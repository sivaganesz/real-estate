# Technical Requirements Document (TRD) — v2
## Real Estate Specification & Lead Management Platform

| | |
|---|---|
| **Version** | 2.0 (draft for team approval) |
| **Date** | 16 November 2026 |
| **Replaces** | `docs/TRD.md` (v1) for everything below. v1 conventions not changed here still apply |
| **Requirements** | `docs/v2/PRD.md` (requirement IDs such as `PROP-18` are referenced here) |
| **UI reference** | `spec-system-wireframe/` (approved wireframe, commit `80209dc`) |
| **Build plan** | `docs/v2/DEVELOPMENT-CHECKLIST.md` |

---

## 1. Review of the existing implementation and the decision

On 16 Nov 2026 the existing monorepo (`apps/api`, `apps/admin`, `packages/shared`) was reviewed against two requirements: the **UI must follow the approved wireframe**, and the **back end must be clean, reliable, optimised and current**. The review had three parts:
- a feature comparison with the wireframe;
- an independent back-end code review;
- an independent front-end and UI review.

### 1.1 Facts

| Check | Result |
|---|---|
| Automated tests | **256 / 256 pass**: API 164, admin 59, shared 33 |
| Type check, lint | Clean (strict TS, `noUncheckedIndexedAccess`, 0 `any`) |
| CI | Format → lint → typecheck → test → build on every push (`.github/workflows/ci.yml`) |
| Phase 2 test report (13 Nov) | Pass: 47/47 end-to-end browser cases, 0 open bugs |

### 1.2 Scores (1–5)

| Back end | Score | | Front end | Score |
|---|:-:|---|---|:-:|
| Architecture & layering | 4 | | Architecture (router, TanStack Query, RHF + zod, guards) | 4 |
| Correctness & reliability | 3 | | Code quality | 4 |
| Security | 3 | | Tests | 3 |
| Performance & scalability | 3 | | Accessibility | 3.5 |
| Data model | 4 | | Design-system readiness (for the wireframe look) | 3 |
| API design | 4 | | | |
| Testing & tooling | 4 | | | |
| Observability & operations | 3 | | | |
| Code quality | 4 | | | |

### 1.3 Decision: **keep and improve; do not start fresh**

- **Already in place:**
  - strict TypeScript;
  - zod schemas shared between API, admin and OpenAPI;
  - a consistent error envelope;
  - argon2id with rotating refresh tokens and reuse detection;
  - a permission check on every route;
  - upload content sniffing and path-traversal guards;
  - UUID v7 ids, audit fields and change logs;
  - a configurable property-type model;
  - Excel import with error reports.

  A rewrite would rebuild all of this at high risk and no gain.
- **Every weakness found is local**: no optimistic locking or transactions, a non-resumable import commit, one SSRF bypass, tokens in logs, and list indexing gaps. Each takes days, not a redesign. They are scheduled as the **hardening track (§13, H-tasks)**, done in R1 before new features ship.
- **The UI gap is mostly visual.** The theme lives in one file (`apps/admin/src/index.css`, CSS variables + Tailwind `@theme`), and shadcn components are themable. The new screens (Location, Legal, Valuation, Customers…) need new back-end data whatever the UI framework, so rebuilding the UI would not make them faster.

### 1.4 Findings to fix (from the reviews; details in §13–§15)

| ID | Severity | Finding | Where |
|---|---|---|---|
| H1 | High | SSRF guard bypass: IPv4-mapped IPv6 in hex form, and DNS rebinding between the check and the fetch | `apps/api/src/lib/remoteFile.ts:20-31, 66-74` |
| H2 | High | Import commit marks the batch `imported` before processing; row outcomes are written only at the end, so a crash leaves it unrecoverable. One long request for 2,000 rows | `modules/imports/imports.service.ts:165-238` |
| H3 | High | Invite token in a GET query string; the request logger logs the full URL | `auth.routes.ts:201`, `middleware/requestLogger.ts:30-34` |
| H4 | High | Concurrent edits overwrite each other (update filter is `_id` only) | `properties.service.ts:353` |
| M1 | Medium | Media reorder / set-cover by array index from a stale read | `media.service.ts:143-170` |
| M2 | Medium | No transactions (Mongo runs standalone) for entity + change log, user lifecycle | `docker-compose.yml`, services |
| M3 | Medium | Refresh grace window still clears the cookie, so users are signed out at random with two tabs open | `auth.routes.ts:161-168` |
| M4 | Medium | Minimum password length is 6 | `packages/shared/src/schemas/common.ts:18` |
| M5 | Medium | Console email provider is the default in every environment and logs reset links | `config/env.ts:23`, `lib/email/console.ts:16` |
| M6 | Medium | Documents (legal papers) served publicly, cached 7 days | `app.ts:84-93` |
| M7 | Medium | List loads full documents; sort not index-backed; regex search scans | `properties.service.ts:45,114-135` |
| M8/M9 | Medium | Import re-reads per row; whole workbook in memory; all rows in one batch document (16 MB limit) | `imports.service.ts`, `workbook.ts:131`, `importBatch.model.ts` |
| M10/M11 | Medium | No shutdown deadline or crash handlers; `syncIndexes()` and data fixes run at boot | `server.ts:31-40`, `db/mongoose.ts:17` |
| F1 | Front end | No route code splitting (main chunk ≈1.15 MB); 1,010-line form page; hard-coded colours; no page primitives; mobile drawer without focus trap | `router.tsx`, `PropertyFormPage.tsx`, `AppLayout.tsx:223-244` |

Low findings (L1–L11: upload-limit race, delete-check races, lockout abuse, in-memory limiter/geocoder, headers-sent check, import file clean-up, loose video sniffing, logo not re-encoded, duplicated helpers) are listed in the checklist.

---

## 2. Architecture

A **modular monolith** (unchanged): one Express API process, one MongoDB, a local `uploads/` folder, and React SPAs. There are **no background workers or queues** (project rule). Long work runs as short, resumable request chunks driven by the client (§10).

```
  Admin portal (React 19 SPA)          Public enquiry page (R4, same SPA, public route)
          │  HTTPS · REST /api/v1 · JSON                 │
 ┌────────▼──────────────────────────────────────────────▼─────────────┐
 │                Express 5 API (Node 22, TypeScript)                  │
 │ /api/v1/auth/*   /api/v1/admin/*   /api/v1/public/*   /api/docs     │
 │ modules: auth · users · settings · propertyTypes · properties       │
 │          (location, legal, valuation, media) · imports · customers  │
 │          · activities · appointments · matching · reports · hni     │
 │ lib: storage · email · logger · remoteFile · geo · concurrency      │
 └───────┬───────────────────────┬───────────────────────┬─────────────┘
         │                       │                       │
 ┌───────▼───────────────┐ ┌─────▼──────────┐   ┌────────▼─────────────┐
 │ MongoDB 7             │ │ uploads/       │   │ External (on demand) │
 │ single-node REPLICA   │ │ public: images │   │ Nominatim (geocode)  │
 │ SET (for transactions)│ │ private: docs, │   │ Resend (email)       │
 └───────────────────────┘ │ imports        │   │ R9: AI / Perfox      │
                           └────────────────┘   └──────────────────────┘
```

**Domain logic lives in `packages/shared/src/domain/`** as pure, unit-tested functions (§8). The **API** uses them as the source of truth and stores derived values. The **admin** uses the same functions for instant previews, such as ₹/sq.ft. while typing, the live budget ceiling, or the readiness breakdown. There is one rule set and no drift.

---

## 3. Technology stack (current versions, kept)

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 LTS, pnpm workspaces |
| API | Express 5, zod 4, `@asteasolutions/zod-to-openapi` + swagger-ui-express, pino / pino-http, helmet, express-rate-limit, multer + sharp, ExcelJS, jose (JWT), `@node-rs/argon2`, libphonenumber-js, Resend |
| DB | MongoDB 7 + Mongoose 9. **Changes to a single-node replica set** (transactions) |
| Admin | React 19, React Router 8 (data router), TanStack Query 5, react-hook-form 7 + `@hookform/resolvers` (zod), shadcn/ui on Base UI, Tailwind CSS 4, lucide-react, sonner, Leaflet + OpenStreetMap |
| Tests | Vitest 5, Supertest, mongodb-memory-server (**replica-set mode**), Testing Library, **Playwright (new, end-to-end)** |
| **Additions** | `ipaddr.js` (address classification), pinned DNS lookup on `node:https` (IP pinning, no extra client), in-house migration runner (`pnpm migrate`), `csv-parse` (CSV import), `@dnd-kit/core` (Kanban, R3), shadcn `dialog`, `radio-group`, `progress`, `popover`, `command`, `toggle-group`, `accordion`, Inter font (`@fontsource-variable/inter`) |

---

## 4. Repository structure

Existing layout, kept and extended:

```
apps/api/src/
  app.ts · server.ts · config/ (zod env) · db/ (mongoose, ids, auditPlugin, transaction.ts NEW)
  middleware/ (auth, validate, errorHandler, rateLimit, requestLogger, security, sanitize, ifMatch NEW)
  lib/ (errors, http, logger, password, remoteFile, storage/, email/, regex.ts NEW (shared escapeRegex), names.ts NEW)
  modules/
    auth · users · profile · settings · geo · health · changeLogs
    propertyTypes/        # + legal checklist templates, main-area meaning, attribute review
    properties/           # property.model, properties.service/routes, media.*, propertyRules
      location.service.ts       NEW (nearby, highway)
      legal.service.ts          NEW
      valuation.service.ts      NEW
      lifecycle.service.ts      NEW (status, archive, restore, delete, links)
    imports/              # + importRow.model NEW, commit chunking, CSV reader
    customers/  activities/  appointments/  matching/  reports/  hni/  public/   (R3+)
  migrations/             NEW (runner + ordered, idempotent migrations; `pnpm migrate up|down|status`)
apps/admin/src/
  components/ui (shadcn) · components/layout (shell) · components/patterns NEW (PageHeader, KpiTile, Chip, Note, NumberedSection, DescriptionGrid, Meter, Timeline, ConfirmDialog, InlineField, EditableTable)
  features/<module>/ (api.ts query keys + hooks, components)
  pages/<module>/ (route components, lazy-loaded)
packages/shared/src/
  schemas/ (zod: request/response) · domain/ NEW (pure business logic) · roles.ts · format.ts · area.ts
```

**Rules:**
- **Thin routes, services hold the logic.** Routes validate and call services; services hold the business logic and have no `req`/`res`.
- **No reaching into other modules.** A module calls another module's **service**, never its Mongoose model. The current exceptions (properties → `UserModel`/`ChangeLogModel`, imports → `PropertyModel`) are fixed in the hardening track (H-12).
- **Derived types, not copies.** `*Doc` types come from the schemas (`InferSchemaType`) rather than being written by hand.

---

## 5. API conventions (v1 kept, with additions)

**Kept from v1:**
- **Paths:** `/api/v1/auth|admin|public/*`.
- **Responses:** `{ data }`, or `{ data, meta:{page,limit,total,totalPages} }` for lists.
- **Errors:** `{ error:{ code, message, details[], requestId } }`.
- **Validation:** zod at the boundary, which also feeds OpenAPI.
- **Money:** integer rupees.
- **Dates:** UTC in storage, shown in Asia/Kolkata.
- **Phones:** E.164.
- **Ids:** UUID v7.
- **Paging:** `page`/`limit`/`sort`.

**New:**

| Topic | Rule |
|---|---|
| **Optimistic concurrency** | Editable resources (property, customer, subcategory, settings) return `version` (Mongoose `__v` with `optimisticConcurrency`, or an explicit counter) and an `ETag`. Mutations send `If-Match: <version>`. A mismatch returns **409 `VERSION_CONFLICT`** with the current version. The admin shows “Changed by someone else — reload / overwrite your field”. Required on PATCH of properties and customers from R1 |
| **Section endpoints** | Detail tabs save **by section or by row** (e.g. `PATCH …/legal/:checkKey`) with atomic `$set` on the matching array element (`arrayFilters` by `_id`/key), never by array index |
| **Business-rule errors** | 422 `BUSINESS_RULE` with a specific `details[].code`: `STATUS_TRANSITION`, `PUBLISH_BLOCKED`, `DELETE_BLOCKED_LINKED`, `VERIFY_NEEDS_VERIFIER`, `CONSENT_REQUIRED`, `HNI_CONSENT_REQUIRED`, `ARCHIVED_READ_ONLY` |
| **Idempotency** | `POST /public/enquiries` and import commit chunks accept an `Idempotency-Key` header. Keys are stored for 24 h, and the same key returns the stored response |
| **Transactions** | `withTransaction(fn)` helper (`db/transaction.ts`) for an entity write plus its change log, delete with tombstone, the user lifecycle, and stage changes plus activity |
| **List projection** | List endpoints use `.select()` with only the columns shown, plus `.lean()` |
| **Tokens never in URLs** | Invite and reset tokens move to POST bodies; the logger logs `req.path` only (no query string) |
| **Sorting** | Every allowed sort has a matching compound index (§7.12) |

---

## 6. Authentication, roles and permissions

### 6.1 Roles (PRD §4 and §4.2, decision D4 confirmed)

**Change from v1:** roles move from code into the database, so the Admin can create custom roles. **Permissions stay in code.** They are the fixed catalogue the API enforces, and Admins can't invent them (ROLE-07).

| Piece | v1 | v2 |
|---|---|---|
| Permission catalogue | `PERMISSIONS` in `packages/shared/roles.ts` | Same, plus `label`, `group` (module), `sensitive` and `reserved` metadata for the role editor |
| Roles | `ROLES` const: `super_admin`, `admin`, `sales_agent` | `roles` collection (§7.14). **System roles:** `admin`, `sales_manager`, `sales_executive`. **Custom roles:** keys `r_<uuid7>` |
| Default permissions | `ROLE_PERMISSIONS` | `SYSTEM_ROLE_DEFAULTS` (used for seeding, migrations and “Reset to defaults”) |
| User → role | `users.role` (enum) | `users.role` = role key (string, validated against `roles`). Same field name, so the migration is a value update only |
| Resolving permissions | `ROLE_PERMISSIONS[role]` | `RoleCache.permissionsFor(key)`: in-process map loaded at boot and invalidated on every role write; 30 s TTL as a safety net if more than one API instance runs |

**Default matrix (system roles):**

| Permission | Admin | SM | SE |
|---|:-:|:-:|:-:|
| `users:manage` · `roles:manage` — **reserved** (Admin only, can't be granted) | ✅ | | |
| `settings:edit` (company, property types, legal checklists, valuation costs) | ✅ | | |
| `rules:edit` (sales rules: points, bands, weights, thresholds, executives, stuck days) | ✅ | ✅ | |
| `properties:read` | ✅ | ✅ | ✅ |
| `properties:write` (create, edit, status, location, legal, valuation, media) | ✅ | | |
| `properties:archive` · `properties:delete` | ✅ | ✅ | |
| `imports:run` | ✅ | | |
| `customers:read:all` / `customers:write:all` | ✅ | ✅ | own (`customers:*:own`, `ownerId = me`) |
| `customers:assign` | ✅ | ✅ | |
| `hni:read` / `hni:write` (sensitive) | ✅ | ✅ | |
| `appointments:read:all` / `:own`, `appointments:write` | all | all | own |
| `reports:read:all` / `:own` | ✅ | ✅ | own |

**Rules:**
- **Admin = every permission.** It is computed as the whole catalogue at runtime, never stored, so a permission added in a later release reaches Admin automatically. Admin can't be edited (403 `SYSTEM_ROLE_LOCKED`).
- **Reserved permissions** (`users:manage`, `roles:manage`) are rejected in any role payload (422 `RESERVED_PERMISSION`). This blocks privilege escalation.
- **Scoped permissions** come in `:own` / `:all` pairs. The role editor's None/Own/All control writes one of them; the API normalises (`:all` wins) and rejects both being sent (422).
- **Last Admin guard:** demoting or deactivating the last active Admin returns 409 `LAST_ADMIN`. The check and the write run in one transaction, which also fixes L4.
- **Role delete:** custom roles only. 409 `ROLE_IN_USE` with `{ userCount }` if users still have it. The UI then offers “Move users to…”, which calls `POST /roles/:key/move-users` and runs in a transaction.
- **Effect of a change:** `authenticate` already re-reads the user on every request (`middleware/auth.ts:39`). `toAuthUser` now takes permissions from `RoleCache`, so a role edit applies on the next request with no sign-out. The access token keeps only `sub`. The `role` claim is dropped from `tokens.ts`.
- `/auth/me` and sign-in return `{ role: <key>, roleName, permissions[] }`. The admin UI shows or hides menus from `permissions`, never from role names.
- `requirePermission()` on every router (existing). Own-only scope is added in the **service** as a query filter, never in the UI.
- **HNI is field-level.** HNI data lives in its own collection (§7.10). Customer responses omit classification values of `Potential/Verified HNI` for callers without `hni:read`; they get `classification: "restricted"` instead.

### 6.2 Auth hardening (H-track)

- Invite and reset tokens move to POST bodies; request logs strip query strings (H3).
- Minimum password length 10, with a common-password deny list (M4).
- **Refresh within the grace window** returns 409 `REFRESH_RACE` and does **not** clear the cookie (M3).
- **Lockout** is per account **and** per IP, with progressive delay. `forgot-password` responds in constant time by queueing the email in a `setImmediate` after the response (L5).
- **Production guard**: refuse to start if `EMAIL_PROVIDER!=resend`, if Swagger auth is not set, or if `TRUST_PROXY` is not configured (M5).

---

## 7. Data model (MongoDB)

Existing collections (`users`, `refreshTokens`, `authTokens`, `settings`, `changeLogs`, `propertyAttributes`, `propertyCategories`, `propertySubcategories`, `amenities`, `counters`, `properties`, `importBatches`) are kept, with the changes below. All documents carry `createdAt/updatedAt/createdBy/updatedBy`.

### 7.1 `propertySubcategories` (extended, R1)

```ts
{ …existing (name, categoryKey, codePrefix, purposes[], isActive, attributes[{attributeId, required, order}]),
  mainAreaMeaning: 'plot'|'built_up'|'super_built_up'|'carpet'|'land'|'usable',   // PROP-06
  legalChecklist: [{ key, label, verifies, mandatory: boolean, order }],          // PROP-28, SET-03
  version }
```

### 7.2 `propertyAttributes` (extended, R1)

```ts
{ …existing (key, label, type, unit, options[], searchFilter); type adds 'month' (stored as 'YYYY-MM'),
  review: { status: 'new'|'reviewed', createdFromPropertyId?, createdFromCode?, at, by } | null }  // PROP-20
```

### 7.3 `properties` (extended, R1)

```ts
{ …existing (code, categoryKey, subcategoryId, title, purpose, price, rental, area{value,unit,sqft},
             location{state,city,locality,pincode,address,landmark,mapPin}, attributeValues, extraAttributes,
             removedAttributeKeys, amenityIds, media[], isFeatured, publishedAt, statusChangedAt),
  status: 'draft'|'available'|'under_negotiation'|'reserved'|'booked'|'on_hold'|'sold'|'rented'|'leased'|'archived',
  listedAt: Date|null,                                  // first time Available
  pricePerSqft: number|null,                            // derived on write (sale + total basis)
  location: { …existing, roadType: string, roadWidthFt: number|null,
              highway: { name, distanceKm: number|null, routeNote } ,
              nearby: [{ _id, category, name, distanceKm, routeChecked: boolean, status: 'existing'|'under_construction'|'planned'|'proposed' }] },
  legal: [{ key, label, mandatory, status: 'not_collected'|'pending'|'verified',
            verifiedBy: string, date: 'YYYY-MM-DD'|null, mediaId: string|null, note: string, updatedAt, updatedBy }],
  legalSummary: { total, verified, pending, notCollected, openMandatory: string[] },   // derived on write
  valuation: { reviewDate, valuerReport, valuerMediaId, notes,
               comparables: [{ _id, location, type, areaSqft, pricePerSqft, kind: 'asking'|'transaction', date, source, differences }] },
  archive: { at, by, reason } | null,
  media[].caption: string, media[].visibility: 'public'|'private',   // documents private by default (M6)
  searchText: string,                                   // lowercased code+title+city+locality+pincode (M7)
  version }
```

- **Derived fields** (`pricePerSqft`, `legalSummary`, `searchText`, `listedAt`) are computed by the shared domain functions in the same write.
- **Legal checklist on create:** a new property copies its subcategory's checklist. Changing subcategory merges the checklists and keeps existing checks. Checks removed from the template stay on old properties, marked as not in the template.
- **Embedded limits:** nearby ≤ 30, comparables ≤ 20, legal ≤ 30, media ≤ 60 (enforced atomically with `'media.59': {$exists:false}`, L1).

### 7.4 `settings` (extended)

```ts
{ company{…existing},
  valuationCosts: { stampDutyPct: 7, registrationPct: 4, otherPct: 1 },                 // R1
  salesRules: { stuckDays: 14, lostReasons[], workWeek: ['mon'..'sat'],               // R3/R6
                readinessPoints{budget25,requirement20,timeline20,funding15,authority10,engagement10},
                bands{high80,qualified60,developing40}, highValueThreshold: 15000000,   // R4
                matchWeights{B.30,L.25,S.20,A.15,P.10} },                               // R5
  version }
```

Validation: points total 100; weights total 1.00 (±0.001); bands are descending.

### 7.5 `importBatches` + `importRows` (R2; rows moved out of the batch, M9)

```ts
importBatches { _id, subcategoryId, subcategoryName, fileName, filePath, fileType: 'xlsx'|'csv',
  status: 'checked'|'importing'|'imported'|'failed', options{ importAs, duplicates, updateByCode },
  totals{rows,new,update,noChange,duplicate,error,warning}, cursor: number, result{created,updated,skipped,failed,draft,photos},
  unknownColumns[], missingColumns[], createdBy, importedBy, importedAt }
importRows   { _id, batchId, row, result: 'new'|'update'|'no_change'|'duplicate'|'error',
  errors[], warnings[], changes[{field,label,from,to}], body, filled[], imageUrls[],
  duplicateOf{propertyId,code,row}, outcome: 'pending'|'created'|'updated'|'skipped'|'failed', propertyId, failure }
  index { batchId:1, row:1 } unique; { batchId:1, result:1 }
```

### 7.6 `customers` (R3)

```ts
{ _id, code: 'CUST-000001', name, mobileE164, email, contactPref, source, enquiryDate, ownerId,
  consent: { followUp: boolean, at, channel, withdrawnAt },
  purpose, purposeNote,
  budget: { min, pref, max, flexPct, basis, funding, fundingReady },
  req: { subcategoryId, cities[], localities[], sizeSqft, amenityIds[], approvalRequired, siteVisit, prefs: {…type-specific} },
  bant: { authority, need, timeline }, engagement: { responded, docsRequested, siteVisited },     // R4
  stage, stageSince, lostReason, lostNote, lostAtStage, lastContactAt, nextFollowUpAt,
  recommendations: [{ propertyId, at, by, label, score, legalCaveat }],                           // R5
  negotiation: { propertyId, offered, counter, notes } | null,
  classificationOverride: string|null,
  derived: { readiness, band, suggestedClassification, bestMatch{propertyId,score,label} },      // R4/R5, refreshed on write
  searchText, version }
indexes: { code:1 } unique · { mobileE164:1 } · { ownerId:1, stage:1, nextFollowUpAt:1 } · { stage:1, stageSince:1 }
         · { 'recommendations.propertyId':1 } · { 'negotiation.propertyId':1 } · { 'derived.readiness':-1 } · { searchText:1 }
```

### 7.7 `activities` (R3)

`{ _id, customerId, type, text, at, by, system: boolean, meta }`, with index `{ customerId:1, at:-1 }`. Stage changes, consent, assignment and property-archived notes are written in the same transaction as the change that caused them.

### 7.8 `appointments` (R3 site visits, full calendar R6)

```ts
{ _id, code, customerId, type: 'site_visit'|'office_meeting'|'phone_call', propertyId|null, executiveId,
  date: 'YYYY-MM-DD', start: 'HH:mm'|null, durationMin, status: 'scheduled'|'completed'|'cancelled'|'no_show',
  notes, outcome, interest, cancelReason, clashOverride: boolean, history[{at,by,text}], version }
indexes: { executiveId:1, date:1, start:1 } · { propertyId:1, date:1 } · { customerId:1, date:-1 } · { status:1, date:1 }
```

**Clash check** is a query on `{executiveId, date}` (and on `{propertyId, date}` for site visits) with an interval-overlap test. It runs again inside the create/update transaction.

### 7.9 Links, used by delete (PROP-49/52)

`lifecycle.service.links(propertyId)` asks each module's service for references:
- customers: `recommendations.propertyId`, `negotiation.propertyId`;
- appointments: `propertyId`;
- later modules register their own check.

Delete runs the check **inside the delete transaction**, so a link created at the same moment blocks it.

### 7.10 `customerHni` (R8, restricted)

`{ customerId (unique), status, potentialFlag, signals{…7}, consent{given,at}, verifiedBy, verifiedAt, notes, reviewedBy, reviewedAt }`. A separate collection keeps the access control and audit simple.

### 7.11 `changeLogs` (kept)

Adds `action: 'deleted'` tombstones `{entity, entityId, code, title, by, at}`, and archive/restore entries.

### 7.12 Index plan for the properties list (M7)

- `{ status:1, updatedAt:-1, _id:-1 }`, `{ status:1, createdAt:-1, _id:-1 }`, `{ status:1, 'price.amount':1 }`, `{ status:1, 'area.sqft':-1 }`
- `{ subcategoryId:1, status:1 }`, `{ 'location.cityLower':1, status:1 }`, `{ 'legalSummary.openMandatory':1 }`, `{ searchText:1 }`
- For search, `q` matches a **prefix** on `searchText` tokens (anchored regex on a lowercase field, which can use the index) and an exact code match. A MongoDB text index is optional if needed later.

### 7.13 Migrations (`apps/api/src/migrations`, in-house runner) — M11

Each migration is idempotent, has a `down`, and runs as a **deploy step** (not at boot):

1. statuses `published → available`, `unpublished → on_hold`;
2. roles (ROLE-10): create the `roles` collection with the 3 system roles; users `super_admin → admin`, `sales_agent → sales_executive` (`admin` stays `admin`); no `down` step (after it, former Super Admins and office Admins are both `admin`; a database backup is the way back);
3. catalogue v2 (PRD §6.3, [PROPERTY-CATALOGUE.md](PROPERTY-CATALOGUE.md)): seeds the types, attributes, amenities, `mainAreaMeaning` and legal checklists, **only when the catalogue is empty**. Replacing a v1 catalogue is done by the explicit command `pnpm db:reset-catalogue`, which refuses to run when `NODE_ENV=production`. It is not a migration, so a deploy can never wipe real data;
4. legal checklist templates (PRD §6.6) and backfill `legal[]` on existing properties;
5. derived fields (`pricePerSqft`, `legalSummary`, `searchText`, `listedAt`) and the new indexes;
6. move import rows to `importRows`;
7. `settings.valuationCosts` / `salesRules` defaults.

`syncIndexes()` moves from boot into a migration command.

### 7.14 `roles` (R1.0, new)

```
{ _id (uuid7), key (unique; 'admin'|'sales_manager'|'sales_executive'|'r_<uuid7>'), name (unique, collation strength 2),
  description, system: boolean, permissions: Permission[] (empty for admin = computed as all),
  version, createdBy, updatedBy, createdAt, updatedAt }
indexes: { key:1 } unique · { name:1 } unique (case-insensitive collation)
```

- `users.role` references `roles.key`. The users service validates that the key exists. `{ role:1, status:1 }` (existing index) serves the user counts and the last-Admin check.
- Role writes go to `changeLogs` (`entity: 'role'`, before/after permissions) (ROLE-09).

---

## 8. Domain logic (`packages/shared/src/domain/`)

Pure functions, unit-tested with the wireframe's numbers as fixtures. The same code runs on the API (authoritative) and in the admin (previews).

| File | Functions | Spec |
|---|---|---|
| `pricing.ts` | `pricePerSqft(price, areaSqft, basis, purpose)`, `valuationSummary(ppsf, comparables)` → avg, txnAvg, min, max, diffPct, position; `transactionCosts(price, costs)` | PROP-07, 35–41 |
| `legal.ts` | `legalSummary(checks)`, `customerWording(summary, checks)`, `nextLegalState(check, change)` (pending on upload, verified needs a verifier) | PROP-29–34 |
| `location.ts` | `advertisable(nearby)` → {verified, future, hiddenCount} | PROP-25/26 |
| `status.ts` | `STATUS_TRANSITIONS`, `canChangeStatus(from,to,purpose)`, `isMatchable(status, archived)` | PROP-43 |
| `matching.ts` | `matchScore(customer, property, weights)` → {filters[], comps{B,L,S,A,P}, M, label, legalOk, reasons[]}; `rank(matches)` (clean before conditional, then M); `infraScore`, `prefChecks` | PRD §11 |
| `readiness.ts` | `readiness(customer, hasEligibleWithinMax, hasEligibleWithFlex, points)` → rows, total, band | PRD §10.1 |
| `classification.ts` | `suggestedClassification(customer, hni, eligible, threshold)` | PRD §10.2 |
| `budget.ts` | `ceiling(budget)`, `budgetSummary` | CUS-05 |
| `appointments.ts` | `overlaps(a,b)`, `layoutDay(events)` (side-by-side columns) | APPT-02/04 |

**Golden tests** (they must pass, because they mirror the approved demo):
- Arun vs PROP-1001 = **95** (Strong, top) and vs PROP-1002 = **66** (Conditional);
- PROP-1003 = Budget mismatch;
- Arun's readiness = **79** (Qualified lead);
- classification = Qualified buyer;
- scenario 001: 9/9.

**Matching at scale (R5).** A Mongo pre-filter query uses indexes:
`{status:'available', subcategoryId, 'location.cityLower':{$in}, 'price.amount':{$lte: ceiling}}`,
with a projection of only the fields the scorer needs. Excluded properties (for the “excluded” list) come from a second, paged query. Scoring 10,000 candidates in memory takes about 10 ms. The reverse direction (property → customers) uses the `customers` indexes on `req.subcategoryId`, cities and `budget.max`.

---

## 9. API catalogue (new and changed)

All under `/api/v1/admin` unless stated. Existing endpoints (auth, users, profile, settings, property types, properties, media, imports, geo) stay as they are, except where noted.

### R1.0 — Roles (PRD §4.2)

| Method & path | Purpose | Perm |
|---|---|---|
| `GET /permissions` | Catalogue: key, label, group, sensitive, reserved, scope pair | `roles:manage` |
| `GET /roles` | Roles with `system`, `userCount`, `updatedAt`, `permissions` | `roles:manage` (a slim `{key,name}` list for pickers via `users:manage`) |
| `POST /roles` | Create a custom role `{name, description, permissions[], copyFrom?}` (ROLE-04) | `roles:manage` |
| `PATCH /roles/:key` (If-Match) | Custom role: name, description, permissions. System SM/SE: permissions only. Admin: 403 (ROLE-05) | `roles:manage` |
| `POST /roles/:key/reset` | System SM/SE back to defaults (ROLE-05) | `roles:manage` |
| `DELETE /roles/:key` | Custom only; 409 `ROLE_IN_USE` with user count (ROLE-06) | `roles:manage` |
| `POST /roles/:key/move-users` | `{ toRole }`: moves all users in one transaction, guarded by the last-Admin rule | `roles:manage` |
| `PATCH /users/:id` (changed) | `role` validated against `roles`; last-Admin guard | `users:manage` |

### R1 — Properties v2

| Method & path | Purpose | Perm |
|---|---|---|
| `GET /properties` | + filters `legal=open|clean`, `archived=only|include`, status list; projection; sorts with indexes | read |
| `GET /properties/stats` | Counts for the nav and tabs (available, by status) | read |
| `GET /properties/:id` | + `version`, `location.nearby`, `legal`, `legalSummary`, `valuation`, `pricePerSqft`, `archive` | read |
| `PATCH /properties/:id` (If-Match) | Main info, specs, amenities. 409 on version conflict | write |
| `PATCH /properties/:id/location` (If-Match) | Road, highway, `nearby[]` (whole list, validated) | write |
| `PATCH /properties/:id/legal/:key` | One check: status, verifiedBy, date, mediaId, note (atomic, element-level) | write |
| `PATCH /properties/:id/valuation` (If-Match) | reviewDate, valuerReport, notes, `comparables[]` | write |
| `POST /properties/:id/status` | Body `{status}`; transition and publish checks | write |
| `POST /properties/bulk-status` | Existing | write |
| `GET /properties/:id/links` | Linked records for the archive/delete dialogs | archive |
| `POST /properties/:id/archive` | `{reason?}` → archived; timeline notes to linked customers (transaction) | archive |
| `POST /properties/:id/restore` | → draft | archive |
| `DELETE /properties/:id` | Header `X-Confirm-Delete: <code>`. 422 `DELETE_BLOCKED_LINKED` with the link list. Removes media files after commit; writes a tombstone | delete |
| `POST /properties/:id/media` | + `caption`, `visibility`; documents private (served via `GET /media/:mediaId/download` with auth) | write |
| `POST /property-types/subcategories/:id/attributes/preview` | Returns `{ existingMatches[], affectedProperties }` for the confirmation step (PROP-17/18) | settings:edit |
| `POST /property-types/subcategories/:id/attributes` | + `confirmed: true` required when called from the property form (`origin: 'property', propertyId`); sets `review.status='new'` | settings:edit |
| `PATCH /property-types/attributes/:id/review` | Mark reviewed | settings:edit |
| `PUT /property-types/subcategories/:id/legal-checklist` | Template CRUD (ordered list) | settings:edit |
| `PATCH /property-types/subcategories/:id` | + `mainAreaMeaning` | settings:edit |
| `GET/PUT /settings/valuation-costs` | Cost assumptions | settings:edit |

### R2 — Bulk import v2

| Method & path | Purpose |
|---|---|
| `GET /imports/template?subcategoryId=&format=xlsx|csv` | Template, now with a **Property code** column; sample file option |
| `GET /imports/columns?subcategoryId=` | Column guide (key, label, required for new rows, allowed values, format) for the page |
| `POST /imports` (multipart) | Upload → validate → batch + rows (`result`, `errors`, `warnings`, `changes`) |
| `GET /imports/:id` · `GET /imports/:id/rows?result=&page=` | Summary, then paged rows (no 500-row cap) |
| `POST /imports/:id/commit` `{options, cursor, limit≤50}` + Idempotency-Key | Processes the next chunk; returns `{cursor, done, progress, result}`. The client loops until done (§10) |
| `GET /imports/:id/error-report?format=` | Original columns + error column |
| `GET /imports` | History (paged) |

### R3 — Customers & pipeline

- **Customers:** `GET/POST /customers`, `GET/PATCH /customers/:id` (If-Match), `POST /customers/:id/stage` `{stage, lostReason?, note?}`, `POST /customers/:id/consent` `{given, channel}`, `POST /customers/:id/assign` `{ownerId}`.
- **Activities:** `GET/POST /customers/:id/activities`.
- **Board and follow-ups:** `GET /pipeline?ownerId=` (board, grouped, with counts and stuck flags), `GET /follow-ups/due`.
- **Appointments (site visits):** `GET/POST/PATCH /appointments` (site visits in R3).
- `GET /customers/check-mobile?mobile=` (duplicate warning).

### R4–R9

| Release | Endpoints |
|---|---|
| R4 | `PATCH /customers/:id/qualification` (BANT, engagement) → returns readiness and classification · `GET/PUT /settings/sales-rules` · **public** `POST /api/v1/public/enquiries` (rate limit, honeypot, Idempotency-Key) |
| R5 | `GET /customers/:id/matches` · `GET /properties/:id/matching-customers` · `POST/DELETE /customers/:id/recommendations/:propertyId` · `GET /matching/explain?customerId=` (step-1 table) |
| R6 | `GET /appointments?from=&to=&executiveId=&type=&status=&propertyId=` · `POST /appointments/check-clashes` · `POST /appointments/:id/reschedule|cancel|complete|no-show` |
| R7 | `GET /dashboard` · `GET /reports/funnel|stuck|sources|purposes|lost|unmet-demand|executives` (role-scoped, aggregation pipelines with `$facet`) |
| R8 | `GET/PATCH /customers/:id/hni` · `GET /hni` (register) |
| R9 | AI integration (MCP tools or REST for the chosen provider), to be designed in its own TRD addendum |

---

## 10. Bulk import design (R2; fixes H2, M8, M9)

1. **Upload** (≤10 MB):
   - **Guards:** zip-bomb guard (check the uncompressed size and sheet dimensions before loading); ExcelJS streaming `WorkbookReader` for xlsx; `csv-parse` with BOM/encoding detection for CSV.
   - **Row limit:** at most 2,000 data rows.
   - **Storage:** the file is saved under private `uploads/imports/<batchId>/` **after** the batch document exists. On failure both are cleaned up.
2. **Validate:**
   - **Definitions loaded once:** the subcategory `FormDefinition` (cached for the request) and all codes and duplicate keys of that subcategory, **in one query** (projection).
   - **Per row, in memory:** check each row with the shared schemas and compute `result`, `errors`, `warnings`, and `changes` (old → new, only the filled cells).
   - **Write rows** with `insertMany` in chunks of 500.
3. **Commit (chunked, resumable, idempotent):**
   - **Claim:** the client calls `POST /commit` with `{cursor, limit:50}`. The first call claims the batch atomically (`checked → importing`).
   - **Process each row:**
     - create or update the property through an **internal** service method (ids only, no DTO building), using a transaction per row (property + change log);
     - download images with the hardened `remoteFile` (concurrency 4, 10 s timeout, 10 MB cap, IP pinned);
     - write the row `outcome` and `propertyId` immediately.
   - **Retries are safe:** re-sending a chunk skips rows whose outcome is not `pending`. The same Idempotency-Key returns the stored response.
   - **Finish:** when the cursor reaches the end, the batch is set to `imported` with totals.
   - **Resume after a crash:** a batch in `importing` can be resumed from the History screen (“Resume import”).
4. **Rules:**
   - **Legal checks:** new properties get the template with every check `not_collected` (IMP-10).
   - **Statuses:** “Import as Available” only for rows that pass the publish checklist; the others stay Draft.
   - **Updates** never change status, legal, location data from the tabs, or valuation.
5. **Clean-up without cron:** each new upload deletes import files older than 30 days (lazy clean-up, L8).

---

## 11. File storage

- `StorageProvider` and local disk are kept.
- **Public:** `properties/<code>/images/*` (WebP thumb/medium/large, re-encoded, metadata stripped) and the company logo, **now re-encoded too** (L9).
- **Private (new):**
  - **Documents:** `properties/<code>/documents/*` (legal papers, floor plans and brochures with `visibility='private'`) are served only through `GET /admin/media/:id/download` (auth + permission, `Cache-Control: private`).
  - **Import files:** `imports/*` are never served.
- **Upload checks:** the video sniffer is tightened to MP4/WebM brands only (L9). The 60-file limit is checked atomically (L1).
- **Delete:** files are removed **after** the DB transaction commits. Failures are logged and retried on the next start (an orphan sweep compares folders with the DB).

---

## 12. Front-end architecture and design system

### 12.1 Design tokens (from `spec-system-wireframe/styles.css`)

Edit `apps/admin/src/index.css` (CSS variables + `@theme inline`):

| Wireframe | Token | Light | Dark (new pair) |
|---|---|---|---|
| `--bg` | `--background` | `#f3f4f7` | current dark surface |
| `--panel` | `--card`, `--popover`, `--sidebar` | `#ffffff` | current dark card |
| `--ink` / `--ink2` | `--foreground` / `--foreground-2` | `#1b2130` / `#3a4254` | light greys |
| `--muted` | `--muted-foreground` | `#6b7385` | |
| `--line` / `--line2` / input | `--border` / `--border-subtle` / `--input` | `#e1e4ea` / `#eef0f4` / `#d5d9e1` | |
| `--brand` / `--brand-soft` | `--primary`, `--ring`, `--sidebar-primary` / `--accent`, `--sidebar-accent` | `#2f5bea` / `#e9efff` | lighter blue (≈ `#6f8ff5`), soft at about 15% alpha |
| tones | `--tone-{green,amber,red,blue,purple,grey}` + `-soft` | wireframe values | tone at full / soft at about 15% alpha |
| radius | `--radius` | `0.625rem` (already) | |
| font | Inter (replaces Geist) | | |

Every hard-coded Tailwind colour (`StatusBadge`, `BatchReview`, form issue icons…) is replaced by tone tokens. A lint rule forbids raw palette classes (`bg-emerald-*`, etc.) outside `components/ui`.

### 12.2 Shared pattern components (`components/patterns/`)

| Component | Use |
|---|---|
| `PageHeader` | title, description, actions |
| `KpiTile` | label, value, sub |
| `Chip` | tone, outline, mono |
| `Note` | info, amber, red, green callout |
| `NumberedSection` | form sections with a numbered circle |
| `DescriptionGrid` | 3-column definition list |
| `Meter` | toned bar |
| `Timeline` | activity and history |
| `ConfirmDialog` | title, body, impact list, checkbox-to-confirm option, danger variant |
| `InlineField` / `EditableTable` | tab edits that save per field or row, with pending, error and conflict states |
| `StatusSelect` | allowed transitions only |
| `RadioCards` | radio cards |
| `StepBar` | import wizard steps |
| `EmptyState` | empty lists |
| `CountBadge` | nav counts |

**shadcn additions:** dialog, radio-group, progress, popover, command (city/locality combobox replaces `<datalist>`), toggle-group, accordion.

### 12.3 App shell

- **Sidebar:** grouped as in the wireframe, 236 px, still collapsible. Soft active state, count slots fed by `/properties/stats` and later endpoints, and a lock icon for restricted items.
- **Top bar:**
  - breadcrumbs with a section prefix and the entity code (from the route loader);
  - quick actions (＋ Customer from R3, ＋ Property);
  - the user menu.
- **Content:** up to 1380 px, left aligned.
- **Mobile:** the drawer moves to `Sheet` (focus trap, Escape).
- **Route-level code splitting:** `React.lazy` per page plus `manualChunks` for Leaflet and the libphonenumber metadata. Target: initial JS under 350 KB gzip.

### 12.4 Screens

| Screen | Approach |
|---|---|
| Properties list | Restyle: `PageHeader`; code column; ₹/sq.ft. under the price; Legal chip; archive filter; keep the existing checkbox, thumbnail, row menu and pagination |
| Property form | Split `PropertyFormPage` (1,010 lines) into section components; single card with `NumberedSection`; sticky action footer; live ₹/sq.ft.; attribute dialog with the **confirmation step** (two-step dialog state machine) |
| Property detail | New `ent-head` header; routes `/properties/:id/{specs,location,legal,pricing,matches,media,history}` (nested routes, each tab lazy) |
| Bulk import | Radio-card type picker, `StepBar`, column guide, KPI tiles, result chips, old → new change list, chunked-commit progress bar, resume |
| Settings → Property types | Restyle (underline tabs, radio cards); new panels: legal checklist editor, main-area meaning, “New” attribute review list; Valuation costs tab |
| Customers / Pipeline (R3) | Wireframe layouts; Kanban with dnd-kit (keyboard sensors for accessibility) |
| Appointments (R6) | Custom Teams-style calendar (CSS grid + `layoutDay` from shared) |

### 12.5 Data and forms

- **Query keys per feature** (existing pattern). Mutations invalidate by key and use optimistic updates only for inline tab edits. 409 conflicts open a “Reload / keep my value” dialog.
- **Forms use the shared zod schemas directly.** The property form's local string schema is replaced by a schema derived from `createPropertyBodySchema`, with number coercion.
- **Permissions** come from `/auth/me` (existing). Hidden actions are also blocked server-side.

---

## 13. Security (H-track and baseline)

| Task | Fixes |
|---|---|
| H-1 Remote file fetch: classify addresses with `ipaddr.js` (allow only `unicast`), resolve once and **pin the IP** with an undici `Agent` `connect.lookup`, https only, no redirects to private addresses, 10 MB / 10 s caps | H1 |
| H-2 Tokens in POST bodies; logger logs `req.path` and redacts `authorization`, `cookie`, `token`, `password` | H3 |
| H-3 Optimistic concurrency (ETag / If-Match) on properties and settings; atomic element updates for media, legal and nearby | H4, M1 |
| H-4 Single-node replica set (docker-compose `--replSet rs0` + init) and `withTransaction` for multi-document writes; tests on a `MongoMemoryReplSet` | M2 |
| H-5 Refresh-race response that keeps the cookie; password min 10 plus a deny list; per-IP lockout | M3, M4, L5 |
| H-6 Production config guards (email provider, Swagger auth, trust proxy, CORS origins explicit) | M5 |
| H-7 Private documents with an authenticated download route | M6 |
| H-8 Error handler: honour `res.headersSent`; keep 4xx status for known errors | L7 |
| Baseline (kept) | helmet CSP, CORS allow-list, rate limits (login, public), argon2id, upload content sniffing, path-traversal guard, zod at every boundary, `requirePermission` on every router, mongo-sanitize |
| New | Public enquiry endpoint: rate limit (5/min/IP), honeypot field, payload ≤ 20 KB, Idempotency-Key. HNI data only from `customerHni` with `hni:*` permissions; HNI access is logged |
| Supply chain | `pnpm audit --prod` in CI (fail on high), Renovate / Dependabot weekly |

---

## 14. Performance and scalability

| Area | Design | Target |
|---|---|---|
| Property list | Projection + compound indexes per sort (§7.12), `searchText` prefix search, offset paging (≤ 100 per page) | p95 < 500 ms at 10k properties |
| Detail | Single document read + subcategory definition (cached in memory per process, invalidated on settings change) | p95 < 300 ms |
| Matching | Indexed pre-filter + in-memory scoring with shared functions | < 300 ms at 10k properties |
| Import | One-query preload, in-memory validation, `insertMany`, chunked commit (50 rows, about 2–5 s per chunk without images) | 2,000 rows validated < 20 s |
| Images | sharp with limited concurrency (2), sizes 400/1200/2000 WebP | |
| Dashboard / reports | `$facet` aggregations on indexed fields | < 1 s at 20k customers |
| Front end | Route splitting, `keepPreviousData`, virtualised import review table above 500 rows | first load < 2.5 s on 4G |

**Single-instance assumptions** (no Redis):
- the rate limiter and geocoder cache are in memory;
- the geocoder queue gets a cap (L6).

If a second instance is ever added, move the rate limiter to Mongo or Redis (documented risk).

---

## 15. Reliability and operations

- **Graceful shutdown:** stop accepting requests, wait up to 25 s, then force exit. Handle `unhandledRejection` and `uncaughtException` with a log and controlled exit (M10). Chunked import commits make shutdown safe.
- **Health:** `/live` (process up) and `/ready` (DB reachable, migrations at the expected version).
- **Logging:** pino JSON with `requestId`, user id, route and duration. No query strings or bodies, and secrets redacted. Audit actions go to `changeLogs`.
- **Backups:**
  - daily `mongodump --oplog` and an `uploads/` rsync to off-server storage;
  - 30-day retention;
  - a restore drill before each release sign-off.
- **Deployment:** one Linux VM (or container host):
  - Nginx (TLS, gzip, static admin build, `/uploads` public folders only, `client_max_body_size 60m`, `proxy_read_timeout 60s`);
  - Node under systemd or PM2;
  - MongoDB as a single-node replica set.
- **Release steps:** `pnpm build` → `pnpm migrate` → restart → smoke test.

---

## 16. Environments and configuration

- **Environments:** `development` (docker-compose Mongo replica set, console email allowed), `test` (in-memory replica set), `staging` and `production` (guards on).
- **New environment variables:**
  - `MONGO_URI` must include `replicaSet`;
  - `TRUST_PROXY` (hop count);
  - `PUBLIC_ENQUIRY_ENABLED`;
  - `IMPORT_MAX_ROWS` (default 2000);
  - `UPLOAD_PRIVATE_DIR`;
  - `SWAGGER_USER`/`SWAGGER_PASS` (required outside development);
  - `CORS_ORIGINS`.
- All environment variables are validated with zod at start-up (existing). Production refuses to start with unsafe values.

---

## 17. Testing strategy

| Layer | Tooling | Must cover |
|---|---|---|
| Domain unit | Vitest (`packages/shared`) | Every function in §8, plus the **golden tests** (95 / 66 / budget mismatch / readiness 79 / scenario 001), status transitions, legal wording, location preview |
| API integration | Vitest + Supertest + `MongoMemoryReplSet` | Every endpoint: validation, permissions (three system roles plus a custom role per test suite, own scope, reserved-permission rejection, last-Admin guard, role edit taking effect on the next request), 409 version conflicts, 422 business rules, transactions (rollback on failure), delete with links, import chunk retry and resume, SSRF cases (IPv6-mapped, rebinding) |
| Concurrency | Vitest | Parallel PATCH (one 409), parallel media upload at 59 files, parallel delete vs link creation |
| Admin component | Testing Library | Each screen's behaviour by role or label; confirmation flows (attribute global add, archive, delete) |
| End-to-end | **Playwright** (new, in CI on staging build) | Per release: the PRD §16 workflows, light and dark themes, 390 px width |
| Visual | Playwright screenshots compared against the wireframe for each release's screens (manual review gate) | |
| Load | k6 or autocannon script | List at 10k properties; import of 2,000 rows (time and memory) |
| Coverage | `vitest --coverage` | Domain ≥ 95%, services ≥ 80% |

---

## 18. Risks and open technical decisions

| Risk / decision | Mitigation / proposal |
|---|---|
| Status rename (published → available) breaks old links and filters | Migration + aliases in `listPropertiesQuerySchema` for one release |
| Replica set adds local setup work | docker-compose with an init script; documented in README; tests use `MongoMemoryReplSet` |
| Dark mode for wireframe colours (the wireframe is light only) | Define dark token pairs in R1; designer or team review of both themes |
| Inline tab editing and conflicts | Section-level `If-Match`, element-level atomic updates, clear conflict UI |
| Lead source (PRD D5) reverses the v1 “Perfox only” rule | Team decision before R3; the data model supports an external `sourceRef` later |
| Single instance (in-memory rate limit and caches) | Accepted for now; documented upgrade path |
| Legal checklist defaults are legal content | Client's legal advisor confirms before R1 sign-off (PRD D11) |
