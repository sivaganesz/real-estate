import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Express } from 'express';

/**
 * The Gemini path, with a scripted fake client in place of the real API:
 * it proves the tool loop, role filtering, confirmations and structured
 * extraction work end to end without spending a key.
 */
const script: { calls: unknown[]; replies: unknown[] } = { calls: [], replies: [] };
vi.mock('@google/genai', async (orig) => {
  const real = await orig<typeof import('@google/genai')>();
  class FakeGenAI {
    models = {
      generateContent: async (params: unknown) => {
        script.calls.push(JSON.parse(JSON.stringify(params)));
        const next = script.replies.shift();
        if (!next) throw new Error('no scripted reply');
        return next;
      },
    };
  }
  return { ...real, GoogleGenAI: FakeGenAI };
});

const { config } = await import('../src/config');
const { setup, teardown, login, EMAIL } = await import('./helpers');

const say = (text: string) => ({ text, functionCalls: undefined, candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }] });
const call = (name: string, args: Record<string, unknown>) => ({ text: undefined, functionCalls: [{ id: 'c1', name, args }], candidates: [{ content: { role: 'model', parts: [{ functionCall: { id: 'c1', name, args }, thoughtSignature: 'sig' }] }, finishReason: 'STOP' }] });

let app: Express;
beforeAll(async () => {
  config.geminiKey = 'test-key';
  app = await setup();
});
afterAll(async () => {
  config.geminiKey = '';
  await teardown();
});
beforeEach(() => {
  script.calls = [];
  script.replies = [];
});

describe('assistant on Gemini', () => {
  it('runs tools for the user and answers from their results', async () => {
    const priya = await login(app, EMAIL.priya);
    script.replies.push(call('search_properties', { types: ['plot'], budgetMax: 4_000_000, availability: ['available'] }), say('Found Sunrise Enclave plots at ₹36 L.'));
    const r = await priya.post('/api/ai/chat').send({ messages: [{ role: 'user', content: 'plots under 40 lakhs' }] });
    expect(r.body).toMatchObject({ mode: 'gemini', reply: 'Found Sunrise Enclave plots at ₹36 L.' });
    expect(r.body.records.length).toBeGreaterThan(0);
    const first = script.calls[0] as { config: { tools: { functionDeclarations: { name: string; parametersJsonSchema: { $schema?: string } }[] }[] } };
    const names = first.config.tools[0].functionDeclarations.map((f) => f.name);
    expect(names).toContain('search_properties');
    expect(names).not.toContain('publish_property'); // not an executive's tool
    expect(first.config.tools[0].functionDeclarations[0].parametersJsonSchema.$schema).toBeUndefined();
    // The model's own turn (with its thought signature) is echoed back, then the tool result.
    const second = script.calls[1] as { contents: { role: string; parts: Record<string, unknown>[] }[] };
    expect(second.contents.at(-2)!.parts[0].thoughtSignature).toBe('sig');
    expect(second.contents.at(-1)!.parts[0].functionResponse).toMatchObject({ id: 'c1', name: 'search_properties' });
  });

  it('refuses a tool the role does not have, even if the model asks for it', async () => {
    const priya = await login(app, EMAIL.priya);
    const p = (await priya.get('/api/properties?q=Velachery&smart=false')).body.items[0];
    script.replies.push(call('publish_property', { propertyId: p.id }), say('You cannot publish; ask a manager.'));
    const r = await priya.post('/api/ai/chat').send({ messages: [{ role: 'user', content: 'publish it' }] });
    expect(r.body.proposals).toEqual([]);
    const second = script.calls[1] as { contents: { parts: { functionResponse?: { response: { error?: string } } }[] }[] };
    expect(second.contents.at(-1)!.parts[0].functionResponse!.response.error).toMatch(/not available/);
  });

  it('turns consequential actions into proposals the user confirms', async () => {
    const manager = await login(app, EMAIL.manager);
    const lead = (await manager.get('/api/leads?q=Hariharan')).body.items[0];
    script.replies.push(call('assign_lead', { leadId: lead.id, ownerName: 'Divya' }), say('Ready to assign — please confirm.'));
    const r = await manager.post('/api/ai/chat').send({ messages: [{ role: 'user', content: 'give Hariharan to Divya' }] });
    expect(r.body.proposals[0].summary).toBe('Assign Hariharan V to Divya Raman');
    expect((await manager.get(`/api/leads/${lead.id}`)).body.lead.ownerName).toBeNull();
    await manager.post(`/api/ai/proposals/${r.body.proposals[0].id}/confirm`).expect(200);
    expect((await manager.get(`/api/leads/${lead.id}`)).body.lead.ownerName).toBe('Divya Raman');
  });

  it('reads a description into fields with structured JSON, checked by code', async () => {
    const manager = await login(app, EMAIL.manager);
    const json = {
      properties: [
        {
          type: 'apartment', purpose: 'sale', title: '3 BHK in Porur', price: 9_000_000, priceNegotiable: true, area: 1400, areaUnit: 'sqft', city: 'Chennai', locality: 'Porur', address: null, pincode: null,
          details: [{ key: 'bedrooms', value: 3 }, { key: 'floor', value: 6 }], amenities: ['Lift'], highlights: [], description: null, approvals: ['RERA'], extras: [],
          sources: [{ field: 'price', quote: '90 lakhs' }], unsure: [],
        },
      ],
    };
    script.replies.push({ text: JSON.stringify(json) });
    const r = await manager.post('/api/properties/extract').send({ text: '3 BHK Porur 1400 sqft 6th floor 90 lakhs negotiable RERA lift' });
    expect(r.body.mode).toBe('gemini');
    expect(r.body.properties[0]).toMatchObject({ price: 9_000_000, details: { bedrooms: 3, floor: 6 }, sources: { price: '90 lakhs' }, readiness: { ready: true } });
    const sent = script.calls[0] as { config: { responseMimeType: string; responseJsonSchema: object } };
    expect(sent.config.responseMimeType).toBe('application/json');
  });

  it('falls back to rules when Gemini returns something unusable', async () => {
    const manager = await login(app, EMAIL.manager);
    script.replies.push({ text: 'not json' });
    const r = await manager.post('/api/leads/parse-requirement').send({ text: '2 BHK in Porur under 70 lakhs' });
    expect(r.body.mode).toBe('offline');
    expect(r.body.requirement).toMatchObject({ bedrooms: 2, budgetMax: 7_000_000 });
  });
});
