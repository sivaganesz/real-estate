import { Router } from 'express';
import { z } from 'zod';
import { parse } from '../lib/http';
import { confirmProposal, dismissProposal, runAssistant } from '../ai/assistant';
import { aiStatus } from '../ai/client';

export const aiRouter = Router();

const Chat = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(8000) })).min(1).max(40),
  context: z
    .object({
      page: z.string().max(60).optional(),
      entity: z.enum(['property', 'project', 'lead', 'deal']).optional(),
      entityId: z.string().max(40).optional(),
      label: z.string().max(200).optional(),
    })
    .optional(),
});

aiRouter.get('/status', (_req, res) => {
  res.json(aiStatus());
});

aiRouter.post('/chat', async (req, res) => {
  const { messages, context } = parse(Chat, req.body);
  res.json(await runAssistant(messages, context, req.actor));
});

aiRouter.post('/proposals/:id/confirm', async (req, res) => {
  res.json(await confirmProposal(req.params.id, req.actor));
});

aiRouter.post('/proposals/:id/dismiss', async (req, res) => {
  await dismissProposal(req.params.id, req.actor);
  res.json({ ok: true });
});
