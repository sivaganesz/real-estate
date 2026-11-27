# Requests — M6 Pipeline

1. **(nice, M7) `services/commands.executeProposal` — moveStage to Lost defaults `lostReason` to `'other'`.** If a proposal reaches it without a reason, the lead is marked Lost with reason "Other" without asking. Proposed: throw a `ValidationError` when `to === 'lost' && !payload.lostReason` (and when `to === 'booked'` without deal data), so callers must open the stage dialog. M6 already routes these moves through `StageChangeDialog` from the pipeline assistant; the global AI panel does not.
2. **(nice, M8 / foundation) Settings → Pipeline stage changes** — the board reads `settings.pipeline.stages` (`enabled`, `order`, `targetDays`, `probability`) live; no change needed, just confirming the contract: disabling a stage hides its column, and leads already in a disabled stage are hidden from the board/list until it is re-enabled.

## Integrator status (Phase 3)
- **1 — APPLIED (by M7).** `executeProposal` refuses Lost without a reason and Booked / Converted.
- **2 — confirmed.** The stage-change dialog now also hides stages switched off in Settings (the lead's own stage stays listed).
- Review: analytics tile screen-reader label without data — APPLIED (`tileLabelNoData`). Stage filter + `?stage=` / `?source=` / `?stalled=1` links — APPLIED. Admin stage renames now show on the board (M8 R1 follow-up).
- Review: "Booked counted twice", dark column weight, phone KPI stacking — left as documented assumptions / UI unifier.
