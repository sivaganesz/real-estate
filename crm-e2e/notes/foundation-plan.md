# Foundation plan — crm-e2e

Written by the Architect at the end of Phase 0. Everyone follows this plan: the foundation developer (Phase 1) and the module developers (Phase 2). It turns the master prompt (`d:\Docs\Real_Estate_CRM_Master_Prompt_v2.md`), `ROLE_RESEARCH.md` and `DESIGN_SYSTEM.md` into concrete decisions.

Where this plan and `DESIGN_SYSTEM.md` disagree on a **path**, this plan wins. Where they disagree on a **visual** detail, `DESIGN_SYSTEM.md` wins. The master prompt overrides both.

**Phase 0 input actually available.** No `notes/*.md` analysis files were produced, only `notes/ref-estate-matching.ts.txt` and `notes/ref-estate-matching.test.ts.txt`. The Architect therefore did the branch analysis directly from these sources:

- `wireframe-rebuild/`: `CHECKLIST.md`, `package.json`, configs, `src/data/*`, `src/store/db.tsx`, `src/lib/**`, `src/components/**`, `src/App.tsx` and the leads helpers.
- `origin/feat/estate-platform`: `docs/06-property-matching.md`, `docs/02-bulk-import.md`, `playwright.config.ts`, plus the matching service and its test.

The port list in §7 comes from that analysis.

---

## 0. Ground rules for every agent

1. Work only inside `E:\real-estate\crm-e2e\`. Never edit `wireframe-rebuild/` or `spec-system-wireframe/`. Never switch branches. Never use `git reset`, `git clean`, `git push`, `git merge` or `git rebase`. Read other branches only with `git show <branch>:<path>` or `git ls-tree -r <branch>`.
2. **Sub-agents do not commit.** The Parent commits after each phase, once `pnpm verify` passes.
3. Never use `@ts-ignore`, `eslint-disable` or `oxlint-disable`, and never skip a test.
4. Every UI string goes through i18n, in English and Tamil. Colours come only from tokens: never write a hex value, an `oklch()` value, or a palette class such as `text-red-500` in a component.
5. Unattended run. Never ask a question. Write each assumption into `PROGRESS.md` under "Assumptions" (Parent) or `notes/assumptions-<module>.md` (module agent).

---

## 1. Stack

The stack is the same as in `wireframe-rebuild/`, with only the additions that new features need. The package manager is **pnpm** (v12 is installed) and Node is **v24**. `crm-e2e/` is a standalone project with its own `package.json` and `pnpm-lock.yaml`. The repo root has no workspace.

### 1.1 `package.json`

```jsonc
{
  "name": "crm-e2e",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",                                   // port 5174, strictPort
    "build": "tsc -b && vite build",
    "preview": "vite preview",                       // port 5175, strictPort
    "typecheck": "tsc -b --noEmit",
    "lint": "oxlint",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "verify": "pnpm typecheck && pnpm lint && pnpm test && pnpm build"
  },
  "dependencies": {
    // same as wireframe-rebuild (copy the versions from its package.json)
    "@fontsource-variable/inter": "^5.3.0",
    "@fontsource/noto-sans-tamil": "^5.3.0",
    "@tailwindcss/vite": "^4.3.5",
    "class-variance-authority": "^0.7.1",
    "cn": "^0.5.2",
    "i18next": "^27.2.3",
    "lucide-react": "^1.77.0",
    "radix-ui": "^1.8.1",
    "react": "^19.3.1",
    "react-dom": "^19.3.1",
    "react-i18next": "^18.0.3",
    "react-router": "^8.5.2",
    "shadcn": "^4.23.0",
    "sonner": "^2.0.8",
    "tailwindcss": "^4.3.5",
    "tw-animate-css": "^1.4.0",
    // additions
    "zustand": "latest 5.x",            // store + persist middleware + immer middleware
    "immer": "latest 10.x",             // drafts inside the zustand immer middleware
    "recharts": "latest 3.x",           // fall back to 2.15.x only if it will not run with React 19.3
    "@dnd-kit/core": "latest 6.x",
    "@dnd-kit/sortable": "latest 10.x",
    "@dnd-kit/utilities": "latest 3.x",
    "xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz",  // official SheetJS; if the CDN is unreachable use npm xlsx@0.18.5 and log it
    "pdfjs-dist": "latest 5.x",         // worker via `import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'`
    "tesseract.js": "latest 6.x",       // lazy-loaded; language data from its default CDN (see Known limitation K1)
    "date-fns": "latest 4.x"
  },
  "devDependencies": {
    "@types/node": "^24.19.2",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.1.2",
    "oxlint": "^1.90.0",
    "typescript": "~7.0.2",
    "vite": "^8.3.6",
    "vitest": "latest",                 // must work with vite 8
    "@playwright/test": "latest",
    "jsdom": "latest"                   // only for the few component/hook tests; lib tests run in node
  }
}
```

The foundation installs every dependency in Phase 1. **Module agents never run `pnpm add` or `pnpm install`.** If a module really needs a new dependency, it writes a request (§8.4).

The following are **not** added:

- **TanStack Table.** The ported `data-table.tsx` already does sort, selection, responsive columns and a sticky action column.
- **cmdk.** The AI panel is the command palette.
- **react-day-picker.** The ported `mini-calendar.tsx` plus native `<input type="time">` cover date and time picking.
- **Any UI kit other than shadcn.**

### 1.2 Config files

All are ported from `wireframe-rebuild`. Only the changes are listed here.

- **`vite.config.ts`:**
  - `server: { port: 5174, strictPort: true }` and `preview: { port: 5175, strictPort: true }`.
  - Alias `@` → `./src`.
  - A `test` block for vitest: `environment: 'node'`, `include: ['src/**/*.test.{ts,tsx}']`. A test file opts into jsdom with `// @vitest-environment jsdom`.
  - `optimizeDeps.exclude: ['tesseract.js']`.
- **Phase 2 dev ports:** each module agent runs its own dev server on `52<NN>` (M1 = 5201 … M8 = 5208) with `pnpm dev --port 52NN --strictPort`. Never use 5174, which belongs to the Parent and QA. `strictPort` exists because demo data lives in per-origin localStorage.
- **`tsconfig.app.json`:** identical to the rebuild (strict, `noUnusedLocals`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, paths `@/*`). Add `"types": ["vite/client", "vitest/globals"]` only if globals are used. Prefer explicit imports from `vitest`.
- **`.oxlintrc.json`:** the same as the rebuild (react, typescript, oxc plugins; `rules-of-hooks` error; `only-export-components` warn).
- **`components.json`:** the same as the rebuild (style `radix-nova`, css `src/index.css`), with aliases `components: @/components`, `ui: @/components/ui`, `lib: @/lib`, `hooks: @/hooks`.
- **`index.html`:**
  - Title "RealSpec CRM".
  - The pre-paint theme script reads **`crm-e2e-theme`**.
  - `lang` is set from **`crm-e2e-lang`**.
- **`.gitignore`:** `node_modules/`, `dist/`, `dist-e2e/`, `test-results/`, `playwright-report/`, `.env`, `.env.*`, `!.env.example`, `*.tsbuildinfo`.
- **`.env.example`:**
  ```
  VITE_AI_PROVIDER=simulated        # simulated | live
  VITE_AI_ENDPOINT=                 # backend proxy URL for live mode (never a vendor URL with a key)
  VITE_AI_MODEL=                    # passed through to the proxy
  ```
  No API key variable. Keys live only on the backend proxy.
- **`playwright.config.ts`** (adapted from `origin/feat/estate-platform`):
  - `testDir: './e2e'`, `workers: 1`.
  - `webServer`: `pnpm build && pnpm exec vite preview --port 5176 --strictPort`, `baseURL: http://localhost:5176`.
  - `use.channel: 'msedge'`. Edge is installed on this Windows machine, so no browser download is needed. Fallback: `channel: 'chrome'`, then `pnpm exec playwright install chromium`, logged in `PROGRESS.md`.
  - Projects: `desktop` (1440×900), `tablet` (iPad gen 7 viewport), `phone` (Pixel 7 viewport; grep `@phone`).
  - Before each test, clear localStorage through `page.addInitScript` unless the test is tagged `@persist`.

---

## 2. Folder structure (`crm-e2e/`)

```
crm-e2e/
├─ package.json  pnpm-lock.yaml  vite.config.ts  tsconfig.json  tsconfig.app.json  tsconfig.node.json
├─ .oxlintrc.json  components.json  index.html  .env.example  .gitignore  playwright.config.ts
├─ README.md  CONVENTIONS.md  DESIGN_SYSTEM.md  ROLE_RESEARCH.md  PROGRESS.md  (later: DEMO_SCRIPT.md QA_REPORT.md DELIVERY_REPORT.md)
├─ notes/                      # plans, requests-<module>.md, assumptions-<module>.md
├─ e2e/                        # Playwright journeys (smoke.spec.ts from foundation; QA adds the rest)
├─ scripts/                    # node scripts, e.g. make-samples.mjs (M5)
├─ public/
│  ├─ favicon.svg
│  ├─ demo-photos/             # copied from wireframe-rebuild/public/demo-photos (14 jpg)
│  └─ samples/                 # M5: demo import files (csv, xlsx, pdf, png/jpg)
└─ src/
   ├─ main.tsx                 # initTheme(), i18n import, <App/>
   ├─ index.css                # DESIGN_SYSTEM.md §12, verbatim
   ├─ app/
   │  ├─ App.tsx               # providers + router
   │  ├─ providers.tsx         # TooltipProvider, Toaster, AIProvider, automation ticker, keyboard shortcuts
   │  ├─ router.tsx            # createBrowserRouter from the route registry; shell layout route; NotFound
   │  ├─ routes.ts             # THE REGISTRY: imports every modules/*/routes.tsx, exports ROUTES + NAV
   │  ├─ nav.ts                # nav groups, role order, bottom-tab sets, badge counters
   │  ├─ paths.ts              # typed path builders: paths.lead(id), paths.property(id), ...
   │  ├─ guards/
   │  │  ├─ require-permission.tsx
   │  │  └─ no-access-page.tsx
   │  ├─ error-boundary.tsx    # route-level boundary (ErrorState + Try again + Go to Today)
   │  └─ shell/
   │     ├─ app-shell.tsx  sidebar.tsx  topbar.tsx  bottom-tabs.tsx  mobile-nav-sheet.tsx
   │     ├─ profile-switcher.tsx  notification-bell.tsx  theme-toggle.tsx  language-toggle.tsx
   │     └─ ask-ai-bar.tsx     # topbar pill "Search or ask AI… Ctrl K" → opens the AI panel
   ├─ components/
   │  ├─ ui/                   # shadcn primitives (ported + new ones, see §7)
   │  ├─ shared/               # domain-agnostic building blocks (DESIGN_SYSTEM's "components/app")
   │  │  ├─ kpi-card.tsx  sparkline.tsx  progress-ring.tsx  score-ring.tsx  gauge.tsx  icon-tile.tsx
   │  │  ├─ charts/ chart-container.tsx area-chart.tsx bar-chart.tsx donut-chart.tsx funnel-chart.tsx
   │  │  │          heatmap.tsx chart-tooltip.tsx chart-legend.tsx chart-empty.tsx
   │  │  ├─ data-table.tsx  bulk-bar.tsx  pagination.tsx  filter-bar.tsx  filter-pill.tsx  search-input.tsx
   │  │  ├─ saved-views-menu.tsx  segmented.tsx  view-switcher.tsx
   │  │  ├─ page-header.tsx  section-card.tsx  key-value-grid.tsx  callout.tsx  chip.tsx
   │  │  ├─ drawer.tsx (side panel, 480/640)  confirm-dialog.tsx
   │  │  ├─ empty-state.tsx  error-state.tsx  skeletons.tsx  filtered-empty.tsx
   │  │  ├─ timeline.tsx (vertical, day-grouped, icon nodes)
   │  │  ├─ user-avatar.tsx  avatar-stack.tsx  badges.tsx (tone-badge, dot-badge, count-badge)
   │  │  ├─ workload-bar.tsx  meter.tsx
   │  │  ├─ mini-calendar.tsx  date-time-field.tsx  amount-input.tsx  phone-input.tsx
   │  │  ├─ file-uploader.tsx (dropzone, type/size checks, previews)  mapping-table.tsx (column → field + confidence)
   │  │  └─ kbd.tsx
   │  ├─ ai/                   # AI UI (owned by M7 after Phase 1)
   │  │  ├─ ai-panel.tsx  ai-fab.tsx  demo-ai-badge.tsx  paste-and-fill-box.tsx  voice-button.tsx
   │  │  ├─ ai-field.tsx (AI-filled marker wrapper)  missing-questions.tsx  action-proposal-card.tsx
   │  │  └─ ai-suggestion-chip.tsx  ai-hero.tsx  effort-saved.tsx
   │  ├─ domain/               # cross-module domain widgets (owner per file in §8.2)
   │  │  ├─ lead-card.tsx  lead-pills.tsx (temperature / stage / source)  contact-actions.tsx (tel: + wa.me)
   │  │  ├─ property-card.tsx  property-pills.tsx  match-list.tsx  match-explain.tsx
   │  │  ├─ appointment-card.tsx  task-row.tsx
   │  │  ├─ assign-dialog.tsx  stage-change-dialog.tsx (Lost reason / Booked amount+property)
   │  │  ├─ appointment-form-dialog.tsx  task-form-dialog.tsx  log-activity-dialog.tsx
   │  │  ├─ entity-link.tsx  activity-timeline.tsx (Activity → Timeline items, i18n-rendered)
   │  │  └─ notification-item.tsx
   │  └─ illustrations/        # inline SVG set from DESIGN_SYSTEM §9
   ├─ domain/
   │  ├─ types.ts              # ALL entity types, complete up front (§2.1)
   │  └─ catalogue.ts          # stages, sources, property types/families/configs, cities→localities,
   │                           # amenities, lost reasons, authorities, banks, appointment types, task types
   ├─ data/
   │  └─ seed/ index.ts (buildSeed(now)) dates.ts users.ts properties.ts leads.ts clients.ts
   │           appointments.ts tasks.ts activities.ts notifications.ts assignments.ts imports.ts drafts.ts settings.ts
   ├─ store/
   │  ├─ db-store.ts           # zustand + immer + persist ('crm-e2e-db'); state = { db: DB }
   │  ├─ session-store.ts      # zustand + persist ('crm-e2e-session'): role, userId, sidebar, aiPanel
   │  ├─ rebase.ts             # shifts every date when the persisted anchorDate ≠ today (§6.3)
   │  └─ migrate.ts            # schemaVersion check → reseed on mismatch
   ├─ services/                # the data-access layer: the ONLY code that writes the store
   │  ├─ core/ commit.ts events.ts effects.ts ids.ts undo.ts actor.ts
   │  ├─ users.ts leads.ts clients.ts properties.ts matching.ts appointments.ts tasks.ts
   │  ├─ activities.ts notifications.ts assignments.ts imports.ts drafts.ts settings.ts
   │  ├─ automation.ts (timers: SLA, reminders, overdue, stalled)  demo.ts (reset)  commands.ts (AI proposals → services)
   │  └─ queries/ visibility.ts today.ts stats.ts lookups.ts   # pure read functions (db, user, now) → data
   ├─ hooks/
   │  ├─ use-db.ts (typed selectors + useShallow)  use-current-user.ts  use-permission.ts  use-now.ts
   │  ├─ use-media-query.ts  use-reduced-motion.ts  use-speech.ts  use-hotkeys.ts
   ├─ lib/
   │  ├─ utils.ts  tones.ts  theme.ts  amount.ts  format.ts  phone.ts  dates.ts  whatsapp.ts  validation.ts
   │  ├─ classification.ts  qualification.ts  scoring.ts  next-action.ts  duplicates.ts
   │  ├─ matching.ts  property.ts  places.ts  search.ts  lead-queries.ts
   │  ├─ permissions.ts  assignment.ts  stalled.ts
   │  └─ *.test.ts             # co-located vitest files
   ├─ ai/
   │  ├─ types.ts              # AIService interface + result shapes (§2.3)
   │  ├─ index.ts              # getAI(): picks the provider from env; useAI() hook; AIProvider context
   │  ├─ context.ts            # builds AIContext (actor, role, route, selection, now, db getter)
   │  ├─ simulated/ provider.ts parse.ts extract-lead.ts extract-property.ts extract-appointment.ts
   │  │             qualify.ts intents.ts commands.ts messages.ts summarize.ts insights.ts columns.ts
   │  ├─ live/ provider.ts     # fetch(VITE_AI_ENDPOINT), same shapes; per-method fallback to simulated
   │  └─ document/ index.ts pdf-text.ts ocr.ts   # owned by M5; file → text
   ├─ i18n/
   │  ├─ index.ts              # loads locales/*/*.json with import.meta.glob (eager); new files need no edit
   │  └─ locales/en/<ns>.json  locales/ta/<ns>.json
   │     ns = common shell catalogue activity notifications ai today leads clients properties matching
   │          appointments tasks pipeline import reports team settings
   └─ modules/
      └─ <module>/ routes.tsx  pages/  components/  lib/  (+ i18n lives in src/i18n/locales/*/<ns>.json)
         modules = today leads clients properties matching appointments tasks pipeline import reports
                   team settings notifications activity
```

**Import rules** (checked in review):

- `modules/X` may import from `app/paths`, `components/**`, `domain/**`, `services/**`, `hooks/**`, `lib/**`, `ai/**` and `i18n`.
- **It never imports from `modules/Y`.** Cross-module UI goes through `components/domain/*`, and navigation goes through `app/paths.ts`.
- UI code **never calls `useDbStore.setState`** and never imports `store/db-store` for writes. Reads go through `hooks/use-db.ts`. Writes go through `services/*`.
- `lib/**` is pure: no React and no store. `services/queries/**` is pure (takes `db`).

### 2.1 Domain types (`src/domain/types.ts`, complete in Phase 1)

The foundation writes this file in full, so modules do not need to touch it. It is a refinement of `wireframe-rebuild/src/data/types.ts`.

```ts
// ── primitives
export type ID = string
export type ISODate = string        // 'YYYY-MM-DD', local calendar day (build with lib/dates, never toISOString().slice)
export type ISODateTime = string    // full ISO from Date#toISOString()
export type Money = number          // whole rupees
export type Role = 'admin' | 'manager' | 'executive'
export type EntityKind = 'lead' | 'client' | 'property' | 'appointment' | 'task' | 'user' | 'importJob' | 'draft' | 'settings'
export type EntityRef = { kind: EntityKind; id: ID }
export type ActorId = ID | 'system'
export type Origin = 'manual' | 'ai' | 'import' | 'automation'
export type FieldMeta = { origin: Origin; confidence?: number /* 0–1 */ }
export type FieldMetaMap = Record<string, FieldMeta>          // keyed by field path, e.g. 'requirement.budgetMax'

// ── users
export type Availability = 'available' | 'inVisit' | 'onLeave'
export type UserStatus = 'active' | 'deactivated'
export type MonthlyTargets = { calls: number; siteVisits: number; bookings: number; revenue: Money }
export interface User {
  id: ID; name: string; role: Role; email: string; phone: string
  managerId?: ID                      // executives → their manager
  status: UserStatus; availability: Availability; leaveUntil?: ISODate
  languages: string[]                 // 'English' | 'Hindi' | 'Tamil' | 'Kannada' | 'Telugu' | 'Marathi' …
  cities: string[]; propertyFocus: PropertyCategory[]
  targets?: MonthlyTargets
  joinedAt: ISODate; deactivatedAt?: ISODateTime
}

// ── catalogue keys (labels in i18n 'catalogue' ns)
export type LeadSource = 'phone' | 'whatsapp' | 'website' | 'walkIn' | 'acres99' | 'magicbricks' | 'housing' | 'nobroker'
  | 'facebook' | 'instagram' | 'googleAds' | 'channelPartner' | 'referral' | 'manual' | 'other'
export type PipelineStageKey = 'new' | 'contacted' | 'qualified' | 'siteVisitScheduled' | 'siteVisitDone'
  | 'negotiation' | 'booked' | 'converted' | 'lost'
export type Temperature = 'hot' | 'warm' | 'cold'
export type Priority = 'high' | 'medium' | 'low'
export type LostReason = 'budgetMismatch' | 'boughtElsewhere' | 'notResponding' | 'location' | 'loanRejected' | 'other'
export type BuyerPurpose = 'selfUse' | 'investment' | 'rental' | 'business'
export type LoanStatus = 'notNeeded' | 'needed' | 'preApproved' | 'unknown'
export type Timeline = 'immediate' | 'm1to3' | 'm3to6' | 'm6to12' | 'exploring'
export type DecisionMaker = 'self' | 'spouse' | 'parents' | 'family' | 'partner' | 'company'
export type Authority = 'sole' | 'joint' | 'needsApproval'
export type Need = 'clear' | 'partly' | 'exploring'
export type PossessionPref = 'ready' | 'underConstruction' | 'any'
export type Furnishing = 'unfurnished' | 'semi' | 'full'
export type Facing = 'N' | 'E' | 'S' | 'W' | 'NE' | 'NW' | 'SE' | 'SW'
export type Configuration = '1RK' | '1BHK' | '2BHK' | '2.5BHK' | '3BHK' | '4BHK+'
export type PropertyType = 'apartment' | 'villa' | 'independentHouse' | 'rowHouse' | 'plot' | 'agriLand'
  | 'office' | 'shop' | 'showroom' | 'warehouse' | 'coworking'
export type PropertyFamily = 'flat' | 'house' | 'plot' | 'land' | 'commercial' | 'warehouse'  // drives the dynamic form
export type PropertyCategory = 'residential' | 'commercial' | 'land'
export type PropertyStatus = 'available' | 'onHold' | 'booked' | 'sold'
export type ListingState = 'draft' | 'live' | 'archived'
export type AreaUnit = 'sqft' | 'sqyd' | 'cents' | 'acres' | 'guntha'
export type Classification = 'general' | 'qualifiedBuyer' | 'investor' | 'highValue' | 'potentialHni' | 'verifiedHni'

// ── leads
export interface Requirement {
  propertyTypes: PropertyType[]; configurations: Configuration[]
  cities: string[]; localities: string[]
  budgetMin?: Money; budgetPreferred?: Money; budgetMax?: Money; budgetFlexPct: number   // default 10
  budgetBasis?: 'propertyOnly' | 'allIn' | 'withLoan'
  areaMinSqft?: number; areaMaxSqft?: number
  possession: PossessionPref; possessionBy?: ISODate
  furnishing?: Furnishing | 'any'; facing: Facing[]; vastu?: boolean
  parking?: 'required' | 'preferred' | 'notNeeded'; floorPref?: 'low' | 'mid' | 'high' | 'any'
  transaction?: 'newBooking' | 'resale' | 'any'
  amenities: string[]; mustHaves: string[]          // must-haves: free text ("covered parking", "near metro")
  purpose: 'sale' | 'rent' | 'lease'
}
export interface Qualification {                     // Budget/Authority/Need/Timeline internally; never labelled "BANT"
  need?: Need; timeline?: Timeline; authority?: Authority; decisionMakers: DecisionMaker[]
  buyerPurpose?: BuyerPurpose; loan: LoanStatus; fundingReady?: 'ready' | 'arranging' | 'undecided'
}
export type ShortlistStatus = 'suggested' | 'shortlisted' | 'shared' | 'visited' | 'liked' | 'notInterested'
export interface ShortlistItem { propertyId: ID; status: ShortlistStatus; at: ISODateTime; by: ActorId; note?: string }
export interface StageEntry { stage: PipelineStageKey; at: ISODateTime; by: ActorId }
export interface Deal { propertyId?: ID; value?: Money; offered?: Money; counter?: Money; bookingAmount?: Money; bookedAt?: ISODateTime; notes?: string }
export interface Lead {
  id: ID                                  // 'LEAD-1001' (also the display code)
  name: string; phone: string             // E.164 '+919845012345'; display via lib/phone
  altPhone?: string; email?: string
  source: LeadSource; sourceDetail?: string           // campaign, CP firm, referrer
  isNri: boolean; nriCountry?: string; preferredLanguage?: string
  contactPref?: 'call' | 'whatsapp' | 'email'; familySize?: number
  ownerId: ID | null; firstOwnerId?: ID              // first owner never changes (attribution)
  createdBy: ActorId; createdAt: ISODateTime; updatedAt: ISODateTime; createdVia: Origin
  stage: PipelineStageKey; stageSince: ISODateTime; stageHistory: StageEntry[]
  temperatureOverride?: Temperature; priorityOverride?: Priority
  requirement: Requirement; qualification: Qualification
  engagement: { responded: boolean; docsRequested: boolean; siteVisited: boolean }
  firstContactAt?: ISODateTime; lastContactAt?: ISODateTime
  shortlist: ShortlistItem[]; deal?: Deal
  lost?: { reason: LostReason; note?: string; at: ISODateTime; by: ActorId }
  classification?: Classification                   // manager override; else suggested (lib/classification)
  hni?: { status: 'notDetermined' | 'potential' | 'consentInProgress' | 'verified' | 'declined'; signals?: Record<string, string> }
  consent?: { followUp: boolean; at: ISODateTime; how: string; withdrawnAt?: ISODateTime }
  tags: string[]; clientId?: ID; importJobId?: ID
  fieldMeta?: FieldMetaMap                           // AI-filled / imported markers
}
// Not stored, always derived: score, temperature (unless override), priority, nextFollowUp (earliest open task), daysInStage, stalled.

// ── clients (created when a lead is Booked)
export interface Client {
  id: ID; leadId: ID; name: string; phone: string; email?: string; ownerId: ID; city?: string
  propertyId?: ID; dealValue?: Money; bookingAmount?: Money; bookedAt: ISODateTime
  status: 'booked' | 'agreement' | 'loanProcessing' | 'registered' | 'converted' | 'cancelled'
  loan?: { bank?: string; status: 'notApplied' | 'applied' | 'sanctioned' | 'disbursed'; amount?: Money }
  kyc: 'pending' | 'done'; documents: { name: string; status: 'pending' | 'received' | 'verified' }[]
  createdAt: ISODateTime; updatedAt: ISODateTime; notes?: string
}

// ── properties
export interface PropertyArea { carpet?: number; builtUp?: number; superBuiltUp?: number; plot?: number; plotUnit?: AreaUnit; plotLengthFt?: number; plotWidthFt?: number }
export interface Media { id: ID; kind: 'photo' | 'floorPlan' | 'brochure'; url: string /* /demo-photos/x.jpg or data: URL */; caption?: string; isCover?: boolean }
export interface Property {
  id: ID                                  // 'PRP-1001'
  title: string; description?: string
  type: PropertyType; category: PropertyCategory          // category derived from type at write time
  purpose: 'sale' | 'rent' | 'lease'; transaction: 'newBooking' | 'resale'
  configuration?: Configuration; projectName?: string; builderName?: string
  location: { city: string; locality: string; address?: string; landmark?: string; pincode?: string; lat?: number; lng?: number }
  price: Money; priceNegotiable?: boolean; maintenancePerMonth?: Money
  area: PropertyArea                       // primary sqft via lib/property.primaryAreaSqft()
  bedrooms?: number; bathrooms?: number; balconies?: number; floor?: number; totalFloors?: number
  facing?: Facing; vastuCompliant?: boolean; corner?: boolean
  parking: { covered: number; open: number }; furnishing?: Furnishing; gatedCommunity?: boolean
  amenities: string[]
  possession: { status: 'ready' | 'underConstruction'; date?: ISODate }
  rera?: { number: string; verified: boolean }
  approvals: { authority: string; docStatus: 'pending' | 'uploaded' | 'verified' }[]
  khata?: 'A' | 'B' | 'E'; pattaAvailable?: boolean
  bankApprovals: string[]; loanEligible?: boolean; roadWidthFt?: number
  specs: Record<string, string | number | boolean>    // family-specific extras from catalogue (washrooms, powerKva, dockDoors, soil…)
  status: PropertyStatus; listing: ListingState; heldUntil?: ISODateTime; heldForLeadId?: ID
  media: Media[]
  owner?: { name: string; phone: string; kind: 'builder' | 'owner' | 'channelPartner' }
  commissionPct?: number
  createdBy: ActorId; createdAt: ISODateTime; updatedAt: ISODateTime; listedAt?: ISODateTime
  importJobId?: ID; fieldMeta?: FieldMetaMap
}

// ── appointments
export type AppointmentType = 'siteVisit' | 'officeMeeting' | 'phoneCall' | 'videoCall' | 'documentation'
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'noShow' | 'cancelled' | 'rescheduled'
export interface VisitOutcome {
  result: 'interested' | 'thinking' | 'notInterested' | 'readyToBook'
  interest?: 'high' | 'medium' | 'low'; likedPropertyIds: ID[]; objections?: string
  decisionMakerPresent?: boolean; nextStep?: string; nextFollowUpAt?: ISODateTime; summary?: string
  at: ISODateTime; by: ActorId
}
export interface Appointment {
  id: ID; type: AppointmentType; status: AppointmentStatus
  leadId?: ID; clientId?: ID; propertyIds: ID[]; ownerId: ID
  start: ISODateTime; durationMin: number
  location?: { text: string; mapUrl?: string }        // site visit defaults to the property address + Google Maps search URL
  reminderMins: number                                // default 60
  notes?: string; outcome?: VisitOutcome; rescheduledFrom?: ISODateTime; cancelReason?: string
  createdBy: ActorId; createdAt: ISODateTime; updatedAt: ISODateTime; fieldMeta?: FieldMetaMap
}

// ── tasks / follow-ups
export type TaskType = 'call' | 'whatsapp' | 'followUp' | 'email' | 'meeting' | 'document' | 'other'
export type TaskStatus = 'open' | 'done' | 'cancelled'
export type AutoTaskReason = 'slaFirstCall' | 'postVisitCall' | 'noAnswerRetry' | 'noShowReschedule' | 'visitCancelledReschedule' | 'bookingDocs'
export interface Task {
  id: ID; title: string; type: TaskType; status: TaskStatus; priority: Priority
  leadId?: ID; clientId?: ID; appointmentId?: ID; ownerId: ID
  dueAt: ISODateTime; completedAt?: ISODateTime; outcome?: string
  callResult?: 'connected' | 'notReachable' | 'busy' | 'wrongNumber'
  createdBy: ActorId; createdAt: ISODateTime; origin: Origin; autoReason?: AutoTaskReason; notes?: string
}

// ── activity (one global log; timelines filter by ref)
export type ActivityKind =
  | 'lead.created' | 'lead.updated' | 'lead.stageChanged' | 'lead.assigned' | 'lead.reassigned' | 'lead.deleted' | 'lead.qualified' | 'lead.merged'
  | 'comm.call' | 'comm.whatsapp' | 'comm.email' | 'comm.sms' | 'note'
  | 'appointment.created' | 'appointment.rescheduled' | 'appointment.completed' | 'appointment.cancelled' | 'appointment.noShow'
  | 'task.created' | 'task.completed' | 'task.cancelled'
  | 'property.created' | 'property.updated' | 'property.statusChanged' | 'property.deleted' | 'property.shared' | 'property.shortlisted'
  | 'client.created' | 'client.updated' | 'import.completed' | 'draft.saved'
  | 'user.created' | 'user.updated' | 'user.deactivated' | 'user.activated' | 'user.availability' | 'settings.changed'
export interface Activity {
  id: ID; kind: ActivityKind; at: ISODateTime; actorId: ActorId
  refs: EntityRef[]                       // primary record first; a lead's timeline = activities with a ref to it
  params: Record<string, string | number | boolean | null>   // rendered by i18n 'activity' ns: t(`activity:${kind}`, params)
  text?: string                           // user-typed note/outcome (never translated)
  via: Origin                             // 'ai' entries show ✦ on timelines
}

// ── notifications
export type NotificationKind = 'assignment' | 'reassignment' | 'appointmentCreated' | 'appointmentReminder' | 'taskOverdue'
  | 'slaBreach' | 'escalation' | 'importFinished' | 'stageChanged' | 'booking' | 'propertyUnavailable'
  | 'leaveReassign' | 'stalledDeal' | 'deactivatedOwner' | 'duplicateFound' | 'system'
export interface Notification {
  id: ID; userId: ID; kind: NotificationKind; at: ISODateTime
  params: Record<string, string | number>; ref?: EntityRef
  priority: 'normal' | 'high'; readAt?: ISODateTime; dedupeKey?: string
}

// ── assignment history (append-only)
export type AssignmentMode = 'auto' | 'manual' | 'self' | 'import' | 'redistribution'
export type AssignmentReasonKey = 'lowestWorkload' | 'roundRobinTie' | 'ruleLocation' | 'rulePropertyType' | 'ruleLanguage'
  | 'ruleSource' | 'manual' | 'creatorOwns' | 'ownerDeactivated' | 'ownerOnLeave' | 'unassigned'
export interface Assignment {
  id: ID; leadId: ID; fromUserId: ID | null; toUserId: ID | null; at: ISODateTime; by: ActorId
  mode: AssignmentMode; reason: { key: AssignmentReasonKey; params?: Record<string, string | number> }
  workload?: Record<ID, number>           // snapshot of active-lead counts used for the decision
  note?: string
}

// ── import
export type ImportKind = 'leads' | 'apartments' | 'villas' | 'plots' | 'commercial' | 'document'
export interface ColumnMapping { column: string; field: string | null; confidence: number; method: 'template' | 'saved' | 'synonym' | 'fuzzy' | 'value' | 'manual' }
export interface MappingProfile { id: ID; name: string; kind: ImportKind; columns: Record<string, string>; createdBy: ID; createdAt: ISODateTime }
export interface ImportJob {
  id: ID; kind: ImportKind; fileName: string; fileType: 'xlsx' | 'csv' | 'pdf' | 'image' | 'text'
  template: 'default' | 'custom' | 'document'; createdBy: ID; createdAt: ISODateTime; finishedAt?: ISODateTime
  status: 'completed' | 'partial' | 'failed' | 'cancelled'
  mapping?: ColumnMapping[]; mappingProfileId?: ID
  counts: { total: number; imported: number; updated: number; skipped: number; duplicates: number; errors: number; drafts: number }
  createdIds: ID[]; draftIds: ID[]; errorRows: { row: number; messages: string[] }[]
}
// (A job in progress lives in the Import page's local state; only finished jobs are stored.)

// ── drafts (low-confidence or unfinished AI/import extractions)
export interface Draft {
  id: ID; kind: 'lead' | 'property' | 'appointment'; title: string
  payload: Record<string, unknown>        // partial LeadInput / PropertyInput / AppointmentInput
  fieldMeta: FieldMetaMap                 // confidence per field → low ones highlighted
  source: { type: 'paste' | 'voice' | 'pdf' | 'image' | 'import' | 'assistant'; fileName?: string; text?: string }
  createdBy: ID; createdAt: ISODateTime; updatedAt: ISODateTime
  status: 'open' | 'saved' | 'discarded'; savedAs?: EntityRef; importJobId?: ID
}

// ── settings
export interface PipelineStageDef { key: PipelineStageKey; order: number; enabled: boolean; targetDays: number; probability: number /* 0–1 */ }
export interface AssignmentRule {
  id: ID; kind: 'location' | 'propertyType' | 'language' | 'source'; values: string[]; userIds: ID[]; enabled: boolean
  scope: 'global' | { managerId: ID }
}
export type MessagePurpose = 'intro' | 'followUp' | 'visitConfirm' | 'postVisit' | 'offer' | 'share' | 'reminder'
export interface MessageTemplate { id: ID; purpose: MessagePurpose; channel: 'whatsapp' | 'sms' | 'email'; tone: 'english' | 'hinglish'; body: string /* {{firstName}} {{property}} {{time}} {{agent}} */ }
export interface Settings {
  assignment: { autoAssign: boolean; rules: AssignmentRule[]; rrCursor: ID | null; maxActivePerExec?: number }
  pipeline: { stages: PipelineStageDef[]; lostReasons: LostReason[] }
  sla: { firstResponseMins: number; escalateAfterMins: number; staleDays: number; hotNoContactDays: number }
  matching: { weights: { budget: number; location: number; size: number; amenities: number; preferences: number }; minScore: number; perProjectCap: number }
  scoring: { hotAt: number; warmAt: number }
  templates: MessageTemplate[]
  costs: { stampDutyPct: number; registrationPct: number; otherPct: number }
  extraAmenities: string[]; mappingProfiles: MappingProfile[]
}
export interface SavedView { id: ID; userId: ID; module: 'leads' | 'properties' | 'appointments' | 'tasks' | 'pipeline'; name: string; filters: Record<string, unknown>; sort?: { key: string; dir: 'asc' | 'desc' } }

// ── the database
export interface DB {
  meta: { schemaVersion: number; anchorDate: ISODate; seededAt: ISODateTime; counters: Record<string, number> }
  users: User[]; leads: Lead[]; clients: Client[]; properties: Property[]; appointments: Appointment[]
  tasks: Task[]; activities: Activity[]; notifications: Notification[]; assignments: Assignment[]
  importJobs: ImportJob[]; drafts: Draft[]; savedViews: SavedView[]; settings: Settings
}

// ── service input shapes (forms, AI extraction and import all produce these)
export type LeadInput = Omit<Lead, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'stageSince' | 'stageHistory' | 'shortlist' | 'engagement' | 'firstOwnerId' | 'createdVia' | 'tags' | 'stage'> & Partial<Pick<Lead, 'stage' | 'tags'>>
export type PropertyInput = Omit<Property, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'category'>
export type AppointmentInput = Omit<Appointment, 'id' | 'status' | 'createdBy' | 'createdAt' | 'updatedAt' | 'outcome'> & { status?: AppointmentStatus }
export type TaskInput = Omit<Task, 'id' | 'status' | 'createdBy' | 'createdAt' | 'completedAt'>
```

Display codes use the id: `LEAD-1001`, `PRP-1001`, `APT-…`, `TSK-…`, `CL-…`. Ids come from `services/core/ids.ts`, using `db.meta.counters`.

### 2.2 Catalogue (`src/domain/catalogue.ts`)

The catalogue is ported and extended from `wireframe-rebuild/src/data/catalogue.ts`. Labels are not stored here. They live in the i18n `catalogue` namespace, keyed by value.

- `STAGES: PipelineStageKey[]` in pipeline order.
- `OPEN_STAGES` = every stage except `converted` and `lost`.
- `STAGE_RANK` for forward-only moves.
- `LEAD_SOURCES`.
- `SOURCE_QUALITY`, a 0–1 prior per source used by scoring:
  - referral 0.9
  - walkIn 0.85
  - channelPartner 0.75
  - website 0.6
  - phone 0.6
  - whatsapp 0.6
  - acres99 0.5
  - magicbricks 0.5
  - housing 0.5
  - nobroker 0.45
  - googleAds 0.45
  - facebook 0.35
  - instagram 0.35
  - manual 0.5
  - other 0.4
- `PROPERTY_TYPES: Record<PropertyType, { family, category, configurable: boolean, areaFields: (keyof PropertyArea)[], required: string[], specs: FactDef[] }>`. The rebuild's per-type `facts` are reused:
  - `flat` → apartment
  - `house` → villa, independentHouse and rowHouse
  - `plot` → plot
  - `agri` → agriLand
  - `commercial` → office, shop, showroom and coworking
  - `industrial` → warehouse
- `CONFIGURATIONS`, `FACINGS`, `FURNISHING`.
- `CITIES: Record<string, string[]>`, with real localities:
  - **Bengaluru:** Whitefield, Sarjapur Road, Hebbal, Electronic City, HSR Layout, Yelahanka.
  - **Chennai:** OMR, Porur, Tambaram, Velachery, Anna Nagar, Perungudi.
  - **Hyderabad:** Gachibowli, Kokapet, Kondapur, Miyapur, Tellapur.
  - **Pune:** Hinjewadi, Wakad, Baner, Kharadi, Hadapsar.
  - **Mumbai:** Thane, Navi Mumbai, Powai, Andheri East, Kharghar.
  - **NCR:** Gurugram, Noida, Greater Noida West, Dwarka Expressway.
- `AMENITIES`: the rebuild's list plus covered parking, kids' play area, jogging track, EV charging, and 24×7 water.
- `APPROVAL_AUTHORITIES`: BBMP, BDA, BMRDA, BIAAPA, CMDA, DTCP, HMDA, GHMC, PMRDA, PMC, MHADA, CIDCO, MMRDA, GMDA, DTCP Haryana, Noida Authority, YEIDA, and Other.
- `BANKS`: SBI, HDFC Bank, ICICI Bank, Axis Bank, LIC HFL, Kotak, and Bank of Baroda.
- `LOST_REASONS`, `APPOINTMENT_TYPES`, `TASK_TYPES`, `DEFAULT_STAGE_DEFS`, and `DEFAULT_SETTINGS`.

### 2.3 AI service contract (`src/ai/types.ts`, written in Phase 1)

```ts
export type AIMode = 'simulated' | 'live'
export interface AIContext { actor: User; role: Role; route: string; selection?: EntityRef; now: Date; db: () => DB }
export interface AIQuestion { field: string; prompt: string /* i18n key */; chips?: { label: string; value: unknown }[]; essential: boolean }
export interface Extraction<T> {
  mode: AIMode; fields: Partial<T>; meta: FieldMetaMap /* origin 'ai' + confidence */
  missing: string[]; questions: AIQuestion[]; filledCount: number; notes?: string[]
  duplicates?: { leadId: ID; by: 'phone' | 'email' }[]           // leads only
}
export interface AIText { mode: AIMode; text: string; bullets?: string[]; links?: EntityRef[] }
export interface LeadScore { score: number; temperature: Temperature; probability: number; factors: { key: string; points: number; max: number; detail?: string }[] }
export interface QualificationResult { known: ('budget' | 'authority' | 'need' | 'timeline')[]; missing: (typeof known)[number][]; inferred: Partial<Qualification>; questions: AIQuestion[] }
export type ProposalKind = 'createLead' | 'updateLead' | 'assignLead' | 'moveStage' | 'createAppointment' | 'rescheduleAppointment'
  | 'createTask' | 'completeTask' | 'shortlistProperty' | 'shareProperties' | 'logActivity' | 'createProperty' | 'updateProperty'
export interface ActionProposal { id: ID; kind: ProposalKind; permission: Action; summary: { label: string; value: string }[]; payload: unknown; targets?: EntityRef[] }
export interface CommandPlan {
  mode: AIMode; intent: string; reply: AIText
  proposals: ActionProposal[]                 // nothing runs until the user confirms (services/commands.executeProposal)
  refusal?: { action: Action; reasonKey: string }
  results?: { kind: EntityKind; ids: ID[] }   // for query intents ("my highest-priority leads")
}
export interface AIService {
  readonly mode: AIMode
  extractLead(text: string, ctx: AIContext): Promise<Extraction<LeadInput>>
  extractProperty(text: string, ctx: AIContext): Promise<Extraction<PropertyInput>>
  extractAppointment(text: string, ctx: AIContext): Promise<Extraction<AppointmentInput>>
  qualifyLead(leadId: ID, ctx: AIContext): Promise<QualificationResult>
  scoreLead(leadId: ID, ctx: AIContext): Promise<LeadScore>
  matchProperties(leadId: ID, ctx: AIContext): Promise<{ matches: Match[]; text: AIText }>
  summarize(target: { kind: 'lead' | 'appointment' | 'day' | 'team' | 'business' | 'pipeline' | 'visitPrep' | 'visitSummary'; id?: ID }, ctx: AIContext): Promise<AIText>
  generateMessage(req: { leadId: ID; purpose: MessagePurpose; channel: 'whatsapp' | 'sms' | 'email'; tone: 'english' | 'hinglish'; propertyIds?: ID[]; appointmentId?: ID }, ctx: AIContext): Promise<AIText>
  suggestNextAction(leadId: ID, ctx: AIContext): Promise<{ key: string; params?: Record<string, string | number>; action?: ActionProposal }>
  insights(scope: 'personal' | 'team' | 'business', ctx: AIContext): Promise<AIText>
  mapColumns(headers: string[], sample: string[][], kind: ImportKind, ctx: AIContext): Promise<ColumnMapping[]>
  parseCommand(text: string, ctx: AIContext): Promise<CommandPlan>
}
```

- **Provider selection.** `getAI()` returns the simulated provider unless `VITE_AI_PROVIDER=live` **and** `VITE_AI_ENDPOINT` is set.
- **Live provider.** It POSTs `{ task, input, context: slimContext }` to the endpoint and expects the same JSON shapes. Any method that fails or is not implemented falls back to the simulated provider, and the returned `mode` is then `'simulated'`.
- **Demo AI badge.** Every component that shows AI output reads `result.mode` and renders `<DemoAIBadge mode={…}/>`. The UI never assumes the mode.
- **Phase 1 scope.** The foundation ships a working simulated provider for `extractLead`, `extractProperty`, `extractAppointment`, `scoreLead`, `qualifyLead`, `matchProperties` and `generateMessage`, plus basic `parseCommand` (create lead and show today's tasks). It builds these by porting `lib/ai/parse.ts` and `understand.ts`. The other methods return a simple, honest text. M7 deepens all of them.

---

## 3. Permission map

### 3.1 Final matrix

This is the matrix from `ROLE_RESEARCH.md` §6, which supersedes master prompt §5.3. It is implemented in `src/lib/permissions.ts`.

Scope values:

- **all:** any record.
- **team:** records owned by the manager's reports, plus unassigned records.
- **own:** for leads, tasks, appointments and clients, `ownerId === user.id`. For properties, `createdBy === user.id`.
- **–:** denied.

| Action key | Admin | Manager | Executive |
|---|---|---|---|
| `user.manage` (create / activate / deactivate / change role) | all | – | – |
| `user.setAvailability` | all | team | own |
| `team.view` | all | team | – |
| `rules.configure` (assignment rules, auto-assign on/off) | all | team | – |
| `settings.pipeline` (stages, lost reasons) | all | – | – |
| `settings.templates` (message templates) | all | – | – |
| `settings.matching` (weights, SLA, scoring thresholds) | all | – | – |
| `settings.preferences` (theme, language, own profile) | own | own | own |
| `demo.reset` | all | – | – |
| `lead.view` | all | team | own |
| `lead.create` | all | all | all (owner = self; auto-assign does not reassign it) |
| `lead.edit` | all | team | own |
| `lead.delete` (with undo) | all | team | – (mark Lost) |
| `lead.assign` (assign / reassign / auto-assign) | all | team | – |
| `lead.requestReassign` | – | – | own |
| `lead.moveStage` | all | team | own |
| `lead.markBooked` | all | team | own (manager notified) |
| `lead.viewHni` | all | all | – (shows "Restricted") |
| `lead.export` / `export.data` | all | team | – |
| `client.view` / `client.edit` | all | team | own |
| `property.view` | all | all | all |
| `property.create` | all | all | all |
| `property.edit` (any field incl. price & status) | all | all | own |
| `property.delete` | all | – | – |
| `matching.run` | all | all | all (lead side limited to own leads) |
| `appointment.view` / `appointment.manage` | all | team | own |
| `task.view` / `task.manage` | all | team | own |
| `import.leads` (bulk) | all | all (assigned within team) | – |
| `import.properties` (bulk) | all | – | – |
| `import.document` (single record from a PDF / image / paste) | all | all | all |
| `report.view` | all (business) | team | own ("My performance") |
| `activity.viewLog` (global log page) | all | team | – (timelines on own records only) |
| `ai.use` | all | all | all (every AI proposal re-checks its own permission) |

**Decision: managers cannot bulk-import properties.** The research allows managers to import leads only. Property inventory stays admin-controlled, so sold units are not pitched. A manager can still add a property one at a time, including from a brochure through `import.document`.

### 3.2 API (`src/lib/permissions.ts`, pure, unit-tested)

```ts
export type Action = /* union of the keys above */
export type Scope = 'all' | 'team' | 'own' | false
export const MATRIX: Record<Role, Record<Action, Scope>>
export type Scoped = { ownerId?: ID | null; createdBy?: ActorId }
export function scopeOf(user: User, action: Action): Scope
export function can(user: User, action: Action, record?: Scoped, db?: Pick<DB, 'users'>): boolean
//  record omitted → true if scope !== false (used for nav, routes, "create" buttons)
//  'team' → record.ownerId is null OR owner.managerId === user.id OR owner === user.id
export function explainDenied(user: User, action: Action): { reasonKey: string; params: Record<string, string> } // used by NoAccess + AI refusals
export const visible = { leads(db, user), tasks(db, user), appointments(db, user), clients(db, user), activities(db, user) } // in services/queries/visibility.ts
```

- **Hook.** `usePermission()` returns `{ can: (action, record?) => boolean, scope: (action) => Scope, user }`.
- **Route guard.** `<RequirePermission action="team.view">` wraps the route element. When the check fails it renders `<NoAccessPage action=… />`. That page shows the `NoAccess` illustration, the text "This area isn't available for {{role}}", a list of what the role *can* do, and a **Go to Today** button. Every route in the registry declares its `permission`. The router wraps it automatically.
- **Buttons.** Action buttons are not just disabled: they are **hidden** when the scope is `false`. Disabled-with-tooltip is used only when the action is allowed for the role but not for this record (for example, an executive on a property somebody else created).
- **Services enforce permissions as well.** Every write service calls `assertCan(actor, action, record)` and throws `PermissionError`. The UI turns that into a toast.
- **AI.** `parseCommand` and `executeProposal` call the same `can()`. A denied proposal becomes `refusal` with `explainDenied()`. The panel shows it in a neutral card with a Lock icon and the reason, for example "Sales Executives can't reassign leads. You can ask your manager: Request reassignment".

---

## 4. Profile switcher

- **Session store** (`store/session-store.ts`, persisted as `crm-e2e-session`):

  ```ts
  { role: Role; userId: ID; sidebarCollapsed: boolean; aiPanelOpen: boolean }
  ```

  - The default is `{ role: 'executive', userId: 'u-arjun' }`, which gives the strongest first impression.
  - The admin user is always `u-admin` and the manager is always `u-rohit`.
- **Switcher UI.** It sits at the bottom of the sidebar and follows `DESIGN_SYSTEM.md` §11.1.
  - The popover shows exactly three role rows.
  - The **Sales Executive** row expands inline to the three switchable executives: `u-arjun` (primary), `u-sneha` and `u-vikram`. Each one shows an avatar, name, active-lead count and an availability dot.
  - Farhan (on leave) and Kavya (deactivated) are **not** switchable. They appear only in Team.
- **Switching** calls `session.switchProfile(role, userId)`. That:
  - updates the store, so every `useCurrentUser()` consumer re-renders without a reload;
  - shows the toast "Now viewing as {{name}} · {{role}}";
  - cross-fades the content over 200 ms;
  - navigates to `/today` when the current route is not allowed for the new role, and otherwise stays on the current route.
- **`useCurrentUser()`** returns the `User` record from the db for `session.userId`. If that record is missing or deactivated (for example after a reset), the hook falls back to the default user for that role.
- **Data scope** follows the user automatically, because every list reads `services/queries/visibility.ts` with the current user.
- **Mobile.** The avatar in the topbar opens the same switcher as a bottom sheet.

---

## 5. Store and event model

### 5.1 Store

- **`useDbStore`**, defined as `create<DbState>()(persist(immer((set, get) => …), {...}))`:
  - The state is `{ db: DB; hydrated: boolean }`.
  - The only setter is the internal `_apply(recipe)`.
  - Persist options:
    - `name: 'crm-e2e-db'`, `version: 1`;
    - `partialize: s => ({ db: s.db })`;
    - `migrate`: if the persisted `schemaVersion` ≠ the current one, reseed;
    - `onRehydrateStorage`: run `rebaseDates`, then `automation.tick(now)`.
  - When storage is blocked (private mode), it falls back to memory, as in the rebuild.
- **Reads** use `useDb(selector)`, a thin wrapper with `useShallow`. Derived data such as scores and matches is computed in `services/queries/*` and `lib/*`, and memoised per `db` identity with `useMemo`. The data is small (about 45 leads and 20 properties), so there is no cache layer.
- **Writes** happen only in `services/*`, through `commit()`.

### 5.2 `commit()` and domain events (`services/core/*`)

```ts
type Tx = { db: Draft<DB>; actor: User | SystemActor; now: ISODateTime; via: Origin;
            emit(e: DomainEvent): void; id(prefix: 'LEAD'|'PRP'|'APT'|'TSK'|'CL'|'ACT'|'NTF'|'ASG'|'IMP'|'DRF'|'SV'|'U'): ID }
export function commit<R>(label: string, fn: (tx: Tx) => R, opts?: { via?: Origin; undoable?: boolean }): { result: R; undoToken?: string }
```

1. `commit` takes a snapshot of the current `db` when the change is undoable (one level, kept for 10 s in `undo.ts`).
2. It runs `fn` inside the immer draft.
3. It then drains the event queue through `effects.ts` handlers in the **same draft**. A handler may emit further events, up to a depth of 5.
4. It applies the result once, which means one re-render.
5. It returns `{ result, undoToken }`. `services/core/undo.ts#undo(token)` restores the snapshot. Undo is used for delete, bulk actions and AI-applied changes.

`DomainEvent` is a discriminated union:

```
lead.created{leadId, via}  lead.updated{leadId, fields[]}  lead.stageChanged{leadId, from, to}
lead.assigned{leadId, from, to, mode, reasonKey}  lead.deleted{lead}  lead.contacted{leadId, channel, result}
lead.shortlisted{leadId, propertyId, status}  lead.shared{leadId, propertyIds, channel}
appointment.created{id}  appointment.rescheduled{id, from}  appointment.completed{id}  appointment.cancelled{id}  appointment.noShow{id}
task.created{id}  task.completed{id}  task.cancelled{id}
property.created{id}  property.updated{id, fields[]}  property.statusChanged{id, from, to}  property.deleted{property}
client.created{id}  import.completed{jobId}  draft.saved{id}
user.created{id}  user.updated{id}  user.deactivated{id}  user.activated{id}  user.availabilityChanged{id, from, to}
settings.changed{section}
```

### 5.3 Side effects (`services/core/effects.ts`): the interconnections of master prompt §7

The foundation implements all of these in Phase 1. Every one of them is covered by `services/core/effects.test.ts`.

| # | Event | Effects (all in the same commit) |
|---|---|---|
| E1 | *every event* | Append an `Activity` (kind, refs, params, via) through `activityFor(event)`. |
| E2 | `lead.created` | **Owner:** if the creator is an executive, owner = creator (`mode: 'self'`). Otherwise, if `ownerId` is null and `settings.assignment.autoAssign` is on, run the assignment engine (§5.4) and emit `lead.assigned` (auto). Otherwise leave the lead unassigned, which puts it in the Manager Today queue. **First-call task:** create a `call` task "Call {{name}}" due `createdAt + sla.firstResponseMins`, priority high, `autoReason: 'slaFirstCall'`, if there is an owner. **Duplicates:** if the phone or email matches an existing lead, notify the admin (`duplicateFound`). The UI already warned before save. |
| E3 | `lead.assigned` | Append an `Assignment` record. Set `firstOwnerId` if it is empty. Move the lead's **open tasks and future appointments** to the new owner. Notify the new owner (`assignment`, or `reassignment` with the previous owner's name). Notify the old owner (`reassignment`). If the lead had no owner, create the first-call task (E2). Advance `settings.assignment.rrCursor` when the mode is `auto`. |
| E4 | `lead.contacted` (call / WhatsApp / email logged, or a call task completed) | Set `lastContactAt`, and `firstContactAt` if it is empty. If the stage is `new`, move it to `contacted` (forward only). If the result was connected, set `engagement.responded = true`. If the result was `notReachable` or `busy`, create a `noAnswerRetry` call task due in 2 h, or at 10:00 tomorrow if that falls after 19:00. |
| E5 | `lead.stageChanged` | Set `stageSince` and append to `stageHistory`. **→ lost:** requires `lost.reason` (the service validates this); cancel open tasks; cancel future appointments (`cancelReason: 'leadLost'`). **→ booked:** requires `deal.bookingAmount` and `deal.propertyId`. Set the property to `status: 'booked'`, which emits `property.statusChanged`. Create a `Client` (`client.created`) and a `bookingDocs` task due in 3 days. Notify the manager and the admin (`booking`). **→ converted:** set the client to `converted` and the property to `sold`. **→ siteVisitScheduled** chosen manually with no future site visit: the UI opens the appointment dialog. The effect does not create one. Notify the owner when the actor is not the owner (`stageChanged`). |
| E6 | `appointment.created` (siteVisit) | If the lead's stage rank is below `siteVisitScheduled`, move it to `siteVisitScheduled` (forward only). Upsert the shortlist entries for its properties as `shortlisted`. Notify the owner when the creator ≠ owner (`appointmentCreated`). The conflict check runs in the service and returns `conflicts[]` to the UI as a warning. It never blocks. |
| E7 | `appointment.completed` | Store the outcome. Set `engagement.siteVisited = true` for site visits. If the stage rank is below `siteVisitDone`, move it to `siteVisitDone`. Set the shortlist to `visited`, or `liked` for each `likedPropertyIds`. Create a `postVisitCall` task due in 24 h, or at `outcome.nextFollowUpAt` if one was given. If `result === 'readyToBook'`, notify the manager. Set `lastContactAt`. |
| E8 | `appointment.noShow` / `appointment.cancelled` | Create a reschedule task due tomorrow at 11:00. The stage does not move back. |
| E9 | `appointment.rescheduled` | Set `status: 'rescheduled'` and `rescheduledFrom`. Notify the owner. |
| E10 | `task.completed` | For `call`, `whatsapp` and `followUp` tasks linked to a lead, emit `lead.contacted` (channel and result). |
| E11 | `lead.shared` | Set each shortlist entry to `shared`. Emit `lead.contacted` (WhatsApp). Append an Activity with the property ids. |
| E12 | `property.statusChanged` → booked / sold / onHold | Matching excludes booked and sold properties automatically, because the exclusion is derived. For every **other** open lead with that property in its shortlist or a future site visit, notify the owner (`propertyUnavailable`: "{{property}} is now Booked: see alternatives"). Future site visits for those leads are **not** cancelled; the notification asks the executive. |
| E13 | `property.deleted` | Cascade, ported from `db.tsx#deleteProperty`: remove it from shortlists, cancel scheduled site visits that include only that property, clear `deal.propertyId`, and add a note on each affected lead. |
| E14 | `user.deactivated` | The service takes `redistribute: 'auto' \| { toUserId } \| 'unassign'`. It reassigns every open lead (`mode: 'redistribution'`, `ownerDeactivated`), which moves their tasks and appointments through E3. The user is removed from the round-robin pool and from rules. If any leads remain, notify the admin (`deactivatedOwner`). |
| E15 | `user.availabilityChanged` → onLeave | Notify the manager (`leaveReassign`, "{{name}} is on leave: reassign {{count}} open leads?"). Manager Today shows a one-click "Reassign with auto-assign" proposal. The engine skips on-leave users. |
| E16 | `import.completed` | Notify the importer and every admin (`importFinished` with counts). Each created lead emits its own `lead.created` (E2 runs: auto-assign). Assignment notifications are **batched** per assignee: "{{count}} new leads assigned to you". |
| E17 | `client.created` | Activity, and link it on the lead (`clientId`). |
| E18 | `settings.changed` | An audit Activity (admin log). |

**Timers** live in `services/automation.ts#tick(now)`. It runs on hydrate and then every 60 s through `providers.tsx`. It is idempotent, because each notification carries a `dedupeKey`.

- `taskOverdue`: once per task, to its owner.
- `appointmentReminder`: once, `reminderMins` before the start, to the owner.
- `slaBreach`: a `new` lead with an owner and no `firstContactAt` after `firstResponseMins` notifies the owner. After `escalateAfterMins` it sends an `escalation` to the manager.
- **Unassigned queue:** an unassigned lead older than `firstResponseMins` sends `slaBreach` to the manager and the admin.
- `stalledDeal`: once per day per lead to the manager, when `daysInStage > 2 × targetDays` in qualified, siteVisitDone or negotiation.

The ticker never changes leads or tasks. It only adds notifications.

### 5.4 Assignment engine (`src/lib/assignment.ts`, pure, unit-tested)

```ts
export function pickAssignee(input: {
  lead: Pick<Lead, 'requirement' | 'source' | 'preferredLanguage'>
  users: User[]; leads: Lead[]; settings: Settings['assignment']; managerId?: ID
}): { userId: ID | null; reason: Assignment['reason']; workload: Record<ID, number>; candidates: ID[] }
```

1. **Pool:** executives with `status: 'active'` and `availability !== 'onLeave'`. `inVisit` users are still eligible. If a manager scope is given, only their reports are in the pool.
2. **Rules.** Each enabled rule whose `values` match the lead narrows the pool to `rule.userIds ∩ pool`, but only if the result is not empty. Rules are evaluated in this order: location, property type, language, source. They compare `requirement.cities` and `localities` against `values`, `propertyTypes`, `preferredLanguage` and `source`. The first rule that narrows the pool supplies the reason key (for example `ruleLocation`).
3. **Workload:** the count of the user's leads in `OPEN_STAGES`. If `maxActivePerExec` is set, users at the cap are dropped (unless that empties the pool).
4. Pick the lowest workload. On a **tie**, use round-robin. Order the tied users by `id`. Pick the first one after `rrCursor` in that order, wrapping around. The reason is `roundRobinTie`. Without a tie, the reason is `lowestWorkload` (or the rule reason).
5. If the pool is empty, return `userId: null` with reason `unassigned`. The lead stays in the queue and the UI explains why.

`services/assignments.ts` exposes:

- `assignLeads(ids, target: ID | 'auto', note?)`, which runs the engine once per lead, updating workloads between leads;
- `autoAssignAll(unassignedIds)`;
- `previewAuto(ids)`, which shows "who would get what" before confirming.

### 5.5 Derived logic (pure `lib/*`)

- **`scoring.ts`:** `leadScore(lead, ctx) → LeadScore`. The score is 0–100 and is the sum of these factors, each with a visible detail:

  | Factor | Points | How it is worked out |
  |---|---|---|
  | Qualification | 40 | The readiness points from `qualification.ts`, scaled from 100 to 40 |
  | Engagement and recency | 20 | responded +6, docs +4, site visited +6; −1 per day without contact after 2 days, minimum 0 |
  | Budget and inventory fit | 15 | The best match score over 100, times 15 |
  | Source quality | 10 | `SOURCE_QUALITY × 10` |
  | Urgency | 15 | Timeline immediate 15, 1–3 months 11, 3–6 months 7, 6–12 months 3, exploring 0; +2 for NRI or high value, capped at 15 |

  - **Temperature:** hot at `scoring.hotAt` (70) or above, warm at `warmAt` (45) or above, otherwise cold. An override wins.
  - **Probability:** `0.5 × stage.probability + 0.5 × score / 100`, with lost = 0 and converted = 1.
  - **Priority:** high when the lead is hot, a site visit is today, or something is overdue.
- **`qualification.ts`:** the rebuild's `readiness.ts` (6 parts, 100 points), plus `qualificationCard(lead)`:
  - It returns the four checks — **Budget** (`budgetMax` set), **Decision maker** (`authority` or `decisionMakers` set), **Requirement** (`need === 'clear'`, or types + cities + configuration known) and **Timeline** — with known and missing states.
  - Each missing check has an `AIQuestion` and quick-pick chips: Immediately / 1–3 months / 3–6 months / Just exploring; Spouse / Parents / Self; and so on.
  - The UI never shows the word "BANT".
- **`next-action.ts`:** ported from `features/leads/next-step.ts` and extended. It returns the rule-based next best action: a key, params, and the proposal kind.
- **`stalled.ts`:** `daysInStage` and `agingTone(daysInStage, targetDays)`. The tone is `muted` below 1×, `warning` from 1× to 2×, and `danger` (stalled) above 2×.
- **`duplicates.ts`:** `findDuplicates(db, { phone, email, excludeId })`. Phones are normalised to the last 10 digits, so +91, spaces and a leading 0 all compare equal.
- **`lead-queries.ts`:** filters, sorts, tabs and attention groups, ported from `features/leads/lead-list.ts` and adapted to the new stages. Today, Pipeline and Reports count leads the same way through this file.
- **`services/queries/today.ts`:** `executiveToday(db, user, now)`, `managerToday(db, user, now)` and `adminToday(db, user, now)`. Each returns structured, ranked items, each with `{ kind, reasonKey, params, dueAt, ref, actions[] }`. The ranking order comes from ROLE_RESEARCH §5.1:
  1. Uncalled new leads (TAT)
  2. Visits within 2 h
  3. Overdue follow-ups
  4. Post-visit calls due
  5. Hot leads not contacted for 3 days or more
  6. Stale leads

  Phase 1 builds a correct first version. M1 owns and refines it.
- **`services/queries/stats.ts`:** per-user and team aggregates, shared by Today, Reports, Team and AI insights:
  - calls and visits today, this week and this month;
  - bookings and revenue against targets;
  - the funnel and drop-off;
  - leads by source;
  - lost reasons;
  - inventory by status;
  - average time to first contact (TAT);
  - overdue counts per executive;
  - activity heatmap buckets.

---

## 6. Seed data plan (`src/data/seed/*`, `buildSeed(now = new Date())`)

All data is fictional. **Never use real builder brands** (Prestige, Sobha, Godrej, DLF, Brigade, Lodha, Hiranandani and so on). Project names are invented. Phone numbers are 10-digit Indian mobiles starting with 9, 8, 7 or 6, stored as E.164 and displayed `+91 98450 12345`. Emails use `@example.com`.

### 6.1 Relative-date helpers (`data/seed/dates.ts`)

```ts
export const makeClock = (now: Date) => ({
  at:   (dayOffset: number, hhmm = '10:00') => ISODateTime,   // local day start + offset days + time
  ago:  (amount: number, unit: 'minutes' | 'hours' | 'days') => ISODateTime,
  in:   (amount: number, unit: 'minutes' | 'hours' | 'days') => ISODateTime,
  day:  (dayOffset: number) => ISODate,                        // local YYYY-MM-DD
})
```

- All arithmetic uses `date-fns` in local time, which is IST on the demo machine.
- "Today" items that must still be upcoming use `in(...)`. Items for a fixed time of day use `at(0, 'HH:mm')`. The Today view handles both past and future times correctly.
- **Weekend-agnostic.** Visits are seeded on every day offset, whatever the weekday.

### 6.2 Users (7)

| id | Name | Role | Cities / focus | Languages | Availability | Monthly targets (calls / visits / bookings / revenue) |
|---|---|---|---|---|---|---|
| `u-admin` | Meera Iyer | admin | All | English, Tamil, Hindi | available | — |
| `u-rohit` | Rohit Khanna | manager | All | English, Hindi | available | team: 1500 / 55 / 8 / ₹9 Cr |
| `u-arjun` | Arjun Mehta (primary exec) | executive → u-rohit | Bengaluru · residential | English, Hindi, Kannada | available | 600 / 20 / 3 / ₹3.5 Cr |
| `u-sneha` | Sneha Reddy | executive → u-rohit | Hyderabad, Chennai · residential + commercial | English, Telugu, Tamil | available | 500 / 18 / 3 / ₹3 Cr |
| `u-vikram` | Vikram Singh | executive → u-rohit | Pune, Mumbai, NCR · residential | English, Hindi, Marathi | **inVisit** | 500 / 18 / 2 / ₹3 Cr |
| `u-farhan` | Farhan Qureshi | executive → u-rohit | Mumbai, NCR | English, Hindi, Urdu | **onLeave** until day +3 | 400 / 15 / 2 / ₹2 Cr |
| `u-kavya` | Kavya Joshi | executive → u-rohit | Pune | English, Marathi | **deactivated** 5 days ago | — |

Workloads (open leads) are designed so that the auto-assignment demo is visible:

- Arjun 6, Vikram 5, Sneha 4. Auto-assigning one lead goes to **Sneha** (lowest).
- Sneha then has 5 and ties with Vikram, so the next lead goes through **round-robin**. The cursor starts at `u-arjun` and moves to `u-sneha` after the first auto-assignment, so the tie goes to **Vikram**, with reason `roundRobinTie`.
- Farhan (on leave) is skipped. Kavya (deactivated) is skipped.
- Leads in Chennai or Hyderabad (for example Rajesh Nair, OMR) go to Sneha through the location rule, with reason `ruleLocation`. The Unassigned-queue demo therefore shows all three reasons.

### 6.3 Persistence and freshness

- `meta.anchorDate` is the local day of seeding.
- On hydrate, if `anchorDate ≠ today`, `store/rebase.ts` shifts **every date field** in every collection by the whole-day difference. It uses a registry of date paths per collection, and then sets `anchorDate = today`. This keeps "today", "overdue" and "upcoming" meaningful even with the user's edits, on any later day.
- **Reset demo data** (Settings, admin only, with a confirm dialog) calls `services/demo.reset()`, which runs `buildSeed(new Date())`. The session stays on the same profile.

### 6.4 Volumes and distribution

| Collection | Count | Distribution and must-haves |
|---|---|---|
| Leads, current pipeline | **23** | **Arjun 6:** Priya Sharma (hot, siteVisitScheduled, visit **today 11:00** Aranya Greens, Whitefield), Karthik Subramanian (hot, negotiation, ₹1.35 Cr), Ananya Iyer (warm, qualified, follow-up today), Mohammed Irfan (warm, contacted, **overdue call** −1d), Neha Kulkarni (new, created 25 min ago, **uncalled → SLA clock**), Deepak Verma (siteVisitDone yesterday, **post-visit call due today**). **Sneha 4:** Lakshmi Narayanan (hot, visit **today 16:00** Kokapet villa), Harish Reddy (hot, negotiation, **stalled 16 days**), Divya Menon (warm, qualified, **overdue** −2d), Sanjay Gupta (cold, contacted, stale 9 days). **Vikram 5:** Rohan Deshpande (hot, visit **today 12:30** Hinjewadi), Pooja Agarwal (warm, qualified, **overdue** −3d), Vivek Malhotra (new, **NRI**: Dubai, ₹3.2 Cr Gurugram, high value), Amit Joshi (cold, contacted, visit **today 12:45** that **conflicts** with Rohan's), Swati Chawla (booked: token ₹5 L, Thane Bayview). **Farhan 2 (on leave):** Nisha Kapoor (qualified, Thane), Gaurav Bansal (contacted, Noida). **Kavya 1 (deactivated):** Fatima Sheikh (contacted, Navi Mumbai). **Unassigned 5:** Sunita Patil (99acres, 15 min ago, Wakad 2BHK), Rajesh Nair (MagicBricks, 2 h, OMR), Aditya Rao (Facebook, 5 h, Hebbal), Tanvi Shah (website, 40 min, ₹2.5 Cr Gurugram, high value), "Mohd Irfan" (WhatsApp, same phone as Mohammed Irfan, a **duplicate**). Every source appears at least once across the current and historical leads. Budgets run from ₹45 L to ₹3.2 Cr. Requirements are complete enough for matching. At least 3 leads have `fieldMeta` origin `ai`. |
| Leads, historical (closed) | **20** | Created 30–180 days ago and owned by Arjun, Sneha, Vikram and Kavya. **15 converted** (bookedAt spread over the last 6 months, deal values ₹48 L–₹2.1 Cr, Sneha with the best conversion) and **5 lost** (one per lost reason). They feed the monthly report trends. |
| Clients | **16** | 15 from the historical conversions (statuses spread across agreement, loan processing, registered and converted) plus Swati Chawla (booked). |
| Properties | **20** | 8 apartments (Bengaluru 3, Chennai 1, Hyderabad 1, Pune 2, Mumbai 1), 3 villas (Kokapet, Sarjapur Road, Tellapur), 1 independent house (Anna Nagar), 1 row house (Wakad), 3 plots (Yelahanka, Tambaram, Greater Noida West), 1 office (Gachibowli), 1 shop (Baner), 1 warehouse (Hoskote / Bengaluru), and 1 co-working or showroom (Noida). Status: **12 available, 2 onHold, 3 booked, 3 sold** (the booked and sold ones are linked to clients). The mix covers ready and under construction, RERA numbers, approvals with pending docs, facing and Vastu, and covered parking. Covers come from `public/demo-photos/*` (14 photos, reused across similar types). Prices are realistic for each locality. At least 4 available properties are strong matches for current hot leads. |
| Property drafts (`Draft`) | **3** | A property from a brochure PDF (low confidence on price and RERA), a property from an owner's WhatsApp message, and a lead from a visiting-card OCR. |
| Appointments | **22** | **Today 7:** Arjun 2 (Priya site visit 11:00, Ananya phone call 15:00), Sneha 2 (Harish office meeting 12:00, Lakshmi site visit 16:00), Vikram 3 (Rohan site visit 12:30, Amit site visit 12:45 **conflict**, Pooja video call 17:00). **Upcoming 6** (days +1 to +6, including weekend site visits). **Past completed 5** (including Deepak yesterday with an outcome). **Past still needing an outcome 2.** **No-show 1. Cancelled 1.** Every type appears. |
| Tasks / follow-ups | **28** | Per switchable exec: 2 overdue, 2–3 due today, 2 upcoming and 1–2 done today. Mostly calls and follow-ups, with some WhatsApp and document tasks. Farhan has 2 open (overdue). Rohit has 2 (approve Karthik's discount; weekly pipeline review). Meera has 1 (clean duplicates). Includes the auto tasks for Neha (`slaFirstCall`) and Deepak (`postVisitCall`). |
| Activities | **~150** (generated) | A coherent timeline for every lead: created, assigned, contacts, stage changes, visits, shares and notes. Calls logged **today**: Arjun 7, Sneha 5, Vikram 4. A 30-day history density feeds the activity heatmap and "calls this month". |
| Notifications | **24** | Arjun 5, Sneha 4, Vikram 4, Rohit 6 (SLA breach on unassigned, leave-reassign for Farhan, stalled Harish, Swati booking, escalation for Neha's TAT, ready-to-book), Meera 5 (import finished, deactivated owner Kavya, duplicate Mohd Irfan, booking, system). About 60% are unread. |
| Assignments | **~50** | One per assigned lead, both current and historical, plus 4 reassignments with reasons (manual, owner on leave, redistribution from Kavya, rule by location). |
| Import jobs | **3** | A 99acres CSV of leads yesterday (40 rows: 34 imported, 4 duplicates, 2 errors, `partial`), a builder price-list xlsx 3 days ago (`completed`, 6 properties), and a brochure PDF (`completed`, 1 draft). |
| Saved views | **6** | Per exec: Hot, Overdue. Manager: Unassigned, Stalled. |
| Settings | 1 | `DEFAULT_SETTINGS`, with autoAssign **on**, 2 rules (location Hyderabad and Chennai → Sneha; NRI or source `channelPartner` → Vikram, disabled) and `rrCursor = 'u-arjun'`. The stage defaults are listed below. There are 12 templates (6 purposes × English and Hinglish, WhatsApp). SLA is 15 / 60 min, stale 7 days, hot-no-contact 3 days. |

Stage defaults (`targetDays` / `probability`):

| Stage | Target days | Probability |
|---|---|---|
| new | 1 | 0.05 |
| contacted | 3 | 0.10 |
| qualified | 5 | 0.20 |
| siteVisitScheduled | 7 | 0.30 |
| siteVisitDone | 5 | 0.45 |
| negotiation | 10 | 0.65 |
| booked | 30 | 0.90 |
| converted | 0 | 1 |
| lost | 0 | 0 |

`data/seed/index.test.ts` checks the following:

- Every reference resolves.
- Each switchable exec has at least 1 hot lead, at least 1 visit today and at least 1 overdue task.
- The manager has at least 3 unassigned leads.
- Counts are within ±10% of the table.
- After `rebase` by +5 days, today's items stay today.

---

## 7. Port list and decisions

Legend:

- **P** = port (copy, adapt imports, types and tokens).
- **P+** = port and improve.
- **R** = reference only (rebuilt fresh in the new design).
- **D** = drop.

The source is `wireframe-rebuild/` on branch `feature/crm-e2e` (identical to `spec-system-wireframe`) unless stated. The Parent copies this table into `DELIVERY_REPORT.md`, adding what actually changed.

### 7.1 Project and config

| Source | New path | Decision | Change / reason |
|---|---|---|---|
| `package.json` | `package.json` | P+ | Same deps, plus the additions in §1.1, plus scripts `typecheck`, `test`, `e2e` and `verify`. |
| `vite.config.ts` | same | P+ | Port 5174/5175 strictPort, vitest block. |
| `tsconfig*.json`, `.oxlintrc.json`, `components.json` | same | P | Unchanged. |
| `index.html` | same | P+ | Storage key `crm-e2e-theme`, pre-paint `lang`. |
| `.gitignore` | same | P+ | Adds e2e artefacts. |
| `vercel.json` | — | D | Not deploying in this run. |
| `public/favicon.svg` | same | R | A new Peacock logo mark (DESIGN_SYSTEM §11.1). |
| `public/demo-photos/*.jpg` (14) | `public/demo-photos/` | P | Copied as is. Generic photos, re-used across cities. |
| `origin/feat/estate-platform:playwright.config.ts` | `playwright.config.ts` | P+ | Single static app (no API server), Edge channel, desktop / tablet / phone projects. |
| `origin/feat/estate-platform:e2e/journeys.spec.ts` | — | R | Journey style for the QA agents. |

### 7.2 Styling, theme, i18n

| Source | New path | Decision | Change / reason |
|---|---|---|---|
| `src/index.css` | `src/index.css` | R | Replaced wholesale by DESIGN_SYSTEM §12 (the new identity, OKLCH tokens). The mechanism (CSS variables + `@theme inline` + `.dark`) is kept. |
| `src/lib/theme.ts` | `src/lib/theme.ts` | P | Key → `crm-e2e-theme`. The behaviour is unchanged (light / dark / system, pre-paint). |
| `src/components/app/tone.ts` | `src/lib/tones.ts` | P+ | Becomes the DESIGN_SYSTEM §3.2 domain map (stage, temperature, appointment, availability, priority → class strings + lucide icon). The old `Tone` union is kept for semantic tones. |
| `src/i18n/index.ts` | `src/i18n/index.ts` | P+ | Namespaces loaded with `import.meta.glob('./locales/*/*.json', { eager: true })`, `defaultNS: 'common'`, key `crm-e2e-lang`, `<html lang>` sync kept. |
| `src/i18n/locales/en.json`, `ta.json` | `src/i18n/locales/{en,ta}/catalogue.json` (subset) | P+ (subset) | Only the catalogue labels (fact / spec labels, amenities, facing, purposes) are carried, re-keyed to the new type keys. All screen strings are new, because the screens are new. |

### 7.3 Shared components

| Source | New path | Decision | Change / reason |
|---|---|---|---|
| `src/components/ui/*` (24 shadcn files) | `src/components/ui/` | P | Kept as is (they consume tokens). **Add:** accordion, alert-dialog, collapsible, radio-group, hover-card, slider, sheet (already there), command-less. |
| `components/app/data-table.tsx` | `components/shared/data-table.tsx` | P+ | Adds: sticky header shadow, row hover action cluster, density toggle, column-visibility menu, inside-table empty / loading / error states, and the 52/40 px rows from DS §11.7. Sorting, selection and responsive hiding are kept. |
| `components/app/filter-bar.tsx` | `components/shared/filter-bar.tsx` + `filter-pill.tsx` | P+ | DS dashed / filled pill styles, count badges, Clear all. |
| `components/app/side-panel.tsx` | `components/shared/drawer.tsx` | P+ | DS §11.8: 480/640 widths, sticky header and footer, unsaved-changes confirm, full-screen on phone. |
| `components/app/stat-card.tsx` | `components/shared/kpi-card.tsx` | R | Redesigned: sparkline, delta chip, ring or progress variants, highlight variant. |
| `components/app/meter.tsx` | `components/shared/meter.tsx`, `workload-bar.tsx` | P+ | Restyled, stacked workload variant. |
| `components/app/empty-state.tsx` | `components/shared/empty-state.tsx` | P+ | Illustration slot plus AI secondary action. Filtered-empty variant. |
| `components/app/confirm-dialog.tsx` | `components/shared/confirm-dialog.tsx` | P | Restyled. |
| `components/app/page-header.tsx`, `section-card.tsx`, `key-value-grid.tsx`, `callout.tsx`, `chip.tsx`, `segmented.tsx`, `status-chip.tsx` (→ `badges.tsx`), `user-avatar.tsx` | `components/shared/…` | P | Restyled to DS tokens. Avatar colour = hash(name) % 8 chart mix. |
| `components/app/mini-calendar.tsx`, `amount-input.tsx` | `components/shared/…` | P | Used by the date-time field and the budget inputs (₹ with L/Cr unit). |
| `components/layout/app-shell.tsx`, `sidebar.tsx`, `top-bar.tsx`, `nav.ts` | `app/shell/*`, `app/nav.ts` | R | A new shell per DS §11.1. Nav is built from the route registry and permissions. The behaviours kept are: fixed sidebar, collapsible to icons with tooltips, live counts. |
| `components/layout/crumbs.tsx` | `app/shell/crumbs.tsx` | P | |
| `hooks/use-media-query.ts` | `hooks/use-media-query.ts` | P | |
| `pages/ui-kit-page.tsx`, `pages/module-placeholder-page.tsx` | — | D | No placeholder screens in the final product. The foundation's stubs are temporary and are replaced in Phase 2. |

### 7.4 Domain, data, store

| Source | New path | Decision | Change / reason |
|---|---|---|---|
| `src/data/types.ts` | `src/domain/types.ts` | P+ | Normalised: visits → `Appointment`, lead.activity → `Activity`, nextFollowUp → open `Task`. New entities: Client, Task, Notification, Assignment, ImportJob, Draft and SavedView. The master prompt's 9 stages replace the rebuild's 8 ("recommended" is dropped as a stage and lives on as the shortlist status). Property types are widened to the Indian list, and the rebuild's 6 type keys become `PropertyFamily`. Kept: `Budget` min / preferred / max / flex and basis, the qualification inputs, classification + HNI, consent, `FieldSource` → `FieldMeta`, shortlist / share semantics. |
| `src/data/catalogue.ts` | `src/domain/catalogue.ts` | P+ | Per-type facts are re-used as `specs`. Cities are replaced by the six metros (§2.2). Sources, configurations, authorities, banks, lost reasons and stage defaults are added. |
| `src/data/seed.ts` | `src/data/seed/*` | R | A new multi-city, relative-date seed (§6). The fixed `DEMO_TODAY` is dropped. Masked phones (`98xxxxxx01`) become valid-looking numbers. |
| `src/store/db.tsx` | `src/store/*` + `src/services/*` | P+ (behaviour) / D (code) | React-context store → zustand + persist + immer. Each store action becomes a service function with the same side effects: `markRecommended` → shortlist status + E11, `deleteProperty` cascade → E13, `noteOnLeads` → Activity, `checkpoint/restore` → `undo.ts`. The fixed `ROLE_PERMISSIONS` is replaced by `lib/permissions.ts`. Keys `realspec-rebuild-*` → `crm-e2e-*`. |

### 7.5 Business logic (`src/lib`)

| Source | New path | Decision | Change / reason |
|---|---|---|---|
| `lib/utils.ts` | `lib/utils.ts` | P | `cn`. |
| `lib/amount.ts` | `lib/amount.ts` | P | L/Cr fields. |
| `lib/format.ts` | `lib/format.ts`, `lib/dates.ts`, `lib/phone.ts` | P+ | `inr`, `inrShort`, `num`, `sqft`, `initials` and the local-day `addDays` are kept, with their UTC warning. New: `inrRange` ("₹60 L – ₹80 L"), `fmtDate` as `DD MMM YYYY`, `fmtTime` (h:mm a), `fmtRelative` (date-fns, i18n-aware), `phoneDisplay` (`+91 98450 12345`), `toE164`. |
| `lib/classification.ts` | `lib/classification.ts` | P | Adapted to the new types. HNI stays manager / admin only (`lead.viewHni`). |
| `lib/readiness.ts` | `lib/qualification.ts` | P+ | The 100-point readiness is kept, plus the four-check card and the missing-question generator (§5.5). It feeds `scoring.ts`. |
| `lib/consent.ts` | `lib/consent.ts` | P+ | **Changed:** consent is a visible badge and a warning, **not a blocker**. The master prompt requires one-click follow-ups everywhere. Recorded as an assumption. |
| `lib/matching.ts` | `lib/matching.ts` | **P+** (main) | See §7.7. |
| `lib/property.ts` | `lib/property.ts` | P+ | `missingRequired` (new smart-required set: title or configuration + type + location + price + area), completion score, needs-attention, price check, `primaryAreaSqft`, `pricePerSqft`, `isMatchable` (live + available or onHold). `DEMO_TODAY` is replaced by a `now` argument. |
| `lib/places.ts` | `lib/places.ts` | P | New `CITIES`. |
| `lib/search.ts` + `features/properties/search/prop-search.ts` | `lib/search.ts` | P+ | NL property filters ("3BHK Whitefield under 1.2 Cr ready to move east facing"), used by the Properties search and the AI. |
| `lib/labels.ts` | `lib/labels.ts` | P+ | `useLabels()` over the `catalogue` namespace. |
| `features/leads/lead-list.ts` | `lib/lead-queries.ts` | P+ | Stages, tabs, filters and attention groups for the new model. One counting source for Today, Pipeline and Reports. |
| `features/leads/next-step.ts` | `lib/next-action.ts` | P+ | Next best action rules over appointments and tasks. |
| `features/properties/pitch.ts` | `lib/whatsapp.ts` | P+ | `waLink(phone, text)` → `https://wa.me/91XXXXXXXXXX?text=…`, `telLink`, and the share message ("Hi {{first}}, as discussed, here are N options…" from estate-platform `shareWithLead`). |
| — | `lib/permissions.ts`, `lib/assignment.ts`, `lib/scoring.ts`, `lib/stalled.ts`, `lib/duplicates.ts`, `lib/validation.ts`, `lib/tones.ts` | new | §3, §5.4, §5.5. |

### 7.6 AI

| Source | New path | Decision | Change / reason |
|---|---|---|---|
| `lib/ai/parse.ts` | `ai/simulated/parse.ts` | **P+** | Amounts (L, lakh, lac, Cr, crore, Tamil units), ranges, dates, times, phone numbers and places are kept. Added: "+91 98450 12345", 10-digit with spaces; "1200 sqft", "1,200 sq.ft", "sq yd", "cents", "acres"; "2.5BHK", "3 bhk", "1RK"; facings ("east facing", "NE"); possession ("ready to move", "RTM", "under construction", "possession Dec 2027"); timeline ("in 2–3 months", "immediately", "just exploring"); decision makers ("wife", "husband", "parents", "father"); loan ("need loan", "pre-approved"); NRI ("from Dubai", "NRI"); purpose ("investment", "rental"); sources ("from 99acres", "MagicBricks"); and furnishing. |
| `lib/ai/understand.ts` | `ai/simulated/intents.ts` | P+ | Intent detection widened to every master prompt §12.5 command, with synonyms and a fuzzy match on lead, property and executive names drawn from the visible data. |
| `lib/ai/plan.ts` | `ai/simulated/commands.ts` + `services/commands.ts` | P+ | The "plan of changes, old → new, tick boxes, a person applies, Undo for 10 s" pattern becomes `ActionProposal[]` + `executeProposal` + `undo.ts`. |
| `lib/ai/answer.ts` | `ai/simulated/commands.ts` (query intents) | P+ | Lead queries with "How I read it" chips. |
| `lib/assistant.ts` (property assistant) | `ai/simulated/extract-property.ts` | P (rules) / R (chat UI) | The fact-extraction rules (type, purpose, city, locality, price, area, BHK, facing, amenities) and the rule "never invent a fact; ask only for the missing required ones" are kept. The one-question-at-a-time chat is replaced by paste-and-fill plus a missing-questions checklist (master prompt §12.3). |
| `features/assistant/use-speech.ts` | `hooks/use-speech.ts` | P+ | en-IN. Returns `supported`. The mic button shows a fallback message instead of disappearing. |
| `features/assistant/ask-bar.tsx`, `assistant-box.tsx` | `components/ai/ai-panel.tsx` | R | The DS §11.9 docked panel with context chip, proposals, refusals and links. |
| `origin/feat/estate-platform:apps/api/src/services/matching.ts` | `lib/matching.ts` (ideas) | P+ | See §7.7. |

### 7.7 Property matching: decision **port and improve**

The rebuild's frontend `matchScore` is the base: hard filters, five weighted parts, configurable weights, labels, two-way helpers, `closeOnBudget` and `excludedForLead`. Its behaviour is kept, and the estate-platform service's better explanation and memory model are merged in.

- **Hard filters (excluded):**
  - `listing !== 'live'` or status booked / sold;
  - purpose mismatch;
  - type not in `requirement.propertyTypes` (when given);
  - city not in `requirement.cities` (when given);
  - price over `budgetMax × (1 + flexPct) × 1.2` → excluded. Between the ceiling and 1.2× it gives `budgetMismatch` (the "worth a call" list, ported `closeOnBudget`);
  - fewer bedrooms than wanted (estate);
  - the shortlist says `notInterested` (estate: "rejected never come back").
- **Score** (0–100, weights from `settings.matching.weights`, default **budget 0.30 · location 0.25 · size 0.20 · amenities 0.15 · preferences 0.10**, the rebuild's formula, kept):
  - **B:** the rebuild's curve (≤ preferred 100 → ≤ max 70–100 → ≤ ceiling 55 → 0). The estate refinement: more than 25% under `budgetMin` loses 10 ("may feel too small").
  - **L:** preferred locality 100 · same city 70 · no localities given 100.
  - **S:** configuration match (exact 100, more BHK 80, fewer → excluded) averaged with area deviation (the rebuild's 200×-deviation curve, using carpet, then built-up, then super built-up area).
  - **A:** requested amenities hit-rate, 50% blended with the infra score (rebuild).
  - **P:** possession (ready / under construction / by date), facing ∈ wanted, Vastu, parking required → covered > 0, furnishing, transaction (new / resale) and free-text must-haves (estate's facing and amenity text matcher).
  - **onHold:** −15 with the reason "On hold until {{date}} for another buyer".
- **Labels:** strong ≥ 80 (no ✗ reasons) · good ≥ 65 (at most 1 ✗) · weak · **conditional** (an approval doc is pending, or S < 60) · budgetMismatch · excluded. Results below `settings.matching.minScore` (default 40) are hidden, except in the "not shown and why" list.
- **Explanation:** `reasons: { ok: true | false | null; key; params }[]`, rendered through i18n in the `matching` namespace. The UI shows the **percentage** (master prompt §14 asks for it; this differs from estate-platform, which hid it), the label, and a one-line summary, for example "Within budget · Whitefield · 3 BHK · ready to move; missing: covered parking".
- **Memory:** the shortlist statuses from estate. `liked` adds a "They liked this one" reason. `shared` shows "Already shared {{when}}". `visited` shows "Already visited". `notInterested` → excluded.
- **Diversity:** at most `settings.matching.perProjectCap` (2) results per `projectName` in lead→property lists (estate).
- **API:**
  - `matchScore(lead, property, settings, now)`;
  - `propertiesForLead(lead, properties, settings, now, { limit, includeShared })`;
  - `leadsForProperty(property, leads, settings, now)`;
  - `closeOnBudget(...)`;
  - `excludedForLead(...)`;
  - `bestMatchesToday(db, user, now)` (estate: one fresh strong or good unshared match per qualified lead, at most 5).
- **Tests:** `lib/matching.test.ts`, written in Phase 1:
  - ports all four estate `scoreMatch` cases (fit with plain reasons; over-budget wording and exclusions for way over, wrong type, sold and rejected; fewer BHK excluded; per-project cap; shared and rejected memory);
  - adds rebuild cases: weights sum, conditional on a pending doc, budgetMismatch within 15%, booked and sold excluded both ways, weights changed in settings change the order.

### 7.8 Feature UIs (all **R**, rebuilt in the new design by module owners)

| Source (`wireframe-rebuild/src/features/…`) | Used as reference by | Notes |
|---|---|---|
| `leads/leads-page.tsx`, `leads-today.tsx` (Today design: summary cards, saved views, grouped list, filter panel with counts) | M2, M1 | The "Today design" grouping and the counted filter panel are the agreed UX. Keep them. |
| `leads/lead-page.tsx` (stage steps, Next step card, profile, visits, negotiation price scale, activity composer, matches, qualification, HNI) | M2 | Three-zone layout per DS §14. Keep: the Next step card, Mark as lost as its own button, the negotiation scale, and the composer that is the assistant. |
| `leads/lead-form.tsx`, `add-lead-sheet.tsx` (3-step sheet) | M2 | Keep: budget min / preferred / max with L/Cr, "What does the budget include?", questions per property type. Required fields are now name + phone + source (smart required). |
| `leads/visit-outcome.tsx`, `offer-dialog.tsx`, `reschedule-button.tsx` (Tomorrow / In 3 days / Next week chips), `done-button.tsx`, `inline-edit.tsx`, `consent-control.tsx` | M4, M2 | The reschedule chips are reused in task-row and on Today. |
| `leads/matches-tab.tsx`, `properties/tabs/matching-tab.tsx` (List or Profile cards, Why N?, Recommend / Visit) | M3 | → `components/domain/match-list.tsx` and `match-explain.tsx`. |
| `properties/pages/properties-page.tsx` (grid / table, NL search, filter pills, status tabs, needs-attention strip, bulk actions, view options) | M3 | Keep all of these behaviours. Statuses are simplified to the four in the master prompt, plus the listing state. |
| `properties/pages/property-page.tsx` + tabs (overview, legal, price, history, neighbourhood) | M3 | Keep: overview, legal / approvals, price check, matched leads, related appointments, history. **Drop** the neighbourhood map and the place-categories editor: too deep for this scope; a "Map" link (Google Maps search) replaces it. |
| `properties/assistant/*` (add-property chat, details drawer, decision cards, sources) | M3, M7 | Replaced by a dynamic form + paste-and-fill + missing questions. **Drop** the decision cards (master-list edits). Keep the `FieldMeta` source tags (✦ AI, 📄 file). |
| `properties/pages/drafts-page.tsx` | M5 | One Drafts page for all kinds (`/import/drafts`). |
| `properties/pages/share-page.tsx`, `components/share-panel.tsx`, `photo-gallery.tsx` | M3 | Keep the quick share panel (choose a lead → WhatsApp / copy text) and the full-screen photo viewer. The brochure share page is **dropped** (not required; WhatsApp share covers it). |
| `settings/settings-page.tsx` | M8 | Preferences (theme, language) are kept. Business rules are rebuilt per §8. |
| `spec-system-wireframe/*` (`views-*.js`, `logic.js`, `docs/`) | all | **R:** the requirement reference. Its business rules are already carried by the rebuild's lib. |
| `origin/feat/estate-platform:docs/02-bulk-import.md` | M5 | **R:** messy-sheet rules (title rows, totals rows, Instructions tabs, value sniffing, nothing dropped, "Call" prices). |
| `origin/feat/estate-platform:docs/03, 04, 05, 07` | M2, M6, M4 | **R:** journeys. |
| `origin/feat/estate-platform:apps/web/src/features/matching.tsx`, `MatchingTab.tsx` | M3 | **R:** journeys (Send to {{name}}, 👍 / 👎, the shortlist card). |
| `origin/feat/property-management-system` docs (PRD 2.1, R1.1, R1.2) | M3 | **R:** property statuses v2 informed the four-status + listing-state decision. |
| **Projects module**, public enquiry form, brochure share page | — | **D:** not in master prompt §7. `projectName` on a property covers the grouping. |

---

## 8. Phase 2 module split (8 owners)

### 8.1 Owners

| Owner | Modules / folders (exclusive write) | Routes owned | i18n namespaces |
|---|---|---|---|
| **M1 Today & Reports** | `modules/today/**`, `modules/reports/**`, `services/queries/today.ts`, `services/queries/stats.ts` (after Phase 1) | `/today` (index redirect target), `/reports`, `/reports/:tab` | `today`, `reports` |
| **M2 Leads, Qualification & Clients** | `modules/leads/**`, `modules/clients/**`, `components/domain/lead-card.tsx`, `lead-pills.tsx`, `contact-actions.tsx`, `log-activity-dialog.tsx`, `lib/qualification.ts`, `lib/scoring.ts`, `lib/duplicates.ts`, `lib/lead-queries.ts`, `lib/next-action.ts`; additive in `services/leads.ts`, `services/clients.ts` | `/leads`, `/leads/new`, `/leads/:id`, `/leads/:id/edit`, `/clients`, `/clients/:id` | `leads`, `clients` |
| **M3 Properties & Matching** | `modules/properties/**`, `modules/matching/**`, `components/domain/property-card.tsx`, `property-pills.tsx`, `match-list.tsx`, `match-explain.tsx`, `lib/matching.ts`, `lib/property.ts`, `lib/search.ts`; additive in `services/properties.ts`, `services/matching.ts` | `/properties`, `/properties/new`, `/properties/:id`, `/properties/:id/edit`, `/matching` (`?lead=` / `?property=`) | `properties`, `matching` |
| **M4 Appointments & Tasks** | `modules/appointments/**`, `modules/tasks/**`, `components/domain/appointment-card.tsx`, `appointment-form-dialog.tsx`, `task-row.tsx`, `task-form-dialog.tsx`; additive in `services/appointments.ts`, `services/tasks.ts` | `/appointments` (`?view=day\|week\|month\|list&date=`), `/appointments/:id`, `/tasks` | `appointments`, `tasks` |
| **M5 Import & Extraction** | `modules/import/**`, `src/ai/document/**`, `public/samples/**`, `scripts/**`; additive in `services/imports.ts`, `services/drafts.ts` | `/import`, `/import/:kind` (wizard), `/import/history`, `/import/drafts`, `/import/drafts/:id` | `import` |
| **M6 Pipeline** | `modules/pipeline/**`, `components/domain/stage-change-dialog.tsx`, `lib/stalled.ts` | `/pipeline` (`?view=board\|list&owner=`) | `pipeline` |
| **M7 AI Assistants** | `src/ai/**` (except `ai/document`), `components/ai/**`, `services/commands.ts` | — (global panel; no page) | `ai` |
| **M8 Team, Settings, Notifications & Activity** | `modules/team/**`, `modules/settings/**`, `modules/notifications/**`, `modules/activity/**`, `components/domain/assign-dialog.tsx`, `notification-item.tsx`, `app/shell/notification-bell.tsx`, `lib/assignment.ts`; additive in `services/users.ts`, `services/settings.ts`, `services/notifications.ts`, `services/assignments.ts` | `/team`, `/team/:id`, `/settings`, `/settings/:section`, `/notifications`, `/activity` | `team`, `settings`, `notifications`, `activity` |

**Foundation / Parent-owned (requests only):**

- `domain/**`, `store/**`, `services/core/**`, `services/queries/visibility.ts` and `lookups.ts`, `services/demo.ts`, `services/automation.ts`, `services/activities.ts`, `data/seed/**`;
- `app/**` (except `notification-bell.tsx`), `components/ui/**`, `components/shared/**`, `components/illustrations/**`, `components/domain/entity-link.tsx` and `activity-timeline.tsx`;
- `lib/permissions.ts`, `tones.ts`, `theme.ts`, `format.ts`, `dates.ts`, `phone.ts`, `amount.ts`, `whatsapp.ts`, `validation.ts`, `classification.ts`, `places.ts`, `labels.ts`, `utils.ts`;
- `hooks/**`, `i18n/index.ts`, and the `common`, `shell`, `catalogue`, `activity` and `notifications` namespaces (`notifications` is co-owned with M8; M8 may add keys).

### 8.2 Rules for module agents

1. **Write only inside your folders** (table above). Each module's `routes.tsx` is created by the foundation with stubs. You edit only your own.
2. **"Additive in services/x.ts"** means you may add **new exported functions** to that file, built on `commit()` and the existing events. You may not change existing signatures, `effects.ts` or `types.ts`.
3. **Anything else needs a request.** This covers a new field, event, effect, shared component change, dependency or catalogue value. Append it to `notes/requests-<module>.md` in the form: what, why, proposed exact code, and urgency (blocking / nice). Then work around it locally if you can. The Parent applies requests between waves and records them.
4. Use `usePermission()` for every action button and `<RequirePermission>` through the route's `permission`. Never check `role === '…'` directly.
5. Every list has empty, filtered-empty, loading-skeleton (for async AI or parse only) and error states. Every action shows a toast. Destructive actions confirm and offer Undo.
6. Every screen works at 375, 768 and 1440 px, in light and dark, in English and Tamil (Tamil drafted, flagged for review).
7. Every form supports **manual and AI**. Paste-and-fill (`<PasteAndFillBox kind="lead|property|appointment">`) fills the same form, marks the AI fields, and asks only the missing essentials. Nothing saves without the user clicking Save.
8. **Before handing back**, run `pnpm typecheck && pnpm lint && pnpm test`. Fix every error in **your** files. Report errors in other agents' files in your summary, and do not fix them. Do not run `pnpm build` in parallel with other agents. The Parent builds.
9. Take a light and dark screenshot of the main screen at 1440 and 375 px with Playwright against your own dev port, and save it to `notes/screens/<module>/`. The Parent uses these for the before/after review.

### 8.3 Acceptance criteria per module

**M1: Today & Reports** (master prompt §6, §13 Reports, §19.1; ROLE_RESEARCH §5)

- `/today` renders a role-specific view with no clicks needed. The layout follows DS §14 rule 4: hero greeting, priority list in 7 columns, timeline and targets in 5.
- **Executive view:**
  - the AI greeting and day summary (Demo AI badge);
  - a ranked priority list with a reason chip, a due time and one-click actions (Call `tel:`, WhatsApp `wa.me`, Log outcome, Reschedule chips, Done, Open lead) that **change real data**, with the list re-ranking at once;
  - today's appointments timeline with map links and "Send confirmation";
  - sections for hot leads, overdue follow-ups, new today and not contacted in X days;
  - target rings (calls, visits, bookings this month);
  - the "Visited, not booked" strip;
  - "New matches to send" (`bestMatchesToday`).
- **Manager view:**
  - the unassigned queue with the AI-suggested executive, per-row assign and **Auto-assign all**;
  - the team board (availability, load bar, today's calls and visits, overdue, TAT breaches);
  - overdue follow-ups by executive;
  - today's team visits colour-coded by executive;
  - stalled and negotiation deals;
  - needs-attention items (escalations, high-value untouched, the leave-reassign proposal);
  - the team target gauge and funnel.
- **Admin view:**
  - KPI cards with sparklines (new leads today, visits, bookings, pipeline value, conversion, inventory);
  - the source funnel;
  - the team snapshot;
  - import activity;
  - system alerts (unassigned age, duplicates, missing data, deactivated owners);
  - 3–5 AI insights with drill-down links.
- **`/reports`** is scoped all / team / personal (title "My performance" for executives). It has:
  - the conversion funnel with stage drop-off;
  - leads and bookings trends (area, 6 months);
  - leads by source (donut) and source → visit → booking conversion;
  - lost reasons;
  - executive performance (bar chart and table);
  - the activity heatmap;
  - the pipeline value by stage;
  - inventory by status and type;
  - the AI summary.
  - A period switcher (this week, month, quarter, 6 months) and CSV export (when `export.data` is allowed).
  - Every chart follows DS §10: tooltips, legend, click-through to a filtered list, empty state.
- Numbers react immediately to changes made elsewhere (verified by changing a stage and seeing the funnel move).

**M2: Leads, Qualification, Clients** (master prompt §8, §9, §10 manual parts, §12.3, §12.6; ROLE_RESEARCH §4 #1, 9, 10)

- **List:**
  - search, filters (source, stage, temperature / priority, executive [managers], budget, city / locality, date), sort, pagination;
  - table, card and "Today design" views;
  - saved views;
  - row hover actions;
  - bulk actions (assign [permission], change stage, delete [permission, undo], export CSV [permission]);
  - an Unassigned tab for managers and admins;
  - lead aging badges (days since contact, SLA breach).
- **Add lead (sheet):**
  - paste-and-fill and voice: the Rahul Verma example fills name, phone, 3 BHK, Whitefield + Sarjapur Road, ₹1.2 Cr, ready, timeline 1–3 months, decision maker spouse;
  - AI fields are marked; missing essentials are asked with chips;
  - required = name + phone (or email) + source; optional sections collapsed;
  - a **duplicate warning** on phone or email with the owner and a link, offering Open existing or Save anyway (merge note);
  - auto-assign is applied for manager and admin when it is on, with a toast naming the executive and the reason.
- **Lead page** (three zones):
  - contact, source, temperature and score ring with an "Why this score?" popover (factors);
  - budget range, locations, configuration;
  - the qualification card ("3 of 4 known…", with the AI asking only the missing questions as chips);
  - stage steps, plus Mark as lost (reason);
  - the Next best action card;
  - quick actions: Call, WhatsApp, Schedule visit, Add follow-up, Match properties, Change stage, Reassign [permission] or Request reassignment [exec];
  - tabs: Activity (composer + timeline), Matches (`match-list`), Appointments, Tasks, Assignment history;
  - the AI summary (2–3 lines), the conversion probability, and generated messages (WhatsApp / SMS / email, English or Hinglish, opening `wa.me` prefilled, with the send logged).
- **Edit** in place or through the form, also with the AI ("change budget to 1.5 Cr and add Hebbal").
- **Clients:** a list and a detail view (booking, loan, KYC and documents checklist, linked lead timeline, appointments). They are created automatically on Booked.
- An executive sees only their own leads. HNI shows "Restricted". Delete is not available to them.

**M3: Properties & Matching** (master prompt §13, §14; ROLE_RESEARCH #5, 19, 20)

- **List:** card grid (DS §11.4: image, price badge, chips, match ring in match context) and table; NL search; filter pills (type, city / locality, budget, configuration, possession, status, furnishing, facing); status tabs with counts; sort; bulk change status / export [permission]; and grouping by locality (a "By locality" view with counts and price ranges).
- **Add / Edit property:**
  - a **dynamic form by family** (flat, house, plot / land, commercial, warehouse) covering every master prompt §13 field: area triple, plot dimensions, facing, corner, floor, rooms, parking, furnishing, amenities, possession and date, RERA, approvals, khata / patta, bank approvals, owner / builder, commission;
  - ₹ / sq ft computed;
  - image upload with preview (compressed to ≤ 1600 px JPEG data URLs, at most 8 per property);
  - paste-and-fill and voice ("2.5BHK 1200 sqft east facing in Kondapur 85 L ready to move");
  - smart required fields;
  - an executive can edit only what they created; delete is admin only (confirm + undo).
- **Property page:** gallery, key facts as icon tiles, price check, approvals / legal, **matched leads** (property → leads, with %, label, reasons and actions), related appointments, history (from Activities), the AI description and title generator, and the "find missing data" checklist.
- **Matching `/matching`:**
  - pick a lead → ranked properties; or pick a property → ranked leads;
  - % + label + reasons (✓ / ✗ / ? chips) + "not shown and why" + close-on-budget;
  - actions: **Shortlist**, **Share on WhatsApp** (message + `wa.me`, logged, E11), **Schedule site visit** (appointment dialog prefilled), **Not interested** (excluded thereafter);
  - booked and sold never appear;
  - the matching assistant ("properties within Rahul's budget in Whitefield").
- Marking a property Booked or Sold from its page removes it from all match lists immediately, and the owners of leads that shortlisted it get a notification.

**M4: Appointments & Tasks** (master prompt §16, §17 tasks; ROLE_RESEARCH #3, 6, 7, 11)

- **Calendar:** day, week and month views (custom grid per DS §11.6, colour by type, legend filter chips, current-time line) plus a list view; filters for executive [manager / admin], type and status; click a slot to book.
- **Appointment form:** lead / client, type, properties (several for a site visit), executive, date / time / duration, location (defaults to the property address + map link), reminder, notes.
  - A **conflict warning** ("Vikram already has Rohan Deshpande at 12:30 · Book anyway") that never blocks.
  - Paste-and-fill: "Site visit with Priya tomorrow 11 am at Aranya Greens".
- **Detail:**
  - confirm, reschedule (status rescheduled), cancel (reason), no-show;
  - complete with an outcome form (result, interest, liked properties, objections, decision maker present, next step), after which the AI suggests the next follow-up date and stage and one click applies them;
  - **AI preparation points** before a visit;
  - an AI summary after it;
  - WhatsApp confirmation with the location link.
- **Tasks:**
  - tabs for Overdue, Today, Upcoming and Done;
  - group by lead or by due date;
  - quick add (title + due + lead), priority, complete with a call result (no answer → auto retry task, E4), reschedule chips, bulk complete;
  - overdue highlighting;
  - the Follow-up Assistant suggests timing and drafts the message.
- Effects visible elsewhere: a site visit booked from a lead moves its stage, and completing a visit creates the 24 h post-visit task.

**M5: Import & Extraction** (master prompt §15; ROLE_RESEARCH #18, 19)

- **`/import` hub:** cards for the 5 default templates, each with **Download .xlsx** and **.csv** generated by SheetJS at runtime (headers + 2–3 example rows), plus Upload; recent jobs; Drafts count.
- **Wizard:** upload (xlsx, xls, csv, pdf, jpg, png) → sheet / tab detection (skips title rows, totals rows and Instructions tabs) → **column mapping** (`mapping-table`: exact / template / saved / synonym / fuzzy with confidence, unknown columns, missing required fields, a manual dropdown, Save mapping) → preview → **validation** (required fields, phone normalisation, "1.2 Cr" / "85 L" / "1,200 sqft" / Excel dates, price-to-area sanity, invalid values) → **duplicate detection** (against the DB and within the file) → row-level errors with **inline fixing** and re-validation, plus a "set for all" action → confirm (skip or update existing) → summary (imported / updated / skipped / errors / drafts, links, a CSV of failed rows). Lead imports run auto-assignment (E16).
- **Documents:**
  - PDF text through `pdfjs-dist`; images and scans through `tesseract.js` (lazy-loaded, progress shown honestly);
  - then the same `extractLead` / `extractProperty`;
  - an uncertain result is saved as a **Draft** with low-confidence fields highlighted;
  - `/import/drafts` lists them and opens the prefilled form to finish and save.
- `public/samples/`: `leads-99acres-export.csv`, `builder-price-list-custom.xlsx` (messy custom columns: "Rate", "SBA", "Unit Type", a title row, a totals row), `apartment-brochure.pdf` (text PDF), `visiting-card.png` and `handwritten-requirement.jpg` (generated by `scripts/make-samples.mjs`). There is a "Try a sample" button for each.
- Permissions: executives get no `/import` (NoAccess), but they can use a single document through paste-and-fill. Managers can import leads only; property templates show a lock with the reason.

**M6: Pipeline** (master prompt §11; ROLE_RESEARCH #14, 20)

- **Kanban** with `@dnd-kit` (pointer + keyboard sensors with announcements), columns for the enabled stages in order, and DS §11.5 styling (stage bar, count, ₹ total, share-of-value bar, the progress strip in the header).
- **Cards:** client, deal value, property, executive avatar, days-in-stage badge (warning / stalled), next follow-up, temperature dot, AI ✦ stalled marker.
- Dropping on **Lost** requires a reason. Dropping on **Booked** requires the booking amount and property. Cancel returns the card. Other moves go through `changeStage` with a toast and **Undo**.
- **List view** in the data table. **Filters:** executive [manager / admin], source, temperature, value range.
- **Mobile:** stage tabs and a "Move to…" sheet.
- **Analytics strip:** stage conversion %, drop-off and average days per stage.
- **AI:** stalled deals with recommended actions, and a conversion prediction per card (from `scoring.probability`).
- Moving a stage updates the lead, Today, Reports and the timeline (E5).

**M7: AI Assistants** (master prompt §12 all; ROLE_RESEARCH §5 prompt chips)

- **Global AI panel:** the floating button and Ctrl / Cmd + K and `/` focus.
  - It docks at 1280 px and above, and overlays below.
  - A context chip shows the current page and record.
  - Suggested prompt chips per role, taken from ROLE_RESEARCH §5.
  - Voice (en-IN) with a clear fallback message.
- **Executes after confirmation** every master prompt §12.5 command, with varied phrasing:
  - add a lead or update a lead;
  - find matching properties for a client;
  - create an appointment, schedule a site visit or schedule a follow-up;
  - assign lead X to Y (permission-checked, refused with the reason otherwise);
  - show today's pending tasks;
  - summarise my or my team's performance;
  - highest-priority leads; leads needing follow-up; properties within a client's budget; potential conversions;
  - summarise today's appointments.

  Answers link to the records. Applied changes are undoable for 10 s and logged with `via: 'ai'`.
- **Shared assistant component** (`<ModuleAssistant module=…>`, inline card), configured for these assistants:
  - Lead creation
  - Lead editing
  - Lead qualification
  - Property creation
  - Property editing
  - Property matching
  - Appointment creation
  - Follow-up
  - Import / extraction
  - Dashboard insights
- **Simulated provider quality:**
  - `src/ai/simulated/*.test.ts` covers **at least 25 varied inputs**: the Rahul Verma example; Hinglish ("3bhk chahiye Whitefield mein 1.2 cr tak"); "85 lakhs", "1.2Cr", "+91 98450 12345", "2.5BHK", "east facing", "1200 sqft"; owner listing messages; appointment phrases ("tomorrow 5pm", "next Saturday morning", "on 3rd Dec at 11"); and command phrasings ("give Sanjay's lead to Sneha", "reassign Sanjay Gupta → Sneha", "move Priya to negotiation").
  - Every output shows the **Demo AI** badge.
- **Live provider stub:** env-driven, with fallback. It is documented in the README, which states that production calls must go through a backend proxy.
- **Effort saved:** "N fields auto-filled" on forms, and "N leads auto-assigned today" on Manager Today (from `assignments` where `mode === 'auto'` today).

**M8: Team, Settings, Notifications, Activity** (master prompt §5, §10, §16 Settings, §17; ROLE_RESEARCH #12, 13, 15, 21)

- **`/team`:**
  - executive cards and rows with availability (set it, with the permission), active load bar (hot / warm / cold stacked), pending follow-ups, today's appointments, conversion rate, targets and progress;
  - a per-user detail with assignment history and activity;
  - **Admin:** add user (name, role, manager, phone, email, cities, languages), activate / deactivate with a **redistribute** dialog (auto / to a person / leave unassigned, with a preview of who gets what).
- **`assign-dialog`** (used everywhere): it lists the executives with name, active leads, pending follow-ups, today's appointments, workload bar, conversion rate and availability. It has a **Recommended (auto)** option with the explanation, supports single and multiple leads, and takes an optional note. Its toast says who was assigned and why.
- **`/settings`** sections, shown by permission:
  - Profile and preferences (theme, language): everyone.
  - Assignment rules and auto-assign toggle: admin; manager at team level.
  - Pipeline stages (rename via label, enable, target days, probability) and lost reasons: admin.
  - Message templates: admin.
  - Matching weights (live sum = 1.00), SLA and scoring thresholds: admin.
  - **Reset demo data**: admin, with a confirm.
- **Notifications:** the bell popover (tabs All / Unread, mark read and mark all read, click to open the record) and the `/notifications` page with filters.
- **`/activity`:** the global activity log (admin all, manager team) with filters for actor, entity, kind, date and via (AI / manual / automation / import).

### 8.4 Requests and coordination

- **Request files:** `notes/requests-<module>.md`. The Parent reviews them between waves and applies them in foundation-owned files, then records the result in `PROGRESS.md`.
- **Assumptions:** `notes/assumptions-<module>.md`.
- **Suggested wave order** inside Phase 2, if the Parent limits parallelism:
  1. **Wave A:** M2, M3, M4, M7. These are the core modules and the AI.
  2. **Wave B:** M1, M5, M6, M8.

  All eight can run together, because the foundation already provides every shared piece in a working first version.

---

## 9. Foundation acceptance checklist (Phase 1 must be green before Phase 2)

**Build and tooling**

- [ ] `pnpm install` is clean, and the lockfile is committed.
- [ ] `pnpm typecheck`, `pnpm lint` (0 errors) and `pnpm build` all pass.
- [ ] `pnpm test` passes, and contains at least:
  - `lib/matching.test.ts` (the ported estate cases plus the rebuild cases);
  - `lib/assignment.test.ts` (lowest workload, tie → round-robin with cursor wrap, on-leave and deactivated skipped, rule narrowing, empty pool → null);
  - `lib/permissions.test.ts` (every matrix cell, plus team / own record checks);
  - `lib/format.test.ts` + `amount` (₹45,00,000, ₹45 L, ₹1.2 Cr, ranges, `+91 98450 12345`, `DD MMM YYYY`);
  - `ai/simulated/extract-lead.test.ts` (the Rahul Verma example plus 5 variants);
  - `services/core/effects.test.ts` (E2 auto-assign, E5 booked → property booked + client, E6 visit → stage, E7 completion → post-visit task, E12 booked excluded from matching);
  - `store/rebase.test.ts`;
  - `data/seed/index.test.ts`.
- [ ] `pnpm dev` serves on **5174**, with no console errors or warnings on load for any role.
- [ ] `playwright.config.ts` and `e2e/smoke.spec.ts` exist and pass. The smoke test switches through all 5 profiles (admin, manager, 3 execs), visits every nav item for each, asserts no console errors, and checks that the executive sees NoAccess on `/team`.

**Shell and cross-cutting**

- [ ] DESIGN_SYSTEM §12 `index.css` is in place, Inter + Noto Sans Tamil load, and every token class used in the DS compiles.
- [ ] App shell per DS §11.1:
  - the sidebar with groups (Work, Sales, Inventory, Insights, Admin) filtered by permission, collapsible, with live count badges (unassigned, overdue tasks, today's appointments);
  - a topbar with crumbs, the "Search or ask AI… Ctrl K" bar, bell, theme toggle and EN / த toggle;
  - a mobile bottom tab bar per role and the sidebar as a sheet;
  - the floating AI button.
- [ ] **Profile switcher:** 3 roles, 3 switchable executives, persisted, instant change with no reload, toast, and redirect to `/today` when a route is not allowed.
- [ ] **Theme** light / dark / system with no flash on reload. **Language** EN / Tamil switches every visible shell string, and `<html lang>` updates.
- [ ] **Route registry:** every route listed in §8.1 exists. Each module's page is a **stub** with a page header and a "Coming in Phase 2" empty state using the module's illustration. A permission is declared on every route, and NoAccess works.
- [ ] Error boundary per route. `NotFound` page.

**Data, services, AI**

- [ ] `domain/types.ts` and `catalogue.ts` are complete (§2.1, §2.2).
- [ ] The seed builds with the §6 counts and distribution. Data persists across reload. Rebase works by simulation: change `meta.anchorDate` in devtools to yesterday, reload, and today's items are still today. `services/demo.reset()` works.
- [ ] Every service in §2 exists with working create / update / delete for its entity. All of them go through `commit()`. Effects E1–E18 and the automation timers are implemented. Undo works for delete.
- [ ] `services/queries/visibility.ts`, `today.ts` (first version) and `stats.ts` (first version) exist.
- [ ] `lib/*` ported and new logic per §7.5. Matching per §7.7.
- [ ] `ai/`: the interface, `getAI()`, a simulated provider working for extract × 3, score, qualify, match, message and a basic `parseCommand`, and the live stub with fallback. `.env.example` exists.

**Shared components** (all real and usable, each shown once on a hidden dev-only route `/__kit` that is excluded from nav and removed before delivery)

- [ ] `components/shared`: kpi-card (sparkline, ring and highlight variants), the chart wrappers (area, bar, donut, funnel, heatmap, gauge), data-table, filter-bar, drawer, empty / error / skeleton states, timeline, avatars, badges, workload-bar, file-uploader, mapping-table, date-time-field, amount-input, phone-input.
- [ ] `components/ai`: ai-panel (opens with Ctrl+K, shows proposals, confirm → service), demo-ai-badge, paste-and-fill-box (text + voice + file .txt, which fills a form through a callback and marks fields), voice-button (with fallback), ai-field, missing-questions.
- [ ] `components/domain` first versions: lead-card, property-card, appointment-card, task-row, match-list, assign-dialog, stage-change-dialog, appointment-form-dialog, task-form-dialog, log-activity-dialog, contact-actions, activity-timeline.
- [ ] `components/illustrations`: the DS §9 set.

**Docs**

- [ ] `CONVENTIONS.md` contains: the folder structure, import rules, ownership table, the service / commit pattern, i18n namespaces, permission use, tokens-only styling, and test commands.
- [ ] `README.md` contains: setup (`pnpm i`, `pnpm dev` on 5174), scripts, env, and the profiles.
- [ ] `PROGRESS.md` is updated, and there is a checkpoint commit ("feat(crm-e2e): foundation").

---

## 10. Known limitations decided now

- **K1. OCR language data.** `tesseract.js` downloads `eng.traineddata` from its CDN on first use. If the demo machine is offline, image OCR fails gracefully: the error says so, the user can paste the text instead, and a Draft can still be created manually. PDF text extraction works offline, because the pdf.js worker is bundled.
- **K2. Voice.** It needs a Web Speech API browser (Chrome or Edge). Elsewhere it shows a fallback message.
- **K3. Images.** Images are stored as data URLs in localStorage. They are compressed, at most 8 per property, and capped at about 4 MB in total. Over the cap, the uploader refuses with a clear message.
- **K4. AI.** All AI is simulated by default (rule-based, labelled "Demo AI"). The live provider needs a backend proxy, which is not part of this frontend.
- **K5. WhatsApp and calls.** These open `wa.me` and `tel:` links. Sending is logged as an activity when the user clicks. No delivery confirmation is possible.
