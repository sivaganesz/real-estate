# Assumptions — foundation (append-only)

## F1 (structure, types, catalogue, permissions, switcher, store, seed, i18n, theme, shell, router)

- **pnpm 12 build approvals.** `tesseract.js@6` ships an install script; pnpm 12 blocks unknown build scripts. It is denied in `pnpm-workspace.yaml` (`allowBuilds: { tesseract.js: false }`) because the library works without it (language data comes from its CDN at runtime, see K1). This file only holds that setting; there is no workspace.
- **Dependency versions resolved:** zustand 5.1.0, immer 10.2.0, recharts 3.11.1, @dnd-kit/core 6.3.1 / sortable 10.0.0 / utilities 3.2.2, pdfjs-dist 5.7.284, tesseract.js 6.0.1, date-fns 4.4.0, xlsx 0.20.3 from the official SheetJS CDN tarball (reachable), vitest 5.1.2, jsdom 31.0.1, @playwright/test 1.65.1.
- **Theme default is `system`** when nothing is saved (the rebuild defaulted to light). The pre-paint script in index.html and `lib/theme.ts` use the same rule, so there is no flash.
- **Route permissions.** Routes that every profile may open declare `'any'` (Today, Notifications). `/import/:kind` resolves its permission from the param (`leads` → import.leads, `apartments|villas|plots|commercial|properties` → import.properties, anything else → import.document). `/settings/:section` maps sections to their editing permission (pipeline, templates, matching/sla/scoring, assignment → rules.configure, users → user.manage, demo → demo.reset), other sections → settings.preferences.
- **Nav additions.** "Activity log" sits in the Insights group (permission `activity.viewLog`), so admins and managers can reach `/activity` from the sidebar. Notifications are reached from the bell and the phone "More" sheet, not the sidebar.
- **Phone tabs:** Today, Leads, Calendar, then Pipeline for roles with `team.view` (admin, manager) or Properties for executives, then More.
- **`lib/permissions.ts` also exports `PermissionError` and `assertCan()`** (pure), so services can import them from one place. `can()` resolves `own` through `createdBy` for `property.*` actions and through `ownerId` otherwise; user records are passed as `{ ownerId: targetUser.id }`. A deactivated user has no permissions.
- **Activity i18n keys are nested** (`activity:lead.created` resolves through `{ lead: { created } }`) because i18next uses `.` as the key separator. Page strings for the activity module live under `activity:page.*`.
- **Seed — temperatures are derived**, not stored. `INTENDED_TEMPERATURE` (data/seed/leads.ts) records the designed hot/warm/cold per current lead; the seed test checks it and scoring (later phase) should reproduce it.
- **Seed — saved views are 8**, not 6: the §6.4 distribution (Hot + Overdue per executive × 3, plus Unassigned + Stalled for the manager) adds up to 8.
- **Seed — assignments: 45** (one per assigned lead + 7 reassignments covering manual, owner on leave, redistribution from Kavya, rule by location). Within ±10% of "~50".
- **Seed — activities: ~180.** Closed historical leads carry only their closing stage change; current leads carry created/assigned/first-call/last stage change; plus appointments, completed tasks, today's calls (Arjun 7, Sneha 5, Vikram 4) and a 30-day call history. The test allows ±25% of 150.
- **Seed — "earlier today" times** (today's logged calls, tasks done today, last contact this morning) are spread between local midnight and `now`, so they are always today and never in the future whatever time the demo starts.
- **Seed — import jobs.** The builder price list (`IMP-1001`) *updated* 6 existing listings (`updated: 6`). The 99acres CSV (`IMP-1003`, 40 rows, 34 imported, 4 duplicates, 2 errors, partial) keeps its counts but has an empty `createdIds`, because the plan fixes the current pipeline at 23 leads; listing 34 extra leads would break that distribution.
- **Seed — historical converted leads** have `stage: 'converted'` while their clients' statuses are spread across agreement / loan processing / registered / converted, as §6.4 asks. Two of them hold the booked properties (PRP-1013, PRP-1019), three the sold ones (PRP-1005, PRP-1010, PRP-1018). Other historical clients have no `propertyId` (their units are not in the current 20-property inventory).
- **Seed — warehouse price** set to ₹2.1 Cr (Hoskote, 12,000 sq ft) so all deal values stay inside the planned ₹48 L–₹2.1 Cr range.
- **Seed — Farhan's leave** started before his leads were redistributed: Rohan Deshpande moved Farhan → Vikram 2 days ago (`ownerOnLeave`); Nisha and Gaurav still sit with Farhan for the Manager-Today "reassign on leave" demo.
- **Rebase registry.** `store/rebase.ts` lists every date path per collection; a test fails if any ISO-looking string in the seed is not shifted. Notification `dedupeKey`s that embed a day are not shifted (they only prevent duplicates).
- **Persistence.** On a first visit (nothing stored) the seed built at store creation is used and written to storage right after hydration (so a reload keeps the same data); a stored DB with a different `schemaVersion` or a broken shape is reseeded.
- **Automation tick on hydrate** (§5.1) is wired through `onDbHydrated(listener)` in `store/db-store.ts`; the automation service that subscribes to it is not part of F1.
- **Stub pages.** Every §8.1 route has its own lazy page file under `src/modules/<module>/pages/` rendering `<StubPage>` (page header + module illustration + "Coming soon" badge). Module owners replace the page files; `routes.tsx` stays the module's route list.
- **Shell placeholders** (replaced later): the bell popover lists the latest 6 notifications read-only (M8 adds read state and the centre); the AI panel is a right sheet with a "coming with the AI module" message, opened by the topbar pill, the floating button and Ctrl+K (M7 mounts the real panel).
- **Dialog/sheet/breadcrumb sr-only labels** in the ported shadcn primitives read i18n through `getI18n().t(...)` (non-hook; re-evaluated each time the element renders).
- **NoAccess / NotFound / Error states** include a visually hidden `<h1>` so every page has one heading level 1.
- **Lint.** `pnpm lint` reports 0 errors and 4 warnings, all `only-export-components` in ported shadcn files (`button`, `badge`, `tabs`, `toggle` export their `cva` variants). Left as ported.
- **Tamil strings** are drafted and need a fluent reviewer before the demo.

## F2 (services/core, entity services, automation, demo reset, queries, pure lib)

- **commit() results are plain values.** Services return ids/counts (drafts are revoked after commit). Callers read the new record from the store (`getDb()` / `useDb`).
- **Effects apply ownership immediately.** `assignNow()` sets `lead.ownerId` (and the round-robin cursor for auto) before emitting `lead.assigned`, so a loop of picks in one commit (bulk assign, deactivation redistribution, imports) sees updated workloads. E3 still records history, moves work and notifies.
- **First-call task lives in E3**, not E2: any lead that gets its first owner while still `new` and uncontacted gets the SLA call task (covers create, later manual assign, import and auto-assign alike).
- **E4 extras.** A logged call (any result) closes the lead's open `slaFirstCall` task; a second "no answer" moves the existing retry task instead of adding another. A retry is only created when someone owns the lead.
- **E7 for non-visit appointments** creates a follow-up task only when the outcome gives `nextFollowUpAt`; site visits always get the post-visit call (24 h or the given time). Completing any appointment marks the lead as responded.
- **E12 skips** the lead the property is held for and the lead whose deal is on that property (booked/negotiation). Notification dedupe key `unavailable:<property>:<status>:<lead>`.
- **New event `lead.noted`** (not in the plan's list) for free-text notes → `note` activity; used by activities.addNote and requestReassign.
- **Notification variants.** Kinds stay as typed; extra messages use `params.variant` rendered from `notifications:system.<variant>`: `assignmentBatch` (imports, E16), `rescheduled` (E9), `reassignRequest`, plus the seeded `readyToBook`. `services/notifications.notificationKey()` encodes the rule.
- **Automation dedupe keys:** `overdue:<task>`, `reminder:<apt>` (`:<start>` appended after a reschedule), `sla:<lead>`, `escalation:<lead>`, `unassigned-queue:<day>` (one daily note per manager/admin with the count), `stalled:<lead>:<day>`. Seed notifications were aligned (`unassigned-queue:<today>`, `escalation:LEAD-1005`) so the first tick does not duplicate them. A tick that finds nothing new does not commit (no re-render).
- **Seed tweaks for consistency:** Harish Reddy's negotiation now started 21 days ago (the plan's "stalled 16 days" contradicts its own rule "stalled > 2 × target", target 10); the stalledDeal notification says 21. Neha Kulkarni has `need: 'clear'` (her enquiry form is fully specific) so her derived score lands warm as designed.
- **Scoring vs INTENDED_TEMPERATURE:** 18 of 23 current leads derive the designed temperature and every designed-hot lead is hot (tested ≥ 75 %). The 5 misses are brand-new or uncontacted leads the plan's formula scores cold (no engagement yet). A lead with a chosen deal property gets full "fit" (15) because its own unit is no longer matchable.
- **Matching budget band:** ceiling = budgetMax × (1 + flex); up to the ceiling is a match ("over budget by …, worth a try" when above max); ceiling → 1.2 × ceiling = `budgetMismatch` (hidden from lists, shown in "worth a call" when ≤ 1.15 × ceiling); above → excluded. No budget known → budget part 70 with a "budget not known yet" note. Price 0 → "price on request".
- **Matching size part** averages configuration fit (exact 100, within the wanted range 90, more BHK 80) and area fit (inside [min,max] 100; below min the rebuild 200 × deviation curve; above max a gentler 100 × deviation). Unknown → 100.
- **Validation errors** use `common:validation.<key>`; services throw `ValidationError` (lib/validation) or `PermissionError` (lib/permissions) or `NotFoundError` (services/core/commit); the UI maps each to a toast or field message.
- **Users have no delete**, only deactivate/activate (history keeps their name). New user ids are `U-1001…` (seed users keep `u-<name>`).
- **settings.updateSettings('matching')** rejects weights that do not add up to 1.00 (±0.01). Manager-created assignment rules are scoped to their team.
- **Smoke e2e timeout.** "every profile can open every nav item" does ~40 full page loads; it already exceeded Playwright's 30 s default before F2 (verified with the ticker disabled). The test now sets `test.setTimeout(120_000)`; desktop smoke 6/6 green.
- **Not built in F2 (owned elsewhere):** services/commands.ts (M7), lib/lead-queries.ts (M2), lib/labels.ts, the AI provider (F3).

## F3 (shared components, AI service + simulated provider, AI UI, domain widgets, /__kit)

- **AI layer is read-only.** `src/ai/simulated/*` reads data only through `ctx.db()` and pure `lib/*` / `services/queries/*`; it never writes. Proposals run through the new `services/commands.ts` (`executeProposal`, first version; M7 deepens it) with `via: 'ai'`, so effects and the activity ✦ are the same as for manual changes.
- **Command language.** The simulated `parseCommand` understands English commands (suggested-prompt chips send English command text while their labels are translated). Tamil commands are not parsed by the simulated provider; replies are translated through the `ai` namespace.
- **Lead source when the assistant creates a lead** and the text names none: `manual` (shown in the proposal summary). The paste-and-fill path never fills source silently; it asks with chips.
- **"Budget around X"** is read as preferred = max = X (matching then applies the flex %). "under X" → max, "from/above X" → min, "X–Y" → min/max, a bare "budget X" → max.
- **Timeline buckets:** ≤ 3 weeks immediate, ≤ 3 months m1to3, ≤ 6 m3to6, ≤ 12 m6to12, longer or "just exploring" → exploring. "2–3 months" uses the upper bound.
- **Decision makers:** a named spouse/parent/partner adds `self` too with authority `joint`; approval words ("needs father's approval") give `needsApproval`.
- **Area for a lead** "1200 sqft" becomes a range 90%–115% of the value; a property's unspecified area kind is read as carpet with a note.
- **Property title** suggested by the extractor is English ("3 BHK Apartment in Gachibowli") because titles are data, never translated; marked low-confidence.
- **Appointment extraction** with no property named uses the lead's shortlisted/liked properties for a site visit (noted); with no day/time the assistant proposes tomorrow 11:00 and says so.
- **Live provider** POSTs `{ task, input, context: slim, model }` to `VITE_AI_ENDPOINT`, 15 s timeout, per-method fallback to simulated (the result then says `simulated`). `matchProperties` always stays rule-based (it needs the full inventory).
- **AI selection context:** record pages call `useAISelection({ kind, id })` (`ai/context.ts`) so the panel shows "On: Lead · Name" and commands default to that record. The panel gets the page title from the shell (components do not import the route registry).
- **AI panel** is docked (content gets `xl:pr-[440px]`) at ≥ 1280 px and overlays below; Esc closes it unless a dialog or menu is open; `aiPanelOpen` stays persisted as F1 decided. "Edit" on a proposal cancels it and puts the original request back in the input (first version).
- **Plan paths:** `error-state.tsx`, `filtered-empty.tsx`, `skeletons.tsx`, `match-explain.tsx` are separate files as in §2. Extra helpers: `shared/form-field.tsx`, `shared/table-controls.tsx` (density + column menu), `shared/undo-toast.ts`, `shared/charts/chart-style.ts|chart-parts.tsx|use-series.ts`, `domain/lead-select.tsx`, `domain/property-multi-select.tsx`, `domain/use-lead-facts.ts`, `ai/proposals.ts`, `ai/context.ts`, `components/ai/use-ai-fields.ts`. `pathFor(ref)` added to `app/paths.ts`; `scoreTone` / `matchTone` added to `lib/tones.ts`.
- **Not built in F3** (listed in plan §2 but outside this step): `saved-views-menu.tsx`, `view-switcher.tsx` (use `Segmented variant="pill"`), `ai-hero.tsx`, `domain/notification-item.tsx`, `ai/document/*` (M5).
- **New i18n namespaces:** `ui` (shared components), `domain` (domain widgets), `kit` (dev page); `ai` extended. Tamil drafted; needs a fluent review.
- **Colour values:** components use only tokens and `color-mix(in oklch, var(--token) …)`; the DS's literal image-scrim and sticky-header shadow values were replaced by `var(--overlay)` and `shadow-md`.
- **Lazy routes** (`/__kit`, NotFound) declare an empty `HydrateFallback`, removing React Router's console warning on a direct visit.
- **/__kit** is added in `router.tsx` only when `import.meta.env.DEV`; not in the registry or nav; remove before delivery.

## F4 (Playwright smoke, CONVENTIONS.md, README.md, acceptance walk)

- **Browser fallback** is an env switch, not an automatic retry: `PW_CHANNEL=chrome pnpm e2e`. Edge (default) ran green here, so no browser was installed and nothing was logged in PROGRESS.md.
- **Smoke navigation** clicks the real sidebar links (client-side), not `page.goto`, so profile switching and nav are exercised as a user would; each executive must not see `/team` in nav and gets NoAccess on a direct visit.
- **"Data persists after reload"** is checked with a real write: the manager creates a lead through the AI panel (proposal → Confirm → services), reloads, and the lead (exactly one) and the chosen profile are still there; theme + language also survive a reload. The seed-stability + rebase check stays.
- **Dev-mode check** for "no console errors on 5174": `pnpm e2e:dev` (playwright.dev.config.ts) runs the same journeys on the dev server, where React dev warnings count as failures. Green.
- **Tablet project** previously had no tests; added one `@tablet` test (shell renders, no horizontal scroll).
- **Added `src/services/demo.test.ts`** (§9 "demo.reset() works"): admin reset restores the fresh seed; manager and executive are refused.
- **README demo reset**: the reset UI belongs to M8 (`/settings/demo`, currently a stub); README says so.
- **Shell file names** differ from plan §2 (F1 chose `topbar-controls.tsx`, `mobile-nav.tsx`, `ai-launcher.tsx` instead of topbar / bottom-tabs / mobile-nav-sheet / theme-toggle / language-toggle / ask-ai-bar). Behaviour matches; not renamed in F4 to avoid churn.
- **Not built (carried from F3, outside §9's required list):** `shared/saved-views-menu.tsx`, `shared/view-switcher.tsx`, `ai/ai-hero.tsx`, `domain/notification-item.tsx` (M8), `ai/document/*` (M5).
- **PROGRESS.md** left to the Parent (its status table still says Foundation "not started"); checkpoint commit is the Parent's.

## Foundation review (independent reviewer)

- **lib/lead-queries.ts** built in the review (plan §7.5/§9 list it for Phase 1; F2 had deferred it to M2). M2 owns and extends it.
- **lib/labels.ts not built:** `lib/` is pure (no React), so a `useLabels()` hook cannot live there; components translate catalogue values directly with `t('catalogue:…')`, which covers the same need.
- **Denial reason "{{role}} can't do this"** now nests the translated role (`$t(common:roles.{{role}})`), so callers pass the raw role key; NoAccess no longer overrides `role` with a label. Added specific reasons for `property.delete` and `user.manage`.
- **Assistant refusals for destructive/admin requests:** "delete/remove … property", "delete … lead", "deactivate/add … user" are recognised. Without the permission the assistant refuses with the reason; with it, it points to the record page / Team (the assistant never deletes; delete keeps confirm + undo on the record).
- **Appointment extraction:** "in 2 hours / in 30 mins / in an hour" is a start relative to now (rounded up to 5 min), not a duration; bare "meet" reads as an office meeting.
- **Lead name** is also read as a 2–3 word capitalised name right before a (labelled) phone number ("new enquiry - Suresh Kumar, ph 98765 …"); single words are not taken, so "Pune, 98…" is never a name.
- **Property extraction** reads named approval authorities (CMDA, DTCP, BBMP, …) as approvals with docs pending, and "patta" as patta available.
- **Budget range words in AI output** ("up to" / "from") now come from i18n. Tamil places the word before the amount (inrRange prefix form); a fluent review may prefer "₹75 L வரை" (suffix) — left for M2/M7.
- **Today stub** hides "Go to Today" on /today itself (it did nothing there).
