# Assumptions — M6 Pipeline

1. **Deal value** = `deal.value`, else `requirement.budgetMax` (the same rule as `services/queries/stats.pipelineValueByStage`), so Pipeline, Today and Reports show the same ₹ totals. Leads with neither show "Value not known" and count ₹0.
2. **Open pipeline** = every stage except Converted and Lost (Booked counts as open, matching `OPEN_STAGES` and the AI pipeline summary). Win rate = (Booked + Converted) / (Booked + Converted + Lost), the same as `stats.conversionRate`.
3. **Share-of-value bar** is the stage's share of the open value; Converted and Lost columns show no bar.
4. **Moves that open a dialog:** Lost (reason required), Booked (property + booking amount required) and also **Converted/Won** (a confirm with an explanation that the property becomes Sold), because winning is irreversible in practice. All other moves apply at once with a toast + Undo (one level, 6 s toast).
5. **Visit scheduled by hand** with no upcoming site visit opens the shared appointment form (type preset to Site visit) plus an info toast (plan E5). It never books anything by itself.
6. **Stalled** = days in stage > 2 × the stage's target days (`lib/stalled`), on any open stage (not only qualified / visit done / negotiation, which remain the stalledDeal notification watch list). The ✦ marker, the KPI, the "Stalled only" filter and the AI panel all use `stalledDeals()`.
7. **Recommended actions** for stalled deals are rule-based per stage (`stallAdvice` in `lib/stalled.ts`) and become a high-priority follow-up task through an AI proposal (`createTask`, executed by `services/commands.executeProposal` with `via: 'ai'`) only after Confirm. The provider's `suggestNextAction` is shown alongside as an Iris chip. Leads without an owner cannot get a task; the card says "Assign this lead first".
8. **Conversion prediction** per card = `scoring.probability` (0.5 × stage probability + 0.5 × score/100), shown as "✦ NN%". The weighted forecast KPI = Σ value × probability over open deals; it carries the Demo AI badge.
9. **Pipeline assistant** reuses the global `ai.parseCommand`. For a proposed move to Lost / Booked / Won, Confirm and Edit open the stage dialog instead of running the proposal (the generic proposal would default the lost reason to "other" and cannot carry booking details). The example chips stay in English in Tamil mode because the simulated parser understands English/Hinglish commands; stage words for the chip live in `pipeline:assistant.stageWord.*`.
10. **Phone (< 768 px):** board view becomes stage tabs + one stage's cards with a visible "Move to…" button that opens a bottom sheet; the AI panel starts folded on phones (remembered per viewer in localStorage, wrapped in try/catch). List view uses the shared data table with lower-priority columns hidden.
11. **Keyboard drag:** Space lifts, ←/→ (or ↑/↓) jump a whole column, Space/Enter drops, Esc cancels; announcements are i18n strings. Every card also has a "Move to…" menu, so moving never requires dragging.
12. **Filters** live in component state; `?view=list` and `?owner=<id>` (one executive) are mirrored in the URL. The Executive filter shows only for roles whose `lead.view` scope is not `own` (manager, admin), and includes "Unassigned".
13. **Card order inside a column:** stalled first, then longest in stage, then highest value (no manual sort order is stored).
14. **"+ Add lead"** appears only at the bottom of the New column (other stages are reached by moving a lead). It links to `/leads/new`.
15. Nothing from `wireframe-rebuild/` was portable (it has no pipeline). The spec-wireframe rules noted in `analysis-spec-wireframe.md` §6 were re-implemented and logged in `ported-files.md`.
16. Tamil strings are drafted and need review by a fluent speaker.

## Independent review (M6 reviewer)

17. **Fixed:** `stage-change-dialog.tsx`: the Lost reason and Booked property selects started uncontrolled (`value={undefined}`), which logged a React warning ("Select is changing from uncontrolled to controlled") on every Lost or Booked move. They are now controlled from the start (`value ?? ''`, so the placeholder shows).
18. **Fixed:** `pipeline-mobile.tsx`: centring the active stage tab used `scrollIntoView`, which also scrolled the phone page down on load. Only the tab strip scrolls now.
19. Keyboard drag: dnd-kit measures the columns just after the lift, so an arrow key pressed in the same frame as Space has no effect. A real user is never that fast; the e2e waits for the "is over …" announcement.
20. The e2e journey is `e2e/m6-pipeline.spec.ts`. `e2e/m6-pipeline.dev.config.ts` runs it against the M6 dev port (5206), because `pnpm build` (the 5176 webServer) currently fails on other modules' type errors.
