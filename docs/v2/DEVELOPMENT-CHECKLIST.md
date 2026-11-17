# Development Checklist — v2
## Real Estate Specification & Lead Management Platform

| | |
|---|---|
| **Version** | 2.0 (draft for team approval) · 16 November 2026 |
| **Requirements / design** | `docs/v2/PRD.md` · `docs/v2/TRD.md` · wireframe `spec-system-wireframe/` |
| **Replaces** | `docs/DEVELOPMENT-CHECKLIST.md` (v1) from R1 onwards. v1 Phase 0–2 history stays there |

**How to use this checklist**
- Work top to bottom inside a release. Tick an item only when it meets the **Definition of Done** (§0.3).
- IDs in brackets point to the PRD (`PROP-18`) or the TRD (`H-3`, `§7.3`).
- Every release ends with a **team review gate**. The next release starts only after sign-off.
- Branch from `main` per step (`feat/r1-…`). Small PRs, one step each. CI must be green. **No commit or push without the owner's approval.**

---

## 0. Before development starts

### 0.1 Approvals
- [x] Team approves PRD v2, TRD v2 and this checklist (2026-11-16)
- [ ] Decisions confirmed (PRD §20):
  - [x] D1 statuses: confirmed
  - [x] D2 property types: confirmed, replaced by the wireframe catalogue ([PROPERTY-CATALOGUE.md](PROPERTY-CATALOGUE.md))
  - [x] D3 delete rule: confirmed
  - [x] D4 roles: confirmed (Admin, Sales Manager, Sales Executive; only the Admin adds roles)
  - [ ] D5 lead source
  - [ ] D6 file types
  - [ ] D7 work week
  - [ ] D8 cost rates
  - [ ] D9 scoring rules
  - [ ] D10 release order
  - [ ] D11 legal checklists (legal advisor)
  - [ ] D12 negotiation in matching
  - [x] D13 admin HNI access: resolved by D4 (Admin has every permission)
- [x] Wireframe accepted as the UI reference for R1–R3 (layout, components, style). Dark theme to be designed from it (TRD §12.1)

### 0.2 Repository
- [x] Working branch `feat/property-management-system` created from `spec-system-wireframe`, so it carries the wireframe and `docs/v2/` as references into `main` with the R1 merge
- [ ] Move `docs/PRD.md`, `TRD.md` and `DEVELOPMENT-CHECKLIST.md` to `docs/v1/` once v2 is approved; add a pointer in README
- [ ] Update README: replica-set MongoDB, migrations command, new environment variables

### 0.3 Definition of Done (every item)
- [ ] Behaviour matches the PRD requirement and the wireframe screen (light **and** dark theme, 390 px width)
- [ ] Shared zod schemas for every request and response; OpenAPI updated; no `any`
- [ ] Permissions enforced in the API (and own-scope where relevant); UI hides what the role can't do
- [ ] Unit and integration tests added; admin component tests for the behaviour; all suites green
- [ ] Lint, typecheck, format and build green in CI
- [ ] Change log and history entries written for business changes
- [ ] Accessibility: labels, keyboard, focus, contrast checked
- [ ] Reviewed in a PR; owner approves before commit and push

---

## R0. Foundation (built in v1; kept)

| Area | Status |
|---|---|
| Monorepo, CI, env validation, logging, error envelope, OpenAPI, UUID v7, audit fields, change logs | ✅ |
| Auth: login, refresh rotation, invite, reset, lockout, sessions, CSRF header | ✅ (hardening in R1.0) |
| Users & Roles (v1: 3 fixed roles), My Profile, Settings → Company info | ✅ (roles move to the database with custom roles in R1.0) |
| Settings → Property types & amenities (3 categories, 9 subcategories, attributes, amenities) | ✅ (extended in R1) |
| Properties v1 (list, form, media, map, detail, history, statuses), Bulk import v1 (Excel) | ✅ (reworked in R1/R2) |
| Tests 256/256, Phase 2 test report PASS | ✅ |

---

## R1. Properties v2

### R1.0 Foundation & hardening (do first)

**Database & infrastructure**
- [x] MongoDB **single-node replica set** in docker-compose (`--replSet rs0` + init script); tests use `MongoMemoryReplSet` (H-4)
- [x] `withTransaction()` helper in `db/transaction.ts` (AsyncLocalStorage, no session passing); used for properties, media, property-type deletes, roles, users, refresh rotation (H-4). Remaining services move over as they are touched
- [x] Migration runner (`apps/api/src/migrations`, in-house, lock + idempotent), `pnpm migrate up|down|status`, `syncIndexes()` and property-type seeding moved out of boot; production refuses to start with pending migrations (M11)
- [x] Migration: create `roles` with the 3 system roles; users `super_admin` → `admin`, `sales_agent` → `sales_executive` (ROLE-10, TRD §7.13 #2)

**Back end hardening**
- [x] H-1 SSRF: `ipaddr.js` unicast-only, pinned DNS lookup on the connection itself, https only, no private redirects, caps. Tests for `::ffff:7f00:1`, `64:ff9b::…`, `fec0::1` and DNS rebinding
- [x] H-2 Invite and reset tokens in POST bodies; logger logs the path only; redact `authorization`, `cookie`, `token` and `password`
- [x] H-3 Optimistic concurrency (`versionPlugin`, `requireIfMatch`, 428 when missing) middleware (`ifMatch`), `version` in responses, 409 `VERSION_CONFLICT`; apply to properties and settings
- [x] M1 Media reorder and set-cover via `arrayFilters` by `_id`; L1 atomic 60-file limit
- [x] H-5 Refresh-race code without clearing the cookie (M3); basic password rules: 6+ characters, upper, lower, number, special; no blocked words (M4, owner decision)
- [ ] L5 Per-IP lockout and constant-time forgot-password
- [x] H-6 Production guards: Resend required, https origins, `TRUST_PROXY`; Swagger already off without auth (M5)
- [x] H-8 Error handler respects `headersSent` and keeps known 4xx codes (L7)
- [x] M10 Shutdown deadline (25 s) and `unhandledRejection`/`uncaughtException` handlers; `/live` and `/ready`
- [x] L3/L4 Usage-check races (subcategory/amenity delete, last Admin) inside transactions
- [x] L10 suppress the reserved-key warning
- [ ] L6 Cap the geocoder queue; L9 tighten MP4/WebM sniffing and re-encode the logo
- [ ] L11 / H-12 Dedupe helpers (`escapeRegex`, `userNames`, multer wrapper) into `lib/`; derive `*Doc` types from schemas; remove cross-module model access


**Role management (PRD §4.2, TRD §6.1, §7.14)**
- [x] Shared: permission catalogue with label/group/sensitive/reserved; `SYSTEM_ROLE_DEFAULTS`; new permissions (`roles:manage`, `rules:edit`, `properties:archive`, `properties:delete`, `customers:*`, `hni:*`, `reports:*`); remove the `ROLES` enum (ROLE-07)
- [x] DB: `roles` collection and model (key, name with a case-insensitive unique index, system, permissions, version)
- [x] API: `RoleCache` (load at boot, invalidate on write, 30 s TTL); `toAuthUser` resolves permissions from it; drop the `role` claim from access tokens; `/auth/me` returns role and permissions
- [x] API: `GET /permissions`; roles CRUD with If-Match; `reset` for SM/SE; `move-users`; reserved-permission 422; Admin locked 403; `ROLE_IN_USE` 409; last-Admin 409 in a transaction (ROLE-01–06)
- [x] API: users service validates `role` against `roles`; invite/edit accept any role key
- [x] Change log entries for role create/edit/delete and user moves (ROLE-09)
- [x] UI: Users & Roles → **Roles** tab: list (System/Custom, users, last change), dynamic permission matrix (one column per role) replacing the static `RolesMatrix`/`roleMatrix.ts` (ROLE-08)
- [x] UI: New/Edit role sheet: name, description, “Start from”, permissions grouped by module, None/Own/All for scoped areas, sensitive warnings, confirmation with affected user count, “Reset to defaults” (ROLE-04/05)
- [x] UI: Delete role confirmation; “Move users to…” when the role is in use (ROLE-06)
- [x] UI: `RolePicker`, `UserBadges`, `UsersFilters` and menus read roles and permissions from the API, not constants
- [x] Tests: each system role's matrix; a custom role end to end (create → assign → access → edit → next request reflects it → delete blocked → move users → delete); reserved permissions rejected; last-Admin guard incl. concurrent demotion; migration up (no down by design)

**Shared domain package** (moved to R1.1, built together with its first users)
- [ ] `packages/shared/src/domain/` created: `status.ts`, `pricing.ts`, `legal.ts`, `location.ts` (R1); stubs for later
- [ ] Golden tests ported from the wireframe fixtures (pricing, legal wording, location preview, status transitions)

**Front end: design system and shell**
- [x] Tokens from the wireframe into `index.css`: brand, background, panel, ink, muted, lines, tone colours and soft variants; **dark pairs**; Inter font (TRD §12.1)
- [x] Replace hard-coded palette classes with tones; lint rule against raw palette classes outside `components/ui`
- [ ] shadcn additions (dialog, radio-group, progress, popover, command, toggle-group, accordion): added with the screens that first use them (R1.1–R1.7)
- [x] Pattern components (`components/patterns`): `PageHeader`, `KpiTile`, `Chip`, `Note`, `NumberedSection`, `Meter`, `EmptyState`, tone maps
- [ ] Remaining patterns, built with the screen that first needs them: `DescriptionGrid`, `Timeline`, `ConfirmDialog`, `InlineField`, `EditableTable`, `StatusSelect`, `RadioCards`, `StepBar`
- [x] Global restyle: table header and rows, underline tabs (brand), card borders and shadow
- [x] App shell:
  - wireframe sidebar groups, 236 px, collapsible, soft active state, count slots, lock icon;
  - top bar with breadcrumbs (section prefix + entity code) and quick actions;
  - content max 1380 px;
  - mobile drawer on `Sheet` (focus trap, Escape)
- [x] Route-level code splitting (`React.lazy`): initial load ≈ 285 KB gzip (was 345 KB, one 1.16 MB chunk); `manualChunks` not needed
- [x] An `<h1>` via `PageHeader` on every page (route `handle.page`, wireframe wording)
- [ ] `ChangeStatusDialog` on `Dialog`: with the new statuses (R1.1)
- [ ] Playwright set up (local + CI job on the built app): moved to the R1.8 testing gate; screen checks for R1.0 were done with headless Edge

**Gate R1.0:** all suites green; screenshots of the restyled existing screens in light and dark; security tests for H1–H4 pass.

### R1.1 Statuses, settings and data model

- [x] **DB**: migration 0003 `published → available`, `unpublished → on_hold` (with a safe `down`); the listing date stays in `publishedAt` (D1, PROP-45)
- [x] **Shared**: new `PROPERTY_STATUSES`, labels, tones and `STATUS_TRANSITIONS` (PROP-43); list query accepts old values as aliases for one release
- [x] **API**: status endpoint uses the new transitions; the publish checklist leads to Available; bulk status
- [x] **DB**: property fields `pricePerSqft`, `legal[]`, `legalSummary`, `location.{roadType, roadWidthFt}`, `highway`, `nearby[]` (top-level, see TRD §7.3), `valuation`, `archive`, `searchText`, `version`; derived fields computed by the shared domain on every write
- [ ] `media[].caption/visibility` (private documents, M6): with the Legal & documents tab (R1.5)
- [x] **DB**: subcategory `mainAreaMeaning` and `legalChecklist[]` (TRD §7.1)
- [x] Attribute `review` (PROP-20): built in R1.2, stored on each placement
- [x] **Catalogue v2** ([PROPERTY-CATALOGUE.md](PROPERTY-CATALOGUE.md)): new `propertyTypes.defaults.ts`; attribute type `month`; seed when the catalogue is empty; `pnpm db:reset-catalogue` (dev/test only); `pnpm seed:demo` with the wireframe's 12 sample properties; update test fixtures (PROP-13)
- [x] **Migration** 0004: legal checks from each type checklist and `legalSummary` on existing properties (idempotent)
- [x] **Migration** 0004: `pricePerSqft`, `searchText`; indexes of TRD §7.12 (applied by `pnpm migrate`)
- [x] **Settings**: `valuationCosts` (7/4/1) and endpoints `GET/PUT /settings/valuation-costs` (If-Match)
- [x] **Admin, Settings → Property types:** legal checklist editor (standard or custom checks, reorder, mandatory) and main-area meaning per type
- [x] **Admin, Settings → Cost assumptions** tab with a worked example
- [x] “New” attribute review list (Mark reviewed / Edit / Remove): built in R1.2
- [x] Tests: migrations 0003/0004 (up, down, idempotent); transition matrix; catalogue v2 contents; reset and demo commands; domain golden tests (pricing, legal, search); settings validation
- [x] Local database: reset to catalogue v2 with the 12 wireframe sample properties (backup taken first)
- [x] Properties list: the status tabs overflowed; fixed in R1.2 (status is a dropdown with counts)

### R1.2 Properties list and form (restyle + attribute confirmation)

- [x] **API list**: projection (list fields only); `legal=open|clean`; `archived=only|include` (a status filter wins); indexed sorts; word-prefix search on `searchText`; rows carry ₹/sq.ft., legal summary and listing date. The existing `GET /properties/status-counts` serves as the stats endpoint (nav count, status counts, footer). `location-suggestions` takes `limit` (≤ 200) for the city filter (PROP-54–56)
- [x] **Admin list**:
  - page header with ＋ Add property and **Bulk import right after it** (PROP-53);
  - columns: code, property (photo, type · purpose), location, area, price + ₹/sq.ft., Legal chip, Status chip, listed / updated;
  - filters: type, city (dropdown of every city in use), status (dropdown with counts, replaces the tab row), legal, archive view, purpose, price, featured; all in the URL;
  - footer “n shown · n active · n archived”;
  - row click opens the property; row menu as before (Archive/Restore through Change status until R1.7); empty, loading and error states
- [x] **Admin form**:
  - `PropertyFormPage` split into `MainInfoSection`, `SpecificationsSection`, `AmenitiesSection`, `FormSidePanel`, `ConflictDialog`;
  - one card with numbered sections 1–5 (PROP-59); type picked from a dropdown grouped by category, derived category shown;
  - live ₹/sq.ft. (shared `pricePerSqft`) and area label from `mainAreaMeaning`; code shown as “Auto: RE-PLT-…”;
  - road type and width with the location (choice B); State moved into section 1;
  - sticky action bar;
  - property name and road width rules shared with the API;
  - 409 conflict dialog (who saved; load theirs or keep mine)
  - Fixed: the form did not send road type and width, so saving erased them (the whole location is saved)
  - Status and listing date are shown in the side panel (status changes keep going through the status actions); after the first save the form opens the Media section until the Location tab exists (R1.4)
- [x] **Attribute from the form**:
  - two-step dialog: details → **confirmation summary** (impact count) → **Confirm and add to settings** (PROP-16–21); Cancel returns with the inputs kept;
  - `POST …/attributes/preview`; adding from a form without `confirmed: true` is refused (428 CONFIRMATION_REQUIRED);
  - “Use for ‹type›” also confirms; “Only this property” stays immediate;
  - the placement gets `review` (property code, who, when) → “New” chip and a **New attributes to review** list in Settings (Mark reviewed / Edit / Remove; logged)
- [ ] Media: delete confirmation; caption; private visibility for documents; authenticated download route (H-7, PROP-68): moved to R1.5 with the Legal & documents tab
- [x] Tests:
  - API: list filters (legal, archive view, word-prefix search), row fields, suggestion limit; attribute preview, confirmation, review tag and Mark reviewed;
  - admin: list (chips, footer, filters to URL), form (type dropdown, live ₹/sq.ft., road fields sent, 409 dialog), the attribute confirm/cancel flow (Cancel saves nothing), the review list
- [ ] Playwright: add a plot → draft → photos → Available: moved to R1.8 with the release tests

### R1.3 Property detail shell + Specifications, Media, History

- [ ] Nested routes `/properties/:id/{specs,location,legal,pricing,media,history}` (matches tab hidden until R5); lazy tabs (PROP-66)
- [ ] Header:
  - icon, name, chips (code, category, type, purpose, status), meta line;
  - price + ₹/sq.ft. with basis;
  - `StatusSelect`, Edit, Archive, Delete (Restore when archived) (PROP-64)
- [ ] Banners: archived info; open mandatory legal checks (PROP-65)
- [ ] Specifications tab: `DescriptionGrid` for main and type-specific fields, amenity chips, Edit links
- [ ] Media tab: reuse `MediaManager` (photos, cover, floor plans, brochures, documents, videos)
- [ ] History tab: `Timeline` (who, what, when, before → after), with archive, restore and delete tombstone labels
- [ ] Tests: detail page component tests (not covered before); history rendering

### R1.4 Location tab

- [ ] **API**: `PATCH /properties/:id/location` (If-Match): road type and width, highway, `nearby[]` (≤ 30, validated enums) (PROP-22–24)
- [ ] **Shared**: `advertisable()` preview rules (PROP-25/26)
- [ ] **Admin**:
  - address and coordinates fields (inline);
  - highway card;
  - nearby `EditableTable` (category, name, km, route checked, status, advertising chip, remove);
  - map card with “Open in maps”;
  - customer-facing preview card (verified list, future infrastructure, hidden count)
- [ ] Tests: validation, preview rules, a concurrent edit gives 409, inline save and error states

### R1.5 Legal & documents tab

- [ ] **API**: `PATCH /properties/:id/legal/:key` (atomic element update); rules (PROP-29/30):
  - upload or link → pending;
  - verified requires a verifier and sets the date;
  - not collected clears the fields;
  - `legalSummary` recomputed in the same write;
  - change log per change
- [ ] **API**: link an uploaded document (`mediaId`) to a check; uploading from the tab creates the media item and links it
- [ ] **Admin**:
  - KPI tiles (verified, pending, not collected, open mandatory);
  - checklist table: status select + chip, mandatory badge, verified by, date, upload/link, notes;
  - note “checks are not interchangeable”;
  - customer-facing wording card (PROP-31–33)
- [ ] List and detail legal chips and banner use `legalSummary` (PROP-34)
- [ ] Tests: the full status rule matrix; wording generator; summary; permission checks

### R1.6 Pricing & valuation tab

- [ ] **API**: `PATCH /properties/:id/valuation` (If-Match): review date, valuer report (+ document), notes, comparables (≤ 20)
- [ ] **Shared**: `valuationSummary`, `transactionCosts`, `pricePerSqft` (PROP-35–41)
- [ ] **Admin**:
  - asking price card with the formula;
  - value positioning (averages, range, diff %, neutral position chip, “never a bargain” note);
  - comparables `EditableTable`;
  - bar chart with `Meter`;
  - transaction costs and all-in (from settings);
  - valuation evidence card
- [ ] Tests: domain golden values (₹28,00,000 ÷ 1,200 = ₹2,333; positioning cases), API validation

### R1.7 Archive, restore and delete

- [ ] **API**:
  - `GET /properties/:id/links` (link registry; TRD §7.9);
  - `POST …/archive` (reason, timeline notes to linked customers when they exist, transaction);
  - `POST …/restore` (→ Draft);
  - `DELETE` with `X-Confirm-Delete: <code>`;
  - links checked inside the transaction;
  - 422 `DELETE_BLOCKED_LINKED`;
  - media removed after commit;
  - tombstone change log (PROP-46–52)
- [ ] Permissions: `properties:archive` and `properties:delete` (Admin and Sales Manager by default; can be granted to custom roles)
- [ ] **Admin**:
  - Archive confirmation (effects, linked customers, upcoming appointments warning, reason);
  - Delete blocked dialog with “Archive instead”;
  - Delete confirmation with the “I understand” tick;
  - archived banner and Restore;
  - list archive filter
- [ ] Tests: blocked vs allowed delete; a concurrent link created during delete blocks it; restore → Draft; archived properties excluded from list defaults and stats

### R1.8 Release testing and team review
- [ ] Full suites + coverage (domain ≥ 95%, services ≥ 80%)
- [ ] Playwright R1 flows in both themes and at 390 px:
  - add property;
  - attribute confirm;
  - location, legal, pricing;
  - status changes;
  - archive, restore, delete
- [ ] Load check: list at 10k seeded properties (p95 < 500 ms)
- [ ] Visual review against the wireframe (screenshots in the PR)
- [ ] R1 test report (`docs/testing/R1-TEST-REPORT.md`)
- [ ] **Team demo and sign-off → R2**

---

## R2. Bulk Import v2

### R2.1 Data and validation
- [ ] **DB**: `importRows` collection; batch status `checked|importing|imported|failed`, `cursor`, totals, options; migration of existing batches (TRD §7.5)
- [ ] **API upload**:
  - zip-bomb / sheet-size guard;
  - ExcelJS streaming reader;
  - **CSV via `csv-parse`** (D6);
  - file saved after the batch exists, with clean-up on failure (M9)
- [ ] **Template**: Property code column; v2 attributes; dropdowns; Instructions sheet; sample file; `GET /imports/columns` guide (IMP-02/03)
- [ ] **Validation**:
  - one-query preload of codes and duplicate keys (M8);
  - shared schemas;
  - results New / Update / No change / Duplicate / Error;
  - unknown, duplicate-in-file, other-subcategory and archived codes are errors;
  - warnings (duplicate name and locality, new locality, unknown amenities, unknown or missing columns);
  - **changes old → new** (IMP-05–07)

### R2.2 Commit
- [ ] **API**: `POST /imports/:id/commit` chunked (≤ 50 rows) with Idempotency-Key and cursor; per-row transaction; outcome written immediately; resumable; internal service methods (ids only) (H2, IMP-11/15)
- [ ] Rules:
  - update by code only changes the filled cells;
  - never changes status, legal, location tabs or valuation;
  - new rows get a `not_collected` legal checklist (IMP-10);
  - Available only if the publish checklist passes
- [ ] Hardened image download (H-1) with concurrency 4
- [ ] Lazy clean-up of import files older than 30 days (L8)

### R2.3 Admin wizard (wireframe “Bulk import”)
- [ ] `StepBar` (4 steps); radio-card type picker with field counts; template, sample and “Try with sample data”; template column guide (IMP-01–03)
- [ ] Dropzone with the rules note; upload progress (IMP-04)
- [ ] Review:
  - KPI tiles;
  - result filter;
  - paged / virtualised table (no 500-row cap) with result chips, messages and old → new changes;
  - options (update by code, duplicates skip/update, import as Draft/Available) (IMP-08/09)
- [ ] Confirm import dialog (counts) → progress bar across chunks → result card with links and next steps (IMP-11/12)
- [ ] Error report download (xlsx/csv); history with “Resume import” for `importing` batches (IMP-13/14)

### R2.4 Release testing and team review
- [ ] Integration tests:
  - xlsx and CSV;
  - every row result;
  - chunk retry and idempotency;
  - crash/resume simulation;
  - SSRF image URLs;
  - 16 MB-safe row storage
- [ ] Load: 2,000 rows validated < 20 s; commit time and memory recorded
- [ ] Playwright: template → upload sample → review → import → error report → history
- [ ] R2 test report; **team demo and sign-off → R3**

---

## R3. Lead Pipeline (customers basics + pipeline)

> Precondition: decision **D5** (our DB is the system of record for leads) approved.

### R3.1 Data and API
- [ ] **DB**: `customers` (TRD §7.6), `activities` (§7.7), `appointments` (§7.8, site visits) with indexes; counter `CUST-000001`
- [ ] **Shared schemas**: customer create/update (purpose, budget rules, type-specific requirements), stage change, consent, activity
- [ ] **API**: customers CRUD (If-Match), own-scope for Sales Executives, duplicate mobile check (CUS-01–09)
- [ ] **API**: `POST /customers/:id/stage`:
  - lost reason required for Lost;
  - `lostAtStage` recorded;
  - follow-up cleared;
  - activity in the same transaction (PIPE-01/03/04)
- [ ] **API**: consent give/withdraw (clears the follow-up, logs it); follow-up date rejected without consent (CUS-03, GEN-04)
- [ ] **API**: auto-assign to the least-loaded active executive; reassign (`customers:assign`) (PIPE-08)
- [ ] **API**: activities (contact types update last contact and responded; documents shared → docsRequested) (PIPE-06/07)
- [ ] **API**: `GET /pipeline` (grouped, counts, days in stage, stuck flag from `salesRules.stuckDays`), `GET /follow-ups/due` (PIPE-02/05/12)
- [ ] **API**: negotiation, and site visits (appointments, type `site_visit`); booking a visit moves earlier stages (PIPE-09/10)
- [ ] Property links registry extended: recommendations, negotiation, appointments (PROP-52)
- [ ] Settings: executives list (users with the Sales Executive role, active flag), stuck days, lost reasons (SET-05/06)

### R3.2 Admin screens (wireframe “Customers”, “Lead pipeline”)
- [ ] Customers list: columns, filters, sorts, follow-up chips (CUS-10/11)
- [ ] Add/Edit customer: numbered sections A–E, purpose radio cards, live budget summary, type-specific requirement fields, consent with explanation (CUS-04–08)
- [ ] Customer detail:
  - header (owner select, next follow-up disabled without consent, Edit, Move stage, Log activity);
  - Overview (requirements, budget with the “clarify” warning, sales record);
  - Follow-ups & activity (log form, timeline, consent card, site visits, negotiation, reason lost) (CUS-12/13)
- [ ] Pipeline Kanban (dnd-kit, keyboard accessible): stage columns, cards, ⚠ stuck, executive filter, Lost modal with reason (PIPE-01–05)
- [ ] Sidebar: Customers count, Lead pipeline; quick action ＋ Customer
- [ ] Property → Archive dialog now shows linked customers and upcoming visits; Delete is blocked when linked (PROP-46/49)

### R3.3 Release testing and team review
- [ ] Integration tests: permissions (own scope), consent rules, stage transitions with transactions, assignment fairness, links blocking property delete
- [ ] Playwright: create a lead → assign → log a call with a follow-up → drag across stages → Lost with a reason; consent withdraw
- [ ] Privacy check: data minimisation, consent records, export/delete of a customer's personal data (PRD §18)
- [ ] R3 test report; **team demo and sign-off**

---

## R4. Qualification & public enquiry (proposed order, D10)
- [ ] Shared `readiness.ts`, `classification.ts`, `budget.ts` with golden tests (Arun = 79, Qualified buyer)
- [ ] `settings.salesRules` (points total 100, bands, high-value threshold) + Settings → Sales rules screen (SET-07/08)
- [ ] `PATCH /customers/:id/qualification`; `derived.readiness/band/suggestedClassification` refreshed on every relevant write
- [ ] Admin:
  - Qualification (BANT) tab with question texts and inline answers;
  - breakdown table and bands;
  - three score cards on Overview;
  - classification select with suggestion and override (QUAL-01–05)
- [ ] Public enquiry: `POST /public/enquiries` (rate limit, honeypot, Idempotency-Key, ≤ 20 KB); 5-step public page; thank-you page; auto-assign; follow-up only with consent (ENQ-01–04)
- [ ] Tests, Playwright, team review

## R5. Matching engine
- [ ] Shared `matching.ts` (filters, B/L/S/A/P, labels, reasons, ranking) — golden tests: Arun → PROP-1001 = 95 Strong top, PROP-1002 = 66 Conditional, PROP-1003 = Budget mismatch, scenario 001 = 9/9
- [ ] `settings.salesRules.matchWeights` (total 1.00) + settings UI (SET-09)
- [ ] API: indexed pre-filter + scoring; `GET /customers/:id/matches`, `GET /properties/:id/matching-customers`, recommendations, `GET /matching/explain` (TRD §8)
- [ ] Admin: Property matches tab (match cards, ★ top, components, reasons, recommend / schedule visit, excluded list); Matching engine page (step 1 table, step 2 ranking); property Matching customers tab (MATCH-01–06)
- [ ] Readiness “budget fits” uses the eligible matches; `derived.bestMatch`
- [ ] Performance: < 300 ms at 10k properties
- [ ] Tests, Playwright, team review

## R6. Appointments
- [ ] Shared `appointments.ts` (`overlaps`, `layoutDay`)
- [ ] API: list by range and filters, create/update with **clash check inside the transaction**, reschedule/cancel/complete/no-show, history (APPT-01–06)
- [ ] Admin Teams-style calendar: Day / Work week (Mon–Sat) / Week / Month / List, hour grid, side-by-side overlaps, now line, Time-TBC row, slot click to book, clash warning with “Book anyway”, detail/outcome/cancel dialogs, KPI tiles, needs-outcome list (APPT-02–07)
- [ ] Dashboard card “Today's appointments”; own-scope for Sales Executives (APPT-08)
- [ ] Tests (overlap edge cases, concurrency), Playwright, team review

## R7. Dashboard & reports
- [ ] API: `/dashboard` and `/reports/*` with `$facet` aggregations, role-scoped (DASH-01–03, RPT-01–03)
- [ ] Admin: KPI tiles, pipeline bars, stuck list, follow-ups due, priority leads, readiness mix, inventory, open legal listings; reports page (funnel, stuck, sources, purposes, types, classification, lost reasons, unmet demand, executive performance)
- [ ] Performance: < 1 s at 20k customers; tests; team review

## R8. HNI assessment (restricted)
- [ ] `customerHni` collection; `hni:read/write`; access logging; restricted redaction in customer responses (TRD §6.1, §7.10)
- [ ] API: HNI status rules (Verified requires consent; indicators → Potential; reviewer and date) (HNI-01–06)
- [ ] Admin: HNI tab (signals with questions, verification, classification ladder, warnings); HNI register page; “Restricted” for others
- [ ] Security review of HNI access; tests; team review

## R9. AI integration (later)
- [ ] Separate TRD addendum: provider (Perfox/MCP or other), tools (initial questions → create/update enquiry, explain property specifications, call preparation), security and rate limits, audit

---

## Cross-cutting: deployment and operations (before the first production release)
- [ ] Staging server: Nginx (TLS, gzip, admin static build, public `/uploads` only, body size 60 MB, timeouts), Node via systemd/PM2, MongoDB single-node replica set
- [ ] Release script: build → `pnpm migrate up` → restart → smoke test (`/ready`, sign in, list properties)
- [ ] Backups: daily `mongodump --oplog` + `uploads/` rsync off-server, 30-day retention; **restore drill** documented and done
- [ ] Monitoring: uptime check on `/live`; log shipping or retention; disk-space alert for `uploads/`
- [ ] CI additions: `pnpm audit --prod` (fail on high), coverage report, Playwright job, Dependabot/Renovate
- [ ] Security checklist per release: OWASP ASVS L1 items, dependency audit, secrets check, permission matrix test

## Low-priority findings tracker (from the review)
- [x] L1 Atomic media limit · [ ] L2 Check `modifiedCount` before the status change log · [x] L3 Subcategory/amenity delete race · [x] L4 Last Admin race (covered by the last-Admin guard, R1.0) · [ ] L5 Lockout abuse / forgot-password timing · [ ] L6 Geocoder queue cap · [x] L7 Error handler `headersSent` · [ ] L8 Import file clean-up · [ ] L9 Video sniffing, logo re-encode · [x] L10 Reserved-key warning · [ ] L11 Duplicated helpers, derived Doc types
