import type { Actor } from '../lib/auth';
import type { AssistantReply } from './assistant';
import type { AssistantContext, ToolCtx } from './tools';

/**
 * Offline mode: when no AI key is configured, common requests still work by
 * matching simple patterns and calling the same tools the AI would use.
 * Each module registers the intents it understands.
 */
export type Intent = {
  name: string;
  /** Higher runs first: intents that depend on the current page beat general ones. */
  priority?: number;
  /** Example shown in the help reply. */
  example: string;
  match: (text: string, ctx: ToolCtx) => unknown | null | undefined | false;
  run: (args: unknown, ctx: ToolCtx, out: AssistantReply) => Promise<string>;
};

const intents: Intent[] = [];

export function registerIntents(...list: Intent[]) {
  intents.push(...list);
}

export async function offlineAssistant(text: string, context: AssistantContext | undefined, actor: Actor): Promise<AssistantReply> {
  const out: AssistantReply = { mode: 'offline', reply: '', records: [], proposals: [], done: [] };
  const ctx: ToolCtx = { actor: { ...actor, viaAI: true }, context };
  const t = text.trim();
  const ordered = [...intents].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  for (const intent of ordered) {
    const args = intent.match(t.toLowerCase(), ctx);
    if (args) {
      out.reply = await intent.run(args, ctx, out);
      return out;
    }
  }
  const examples = intents.slice(0, 6).map((i) => `• ${i.example}`).join('\n');
  out.reply = `I'm running in offline mode (no AI key set), so I understand a fixed set of requests. Try:\n${examples}`;
  return out;
}
