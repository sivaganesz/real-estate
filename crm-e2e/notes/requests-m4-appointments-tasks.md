# Requests — M4 Appointments & Tasks

## 1. New file `src/components/domain/appointment-slots.ts` (+ test) — APPLIED
- **What:** pure `suggestSlots()` / `nextFreeSlots()` (free slots for an executive, working hours, 15-min buffer, site visits in daylight windows) used by `appointment-form-dialog.tsx` and the module's reschedule dialog.
- **Why:** the form dialog lives in `components/domain` and cannot import from `modules/appointments`; the logic must be pure and unit-tested. New file only, nothing else touched.
- **Urgency:** blocking (scheduling suggestions, master prompt §16). Please list it under M4 ownership in CONVENTIONS §3 / plan §8.1.

## 2. `src/components/domain/lead-select.tsx` — always controlled — APPLIED
- **What:** `<Select value={value} …>` → `<Select value={value ?? ''} …>` (one token).
- **Why:** with no lead chosen the Radix Select started uncontrolled and React logged "Select is changing from uncontrolled to controlled" when a lead was picked (appointment form, task form, quick add). Dev warnings fail `pnpm e2e:dev`.
- **Urgency:** blocking-small. File has no owner in §8.1.

## 3. Additive service functions — done within the M4 "additive" rule
- `services/appointments.ts#completeAppointmentWithStage(id, outcome, stage?, opts)` — completes and applies an accepted forward stage (never booked / converted / lost) in ONE commit with Undo; checks `lead.moveStage`. Import lines extended for `PipelineStageKey`, `STAGE_RANK`, `moveStage` (from `core/effects`, read-only use).
- `services/tasks.ts#rescheduleTasks(ids, dueAt | (task) => dueAt, opts)` — bulk / single reschedule with Undo (the existing `rescheduleTask` is not undoable).

## 4. Nice to have (not applied)
- `common` namespace: generic `yes` / `no` keys (M4 uses `appointments:yes|no` meanwhile).
- `catalogue`: `callResult.*` and `visitResult.*` labels so Today / Activity can show them (M4 uses `tasks:callResult.*`, `appointments:result.*`).
- `Drawer` (shared): pressing Escape while focus is inside a textarea in the drawer sometimes did not close it during automated runs — worth a look.
- `ai/simulated/messages.ts`: the `visitConfirm` template prints "to  at ." when called without `appointmentId`; M4 now always passes it, but a guard there would help other callers.

## Integrator status (Phase 3)
- §4 `common` yes/no keys — DECLINED (module keys work; no second caller).
- §4 `catalogue` callResult / visitResult labels — DECLINED for now (only M4 renders them).
- §4 Drawer Escape in a textarea — DECLINED (not reproducible; Radix handles Escape on the dialog content).
- §4 `visitConfirm` guard — APPLIED already in `ai/simulated/messages.ts` (falls back to a follow-up message without a visit).
- Review #5 (automatic task titles in English) — APPLIED at display time: `task-row.tsx` shows `domain:task.autoTitle.<reason>` (en + ta) for automatic tasks.
- Review #1 (phone checkboxes), #2 (cancel reason language), #3 (reschedule Undo; `rescheduleTasks` already has one) — left to the UI unifier / documented assumptions.
- Activity log: `updateTask`, `rescheduleTasks`, `reopenTask`, `deleteTask`, `updateAppointment`, `confirmAppointment`, `deleteAppointment` now emit `task.updated` / `task.deleted` / `appointment.updated` / `appointment.deleted` (new activity kinds, en + ta), so these changes show on timelines and in the log.
