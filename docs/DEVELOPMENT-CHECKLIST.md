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
- [ ] Phase 2 wireframes: Property list, Add/Edit property (group-based fields), Bulk import, Settings → Property types & amenities
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
- [ ] Unit tests: password rules, token handling, permission checks
- [ ] API integration tests:
  - [ ] Auth flows, users CRUD, safety rules, company info
  - [ ] Logo upload (temporary upload folder)
  - [ ] Emails sent through a fake provider
- [ ] Postman collection generated from the OpenAPI spec, with tests passing
- [ ] UI checks: login, invite, accept invite, edit user, role-based menus, company info
- [ ] Demo checklist:
  - [ ] Log in as each role
  - [ ] Invite a user (email arrives) and accept the invite
  - [ ] Change a role
  - [ ] Deactivate a user
  - [ ] Reset a password
  - [ ] Edit company info and logo
- [ ] Collect feedback and fix the agreed items

---

## Phase 2: Inventory Management

### 2.1 Settings → Property types & amenities
- [ ] **API**
  - [ ] `fieldDefinitions` model (field library shared by groups):
    - [ ] Label, key, type (number, text, dropdown, multi-select, yes/no, date)
    - [ ] Unit, options
    - [ ] Visibility (public or internal)
  - [ ] `propertyGroups` model:
    - [ ] Name, category (Residential / Commercial / Other)
    - [ ] Allowed purposes (Sale / Rent / Lease)
    - [ ] Code prefix, icon, active, order
    - [ ] Fields with order, required, website filter, show on card, hidden
  - [ ] Group CRUD; add a new or existing field to a group; reorder, hide and edit fields
  - [ ] Rules:
    - [ ] A field used by properties can't be deleted (only hidden)
    - [ ] A field's key is locked once used
    - [ ] A group's code prefix is locked after its first property
  - [ ] "Fields added during property creation" list for admin review
  - [ ] `amenities` model and CRUD: name, icon, applicable groups, active
  - [ ] Seed the starting groups and fields (Residential Plot, Villa / House, Apartment / Flat, Commercial Plot, Commercial Space, Warehouse, Agricultural Land, Industrial Land) and the starting amenities
- [ ] **UI**
  - [ ] Settings navbar gains the "Property types & amenities" tab
  - [ ] "Groups & fields" sub-tab:
    - [ ] Group list by category
    - [ ] Group details form
    - [ ] Fields table
    - [ ] Add-field drawer: use an existing field, or create a new one
    - [ ] Live form preview
    - [ ] Review banner for newly added fields
  - [ ] "Amenities" sub-tab: table plus add/edit panel

### 2.2 Properties: data and API
- [ ] `properties` model:
  - [ ] Property code (auto-generated per group, e.g. `RE-VIL-000031`), title, description, group, category, purpose
  - [ ] Price (amount, basis, negotiable, on request); rent details for rent/lease
  - [ ] Area (value, unit, auto-converted to sq.ft)
  - [ ] Location fields entered by the admin: state, city, area/locality, pincode, address, landmark; optional map pin for directions
  - [ ] Group field values; "this property only" extra fields
  - [ ] Amenities, media (relative file paths), legal (RERA / approval numbers)
  - [ ] Status: Draft, Published, Unpublished, Booked, Sold, Rented, Leased, Archived; featured flag
- [ ] Counters for property codes
- [ ] Indexes for search and filters: status, group, city, area, pincode, price, area, text search
- [ ] Validation of group field values against the group's fields
- [ ] API: create, get, update, archive, duplicate
- [ ] API: list with search (code, title, location), filters (group, category, purpose, city, area, pincode, price range, status, featured), sorting and pagination
- [ ] API: location suggestions (existing city / area / pincode values) for consistent spelling
- [ ] API: status changes, with history; bulk status change for selected rows
- [ ] API: add a field during creation, with "add to group" or "this property only"
- [ ] API: change the group of an existing property (fields outside the new group are kept but hidden; returns a warning)
- [ ] Change history per property (from `changeLogs`)
- [ ] Media through the storage module:
  - [ ] Multipart upload to `uploads/properties/<code>/images` or `/documents`
  - [ ] Image resizing with sharp during upload (thumbnail and medium, WebP)
  - [ ] Reorder, set cover, delete (removes the files)
- [ ] Publish rules: required fields filled, at least one image

### 2.3 Properties: UI
- [ ] Property list:
  - [ ] Table with cover image, code, title, group, purpose, city/area, price, status, featured, updated date
  - [ ] Search and filter bar, saved filter in the URL
  - [ ] Row actions and bulk actions
- [ ] Add/Edit property form:
  - [ ] Basic info, with the property group select (category fills in automatically)
  - [ ] Price and area, with unit conversion and INR formatting (₹45 L / ₹1.25 Cr)
  - [ ] Location fields (state, city, area, pincode, address, landmark), with suggestions; optional map pin
  - [ ] Group details section built from the selected group's fields
  - [ ] Extra fields on this property; "+ Add a field that isn't listed" with the add-to-group choice
  - [ ] Photos, videos and documents, with upload progress, drag to reorder and set cover
  - [ ] Amenities checklist (filtered by group)
  - [ ] Legal details
  - [ ] Status and visibility side panel; save draft, publish
- [ ] Property detail/preview view
- [ ] Change history view
- [ ] Unsaved-changes warning; field-level validation messages

### 2.4 Bulk Import (Excel)
- [ ] **API** (all processing inside the request, no background jobs; at most 2,000 rows / 10 MB)
  - [ ] Download an Excel template per group:
    - [ ] Common columns plus the group's fields
    - [ ] Dropdowns for fixed values
    - [ ] Instructions sheet and a sample row
  - [ ] Upload .xlsx: save to `uploads/imports/<batchId>/` and validate each row:
    - [ ] Required fields
    - [ ] Types and allowed values
    - [ ] Positive price and area
    - [ ] Unit conversion
  - [ ] Duplicate detection: within the file, and against existing properties
  - [ ] Review results: valid / invalid / duplicate counts, plus row-level errors (stored on the import batch)
  - [ ] Commit: import valid rows as Draft or Published; skip or update duplicates
  - [ ] Error report (original rows plus an "Errors" column), downloaded through an authenticated endpoint
  - [ ] Images: image URL column (downloaded during commit) or a ZIP of files named by property code
  - [ ] Import history: who, when, file, results
- [ ] **UI**
  - [ ] Step 1: choose a group, download its template
  - [ ] Step 2: upload the file, show progress
  - [ ] Step 3: review screen with counts, error rows and duplicate choices
  - [ ] Step 4: import options and confirm, then the result summary
  - [ ] Import history table with error report links

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
