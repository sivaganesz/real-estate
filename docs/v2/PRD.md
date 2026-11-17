# Product Requirements Document (PRD) — v2
## Real Estate Specification & Lead Management Platform

| | |
|---|---|
| **Version** | 2.1 (draft for team approval) |
| **Date** | 17 November 2026 (2.0: 16 November 2026) |
| **Status** | Draft. Review with the team before development starts |
| **Replaces** | `docs/PRD.md` (v1) for every module listed here. v1 stays in the repository for history |
| **UI reference** | Approved wireframe: `spec-system-wireframe/` (branch `spec-system-wireframe`, commit `80209dc`), demoed to the team on 16 Nov 2026 |
| **Business reference** | `spec-system-wireframe/docs/Real_Estate_Specification_System_Project_Spec.pdf` |
| **Companion documents** | `docs/v2/TRD.md` (technical design) · `docs/v2/DEVELOPMENT-CHECKLIST.md` (build plan) |

> **Changed in 2.1 (17 Nov 2026, owner's decision):** the add / edit property form follows the wireframe layout exactly (§6.11: PROP-59, 61, 62 rewritten). Photos move to the property page's **Media** tab, and road type, road width and the map pin to its **Location** tab (PROP-09, PROP-22). Fields the system needs that the wireframe form does not show (pincode, price options, rent deposit and lock-in, area unit, featured) stay in section 1 in the same style; "+ Add attribute" (§6.4) stays.

> **How to read this document.** Each requirement has an ID (e.g. `PROP-12`) used in the TRD and the checklist. **Priority:** **M** = must have in that release, **S** = should have, **C** = could have. **Release** says when it is built (§3). Each screen requirement names the wireframe screen it must follow. Decisions that still need the team's confirmation are marked **⚑** and listed in §20.

---

## 1. Background

The business sells and lets plots, flats, houses, villas and commercial property in Tamil Nadu (Madurai, Chennai, Coimbatore, Tiruchirappalli and others). The goal is more than a listing website. The platform should understand:

1. **what is being sold**: accurate, type-specific property specifications with evidence;
2. **what it is worth**: price per sq.ft. backed by comparable properties, without unsupported claims;
3. **what each customer needs**: purpose, budget range, requirements, timeline and funding;
4. **how ready each customer is**: qualification and lead priority;

and use that to **match the right property to the right customer** and help the sales team convert enquiries.

**Core principle.** A high-budget customer is not automatically a high-net-worth individual (HNI), and an expensive property is not automatically a high-value investment. Property value, customer purchasing capacity and sales priority are **separate assessments** and are never merged into one number.

### 1.1 What already exists

The admin portal built in v1 (`apps/admin`, `apps/api`, `packages/shared`) already provides:
- **Foundation:** sign-in, sessions, invites, password reset, Users & Roles, My Profile, and Settings → Company info.
- **Settings → Property types & amenities:** configurable categories, subcategories and attributes.
- **Properties:** list, add/edit form, media, map pin, detail page, history and statuses.
- **Bulk import:** from Excel.

All of it is tested: 256 automated tests pass. The technical review (TRD §1) concluded that we **keep and improve** this code base rather than start again. v2 therefore:
- **keeps** what already works and matches the wireframe's intent;
- **re-styles** every screen to the approved wireframe's layout and visual design;
- **adds** what the wireframe introduced (legal verification, honest location data, valuation, delete with safety rules, new statuses, customers, the lead pipeline and the later modules).

---

## 2. Goals and success measures

| # | Goal | Measure (first 3 months after each release) |
|---|---|---|
| G1 | Every listed property has a complete, type-specific specification | ≥ 90% of Available properties have no publish issues and all mandatory legal checks recorded (any status) |
| G2 | Property claims are honest and defensible | 0 listings show “100% legally clear”, unverified distances or planned infrastructure as existing (enforced by the system) |
| G3 | Faster listing of inventory | A property can be added by form in under 5 minutes; 500 properties can be imported in one Excel upload |
| G4 | No lead is lost or forgotten (from R3) | 100% of active leads have an owner and a next follow-up date (when consent exists); leads stuck more than 14 days are visible on the dashboard |
| G5 | Better recommendations (from R5) | Every recommendation shows its fit score and reasons; no property with open mandatory legal checks is ever the top recommendation |
| G6 | Privacy by design | Follow-ups only with recorded consent; no sensitive financial documents collected during lead generation; HNI data visible to managers only |

---

## 3. Scope and releases

The team agreed to build **Properties**, then **Bulk Import**, then the **Lead Pipeline**, and to review each module with the team before starting the next. Later modules follow the order of the specification's implementation phases.

| Release | Content | Status |
|---|---|---|
| **R0 Foundation** | Auth, Users & Roles, My Profile, Settings → Company info, Settings → Property types & amenities | ✅ Built (v1). Restyled in R1 |
| **R1 Properties v2** | Role management (three default roles and custom roles, §4.2). Module A: property list, add/edit form, detail tabs (Specifications, Location, Legal & documents, Pricing & valuation, Media, History), new statuses, archive/delete, attribute-from-form confirmation | **Next** |
| **R2 Bulk Import v2** | Wizard aligned with the wireframe, update by property code, new fields and statuses, legal rule | After R1 sign-off |
| **R3 Lead Pipeline** | Module B basics (customer record, purpose, budget, requirements, consent) + Module E pipeline (Kanban, stages, lost reasons, follow-ups, activity timeline, assignment) | After R2 sign-off |
| R4 Qualification & enquiry | Module C: BANT, purchase readiness score, classification; public enquiry form | Proposed order ⚑ |
| R5 Matching | Module D: matching engine, recommendations, “Matching customers” tab | Proposed |
| R6 Appointments | Teams-style calendar, booking, clash checks, outcomes | Proposed |
| R7 Dashboard & Reports | Sales dashboard, funnel, stuck leads, source/purpose/lost reports, executive performance | Proposed |
| R8 HNI assessment | Restricted, consent-based HNI qualification | Proposed |
| R9 AI integration | AI assistant: initial questions, explaining specifications, call preparation (Perfox/MCP or other, to be decided) | Later ⚑ |

**Deferred / out of scope for now:** the public property website (placement to be decided), WhatsApp/SMS/phone integrations, a customer self-service portal, payments, document e-signing, a native mobile app, and customer bulk import (⚑).

---

## 4. Users and roles

There are **three default roles** (confirmed, D4). Only the Admin can add more roles (§4.2).

| Role | Who | Main work |
|---|---|---|
| **Admin** | Owner / office administrator | Everything: users, roles, settings, properties, bulk import, archive/delete, all leads, HNI, reports |
| **Sales Manager** (new) | Sales head | All leads, pipeline, reassignment, sales rules, HNI (restricted), reports, property archive/delete |
| **Sales Executive** (was “Sales Agent”) | Field / tele sales | View properties; manage **own** leads, follow-ups and appointments |
| *Custom roles* | Created by the Admin when needed (for example “Office staff”, “Channel partner coordinator”) | Any combination of the permissions in §4.1, except managing users and roles |
| *Customer* | Buyer / tenant / investor | Submits an enquiry (R4). Never signs in to the admin portal |

The v1 roles map as follows: Super Admin → **Admin**, Admin → **Admin**, Sales Agent → **Sales Executive** (ROLE-10).

### 4.1 Permission matrix (defaults)

| Capability | Admin | Sales Manager | Sales Executive |
|---|:-:|:-:|:-:|
| Users & Roles (invite users, create/edit/delete roles) | ✅ (Admin only, can't be granted) | ❌ | ❌ |
| Settings → Company, Property types, Legal checklists, Valuation costs | ✅ | ❌ | ❌ |
| Settings → Sales rules (scoring weights, bands, thresholds, executives) | ✅ | ✅ | read only |
| Properties: view | ✅ | ✅ | ✅ |
| Properties: create, edit, change status, legal, valuation | ✅ | ❌ | ❌ |
| Properties: archive / restore | ✅ | ✅ | ❌ |
| Properties: delete (rules in §6.9) | ✅ | ✅ | ❌ |
| Add an attribute to global settings from the property form | ✅ | ❌ | ❌ |
| Bulk import | ✅ | ❌ | ❌ |
| Leads / customers (R3) | all | all | own |
| Reassign leads | ✅ | ✅ | ❌ |
| HNI assessment (R8) | ✅ | ✅ | ❌ (sees “Restricted”) |
| Appointments (R6) | all | all | own |
| Dashboard & reports (R7) | full | full | own figures |

The Admin can change the Sales Manager and Sales Executive permissions, and can reset them to these defaults (ROLE-05).

### 4.2 Role management (R1.0)

| ID | Requirement | Pri |
|---|---|---|
| ROLE-01 | Three **system roles** are created by the system: Admin, Sales Manager, Sales Executive. They can't be renamed or deleted | M |
| ROLE-02 | **Admin** always has every permission, and its permissions can't be edited. There must always be at least one active Admin: the last one can't be deactivated or moved to another role | M |
| ROLE-03 | **Only the Admin** manages users and roles. These two permissions are reserved for the Admin role and can't be given to any other role, so no other role can raise its own access | M |
| ROLE-04 | **Create role** (Users & Roles → Roles → “＋ New role”):<br>• name (unique, not case-sensitive) and description;<br>• “Start from”: blank or a copy of an existing role;<br>• permissions picked from the fixed list, grouped by module, as the same matrix as §4.1;<br>• for leads/customers, appointments and reports, a scope choice: None / Own / All;<br>• sensitive permissions (HNI, delete, bulk import) are marked and show a warning when ticked | M |
| ROLE-05 | **Edit role**: custom roles fully; Sales Manager and Sales Executive permissions only (not name), with “Reset to defaults”. Saving shows a confirmation with the number of users affected. Changes apply to those users on their next action, without signing them out | M |
| ROLE-06 | **Delete role**: custom roles only, with confirmation. If users still have the role, the dialog asks the Admin to move them to another role first | M |
| ROLE-07 | Admins can't invent permissions: the list is defined by the product and grows with each release. A new permission is off for custom roles until the Admin turns it on. For system roles it follows the defaults in §4.1 | M |
| ROLE-08 | **Roles screen**: a list of roles with type (System / Custom), number of users and last change. The permission matrix shows one column per role. The role picker in Invite user / Edit user lists all roles | M |
| ROLE-09 | Every role change (created, permissions changed, deleted, user moved) is recorded in the change log: who, when, before and after | M |
| ROLE-10 | **Migration** of existing users: Super Admin → Admin, Admin → Admin, Sales Agent → Sales Executive. The v1 office Admins gain user management. The Admin reviews the user list after the migration and can move them to a custom role if needed | M |

---

## 5. Product-wide rules

| ID | Rule |
|---|---|
| GEN-01 | Every property and customer has a **system-generated unique ID**. Never rely on names. Properties: `RE-<3-letter subcategory prefix>-000001` (existing format, unchanged). Customers: `CUST-000001`. |
| GEN-02 | **Three separate assessments**: property fit score, purchase readiness score, HNI verification status. HNI is a status, never a score. |
| GEN-03 | **Honest claims.** Never “100% legally clear” (§6.6). Never present unverified distances or planned/proposed infrastructure as existing (§6.5). Never call a price a “bargain” (§6.7). |
| GEN-04 | **Consent before follow-up.** No follow-up can be scheduled without recorded consent. Withdrawing consent clears pending follow-ups. |
| GEN-05 | **Collect only what is needed.** No bank statements, tax returns or account balances during lead generation. |
| GEN-06 | **No bias.** No points or classification from name, appearance, occupation, caste, religion or other personal characteristics. |
| GEN-07 | **Business rules are configurable.** Scoring points, weights, bands and thresholds are starting assumptions, editable in Settings (§15) and tuned with real results. |
| GEN-08 | **Nothing disappears silently.** Every create, edit, status change, archive, restore and delete is recorded in history / change logs with who and when. |
| GEN-09 | **Money and units.** Indian Rupees with Indian grouping (₹30,00,000; short forms ₹30 L / ₹1.2 Cr). Areas in sq.ft. by default, other units converted (sq.ft, sq.m, sq.yd, cent, acre, ground, hectare: existing). Dates shown as `16 Nov 2026`, in the Asia/Kolkata time zone. |
| GEN-10 | **UI follows the approved wireframe** in layout, components and visual style (§17), in light and dark themes. |

---

## 6. Module A — Properties (R1)

### 6.1 Property structure

Properties are configured, not hard-coded (existing model, kept):

- **Category → Subcategory → Attributes.**
  - Categories: **Residential** and **Commercial** (active). **Other** stays inactive with no property types; an Admin can activate it later.
  - Default property types (subcategories) come from the approved catalogue ([PROPERTY-CATALOGUE.md](PROPERTY-CATALOGUE.md)):
    - Residential: Residential plot `PLT`, Flat / Apartment `APT`, Independent house / Villa `VIL`.
    - Commercial: Office space `OFC`, Shop / Showroom `SHP`, Warehouse / Godown `WHS`, Commercial building `CBD`, Industrial shed `ISH`.
  - Admins can add more in Settings.
- **Core fields** are on every property, always required to publish, and locked: property name, purpose, price, area and location.
- **Common attributes** belong to a category; **subcategory attributes** belong to one subcategory. Attribute types are text, long text, number (with unit), yes/no, dropdown, multi-select, date and **month** (new: month and year).
- **Amenities** belong to a category and are offered for all of its subcategories or selected ones.

> ✅ **D2 (confirmed):** keep this configurable model, but **replace** the v1 types, attributes and amenities with the wireframe's catalogue. Attributes that suit every type are common; the rest are specific to each type (§6.3, [PROPERTY-CATALOGUE.md](PROPERTY-CATALOGUE.md)).

### 6.2 Main property information (every property)

| ID | Field | Rules | Pri |
|---|---|---|---|
| PROP-01 | Property code | Generated on first save from the subcategory prefix; never changes, even if the subcategory changes or the property is duplicated | M |
| PROP-02 | Property name (title) | 5–150 characters | M |
| PROP-03 | Category / subcategory | Picked first; drives the rest of the form. The subcategory can be changed later within the same category; values that no longer apply are hidden, not deleted | M |
| PROP-04 | Listing purpose | Sale, Rent or Lease; limited to the purposes the subcategory allows | M |
| PROP-05 | Price | Amount in ₹, basis (Total / Per sq.ft / Per month), Negotiable, Price on request. Rent/Lease add security deposit and lock-in months | M |
| PROP-06 | Area | Value + unit; stored also in sq.ft. Each subcategory defines **what the main area means** (Plot area, Built-up area, Super built-up area, Carpet area, Land area, Usable area). The label follows it, e.g. “Plot / land area (sq.ft.)” | M |
| PROP-07 | Price per sq.ft. | **Calculated** = total price ÷ area in sq.ft. (Sale with Total basis), shown with its basis, e.g. “₹2,333 / sq.ft. (plot area)” | M |
| PROP-08 | Facing | East, North, West, South, North-East, North-West, South-East, South-West (existing “Facing” attribute) | M |
| PROP-09 | Location | On the form (section 1): state, city/district and locality (with suggestions from existing values) and pincode. On the **Location tab** (PROP-22): full address, landmark, map pin (the map follows the typed address until a pin is dropped), and **road type and road width**, which are common to every property and asked only once, there | M |
| PROP-10 | Status and listing date | §6.8. Listing date = first time it became Available | M |
| PROP-11 | Featured flag | Existing | S |
| PROP-12 | Amenities | Checklist of the amenities offered for the subcategory | M |

### 6.3 Type-specific specifications (default attributes)

The form shows only the attributes of the chosen property type: a plot never asks for BHK and a flat never asks for a survey subdivision. The full list (names, types, options, units, filters) is in **[PROPERTY-CATALOGUE.md](PROPERTY-CATALOGUE.md)**, approved on 2026-11-16. In summary:

| Applies to | Attributes |
|---|---|
| **Every type (common)** | Facing, Description (plus road type and road width, stored with the location and edited on the Location tab, PROP-09) |
| Residential plot | Length, Width, Road access, Corner / non-corner, Topography, Survey number, Subdivision, Layout approval details, Land-use classification, Water supply, Electricity, Drainage |
| Flat / Apartment | BHK configuration, Carpet area, Super built-up area, Floor number, Total floors, Number of lifts, Parking allocation, UDS, Maintenance, Possession status, Expected possession (month) |
| Independent house / Villa | House or villa, Land area, Number of floors, Bedrooms, Bathrooms, Car parking, Construction year, Construction quality, Condition, Private garden / amenities, Water supply, Power arrangement, Approval & completion documents |
| All 5 commercial types | Floor, Frontage, Parking, Permitted usage, Occupancy status, Rental income, Lease duration, Lease terms, Maintenance, Operating expenses |

Water supply and Maintenance are each defined once and shared between types. Amenities are the wireframe's 12, mapped per category in the catalogue.

| ID | Requirement | Pri |
|---|---|---|
| PROP-13 | A new installation is seeded with the catalogue. On an installation that holds **test data only**, an explicit command (`pnpm db:reset-catalogue`, refused in production) removes the v1 types, attributes, amenities, properties, media and import batches, then seeds the catalogue. `pnpm seed:demo` loads the wireframe's 12 sample properties. Admins can still edit, remove or add attributes afterwards | M |
| PROP-14 | Optional attributes can be removed from one property only (“Remove from this property”), and restored | M (exists) |
| PROP-15 | “Only this property” extra attributes (text, long text, number, yes/no, date) | M (exists) |

### 6.4 Adding an attribute from the property form, with confirmation

The user asked for this explicitly: an attribute added from the property form must reach the **global settings only after confirmation**.

| ID | Requirement | Pri |
|---|---|---|
| PROP-16 | “＋ Add attribute” on the form opens a dialog: name, value type, unit/options, and **Add to**: “Only this property” (default) or “All properties under ‹Category› › ‹Subcategory›”. The second option needs the Settings permission | M |
| PROP-17 | If an attribute with the same or a similar name exists, the dialog lists it with “Use this instead” (prevents duplicates). Names are compared ignoring case and extra spaces | M |
| PROP-18 | **Confirmation step** for “All properties under…”: a second screen summarises the name, type, options, required flag and target subcategory, plus the impact (“will appear on every ‹Subcategory› property, N existing properties”). Nothing is saved globally until the user clicks **Confirm and add to settings**. Cancel returns to the dialog with the inputs kept | M |
| PROP-19 | Reusing an existing attribute for the subcategory (“Use for ‹Subcategory›”) also goes through the same confirmation | M |
| PROP-20 | After confirmation the attribute is added to the subcategory in Settings, tagged **“New — added from property ‹code›”** until an admin reviews it in Settings (Mark reviewed / Edit / Remove) | S |
| PROP-21 | “Only this property” attributes never touch global settings and need no confirmation | M |

### 6.5 Location (detail tab “Location”)

Wireframe: Properties → detail → **Location** tab.

| ID | Requirement | Pri |
|---|---|---|
| PROP-22 | Address and coordinates: state and district (shown; edited on the form), locality, pincode, full address, landmark, latitude/longitude (map pin, click or drag on the map), road type and road width (ft) | M |
| PROP-23 | Highway access: name, distance by road (km), and **how it was measured** (free text, e.g. “route driven 02 Nov 2026”) | M |
| PROP-24 | Nearby places table, with add and remove: category (School, Hospital, Bus stop, Railway station, Airport, Market, Other), name, **measured road distance (km)**, **Route checked** (yes/no), **Status** (Existing / Under construction / Planned / Proposed) | M |
| PROP-25 | Advertising rule per row: “OK to advertise” only when Existing **and** route checked; “Route not checked” and “Not an existing benefit” are warnings | M |
| PROP-26 | **Customer-facing preview** generated from the rules:<br>• “Nearby (measured by road)” lists only verified, existing places plus the highway;<br>• “Future infrastructure — not yet existing” lists planned and proposed items with their status;<br>• a note shows how many places are hidden until their route is checked | M |
| PROP-27 | Map card with the pin and an “Open in maps” link | M (exists) |

### 6.6 Legal & documents (detail tab “Legal & documents”)

Wireframe: **Legal & documents** tab.

| ID | Requirement | Pri |
|---|---|---|
| PROP-28 | Each subcategory has a **legal checklist template** (Settings, §15), with each check marked mandatory or optional. A new property gets the checklist of its subcategory. Changing subcategory merges the checklists and keeps existing checks | M |
| PROP-29 | Each check stores:<br>• **Status**, one of exactly three: **Not collected · Collected, pending verification · Verified by authorised legal professional**<br>• Verified by (only when verified)<br>• Date<br>• Linked document (a file in the property's media)<br>• Notes | M |
| PROP-30 | Uploading a document for a check sets it to **pending**, never to verified. Setting “verified” fills the date (today) and requires “Verified by”. Setting “not collected” clears the verifier, date and link | M |
| PROP-31 | Summary tiles: Verified n / total · Pending · Not collected · open mandatory checks. The list column and the detail header show “n/total verified” (amber when a mandatory check is open) | M |
| PROP-32 | Explanatory note: checks are **not interchangeable**, e.g. a DTCP/planning approval does not prove ownership | M |
| PROP-33 | **Customer-facing wording** is generated, e.g. “8 of 9 document checks verified by an authorised legal professional (latest 05 Nov 2026). 1 collected and pending verification.” The system never shows “100% legally clear” | M |
| PROP-34 | A property with an open **mandatory** check shows an amber banner. In matching (R5) it can only ever be a **Conditional match** | M |

Default legal checklists (⚑ D11, to be confirmed by the client's legal advisor):

| Check (what it verifies) | Residential plot | Flat / Apartment | House / Villa | All commercial types |
|---|:-:|:-:|:-:|:-:|
| Parent documents (ownership history) | ✓ | ✓ | ✓ | ✓ |
| Sale deed (current ownership and transaction) | **M** | **M** | **M** | **M** |
| Encumbrance Certificate (registered encumbrances in the searched period) | **M** | **M** | **M** | **M** |
| Patta / revenue records | ✓ | ✓ | ✓ | ✓ |
| FMB / survey records (boundaries, measurements) | ✓ | – | ✓ | – |
| Land-use classification (permitted use) | ✓ | – | – | ✓ |
| Layout approval (DTCP / CMDA / local body) | **M** | – | – | – |
| Building plan approval | – | **M** | **M** | **M** |
| Completion / occupancy certificate | – | ✓ | ✓ | ✓ |
| RERA registration (or exemption) | ✓ | **M** | – | – |
| Fire NOC (where applicable) | – | – | – | ✓ |
| Tax receipts (property tax / land revenue) | ✓ | ✓ | ✓ | ✓ |

These are the wireframe's checklists (M = mandatory).

### 6.7 Pricing & valuation (detail tab “Pricing & valuation”)

Wireframe: **Pricing & valuation** tab.

| ID | Requirement | Pri |
|---|---|---|
| PROP-35 | Asking price, area and **price review date**, editable on the tab. Price per sq.ft. is shown with its formula, e.g. “₹28,00,000 ÷ 1,200 = ₹2,333” | M |
| PROP-36 | **Comparable properties** (add/remove rows): location, type, area, ₹/sq.ft., **Asking or Transaction**, date, source, differences affecting price | M |
| PROP-37 | Value positioning, calculated:<br>• average comparable ₹/sq.ft.<br>• transaction-only average<br>• range (min–max)<br>• asking vs average (%)<br>• **neutral** position: “Within comparable range” / “Below comparable range — check for differences (access, approval, condition)” / “Above comparable range — justify with differences or review price” | M |
| PROP-38 | Bar chart: this property's ₹/sq.ft. against each comparable | S |
| PROP-39 | **Estimated transaction costs** = price × (stamp duty % + registration % + other %), from Settings; estimated all-in cost. Labelled as editable assumptions to confirm before quoting | M |
| PROP-40 | Valuation professional's report (text, and optionally a linked document) and valuation notes | M |
| PROP-41 | Never label a price a “bargain”. A fixed note explains comparing like with like in the same micro-market | M |

### 6.8 Property statuses

> ⚑ **D1 (recommended):** keep the existing draft → publish workflow, which controls what reaches customers, and adopt the wireframe's sales statuses. Rename “Published” to **Available** and “Unpublished” to **On hold**; add **Under negotiation** and **Reserved**.

| Status | Meaning | Visible to customers / matching |
|---|---|---|
| **Draft** | Being prepared; may be incomplete | No |
| **Available** | Complete and on the market (passes the publish checklist) | **Yes** |
| **Under negotiation** | A buyer is negotiating | No (matching: excluded ⚑ D12) |
| **Reserved** | Token or advance received, not yet booked | No |
| **Booked** | Booking completed | No |
| **On hold** | Taken off the market temporarily | No |
| **Sold / Rented / Leased** | Closed. Must match the purpose: sale → Sold, rent → Rented, lease → Leased | No |
| **Archived** | Hidden from lists and matching; data and links kept | No |

| ID | Requirement | Pri |
|---|---|---|
| PROP-42 | **Publish checklist** (existing, kept) before Draft → Available: price (or Price on request), area, city, locality, pincode, all required attributes, at least one photo. Missing items are listed in the side panel | M |
| PROP-43 | Allowed changes:<br>• Draft → Available, Archived<br>• Available → Under negotiation, Reserved, Booked, On hold, closed, Archived<br>• Under negotiation → Available, Reserved, Booked, On hold, closed, Archived<br>• Reserved → Available, Booked, closed, Archived<br>• Booked → Available, closed, Archived<br>• On hold → Available, Archived<br>• closed → Available (relist), Archived<br>• Archived → Draft (restore) | M |
| PROP-44 | Status can be changed from the detail header (dropdown limited to allowed statuses), the list row menu, and **bulk** on the list. Every change is logged | M |
| PROP-45 | Existing data is migrated: published → available, unpublished → on_hold | M |

### 6.9 Archive and delete

Wireframe: detail header buttons **🗄 Archive**, **🗑 Delete**, **↺ Restore**, with their confirmation dialogs.

| ID | Requirement | Pri |
|---|---|---|
| PROP-46 | **Archive** is always available (Admin and Sales Manager by default) and needs **confirmation**. The dialog:<br>• explains the effect: hidden from the list, matching and new bookings; data, history and customer links kept; can be restored;<br>• lists linked customers;<br>• warns about upcoming appointments for the property, which are **not** cancelled automatically;<br>• offers an optional reason (Sold outside the system, Withdrawn by owner, Listing expired, Duplicate listing, Other) | M |
| PROP-47 | Archiving records date, user and reason, shows an “Archived on … by …” banner, and adds a note to each linked customer's timeline | M |
| PROP-48 | **Restore** brings an archived property back as Draft (it must be re-published) and is logged | M |
| PROP-49 | **Delete** only when the property is **not linked to any customer**: no recommendation, site visit/appointment, negotiation, booking or match record. If linked, Delete is blocked; the dialog lists the linked customers and what links them, and offers **Archive instead** (opens the archive confirmation) | M |
| PROP-50 | When deletion is allowed, the confirmation states it **cannot be undone** and lists what will be removed (specification, location, legal checks, comparables, media, history). The user must tick “I understand that ‹code› will be permanently deleted”. Media files are removed from storage. A tombstone entry stays in the change log (code, title, who, when) | M |
| PROP-51 | Archived properties are hidden by default; the list filter offers Active properties / Archived only / Active + archived | M |
| PROP-52 | Until R3 there are no customer links, so Delete only checks the links that exist at that time. The rule must automatically include new link types as modules are added | M |

### 6.10 Properties list

Wireframe: **Properties** list.

| ID | Requirement | Pri |
|---|---|---|
| PROP-53 | Header: “Property specification database”, with buttons **＋ Add property** and **📥 Bulk import** (Bulk import right after Add property) | M |
| PROP-54 | Columns:<br>• Code<br>• Property (name; type · purpose; cover thumbnail)<br>• Location (locality; city)<br>• Area<br>• Asking price (short form + ₹/sq.ft.)<br>• **Legal checks** chip (n/total verified; amber when a mandatory check is open)<br>• Status chip (+ Archived)<br>• Listed / updated | M |
| PROP-55 | Filters:<br>• search (code, name, locality, city, pincode)<br>• type<br>• city<br>• status<br>• **legal** (Mandatory checks open / Mandatory checks verified)<br>• archive view<br>• purpose, price range, featured (existing)<br>• Clear filters<br>Filters are kept in the URL | M |
| PROP-56 | Sorting (recently updated, newest, price ↑↓, largest area), pagination (20 per page), a footer count (“n shown · n active · n archived”) | M |
| PROP-57 | Row click opens the detail page. Row menu: View, Edit, Duplicate as draft, Change status, Archive/Restore. Bulk: change status | M |
| PROP-58 | Empty, loading and error states as in the wireframe style | M |

### 6.11 Add / edit property form

Wireframe: **Add property** form with numbered sections. The form follows the wireframe layout (one card, the same sections, field order and wording); the few extra fields the system needs sit in section 1 in the same style.

| ID | Requirement | Pri |
|---|---|---|
| PROP-59 | Numbered sections, as in the wireframe:<br>**1 Main property information**: Property ID (“Auto: RE-PLT-…”), property title, property type (grouped by category), derived category, listing purpose, state, city/district, locality, **pincode**, facing, area (label from the type's main-area meaning, with unit), asking price (with basis), live ₹/sq.ft., property status, listing date; for rent and lease also security deposit and lock-in; checkboxes Price negotiable, Price on request, Featured listing; other common attributes (e.g. Description)<br>**2 Property-specific specifications** (a chip shows the type; optional fields can be removed from one property; “+ Add attribute”, §6.4)<br>**3 Features & amenities** (checkboxes)<br>**4** a note pointing to the Location, Legal & documents, Pricing & valuation and Media tabs<br>Photos are not on the form: they are added on the Media tab | M |
| PROP-60 | Changing the type swaps section 2's fields immediately without losing the main information. In edit mode, changing subcategory uses the existing “Change subcategory” dialog (warns which values will be hidden) | M |
| PROP-61 | New property: **Save property** creates it as a Draft (code assigned) and opens the Location tab. Edit (heading “Edit ‹title›”): **Save changes** (disabled when nothing changed). Cancel and Save stay in view at the bottom. Unsaved-change protection | M |
| PROP-62 | **Property status** and **listing date** are fields in section 1 (no side panel). The status list shows only the moves the rules allow (PROP-43); choosing Available runs the publish checklist on save and lists anything missing. A new property starts as Draft. The listing date is set the first time a property becomes Available and can then be corrected (logged). History is on the property page's History tab | M |
| PROP-63 | Field-level validation messages come from the shared rules; server errors are mapped back onto fields | M |

### 6.12 Property detail

Wireframe: property detail.

| ID | Requirement | Pri |
|---|---|---|
| PROP-64 | Header:<br>• type icon, name<br>• chips: code, category, type, purpose, status<br>• location line: locality, city, state · area · facing · listed date<br>• price and ₹/sq.ft. (with basis)<br>• actions: status dropdown, Edit, Archive, Delete (Restore when archived) | M |
| PROP-65 | Banners: archived (date, user, reason); open mandatory legal checks | M |
| PROP-66 | Tabs:<br>• **Specifications** (main information + type-specific + amenities)<br>• **Location**<br>• **Legal & documents** (with an n/total badge)<br>• **Pricing & valuation**<br>• **Matching customers** (from R5; hidden before)<br>• **Media** (photos with cover, floor plans, brochures, documents, videos)<br>• **History** (who, what, when, before → after) | M |
| PROP-67 | Tab edits on Location, Legal and Pricing save field by field (inline), each saved change is logged, and failures are shown inline without losing other edits | M |

### 6.13 Media (existing, kept)

Photos (JPG/PNG/WebP up to 10 MB; resized to thumbnail/medium/large WebP), videos (MP4/WebM up to 50 MB), floor plans, brochures and documents (PDF up to 20 MB), max 60 files per property, ordering, cover photo, drag and drop. **New:**
- a document can be linked to a legal check (PROP-29);
- deleting a file asks for confirmation;
- an optional caption per file. (PROP-68, S)

---

## 7. Module — Bulk Import (R2)

Wireframe: **Bulk import** (a four-step wizard). The existing Excel import is kept and aligned.

| ID | Requirement | Pri |
|---|---|---|
| IMP-01 | Steps: **1 Choose type & template → 2 Upload file → 3 Review & validate → 4 Import complete**, with a step indicator | M |
| IMP-02 | One template per subcategory (fields differ by type). The **.xlsx** template has:<br>• main columns + that subcategory's attributes<br>• dropdowns for fixed values<br>• an Instructions sheet<br>• a “Property code” column for updates<br>• optional image URL columns (max 5)<br>CSV is also accepted (⚑ D6). “Sample file” and “Try with sample data” are available | M |
| IMP-03 | The page shows the **template column guide**: column, field, required (for new rows), allowed values / format | M |
| IMP-04 | Upload by drag-and-drop or file picker. Limits: 10 MB, 2,000 rows. Wrong file type → clear message (“save as CSV UTF-8 / .xlsx”) | M |
| IMP-05 | Every row is validated before anything is saved:<br>• required fields for new rows<br>• numbers (Indian commas accepted: “33,00,000”)<br>• dates<br>• allowed values (case-insensitive)<br>• purposes allowed for the subcategory<br>• image URLs (https, public, size/type checked) | M |
| IMP-06 | Row results:<br>• **New**: blank code, creates a property<br>• **Update**: existing code; only the filled cells change<br>• **No change**: existing code, nothing different; skipped<br>• **Duplicate**: same subcategory, locality, pincode and plot number or name, either in the file or in the database<br>• **Error**<br>An unknown code, a code used twice in the file, a code of another subcategory, or an archived code (“restore it before updating”) is an **error** | M |
| IMP-07 | Warnings that don't block:<br>• possible duplicate (same name and locality)<br>• new locality for the city<br>• unknown amenities (ignored)<br>• columns not in the template (ignored, listed)<br>• missing template columns (fine for update-only files) | M |
| IMP-08 | Review screen:<br>• KPI tiles: rows in file / new / updates (and no-change) / errors (and warnings)<br>• filter (all / new / updates / errors / warnings / no change)<br>• table: line, result chip, code, property, area, price, and validation messages / changes shown as old → new | M |
| IMP-09 | Options:<br>• **Update existing properties matched by property code**<br>• duplicates of existing properties: Skip or Update (existing rule)<br>• import new rows as **Draft** or **Available**; rows that fail the publish checklist stay Draft | M |
| IMP-10 | **Legal checks are never imported as verified.** New properties start with every check “Not collected”. Location, nearby places, comparables and legal data are completed on the property page | M |
| IMP-11 | The **Import n rows** button confirms the number of new and updated properties before committing. While committing, a progress state is shown; the page can't be submitted twice | M |
| IMP-12 | Result: created / updated / skipped / failed / saved as draft / photos downloaded, with links to the new and updated properties and a next-steps note (complete location, legal, pricing) | M |
| IMP-13 | **Download error report** (.xlsx, the original columns plus an error column) | M |
| IMP-14 | **Import history**: batch id, date, user, type, file, rows, created, updated, skipped, errors, error report | M |
| IMP-15 | Re-running the same file is safe: rows already imported become “Update/No change” or “Duplicate”, never silent duplicates | M |

---

## 8. Module B — Customers (R3 basics, R4 qualification)

Wireframe: **Customers** list, **Add customer** form, customer detail.

### 8.1 Customer record

| ID | Field / rule | Rel | Pri |
|---|---|---|---|
| CUS-01 | Customer ID `CUST-000001` (system) | R3 | M |
| CUS-02 | Name, mobile (E.164; Indian format by default), email (optional), preferred contact method (WhatsApp / Phone call / Email / SMS), lead source (Website, Walk-in, Referral, Property portal, Social media, Phone enquiry, Channel partner), enquiry date, assigned sales executive | R3 | M |
| CUS-03 | **Consent for follow-up** (yes/no, date, how it was given), with the reason explained: “We use your number only to share matching properties and arrange visits. You can ask us to stop at any time.” Withdrawing consent clears the next follow-up and logs it | R3 | M |
| CUS-04 | **Purchase purpose** (`purchase_purpose`): Own use, Investment, Rental income, Business use, Second home, Other; plus purpose details. Asked first | R3 | M |
| CUS-05 | **Budget**:<br>• minimum / preferred / maximum (₹)<br>• flexibility % (ceiling = maximum × (1 + flexibility))<br>• what the budget includes (Not clarified yet / Property price only / Including registration & other costs / Includes a home loan)<br>• funding preference (Own funds / Loan / Combination)<br>• funding readiness (Ready / Arranging / Not decided)<br>Rule: minimum and preferred ≤ maximum. Shows the warning “Clarify … before recommending” when not clarified | R3 | M |
| CUS-06 | **Requirements**:<br>• preferred subcategory<br>• preferred cities (at least one) and localities<br>• preferred size (sq.ft.)<br>• must-have amenities<br>• approvals must be verified (yes/no)<br>• site visit required<br>• type-specific fields: plot (facing, minimum road width, corner preference, construction plan); flat (BHK, parking, possession); house (bedrooms, minimum land area, parking, possession); commercial (category, occupancy preference) | R3 | M |
| CUS-07 | **BANT and engagement**:<br>• Authority: Sole decision-maker / Joint — family / partners / Needs approval from others / Not known<br>• Need: Clear and specific / Partly defined / Just exploring<br>• Timeline: Within 1 month / 1–3 months / 3–6 months / 6–12 months / Not decided<br>• Engagement: responded, requested documents, attended site visit | R4 | M |
| CUS-08 | The form uses numbered sections A–E like the wireframe (Basic, Purpose as radio cards, Budget with a live summary, Requirements, Readiness). Requirement fields change by type | R3 | M |
| CUS-09 | Duplicate check on mobile number: warn and link to the existing customer | R3 | M |

### 8.2 Customers list and detail

| ID | Requirement | Rel | Pri |
|---|---|---|---|
| CUS-10 | List columns:<br>• ID<br>• customer (source · date)<br>• purpose<br>• looking for<br>• budget range<br>• readiness (R4)<br>• classification (R4; restricted for HNI)<br>• stage<br>• owner<br>• next follow-up (Overdue red / Today amber) | R3 | M |
| CUS-11 | List filters: search, stage, executive, purpose, type, readiness band (R4). Sort: readiness / next follow-up / newest. Sales Executives see only their own customers | R3 | M |
| CUS-12 | Detail header:<br>• avatar initials, name<br>• chips: ID, stage, readiness (R4), classification (R4), purpose<br>• contact line, consent chip<br>• owner select, next follow-up date (disabled without consent)<br>• Edit, Move stage, Log activity | R3 | M |
| CUS-13 | Detail tabs: **Overview**, **Follow-ups & activity** (R3); **Qualification (BANT)** (R4); **Property matches** (R5); **HNI assessment** (R8, restricted) | R3+ | M |

---

## 9. Module E — Lead Pipeline (R3)

Wireframe: **Lead pipeline** Kanban, customer **Follow-ups & activity** tab.

| ID | Requirement | Pri |
|---|---|---|
| PIPE-01 | Stages: **New enquiry → Contacted → Qualified → Property recommended → Site visit scheduled → Negotiation → Booking / Closed**, plus **Lost** | M |
| PIPE-02 | Kanban board: one column per stage with a count. Cards show:<br>• name<br>• readiness chip (R4)<br>• requirement summary<br>• maximum budget<br>• owner<br>• next follow-up or lost reason<br>• days in stage<br>Cards are draggable between columns; filter by executive | M |
| PIPE-03 | Moving to **Lost** requires a reason (Bought elsewhere, Budget mismatch, No suitable inventory, Not responding, Postponed purchase, Loan not approved, Other) and an optional note; the stage at which it was lost is recorded; the next follow-up is cleared | M |
| PIPE-04 | Every stage change records from → to, user and date in the activity timeline and resets “days in stage” | M |
| PIPE-05 | A lead is **stuck** after more than N days (default 14, Settings) in one active stage; stuck cards are marked ⚠ | M |
| PIPE-06 | **Log activity**: type (Call, WhatsApp, Email, Meeting, Site visit, Note, Documents shared), date, notes, optional next follow-up (needs consent).<br>• Contact types update “last contact” and mark the customer as responded.<br>• “Documents shared” marks documents as requested. | M |
| PIPE-07 | Activity timeline, newest first: date, type, user, text. System events (assignment, stage, consent, property archived) are included | M |
| PIPE-08 | **Assignment**: on creation, if no executive is chosen, assign to the active executive with the fewest active leads. Reassignment is logged | M |
| PIPE-09 | **Negotiation** card: property (from recommendations), customer offer, seller counter, gap (₹ and %), notes | M |
| PIPE-10 | **Site visits** card (until R6 brings the calendar): date, property, status (Scheduled / Completed / Cancelled / No-show), interest (High / Medium / Low), feedback. Booking a visit moves earlier stages to “Site visit scheduled” | M |
| PIPE-11 | Moving a lead to Booking / Closed with a property suggests changing the property's status (Booked / Sold…) through a confirmation; nothing changes automatically | S |
| PIPE-12 | Follow-ups due: overdue and today, per executive (shown on the customer list and on the dashboard in R7) | M |

---

## 10. Module C — Qualification (R4) and HNI (R8)

### 10.1 Purchase readiness score: transparent 100-point model

| Criterion (max points) | Points given (initial rules, editable) |
|---|---|
| Budget fits property (25) | **25** if an eligible available property fits within the maximum budget · **13** if it fits only with flexibility · **0** if none fits |
| Clear purchase requirement (20) | Clear and specific 20 · Partly defined 10 · Just exploring 4 |
| Purchase timeline (20) | Within 1 month 20 · 1–3 months 16 · 3–6 months 10 · 6–12 months 5 · Not decided 0 |
| Funding readiness (15) | Ready 15 · Arranging 8 · Not decided 0 |
| Decision-making authority (10) | Sole decision-maker 10 · Joint 7 · Needs others' approval 4 · Not known 0 |
| Engagement and follow-up (10) | Responded 3 · Requested documents 3 · Attended site visit 4 |

Each criterion's points = maximum × factor, rounded. Factors: requirement 1 / 0.5 / 0.2; timeline 1 / 0.8 / 0.5 / 0.25 / 0; funding 1 / 0.55 / 0; authority 1 / 0.7 / 0.4 / 0; budget 1 / 0.5 / 0; engagement 0.3 + 0.3 + 0.4.

| ID | Requirement | Pri |
|---|---|---|
| QUAL-01 | Score shown with the full breakdown table (criterion, answer, points) and bands: **80–100 High-priority lead · 60–79 Qualified lead · 40–59 Developing lead · below 40 Early-stage enquiry** (thresholds in Settings) | M |
| QUAL-02 | BANT questions are shown with the exact question text; answers edit inline and recalculate immediately | M |
| QUAL-03 | Note: “Initial business rules, not industry-standard thresholds… no points for name, appearance, occupation, caste, religion or other personal characteristics.” | M |
| QUAL-04 | Three score cards on the customer overview: **1 Property fit** (best eligible match), **2 Purchase readiness**, **3 HNI verification status** (Restricted for Sales Executives) | M |

### 10.2 Customer classification (separate from scoring)

| Classification | Meaning | System suggestion rule (in this order) |
|---|---|---|
| Verified HNI | Verified through an appropriate, consent-based process | HNI status = Verified (consent required) |
| Potential HNI | Indicators of substantial wealth or investment capacity | A manager marked indicators as recorded |
| High-value prospect | Considering a high-ticket property | Maximum budget ≥ threshold (default ₹1.5 Cr). **Never implies HNI** |
| Investor | Investment objective | Purpose = Investment or Rental income |
| Qualified buyer | Clear requirement and realistic budget | Need = clear **and** at least one eligible property |
| General lead | Has enquired | Otherwise |

QUAL-05 (M): the system shows its suggestion. A Sales Manager can override it (marked “Manual override”). “Verified HNI” can't be chosen manually.

### 10.3 HNI assessment (R8, restricted)

| ID | Requirement | Pri |
|---|---|---|
| HNI-01 | Visible only to roles with the HNI permission: by default Admin and Sales Manager. Others see “Restricted to managers”, also in lists and chips | M |
| HNI-02 | Signals recorded **as stated by the customer**, each with its question: previous investment, portfolio experience, investment objective, purchase range, funding readiness, decision process, timeline | M |
| HNI-03 | Status: Not determined · Not verified · Potential — indicators recorded · Consent obtained — verification in progress · Verified · Customer declined verification. Marking “indicators recorded” moves Not determined to Potential | M |
| HNI-04 | **Verified** is blocked until consent for verification is recorded. Consent date, verified by and verified date are enabled only after consent | M |
| HNI-05 | Every HNI change records reviewer and date. The HNI register page lists customers with classification, status, signals count, consent and last review | M |
| HNI-06 | Fixed warning: no bank statements, tax returns or account balances during lead generation; verification only through a lawful, consent-based process | M |

---

## 11. Module D — Matching engine (R5)

Wireframe: **Matching engine** page, customer **Property matches** tab, property **Matching customers** tab.

**Step 1: hard filters.** A property is excluded when any of these fails:
- status is **Available** (and not archived);
- subcategory matches the requirement;
- city is in the customer's preferred cities;
- **price ≤ maximum budget × (1 + flexibility %)**.

The result label is “Budget mismatch” if price is the only failure, otherwise “Excluded”.

**Legal (soft) filter:** if any mandatory legal check is not verified, the property stays only as a **Conditional match** and can **never** be the top recommendation. Clean properties always rank above conditional ones.

**Step 2: weighted fit score.** `M = 0.30·B + 0.25·L + 0.20·S + 0.15·A + 0.10·P`. Each component is 0–100 and the weights are editable (they must total 1.00).

| Component | Rule |
|---|---|
| **B** Budget | 100 if price ≤ preferred; from preferred to maximum, falls linearly from 100 to 70; within flexibility 55; above the ceiling 0 |
| **L** Location | City in preferred list: 100 if the locality is preferred (or there is no locality preference), else 70 |
| **S** Size | 100 − 2 points per 1% difference from the preferred size (min 0); 100 if no size given |
| **A** Amenities | Infrastructure score, averaged 50/50 with must-have amenities matched when amenities are requested. Infrastructure by type:<br>• **Plot:** water, electricity at site, drainage, tar/concrete road<br>• **House:** water not tanker-dependent, power, approvals complete, new/good condition<br>• **Flat:** lift (or low floor), parking, power backup, security<br>• **Commercial:** road ≥ 30 ft, parking, permitted usage |
| **P** Preferences | Share of type preferences met:<br>• **Plot:** facing, minimum road width, corner<br>• **Flat:** BHK, parking, possession<br>• **House:** bedrooms, parking, ready-to-move, minimum land area<br>• **Commercial:** category, occupancy<br>100 if none given |

**Labels:**
- **Strong match** ≥ 80
- **Good match** 65–79
- **Weak match** < 65
- **Conditional match**: a mandatory legal check is open, or the size differs by more than 20%
- **Budget mismatch / Excluded**: fails a hard filter

| ID | Requirement | Pri |
|---|---|---|
| MATCH-01 | Each match card shows:<br>• property and its label<br>• ★ Top recommendation (only the best non-conditional match)<br>• fit score<br>• the five component scores with weights<br>• plain-language reasons (e.g. “Price ₹28 L is within maximum budget (above preferred ₹25 L)”, “✗ Facing East (has: West)”, “⚠ Mandatory checks unresolved: Layout approval”) | M |
| MATCH-02 | Actions:<br>• **Recommend to customer**: logged; moves earlier stages to “Property recommended”; for a conditional match, a legal caveat is logged<br>• remove recommendation<br>• **Schedule site visit** | M |
| MATCH-03 | “Excluded by hard filters” is a collapsible list with the reasons | M |
| MATCH-04 | Matching engine page: customer picker, customer profile, formula, result counts, **Step 1 table** (every active property × filters ✓ ✗ ⚠), **Step 2 ranking** (B, L, S, A, P, M, label, reasons) | M |
| MATCH-05 | Property → **Matching customers** tab: active customers (not Lost or Closed) who pass the hard filters for this property, ranked by fit score | M |
| MATCH-06 | Results are always calculated from current data; a change to a property, customer or rule shows immediately | M |

---

## 12. Appointments (R6)

Wireframe: **Appointments**, a Teams-style calendar.

| ID | Requirement | Pri |
|---|---|---|
| APPT-01 | Types: **Site visit** (property required), **Office meeting**, **Phone call**. Fields: customer, type, property, date, time (07:00–20:30 in 30-minute slots), duration (30/60/90/120 min), executive (default: the lead owner), notes | M |
| APPT-02 | Views: **Day, Work week (Mon–Sat ⚑ D7), Week, Month, List**. Hour grid 7 AM–9 PM:<br>• blocks sized to their duration<br>• overlapping blocks side by side<br>• red “now” line; today highlighted<br>• “Time TBC” row<br>• colour by type, status styling (✓ completed, struck-through cancelled, red no-show, dashed amber needs outcome) | M |
| APPT-03 | Clicking an empty slot books at that half-hour (with the executive filter applied). Clicking a block opens the details | M |
| APPT-04 | **Clash check**: same executive at an overlapping time, or the same property with another site visit at an overlapping time. Shows a warning listing the clashes; the user can still choose “Book anyway”, which is recorded in the history | M |
| APPT-05 | Actions:<br>• **Reschedule**: history “from → to”<br>• **Cancel**: reason (Customer request, Customer not reachable, Property no longer available, Executive unavailable, Weather / travel, Other) + note<br>• **Mark completed**: outcome or feedback required, interest for site visits, optional next follow-up<br>• **No-show** | M |
| APPT-06 | Completing a site visit sets “attended site visit” (readiness). Booking a site visit adds the property to recommendations and moves earlier stages to “Site visit scheduled”. Every action is logged on the customer timeline | M |
| APPT-07 | Tiles: Today, Next 7 days, **Needs outcome** (past, still Scheduled, with links), Completed (cancelled / no-show count). Toolbar: Today ‹ ›, range label, date picker, view switcher, ＋ New appointment; filters: executive, type, status, property | M |
| APPT-08 | Dashboard card “Today's appointments”. Sales Executives see only their own | M |
| APPT-09 | Booking warns when the customer has no follow-up consent | M |

---

## 13. Dashboard and reports (R7)

| ID | Requirement | Pri |
|---|---|---|
| DASH-01 | KPI tiles: total leads (active · lost), qualified leads (reached Qualified or beyond), site visits (upcoming), bookings (% of leads) | M |
| DASH-02 | Lead pipeline bars per stage plus “stuck more than N days” list; follow-ups due (overdue/today); today's appointments; priority leads (by readiness) with best property fit, stage, owner and next follow-up | M |
| DASH-03 | Readiness mix (active leads), inventory by status, available listings with open mandatory legal checks | M |
| RPT-01 | Conversion funnel (lost leads count up to the stage where they were lost); enquiry → booking %; where leads are stuck (count now, average days, over N days) | M |
| RPT-02 | Leads by source, by purpose, by requirement type, by classification; reasons lost; **unmet demand** (active leads with no eligible property); sales executive performance (active, qualified+, site visits, bookings, lost, overdue follow-ups) | M |
| RPT-03 | Every report respects the role scope (executives see their own) | M |

---

## 14. Public enquiry form (R4)

Wireframe: **Public enquiry form**, customer-facing.

| ID | Requirement | Pri |
|---|---|---|
| ENQ-01 | Five steps:<br>1. **Purpose** (first question, radio cards)<br>2. **Property & location** (type, preferred size, localities, cities)<br>3. **Budget** (min/preferred/max, flexibility, what the budget includes, funding, funding status)<br>4. **Requirements & timeline** (type-specific, timeline, who decides, approvals, site visit)<br>5. **Contact & consent** (name, mobile, email, preferred contact, consent checkbox with explanation; no financial documents) | M |
| ENQ-02 | On submit:<br>• create the customer (stage New enquiry, source Website, need “Partly defined”)<br>• auto-assign the least-loaded executive<br>• schedule a follow-up for the next day **only with consent**<br>• run matching | M |
| ENQ-03 | The thank-you page shows the reference ID and how they'll be contacted (or that they won't be, without consent) | M |
| ENQ-04 | Public endpoint protection: rate limit, bot protection (honeypot / challenge), server-side validation, no sign-in | M |

---

## 15. Settings

| ID | Setting | Who | Rel |
|---|---|---|---|
| SET-01 | Company info (existing) | Admin | R0 |
| SET-02 | Property types & amenities (existing):<br>• subcategory code prefix, purposes, active<br>• **main-area meaning** (new)<br>• attributes (+ the **New / review** tag for attributes added from a property)<br>• amenities with icons and order | Admin | R0/R1 |
| SET-03 | **Legal checklists** per subcategory: checks, order, mandatory flag; defaults per §6.6 | Admin | R1 |
| SET-04 | **Valuation cost assumptions**: stamp duty %, registration %, other % (defaults 7 / 4 / 1, flagged “illustrative — confirm current rates and guideline value”) | Admin | R1 |
| SET-05 | **Sales executives**: active list used for assignment (linked to users with the Sales Executive role) | Sales Mgr | R3 |
| SET-06 | Pipeline: stuck after N days (14); lost reasons list | Sales Mgr | R3 |
| SET-07 | Readiness points per criterion (must total 100) and lead bands (80/60/40) | Sales Mgr | R4 |
| SET-08 | High-value prospect threshold (₹1.5 Cr) | Sales Mgr | R4 |
| SET-09 | Matching weights B/L/S/A/P (0.30/0.25/0.20/0.15/0.10, must total 1.00) | Sales Mgr | R5 |
| SET-10 | Appointment working week (Mon–Sat), visible hours, default durations | Admin | R6 |

All rule changes are logged and take effect immediately for calculated values.

---

## 16. Key workflows

1. **List a property (R1):**
   1. Add property: pick the type, fill sections 1–3, Save draft (a code is assigned).
   2. Add photos and documents.
   3. Complete the Location (measured distances), Legal (statuses) and Pricing (comparables) tabs.
   4. When the checklist passes, make it Available.
2. **Bulk list properties (R2):**
   1. Choose the subcategory and download the template.
   2. Fill it and upload; review the New / Update / Error rows; import as Draft.
   3. Complete legal, location and pricing on each property.
3. **Add an attribute while listing:**
   1. On the form: ＋ Add attribute → “All properties under…”.
   2. The **confirmation screen** appears; confirm.
   3. The attribute is added to Settings, tagged New for admin review.
4. **Retire a property:**
   - Archive (confirmation) when it is linked to customers;
   - Delete (confirmation + tick) only when it isn't;
   - Restore brings it back as Draft.
5. **Work a lead (R3):**
   1. The lead is created (manually; from R4 also by the enquiry form) and auto-assigned; consent is recorded.
   2. Contact the customer and log the activity; set the next follow-up.
   3. Move through the stages on the board; record a reason if Lost.
6. **Qualify and recommend (R4–R5):**
   1. Ask the BANT questions to update readiness.
   2. Open matches and recommend the top match (never a conditional one as the top).
   3. Book a site visit (R6) and record the outcome.
   4. Negotiate, then mark the booking.

---

## 17. UI and design requirements

| ID | Requirement |
|---|---|
| UI-01 | **App shell as in the wireframe.** Left sidebar with brand and grouped sections:<br>• Overview: Dashboard<br>• Specification data: Properties (count of available), Customers (count of active), Bulk import<br>• Sales & qualification: Lead pipeline, Appointments (count today), Matching engine, HNI qualification (🔒 for executives), Reports<br>• Tools: Public enquiry form (preview), Settings & rules<br>Modules not yet released are hidden or shown as “Coming soon”. Top bar: breadcrumb, quick actions (＋ Customer, ＋ Property), user menu |
| UI-02 | **Page header pattern**: H1 title, one-line description, actions on the right |
| UI-03 | **Visual language from the wireframe**:<br>• cards with soft borders and 10px radius<br>• chips/badges in tones (green, amber, red, blue, purple, grey)<br>• KPI tiles, tables with uppercase small headers, underline tabs<br>• numbered form sections, radio cards, notes/callouts (info, warning, danger, success)<br>• confirmation modals<br>• Kanban columns, match cards with component scores, and the Teams-style calendar<br>Light and **dark** themes (existing) |
| UI-04 | Status colours:<br>• property: Available green, Under negotiation purple, Reserved/Booked blue, On hold amber, Sold grey, Draft grey outline, Archived outline<br>• legal: Not collected grey, Pending amber, Verified green<br>• match: Strong green, Good blue, Weak grey, Conditional amber, Budget mismatch/Excluded red |
| UI-05 | Responsive down to 390 px phone width, with no horizontal page scroll except inside tables and boards. Keyboard accessible; visible focus; labels on every input; WCAG 2.1 AA contrast in both themes |
| UI-06 | Every destructive or global-impact action has a confirmation modal (delete, archive, global attribute add, bulk status change, import commit, cancel appointment, lost stage) |
| UI-07 | Toast feedback after saves; inline errors; skeleton loading; empty states with a next action |

---

## 18. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | List pages respond in under 500 ms (p95) at 10,000 properties / 20,000 customers; detail under 300 ms; matching for one customer under 300 ms at 10,000 properties; an import of 2,000 rows (without images) validates in under 20 s |
| Reliability | No lost writes on concurrent edits (optimistic concurrency with a clear “changed by someone else” message); imports are all-or-nothing per row and safe to retry; 99.5% monthly availability target |
| Security | Role-based access on every API; HNI fields filtered server-side; audit trail; OWASP ASVS L1 baseline; secure uploads (type sniffing, size limits, private import files); rate limits on sign-in and public endpoints |
| Privacy | Consent recorded with date and channel; data minimisation; export/delete of a customer's personal data on request (R3) in line with India's Digital Personal Data Protection Act, 2023 (legal review ⚑) |
| Data | Daily database backups and `uploads/` backups, 30-day retention; restore tested each release |
| Usability | Indian formats (₹, lakh/crore, dd Mon yyyy); English UI; usable on a 13" laptop and a phone |
| Quality | Every release: lint, typecheck, unit/integration tests, end-to-end tests of the release's flows, and a team demo before sign-off |

---

## 19. Acceptance scenarios (examples, more in the checklist)

**Scenario 001: residential plot buyer (R5).**
- **Customer:** Madurai, own house, ₹30 L, 1,200 sq.ft., 3 months, approvals must be verified.
- **Expected behaviour:**
  1. The enquiry is saved.
  2. Plots matching location and budget are identified.
  3. Unavailable properties are excluded.
  4. Unresolved approval verification is flagged (Conditional).
  5. A verified listing is recommended as the top match.
  6. The lead is assigned.
  7. A follow-up is scheduled **only after consent**.
- **Expected output:** Qualified buyer · HNI status *Not determined*.

**Scenario 002: attribute from form (R1).** “All properties under Residential › Residential Plot” → confirmation shown → Cancel leaves Settings unchanged → Confirm adds it with the “New” tag.

**Scenario 003: delete safety (R1/R3).**
- A property linked to a customer can't be deleted; the dialog lists the customer and offers Archive.
- An unlinked property can be deleted only after the confirmation tick.

**Scenario 004: import update (R2).** A file with an existing code and only a changed price updates only the price; the status and other fields stay the same.

---

## 20. Decisions to confirm (⚑)

| # | Decision | Recommendation (assumed in this document) |
|---|---|---|
| D1 | Property statuses | ✅ **Confirmed.** Keep Draft → publish. Rename Published → **Available** and Unpublished → **On hold**. Add **Under negotiation**, **Reserved**. Keep Booked, Sold/Rented/Leased, Archived |
| D2 | Property types | ✅ **Confirmed:** the configurable model stays. The v1 defaults are replaced by the wireframe catalogue ([PROPERTY-CATALOGUE.md](PROPERTY-CATALOGUE.md)): 3 residential and 5 commercial types, with common and type-specific attributes. The test data is reset |
| D3 | Delete rule | Only when not linked to any customer (your instruction). Admin and Sales Manager |
| D4 | Roles | ✅ **Confirmed:** three default roles: Admin, Sales Manager, Sales Executive. Super Admin merges into Admin. Only the Admin can add new roles (§4.2) |
| D5 | Lead data source | Our database is the system of record for customers and the pipeline (consent, requirements, scores need it). This **changes the v1 rule** “leads live only in Perfox”. Perfox/AI can create and update leads through our API in R9 |
| D6 | Import file types | .xlsx (existing, richer) **and** CSV |
| D7 | Work week | Mon–Sat |
| D8 | Cost assumptions | 7% stamp duty, 4% registration, 1% other: placeholders until confirmed |
| D9 | Scoring rules | Use the wireframe values as starting rules |
| D10 | Release order after R3 | R4 Qualification & enquiry → R5 Matching → R6 Appointments → R7 Dashboard & Reports → R8 HNI → R9 AI |
| D11 | Legal checklists | The defaults in §6.6, confirmed by the client's legal advisor |
| D12 | Under negotiation & matching | Excluded from matching for everyone. Alternative: keep it visible to the negotiating customer only |
| D13 | Admin access to HNI | ✅ **Resolved by D4:** yes. The Admin is the top role and has every permission. HNI stays hidden from Sales Executives and from custom roles unless the Admin grants it |

---

## 21. Glossary

| Term | Meaning |
|---|---|
| Subcategory | A property type such as Residential Plot or Apartment / Flat; defines fields, legal checklist, code prefix and purposes |
| Attribute | A configurable field on a property (e.g. Road width) |
| Mandatory legal check | A check that must be **verified** for a property to be an unconditional match |
| Comparable | A similar property used as price evidence (asking or transaction) |
| Fit score (M) | 0–100 suitability of one property for one customer |
| Readiness score | 0–100 measure of how ready a customer is to buy |
| HNI | High-net-worth individual; a verified **status**, never inferred from budget |
| BANT | Budget, Authority, Need, Timeline |
| Stuck lead | An active lead in the same stage longer than the configured number of days |
