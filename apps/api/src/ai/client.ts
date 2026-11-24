import { ApiError, GoogleGenAI, type Part } from '@google/genai';
import type { ZodTypeAny, z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { config } from '../config';

let client: GoogleGenAI | null = null;

/** The assistant uses Google Gemini when GEMINI_API_KEY is set; otherwise rule-based offline mode. */
export function gemini(): GoogleGenAI | null {
  if (!config.geminiKey) return null;
  // v1beta: the assistant needs function calling and JSON schema output, which v1 doesn't offer for every key type.
  client ??= new GoogleGenAI({ apiKey: config.geminiKey, apiVersion: 'v1beta' });
  return client;
}

export function aiStatus() {
  return config.geminiKey ? { mode: 'gemini' as const, model: config.aiModel } : { mode: 'offline' as const, model: null };
}

/** Gemini wants plain JSON Schema: no $schema, no $ref. */
export function jsonSchema(schema: ZodTypeAny) {
  const s = zodToJsonSchema(schema, { target: 'jsonSchema7', $refStrategy: 'none' }) as Record<string, unknown>;
  delete s.$schema;
  return s;
}

export class AiUnavailable extends Error {}

/**
 * One structured call: the model must answer in the given shape, and the
 * answer is validated again here before anyone sees it.
 */
export async function aiJson<S extends ZodTypeAny>(schema: S, parts: Part[], opts: { system?: string } = {}): Promise<z.infer<S>> {
  const ai = gemini();
  if (!ai) throw new AiUnavailable('No AI key');
  let text: string | undefined;
  try {
    const res = await ai.models.generateContent({
      model: config.aiModel,
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: opts.system,
        responseMimeType: 'application/json',
        responseJsonSchema: jsonSchema(schema),
        temperature: 0.1,
      },
    });
    text = res.text;
  } catch (err) {
    if (err instanceof ApiError) throw new AiUnavailable(`Gemini error ${err.status}`);
    throw err;
  }
  if (!text) throw new AiUnavailable('Empty answer');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AiUnavailable('Answer was not JSON');
  }
  const r = schema.safeParse(parsed);
  if (!r.success) throw new AiUnavailable('Answer did not match the expected shape');
  return r.data;
}
