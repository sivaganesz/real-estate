# Technical Requirements Document (TRD)
## AI-Powered Real Estate Management Platform

| Field | Value |
|---|---|
| Document | Technical Requirements Document |
| Version | 2.0 (Draft): simplified architecture |
| Related documents | [PRD.md](./PRD.md) · [DEVELOPMENT-CHECKLIST.md](./DEVELOPMENT-CHECKLIST.md) |
| External reference | Perfox documentation: https://perfox.ai/docs |

**What changed in 2.0:**
- No background jobs, queues or sync.
- Leads, conversations and call logs are read live from the Perfox REST API.
- Files are stored on the local server.
- Email goes through a swappable module (Resend).
- Plivo and WhatsApp are deferred.
- There is no locations master and no radius search.
- Property types are category → subcategory → attributes (Residential and Commercial set up; Other later).

---

## 1. Purpose and guiding principles

This document describes **how** the platform is built: architecture, stack, repository layout, data model, APIs, the MCP server for the AI agent, the Perfox integration, file storage, email and testing.

**Guiding principles:**
1. **Keep it simple.** No background workers, queues, cron jobs or data-sync systems.
2. **One source of truth per type of data.**
   - Properties, appointments, users and settings live in **our MongoDB**.
   - Leads (customers), conversations and call logs live in **Perfox**, and we read them through its REST API when a screen needs them.
3. **No third-party service unless needed now.** Plivo and WhatsApp are added when we reach that stage.
4. **Swappable modules.** Email and file storage sit behind small interfaces, so a provider can change without touching business code.
5. **Build phase by phase:**
   - Phase 1: Settings & Users
   - Phase 2: Inventory
   - Phase 3: Leads, Appointments & AI
   - Phase 4: Public Website (placement to be confirmed)

**AI agent scope (three jobs only):** answer property-detail questions, search properties (location, type, budget), and schedule / reschedule / cancel visits.

---

## 2. Architecture overview

```
   Admins / Agents                                   Visitors (Phase 4)
         │                                                  │
 ┌───────▼──────────────┐                     ┌─────────────▼─────────┐
 │ Admin Portal         │                     │ Public Website        │
 │ React + Vite (SPA)   │                     │ React + Vite (SPA)    │
 └───────┬──────────────┘                     └─────────────┬─────────┘
         │ HTTPS · REST /api/v1                             │
 ┌───────▼──────────────────────────────────────────────────▼──────────┐
 │                  Express API  (Node.js + TypeScript)                │
 │                                                                     │
 │  /api/v1/auth/*   /api/v1/admin/*   /api/v1/public/*   /api/docs    │
 │  /mcp  (MCP server for the AI agent, JSON-RPC)                      │
 │  /uploads/*  (static files from local storage)                      │
 │                                                                     │
 │  modules: auth · users · settings · propertyTypes · amenities ·    │
 │           properties · imports · appointments · mcp · perfox        │
 │  lib:     storage (local disk) · email (Resend) · logger            │
 └──────┬───────────────────────┬──────────────────────┬───────────────┘
        │                       │                      │ on demand, HTTPS
 ┌──────▼──────┐        ┌───────▼────────┐    ┌────────▼─────────────────┐
 │  MongoDB    │        │ Local disk     │    │ PERFOX                   │
 │             │        │ uploads/       │    │ REST API: customers      │
 │ users,      │        │ (logo, images, │    │ (leads), conversations,  │
 │ settings,   │        │  documents,    │    │ call logs                │
 │ properties, │        │  Excel files)  │    │                          │
 │ appointments│        └────────────────┘    │ AI agent ──► calls /mcp  │
 └─────────────┘                              └──────────────────────────┘
                         Email: Resend API (via the email module)
```

### 2.1 Communication paths

| From → To | How | Purpose |
|---|---|---|
| Admin / Website → API | REST over HTTPS, JSON | All application features |
| API → Perfox REST | HTTPS with `Authorization: Bearer <key>`, **only when a screen requests the data** | Leads list and detail, conversations and transcripts, call logs and recordings |
| Perfox AI agent → API `/mcp` | MCP (JSON-RPC 2.0 over HTTP), bearer token | AI searches properties, reads details, books / reschedules / cancels visits |
| API → Resend | HTTPS (through the email module) | Invites, password resets, visit confirmation emails |
| API → local disk | File system (through the storage module) | Logo, property images and documents, import files |

**Not used:** BullMQ, Redis, cron jobs, worker processes, Perfox sync pollers, Perfox webhooks, S3/Cloudinary, Plivo (deferred), WhatsApp (deferred), geocoding/maps APIs.

---

## 3. Technology stack

| Layer | Technology | Notes |
|---|---|---|
| Language | **TypeScript** (strict) everywhere | Types shared between frontend and backend |
| Admin portal | **React 18 + Vite**, React Router, TanStack Query, TanStack Table, shadcn/ui (Radix + Tailwind), React Hook Form | |
| Public website (Phase 4) | **React 18 + Vite**, React Router, TanStack Query, Tailwind, react-helmet-async | SEO via server-side meta injection |
| Backend | **Node.js 22 LTS + Express 5** | One process (modular monolith) |
| Validation | **Zod** | Same schemas for API requests, admin forms and MCP tool inputs |
| API docs | **OpenAPI 3.1** via `@asteasolutions/zod-to-openapi` + **swagger-ui-express** at `/api/docs` | `openapi.json` importable into Postman |
| Database | **MongoDB 7** with **Mongoose** | Standalone instance is enough (no transactions required, see §7.11) |
| File storage | **Local disk** (`uploads/` folder) via a storage module; **sharp** for image resizing | §11 |
| Email | **Resend** via an email module (provider can be swapped) | §12 |
| Excel | **ExcelJS** | Template generation and parsing |
| Auth | JWT access token + rotating refresh token (httpOnly cookie); **argon2id** password hashing | |
| Rate limiting | `express-rate-limit` (in-memory store) | Fine for a single server process |
| Logging | **pino** with request IDs | |
| Testing | Vitest, Supertest, mongodb-memory-server, Playwright, Postman CLI | |
| Tooling | pnpm workspaces, ESLint, Prettier, GitHub Actions | |

---

## 4. Repository structure (monorepo)

```
real-estate/
├── apps/
│   ├── api/                          # Express API + MCP server
│   │   ├── src/
│   │   │   ├── app.ts                # express app factory
│   │   │   ├── server.ts             # HTTP entry
│   │   │   ├── config/               # env loading (zod-validated)
│   │   │   ├── db/                   # mongoose connection, seed scripts
│   │   │   ├── middleware/           # auth, permissions, validate, errorHandler, rateLimit, requestId
│   │   │   ├── docs/                 # OpenAPI registry → /api/docs, /api/openapi.json
│   │   │   ├── lib/
│   │   │   │   ├── storage/          # StorageProvider interface + LocalStorageProvider
│   │   │   │   ├── email/            # EmailProvider interface + ResendProvider + ConsoleProvider + templates
│   │   │   │   ├── logger.ts
│   │   │   │   └── units.ts          # area/price helpers (re-exported from shared)
│   │   │   └── modules/
│   │   │       ├── auth/             # Phase 1
│   │   │       ├── users/            # Phase 1
│   │   │       ├── settings/         # Phase 1 (company), Phase 3 (visit slots)
│   │   │       ├── propertyTypes/    # Phase 2 (categories, subcategories, attributes)
│   │   │       ├── amenities/        # Phase 2
│   │   │       ├── properties/       # Phase 2 (incl. media)
│   │   │       ├── imports/          # Phase 2
│   │   │       ├── appointments/     # Phase 3 (incl. availability)
│   │   │       ├── perfox/           # Phase 3 (REST client + leads/conversations/calls endpoints)
│   │   │       ├── mcp/              # Phase 3 (MCP router, context, idempotency, tools/)
│   │   │       └── public/           # Phase 4 (website read endpoints, SEO)
│   │   ├── uploads/                  # local file storage (git-ignored), see §11
│   │   └── test/
│   ├── admin/                        # Admin portal (React + Vite)
│   │   └── src/{pages,components,features,hooks,lib,routes}
│   └── web/                          # Public website (Phase 4)
├── packages/
│   └── shared/                       # Zod schemas, enums, types, INR/area formatters
├── docs/                             # PRD, TRD, checklist, wireframes
├── docker-compose.yml                # local MongoDB
├── package.json
└── pnpm-workspace.yaml
```

**Module layout** (each folder in `modules/`):
```
properties/
  property.model.ts        # Mongoose schema + indexes
  property.schemas.ts      # Zod request/response schemas
  property.service.ts      # business logic (no req/res), reused by REST routes and MCP tools
  property.controller.ts   # HTTP handlers (thin)
  property.routes.ts       # router + OpenAPI registration
  property.test.ts
```
A module never reads another module's Mongoose model directly; it calls that module's service.

---

## 5. Backend conventions

### 5.1 URL structure
| Prefix | Audience | Auth |
|---|---|---|
| `/api/v1/auth/*` | Admin login and password flows | Public (rate-limited) |
| `/api/v1/admin/*` | Admin portal | JWT + permission check |
| `/api/v1/public/*` | Public website (Phase 4) | None (rate-limited) |
| `/mcp` | Perfox AI agent | Bearer token |
| `/uploads/*` | Images and documents | Public for property media and logo; import files are **not** served statically |
| `/api/docs`, `/api/openapi.json` | Developers | Basic auth outside local development |

### 5.2 Response format
```json
// single
{ "data": { ... } }
// list
{ "data": [ ... ], "meta": { "page": 1, "limit": 20, "total": 347, "totalPages": 18 } }
// error
{ "error": { "code": "VALIDATION_ERROR", "message": "Price must be positive",
             "details": [ { "path": "price.amount", "message": "..." } ], "requestId": "req_01H..." } }
```

| HTTP | `code` |
|---|---|
| 400 | `VALIDATION_ERROR`, `BAD_REQUEST` |
| 401 | `UNAUTHENTICATED`, `TOKEN_EXPIRED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT`, `DUPLICATE`, `SLOT_UNAVAILABLE` |
| 422 | `BUSINESS_RULE` |
| 429 | `RATE_LIMITED` |
| 502 | `UPSTREAM_ERROR` (Perfox unavailable or returned an error) |
| 500 | `INTERNAL_ERROR` |

### 5.3 Pagination, sorting, filtering
- `page` (default 1), `limit` (default 20, max 100), `sort` (e.g. `price`, `-price`, `-createdAt`).
- Filters as flat query params, validated with Zod.
- For Perfox-backed lists, our API passes paging and filters through to Perfox and converts the response to our format.

### 5.4 Validation and OpenAPI
- Each route declares `{ params, query, body, response }` Zod schemas.
- A `validate()` middleware replaces `req.body/query/params` with the parsed, typed values.
- The same schemas build `/api/openapi.json` at startup. CI checks the spec builds and runs the Postman collection generated from it.

### 5.5 Other rules
- Dates stored in UTC and shown in `Asia/Kolkata`.
- Phone numbers stored in E.164 (`+91XXXXXXXXXX`) using `libphonenumber-js`.
- Money stored as integer rupees.
- Every document has `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.
- Archive instead of hard-delete for business records.
- **Record ids are UUID v7 strings** (`_id`, generated by `db/ids.ts`), not MongoDB ObjectIds. References between records are UUID strings too. v7 ids are time-ordered, so they sort by creation time and index efficiently.

---

## 6. Authentication and permissions (Phase 1)

### 6.1 Login and sessions
- `POST /auth/login` returns an access token (JWT, 15 min) and sets a refresh token cookie:
  - Random value, stored hashed, valid 7 days, rotated on every use.
  - Cookie flags: `Secure; HttpOnly; SameSite=Strict`.
- `POST /auth/refresh` rotates the refresh token (an opaque random value stored as a SHA-256 hash, not a JWT, so no refresh secret is needed). Reusing an already-replaced token revokes that whole session; a reuse within 10 seconds is treated as a harmless race between two tabs.
- Sessions end after **30 minutes without a refresh** (enforced by the server) and at most **7 days** after sign-in.
- Cookie-based endpoints (`/auth/refresh`, `/auth/logout`) require an `X-Requested-With` header as a CSRF guard.
- `POST /auth/logout` revokes the current refresh token.
- `GET /auth/me` returns the user and their permission list.
- Passwords are hashed with argon2id. Minimum length is 6 characters, with at least one letter and one number (lockout and rate limits protect against guessing).
- After 5 failed logins the account locks for 15 minutes; a Super Admin can unlock it earlier.
- The admin UI signs the user out after 30 minutes of inactivity (the server enforces the same limit on refresh).
- Every authenticated request re-reads the user, so deactivation or a role change takes effect immediately.

### 6.2 Invite and password reset
- Invite and reset links carry a random token, stored hashed in `authTokens`, single-use, with an expiry (invite 72 h, reset 1 h).
- `POST /auth/forgot-password` always returns 200, so it doesn't reveal which emails exist. It emails a reset link through the email module.
- `POST /auth/reset-password` sets the new password and revokes all sessions.
- `POST /auth/accept-invite` sets the password and activates the user.

### 6.3 Roles and permissions
Three fixed roles, defined in code (`packages/shared/permissions.ts`), so there is no roles collection:

| Permission | Super Admin | Admin | Sales Agent |
|---|---|---|---|
| `users:manage` | ✅ | ❌ | ❌ |
| `settings:edit` | ✅ | ✅ | ❌ |
| `properties:read` | ✅ | ✅ | ✅ |
| `properties:write` (create, edit, publish, archive) | ✅ | ✅ | ❌ |
| `imports:run` | ✅ | ✅ | ❌ |
| `appointments:read:all` / `appointments:write` | ✅ | ✅ | own only |
| `leads:read`, `conversations:read`, `calls:read` | ✅ | ✅ | ✅ (scope depends on Perfox data, decided in Phase 3) |

- Middleware: `requirePermission('properties:write')`.
- "Own only" adds `{ agentId: req.user.id }` in the service layer.

---

## 7. Data model (MongoDB)

Only data **we own** is stored. Leads, conversations and call logs are **not** stored; they come from Perfox (§10).

Every document has `_id` as a **UUID v7 string**; fields shown as `…Id` / `…Ids` hold UUID strings.

### 7.1 `users` (Phase 1)
```ts
{ name, email (unique, lowercase), phone, role: 'super_admin'|'admin'|'sales_agent',
  status: 'invited'|'active'|'inactive', passwordHash?,
  lastLoginAt?, failedLoginCount, lockedUntil?, createdBy, updatedBy }
```
Indexes: `{ email: 1 } unique`, `{ role: 1, status: 1 }`.

### 7.2 `refreshTokens` (Phase 1)
```ts
{ userId, tokenHash, familyId, expiresAt, revokedAt?, replacedBy?, userAgent, ip }
```
Indexes: `{ tokenHash: 1 } unique`, `{ expiresAt: 1 }` TTL.

### 7.3 `authTokens` (Phase 1)
```ts
{ userId, type: 'invite'|'password_reset', tokenHash, expiresAt, usedAt? }
```
Indexes: `{ tokenHash: 1 } unique`, `{ expiresAt: 1 }` TTL.

### 7.4 `settings` (Phase 1, extended in Phase 3)
One document per key.
```ts
{ key: 'company', value: {
    logoPath?, name, shortDescription?, address, officeLocation?: { lat, lng },
    phone, email },
  updatedBy, updatedAt }

{ key: 'visitSlots', value: {                      // Phase 3
    workingDays: number[], dayStart: 'HH:mm', dayEnd: 'HH:mm', slotMinutes: 60,
    maxVisitsPerSlot: 3, minNoticeMinutes: 120, bookingWindowDays: 30,
    blockedDates: [{ date: 'YYYY-MM-DD', from?: 'HH:mm', to?: 'HH:mm', reason, propertyId? }] } }
```

### 7.5 `changeLogs` (Phase 1)
Simple record of important changes. There is no screen for it in Phase 1; property history is shown on the property page.
```ts
{ actorId, entity: 'user'|'settings'|'property'|'propertyType'|'appointment', entityId,
  action: 'created'|'updated'|'status_changed'|'archived'|'role_changed'|..., changes?: { field: [before, after] }, at }
```
Indexes: `{ entity: 1, entityId: 1, at: -1 }`.

### 7.6 `propertyAttributes` (Phase 2): an attribute library shared by categories and subcategories
```ts
{ key: 'road_width' (unique; made from the first name, never changes), label: 'Road width',
  labelKey: 'road width' (unique, lower-cased: no two attributes with the same name),
  type: 'text'|'long_text'|'number'|'yes_no'|'dropdown'|'multi_select'|'date',
  unit: 'ft'|'sq.ft'|'slots'|… | null (numbers only), options: string[] (dropdown / multi-select only),
  searchFilter: boolean,                        // buyers and the AI agent can search by it
  createdBy, updatedBy }
```
Name, type, unit, options and search filter are the same everywhere the attribute is used (so "BHK" filters villas and apartments alike). The type is locked once properties have values for it.

### 7.7 `propertyCategories` and `propertySubcategories` (Phase 2)
```ts
// propertyCategories: one per category; the common attributes appear for every subcategory
{ key: 'residential'|'commercial'|'other', name, isActive, order,
  attributes: [{ attributeId, required }],         // array order = form order
  setupSeededAt, amenitiesSeededAt }               // starting setup / amenities applied (once)

// propertySubcategories
{ categoryKey, name: 'Villa / House', nameKey (unique per category),
  codePrefix: 'VIL' (unique, 3 letters, locked once it has properties),
  purposes: ('sale'|'rent'|'lease')[], isActive, order,
  attributes: [{ attributeId, required }], createdBy, updatedBy }
```
- **Core attributes** are columns of every property (title, purpose, price, area, location), always required, shown as locked rows; they are not in these collections.
- An attribute is either common or in a subcategory of the same category, never both.
- Removing an attribute from a place keeps the values properties already have; the library entry is deleted once nothing uses it.
- Starting setup (applied at start and by the seed script, once per category, marked by `setupSeededAt`; databases created earlier get a newly added category the same way, and nothing an admin deleted comes back):
  - **Residential:** Residential Plot (PLT), Villa / House (VIL), Apartment / Flat (APT); common: facing, ownership type, description.
  - **Commercial:** Office space (OFC), Shop / Showroom (SHP), Commercial land (CLD, plot dimensions required), Warehouse / Godown (WHS); same common attributes. Shared attributes (e.g. carpet area, lift, approval type) are the same library entries as in Residential.
  - **Other:** inactive ("set up later").
  - A starting subcategory whose name or code prefix is already in use is skipped; an attribute with the same name as an admin-made one reuses it.
- Rules that depend on properties (prefix lock, delete subcategory, type lock) go through a `PropertyUsage` interface; Phase 2.2 plugs in the real counts.

### 7.8 `amenities` (Phase 2)
```ts
{ categoryKey, name, nameKey (unique per category), icon: 'shield-check'|'car'|… | null,
  appliesToAll: boolean,                         // true: every subcategory, including new ones
  subcategoryIds: string[],                      // when not for all
  isActive, order,                               // order = checklist order on the property form
  createdBy, updatedBy }
```
An amenity ticked on properties can't be deleted, only deactivated (properties keep it). The 14 starting Residential amenities are added once, marked by `propertyCategories.amenitiesSeededAt`.

### 7.9 `properties` (Phase 2)
```ts
{
  code: 'RE-VIL-000031',                        // unique; from counters, per subcategory prefix; never changes
  categoryKey, subcategoryId,                   // category copied from the subcategory
  title,                                        // "Property name" (core attribute)
  purpose: 'sale'|'rent'|'lease',               // must be allowed by the subcategory
  price: { amount | null, basis: 'total'|'per_sqft'|'per_month', negotiable, onRequest },
  rental: { securityDeposit, lockInMonths } | null,   // rent / lease only
  area: { value, unit: 'sqft'|'sqyd'|'sqm'|'cent'|'ground'|'acre'|'hectare', sqft } | null,
  location: {                                   // entered by the admin, no master data
    state, city, locality, pincode, address, landmark,
    mapPin: { lat, lng } | null                 // optional: website map + visit directions
  },
  attributeValues: { [attributeKey]: string | number | boolean | string[] },
                                                // common + subcategory attributes (incl. description,
                                                // RERA / approval where configured); values the current
                                                // subcategory doesn't show are kept and reported as hidden
  extraAttributes: [{ label, type: 'text'|'long_text'|'number'|'yes_no'|'date', value }],  // this property only
  amenityIds: string[],                         // offered for the subcategory, in checklist order
  media: [{ _id, kind: 'image'|'video'|'floor_plan'|'brochure'|'document',
            path, thumbPath?, mediumPath?, originalName, mime, sizeBytes, order, isCover }],
                                                // photos: path = 2000 px WebP, medium 1200 px, thumb 400 px
  status: 'draft'|'published'|'unpublished'|'booked'|'sold'|'rented'|'leased'|'archived',
  isFeatured, publishedAt | null, statusChangedAt,
  createdBy, updatedBy
}
```
Indexes:
- `{ code: 1 } unique`
- `{ status: 1, subcategoryId: 1, 'location.city': 1, 'price.amount': 1 }`
- `{ 'location.locality': 1 }`, `{ 'location.pincode': 1 }`, `{ amenityIds: 1 }`, `{ updatedAt: -1 }`

**Rules:**
- Saving a Draft needs only the subcategory, the property name and the purpose; values are checked against the subcategory's attributes (types, options, unknown keys).
- **Publishing** needs a price (or "price on request"), the area, city, locality and pincode, every attribute marked Required for the subcategory, and at least one photo. A published property must stay complete while it is published.
- Status changes follow PRD §5.4; the closing status must match the purpose (Sale → Sold, Rent → Rented, Lease → Leased). Archived properties can't be edited until restored as a Draft.
- Changing the subcategory keeps the code; values outside the new subcategory are kept but hidden, and amenities it doesn't offer are dropped.
- Every change is recorded in `changeLogs` (attribute values one by one, e.g. `attributes.bhk`).

**Area conversion to sq.ft:** sqyd ×9 · sqm ×10.7639 · cent ×435.6 · ground ×2400 · acre ×43,560 · hectare ×107,639 (`packages/shared`).

**Location matching (AI and admin search):** case-insensitive match of the search text against `location.locality`, `location.city` and `location.pincode`. The admin form suggests existing values (distinct values from properties) to keep spellings consistent.

### 7.10 `counters` and `importBatches` (Phase 2)
```ts
counters:      { _id: 'property:VIL', seq }     // atomic $inc for property codes
importBatches: { subcategoryId, subcategoryName, fileName, filePath (uploads/imports/…, never public),
  status: 'checked'|'imported', unknownColumns: string[],
  importAs?: 'draft'|'published', duplicates?: 'skip'|'update',
  rows: [{ row, status: 'valid'|'invalid'|'duplicate', errors: string[],
           duplicateOf?: { id?, code?, row? }, body (checked create-property body), imageUrls, outcome? }],
  result?: { created, updated, skipped, failed, savedAsDraft, imagesAdded, imagesFailed },
  createdBy, importedBy?, importedAt?, createdAt }
```
Rows are embedded. At up to 2,000 rows per file, the batch document stays well under MongoDB's 16 MB limit.

### 7.11 `appointments` and `slotBookings` (Phase 3)
```ts
appointments: {
  code: 'AP-000123', propertyId, agentId?,
  customer: { perfoxCustomerId?, name, phone, email? },   // the lead itself lives in Perfox
  scheduledAt, durationMinutes,
  status: 'requested'|'confirmed'|'completed'|'no_show'|'cancelled',
  source: 'ai'|'admin'|'website',
  history: [{ action: 'booked'|'rescheduled'|'cancelled'|'status_changed', from?, to?, by: 'ai'|'user'|'customer', reason?, at }],
  cancelReason?, notes?,
  createdVia?: { perfoxConversationId?, idempotencyKey? }
}
slotBookings: { slotKey: '2026-12-05T10:00', count }      // unique slotKey
```
**Slot capacity without transactions:** booking calls
`findOneAndUpdate({ slotKey, count: { $lt: max } }, { $inc: { count: 1 } }, { upsert: true })`.
- If the slot is full, no document matches and the upsert hits the unique index. That **duplicate-key error is turned into `409 SLOT_UNAVAILABLE`**.
- Cancelling or rescheduling decrements the old slot.

### 7.12 `idempotencyKeys` (Phase 3)
```ts
{ key (unique), toolName, result, createdAt }            // TTL 7 days
```

---

## 8. API endpoint catalogue

All paths are under `/api/v1`. Full schemas are in Swagger (`/api/docs`).

### Phase 1
| Area | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET /auth/invite?token=` (invite details), `POST /auth/accept-invite` (activates and signs in) |
| Users | `GET /admin/users`, `GET /admin/users/stats` (status counts), `POST /admin/users` (invite), `GET /admin/users/:id`, `PATCH /admin/users/:id`, `POST /admin/users/:id/resend-invite`, `/deactivate`, `/reactivate`, `/send-password-reset`, `/unlock`, `GET /admin/roles` (read-only matrix) |
| Profile | `GET /admin/profile`, `PATCH /admin/profile`, `POST /admin/profile/change-password` |
| Settings | `GET /admin/settings/company`, `PUT /admin/settings/company`, `POST /admin/settings/company/logo` (multipart) |
| System | `GET /health` |

### Phase 2
| Area | Endpoints |
|---|---|
| Categories & attributes | `GET /admin/property-types` (whole setup), `GET /admin/property-types/attributes?q=` (find existing attributes), `POST /admin/property-types/subcategories`, `PATCH/DELETE /admin/property-types/subcategories/:id`, `POST /admin/property-types/categories/:key/attributes` and `POST /admin/property-types/subcategories/:id/attributes` (new or existing attribute), `PATCH/DELETE …/attributes/:attributeId`. Every change returns the whole setup. |
| Amenities | Listed in `GET /admin/property-types` (per category). `POST /admin/property-types/categories/:key/amenities`, `PUT /admin/property-types/categories/:key/amenities/order`, `PATCH/DELETE /admin/property-types/amenities/:id`. Every change returns the whole setup. |
| Properties | `GET/POST /admin/properties`, `GET /admin/properties/status-counts`, `GET/PATCH/DELETE /admin/properties/:id` (DELETE archives; PATCH with `subcategoryId` changes the subcategory), `POST /admin/properties/:id/status`, `POST /admin/properties/bulk-status`, `POST /admin/properties/:id/duplicate`, `GET /admin/properties/:id/history`, `GET /admin/properties/location-suggestions?field=city&q=` |
| Media | `POST /admin/properties/:id/media?kind=` (multipart upload), `PUT /admin/properties/:id/media/order`, `POST /admin/properties/:id/media/:mediaId/cover`, `DELETE /admin/properties/:id/media/:mediaId` |
| Map | `GET /admin/geo/search?city=&locality=&pincode=&state=` (address → map position), `GET /admin/geo/reverse?lat=&lng=` (pin → nearest address). Proxied to OpenStreetMap Nominatim: one request at a time, at most one per second, cached for a day; only the typed address or pin is sent. |
| Imports | `GET /admin/imports/template?subcategoryId=` (xlsx), `POST /admin/imports?subcategoryId=` (upload + check every row), `GET /admin/imports` (history), `GET /admin/imports/:id`, `POST /admin/imports/:id/commit`, `GET /admin/imports/:id/error-report` (xlsx). All need `imports:run`. |

### Phase 3
| Area | Endpoints |
|---|---|
| Visit slots | `GET/PUT /admin/settings/visit-slots`, `GET /admin/availability?propertyId=&from=&to=` |
| Appointments | `GET/POST /admin/appointments`, `GET /admin/appointments/:id`, `POST /admin/appointments/:id/reschedule`, `/cancel`, `/confirm`, `/complete`, `/no-show`, `GET /admin/appointments/calendar?from&to&agentId` |
| Leads (Perfox) | `GET /admin/leads`, `GET /admin/leads/:id` (proxied to Perfox; exact capabilities follow the Perfox API docs) |
| Conversations (Perfox) | `GET /admin/conversations`, `GET /admin/conversations/:id`, `GET /admin/conversations/:id/transcript` |
| Call logs (Perfox) | `GET /admin/calls`, `GET /admin/calls/:id`, `GET /admin/calls/:id/recordings` |
| Dashboard | `GET /admin/dashboard/summary` (our counts + live Perfox counts) |
| MCP | `POST /mcp` (outside `/api/v1`) |

---

## 9. MCP server for the AI agent (Phase 3, inside Express)

Follows Perfox's guide **"Building Your Own MCP Server"** (https://perfox.ai/docs/mcp/building-your-own).

### 9.1 Protocol
Perfox sends JSON-RPC 2.0 requests to `POST /mcp`:

| Method | Our response |
|---|---|
| `initialize` | `{ protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo }` |
| notifications (no `id`) | HTTP `202`, empty body |
| `ping` | `{}` |
| `tools/list` | `{ tools: [{ name, description, input_schema }] }` |
| `tools/call` | `{ content: [{ type: 'text', text: '<json>' }] }`, or `isError: true` for tool-level errors |
| anything else | JSON-RPC error `-32601` |

```ts
// modules/mcp/mcp.router.ts (sketch)
mcpRouter.use(mcpAuth, mcpRateLimit);
mcpRouter.post('/', async (req, res) => {
  const { method, params, id } = req.body ?? {};
  if (id === undefined) return res.status(202).end();
  const reply = (result: unknown) => res.json({ jsonrpc: '2.0', id, result });
  switch (method) {
    case 'initialize': return reply({ protocolVersion: '2024-11-05', capabilities: { tools: {} },
                                      serverInfo: { name: 'real-estate-mcp', version: APP_VERSION } });
    case 'ping':       return reply({});
    case 'tools/list': return reply({ tools: toolDescriptors });
    case 'tools/call': {
      const tool = tools[params?.name];
      if (!tool) return res.json({ jsonrpc: '2.0', id, error: { code: -32602, message: 'unknown_tool' } });
      const parsed = tool.input.safeParse(params.arguments ?? {});
      if (!parsed.success) return reply(toolError(parsed.error.issues));
      const ctx = getMcpContext(req);                       // X-Sa-* headers
      const key = req.get('Idempotency-Key') ?? params?._meta?.['ai.perfox/idempotency-key'];
      return reply(await withIdempotency(tool.mutates ? key : undefined, tool.name,
                                         () => tool.handler(parsed.data, ctx).then(toolText)));
    }
    default: return res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'unknown_method' } });
  }
});
```

### 9.2 Tools (six tools, for the three AI jobs)

| Tool | Job | Changes data | Input | Output (summary) |
|---|---|---|---|---|
| `search_properties` | Search | No | `location?` (area / city / pincode text), `group?`, `purpose?`, `minPrice?`, `maxPrice?`, `minAreaSqft?`, `maxAreaSqft?`, `limit ≤ 10` | `{ total, items: [{ code, title, group, purpose, priceText, areaText, location, keyFields }] }` |
| `get_property_details` | Details | No | `code` | Published details: price, area, location, public group fields, extra fields, amenities, legal, map link if a pin exists |
| `get_available_slots` | Schedule | No | `propertyCode`, `fromDate?`, `days ≤ 7` | `[{ date, slots: ['10:00', '11:00'] }]` |
| `book_site_visit` | Schedule | Yes | `propertyCode`, `slotStart`, `name`, `phone?` | `{ appointmentCode, status, dateTimeText, address }` |
| `reschedule_visit` | Schedule | Yes | `appointmentCode`, `newSlotStart` | Updated appointment |
| `cancel_visit` | Schedule | Yes | `appointmentCode`, `reason?` | `{ status: 'cancelled' }` |

**Rules:**
- Only **published** properties and **public** fields are returned. Internal fields, internal notes, staff phone numbers and unpublished data never leave the API.
- Results stay small (at most 10 items, summary fields only).
- The caller's phone comes from `phone` or the `X-Sa-End-User-Phone` header. If neither is present, the tool returns an error asking the agent to collect it.
- `reschedule_visit` and `cancel_visit` act only on appointments whose `customer.phone` matches the caller.
- Changing tools are **idempotent**, so a retry never creates a second booking.
- Tool descriptions say what the tool does and when to use it, never instructions to the model (Perfox scans tool text for prompt injection).

### 9.3 Security
- `Authorization: Bearer <MCP_BEARER_TOKEN>` (set in Perfox under Integrations → custom server), compared in constant time.
- HTTPS only; separate rate limit for `/mcp`.

---

## 10. Perfox integration (Phase 3)

### 10.1 Approach
- **Direct REST calls, on demand.** When an admin opens Leads, Conversations or Call Logs, our API calls the matching Perfox endpoint, converts the response to our format and returns it.
- **No local copies, no sync**, no polling, no webhooks, no background jobs.
- The Perfox API key stays on the server; the browser never calls Perfox directly.
- The exact endpoints and fields will be confirmed from the **Perfox API documentation** you provide at this stage.

### 10.2 Perfox client (`modules/perfox/perfox.client.ts`)
- Thin typed wrapper over `fetch`: bearer auth, 10 s timeout, JSON parsing.
- Perfox errors are mapped to `502 UPSTREAM_ERROR` with a readable message.
- Read requests (GET) are retried at most twice on network errors or `429` (honouring `Retry-After`) **within the same request**. This is not a background retry.
- Optional short in-memory cache (e.g. 30–60 s) for list calls, to avoid repeat calls while paging. No Redis.

### 10.3 Screens and their data source

| Screen | Data source | Notes |
|---|---|---|
| Leads list / detail | Perfox customers API | Lead stages, agent assignment and notes depend on what the Perfox API supports (confirm from the docs) |
| Conversations list / detail / transcript | Perfox conversations API | Transcript loaded when opened |
| Call logs list / detail / recording | Perfox calls API | Recording links are fetched fresh each time (they expire) |
| Appointments | **Our MongoDB** | `customer.perfoxCustomerId` links an appointment to the Perfox customer |
| Dashboard | Our MongoDB + live Perfox counts | |

### 10.4 Perfox configuration (in Perfox Studio)
- **Property Assistant** agent:
  - Instructions limited to the three AI jobs.
  - Never invent details; hand over to staff when it can't help.
  - Connected to our `/mcp` server with the bearer token.
- **Channel during development:** Perfox web chat, for testing. WhatsApp and phone (Plivo) are added later.
- **Environment variables:** `PERFOX_API_BASE`, `PERFOX_API_KEY`, `MCP_BEARER_TOKEN`.

### 10.5 Deferred (decide when we reach that stage)
- **Plivo** (phone calls) and **WhatsApp** channels.
- **Reminder call before the visit.** It needs Plivo, plus a way to trigger the call at the right time without a background job system.
- WhatsApp/SMS confirmation messages.

---

## 11. File storage (local server)

**Storage module** (`lib/storage`):
```ts
interface StorageProvider {
  save(file: Buffer | Readable, opts: { folder: string; ext: string; mime: string }): Promise<{ path: string; sizeBytes: number }>;
  delete(path: string): Promise<void>;
  publicUrl(path: string): string;       // e.g. /uploads/properties/RE-VIL-000031/images/abc.webp
  absolutePath(path: string): string;    // for internal reads (imports, error reports)
}
```
`LocalStorageProvider` is the only implementation now (development and testing). A Cloudinary provider will be added later, when the credentials are provided, without changing business code.

**Folder layout** (root set by `UPLOAD_DIR`, default `apps/api/uploads`):
```
uploads/
  company/logo/                              logo files
  properties/<propertyCode>/images/          each photo: large (2000px) + medium (1200px) + thumb (400px), WebP
  properties/<propertyCode>/videos/          MP4 / WebM
  properties/<propertyCode>/documents/       PDF floor plans, brochures, documents
  imports/<batchId>/                         uploaded Excel file + error report (not public)
```

**Rules:**
- File names are generated (random ID + extension). The original name is kept only in the database.
- MIME and extension whitelist:
  - Images: jpg, png, webp (checked from the file content, then re-encoded)
  - Videos: mp4, webm
  - Documents: pdf
  - Imports: xlsx
- Size limits: image 10 MB, video 50 MB, PDF 20 MB, Excel 10 MB. Upload parsing with `multer` (one file per request).
- Images are resized with **sharp** during the upload request (no background job); the camera rotation is applied and metadata (e.g. GPS location) is dropped.
- The database stores the **relative path** (local storage). When Cloudinary is added, its full https URL goes into the same field; `publicUrl()` returns full URLs unchanged, so no other code changes. The API always returns URLs built with `publicUrl()`.
- `express.static` serves `uploads/company` and `uploads/properties` under `/uploads`, with cache headers. `uploads/imports` is **not** public; downloads go through an authenticated endpoint.
- Deleting media or archiving a property removes or keeps files according to the action (deleting media removes its files).
- `uploads/` is git-ignored (`apps/api/uploads/` and a root `/uploads/`) and must be included in server backups.

---

## 12. Email (Resend, swappable)

**Email module** (`lib/email`):
```ts
interface EmailProvider {
  send(msg: { to: string | string[]; subject: string; html: string; text?: string; replyTo?: string }): Promise<{ id?: string }>;
}
```
- `ResendProvider` uses `RESEND_API_KEY` and `EMAIL_FROM`.
- `ConsoleProvider` prints emails to the log in local development (no account needed).
- `EMAIL_PROVIDER=resend|console` selects the provider. Adding another provider means one new class.
- Templates live in code (`lib/email/templates`):
  - Phase 1: user invite, password reset, password changed.
  - Phase 3: visit booked / rescheduled / cancelled, sent to the customer when their email is known, and to the assigned agent.
- Sending happens inside the request. A failed send is logged and reported to the admin ("invite email could not be sent, resend?"); it is never retried in the background.

---

## 13. Bulk import design (Phase 2)

All processing happens **inside the request**, with no background jobs. Files are limited to 2,000 rows and 10 MB.

1. **Template** (`GET /admin/imports/template?subcategoryId=`): ExcelJS builds, from the subcategory's form definition:
   - The `Properties` sheet: core columns (property name, purpose, price, price basis, negotiable, price on request, deposit, lock-in, area, unit, city, locality, pincode, state, address, landmark, latitude, longitude), then the common and subcategory attributes, then amenities, featured and image URLs. Required ones are marked `*`; each header has a note.
   - Dropdowns for fixed values (purpose, units, Yes / No, dropdown attributes) through a very hidden `Lists` sheet.
   - An `Instructions` sheet: what each column takes, whether it is needed to import or to publish, and an example.
2. **Upload + check** (`POST /admin/imports?subcategoryId=`, multipart): columns are matched by name (unknown ones are listed and ignored); each row is turned into a create-property body and checked exactly like Add property (schema, purpose, attribute types and options, amenities). Messages name the column, e.g. "Pincode: Enter a valid 6-digit pincode".
   - **Duplicates**: same subcategory, area / locality and pincode, and the same plot number (or property name), within the file (later rows) and against existing, not archived properties.
   - The file is saved under `uploads/imports/` and the per-row results in `importBatches.rows`. Nothing is imported yet.
3. **Review** (admin UI): counts, rows by status, error report.
4. **Import** (`POST /admin/imports/:id/commit` with `{ importAs, duplicates }`): runs once per batch. Valid rows are created (codes from `counters`); duplicates of existing properties are skipped or updated (an update changes only the cells filled in the sheet; empty cells keep the existing values, and `importAs: published` publishes only new properties and drafts: a Sold, Booked or Unpublished property keeps its status); duplicates within the file are skipped. Each row keeps its outcome. Rows asked to be Published but not ready (e.g. no photo) stay Draft, with the reason.
5. **Photos:** the `Image URLs` column (up to 5 https links per row) is downloaded during the import through the storage module, like an upload (resized to WebP; the first becomes the cover). Links must be public https: private-network hosts are refused (checked again after each redirect), with a 10 s timeout and the 10 MB photo limit. A ZIP of photos is not supported yet.
6. **Error report** (`GET /admin/imports/:id/error-report`): the rows that need attention, with `Errors` and `Row` columns added in front, so they can be fixed and uploaded again.

---

## 14. Frontend architecture

### 14.1 Shared
- `packages/shared`: Zod schemas, enums (statuses, purposes, units, roles, permissions), `formatINR` (₹45 L / ₹1.25 Cr), area conversion.
- API client per app: `fetch` + TanStack Query, with types from the shared schemas.

### 14.2 Admin portal (`apps/admin`)
- **Routes:**
  - Phase 1: `/login`, `/forgot-password`, `/reset-password`, `/accept-invite`, `/users`, `/profile`, `/settings/company`
  - Phase 2: `/properties`, `/properties/new`, `/properties/:id`, `/imports`, `/settings/property-types`
  - Phase 3: `/dashboard`, `/appointments`, `/leads`, `/conversations`, `/calls`, `/settings/visit-slots`
- **Layout:** left sidebar (modules), top bar (user menu). Settings uses a **top navbar** for its tabs, which grow per phase.
- **Auth:** the access token is kept in memory and refreshed silently through the cookie. Menus and buttons follow the permissions from `/auth/me`.
- **Dynamic property form:** React Hook Form + Zod; section 4 is rendered from the selected group's fields; "+ Add field" offers "add to group" or "this property only".
- **Tables:** TanStack Table with server-side paging, sorting and filters (state in the URL).
- **Media uploader:** multipart upload to our API with progress, drag to reorder, set cover.

### 14.3 Public website (`apps/web`, Phase 4)
- Pages: home, listing, property details, about, contact.
- SEO: Express injects title, description, Open Graph and JSON-LD for public routes; the sitemap is generated on request and cached in memory.
- The OTP channel for website forms will be decided in Phase 4 (SMS and WhatsApp are deferred).

---

## 15. Security

| Area | Measures |
|---|---|
| Transport | HTTPS only (reverse proxy), HSTS |
| Headers | `helmet`; CORS limited to the admin and website origins |
| Auth | Short-lived JWT, rotating refresh token, argon2id, lockout, SameSite=Strict cookies |
| Input | Zod on every route; NoSQL-injection protection; body limit 1 MB; upload type and size whitelist |
| Uploads | Generated file names, no user-controlled paths, imports folder not public, images re-encoded by sharp |
| Rate limiting | Login 10/min/IP, forgot-password 5/hour/IP, `/mcp` 120/min, public API 60/min/IP |
| Secrets | Environment variables only, never committed; Perfox key and MCP token rotated on staff changes |
| Data | Only needed personal data stored; leads, conversations and recordings stay in Perfox |
| Audit | `changeLogs` for user, role, settings, property and appointment changes |

---

## 16. Logging and monitoring
- pino JSON logs with `requestId`, `userId` and route. Phone numbers and tokens are masked.
- MCP tool calls are logged with tool name, conversation ID, latency and result status.
- Perfox API errors are logged with endpoint and status code.
- `GET /health` reports API and database status.

---

## 17. Environments and configuration

| Environment | Setup |
|---|---|
| Local | `docker compose` (MongoDB on host port **27018**, so it never clashes with a locally installed MongoDB on 27017); API + admin dev servers; `EMAIL_PROVIDER=console`; `uploads/` in the project |
| Demo / staging server | Node process + MongoDB + `uploads/` folder, behind a reverse proxy (HTTPS); admin built as static files |

**Environment variables** (validated with Zod at startup; the process stops if one is missing):
- `NODE_ENV`, `PORT`, `MONGODB_URI`
- `JWT_ACCESS_SECRET` (refresh tokens are random values, so there is no refresh secret)
- `ADMIN_ORIGIN`, `WEB_ORIGIN`, `APP_BASE_URL` (for links in emails)
- `UPLOAD_DIR`
- `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`
- `SWAGGER_BASIC_AUTH`
- `GEOCODER_URL` (default OpenStreetMap Nominatim), `GEOCODER_COUNTRY` (default `in`): address search for the property map
- Phase 3: `PERFOX_API_BASE`, `PERFOX_API_KEY`, `MCP_BEARER_TOKEN`

---

## 18. Testing strategy

| Level | Tooling | Focus |
|---|---|---|
| Unit | Vitest | Password and token rules, permissions, area/price helpers, property codes, group field validation, Excel row validation, slot calculation, reschedule/cancel rules |
| Integration | Vitest + Supertest + mongodb-memory-server | All REST routes, permission checks, upload handling (temp `UPLOAD_DIR`), email sent through a fake provider, slot capacity under concurrent bookings |
| Perfox client | Mocked HTTP (`msw`) | Response mapping, error → `502`, retry on 429 within the request |
| MCP | Supertest JSON-RPC tests | `initialize`, `tools/list` snapshot, each tool's success and error paths, caller-phone rules, idempotent retries |
| API contract | Postman CLI with collections generated from `/api/openapi.json` | Responses match the spec |
| E2E | Playwright | Phase 1 flows (login, invite, roles, company info); Phase 2 flows (group, property, import); Phase 3 flows (appointments) |
| AI quality | Scripted conversations in Perfox web chat | Search, details, book, reschedule, cancel; no invented details |

---

## 19. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Perfox API doesn't support lead stages, assignment or notes | Confirm from the docs at the start of Phase 3; adjust the Leads screen to what the API offers |
| Perfox API slow or unavailable | Timeouts, clear "Perfox unavailable" message in the UI, short in-memory cache for lists |
| Local disk full or lost | Monitor disk space; include `uploads/` in server backups; storage module allows moving to other storage later |
| Single server process (in-memory rate limits and cache) | Acceptable at this scale; revisit if the API runs on more than one server |
| AI invents details | Strict agent instructions; tools return only verified public fields; AI test conversations |
| Duplicate bookings from AI retries | Idempotency keys + `slotBookings` capacity check |
| Large Excel files block a request | 2,000-row and 10 MB limits; streaming parse |

---

## 20. Open decisions

| # | Decision | Current proposal |
|---|---|---|
| T-1 | When the public website is built | After Phase 2 or as Phase 4 (to confirm) |
| T-2 | Which lead features the Leads screen offers | Decide from the Perfox API documentation in Phase 3 |
| T-3 | Reminder call before visits: trigger mechanism | Decide with Plivo integration (no background job system) |
| T-4 | Plivo and WhatsApp channels | Discuss when we reach that stage |
| T-5 | OTP channel for website forms | Decide in Phase 4 |
| T-6 | Hosting for the demo / staging server | To confirm before the Phase 1 demo |
