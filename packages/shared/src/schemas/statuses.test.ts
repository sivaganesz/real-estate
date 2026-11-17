import { describe, expect, it } from 'vitest';
import {
  canChangeStatus,
  listPropertiesQuerySchema,
  PROPERTY_STATUSES,
  STATUS_TRANSITIONS,
} from './properties';
import type { PropertyStatus } from './properties';

/** PRD v2 PROP-43, written out as a table so a change to the rules is a visible diff. */
const EXPECTED: Record<PropertyStatus, PropertyStatus[]> = {
  draft: ['available', 'archived'],
  available: [
    'under_negotiation',
    'reserved',
    'booked',
    'on_hold',
    'sold',
    'rented',
    'leased',
    'archived',
  ],
  under_negotiation: [
    'available',
    'reserved',
    'booked',
    'on_hold',
    'sold',
    'rented',
    'leased',
    'archived',
  ],
  reserved: ['available', 'booked', 'sold', 'rented', 'leased', 'archived'],
  booked: ['available', 'sold', 'rented', 'leased', 'archived'],
  on_hold: ['available', 'archived'],
  sold: ['available', 'archived'],
  rented: ['available', 'archived'],
  leased: ['available', 'archived'],
  archived: ['draft'],
};

describe('property statuses (PRD v2 §6.8)', () => {
  it('follows the PROP-43 transition table exactly', () => {
    for (const from of PROPERTY_STATUSES) {
      expect([...STATUS_TRANSITIONS[from]].sort(), from).toEqual([...EXPECTED[from]].sort());
    }
  });

  it('closes only with the status that matches the purpose', () => {
    expect(canChangeStatus('available', 'sold', 'sale')).toBe(true);
    expect(canChangeStatus('available', 'rented', 'sale')).toBe(false);
    expect(canChangeStatus('reserved', 'leased', 'lease')).toBe(true);
    expect(canChangeStatus('booked', 'sold', 'rent')).toBe(false);
  });

  it('can never skip the checklist: Draft only goes to Available or Archived', () => {
    for (const to of PROPERTY_STATUSES) {
      expect(canChangeStatus('draft', to, 'sale'), to).toBe(['available', 'archived'].includes(to));
    }
  });

  it('list filters still accept the v1 names for one release', () => {
    expect(listPropertiesQuerySchema.parse({ status: 'published' }).status).toBe('available');
    expect(listPropertiesQuerySchema.parse({ status: 'unpublished' }).status).toBe('on_hold');
    expect(listPropertiesQuerySchema.safeParse({ status: 'nonsense' }).success).toBe(false);
  });
});
