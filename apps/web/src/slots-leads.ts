import type { ComponentType } from 'react';
import type { Lead } from './lib/leads';

/** Panels later modules add to the lead page and the Leads list (pipeline board, matches, deals). */
export const views: { board: ComponentType<{ owner: string; q: string }> | null } = { board: null };

export const leadSlots = {
  /** Inside the customer's header, under the key facts (the stage steps). */
  hero: [] as ComponentType<{ lead: Lead }>[],
  top: [] as ComponentType<{ lead: Lead }>[],
  /** Under the stage: what's planned next. */
  next: [] as ComponentType<{ lead: Lead }>[],
  /** Sections of the profile card on the right (each draws its own top border). */
  side: [] as ComponentType<{ lead: Lead }>[],
  actions: [] as ComponentType<{ lead: Lead }>[],
  /** Extra tabs on the lead page, after Activity. `useCount` is a hook for the number beside the name. */
  tabs: [] as { key: string; label: string; useCount?: (lead: Lead) => number | undefined; C: ComponentType<{ lead: Lead }> }[],
};
