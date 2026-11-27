# Requests — M3 Properties & Matching

## R1 (nice) — share template grammar for one property
`DEFAULT_TEMPLATES` `tpl-share-en` / `tpl-share-hi` read "here are 1 options" when one property is shared. Proposed: add `{{options}}` or use i18n-free plural in `lib/whatsapp.shareMessage` (e.g. pass `count === 1 ? 'an option' : `${count} options``). Owner: foundation (catalogue / lib/whatsapp).

## R2 (nice) — extractor misses the owner's name in "owner Ramesh 98450 12345"
`ai/simulated/extract-property.ts` → `nameIn` does not catch "owner <Name>". Proposed: add `/\b(?:owner|contact|call)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/`. Owner: M7.

## R3 (nice) — LeadSelect / foundation selects switch uncontrolled → controlled
`components/domain/lead-select.tsx` passes `value={undefined}` first; Radix warns when it later gets a value. Proposed: `value={value ?? ''}`. Owner: foundation.

No blocking requests; nothing applied to foundation files. Additive service functions added: `services/properties.ts` → `changePropertiesStatus(ids, status)` and `replaceProperty(id, input, opts)`.

## Integrator status (Phase 3)
- **R1 — APPLIED.** `lib/whatsapp.shareMessage` turns "here are {{count}} options" into "here is 1 option" for one property, also for templates already stored in a browser (test `lib/whatsapp.test.ts`).
- **R2 — APPLIED (by M7).** **R3 — APPLIED (by M4).**
- Review OPEN 1 — APPLIED: the edit form asks before saving a new Booked / Sold status. OPEN 2 — APPLIED: bulk Booked / Sold asks first (`statusConfirm*` keys). OPEN 3 — APPLIED: the table's edit pencil is disabled with the reason on someone else's listing.
