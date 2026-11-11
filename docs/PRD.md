# Product Requirements Document (PRD)
## AI-Powered Real Estate Management Platform

| Field | Value |
|---|---|
| Document | Product Requirements Document |
| Version | 2.0 (Draft): simplified scope, phased delivery |
| Related documents | [TRD.md](./TRD.md) · [DEVELOPMENT-CHECKLIST.md](./DEVELOPMENT-CHECKLIST.md) |
| Status | For review |

**What changed in 2.0:**
- The AI agent is limited to three jobs.
- Delivery is split into phases, with a demo and feedback after each one.
- Leads, conversations and call logs come from the Perfox REST API.
- Property locations are the plain fields entered on each property. There is no locations master and no radius search.
- Property types are now "groups" with their own fields.
- Settings grows phase by phase.
- Plivo, WhatsApp and reminder calls are deferred.
- Lead Analytics is removed.

---

## 1. Background

The client owns many properties: residential plots, agricultural and industrial land, independent houses, villas, apartments and commercial spaces. Today enquiries and site visits are handled by phone and in person, and there is no central record of properties or appointments.

We will build a **real estate management platform** made up of:

1. An **Admin Portal** where the client's team manages users, settings, properties (manually or by Excel import) and site-visit appointments, and views leads, AI conversations and call logs from Perfox.
2. An **AI agent (Perfox)** that talks to customers and does three jobs:
   - Answers questions about property details.
   - Searches properties by the customer's requirements (location, property type, budget).
   - Schedules, reschedules and cancels site visits or meetings.
3. A **Public Website** where customers browse properties (its phase is to be confirmed).

The AI agent gets all property information from **our database** through our MCP tools, so it only ever answers with data the admin has entered.

---

## 2. Goals

- One place where the client's team manages every property, with details, photos, documents and location.
- Fast data entry: add a property manually in a few minutes, or import many at once from Excel.
- Customers get correct, instant answers from the AI agent, based only on real property data.
- Site visits are booked, rescheduled and cancelled without staff effort, and every booking is visible to the team.
- Build step by step: each phase is finished, demoed and reviewed before the next begins.

**Success measures:**

| Measure | Target |
|---|---|
| Properties managed in the system | 100% of the client's available inventory |
| Time to add a property manually | ≤ 5 minutes |
| Excel import | 100 properties imported with clear error reporting for bad rows |
| AI answers | Only verified data from our database; no invented details in test conversations |
| AI bookings | Book, reschedule and cancel all work end to end in test conversations |

---

## 3. Scope

### 3.1 Delivery phases

| Phase | Modules |
|---|---|
| **Phase 1: Settings & User Management** | Login and password flows, Users & Roles, My Profile, Settings → Company info |
| **Phase 2: Inventory Management** | Properties (add, edit, list, filters, status), Bulk Import (Excel), Settings → Property types & amenities |
| **Phase 3: Leads, Appointments & AI** | Leads (from Perfox), Appointments (schedule, reschedule, cancel), Settings → Visit slots, MCP tools and Perfox AI agent, Conversations (from Perfox), Call Logs (from Perfox), Dashboard |
| **Phase 4: Public Website** (placement to be confirmed) | Home, property listing, property details, about, contact, enquiry and book-visit forms |

Each phase ends with a demo to the client's management and users. Their feedback is handled before the next phase starts.

### 3.2 Deferred (discussed when we reach that stage)
- **Plivo:** phone channel for the AI agent.
- **WhatsApp:** WhatsApp channel for the AI agent, and WhatsApp messages.
- **Reminder call before the visit:** needs Plivo.
- **SMS** confirmations and OTP for website forms.

### 3.3 Out of scope
- Lead Analytics page.
- Radius / "within X km" search, location master data, geocoding and maps services.
- Our own copy or sync of Perfox data (leads, conversations, calls).
- Customer Portal (customer login, saved properties).
- Online payments or booking-amount collection.
- Third-party sellers or brokers listing properties. The client is the only owner of all listings.
- Native mobile apps. The admin portal and website are responsive.

---

## 4. Users and roles

| Role | Who | What they do |
|---|---|---|
| **Customer** | People chatting with the AI agent (later: website visitors) | Ask about properties, search, book / reschedule / cancel visits |
| **Super Admin** | Client owner / IT | Full access, including users and roles |
| **Admin** | Client office staff | Manage settings, properties, imports and appointments; view leads, conversations and calls |
| **Sales Agent** | Client field staff who host site visits | View properties; see and manage only their own appointments |

### 4.1 Permission matrix

| Module | Super Admin | Admin | Sales Agent |
|---|---|---|---|
| Users & Roles | ✅ | ❌ | ❌ |
| Settings | ✅ | ✅ | ❌ |
| Properties: view | ✅ | ✅ | ✅ |
| Properties: create / edit / publish / archive | ✅ | ✅ | ❌ |
| Bulk Import | ✅ | ✅ | ❌ |
| Appointments | All | All | Own only |
| Leads, Conversations, Call Logs | ✅ | ✅ | View (scope depends on Perfox data, decided in Phase 3) |
| Dashboard | Full | Full | Own appointments |

---

## 5. Property model (business view)

### 5.1 Property groups
A **group** is a kind of property with its own set of fields. Admins manage groups in **Settings → Property types & amenities** (Phase 2). When an admin adds a property, they pick a group, and the form shows only that group's fields.

| Category | Starting groups | Purposes allowed |
|---|---|---|
| Residential | Residential Plot, Villa / House, Apartment / Flat | Plot: Sale, Lease. Villa / House, Apartment: Sale, Rent, Lease |
| Commercial | Commercial Plot, Commercial Space, Warehouse | Plot: Sale, Lease. Others: Sale, Rent, Lease |
| Other | Agricultural Land, Industrial Land | Sale, Lease |

**Group and field rules:**
- Admins can add groups and add, reorder or hide fields at any time, without code changes.
- One field can be shared by several groups (e.g. "Facing" in Plot, Villa and Apartment). It then works the same everywhere.
- Each field has:
  - Label and type (number, text, dropdown, multi-select, yes/no, date).
  - Unit, options and whether it's required.
  - Whether it's a website filter and whether it shows on the property card.
  - Visibility: **public** (website and AI) or **internal** (admin only).
- A field already used by properties can't be deleted, only hidden, so no data is lost.

### 5.2 Starting fields per group (editable by admins)

| Group | Fields |
|---|---|
| Residential Plot | Length, breadth, facing, road width, corner plot, boundary wall, plot number, layout name, approval type |
| Villa / House | Bedrooms, bathrooms, built-up area, floors, facing, car parking, furnishing, age of property |
| Apartment / Flat | BHK, bathrooms, floor number, total floors, carpet area, facing, furnishing, parking, lift, maintenance |
| Commercial Plot | Dimensions, road width, frontage, zoning, approval type |
| Commercial Space | Carpet area, floor number, furnishing, washrooms, parking, power backup, frontage |
| Warehouse | Built-up area, clear height, dock doors, floor load capacity, truck access, power (kVA) |
| Agricultural Land | Water source, soil type, road access, electricity, fencing |
| Industrial Land | Zoning, road width, power availability, water supply |

The client confirms the final field list at the start of Phase 2.

### 5.3 Common fields (every property)
- **Identity:** property code (automatic, e.g. `RE-VIL-000031`), title, description, group (category comes from the group), purpose.
- **Price:** amount (INR); basis (total / per sq.ft / per month); negotiable; "price on request". For rent and lease: monthly rent, security deposit, maintenance, lock-in period.
- **Area:** value and unit (sq.ft, sq.yd, sq.m, cent, ground, acre, hectare). The sq.ft equivalent is calculated automatically.
- **Location**, typed by the admin:
  - State, city, area/locality, pincode, full address, landmark.
  - The form suggests existing values, to keep spellings consistent.
  - An optional map pin, used for directions.
- **Media:** images (one is the cover), videos, floor plans, brochure (PDF).
- **Amenities:** chosen from the amenities list (filtered by group).
- **Legal:** RERA number, approval type, approval number.
- **Extra fields:** fields added for one property only.
- **Featured** flag.

### 5.4 Property status lifecycle

```
Draft ──► Published ◄──► Unpublished
              │
              ├──► Booked ──► Sold / Rented / Leased
              │
              └──► Archived
```
- Only **Published** properties are visible to the AI agent (and later the website).
- Every status change is recorded with user and time.
- Deleting a property archives it; nothing is permanently deleted.

### 5.5 Display rules
- Indian price format: ₹45 L, ₹1.25 Cr, ₹25,000/month.
- Area shown in the unit the admin entered, with the sq.ft equivalent where useful.
- Empty fields are hidden, never shown as "0" or "N/A".

---

## 6. Functional requirements: Admin Portal

Priority: **M** = Must, **S** = Should, **C** = Could.

### Phase 1

#### 6.1 Authentication
| ID | Requirement | Priority |
|---|---|---|
| ADM-AUTH-01 | Email + password login | M |
| ADM-AUTH-02 | Forgot password: reset link by email; reset sets a new password and signs out all sessions | M |
| ADM-AUTH-03 | Accept invite: an invited user sets a password from the email link | M |
| ADM-AUTH-04 | Menus and actions follow the user's role (§4.1) | M |
| ADM-AUTH-05 | Lock the account for 15 minutes after 5 failed logins; Super Admin can unlock | S |
| ADM-AUTH-06 | Sign out automatically after 30 minutes of inactivity | S |

#### 6.2 Users & Roles
| ID | Requirement | Priority |
|---|---|---|
| ADM-USR-01 | User list: name, email, phone, role, status (Invited / Active / Inactive / Locked), last login; search and filters | M |
| ADM-USR-02 | Invite user: name, email, phone, role; invite email with an expiring link; resend invite | M |
| ADM-USR-03 | Edit user: name, phone, role | M |
| ADM-USR-04 | Deactivate and reactivate users (never permanently deleted) | M |
| ADM-USR-05 | Send a password reset email; unlock a locked account | M |
| ADM-USR-06 | Safety rules: users can't deactivate or demote themselves; there is always at least one active Super Admin | M |
| ADM-USR-07 | Read-only table showing what each role can do | S |

#### 6.3 My Profile
| ID | Requirement | Priority |
|---|---|---|
| ADM-PRF-01 | View and edit own name and phone | M |
| ADM-PRF-02 | Change own password (current password required); confirmation email | M |

#### 6.4 Settings → Company info
| ID | Requirement | Priority |
|---|---|---|
| ADM-SET-01 | Company info: logo, company name, short description, office address (optional map pin), one phone number, one email | M |
| ADM-SET-02 | Settings page uses a top navbar. Tabs are added per phase: Company info (Phase 1), Property types & amenities (Phase 2), Visit slots (Phase 3) | M |

### Phase 2

#### 6.5 Settings → Property types & amenities
| ID | Requirement | Priority |
|---|---|---|
| ADM-SET-03 | Groups & fields: list groups by category; add/edit a group (name, category, purposes, code prefix, icon, active) | M |
| ADM-SET-04 | Manage a group's fields: add a new field or reuse an existing one, reorder, hide, edit (rules in §5.1) | M |
| ADM-SET-05 | Live preview of how the group's section looks in the Add Property form | S |
| ADM-SET-06 | Review list of fields added while creating properties | S |
| ADM-SET-07 | Amenities: name, icon, applicable groups, active | M |

#### 6.6 Properties
| ID | Requirement | Priority |
|---|---|---|
| ADM-PROP-01 | Property list: cover image, code, title, group, purpose, city/area, price, status, featured, updated date | M |
| ADM-PROP-02 | Search by code, title or location; filter by group, category, purpose, city, area, pincode, price range, status, featured | M |
| ADM-PROP-03 | Add/Edit property: pick a group, and the form shows that group's fields, with validation | M |
| ADM-PROP-04 | Add a missing field during creation; choose **add to the group** (all future properties) or **this property only** | M |
| ADM-PROP-05 | Location fields typed by the admin (state, city, area, pincode, address, landmark), with suggestions from existing values; optional map pin | M |
| ADM-PROP-06 | Upload images, videos, floor plans and brochures; drag to reorder; set cover | M |
| ADM-PROP-07 | Save as Draft, Publish, Unpublish; mark Booked, Sold, Rented, Leased; Archive | M |
| ADM-PROP-08 | Publish requires all required fields and at least one image | M |
| ADM-PROP-09 | Mark or unmark Featured | S |
| ADM-PROP-10 | Change a property's group (fields outside the new group are kept but hidden, with a warning) | S |
| ADM-PROP-11 | Duplicate a property as a new draft | S |
| ADM-PROP-12 | Bulk actions on selected rows: publish, unpublish, archive, change status | S |
| ADM-PROP-13 | Change history (who, what, when) | S |

#### 6.7 Bulk Import (Excel)
| ID | Requirement | Priority |
|---|---|---|
| ADM-IMP-01 | Download an Excel template **per group**: common columns + the group's fields, dropdowns for fixed values, instructions sheet, sample row | M |
| ADM-IMP-02 | Upload a filled template (.xlsx, up to 2,000 rows) | M |
| ADM-IMP-03 | Validate every row: required fields, types, allowed values, positive price and area | M |
| ADM-IMP-04 | Detect duplicates within the file and against existing properties | M |
| ADM-IMP-05 | Review screen: valid / invalid / duplicate counts and row-level errors | M |
| ADM-IMP-06 | Import valid rows as Draft or Published; skip or update duplicates | M |
| ADM-IMP-07 | Download an error report (original rows plus an "Errors" column) | M |
| ADM-IMP-08 | Images by URL column, or a ZIP of files named by property code | S |
| ADM-IMP-09 | Import history: who, when, file, results | M |

### Phase 3

#### 6.8 Settings → Visit slots
| ID | Requirement | Priority |
|---|---|---|
| ADM-SET-08 | Working days, day start/end, slot length, maximum visits per slot, minimum notice, booking window | M |
| ADM-SET-09 | Blocked dates and holidays (all properties or a specific property) | M |

#### 6.9 Appointments
| ID | Requirement | Priority |
|---|---|---|
| ADM-APT-01 | Calendar (day/week) and list views of site visits | M |
| ADM-APT-02 | Create an appointment: property, customer (name, phone, email), free slot, assigned agent, notes | M |
| ADM-APT-03 | Statuses: Requested → Confirmed → Completed / No-show / Cancelled | M |
| ADM-APT-04 | **Reschedule** an appointment (keeps history) | M |
| ADM-APT-05 | **Cancel** an appointment with a reason | M |
| ADM-APT-06 | A slot can never be booked beyond its capacity | M |
| ADM-APT-07 | Filters: date, status, property, agent, source (AI / admin / website) | M |
| ADM-APT-08 | Sales Agents see and manage only their own appointments | M |
| ADM-APT-09 | Email notification (booked / rescheduled / cancelled) to the customer when their email is known, and to the assigned agent | S |

#### 6.10 Leads (from Perfox)
| ID | Requirement | Priority |
|---|---|---|
| ADM-LEAD-01 | Leads list read live from the Perfox REST API, with search and filters as the API supports | M |
| ADM-LEAD-02 | Lead detail: customer details from Perfox, plus that customer's appointments from our system | M |
| ADM-LEAD-03 | Stages, agent assignment and notes, **if supported by the Perfox API** (confirmed from the API docs) | S |

#### 6.11 Conversations (from Perfox)
| ID | Requirement | Priority |
|---|---|---|
| ADM-CONV-01 | Conversations list read live from Perfox, with filters as the API supports | M |
| ADM-CONV-02 | Conversation detail: transcript, the tools the AI used (e.g. "booked visit"), and the linked appointment | M |

#### 6.12 Call Logs (from Perfox)
| ID | Requirement | Priority |
|---|---|---|
| ADM-CALL-01 | Call list read live from Perfox: date/time, customer, duration, status | M |
| ADM-CALL-02 | Call detail: recording player (fresh link each time) and transcript | M |

#### 6.13 Dashboard
| ID | Requirement | Priority |
|---|---|---|
| ADM-DASH-01 | Property counts by status | M |
| ADM-DASH-02 | Today's and upcoming appointments | M |
| ADM-DASH-03 | Leads, conversations and calls counts (live from Perfox) | S |

---

## 7. Functional requirements: AI Agent (Perfox), Phase 3

### 7.1 Channel
- **During development: Perfox web chat**, for testing.
- WhatsApp and phone are added later (deferred, §3.2). The AI's behaviour and tools stay the same on every channel.

### 7.2 The three jobs

| ID | Job | What the AI does | MCP tool(s) |
|---|---|---|---|
| AI-01 | **Answer property details** | Answers questions about a property (price, size, location, fields, amenities, legal) | `get_property_details` |
| AI-02 | **Search properties** | Finds published properties by location (area / city / pincode), group/type, purpose and budget (and size) | `search_properties` |
| AI-03 | **Schedule visits** | Shows free slots and books a visit; **reschedules** or **cancels** the customer's existing visit | `get_available_slots`, `book_site_visit`, `reschedule_visit`, `cancel_visit` |

**Location search:** the customer's words (e.g. "Tambaram", "Chennai", "600045") are matched against the area, city and pincode the admin entered on each property.

### 7.3 Accuracy rules (must not be broken)
1. The AI answers **only** from data returned by our MCP tools.
2. If information is missing, it says so and offers to have the team call back. It **never** guesses prices, sizes, approvals or availability.
3. It never shares unpublished properties, internal fields, other customers' data or staff phone numbers.
4. It never promises discounts or legal outcomes.
5. For anything outside the three jobs, it politely says it can't help and offers to pass the request to the team.

### 7.4 Booking rules
- Before booking, rescheduling or cancelling, the AI reads back the property, date and time and gets a clear "yes".
- A customer can only reschedule or cancel **their own** appointment (matched by phone number).
- Web-chat bookings are created as **Requested**, because the phone number is typed by the customer. An admin confirms them. When the WhatsApp and phone channels are added, bookings from those channels can be created as **Confirmed**.
- A retry never creates a second booking.

---

## 8. Functional requirements: Public Website (Phase 4, placement to be confirmed)

| ID | Requirement | Priority |
|---|---|---|
| PW-01 | Responsive layout; header and footer use Company info | M |
| PW-02 | Home: search (location, group, purpose, budget), featured properties, browse by category | M |
| PW-03 | Property listing: filters (including group fields marked as website filters), sorting, pagination | M |
| PW-04 | Property details: gallery, price, area, location, public group fields, amenities, legal, map pin if set | M |
| PW-05 | Enquiry and book-visit forms with consent checkbox (verification method to be decided) | M |
| PW-06 | About, Contact, privacy policy and terms pages | M |
| PW-07 | Search-engine friendly pages and share previews | S |

---

## 9. Key user flows

### 9.1 Invite a staff member (Phase 1)
1. A Super Admin opens Users & Roles → **Invite user**, enters name, email, phone and role.
2. The person receives an invite email and sets a password.
3. They sign in and see only the menus their role allows.

### 9.2 Add a property (Phase 2)
1. An admin clicks **Add property** and picks the group "Villa / House".
2. They fill in the common fields, then the villa fields that appear.
3. A field is missing ("Solar panels"), so they add it and choose **add to the group**.
4. They upload photos and publish. The property is now available to the AI agent.

### 9.3 Bulk import (Phase 2)
1. The admin downloads the template for "Residential Plot" and fills in 150 rows.
2. After upload, the system shows 142 valid, 5 invalid (with reasons) and 3 duplicates.
3. The admin imports the valid rows as Draft, skips the duplicates and downloads the error report.

### 9.4 Customer searches and books through the AI (Phase 3)
1. Customer: *"Do you have residential plots in Tambaram under ₹50 L?"*
2. The AI calls `search_properties` and presents 2–3 matches with real details.
3. Customer: *"Tell me more about the second one."* The AI calls `get_property_details` and answers.
4. Customer: *"Can I visit on Saturday?"* The AI shows free slots, reads back the details and books after a "yes".
5. The appointment appears in Appointments. The conversation appears in Conversations, and the customer in Leads (both from Perfox).

### 9.5 Customer reschedules or cancels (Phase 3)
1. Customer: *"I need to move my Saturday visit to Sunday."*
2. The AI finds the customer's appointment, shows Sunday's free slots and reschedules after a "yes".
3. Or: *"Please cancel my visit."* The AI confirms and cancels it, and the slot becomes free again.

---

## 10. Notifications

Email only for now, sent through Resend.

| Event | Recipient |
|---|---|
| User invited | Invited user |
| Password reset requested | User |
| Password changed | User |
| Visit booked / rescheduled / cancelled (Phase 3) | Customer (when their email is known) and the assigned agent |

WhatsApp and SMS notifications are deferred (§3.2).

---

## 11. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Admin pages respond quickly; property search API under 300 ms for typical queries |
| Scale | At least 10,000 properties and 50 concurrent admin users |
| Responsiveness | Admin portal usable on tablet and mobile (360 px and up) |
| Browser support | Latest 2 versions of Chrome, Edge, Safari, Firefox |
| Security | HTTPS, role-based access, secure password storage, account lockout, secrets never exposed to browsers |
| Files | Uploaded files stored on our server, organised by purpose; included in backups |
| Data | Daily database backups; time zone Asia/Kolkata; phone numbers stored as +91… |
| Simplicity | No background jobs, data-sync processes or unapproved third-party services |
| Localisation | English UI; text kept in one place so translation is possible later |

---

## 12. Compliance

- **DPDP Act 2023:** collect only necessary personal data; consent checkbox on website forms (Phase 4); support deletion requests.
- **AI disclosure:** when voice channels are added, the AI says the customer is speaking with an AI assistant.
- **RERA:** show the RERA number on properties where it applies.
- SMS (DLT) and WhatsApp template rules apply when those channels are added.

---

## 13. Assumptions and dependencies

| # | Item | Status |
|---|---|---|
| D-1 | Perfox workspace | Available |
| D-2 | Perfox REST API documentation and credentials, for leads, conversations and call logs | To be provided by the client at Phase 3 |
| D-3 | Resend account and a verified sender domain for emails | To set up in Phase 1 |
| D-4 | A server for demos/staging, with disk space for uploaded files and backups | To confirm before the Phase 1 demo |
| D-5 | Property data (existing spreadsheet), photos, company content and logo | Client, by Phase 2 |
| D-6 | Plivo credentials | Available; integration deferred |

---

## 14. Open questions

| # | Question | Owner |
|---|---|---|
| Q-1 | When is the public website built: after Phase 2, or as Phase 4? | Client |
| Q-2 | Which lead features are needed (stages, assignment, notes), and does the Perfox API support them? | Client / Tech (Phase 3) |
| Q-3 | Final field list for each property group | Client (start of Phase 2) |
| Q-4 | Format of the client's existing property data | Client |
| Q-5 | How many sales agents, and do they host visits? | Client |
| Q-6 | AI languages: English only, or also Tamil / Hindi? | Client |
| Q-7 | Should Sold / Rented properties be hidden or shown with a badge (website)? | Client |
| Q-8 | Verification method for website forms (Phase 4) | Client / Tech |

---

## 15. Glossary

| Term | Meaning |
|---|---|
| Group | A kind of property (e.g. Villa / House) with its own set of fields |
| Field | One piece of property information (e.g. Facing, Road width); can be shared by several groups |
| Lead | A customer who has contacted the business; stored in Perfox |
| Appointment / Site visit | A scheduled visit by a customer to a property; stored in our system |
| Perfox | The AI agent platform that talks to customers |
| MCP tools | The secure connector through which the Perfox AI reads property data and books, reschedules and cancels visits in our system |
| DPDP | India's Digital Personal Data Protection Act, 2023 |
| RERA | Real Estate Regulatory Authority registration |
