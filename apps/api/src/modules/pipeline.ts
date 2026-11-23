import { Router } from 'express';
import { z } from 'zod';
import { LEAD_SOURCE_LABEL, LOST_REASONS, STAGES, STAGE_META, type Stage } from '@estate/shared';
import { parse } from '../lib/http';
import { board, insights, moveStage } from '../services/pipeline';
import { leadRef, serialiseLead } from '../services/leads';
import { registerTools } from '../ai/tools';
import { registerIntents } from '../ai/offline';
import { callTool } from '../ai/assistant';
import { User } from '../models/user';

export const pipelineRouter = Router();

pipelineRouter.get('/board', async (req, res) => {
  res.json({ columns: await board(req.actor, { ownerId: (req.query.owner as string) || undefined, q: (req.query.q as string) || undefined }) });
});

pipelineRouter.get('/insights', async (req, res) => {
  res.json(await insights(req.actor, { days: req.query.days ? Number(req.query.days) : undefined, ownerId: (req.query.owner as string) || undefined }));
});

const Move = z.object({ to: z.enum(STAGES), reason: z.string().optional(), note: z.string().max(500).optional(), propertyId: z.string().optional() });

pipelineRouter.post('/move/:id', async (req, res) => {
  const body = parse(Move, req.body);
  const lead = await moveStage(String(req.params.id), body.to, req.actor, body);
  res.json({ lead: serialiseLead(lead as never) });
});

registerTools(
  {
    name: 'move_lead_stage',
    kind: 'write',
    permission: 'lead.editOwn',
    description: `Move a lead to another pipeline stage. Stages: ${STAGES.join(', ')}. Forward moves need evidence (a logged conversation; budget, location and type for qualified; a site visit for visit; a property for negotiation). "booked" only happens through a booking. "lost" needs one of these reasons: ${LOST_REASONS.join(', ')}. If the move is refused, tell the user what is missing.`,
    schema: Move.extend({ leadId: z.string() }),
    run: async ({ leadId, ...m }, { actor }) => {
      const l = await moveStage(leadId, m.to, actor, m);
      return { data: { ok: true, stage: l.stage }, records: [leadRef(l)], done: `${l.name} → ${STAGE_META[l.stage as Stage].label}` };
    },
  },
  {
    name: 'pipeline_insights',
    kind: 'read',
    permission: 'lead.create',
    description:
      'Pipeline health over the last N days (default 90): funnel counts, stage-to-stage conversion and the weakest step, leads stuck per stage with average days, lost reasons and the stage they were lost at, lead sources and their booking rate, and per-executive open/stuck/overdue/no-next-step counts. Executives see their own pipeline only.',
    schema: z.object({ days: z.number().int().min(7).max(365).optional(), ownerName: z.string().optional() }),
    run: async ({ days, ownerName }, { actor }) => {
      let ownerId: string | undefined;
      if (ownerName) ownerId = String((await User.findOne({ name: new RegExp(ownerName, 'i') }).lean())?._id ?? '');
      const r = await insights(actor, { days, ownerId });
      return { data: { ...r, sources: r.sources.map((s) => ({ ...s, source: LEAD_SOURCE_LABEL[s.source as keyof typeof LEAD_SOURCE_LABEL] ?? s.source })) } };
    },
  },
);

registerIntents({
  name: 'pipeline-health',
  example: 'Where are deals getting stuck?',
  match: (t) => /\b(stuck|stall|conversion|funnel|pipeline|leak|losing|lost reasons?|why .* lost)\b/.test(t) && !/\b(show|list)\b.*\bleads\b/.test(t),
  run: async (_a, ctx, out) => {
    const r = await callTool('pipeline_insights', {}, ctx, out);
    if (r.is_error) return r.content;
    const d = JSON.parse(r.content) as Awaited<ReturnType<typeof insights>>;
    const stuck = d.stuck.filter((s) => s.stuck > 0).sort((a, b) => b.stuck - a.stuck);
    const lines = [
      `Last ${d.days} days: ${d.total} leads, ${d.booked} booked (${d.overallRate}%).`,
      d.weakest ? `Weakest step: **${d.weakest.from} → ${d.weakest.to}** at ${d.weakest.rate}%.` : '',
      stuck.length ? `Stuck now:\n${stuck.map((s) => `• ${s.label}: ${s.stuck} of ${s.open} past ${s.limit} day${s.limit > 1 ? 's' : ''} (avg ${s.avgDays} days)`).join('\n')}` : 'Nothing is stuck right now.',
      d.lostReasons.length ? `Top lost reasons: ${d.lostReasons.slice(0, 3).map((l) => `${l.reason} (${l.count})`).join(', ')}.` : '',
    ];
    return lines.filter(Boolean).join('\n');
  },
});
