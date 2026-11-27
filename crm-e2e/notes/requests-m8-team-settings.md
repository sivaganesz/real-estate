# Requests — M8 Team, Settings, Notifications & Activity

## R1 — `PipelineStageDef.label?: string` — APPLIED (blocking, additive)
- **What:** optional `label` on `PipelineStageDef` in `src/domain/types.ts` (one-line precise edit; no other change).
- **Why:** plan §8.3 "Pipeline stages (rename via label)". Settings → Pipeline stores the admin's label there.
- **Follow-up (nice, Parent/M6/M2/M1):** add a shared helper and use it wherever a stage name is shown, so a rename shows everywhere:
  ```ts
  // lib/labels.ts (foundation)
  export const stageLabel = (t: TFunction, key: PipelineStageKey, stages: PipelineStageDef[]) =>
    stages.find((s) => s.key === key)?.label?.trim() || t(`catalogue:stage.${key}`)
  ```
  Until then only Settings shows the custom label; other screens show the catalogue name.

## R2 — respect `PipelineStageDef.enabled` (nice, M6/M2)
Settings can switch off optional stages (contacted … negotiation). Pipeline columns and stage pickers should hide disabled stages (leads already in such a stage should stay visible). M8 only stores the flag.

## R3 — `shell:bell.*` keys are now unused (nice, Parent)
The bell renders from `notifications:bell.*` (M8 namespace). `shell:bell.soon`, `shell:bell.empty`, `shell:bell.viewAll`, `shell:bell.unread`, `shell:bell.label` can be removed from `shell` en/ta when convenient.

## R4 — breadcrumb for `/settings/:section` (nice, Parent)
`AppRoute.titleKey` is static, so the crumb reads "Settings section". A `titleKey` function of params (like `permission`) would let it read "Assignment rules". The page H1 already shows the section name.

## R5 — `user.updated` activity params (nice, foundation effects)
`activityFor('user.updated')` drops `fields`; the log can only say "User updated: {{name}}". Adding `fields: e.fields.join(',')` would allow "changed role, manager".

## R6 — service guard: managers and company-wide rules in `saveRule` / `deleteRule` (nice→should, foundation `services/settings.ts`) — added by the M8 reviewer
The UI only lets a manager edit or delete their own team's rules, but the services do not check this. `deleteRule(id)` lets a manager delete a company-wide rule. `saveRule({ id: <global rule id>, ... })` lets a manager overwrite a company-wide rule, and the forced `scope: { managerId }` turns it into their team's rule. `setRuleEnabled` (M8) already checks this. Proposed: in both functions, after `assertActorCan`, add the same check:
```ts
const target = rule.id ? tx.db.settings.assignment.rules.find((r) => r.id === rule.id) : undefined // deleteRule: by id
if (target && !isSystem(tx.actor) && scopeOf(tx.actor, 'rules.configure') === 'team' && (target.scope === 'global' || target.scope.managerId !== tx.actor.id)) throw new PermissionError('rules.configure', explainDenied(tx.actor, 'rules.configure'))
```
The same applies to `setAutoAssign` / the `maxActivePerExec` cap: managers can currently change these company-wide values (see assumption 4). Decide whether they should become admin-only, or stay company-wide with the warning the UI shows now.

## Integrator status (Phase 3)
- **R1 follow-up — APPLIED.** `applyStageLabels()` in `i18n/index.ts` overrides `catalogue:stage.*` / `stageShort.*` with the admin's labels (cleared label restores the catalogue name); `app/providers.tsx` keeps it in sync, so a rename shows on every screen (test `i18n/stage-labels.test.ts`).
- **R2 — APPLIED.** The board already hid disabled stages; the stage-change dialog now does too.
- **R3 — APPLIED.** `shell:bell.*` removed (en + ta).
- **R4 — APPLIED.** `AppRoute.titleKeyFor(params)`; settings sections and report tabs name themselves in the breadcrumb and document title.
- **R5 — APPLIED.** `user.updated` activities carry `fields`.
- **R6 — APPLIED** (rules part): `saveRule` / `deleteRule` / `setRuleEnabled` share `assertMayChangeRule` — a manager cannot edit, delete or toggle a company-wide or another team's rule (test in `services/interconnections.test.ts`). The auto-assign switch and cap stay company-wide with the UI warning (assumption 4 kept; DECLINED to change permissions).
- Review E — APPLIED: the "Not in your team" / "Not found" member states have an (sr-only) `<h1>`.
