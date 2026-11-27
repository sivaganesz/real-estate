# Phase 3 reports (verbatim)


---
## demo-script

I wrote `E:\real-estate\crm-e2e\DEMO_SCRIPT.md`. It has a reset step plus a 3–5 minute click-by-click segment for each role, and every step has a one-line expected result. I checked every step against the running app on port 5211, not just the source: first by looking at each screen, then by running the whole script in order on fresh seed data with a scratch Playwright script and recording what actually appeared. The server is stopped and port 5211 is confirmed free. I did not edit any code and did not commit.

**What's in the script**
- **Reset before demo (§0):** Admin → Settings → Demo data → **Reset demo data** → **Reset everything**. There's a fallback (`localStorage.clear()` and reload) for when the Admin profile isn't active, plus window size, theme and language checks.
- **Admin, Meera (A1–A23):** her Today summary, KPI cards, system alerts and AI insights (one opens /reports/sources).
  - Global assistant with varied wording: the "Business summary" chip, "Which project has most unsold inventory?", "any duplicate leads?", adding the Kondapur listing then **Confirm**, and the refusal for "mark Priya as booked".
  - Import of `leads-99acres-export.csv`: mapping at 97% confidence, Check 12 rows, fixing row #10 and re-checking it, then **Import 9 rows**. The result shows who the leads were auto-assigned to (Sneha 5, Vikram 3, Arjun 1).
  - `apartment-brochure.pdf` saved as 2 drafts, and the builder `.xlsx` as an optional step.
  - An assignment rule written in words, Add user filled from one pasted sentence and then cancelled, the Activity log question, and the Reports drill-down.
- **Sales Manager, Rohit (M1–M24):**
  - Today: assigning one queued lead using the AI's suggested owner, **Auto-assign all** with its preview and then **Assign 4**, and reassigning Farhan's leads while he's on leave.
  - Leads: the duplicate warning, then paste-and-fill with the exact Rahul Verma text. It fills 13 fields, asks one question with chips, and shows "4 of 4 known" with Spouse as a decision maker. On the lead: **Why this score?**, **Edit with AI** (diff, then Apply) and the Hinglish message.
  - Pipeline: dragging Rahul to Contacted, the Lost dialog that requires a reason, **Plan it** on a stalled deal, and the pipeline assistant.
  - Global assistant: overload check, a reassignment confirmed and undone, team summary, the property-delete refusal, and Matching with **Why?** on a match.
- **Sales Executive (E1–E22), switching Arjun → Vikram → Sneha:**
  - Arjun's Today: **Log outcome**, **Done** and **Undo**, rescheduling a follow-up from the Today **Ask** box, **Send confirmation**, and sharing a match.
  - Assistant: "who do I call next", the Hinglish "Priya ka visit kal 11 baje fix karo" (with a double-booking heads-up), a reminder, and two refusals (reassigning, and the team view).
  - **Paste & book** with its **Book anyway** warning, a pipeline drag, and the limited Import page executives get.
  - Vikram sees Rahul Verma, who was auto-assigned to him, and sends **Request** reassignment. Sneha sees the leads the Admin imported, saves a pasted document as a draft, and the Tamil toggle closes the demo.

**Things to know**
- **Order matters:** the segments must run Admin → Manager → Executive on one reset, because later steps rely on earlier ones. Followed exactly, Rahul Verma is auto-assigned to Vikram. If the Manager segment is run alone after a reset, Rahul goes to Arjun instead; the script says this.
- **Labels may drift:** another agent is changing code in the working tree right now (`git status` shows many modified `src/` files and a `notes/tmp-integrator/` folder). My run used the code as it was then, so if their changes touch Today, Leads, Pipeline or Import, labels or numbers in the script may need re-checking.
- **Clock-dependent text:** values like "Good morning" and "25 min since the enquiry" were recorded around 10 AM on 27 Nov 2026 and will shift at other times; the script warns about this.
- **Not clicked live:** three labels in the Executive segment come from the English locale files and e2e specs rather than the live run: "Send request" (E19), "Save as draft" (E21) and the Tamil wording of AI answers (E22).
- **Image samples need internet:** the two image samples need an internet connection the first time OCR runs; the script notes this.

I logged these assumptions in `E:\real-estate\crm-e2e\notes\assumptions-integration.md`, a new file. My scratch folder `notes\tmp-demo\` is deleted.

Files are in `E:\real-estate\crm-e2e`:
- DEMO_SCRIPT.md
- notes\assumptions-integration.md

---
## integrator

INTEGRATOR (Phase 3, resumed): finished. `pnpm verify` passes (typecheck, lint, 51 test files with 648 tests, build). The full e2e suite against a dev server on 5210 had 79 of 81 passing. Both failures were in `m7-ai`, I fixed them, and the re-runs pass: m7-ai, m2-leads-clients and integration together (17), plus a new phone check (1). I did not re-run the whole 81-test suite after the two fixes. Nothing was committed. The dev server is stopped and port 5210 is free. `notes/tmp-integrator/` is deleted, and nothing was created outside `crm-e2e/`.

## The interrupted run's edits (79 files)
- I kept all of them. `pnpm verify` passed on them as they were.
- All eight `notes/requests-*.md` files have an "Integrator status (Phase 3)" section, with every entry marked APPLIED, DECLINED with a reason, or confirmed. I checked a sample of the APPLIED entries against the code.
- The e2e log it left behind showed 18 failures. They were all "worker process exited unexpectedly (0xC0000142)", meaning the run was killed by the pause, not real test failures.

## What the kept edits cover (checked in code and tests)
- **Requests:**
  - Filter params work on `paths.leads()`, `paths.pipeline()` and `paths.properties()`, and Leads, Pipeline and Properties honour them.
  - The Reports drill drawer's "Open" button goes to the filtered list. The admin source chart on Today and the manager funnel link to filtered lists.
  - Smaller fixes:
    - Drawer widths.
    - "1 option" wording in share messages.
    - Booked/Sold confirmation in the property edit form and in bulk.
    - The edit pencil is disabled, not hidden, on someone else's listing.
    - File-uploader thumbnails no longer break in dev.
    - EmptyState body is a `<div>`.
    - MappingTable marks only real AI guesses with the sparkle.
- **Assistant and services:**
  - `executeProposal` refuses Lost without a reason.
  - `assignLeads` and `requestReassign` accept `via`, and assistant commands pass `via: 'ai'`.
  - A manager cannot edit, delete or toggle a company-wide or another team's assignment rule, enforced in the service.
- **Stages:**
  - Admin stage renames show on every screen, in English and Tamil.
  - The stage dialog hides stages switched off in Settings.
- **Breadcrumbs:** report tabs and settings sections now name themselves in the breadcrumb and page title.
- **Activity log:** task and appointment edits, reschedules, reopen, confirm and delete now appear in the activity log.
- **Interconnections (master spec §7):** covered by the new `src/services/interconnections.test.ts`:
  - Booking a site visit creates the appointment, the timeline entry and the stage move.
  - Completing a visit suggests the follow-up and the next stage.
  - Booked/Sold properties leave every match list.
  - Reassigning updates both executives' workloads and Today, the assignment history and notifications.
  - Stage changes reach Today, Reports and the lead page.
  - Imported, assistant-created and hand-made leads are auto-assigned when auto-assign is on.
  - Every change appears in the activity log.
- **Assistants (§12.2):** all 10 can be reached.
  - Placed directly on screens: Add lead, Add/Edit property, Add appointment, follow-up on the lead page, property edit, import on `/import`, and insights on Reports and the manager and executive Today.
  - Edit lead, qualify lead and property matching come through the lead page's existing cards and the panel's Assistants tab.
  - Paste-and-fill and voice are on Add/Edit Lead (Edit uses the Edit-with-AI card, with voice), Add/Edit Property and Add Appointment.
- **Cleanup:** the dev-only `/__kit` route is gone, along with the `kit` text files, `StubPage` and the "Coming soon" text.
  - No "Coming soon", TODO, stub pages or empty click handlers are left.
  - A browser crawl of 27 routes as admin, manager and executive found no dead buttons and no console errors.
- **`e2e/integration.spec.ts`:** filtered links, Reports drill-down to the filtered list, assistant placement, and the panel overlaying at 1440 px.

## What I changed in this run
1. **Lead page was wider than the phone screen (real bug from Phase 3).** `src/modules/leads/pages/lead-page.tsx` had no fixed column on phones. The newly added follow-up assistant stretched the page to 552 px on a 412 px phone, and the assistant panel's Close button could not be tapped. The single phone column is now pinned to the screen width, the side panels may shrink, and the tablet two-column grid is made the same way. The page now measures 412 px. Screenshot: `E:\real-estate\crm-e2e\notes\screens\integration\after-lead-phone-412-panel.png`.
2. **`e2e/m7-ai.spec.ts`:** below 1920 px the panel now overlays the page, so following a link from it closes the panel. The test now reopens the panel after the "open the changed record" link.
3. **`e2e/integration.spec.ts`:** new phone test that checks the lead page, with the follow-up assistant, fits the phone width.
4. **Notes:**
   - `notes/assumptions-integration.md`: added items 15 and 16.
   - `notes/requests-m7-ai.md`: added a follow-up note under R5.

## Still open
These are left for the UI unifier (layout only):
- Leads: KPI labels cut off on phones, the lead page tab strip clips its last tab (it still scrolls), the phone column order, and the narrow search box at 1440 px.
- Pipeline: KPI cards stack on phones, and two columns look heavier in dark mode.
- Appointments and tasks: phone checkboxes.

These stay as documented assumptions:
- Pipeline: Booked deals count both in open pipeline and in the win rate.
- Team: assigning a single lead has no Undo.
- Import: executives get a limited import hub, not the NoAccess page the plan describes.

Tamil text still needs a review by a fluent speaker.

## Files changed in this run
- `E:\real-estate\crm-e2e\src\modules\leads\pages\lead-page.tsx`
- `E:\real-estate\crm-e2e\e2e\m7-ai.spec.ts`
- `E:\real-estate\crm-e2e\e2e\integration.spec.ts`
- `E:\real-estate\crm-e2e\notes\assumptions-integration.md`
- `E:\real-estate\crm-e2e\notes\requests-m7-ai.md`
- `E:\real-estate\crm-e2e\notes\screens\integration\after-lead-phone-412-panel.png` (new)

---
## ui-unifier

VISUAL UNIFIER (Phase 3): done. `pnpm verify` passes: typecheck, lint (only the 3 existing fast-refresh warnings in components/ui), 51 test files with 648 tests, and the build. I ran the full e2e suite against a dev server on 5210: 81 of 82 passed. The one failure was in m1-today-reports and was not caused by my changes (explained under item 7). After fixing that test, its spec passes 8 of 8. I did not re-run the whole suite after that fix. Nothing was committed. Ports 5210 and 5180 are free, `notes/tmp-unifier/` is deleted, and nothing was created or changed outside `crm-e2e/`. `git status` of wireframe-rebuild is clean.

## How I checked
- Captured 16 routes for admin, manager and executive at 1440 light, 1440 dark, 768 and 375 with Playwright and Edge. Routes a role can't open were skipped.
- Read about 40 of the screenshots myself, plus some Tamil shots at 1440.
- No horizontal overflow and no console errors on any captured screen.

## What I changed
1. **KPI cards are one shape everywhere** (`src/components/shared/kpi-card.tsx`, used by 59 cards on 13 pages).
   - **Problem:** clickable cards are `<button>`s, which centre their content vertically, so cards in the same row had their numbers at different heights. The progress ring sat in the label row and squeezed labels at 375 ("OVERD… FOL…", "UNASS…", "SITE VISI…").
   - **Now:** each card is a full-height column with a fixed-height label row. The ring sits beside the value, and the sparkline or target bar sits on the bottom edge, so cards in a row line up.
   - Clickable cards get a primary-tinted border on hover.
   - Cards with no chart show their icon large and faint in the corner (decorative, `aria-hidden`, token colour at 7%, 12% in dark), so they no longer look empty.
   - Removed the `className="flex flex-col justify-start"` workarounds in `activity-page.tsx` and `notifications-page.tsx`.
2. **One style for the AI button next to the primary button.** I added a Button variant `ai-outline` in `src/components/ui/button.tsx` (AI border and AI text on the card colour). Before, these buttons were five different styles: secondary with an AI-coloured icon, secondary with AI text, a ghost button, and a filled AI button. Applied to:
   - Leads "Paste a message"
   - Tasks "Follow-up assistant"
   - Appointments "Paste & book" (header and empty state)
   - Team "Team insight"
   - Properties "Paste a listing" (was a ghost button)
   - Notifications "Catch me up" (was a filled AI button, a second primary next to "Mark all read")
3. **Today priority list** (`src/modules/today/components/priority-list.tsx`).
   - **Problem:** at 1440 the list is about 615 px wide and the one-line row layout clipped names ("Karthik Subram…") and wrapped reason chips onto two lines.
   - **Now:** the layout switches on the list's own width, not the window's (a container query, `@3xl`, about 690 px at the 90% desktop root font size).
   - When narrower, rows stack: name, reason and due time on top with the score ring at the right, and the actions on their own right-aligned line. Call and Done labels show whenever there is room.
4. **Matching "Fresh matches to send"** (`src/modules/matching/pages/matching-page.tsx`): each row now has the buyer's avatar, the property title with an icon, and a match ring instead of a bare percentage. Rows also get a focus ring.
5. **Focus states** (`src/index.css`): one keyboard focus ring for plain links, buttons, tabs and `[tabindex]` elements that don't draw their own. It has zero specificity, so components' own focus styles still win. Before this, about 60 inline links and buttons had only the browser's default outline.
6. **Filter bar** (`src/components/shared/filter-bar.tsx`): the search box keeps its width on desktop (`lg:shrink-0`). In Tamil, and in English on Leads, the filter pills had squeezed it to one word.
7. **Test fix in `e2e/m1-today-reports.spec.ts`** (the "list re-ranks" test).
   - **Problem:** the reschedule step checked by lead name. Ananya Iyer owns two rows (the 15:00 call and an overdue follow-up), so from about 13:00 the test fails whatever the layout. The screenshot taken before my changes shows the same row order.
   - **Fix:** it now checks the rescheduled row's item id.
8. Logged everything above in `E:\real-estate\crm-e2e\notes\assumptions-integration.md`, under "Visual unifier (Phase 3)".

## What I looked at and left alone
- **Untranslated Tamil:** 11 Tamil values match the English. They are sample inputs typed into AI fields, the brand name and "Google Ads". All are intentional; no missing translations.
- **Dark mode:** contrast is good on Today, Lead, Appointments, Settings, Activity and Properties. No changes needed.
- **Empty states:** Matching has an illustrated empty state, and Today has empty and filtered-empty states.
- **Loading and error states:** I didn't check these pages for them; they come from the module builds.
- **Not fixed:**
  - With only one photo, the property detail header stretches it and it looks soft.
  - The Pipeline "Win rate" sparkline dips to zero because of the seed data.

## Screenshots
- **After:** `E:\real-estate\crm-e2e\notes\screens\final\` holds 184 PNGs named `<route>-<role>-<width>-<theme>.png`. Routes: today, tasks, appointments, leads, lead (LEAD-1001), pipeline, clients, matching, properties, property (PRP-1001), import, reports, activity, team, settings and notifications.
- **Before:** `E:\real-estate\crm-e2e\notes\screens\before\` holds 8 PNGs from wireframe-rebuild, which I ran with its own vite on 5180 (its node_modules were present) and stopped afterwards:
  - properties, property (PROP-1001), leads, lead (LEAD-1001), settings and today (its "Sales dashboard" placeholder, "This section is being rebuilt"), all at 1440 light
  - leads and properties at 375 light
- **Pairs to show the owner:**
  - `leads-manager-1440-light` with `leads-wireframe-1440-light`
  - `today-admin-1440-dark` or `today-executive-1440-light` with `today-wireframe-1440-light`
  - `properties-admin-1440-light` with `properties-wireframe-1440-light`
  - `lead-executive-1440-light` with `lead-wireframe-1440-light`

## Files changed
- `src/components/shared/kpi-card.tsx`
- `src/components/ui/button.tsx`
- `src/components/shared/filter-bar.tsx`
- `src/index.css`
- `src/modules/today/components/priority-list.tsx`
- `src/modules/matching/pages/matching-page.tsx`
- `src/modules/leads/pages/leads-page.tsx`
- `src/modules/tasks/pages/tasks-page.tsx`
- `src/modules/appointments/pages/appointments-page.tsx`
- `src/modules/team/pages/team-page.tsx`
- `src/modules/properties/pages/properties-page.tsx`
- `src/modules/notifications/pages/notifications-page.tsx`
- `src/modules/activity/pages/activity-page.tsx`
- `e2e/m1-today-reports.spec.ts`
- `notes/assumptions-integration.md`

No dependencies added. No `@ts-ignore` or lint-disable comments, and no skipped tests.

---
## suite-owner

The whole suite now passes, with nothing left failing. I added five end-to-end tests for the cross-module flows, and no app code needed fixing.

**Results**
- `pnpm verify` passed: typecheck, lint (only the old fast-refresh warnings), 648 unit tests in 51 files, and the build.
- `pnpm e2e` on the build passed 87 of 87 in all three projects (desktop, tablet, phone).
- `pnpm e2e:dev` ran once against the dev server and passed 82 of 82, with no React dev warnings or console errors. That run started before the five new tests were added; they then passed against the dev server on 5210.
- No bugs turned up in the app. The only change to a test was a fix to my own new reassignment test (see below). No existing spec was changed.

**Passes per spec file (`pnpm e2e`)**

| Spec file | Desktop | Phone | Tablet |
|---|---|---|---|
| `integration.spec.ts` | 9 | 1 | |
| `m1-today-reports.spec.ts` | 7 | 1 | |
| `m2-leads-clients.spec.ts` | 7 | 1 | |
| `m3-properties-matching.spec.ts` | 9 | 1 | |
| `m4-appointments-tasks.spec.ts` | 11 | 1 | |
| `m5-import.spec.ts` | 6 | | |
| `m6-pipeline.spec.ts` | 6 | 1 | |
| `m7-ai.spec.ts` | 4 | 1 | |
| `m8-team-settings.spec.ts` | 9 | 1 | |
| `smoke.spec.ts` | 9 | 1 | 1 |
| **Total** | **77** | **9** | **1** |

**New tests in `E:\real-estate\crm-e2e\e2e\integration.spec.ts`**
Each one checks the saved data as well as the screen.
1. **Site visit from a lead page:** the executive books a visit, and the appointment is saved with the right owner. The lead's stage moves to "Site visit scheduled". The timeline shows "Appointment booked" and the stage move, and the lead's Appointments tab and the calendar list both show it. Everything is still there after a reload.
2. **Booked property leaves matching:** the manager books Harish Reddy on the pipeline. His property PRP-1011 becomes booked and a client record is created. The property then no longer appears in matching, either on its own page or in another buyer's matches.
3. **Reassignment:** the manager moves one of Arjun's Today leads to Vikram. Its open tasks move with it and the assignment history records the change. The timeline shows "Reassigned from…" and both people get a notification. The lead leaves Arjun's Today priority list and appears on Vikram's.
4. **Pipeline move reaches Today and Reports:** moving Divya Menon to Negotiation raises the Negotiation count on the manager's Today by one, and also on the Reports pipeline tab.
5. **Persistence and reset:** a stage move and a note are still there after a reload, along with the chosen profile. Reset demo data asks first, then restores the seed, and the reset itself survives a reload.

**The one test fix**
The reassignment test first failed because the lead was still linked from Arjun's Today. The link came from a visit Arjun had already done at 11:00 that day, still waiting for its outcome. The app moves only open tasks and future appointments to the new owner, so the person who ran the visit records its outcome. That is correct behaviour, so I changed the test to check the Today priority list only. I logged this as assumption 17 in `E:\real-estate\crm-e2e\notes\assumptions-integration.md`, and the coverage of the new tests as assumption 18.

**Housekeeping**
- Nothing was committed and no packages were added.
- My scratch folder `notes\tmp-suite` is deleted, and nothing outside `crm-e2e` was touched.
- No dev servers are left running, and ports 5174, 5176 and 5210 are free.