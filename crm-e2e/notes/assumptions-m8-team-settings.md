# Assumptions — M8 Team, Settings, Notifications & Activity

1. **Team scope** uses `can('team.view', { ownerId: user.id })`: admins see everyone, managers see themselves + their reports. A manager opening `/team/<someone else>` gets a "Not in your team" state (the route itself only checks `team.view`).
2. **Conversion rate** per executive = (booked + converted) / (booked + converted + lost) over leads they own, or first owned if now unassigned. "–" when nothing is closed yet. Booked counts as both open (workload) and won (conversion), matching `OPEN_STAGES` and `stats.conversionRate`.
3. **Assign dialog** lists active executives in scope incl. people on leave (shown, disabled, with "On leave until …"); deactivated users never appear. "Recommended (auto)" previews with `services/assignments.previewAuto` (same engine as the real run). Single-lead assignment has no Undo (the service only snapshots bulk); a toast still says who and why.
4. **Auto-assign toggle** is a single company-wide flag (`settings.assignment.autoAssign`); managers may flip it (`rules.configure` = team) and are told it applies company-wide. Manager rules are scoped to their team (service forces `scope: { managerId }`); company-wide rules are read-only for managers, and `setRuleEnabled` enforces that server-side too.
5. **Lost reasons** are a fixed union in `types.ts`, so Settings can switch them on/off and re-order them but not invent new ones. At least one must stay on.
6. **Locked stages:** New, Booked, Converted and Lost cannot be switched off; Converted/Lost have no target days and fixed 100 % / 0 % probability.
7. **Templates** get ids `tpl-custom-N` (the id generator has no TPL prefix). Placeholders known to the preview: firstName, agent, property, time, map, price, link; others are flagged "won't be filled".
8. **Simulated assistants in M8** (all rule-based, Demo AI badge, nothing saved without a click): add-user paste/voice reader (`modules/team/lib/user-input.ts`), rule-in-words reader and template drafter (`modules/settings/lib/settings-logic.ts`), activity "ask in words" (`modules/activity/lib/activity-filters.ts`), notifications "Catch me up" digest, assignment simulator, plus `ai.insights('team')` on Team.
9. **Going on leave** from Team asks for a return date and, for people with `lead.assign`, offers to hand open leads over with auto-assignment right away; from Settings → Profile it sets leave for 3 days by default (editable) and relies on E15 to notify the manager.
10. **Deactivate** preview mirrors `effects.onUserDeactivated`: auto picks within the leaver's manager's team; "to a person" lists any active, not-on-leave executive. Undo works for 10 s (service is undoable).
11. **Reset demo data** has a confirm but no Undo (`resetDemo` clears the undo slot by design); the confirm says so.
12. **Notification delete** is per user and undoable; read state is never logged as activity (service rule).
13. **Activity log** shows `visible.activities` (admin all; manager team actors + their visible leads). Executives get NoAccess via the route permission. The list pages 60 entries at a time.
14. Tamil strings are drafted and need review by a fluent speaker; language names in chips are translated for display but stored in English.

## Reviewer additions
15. The rule reader ("describe the rule in words") keeps one condition per rule, because that is the data model. When a sentence names a second kind (e.g. a city and a language), the editor now says "One condition per rule: I also saw Location", so that condition is not dropped silently.
16. In the assign dialog and Assignment settings, team-level behaviour comes from `scope('lead.assign' | 'rules.configure') === 'team'` instead of `role === 'manager'` (plan §8.2 rule 4).
