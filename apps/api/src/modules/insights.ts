import { Router } from 'express';
import { z } from 'zod';
import { formatINR } from '@estate/shared';
import { interestByProperty, interestRef, projectMovement } from '../services/insights';
import { registerTools } from '../ai/tools';
import { registerIntents } from '../ai/offline';
import { callTool } from '../ai/assistant';

export const insightsRouter = Router();

insightsRouter.get('/interest', async (_req, res) => {
  res.json(await interestByProperty());
});
insightsRouter.get('/movement', async (req, res) => {
  res.json(await projectMovement(req.query.days ? Number(req.query.days) : 90));
});

registerTools(
  {
    name: 'property_interest',
    kind: 'read',
    permission: 'property.view',
    description: 'Which live properties draw the most interest (direct enquiries, times shared with customers, visits/likes, negotiations), and which available standalone listings nobody is engaging with.',
    schema: z.object({}),
    run: async () => {
      const r = await interestByProperty();
      const row = (x: (typeof r.top)[number]) => ({ title: x.property.title, price: formatINR(x.property.price), enquiries: x.enquiries, sharedWithCustomers: x.shared, visitedOrLiked: x.visited, negotiations: x.deals, availability: x.property.availability });
      return { data: { mostInterest: r.top.map(row), littleInterest: r.ignored.map(row) }, records: r.top.slice(0, 6).map(interestRef) };
    },
  },
  {
    name: 'project_movement',
    kind: 'read',
    permission: 'property.view',
    description: 'How fast each project is selling: units booked or sold in the last N days (default 90), units still available, sales per month and months of stock left at that pace. Flags slow movers.',
    schema: z.object({ days: z.number().int().min(30).max(365).optional() }),
    run: async ({ days }) => {
      const r = await projectMovement(days);
      return { data: r, records: r.projects.map((p) => ({ kind: 'project' as const, id: p.id, title: p.name, subtitle: p.slow ? 'slow' : `${p.perMonth}/month` })) };
    },
  },
);

registerIntents(
  {
    name: 'most-interest',
    example: 'Which properties receive the most enquiries?',
    match: (t) => /\b(most|popular|top|least|no one|nobody)\b.*\b(enquir|interest|asked|demand)/.test(t) || /\bpopular properties\b/.test(t),
    run: async (_a, ctx, out) => {
      const r = await callTool('property_interest', {}, ctx, out);
      const d = JSON.parse(r.content) as { mostInterest: { title: string; enquiries: number; sharedWithCustomers: number; negotiations: number }[]; littleInterest: { title: string }[] };
      return [
        `**Most interest**\n${d.mostInterest.slice(0, 6).map((p) => `• ${p.title} — ${p.enquiries} enquiries, shared ${p.sharedWithCustomers}×${p.negotiations ? `, ${p.negotiations} negotiation${p.negotiations > 1 ? 's' : ''}` : ''}`).join('\n')}`,
        d.littleInterest.length ? `**Little interest** (available, rarely asked about): ${d.littleInterest.slice(0, 5).map((p) => p.title).join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');
    },
  },
  {
    name: 'project-movement',
    example: 'Which projects have low inventory movement?',
    match: (t) => /\b(slow|low|moving|movement|selling|sell[\s-]?through|stock)\b/.test(t) && /\b(projects?|inventory|units?)\b/.test(t),
    run: async (_a, ctx, out) => {
      const r = await callTool('project_movement', {}, ctx, out);
      const d = JSON.parse(r.content) as Awaited<ReturnType<typeof projectMovement>>;
      return `Last ${d.days} days:\n${d.projects
        .map((p) => `• **${p.name}**${p.slow ? ' ⚠ slow' : ''} — ${p.movedInWindow} sold/booked, ${p.available} available${p.monthsOfStock ? `, ~${p.monthsOfStock} months of stock at this pace` : p.available ? ', no sales in this period' : ''}`)
        .join('\n')}`;
    },
  },
);
