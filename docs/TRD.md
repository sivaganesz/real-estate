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
- Property types are now "groups" with fields.

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
 │  modules: auth · users · settings · propertyGroups · amenities ·    │
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
│   │   │       ├── propertyGroups/   # Phase 2 (groups + field library)
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

---

## 6. Authentication and permissions (Phase 1)

### 6.1 Login and sessions
- `POST /auth/login` returns an access token (JWT, 15 min) and sets a refresh token cookie:
  - Random value, stored hashed, valid 7 days, rotated on every use.
  - Cookie flags: `Secure; HttpOnly; SameSite=Strict`.
- `POST /auth/refresh` rotates the refresh token. Reusing an old token revokes all of that user's sessions.
- `POST /auth/logout` revokes the current refresh token.
- `GET /auth/me` returns the user and their permission list.
- Passwords are hashed with argon2id. Minimum length is 10 characters.
- After 5 failed logins the account locks for 15 minutes; a Super Admin can unlock it earlier.
- The admin UI signs the user out after 30 minutes of inactivity.

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
    phones: { primary, alternate? }, whatsappNumber?, publicEmail, enquiryEmails: string[] },
  updatedBy, updatedAt }

{ key: 'visitSlots', value: {                      // Phase 3
    workingDays: number[], dayStart: 'HH:mm', dayEnd: 'HH:mm', slotMinutes: 60,
    maxVisitsPerSlot: 3, minNoticeMinutes: 120, bookingWindowDays: 30,
    blockedDates: [{ date: 'YYYY-MM-DD', from?: 'HH:mm', to?: 'HH:mm', reason, propertyId? }] } }
```

### 7.5 `changeLogs` (Phase 1)
Simple record of important changes. There is no screen for it in Phase 1; property history is shown on the property page.
```ts
{ actorId, entity: 'user'|'settings'|'property'|'propertyGroup'|'appointment', entityId,
  action: 'created'|'updated'|'status_changed'|'archived'|'role_changed'|..., changes?: { field: [before, after] }, at }
```
Indexes: `{ entity: 1, entityId: 1, at: -1 }`.

### 7.6 `fieldDefinitions` (Phase 2): a field library shared by groups
```ts
{ key: 'facing' (unique, locked once used), label: 'Facing',
  type: 'number'|'text'|'dropdown'|'multi_select'|'yes_no'|'date',
  unit?: 'ft'|'sq.ft'|'slots'|..., options?: string[],
  visibility: 'public'|'internal',             // internal fields never reach the website or the AI
  createdBy, createdFrom?: { propertyId } }    // set when added during property creation
```

### 7.7 `propertyGroups` (Phase 2)
```ts
{ name: 'Villa / House', category: 'residential'|'commercial'|'other',
  purposes: ('sale'|'rent'|'lease')[], codePrefix: 'VIL' (locked after first property),
  icon?, isActive, order,
  fields: [{ fieldId, order, required, websiteFilter, showOnCard, hidden }] }
```
Seed groups: Residential Plot, Villa / House, Apartment / Flat, Commercial Plot, Commercial Space, Warehouse, Agricultural Land, Industrial Land, each with their starting fields.

### 7.8 `amenities` (Phase 2)
```ts
{ name, icon?, groupIds: ObjectId[], isActive, order }
```

### 7.9 `properties` (Phase 2)
```ts
{
  code: 'RE-VIL-000031',                        // unique, from counters
  slug, title, description,
  groupId, category,                            // category copied from the group
  purpose: 'sale'|'rent'|'lease',
  price: { amount, basis: 'total'|'per_sqft'|'per_month', negotiable, onRequest },
  rental?: { monthlyRent, securityDeposit, maintenance, lockInMonths },
  area: { value, unit: 'sqft'|'sqyd'|'sqm'|'cent'|'ground'|'acre'|'hectare', sqft },
  location: {                                   // entered by the admin, no master data
    state, city, area, pincode, address, landmark?,
    mapPin?: { lat, lng }                       // optional: website map + visit directions
  },
  fieldValues: { [fieldKey]: unknown },         // validated against the group's fields
  extraFields: [{ label, type, value }],        // "this property only"
  hiddenFieldValues?: { [fieldKey]: unknown },  // kept when the group changes
  amenityIds: ObjectId[],
  media: [{ _id, kind: 'image'|'video'|'floor_plan'|'brochure'|'document',
            path, thumbPath?, mediumPath?, originalName, mime, sizeBytes, order, isCover }],
  legal: { reraNumber?, approvalType?, approvalNumber? },
  status: 'draft'|'published'|'unpublished'|'booked'|'sold'|'rented'|'leased'|'archived',
  isFeatured, publishedAt?, statusChangedAt,
  createdBy, updatedBy
}
```
Indexes:
- `{ code: 1 } unique`, `{ slug: 1 } unique`
- `{ status: 1, groupId: 1, 'location.city': 1, 'price.amount': 1 }`
- `{ 'location.area': 1 }`, `{ 'location.pincode': 1 }`
- `{ status: 1, purpose: 1, 'area.sqft': 1 }`
- Text index on `title`, `description`, `location.area`, `location.city`, `code`

**Area conversion to sq.ft:** sqyd ×9 · sqm ×10.7639 · cent ×435.6 · ground ×2400 · acre ×43,560 · hectare ×107,639 (`packages/shared`).

**Location matching (AI and admin search):** case-insensitive match of the search text against `location.area`, `location.city` and `location.pincode`. The admin form suggests existing values (distinct values from properties) to keep spellings consistent.

### 7.10 `counters` and `importBatches` (Phase 2)
```ts
counters:      { _id: 'property:VIL', seq }     // atomic $inc for property codes
importBatches: { groupId, filePath, fileName, uploadedBy,
  status: 'validated'|'imported'|'failed',
  options?: { publishMode: 'draft'|'published', duplicateMode: 'skip'|'update' },
  counts: { total, valid, invalid, duplicate, imported, updated, skipped },
  rows: [{ rowNumber, status, errors: [{ column, message }], duplicateOfPropertyId?, propertyId? }],
  errorReportPath?, createdAt }
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
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/accept-invite` |
| Users | `GET /admin/users`, `POST /admin/users` (invite), `GET /admin/users/:id`, `PATCH /admin/users/:id`, `POST /admin/users/:id/resend-invite`, `/deactivate`, `/reactivate`, `/send-password-reset`, `/unlock`, `GET /admin/roles` (read-only matrix) |
| Profile | `GET /admin/profile`, `PATCH /admin/profile`, `POST /admin/profile/change-password` |
| Settings | `GET /admin/settings/company`, `PUT /admin/settings/company`, `POST /admin/settings/company/logo` (multipart) |
| System | `GET /health` |

### Phase 2
| Area | Endpoints |
|---|---|
| Groups & fields | `GET/POST /admin/property-groups`, `GET/PATCH /admin/property-groups/:id`, `POST /admin/property-groups/:id/fields` (add new or existing field), `PATCH /admin/property-groups/:id/fields/:fieldId`, `PUT /admin/property-groups/:id/fields/order`, `GET /admin/fields` (library search), `GET /admin/fields/recent` (added during property creation) |
| Amenities | `GET/POST /admin/amenities`, `PATCH /admin/amenities/:id` |
| Properties | `GET/POST /admin/properties`, `GET/PATCH /admin/properties/:id`, `POST /admin/properties/:id/status`, `POST /admin/properties/bulk-status`, `POST /admin/properties/:id/duplicate`, `POST /admin/properties/:id/change-group`, `GET /admin/properties/:id/history`, `GET /admin/properties/location-suggestions?field=city&q=` |
| Media | `POST /admin/properties/:id/media` (multipart upload), `PATCH /admin/properties/:id/media/order`, `PATCH /admin/properties/:id/media/:mediaId` (cover, caption), `DELETE /admin/properties/:id/media/:mediaId` |
| Imports | `GET /admin/imports/templates/:groupId` (xlsx), `POST /admin/imports` (upload + validate), `GET /admin/imports`, `GET /admin/imports/:id`, `POST /admin/imports/:id/commit`, `GET /admin/imports/:id/error-report` |

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
`LocalStorageProvider` is the only implementation now. Another provider can be added later without changing business code.

**Folder layout** (root set by `UPLOAD_DIR`, default `apps/api/uploads`):
```
uploads/
  company/logo/                              logo files
  properties/<propertyCode>/images/          original + _thumb (400px) + _medium (1200px), WebP
  properties/<propertyCode>/documents/       floor plans, brochures, legal PDFs
  imports/<batchId>/                         uploaded Excel file + error report (not public)
```

**Rules:**
- File names are generated (random ID + extension). The original name is kept only in the database.
- MIME and extension whitelist:
  - Images: jpg, png, webp
  - Documents: pdf
  - Imports: xlsx
- Size limits: image 10 MB, PDF 20 MB, Excel 10 MB. Upload parsing with `multer`.
- Images are resized with **sharp** during the upload request (no background job).
- The database stores the **relative path**. The API returns URLs built with `publicUrl()`.
- `express.static` serves `uploads/company` and `uploads/properties` under `/uploads`, with cache headers. `uploads/imports` is **not** public; downloads go through an authenticated endpoint.
- Deleting media or archiving a property removes or keeps files according to the action (deleting media removes its files).
- `uploads/` is git-ignored and must be included in server backups.

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

All processing happens **inside the request**, with no background jobs. Files are limited to 2,000 rows.

1. **Template** (`GET /admin/imports/templates/:groupId`): ExcelJS builds:
   - The `Properties` sheet: common columns + the group's fields (required ones marked `*`).
   - Dropdowns for fixed values (purpose, unit, dropdown fields) through a hidden `Lists` sheet.
   - An `Instructions` sheet and a sample row.
   - A hidden cell holding the group ID and template version.
2. **Upload + validate** (`POST /admin/imports`, multipart): save the file to `uploads/imports/<batchId>/`, then for each row:
   - Normalise (trim, numbers, units, phone).
   - Validate with the Zod schema built from the group's fields.
   - Check for duplicates by `code`, or by `group + area + pincode + area.sqft + (plot number or title)`, within the file and against the database.
   - Store the per-row result in `importBatches.rows` and return the summary.
3. **Review** (admin UI): counts plus error rows.
4. **Commit** (`POST /admin/imports/:id/commit` with `{ publishMode, duplicateMode }`): `insertMany` in chunks of 100, codes from `counters`, update or skip duplicates, write `changeLogs`.
5. **Images:** an `imageUrls` column (downloaded and saved through the storage module during commit), or a ZIP upload with files named `<code>_<n>.jpg`.
6. **Error report:** the original rows plus an `Errors` column, saved in `uploads/imports/<batchId>/` and downloaded through an authenticated endpoint.

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
| Local | `docker compose` (MongoDB); API + admin dev servers; `EMAIL_PROVIDER=console`; `uploads/` in the project |
| Demo / staging server | Node process + MongoDB + `uploads/` folder, behind a reverse proxy (HTTPS); admin built as static files |

**Environment variables** (validated with Zod at startup; the process stops if one is missing):
- `NODE_ENV`, `PORT`, `MONGODB_URI`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `ADMIN_ORIGIN`, `WEB_ORIGIN`, `APP_BASE_URL` (for links in emails)
- `UPLOAD_DIR`
- `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`
- `SWAGGER_BASIC_AUTH`
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
