import type { ComponentType } from 'react';
import type { Lead } from './lib/leads';

/** Panels later modules add to the lead page and the Leads list (pipeline board, matches, deals). */
export const views: { board: ComponentType<{ owner: string; q: string }> | null } = { board: null };

export const leadSlots = {
  top: [] as ComponentType<{ lead: Lead }>[],
  side: [] as ComponentType<{ lead: Lead }>[],
  actions: [] as ComponentType<{ lead: Lead }>[],
};
