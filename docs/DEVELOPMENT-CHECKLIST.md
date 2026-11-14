# Development Checklist: Real Estate Platform

Tick each item when it is done. The work runs phase by phase. Each phase ends with a demo to stakeholders and a round of feedback. The next phase starts only after that feedback has been handled.

**Stack:** React + Vite (admin and website), Express + TypeScript (API), MongoDB, OpenAPI/Swagger, Perfox AI, monorepo (pnpm workspaces). Architecture details are in [TRD.md](./TRD.md).

**AI agent scope (three jobs only):**
1. Answer customers' questions about property details.
2. Search properties by location, property type and budget.
3. Schedule, reschedule and cancel site visits or meetings.

The AI agent reads property data only through our MCP tools. Property locations are the fields the admin enters on each property (city, area, pincode, address).

**Development guidelines:**
- Keep it simple:
  - No background workers, queues (BullMQ/Redis), cron jobs or data-sync systems.
  - No new third-party integrations unless the current phase needs them.
- **Leads, Conversations and Call Logs** use the **Perfox REST APIs** directly, when a screen needs the data:
  - No local copies, no 5-minute sync, no webhooks.
  - The API documentation and credentials will be provided at the integration stage.
- **Email:** Resend, behind a swappable email module.
- **File storage:** a folder on our own server, organised by purpose, with file paths saved in MongoDB. No S3 or Cloudinary.
- **Plivo and WhatsApp:** out of scope for now; discussed when we reach that stage.

---

## Phase 0: Planning and Setup

### 0.1 Scope and documents
- [x] Agree the simplified scope: the three AI jobs, the phase order and the modules in each phase
- [x] Agree the integration rules: Perfox REST for leads/conversations/calls, no background jobs, local file storage, Resend email, Plivo/WhatsApp deferred
- [x] Update **TRD.md** to the simplified architecture
- [x] Update **PRD.md** to the simplified scope:
  - [x] Remove radius search, the locations master, extra AI features, background sync and Plivo/WhatsApp features
  - [x] Settings grows per phase
- [ ] Decide when the public website is built (its own phase, or alongside Inventory)
- [ ] Agree the Definition of Done for every module (see the end of this file)

### 0.2 Wireframes (approve before building each phase)
- [x] Phase 1 wireframes ([phase-1.html](./wireframes/phase-1.html)): Login, Forgot/Reset password, Accept invite, Users & Roles, Invite/Edit user, My Profile, Settings → Company info
- [x] Phase 2 wireframes: Property list, Add/Edit property (category → subcategory attributes), Bulk import, Settings → Property types & amenities
- [ ] Phase 3 wireframes: Leads, Lead detail, Appointments calendar, Conversations, Call logs, Settings → Visit slots, Dashboard
- [ ] Public website wireframes: Home, Listing, Property details, Contact

### 0.3 Accounts and access
- [x] Perfox workspace available
- [ ] Code repository created and team access granted
- [ ] MongoDB: local (Docker) and a shared development database
- [ ] Resend account and API key (a verified sender domain is needed before real emails go out)
- [ ] Server for demos/staging, with disk space for the `uploads/` folder and backups that include it

---

## Phase 1: Foundation, Settings and User Management

### 1.1 Monorepo and tooling
- [x] Create a pnpm workspace with these packages:
  - [x] `apps/api`
  - [x] `apps/admin`
  - [x] `apps/web` (empty until the website phase)
  - [x] `packages/shared`
- [x] Set up shared tooling:
  - [x] TypeScript config
  - [x] ESLint and Prettier
  - [x] Editor settings
- [x] Set up the shared package for code used by both API and UI:
  - [x] Zod schemas: common ones (id, email, password, phone, pagination); module schemas added with each module
  - [x] Shared types and constants
  - [x] Roles and permissions list
  - [x] Formatting helpers: INR price, area units
  - [x] Phone helper (normalise to +91 E.164, display format)
- [x] Docker Compose for local MongoDB
- [x] Environment variable template (`.env.example`)
- [x] Startup validation of environment variables
- [x] README with setup and run instructions
- [x] CI pipeline: install → lint → type check → test → build

### 1.2 Backend foundation (`apps/api`)
- [x] Express app skeleton:
  - [x] Module folder layout (model, schema, service, controller, routes, tests)
  - [x] Config loader
  - [x] `GET /health`
- [x] MongoDB connection (Mongoose), with index sync on start-up
- [x] Standard response format `{ data, meta }` and error format `{ error: { code, message, details, requestId } }`
- [x] Central error handler, plus a 404 handler
- [x] Request validation with Zod
- [x] OpenAPI generation from Zod schemas; Swagger UI at `/api/docs`
- [x] Logging with request IDs (phone numbers and tokens masked)
- [x] Security middleware:
  - [x] Helmet
  - [x] CORS for the admin and website origins
  - [x] Request body size limits
  - [x] Rate limiting (in-memory) on auth routes (login and reset 10/min, forgot password 5/hour per IP)
- [x] Pagination, sorting and filtering helpers
- [x] Audit fields (`createdBy`, `updatedBy`, timestamps) and a simple `changeLogs` collection for important changes
- [x] **Storage module** (`lib/storage`):
  - [x] `StorageProvider` interface and `LocalStorageProvider`
  - [x] `uploads/` root from `UPLOAD_DIR`; folders by purpose (`company/logo`, `properties/<code>/images`, `properties/<code>/documents`, `imports/<batchId>`)
  - [x] Generated file names; MIME, extension and size whitelist (multer)
  - [x] Store relative paths in MongoDB; build URLs with `publicUrl()`
  - [x] Serve public folders under `/uploads` (static, with cache headers); keep `imports/` private
  - [x] `uploads/` git-ignored
- [x] **Email module** (`lib/email`):
  - [x] `EmailProvider` interface
  - [x] `ResendProvider` (`RESEND_API_KEY`, `EMAIL_FROM`)
  - [x] `ConsoleProvider` for local development
  - [x] Provider chosen by `EMAIL_PROVIDER`
  - [x] Email layout in code (invite / reset templates are added in 1.5 and 1.3)
  - [x] Send failures are logged and reported to the admin (no background retries)
- [x] Seed script: first Super Admin, default company info

### 1.3 Authentication
- [x] `users` model (UUID v7 ids): name, email (unique), phone, role, status (invited / active / inactive), password hash, last login, failed attempts, locked until
- [x] Password hashing (argon2id)
- [x] Login: issues an access token, plus a refresh token stored as an httpOnly cookie
- [x] Token refresh with rotation and reuse detection, and logout (revokes the refresh token)
- [x] `GET /auth/me` (current user and permissions)
- [x] `authTokens` model for invite and reset links (hashed, single-use, expiring)
- [x] Forgot password: reset link emailed through the email module
- [x] Reset password: validate the token, set a new password, revoke all sessions
- [x] Lock the account after repeated failed logins; unlock after a set time
- [x] Unlock by Super Admin
- [x] Session timeout after 30 minutes of inactivity: enforced by the server on refresh
- [x] Session timeout in the admin UI (signs out after 30 minutes idle, message on the login page)

### 1.4 Roles and permissions
- [x] Three fixed roles defined in code: Super Admin, Admin, Sales Agent
- [x] Permission strings per module (e.g. `users:manage`, `settings:edit`, `properties:write`)
- [x] Middleware that checks permissions on protected routes (`authenticate` + `requirePermission`)
- [ ] "Own data only" rule for Sales Agents (used for appointments in Phase 3)
- [x] Permission list exposed to the UI through `/auth/me`
- [x] Admin UI hides menus the user can't use, and shows a 403 page for blocked routes

### 1.5 Users & Roles module
- [x] **API**
  - [x] List users with search, role and status filters, and pagination
  - [x] Invite user: name, email, phone and role; send the invite email (Resend) with an expiring link
  - [x] Resend invite
  - [x] Accept invite: set password and activate
  - [x] Edit user: name, phone, role
  - [x] Deactivate and reactivate (never hard-delete)
  - [x] Admin-triggered password reset email
  - [x] Unlock a locked account
  - [x] Safety rules: users can't deactivate or demote themselves, and there must always be one active Super Admin
  - [x] Read-only roles and permission matrix endpoint
- [x] **UI**
  - [x] Users list: table, search, filters, status chips, last login
  - [x] Invite user drawer, with validation
  - [x] Edit user drawer, with deactivate, reactivate, reset password and unlock actions
  - [x] Accept-invite page (set password)
  - [x] Read-only role permission table
  - [x] Confirmation dialogs for destructive actions

### 1.6 My Profile
- [x] API: view and update own name and phone; change password (requires the current password; signs out other devices, keeps this one signed in; sends a "password changed" email)
- [x] UI: profile page reached from the top-bar user menu

### 1.7 Settings → Company info
- [x] **API**
  - [x] `settings` document (`key: 'company'`):
    - [x] Logo, company name, short description
    - [x] Office address (optional office map pin)
    - [x] One phone number and one email (alternate phone, WhatsApp number and enquiry notification emails removed, as agreed)
  - [x] Logo upload through the storage module (`uploads/company/logo/`), replacing the old file (PNG/JPG/WebP up to 2 MB, checked by file content; remove logo too)
  - [x] Change log entry on update
- [x] **UI**
  - [x] Settings page with the top navbar (only Company info in this phase; later tabs shown greyed out)
  - [x] Company info form: logo upload with preview, contact details, save, "last updated by"
  - [x] Sidebar shows the company logo and name

### 1.8 Admin UI foundation (`apps/admin`)
- [x] Vite + React + TypeScript project with routing (React Router, Tailwind, shadcn/ui on Base UI)
- [x] API client with token refresh handling (access token in memory, refresh cookie, one shared refresh); TanStack Query for data fetching and caching
- [x] Admin layout:
  - [x] Sidebar navigation grouped by module (later phases shown greyed out)
  - [x] Top bar with the user menu
  - [x] Content area (mobile: slide-in menu)
- [x] Protected routes and role-based menus
- [x] Login, Forgot password and Reset password pages (connected to the API)
- [x] Accept invite page (signs the user in after setting a password)
- [ ] Shared UI components:
  - [x] Button, input
  - [x] Select
  - [x] Textarea (Company info)
  - [ ] Checkbox (added with the forms that need it)
  - [x] Form field with error message, password field with show/hide, password rules checklist
  - [x] Data table (paginate, empty, loading and error states)
  - [x] Drawer (sheet) and modal
  - [x] Toast notifications
  - [x] Confirmation dialog
  - [x] Tabs, status chip
  - [x] Settings navbar, file upload with preview (with Company info in 1.7)
- [x] Form handling with shared Zod schemas (same validation as the API)
- [x] Error pages: 403 (no permission), 404, generic error
- [x] Responsive layout (usable on tablet and mobile)
- [x] Light and dark themes (Light / Dark switch in the account menu, remembered per browser; dark palette with orange accent)

### 1.9 Phase 1 testing and demo
- [x] Unit tests: password rules, token handling, permission checks
- [x] API integration tests:
  - [x] Auth flows, users CRUD, safety rules, company info
  - [x] Logo upload (temporary upload folder)
  - [x] Emails sent through a fake provider
- [ ] Postman collection generated from the OpenAPI spec, with tests passing (not needed for now, as agreed; the API is covered by the integration tests and the live spec at `/api/docs`)
- [x] UI checks: login, invite, accept invite, edit user, role-based menus, company info (component tests)
- [x] Demo checklist (checked manually):
  - [x] Log in as each role
  - [x] Invite a user (email arrives) and accept the invite
  - [x] Change a role
  - [x] Deactivate a user
  - [x] Reset a password
  - [x] Edit company info and logo
- [x] Collect feedback and fix the agreed items

---

## Phase 2: Inventory Management

### 2.1 Settings → Property types & amenities
Category (Residential / Commercial / Other) → subcategory (e.g. Villa / House) → attributes. **Residential first**, then Commercial; Other stays "set up later".

**Categories & attributes (Residential)**
- [x] **API**
  - [x] Attribute library (`propertyAttributes`): name, key (made from the name, never changes), value type (text, long text, number, yes/no, dropdown, multi-select, date), unit, options, search filter
  - [x] `propertyCategories`: Residential active, Commercial and Other inactive; common attributes per category
  - [x] `propertySubcategories`: name, code prefix, allowed purposes (Sale / Rent / Lease), active, order, own attributes
  - [x] Core attributes on every property, required and locked: property name, purpose, price, area, location
  - [x] Add a new or existing attribute to common or a subcategory; edit (name, type, options apply everywhere it is used; "required" per place); delete from one place
  - [x] Add / edit / delete subcategories (delete only without properties)
  - [x] Rules:
    - [x] No duplicate attribute names; an attribute is either common or in a subcategory, never both
    - [x] Code prefix is 3 letters, unique, and locked once the subcategory has properties
    - [x] An attribute's value type is locked once properties have values for it
    - [x] Deleting an attribute keeps the values properties already have
    - [x] A category can't be changed until it's set up (now only Other)
  - [x] Starting Residential setup created on first start (Plot 7, Villa / House 8, Apartment / Flat 11 attributes; common: facing, ownership type, description); never re-adds what an admin deleted
  - [x] Every change recorded in the change log
  - [ ] Hook the property rules to real property counts (with 2.2)
- [x] **UI**
  - [x] Settings navbar: "Property types & amenities" tab
  - [x] "Categories & attributes" sub-tab: category cards, subcategory cards, common attributes (locked core rows), the selected subcategory's attributes
  - [x] Add / edit attribute drawer: "add to" place, value type, unit, options, required, search filter; offers to reuse an existing attribute with the same name
  - [x] Add / edit subcategory drawer (name, code prefix, purposes, active, delete)
  - [x] Delete confirmation
- [x] Tests: API (rules and permissions), shared schemas, page (add, reuse, edit, delete, add subcategory)

**Amenities (Residential)**
- [x] **API**
  - [x] `amenities` model: name (unique per category), icon (fixed icon set), for all subcategories or chosen ones, active, order
  - [x] Add, edit, reorder, delete (delete only when no property has it ticked; otherwise deactivate)
  - [x] Deleting a subcategory takes it off amenities; Other can't be changed yet
  - [x] 14 starting Residential amenities, added once (also to existing databases) and never re-added after a delete
- [x] **UI**
  - [x] "Amenities" sub-tab (`/settings/property-types/amenities`): category cards, search, subcategory filter, table with order arrows, icon, "offered for", used by, Edit / Delete
  - [x] Add / edit amenity drawer: name, icon picker, all or chosen subcategories, active
- [x] Tests: API (rules, seed, permissions), page (filter, reorder, add, delete)

**Sign-off and later in 2.1**
- [x] Residential sign-off: starting attributes and amenities checked manually, working fine
- [ ] "Attributes added during property creation" review ("New" tag), with the property form (2.3)
- [x] **Commercial** (started 15 Nov 2026)
  - [x] Starting setup: Office space (OFC), Shop / Showroom (SHP), Commercial land (CLD), Warehouse / Godown (WHS); common facing, ownership type, description; 12 new attributes (office fit-out, cabins, workstations, washrooms, frontage, ceiling height, main road facing, suitable for, land use, loading docks, truck access, power load) plus shared ones
  - [x] 12 Commercial amenities; 5 new icons (parking, air conditioning, cafeteria, conference room, truck)
  - [x] Applied once to existing databases (marker per category), Residential untouched
  - [x] Property form: changing the category clears the subcategory and amenities
  - [x] Tests: API (setup, upgrade of an older database, commercial property, commercial template) and browser E2E (settings, add, publish, import, list, detail)
  - [ ] Commercial sign-off by the client (attributes and amenities checked)
- [ ] Other: subcategories, attributes and amenities, when the client asks

### 2.2 Properties: data and API
**2.2a Data and API**
- [x] `properties` model on category → subcategory → attributes:
  - [x] Property code per subcategory prefix (`RE-VIL-000031`), from atomic counters; never changes
  - [x] Property name, purpose (allowed by the subcategory), price (amount, basis, negotiable, on request), rent / lease details
  - [x] Area (value, unit, auto-converted to sq.ft)
  - [x] Location typed by the admin: state, city, area / locality, pincode, address, landmark; optional map pin
  - [x] Attribute values (common + subcategory) checked against their types and options; "this property only" attributes
  - [x] Amenities offered for the subcategory; media list (uploads in 2.2b)
  - [x] Status: Draft, Published, Unpublished, Booked, Sold, Rented, Leased, Archived; featured flag
- [x] Indexes for the list filters: status, subcategory, city, locality, pincode, price, amenities, updated date
- [x] API: create (as Draft), get, edit (only what is sent), archive, duplicate (new Draft, no photos)
- [x] API: list with search (code, name, city, locality, pincode), filters (category, subcategory, purpose, city, locality, pincode, price range, status, featured), sorting and pagination; status counts for the tabs
- [x] API: location suggestions (existing values, most used first) for consistent spelling
- [x] API: status changes with the lifecycle rules (closing status matches the purpose); bulk status change, with a reason for each failure
- [x] API: change the subcategory (code kept; values outside it kept but hidden; amenities it doesn't offer dropped)
- [x] Publish rules: price or "on request", area, city / locality / pincode, required attributes, at least one photo; a published property stays complete
- [x] Change history per property (from `changeLogs`), with who and when
- [x] Property-type rules switched on: prefix lock, subcategory and amenity delete blocks, attribute type lock
- [x] Tests: value rules (unit) and the API (create, validation, permissions, edit and history, publish, statuses, bulk, list and filters, suggestions, duplicate)

**2.2b Media**
- [x] Storage: local server storage for now (`uploads/properties/<code>/images|videos|documents`) through the storage module; Cloudinary later, when credentials are provided
- [x] Upload one file per request: photos (JPG / PNG / WebP, 10 MB), videos (MP4 / WebM, 50 MB), floor plans (image or PDF, 20 MB), brochures / documents (PDF, 20 MB); the real file type is checked from its content
- [x] Photos resized with sharp during upload: large (2000 px), medium (1200 px) and thumbnail (400 px) WebP; camera rotation applied, location metadata dropped
- [x] First photo becomes the cover; set cover, reorder, delete (removes all sizes; the next photo becomes the cover)
- [x] A published property keeps at least one photo; archived properties are locked
- [x] Property responses list the files with URLs; the list shows the cover thumbnail
- [x] Tests: sizes and formats, type and size checks, cover, reorder, delete, publish with a real photo

### 2.3 Properties: UI
- [x] Sidebar: "Inventory → Properties" for every role that can view properties; Admins and Sales Agents now land on Properties after sign-in
- [x] Property list:
  - [x] Table with cover photo, name, code, subcategory, purpose, city / area / pincode, price, area, status, featured star, updated date
  - [x] Status tabs with counts; search (code, name, area, pincode), subcategory, purpose, city (suggestions), price range, sort, featured; all kept in the URL
  - [x] Row menu: view, edit, duplicate as draft, change status / restore; bulk "Change status…" with a reason for each property that couldn't change
  - [x] Sales Agents: list and details only (no selection, add or edit)
- [x] Add / Edit property form (wireframe layout):
  - [x] Property type: category cards (Residential; others "set up later") and subcategory cards; "Change subcategory…" when editing, with a warning about details that will be hidden
  - [x] Common details: property name, purpose (only those the subcategory allows), price with ₹ preview, negotiable, price on request, rent / lease deposit and lock-in, area with unit and sq.ft equivalent, the category's common attributes
  - [x] Location: city, locality and pincode with suggestions from existing properties
  - [x] "Full address, landmark & map pin" opens and closes (closed, it summarises what was entered; "Clear" empties it): state, landmark, full address and an interactive OpenStreetMap map that finds the typed city / area / pincode; click to drop the pin, drag to adjust; latitude, longitude and the nearest address are shown; "Fill empty fields from pin"
  - [x] Subcategory details built from its attributes (text, number, yes / no, dropdown, multi-select, date); ✕ removes an optional attribute from this property only, with "Restore"
  - [x] "+ Add attribute": only this property, or all properties of the subcategory (added in Settings; offers to reuse an existing one)
  - [x] Photos, floor plans, brochures, documents and videos: drop or pick, upload progress, cover, reorder, delete (after the first save)
  - [x] Amenities as tap-to-select chips (only those offered for the subcategory)
  - [x] Side panel: status, featured, "Ready to publish" checklist from the API; Save draft, Save changes, Save & publish
- [x] Property detail: photos, price, key facts, description, details, rent details, amenities, status, location with map, documents and videos; Change status, Duplicate, Edit
- [x] Change history tab: who, when and what changed, in words
- [x] Unsaved-changes warning (leaving the page or closing the tab); field errors from the form and from the API shown next to the field
- [x] Tests: list (counts, bulk change, Sales Agent view), Add property (validation, values sent, API field errors); browser walkthrough of add → photos → publish → detail → history → list → bulk

### 2.4 Bulk Import (Excel)
- [x] **API** (all processing inside the request, no background jobs; at most 2,000 rows / 10 MB)
  - [x] Excel template per subcategory: core columns plus its attributes, amenities and image links; dropdowns for fixed values (hidden Lists sheet); an Instructions sheet with an example per column
  - [x] Upload .xlsx: saved to `uploads/imports/` (not public); columns matched by name; each row checked like Add property, with messages naming the column
  - [x] Duplicates within the file and against existing properties (subcategory + locality + pincode + plot number or name)
  - [x] Review results stored on the import batch: valid / invalid / duplicate counts and row-level errors
  - [x] Import valid rows as Draft or Published (rows not ready to publish stay Draft, with the reason); skip or update duplicates (an update changes only the filled cells; Published applies to new rows and drafts, a Sold, Booked or Unpublished status is kept); runs once per file; each row keeps its outcome
  - [x] Error report: the rows to fix with an "Errors" column, through an authenticated download
  - [x] Photos from an "Image URLs" column (public https only, private networks refused, size and time limits), downloaded during the import
  - [ ] Photos as a ZIP file (later, if needed)
  - [x] Import history: who, when, file, results
- [x] **UI** (`/imports`, sidebar "Inventory → Bulk Import" for roles with imports:run; "Bulk import" button on the property list)
  - [x] Step 1: choose a subcategory, download its template
  - [x] Step 2: upload the file (drop or pick), with progress
  - [x] Step 3: review counts, rows by status (invalid / duplicates / valid), unknown columns, error report
  - [x] Step 4: import options and confirm, then the result summary and a link to the properties
  - [x] Import history table with error report links; each import can be reopened
- [x] Tests: template, checking, duplicates, import as Draft / Published, update duplicates, error report, wrong files, permissions, photo links (API); safe download rules (unit); review and import (UI); browser walkthrough template → fill → upload → review → error report → import → list → history

### 2.5 Phase 2 testing and demo
- [ ] Unit tests: area conversion, price formatting, property code generation, dynamic field validation, Excel row validation
- [ ] API integration tests:
  - [ ] Groups and fields rules
  - [ ] Property CRUD and status flow, filters
  - [ ] Media upload and delete (temporary upload folder)
  - [ ] Import flow
- [ ] Postman collection updated, with tests passing
- [ ] UI checks: create group → add property with an extra field → publish → filter → import
- [ ] Demo checklist:
  - [ ] Create a group and its fields
  - [ ] Add a villa with photos and an extra field, and publish it
  - [ ] Import plots from Excel, review the errors and import
  - [ ] Filter and search the property list
- [ ] Collect feedback and fix the agreed items

---

## Phase 3: Leads, Appointments, AI Agent, Conversations and Call Logs

### 3.1 Perfox REST integration setup
- [ ] Receive the Perfox API documentation and credentials
- [ ] Confirm the endpoints and fields for customers (leads), conversations and call logs
- [ ] Perfox client in the API:
  - [ ] Bearer auth, timeout
  - [ ] Error mapping to `502 UPSTREAM_ERROR`
  - [ ] Limited retry on 429 within the same request
- [ ] Optional short in-memory cache for list calls (no Redis)
- [ ] Mocked Perfox responses for tests

### 3.2 Leads (customers), from the Perfox REST API
- [ ] **API** (calls Perfox when requested; nothing stored or synced locally)
  - [ ] Leads list: paging, search and filters as supported by the Perfox API
  - [ ] Lead detail: profile, plus linked appointments from our database (matched by Perfox customer ID / phone)
  - [ ] Decide stages, agent assignment and notes based on what the Perfox API supports
- [ ] **UI**
  - [ ] Leads list (table, search, filters)
  - [ ] Lead detail page with appointments, conversations and calls for that customer
  - [ ] Clear "Perfox unavailable" message when the API can't be reached

### 3.3 Settings → Visit slots
- [ ] **API**
  - [ ] `settings` document (`key: 'visitSlots'`): working days, start/end time, slot length, maximum visits per slot, minimum notice, booking window
  - [ ] Blocked dates and holidays (all properties or specific ones)
- [ ] **UI**
  - [ ] Settings navbar gains the "Visit slots" tab
  - [ ] Visit slots form and blocked dates table

### 3.4 Appointments (schedule, reschedule, cancel)
- [ ] **API**
  - [ ] `appointments` model:
    - [ ] Code, property, assigned agent
    - [ ] Customer (Perfox customer ID, name, phone, email)
    - [ ] Date/time
    - [ ] Status (Requested, Confirmed, Completed, No-show, Cancelled)
    - [ ] Source (AI / admin / website), history
  - [ ] Free-slot calculation (settings, blocked dates, existing bookings, capacity)
  - [ ] Book a visit, with a slot capacity check that can't double-book (`slotBookings`)
  - [ ] **Reschedule** a visit: check the new slot, free the old one, keep history
  - [ ] **Cancel** a visit: reason, free the slot, keep history
  - [ ] Confirm, complete, no-show; assign agent
  - [ ] Calendar endpoint (by day/week, filter by agent and property)
  - [ ] Sales Agents see only their own appointments
  - [ ] Email notifications (Resend) for booked, rescheduled and cancelled: to the customer when their email is known, and to the assigned agent
- [ ] **UI**
  - [ ] Appointments calendar (day/week) and list view
  - [ ] Appointment detail drawer: confirm, reschedule, cancel, complete, no-show, history
  - [ ] Book visit form (admin side): property, customer, free slot picker

### 3.5 MCP server for the AI agent (inside Express)
- [ ] `/mcp` endpoint following Perfox's "Build your own MCP server" pattern (JSON-RPC: `initialize`, `tools/list`, `tools/call`, `ping`)
- [ ] Bearer token authentication; rate limiting
- [ ] Read the caller's identity from Perfox request headers (name, phone, Perfox customer ID where available)
- [ ] Idempotency for book, reschedule and cancel (no duplicates on retries)
- [ ] Tools (published properties and public fields only, small results):
  - [ ] `search_properties`: location (city / area / pincode text match), group/type, purpose, budget range, size range
  - [ ] `get_property_details`: details of one property by code
  - [ ] `get_available_slots`: free visit slots for a property
  - [ ] `book_site_visit`: create the appointment
  - [ ] `reschedule_visit`: move the caller's existing appointment
  - [ ] `cancel_visit`: cancel the caller's existing appointment
- [ ] Callers can only see and change their own appointments
- [ ] Tool calls logged (tool, conversation ID, result)
- [ ] Tests for each tool: success, not found, invalid input, idempotent retry

### 3.6 Perfox AI agent setup
- [ ] Add the Perfox API key and MCP token to server configuration
- [ ] Property Assistant agent:
  - [ ] Instructions limited to the three jobs
  - [ ] Never invent details
  - [ ] Hand over to staff when it can't answer
- [ ] Connect the agent to our MCP server (URL and bearer token)
- [ ] Test channel: Perfox web chat (WhatsApp and phone are deferred)
- [ ] End-to-end conversation tests:
  - [ ] Search
  - [ ] Property details
  - [ ] Book
  - [ ] Reschedule
  - [ ] Cancel
  - [ ] Unknown property
  - [ ] Nothing found

### 3.7 Conversations, from the Perfox REST API
- [ ] **API:** list (filters as supported by Perfox), detail, transcript, each loaded from Perfox when requested
- [ ] **UI:**
  - [ ] Conversation list with filters
  - [ ] Conversation detail with chat transcript (including which tools the AI used) and the linked appointment

### 3.8 Call logs, from the Perfox REST API
- [ ] **API:** list, detail, recording links (fetched fresh each time, since they expire), each loaded from Perfox when requested
- [ ] **UI:**
  - [ ] Call log list with filters
  - [ ] Call detail with recording player and transcript

### 3.9 Dashboard
- [ ] Summary cards:
  - [ ] Properties by status (our database)
  - [ ] Upcoming visits (our database)
  - [ ] Leads, conversations and calls (live from Perfox)
- [ ] Today's and upcoming appointments list
- [ ] Sales Agents see their own appointments only

### 3.10 Phase 3 testing and demo
- [ ] Unit tests: slot calculation, reschedule/cancel rules, slot capacity
- [ ] API integration tests: appointments (including concurrent booking), MCP tools, Perfox-backed endpoints with mocked responses
- [ ] AI conversation test set in Perfox web chat: search, details, book, reschedule, cancel, edge cases; no invented details
- [ ] Postman collection updated, with tests passing
- [ ] Demo checklist:
  - [ ] Customer in Perfox web chat searches "plots in Tambaram under ₹50 L"
  - [ ] Asks about one property, then books a visit
  - [ ] Reschedules the visit, then cancels it
  - [ ] The booking appears in Appointments
  - [ ] The customer appears in Leads, and the chat appears in Conversations (from Perfox)
- [ ] Collect feedback and fix the agreed items

---

## Phase 4: Public Website (placement to be confirmed)

### 4.1 Website foundation (`apps/web`)
- [ ] Vite + React + TypeScript project, routing, layout (header, footer from Company info)
- [ ] Public API endpoints (published properties only): list, details, groups and filters, company info
- [ ] SEO:
  - [ ] Page titles and descriptions
  - [ ] Share previews
  - [ ] Structured data
  - [ ] Sitemap generated on request and cached in memory (no cron)

### 4.2 Pages
- [ ] Home: search bar (location, group, purpose, budget), featured properties, browse by category, contact strip
- [ ] Property listing: filters from group fields, sorting, pagination, property cards
- [ ] Property details:
  - [ ] Gallery
  - [ ] Price, area, location, group fields, amenities, legal
  - [ ] Map pin if set
  - [ ] Enquiry and book-visit actions
- [ ] Contact and About pages
- [ ] Enquiry form and book-visit form, with consent checkbox (OTP channel to be decided)
- [ ] Privacy policy and terms pages

### 4.3 Website testing
- [ ] Responsive checks (mobile first)
- [ ] Accessibility checks
- [ ] Page speed checks
- [ ] Enquiry and booking flows create appointments correctly

---

## Deferred Integrations (discuss when we reach that stage)

- [ ] **Plivo:** phone channel for the AI agent
- [ ] **WhatsApp:** WhatsApp channel for the AI agent; WhatsApp confirmation messages
- [ ] **Reminder call before the visit:** needs Plivo, plus a way to trigger it at the right time without background workers
- [ ] **SMS** confirmations and OTP for website forms

---

## Definition of Done (every module)

- [ ] Wireframe approved
- [ ] API endpoints documented in Swagger, with request/response examples
- [ ] Input validation and clear error messages
- [ ] Permission checks applied and tested per role
- [ ] Unit and integration tests written and passing
- [ ] Postman collection updated, with tests passing
- [ ] UI matches the approved wireframe and works on desktop and mobile
- [ ] Loading, empty and error states handled in the UI
- [ ] No background jobs, sync processes or unapproved third-party services added
- [ ] Code reviewed and merged
- [ ] Demoed and feedback recorded
