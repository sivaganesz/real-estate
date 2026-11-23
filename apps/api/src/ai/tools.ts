import type { ZodTypeAny, z } from 'zod';
import type { FunctionDeclaration } from '@google/genai';
import { jsonSchema } from './client';
import { can, type Permission } from '@estate/shared';
import type { Actor } from '../lib/auth';

/** A record the answer is based on; the UI shows these as links under the reply. */
export type RecordRef = { kind: 'property' | 'project' | 'lead' | 'deal' | 'activity' | 'user'; id: string; title: string; subtitle?: string };

export type ToolResult = {
  /** What the model reads. Keep it compact. */
  data: unknown;
  records?: RecordRef[];
  /** Set when the tool changed data: a past-tense line the UI shows as "done". */
  done?: string;
};

export type ToolCtx = { actor: Actor; context?: AssistantContext };

export type AssistantContext = { page?: string; entity?: 'property' | 'project' | 'lead' | 'deal'; entityId?: string; label?: string };

type Base<S extends ZodTypeAny> = {
  name: string;
  description: string;
  schema: S;
  permission?: Permission;
};

/** read: looks things up. write: safe, reversible change done straight away. */
export type DirectTool<S extends ZodTypeAny = ZodTypeAny> = Base<S> & {
  kind: 'read' | 'write';
  run: (input: z.infer<S>, ctx: ToolCtx) => Promise<ToolResult>;
};

/** confirm: consequential (publish, reassign, discount, booking). The AI proposes; a person confirms. */
export type ConfirmTool<S extends ZodTypeAny = ZodTypeAny> = Base<S> & {
  kind: 'confirm';
  /** Validates and describes the change without making it. Throw to refuse. */
  preview: (input: z.infer<S>, ctx: ToolCtx) => Promise<{ summary: string; records?: RecordRef[] }>;
  execute: (input: z.infer<S>, ctx: ToolCtx) => Promise<ToolResult>;
};

export type AiTool = DirectTool | ConfirmTool;

const registry = new Map<string, AiTool>();

export function registerTools(...tools: AiTool[]) {
  for (const t of tools) registry.set(t.name, t);
}

export function getTool(name: string) {
  return registry.get(name);
}

/** Only the tools this person's role allows are ever shown to the model. */
export function toolsFor(actor: Actor): AiTool[] {
  return [...registry.values()]
    .filter((t) => !t.permission || can(actor.role, t.permission))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function toFunctionDeclaration(t: AiTool): FunctionDeclaration {
  const suffix = t.kind === 'confirm' ? ' This does NOT happen immediately: it creates a proposal the user must confirm.' : '';
  return { name: t.name, description: t.description + suffix, parametersJsonSchema: jsonSchema(t.schema) };
}
