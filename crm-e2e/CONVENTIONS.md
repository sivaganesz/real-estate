# Conventions — crm-e2e

Rules every contributor (human or agent) follows. `notes/foundation-plan.md` is the authority on architecture and paths; `DESIGN_SYSTEM.md` is the authority on visuals; the master prompt overrides both. This file is the short, practical version.

## 1. Folder structure

```
crm-e2e/
├─ e2e/                 Playwright journeys (smoke.spec.ts, fixtures.ts; QA adds more)
├─ notes/               plans, analyses, assumptions-<module>.md, requests-<module>.md, ported-files.md, screens/
├─ public/              favicon, demo-photos/, samples/ (M5)
├─ scripts/             node helper scripts (M5)
└─ src/
   ├─ main.tsx  index.css            entry; DESIGN_SYSTEM §12 tokens
   ├─ app/                           App, providers, router, routes.ts (registry), nav.ts, paths.ts,
   │  ├─ guards/                     RequirePermission, NoAccessPage
   │  └─ shell/                      app shell, sidebar, topbar, bottom tabs, profile switcher, toggles, bell
   ├─ components/
   │  ├─ ui/                         shadcn primitives
   │  ├─ shared/                     domain-agnostic building blocks (+ charts/)
   │  ├─ ai/                         AI panel, badges, paste-and-fill, voice, AI field markers
   │  ├─ domain/                     cross-module domain widgets (cards, dialogs, timelines)
   │  └─ illustrations/              inline SVG set (DESIGN_SYSTEM §9)
   ├─ domain/                        types.ts (all entities), catalogue.ts (stages, sources, cities…)
   ├─ data/seed/                     buildSeed(now) and its parts
   ├─ store/                         db-store (zustand+immer+persist), session-store, rebase, migrate
   ├─ services/                      the ONLY code that writes data
   │  ├─ core/                       commit, events, effects, ids, undo, actor
   │  └─ queries/                    pure reads: visibility, today, stats, lookups
   ├─ hooks/                         useDb, useCurrentUser, usePermission, useNow, useMediaQuery, …
   ├─ lib/                           pure logic (no React, no store) + co-located *.test.ts
   ├─ ai/                            AIService types, getAI()/useAI(), simulated/, live/, document/ (M5)
   ├─ i18n/                          index.ts + locales/<lang>/<ns>.json
   └─ modules/<module>/              routes.tsx, pages/, components/, lib/
```

Modules: `today leads clients properties matching appointments tasks pipeline import reports team settings notifications activity`.

File names are kebab-case (`lead-card.tsx`). Components are PascalCase named exports. Tests sit next to the code they test (`matching.ts` → `matching.test.ts`).

## 2. Import rules

- Always import through the `@/` alias (`@/lib/format`), except siblings inside the same folder.
- `modules/X` may import from `@/app/paths`, `@/components/**`, `@/domain/**`, `@/services/**`, `@/hooks/**`, `@/lib/**`, `@/ai` and `@/i18n`.
- **A module never imports from another module.** Shared UI goes into `components/domain/*` (by request); navigation uses `paths.*` from `app/paths.ts` (never hand-built URL strings).
- UI never imports `store/db-store` to write and never calls `useDbStore.setState`. Reads: `useDb(selector)` from `hooks/use-db.ts`. Writes: functions in `services/*`.
- `lib/**` and `services/queries/**` are pure: no React, no store, no `Date.now()` (take `now` as a parameter).
- `ai/simulated/**` reads only through `ctx.db()` and pure helpers; it never writes. AI proposals run through `services/commands.ts`.
- Use `import type` for type-only imports (`verbatimModuleSyntax` is on).

## 3. Ownership (Phase 2, plan §8.1)

| Owner | Exclusive write | Routes | i18n namespaces |
|---|---|---|---|
| **M1 Today & Reports** | `modules/today/**`, `modules/reports/**`, `services/queries/today.ts`, `services/queries/stats.ts` | `/today`, `/reports`, `/reports/:tab` | `today`, `reports` |
| **M2 Leads, Qualification & Clients** | `modules/leads/**`, `modules/clients/**`, `components/domain/lead-card.tsx`, `lead-pills.tsx`, `contact-actions.tsx`, `log-activity-dialog.tsx`, `lib/qualification.ts`, `lib/scoring.ts`, `lib/duplicates.ts`, `lib/lead-queries.ts`, `lib/next-action.ts`; additive in `services/leads.ts`, `services/clients.ts` | `/leads`, `/leads/new`, `/leads/:id`, `/leads/:id/edit`, `/clients`, `/clients/:id` | `leads`, `clients` |
| **M3 Properties & Matching** | `modules/properties/**`, `modules/matching/**`, `components/domain/property-card.tsx`, `property-pills.tsx`, `match-list.tsx`, `match-explain.tsx`, `lib/matching.ts`, `lib/property.ts`, `lib/search.ts`; additive in `services/properties.ts`, `services/matching.ts` | `/properties`, `/properties/new`, `/properties/:id`, `/properties/:id/edit`, `/matching` | `properties`, `matching` |
| **M4 Appointments & Tasks** | `modules/appointments/**`, `modules/tasks/**`, `components/domain/appointment-card.tsx`, `appointment-form-dialog.tsx`, `task-row.tsx`, `task-form-dialog.tsx`; additive in `services/appointments.ts`, `services/tasks.ts` | `/appointments`, `/appointments/:id`, `/tasks` | `appointments`, `tasks` |
| **M5 Import & Extraction** | `modules/import/**`, `src/ai/document/**`, `public/samples/**`, `scripts/**`; additive in `services/imports.ts`, `services/drafts.ts` | `/import`, `/import/:kind`, `/import/history`, `/import/drafts`, `/import/drafts/:id` | `import` |
| **M6 Pipeline** | `modules/pipeline/**`, `components/domain/stage-change-dialog.tsx`, `lib/stalled.ts` | `/pipeline` | `pipeline` |
| **M7 AI Assistants** | `src/ai/**` (except `ai/document`), `components/ai/**`, `services/commands.ts` | — (global panel) | `ai` |
| **M8 Team, Settings, Notifications & Activity** | `modules/team/**`, `modules/settings/**`, `modules/notifications/**`, `modules/activity/**`, `components/domain/assign-dialog.tsx`, `notification-item.tsx`, `app/shell/notification-bell.tsx`, `lib/assignment.ts`; additive in `services/users.ts`, `services/settings.ts`, `services/notifications.ts`, `services/assignments.ts` | `/team`, `/team/:id`, `/settings`, `/settings/:section`, `/notifications`, `/activity` | `team`, `settings`, `notifications`, `activity` |

**Foundation / Parent-owned (change by request only):** `domain/**`, `store/**`, `services/core/**`, `services/queries/visibility.ts` and `lookups.ts`, `services/demo.ts`, `services/automation.ts`, `services/activities.ts`, `data/seed/**`; `app/**` (except `notification-bell.tsx`); `components/ui/**`, `components/shared/**`, `components/illustrations/**`, `components/domain/entity-link.tsx` and `activity-timeline.tsx`; `lib/permissions.ts`, `tones.ts`, `theme.ts`, `format.ts`, `dates.ts`, `phone.ts`, `amount.ts`, `whatsapp.ts`, `validation.ts`, `classification.ts`, `places.ts`, `utils.ts`; `hooks/**`; `i18n/index.ts`; namespaces `common`, `shell`, `catalogue`, `ui`, `domain`, `activity`, `notifications` (the last two co-owned with M8, which may add keys).

**"Additive in services/x.ts"** = you may add new exported functions built on `commit()` and existing events. You may not change existing signatures, `effects.ts` or `domain/types.ts`.

**Anything else** (a new field, event, effect, shared component change, dependency, catalogue value) → append to `notes/requests-<module>.md`: what, why, exact proposed code, urgency (blocking / nice). Work around it locally meanwhile. Assumptions go into `notes/assumptions-<module>.md`.

## 4. Data: the service / commit pattern

```ts
// services/tasks.ts
export function createTask(input: NewTask, opts: { via?: Origin } = {}) {
  assertValid(validateTask(input))                          // ValidationError → field messages
  const { result: id } = commit('task.create', (tx) => {    // one immer draft, one re-render
    assertActorCan(tx.actor, 'task.manage', { ownerId: input.ownerId }, tx.db)   // PermissionError → toast
    return addTask(tx, { ...input, origin: opts.via ?? 'manual' })              // emits task.created
  }, opts)
  return { id }
}
```

- `commit(label, fn, { via, undoable })` runs `fn` on a draft, drains domain events through `services/core/effects.ts` (the master prompt §7 interconnections) in the **same** draft, then applies once.
- Every write service checks permission (`assertActorCan`) — the UI hiding a button is not enough.
- Destructive and bulk changes pass `undoable: true`; the UI shows `toastUndo(label, undoToken)` (10 s, one level).
- Errors: `ValidationError` (`lib/validation`), `PermissionError` (`lib/permissions`), `NotFoundError` (`services/core/commit`). Show them with `toastError(e)` from `components/shared/undo-toast`.
- Derived data (scores, matches, today lists, stats) is computed by pure functions in `lib/*` and `services/queries/*`, memoised with `useMemo` on the `db` slice. Never store derived values.
- Visibility: lists always go through `services/queries/visibility.ts` with the current user.
- Time: use `useNow()` in components and pass `now` into pure functions; seed dates are relative (`data/seed/dates.ts`) and rebased on load.

## 5. i18n

- Every visible string goes through `useTranslation()` / `t('ns:key')`, in **English and Tamil**. Data people type (names, notes, titles) is never translated.
- One JSON file per namespace and language: `src/i18n/locales/{en,ta}/<ns>.json`. New files are picked up automatically by `import.meta.glob`; `src/i18n/locales.test.ts` checks that en and ta have the same keys.
- Namespaces: `common` (buttons, validation, errors), `shell` (nav, topbar, switcher), `catalogue` (stages, sources, types…), `ui` (shared components), `domain` (domain widgets), `ai`, `activity`, `notifications`, and one per module: `today leads clients properties matching appointments tasks pipeline import reports team settings`.
- Use i18next plurals (`_one` / `_other`) and interpolation (`{{name}}`); never concatenate translated fragments.
- Format numbers, money, phones and dates only through `lib/format.ts` / `lib/amount.ts` (₹45,00,000, ₹45 L, ₹1.2 Cr, `+91 98450 12345`, `DD MMM YYYY`).
- Tamil is drafted and flagged for review by a fluent speaker.

## 6. Permissions

- The matrix lives in `src/lib/permissions.ts` (plan §3.1). Never compare `role === '…'` in UI code.
- Routes: every entry in a module's `routes.tsx` declares `permission` (an action key, `'any'`, or a function of params). The router wraps it in `<RequirePermission>`, which renders `NoAccessPage` on failure.
- Buttons: `const { can } = usePermission()`.
  - Role cannot do it at all (`scope === false`) → **hide** the control.
  - Role can, but not on this record → **disable** with a tooltip from `explain(action)`.
- AI proposals carry their own `permission` and are re-checked in `services/commands.executeProposal`; refusals use `explainDenied()`.
- Nav items and bottom tabs are filtered by the same permissions (`app/nav.ts`).

## 7. Styling: tokens only

- Colours come only from the DESIGN_SYSTEM tokens in `src/index.css` (`bg-card`, `text-muted-foreground`, `bg-hot/10`, `text-ai`, `border-border`…). Never write a hex value, `oklch()`/`rgb()` literal, or a palette class such as `text-red-500` in a component. For mixes use `color-mix(in oklch, var(--token) …)`.
- Tone helpers in `lib/tones.ts` map domain states (temperature, stage, score, match) to token classes; use them instead of ad-hoc mappings.
- Use the type scale classes from DESIGN_SYSTEM (`text-meta`, …), shadcn primitives from `components/ui`, and building blocks from `components/shared` before writing new ones.
- Every screen must work at 375, 768 and 1440 px, light and dark, English and Tamil. Respect `prefers-reduced-motion` (`useReducedMotion`).
- Lists need empty, filtered-empty, loading-skeleton (async AI/parse only) and error states; actions toast; destructive actions confirm and offer Undo.
- Add `data-testid` to anything an e2e journey needs to find.

## 8. Code hygiene

- TypeScript strict; no `any` without a reason, **no `@ts-ignore`, no `eslint-disable` / `oxlint-disable`, no skipped tests**.
- Keep `lib/*` pure and unit-tested. Comments explain *why*, not *what*.
- Ported files are logged in `notes/ported-files.md` (`| source (branch:path) | new path | what changed |`).
- Agents do not commit; the Parent commits after `pnpm verify` is green.

## 9. Test and run commands

| Command | What it does |
|---|---|
| `pnpm dev` | Vite dev server on **5174** (strict port; Parent / QA). Module agents use `pnpm dev --port 52NN --strictPort` (M1 = 5201 … M8 = 5208). |
| `pnpm typecheck` | `tsc -b --noEmit` |
| `pnpm lint` | oxlint (0 errors required; warnings reviewed) |
| `pnpm test` | vitest unit tests (`src/**/*.test.{ts,tsx}`; node env, opt into jsdom with `// @vitest-environment jsdom`) |
| `pnpm build` | `tsc -b && vite build` → `dist/` |
| `pnpm verify` | typecheck + lint + test + build — must be green before handing back |
| `pnpm e2e` | Playwright: builds, serves `vite preview` on **5176**, runs `e2e/` in Edge (desktop; `@tablet` / `@phone` tagged tests on those projects) |
| `pnpm e2e:dev` | the same journeys against the dev server on 5174 (React dev warnings count as failures) |
| `PW_CHANNEL=chrome pnpm e2e` | fallback when Edge is not installed |

E2E tests import `test` / `expect` from `e2e/fixtures.ts`: localStorage is cleared on the first page load unless the test title contains `@persist`, and `consoleProblems` collects console errors, warnings and page errors — assert it is empty.
