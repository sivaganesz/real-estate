NOTE: The harness refused my Write to E:\real-estate\crm-e2e\notes\analysis-spec-wireframe.md ("Subagents should return findings as text, not write report files"). The file was NOT created. I did not work around this. The full intended content is below, between the BEGIN and END markers. The lead should save it to that path as is.

Summary:
- Read the master spec and all of spec-system-wireframe: app.js, data.js, logic.js, views-appointments/import/projects/sales/customers/tools, the share/properties/add-property/AI/search outlines, and docs/project-spec.html. Compared them with wireframe-rebuild/CHECKLIST.md and src/data/types.ts.
- Modules not in the rebuild, documented field by field and rule by rule: Appointments (§2), Bulk import (§4), Projects (§5), Pipeline (§6), Dashboard (§7), Matching engine page (§8), HNI register (§9), Reports (§10), Public enquiry (§11), Settings business rules (§13).
- Data model gaps in the rebuild: SiteVisit has no duration, exec, notes, cancelReason or history. There are no meeting/call appointments, and no projects, imports or importMappings. readinessPoints, bands and highValueThreshold are not in Settings.
- The wireframe's stage list differs from master prompt §11 and must be reconciled. The wireframe also has no per-owner data scoping.
- Test scenario 001 is described as a ready-made acceptance test (§12).

=== BEGIN analysis-spec-wireframe.md ===
# Analysis — `spec-system-wireframe/` (the functional spec)

Source: `E:\real-estate\spec-system-wireframe\`. It is plain HTML/JS with a hash router and one `DB` object in localStorage (key `respec-wireframe-v1`; role in `respec-wireframe-role`). Files read: index.html, app.js, data.js, logic.js, views-appointments.js, views-import.js, views-projects.js, views-sales.js, views-customers.js, views-tools.js, views-share.js (header and rules), views-properties.js / views-add-property.js / properties-ai.js / property-search.js (outline and scoring), and docs/project-spec.html. Compared against wireframe-rebuild/CHECKLIST.md (27 Nov 2026) and wireframe-rebuild/src/data/types.ts.

Demo date in the wireframe is fixed: `DEMO_TODAY = '2026-11-16'`. The new app must use dates relative to today (master §18). Below, "D" means today.

## 0. Summary — wireframe vs rebuild
| Module / screen | Route | In rebuild? | Notes |
|---|---|---|---|
| Shell, role switch, Reset demo data | all | Done | Roles: Admin, Sales manager, Sales executive. The executive is always EX01. crm-e2e needs 3 exec accounts and a permission map. |
| Sales dashboard | #/dashboard | NOT started | §7 |
| Properties list/page/drafts/add AI/edit AI/share | #/properties… | Done | Only the project tag and the project unit link/hold are missing |
| Projects (list, page, new) | #/projects… | NOT started | §5 |
| Leads (customers) | #/customers… | Done (redesigned) | The rebuild is the source; small extras in §3 |
| Bulk import (properties) | #/import | NOT started | §4 |
| Lead pipeline | #/pipeline | NOT started | §6 |
| Appointments | #/appointments | NOT started | §2 |
| Matching engine page | #/matching?c=ID | NOT started (logic is in lib/matching.ts) | §8 |
| HNI register | #/hni | NOT started (per-lead HNI tab is done) | §9 |
| Reports | #/reports | NOT started | §10 |
| Public enquiry (5 steps) | #/enquiry | NOT started | §11 |
| Test scenario 001 | #/test | Removed on purpose | §12, use it as an acceptance test |
| Settings & business rules | #/settings | Only "Your preferences" | §13 |
| System map | #/about | Removed | Drop |

## 1. Core data model
DB root: `{ version, settings, properties[], customers[] (=Lead), projects[], imports[] (IMP-###), importMemory {normHeading:fieldKey}, importMappings[] (FMT-###), counters {prop, cust, appt}, apptSeeded, apptSeedV2 }`. IDs: PROP-####, CUST-####, PRJ-###, APT-####.

Executives (settings.executives):
- EX01 "Executive 01 — Priya S"
- EX02 "Executive 02 — Karthik R"
- EX03 "Executive 03 — Divya M"
- EX04 "Executive 04 — Naveen P"

Helpers:
- `execName` returns '— Unassigned —' for an unknown id.
- `execShort` returns the part after "—".
- `currentUser()` returns 'Executive 01 — Priya S' for the executive role, and the role name otherwise.

Customer/Lead shape:
```
{ id, name, mobile:'+91 98xxxxxx02', email, contactPref:'WhatsApp'|'Phone call'|'Email'|'SMS', source, enquiryDate, owner:'EX02',
  purpose:'Own use'|'Investment'|'Rental income'|'Business use'|'Second home'|'Other', purposeNote,
  budget:{min,pref,max,flexPct,basis,funding:'Own funds'|'Loan'|'Combination',fundingReady:'Ready'|'Arranging'|'Not decided'},
  req:{type,cities[],localities[],size,approvalRequired,siteVisit,amenities[], facing,minRoad,corner,constructionPlan,bhk,parking,possession,landArea,commCategory,occupancy},
  bant:{authority,need,timeline}, engagement:{responded,docsRequested,siteVisited}, consent:{followUp,date,channel},
  stage, stageSince, lastContact, nextFollowUp, classification:''(manager override),
  hni:{status,signals{},potentialFlag,consent,consentDate,verifiedBy,verifiedDate,notes,reviewedBy,reviewedDate},
  recommended:['PROP-1005'],
  siteVisits:[{id:'APT-0001',date,time,duration:60,exec,prop,status,feedback,interest:'High'|'Medium'|'Low'|'',notes,cancelReason,history:[{date,text,by}]}],
  appointments:[{id,type:'Office meeting'|'Phone call',date,time,duration,exec,status,prop,notes,feedback,cancelReason,history[]}],
  negotiation:{prop,offered,counter,notes}|null, lostReason, lostNote, lostAtStage, activity:[{date,ts,type,text,by}] }
```
The rebuild's `Lead` uses camelCase enums, `visits: SiteVisit[]` and `lost:{reason,note,at,by}`. Its SiteVisit has no duration, exec, notes, cancelReason or history, and there is no meeting/call appointment type.

Enums (verbatim):
- STAGES = New enquiry, Contacted, Qualified, Property recommended, Site visit scheduled, Negotiation, Booking / Closed. Plus 'Lost'.
  - Rebuild keys: new, contacted, qualified, recommended, visitScheduled, negotiation, closed, lost.
  - Master §11 wants New → Contacted → Qualified → Site Visit Scheduled → Site Visit Done → Negotiation → Booked → Converted → Lost. Reconcile the two lists.
- LOST_REASONS = Bought elsewhere, Budget mismatch, No suitable inventory, Not responding, Postponed purchase, Loan not approved, Other.
- LEAD_SOURCES = Website, Walk-in, Referral, Property portal, Social media, Phone enquiry, Channel partner, Test. Use master §4's Indian list instead.
- ACTIVITY_TYPES = Call, WhatsApp, Email, Meeting, Site visit, Note, Documents shared.
- TIMELINES = Within 1 month, 1–3 months, 3–6 months, 6–12 months, Not decided.
- AUTHORITY = Sole decision-maker, Joint — family / partners involved, Needs approval from others, Not known yet.
- NEED_CLARITY = Clear and specific, Partly defined, Just exploring.
- BUDGET_BASIS = Not clarified yet, Property price only, Including registration & other costs, Includes a home loan.
- CONSTRUCTION_PLANS = Within 1 year, 1–3 years, No immediate plan, Not applicable.
- PROPERTY_STATUSES = Available, Under negotiation, Reserved, Booked, On hold, Sold. Plus an `archived` flag.
- LISTING_PURPOSES = Sale, Lease, Rent. FACINGS = 8 directions.
- CLASSIFICATIONS ladder: General lead < Qualified buyer < Investor < High-value prospect < Potential HNI < Verified HNI.
- HNI_STATUSES = Not determined, Not verified, Potential — indicators recorded, Consent obtained — verification in progress, Verified, Customer declined verification.
- HNI_SIGNALS (each with a question): prevInvestment, portfolio, objective, range, fundingReadiness, decisionProcess, timeline.
- Consent channels = Verbal on call, WhatsApp message, Website form, Signed enquiry form, Email.
- Property types: plot, flat, house, commercial, agri, industrial.
- REQUIRED_DETAILS (needed to publish): plot length+width; flat bhk+floor; house subType+bedrooms; commercial commCategory+occupancy; agri acres+waterSource; industrial subType+powerKva.
- Cities: 10 Tamil Nadu cities with localities. Master wants pan-India cities.

Requirement fields per type (REQ_FIELDS):
- plot: facing, minRoad ft, corner (No preference / Corner / Non-corner), constructionPlan.
- flat: bhk 1–4+, parking (Required / Preferred / Not needed), possession (Any / Ready to move / Under construction).
- house: bhk 2–5, landArea min, parking, possession (Any / Ready to move).
- commercial: commCategory (Office space / Shop / Showroom / Warehouse / Godown / Commercial building / Industrial shed), occupancy (Any / Vacant / Tenanted).
- agri and industrial have none.

Helpers to port:
- inr gives ₹45,00,000. inrShort gives ₹45 L / ₹1.2 Cr.
- fmtDate gives "16 Nov 2026" (en-IN). daysBetween, addDays. ymd uses the local date, because toISOString shifts a day in IST.
- isActive = stage is not Lost and not Booking / Closed. isOverdue = nextFollowUp < today && active. isDueToday.
- moveStage(c, stage, reason, note):
  - Sets stageSince.
  - Lost: lostReason (default Other), lostNote, lostAtStage = from, and clears nextFollowUp.
  - Leaving Lost clears the reason.
  - Logs "Stage changed: A → B (reason: …)".
- **Automatic stage moves go forward only:** `if (stageIndex(c.stage)>=0 && stageIndex(c.stage) < STAGES.indexOf(target)) moveStage(c,target)`. They never move a lead backwards and never touch Lost leads.
- logActivity / logHistory prepend `{date, ts, type, text, by}`.

Guard rules (BIND_HOOKS):
- HNI status can become Verified only with hni.consent.
- nextFollowUp can be set only with consent.followUp.
- Settings edits, property status changes and lead owner changes are blocked for the executive.
- After-effects:
  - Property status/price changes add a history entry.
  - An owner change logs "Lead reassigned to X".
  - Setting a follow-up logs "Next follow-up set for D".
  - Any hni.* change stamps reviewedBy/Date.
  - Status Verified stamps verifiedBy/Date.
  - Ticking potentialFlag while status is Not determined sets status to "Potential — indicators recorded".

## 2. Appointments — NOT in rebuild
Storage:
- Site visits live in `customer.siteVisits` (kept in sync with the lead's Site visits card).
- Meetings and calls live in `customer.appointments` with a `type`.
- allAppointments() flattens both into `{id, c, src, i, rec, type, date, time, duration, prop, exec(default owner), status}`, sorted by date+time, untimed last.
- For crm-e2e, use a first-class Appointment entity: leadId, type, propertyId?, executiveId, date, time, durationMin, status, notes, feedback, interest, cancelReason, history[], location.
- Master §16 adds video call and documentation/registration types, Confirmed/Rescheduled statuses, reminders and a map link.

Constants:
- APPT_TYPES = Site visit 📍, Office meeting 🏢, Phone call 📞.
- APPT_STATUSES = Scheduled (blue), Completed (green), Cancelled (grey), No-show (red).
- CANCEL_REASONS = Customer request, Customer not reachable, Property no longer available, Executive unavailable, Weather / travel, Other.
- DURATIONS = 30/60/90/120 min (default 60). TIME_SLOTS = 07:00–20:30 every 30 min.
- Activity type logged on the lead: visit → 'Site visit', meeting → 'Meeting', call → 'Call'.
- **"Needs outcome"** = Scheduled with date < today (amber dashed outline and chip).

Page:
- 4 KPI cards (they respect the filters):
  - Today: date = today, not cancelled. Sub "next at HH:MM".
  - Next 7 days: Scheduled, today < date ≤ today+7. Sub "N site visit(s)".
  - Needs outcome (amber when > 0).
  - Completed. Sub "N cancelled / no-show".
- An amber note links every needs-outcome item.
- Toolbar: Today, ‹ ›, range label, go-to date, view select, ＋ New appointment. List view shows an "Upcoming only" box instead.
- Filters: executive, type, status, property, Clear.
- Views (deep link ?view=): Day, Work week (Mon–Sat, 6 days, the default), Week, Month, List.
- Time grid:
  - 07:00–21:00, 48 px per hour. Events are sized by duration; overlapping events sit side by side (cluster/column layout).
  - A now-line on today. A "Time TBC" row for untimed items. Scrolls to 08:00.
  - Colour by type; completed ✓, cancelled struck through, no-show red border.
  - Clicking an empty slot books at that half-hour (exec filter prefilled). A day header opens Day view.
  - Month view: 3 pills per day, "+N more" opens Day view, clicking an empty cell books on that date.
- List columns: Date (Today chip), Time HH:MM–HH:MM or TBC, Type, Customer + id, Property, Executive, Status (+Needs outcome), and Actions (Reschedule / Complete / Cancel) while Scheduled. "Upcoming only" = date ≥ today OR Scheduled.
- Dashboard card: today's non-cancelled appointments, ＋ Book, All appointments →.

Book / reschedule dialog:
- Fields:
  - Customer* (active leads; locked on reschedule).
  - Type* (locked on reschedule).
  - Property: required for Site visit. Other types start with "— Not about a specific property —". The list shows the lead's eligible matches first as "★ PROP · title (label)", then the other Available non-archived properties.
  - Date* (default tomorrow), Time* (default 11:00), Duration.
  - Executive (blank = "Lead owner — X").
  - Notes ("Purpose, what to prepare, meeting point…").
- Changing the customer or type re-renders the dialog and clears the warning.
- Without consent an amber warning shows; it does not block.
- Validation toasts: "Choose a customer", "Choose a date", "Choose the property for the site visit".
- **Clash rule:** another Scheduled, timed appointment on the same date whose [start, start+duration) overlaps, AND (same executive OR both are site visits of the same property).
  - Messages: "<exec> already has a <type> with <name> at HH:MM–HH:MM" or "PROP-x already has a site visit with <name> at …".
  - The red note appears and the submit button changes to **"Book anyway"**. Resubmitting the same date/time/duration/exec/prop books it, and history adds "(booked despite a time clash)".

Effects:
- New booking:
  - Record `{id APT-####, date, time, duration, exec, prop, notes, status:'Scheduled', feedback:'', interest:'', cancelReason:'', history:[{text:'Booked for D T'}]}`.
  - A site visit also adds the property to recommended and moves the lead forward to **Site visit scheduled**.
  - Activity: "<Type> booked for <when> — PROP with <exec>". Toast.
- Reschedule:
  - Updates fields and sets status back to Scheduled.
  - History: "Rescheduled from A to B" or "Details updated".
  - Activity: "<Type> rescheduled from A to B".
- Cancel dialog:
  - Reason* (default Customer request) and Details.
  - cancelReason = "Reason — details". Logs history and activity "<Type> on D cancelled (…)".
- Mark completed dialog:
  - Fields: Outcome / "Site visit feedback" (required); Interest High/Medium/Low (default Medium, visits only); Next follow-up (disabled with hint "Needs consent" when there is no consent).
  - Sets status Completed, feedback and interest. History "Marked completed".
  - lastContact = appointment date (today if it is in the future). engagement.responded = true. A visit also sets engagement.siteVisited = true.
  - Sets the follow-up only with consent.
  - Activity "<Type> completed (PROP): feedback — interest High".
- No-show (one click): status No-show; activity "<Type> on D — customer did not show up".
- Detail dialog:
  - Shows status, id, Needs outcome; When, Customer (link to lead, mobile, "prefers X"), Property link + locality, Executive, Notes, Outcome, Cancel reason; history newest first.
  - Actions while Scheduled: Reschedule, Mark completed, No-show, Cancel. Otherwise "Book a follow-up appointment" (same customer/type/property). Plus "Open customer →".
- Master additions: AI prep points, an AI summary after the visit, and an AI-suggested next follow-up and stage.

Seed (D = today):
- Site-visit times: CUST-1002 11:00 (D+3, PROP-1005); 1004 10:30 (completed); 1005 16:00 (completed); 1006 15:00 (D+4, PROP-1008); 1012 11:30; 1013 12:00.
- Meetings and calls:
  - 1004: meeting D 11:00, PROP-1007, "Final price discussion with the seller at our office".
  - 1001: call D 17:00, 30 min, PROP-1001.
  - 1009: call D+1 12:00, PROP-1011.
  - 1003: meeting D+1 16:00.
  - 1007: call D+2 18:30.
  - 1013: meeting D+9 11:00, 120 min, PROP-1010, "Registration at the sub-registrar office".
  - 1005: meeting D-4 (gives a needs-outcome item).
  - 1008: meeting D-2, Cancelled (Customer request).
  - 1011: call D-10, No-show.
  - 1006: call D+3 11:30.
  - 1014: meeting D+5 10:00.

## 3. Customers / Leads — mostly in rebuild
List:
- Search over id, name, mobile, cities.
- Filters: stage, executive, purpose, type, readiness band. Sort: readiness (default), next follow-up, newest.
- Columns:
  - ID; Customer (source · date); Purpose.
  - Looking for (reqSummary = type · cities · size · bhk/facing/commCategory).
  - Budget min–max; Readiness score + band; Classification (HNI classes show "Restricted" to executives).
  - Stage; Owner; Next follow-up (Overdue red / Today amber / date).

Form:
- A Basic:
  - ID auto, name*, mobile*, email, contact pref, source, enquiry date.
  - Executive: managers get a select with "Auto-assign (least loaded)". Executives are locked to themselves, with the hint "Only an Admin or Sales manager can reassign a lead".
  - Stage.
  - Consent box with the "say why" text: "We use your number only to share matching properties and arrange visits. You can ask us to stop at any time."
- B Purpose: radio cards and purpose details.
- Budget: min/pref/max/flex%, with the live summary "₹20 L – ₹30 L · preferred ₹25 L · with flexibility up to ₹31.5 L", plus basis, funding and funding readiness.
- Requirement: type-specific fields, cities, localities, size, approvalRequired, siteVisit, amenities.
- BANT and engagement checkboxes.
- Validation: name, mobile, purpose, max > 0 and ≥1 city required; min and pref ≤ max; pref defaults to max.
- On create:
  - A blank owner goes to nextExecutive().
  - nextFollowUp = tomorrow, only with consent.
  - Activity: "Customer created and assigned to X; follow-up scheduled D" or "…no consent — follow-up not scheduled".
  - Opens the Matches tab.
- On edit: losing consent clears the follow-up. Logs "Customer specification updated".

Lead page tabs: Overview, Qualification (BANT), Property matches, Follow-ups & activity, HNI (🔒). All are ported.

Follow-ups tab:
- Log activity: type, date, next follow-up (disabled without consent), notes*.
  - Call/WhatsApp/Email/Meeting/Site visit set lastContact and responded = true.
  - "Documents shared" sets docsRequested = true.
- Consent: record it (channel + date; sets follow-up = tomorrow if there is none) or withdraw it (clears the follow-up; logs "Customer withdrew follow-up consent — follow-ups cancelled").
- Site visits table, editable inline. ＋ Schedule: property = eligible matches, otherwise all Available; date default +3. It adds the property to recommended and moves the lead forward.
- Negotiation:
  - Start picks the first recommended or the top eligible property.
  - Fields: property, offer ₹, seller counter ₹, details.
  - "Gap ₹x (y%)" where y = |counter−offer| / counter.
- Lost card: reason + details.
- Recommend: pushes to recommended. Logs "Recommended PROP (label, fit M)", adding "— customer informed that an approval document is pending" when legal is not OK. Moves the lead forward to Property recommended. Unrecommend logs.
- Stage modal: Lost requires a reason + details. Text: "Current: X since D".

Seed leads (15):
- 1001 Arun: plot Madurai ₹20–30 L, Qualified (the worked example).
- 1002 Meena: 2 BHK, visit scheduled.
- 1003 Rajesh: investor, Recommended, overdue.
- 1004 Fatima: house Coimbatore ₹1.1–1.45 Cr, Negotiation (1.28 vs 1.32 Cr).
- 1005 Suresh: shop, rental income, Negotiation, overdue.
- 1006 Lakshmi: ₹3–4 Cr villa, Potential HNI with 7 signals, no consent.
- 1007 Vignesh: 3 BHK OMR, Contacted.
- 1008–1012: various.
- 1013 Ramesh Traders: registration.
- 1014 Priyanka.
- 1015 Karthik Subramanian: ₹5–7 Cr stated, no funding plan ("High budget ≠ HNI").

## 4. Bulk import (properties) — NOT in rebuild
Flow: stepper **Upload file → Check → Done**. Header: "Add or update many properties at once — from a spreadsheet, a brochure or catalogue, or photos."

Start screen:
- "What's in the file?" type pills.
- Drop zone for .xlsx, .csv, .pdf and images.
- "Try:" links: our template, an owner's own sheet, a builder's brochure (PDF), a photo of a board. Also template and sample CSV downloads.
- Promise line: "Brochures and photos are read by the AI · columns with other names are matched · a title above the headings is fine · '30 L' or '1,200 sqft' are read · other columns are kept as extra details · rows missing details become drafts — nothing is lost."
- Collapsible column reference (highlighted = needed to publish; how a Property ID column updates).
- .xls gets a toast asking to save as .xlsx. A PDF or image shows the reading spinner "The AI is reading <file>…".

Check screen:
- Header: file, type chip, rows, "Choose another file". Column summary.
- Found notes:
  - "Headings found on line 4 — skipped above them: …"
  - "Skipped 1 total row (line 9)"
- Executive note: ready rows go for approval.
- File notes:
  - "Only the first 500 rows were read"
  - "Not in this file: X — rows are still imported, as drafts the AI finishes"
- Filter chips (empty ones hidden): All / Ready (green) / Drafts (amber) / Updates (blue) / Need fixing (red).
- Each row: dot; title (or the existing title, or the AI title with ✨); id link; locality, city; "line N" / "page N" / "the photo"; 📷 count; area and price.
- Each row's status text:
  - Error: "✗ first error +N more".
  - Draft: "Draft — the AI will ask for <needs> and to confirm: <confirm>".
  - Update: "Update: Asking price ~~₹29 L~~ → ₹30 L".
  - No change: "No change — skipped".
  - Ready: "Ready", or "Ready — goes for approval" for executives.
  - Plus the source quote, warnings (⚠) and notes.
- Footer: "⤓ Rows that need fixing (N)" (CSV of line, errors and data), "Update existing properties" (on by default), Cancel, "Import N rows".

Done screen:
- Chips: Added / Sent for approval / Drafts to finish / Updated / Skipped, with linked lists; drafts show "needs…, confirm…".
- Buttons: Open properties / Open drafts / Import another file.
- Toast "IMP-003: 2 created, 1 sent for approval, 3 saved as drafts, 1 updated, 2 skipped".
- Collapsible Past imports table: Batch, Date, By, File (+ from sender), Added, Drafts, Updated, Skipped.
- Collapsible Saved formats table: Sender, Type, Columns, Used, Last used, Forget (managers only).

Columns:
- property_id: blank = new, an existing id = update.
- title: blank = the AI suggests one.
- purpose (default Sale), status (default Available), listing_date YYYY-MM-DD (default today).
- city* (known list), locality*, address, pincode (6 digits), facing.
- area_sqft* (label = the type's area label, > 0), asking_price* (> 0, commas allowed).
- latitude, longitude.
- amenities (separated by ;), approvals (separated by ;; each starts as "document pending").
- All of the type's fields; required details sort first.
- Mapping to the property: address→location.address, pincode→location.pincode, lat/lng→location, listing_date→listingDate, area_sqft→area, asking_price→price.

Validation: each row becomes `{line, data, errors, warnings, needs, notes, mode:new|update, existing, changes[{l,from,to}], extra, suggestedTitle}`.
- Property ID:
  - Duplicate id in the file: error "(also on line N)".
  - Unknown id: error "leave it blank to create a new property".
  - Existing id: update mode. Errors when the user is an executive ("X is published — only an Admin or Sales manager can update it"), the property is archived, or the type differs ("use the <type> template").
- New rows missing required fields go to `needs` and become a **draft, not rejected**.
- Numbers: NaN or ≤ 0 (positive fields) is an error.
- Selects: case-insensitive match, otherwise error "'v' is not an allowed value (a / b)".
- Dates: YYYY-MM-DD. Months: YYYY-MM.
- Unknown amenities: warning. Unknown approvals: warning "create them in Settings → Approval badges"; known ones add the note "N approval badge(s) — document pending".
- Pincode must be 6 digits.
- Only one of lat/lng: warning. Both: note "Exact location".
- No title: AI title + note.
- A new locality: warning.
- **Duplicate detection:** same type + same locality + (same title or area within ±10%) gives the warning "Possible duplicate of PROP-x — it will still be added".
- Extra columns: note "Kept as extra detail: Label 'value'".
- An update with no changes: warning "No changes — this row will be skipped".
- Row status: errors → error; update → update / nochange; needs or confirm items → draft; otherwise new. Rows imported = new + draft + (update if the box is on).

Spreadsheet reading:
- CSV: quotes, BOM, CRLF.
- XLSX: read in the browser (use SheetJS in crm-e2e). Max 500 rows.
- Header row: the first of the first 15 rows that is ≥ 60% of the max width and ≥ 70% non-numeric text.
- Total rows are skipped when the first cell matches /^(grand |sub)?total\b/i and ≤ half the columns are filled.

Column matching (impAutoMap), in this order:
1. Exact match on key or label (normalised: lowercase, strip (...) and non-alphanumerics).
2. The sender's saved format.
3. A remembered match (importMemory).
4. By the values, for ambiguous "Area" / "Location": numeric-looking values → area_sqft, otherwise locality, with the reason shown.
5. Synonyms: exact, then "contains" for synonyms of 4+ characters.
6. Otherwise "Keep as extra detail" if the column has values, else unused.
- A second column that maps to the same key becomes extra.
- `how` is one of: exact, format, remembered, ai, extra, none, you.

Synonyms:
- price ← rate, cost, amount, expected price, value, total price, price rs, price inr, quoted price, rs
- area ← size, plot size, plot area, sqft, total area, built up area, extent, land area, carpet area
- locality ← area name, location, place, neighbourhood, village
- city ← town, district
- title ← property name, plot name, project name, name, heading
- facing ← direction, orientation
- approvals ← approval, approved by, sanction
- roadWidth ← road, road ft, street width
- surveyNo ← sf no, survey, s no
- layoutApproval ← dtcp, approval no, layout no
- bhk ← config, configuration
- status ← availability
- listing_date ← date, listed on, date added
- property_id ← id, ref no, reference

Value cleaning:
- Prices: "30 L" / "36 lakhs" / "1.2 Cr" / "25k" → rupees, with the note "'30 L' read as ₹30,00,000".
- Numbers with units ("1200 sqft", "30 ft") → numbers, with a note.
- A 5-digit Excel serial → ISO date, with a note.
- Approvals: DTCP/CMDA/layout/building/plan → 'Building approval'; rera → 'RERA'; split on ; , / and "and".
- Selects: normalised equality, or prefix match (≥ 3 characters).

Column UI ("Check / change"):
- Summary: "10 of 13 columns matched · 4 by the AI · kept as extra details: … · not used: … · N values read from …".
- Grid per column: heading, ✨ when matched by the AI, "as last time", 2 sample values, and a select of fields + "Don't use" + "Keep as extra detail".
- A red warning when two columns map to the same field. Every change re-validates.

Saved formats:
- A "Sent by" input with a datalist of known senders.
- Signature = the set of normalised headings. A match needs ≥ 80% overlap with a saved format of the same type, and shows "ABC Realty's format recognised — columns matched as last time (used N×)".
- On import: non-exact matches go into importMemory, and the format is saved as `{id FMT-###, type, sender, sig, headers, map, uses, created, last, by}`.

Documents (the AI is mocked):
- The AI returns `{kind, pages, type, what, items:[{page, photos, quote, f:{field:value}, notes[], confirm[], extra:[{label,value}]}]}`. These feed the same Check screen.
- Items with `confirm` entries become drafts (for example "the price says 'onwards'"). Photos are attached.
- Banner: "Read by the AI: a builder's project brochure — Green Meadows · 8 pages · 3 properties found · 11 photos attached".
- Samples:
  - A board photo: "PLOT FOR SALE · 30 × 40 · EAST FACING · PONMENI · 24 L · CALL 98XXX XXXXX". City worked out from the locality, area from 30×40, phone kept as an extra.
  - A brochure: 2 BHK ₹68 L onwards, 3 BHK ₹89 L onwards, 3 BHK Premium ₹1.05 Cr; RERA number and builder kept as extras.
- Master §15.3 wants real PDF text, OCR, and sample files in public/samples.

Apply:
- Batch IMP-###.
- A draft row, or any new row from an executive, becomes a draft property (AddProperty.importDraft):
  - The executive's ready rows go to "Waiting for approval".
  - Missing details stay as "Draft"; the AI chat asks for them.
  - Source kept: {file, line, where, batch, confirm}.
- A ready new row from a manager is published:
  - title = given, else the AI title, else the type label.
  - Defaults: status Available, listingDate today.
  - **Approvals are all pending (never imported as verified).**
  - Extras kept; the pin comes from lat/lng; default nearby places are added.
  - History: "Created by bulk import IMP-003 (file, line 4, from ABC Realty, 2 photos) — title suggested by the AI".
- An update changes only the filled cells. New approvals are appended as pending; extras are merged. History "Updated by bulk import IMP-003: Asking price, Status".
- Batch record: `{id, date, by, type, file, sender, total, created[], updated[], drafts[], pending[], skipped, errors, photos}`.

Samples to replicate:
- The plot template sample, 10 rows: valid; "33,00,000"; blank title; missing length/width (→ draft); an update of PROP-1012's price; blank price (draft); facing "Eastern" (error); unknown PROP-9999 (error); area "abc" (error); a duplicate of PROP-1001 with "Helipad" (warnings).
- The owner's own sheet:
  - Title lines "ABC Realty – Plot list, November 2026" and "Prepared for the sales team", then a blank line.
  - Headings: Plot Name, Area Name, Town, Plot Size, Rate, Facing, Length, Breadth, Road, Survey No, Approval, Contact person, Owner remarks.
  - Values like "1200 sqft", "30 L", "36 lakhs", "31,00,000", "18 L", "30 ft", "DTCP".
  - A final "Total: 4 plots" row.

## 5. Projects — NOT in rebuild
Concept:
- A project is a builder's development; each **unit is an ordinary property** with projectId and `unit={block, floor, no, pos, corner}`. Matching, share, recommend and the pipeline therefore work unchanged.
- Managers create projects, edit the price list, mark units booked/sold and add blocks. Executives hold units **for their own leads**, recommend and share.

Project shape:
```
{id:'PRJ-001', name, builder, type:'flat'|'plot', city, locality, address, pincode, lat, lng,
 status:'Upcoming launch'|'Under construction'|'Ready', possession:'2027-06', launched,
 rera:'TN/35/Building/0456/2026', layoutApproval,
 approvals:[{k:'rera',status:'verified',file}], amenities[], images, brochure, description,
 blocks:[{name:'A',floors:4}] | [{name:'Phase 1',plots:12}],
 perFloor:2, mix:[{bhk,area,facing,corner}] (one per position on a floor), plotMix:[{length,width,facing}] (cycled),
 priceList:{basePsf:4400, floorRisePsf:40, cornerPct:3, parking:250000}, nearby (shared by every unit),
 createdBy, createdAt, history[]}
```
Unit hold (status Reserved): `{cust, by, at, until}`.

Unit generation:
- Flats:
  - Unit number `<block>-<floor>0<pos>` (A-101).
  - Specs: bhk; carpet = 0.8 × area; superBuiltup = area; floor; totalFloors; lifts 1; parking '1 covered'; possession = Ready to move if the project is Ready, else Under construction.
- Plots: numbered across phases; plotMix cycled; area = L×W; corner = the first and last plot of each phase; road 30 ft.
- Titles: "<Project> — A-101 · 2 BHK" or "<Project> — Plot 7". Status Available; listingDate = launched.
- Amenities, images and approvals are copied from the project. History: "Created as unit X of <Project>".
- **Price:**
  - rate = basePsf + (flat ? floorRisePsf × max(0, floor−1) : 0)
  - base = area × rate
  - corner = base × cornerPct/100 if the unit is a corner, else 0
  - parking = the parking charge (flats only)
  - total = round((base + corner + parking)/1000) × 1000

Screens:
- **List:**
  - Header text "Each unit is a property, so it is matched, shared and recommended like any other". Managers get ＋ New project.
  - Card contents:
    - Cover (🏢 or 🗺️ + photo count) and kicker ("Apartments · Under construction").
    - Name, builder · locality, city.
    - **Inventory bar** (available / held / booked / sold / other) and "N of M available".
    - Price range of available units, or "Sold out".
    - Footer: "🎯 N buyers fit", "✓ RERA", "Possession Jun 2027".
  - The sidebar shows the project count.
- **Project page:**
  - Header: price range "from ₹4,400/sq.ft.". KPIs: total, Available, Held for a buyer, Booked, Sold.
  - **Inventory grid:**
    - Flats: per block, floors top-down. Each cell shows no, bhk, corner, and the price if available, else "🔒 held" / "⌛ hold expired" / the status. A fit % badge shows when a buyer is focused. Cells are coloured by status.
    - Plots: a grid per phase.
    - Managers get "＋ Add block/phase": the next letter or "Phase N", copying the last block's size; units are generated and logged.
  - **Buyers who fit:**
    - Active leads with ≥ 1 non-excluded match among Available units, best first; the top 6 are shown.
    - Each row: name, "₹x max · stage · best: A-302", fit chip.
    - Clicking a buyer focuses the grid: fitting units are highlighted with %, the others dimmed, with a "show all" link.
  - **Price list:**
    - Fields: base ₹/sq.ft., floor rise (flats), corner %, parking (flats). Managers only.
    - The formula text ends with "Booked, sold and held units keep their price".
    - "Apply to available units" reprices only Available units. It logs unit history "Price ₹a → ₹b (project price list)" and project history "Price list applied to N available units", and toasts.
  - A hint shows when no unit is selected.
- **Unit panel:**
  - Status chip ("Held" for Reserved). Spec line: "2 BHK · floor 3 of 4 · 1,050 sq.ft. · East facing · corner".
  - **Price breakdown:** area × rate (incl. floor rise), corner premium, parking, Price, and "With stamp duty & registration" (allIn from the cost settings).
  - Hold note: "Held for <lead> by <exec> until D", or amber "hold expired on D — release or extend it".
  - Actions:
    - Available: a lead select (leads the user may hold for, sorted by fit, "Name — 86% fit") and **Hold 2 days**.
    - Release / Extend 2 days: managers, or whoever placed the hold.
    - Managers: Mark booked (from Available or Reserved), Mark sold (from Available, Reserved or Booked), Make available (from Booked or Sold; clears the hold).
    - Links: Open unit page and ↗ Share (available units only).
  - "Fits": the top 3 leads with "✓ Recommend".
- **New project** (managers only; executives see a lock message):
  - The type toggle sets the base rate default: 4500 flat, 2500 plot.
  - Fields: name*, builder, city*, locality* (datalist), status, possession, RERA.
  - Flats: blocks as a comma list, floors, per-floor count, and the per-position mix.
  - Plots: phases, plots per phase, and plotMix rows (add/remove).
  - Price list and amenities.
  - **Live preview** of the units and their prices.
  - On create: PRJ-###; a RERA approval is pending if a RERA number is given; lat/lng come from the city centre; units are generated; history "Project created with N units"; then go to the project page.

Hold rules:
- Hold days = 2. The unit must be Available, and the user must be a manager or own the lead.
- Placing a hold:
  - Sets Reserved and `{cust, by, at: today, until: today+2}`.
  - Logs on the unit history **and** the lead activity: "Unit A-301 at Lotus Residency (PROP) held for X until D".
  - Adds the unit to the lead's recommended and moves the lead forward to Property recommended.
- Expired = `until < today`. The wireframe has no auto-release; crm-e2e should surface or auto-release it.
- Extend: until = max(until, today) + 2. Release: Available, and logs on both.
- A manager status change logs unit history and, with a hold, lead activity "Unit X: Reserved → Booked for Name".
- The pipeline card shows "🔒 holding A-301 · Lotus Residency (expired)".

Seed:
- PRJ-001 Lotus Residency: flats, Madurai Anna Nagar, 2 blocks × 4 floors × 2 = 16 units.
  - Sold: A-101, A-102, B-101. Booked: A-201, B-102. B-301 held for CUST-1002 until D+1.
- PRJ-002 Green Acres Layout: 12 plots, Othakadai, DTCP. Sold: 1, 2. Booked: 5. Plot 8 held for CUST-1011, expired.

Also missing in the rebuild: the project tag on the property list, the project unit/hold info on the property page, and the sidebar Projects count.

## 6. Lead pipeline — NOT in rebuild
- Header: "Drag a card to move a lead… Moving to Lost asks for a reason. ⚠ marks leads stuck more than 14 days". Executive filter.
- **KPIs:**
  - Active leads (sub "N new enquiries").
  - **Pipeline value** = Σ budget.max of active leads.
  - Site visits this week = Scheduled visits from today to today+7.
  - Stuck = active leads with days in stage > stuckDays (14).
  - Closed (sub "₹x · N lost").
- **Funnel:**
  - Per stage (not Lost): a bar ∝ leads now at the stage, the count, the name and the ₹ total.
  - Arrows show the % that reached the stage out of those that reached the previous one (reached = stageIndex ≥ i; Lost excluded).
  - Clicking a stage filters the board ("Showing X only · Show all stages").
- **Colours:**
  - New enquiry #64748b, Contacted #2f5bea, Qualified #6a3fc4
  - Property recommended #0e8a8a, Site visit scheduled #c27a0e, Negotiation #d9622b
  - Booking/Closed #11743f, Lost #b42318
- **Board:** 7 stages + Lost. Column head: dot, name, count, "₹x in budgets"; empty columns say "Drop a lead here".
- **Card:**
  - Avatar tinted by readiness band, name, purpose icon.
  - Readiness bar "62 · Qualified lead". Requirement summary. "₹x max · exec".
  - "🏠 3 recommended: PROP… +1". "📅 visit D · PROP". "🔒 holding A-301 · Project (expired)".
  - Footer: the follow-up chip (or the lost reason in Lost) and days in stage ("⚠ 21d" when stuck).
  - Clicking opens the lead.
- **Drag and drop:** dropping moves the stage and toasts "Name → Stage". Dropping on **Lost** opens the stage modal with reason* + details.
- Master adds: a list view, a "Booked" dialog (amount + property), and AI for stalled deals / next actions / predictions.

## 7. Sales dashboard — NOT in rebuild
- KPIs:
  - Total leads (N active · N lost).
  - Qualified = reached Qualified or later (Lost leads counted by lostAtStage).
  - Site visits (N upcoming).
  - Bookings (x% of leads).
- Pipeline bars per stage, with an amber list of stuck leads "(stage, Nd)".
- **Follow-ups due** (overdue + today, sorted); empty text "Nothing due today. 🎉".
- Today's appointments.
- **Priority leads — next actions:** the top 8 active leads by readiness. Columns: requirement, readiness + band, best fit (label, PROP, M) or "No eligible property", stage, owner, follow-up.
- Readiness mix; Inventory by status; **Approval documents pending** (available properties with a claimed approval and no document, linked to the Legal tab).
- These widgets are the raw material for the role "Today" views (master §6).

## 8. Matching engine page — page NOT in rebuild (logic ported to lib/matching.ts)
- **Hard filters:** Available; type = req.type; city in req.cities; price ≤ max × (1 + flex%). Approval documents is a soft filter (it makes the match Conditional). Archived properties never match.
- **Components (0–100):**
  - B (budget): ≤ pref → 100; ≤ max → 100 − 30 × (p−pref)/(max−pref); ≤ ceiling → 55; else 0.
  - L (location): 100 with no localities listed, otherwise 100 in-list / 70 not.
  - S (size): 100 − |area−size|/size × 200, clamped.
  - A (amenities/infrastructure): infraScore per type, averaged 50/50 with amenity coverage. The infra checks:
    - plot: water, electricity at site, drainage, tar/concrete road
    - house: water not tanker, power, approval+completion, new/good condition
    - flat: lift or floor ≤ 1, parking, power backup, security
    - other: road ≥ 30 ft, parking, permitted usage
  - P (preferences): share of preference checks passed:
    - plot: facing, min road, corner
    - flat: bhk, parking, possession
    - house: bedrooms ≥ bhk, land area, parking, ready ⇒ approval+completion
    - commercial: category, occupancy
- **M = 0.30B + 0.25L + 0.20S + 0.15A + 0.10P**
- **Labels:**
  - A hard fail: "Budget mismatch" if only the budget failed, else "Excluded".
  - Legal not OK or S < 60: Conditional.
  - Otherwise ≥ 80 Strong, ≥ 65 Good, else Weak.
- **"Why" reasons:**
  - Price: preferred / maximum / uses the flexibility.
  - Size ±%. Locality preferred, or "city matches, locality not in preferred list".
  - ✓/✗ preference checks "(has: …)".
  - "⚠ X claimed, document pending — upload it before recommending".
- **Ranking:**
  - Eligible properties sort clean first, then by M. **Top = the first non-conditional; a conditional property is never top.**
  - matchesForProperty: active leads (not Lost or Closed) with non-excluded matches, sorted by M.
- **Page:**
  - Customer select.
  - Cards: Profile (purpose, looking for, budget + flex ceiling, timeline, approval wish); Formula (live weights + legend + Settings link); Result (eligible / conditional / excluded counts, the best recommendation, the critical rule).
  - **Step 1** table: every property × (Available, Type, Location, Budget, Approval docs) with ✓/✗/⚠ (tooltip = reason) and the label.
  - **Step 2** ranking: #, property (★ Top), B, L, S, A, P, M, label + reasons.
  - "Recommend from customer page →".
- Worked example (test fixture), Arun: ₹20–30 L (+5% → 31.5 L), 1,200 sq.ft., East, road ≥ 30, Vilangudi/Thirunagar.
  - PROP-1001: Strong 95, Top (B 82, L 100, S 100, A 100, P 100).
  - PROP-1002: Conditional 66 (doc pending, +25% size; B 70, L 70, S 50, A 50, P 100).
- Master §14 adds: possession, configuration and facing in the score; both directions; shortlist / WhatsApp / visit / not-interested actions; port the estate-platform tests.

## 9. HNI register — NOT in rebuild
- Executives get a 🔒 "Restricted to managers" card.
- Filter "Only investors, high-value & HNI-flagged" (classification in {High-value, Potential HNI, Verified HNI, Investor}, or HNI status ≠ Not determined). Sorted by max budget, descending.
- Table: Customer, Max budget, Purpose, Classification, HNI status, Signals n/7, Consent Yes/No, Reviewed. Rows open the lead's HNI tab.
- Side cards:
  - Status overview bars.
  - Rules:
    - A potential HNI is not a confirmed HNI.
    - A high budget does not mean HNI (example: CUST-1015).
    - No bank statements, tax returns or balances during lead generation.
    - Verification only through a lawful, consent-based process with restricted access.
    - Never judge by name, appearance, occupation, caste or religion.
- Suggested classification, first match wins:
  1. Verified HNI
  2. Potential HNI (potentialFlag)
  3. High-value prospect (max ≥ ₹1.5 Cr)
  4. Investor (Investment or Rental income)
  5. Qualified buyer (need Clear and ≥ 1 eligible match)
  6. General lead
- A manager override is stored in `classification`.

## 10. Reports — NOT in rebuild
- **Conversion funnel:** leads that reached each stage (Lost counted up to lostAtStage); "Enquiry → booking x%".
- **Where leads are stuck:** per stage, leads now, average days in stage, count over stuckDays.
- **Breakdowns:** by source; by purpose; reasons lost; requirement by property type; classification (all 6, zero counts included).
- **Unmet demand:** active leads with no eligible property ("input for sourcing new inventory").
- **Executive performance:** Active, Qualified+, Site visits, Bookings, Lost, Overdue follow-ups.
- Master adds: scoping (all / team / personal), charts, response time, calls, conversion and revenue.

## 11. Public enquiry form — NOT in rebuild
Five steps:
1. Purpose (cards, required).
2. Type*, size, localities, cities* (checkboxes). Changing the type resets the type-specific answers.
3. Budget:
   - min, pref, max* (> 0, min ≤ max)
   - flexibility: None / 5% / 10% (default 5)
   - basis ("Does this budget include registration & other costs?"), funding, funding status
4. Requirements and timeline:
   - Type-specific fields.
   - "When are you planning to purchase?" (default 1–3 months).
   - "Who will take the decision?": Myself / With family / Prefer not to say.
   - Boxes: approvals verified; site visit.
5. Contact:
   - name*, mobile*, email, contact preference.
   - Consent with the text "We never ask for bank statements or financial documents at this stage. You can withdraw consent at any time."

Submit:
- Creates a lead: source Website, New enquiry, owner = nextExecutive(), need Partly defined, responded.
- With consent (channel Website form), the follow-up is tomorrow.
- System activity: "Website enquiry received; auto-assigned to X; follow-up scheduled D" (or "…no consent…").

Thank-you page:
- "Thank you, Name! Your reference is CUST-x."
- Internal "Behind the scenes — what the CRM did": saved id/stage; assigned to whom (least-loaded); follow-up or not; matching counts + top; readiness score + band; classification + "HNI status: Not determined".
- Buttons: "Open in CRM →" and "Submit another enquiry".

## 12. Test scenario 001 (port as a Vitest/Playwright acceptance test)
Test customer:
- Own use, construct a house. ₹25–30 L (pref = max = 30 L, flex 0, property only), Combination funding, Arranging.
- Plot, Madurai, 1,200 sq.ft., approvals required, construction within 1 year.
- Joint authority, need Clear and specific, 1–3 months, responded.
- Runs with or without consent.

The system assigns the lead, sets a follow-up tomorrow only with consent, recommends the top match and sets the stage to Qualified.

The 9 checks:
1. Saved.
2. Plots matching location and budget found.
3. Unavailable properties excluded.
4. Pending-approval properties are Conditional and the top is legal-OK.
5. The recommendation exists and is legal-OK.
6. Assigned to an executive.
7. Follow-up set if and only if there is consent.
8. Classification = **Qualified buyer**.
9. HNI = **Not determined**.

## 13. Settings & business rules — only preferences in rebuild
- Executives get read-only inputs with a note.
- Rules and lists:
  - **Matching weights** B/L/S/A/P (step 0.05), "Sum 1.00" chip, live formula, red if ≠ 1.
  - **Readiness points** budget 25, requirement 20, timeline 20, funding 15, authority 10, engagement 10; must total 100.
  - **Bands:** high 80, qualified 60, developing 40; below that, Early-stage.
  - **High-value threshold** ₹1.5 Cr ("a suggestion only, never HNI"); **stuck days** 14.
  - **Transaction costs:** stamp duty 7%, registration 4%, other 1%.
  - **Executives:** rename; ＋ Add ("EX0n — New").
  - **Nearby place categories:** name, icon, group, Google type, route check, shown by default. A rename cascades to every property.
  - **Approval badges:** name, document, created by, "on N properties"; ＋ Add.
- **Demo data:** export JSON, import JSON (validated), and reset (with a confirm).
- The rebuild's Settings has no readinessPoints, bands or highValueThreshold; add them. Master §16 also adds assignment rules, an auto-distribution toggle, stages, templates and users.

Readiness score (each row = max points × factor):
- Budget: 1 if an eligible property is ≤ max; 0.5 if it fits only with flexibility; else 0.
- Need: Clear 1 / Partly 0.5 / Exploring 0.2.
- Timeline: ≤1 month 1 / 1–3 m 0.8 / 3–6 m 0.5 / 6–12 m 0.25 / undecided 0.
- Funding: Ready 1 / Arranging 0.55 / Undecided 0.
- Authority: Sole 1 / Joint 0.7 / Needs approval 0.4 / Unknown 0.
- Engagement: responded 0.3 + docs requested 0.3 + site visited 0.4.
- Each row is rounded; the total is out of 100. Show it without the word "BANT" (master §9).

nextExecutive():
- Picks the fewest active leads; a tie goes to the first in settings order (no round-robin).
- Master §10 adds: skip inactive / on-leave executives; round-robin on ties; rules by location, type, language and source; history; an on/off toggle.

## 14. Properties / Add / Share / search — done in rebuild (rules to respect)
- Property fields: id, title, type, purpose, status, archived, listingDate, city, locality, state, facing, area, price, amenities, images, specs, location{lat,lng,address,pincode,district,roadType,roadWidth,highway,nearby[]}, approvals[{k,status pending|uploaded|verified,file,…}], documents[], valuation{comparables[{location,type,area,pricePerSqft,kind Transaction|Asking,date,source,differences}]}, history, extra, projectId/unit/hold.
- **Completion score** (100): purpose 10, type 10, city 10, locality 10, price 10, area 10, key details 15, photos 10, legal documents 10, amenities 5.
- **Needs attention:** completion < 80; price outside the comparable range; Available ≥ 45 days with no visit; an approval document pending.
- **Price check:** neutral wording; buyer total = price × (stamp + registration + other)%.
- **Share brochure:**
  - Shows only verified approvals and only route-checked existing places.
  - Never shows the owner contact, notes, price check, documents, or survey/layout numbers.
  - Sharing with a buyer logs it and counts as a recommendation.
  - Off for sold or archived properties.
- Executive properties wait for approval; managers publish and change status.

## 15. Role rules in the wireframe (input for the permission map)
- **Managers only:**
  - HNI register/tab/classes.
  - Settings edits.
  - Property status changes.
  - Reassigning leads.
  - Publishing, approving and updating published properties (including via import).
  - Forgetting import formats.
  - Projects: create, price list, apply, add block, booked/sold/available.
  - Holding units for any lead.
- **Executives:**
  - Import, but ready rows go for approval and published-row updates are errors.
  - Hold units only for their own leads, and release/extend only their own holds.
- **Appointments and pipeline:** no role restriction in the wireframe.
- **No owner data scoping** anywhere in the wireframe: an executive sees all leads, appointments and the pipeline. crm-e2e must scope them (master §5.3).

## 16. Not in the wireframe at all (design new, from the master prompt)
- Users / team management: activate, on leave, 3 exec accounts.
- Assignment rules, round-robin and assignment history.
- Tasks / follow-ups as entities.
- Notifications centre and a global activity log.
- Role "Today" views.
- Leads import and .xlsx templates; real PDF/OCR.
- Appointment video/registration types, Confirmed/Rescheduled, reminders, map link, AI prep and summary.
- Pipeline list view, Booked dialog, AI stalled-deal detection.
- A Clients view.
- Pan-India cities and master-prompt lead sources.
- Carpet / built-up / super built-up for every residential type; RERA number; possession; furnishing; NRI; loan needed; decision makers.
=== END analysis-spec-wireframe.md ===

Relevant paths:
- Target (to be written by the lead): E:\real-estate\crm-e2e\notes\analysis-spec-wireframe.md
- Main source files: E:\real-estate\spec-system-wireframe\views-appointments.js, E:\real-estate\spec-system-wireframe\views-import.js, E:\real-estate\spec-system-wireframe\views-projects.js, E:\real-estate\spec-system-wireframe\views-sales.js, E:\real-estate\spec-system-wireframe\views-customers.js, E:\real-estate\spec-system-wireframe\views-tools.js, E:\real-estate\spec-system-wireframe\logic.js, E:\real-estate\spec-system-wireframe\data.js, E:\real-estate\spec-system-wireframe\app.js
- Rebuild types compared: E:\real-estate\wireframe-rebuild\src\data\types.ts, E:\real-estate\wireframe-rebuild\CHECKLIST.md