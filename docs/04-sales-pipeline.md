# 04 · Sales pipeline

**Status:** built · **Commit:** Phase 4 · **Users:** executives (their pipeline), managers (the team's).

## 1. Stages, and what each one means

Arbitrary stages ("Warm", "Follow-up 2", "Hot prospect") are where pipelines rot: nobody agrees what they mean, so the numbers mean nothing. Each stage here has an **entry condition the app checks**, and a normal time limit after which the lead counts as stuck.

| Stage | Entry condition (checked) | Stuck after | What the salesperson is doing |
|---|---|---|---|
| **New** | Enquiry received | 1 day | Call them today |
| **Contacted** | A real conversation is logged (a "not reachable" call doesn't count) | 3 days | Understand what they need |
| **Qualified** | Budget, location and type are known | 5 days | Shortlist and send options, book a visit |
| **Site visit** | A site visit is scheduled or done | 5 days | Host the visit, collect feedback |
| **Negotiation** | A specific property is being discussed (it goes on their shortlist) | 4 days | Price, offers, approvals (Phase 7) |
| **Booked** | Booking amount received, **only through the deal** (Phase 7) | — | Payments and paperwork |
| **Lost** | A reason from a fixed list; planned follow-ups are cancelled | — | — |

**Lost reasons:** Budget mismatch · Bought elsewhere · Location not suitable · Loan not approved · Plan postponed · Not reachable · Not a genuine enquiry · Other.

## 2. Transitions

- **Automatic forward moves** (Phase 3): a logged conversation means *Contacted*; a complete requirement means *Qualified*. Scheduling a visit means *Site visit* (Phase 5). Confirming a booking means *Booked* (Phase 7).
- **Manual moves** (drag on the board, or the stage bar on a lead) are checked. When evidence is missing, the app asks for exactly that, in a small dialog:
  - log the conversation, then move;
  - pick the property they're negotiating on;
  - pick the lost reason;
  - or go to their page to fill in the requirement or schedule the visit.
- **Backward moves** are allowed; deals do fall back to another visit.
- **Booked** can't be dragged into or out of. Cancelling a booking (Phase 7) is the only way out.
- **Reopen** a lost lead → *Contacted* (or *New* if never reached). A returning enquiry reopens automatically.

## 3. Insights

Shown above the board, and available to the assistant (`pipeline_insights`):

- **Funnel** for the last 90 days: how many leads *reached* each stage, worked out from stage history and what happened (a done site visit counts), so lost leads count where they got to;
- **Conversion** from step to step, and the **weakest step** ("Qualified → Site visit, 47%");
- **Stuck now:** per stage, how many are past their limit and the average days;
- **Lost reasons**, and the stage they were lost at;
- **Sources:** leads and booking rate per source;
- **Team:** per executive, open, stuck, overdue and no-next-step counts. The manager's Today page (Phase 5) uses this.

## 4. Screens

- **Leads → Pipeline** (the *List / Pipeline* switch; `features/pipeline.tsx`, registered as `views.board`):
  - **Outcomes** across the top in three columns: four status tiles (2 × 2); a green **Booked** panel with a build-up chart and the people who booked; a **Lost** panel with the value lost, a "Where" chart (furthest stage reached, 90 days) and the people.
  - **Flow:** a 90-day band with the conversion between stages and the number lost at each.
  - Focus chips, then columns New → Negotiation. Cards are ordered by lead score and show the score, name, what they want, the next step (or "No next step"), days in stage (red when stuck) and the owner (for managers).
  - **Move a lead:** drag the card (a drop bar for Booked and Lost appears while dragging), or use the card's *Move to…* menu, which also works on phones where touch dragging doesn't.
- **Lead page:** a stage bar across the top. Click a stage or **Move to …**; **Lost** asks for a reason; **Reopen** when lost.

## 5. AI

- `move_lead_stage` (write): the same checks apply. When refused, the assistant explains what's missing ("Still unknown: budget").
- `pipeline_insights` (read): answers "where are deals getting stuck?", "why are we losing leads?", "how is Arun's pipeline?".
- Offline: "where are deals getting stuck?" gives the weakest step, stuck counts and top lost reasons.

## 6. Assumptions to confirm

- **Stuck-after limits** (1/3/5/5/4 days) are sensible defaults for residential sales. Land and commercial cycles are longer; these could become per-type settings.
- **No probability-weighted forecast.** With a small team, "4 in negotiation worth ₹3.2 Cr" (Phase 7 deals) is more honest than a percentage.
