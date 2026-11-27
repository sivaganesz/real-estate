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

## Integrator status (Phase 3)
- **R1 — APPLIED.** `paths.leads({ stage, source, owner, temp, lostReason, attn, tab, view, add })`, `paths.pipeline({ stage, source, stalled, owner, view })` and `paths.properties({ status, type, city, q, attention })`. Leads (`lib/lead-queries.leadFiltersFromParams`, new `lostReasons` filter + pill), Pipeline (`pipelineFiltersFromParams`, new Stage pill) and Properties (`?type=`, `?city=`) honour them. The Reports drill drawer's "Open in …" button now goes to the filtered list (`drill-open`); admin Today's source chart and insights, and the manager's funnel, link to filtered lists.
- **R2 — APPLIED (by M7).** `askAssistant(command, { prefill })` from `components/ai/chat-store`.
- Review OPEN 3 (Segmented aria / heatmap hue): already in place (`aria-pressed` / `aria-current`, single-hue primary scale). Breadcrumb on `/reports/:tab`: APPLIED via `AppRoute.titleKeyFor` (M8 R4).
- Review OPEN 2 (Activity tab drill-down): DECLINED — the drawer lists leads/properties only; heatmap cells are activities. Left as is.
