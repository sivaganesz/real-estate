# DELIVERY_REPORT — crm-e2e

Master prompt: `d:\Docs\Real_Estate_CRM_Master_Prompt_v2.md` (§23). All work is committed locally on the branch below; nothing is pushed or merged.

Run history: the run was paused once on owner request (and resumed), later switched to low-usage mode, and finally to fast mode by owner instruction. In fast mode the minor QA bugs were deferred as known issues (see §10).

## 1. New branch name and base commit

- Branch: `feature/crm-e2e` (created from `spec-system-wireframe`, not pushed, not merged).
- Base commit: `10bc8c74ed5b1d9c12d8e839e46f578bbbb01f7e` ("chore: remove the docs folder").
- Commits on the branch since the base (`git log 10bc8c7..HEAD`):
  - `e191188` docs(crm-e2e): phase 0 analysis, role research, design system, foundation plan
  - `2d6fc1d` feat(crm-e2e): foundation — shell, roles, permissions, store, seed, services, AI service, shared components
  - `d76d351` feat(crm-e2e): phase 2 modules — today, reports, leads, clients, properties, matching, appointments, tasks, import, pipeline, AI assistants, team, settings, notifications, activity
  - `4527af9` feat(crm-e2e): phase 3 integration — cross-module flows, assistants everywhere, unified UI, integration e2e, demo script
  - plus the final Phase 4 commit (QA rounds 1 and 2 fixes, QA_REPORT.md, this report), made by the lead after this document was written.
- Existing code and branches were not modified; all new work lives in `crm-e2e/`.

## 2. Modules completed

All eight Phase 2 module groups were built, independently reviewed, and then integrated in Phase 3 (reports in `notes/phase2-reports.md` and `notes/phase3-reports.md`):

| Module | Scope |
|---|---|
| Foundation | Shell (permission-filtered nav, collapsible sidebar, phone bottom tabs, profile switcher, theme, English/Tamil), roles and permissions, zustand + immer + persist store, relative-date Indian seed data with reset, services layer with undo, AI service, shared components |
| M1 Today and Reports | Role-specific Today (executive, manager, admin) with ranked priorities, one-click Call / WhatsApp / Done / Reschedule / Log outcome, day brief, KPIs; Reports (funnel, sources, trend, pipeline health, team) with drill-down and AI summary |
| M2 Leads, Qualification and Clients | Lead list (counted filters, saved views, "Today design" grouping, bulk actions), 3-step add-lead sheet with paste-and-fill and duplicate warning, lead page (stage steps, next-step card, qualification, activity composer, matches, mark as lost), clients |
| M3 Properties and Matching | Property list/grid with natural-language search, dynamic property form by type, property page (price check, legal, listing health, history), photo gallery, two-way matching (buyer to homes, home to buyers) with explanations, shortlist and WhatsApp share |
| M4 Appointments and Tasks | Calendar (day, week, list), site-visit and call booking with conflict checks, visit outcome dialog, tasks with reschedule chips, auto follow-up after no-answer, post-visit call task |
| M5 Import | Lead and property sheet import (templates, custom mapping, messy-sheet rules, duplicate detection, failed-rows CSV), document extraction (PDF, image OCR, text) to drafts, Drafts page, import history |
| M6 Pipeline | Nine-stage board with drag and drop, stage dialogs (Lost reason, Booked property + amount, Converted), stalled flags, stage analytics |
| M7 AI Assistants | Global assistant panel and ten module assistants, command parsing for every §12.5 request (English and Hinglish), proposals with Confirm / Edit / Cancel, permission refusals, undo |
| M8 Team, Settings, Notifications and Activity | Team (workload, availability, leave, deactivation with hand-over), users and roles, assignment rules and auto-assign, pipeline/templates/matching settings, demo reset, notifications, global activity log |
| Phase 3 integration | Cross-module flows from master prompt §7 (assign, reassign, deactivate, book, sold, shortlist, lost), requests applied across modules, assistants mounted everywhere, unified UI, integration e2e, `DEMO_SCRIPT.md` |
| Phase 4 QA | QA round 1 (57 bugs found, 19 major), round-1 fixes, round-2 fixes (e2e failures, ADM-5, XAI-10), QA round 2 (one main journey per role) |

Deliverable documents in `crm-e2e/`: `README.md`, `CONVENTIONS.md`, `DESIGN_SYSTEM.md`, `ROLE_RESEARCH.md`, `DEMO_SCRIPT.md`, `PROGRESS.md`, `QA_REPORT.md`, `DELIVERY_REPORT.md`, and the e2e specs in `e2e/` (smoke, integration, one per module M1 to M8, and five QA specs: admin, manager, executive, cross, visual).

## 3. New folder and ported files

New folder: `crm-e2e/` (next to the untouched `wireframe-rebuild/` and the other existing code).

Sources: `wireframe-rebuild/` on `feature/crm-e2e` (identical to `spec-system-wireframe`) unless a row names another branch. Decision legend: P = port, P+ = port and improve, R = reference only (rebuilt fresh in the new design), D = drop. The full append-only log is `notes/ported-files.md`; it is reproduced in §3.3.

### 3.1 Property Matching (from `origin/feat/estate-platform` plus the rebuild)

Decision: port and improve. The rebuild's frontend `matchScore` (hard filters, five weighted parts, configurable weights, labels, two-way helpers) is the base; the estate-platform service's plain-language reasons, shortlist memory and per-project diversity were merged in.

- `feature/crm-e2e:wireframe-rebuild/src/lib/matching.ts` + `origin/feat/estate-platform:apps/api/src/services/matching.ts` → `src/lib/matching.ts`
- `origin/feat/estate-platform:apps/api/test/matching.test.ts` → `src/lib/matching.test.ts` (all estate cases ported as pure-function tests, plus rebuild cases)
- UI: `src/components/domain/match-list.tsx`, `match-explain.tsx`, `src/modules/matching/**` (reference-rebuilt from `features/leads/matches-tab.tsx`, `features/properties/tabs/matching-tab.tsx`, `share-panel.tsx`)
- What changed: the match percentage is shown (the master prompt asks for it; estate hid it); labels strong / good / weak / conditional / budgetMismatch / excluded; shortlist memory (liked, shared, visited; not interested excludes); on-hold penalty; at most 2 results per project; weights come from settings.

### 3.2 Lead Management (from `wireframe-rebuild`)

Rebuilt in the new design with logic ported: `src/lib/lead-queries.ts` (from `features/leads/lead-list.ts`), `src/lib/next-action.ts` (from `next-step.ts`), `src/lib/qualification.ts` (from `readiness.ts`), `src/lib/classification.ts`, `src/lib/consent.ts`, `src/modules/leads/**` (add-lead sheet, lead form, Today-design grouping, inline edit, lead page) and `src/modules/appointments/components/outcome-dialog.tsx` (from `visit-outcome.tsx`). Details are in the table below.

### 3.3 Full ported-files table (source branch:path → new path, what changed)

| source (branch:path) | new path | what changed |
|---|---|---|
| feature/crm-e2e:wireframe-rebuild/package.json | package.json | Renamed to crm-e2e 0.1.0; scripts typecheck/test/test:watch/e2e/verify; added zustand 5, immer 10, recharts 3, @dnd-kit core 6/sortable 10/utilities 3, xlsx 0.20.3 (SheetJS CDN), pdfjs-dist 5, tesseract.js 6, date-fns 4, vitest, jsdom, @playwright/test. |
| feature/crm-e2e:wireframe-rebuild/vite.config.ts | vite.config.ts | Ports 5174/5175 strictPort; vitest `test` block (node env, src/**/*.test.ts[x]); optimizeDeps exclude tesseract.js; chunkSizeWarningLimit 900. |
| feature/crm-e2e:wireframe-rebuild/tsconfig.json | tsconfig.json | Unchanged. |
| feature/crm-e2e:wireframe-rebuild/tsconfig.app.json | tsconfig.app.json | Unchanged. |
| feature/crm-e2e:wireframe-rebuild/tsconfig.node.json | tsconfig.node.json | Adds DOM lib and includes playwright.config.ts + e2e/. |
| feature/crm-e2e:wireframe-rebuild/.oxlintrc.json | .oxlintrc.json | Unchanged. |
| feature/crm-e2e:wireframe-rebuild/components.json | components.json | Unchanged (radix-nova, aliases components/ui/lib/hooks). |
| feature/crm-e2e:wireframe-rebuild/index.html | index.html | Pre-paint theme key `crm-e2e-theme` (default system), pre-paint `<html lang>` from `crm-e2e-lang`, viewport-fit=cover. |
| feature/crm-e2e:wireframe-rebuild/.gitignore | .gitignore | Rewritten: node_modules, dist, dist-e2e, test-results, playwright-report, .env* (keeps .env.example), *.tsbuildinfo. |
| feature/crm-e2e:wireframe-rebuild/public/demo-photos/*.jpg (14) | public/demo-photos/*.jpg | Copied as is. |
| feature/crm-e2e:wireframe-rebuild/public/favicon.svg | public/favicon.svg | Redrawn (reference only): Peacock rounded square with a roof-line glyph (DESIGN_SYSTEM §11.1). |
| feature/crm-e2e:wireframe-rebuild/src/components/ui/*.tsx (25) | src/components/ui/*.tsx | Copied. button.tsx restyled to DS §11.12 (36 px default, rounded-md, primary hover primary-strong, secondary = card + border + shadow-xs, destructive = danger, new `ai` variant, press scale 0.98). dialog/sheet/breadcrumb sr-only "Close"/"More" now via i18n. |
| feature/crm-e2e:wireframe-rebuild/src/lib/utils.ts | src/lib/utils.ts | Unchanged (`cn` with named text sizes). |
| feature/crm-e2e:wireframe-rebuild/src/lib/theme.ts | src/lib/theme.ts | Key `crm-e2e-theme`; default `system` (matches pre-paint script); exports THEME_STORAGE_KEY, `useIsDark()`, `isDarkApplied()`; listeners notified when the device theme changes under `system`. |
| feature/crm-e2e:wireframe-rebuild/src/lib/format.ts | src/lib/format.ts | Copied (inr, inrShort, num, sqft, fmtDate, daysBetween, addDays, initials); only a spacing fix. Phone and date helpers live in new lib/phone.ts and lib/dates.ts. |
| feature/crm-e2e:wireframe-rebuild/src/hooks/use-media-query.ts | src/hooks/use-media-query.ts | Unchanged. |
| feature/crm-e2e:wireframe-rebuild/src/i18n/index.ts | src/i18n/index.ts | Namespaces loaded with `import.meta.glob('./locales/*/*.json', { eager: true })`; defaultNS common; key `crm-e2e-lang`; `<html lang>` sync kept; exports `resources`, `NAMESPACES`, `buildResources`. |
| feature/crm-e2e:wireframe-rebuild/src/i18n/locales/en.json (facing labels only) | src/i18n/locales/{en,ta}/catalogue.json | Facing labels re-used; all other catalogue labels re-keyed to the new type keys and written fresh (en + ta). |
| feature/crm-e2e:wireframe-rebuild/src/data/catalogue.ts | src/domain/catalogue.ts | Per-type `facts` re-used as family `specs` (option values re-keyed to i18n keys); 6 type keys became `PropertyFamily`; 11 Indian property types; six metros with real localities; sources + SOURCE_QUALITY; stages/OPEN_STAGES/STAGE_RANK; authorities, banks, lost reasons, appointment/task types, stage defaults, 12 WhatsApp templates, DEFAULT_SETTINGS. |
| feature/crm-e2e:wireframe-rebuild/src/data/types.ts | src/domain/types.ts | Replaced by the complete foundation-plan §2.1 model (normalised entities: Appointment, Task, Activity, Notification, Assignment, ImportJob, Draft, Client, SavedView; 9 stages). |
| feature/crm-e2e:wireframe-rebuild/src/components/app/tone.ts | src/lib/tones.ts | Rebuilt as the DESIGN_SYSTEM §3.2 map: semantic tones, temperature, stage, appointment type/status, property status, priority, availability, role ring, avatar tints (full class strings + lucide icons). |
| feature/crm-e2e:wireframe-rebuild/src/components/app/page-header.tsx | src/components/shared/page-header.tsx | Restyled to DS (H1 24/650, subtitle, actions wrap on phone); eyebrow slot. |
| feature/crm-e2e:wireframe-rebuild/src/components/app/empty-state.tsx | src/components/shared/empty-state.tsx | Illustration slot (120 px / 80 px compact), badge, primary + secondary actions. |
| feature/crm-e2e:wireframe-rebuild/src/components/app/user-avatar.tsx | src/components/shared/user-avatar.tsx | Tint = hash(name) % 8 chart mix; role ring; availability dot. |
| feature/crm-e2e:wireframe-rebuild/src/components/layout/{app-shell,sidebar,top-bar,nav,crumbs}.tsx | src/app/shell/*, src/app/nav.ts | Reference only: new shell per DS §11.1 (permission-filtered groups, live count badges, collapse to 64 px, profile switcher, topbar AI pill/bell/theme/language, phone bottom tabs + sheet, floating AI button). Crumbs rebuilt from the route registry. |
| origin/feat/estate-platform:playwright.config.ts | playwright.config.ts | Single static app via `vite preview` on 5176, Edge channel, desktop/tablet/phone projects, list reporter. |
| feature/crm-e2e:wireframe-rebuild/src/lib/amount.ts | src/lib/amount.ts | Copied (L/Cr fields); added LAKH/CRORE constants and `parseAmountText` ("1.2 Cr", "85 lakhs", "₹45,00,000", bare "85" = lakhs). |
| feature/crm-e2e:wireframe-rebuild/src/lib/format.ts | src/lib/format.ts | F2: added `inrRange` ("₹60 L – ₹80 L", "up to …"), `fmtDate` as DD MMM YYYY via date-fns (ta-IN for Tamil), `fmtTime` (h:mm a), `fmtDateTime`, `firstName`. |
| feature/crm-e2e:wireframe-rebuild/src/lib/matching.ts + origin/feat/estate-platform:apps/api/src/services/matching.ts (notes/ref-estate-matching.ts.txt) | src/lib/matching.ts | P+: rebuild hard filters + 5 weighted parts (weights from settings.matching) and labels kept; merged estate plain reasons (over budget by ₹/%, "well under budget", must-have text matcher incl. facing, on hold −15, docs pending), shortlist memory (liked/visited/shared N days ago; notInterested excluded), fewer bedrooms excluded, per-project cap, bestMatchesToday. New: budget band ceiling→1.2× = budgetMismatch, >1.2× excluded; configurations + area range size part; possession/facing/Vastu/parking/furnishing/transaction preferences; minScore hiding with "not shown and why"; reasons as i18n keys (matching:reason.*) with tParams; reasonText/summaryLine; upsertShortlist. |
| origin/feat/estate-platform:apps/api/test/matching.test.ts (notes/ref-estate-matching.test.ts.txt) | src/lib/matching.test.ts | All 6 estate cases ported to pure functions (fit reasons + label, over-budget wording + exclusions, best-first with project cap, buyers only among visible leads, shortlist memory + share message, Today matches + one-line explanation) plus rebuild cases (weights sum, conditional on pending doc, budget mismatch within 15%, booked/sold excluded both ways, weights change order, minScore, every reason key in en + ta). |
| feature/crm-e2e:wireframe-rebuild/src/lib/readiness.ts | src/lib/qualification.ts | Same 100-point readiness (6 parts) re-keyed to the new Qualification (need/timeline/fundingReady or loan/authority or decision makers); budget part uses matching; added `qualificationCard` (Budget/Decision maker/Requirement/Timeline known vs missing) and per-check questions with quick-pick chips (i18n keys). |
| feature/crm-e2e:wireframe-rebuild/src/lib/classification.ts | src/lib/classification.ts | HNI from hni.status (potential/consentInProgress/verified), high value from budgetMax ≥ ₹1.5 Cr, investor from buyerPurpose; takes a context (properties, settings, now) instead of the old Database. |
| feature/crm-e2e:wireframe-rebuild/src/lib/consent.ts | src/lib/consent.ts | Consent is a badge/warning only (never blocks a follow-up); adds consentWithdrawn. |
| feature/crm-e2e:wireframe-rebuild/src/lib/property.ts | src/lib/property.ts | P+: primaryAreaSqft (per-type area field, plot units → sq ft), usableAreaSqft, pricePerSqft, isMatchable/isOnOffer, smart-required `missingRequired`, listingScore re-keyed to specs/approvals/RERA, comparables + priceCheck from settings.costs, attentionFor and linkedLeads over appointments; DEMO_TODAY → `now`; nearby-places code dropped (plan §7.8). |
| feature/crm-e2e:wireframe-rebuild/src/lib/places.ts | src/lib/places.ts | New six-metro CITIES; added findPlace. |
| feature/crm-e2e:wireframe-rebuild/src/lib/search.ts + src/features/properties/search/prop-search.ts | src/lib/search.ts | Merged into one parser `parsePropertyQuery` over the new catalogue (BHK incl. 2.5/1RK, areas sq ft/sq yd/cents/acres, price ranges, ready/UC, facing, furnishing, purpose, 11 types, amenities, statuses, sort, localities → city, city aliases); `propertyMatchesFilters`, `applyPropertyFilters`, `sortProperties`, `criteriaKeys`, `relaxFor`. |
| feature/crm-e2e:wireframe-rebuild/src/features/leads/next-step.ts | src/lib/next-action.ts | Rules over Appointment/Task records: assign, record outcome, overdue task, first call, prepare visit (loan), collect docs, negotiation gap, propose offer, post-visit, book visit, share fresh match, next follow-up, check in; returns i18n key (leads:next.*) + params + action kind + target id. |
| feature/crm-e2e:wireframe-rebuild/src/features/properties/pitch.ts (share idea) + estate shareWithLead | src/lib/whatsapp.ts | New: waLink, telLink, mailtoLink, mapsLink, propertyAddress, fillTemplate, propertyLine and shareMessage (settings template when present, else estate wording "Hi {first}, as discussed, here are N options…"). |
| feature/crm-e2e:wireframe-rebuild/src/store/db.tsx (store actions: markRecommended, deleteProperty cascade, noteOnLeads, checkpoint/restore) | src/services/** (core/commit, effects, undo; leads, properties, matching, …) | Behaviour only: React-context actions became services over commit(); deleteProperty cascade → E13; markRecommended → shortlist status + E11 share; noteOnLeads → Activity refs; checkpoint/restore → core/undo.ts (one level, 10 s). |
| feature/crm-e2e:wireframe-rebuild/src/lib/ai/parse.ts | src/ai/simulated/parse.ts | P+: amounts (ranges, ₹/Rs prefix, L/lakh/lac/Cr/crore/Tamil units), budget roles (under/around/from), phones (+91 98450 12345 etc. → E.164), e-mail, names (I'm / my name is / Name: / Mr. / "X here" / chat export / "Name, phone"; greetings rejected), areas (sqft/sq.ft/sft/sq yd/cents/acres/guntha, 30x40), BHK (2.5BHK, 2 or 3 BHK, 1RK; never a phone's last digit), places with locality aliases (Sarjapur → Sarjapur Road), facing, possession (+ "possession Dec 2027"), timeline buckets, decision makers + authority, loan, NRI + country, purpose, source, furnishing, amenities, vastu, parking, language, family size; dates/times kept and widened; fuzzy `named()` (1-letter typo); `propertyNamed` over PRP ids and title/project words. |
| feature/crm-e2e:wireframe-rebuild/src/lib/ai/understand.ts | src/ai/simulated/intents.ts | P+: intent rules widened to every master prompt §12.5 request; stage words. |
| feature/crm-e2e:wireframe-rebuild/src/lib/ai/plan.ts + answer.ts | src/ai/simulated/commands.ts, src/ai/proposals.ts, src/services/commands.ts | P+: "plan of changes a person applies" → `ActionProposal[]` (i18n summary rows, permission, payload) + `executeProposal` over the real services with via 'ai'; refusals with the permission reason; query intents return result ids + links. |
| feature/crm-e2e:wireframe-rebuild/src/lib/assistant.ts (fact rules) | src/ai/simulated/extract-property.ts | P (rules) / R (chat): type, purpose, city/locality, price, area kind, BHK, baths, floor x of y, facing, parking, amenities, possession, RERA, khata, road width, owner; never invents; smart-required missing list + chip questions; suggested title. |
| feature/crm-e2e:wireframe-rebuild/src/features/assistant/use-speech.ts | src/hooks/use-speech.ts | P+: en-IN, returns `supported` and a typed `error` so the mic shows a fallback instead of disappearing. |
| feature/crm-e2e:wireframe-rebuild/src/features/assistant/ask-bar.tsx, assistant-box.tsx | src/components/ai/ai-panel.tsx, ai-fab.tsx | R: DS §11.9 docked panel (context chip, Demo AI badge from result mode, bubbles, proposal cards Confirm/Edit/Cancel → services, refusal card, links to changed records, suggested prompts, voice, Ctrl/Cmd+K). |
| feature/crm-e2e:wireframe-rebuild/src/components/app/data-table.tsx | src/components/shared/data-table.tsx (+ table-controls.tsx, bulk-bar.tsx, pagination.tsx) | P+: sticky header with scroll shadow, 52/40 px density, selection with Peacock inset, row hover action cluster over a gradient, in-body loading/empty/error, hidden columns, footer slot. |
| feature/crm-e2e:wireframe-rebuild/src/components/app/filter-bar.tsx | src/components/shared/filter-bar.tsx, filter-pill.tsx, search-input.tsx | P+: search split out; dashed/filled filter pills with checklist popover and counts; Clear all. |
| feature/crm-e2e:wireframe-rebuild/src/components/app/side-panel.tsx | src/components/shared/drawer.tsx | P+: 480/640 widths, full screen or bottom sheet on phone, sticky header/footer, unsaved-changes confirm. |
| feature/crm-e2e:wireframe-rebuild/src/components/app/confirm-dialog.tsx | src/components/shared/confirm-dialog.tsx (+ undo-toast.ts) | P: on the new alert-dialog primitive, danger tone; undo toast (6 s) and service-error toast helpers. |
| feature/crm-e2e:wireframe-rebuild/src/components/app/stat-card.tsx | src/components/shared/kpi-card.tsx (+ sparkline, progress-ring, gauge, icon-tile) | R: icon tile, uppercase label, tabular KPI, delta chip (good when up/down), sparkline / ring / target bar / highlight gradient, skeleton. |
| feature/crm-e2e:wireframe-rebuild/src/components/app/meter.tsx | src/components/shared/meter.tsx, workload-bar.tsx | P+: tones from lib/tones, marigold when the target is met; stacked hot/warm/cold workload bars + legend. |
| feature/crm-e2e:wireframe-rebuild/src/components/app/segmented.tsx | src/components/shared/segmented.tsx | P: restyled (Peacock underline indicator; pill group on muted track). |
| feature/crm-e2e:wireframe-rebuild/src/components/app/section-card.tsx, key-value-grid.tsx, callout.tsx, chip.tsx, status-chip.tsx | src/components/shared/section-card.tsx, key-value-grid.tsx, callout.tsx, chip.tsx, badges.tsx | P: restyled to DS tokens; the chip's violet tone became the AI tone; status-chip → ToneBadge / DotBadge / CountBadge / StatusDot. |
| feature/crm-e2e:wireframe-rebuild/src/components/app/mini-calendar.tsx, amount-input.tsx | src/components/shared/mini-calendar.tsx, amount-input.tsx (+ new date-time-field.tsx, phone-input.tsx, form-field.tsx) | P+: marked days; amount value is plain rupees with auto unit and "85 lakhs" paste; date-time field with quick chips and 15-minute times. |
| feature/crm-e2e:wireframe-rebuild/src/features/leads/matches-tab.tsx (reference), reschedule-button.tsx (chips) | src/components/domain/match-list.tsx, match-explain.tsx, task-row.tsx | R: ranked matches with % ring + hover explanation, label, summary line, memory, actions; task-row reschedule chips (Tomorrow / In 3 days / Next week). |
| feature/crm-e2e:wireframe-rebuild/src/components/ui (shadcn style) | src/components/ui/accordion.tsx, alert-dialog.tsx, collapsible.tsx, radio-group.tsx, hover-card.tsx, slider.tsx | New shadcn primitives (radix-ui), token classes only; alert-dialog overlay uses `--overlay` + 2 px blur. |
| origin/feat/estate-platform:playwright.config.ts (F4 update) | playwright.config.ts, playwright.dev.config.ts | F4: `channel` reads `PW_CHANNEL` (default `msedge`, fallback `chrome`); new dev-server variant on 5174 (`pnpm e2e:dev`); tsconfig.node.json includes it. |
| feature/crm-e2e:wireframe-rebuild/src/features/leads/lead-list.ts | src/lib/lead-queries.ts (+ lead-queries.test.ts) | Foundation review: P+ per plan §7.5. Next follow-up derived from the earliest open task (no stored nextFollowUp); readiness → score + temperature; new stage keys; multi-value filters (stages, owners incl. unassigned, sources, types, cities, temperatures), NRI, attention adds `uncontacted`; sort score/followUp/newest/name; `tabCounts`; sentence search reads localities → city, hot/warm/cold, NRI, unassigned. |
| spec-system-wireframe #/pipeline (via notes/analysis-spec-wireframe.md §6; no code in wireframe-rebuild) | src/modules/pipeline/lib/pipeline.ts (stageAnalytics, columnSummaries), components/pipeline-board.tsx, deal-card.tsx | M6 R: rule only, no code copied (wireframe-rebuild has no pipeline). "Reached = furthest stage index ≥ i, Lost excluded" for stage conversion; column head "dot, name, count, ₹ total"; empty column "Drop a deal here"; lost reason shown on Lost cards; stuck flag now uses 2× the per-stage target days (lib/stalled) instead of a flat 14 days. |
| feature/crm-e2e:wireframe-rebuild/src/features/leads/reschedule-button.tsx | src/modules/today/components/reschedule-menu.tsx (+ lib/slots.ts `rescheduleSlots`) | M1: same popover UX (quick list → "Pick a date…" calendar with back arrow); slots widened to In 2 hours / Tomorrow 10:00 / Tomorrow 17:00 / In 3 days / Next Monday with times; writes via services (task reschedule, appointment reschedule, or a new follow-up task) instead of a lead field. |
| feature/crm-e2e:wireframe-rebuild/src/features/leads/done-button.tsx | src/modules/today/components/use-today-actions.ts (`done`) | M1: "one click, no menu" Done kept; now completes the real Task (completeTask, E10 logs contact) with an Undo toast instead of clearing lead.nextFollowUp. |
| feature/crm-e2e:wireframe-rebuild/src/features/settings/settings-page.tsx (Choice / Option / ThemePreview / LanguageSample) | src/modules/settings/components/profile-section.tsx | M8 P: theme and language option cards with live preview and arrow-key radio group kept; keys moved to `shell:theme.*` / `settings:profile.*`; added own profile (name, mobile, languages via updateUser) and availability; the rebuild's "coming next" rules list replaced by real sections. |
| src/components/domain/activity-timeline.tsx (foundation ICON map, stage/call colouring) | src/modules/activity/pages/activity-page.tsx | M8: same kind → icon/tone mapping (plus user.* kinds) so the global log matches record timelines, with record links, "how" badges and richer settings / user sentences. |
| feature/crm-e2e:wireframe-rebuild/src/features/properties/components/photo-gallery.tsx (shrink, storage budget, strip + full-screen viewer) | src/modules/properties/lib/image.ts, components/gallery.tsx, components/photo-manager.tsx | M3: pure helpers split out and tested (fitWithin ≤1600 px, 8-photo cap, ~4 MB budget, cover rules); viewer restyled to tokens; writes via updateProperty with Undo on remove. |
| feature/crm-e2e:wireframe-rebuild/src/features/properties/pages/properties-page.tsx (grid/table, NL search, pills, status tabs, needs-attention, bulk) | src/modules/properties/pages/properties-page.tsx, lib/list.ts, components/property-filters.tsx, properties-table.tsx, locality-groups.tsx | M3: rebuilt in DS; "How I read it" chips with drop + relax suggestion; new By-locality view; KPI strip; bulk status (one undoable commit) / CSV / delete by permission. |
| feature/crm-e2e:wireframe-rebuild/src/features/properties/pages/property-page.tsx + tabs (overview, legal, price, history) | src/modules/properties/pages/property-page.tsx, components/key-facts.tsx, price-check-card.tsx, legal-card.tsx, listing-health-card.tsx, status-control.tsx | M3: three-zone page; neighbourhood map dropped for a Maps link (plan §7.8); matched leads + close-on-budget + linked leads + appointments; AI listing copy (lib/property.propertyCopy). |
| feature/crm-e2e:wireframe-rebuild/src/features/properties/assistant/* (add-property chat, details form) | src/modules/properties/components/property-form.tsx, lib/form.ts | M3: dynamic form by family + PasteAndFillBox/voice + missing-field chips; edit-with-AI merges only fields the text mentioned (pickExtracted). |
| feature/crm-e2e:wireframe-rebuild/src/features/properties/components/share-panel.tsx, tabs/matching-tab.tsx | src/components/domain/match-list.tsx (useMatchActions, ShareDialog), src/modules/matching/** | M3: share dialog (template EN/Hinglish or AI draft, editable, wa.me, logged E11); shortlist / schedule (AppointmentFormDialog prefilled) / not interested with Undo; matching page both directions + assistant. |
| feature/crm-e2e:wireframe-rebuild/src/features/leads/add-lead-sheet.tsx | src/modules/leads/components/add-lead-sheet.tsx, lead-editor.tsx, use-lead-editor.ts | R/P+: kept the 3-step sheet (Who · What they want · Money & readiness), big chips, places bringing their city, "More details", live "N properties already fit" and duplicate check. Rebuilt on the new LeadInput, PasteAndFillBox + missing-question chips, AI field markers, smart required (name + phone/e-mail + source), auto-assign preview. |
| feature/crm-e2e:wireframe-rebuild/src/features/leads/lead-form.tsx | src/modules/leads/lib/lead-form.ts | P+: draftOf / withPrefill / build became `draftFromLead`, `applyExtraction` (only AI-read paths), `draftToInput`; budget min/preferred/max + "what the budget includes"; questions per property type via `wantsHomes`. |
| feature/crm-e2e:wireframe-rebuild/src/features/leads/leads-today.tsx | src/modules/leads/lib/focus.ts, components/leads-views.tsx | P+: the "Today design" grouping (overdue · not called · due today · hot no visit · no follow-up · upcoming), first match wins. |
| feature/crm-e2e:wireframe-rebuild/src/features/leads/inline-edit.tsx | src/modules/leads/components/lead-summary.tsx (InlineEdit) | P+: click a detail → popover editor → Save with Undo; budget, places, configuration + possession. |
| feature/crm-e2e:wireframe-rebuild/src/features/leads/leads-page.tsx, lead-page.tsx | src/modules/leads/pages/leads-page.tsx, lead-page.tsx | R: list with counted filter pills, saved views, tabs; lead page in three zones with stage steps, Next step card, Mark as lost on its own button, composer, matches. |
| feature/crm-e2e:wireframe-rebuild/src/features/leads/visit-outcome.tsx | src/modules/appointments/components/outcome-dialog.tsx | M4: UX ported (outcome as radio cards, interest chips, note). Rebuilt on the Appointment record: 4 results (interested / thinking / not interested / ready to book), liked properties, objections, decision maker present, next step, follow-up time, stage, summary; "Describe the visit" AI fill (readOutcomeNotes) and the AI next-step suggestion; saves through completeAppointmentWithStage (one Undo). |
| feature/crm-e2e:wireframe-rebuild/src/features/leads/reschedule-button.tsx | src/components/domain/task-row.tsx (reschedule menu) | M4: Tomorrow / In 3 days / Next week + "Pick a date and time" ported into the task row; keeps the task's wall-clock time; undoable through rescheduleTasks. |
| feature/crm-e2e:wireframe-rebuild/src/lib/ai/understand.ts (leadActions, readLeadDetails, LOST rules) | src/ai/simulated/lead-update.ts | M7: P+ "update an existing lead" reader re-keyed to the new Lead: contact (call / WhatsApp / e-mail; no answer / busy / wrong number), budget only near a budget word (offers ignored), configurations / types / localities ("also" adds), possession, facing, timeline, decision makers, loan, purpose, phone / alt phone / e-mail / source, lost + reason, next follow-up date, else a note; returns only values that differ from the lead. |
| feature/crm-e2e:wireframe-rebuild/src/lib/ai/understand.ts (QUESTION_RE / leadQuery) + answer.ts ("how I read it" chips) | src/ai/simulated/intents.ts, command-queries.ts, command-actions.ts; CommandPlan.readAs / followUps / stats | M7: P+ intents widened to every master prompt §12.5 request and every ROLE_RESEARCH §5 chip (reschedule, complete task, bulk / reassign-from / request reassignment, share / shortlist, draft message, next call, target left, workload, stalled, source conversion, lost reasons, unsold inventory, business summary, duplicates, import); "how I read it" became the Hinglish "Read as" line plus next-question chips. |
| feature/crm-e2e:wireframe-rebuild/src/features/assistant/assistant-box.tsx (conversation + apply flow) | src/components/ai/ai-panel.tsx, chat-store.ts, ai-answer.tsx, use-proposals.ts, proposal-editor.tsx, module-assistant/* | M7: R conversation kept per tab, rich answers (stat bars / tiles, record rows with avatars, stage pills and score rings, page links, drafted WhatsApp card), proposal Edit in place (ai/revise.ts), Undo on the card and the toast, Assistants tab with the ten module assistants, "/" hotkey. |
| feature/crm-e2e:wireframe-rebuild/src/features/properties/pages/drafts-page.tsx | src/modules/import/pages/drafts-page.tsx | M5. Reference port (UX, not code): one Drafts list for all kinds, what is still needed per row, own drafts for executives and everyone's for managers. Rebuilt as cards with a confidence ring, low-confidence and missing counts, Open / Saved / Discarded tabs, and discard with confirm + undo. |
| origin/feat/estate-platform:docs/02-bulk-import.md | src/modules/import/lib/{sheet,mapping,values,rows,plan}.ts | M5. Rules ported as code: Instructions/Lists/Help tabs ignored and the tab with most rows wins; title, totals and note rows skipped; an "Area" heading settled by its values; "30 L", "1.2 Cr", "1,200 sq.ft", "3 cents", "30x40", "Ground", "NE" and Excel dates read; "Call" prices need fixing; nothing dropped (unmapped columns kept in the description / lead note); duplicates by same project+unit or same locality+type with price ±5 % and area ±2 %; ready / draft / duplicate / needs fixing; failed-rows CSV with a Problems column. |
| feature/crm-e2e:wireframe-rebuild/src/features/properties/assistant/source-tag.tsx | src/modules/import/components/record-form.tsx | M5. Reference only (the FieldMeta source-tag idea): per-field origin + confidence markers (✦ AI through AIField, warning highlight under 75 %). |

### 3.4 What was dropped, and why (foundation-plan §7)

| Dropped item | Reason |
|---|---|
| `vercel.json` | Not deploying in this run. |
| `pages/ui-kit-page.tsx`, `pages/module-placeholder-page.tsx` | No placeholder screens in the final product; foundation stubs were replaced in Phase 2. |
| `src/data/seed.ts` fixed `DEMO_TODAY` and masked phones (`98xxxxxx01`) | Replaced by a multi-city seed with relative dates and valid-looking numbers. |
| Rebuild's 8th stage "recommended" | The master prompt has 9 stages; "recommended" lives on as the shortlist status. |
| Neighbourhood map and place-categories editor on the property page | Too deep for this scope; a Google Maps search link replaces it. |
| Add-property chat (one question at a time) and "decision cards" (master-list edits) | Replaced by a dynamic form, paste-and-fill and a missing-fields checklist (master prompt §12.3). |
| Brochure share page (`share-page.tsx`) | Not required; the WhatsApp share panel covers it. |
| Projects module, public enquiry form | Not in master prompt §7; `projectName` on a property covers grouping. |
| Rebuild's `index.css` | Replaced wholesale by the new design-system tokens (the CSS-variable mechanism is kept). |
| Consent as a blocker | Changed: consent is a badge and warning only, because the master prompt requires one-click follow-ups everywhere. |
| `origin/feat/estate-platform` API server and database code | Out of scope (frontend only, no backend). Its docs and matching logic were used as reference. |

## 4. AI features implemented: simulated vs ready for live API

All AI lives in `src/ai/`. Everything sits behind one `AIService` interface (`src/ai/types.ts`), chosen once by `getAI()` in `src/ai/index.ts`.

| Feature | Implementation |
|---|---|
| Lead extraction from pasted text, WhatsApp chat or portal enquiry (`extractLead`) | Simulated (rule based; English, Hinglish, Tamil units); live-ready |
| Property extraction (`extractProperty`), appointment extraction (`extractAppointment`) | Simulated; live-ready |
| Document extraction (PDF text, image OCR, classification to drafts) | Runs in the browser (pdfjs-dist, tesseract.js); OCR language data comes from a CDN on first use |
| Lead qualification and scoring (`qualifyLead`, `scoreLead`) | Simulated; live-ready |
| Property matching (`matchProperties`) | Always rule based (needs the full inventory); never sent to the proxy |
| Summaries, next-action suggestions, message drafts in English and Hinglish (`summarize`, `suggestNextAction`, `generateMessage`) | Simulated; live-ready |
| Dashboard and report insights (`insights`) | Simulated; live-ready. Today briefs and report summaries are computed locally and always labelled Demo AI |
| Import column mapping (`mapColumns`) | Simulated; live-ready |
| Command assistant: every master prompt §12.5 request, Hinglish, role refusals, proposals with Confirm / Edit / Cancel, undo (`parseCommand`, `readUpdate`) | Simulated; live-ready |
| Voice input | Web Speech API in the browser (en-IN), fallback message when unsupported |
| Module assistants (ten mounts: lead create, property create, appointment create, follow-up, property edit, import, insights and others) | Share the same `AIService` |

Simulated vs live: the default is the simulated provider, labelled "Demo AI" in the UI. Set `VITE_AI_PROVIDER=live` and `VITE_AI_ENDPOINT` (optionally `VITE_AI_MODEL`) to switch on `src/ai/live/provider.ts`. It POSTs `{ task, input, context, model }` to a backend proxy, expects the same JSON shapes, and falls back per call to the simulated provider on error, timeout (15 s) or not-implemented. There is deliberately no API-key variable: the key must live in the backend proxy (not included). Nothing AI proposes runs without a user confirmation and a permission check.

## 5. Major design decisions and manual tasks reduced

### 5.1 Major design decisions

- New design system (Peacock identity, OKLCH tokens, light / dark / system, English and Tamil), documented in `DESIGN_SYSTEM.md`.
- Normalised domain model: visits became Appointments, activity became Activity records, the next follow-up is the earliest open Task. Nine pipeline stages per the master prompt.
- Every action goes through a services layer (`src/services/**`) that checks permissions, writes through one commit path, applies side effects (activity, notifications, task creation) and supports undo. UI code never checks role names; it calls `usePermission().can(action, record)`. Role views are chosen by permission scope.
- Every feature works manually and with AI; AI only proposes and the user confirms.
- Simulated integrations are clearly labelled and fully working in the frontend (Demo AI badge; wa.me and tel links logged on click).
- Auto-assignment is a single company-wide switch and always explains its pick (lowest workload, round-robin on ties, skips people on leave and deactivated users); manual assignment is always available.
- Consent is a warning, never a blocker.
- Data lives in localStorage with relative dates shifted to today on load; admin demo reset.
- Property matching: rebuild formula plus estate-platform explanations and shortlist memory (§3.1).
- Today is the front door for each role, ranked with reasons, so the user never decides "what next" manually.

### 5.2 Main manual tasks reduced per role (from `ROLE_RESEARCH.md` §4)

| Role | Manual task | Reduced by |
|---|---|---|
| Executive | Copying WhatsApp or portal enquiries into a form | Paste or speak; fields auto-filled and marked; only missing essentials asked |
| Executive | Deciding whom to call first | Ranked Today list with a reason |
| Executive | Remembering follow-ups, rescheduling no-answers | Auto follow-up task after "not reachable"; one-click reschedule chips |
| Executive | Typing the same WhatsApp messages | Drafted messages per context (intro, visit confirm, post-visit, offer), Hinglish variant, wa.me prefilled |
| Executive | Finding matching units | Ranked matches with "why it matches" chips; booked and sold units excluded |
| Executive | Logging visit feedback, calling within 24 h of a visit | Structured outcome dialog with AI next-stage suggestion; completing a visit creates the post-visit call task |
| Executive | Daily report to the manager, duplicate checks, visit reminders | Automatic activity counts; duplicate warning on create and import; reminders and one-click WhatsApp confirmation |
| Manager | Allocating each lead | Auto-assign with reasons, or a manual dialog showing load, visits, leave and conversion |
| Manager | Chasing executives for updates, finding stalled deals, neglected high-value leads | Live team board; stalled flags with AI next action; escalation list |
| Manager | Reassigning leads of absent executives, building the team MIS | Reassign proposals from the assistant; live reports with a 3-line AI summary and export |
| Admin | Cleaning, mapping and importing portal exports | Column auto-mapping, phone normalisation, dedupe preview, source tagging, confirm |
| Admin | Entering properties from brochures and PDFs | Extraction from PDF, image or text into a form marked as AI-filled |
| Admin | Syncing inventory with bookings, transferring a leaver's leads, hand-built reports, data hygiene | Booked deal sets the unit to Booked and removes it from matching; deactivation prompts a hand-over; dashboards and insights; duplicate and missing-field alerts with one-click fixes |
| All | Searching for a record or action | Global assistant (Ctrl/Cmd+K) with natural-language commands |

## 6. Final permission matrix

Source: `src/lib/permissions.ts`. Scope values: `all` = any record; `team` = the manager's reports, the manager's own and unassigned records; `own` = records owned by the user (properties: created by the user); `no` = denied (the UI hides the control, the route shows no-access, services throw `PermissionError`). Deactivated users have no access to anything.

| Action | Admin | Manager | Executive |
|---|---|---|---|
| `user.manage` | all | no | no |
| `user.setAvailability` | all | team | own |
| `team.view` | all | team | no |
| `rules.configure` | all | team | no |
| `settings.pipeline` | all | no | no |
| `settings.templates` | all | no | no |
| `settings.matching` | all | no | no |
| `settings.preferences` | own | own | own |
| `demo.reset` | all | no | no |
| `lead.view` | all | team | own |
| `lead.create` | all | all | all |
| `lead.edit` | all | team | own |
| `lead.delete` | all | team | no |
| `lead.assign` | all | team | no |
| `lead.requestReassign` | no | no | own |
| `lead.moveStage` | all | team | own |
| `lead.markBooked` | all | team | own |
| `lead.viewHni` | all | all | no |
| `lead.export` | all | team | no |
| `export.data` | all | team | no |
| `client.view` | all | team | own |
| `client.edit` | all | team | own |
| `property.view` | all | all | all |
| `property.create` | all | all | all |
| `property.edit` | all | all | own |
| `property.delete` | all | no | no |
| `matching.run` | all | all | all |
| `appointment.view` | all | team | own |
| `appointment.manage` | all | team | own |
| `task.view` | all | team | own |
| `task.manage` | all | team | own |
| `import.leads` | all | all | no |
| `import.properties` | all | no | no |
| `import.document` | all | all | all |
| `report.view` | all | team | own |
| `activity.viewLog` | all | team | no |
| `ai.use` | all | all | all |

## 7. Workflows tested and results

Test layers: Vitest unit tests (pure logic, services, AI parsing, matching, permissions), Playwright end-to-end specs in `e2e/` (smoke, M1 to M8 module journeys, `integration.spec.ts` for the master prompt §7 cross-module flows, and QA specs for admin, manager, executive, cross-role AI and visual/accessibility), and two QA rounds (the full QA record is in `QA_REPORT.md`).

- Phase 3 integration: 648 unit tests and 87 e2e tests green at the time.
- QA round 1: 57 bugs found (19 major); 17 of 19 majors were fixed in round 1. Full e2e after round 1: 208 passed, 16 failed (`notes/e2e-r1-failed.log`).
- Round-2 fixes: the 16 failures were resolved. Two were app bugs fixed in `src/` (VIS-2 Tamil insights not re-rendering on language switch; the visit-outcome Today item not following the lead's current owner after a reassignment), and the rest were test defects corrected with the assertions kept (executives have no Team tab so the visual walk skips `/reports/team` for them; the Arjun ranking test now includes the new `visitOutcome` kind; the admin Undo test now clicks the front toast). The two remaining majors were fixed: ADM-5 (role change leaving a stale executive in the profile picker) and XAI-10 (assistant phrasing coverage for the §12.5 requests, with a new `phrasings-12-5.test.ts`).
- QA round 2 (one main journey per role, through the real profile switcher). All journey steps passed and no new bugs were found:
  - Admin: Today one-click Redistribute, add user, deactivate with auto hand-over, auto-assign toggle, rename a pipeline stage, template download plus sample CSV import with an inline fix, reports and activity log, demo reset. ADM-5, ADM-7 and VIS-1 re-checked FIXED.
  - Manager: unassigned queue, per-row assign and Auto-assign all with reasons (skipping the executive on leave), reassign with notifications, pipeline moves including the Booked dialog, team-scoped report, blocked actions (no delete, no add user, no user settings), seven assistant phrasings including Hinglish. MGR-1 and XAI-10 re-checked FIXED.
  - Executive (Arjun, then Sneha and Vikram): ranked Today and one-click actions, own-data scoping, paste-and-fill lead creation, lead page actions, visit outcome saves the stage shown, matching both ways, assistant create / task / note commands with confirmation, refusals for delete and assign. EXE-1, EXE-2, EXE-7, EXE-8, XAI-1, XAI-4, XAI-6 and XAI-7 re-checked FIXED. XAI-2, XAI-3, XAI-5 and XAI-9 are covered by `qa-cross.spec.ts`, which was not re-run in round 2 (it was part of the final full run).
- Minor QA bugs are deferred as known issues (listed in `QA_REPORT.md`).

## 8. Build and runtime status

- `pnpm verify` (typecheck, lint, unit tests, build): green before the final e2e fixes. After the last test-only fixes, typecheck was re-run clean and lint shows warnings only (existing react-refresh and similar warnings, no errors).
- Unit tests: 54 files, 785 tests passed (last full `pnpm test` run, after the round-2 app fixes).
- Final full e2e run (once, `--workers=4`, default config on a build served by `vite preview` on port 5176, 24.7 minutes): 224 tests, 220 passed, 4 failed, 0 flaky. All 4 failures were in the desktop project; the phone project had none (`notes/e2e-final-run1.log`, `notes/e2e-final.log`).
- The 4 failures (plus one related test, the 4th Arjun walk) were test defects, not app bugs: the admin one-click Undo test (`.last()` hit a hidden older toast because Redistribute is now undoable) and the Arjun visual walks (the default profile is not persisted in the session store, so the role read as undefined and the walk visited `/reports/team`, which executives are deliberately redirected from). Both tests were corrected without weakening any assertion, and the 5 affected tests were re-run with 1 to 2 workers: 5 of 5 passed. Effective final result: 224 passed, 0 failed. The full suite was not run a second time after those test fixes.
- Runtime: frontend only, no backend. The app runs on the Vite dev server (port 5174) or a static build (`pnpm build`, preview on 5175). All data is in the browser.
- Known parallel-run caveat: several Playwright processes sharing `test-results/` can cause `ENOENT` trace-file errors and browser launch flakes; use a private `--output` directory per runner.

## 9. Assumptions made without asking

The complete per-module lists are in `notes/assumptions-*.md` (foundation, M1 to M8, integration). Main ones:

- Folder `crm-e2e/`, branch `feature/crm-e2e`; sub-agents do not commit, the lead commits after each phase.
- Foundation: theme default is `system`; routes every profile may open declare `any` (Today, Notifications); nav adds an Activity log item for admins and managers; phone tabs differ for roles with `team.view`; dependency versions pinned as resolved; tesseract.js install script denied under pnpm 12 (the library works from its CDN).
- Today and Reports: role view comes from the `lead.view` scope; a lead with a planned follow-up is not repeated in priorities; day briefs and insights are rule based with the Demo AI badge; the default report period is the last 6 months.
- Leads and Clients: the "All" tab includes closed leads; managers and admins open on the Table and executives on the "Today design"; "Save anyway" on a duplicate needs an explicit tick and notifies the admin; bulk stage change excludes Booked and Converted.
- Properties and Matching: smart-required fields are title or configuration, type, city, locality, price and area; saving an edit replaces the whole record; AI edits apply only fields the text mentioned; listing copy is rule based; hidden sections are cleared on save.
- Appointments and Tasks: weeks start on Monday; "Log outcome" opens 15 minutes before the start; working hours for suggestions are 10:00 to 19:30 for calls and 09:30 to 19:00 for bookings; AI never proposes Booked or Lost after an outcome.
- Import: executives have no access to sheet imports or history; template headings are English data; unmapped columns are kept, never dropped; a bare number below 1,000 is read as lakhs.
- Pipeline: deal value is the deal value, else the budget maximum; open pipeline is every stage except Converted and Lost; Lost, Booked and Converted moves open dialogs; stalled means more than 2x the stage's target days.
- AI: Hinglish is rewritten to English before parsing; every applied AI change can be undone for 10 seconds; permissions are checked twice (role and record).
- Team and Settings: managers see themselves and their reports; one company-wide auto-assign flag; lost reasons are a fixed set that can be switched on or off but not invented; New, Booked, Converted and Lost stages cannot be switched off.
- Integration: chart click-through opens the filtered list; link filters are only a starting point; some assistants (lead edit, lead qualify, property match) are not mounted a second time because the page's own cards use the same AI calls.
- Tamil is drafted and awaits review by a fluent speaker.

## 10. Known limitations and suggested next steps

Known limitations:

- OCR language data is downloaded from a CDN on first use (needs internet; paste text as a fallback).
- Voice input uses the Web Speech API, which needs Chrome or Edge.
- Images are stored as compressed data URLs in localStorage (about 4 MB cap per property).
- AI is simulated (rule based, labelled Demo AI); live mode needs a backend proxy that is not included.
- WhatsApp and calls are `wa.me` and `tel:` links only, logged when clicked; delivery cannot be verified.
- No backend: no database, no authentication, data is per browser, the profile switcher replaces login.
- Minor QA bugs from round 1 are deferred as known issues (see `QA_REPORT.md`); the demo e2e suite takes about 25 minutes with 4 workers.

Suggested next steps:

1. Backend and database (API for leads, properties, appointments, tasks, users; move the services layer behind it).
2. Authentication, real users and server-side permission enforcement.
3. Real LLM through a backend proxy (`VITE_AI_PROVIDER=live` plus `VITE_AI_ENDPOINT`), with the key held server side.
4. WhatsApp Business API and telephony integration (click-to-call, call logs, template messages, delivery status).
5. Portal lead APIs (99acres, MagicBricks, Housing) for automatic lead intake in place of file import.
6. Native-speaker review of the Tamil strings; notification delivery (email, push).

## 11. Run instructions

Requirements: Node 24, pnpm, and Microsoft Edge for the e2e tests (or `PW_CHANNEL=chrome`).

```sh
cd crm-e2e
pnpm i
pnpm dev            # http://localhost:5174 (strictPort; demo data is stored per origin)
pnpm build          # type-check and build to dist/
pnpm preview        # serve the build on 5175
pnpm typecheck
pnpm lint
pnpm test           # Vitest unit tests
pnpm verify         # typecheck + lint + test + build
pnpm e2e            # Playwright journeys against a fresh build served on 5176
pnpm e2e:dev        # the same journeys against the dev server on 5174
```

- Environment (optional, `.env.example`): `VITE_AI_PROVIDER` (`simulated` default, or `live`), `VITE_AI_ENDPOINT` (your backend proxy URL), `VITE_AI_MODEL`. There is no API-key variable by design.
- Demo profiles (profile switcher at the bottom of the sidebar): Meera Iyer (Admin), Rohit Khanna (Sales Manager), Arjun Mehta (Sales Executive, default), Sneha Reddy and Vikram Singh (Sales Executives). Farhan Qureshi (on leave) and Kavya Joshi (deactivated) appear in Team only.
- Reset the demo data as Admin from Settings, Demo (`/settings/demo`), or clear the site data.
- A guided walkthrough is in `DEMO_SCRIPT.md`; more detail in `README.md`, `CONVENTIONS.md` and `DESIGN_SYSTEM.md`.
