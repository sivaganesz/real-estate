# Requests — M2 Leads, Qualification & Clients

| # | What | Why | Proposed code | Urgency | Status |
|---|---|---|---|---|---|
| R1 | `components/shared/drawer.tsx`: the width classes lose to the Sheet primitive's `data-[side=right]:w-3/4 data-[side=right]:sm:max-w-sm`, so every 480 / 640 px drawer renders ~384 px wide. | DESIGN_SYSTEM §11.8 widths; forms in drawers are cramped. | Replace `size === 'lg' ? 'w-[640px] sm:max-w-[640px]' : 'w-[480px] sm:max-w-[480px]'` with `size === 'lg' ? 'data-[side=right]:w-[640px] data-[side=right]:sm:max-w-[640px]' : 'data-[side=right]:w-[480px] data-[side=right]:sm:max-w-[480px]'`. | nice (M2 works around it with a className on its own Drawer) | open |
| R2 | `app/paths.ts`: `leads(opts?: { tab?: 'overdue' \| 'today' \| 'upcoming' \| 'unassigned' \| 'closed'; view?: 'focus' \| 'table' \| 'cards'; add?: '1' })` | Today / notifications can deep-link to the Unassigned tab or open the Add lead sheet. The Leads page already reads `?tab=`, `?view=` and `?add=1`. | `leads: (opts: { tab?: string; view?: string; add?: string } = {}) => \`/leads${q(opts)}\`` (existing calls without args unchanged) | nice | open |
| R3 | `components/ai/ai-field.tsx`: `ai && '-mx-2 px-2'` bleeds 8 px past grid cells and drawer padding. | Visual polish in two-column forms. | Use `px-2 py-1.5` with an inset ring instead of negative margins, or let callers opt out. | nice | open |

Additive service functions added (allowed by plan §8.2, not requests):
- `services/leads.ts`: `LeadFieldPatch`, `updateLeadFields()` (partial requirement / qualification patches, merged by the existing `mergePatch`).
- `services/clients.ts`: `changeClientStatus()` (undoable), `removeClientDocument()` (undoable), `addClientDocuments()` (undoable).

## Integrator status (Phase 3)
- **R1 — APPLIED.** `components/shared/drawer.tsx` widths are prefixed `data-[side=right]:` so 480 / 640 px drawers render at their width (phones full width).
- **R2 — APPLIED** (wider than asked): `paths.leads(LeadListParams)` with tab / view / add plus filter params (stage, source, owner, temp, lostReason, attn); the Leads page applies them and drops them once the user edits the filters.
- **R3 — APPLIED (by M7).**
- Review OPEN 1–4 (phone KPI labels, tab strip clipping, phone column order, narrow search at 1440): handed to the UI unifier (layout polish, no behaviour change).
