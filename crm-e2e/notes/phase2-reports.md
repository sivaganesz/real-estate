# Phase 2 build + review reports (verbatim)



---
## build:m1-today-reports

## M1 Today & Reports: report

Both screens are built and working. `/today` gives a different view to the executive (all three accounts), the manager and the admin. `/reports` and `/reports/:tab` have six tabs of interactive charts. Every one-click action writes through a service, and because the Today lists are recomputed from the store on every change, a row leaves or moves as soon as you act. Typecheck and lint show 0 errors in my files and all my tests pass. The full `pnpm test` run is not green: one locale test in another module's files fails (see "Problems in other agents' files").

### What I built
**Data (my files, additive only):**
- `src/services/queries/stats.ts`: all existing exports kept. Added:
  - periods and buckets: `periodBounds`, `periodBuckets`, `pctChange`, `REPORT_PERIODS`
  - series: `trendSeries`, `dailySeries`, `pipelineValueSeries`, `conversionSeries`, `activityTrend`
  - report scope: `subjectOptions`, `subjectLeads`, `subjectUserIds`, `parseSubject`, `subjectKey`
  - pipeline health: `stageAging`, `lostReasonsIn`, `closedAt`
  - people: `execPerformance`, `streakDays`, `teamRank`
- `src/services/queries/today.ts`: refined, all signatures kept.
  - A hot or stale lead that already has a follow-up planned drops off the list, so Reschedule actually clears it.
  - Added: an `overdue` flag on items, `executiveBriefFacts`, the visited-not-booked list (≤ 14 days), rank, streak, next appointment.
  - Manager additions: queue age and breach flag, overdue tasks per executive, missed post-visit calls, `openLeadIdsOf`.
  - Admin additions: KPI series and deltas, inventory, import totals, alerts, and `businessInsights` (3–5 items, each with a drill-down link).

**Today (`src/modules/today/**`):**
- **Hero:** greeting, AI day brief, "Start here" chips that scroll to a row, a stat strip, and an inline assistant. The assistant runs `ai.parseCommand`; any change it proposes appears as a card and runs only on Confirm (Demo AI badge throughout).
- **Executive:**
  - ranked priority list with reason chip, due time, score ring, and Call (`tel:`, then opens Log outcome), WhatsApp (`wa.me`, logged), Log outcome, Reschedule, Done (with Undo), Open
  - filter tabs on the list, and an "All caught up" empty state
  - appointments timeline with a "Now" marker, map links, Send confirmation (WhatsApp template, marks the visit confirmed) and Record outcome
  - target rings, revenue meter, team rank, streak and pace
  - lead sections: Hot / Overdue / New today / No contact N+ days
  - New matches to send (Share on WhatsApp, Shortlist) and the Visited-not-booked strip
- **Manager:**
  - unassigned queue with the AI-suggested executive and reason, per-row Assign or Choose, and Auto-assign all (preview dialog, Undo)
  - team board with availability, a hot/warm/cold load bar, calls, visits, overdue and TAT breaches
  - needs-attention list (escalations, missed post-visit calls, high-value leads untouched) plus one-click "Reassign with auto-assign" cards for executives on leave or deactivated
  - stalled / negotiation deals, overdue by executive (expandable), team visits coloured by executive, bookings and revenue gauges, and the funnel
- **Admin:**
  - six KPI cards with sparklines and deltas; the inventory card shows a status bar
  - source funnel chart and team snapshot table
  - system alerts with one-click fixes (auto-assign, redistribute a deactivated owner's leads, duplicates, missing data, incomplete listings)
  - AI insights with drill-down links, and import activity

**Reports (`src/modules/reports/**`):**
- Scope selector: Everyone / a team / one person. Executives see only their own numbers under the title "My performance", and the Team tab is hidden for them.
- Period switcher: week / month / quarter / 6 months. CSV export of the current tab appears only when `export.data` is allowed.
- Tabs:
  - Overview: KPIs with sparklines, leads and bookings trend, AI summary, funnel with drop-off, sources donut
  - Pipeline: value by stage in stage colours, where-deals-wait table, lost reasons
  - Sources: source → visit → booking chart and table
  - Team: performance bar chart and table
  - Activity: weekday × hour heatmap and calls/messages trend
  - Inventory: status donut and by-type chart
- Every chart, row and AI line opens a drill-down drawer listing the exact records behind the number, with its own CSV and a link on to the module.

**i18n:** `today` and `reports` written in full in English and Tamil (Tamil needs review by a fluent speaker).

### Acceptance criteria (plan §8.3)
Met:
- Role-specific `/today` with no clicks needed, using the DS §14 rule 4 layout. Below `lg` the executive view is one column in the order hero, priorities, appointments, targets.
- Every executive, manager and admin item listed in §8.3.
- Reports: all charts, period switcher, scope, CSV export, AI summary, tooltips, legends, empty states and click-through.
- Numbers react at once: a test changes a stage and the funnel moves; other tests log a call, complete a task (with Undo), reschedule, and auto-assign, and check the lists re-rank.

Partly met:
- Click-through goes to an in-module drill-down drawer, not to a filtered Leads or Pipeline list, because `paths.leads()` and `paths.pipeline()` take no filter parameters yet (request R1).
- The brief, insights and report summary are rule-based and always show the "simulated" Demo AI badge. Only the inline assistant follows the configured provider's mode.

### Tests
- `src/services/queries/today.test.ts`: the original 4 tests plus 6 that run the real services on a live store and check the list re-ranks.
- `src/modules/today/lib/today-lib.test.ts`: reschedule slots, due states, filters, briefs, target pace.
- `src/modules/reports/lib/reports-lib.test.ts`: scope, periods, report build, drill-downs matching the counts, funnel reacting to a stage change, CSV.
- In total 51 tests ran across my modules and the locale check; 50 passed. The 1 failure is the `import` locale check (M5's files).

### Requests filed (`notes/requests-m1-today-reports.md`)
No foundation files were edited.
- **R1 (nice):** filter parameters on `paths.leads()` and `paths.pipeline()`.
- **R2 (nice):** let the AI panel open with a question already typed in.

### Problems seen in other agents' files (not fixed)
- Typecheck errors when I checked mid-run: `components/domain/match-list.tsx` (unused AppointmentFormDialog), `modules/import/lib/sheet.ts` (missing `./mapping`), and `modules/pipeline/lib/pipeline.ts` / `pipeline.test.ts` (type errors). I only re-checked my own files at the end, so these may be fixed or changed since.
- The locale check (`src/i18n/locales.test.ts`) failed for `clients` and `leads` earlier, and for `import` at the end: Tamil is missing keys that exist in English.
- Lint warnings only (no errors) in clients, leads and import files.

### Screenshots and notes
- Screenshots: `E:\real-estate\crm-e2e\notes\screens\m1-today-reports\`. Today for all three roles and Reports (admin, manager pipeline tab, executive) at 1440 light, 1440 dark and 375 light, plus the executive Today in Tamil. The last Tamil fix (a wider due-time column) was made after these shots were taken.
- Notes:
  - `E:\real-estate\crm-e2e\notes\assumptions-m1-today-reports.md`
  - `E:\real-estate\crm-e2e\notes\requests-m1-today-reports.md`
  - `E:\real-estate\crm-e2e\notes\ported-files.md` (2 rows added: the reschedule menu and the Done action, from wireframe-rebuild)
- The dev server on port 5201 is stopped and the port is free.

---
## build:m2-leads-clients

## M2 Leads, Qualification & Clients: report

The whole module is built. `pnpm typecheck` exits 0 and `pnpm lint` exits 0, with no warnings left in my files. `pnpm test` passes 47 of 47 files and 616 of 616 tests, which covers every module at the time of the run. Dev server 5202 is stopped and the port is free. The temporary Playwright scripts are deleted. Nothing was committed.

### What I built

**Leads list** (`/leads`)
- **Header:** four KPI cards that filter the list when clicked: open leads with a weekly sparkline, hot, overdue, and unassigned (manager/admin) or SLA-breached (executive). Each has a share ring.
- **Tabs with counts:** All, Overdue, Due today, Upcoming, Unassigned (manager/admin only) and Closed.
- **Search and filters:**
  - Search box. If you type a sentence like "hot NRI leads in Gurugram under 4 cr", the AI offers it as filters, marked with the Demo AI badge, and applies them when you click.
  - Filter pills with counts: stage, temperature, priority, source, executive (managers only), city, locality, budget band, created date, needs attention.
  - Saved views: apply, save, delete with undo. The seed's own view formats load correctly.
  - Sort, density, column menu, and CSV export for anyone with export permission.
- **Three views:**
  - "Today design", grouped by who to call now.
  - Table, with sortable columns, hover actions and pagination.
  - Cards.
- **Phone layout:** the table becomes stacked compact cards.
- **Aging badges:** days since last contact, plus an "SLA breached" badge.
- **Bulk bar:** Assign, change stage (one undo for all; Lost asks for a reason), export, and delete (confirm + undo). Each action is hidden or disabled by permission.

**Add lead**
- A 3-step sheet, also available as a full page at `/leads/new`.
- Paste-and-fill, voice and .txt input. AI-filled fields are marked, and only the missing essentials are asked, as chips.
- Smart required: name + phone or e-mail + source. Optional sections are collapsed.
- Live "N properties already fit" line and a live qualification preview.
- Duplicate warning by phone or e-mail shows the owner and an "Open existing" link, plus a "save anyway" tick that adds a note to the new lead.
- Managers and admins see an auto-assign preview ("Goes to Sneha · Lowest workload"). After saving, a toast names who got the lead and why.

**Lead page** (`/leads/:id`, three zones)
- **Summary rail:**
  - Who the lead is, plus a score ring with a "Why this score?" popover showing the five factor bars, and the conversion probability.
  - What they want (budget, locations, configuration), editable in place with undo.
  - Buyer type / HNI: managers can set it; executives see "Restricted".
- **Main column:**
  - Stage steps, Mark as lost (needs a reason) and Reopen.
  - Next best action card (AI-worded, Demo AI badge, one button that does it).
  - Quick actions: Call, WhatsApp, Site visit, Follow-up, Match, Stage, Reassign for managers or Request reassignment for executives.
  - AI summary.
  - Tabs: Activity (composer + timeline), Matches (shortlist / share on WhatsApp / schedule / not interested), Appointments, Tasks, Assignment history.
- **Side column:**
  - Qualification card, "X of 4 known", with ✓ / ? checks. The word BANT never appears.
  - Under it, answers the AI read from notes (applied only when you click Apply) and chips for only the missing questions, including loan, self-use vs investment and possession.
  - Message composer: WhatsApp / SMS / e-mail, English or Hinglish, editable. Opening it goes to wa.me (or sms / mailto) prefilled and logs the send.
  - "Edit with AI": "change budget to 1.5 Cr and add Hebbal" shows the changes from → to with tick boxes, then applies them with undo.

**Edit page** (`/leads/:id/edit`): the full form, with the Edit-with-AI box on top that fills the form instead of saving.

**Clients**
- **List:** KPIs, status tabs, search, executive and loan filters, sort, journey bar, loan and document progress, and phone cards.
- **Detail:**
  - Journey stepper with undo, and cancel booking (confirm).
  - Booking card, loan card (bank / status / amount), KYC toggle.
  - Documents checklist: pending → received → verified, add the standard list, add a custom document, remove with undo.
  - Notes, AI summary and a reminder WhatsApp draft.
  - Lead timeline, appointments (can schedule a documentation visit) and delete (confirm + undo).
- Clients are still created automatically on Booked (effect E5).

### Acceptance criteria (plan §8.3, M2)
All are met. I checked these end to end in Edge against the dev server:
- The Rahul Verma paste fills name, phone, 3 BHK, Whitefield + Sarjapur Road, ₹1.2 Cr, ready to move, 1–3 months and spouse. Only the source chip was left; picking it and saving opened `LEAD-1044`.
- Edit with AI raised the budget to ₹1.5 Cr and added Hebbal.
- The duplicate warning listed both Mohammed Irfan leads.
- No console errors or warnings during any of these runs.

Two caveats:
- Tamil text is my draft and needs review by a fluent speaker. English and Tamil keys match (the parity test passes).
- I could not fully check phone-width layout of the bulk bar against the bottom tab bar.

### Tests added
- `src/modules/leads/lib/lead-form.test.ts`: the Rahul example, smart required fields, places, chip answers, and the edit-with-AI cases.
- `src/modules/leads/lib/focus.test.ts`: the "Today design" grouping and the header numbers.
- `src/modules/clients/lib/client-queries.test.ts`.
- `src/lib/qualification.test.ts`.
- New cases in `src/lib/lead-queries.test.ts`: aging, saved views, extra filters, CSV.

### Shared files I changed
- **Additive service functions** (allowed by §8.2):
  - `services/leads.ts`: `LeadFieldPatch` and `updateLeadFields`, for partial requirement / qualification patches.
  - `services/clients.ts`: `changeClientStatus`, `removeClientDocument`, `addClientDocuments`, all undoable.
- **My own lib files:**
  - `lib/lead-queries.ts`: `contactAging`, saved-view conversion, CSV, priority / locality / created filters.
  - `lib/qualification.ts`: `extraQuestions`, `answerPatch`.
  - `components/domain/lead-pills.tsx`: `AgingBadge`, `PriorityPill`.

### Requests filed (`notes/requests-m2-leads-clients.md`, none applied)
- **R1 — affects everyone using `Drawer`:** in `components/shared/drawer.tsx` the 480 / 640 px widths lose to the Sheet's `data-[side=right]` sizes. Every drawer renders about 384 px wide, and is not full-screen on phones. I worked around it in my own sheet with a className. Exact fix is in the file.
- **R2:** `paths.leads()` should accept `tab` / `view` / `add`. The Leads page already reads `?tab=`, `?view=` and `?add=1`.
- **R3:** the AI-field marker's negative margin pokes past grid cells.

### Problems seen in other agents' files (not fixed)
- Earlier in the run, `tsc` errors in `src/modules/import/lib/import-flow.test.ts` (no node types for `node:fs` / `node:path`, `import.meta.dirname`) and in `src/modules/today/components/executive-view.tsx` (wrong `t()` argument types). Both were gone by the final run, which exited 0.
- Other agents' edits make Vite fully reload the page every so often, which can interrupt screenshot runs.

### Files
- Assumptions: `E:\real-estate\crm-e2e\notes\assumptions-m2-leads-clients.md`
- Requests: `E:\real-estate\crm-e2e\notes\requests-m2-leads-clients.md`
- Ported-files rows appended: `E:\real-estate\crm-e2e\notes\ported-files.md`
- Screenshots in `E:\real-estate\crm-e2e\notes\screens\m2-leads-clients\` at 1440 light, 1440 dark and 375 light: `leads-*`, `lead-*`, `lead-edit-*`, `clients-*`, `client-*`, `add-lead-*`, `add-lead-filled-*` (the Rahul fill). There is no 375 shot of add-lead step 2.
- Code: `E:\real-estate\crm-e2e\src\modules\leads\` and `E:\real-estate\crm-e2e\src\modules\clients\`, plus `src\i18n\locales\{en,ta}\leads.json` and `clients.json`.

---
## build:m3-properties-matching

## M3 Properties & Matching: finished

The whole module is built and working against the shared demo data. In the full-repo run at the end, `pnpm typecheck` has 0 errors, `pnpm lint` has 0 errors (only fast-refresh warnings) and `pnpm test` passes 47 files / 616 tests. I did not run `pnpm build`, as plan §8.2 says. I also scripted the main flows in Playwright (Edge) on port 5203. All of them worked with no console errors or warnings. The dev server is stopped and port 5203 is free.

### What I built
- **Properties list** (`/properties`, file `src/modules/properties/pages/properties-page.tsx`)
  - Four KPI cards: live listings (with a sparkline), available (with a progress bar), average ₹/sq ft, and "need attention" (click to filter).
  - Plain-words search, e.g. "3BHK Whitefield under 1.2 Cr ready to move east facing". It shows "How I read it" chips you can remove, and suggests which filter to drop when nothing matches.
  - Filter pills with counts: type, city, locality, budget, BHK, possession, furnishing, facing.
  - Status tabs with counts: all, available, on hold, booked, sold, drafts, archived. Sorting by date, price or area.
  - Three views: cards, table, and "By locality" (each group shows count, price range, average ₹/sq ft and a status bar).
  - Select cards or rows for bulk actions, each shown only if your role allows it: change status (one step, with Undo), export CSV, delete (confirm, then Undo).
  - Empty and filtered-empty states.
- **Add / edit property** (`components/property-form.tsx`, logic in `lib/form.ts`)
  - The form changes with the property family (flat, house, plot, land, commercial, warehouse) and covers every master prompt §13 field: area triple, plot dimensions and unit, facing, corner, floor, rooms, parking, furnishing, amenities, possession and date, RERA, approvals with document status, khata/patta, bank approvals, loan, owner/builder, commission, the family-specific details from the catalogue, availability/hold and listing state.
  - ₹/sq ft is worked out live. There is a completeness ring, a title suggester, and fields that don't apply to the chosen type are cleared on save.
  - Photo upload with preview: images are shrunk to at most 1600 px JPEG, 8 per property, about 4 MB in total; you can set the cover and remove photos.
  - Paste-and-fill and voice. Your example "2.5BHK 1200 sqft east facing in Kondapur 85 L ready to move" fills the form and computes ₹7,083/sq ft (unit-tested); a longer listing in the screenshot filled 14 fields. AI-filled fields are marked and missing essentials are asked with chips. Nothing saves until Save is clicked.
  - On the edit page, pasted text changes only the fields it mentions. An executive can edit only properties they created, and only an admin can delete.
- **Property page** (`/properties/:id`)
  - Photo strip with a full-screen viewer, and key facts as icon tiles.
  - Price check: where this listing sits against similar ones, plus stamp duty, registration and the all-in cost.
  - Legal and approvals, and history from the activity log.
  - Matched leads, with the four actions (shortlist, share on WhatsApp, schedule visit, not interested) and a "close on budget" list.
  - Leads already linked, related appointments, and listing health with a "find missing data" checklist.
  - AI listing copy (title and description), with the Demo AI badge; it is applied only after you click "Use".
  - Status control. Marking it Booked or Sold asks first, removes it from every match list at once, notifies the owners of interested leads, and can be undone.
- **Matching** (`/matching?lead=` or `?property=`)
  - Works both ways: pick a buyer to rank properties, or pick a property to rank buyers.
  - Every match shows the %, a label and the reasons, plus "close on budget" and a "not shown, and why" list.
  - Card or list layout; select several properties and share them together.
  - "Fresh matches to send" when no buyer is picked yet.
  - A matching assistant you can type or speak to, e.g. "properties within Priya's budget in Whitefield" or "which leads fit PRP-1001". It shows how it read the request, with the Demo AI badge.
- **Shared match actions** in `components/domain/match-list.tsx` (a file I own), so the lead page can reuse them.
  - Shortlist; not interested (with Undo); schedule visit opens the existing appointment dialog prefilled.
  - Share opens a WhatsApp dialog: English or Hinglish template or an AI draft, editable, then it opens wa.me and records the share on the lead (it marks the properties as shared; E11).
  - `PropertyCard` can now be selected.
- **New service functions** (added, nothing existing changed) in `services/properties.ts`:
  - `changePropertiesStatus` for the bulk change.
  - `replaceProperty` for saving the edit form. I added it because the existing `updateProperty` cannot clear a field the user emptied.

### Acceptance criteria (plan §8.3, M3)
All met. Checked in the browser on port 5203:
- create via paste-and-fill → save
- edit → save
- Booked → it leaves matching and 4 owners were notified
- share → logged
- not interested → excluded
- assistant request → goes to the right buyer
- bulk bar

Not fully covered:
- I did not take Tamil screenshots; Tamil is covered by the locale key test.
- 768 px was not screenshotted, only built responsively.

### Tests added
- `src/modules/properties/lib/form.test.ts` (10 tests, including your paste-and-fill example)
- `src/modules/properties/lib/image.test.ts`
- `src/modules/properties/lib/list.test.ts`
- `src/modules/matching/lib/assistant.test.ts`
- `src/lib/property.test.ts`

### Requests filed (none blocking; nothing applied to foundation files)
In `notes/requests-m3-properties-matching.md`:
- **R1:** the share message template says "here are 1 options" when one property is shared (catalogue / `lib/whatsapp`).
- **R2:** the M7 property extractor misses the owner's name in "owner Ramesh 98450 12345".
- **R3:** `components/domain/lead-select.tsx` causes a React warning (select switches from uncontrolled to controlled).

### Problems seen in other agents' files (not fixed by me)
- During the run, M7's `src/components/ai/ai-panel.tsx` crashed the app for a while ("add is not defined"). There were also passing type errors in M5 (`modules/import/*`) and M7 (`ai/simulated/assist.ts`), and the M5 `import` locale test failed for a while. All of these were fixed by the final run.
- The shared scratchpad is used by several agents at once. M1 overwrote my `shots.cjs`, so I switched to `m3-*` file names.

### Files
- Code: `E:\real-estate\crm-e2e\src\modules\properties\**`, `E:\real-estate\crm-e2e\src\modules\matching\**`, `E:\real-estate\crm-e2e\src\components\domain\match-list.tsx`, `E:\real-estate\crm-e2e\src\components\domain\property-card.tsx`, `E:\real-estate\crm-e2e\src\lib\property.ts`, `E:\real-estate\crm-e2e\src\lib\search.ts`, `E:\real-estate\crm-e2e\src\services\properties.ts`
- Translations (English and Tamil): `E:\real-estate\crm-e2e\src\i18n\locales\{en,ta}\properties.json` and `matching.json`
- Notes: `E:\real-estate\crm-e2e\notes\ported-files.md` (5 rows added), `E:\real-estate\crm-e2e\notes\assumptions-m3-properties-matching.md`, `E:\real-estate\crm-e2e\notes\requests-m3-properties-matching.md`
- Screenshots (26, at 1440 light, 1440 dark and 375 light): `E:\real-estate\crm-e2e\notes\screens\m3-properties-matching\`

---
## build:m4-appointments-tasks

## M4 Appointments & Tasks: report

The module is built and works by hand and with AI. Every §8.3 M4 criterion is met, with one gap in "Effects visible elsewhere" (see below).

**Checks**
- `pnpm test`: 47 files, 616 tests pass.
- `pnpm lint`: 0 errors, and no warnings in my files.
- `pnpm typecheck`: clean for my files. The only errors left belong to M1 (listed at the end).
- A scripted browser run on port 5204 exercised booking, outcome, tasks, the assistant and AI quick add. After one fix (a warning from `lead-select.tsx`) the screenshot runs showed no console errors or warnings.
- The dev server on 5204 is stopped and the port is free.

### What I built
**Calendar (`/appointments?view=day|week|month|list&date=`)**
- KPI cards: Today (with a 7-day sparkline), Site visits this week (with a done ring), Waiting for outcome, To confirm.
- A "waiting for outcome" strip with Log outcome buttons.
- Day and week views on a custom time grid:
  - overlapping appointments sit side by side;
  - colour by type, with status styling (completed, cancelled, no-show, confirmed);
  - clashes get a striped overlay and a warning icon;
  - a current-time line, and today's date in a filled circle;
  - click or keyboard on a slot to book.
- Month view with at most 3 chips a day and "+N more"; on a phone the chips become dots.
- List view grouped by day, each card with quick actions.
- Type legend chips that filter; executive filter (managers and admins only) and status filter.
- Empty, filtered-empty and no-access states. On a phone the default is the day view, and the week view becomes the list.

**Appointment form (`appointment-form-dialog.tsx`)**
- Lead, type, several properties, executive (only for roles beyond "own"), date/time/duration, location (defaults to the property address, with a map link), reminder, notes.
- Paste-and-fill marks the fields the AI filled.
- "Free slots" chips suggest open times for the executive (Demo AI badge).
- The clash warning reads like "Vikram Singh already has Rohan Deshpande at 12:30 PM" and the save button becomes "Book anyway"; it never blocks.
- The form also handles editing an existing appointment.

**Appointment detail (`/appointments/:id`)**
- Actions: confirm, log outcome, reschedule (with free slots and the clash warning), cancel with reason chips and Undo, no-show with confirm and Undo, edit, delete with confirm and Undo.
- Outcome dialog:
  - fields: result, interest, liked properties, objections, decision maker present, next step, follow-up time, stage, summary;
  - "Describe the visit" (typed or spoken) fills the form;
  - an AI card suggests the next follow-up time and stage, and one click on Apply fills them in;
  - Save completes the appointment and moves the stage in one commit with Undo.
- AI preparation points before the visit; AI meeting summary after it.
- WhatsApp confirmation (English or Hinglish, editable) with the Google Maps link; sending is logged on the lead. Client card, related follow-ups and the activity timeline sit alongside.

**Tasks (`/tasks`)**
- KPI cards with sparklines and quick add. Quick add takes a title, due chips and a lead; "Say it in your words" turns a sentence into a task proposal that you confirm before it is created.
- Tabs for Overdue, Today, Upcoming and Done with counts; search plus executive, type and priority filters; group by due date or by lead.
- Rows:
  - completing a call task asks for the call result; "Not reachable" or "Busy" creates the automatic retry task;
  - reschedule chips (Tomorrow, In 3 days, Next week, or pick a time) with Undo;
  - Call and WhatsApp buttons, and overdue highlighting;
  - Reopen on done tasks.
- Bulk complete and bulk reschedule with Undo.
- Follow-up Assistant drawer: suggests the best time and channel with a reason, drafts the message through the AI service, and offers "Use this time", "Send on WhatsApp" and "Apply all times".

**Effects elsewhere:** booking a site visit moves the lead's stage, and completing a visit creates the 24-hour post-visit call. Both come from the foundation effects (E6 and E7) and the save toasts mention them.

**Pure logic and tests** (56 tests across 5 files):
- `modules/appointments/lib/` `calendar.ts`, `visit-ai.ts`, `messages.ts`, `event-style.ts`
- `modules/tasks/lib/` `task-lists.ts`, `follow-up.ts`
- `components/domain/appointment-slots.ts`
- Test files: `calendar.test.ts`, `visit-ai.test.ts`, `appointment-slots.test.ts`, `task-lists.test.ts`, `follow-up.test.ts`

**i18n:** the `appointments` and `tasks` namespaces are complete in English and Tamil (Tamil drafted, needs review by a fluent speaker).

**Services (additive):**
- `completeAppointmentWithStage` in `services/appointments.ts`. To add it I also extended that file's import lines.
- `rescheduleTasks` in `services/tasks.ts`.

**Ports:** `visit-outcome.tsx` and `reschedule-button.tsx` from wireframe-rebuild, logged as two rows in `notes/ported-files.md`.

### Criteria
- **Met:** calendar (all four views, legend filters, executive/type/status filters, current-time line, click a slot to book); appointment form with the non-blocking clash warning and paste-and-fill; detail actions; outcome with the AI follow-up and stage suggestion; AI preparation points; AI summary; WhatsApp confirmation with the location link; tasks (tabs, grouping, quick add, priority, call result with automatic retry, reschedule chips, bulk complete, overdue highlighting, Follow-up Assistant).
- **Partly met:** "booking a visit from a lead moves its stage" works whenever the form is used, but the "Book visit" button on the lead page belongs to M2. My dialog's `leadId` and `propertyIds` props are ready for it.

### Requests filed (`notes/requests-m4-appointments-tasks.md`)
- **APPLIED:** new file `components/domain/appointment-slots.ts` plus its test (needs adding to the M4 ownership list).
- **APPLIED:** `lead-select.tsx` now passes `value ?? ''`, which removes React's "uncontrolled to controlled" console warning.
- **Not applied (nice to have):** generic yes/no keys in `common`; call-result and visit-result labels in `catalogue`; the shared drawer sometimes did not close on Escape in automated runs; the simulated `visitConfirm` message prints "to  at ." when called without an appointment id.

Assumptions are in `notes/assumptions-m4-appointments-tasks.md`.

### Screenshots (`notes/screens/m4-appointments-tasks/`)
- Pages: week, month, day, list, upcoming detail, completed detail, tasks.
- Each at 1440 light, 1440 dark and 375 light, plus a Tamil set at 1440 light (`-ta`).
- Nothing scrolls sideways at 375: an appointment-card overflow was found and fixed.

### Problems in other agents' files (reported, not fixed)
- **M1:** typecheck errors TS2345 (a `TFunction` passed where a plain translation function is expected) in `src/modules/today/components/executive-view.tsx` (lines 53 and 57) and `priority-list.tsx` (line 107).
- **Earlier in the run, since resolved:**
  - typecheck errors in `src/modules/import/*` (M5), `src/modules/reports/components/report-tabs.tsx` (M1), `src/ai/simulated/assist.ts` (M7) and `e2e/m6-pipeline.spec.ts` (M6);
  - the locale test failed on the M3 `properties` namespace (Tamil keys missing).

  Other agents' dev-server reloads also blanked some of my screenshots mid-capture, so I retook them.


---
## build:m5-import

M5 Import & Extraction is built and meets all of the plan §8.3 criteria except one: an executive still sees an "Import" link in the sidebar that opens the NoAccess page. That needs a one-token change in `app/nav.ts`, which I filed as request R1 and did not apply. `pnpm typecheck`, `pnpm lint` and `pnpm test` all pass on the whole project: 47 test files, 624 tests, 0 type errors, 0 lint errors. I drove every flow in Edge against my dev server on port 5205 with no console errors, then stopped the server and checked that 5205 is free.

## What I built
- **`/import` hub:** four KPI cards (imports with a sparkline, rows read, duplicates caught, drafts to review with a ring). Five template cards (Apartments, Villas/Houses, Plots/Land, Commercial, Leads), each with **.xlsx** and **.csv** files generated by SheetJS when clicked. The .xlsx has the headings, 2–3 example rows and an Instructions tab. There is also a documents card, a "Try a sample" list and the five most recent jobs.
- **Sheet wizard `/import/:kind`** (Upload → Columns → Check → Done). Nothing is written until the user confirms on Check.
  - **Upload:** xlsx, xls, csv or a sample. Dropping a PDF or image there switches to document extraction.
  - **Table detection:** Instructions/Lists/Help tabs are ignored and the tab with the most rows wins. Title, blank, totals and note rows are skipped and shown as chips.
  - **Mapping:** matched by saved mapping, template heading, synonym, fuzzy spelling or the column's values, each with a confidence. You can change any column in the shared mapping table, save the mapping (and it is re-applied automatically next time), and set one value for all rows when a required column is missing.
  - **Check:** every row is Ready, Draft, Duplicate or Needs fixing. It validates phones, emails, prices like "1.2 Cr", "85 L" and "Call", per-sq-ft rates, areas in sq ft, cents, acres and "30x40", "Ground" floors, Excel dates, facings, possession, and price-to-area sanity.
  - **Duplicates:** checked against the CRM (with a link to the record) and within the file. On import you choose to skip them or update the existing record.
  - **Fixing:** fix a row inline and it is re-checked; "Set for all" fills a gap shared by several rows; any row can be skipped or included.
  - **Done:** counts, a donut chart, who the new leads were auto-assigned to, links, a CSV of rows not imported with a Problems column, and Undo.
  - Unmapped columns are never dropped: they go into the property description or the lead's note.
- **Documents `/import/document`:**
  - **Reading:** text PDFs through pdfjs-dist; scanned PDFs and images through tesseract.js, loaded only when needed, with a progress bar driven by tesseract's own progress events.
  - **Extraction:** the text runs through M7's `extractLead` / `extractProperty`. Brochures with a unit table become one property per unit, and my own rules read each unit row, the project name and the possession date.
  - **Review:** editable source text with "Read again", a Lead/Property switch with the AI's guess, AI markers on filled fields, low-confidence fields highlighted, and the Demo AI badge.
  - **Saving:** Save, Save as draft, or save the complete ones and keep the rest as drafts. "Fill the form by hand" and "Paste text" are the manual paths.
- **`/import/drafts`:** cards with a confidence ring, a count of fields to check and of missing facts, tabs for To review / Saved / Discarded, filters, and Discard with confirm and Undo.
- **`/import/drafts/:id`:** the prefilled form with low-confidence fields highlighted, a duplicate warning, paste-and-fill, and the source panel. "Save as lead/property" goes through the lead/property services and marks the draft saved. Appointment drafts open the appointment booking form.
- **`/import/history`:** search, filters and pagination. A side panel shows the mapping used, error rows (as CSV too) and created records. "Remove from history" asks first and can be undone.
- **Permissions:**
  - Executives get NoAccess on `/import` but can use `/import/document` and their own drafts.
  - Managers can import leads only; property templates show a lock with the reason.
- **Sample files:** `scripts/make-samples.mjs` (I ran it) creates the five files in `public/samples/`:
  - a 99acres lead CSV
  - a messy builder `.xlsx`
  - a brochure PDF with a real text layer
  - `visiting-card.png`
  - `handwritten-requirement.jpg`

  The PDF and images are rendered with Playwright. OCR reads both images in about 5–9 seconds.
- **Services (added only):** `runImport`, `saveMappingProfile`, `deleteMappingProfile` and `removeImportJob` in `services/imports.ts`. Existing functions are untouched.
- **Strings:** all in the `import` namespace in English and Tamil; the locale key check passes.

## Things to know
- **OCR needs the internet the first time:** the engine and English language data load from the library's CDN, then the browser caches them. Offline it shows a clear error with "Paste text instead" and "Fill the form by hand".
- **Document source:** a lead read from a visiting card has no source, so it is flagged as missing and the review screen recommends keeping it as a draft.
- **Extraction quality on the samples:** the handwritten note reads well. The visiting-card name comes out as "Ramesh Lyer" because OCR reads the I in "Iyer" as an l; it is highlighted as low confidence.

## Tests
- `src/modules/import/lib/values.test.ts`: the value readers.
- `src/modules/import/lib/import-flow.test.ts`: end to end on the real sample files and all five generated templates in both formats.
- `src/modules/import/lib/document.test.ts`: document entries, refinements and stats.
- `src/ai/document/classify.test.ts`: lead-or-property guessing, unit splitting, PDF line grouping.

## Requests filed (`notes/requests-m5-import.md`)
- **R1 (not applied):** change the nav "Import" item's permission to `import.leads`, so executives don't get a link to NoAccess.
- **R2:** `vite.config.ts` excludes tesseract.js from pre-bundling, so `import('tesseract.js')` fails in dev with "require is not defined". I worked around it by importing the package's browser build, with a small type file in `src/ai/document/`.
- **R3:** the shared file uploader's image thumbnails break in dev because the object URL is revoked under Strict Mode.
- **R4:** the route error page puts a `<details>` inside a `<p>`, which React warns about.
- **R5:** the shared mapping table shows the AI sparkle on template and saved-mapping matches too.

## Problems seen in other agents' files
- During the run, M7's `src/ai/simulated/assist.ts` and `src/components/ai/module-assistant/record-assistants.tsx` had type errors, and the `ai` Tamil file was missing keys (`effort.*`, `panel.try.executive`). All of these were green by the final run; I did not touch them.

## Notes and screenshots
- `notes/assumptions-m5-import.md` (17 assumptions); three rows added to `notes/ported-files.md`.
- `E:\real-estate\crm-e2e\notes\screens\m5-import\` has 26 screenshots: hub, wizard columns, check, done, document review, drafts, draft and history, each at 1440 light, 1440 dark and 375 light, plus the hub and the check step in Tamil.

Main files are in `E:\real-estate\crm-e2e\src\modules\import\` (routes, pages, components, lib), `E:\real-estate\crm-e2e\src\ai\document\`, `E:\real-estate\crm-e2e\src\services\imports.ts`, `E:\real-estate\crm-e2e\scripts\make-samples.mjs`, `E:\real-estate\crm-e2e\public\samples\` and `E:\real-estate\crm-e2e\src\i18n\locales\{en,ta}\import.json`.

---
## build:m6-pipeline

## M6 Pipeline: finished

The pipeline module is complete. In my files, typecheck, lint and tests are clean and there are no console warnings. The repo-wide `pnpm typecheck`, `pnpm lint` and `pnpm test` still fail, but only because of other agents' files (listed below). I checked the interactions by driving the app in Edge on port 5206. The dev server is stopped and the port is free.

### What I built
**Board** (`src/modules/pipeline/components/pipeline-board.tsx`, `deal-card.tsx`, `stage-style.ts`)
- Drag and drop with the mouse (starts after moving 6 px) and with the keyboard: Space lifts the card, the arrow keys jump a whole column, Space or Enter drops it, Esc cancels. Screen-reader announcements are translated.
- The lifted card is tilted with a shadow; the target column gets a ring and a dashed placeholder.
- One column per enabled stage, in the order from Settings. Each column has the stage-coloured top bar, a count, the ₹ total and a share-of-value bar.
- Cards show the client with a temperature dot, the property, ₹ value, the executive's avatar, days in stage (normal / warning / "Stalled"), the next follow-up (red when overdue), the ✦ conversion % and a ✦ stalled marker with a tooltip.
- Every card also has a "Move to…" menu, so moving never needs dragging.

**Moves** (`pages/pipeline-page.tsx`): drag, menu, phone sheet and the assistant all go through one function, which checks permission first.
- Lost asks for a reason and Booked asks for the property and booking amount. I also put Won behind a confirmation (my choice, in the assumptions file). Cancel leaves the card where it was.
- Every other move calls `changeStage` and shows a toast with Undo.
- Moving a lead to "Visit scheduled" when it has no upcoming visit opens the appointment form.
- `components/domain/stage-change-dialog.tsx` only gained explanatory hint lines.

**Other views**
- **Stage strip** above the board, one segment per stage sized by count; hover shows count and ₹, click jumps to that stage.
- **KPI cards:** open pipeline with a sparkline; weighted forecast with a ring and the Demo AI badge; stalled count (click it to filter); win rate with a sparkline.
- **Stage conversion strip:** for each stage, how many reached it, % that moved on, % drop-off, and average days against the target.
- **List view** in the shared data table, sortable, with a "Move to…" action on each row.
- **Filters:** search, executive (managers and admins only, includes Unassigned), source, temperature, value band and "Stalled only". `?view=` and `?owner=` are kept in the URL.
- **Phone:** stage tabs plus a "Move to…" bottom sheet (`pipeline-mobile.tsx`).
- **Empty states:** an illustrated one when there are no deals at all, a separate one when filters match nothing, and an error state with Try again for the AI panel.

**AI** (`pipeline-ai.tsx`): every AI output carries the Demo AI badge, and nothing changes until the user clicks Confirm.
- **Stalled deals panel:** the AI pipeline summary, the worst stalled deals, a recommended action per stage, and the provider's next best action. "Plan it" turns the advice into a follow-up task proposal that runs on Confirm.
- **Pipeline assistant:** type or speak a command ("move Priya Sharma to negotiation"), confirm the proposal card. Moves to Lost, Booked or Won open the stage dialog instead, so the required details are still asked for.
- **Conversion prediction** on each card comes from the lead score's probability.

**Pure logic:** `modules/pipeline/lib/pipeline.ts` (deals, filters, column totals, sorting, totals, stage conversion, weekly sparklines). I added `stallRatio`, `stallAdvice` and `stalledDeals` to `src/lib/stalled.ts`.

**Translations:** `pipeline` namespace in English and Tamil (Tamil is a draft for review).

### Acceptance criteria (plan §8.3, M6): all met
Kanban with mouse and keyboard and announcements; required card contents; Lost/Booked dialogs with Cancel returning the card; Undo on other moves; list view and filters; phone tabs and sheet; analytics strip; AI stalled deals and conversion prediction; and a move updates the lead record, which Today, Reports and the timeline read.

### Checked in the browser
- A mouse drag moved a deal from New to Contacted (5 → 6), and Undo brought it back.
- Dropping on Lost opened the dialog; with no reason it stayed open, and Esc left the counts unchanged.
- A keyboard move to Visit scheduled worked (3 → 4). No appointment form opened because that lead already has a site visit in the seed data, which is correct. I did not test the case where the form should open.
- The Booked dialog opened from the card menu.
- "Plan it" then Confirm added the task, and the assistant produced a move proposal.
- The phone "Move to…" sheet moved a deal and showed the toast.
- The executive view in Tamil showed only Arjun's 12 deals, with no executive filter.
- No sideways page scrolling at 768 or 375 px.

### Tests
- `src/modules/pipeline/lib/pipeline.test.ts` (12) and `src/lib/stalled.test.ts` (6): all pass.
- The en/ta key check for `pipeline` passes.

### Screenshots (`E:\real-estate\crm-e2e\notes\screens\m6-pipeline\`)
- Required: `manager-1440-light.png`, `manager-1440-dark.png`, `manager-375-light.png`.
- Extra: `manager-768-light.png`, `manager-1440-list.png` (taken before scrolling, so the table itself is not in view), `executive-1440-ta.png`, `flow-dragging.png`, `flow-lost-dialog.png`, `flow-booked-dialog.png`, `flow-ai.png`, `flow-375-move-sheet.png`, `flow-visit-prompt.png`.

### Notes written
- `notes/assumptions-m6-pipeline.md`: 16 assumptions, including deal value = deal value or else top of budget (same as Reports), Booked counted as open pipeline, Won needing a confirmation, and stalled = more than twice the stage's target days.
- `notes/requests-m6-pipeline.md`, nothing applied and nothing blocking:
  1. For M7: `executeProposal` marks a lead Lost with reason "other" when no reason is given. The global AI panel can still do this; my assistant avoids it.
  2. Confirming the Settings contract: if a stage is disabled, its leads disappear from the board until it is re-enabled.
- `notes/ported-files.md`: one row. Nothing could be copied, because `wireframe-rebuild` has no pipeline code; I re-implemented the pipeline rules described in the spec-wireframe analysis.

### Problems in other agents' files (not fixed)
- **Typecheck:**
  - `src/ai/live/provider.ts` and `src/ai/simulated/provider.ts`: `readUpdate` missing from `AIService`.
  - `src/ai/simulated/command-actions.ts:221`: comparisons with task types that can't match.
  - `src/modules/appointments/components/outcome-dialog.tsx:244`: wrong argument type to `t()`.
  - `src/modules/import/lib/plan.ts`: `./plan-types` not found.
  - `src/modules/import/lib/import-flow.test.ts`: 3 errors.
  - `src/modules/leads/components/leads-filters.tsx:125` and `src/modules/leads/components/lead-summary.tsx`: 3 errors.
  - `src/modules/today/components/priority-list.tsx:62`: icon type mismatch.
- **Lint errors:** `src/lib/property.ts:235–254`, rules-of-hooks errors because `propertyCopy` calls a function named `use`.
- **Tests:** `src/i18n/locales.test.ts` fails because the Tamil files for `today`, `appointments` and `tasks` are missing keys that English has.

The scratchpad folder is shared with other agents; my own scripts are under `scratchpad\m6\` plus `shots.cjs`.


---
## build:m7-ai

## M7 AI Assistants: report

M7 is built, and every plan §8.3 M7 criterion is met. A full `pnpm typecheck`, `pnpm lint` and `pnpm test` run is green: 0 TS errors, lint exit 0, 47 test files and 623 tests passing. Only the hand-off notes came after that run. The dev server ran on port 5207 and is stopped; the port is free. I made no commits and edited no foundation-owned file.

### What I built

**Global panel** (`src/components/ai/ai-panel.tsx`, plus `chat-store.ts`, `ai-answer.tsx`, `use-proposals.ts`, `proposal-editor.tsx`, `action-proposal-card.tsx`, `effort-saved.tsx`)
- **Opening:** the FAB, Ctrl/Cmd+K and `/` open it. It docks at 1280 px and wider and overlays below that (full screen at 375). Esc closes it.
- **Context chip:** shows the page or the open record plus the role, e.g. "On: Lead · Priya Sharma · Sales Manager". If a page doesn't call `useAISelection`, the record is read from the URL (`selectionFromRoute`).
- **Prompt chips:** the ROLE_RESEARCH §5 chips for each role, filled with real names from the data, plus extra chips for the open record.
- **Answers:** a "Read as" line when Hinglish was rewritten, stat bars or tiles, record rows (avatar, stage pill, score ring, price or due time) that link to the record, page links, a drafted WhatsApp card (copy, or open in WhatsApp, which logs the message), and next-question chips.
- **Proposals:** each change is a card with Confirm, Edit (change it in place) and Cancel. After it runs, the card links to the changed records and offers Undo for 10 s, and so does the toast. A change the role can't make shows the reason with a lock.
- **Other:** voice in en-IN with a fallback message; an "AI help today" strip (actions, fields filled, automations, about how many minutes saved); an **Assistants** tab with the module assistants that fit the page.
- **Opening it from elsewhere:** `askAssistant(command, { prefill })` lets any page open the panel with a question (this covers M1's request R2).

**`executeProposal`** (`src/services/commands.ts`)
- Covers 16 proposal kinds, including the new `assignLeads`, `requestReassign` and `rescheduleTask`.
- It re-checks the role's permission (the service then checks the record) and runs with `via: 'ai'`.
- Every applied change gets a 10 s undo snapshot.
- It refuses Lost without a reason, and Booked or Converted, with a validation error (M6's request R1).

**Simulated provider** (`src/ai/simulated/*`)
- **Command reader:** recognises 40 intents: every §12.5 command plus every role chip.
- **Hinglish:** sentences are rewritten before reading ("Sanjay ki lead Sneha ko de do", "Priya ka visit kal 11 baje fix karo"). Pasted messages get word swaps only.
- **Update readers:** "Update a lead" (ported from wireframe-rebuild `understand.ts`) and "update a property" readers return only values that actually changed.
- **Other additions:**
  - assignment arrows (→ / ->) and a preview of who would get each lead under auto-assign;
  - "within budget" / "under X" filtering of matches;
  - buyers for a property;
  - smarter visit messages: no "your visit to at ." when there is no visit;
  - an owner-name fix for listings like "owner Ramesh 98450 12345" (M3's request R2).
- **Interface:** I added `readUpdate` to `AIService`, with live-provider fallback. The README already documents the live provider and the backend-proxy rule.

**`<ModuleAssistant module=…>`** (`src/components/ai/module-assistant/`, registry in `src/ai/modules.ts`)
- One shared component configured for all 10 §12.2 assistants: `leadCreate`, `leadEdit`, `leadQualify`, `propertyCreate`, `propertyEdit`, `propertyMatch`, `appointmentCreate`, `followUp`, `import`, `insights`.
- Inside a form (`onFill` given) it is the paste-and-fill box; on its own it proposes the record as a card to confirm.
- Its import mode maps the columns of pasted CSV rows, with confidence bars.

### Criteria
- Met: panel (shortcuts, docking, context chip, role chips, voice); execute-after-confirm with varied phrasing, links, refusals, undo; `via: 'ai'` logging (except assignments, reschedules and reassignment requests — see R1 and R2 below); the shared assistant configured 10 ways; more than 25 varied inputs including Hinglish; the Demo AI badge on every output; the live stub; effort-saved indicators; English and Tamil (the Tamil is a draft that needs a fluent reviewer); 1440 light and dark, 768 and 375.
- One known gap: AI assignments, reschedules and reassignment requests are still logged as `manual`. The services they call don't accept a `via` option yet; I filed that as R1 and R2 below.

### Tests
About 190 AI and command tests in six files:
- `ai/simulated/commands.test.ts`: Hinglish rewrites, 34 intent phrasings, the Rahul Verma enquiry, appointment phrases, the Sanjay → Vikram variants, refusals, reschedule, bulk assign, drafts, a property price change, and a check that reading never changes the database.
- `ai/simulated/assist.test.ts`: Indian amounts, phones and areas (2.5BHK, east facing, 1200 sqft), owner listings, appointment phrases ("tomorrow 5pm", "next Saturday morning", "on 3rd Dec at 11", Hinglish), update readers, paste and CSV classification, follow-up timing.
- `ai/panel-logic.test.ts`: route selection; every role chip is understood (never "unknown"); proposal edits; the registry; effort counts; about 100 questions × 3 roles in English and Tamil with no raw i18n keys.
- `services/commands.test.ts`: real writes through the services, including undo, permissions and M6's rule.

### Requests filed (`notes/requests-m7-ai.md`)
- **R1 (M8, nice):** add an optional `via` to `assignLeads`.
- **R2 (M4 and M2, nice):** add an optional `via` to `rescheduleTask` and `requestReassign`.
- **R3 (M1, nice):** optionally mount `<AutoAssignedToday/>` on Manager Today. M1 already shows the count.
- **R4 (module owners, nice):** mount `<ModuleAssistant/>` inline on your pages; all 10 already work from the panel's Assistants tab.

I also handled M1 R2, M2 R3 (the AI-filled field marker no longer bleeds past its cell), M3 R2 and M6 R1 in my own files.

### Problems seen in other agents' files
At the end, none were blocking: 0 TS errors overall. Midway through, `modules/import/lib/import-flow.test.ts` (missing node types), `modules/leads/components/leads-filters.tsx` and `modules/today/components/executive-view.tsx` (TFunction typing) had type errors; they were fixed by their owners before my final run. Lint shows only warnings, in foundation `components/ui/*` and in `components/domain/match-list.tsx` (only-export-components).

### Files
- Notes: `E:\real-estate\crm-e2e\notes\assumptions-m7-ai.md`, `E:\real-estate\crm-e2e\notes\requests-m7-ai.md`, plus 3 rows appended to `E:\real-estate\crm-e2e\notes\ported-files.md`.
- Screenshots in `E:\real-estate\crm-e2e\notes\screens\m7-ai\` (19): 1440 light (executive panel, Hinglish proposal, confirmed with undo, target stats, refusal, Assistants tab on lead / property / Today, import mapping, lead-creation assistant, proposal edit, Tamil business summary), 1440 dark (manager panel, workload, bulk assign), 768 (sources), 375 (panel, matches).


---
## build:m8-team-settings

## M8 Team, Settings, Notifications & Activity: report

Everything in plan §8.3 for M8 is built. Checks on the whole project at the end:
- `pnpm typecheck`: passes.
- `pnpm lint`: no errors. My files have no warnings.
- `pnpm test`: 44 files, 574 tests pass.
- I clicked through the main flows with Playwright (Edge) on port 5208 and they all worked with no console errors or warnings: reassign from the on-leave prompt, add a user by pasting text, deactivate with hand-over, bell "mark all read", balance the match weights and save, activity "ask in words", reset demo data.
- The dev server on 5208 is stopped and the port is free. The stop command left one vite process running, so I killed it (PID 4796) and checked the port again.

### What I built
- **Assign dialog** (`components/domain/assign-dialog.tsx`, same props as before so other modules don't break):
  - One row per executive: name, availability, open leads with a hot/warm/cold bar, pending follow-ups, overdue, today's appointments, conversion %. People on leave are shown but can't be picked.
  - "Recommended (auto)" option with the Demo AI badge. For one lead it shows "Recommended: X · lowest workload (N open)" (or round-robin / rule). For several leads it shows who gets each one and the totals.
  - Optional note. The toast says who got the lead(s) and why; bulk assignments get Undo.
- **Bell** (`app/shell/notification-bell.tsx`) and **notification row** (`components/domain/notification-item.tsx`):
  - All / Unread tabs, mark one read or unread, "Mark all read", click to open the record, "View all".
  - Sentences now fill in stage names, property status, ₹ amounts and the unassigned-queue count.
- **/notifications**:
  - Four count tiles; tabs for All / Unread / Read; filters for type, time and urgency.
  - Grouped by day; bulk mark read, mark unread and delete (delete asks first and offers Undo).
  - "Catch me up" summary (simulated, Demo AI badge) that names the most urgent item first.
- **/team**:
  - Count tiles (people, open leads with a 14-day sparkline, unassigned queue opening the assign dialog, team conversion) and workload bars.
  - An "on leave with N open leads → Reassign" prompt.
  - Team insight from `ai.insights('team')`.
  - One card per executive: availability control, load bar, follow-ups, today's appointments, conversion ring, monthly target bars.
  - An admin list of managers, admins and deactivated users.
  - Admin only: add or edit a user (by hand, or paste / speak a line that fills the form, with AI-filled fields marked and missing ones listed), activate, and deactivate with a hand-over dialog (auto, to one person, or leave unassigned) that previews who gets what.
  - Going on leave asks for a return date and can hand open leads over at once.
- **/team/:id**: header with contact details and availability, count tiles, target rings, open leads by stage with a "Reassign…" button, assignment history (who, when, why, auto or manual, note) and activity timeline. Managers see only their own team.
- **/settings**: an overview of tiles filtered by permission (executives go straight to their profile), and `/settings/:section` with a side nav. Sections:
  - **Profile:** name, mobile and languages; availability; theme and language pickers ported from wireframe-rebuild.
  - **Assignment:** auto-assign switch with "N leads auto-assigned today", workload cap, rules (add / edit / switch on-off / delete with Undo), "describe the rule in words" (simulated), and a "who would get a new lead?" tester. Managers can only change their own team's rules.
  - **Pipeline:** rename a stage, switch it off (New, Booked, Converted and Lost are locked on), target days, win probability, and lost reasons (switch on/off, re-order).
  - **Templates:** filter by channel, edit, delete with Undo, "Draft with AI", insert placeholders, live preview, SMS length count.
  - **Matching:** five weight sliders with a live total that must read 1.00, a "balance to 1.00" button, minimum match score, cap per project.
  - **Response times and scoring:** the four SLA numbers and the hot / warm thresholds drawn as a 0–100 band.
  - **Users:** counts by role with a link to Team.
  - **Reset demo data:** asks first.
- **/activity**:
  - Visible log (admin everything, manager their team), grouped by day, with record links and a "how" badge (by hand / AI / automatic / import).
  - Count tiles; filters for person, record, kind, how and when, plus search.
  - "Ask in words" reader (simulated, e.g. "AI changes by Arjun this week"); 60 entries at a time with "Show more".
- **Services** (new exported functions only):
  - `services/notifications.ts`: `markManyUnread`, `deleteNotifications` (undoable), `notificationText`.
  - `services/settings.ts`: `saveTemplate`, `deleteTemplate` (undoable), `setRuleEnabled` (blocks managers from changing company-wide rules in the service, not just the UI).
- **`lib/assignment.ts`** (new functions only): `assigneeStats`, `assigneeStatsFromDb`, `openLeadsOf`, `previewRedistribution`, `previewTotals`. The engine itself is unchanged.
- **i18n**: `team`, `settings`, `notifications` and `activity` namespaces in English and Tamil with matching keys; the old stub keys are removed. Tamil is drafted and needs a fluent reviewer.

### Acceptance criteria (§8.3 M8)
All met:
- **/team:** availability, load bar, follow-ups, appointments, conversion, targets.
- **/team/:id:** member detail with assignment history and activity.
- **Admin on /team:** add user and activate; deactivate with hand-over and preview.
- **Assign dialog:** all the fields listed in the spec, recommended option with its explanation, one or many leads, note, toast with who and why.
- **Settings:** every section, each shown only to the roles allowed to use it.
- **Notifications and activity:** bell popover, notifications page with filters, activity log with all five filters.

Two partial points:
- **Renamed stage names only show inside Settings.** Other screens still use the catalogue names until the stage-label helper in R1 is added.
- **Switching off a stage only stores the setting.** Pipeline and stage pickers still need to hide it (R2).

### Tests added
- `src/lib/assignment.test.ts`: 5 new tests (stats, conversion, open leads, hand-over preview, totals).
- `src/modules/team/lib/user-input.test.ts`: 7 tests.
- `src/modules/settings/lib/settings-logic.test.ts`: 14 tests.
- `src/modules/activity/lib/activity-filters.test.ts`: 9 tests.
- `src/modules/notifications/lib/notification-filters.test.ts`: 6 tests.

### Requests filed (`E:\real-estate\crm-e2e\notes\requests-m8-team-settings.md`)
- **R1 (applied by me):** added optional `label?: string` to `PipelineStageDef` in `src/domain/types.ts` with one precise edit. It was blocking the "rename a stage" criterion. It also proposes a shared `stageLabel` helper so other screens show the renamed stage.
- **R2:** Pipeline and stage pickers should hide stages that are switched off.
- **R3:** the `shell:bell.*` text keys are no longer used and can be deleted.
- **R4:** the breadcrumb for `/settings/:section` always reads "Settings section"; it needs a title that can depend on the URL.
- **R5:** the "user updated" activity entry should record which fields changed.

### Other notes files
- Assumptions (14 items): `E:\real-estate\crm-e2e\notes\assumptions-m8-team-settings.md`
- Two port rows appended to `E:\real-estate\crm-e2e\notes\ported-files.md` (the settings preferences UI, and the icon mapping copied from the foundation's activity timeline).
- Screenshots in `E:\real-estate\crm-e2e\notes\screens\m8-team-settings\`: team, team-member, settings, settings-assignment, settings-matching, settings-pipeline, settings-templates, settings-profile-exec, notifications and activity, each at 1440 light, 1440 dark and 375 light. Also assign-dialog, add-user-ai, redistribute and bell at 1440 light.

### Problems seen in other agents' files (not fixed)
- Midway through, typecheck errors appeared in:
  - `src/ai/live/provider.ts` and `src/ai/simulated/provider.ts`: the new `readUpdate` method was missing.
  - `src/ai/simulated/command-actions.ts`: two comparisons can never match.
  - `src/ai/index.ts`
  - `src/modules/appointments/components/outcome-dialog.tsx` and `src/modules/leads/components/leads-filters.tsx`: translation-function typing errors.
  - `src/modules/import/lib/import-flow.test.ts`
  - `src/modules/pipeline/components/pipeline-ai.tsx`: unused `useCallback`.
- All of these were gone by the final typecheck.
- Lint warnings remain only in files I don't own: `components/ui/*` and `components/domain/match-list.tsx`.

---
## review:m1-today-reports

## M1 Today & Reports: independent review

**Result:** Most of the builder's report checks out. I found and fixed 7 issues in M1's own files. 3 minor items stay open (listed below).

I checked the module in Microsoft Edge with Playwright on the M1 dev port 5201. I ran the admin and manager profiles and all three executives (Arjun, Sneha, Vikram) at 1440 light, 1440 dark and 375 px, in English and Tamil. I also read the code. There were no console errors in any run.

**Checks after my fixes:**
- `pnpm typecheck`: 0 errors.
- `pnpm lint`: 0 errors. The only warnings are in foundation `components/ui/*` files, not M1's.
- `pnpm test`: 47 files and 624 tests, all pass.
- New e2e journey `E:\real-estate\crm-e2e\e2e\m1-today-reports.spec.ts`, run with the real 5176 build and preview: 7 of 7 pass on `--project=desktop`, and the `@phone` test passes on `--project=phone`. I didn't need the dev-config fallback.

The journey switches profiles through the real profile switcher and reads `crm-e2e-db` in localStorage to confirm each write happened. It covers:
- **Executive (Arjun):** Done, then Undo; Log outcome; Reschedule; Send confirmation. After each one it checks the stored data changed and the list re-ranked at once.
- **Inline assistant:** nothing changes before Confirm, and the change happens after it.
- **Three executives:** each one gets a different Today.
- **Manager:** per-row Assign, Auto-assign all (preview dialog, then Undo), and the on-leave reassign.
- **Admin:** 6 KPI cards, 3–5 insights, the auto-assign alert fix.
- **Reports:** period switch, AI summary drill-down, CSV download, every tab, the inventory drill-down. A call logged on Today shows up straight away in the Activity report.
- **Executive Reports:** titled "My performance", with no scope selector and no Team tab.
- **Phone:** no horizontal scroll.

### Criteria (plan §8.3, master spec §6 and §13 Reports)
| Criterion | Status |
|---|---|
| `/today` is role-specific with no clicks; layout follows DS §14 rule 4 (hero, 7 + 5 columns; one column below lg) | PASS |
| Exec: AI greeting and day brief with Demo AI badge | FIXED (brief showed raw minutes, e.g. "Not called yet: 1200 min") |
| Exec: ranked list with reason chip, due time, Call, WhatsApp, Log outcome, Reschedule, Done, Open; real data; re-ranks at once | PASS (each action checked in the browser and in the e2e) |
| Exec: appointments timeline, map links, Send confirmation (marks the visit confirmed) | PASS |
| Exec: Hot / Overdue / New today / Not contacted in N days sections | PASS |
| Exec: target rings, Visited-not-booked strip, New matches to send | PASS; FIXED "visited 0 days ago" (now "visited today") |
| Three executive accounts each get their own Today | PASS |
| Mgr: unassigned queue, AI-suggested executive, per-row Assign, Auto-assign all with Undo | PASS |
| Mgr: team board, overdue by executive, team visits coloured by executive, stalled and negotiation deals | PASS |
| Mgr: needs-attention items, leave-reassign proposal, target gauge, funnel | PASS; FIXED plurals ("holds 1 open leads") |
| Admin: 6 KPI cards with sparklines and deltas, source funnel, team snapshot, import activity | PASS; FIXED a hard-coded English " pts" unit (now in i18n, kept on one line) |
| Admin: system alerts with one-click fixes | PASS; FIXED the duplicate alert showing only the other lead's ID (now name and ID). FIXED "1 open leads" plural. |
| Admin: 3–5 AI insights with drill-down links | PASS |
| `/reports` scope (all / team / personal, "My performance") | PASS (no leak: an executive opening `/reports/team` falls back to Overview) |
| Reports: funnel with drop-off, trends, sources donut, source conversion, lost reasons, team bar and table, heatmap, pipeline value, inventory, AI summary | PASS |
| Period switcher and CSV export (only with `export.data`) | PASS; FIXED the Conversion KPI. It fell back to the all-time rate when nothing closed in the period, so an executive's "This month" showed 0 bookings next to 100% conversion. It now uses only deals booked or lost in the period, and shows "—" when none closed. |
| DS §10: tooltips, legend, click-through, empty states | PASS (click-through opens a drill-down drawer; see OPEN 1 and 2) |
| Numbers react to changes made elsewhere | PASS (unit test for the funnel; e2e from a Today log to the Activity report) |
| Layout at 375 px, dark mode, Tamil | PASS, no horizontal overflow; FIXED priority rows at 375 px, where names were cut off ("Vivek Malh…") and reason chips squeezed (the due time now sits next to the reason below `sm`) |
| Permissions: actions gated with `usePermission`, disabled controls show the reason | PASS |
| Console errors | PASS (none) |

### Files I changed (all owned by M1)
- `src/modules/reports/lib/report-data.ts` and `src/modules/reports/components/report-tabs.tsx`: the Conversion KPI fix.
- `src/modules/today/lib/slots.ts`: new `agePhrase` and `reasonParams`.
- `src/modules/today/components/executive-view.tsx` and `priority-list.tsx`: readable ages, and the 375 px row layout.
- `src/modules/today/components/admin-view.tsx`: the " pts" unit through i18n, and the duplicate lead's name.
- `src/i18n/locales/{en,ta}/today.json`: `slaBreached` uses `{{age}}`; `leave_one/_other`, `deactivated_one/_other` (×2), `daysAgo_zero`, and `admin.kpi.pts` (with a non-breaking space).
- Tests: `src/modules/today/lib/today-lib.test.ts` (2 new) and `src/modules/reports/lib/reports-lib.test.ts` (1 new).
- `notes/assumptions-m1-today-reports.md`: added items 13–15 under "Independent review".
- New e2e: `e2e/m1-today-reports.spec.ts`.
- Screenshots refreshed in `E:\real-estate\crm-e2e\notes\screens\m1-today-reports\`: the three `today-executive-*` files, `today-admin-1440-light`, `reports-admin-1440-light`, and a new `review-today-vikram-375-light`.

I edited no foundation files and nothing in another module's folder, ported nothing from wireframe-rebuild (so `ported-files.md` is unchanged), and committed nothing. The M1 dev server on 5201 is stopped and the port is free (an orphaned vite on 5201 was mine, and I killed it). 5176 is free.

### Still open
1. **Click-through is not a filtered list.** Chart clicks open an in-module drawer with the exact records and a link to the unfiltered Leads or Pipeline page. A filtered list needs request R1: filter parameters on `paths.leads()` and `paths.pipeline()`, honoured by M2 and M6.
2. **Activity tab can't be clicked through.** The heatmap and the calls/messages bars have tooltips and a legend but no drill-down, because the drawer only lists leads and properties. This is minor.
3. **Shared components need small fixes** (foundation-owned, so not changed):
   - The report section tabs (Segmented with role=group or nav) don't mark the selected tab with aria-pressed or aria-current.
   - The Activity heatmap colour scale goes from purple to teal rather than staying in one hue.
   - The breadcrumb on `/reports/:tab` always reads "Report" because the route title key is fixed.
4. **Behaviour to know about, not a bug:**
   - The brief, insights and report summary are rule-based and always show the "simulated" Demo AI badge (documented as assumption #5).
   - In Tamil, the assistant's example placeholder and the commands sent are English, because the command parser only understands English.
   - The Tamil text still needs review by a fluent speaker.
5. **Shared scratchpad warning:** another agent overwrote my scratch `explore.mjs` (the scratchpad folder is shared between agents). One stray run of that other script happened; I stopped it, then moved my scripts into a separate `scratchpad\m1rev\` folder.


---
## review:m2-leads-clients

## M2 Leads, Qualification & Clients: independent review

I checked the code and ran the module in Edge on 5202 as admin, manager and the executives Arjun and Sneha. Vikram was not exercised directly. The builder's report mostly holds up. I found two layout problems in the module and fixed both. I wrote the e2e journey for the module and it passes.

### Criteria
| Criterion (plan §8.3 M2 / master spec) | Result |
|---|---|
| List: search, filters (source, stage, temperature/priority, executive for managers, budget, city/locality, date), sort, pagination | PASS |
| Table, card and "Today design" views | FIXED: "Today design" was 568 px wide at 375 px |
| Table at 1440 px | FIXED: the last column was cut off (table was 1253 px in a 1132 px card) |
| Saved views | PASS (e2e) |
| Row hover actions | PASS |
| Bulk actions: assign, change stage with one undo, export, delete with confirm + undo | PASS (e2e: stage + undo as manager, delete + undo as admin) |
| Unassigned tab for managers/admins only | PASS (e2e) |
| Aging badges (days since contact, SLA breach) | PASS |
| Add lead: Rahul Verma paste fills name, phone, 3 BHK, Whitefield + Sarjapur Road, ₹1.2 Cr, ready, 1–3 months, spouse (§12.3) | PASS (e2e checks the saved lead) |
| AI fields marked, missing essentials asked as chips, Demo AI badge | PASS: only the Source chip was asked |
| Required = name + phone or e-mail + source; optional sections collapsed | PASS |
| Duplicate warning with owner, Open existing link, Save anyway | PASS (e2e: Mohammed Irfan, Arjun Mehta) |
| Auto-assign for manager/admin with a toast naming who and why | PASS (e2e) |
| Closing a half-filled sheet asks before discarding | PASS |
| Lead page: score ring and "Why this score?" factors, conversion probability | PASS (e2e) |
| Qualification card "X of 4 known", asks only missing questions as chips; the word BANT never appears (§9) | PASS (e2e: 3 of 4 → Spouse chip → 4 of 4, saved; no "BANT" anywhere on the page) |
| Stage steps and Mark as lost with a reason | PASS (e2e) |
| Next best action card | PASS (e2e: one click closes Arjun's overdue task TSK-1001) |
| Quick actions; Reassign for managers, Request reassignment for executives | PASS (e2e: Arjun's request reaches the manager as a notification) |
| Tabs: activity, matches, appointments, tasks, assignment history | PASS (the last tab label is clipped at the edge of the scrolling tab strip) |
| AI summary | PASS |
| Generated messages: WhatsApp/SMS/e-mail, English and Hinglish, opens wa.me prefilled, send is logged | PASS (e2e: Hinglish text changes, link is `https://wa.me/919845098765?text=…`, a timeline entry is added) |
| Edit with AI: "change budget to 1.5 Cr and add Hebbal" | PASS (e2e: budget becomes ₹1.5 Cr and Hebbal is added) |
| Edit page | PASS |
| Clients list and detail: booking, loan, KYC, documents checklist, lead timeline, appointments | PASS (e2e: a document moved to Verified is saved) |
| Clients created automatically on Booked | PASS (foundation effect E5, already in place) |
| Executive sees only own leads, HNI shows "Restricted", no Delete, other executives' leads blocked | PASS (e2e: Sneha's list shows only her leads; LEAD-1007 Restricted; no bulk delete; Arjun's LEAD-1004 doesn't open) |
| No console errors or warnings | PASS (checked in every e2e test) |
| 375 px with no sideways scroll on leads (all 3 views), lead page, clients list and detail | FIXED, and covered by a @phone e2e test that passes |
| Dark mode | PASS (lead page, leads list and client page checked) |
| Tamil | PASS: no untranslated interface text. Remaining English is data (names, places, task titles, AI drafts). A fluent speaker still needs to review it. |

### What I fixed (only in M2's own files)
- `E:\real-estate\crm-e2e\src\modules\leads\components\leads-views.tsx`: the "Today design" grid is now `grid-cols-1` and its sections and reason lines have `min-w-0`. Long AI next-action chips now truncate instead of widening the page.
- `E:\real-estate\crm-e2e\src\modules\leads\components\leads-table.tsx`:
  - Below 1536 px the "Last contact" column is hidden and its aging badge moves under the next follow-up (it stays off when the column is hidden from the column menu).
  - The Location column now shows from 1280 px instead of 1024 px.
  - The table now fits exactly at 1440 px (1132 / 1132). At 1280 and below it still scrolls sideways inside its card, as tables do elsewhere in the app.
- I added the reviewer decisions to `E:\real-estate\crm-e2e\notes\assumptions-m2-leads-clients.md`.

### E2E journey
- `E:\real-estate\crm-e2e\e2e\m2-leads-clients.spec.ts`: 7 desktop tests and 1 @phone test.
- `E:\real-estate\crm-e2e\e2e\m2-leads-clients.dev.config.ts`: runs the same spec against the 5202 dev server.
- `pnpm exec playwright test e2e/m2-leads-clients.spec.ts --project=desktop` on the official 5176 build + preview: **7/7 pass**.
- The @phone test passes with `-c e2e/m2-leads-clients.dev.config.ts --project=phone`.

### Checks
- `pnpm typecheck` exits 0. It failed at first because of M1's `today/components/executive-view.tsx` and `priority-list.tsx`; that was fixed in the meantime.
- `pnpm lint`: no errors and no warnings in M2 files. The only warnings are fast-refresh ones in shared ui files and `match-list.tsx`.
- `pnpm test`: 630 of 631 pass. **The one failure is not M2's:** `src/i18n/locales.test.ts > ai: Tamil has every English key with the same placeholders`, in the M7 `ai` namespace.
- Dev server 5202 is stopped and the port is free.
- Temporary scripts are deleted. Nothing was committed.
- Review screenshots (1440 light and dark, 375, Tamil, and the table after the fix) are in `E:\real-estate\crm-e2e\notes\screens\m2-leads-clients\review\`.

### Remaining issues (OPEN, minor)
1. On phones the KPI card titles are cut off ("OVERD FOL…", "NOT CAL…"). The shared `KpiCard` would need a short-label option; this is a request for the foundation.
2. The lead page tab strip clips its last tab ("Assignment history") at the edge; it can still be reached by scrolling.
3. On phones the lead page shows the summary column first, so Stage and Next best action are below the fold.
4. At 1440 px the leads search box is narrow ("Name, phon…") because the filter pills take most of the row.
5. The builder's requests R1–R3 for the foundation (drawer width, `paths.leads` options, AI field margin) are still open.
6. The clients e2e test only moves a document to Verified if the first client has one that isn't verified yet. It does in the current seed.
7. Shared `test-results/` gave occasional ENOENT trace errors while another agent was running at the same time; a rerun was clean.

---
## review:m3-properties-matching

## M3 Properties & Matching: independent review

I reviewed the code and ran the module in Edge with Playwright on port 5203 as admin, manager and the executives Arjun, Sneha and Vikram, in light and dark, English and Tamil, at 1440, 768 and 375 px. The builder's report is mostly accurate. I found and fixed five problems inside M3's own files. The new e2e journey passes 9/9 on desktop and 1/1 on phone against the build-and-preview server on 5176, using the command you gave. The same tests also pass against the dev server on 5203 through a new config, `e2e/m3-properties-matching.dev.config.ts`.

**Final checks:**
- `pnpm typecheck`: 0 errors.
- `pnpm lint`: 0 errors (only the existing fast-refresh warnings).
- `pnpm test`: 47 of 48 files pass, 630 of 631 tests. The one failure is not M3: `src/i18n/locales.test.ts › ai: Tamil has every English key`. The English `ai` namespace has 648 keys and Tamil has 645. That namespace belongs to M7 and is still being edited, so I reported it and did not touch it.
- The dev server is stopped and ports 5203 and 5176 are free.

### Criteria (plan §8.3 M3, master prompt §13 and §14)
| Criterion | Result |
|---|---|
| Card grid: large image, price badge, chips, match ring when matching | PASS |
| Table view, and "By locality" view with counts, price range and ₹/sq ft | PASS |
| Plain-words search shown as chips you can remove, with a "drop this filter" hint | PASS |
| Filter pills (type, city, locality, budget, BHK, possession, furnishing, facing), status tabs with counts, sort | PASS |
| Bulk change status with Undo, export and delete, each shown only to roles allowed to use it | PASS, plus a FIX: bulk actions used to apply to selected rows hidden by a filter or tab; now the bar counts and acts only on what is on screen |
| Form changes by property family and covers every §13 field (checked flat, house, plot, land, commercial, warehouse) | PASS |
| ₹/sq ft worked out live ("2.5BHK 1200 sqft … 85 L" gives ₹7,083) | PASS |
| Photo upload with preview (JPEG data URL, at most 8) | PASS |
| Paste-and-fill and voice, AI fields marked, Demo AI badge, nothing saved before Save | PASS |
| "Paste a listing" button | FIXED: it went to the same page as "Add property" without opening the paste box, although the page's comment said it should. It now opens `?paste=1` and focuses the paste box that is on screen |
| Smart required fields (save blocked until essentials are filled) | PASS |
| Executive edits only their own listings, only admin deletes (confirm + Undo) | PASS, plus a FIX: on someone else's listing the Edit button was hidden. CONVENTIONS §6 asks for a disabled button with the reason in a tooltip, which is what it shows now |
| Property page: gallery, key-fact tiles, price check, legal, history, matched leads with actions, appointments, AI title and description (applied only on "Use"), missing-data checklist | PASS |
| `/matching` works both ways, with %, label, reasons, "not shown and why" and "close on budget" | PASS |
| Shortlist / WhatsApp share (message, wa.me link, recorded on the lead) / schedule visit (dialog prefilled) / not interested (stays excluded after reload) | PASS (checked in the stored data) |
| Booked and sold never appear in matches | PASS |
| Matching assistant ("properties within Priya's budget in Whitefield", "which leads fit PRP-1002") | PASS |
| Booked from the property page leaves every match list and notifies owners of interested leads | PASS |
| Each executive sees only their own buyers in matching | PASS (Arjun, Sneha, Vikram) |
| No console errors or warnings | PASS (all journeys) |
| Layout at 375 px | FIXED: the add/edit form scrolled sideways by 9 px in English (Bedrooms / Bathrooms / Balconies "(optional)" labels) and by 94 px in Tamil (the add-approval row). Labels and that row now wrap, and every M3 page is free of sideways scroll in both languages |
| 768 px, dark mode, Tamil text | PASS (the only English left is record data, and the assistant's example query, which is English because the parser reads English) |

### Files I changed (all owned by M3)
- `E:\real-estate\crm-e2e\src\modules\properties\pages\property-page.tsx`: locked Edit button with the reason.
- `E:\real-estate\crm-e2e\src\modules\properties\pages\properties-page.tsx`: bulk actions use only visible selected rows; Paste goes to `?paste=1`; added `data-testid="paste-property"`.
- `E:\real-estate\crm-e2e\src\modules\properties\pages\property-new-page.tsx`: focuses the paste box when `?paste=1`.
- `E:\real-estate\crm-e2e\src\modules\properties\components\property-form.tsx`: 375 px wrapping fixes.
- `E:\real-estate\crm-e2e\notes\assumptions-m3-properties-matching.md`: review assumptions 14–17.

### Added
- `E:\real-estate\crm-e2e\e2e\m3-properties-matching.spec.ts`: 9 desktop journeys and 1 phone journey at 375 px in English and Tamil.
- `E:\real-estate\crm-e2e\e2e\m3-properties-matching.dev.config.ts`: runs the same tests on 5203. Traces are off because another agent's run deleted `test-results/` during one of mine.
- Screenshots in `E:\real-estate\crm-e2e\notes\screens\m3-properties-matching\`:
  - `review-form-rooms-375-light-before.png` and `review-form-rooms-375-light-after.png`
  - `review-form-approvals-375-ta-after.png`
  - `review-property-locked-edit-1440-light.png`

### Still open (minor)
1. In the edit form, an executive can set their own listing to Booked or Sold and save without the confirmation that the property page asks for. It can't be undone from there, though the notifications still go out.
2. Bulk status change to Booked or Sold has no confirmation step; it can be undone.
3. In the table, the row's edit pencil is still hidden, not disabled, on someone else's listing.
4. The builder's requests R1 (the share message says "1 options") and R2 (the extractor misses the owner's name) are still waiting on the foundation and M7. R3 (the lead-select warning) is already fixed in `lead-select.tsx`.
5. The `ai` namespace Tamil key test fails (M7, see above).
6. The builder screenshots were taken while the page was still loading in at least one run. I checked the current pages myself in light and dark.

---
## review:m4-appointments-tasks

## M4 Appointments & Tasks: independent review

**The module passes review.** I checked every M4 criterion in plan §8.3 and master spec §16 and the §17 tasks by reading the code and by running it in Edge (Playwright) on port 5204 as admin, manager, Arjun, Sneha and Vikram, in light and dark, English and Tamil, at 1440 and 375. I found two problems and fixed both:
- **Clipped calendar blocks:** 15-minute blocks lost their text, which also showed in the builder's own screenshots.
- **No e2e journey:** there was none, so I wrote one.

I found no dead buttons, permission leaks, console errors or warnings, raw i18n keys, or sideways scrolling.

**Checks**
- **E2E:** all 12 journeys in `e2e/m4-appointments-tasks.spec.ts` pass (11 desktop + 1 phone). The last full run had one failure, in the tasks journey. It failed because another agent's run deleted the shared `test-results/` folder mid-run. I moved this config's output to the OS temp folder and that journey passed on rerun; I did not repeat the whole suite after that change.
- **Not run as asked:** the required `pnpm exec playwright test e2e/m4-appointments-tasks.spec.ts --project=desktop` (build + preview on 5176) was not run. `pnpm build` fails because typecheck fails in other modules:
  - M1: `src/modules/today/components/executive-view.tsx` and `src/modules/today/components/priority-list.tsx` (TFunction type errors).
  - M5: `src/modules/import/lib/document.ts:66`, "Unterminated regular expression" (lint error).

  Instead I ran it against the dev server on 5204: `pnpm exec playwright test -c e2e/m4-appointments-tasks.dev.config.ts --project=desktop --project=phone`.
- **Typecheck:** no errors in M4 files or the e2e spec.
- **Lint:** no M4 findings. The only warning in the folders I checked is in `match-list.tsx` (M3).
- **Unit tests:** the module's 5 files and 56 tests pass. I did not rerun the whole suite (the builder reported 616 passing).
- **Dev server:** stopped. A leftover vite process kept 5204 open; I killed it and checked that 5204 is free.

| Criterion | Result |
|---|---|
| Calendar: day, week, month and list views (custom grid, colour by type, current-time line) | PASS (short blocks were clipped: FIXED) |
| Legend chips filter by type; executive filter for manager and admin only; status filter | PASS (executives get no executive filter) |
| Click a slot to book (slot is prefilled, and so is the executive when the calendar is filtered to one) | PASS |
| Appointment form: lead, type, several properties, executive, date/time/duration, location with property address and map link, reminder, notes | PASS |
| Clash warning that never blocks ("Vikram Singh already has Pooja Agarwal at 11:30 AM", button reads "Book anyway") | PASS (saved and checked in the stored data) |
| Paste-and-fill ("Site visit with Priya tomorrow 11 am at Aranya Greens") | PASS (fields marked as AI-filled, Demo AI badge, lead stage moves) |
| Detail: confirm / reschedule (status becomes rescheduled) / cancel with reason and Undo / no-show with Undo / delete with confirm and Undo | PASS |
| Outcome form, "Describe the visit" AI fill, AI next follow-up + stage suggestion, one-click Apply | PASS (follow-up time stored; the post-visit task is due at that time; stage moves forward) |
| AI preparation points before the visit; AI summary after it | PASS (Demo AI badge on both) |
| WhatsApp confirmation with map link | PASS (text contains the Google Maps link; button opens wa.me) |
| Tasks: Overdue / Today / Upcoming / Done tabs; group by due date or lead; quick add (title + due + lead); priority | PASS |
| Call result: "Not reachable" creates the automatic retry task (E4); reschedule chips with Undo; bulk complete; overdue highlighting | PASS |
| AI quick add ("say it in your words"): a proposal that is created only after Confirm | PASS |
| Follow-up Assistant: suggests a time and drafts the message; "Use this time" changes the due time | PASS |
| Effect elsewhere: a visit booked from the lead page (M2's button, which opens the M4 dialog) moves the stage (E6) | PASS (the builder marked this partial; it now works end to end) |
| Effect elsewhere: completing a visit creates the post-visit task (E7) | PASS |
| Permissions: an executive opening Vikram's APT-1007 gets "This appointment isn't yours"; executives see only their own calendar and tasks | PASS |
| Console clean across all 5 profiles × 4 calendar views and /tasks | PASS |
| i18n: en/ta key sets match for appointments, tasks and domain; no raw keys in Tamil views; no hard-coded strings or colours | PASS |
| 375 px (no sideways scroll, day view by default) and dark mode | PASS |
| Visual quality against DESIGN_SYSTEM.md | PASS (short-event clipping FIXED; KPI cards, rings, sparklines, avatars and type colours present) |

**Fixes, all in M4-owned files**
- `src/modules/appointments/components/time-grid.tsx`: blocks are at least 18 px tall.
- `src/modules/appointments/components/event.tsx`: tighter line height; one-line blocks centred with no vertical padding. Before, 15-minute calls showed half-cut text and 60-minute visits cut off the property line.
- New `e2e/m4-appointments-tasks.spec.ts`: 12 journeys that check the stored data, not just the screen.
- New `e2e/m4-appointments-tasks.dev.config.ts`: runs against 5204; output goes to the OS temp folder.
- Appended a review section to `notes/assumptions-m4-appointments-tasks.md`.
- Review screenshots of the calendar day/week, appointment detail and tasks at 1440 light, 1440 dark and 375 light are in `E:\real-estate\crm-e2e\notes\screens\m4-appointments-tasks\review\`.

**Remaining issues (minor, nothing blocking)**
1. On a phone, the task-row selection checkboxes stay hidden until something is selected. Bulk actions on a phone only start from "Select all". (M4, `task-row.tsx`)
2. Cancel reasons are stored in the chosen language, so a Tamil user stores Tamil text. (M4)
3. Reschedule has no Undo; the plan only requires Undo for destructive actions. (M4)
4. On the phone the Tasks tab strip scrolls sideways, and "Done" is off-screen until you scroll. (M4 page using the shared Segmented component)
5. The E7 post-visit task title is hard-coded English ("Post-visit call: …") in `services/core/effects.ts`. (foundation)
6. The dev-server e2e is exposed to vite reloading the page when other agents save files. One earlier lead-page failure looked like this; it passed on rerun. (environment)
7. The 5176 build + preview run is blocked by M1 and M5 typecheck errors (listed under Checks). (other modules)

---
## review:m5-import

## M5 Import & Extraction: independent review

M5 meets every acceptance criterion I checked except one, and I fixed that one. The builder's report was mostly accurate, but it hid a real failure: executives' sidebar "Import" link opened the NoAccess page, which made the project's smoke test fail ("every profile can open every nav item"). I fixed this inside M5's own files without touching `app/nav.ts`, and the smoke suite now passes 9/9 against my dev server.

I also fixed a page overflow on the hub at 375 px and two smaller issues. Final checks: `pnpm typecheck` gives 0 errors, `pnpm lint` exits 0 (only warnings in files other modules own), and `pnpm test` passes 48 files and 631 tests. The new e2e journey `e2e/m5-import.spec.ts` passes 6/6 with `pnpm exec playwright test e2e/m5-import.spec.ts --project=desktop`, which builds and previews on 5176. I stopped my dev server on 5205; ports 5205 and 5176 are free.

### Criterion → result
| Criterion (plan §8.3 M5 / master spec §15) | Result |
|---|---|
| Hub: 5 template cards; .xlsx and .csv made by SheetJS when clicked; Upload; recent jobs; drafts count | PASS (both downloads checked in e2e) |
| Hub KPIs with a sparkline and a ring | PASS |
| Sheet tab detection: Instructions/Lists tabs ignored; title, blank and totals rows skipped and shown as chips | PASS (messy builder .xlsx) |
| Column mapping: template, saved, synonym, fuzzy or value match, with confidence, manual dropdown, unmapped columns, missing required fields, Save mapping (re-applied automatically next time) | PASS (saved profile checked in the stored data) |
| Mapping table said "Still to map: City" when the city is worked out from the locality | FIXED (`sheet-wizard.tsx`) |
| Validation: phone, e-mail, "1.2 Cr" / "85 L" / "Call", per-sq-ft rate, area, price-to-area sanity | PASS |
| Duplicates against the CRM (with a link) and inside the file; on import, skip or update existing | PASS |
| Inline row fix that re-checks the row; "Set for all"; Skip / Include | PASS (e2e fixes rows 10 and "Call" → Ready) |
| Confirm before writing; Done step with counts, donut, auto-assign owners, CSV of rows not imported, Undo | PASS (e2e checks the leads exist, have owners, and are removed by Undo) |
| Text PDFs read by pdfjs-dist; brochure gives one entry per unit; saved as drafts | PASS |
| Images read by tesseract.js, loaded only when needed, with real progress | PASS (visiting card read in about 20 s with progress; needs the CDN the first time) |
| Low-confidence fields highlighted; Demo AI badge; manual paths (paste text, fill by hand) | PASS |
| `/import/drafts` list and `/import/drafts/:id` prefilled form → Save as property/lead marks the draft saved | PASS (e2e) |
| History: drawer, CSV of error rows, remove with confirm and Undo | PASS (e2e) |
| `public/samples` (5 files) made by `scripts/make-samples.mjs`, with a "Try a sample" button for each | PASS |
| Managers import leads only; property templates show a lock with the reason; property wizard is NoAccess | PASS (e2e) |
| Executives: no bulk import, no history, single document extraction allowed (Arjun, Sneha, Vikram) | FIXED (details below) |
| Executives see only their own drafts; a pasted document becomes their own draft | PASS (e2e) |
| Executive opening a draft that came from an import saw a link to the history page (NoAccess) | FIXED (`draft-page.tsx`, the link is hidden without `import.leads`) |
| 375 px layout: the hub overflowed sideways by 421 px (the documents and samples grid items had no `min-w-0`) | FIXED; every main screen now has 0 overflow at 375 |
| Dark mode, Tamil, no leaked i18n keys, no console errors or warnings | PASS (hub, columns, check, done, document, drafts and history at 1440 dark, 375 and Tamil) |
| Visual quality against DESIGN_SYSTEM.md (KPI cards, rings, donut, avatars, illustrated empty states) | PASS |

### How the executive fix works
- `/import` now needs `import.document`, so all roles can open it.
- Executives see a limited hub:
  - a note saying bulk import is for admins and managers, with the permission reason;
  - "My drafts to review" and "Read a document";
  - the document samples only;
  - their own recent documents, which link to their drafts.
- The sheet wizards and `/import/history` stay NoAccess for executives.
- This follows master spec §4 (executive bulk import "❌ (or limited)") and ROLE_RESEARCH (single-document extraction). It also gives executives a way to reach their drafts, which the builder's request R1 would have removed. If the Parent applies R1 anyway, nothing breaks.

**Decision for you:** plan §8.3 literally says executives get NoAccess on `/import`. I chose the limited hub because the smoke test requires every sidebar link to open, and the master spec allows "limited". If you want the literal NoAccess back, revert the `/import` permission in `routes.tsx` and apply R1. That turns the smoke failure into a missing sidebar link and leaves executives with no way to reach their drafts.

### Files changed (all owned by M5)
- `src/modules/import/routes.tsx`: `/import` permission.
- `src/modules/import/pages/import-page.tsx`: limited executive hub and the `min-w-0` fix.
- `src/modules/import/pages/drafts-page.tsx`: the "Import" link above the title always shows.
- `src/modules/import/pages/draft-page.tsx`: history link hidden from executives.
- `src/modules/import/components/sheet-wizard.tsx`: city not required when the locality is mapped.
- `src/i18n/locales/en/import.json` and `ta/import.json`: new keys for the executive hub (Tamil is a draft and needs a fluent reviewer).
- `notes/requests-m5-import.md`: reviewer note saying R1 is no longer needed.
- `notes/assumptions-m5-import.md`: item 1 rewritten.
- New: `e2e/m5-import.spec.ts` (6 journeys) and `e2e/m5-import.dev.config.ts` (the same journeys against the dev server on 5205).
- Review screenshots: `E:\real-estate\crm-e2e\notes\screens\m5-import-review\`. The phone screenshots of the bulk screens (columns, check, done…) were taken before the overflow fix; only the hub showed the problem, and its re-measure gives 0 overflow. `phone-hub.png` and `phone-exec-hub.png` were retaken after the fix.

### Remaining issues
- **R2–R5** are small, non-blocking requests in files other modules own, still unapplied: R2 (tesseract pre-bundling in `vite.config.ts`, already worked around), R3 (image thumbnails in `file-uploader`), R4 (`<details>` inside `<p>` on the error page), R5 (`MappingTable` shows the AI sparkle on template and saved matches).
- **OCR needs the internet the first time.** The e2e journey uses the text PDF and pasted text, so it runs offline; the image samples are not covered by e2e.
- **Minor:** a row with no name shows "#12 #12"; on a phone the wizard step labels are shortened ("Ch…").
- **Build warning:** `pnpm build` warns that some chunks are larger than 900 kB. It is a warning only and I did not investigate it.

---
## review:m6-pipeline

## M6 Pipeline review: all acceptance criteria now met, 2 bugs fixed, 7/7 e2e tests pass

I read the module's code and drove it in Edge on port 5206 as admin, manager (Rohit) and executives Arjun, Sneha and Vikram, in light and dark, English and Tamil, at 1440 and 375 px. All acceptance criteria in plan §8.3 (M6) and master spec §11 are now met. I found and fixed 2 real bugs in M6-owned files.

**The new e2e journey passes 7/7** (6 desktop, 1 phone), with no console errors or warnings asserted in every test. It ran against the dev server on 5206, not the standard 5176 run: that run builds first, and `pnpm build` fails on other modules' type errors. Command:
`pnpm exec playwright test -c e2e/m6-pipeline.dev.config.ts --project=desktop --project=phone`

**M6 checks:** typecheck and lint show no errors in M6 files, and the module's vitest (18 tests) passes. The repo-wide `pnpm typecheck` and `pnpm lint` still fail on other agents' files, which I did not touch:
- `src/modules/import/components/sheet-wizard.tsx` is missing `./check-step` and `./done-step`.
- `src/modules/import/lib/import-flow.test.ts` has node-types errors.
- `src/modules/leads/components/lead-side.tsx` and `lead-summary.tsx` have type errors.
- `src/lib/property.ts` breaks the hooks rule in `propertyCopy`.

The dev server is stopped and port 5206 is free.

| Criterion | Result |
|---|---|
| Kanban with @dnd-kit, mouse drag (with Undo) | PASS (e2e) |
| Keyboard drag (Space, arrow keys, Space) with spoken announcements | PASS (e2e). It works at human speed; a key pressed in the same frame as the lift is ignored |
| One column per enabled stage, in Settings order | PASS (e2e) |
| Stage colours, 3 px top bar, count, ₹ total, share-of-value bar, stage strip in the header | PASS |
| Cards: client, temperature dot, property, ₹ value, executive avatar, days in stage (warning / Stalled), next follow-up (red when overdue), ✦ stalled marker | PASS (e2e) |
| Lost requires a reason; Cancel returns the card | PASS (e2e) |
| Lost and Booked dialogs without console warnings | FIXED (see bug 1) |
| Booked requires booking amount and property | PASS (e2e) |
| Undo on other moves | PASS (e2e) |
| Moving to Visit scheduled with no visit booked opens the appointment form | PASS (e2e; the builder had not tested this) |
| Move updates the lead record (stage history), which Today, Reports and the timeline read | PASS (e2e checks the stage history) |
| List view: sortable, "Move to…" on each row, `?view=list` in the URL | PASS (e2e) |
| Filters: executive (managers/admins only, `?owner=`), source, temperature, value, stalled only; filtered-empty with Clear filters | PASS (e2e) |
| Phone: stage tabs and "Move to…" sheet, no sideways scroll | PASS (e2e, phone project) |
| Phone page opens scrolled to the top | FIXED (see bug 2) |
| Analytics strip: conversion %, drop-off, average days against target | PASS |
| KPI cards: sparklines, forecast ring with Demo AI badge | PASS |
| AI stalled deals: recommended action; "Plan it" creates a task only after Confirm | PASS (e2e) |
| AI conversion prediction (✦ %) on each card and list row | PASS |
| Pipeline assistant: move proposal only applies on Confirm; a move to Lost still opens the reason dialog | PASS (e2e) |
| Demo AI badge on every AI output | PASS |
| Roles: Arjun, Sneha and Vikram see exactly their own deals and no executive filter; manager and admin see all 43 with the filter | PASS (e2e). No permission leaks found |
| Tamil and dark mode: no raw i18n keys, no sideways scroll | PASS (e2e and screenshots) |
| Empty, filtered-empty and AI error states | PASS (code review; the filtered-empty state is also exercised by e2e) |

### Fixes
1. `src/components/domain/stage-change-dialog.tsx`: the Lost reason and Booked property selects started out uncontrolled (`value={undefined}`). Every Lost or Booked move logged React's warning "Select is changing from uncontrolled to controlled", which also failed the no-console-warnings check. They now use `value={reason ?? ''}` and `value={propertyId ?? ''}`, and the placeholder still shows.
2. `src/modules/pipeline/components/pipeline-mobile.tsx`: centring the active stage tab used `scrollIntoView`, which also scrolled the whole phone page down when it opened. Now only the tab strip scrolls sideways.

### Remaining issues (none blocking, all left OPEN)
- **Booked counted twice:** Booked deals count both in open pipeline and in the win rate. This is a documented assumption, but the two numbers overlap.
- **Stage dialog list:** the dialog's "Move to" list shows every stage, not only the enabled ones.
- **Analytics tile label:** for a stage with no data, the screen-reader label reads "—% moved on, average — days".
- **Dark mode:** the Qualified and Visit-scheduled column backgrounds look heavier than the others. This follows the design system's dark tokens, so any change belongs to the foundation.
- **Phone layout:** at 375 px the four KPI cards stack, so the deals start far down the page. A two-column grid clipped the forecast card's label, so I put the original layout back; fixing it needs a compact option on the shared KPI card.
- **Global AI panel (M7):** the builder's request still stands. `executeProposal` can mark a lead Lost with reason "Other" without asking.

### Files
- New: `E:\real-estate\crm-e2e\e2e\m6-pipeline.spec.ts` (the journey).
- New: `E:\real-estate\crm-e2e\e2e\m6-pipeline.dev.config.ts` (runs the journey on 5206 because the 5176 build is blocked).
- Edited: `E:\real-estate\crm-e2e\src\components\domain\stage-change-dialog.tsx` and `E:\real-estate\crm-e2e\src\modules\pipeline\components\pipeline-mobile.tsx`.
- Appended review notes 17–20 to `E:\real-estate\crm-e2e\notes\assumptions-m6-pipeline.md`.
- Replaced `E:\real-estate\crm-e2e\notes\screens\m6-pipeline\manager-375-light.png` with a capture taken after the scroll fix. The other required screenshots look the same after the fixes, so I kept the builder's.

---
## review:m7-ai

## M7 AI Assistants: independent review

M7 mostly holds up. I tested it in Edge on port 5207 as the admin, the manager (Rohit) and executives Arjun, Sneha and Vikram, and read the code. Nearly every claim in the builder's report checked out. I found and fixed nine defects inside M7's own files. One layout problem is still open, because the fix belongs to files M7 doesn't own.

**Checks:**
- **Tests:** a full `pnpm typecheck`, `pnpm lint` and `pnpm test` run finished green: tsc exit 0, lint exit 0 (only the existing fast-refresh warnings in `components/ui` and `match-list`), and 48 test files with 631 tests passing.
- **E2E:** `pnpm exec playwright test e2e/m7-ai.spec.ts --project=desktop` passes 4 of 4 on the standard 5176 build-and-preview, once 5176 was free.
- **Dev config:** the dev-port config `e2e/m7-ai.dev.config.ts` passes 5 of 5 (desktop plus the `@phone` test).
- **Housekeeping:** the dev server is stopped and ports 5207 and 5176 are free. No commits, no foundation files edited.

### Criteria
| Criterion (plan §8.3 M7 / master spec §12) | Result |
|---|---|
| Global panel: FAB, Ctrl/Cmd+K, `/` (focuses the box), Esc closes; docked at 1280 px+, overlay below, full screen at 375 | PASS (docking breaks some pages, see OPEN below) |
| Context chip shows the page or record and the role; follows the open record (`/leads/LEAD-1001` shows "Lead · Priya Sharma") | PASS, plus a FIX: at 375 px the role hid the record name, so the role is now hidden there and still shown above the chips |
| Role prompt chips (ROLE_RESEARCH §5) for admin, manager and executive, using real names; extra chips for the open record | PASS |
| Voice in en-IN with a fallback message | PASS (code read; the speech API itself was not exercised in the headless browser) |
| §12.5 commands run after Confirm, with varied phrasing: add lead, update lead, matches, appointment, site visit, follow-up, assign X to Y, today's tasks, my and team performance, priority leads, follow-up leads, within budget, conversions, today's appointments | PASS, each one tested in the browser and its data change checked in localStorage |
| "Add property …" in the chat | FIXED: it was read as a property *search*. There is now a `createProperty` intent with a confirm card, or a "still needed" reply that links to the form |
| Answers link to records; Undo for 10 s; Cancel leaves data alone | PASS; e2e checks Confirm → stage changed → Undo → restored, and link → `/leads/LEAD-1001` |
| Refusal by permission, with the reason (executive assign, delete, team view; Booked or Lost need the dialog or a reason) | PASS |
| Changes logged with `via: 'ai'` | PASS for stage moves, leads, appointments, tasks and properties. FIXED: AI task reschedules now go through `updateTask(…, { via: 'ai' })`. OPEN: AI assignments and reassignment requests are still logged as manual (R1 and R2, services owned by M8 and M2) |
| Confirm button reachable after a change | FIXED: the 10 s Undo toast sat at the bottom right, over the next card's Confirm button (Playwright confirmed the click was blocked). AI toasts now appear beside the panel while it is open |
| `<ModuleAssistant>` configured for all 10 §12.2 assistants and exported from `components/ai/module-assistant` | PASS (registry plus the Assistants tab; 5 assistants on a lead page). Mounting it inline on module pages is still request R4 to the owners |
| Simulated provider handles any reasonable input, with 25+ varied tests including Hinglish | PASS, plus FIXES (each now has a test in `src/ai/simulated/m7-review.test.ts`): the "Which buyers match Aranya Greens?" chip answered with matches for the lead Ananya Iyer; "Sanjay ka budget 2 cr kar do" was not understood (new Hinglish field-change rewrite); a "Called Sanjay Gupta, …" note was saved as "Called , he wants…" |
| Readable output, no raw keys | FIXED: "Who should I call next?" showed a raw `{{age}}`; "1 site visits", "1 bookings" and "1 units" are now worded or pluralised correctly in English, with matching Tamil keys |
| Demo AI badge on every output | PASS (the e2e checks it on every answer) |
| Effort-saved indicators ("AI help today" strip, fields filled) | PASS |
| No console errors; 1440 light and dark, 375, Tamil; no sideways scroll | PASS (no console problems as any role; the 375 overflow check passes in the e2e). Screenshots are in `notes/screens/m7-ai/review/` |
| Docked panel at 1440 px vs page layouts | OPEN (R5, see below) |

### Files changed (all owned by M7 or new)
- `src/services/commands.ts`: reschedule now logs via `'ai'`.
- `src/ai/simulated/intents.ts`, `command-actions.ts`, `commands.ts`: the `createProperty` intent and `createPropertyPlan`, and tidier call notes.
- `src/ai/simulated/command-queries.ts`: `reasonText` (the age fix) and the buyers-for-a-property fix.
- `src/ai/simulated/hinglish.ts`: the field-change rewrite.
- `src/components/ai/use-proposals.ts`: the toast position (`besidePanel`).
- `src/components/ai/ai-panel.tsx`: the role in the context chip is hidden at phone width.
- `src/i18n/locales/{en,ta}/ai.json`: new reply and nav keys, plurals, the count wording.
- New:
  - `src/ai/simulated/m7-review.test.ts` (7 tests)
  - `e2e/m7-ai.spec.ts` (5 journeys)
  - `e2e/m7-ai.dev.config.ts`
- Notes: `notes/requests-m7-ai.md` (added R5 and a note that R2 is partly worked around), `notes/assumptions-m7-ai.md` (#19–22).

### Remaining issues
1. **R5 (blocking for the docked look; owners: foundation shell and M2).** When the panel is docked, the app shell reserves 440 px on the right (`xl:pr-[440px]`), so at 1440 px the page content is only about 750 px wide. Pages still pick their grid by window width, so the lead page squeezes its middle column to about 40 px and two cards overlap (`notes/screens/m7-ai/review/panel-1440-light-answers.png`). The fix is either to dock only from 1536 px (shell and panel changed together) or to have pages lay out by their container's width.
2. **R1 and R2.** AI assignments (`assignLeads`) and reassignment requests (`requestReassign`) are still logged as `manual`, because those services take no `via` option yet.
3. **R3 and R4.** `<AutoAssignedToday/>` and inline `<ModuleAssistant/>` are not yet mounted by the module owners. They work today from the panel's Assistants tab.
4. **Minor.**
   - Marking a lead Lost by chat with no reason given picks "Other" (shown on the card, can be edited).
   - The Hinglish "Read as" text is sometimes clumsy ("3bhk wants Whitefield in up to 1.2 cr") but reads correctly.
   - The Tamil strings are still a draft and need a fluent reviewer.
   - Errors (`toastError`, from shared code) still appear at the bottom right.

---
## review:m8-team-settings

## M8 Team, Settings, Notifications & Activity: independent review

M8 meets every acceptance criterion in plan §8.3 and the master spec sections I was given. I fixed six problems in M8's own files. Two points are still open: one is a gap in the foundation's settings service, and the other is the known rename that only shows inside Settings.

I checked by reading the code and by using the app in Edge on port 5208 as admin, manager, Arjun, Sneha and Vikram. I covered 1440 light, 1440 dark, 375 px and Tamil. No route produced console errors or warnings, and no page scrolls sideways at 375 px.

### Criteria

| Criterion | Result |
|---|---|
| /team cards: availability (can be changed, with permission), hot/warm/cold load bar, follow-ups, today's appointments, conversion ring, targets | PASS |
| /team/:id: assignment history and activity; a manager opening someone outside their team gets "Not in your team" | PASS |
| Admin: add user by hand or by pasting a sentence (AI fields marked, missing ones listed, nothing saved before Save) | PASS (e2e) |
| Admin: deactivate with hand-over (auto / to one person / leave unassigned) and a preview; activate again | PASS (e2e) |
| Assign dialog: name, open leads, follow-ups, today's appointments, workload bar, conversion %, availability; people on leave shown but can't be picked | PASS |
| Assign dialog: "Recommended (auto)" with Demo AI badge and the reason ("Recommended: Sneha Reddy · lowest workload (4 open leads)"); ties go round-robin (covered by `lib/assignment.test.ts`) | PASS (e2e) |
| Assign dialog: one or many leads, optional note, toast saying who and why | PASS (e2e) |
| Assign dialog: no direct `role === 'manager'` check (plan §8.2 rule 4) | FIXED (now uses `scope('lead.assign')`) |
| Settings sections by permission: admin sees 8, manager sees profile + assignment, executives go straight to their profile; blocked sections show NoAccess | PASS (e2e) |
| Profile: theme and language | PASS (e2e: theme switch) |
| Assignment: auto-assign switch, cap, rules, rule tester; no direct role check | FIXED (now uses `scope('rules.configure')`) |
| Assignment: "describe the rule in words" | FIXED (see issue 2 below) |
| Pipeline: rename, switch on/off, target days, win probability, lost reasons | PASS (renames show only inside Settings, see open point B) |
| Templates: "Draft with AI", placeholders, preview | PASS |
| Matching weights: live total must read 1.00, "balance to 1.00", save | PASS (e2e) |
| Response times and scoring thresholds | PASS |
| Reset demo data: asks first, then restores the seed | PASS (e2e) |
| Bell: All / Unread tabs, mark read, mark all read, open the record, View all | PASS (e2e) |
| /notifications: filters, mark one unread, "Catch me up" (Demo AI) | PASS (e2e) |
| Notification text for one lead | FIXED (see issue 1 below) |
| /activity: admin sees everything, manager their team, executives get NoAccess; five filters; "ask in words" | PASS (e2e) |
| 375 px / dark / Tamil | PASS, except the cap field (FIXED, issue 3) |

### What I fixed
1. **Notification text for one lead:** `deactivatedOwner` read "owns 1 open lead(s)" and `leaveReassign` had no singular. Both now have proper singular and plural forms in `notifications.json`, English and Tamil. Checked on screen: "owns 1 open lead".
2. **"Describe the rule in words" dropped a condition without saying so.** A rule holds one condition, so "Chennai … Tamil … to Sneha" lost Chennai with no message. `readRule` now also returns `alsoFound`, and the editor shows "One condition per rule: I also saw Location. Add a second rule for it." Added in English and Tamil, with a vitest case.
3. **Workload cap field cut off its placeholder at 375 px** ("No lim"). Widened it from `w-28` to `w-36` in `assignment-section.tsx`.
4. **Rule editor layout:** the AI-filled Values / Send-to boxes used `fieldset`/`legend` with a negative margin, so the label sat on the border and the box stuck out of the dialog. Changed to labelled `div role="group"` blocks in `rule-editor.tsx`.
5. **Direct role checks** in `assign-dialog.tsx` and `assignment-section.tsx` replaced with permission scopes.
6. **New e2e journey** at `e2e/m8-team-settings.spec.ts`: 10 desktop tests and 1 phone test. Each checks the saved data and that the console is clean.

### Checks
- **E2E, required command** (`pnpm exec playwright test e2e/m8-team-settings.spec.ts --project=desktop`, build + preview on 5176): 8/8 passed. I added the "assign dialog" and "rule in words" tests after that run.
- **E2E on my dev port:** the "assign dialog" and "rule in words" tests passed against 5208 with the new `e2e/m8-team-settings.dev.config.ts`. So did the `--project=phone` test. Every desktop test has passed against 5208, but not all in one run, and the full set of 10 has not been run on 5176.
- `pnpm typecheck`: passes.
- `pnpm lint`: 0 errors. The only warnings are 5 in files outside M8.
- `pnpm test`: 630 of 631 pass. The one failure is not M8's: `src/i18n/locales.test.ts` says the M7-owned `ai` namespace is missing 3 Tamil keys ("ai: Tamil has every English key"). M7 is probably still writing it.

### Open
- **A. The settings service doesn't stop managers from changing company-wide rules** (foundation file, so I logged it as R6 in `notes/requests-m8-team-settings.md`). The UI blocks it, but `deleteRule` lets a manager delete a company-wide rule. `saveRule` with a company-wide rule's id overwrites it and turns it into their team's rule. Managers can also flip the company-wide auto-assign switch and change the cap. The builder recorded that as assumption 4, and the UI warns that it applies company-wide. R6 proposes the exact guard and asks for a decision on the switch and cap.
- **B. Renamed stage names only show inside Settings** (R1 follow-up). The builder applied R1 itself (marked APPLIED): an optional `label` field on `PipelineStageDef`. Showing the new name elsewhere needs a shared `stageLabel` helper from the foundation and changes in M2, M6 and M1.
- **C. The breadcrumb on a settings section reads "Settings section"** instead of the section's name (R4). Route titles can't change with the URL; the page heading is correct.
- **D. Undo:** assigning a single lead has no Undo (the service only supports it for bulk), and Reset demo data has a confirm but no Undo. Both are documented assumptions.
- **E. A manager opening `/team/<someone outside their team>`** sees the "Not in your team" state, which has no `<h1>`. Minor, accessibility only.
- **F. Tamil** is drafted and still needs a fluent reviewer.

### Housekeeping
- **Ports:** 5208 is stopped and free; stopping the task left a vite process running, so I killed it (PID 17584) and checked the port. A `vite preview` on 5176 (PID 26536) is still running. It is probably another agent's run, so I left it.
- **Shared scratchpad:** other agents' files are in it, and one of them overwrote my first exploration script.
- **Other files:** I changed nothing outside M8's folders and the `settings` / `notifications` i18n namespaces. Nothing was committed.

### Files
- e2e: `E:\real-estate\crm-e2e\e2e\m8-team-settings.spec.ts`, `E:\real-estate\crm-e2e\e2e\m8-team-settings.dev.config.ts`
- `E:\real-estate\crm-e2e\src\components\domain\assign-dialog.tsx`
- settings module: `E:\real-estate\crm-e2e\src\modules\settings\components\assignment-section.tsx`, `E:\real-estate\crm-e2e\src\modules\settings\components\rule-editor.tsx`, `E:\real-estate\crm-e2e\src\modules\settings\lib\settings-logic.ts`, `E:\real-estate\crm-e2e\src\modules\settings\lib\settings-logic.test.ts`
- i18n: `E:\real-estate\crm-e2e\src\i18n\locales\en\notifications.json`, `E:\real-estate\crm-e2e\src\i18n\locales\ta\notifications.json`, `E:\real-estate\crm-e2e\src\i18n\locales\en\settings.json`, `E:\real-estate\crm-e2e\src\i18n\locales\ta\settings.json`
- notes: `E:\real-estate\crm-e2e\notes\requests-m8-team-settings.md` (R6 added), `E:\real-estate\crm-e2e\notes\assumptions-m8-team-settings.md` (items 15–16 added)
- Before/after screenshots (`review-before-*`, `review-after-*`) in `E:\real-estate\crm-e2e\notes\screens\m8-team-settings\`: the rule editor with AI fill at 1440 light, 1440 dark and 375, plus the assignment page at 375.