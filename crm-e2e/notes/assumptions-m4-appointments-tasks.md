# Assumptions — M4 Appointments & Tasks

1. **Lead / client on an appointment:** the form links a lead; when that lead is already a client the form says so. A separate client picker was not added (every client has a lead, `Client.leadId`).
2. **Weeks start on Monday** (Indian business convention). Default view: week on tablet/desktop, day on phones; the week view on a phone renders as the day-grouped agenda (no sideways-scrolling grid).
3. **List view range** = the anchor's week plus the next week (14 days).
4. **"Log outcome" / "No-show"** are offered from 15 minutes before the start; **Confirm** only before the start.
5. **Working hours** for suggestions: calls 10:00–19:30 (follow-up assistant), bookings 09:30–19:00, site visits 10:00–13:00 and 15:00–17:30 (daylight); 15-minute buffer around existing bookings.
6. **AI suggestion after an outcome** never proposes Booked / Lost (those need the stage dialog's details) and never moves a lead backwards; "ready to book" suggests Negotiation and points to the lead page to record the token.
7. **Rule-based (module-local) AI** — prep points, visit summary, outcome-note reading, follow-up timing — always shows the Demo AI badge with mode `simulated`, even when a live provider is configured, because these come from local rules. Message drafts come from `ai.generateMessage` and show that result's mode.
8. **WhatsApp confirmation** for site visits uses the `visitConfirm` template (includes the Google Maps link); other types use a module-local English/Hinglish message with venue + map link. Clicking "Open in WhatsApp" logs a WhatsApp contact on the lead (delivery cannot be confirmed — K5).
9. **Call tasks linked to a lead** ask for the call result on completion; "Not reachable" / "Busy" rely on the foundation E4 retry task. Other tasks complete directly.
10. **Quick add** creates the task for the current user; the type is guessed from the first word ("Call…" → call, "WhatsApp…" → whatsapp, else follow-up). "More options" opens the full form pre-filled.
11. **Executive filters** appear only when the role's scope is not `own` (managers, admins) and more than one executive has records in view.
12. Times and dates use `fmtDate` / `fmtTime` / locale `toLocaleDateString` (en-IN / ta-IN); Tamil strings are drafted and need review by a fluent speaker. Placeholder examples inside inputs stay in English (they show data the user types).

## Independent review (reviewer, not the builder)
- Short calendar blocks (15-minute calls) clipped their text at the default zoom. Fixed: blocks are at least 18 px tall, use tighter line height, and a one-line block is centred vertically (`time-grid.tsx`, `event.tsx`).
- The e2e journey is `e2e/m4-appointments-tasks.spec.ts`. It runs against the dev server on 5204 with `e2e/m4-appointments-tasks.dev.config.ts`, because `pnpm build` is red from other modules' typecheck errors (M1 today, M5 import). The config writes to the OS temp folder, because other agents' runs clear `test-results/` while a run is still going.
- Cancel reasons are stored as the label in the chosen language (a Tamil user stores Tamil text). This is left as is and noted.
