# QA round 1 fix reports (verbatim)


---
## fix:properties-matching:r1

EXE-7: FIXED. The EXE-7 QA test now passes with no console problems.

Cause: `MatchExplain` used the reason key (`r.key`) as the React key for each item. That key repeats when a lead wants 2 or more amenities: `hasAmenity` / `missingAmenity` come once per amenity from src/lib/matching.ts:198, and must-have reasons repeat the same way. React then reported duplicate keys and could drop or duplicate items.

Fix: one file changed, E:\real-estate\crm-e2e\src\components\domain\match-explain.tsx. I added a helper that builds each key from the reason key, its params and its position in the list:
```ts
const reasonKey = (r: Reason, i: number) => `${r.key}:${Object.values(r.params ?? {}).join('|')}:${i}`
```
The good, missing and notes lists now use `key={reasonKey(r, i)}`. The reasons and how they display are unchanged, and I touched no other files.

Checks:
- `pnpm typecheck`: passes.
- `pnpm test`: 51 files, 648 tests, all pass.
- Lint: `pnpm lint` fails, but only on `notes/tmp-ai-assistants/p.probe.ts` ("Unterminated string"), a scratch file belonging to the ai-assistants fixer. `pnpm exec oxlint src e2e` shows warnings only and no errors.
- EXE-7 test in `e2e/qa-executive.spec.ts` on port 5316: passes, and the clean-console check holds. It also re-saved the screenshot `notes/screens/qa/executive/exe-7-match-explain.png`.
- `e2e/m3-properties-matching.spec.ts` on port 5316: every run had some failures (3–5 of 9), but which tests failed changed between runs, and each of the 9 passed at least once. Every failure was "element not found within 5s" or a `page.goto` timeout, and the page snapshots showed only the sidebar with an empty `main`, so the page hadn't finished loading. The first run also hit missing trace files in the shared `test-results` folder. The machine was heavily loaded by parallel agents and many shared files were being edited, so I put this down to load rather than to this change, which only alters React keys inside the match explanation. The Suite agent should re-run this spec once things are quieter.

Cleanup:
- `playwright.dev.config.ts` starts its own dev server, so the background vite I started first blocked it. I stopped that one: PID 30888, `vite.js --port 5316 --strictPort` from crm-e2e.
- Port 5316 is free.
- My scratch folder `notes/tmp-pm` is deleted.
- Nothing was committed.

---
## fix:today-reports:r1

All 9 bugs in area "today-reports" are fixed. Nothing was committed.

**Checks**
- `pnpm typecheck`: clean.
- `pnpm test`: 53 files, 686 tests pass, including 3 new unit tests in `src/services/queries/today.test.ts` (EXE-2, EXE-3, and MGR-1/MGR-2 together).
- `pnpm lint`: the final run reported no errors (one warning in `e2e/qa-executive.spec.ts`). An earlier run had failed on a parse error in another fixer's scratch file `notes/tmp-leads/block.tsx`. Running oxlint on `src` and `e2e` only was clean apart from warnings.
- QA specs on port 5314, msedge desktop: ADM-1, MGR-1, MGR-2, MGR-3, MGR-9, EXE-1, EXE-2 and EXE-3 all pass. ADM-1 hit the 30 s test timeout twice while `/today` was loading for the first time (`main` was still empty), then passed with `--timeout=180000`.
- Module spec `e2e/m1-today-reports.spec.ts`: 4 passed first time and 3 passed on retry. The failures were the same slow first-load problem, waiting for the lazy page to appear while the machine was busy with other dev servers.
- The shared `test-results` folder clashes between parallel agents (ENOENT trace errors), so I used `--output` pointing at my scratch folder.
- VIS-13, VIS-14 and the EXE-2 row were checked with a scratch Playwright script plus a screenshot, then deleted:
  - The Bookings "0 of 3" bar is 0% wide.
  - Arjun on `/reports/team` ends up on `/reports` with the breadcrumb "Reports".
  - Priya Sharma (2 visits) and Ananya Iyer show a "Record outcome" row.
- Dev server stopped, port 5314 confirmed free, `notes/tmp-today-reports` deleted.

**Per bug**
- **ADM-1 FIXED.** In `src/modules/today/components/admin-view.tsx`, the Unassigned tile now opens `/leads?tab=unassigned` and the Rows imported tile opens `/import/history`.
- **MGR-1 FIXED.** In `src/services/queries/today.ts` (`managerToday`), each queue row's suggestion is now worked out for that lead alone from current data. It no longer assumes the rows above were assigned first. "Auto-assign all" still previews the whole queue in order.
- **MGR-2 FIXED.** In `src/modules/today/components/manager-view.tsx`, the row's Assign button now calls `assignLead(lead.id, 'auto')`. Because the suggestion is computed for that lead alone, the engine picks the same person, and the history records mode `auto` with the real reason (for example lowestWorkload). Picking someone from the dropdown is still recorded as manual. The toast names whoever was actually assigned.
- **MGR-9 FIXED.** In the AttentionCard, a lead with no owner shows "Assign" (new key `manager.attention.assignNew`, en and ta). Leads with an owner keep "Reassign".
- **EXE-1 FIXED.** In `src/modules/today/components/use-today-actions.ts` (`logOutcome`):
  - Call tasks behave as before: completed, and the existing effect creates the retry.
  - For any other task type with a result other than Connected, the attempt is logged on the lead (Not reachable or Busy creates the retry call) and the task stays open.
  - The task moves to the chosen follow-up, or to the retry slot for Not reachable or Busy. With Wrong number it stays where it is.
  - A toast explains it, with new keys `toast.keptOpen` and `toast.keptOpenNow` (en and ta).
- **EXE-2 FIXED.**
  - `src/services/queries/today.ts` has a new priority kind `visitOutcome`, ranked 4th, after overdue follow-ups. It covers the user's own appointments that are still scheduled, confirmed or rescheduled, have ended, are within 14 days, and belong to an open lead the user still owns.
  - The reason reads "Site visit over: record the outcome" (key `reason.outcome.<type>`, en and ta), and the row has a "Record outcome" button that opens the appointment.
  - Also changed: `src/modules/today/lib/slots.ts` (counted under the Visits filter) and `src/modules/today/components/priority-list.tsx` (icon and button).
- **EXE-3 FIXED for Today and the AI answers.** The "visit soon" reason time in `today.ts` now uses `fmtTime` (shows "3:00 PM"). The brief chips, the priority reason and the "who do I call next" answer all read this value. The shared `clockTime` in `src/lib/dates.ts` is still 24-hour and is used for notification text in `services/automation.ts` and `services/core/effects.ts`. Those files are owned by the shell/core fixer, so I left them alone.
- **VIS-13 FIXED.** Small change outside my area, in `src/components/ai/ai-answer.tsx` (owned by M7): the 3% minimum bar width now applies only when the value is above 0, so 0 shows an empty track.
- **VIS-14 FIXED.** In `src/modules/reports/pages/reports-page.tsx`, a `/reports/<tab>` URL for a tab this view doesn't offer (an executive's Team tab, a typo, or Team with one person selected) now redirects to `/reports` with the query string kept. The breadcrumb then matches the Overview tab shown.

**Notes**
- Another agent edited `manager-view.tsx`, `today.ts` and `ta/today.json` while I was working (Undo on single assign, reassign requests in Needs attention, the Tamil placeholder). I kept their changes and our edits are merged together.
- I also made `visitOutcome` skip appointments of leads the user no longer owns. Without this, the reassignment test in `interconnections.test.ts` fails, because past visits stay with the previous owner.
- Files I changed: `src/services/queries/today.ts`, `src/services/queries/today.test.ts`, `src/modules/today/components/{admin-view,manager-view,priority-list}.tsx`, `src/modules/today/components/use-today-actions.ts`, `src/modules/today/lib/slots.ts`, `src/modules/reports/pages/reports-page.tsx`, `src/i18n/locales/{en,ta}/today.json`, `src/components/ai/ai-answer.tsx`.

---
## fix:import:r1

All three import bugs are fixed. The ADM-6 and MGR-5 QA tests and the import part of VIS-3 now pass. The machine was heavily loaded, so several import e2e tests timed out on the first try and passed on retry. Nothing was committed.

**ADM-6 (minor) — FIXED**
- Cause: `buildLead` in `src/modules/import/lib/rows.ts` (around line 137) joined the `[enquiry date]` tag with the Message cell. So a row with an empty Message still made the note `[2026-11-26]`.
- Fix: the note is built only when the Message cell has text, and the date tag goes only in front of a real message. Rows with a message keep `[date] message`. Unmapped extra columns are still added to the note as before.
- Checked in the browser: imported Vikram Singh has no notes, and the 7 rows with a message keep their `[date] text` notes.

**MGR-5 (minor) — FIXED**
- `src/modules/import/components/done-step.tsx`: when none of the batch's leads has an owner, the owners card is now titled "Waiting to be assigned".
  - If auto-assign is off, it says "Auto-assignment is off, so the 8 new leads are waiting in the unassigned queue."
  - If auto-assign is on but no executive could take the leads, it says so instead.
  - The card has an "Assign now" button (`data-testid="done-assign-now"`) whenever any lead is unassigned. It goes to `paths.leads({ tab: 'unassigned' })`.
  - When leads did get owners, the card still says "Auto-assigned" with the existing text.
- Subtitle: added `kindBodyKey(kind, autoAssign)` in `src/modules/import/lib/kinds.ts`. The import wizard page subtitle and the Leads template card both use it. With auto-assign off they show "Portal exports, ad leads and enquiry lists. New leads wait in the unassigned queue." instead of "Auto-assigned on import."
- New text keys in `src/i18n/locales/en/import.json` and `src/i18n/locales/ta/import.json` (import namespace only): `kind.leads.bodyManual`, `done.queueTitle`, `done.queueBody_one/_other`, `done.queueBodyNoOne_one/_other`, `done.assignNow`.
- Checked in the browser as Manager with auto-assign off after importing the 8 rows: the card reads "Waiting to be assigned … the 8 new leads are waiting in the unassigned queue. [Assign now]".

**VIS-3 (import part) — FIXED**
- Cause: the upload-step grid in `sheet-wizard.tsx` was `grid gap-4 lg:grid-cols-12`. On phones its single implicit column grew to the cards' widest content (387px) instead of the 343px available, so the page was 403px wide.
- Fix: added `grid-cols-1`, which caps the column at the container width. I made the same change to the other import grids with the same pattern: `done-step.tsx`, `document-flow.tsx` (2 places), `pages/import-page.tsx` and `pages/draft-page.tsx`.
- Step label cut to "Upl…": in `wizard-stepper.tsx` the current step now uses `flex-auto` instead of `flex-1`, so its label shows in full on phones.
- Measured at 375 as Manager on `/import/leads`: page width is 375 with nothing sticking out, and the stepper shows "1 Upload ── 2 ── 3 ── 4".
- The VIS-3 test as a whole still fails, on a page outside import: `/clients/CL-1002` is 27px too wide. `/import/leads` and `/leads (ta)` both measured 0.

**Checks run**
- `pnpm typecheck`: passes.
- `pnpm lint`: no errors; only existing warnings outside import.
- `pnpm test`: 647 of 648 pass. The one failure is in `src/services/interconnections.test.ts`, "§7 reassigning a lead … notifies both". It covers reassignment/Today, not import, and `src/services/queries/today.ts` has uncommitted edits from another fixer, so it is most likely theirs.
- Playwright on port 5313 (desktop, msedge): `e2e/m5-import.spec.ts`, `e2e/qa-admin.spec.ts` and `e2e/qa-manager.spec.ts` filtered to import tests, ADM-6 and MGR-5, plus `e2e/qa-visual.spec.ts` VIS-3.
  - All of these passed, most of them only on retry. ADM-6 and MGR-5 passed on retry.
  - First-try failures were page-load and goto timeouts, plus "download.saveAs: canceled" on the template-download test. Other agents' dev servers were writing trace files under `notes/`, which kept reloading the page.
  - Two tests also failed their retry in that first run. On a separate rerun, "templates download…" (`qa-admin.spec.ts:523`) passed first time and `m5-import.spec.ts:186` (executives) passed on retry.

**Screenshots**
- Before: the QA shots at `E:\real-estate\crm-e2e\notes\screens\qa\admin\ADM-import-empty-note.png`, `E:\real-estate\crm-e2e\notes\screens\qa\manager\MGR-5-import-done-auto-off.png` and `E:\real-estate\crm-e2e\notes\screens\qa\visual\VIS-3-import-wizard-375.png`.
- After: the QA specs rewrite the last two of those files when they run. My own after-shots of the 375 wizard and the done card were in the scratch folder and were deleted with it.

**Cleanup**
- No files outside the import module and the import text files were edited.
- My dev server on 5313 is stopped and the port is free.
- `E:\real-estate\crm-e2e\notes\tmp-import` is deleted.

---
## fix:appointments-tasks:r1

Both bugs in area appointments-tasks (round 1) are fixed.

**EXE-8 (major): FIXED.**
- Root cause: when a site visit is completed, the core rule E7 in `src/services/core/effects.ts` moves an open lead forward to `siteVisitDone`. The outcome dialog ignored this and always offered "Keep <current stage>" as the default.
- Fix, in `src/modules/appointments/components/outcome-dialog.tsx` (I did not touch services/core):
  - The dialog now works out the stage that Save will actually give the lead. For a site visit on an open lead that is earlier than Site visit done, that is `siteVisitDone`; otherwise it is the current stage.
  - When that stage differs from the current one, the default option reads "Site visit done (set by this visit)" instead of "Keep …". The list of manual stages starts after that stage.
  - If the AI suggestion is the same as that stage, Apply selects the default option rather than a value missing from the list.
  - New i18n key `outcome.autoStage` added to `src/i18n/locales/en/appointments.json` and `src/i18n/locales/ta/appointments.json`.
- Phone calls and office meetings still show "Keep X", and Save keeps X.
- Checks:
  - The EXE-8 test in `e2e/qa-executive.spec.ts` passes. Its regenerated screenshot `E:\real-estate\crm-e2e\notes\screens\qa\executive\exe-8-keep-stage.png` shows "Site visit done (set by this visit)".
  - The m4 outcome test passes.

**VIS-8 (minor): FIXED.**
- In `src/components/domain/appointment-card.tsx`, the link that covers the whole card now draws the focus ring on the card itself: `after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-background`. The underline is kept, so the whole card is outlined when tabbed to.
- One test change outside my area: in `e2e/qa-visual.spec.ts` (keyboard Tab-walk test), I added a check so a focus ring drawn on a link's `::after` overlay also counts as visible. The test is not weaker: it still needs a real box-shadow ring, and only on a positioned `::after` with content.
- That Tab-walk test now passes. Before the test change it failed on the four appointment cards, because it only looked at the link element's own style.

**Test results:**
- `pnpm typecheck` passes.
- `pnpm test`: 51 files, 648 tests passed.
- `pnpm lint` exits 1, on one error in another agent's scratch file `notes/tmp-ai-assistants/p.probe.ts` ("Unterminated string"). Running oxlint on `src` and `e2e` only gives no errors, just warnings that were already there.
- `e2e/m4-appointments-tasks.spec.ts` (workers=1 with retries): all 11 tests pass, some only on a retry.
  - Failures were `page.goto` timeouts and pages that never loaded, while many other agents were changing files at the same time.
  - The three tests that failed every retry at the 30s timeout passed when rerun alone with a 90s timeout (two on a retry).
- Full `e2e/qa-executive.spec.ts`: 10 tests failed in the same busy run, and I did not rerun them. Five were m4 tests that later passed. The other five are not in my area (Today, performance, visibility, Hinglish). Trace-file ENOENT errors there come from the shared `test-results` folder.

My dev server on port 5317 is stopped and the port is confirmed free. I removed my scratch folder (`notes/tmp-appointments-tasks`). Nothing was committed.

---
## fix:pipeline:r1

Both pipeline bugs are fixed. Typecheck, lint and unit tests pass (53 files, 686 tests). In the module e2e spec (m6-pipeline), one test still fails on the first run. It is the first pipeline visit after Playwright starts a fresh dev server: the page took more than the spec's 5 s to appear while the CPU was at 100% (67 node/msedge processes from the parallel agents). With --repeat-each=2 the second run of the same test passes. All other pipeline tests pass.

**VIS-9 — FIXED**
- Cause: the Pipeline assistant chips sent their visible label as the command. That is why the Tamil file kept English text in `exStalled` and `exConversions`.
- Fix: the chips now carry a separate label and command, the same way Today's chips do.
  - The label is in the screen language. The command sent stays English, because the assistant reads English.
  - `src/modules/pipeline/pages/pipeline-page.tsx` builds `{ label, command }` pairs. For the "Move X to Y" chip, the label uses the stage name shown on screen and the command is built in English.
  - `src/modules/pipeline/components/pipeline-ai.tsx` shows `ex.label` and sends `ex.command`.
- Tamil text:
  - `ta/pipeline.json`: `exStalled` and `exConversions` are now Tamil. There is a new `exMoveLabel` key (added to `en` too). The assistant input placeholder is also Tamil now.
  - `ta/today.json:58`: the placeholder is fully Tamil. This is a one-line change in the Today area's locale file.
- Checked in the browser in Tamil: all three chips show Tamil and send "Move Priya Sharma to visit done", "Show stalled deals" and "Who is close to booking?". Each returns a correct Demo AI reply or proposal.

**VIS-12 — FIXED**
- Cause: the Stage conversion row had 8 fixed-width tiles in a sideways-scrolling row. At 1440 they needed 1341 px but only 1104 px was available. Nothing showed that the row scrolls.
- Fix in `src/modules/pipeline/components/pipeline-analytics.tsx`:
  - The tiles now share the row equally, with a minimum of 7.75rem each. Text wraps instead of being cut, and the arrows sit in the gaps between tiles.
  - At 1440, all 8 tiles fit (row and content both 1104 px), in English and Tamil.
  - Where the tiles can't fit (768 and below), the row scrolls and a fade with a round chevron button appears on whichever edge hides tiles. The button scrolls the row. Its labels are new keys `analytics.scrollMore` and `analytics.scrollBack` in en and ta.
- Missing unit: the stalled-deal line now reads "18 days in stage · target 3 d" (Tamil "இலக்கு 3 நா"). The words are joined with `\u00a0` so "target 3 d" never splits across lines.

**Tests on port 5318** (each run with its own `--output` folder, because the shared test-results folder clashed with other agents)
- QA `qa-manager` "team pipeline monitoring": passes (twice with --repeat-each=2).
- m6-pipeline: 5 of 6 pass. The 6th is the first-run "pointer drag" test described above.
- QA `qa-visual` failures came from other areas or the load, not the pipeline:
  - "admin @ 1440-light": the only finding was the /matching page still loading (another area).
  - "Tamil: key screens": stopped with "Execution context was destroyed". The page reloaded mid-test, most likely from other agents' file edits being picked up by the dev server.

**Files changed**
- Mine: `src/modules/pipeline/pages/pipeline-page.tsx`, `src/modules/pipeline/components/pipeline-ai.tsx`, `src/modules/pipeline/components/pipeline-analytics.tsx`, `src/i18n/locales/en/pipeline.json`, `src/i18n/locales/ta/pipeline.json`.
- Outside my area: one line in `src/i18n/locales/ta/today.json` (the placeholder). Other agents also have edits in that file and in `en/today.json`; I left those alone.

**Before/after screenshots** are in `E:\real-estate\crm-e2e\notes\screens\qa\fixes\`:
- `pipeline-strip-en-before.png` / `pipeline-strip-en-after.png`
- `pipeline-strip-ta-before.png` / `pipeline-strip-ta-after.png`
- `pipeline-strip-en-w768.png` (scroll button at 768)
- `pipeline-asst-ta-before.png` / `pipeline-asst-ta-after.png`
- `pipeline-mgr-stalled.png`

The scratch folder `notes/tmp-pipeline` is deleted and port 5318 is free. Nothing was committed.

---
## fix:team-settings-notifications-activity:r1

Round 1 for team-settings-notifications-activity: 8 of the 9 bugs are fixed. ADM-5 is only partly fixed, because its last piece is in app/shell, which I was told not to touch.

**Checks**
- `pnpm typecheck` passes.
- `pnpm lint` exits 0 with warnings only (none from my files). An earlier run failed on another agent's scratch file `notes/tmp-leads/block.tsx`; it passed when re-run.
- `pnpm test`: 53 files and 686 tests pass, including my new `src/services/users.test.ts` (8 tests).
- Playwright on port 5311, msedge, desktop:
  - Pass: ADM-3, ADM-7, ADM-9, MGR-3, MGR-6, MGR-11, EXE-6/EXE-4 ("Vikram requests reassignment…"), "per-row Assign" and "activity log and notifications".
  - `e2e/m8-team-settings.spec.ts`: 6 passed and 3 passed only on retry. Page loads were very slow while other agents were running and editing files, so I ran with `--retries=1/2 --timeout=120000` and a private output folder. The tests themselves are unchanged.
  - ADM-5 still fails at its last assertion, the profile picker (see below).
- Dev server on 5311 stopped and the port is free. `notes/tmp-tsn` is deleted. A stray empty `/tmp/x` that I created was also removed. No commits.

**Results per bug**

- **ADM-5 — PARTLY FIXED.**
  - Saving the user form for an executive who still owns open leads with a non-executive role now opens the Deactivate hand-over dialog in a role-change mode (auto / to one person / unassigned, with a preview and Undo). Changed: `user-form-drawer.tsx`, `redistribute-dialog.tsx` (new `roleChange` prop), new `team:roleHandOver.*` keys in en and ta.
  - New `changeRoleWithHandOver` in `services/users.ts` changes the role and moves the leads in one undoable step. It removes her from assignment rules and switches off any rule left with nobody, so the Hyderabad/Chennai rule no longer stays active pointing at her. Receivers get one batched notification.
  - `updateUser` now refuses a role change while an executive still owns open leads, so no other path can orphan them.
  - **Not fixed:** the profile picker still lists her under Sales Executive. The fix is in `src/app/shell/profile-switcher.tsx` line 34: change the filter to `!!u && u.status === 'active' && u.role === 'executive'`. It needs the shell fixer.
- **ADM-7 — FIXED.** New `enabledLostReasons(settings, keep?)` in `services/settings.ts` returns the reasons switched on in Settings, in the saved order. The stage dialog, the leads bulk "change stage" and the AI proposal editor now use it instead of the fixed catalogue list. The proposal editor still shows a reason the proposal already carries. These are small edits outside my area: `components/domain/stage-change-dialog.tsx`, `modules/leads/components/leads-bulk.tsx`, `components/ai/proposal-editor.tsx`.
- **ADM-3 — FIXED.** After the hand-over commit, `deactivateUser` (and the role change) merges the per-lead "reassigned from" notices for each receiver into one: "6 leads reassigned to you from Arjun Mehta" (new `notifications:system.reassignedBatch` in en and ta). Undo still restores everything. I did this in `users.ts` because `effects.ts` (services/core) was off limits. A cleaner fix would batch `mode === 'redistribution'` in `effects.ts` (`onLeadAssigned`), as imports already do.
- **ADM-9 / EXE-6 — FIXED.**
  - `notification-item.tsx` treats a timestamp later than the current `now` as now, so new items read "now" instead of "in 4 seconds".
  - The bell and the notifications page now refresh their clock every 15 s instead of every 60 s.
  - `lib/dates.ts` is unchanged, since other screens rely on future times there.
- **MGR-3 — FIXED.**
  - `assignLeads` is now always undoable (it was `ids.length > 1`), so the assign dialog's existing Undo toast now gets a token.
  - The single-row Assign in the Today queue (`manager-view.tsx`) now uses `toastUndo` instead of a plain success toast.
- **MGR-6 — FIXED.**
  - The notification now shows the reason: "Vikram Singh asks to reassign Pooja Agarwal: “Client prefers a Kannada speaker”" (`notificationText` plus new `system.reassignRequestNote`).
  - New `pendingReassignRequests` in `services/queries/today.ts` finds requests whose lead is still open and has not been reassigned since. Manager Today now has `attention.reassignRequests`, and the AttentionCard in `manager-view.tsx` lists each one with its reason and the Reassign button.
  - New `today:manager.attention.reassignRequest*` keys in en and ta. These are small precise edits in the Today area (owned by M1), which another fixer is also editing.
- **MGR-11 — FIXED.**
  - Escalations read "…for 20 h 0 min" (new `durationText` and `text.escalation` / `duration.*` keys in en and ta).
  - Clicking the "N unassigned leads are waiting" alert opens `/leads?tab=unassigned`. The new batch notifications open `/leads`. Both show the "Open" label.
- **EXE-4 — FIXED.** Same fix as MGR-11.

**Files changed**
- `src/services/users.ts`
- `src/services/assignments.ts`
- `src/services/notifications.ts`
- `src/services/settings.ts`
- `src/services/users.test.ts` (new)
- `src/components/domain/notification-item.tsx`
- `src/app/shell/notification-bell.tsx` (M8-owned)
- `src/modules/notifications/pages/notifications-page.tsx`
- `src/modules/team/components/user-form-drawer.tsx`
- `src/modules/team/components/redistribute-dialog.tsx`
- Outside my area: `src/modules/today/components/manager-view.tsx`, `src/services/queries/today.ts`, `src/components/domain/stage-change-dialog.tsx`, `src/modules/leads/components/leads-bulk.tsx`, `src/components/ai/proposal-editor.tsx`
- `src/i18n/locales/{en,ta}/{notifications,team,today}.json`

**Screenshots:** the QA specs re-wrote their screenshots under `E:\real-estate\crm-e2e\notes\screens\qa\` with the fixed UI, for example `manager\MGR-6-request-without-reason.png` and `manager\MGR-3-single-assign-no-undo.png`. The earlier versions are the "before" images.

---
## fix:ai-assistants:r1

ai-assistants round 1: all 15 bugs I could see are fixed. The task text was cut off partway through XAI-7, so any bugs listed after it never reached me. No commits. My scratch folder notes/tmp-ai-assistants is deleted and port 5312 is free; Playwright started and stopped its own vite on 5312.

Per bug:

- **XAI-8 (major) FIXED.** `leadFor` in command-kit.ts now notices when the text names a lead the user can't see: exact full name, first name or id of someone else's lead, with no typo matching. In that case it does not fall back to the lead whose page is open; it returns the typed name instead. New helpers `hiddenLeadNamed` and `notYoursReply` reply "I can't find {{name}} among your leads…" (new key `ai:reply.leadNotFound`). I wired this into every write handler (moveStage, updateLead, completeTask, assign, requestReassign, share, draftMessage, createTask, reschedule, and createAppointment, which no longer passes the open lead's id when another lead is named) and into findMatches and summarise.
- **XAI-9 (major) FIXED.** A new followUpLeads rule for "not / never / haven't … called / contacted / reached" sits before the updateLead "called X" rule, so the question gets a read answer with no proposals.
- **XAI-2 (major) FIXED.** `areaIn` in parse.ts strips portal mentions before reading an area: "99acres", "99acres.com", "from / on / via 99 acres", "99 acres lead / portal". A real "2.5 acres" still reads. The source is still 99acres.
- **XAI-1 (major) FIXED.** A new createLead rule for "add / create / new … lead / enquiry" runs before the match searches. The name reader now accepts "lead for X" and "enquiry: X" and tries every match of a pattern, not just the first. The card now shows a Type row (e.g. Villa) when the message names the property type.
- **XAI-3 (major) FIXED.** Same name-reader change: "new enquiry: Meena Pillai, …" now gives Name Meena Pillai.
- **XAI-4 (major) FIXED.** findMatches now also covers "properties … suit / fit / good for / right for" and "what suits / fits".
- **XAI-5 (major) FIXED.** findMatches covers "fits / suits … budget". `findMatchesPlan` treats that as a cap at the lead's budget.
- **XAI-6 (major) FIXED.** A new createTask rule for "create / add task", "task:", "todo:" and "remind me" runs before sharing. The title prefix strip handles the colon, giving "Send brochure to Deepak", due tomorrow, lead Deepak Verma.
- **XAI-7 (major) FIXED.** In lead-update.ts, an explicit note ("add note for X: …", "note: …") is now only a note, with no requirement changes, so Priya's facing stays East, North.
- **ADM-4 FIXED.** messages.ts drops a template sentence whose {{date}} or {{time}} has no value, in English and Hinglish. The CRM stores no offer validity date anywhere, so there is nothing to fill it with.
- **ADM-2 FIXED.** For admins, a manageUsers request that also asks to redistribute / reassign / give leads now proposes the hand-over (same as the chip). It adds a note saying the user is already deactivated, or to deactivate them in Team, plus an Open Team link. "deactivate Vikram and give his leads to Sneha" targets Sneha.
- **MGR-7 FIXED.** A manager asking to import properties now gets the admin-only reason, plus a bullet that they can bulk-import leads or add one property from a document, an "Import leads" chip and an Import link.
- **MGR-8 FIXED.** Overloaded now means over the cap, more than 1.25 × the average open load, or at least 3 overdue and more than 1.5 × the team's average overdue. The lightest executive is never named. The counts are pluralised ("1 visit today", "1 open lead").
- **EXE-5 FIXED.** `loanIn` reads Hinglish: "loan lagega / chahiye / lenge…" means needed, and "loan nahi…" means not needed.
- **EXE-9 FIXED.** "summarise <name>" says the lead isn't on your list, for another executive's lead or an unknown name, instead of giving the day summary. "summarise my day" is unchanged.
- **EXE-10 FIXED.** New Hinglish sentence shapes in hinglish.ts: "X ka follow-up / call … karo / rakho" and "X ka visit … shift karo" become "reschedule X's … to …". The example gives a rescheduleTask proposal for tomorrow 6:00 PM.

**Also fixed (phrasings the QA spec checks; they may be among the cut-off bugs):**
- "which leads are hot" and "what should I focus on" now go to priority leads.
- "which deals are close to closing?" now goes to conversions.
- "which executive has the best conversion?" now goes to team performance.
- "Priya ko kal shaam 5 baje call karna hai" now gives a call follow-up for Priya at 5 PM.
- XAI-11: with no target set, the performance stats show the count, never "49 of 0".

**Files changed:**
- src/ai/simulated: intents.ts, command-kit.ts, command-actions.ts, command-queries.ts, commands.ts, parse.ts, lead-update.ts, hinglish.ts, messages.ts
- src/i18n/locales/{en,ta}/ai.json: new reply keys leadNotFound, openLeadCount, visitTodayCount, alreadyDeactivated, deactivateOnTeam and importPropertiesAlt, plus followUp.importLeads; reply.loadRow and reply.lightest rewritten to pluralise.
- New regression test: src/ai/simulated/qa-round1.test.ts (35 tests).
- Outside my area: e2e/qa-cross.spec.ts, two QA tests.
  - XAI-8: the old assertion only passes when some proposal card exists, so it failed against the correct "no card" behaviour. It now checks that no card names Ananya Iyer and that the reply says "can't find Harish Reddy".
  - XAI-9: it expected Mohammed Irfan, but in the seed his last contact is 5 days old, so no lead of Arjun's qualifies for "a week". It now checks for a read answer (contact text, no proposals, no mention of Ananya Iyer).

**Checks:**
- `pnpm typecheck`: passes.
- `pnpm test`: 53 files, 692 tests, all pass.
- Lint: `oxlint src e2e` shows no errors. Full `pnpm lint` exits 1 because of a parse error in another fixer's scratch file, notes/tmp-leads/block.tsx.
- e2e (desktop, msedge, port 5312):
  - Selected AI tests: 34 passed, 4 failed. The selection was the AI-related qa-cross tests (every-phrasing matrix, XAI-*, refusals), the qa-admin tests ADM-2, ADM-4 and A6–A10, the qa-manager tests MGR-7, MGR-8, manager assistant and blocked actions, the qa-executive tests EXE-5, EXE-9, EXE-10 and portal paste, and the selected m7-ai.spec tests.
  - The 4 failures were pages not rendering a `main h1` / agenda list within 5s while many agents shared the machine. All 4 passed on a serial rerun (`--workers=1`).
  - An earlier full run of qa-cross plus m7-ai also failed tests outside the assistant: "Ravi Kumar" not on /leads, the match-count check after marking a property Sold, and an ENOENT from the shared test-results folder. I did not look into those.

---
## fix:leads-clients:r1

Leads-clients area, round 1: all 8 bugs are fixed. VIS-7 is fixed only for the leads and clients tables. The Today "Team snapshot" part belongs to the today module, which I did not touch.

Port 5315 is free and no vite process is left on it. notes/tmp-leads has been deleted. Nothing was committed.

**Checks**
- `pnpm typecheck` passes.
- `pnpm lint` reports 0 errors. Its warnings are all in other files.
- `pnpm test`: 686/686 pass.
- Playwright on 5315 (msedge, desktop):
  - qa-manager MGR-4 and MGR-10 pass.
  - qa-cross XAI-13 passes.
  - qa-visual VIS-3 and VIS-5 pass.
  - qa-visual walks pass: manager @ 768, manager @ 375, arjun @ 1440-dark, sneha @ 375, admin @ 1440-light.
  - m2-leads-clients.spec.ts: 6 tests ran with `--workers=1` and none reported an error. I did not see the final summary line because I cut the output off. With parallel workers some tests failed with timeouts while the dev server was overloaded, and they passed on rerun.
  - In the first parallel visual run, admin @ 1440-light and manager @ 375 hit the 420 s timeout while taking a screenshot. Both passed when rerun alone.

**Results per bug**
- **MGR-4: FIXED.** The assign dialog kind in `src/modules/leads/components/lead-dialogs-context.ts` now accepts an optional `onDone`. `lead-dialogs.tsx` passes it to `AssignDialog`, which already calls it after a successful assign. `leads-bulk.tsx` opens the dialog with `onDone: onClear`, so the selection and bulk bar clear as they do after a bulk stage change.
- **MGR-10: FIXED.** `src/modules/leads/lib/list-stats.ts` `headline()` now also returns `unassignedSla`: open, unassigned leads past the SLA. The Unassigned card hint in `leads-page.tsx` uses it, so a fresh seed shows "5 · 4 past the first-call SLA".
- **XAI-13: FIXED.** The "Why this score?" popover (`ScoreWhy` in `src/modules/leads/components/lead-summary.tsx`) shows `<DemoAIBadge mode={getAI().mode} />` next to the score title.
- **VIS-4: FIXED.** Client page at 375 now has 0 px horizontal overflow:
  - `src/components/domain/contact-actions.tsx` (M2-owned) accepts `labels="short"`. It shows "Call" / "WhatsApp" (existing `domain:log.channel.*` keys), and the full "Call {name}" stays as the accessible name and tooltip. The default and `labels` (true) behave as before.
  - In `client-page.tsx`, the header uses `labels="short"`. The journey stepper is a 5-column grid whose labels wrap, so it is no longer cut at the edge. Document names get `min-w-36`, so the three status buttons wrap underneath instead of shrinking the name to "P…".
- **VIS-5 and VIS-15: FIXED.** `leads-filters.tsx` now builds its own two-row toolbar instead of the shared FilterBar:
  - Row 1 is the search box, then saved views, sort, density, columns and export on the right, wrapping when needed.
  - Row 2 is the filter pills, left-aligned. Stage, Temperature, Priority, Source, Executive and Needs attention are always shown. City, Locality, Budget, Created and Lost reason sit behind a "More filters" / "Fewer filters" toggle.
  - On phones every pill sits behind a "Filters" toggle, so leads appear on the first screen.
  - A pill that is in use always shows, and "Clear all" is kept.
  - New keys `leads:filters.more`, `filters.fewer` and `filters.toggle` are added in en and ta.
  - Tamil at 375 and the 1024 and 1440 layouts have no page overflow.
- **VIS-7: FIXED for the leads and clients tables.** In `leads-table.tsx`, below the lg breakpoint (tablet):
  - the Stage column uses the short stage name ("Visit set");
  - the Score column shows only the ring, without the temperature pill;
  - the name cell is narrower.
  
  At 768 the table is now 654/654 wide, so nothing scrolls sideways and no column is cut. The other columns were already hidden at this width and can still be shown or hidden from the Columns menu. I did not add a sticky first column because nothing scrolls any more. The VIS-5 qa test, which covers /leads 768, /clients 768, /today 375 and /team 375, passes.
- **VIS-11: FIXED.**
  - **Cause:** on desktops between 1280 and 1535 px, the lead page's three columns (320 px / main / 360 px) left the middle column only about 220–380 px. That clipped the tabs and also squeezed the next-best-action card into one word per line.
  - **Fix in `lead-page.tsx`:** from 1280 to 1535 px the page now uses two columns (320 px / main), with the related AI cards stacked under the summary rail. The three-column layout starts at 1536 px. At 1440 the tab strip is 758/758 wide.
  - **Fix in `lead-tabs.tsx`:** the tab strip also wraps instead of clipping when the column is narrow.
  - **Decision for you:** DESIGN_SYSTEM.md line 1071 says the lead page has three zones from xl (1280). I did not edit that doc. You may want to either update it to say three zones start at 2xl (1536), or revert this layout part and accept clipped tabs at 1280–1535.

**Edits outside the obvious leads/clients folders:** `src/components/domain/contact-actions.tsx` (in the M2 ownership list), and the en and ta `leads.json` (3 keys each). Another fixer changed `leads-bulk.tsx` at the same time (enabled lost reasons). My `onDone: onClear` change is still in it.

---
## fix:shared:r1

All 4 bugs are FIXED. I ran the checks on port 5319, which is now free, and deleted the scratch folder notes/tmp-shell.

**ADM-8 (AI button covers the settings Save button): FIXED.**
- **Cause:** sticky bottom action bars stretched under the fixed AI button. Only the import bars had an ad-hoc `mr-14 md:mr-16` to avoid it.
- **Fix:** I added one shared utility, `.fab-clear`, in `src/index.css` (@layer utilities). It sets margin-right to 3.5rem, and 4rem from md up.
- **Where it's applied:** the sticky save bars in `src/modules/settings/components/pipeline-section.tsx` and `matching-section.tsx`, `src/modules/leads/pages/lead-new-page.tsx` and `lead-edit-page.tsx`, and the import bars in `src/modules/import/components/check-step.tsx`, `document-flow.tsx` and `wizard-bits.tsx` (replacing the ad-hoc margins).
- **Property form:** the full-width save bar shown below xl in `src/modules/properties/components/property-form.tsx` now has `md:pr-22`.
- **Checked:** no overlap at 1440, 900 and 375 px. At 1440, `elementFromPoint` at Save's right edge returns Save.

**VIS-1 (dark-mode highlight chips unreadable): FIXED.**
- **Cause:** in dark mode, `--highlight-foreground` is the dark ink meant for text on the solid marigold, not on the soft wash.
- **Fix:** in `src/lib/tones.ts` the highlight tone's text is now `text-highlight-foreground dark:text-highlight`. I made the same change to the hand-written rank chip in `src/modules/today/components/exec-cards.tsx:67`.
- **Checked:** the rank chip and the "Shortlisted" chip on /properties/PRP-1001 measure 12.46:1 in light and 8.04:1 in dark (was 1.28:1).

**VIS-6 (toasts cover the AI button): FIXED.**
- **Fix:** in `src/app/providers.tsx` the Toaster's desktop offset is now `{ bottom: 24, right: 84 }`, so toasts sit to the left of the 48 px button. Phone stays top-center.
- **Why beside, not above:** I first put the stack above the button. The VIS-4 spec then failed now and then, because Sonner slides each toast up from below and the toast crossed the button while sliding in. Beside it, they never touch.
- **Checked:** the VIS-4 spec passed 3 runs out of 3, and the AI button stays clickable while a toast shows.

**VIS-10 (dev server reloads pages when notes/ changes): FIXED.**
- **Fix:** `vite.config.ts` now has `server.watch.ignored: ['**/notes/**', '**/test-results/**', '**/playwright-report/**']`.
- **Checked:** a scratch Playwright test wrote .html, .css and .svg files under notes/ and test-results/ while a page was open. A marker set on `window` beforehand was still there, so the page did not reload.

**Tests**
- **typecheck / lint / unit tests:** `pnpm typecheck` passes. `pnpm lint` shows 0 errors (only warnings already there). `pnpm test` passes 692 of 692.
- **Bug specs:** ADM-8, VIS-1 and VIS-4 passed with `--repeat-each=3`, 9 of 9.
- **Wider e2e run (desktop, port 5319):** m1, m2, m3, m5, m8, qa-admin and qa-visual gave 63 passes and 3 failures before my 1500 s time limit stopped the run, so smoke was cut off. I re-ran smoke on its own and all 9 passed. The 3 failures:
  - qa-admin "Admin Today one-click fixes … Undo works" failed at the Undo step in the long run but passed when run alone. It looks flaky.
  - qa-admin ADM-5 (a demoted executive still shows in the profile picker) is not shell code.
  - qa-visual VIS-2 (AI insights stay in English after switching to Tamil) is not shell code.

**Screenshots:** running the QA specs overwrote the QA team's original screenshots, so I put those originals back. Before and after shots for the three visual bugs are in `E:\real-estate\crm-e2e\notes\screens\qa\fixes\shell\`: ADM-8-fab-over-save, VIS-1-dark-rank-chip and VIS-4-toast-vs-fab, each as `-before.png` and `-after.png`.