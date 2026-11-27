# Assumptions — M2 Leads, Qualification & Clients

1. **"All" tab includes closed leads** (converted / lost) because plan §5.5 `LEAD_TABS` defines it as everyone; the KPI and Today-design views only count open leads.
2. **Default view**: managers and admins open on the Table, executives on the "Today design" (who to call now). The choice is remembered per browser (localStorage, wrapped in try/catch) and can be forced with `?view=`.
3. **Duplicate "Save anyway"** requires an explicit tick; the saved lead gets a note naming the possible duplicates and the admin is notified by effect E2 (so `flagDuplicate` is not called twice).
4. **Executives see a duplicate's owner but no link** when the other lead is not theirs ("ask your manager"), so no NoAccess dead end.
5. **Owner choice on Add lead (managers/admins)**: "Auto-assign" (when on in Settings, previewed live with the engine's pick and reason) or a named executive. When auto-assign is off the choices are "Leave unassigned" (default), a person, or "Auto-assign now" (runs `assignLead(id, 'auto')` once after create).
6. **Bulk stage change excludes Booked/Converted** (each needs a property and booking amount) and by default skips leads already at or past the target stage; Lost asks for one reason for all.
7. **Edit with AI semantics**: words "add / also / include" add to lists, "remove / drop / without" remove, otherwise lists are replaced; contact fields change only when the message names them ("phone", "e-mail", "name"). "Requirement clarity" is never changed by an edit message (it is inferred, not said).
8. **Qualification chips save immediately with Undo** (6 s) — the user's click on an answer is the confirmation. AI answers read from notes are shown first and only applied on "Apply".
9. **Generated messages**: the text is the AI draft until the user edits it; changing purpose/channel/tone starts a fresh draft. Clicking Open WhatsApp/SMS/e-mail logs the contact (Known limitation K5: no delivery confirmation).
10. **Clients**: status moves one step forward from the header button, or any step from the journey bar (undoable). Cancel booking does not touch the lead or the property (their own flows handle that). Delete of a client record uses the `lead.delete` permission (managers/admins) like `services/clients.deleteClient`.
11. **Standard client documents** are stored by English name (data) and translated in the UI when the name is known (`clients:doc.*`); custom names are shown as typed.
12. **Classification override and HNI status** are editable by managers/admins only; executives see "Restricted" for HNI-classified leads and the high-value label otherwise.
13. **Score detail for source** now reads "{{source}} leads convert at this rate" with the translated source label.
14. Tamil strings in `ta/leads.json` and `ta/clients.json` are drafted and need review by a fluent speaker.

## Reviewer pass (independent review)
- Leads table at < 2xl (1536 px): the "Last contact" aging column is hidden and the aging badge is shown under the next follow-up instead, so the table fits a 1440 screen with the sidebar open; the Location column shows from xl (1280 px). Below that the table scrolls sideways inside its card (DataTable behaviour).
- "Today design" view: the group grid is `grid-cols-1` with `min-w-0` sections so long AI next-action chips truncate instead of widening the page at 375 px (it was 568 px wide).
- e2e: `e2e/m2-leads-clients.spec.ts` (7 desktop journeys + 1 @phone), with `e2e/m2-leads-clients.dev.config.ts` to run the same spec against the 5202 dev server.
