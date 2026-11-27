# Assumptions — M1 Today & Reports

1. **Role view selection** uses the permission scope of `lead.view` (all → admin view, team → manager, own → executive), never a role-name comparison.
2. **Hot / stale leads with a planned follow-up** (an open task due later) are not repeated in the priority list: "Reschedule" on such a lead creates a follow-up task, which takes it off today (inbox to zero).
3. **Log outcome** on a task completes the task with the call result (E10 → E4 contact + retry); on a lead item it logs a call (`logContact`). The optional next follow-up creates a `followUp` task. Nothing saves before Save.
4. **Send confirmation** opens WhatsApp with the `visitConfirm` template (English tone), logs a WhatsApp contact and marks the appointment `confirmed`. Delivery cannot be verified (K5).
5. **Day brief, manager/admin briefs, admin insights and the report AI summary** are rule-based over the store (simulated AI) and always carry the Demo AI badge with mode `simulated`, even if the live provider is configured, because they are computed locally. Free-text requests go through `ai.parseCommand` (the inline Today assistant), whose badge follows the provider's mode.
6. **Reports cohort**: funnel, sources and trend count the leads created in the chosen period; pipeline health/value use leads open now. Default period is "Last 6 months" so the seeded history is visible. Previous-period deltas compare the same elapsed time.
7. **Report scope** comes from `report.view`: admin → Everyone, each team, each executive (deactivated ones too while they hold leads); manager → team + each report; executive → only self ("My performance", Team tab hidden). A person's leads include those they first owned (`firstOwnerId`) so attribution survives reassignment; a team also covers its unassigned queue.
8. **Click-through** opens an in-module drill-down drawer listing the exact leads/properties behind a number (with CSV and a link on to Leads / Pipeline / Properties), because `paths.leads()` / `paths.pipeline()` take no filter params yet (request R1).
9. **Conversion** = booked + converted over closed (booked + converted + lost). Booked counts as "won" in the funnel.
10. **"Visited, not booked"** = open leads in Site visit done, or Negotiation after a visit, whose last completed site visit was ≤ 14 days ago (badged "This week" ≤ 7 days, else "Last 2 weeks").
11. **Monthly pace** line: calls/day needed = remaining calls ÷ days left in the month (today included).
12. Tamil strings are drafted and need review by a fluent speaker.

## Independent review (reviewer, 2026-11-27)
13. **Period conversion** (Reports KPI) = deals booked in the period ÷ (booked + lost in the period). When nothing closed in the period it shows "—" instead of falling back to the all-time rate (the old fallback showed 100% next to 0 bookings).
14. **Elapsed time in reasons** ("Not called yet: …") is formatted as min / h min / days (`agePhrase`), never raw minutes.
15. Phone layout of a priority row: the due time moves next to the reason chip below `sm`, so the lead name keeps the row width.
