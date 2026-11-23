import { ApiError, FinishReason, FunctionCallingConfigMode, type Content, type Part } from '@google/genai';
import { ROLE_LABEL } from '@estate/shared';
import { gemini } from './client';
import { config } from '../config';
import { getTool, toFunctionDeclaration, toolsFor, type AssistantContext, type RecordRef, type ToolCtx } from './tools';
import { Proposal } from '../models/proposal';
import { offlineAssistant } from './offline';
import type { Actor } from '../lib/auth';
import { HttpError } from '../lib/http';

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export type AssistantReply = {
  mode: 'gemini' | 'offline';
  reply: string;
  records: RecordRef[];
  proposals: { id: string; summary: string }[];
  done: string[];
};

const SYSTEM = `You are the assistant inside EstateOS, a real-estate sales and inventory app used by an Indian real-estate business. You help admins, sales managers and sales executives get their work done.

How you work:
- Answer only from data returned by your tools. Never invent properties, prices, people, dates or numbers. If the tools return nothing, say so plainly and suggest what the user could do.
- When a request is ambiguous or a required detail is missing (for example a time for a follow-up, or which lead), ask one short question instead of guessing.
- Tools marked as needing confirmation only create a proposal. Say clearly that it is waiting for their confirmation; never say it is done.
- Tools that change data straight away are done once they return; say what you did in one line.
- You can only use the tools you are given; they already reflect the user's role. If the user asks for something outside their role, say who can do it.
- Money is in Indian rupees. Write amounts as ₹45 L, ₹1.2 Cr or ₹25,000. Dates in a friendly form ("Tue 4 Mar, 11 am"). Times you send to tools are ISO 8601 with +05:30.
- Be brief and practical: short paragraphs or a few bullets. Name the records you relied on; the app shows them as links under your reply, so do not paste IDs.
- When drafting a message to a customer, write it ready to send (WhatsApp tone, warm, short), and only mention facts from the records.
- If something in a record looks inconsistent (price per sq.ft far off, missing key detail), point it out.`;

function contextLine(ctx?: AssistantContext) {
  if (!ctx?.page) return '';
  const on = ctx.entity && ctx.entityId ? ` The user is looking at ${ctx.entity} "${ctx.label ?? ''}" (id ${ctx.entityId}); "this", "him/her", "them" or "it" refers to it.` : '';
  return `[Screen: ${ctx.page}.${on}]\n`;
}

/**
 * The assistant loop on Google Gemini: the model may call our tools (only
 * those the user's role allows), we run them on the user's behalf, and feed
 * the results back until it answers.
 */
export async function runAssistant(turns: ChatTurn[], context: AssistantContext | undefined, actor: Actor): Promise<AssistantReply> {
  const last = turns.at(-1);
  if (!last || last.role !== 'user' || !last.content.trim()) throw new HttpError(400, 'Ask me something');
  const ai = gemini();
  if (!ai) return offlineAssistant(last.content, context, actor);

  const ctx: ToolCtx = { actor: { ...actor, viaAI: true }, context };
  const tools = toolsFor(actor);
  const out: AssistantReply = { mode: 'gemini', reply: '', records: [], proposals: [], done: [] };

  const now = new Date();
  const system = `${SYSTEM}\n\nSigned-in user: ${actor.name}, ${ROLE_LABEL[actor.role]} (id ${actor.id}). Today is ${now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} IST.`;

  const contents: Content[] = turns.slice(-12).map((t, i, arr) => ({
    role: t.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: i === arr.length - 1 ? contextLine(context) + t.content : t.content }],
  }));
  // The conversation must start with the user.
  while (contents.length && contents[0].role !== 'user') contents.shift();

  for (let step = 0; step < 8; step++) {
    let res;
    try {
      res = await ai.models.generateContent({
        model: config.aiModel,
        contents,
        config: {
          systemInstruction: system,
          tools: [{ functionDeclarations: tools.map(toFunctionDeclaration) }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
          temperature: 0.2,
        },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) throw new HttpError(429, 'The assistant is busy right now. Try again in a moment.');
        if (err.status === 401 || err.status === 403 || (err.status === 400 && /api key/i.test(err.message))) throw new HttpError(503, 'The Gemini key is not valid. Ask an admin to check GEMINI_API_KEY.');
        throw new HttpError(502, 'The assistant could not answer just now. Please try again.');
      }
      throw err;
    }

    const candidate = res.candidates?.[0];
    if (candidate?.finishReason === FinishReason.SAFETY || res.promptFeedback?.blockReason) {
      out.reply = "I can't help with that request.";
      break;
    }
    const calls = res.functionCalls ?? [];
    if (!calls.length) {
      out.reply = res.text?.trim() || out.reply || 'I could not find an answer to that.';
      break;
    }
    // Echo the model's turn back exactly (it can carry thought signatures).
    contents.push(candidate?.content ?? { role: 'model', parts: calls.map((c) => ({ functionCall: c })) });
    const responses: Part[] = [];
    for (const call of calls) {
      const r = await callTool(call.name ?? '', call.args ?? {}, ctx, out);
      responses.push({ functionResponse: { id: call.id, name: call.name, response: r.is_error ? { error: r.content } : { result: safeJson(r.content) } } });
    }
    contents.push({ role: 'user', parts: responses });
    if (step === 7) out.reply = 'I ran out of steps for this request. Could you narrow it down?';
  }

  out.records = dedupe(out.records);
  return out;
}

function safeJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

/** Runs one tool on the user's behalf, enforcing role permissions again server-side. */
export async function callTool(name: string, rawInput: unknown, ctx: ToolCtx, out: AssistantReply): Promise<{ content: string; is_error?: boolean }> {
  const tool = getTool(name);
  if (!tool || !toolsFor(ctx.actor).includes(tool)) return { content: 'Tool not available for this user.', is_error: true };
  const parsed = tool.schema.safeParse(rawInput);
  if (!parsed.success) return { content: `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`, is_error: true };
  try {
    if (tool.kind === 'confirm') {
      const preview = await tool.preview(parsed.data, ctx);
      const p = await Proposal.create({ actorId: ctx.actor.id, tool: tool.name, input: parsed.data, summary: preview.summary });
      out.proposals.push({ id: String(p._id), summary: preview.summary });
      out.records.push(...(preview.records ?? []));
      return { content: JSON.stringify({ status: 'waiting_for_user_confirmation', summary: preview.summary }) };
    }
    const r = await tool.run(parsed.data, ctx);
    out.records.push(...(r.records ?? []));
    if (r.done) out.done.push(r.done);
    return { content: JSON.stringify(r.data ?? null) };
  } catch (err) {
    const msg = err instanceof HttpError ? err.message : 'The tool failed';
    if (!(err instanceof HttpError)) console.error(`[ai tool ${name}]`, err);
    return { content: msg, is_error: true };
  }
}

export async function confirmProposal(id: string, actor: Actor) {
  const p = await Proposal.findOne({ _id: id, actorId: actor.id });
  if (!p) throw new HttpError(404, 'This suggestion has expired');
  if (p.status !== 'pending') throw new HttpError(409, `This suggestion was already ${p.status}`);
  const tool = getTool(p.tool);
  if (!tool || tool.kind !== 'confirm' || !toolsFor(actor).includes(tool)) throw new HttpError(403, 'Your role does not allow this action');
  try {
    const r = await tool.execute(tool.schema.parse(p.input), { actor: { ...actor, viaAI: true } });
    p.status = 'confirmed';
    p.result = r.done ?? 'Done';
    await p.save();
    return { done: p.result, records: r.records ?? [] };
  } catch (err) {
    p.status = 'failed';
    p.result = err instanceof Error ? err.message : 'Failed';
    await p.save();
    throw err;
  }
}

export async function dismissProposal(id: string, actor: Actor) {
  await Proposal.updateOne({ _id: id, actorId: actor.id, status: 'pending' }, { status: 'dismissed' });
}

function dedupe(records: RecordRef[]) {
  const seen = new Set<string>();
  return records
    .filter((r) => {
      const k = `${r.kind}:${r.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 12);
}
