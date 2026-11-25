# RealSpec CRM — wireframe rebuild checklist

What the clickable wireframe (`spec-system-wireframe/`) has, and how far the React rebuild (`wireframe-rebuild/`) has got.
Updated 25 Nov 2026.

- `[x]` done in the rebuild
- `[ ]` not done yet
- **Changed:** works differently from the old wireframe, on purpose
- **New:** not in the old wireframe, added during the rebuild

## Order of work (agreed 24 Nov)

1. **Core modules first:** Properties → Leads → Bulk import → Appointments → Pipeline
2. **Then:** dashboard, the sales team's own journeys ("My day"), and who can see and do what (roles and permissions)

## Summary

| Section | Status |
|---|---|
| App shell (sidebar, top bar, demo ribbon) | Done |
| Theme (light / dark) and language (English / Tamil) | Done |
| Properties — list | Done |
| Properties — property page | Mostly done; design changes in progress |
| Properties — Drafts, Add property with AI, Edit with AI, Share page | Not started |
| Leads (list, add / edit, lead page) | Not started |
| Bulk import | Not started |
| Appointments | Not started |
| Lead pipeline | Not started |
| Settings — your preferences | Done |
| Settings — business rules | Not started |
| Sales dashboard, Projects, Matching engine, HNI, Reports, Public enquiry form | Not started (after the core modules) |

---

## 1. Foundation

- [x] React, Vite, TypeScript, Tailwind CSS, shadcn/ui
- [x] Demo data saved in the browser, shaped like the real database
- [x] Shared components: page header, section card, status chip, chip, table, side panel, confirm dialog, empty state and others
- [x] One theme file: every colour, text size and rounding comes from `src/index.css`
- [x] **Changed:** Light theme (light blue) and Dark theme (warm dark with orange), plus "Match my device"
- [x] English and Tamil for every screen
  - [ ] A fluent Tamil speaker checks the Tamil text before a demo
- [x] Works on phone, tablet and laptop
- [ ] Remove the temporary **UI kit** page before the demo

## 2. App shell (every page)

- [x] Demo ribbon: "WIREFRAME … fictional data", demo date, **Reset demo data**
- [x] Sidebar with groups and live counts (Properties, Leads, Appointments)
  - [ ] Projects count, once Projects is built
- [x] HNI qualification shows 🔒 to Sales executives
- [x] **New:** sidebar stays fixed while the page scrolls; it can be collapsed to icons, with tooltips
- [x] Top bar: breadcrumbs, "Public enquiry", "＋ Lead", "＋ Property"
- [x] "Viewing as" role switch (Admin / Sales manager / Sales executive), remembered
- [x] **Changed:** the English / தமிழ் switch moved to Settings
- [x] **Changed:** "System map" and "Test scenario 001" removed from the menu (24 Nov)

## 3. Properties

### 3.1 Property list

- [x] Header buttons: Drafts (count), ＋ Add property, Bulk import
  - [x] Drafts and Add property are built (see 3.3); Bulk import is still a placeholder
  - [x] **New:** executives see Drafts (their own) and Add property too; managers see how many drafts wait for approval
- [x] Keyword search: every word must match, in any order
- [x] ✨ AI search: type or speak a sentence ("2 BHK flat in Madurai under 60 lakh"), with example phrases
- [x] Filter pills: Type, City → Locality, Budget, Size, More (purpose, facing, corner, amenities), with ✕ on each and "Clear all"
- [x] Sort: Newest, Price ↑↓, Least complete
  - [x] **New:** Oldest, Area ↑↓, Most complete
- [x] Status tabs with counts (All, Available, Under negotiation, Reserved, On hold, Booked, Sold, Archived); empty tabs hidden
- [x] "✨ N properties need attention" strip: missing details, price out of range, no site visits in 45+ days, approval documents pending; each with a fix link
- [x] No results: "Show N without [filter]"
- [x] Pager: rows per page, Prev / Next, "Showing x–y of N"
- [x] Table: Property, Location, Area, Asking price, Status, Listed, Completion score
  - [x] **Changed:** the Property ID sits under the title, not in its own column
  - [ ] Project tag on units that belong to a project (needs Projects)
- [x] **New — grid view:** photo cards (price, type, place, key facts, leads that fit, completion); Grid / Table remembered per person
- [x] **New:** cover photo thumbnails in the table, real demo photos
- [x] **New:** sort by clicking a column header
- [x] **New:** "Leads" column; the count opens Matching customers
- [x] **New:** tick several properties → Change status, Export CSV, Archive / Restore
- [x] **New:** ⋯ menu on each row (Open, Edit with AI, Share, Matching customers, Change status, Archive)
- [x] **New:** View options — Comfortable / Compact, and which columns to show
- [x] **New:** columns adapt to phone, tablet and laptop; the ⋯ menu always stays in view
- Set aside, to do when wanted:
  - [ ] "New" and "Price ↓" badges on cards
  - [ ] Sort by number of leads
  - [ ] Tick cards in the grid view
  - [ ] Share several properties at once
  - [ ] Show what's inside "More · 2"

### 3.2 Property page

**Header**
- [x] Title, with ✎ for managers
- [x] **Changed:** one line of facts (ID · type · purpose · place · area · facing · listed date); chips only for approvals
- [x] Price and ₹/sq.ft.
- [x] Managers: status menu, ✨ Edit with AI, Share, ⋯ (Archive)
- [x] Executives: status, Share, "🔒 Changes by a manager"
- [x] Archived: banner, Restore, Delete
- [x] Archive dialog with an optional reason
  - [ ] List the linked leads and warn about upcoming appointments
- [x] Delete dialog
  - [ ] Block Delete when leads are linked, and offer "Archive instead"
- [ ] Project unit link and hold information (needs Projects)

**Overview tab**
- [x] Photo strip
  - [x] **New:** full-screen photo viewer
  - [x] **New:** real photo upload for everyone
  - [x] **New:** managers set the cover or remove any photo
- [x] Property details: main information, "<type> details x of y filled", amenities, "＋ add a detail" chips
- [x] Explore the neighbourhood:
  - [x] Team / Customer view
  - [x] Map with 1 / 3 / 10 km rings
  - [x] Grouped places
  - [x] Set or change location
  - [x] Find more places
  - [x] Add a place
  - [x] Mark route checked
  - [x] Rule: only checked, existing places are advertised
- [x] Side cards:
  - [x] Price check, or the Deal card when the property isn't available
  - [x] To do list
  - [x] Best-matching buyers
- [ ] **Planned — step 2:** "At a glance" key facts as icon tiles; Property details keeps only the remaining facts
- [ ] **Planned — step 3:** title, price, Share and tabs stay visible while scrolling; the side cards stay in view
- [ ] **Planned — step 4:** phone layout: shorter header, actions in a bar at the bottom
- [ ] **Planned — step 5:** Legal document actions in a ⋯ menu; price range shown as one bar

**Legal & documents tab**
- [x] Approvals: Document pending / uploaded / Verified; Upload, View, Replace; managers mark verified or remove
- [x] "Add a badge" chips; managers create a new approval type
- [x] Other documents, with one-click chips for the usual documents
- [x] Note: never says "100% legally clear"; documents shared only on request

**Price tab**
- [x] Asking price, total for the buyer (stamp duty, registration, other)
- [x] Market check: in line / below / above, range and recent sales average
- [x] ₹/sq.ft. comparison bars, and the neutral-wording rule
- [x] Similar properties found automatically; "Not similar" / "Bring back"; ＋ Add from outside

**Matching customers tab**
- [x] "N buyers fit" with strong / good / weak / conditional counts; sort by best fit or most ready
- [x] Each buyer: fit score and label, "Why N?", talking points, Recommend, site-visit booking
- [x] "Close — over budget" buyers

**History tab**
- [x] Filter chips (Details, Price, Status, Location, Documents, Photos, Buyers), grouped by day

### 3.3 Still to build in Properties

- [x] **Drafts page:** same search, filters and pager as the list; tabs Draft / Ready to publish / Waiting for approval; "Needs: …" per row
  - [x] Executives see the drafts they started; managers see everyone's
- [x] **Add property with the ✨ AI assistant:**
  - [x] Chat that fills details from plain language, one question at a time, with quick replies; then photos, amenities and approvals (each skippable)
  - [x] Saved as a draft property (with its conversation) once the type is known; picked up again at /properties/:id/edit
  - [x] Decision cards, one at a time with buttons: possible duplicate, new amenity, new detail, lakh or crore, unusual price, map pin
    - [x] Publish waits until the open cards are answered
    - [x] "Add to list" / "For every <type>" change the master lists, so managers only; executives get "Only here" or "Skip"
  - [x] Summary card with completion ring, suggested title (✎ to change), checklist and "Needed to publish"
  - [x] Publish (managers) or Submit for approval (executives)
  - [x] Managers Approve & publish or Send back (in the chat and on the summary card); a sent-back draft says so in its chat
  - [x] "Review all details" button that opens the drawer; the summary's Add buttons open the drawer at that field
  - [x] Drawer tabs: Details (four sections), Media, Legal documents, History; each tab has its own address
    - [x] **New:** a change in the form moves the chat on to the next question
    - [x] "＋ Something else": a detail for this property only (also shown on the property page)
  - [x] Where each value came from: ✨ AI, 🗺 Google, auto, 📄 file
- [x] **Edit with AI:** the same page for a published property; "Save these changes?" table (old → new); managers only
  - [x] Changes in the details drawer save straight away; "Done — back to the property"
- [x] **Share page (customer brochure):** /properties/:id/share
  - [x] Brochure preview for a buyer or "Anyone" ("Prepared for …", "Talk to" their executive)
  - [x] Options to show total cost, exact location and extra details
  - [x] "Before you share" checks and "never on the brochure" list (internal fields named)
  - [x] Copy link, Download PDF (prints the brochure only), share log
  - [x] **New:** Send on WhatsApp (simulated) when a buyer is chosen; "See the brochure" from the quick Share panel
  - [x] The quick **Share panel** (choose a lead, then WhatsApp, Copy link or PDF) already works from the list and the property page

## 4. Leads — next module

- [ ] **Leads list:**
  - [ ] Search; filters by stage, executive, purpose, property type and readiness band; sort
  - [ ] Columns: purpose, looking for, budget, readiness, classification, stage, owner, next follow-up (overdue / today)
  - [ ] HNI classification shows "Restricted" to executives
- [ ] **Add / edit lead:**
  - [ ] Basic information; assigned executive (auto-assign to the least busy); stage; consent to follow up
  - [ ] Purpose; budget (min / preferred / max / flexibility, what it includes, funding)
  - [ ] Requirements, with fields per property type; readiness questions
  - [ ] Checks: required fields; min and preferred ≤ max
- [ ] **Lead page — header:** stage, readiness, classification, consent; owner (managers); next follow-up; Move stage (Lost needs a reason); Log activity
- [ ] **Lead page tabs:**
  - [ ] Overview: property fit, readiness out of 100, HNI status, requirements, budget, classification (with manager override), sales record
  - [ ] Qualification: questions with suggested wording, readiness points table
  - [ ] Property matches: fit score and its parts, recommend, schedule site visit, excluded properties with reasons
  - [ ] Follow-ups & activity: log activity, timeline, consent record / withdraw, site visits, negotiation, reason lost
  - [ ] HNI assessment (managers only): signals, verification with consent, classification ladder

## 5. Bulk import

- [ ] Steps: Upload file → Check → Done
- [ ] Choose the property type; drop Excel, CSV, a PDF brochure or photos; sample files; download the template
- [ ] Column matching (exact, remembered, a sender's saved format, or ✨ AI), with "Check / change"
- [ ] Values converted ("30 L", "1.2 Cr", "1,200 sqft", Excel dates)
- [ ] Row checks: errors, warnings and notes, each explained
- [ ] Review with filter chips; download the rows that need fixing; "Update existing properties"
- [ ] Rules:
  - [ ] Incomplete rows become drafts
  - [ ] Executives' rows go for approval
  - [ ] An existing ID updates only the filled cells
- [ ] Done screen with counts and links; past imports; saved formats

## 6. Appointments

- [ ] Key numbers: today, next 7 days, needs an outcome, completed
- [ ] Calendar: Day, Work week, Week, Month and List views; click a free slot to book
- [ ] Filters: executive, type, status, property
- [ ] Book / reschedule: customer, type, property, date, time, length, executive; clash warning ("Book anyway")
- [ ] Appointment details: reschedule, mark completed (outcome, interest, next follow-up), no-show, cancel, book a follow-up
- [ ] Effects:
  - [ ] Logged on the lead's timeline
  - [ ] A booked site visit moves the lead to "Site visit scheduled"

## 7. Lead pipeline

- [ ] Filter by executive
- [ ] Key numbers: active leads, pipeline value, site visits this week, stuck leads, closed
- [ ] Sales funnel with the % that got at least that far; click a stage to show only it
- [ ] Board, one column per stage plus Lost: readiness, budget, recommended properties, next visit, days in stage (⚠ stuck)
- [ ] Drag a card to another stage; dropping on Lost asks for the reason

## 8. Settings & business rules

- [x] **New — Your preferences:** theme and language
- [ ] Read-only for Sales executives
- [ ] Matching weights (must add up to 1.00, live formula)
- [ ] Purchase readiness points (must total 100)
- [ ] Lead classification bands
- [ ] Classification & follow-up (high-value threshold, stuck-lead days)
- [ ] Transaction cost assumptions (stamp duty, registration, other)
- [ ] Sales executives (rename, add)
- [ ] Nearby place categories (icon, group, Google type, route check, shown by default)
- [ ] Approval badges (name, document, in use on N properties)
- [ ] Demo data: export, import, reset

## 9. After the core modules

**Sales dashboard**
- [ ] Key numbers: total leads, qualified, site visits, bookings
- [ ] Pipeline bars and stuck leads
- [ ] Follow-ups due
- [ ] Today's appointments
- [ ] Priority leads — next actions
- [ ] Readiness mix
- [ ] Inventory by status
- [ ] Approval documents pending

**Projects**
- [ ] Project cards: inventory bar, price range, buyers who fit, RERA, possession
- [ ] Project page:
  - [ ] Unit grid by block / floor or phase
  - [ ] Unit panel: price breakdown, hold for 2 days, release / extend, mark booked / sold
  - [ ] Buyers who fit
  - [ ] Price list applied to available units
- [ ] New project (managers): blocks and flats or phases and plots, price list, preview of units created

**Matching engine**
- [ ] Choose a lead; their profile and the weighted formula
- [ ] Step 1: hard filters, every property against available / type / location / budget / approval documents
- [ ] Step 2: ranking with each part of the score

**HNI qualification**
- [ ] Managers only
- [ ] Register of leads with signals, consent and review date
- [ ] Status overview
- [ ] Rules card

**Reports**
- [ ] Conversion funnel
- [ ] Where leads get stuck
- [ ] Leads by source and by purpose
- [ ] Reasons lost
- [ ] Demand by property type
- [ ] Unmet demand
- [ ] Sales executive performance

**Public enquiry form**
- [ ] 5 steps: purpose, property and location, budget, requirements and timeline, contact and consent
- [ ] Submitting creates a lead, assigns it, sets a follow-up only with consent
- [ ] Thank-you page with "what the CRM did"

**From the reviews (CTO, 17 and 20 Nov) — to plan together later**
- [ ] A home page per role (Sales executive: my leads, my tasks, the next action)
- [ ] Matching shown prominently, not two or three clicks deep
- [ ] Who can see which data and do which action (roles and permissions)
- [ ] AI reading a full brochure to add a property

## 10. Business rules to carry over

These run behind the screens. They're already in the rebuild where Properties uses them; the rest come with their modules.

- [x] Match fit score: M = 0.30 budget + 0.25 location + 0.20 size + 0.15 amenities / infrastructure + 0.10 preferences
- [x] Hard filters: available, type, preferred city, price within max budget + flexibility; archived never matches
- [x] Match labels:
  - [x] Conditional: approval document missing, or size score below 60
  - [x] Strong: 80 or more
  - [x] Good: 65 or more
  - [x] Otherwise: Weak
- [x] Listing completion score out of 100 (purpose, type, city, locality, price, area, key details, photos, documents, amenities)
- [x] "Needs attention" rules (below 80%, price out of range, 45+ days without a visit, document pending)
- [x] Price check against similar properties; total cost for the buyer
- [ ] Purchase readiness out of 100, and its bands (High-priority 80+, Qualified 60+, Developing 40+)
- [ ] Suggested classification, in order:
  - [ ] Verified HNI
  - [ ] Potential HNI
  - [ ] High-value prospect
  - [ ] Investor
  - [ ] Qualified buyer
  - [ ] General lead
- [ ] HNI verification only after consent; a high budget never makes someone an HNI
- [ ] Auto-assign new leads to the least busy executive
- [ ] No follow-up date without consent
- [ ] Automatic stage moves, forward only:
  - [ ] Recommending or sharing a property → "Property recommended"
  - [ ] Booking a site visit → "Site visit scheduled"
- [ ] Lost needs a reason; stuck lead after 14 days in one stage
- [ ] Project unit price (area × rate + floor rise + corner + parking); holds last 2 days
