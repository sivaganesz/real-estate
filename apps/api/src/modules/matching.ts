import { Router } from 'express';
import { z } from 'zod';
import { formatINR } from '@estate/shared';
import { parse } from '../lib/http';
import { bestMatchesToday, leadsForProperty, matchesForLead, rateShortlist, shareWithLead, shortlistOf } from '../services/matching';
import { getLeadFor, leadRef } from '../services/leads';
import { propertyRef } from '../services/properties';
import { registerTools } from '../ai/tools';
import { registerIntents } from '../ai/offline';
import { callTool } from '../ai/assistant';
import { Lead } from '../models/lead';

export const matchingRouter = Router();

matchingRouter.get('/lead/:id', async (req, res) => {
  res.json(await matchesForLead(String(req.params.id), req.actor, { limit: Number(req.query.limit ?? 6), includeShared: req.query.all !== 'false' }));
});
matchingRouter.get('/property/:id', async (req, res) => {
  res.json({ items: await leadsForProperty(String(req.params.id), req.actor) });
});
matchingRouter.get('/today', async (req, res) => {
  res.json({ items: await bestMatchesToday(req.actor) });
});
matchingRouter.get('/shortlist/:leadId', async (req, res) => {
  res.json({ items: await shortlistOf(String(req.params.leadId), req.actor) });
});
matchingRouter.post('/shortlist/:leadId', async (req, res) => {
  const b = parse(z.object({ propertyId: z.string(), status: z.enum(['liked', 'rejected', 'shared']) }), req.body);
  await rateShortlist(String(req.params.leadId), b.propertyId, b.status, req.actor);
  res.json({ ok: true });
});
matchingRouter.post('/share/:leadId', async (req, res) => {
  const b = parse(z.object({ propertyIds: z.array(z.string()).min(1).max(10) }), req.body);
  const origin = req.get('origin') ?? `${req.protocol}://${req.get('host')}`;
  res.json(await shareWithLead(String(req.params.leadId), b.propertyIds, req.actor, { origin }));
});

const reasonText = (r: { ok: string; text: string }[]) => r.map((x) => `${x.ok === 'yes' ? '✓' : x.ok === 'near' ? '≈' : x.ok === 'no' ? '✗' : '•'} ${x.text}`).join('; ');

registerTools(
  {
    name: 'match_properties_for_lead',
    kind: 'read',
    permission: 'property.view',
    description:
      "Properties that fit a customer's requirement, best first, each with a fit label (strong/good/partial) and the reasons (✓ fits, ≈ close, ✗ doesn't). Excludes what they rejected; marks what was already shared. Explain matches with these reasons; never invent a score.",
    schema: z.object({ leadId: z.string(), includeAlreadyShared: z.boolean().optional() }),
    run: async ({ leadId, includeAlreadyShared }, { actor }) => {
      const r = await matchesForLead(leadId, actor, { limit: 6, includeShared: includeAlreadyShared ?? true });
      return {
        data: { requirementComplete: r.qualified, total: r.total, matches: r.items.map((m) => ({ propertyId: m.property.id, title: m.property.title, price: formatINR(m.property.price as number), fit: m.fit, why: reasonText(m.reasons) })) },
        records: r.items.map((m) => propertyRef({ ...m.property, _id: m.property.id } as never)),
      };
    },
  },
  {
    name: 'match_leads_for_property',
    kind: 'read',
    permission: 'lead.create',
    description: 'Open customers (in the user\'s scope) whose requirement fits a property, best first, with fit label and reasons.',
    schema: z.object({ propertyId: z.string() }),
    run: async ({ propertyId }, { actor }) => {
      const items = await leadsForProperty(propertyId, actor);
      return {
        data: items.map((i) => ({ leadId: i.lead.id, name: i.lead.name, stage: i.lead.stage, owner: i.lead.owner, fit: i.fit, why: reasonText(i.reasons) })),
        records: items.map((i) => ({ kind: 'lead' as const, id: i.lead.id, title: i.lead.name, subtitle: `${i.fit} fit` })),
      };
    },
  },
  {
    name: 'share_properties_with_lead',
    kind: 'write',
    permission: 'property.share',
    description: 'Record that properties are being shared with a customer and get buyer links plus a ready WhatsApp message. It logs on their timeline; the user still sends the message.',
    schema: z.object({ leadId: z.string(), propertyIds: z.array(z.string()).min(1).max(10) }),
    run: async ({ leadId, propertyIds }, { actor }) => {
      const r = await shareWithLead(leadId, propertyIds, actor);
      const lead = await getLeadFor(leadId, actor);
      return { data: { message: r.message, links: r.links }, records: [leadRef(lead)], done: `Shared ${propertyIds.length} with ${lead.name} (logged)` };
    },
  },
);

registerIntents(
  {
    name: 'matches-for-lead',
    priority: 10,
    example: 'Find properties matching this customer (on a lead page)',
    match: (t, ctx) => /\b(match|fit|suit|options|properties|recommend)/.test(t) && (ctx.context?.entity === 'lead' ? ctx.context.entityId : /\bfor ([a-z]+)/.test(t) && t),
    run: async (arg, ctx, out) => {
      let leadId = ctx.context?.entity === 'lead' ? ctx.context.entityId : undefined;
      if (!leadId) {
        const name = (arg as string).match(/\bfor ([a-z]+(?: [a-z]+)?)/)?.[1];
        const l = name ? await Lead.findOne({ name: new RegExp(name, 'i') }).lean() : null;
        if (!l) return "Whose requirement? Open the customer's page and ask there.";
        leadId = String(l._id);
      }
      const r = await callTool('match_properties_for_lead', { leadId }, ctx, out);
      if (r.is_error) return r.content;
      const d = JSON.parse(r.content) as { requirementComplete: boolean; total: number; matches: { title: string; price: string; fit: string; why: string }[] };
      if (!d.total) return d.requirementComplete ? 'Nothing live fits right now. Widen the budget or areas, or check again after new listings.' : 'Their requirement is incomplete (budget, location or type), so matches would be guesses. Fill those in first.';
      return `${d.total} fit. Best:\n${d.matches.slice(0, 4).map((m) => `• **${m.title}** — ${m.price}, ${m.fit} fit\n  ${m.why}`).join('\n')}`;
    },
  },
  {
    name: 'leads-for-property',
    priority: 10,
    example: 'Which leads would like this property? (on a property page)',
    match: (t, ctx) => /\b(leads?|buyers?|customers?|who)\b/.test(t) && /\b(fit|match|like|interest|want)/.test(t) && ctx.context?.entity === 'property' && ctx.context.entityId,
    run: async (id, ctx, out) => {
      const r = await callTool('match_leads_for_property', { propertyId: id }, ctx, out);
      if (r.is_error) return r.content;
      const d = JSON.parse(r.content) as { name: string; fit: string; why: string; owner: string }[];
      if (!d.length) return 'No open customer fits this one right now.';
      return d.slice(0, 5).map((m) => `• **${m.name}** (${m.fit} fit${ctx.actor.role !== 'executive' && m.owner ? `, ${m.owner}` : ''}) — ${m.why}`).join('\n');
    },
  },
);
