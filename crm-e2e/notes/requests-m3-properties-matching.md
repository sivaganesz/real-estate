# Requests — M3 Properties & Matching

## R1 (nice) — share template grammar for one property
`DEFAULT_TEMPLATES` `tpl-share-en` / `tpl-share-hi` read "here are 1 options" when one property is shared. Proposed: add `{{options}}` or use i18n-free plural in `lib/whatsapp.shareMessage` (e.g. pass `count === 1 ? 'an option' : `${count} options``). Owner: foundation (catalogue / lib/whatsapp).

## R2 (nice) — extractor misses the owner's name in "owner Ramesh 98450 12345"
`ai/simulated/extract-property.ts` → `nameIn` does not catch "owner <Name>". Proposed: add `/\b(?:owner|contact|call)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/`. Owner: M7.

## R3 (nice) — LeadSelect / foundation selects switch uncontrolled → controlled
`components/domain/lead-select.tsx` passes `value={undefined}` first; Radix warns when it later gets a value. Proposed: `value={value ?? ''}`. Owner: foundation.

No blocking requests; nothing applied to foundation files. Additive service functions added: `services/properties.ts` → `changePropertiesStatus(ids, status)` and `replaceProperty(id, input, opts)`.
