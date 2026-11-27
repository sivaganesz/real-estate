# Requests — M1 Today & Reports

## R1 (nice) — filter params on list paths
**What:** `paths.leads({ stage?, source?, owner?, lostReason? })` and `paths.pipeline({ stage? })` query params, honoured by the Leads (M2) and Pipeline (M6) pages.
**Why:** DS §10 asks chart clicks to open "a filtered list". Today the Reports drill-down drawer lists the records itself and links to the unfiltered module.
**Proposed code (app/paths.ts):**
```ts
leads: (f: { stage?: string; source?: string; owner?: ID; lostReason?: string } = {}) => `/leads${q(f)}`,
pipeline: (opts: { view?: 'board' | 'list'; owner?: ID; stage?: string } = {}) => `/pipeline${q(opts)}`,
```
**Urgency:** nice (worked around with the drawer).

## R2 (nice) — global AI panel prefill
**What:** `useSessionStore.openAiPanel(prompt?: string)` (or an `aiPrompt` field) so "Ask the assistant" on Reports/Today can open the panel with a question typed in.
**Why:** today it opens the panel empty. **Urgency:** nice.

No foundation files were edited by M1.
