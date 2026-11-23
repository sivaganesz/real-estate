import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';

let client: Anthropic | null = null;

/** The assistant uses Claude when a key is configured; otherwise rule-based offline mode. */
export function claude(): Anthropic | null {
  if (!config.anthropicKey) return null;
  client ??= new Anthropic({ apiKey: config.anthropicKey });
  return client;
}

export function aiStatus() {
  return config.anthropicKey
    ? { mode: 'claude' as const, model: config.aiModel }
    : { mode: 'offline' as const, model: null };
}

/** Refusal fallback: if the model declines, the API re-runs the turn on a fallback model. */
export const FALLBACK = {
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default' as const,
};
