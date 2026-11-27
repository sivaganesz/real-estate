# Assumptions — M3 Properties & Matching

1. **Smart required** = what `validateProperty` enforces (title or configuration, type, city, locality, price, area). The type's extras in `PROPERTY_TYPES.required` (floor for flats, road width for plots) are shown as *recommended* and do not block saving, so a quick paste-and-fill listing can be saved.
2. **Edit saves the whole record** through a new additive `replaceProperty()` (services/properties.ts) because `updateProperty` skips `undefined` and so cannot clear a field (RERA, owner, a spec) the user removed.
3. **Edit with AI** applies only fields the extractor actually marked (`fieldMeta`), never its defaults (e.g. purpose 'sale'), and never overwrites the existing title.
4. **AI listing copy** (title + description) is rule-based from record facts only (`lib/property.propertyCopy`) since `AIService` has no description method; it is labelled with the Demo AI badge (`mode="simulated"`), and written in English because listing text is record data (same convention as the extractor's suggested title).
5. **Hidden sections are cleared on save**: switching type from flat to plot drops configuration, floor, rooms, etc. (`cleanForSave`), so stale values never leak into matching.
6. **"All" tab excludes archived** listings; drafts and archived have their own tabs.
7. **Status On hold** from the property page asks for a hold-until date (default +3 days, 18:00); hold-for-lead is not asked (optional field, not required by spec).
8. **Matching scope**: lead → properties for leads the user can see; property → leads ranks only visible open leads (an executive sees only own leads), per permission `matching.run`.
9. **Matching assistant** is rule-based (`modules/matching/lib/assistant.ts`) over the NL parser; it reads a lead by full/first name (possessive OK), a property by id/project, plus filters; it never writes.
10. **Bulk status** is offered only when the user may edit every selected property (otherwise disabled with the permission reason as tooltip).
11. Uploaded photo budget: ≤ 8 per property, ~4 MB of data-URL photos across the demo (K3); compression to ≤ 1600 px JPEG q=0.78.
12. The view choice (cards/table/locality) is remembered per browser in localStorage (try/catch guarded).
13. `useMatchActions` is exported from `components/domain/match-list.tsx` (an owned file) so M2's lead page can reuse the same actions; oxlint reports a fast-refresh *warning* (not an error) for that file.

## Independent review (M3 reviewer)

14. **Edit locked, not hidden:** on another person's listing an executive sees a disabled Edit with the reason ("You can only change records you own.") as the tooltip (CONVENTIONS §6: the role can edit, just not this record). The table's row pencil stays hidden (an icon-only row action).
15. **Bulk acts on what is on screen:** the bulk bar counts and acts on the selected rows that the current filters and tab show, so a selection hidden by a filter is never changed or deleted by accident.
16. **"Paste a listing"** opens `/properties/new?paste=1` and focuses whichever paste box is visible (beside the form at ≥ xl, above it on smaller screens).
17. The M3 e2e journey also has `e2e/m3-properties-matching.dev.config.ts` (dev server on 5203, traces off because a parallel run can wipe `test-results/`).
