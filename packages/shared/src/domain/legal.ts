/**
 * Legal & documentation checks (PRD v2 §6.6, wireframe LEGAL_DOCS). Each property type has
 * a checklist built from these; each check on a property has one of three statuses.
 * The checks are not interchangeable: a planning approval does not prove ownership.
 */
export const LEGAL_CHECKS = {
  parent_documents: {
    label: 'Parent documents',
    verifies: 'Ownership history (chain of title)',
  },
  sale_deed: { label: 'Sale deed', verifies: 'Current ownership and transaction' },
  encumbrance_certificate: {
    label: 'Encumbrance Certificate (EC)',
    verifies: 'Registered encumbrances within the searched period',
  },
  patta: { label: 'Patta / revenue records', verifies: 'Relevant revenue records' },
  fmb_survey: { label: 'FMB / survey records', verifies: 'Survey boundaries and measurements' },
  land_use: { label: 'Land-use classification', verifies: 'Permitted land use' },
  layout_approval: {
    label: 'Layout approval',
    verifies: 'Applicable planning approval (e.g. DTCP / CMDA / local body)',
  },
  building_plan: { label: 'Building plan approval', verifies: 'Sanctioned building plan' },
  completion_certificate: {
    label: 'Completion / occupancy certificate',
    verifies: 'Building completed as per approval',
  },
  rera: { label: 'RERA registration', verifies: 'Registration or exemption status, as applicable' },
  fire_noc: { label: 'Fire NOC', verifies: 'Fire safety clearance, where applicable' },
  tax_receipts: { label: 'Tax receipts', verifies: 'Property tax / land revenue records' },
} as const satisfies Record<string, { label: string; verifies: string }>;

export type LegalCheckKey = keyof typeof LEGAL_CHECKS;
export const LEGAL_CHECK_KEYS = Object.keys(LEGAL_CHECKS) as LegalCheckKey[];

/** The three statuses a check can have (never "100% legally clear"). */
export const LEGAL_STATUSES = ['not_collected', 'pending', 'verified'] as const;
export type LegalStatus = (typeof LEGAL_STATUSES)[number];
export const LEGAL_STATUS_LABELS: Record<LegalStatus, string> = {
  not_collected: 'Not collected',
  pending: 'Collected, pending verification',
  verified: 'Verified by authorised legal professional',
};

/** One check in a property type's checklist (Settings → Property types). */
export interface LegalChecklistItem {
  key: string;
  label: string;
  verifies: string;
  /** A property with an open mandatory check can never be a top recommendation (R5). */
  mandatory: boolean;
}

/** One check on a property (what the Legal & documents tab edits, R1.5). */
export interface PropertyLegalCheck extends LegalChecklistItem {
  status: LegalStatus;
  verifiedBy: string;
  /** YYYY-MM-DD. */
  date: string | null;
  mediaId: string | null;
  note: string;
}

export interface LegalSummary {
  total: number;
  verified: number;
  pending: number;
  notCollected: number;
  /** Keys of mandatory checks that are not verified yet. */
  openMandatory: string[];
}

/** The counts shown on the list and the detail header (PROP-31). */
export function legalSummary(checks: readonly PropertyLegalCheck[]): LegalSummary {
  return {
    total: checks.length,
    verified: checks.filter((c) => c.status === 'verified').length,
    pending: checks.filter((c) => c.status === 'pending').length,
    notCollected: checks.filter((c) => c.status === 'not_collected').length,
    openMandatory: checks.filter((c) => c.mandatory && c.status !== 'verified').map((c) => c.key),
  };
}

/** A fresh check from a checklist item: not collected yet. */
export function newLegalCheck(item: LegalChecklistItem): PropertyLegalCheck {
  return { ...item, status: 'not_collected', verifiedBy: '', date: null, mediaId: null, note: '' };
}

/**
 * The checks a property should have for a type's checklist (on create, and when the type
 * changes): existing checks keep their status and details (label and mandatory follow the
 * checklist); new ones are added as not collected; checks the checklist no longer has stay,
 * so no collected document is ever lost.
 */
export function mergeLegalChecks(
  existing: readonly PropertyLegalCheck[],
  checklist: readonly LegalChecklistItem[],
): PropertyLegalCheck[] {
  const byKey = new Map(existing.map((c) => [c.key, c]));
  const merged = checklist.map((item) => {
    const had = byKey.get(item.key);
    return had ? { ...had, ...item } : newLegalCheck(item);
  });
  const inChecklist = new Set(checklist.map((i) => i.key));
  return [...merged, ...existing.filter((c) => !inChecklist.has(c.key))];
}

/** Builds checklist items from keys; `mandatory` lists the keys that are mandatory. */
export function legalChecklist(
  keys: readonly LegalCheckKey[],
  mandatory: readonly LegalCheckKey[],
): LegalChecklistItem[] {
  return keys.map((key) => ({ key, ...LEGAL_CHECKS[key], mandatory: mandatory.includes(key) }));
}
