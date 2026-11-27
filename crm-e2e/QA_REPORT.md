# QA Report

## 1. How QA was done

- QA was done by role-based QA sub-agents, independent from the developers: Admin, Manager, Executive (three accounts: Arjun, Sneha, Vikram), Cross-module & AI, and Visual & responsive.
- Each agent walked real journeys through the UI, using the real profile switcher. The journeys are Playwright specs in e2e/qa-*.spec.ts (qa-admin, qa-manager, qa-executive, qa-cross, qa-visual).
- Round 1 was a full pass and found 57 bugs (recorded in notes/qa-r1-bugs.json).
- Round 2 was one main journey per role (Admin, Manager, Executive), run in fast mode on the owner's instruction. Visual and Cross-module/AI were not re-run as full passes in round 2; they were re-checked through the fixed-bug tests.

## 2. Round 1 bugs

| ID | Role | Severity | Area | Title | Status |
|---|---|---|---|---|---|
| ADM-5 | Admin | major | team-settings-notifications-activity | Changing an executive with open leads to Sales Manager orphans her leads (no hand-over, no alert, stale rule, still offered as executive profile) | Fixed in round 2 (profile picker now checks role) |
| ADM-7 | Admin | major | team-settings-notifications-activity | Lost reasons switched off in Settings are still offered when marking a lead lost | Fixed |
| ADM-4 | Admin | minor | ai-assistants | Offer message drafts a broken sentence: 'This offer holds until . ' | Fixed |
| ADM-2 | Admin | minor | ai-assistants | Typed ROLE_RESEARCH admin prompt 'Deactivate Kavya and redistribute her leads' only says 'go to Team' | Fixed |
| ADM-3 | Admin | minor | team-settings-notifications-activity | Deactivation hand-over sends the receiver one notification per lead (6 at once) | Fixed |
| ADM-6 | Admin | minor | import | Import adds a blank note '[2026-11-26]' for rows with an empty Message cell | Fixed |
| ADM-8 | Admin | minor | shell-shared-core | Floating AI button covers the right part of the settings 'Save changes' button | Fixed |
| ADM-9 | Admin | minor | team-settings-notifications-activity | New notifications show a future time ('in 2 seconds', 'in 6 seconds') | Fixed |
| ADM-1 | Admin | minor | today-reports | Admin Today hero tiles 'Unassigned' and 'Rows imported' are not clickable (other two tiles are) | Fixed |
| EXE-1 | Sales Executive (Arjun) | major | today-reports | Log outcome 'Not reachable' on a non-call follow-up closes the task and creates no retry | Fixed |
| EXE-2 | Sales Executive (Arjun, Vikram) | major | today-reports | Visits waiting for their outcome are missing from 'Your priorities' | Fixed |
| EXE-7 | Sales Executive (Arjun) | major | properties-matching | Match explanation: React duplicate-key console error when a lead wants 2+ amenities | Fixed |
| EXE-8 | Sales Executive (Arjun, Vikram) | major | appointments-tasks | Visit outcome dialog says 'Keep <stage>' but saving moves the lead to Site visit done | Fixed |
| EXE-3 | Sales Executive (all) | minor | today-reports | Today brief, reason chips and AI answers use 24-hour time ('Call at 15:00') while the rest of the app uses 3:00 PM | Fixed for Today and AI answers; 24-hour time remains in some notification text (known issue) |
| EXE-4 | Sales Executive (Vikram) → seen by Manager | minor | team-settings-notifications-activity | Notification reads 'has not called Vivek Malhotra for 1200 minutes' (raw minutes) | Fixed |
| EXE-5 | Sales Executive (Sneha) | minor | ai-assistants | Paste-and-fill misses the Hinglish 'loan lagega' (home loan needed) | Fixed |
| EXE-6 | Sales Executive (Vikram) → Manager | minor | team-settings-notifications-activity | Bell shows just-created notifications as 'in 4 seconds' (future time) | Fixed |
| EXE-9 | Sales Executive (Arjun) | minor | ai-assistants | 'summarise Divya Menon' as Arjun answers with Arjun's day summary instead of saying the lead isn't his | Fixed |
| EXE-10 | Sales Executive (Vikram) | minor | ai-assistants | Today Ask doesn't understand the Hinglish 'Rohan ka follow-up kal shaam 6 baje karo' | Fixed |
| XAI-8 | Sales Executive (Arjun, Vikram) | major | ai-assistants | On a lead page, a command naming another lead is applied to the open lead | Fixed |
| XAI-9 | Sales Executive (Arjun) | major | ai-assistants | A question asked on a lead page becomes a 'log call' plus 'timeline: Immediate' proposal | Fixed |
| XAI-2 | Sales Manager | major | ai-assistants | 'from 99acres' is read as a 99-acre area requirement (areaMinSqft 3,881,196) | Fixed |
| XAI-1 | All roles | major | ai-assistants | 'create a lead for Sanjay Mehra 99887 76655 …' is not read as a new lead | Fixed |
| XAI-3 | All roles | major | ai-assistants | Name not extracted from 'new enquiry: Meena Pillai, +91 98450 33221, …' | Fixed |
| XAI-4 | All roles | major | ai-assistants | 'which properties suit Ananya Iyer?' ignores the client and lists unrelated inventory | Fixed |
| XAI-5 | All roles | major | ai-assistants | 'what fits Ananya budget?' returns a lead summary instead of properties within budget | Fixed |
| XAI-6 | All roles | major | ai-assistants | 'create task: send brochure to Deepak tomorrow' proposes a WhatsApp share instead of a task | Fixed |
| XAI-7 | All roles | major | ai-assistants | 'add note for Priya: wants east facing' overwrites her facing preference instead of adding a note | Fixed |
| XAI-10 | All roles | major | ai-assistants | Common phrasings of §12.5 questions fall through to 'I didn't understand that yet' | Fixed in round 2 (9 added intent rules + phrasings test) |
| XAI-11 | Admin, Sales Manager | minor | ai-assistants | Admin and Manager 'summarize my sales performance' shows 'Calls 49 of 0' and '0 open leads · conversion 0%' | Fixed |
| XAI-13 | All roles | minor | leads-clients | The lead-score explanation ('Why this score?') has no Demo AI badge | Fixed |
| VIS-1 | Sales Executive (Arjun); also on property pages | major | shell-shared-core | Dark mode: 'highlight' tone chips are unreadable (dark text on dark wash, 1.28:1) | Fixed |
| VIS-2 | Sales Manager (also Admin and Executive dashboards) | minor | ai-assistants | Switching to Tamil leaves AI assistant output and its follow-up chips in English until reload | Fixed in round 2 (answer re-asked when language changes) |
| VIS-3 | Admin, Sales Manager | minor | import | Phone 375: the import wizard card overflows the page by 28px | Fixed (import wizard 0px overflow; client-page part covered by VIS-4) |
| VIS-4 | All roles (seen as Sneha, Vikram and Manager) | minor | leads-clients | Phone 375: client page action row ('Call X' / 'WhatsApp X') overflows by 22–27px | Fixed |
| VIS-5 | Sales Manager (any role in Tamil) | minor | leads-clients | Phone 375 in Tamil: the leads toolbar (sort select and view buttons) overflows by 50px | Fixed |
| VIS-6 | All | minor | shell-shared-core | Toasts appear on top of the floating AI button (bottom-right collision) | Fixed |
| VIS-7 | All | minor | leads-clients | Tablet 768: the leads table scrolls sideways and cuts columns mid-cell instead of showing key columns only | Fixed for leads and clients tables; Today Team snapshot part not done (known issue) |
| VIS-8 | All | minor | appointments-tasks | Appointment cards show no focus ring when tabbed to (underline only) | Fixed |
| VIS-9 | All (seen as Manager) | minor | pipeline | Untranslated English in Tamil mode: pipeline assistant examples and Today quick-command placeholder | Fixed |
| VIS-10 | QA / developers | major | shell-shared-core | Dev server reloads every open page when anyone writes under notes/ (Playwright traces), making e2e flaky | Fixed |
| VIS-11 | All (seen as Arjun) | minor | leads-clients | Lead page tab strip is cut off at 1440 (last tab shows 'As…') | Fixed |
| VIS-12 | Admin, Manager | minor | pipeline | Pipeline 'Stage conversion' row cut at the right edge at 1440 (Booked card truncated, Won not reachable visibly) | Fixed |
| VIS-13 | Sales Executive | minor | today-reports | Progress bars show a filled stub for a value of 0 ('Bookings 0 of 3') | Fixed |
| VIS-14 | Sales Executive | minor | today-reports | Executive on /reports/team: the breadcrumb says 'Team' but the Overview tab and content are shown | Fixed |
| VIS-15 | All | minor | leads-clients | Leads filter toolbar wraps into an awkward centred 3-row block at 1440 | Fixed |
| MGR-1 | Sales Manager | major | today-reports | Unassigned queue: per-row suggestion assumes the rows above were assigned first, so 'Lowest workload' can be false | Fixed |
| MGR-2 | Sales Manager | minor | today-reports | Accepting the AI-suggested owner in the queue is recorded as 'Assigned by hand' with no reason | Fixed |
| MGR-3 | Sales Manager | minor | team-settings-notifications-activity | Single assign / reassign has no Undo (queue Assign and the assign dialog for one lead) | Fixed |
| MGR-4 | Sales Manager | minor | leads-clients | Leads list keeps the bulk selection after a bulk assign | Fixed |
| MGR-5 | Sales Manager | minor | import | Import Done step claims 'Auto-assigned … each executive got one notification' when auto-distribution is off | Fixed |
| MGR-6 | Sales Manager | minor | team-settings-notifications-activity | Executive's reassignment request: the manager never sees the reason, and it is not on Manager Today | Fixed |
| MGR-7 | Sales Manager | minor | ai-assistants | AI says 'Bulk import isn't available for your role' to a manager, who can bulk-import leads | Fixed |
| MGR-8 | Sales Manager | minor | ai-assistants | 'Who is overloaded today?' calls every executive overloaded, including the lightest one; '1 visits today' | Fixed |
| MGR-9 | Sales Manager | minor | today-reports | Needs attention shows 'Reassign' for a lead that is still unassigned | Fixed |
| MGR-10 | Sales Manager | minor | leads-clients | Leads 'Unassigned' KPI says '5' with '6 past the first-call SLA' underneath | Fixed |
| MGR-11 | Sales Manager | minor | team-settings-notifications-activity | Manager notifications: escalation shows '1200 minutes'; the 'unassigned leads waiting' alert opens nothing | Fixed |

## 3. Known issues (minor, deferred by owner decision)

Nearly all round-1 minors were fixed anyway. What remains open:

- EXE-3 (minor): the shared clockTime in src/lib/dates.ts is still 24-hour and is used in notification text (services/automation.ts, services/core/effects.ts). Today and AI answers show 3:00 PM style.
- VIS-7 (minor): the Today Team snapshot at tablet width was not changed.
- ADM-3 (minor, cleanup): the batched hand-over notification is done in users.ts; batching in effects.ts (onLeadAssigned) would be cleaner.
- Design decision pending: DESIGN_SYSTEM.md line 1071 says the lead page has three zones from xl (1280); the VIS-11 fix starts them at 2xl (1536). The doc was not updated.
- Lint reports warnings only (react-refresh only-export-components, no-empty-pattern), no errors.
- Running several Playwright processes at once shares test-results/ and can cause ENOENT trace errors and browser launch failures. Use a private --output directory per runner.

## 4. Round 2 results

All round-2 journeys passed. No new bugs were found in any role.

- **Admin (R2 Admin main journey, qa-admin.spec.ts): PASS, 58s, clean console.** Redistribute one-click fix, add user, deactivate with auto hand-over, auto-assign toggle, rename pipeline stage, leads template download and sample CSV import (12 rows, row 10 fixed inline), reports and activity log, reset demo data. ADM-5, ADM-7 and VIS-1 re-checked: fixed.
- **Manager (R2 manager main journey, qa-manager.spec.ts): PASS, 1.1 min.** Unassigned queue with reasons, per-row assign (lowest workload label true), auto-assign all (skips the executive on leave), reassign with notifications, pipeline drag and booking dialog, team report scope, blocked actions, 7 assistant phrasings understood. MGR-1 and XAI-10 re-checked: fixed. XAI-8 was not re-tested directly in this journey.
- **Executive (R2: Arjun drives the assistant plus existing journeys, qa-executive.spec.ts): PASS, 27 of 27 tests in the file.** Ranked Today, data isolation across Arjun/Sneha/Vikram, paste-and-fill lead add, lead page actions, visit outcome, matching both ways, assistant create lead / task / note / match, refusals for delete and assign. EXE-1, EXE-2, EXE-7, EXE-8, XAI-1, XAI-4, XAI-6, XAI-7 re-checked: fixed. XAI-2, XAI-3, XAI-5 and XAI-9 were covered only by qa-cross.spec.ts and were not re-run in this round's journey.

Round-2 fixes: ADM-5 (profile picker), VIS-2 (Tamil insights), XAI-10 (intent rules), the Today visit-outcome item now follows the lead's current owner (integration.spec.ts:247).

Test changes (none weakened):
- qa-executive.spec.ts:113 order array now includes visitOutcome (EXE-2 added this priority kind).
- qa-visual.spec.ts: /reports/team is not walked for executives (they are deliberately redirected); role defaults to executive when the session store is empty.
- qa-admin.spec.ts:105: Undo click uses .first() (front toast) because redistribute is now undoable too.

## 5. Final verification

- pnpm verify (typecheck, lint, test, build) was green before the last e2e test fixes. pnpm test: 54 files, 785 tests passed in the fix runs. After the last test-only edits, only typecheck and lint were re-run: typecheck clean, lint warnings only.
- Full e2e run, once (--workers=4, default config build+preview, 24.7 min): 224 tests, 220 passed, 4 failed, 0 flaky. All 4 failures were desktop; the phone project had none. Log: notes/e2e-final.log (raw: notes/e2e-final-run1.log).
- The 4 failures (3 arjun route walks in qa-visual, qa-admin one-click test) were test defects, fixed as above. The 5 affected tests (4 arjun walks plus the admin test) were re-run alone and passed 5 of 5. The full suite was not run a second time, so "224 of 224 passed" is derived (220 + the re-run tests), not observed in one run.
- One earlier run of integration.spec.ts:247 reported a failure whose cause was not captured; the next two runs passed.
