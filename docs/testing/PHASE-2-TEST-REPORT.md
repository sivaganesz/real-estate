# Phase 2 test report — Properties, Property types and Bulk import

| | |
| --- | --- |
| **Date** | 13 November 2026 |
| **Scope** | Phase 2.1 Property types & amenities · 2.2 Properties data, API & media · 2.3 Property UI & map · 2.4 Bulk import from Excel |
| **Build tested** | `main` at `a4a5677` + the two import fixes described in [§7](#7-bugs-and-issues) |
| **Category in scope** | Residential (Residential Plot, Villa / House, Apartment / Flat). Commercial and Other are "set up later" and were checked only to confirm they stay disabled. |
| **Overall status** | ✅ **PASS.** 2 bugs found and fixed, 0 open bugs, 4 minor observations ([§9](#9-overall-phase-2-status)) |

---

## 1. Summary

| Activity | Result |
| --- | --- |
| Automated test suites (shared, API, admin) | **250 / 250 passed** |
| Lint, typecheck, format check | **All clean** |
| Browser end-to-end suite on an isolated test copy | **47 / 47 passed** in the final state (run 4: 46 / 47; the one timeout was re-checked and passed 3 / 3; see [§6](#6-test-cases-and-results)) |
| Live re-checks of the two bug fixes | **2 / 2 passed** |
| Real data in the development app (3 plots by form + 12 by Excel) | **10 / 10 passed.** All 15 new plots appear correctly on the Properties list |
| Bugs found | **2** (both High, both in "update existing properties" during import). **Both fixed** and covered by new automated tests |
| Open bugs | **0** |

---

## 2. Testing approaches

| # | Approach | What it gives | Tools |
| --- | --- | --- | --- |
| A | **Automated unit & integration tests**: run the whole existing suite, plus new regression tests for each bug | Business rules, API contracts, validation, permissions | Vitest, Supertest, in-memory MongoDB, Testing Library |
| B | **Static checks** | Type safety, code style | ESLint, `tsc`, Prettier |
| C | **Browser end-to-end (E2E)**: a script drives the real admin UI like a user, on an **isolated copy** (own API, database and upload folder), so the development data is never touched | Full user journeys: forms, uploads, map, statuses, import, list | Puppeteer + Google Chrome (headless) |
| D | **API-level checks**: the same E2E run calls the REST API directly to compare stored values with what the UI shows, and to test permission refusals | Data correctness behind the UI | `fetch` against `/api/v1` |
| E | **File round-trip**: download the Excel template, fill it with a script, upload it, then download and read the error report | Excel template, parser and report | ExcelJS |
| F | **Negative & boundary testing**: invalid inputs, wrong file types, wrong purposes, duplicates, private photo links, 6 area units with conversions | Validation and safety rules | Built into C, D and E |
| G | **Role-based testing**: the same screens and API calls as Super Admin, Admin and Sales Agent | Access control | Three test users |
| H | **Responsive, theme and console monitoring**: 390 px phone width, dark theme, every browser console error collected during the run | Layout and runtime quality | Puppeteer |
| I | **Real-data run in the development app**: plots added through the form and an Excel import, checked on the Properties list | What the team will actually see | Puppeteer + API |
| J | **Visual review**: screenshots of each key screen, read by a person | Things scripts don't catch (labels, layout, wording) | Screenshots taken during the run (reviewed, not kept in the repo) |

---

## 3. Environments

| Environment | Admin | API | Database | Used for |
| --- | --- | --- | --- | --- |
| Isolated test copy | `localhost:5174` | `localhost:4100` | `real_estate_e2e` (dropped after testing) | Approaches C–H. Separate upload folder; 3 temporary test users (Super Admin, Admin, Sales Agent) |
| Development app | `localhost:5173` | `localhost:4000` | `real_estate` | Approach I. Existing data and settings were left unchanged; only new plots were added |
| Automated tests | — | in-process | in-memory MongoDB | Approaches A and B |

Browser: Google Chrome (headless), desktop viewport 1440 × 1000, mobile viewport 390 px. Map and address lookup used the real OpenStreetMap / Nominatim services.

---

## 4. Features and functions tested

| Phase | Feature | Covered by |
| --- | --- | --- |
| 2.1 | Property types: Residential with 3 subcategories; Commercial / Other disabled ("set up later") | SET-01 |
| 2.1 | Add attribute (dropdown with options), make an attribute required, duplicate-name check with "use existing" | SET-02 – SET-04 |
| 2.1 | Amenities per subcategory | SET-05, IMP-03, DEV run 1 |
| 2.2 | Create property as Draft; property codes (`RE-PLT-000001`…) | PRP-03, PRP-07, PRP-08 |
| 2.2 | Field validation (name length, pincode, numbers) | PRP-01, IMP-03 |
| 2.2 | Purpose rules (plots: Sale or Lease only; no Rent) | PRP-02, IMP-03 |
| 2.2 | Price, price on request, negotiable, monthly rent, deposit, lock-in | PRP-06 – PRP-08, DEV-02, DEV-03 |
| 2.2 | Area units and conversion (sq.ft, sq.yd, cent, ground, acre) | PRP-07, DAT-01, DEV-02, DEV-08 |
| 2.2 | Photos (upload, cover, wrong type rejected), brochure PDF | MED-01 – MED-03, DEV-01 |
| 2.2 | Publish rules (photo + required details); status lifecycle; archive / restore | PRP-04, PRP-05, STS-01 – STS-04 |
| 2.2 | Remove an attribute from one property; add a "this property only" attribute | PRP-08 |
| 2.2 | Duplicate property; change subcategory | PRP-11 |
| 2.2 | Change history | PRP-09, STS-02 |
| 2.2 | Permissions (Super Admin / Admin / Sales Agent) on UI and API | ROL-01 – ROL-04 |
| 2.3 | Property list: tabs with counts, search, filters, sort, pagination, bulk status | LST-01 – LST-05, DEV-07, DEV-09 |
| 2.3 | Add / edit form, unsaved-changes warning, city suggestions | PRP-01 – PRP-10 |
| 2.3 | Detail page with every value, map, Google Maps link | PRP-06, DEV-01, DEV-08 |
| 2.3 | Map pin and address lookup (real OpenStreetMap) | PRP-03, MAP-01, DEV-01 |
| 2.3 | Phone width, dark theme, no console errors | UI-01 – UI-03, DEV-10 |
| 2.4 | Excel template per subcategory (columns, dropdowns, instructions) | IMP-01, DEV-04 |
| 2.4 | Upload and row check: valid / invalid / duplicate, messages that name the column | IMP-03, IMP-04, DEV-05 |
| 2.4 | Error report (.xlsx with an Errors column) | IMP-05 |
| 2.4 | Import as Draft / Published, skip / update duplicates, photo links downloaded, private links refused | IMP-06, DAT-02, DAT-03, DEV-06 |
| 2.4 | A file can be imported only once; import history | IMP-07, IMP-08 |
| 2.4 | Imported data shown correctly on list and detail pages | LST-01, DAT-01, DEV-07, DEV-08 |

---

## 5. Bulk upload testing

### 5.1 E2E Excel file: `phase-2-e2e-residential-plots.xlsx` (30 records)

The template was **downloaded from the app** (Bulk Import → Residential Plot → Download template) and filled by a script, so the test used the real column layout. File: [`phase-2-e2e-residential-plots.xlsx`](phase-2-e2e-residential-plots.xlsx).

| Rows | What they test |
| --- | --- |
| 24 valid | 8 localities in 5 cities (Chennai, Coimbatore, Madurai, Tiruchirappalli, Salem); 20 Sale + 4 Lease (per month); 5 area units (sq.ft, cent, ground, sq.yd, acre); all plot attributes (facing, dimensions, road width, corner plot, approval type, layout, plot number, soil type); amenities; 3 featured; row 1 with a public photo link; row 2 with one public and one **private** (`127.0.0.1`) photo link |
| 4 invalid | Bad pincode `6000`; price "Twenty lakhs"; purpose **Rent** (not allowed for plots) + an amenity not offered for plots; name too short + area "big" + an `http://` (not https) photo link |
| 2 duplicates | A repeat of row 2 in the same file; a row matching an existing property (Plot A: same locality, pincode and plot number `A-12`) |

**Results**

| Step | Expected | Actual | |
| --- | --- | --- | --- |
| Check | 30 rows · 24 valid · 4 invalid · 2 duplicates | 30 · 24 · 4 · 2. All 7 expected messages shown, e.g. *"Pincode: Enter a valid 6-digit pincode"*, *"Price (₹): "Twenty lakhs" isn't a number"*, *"Residential Plot can be listed for: Sale, Lease"* | ✅ |
| Duplicates | Row 26 "Same as row 2 in this file"; row 31 "Already exists as RE-PLT-000001" | Both shown | ✅ |
| Error report | 6 rows (4 invalid + 2 duplicates) with an Errors column first | 6 rows, Errors column | ✅ |
| Import (as Published, update duplicates) | 24 created + 1 updated; rows without a photo saved as Draft with the reason; private photo link refused | **24 created · 1 updated · 5 skipped · 22 saved as Draft instead of Published · photos: 2 added, 1 failed** (*"photo 2 skipped: links to private network"*) | ✅ |
| Import again | Refused | `409 ALREADY_IMPORTED` | ✅ |
| History | File, rows, result | `phase-2-residential-plots.xlsx · 30 · 25 · as Published · 2 · 4 · Error report` (the file was uploaded under this name; the copy here is renamed `phase-2-e2e-…`) | ✅ |
| Properties list | 28 properties (4 by form + 24 imported), codes RE-PLT-000001…028 | 28, all codes present | ✅ |

### 5.2 Development-app Excel file: `phase-2-dev-residential-plots.xlsx` (12 records)

A realistic sheet for the team's own app. File: [`phase-2-dev-residential-plots.xlsx`](phase-2-dev-residential-plots.xlsx).

- 12 Residential plots across 6 cities: Chennai (Tambaram, Medavakkam, Guduvanchery, Oragadam), Coimbatore (Vadavalli, Kovaipudur, Thudiyalur), Madurai (Anna Nagar, Thiruparankundram), Tiruchirappalli (Srirangam), Salem (Fairlands) and Erode (Perundurai).
- 10 Sale and 2 Lease (₹22,000 and ₹15,000 per month, with deposit and lock-in).
- Areas in sq.ft, cent, ground, sq.yd and acre.
- DTCP, CMDA, Panchayat and Unapproved approvals.
- 2 featured; 3 rows with a public photo link.

| Step | Result | |
| --- | --- | --- |
| First upload | 11 valid, **1 invalid**: *"Amenities: "Rainwater harvesting" isn't an amenity of Residential Plot"*. Correct: in this app's settings that amenity isn't enabled for plots. Nothing was imported. The checked file stays in Import history as "checked". | ✅ validation works |
| Corrected upload | **12 rows · 12 valid · 0 invalid · 0 duplicates** | ✅ |
| Import as Published | **12 created · 0 skipped · 9 saved as Draft instead of Published · photos: 3 added**. The 3 rows with a photo link are Published; the 9 without stay Draft with *"Add at least one photo"* | ✅ |
| Data check (all 12 rows) | Price, area and unit, city, locality, pincode, plot number, approval type, status and deposit match the sheet | ✅ |
| Detail page (Salem row) | ₹56 L · 0.25 acre · 104 x 104 ft · Fairlands, Salem · DTCP · FG-01 · amenities | ✅ |

---

## 6. Test cases and results

**Legend:** ✅ passed · ❌ failed · 🔁 failed first, passed after a fix or re-check (reason given)

### 6.1 Automated suites (after both fixes)

| Package | Test files | Tests | Result |
| --- | --- | --- | --- |
| `packages/shared` | 6 | 33 | ✅ 33 / 33 |
| `apps/api` | 21 | 158 | ✅ 158 / 158 (includes 2 new regression tests) |
| `apps/admin` | 15 | 59 | ✅ 59 / 59 |
| Lint / typecheck / format | — | — | ✅ clean |

### 6.2 Browser E2E (isolated test copy)

| ID | Area | Scenario | Approach | Expected | Actual | Result |
| --- | --- | --- | --- | --- | --- | --- |
| ROL-01 | Roles | Super Admin menus | Sign in, read sidebar | Properties, Bulk Import, Users & Roles, Settings | Same | ✅ |
| SET-01 | Settings | Residential complete; Commercial / Other "set up later" | Settings → Property types | 3 subcategories, 5 locked core attributes, Commercial / Other disabled | Same | ✅ |
| SET-02 | Settings | New dropdown attribute "Soil type" for Residential Plot | Add attribute drawer | Saved with options | Red soil, Black soil, Sandy | ✅ |
| SET-03 | Settings | Existing name blocked, reuse offered | Type "LIFT" | "Already exists" + Use it; Create disabled | Same | ✅ |
| SET-04 | Settings | Make "Approval type" required | Edit attribute | Shows Required | Same | ✅ |
| SET-05 | Settings | Amenity "Water connection" for plots only | Amenities tab | Listed for Residential Plot | Same | ✅ |
| PRP-01 | Add property | Short name, bad pincode | Save draft | Field errors, nothing saved | Same | ✅ |
| PRP-02 | Add property | Plots: Sale / Lease only | Purpose buttons | Rent disabled | Sale on, Rent off, Lease on | ✅ |
| PRP-03 | Add property | Plot A with attributes, amenities, address, map pin | Full form + map click | Draft RE-PLT-000001 | RE-PLT-000001, pin 11.073, 77.017 | ✅ |
| PRP-04 | Publish rules | Draft without photo can't be published | Checklist + Publish | Blocked with reason | Same | ✅ |
| MED-01 | Media | 2 photos + brochure; first is cover | Upload | 2 photos (cover on 1st), 1 document | Same | ✅ |
| MED-02 | Media | Text file as photo | Upload notes.txt | Rejected | "Allowed file types…" | ✅ |
| MED-03 | Media | Change cover | Star button | Cover moves to photo 2 | Same | ✅ |
| PRP-05 | Publish rules | Publish after photos | Publish | Published | Same | ✅ |
| PRP-06 | Detail | All values shown | Read detail page | 16 values incl. ₹38 L, 2,400 sq.ft, map link, brochure | All 16 | 🔁 run 3: the page was read mid-navigation (test timing). Passed after the script waited for the page |
| PRP-07 | Add property | Plot B for Lease, 5 cent | Form, Lease | 5 cent = 2,178 sq.ft; rent per month | ₹25,000/month, deposit, 11 months | 🔁 same as PRP-06 |
| PRP-08 | Add property | Price on request; remove an attribute; add a "this property only" attribute | ✕ and + Add attribute | Saved; removed one restorable | Boundary wall removed; "Temple nearby" kept | ✅ |
| PRP-09 | Edit | Unsaved-changes warning, then save | Cancel → Keep editing → Save | Warning; change in history | Same | ✅ |
| PRP-10 | Form | City suggestions | Type "Coim" | Coimbatore suggested | Same | ✅ |
| PRP-11 | Duplicate | Duplicate, then change subcategory | Duplicate + dialog | Copy as draft, no photos; plot details hidden | RE-PLT-000004 → Villa / House | 🔁 same as PRP-06 |
| STS-01 | Status | Valid next statuses for a published sale property | Change status dialog | Unpublished, Booked, Sold, Archived | Run 4: page load timed out (30 s waiting for the map's network to go idle). Re-check on 3 published sale plots: **3 / 3 correct** | 🔁 test timing, not an app fault |
| STS-02 | Status | Published → Booked → Sold | Two changes | Sold; both in history | Same | 🔁 run 3: navigation timeout (map). Passed after a wait-strategy change |
| STS-03 | Status | Lease property closes as Leased | Change status | Leased offered, Sold not | Same | ✅ |
| STS-04 | Status | Archive and restore | Archive → Restore | Archived (no Edit) → Draft | Same | ✅ |
| IMP-01 | Import | Template download | Bulk Import → Download | Plot columns, dropdowns, instructions | 32 columns; sheets Properties, Lists, Instructions | ✅ |
| IMP-02 | Import | Create 30-row Excel | Fill template | 30 rows | Same | ✅ |
| IMP-03 | Import | Every row checked | Upload | 30 · 24 · 4 · 2; messages name the column | Same; 7 / 7 messages | ✅ |
| IMP-04 | Import | Duplicates in file and in system | Duplicates tab | Both kinds | Same | ✅ |
| IMP-05 | Import | Error report | Download + read | 6 rows + Errors column | Same | ✅ |
| IMP-06 | Import | Import as Published, update duplicates | Step 4 → Import | 24 created + 1 updated; drafts with reason; private link refused | Same | ✅ |
| IMP-07 | Import | Import only once | API commit again | 409 | 409 ALREADY_IMPORTED | ✅ |
| IMP-08 | Import | History | Import history tab | File and results | Same | ✅ |
| LST-01 | List | All properties present; counts add up | List + API | 28 | 28 | 🔁 run 3: wrong query in the test script |
| LST-02 | List | Pagination | Next page | 1–20, 21–28 | Same | ✅ |
| LST-03 | List | Filters: type, purpose, city, price, featured, search | Each filter vs API | Counts match | All match (e.g. Lease 5 / 5, Coimbatore 9 / 9) | ✅ |
| LST-04 | List | Sort by price | Sort select | Lowest first | ₹16.75 L, 18.5 L, 20.25 L… | ✅ |
| LST-05 | List | Bulk status change | Select drafts → Published | Rows without photo listed with reason | Same | ✅ |
| DAT-01 | Data | Imported values correct | API + detail page | Sheet row 5 values | ₹23.75 L, 2,400 sq.ft, Panchayat, P-105, Sandy, 35 x 45 ft | 🔁 run 3: wrong expected values in the script |
| DAT-02 | Data | Published without photo → Draft | API | Row 1 published with photo; others draft | Same | ✅ |
| DAT-03 | Data | Duplicate update changes only filled cells | API | New price; other details kept | Same | 🔁 **BUG-01** found here in run 3. Passed after the fix |
| MAP-01 | Map | Address lookup | Type city / area / pincode | Map moves; pin can be dropped | Pin 9.922, 78.148 (Madurai) | ✅ |
| ROL-02 | Roles | Admin | Sign in | No Users & Roles | Properties, Bulk Import, Settings | ✅ |
| ROL-03 | Roles | Sales Agent view-only | Sign in, open write pages | 4 write pages blocked | Same | ✅ |
| ROL-04 | Roles | API refuses Sales Agent writes | 5 API calls | All 403 | 403 × 5 | ✅ |
| UI-01 | UI | Phone width | 390 px | No sideways scroll | 4 pages fit | ✅ |
| UI-02 | UI | Dark theme | Dark class | Readable | Readable | ✅ |
| UI-03 | UI | No console errors | Whole run | 0 | 0 | ✅ |

**E2E totals (final state): 47 / 47 passed.** The 🔁 rows all came from test-script timing or wrong expectations, except DAT-03 (BUG-01).

### 6.3 Bug-fix re-checks (live, isolated test copy)

| ID | Check | Result |
| --- | --- | --- |
| RCK-01 | STS-01 again on 3 published sale plots, waiting for the page instead of network idle | ✅ 3 / 3: Unpublished, Booked, Sold, Archived |
| RCK-02 | BUG-02: Plot A set to **Sold**, then an Excel row for it imported "as Published, update duplicates" | ✅ Price updated (₹37 L → ₹36.5 L), status **still Sold** |

### 6.4 Development app (real data)

| ID | Scenario | Actual | Result |
| --- | --- | --- | --- |
| DEV-01 | Plot by form: Sale, 30 x 40 ft DTCP, address, landmark, map pin, 2 photos, brochure → Publish | RE-PLT-000002 Published; detail page shows all 15 values | ✅ |
| DEV-02 | Plot by form: Lease, 4 cent, ₹18,000/month, deposit, lock-in, photo → Publish | RE-PLT-000004 Published; "= 1,742.4 sq.ft" | 🔁 first run: the test expected "1,742" (rounded); the app shows the exact 1,742.4 |
| DEV-03 | Plot by form: price on request, 2 ground, corner plot → keep Draft | RE-PLT-000003 Draft; checklist asks for a photo | ✅ |
| DEV-04 | Download template, fill 12 records | `phase-2-dev-residential-plots.xlsx` | ✅ |
| DEV-05 | Upload: rows checked | 12 · 12 valid · 0 · 0 | 🔁 first run: 1 row used an amenity not enabled for plots here. The app rejected it correctly; the test data was fixed |
| DEV-06 | Import as Published | 12 created; 3 Published (with photos), 9 Draft with reason | ✅ |
| DEV-07 | **Properties list shows every new plot** | 16 rows: all 3 form plots + all 12 imported + the existing one; tabs All 16 · Draft 10 · Published 6 | ✅ |
| DEV-08 | Imported values match the sheet (all 12 rows) + Salem detail page | All match | ✅ |
| DEV-09 | Search and filters find the new plots | Search "Fairlands", "636016", "RE-PLT-000016", "Porur" each find the right plot; Lease = 3; Coimbatore = 5; featured = 2; price ₹30–45 L = 5; sort by price and area correct | 🔁 the first check searched by plot number, which isn't a search field by design (PRD ADM-PROP-02: code, title, location). See OBS-03 |
| DEV-10 | No console errors | 0 | ✅ |

The development app now has **16 properties** (RE-PLT-000001 "siva garden", which already existed, plus RE-PLT-000002 … 000016).

---

## 7. Bugs and issues

### BUG-01: "Update the existing properties" wiped details not in the sheet (High, ✅ fixed)

- **Found by:** DAT-03, E2E run 3.
- **Steps:** Plot A had facing, dimensions, road width, layout, soil type, amenities, address, landmark and map pin. An Excel row matching Plot A filled only name, price, city, locality, pincode, plot number and approval type. It was imported with "Update the existing properties".
- **Expected:** only the filled cells change.
- **Actual:** every empty cell cleared the existing value. Plot A lost its facing, dimensions, road width, layout, soil, amenities, address, landmark and map pin.
- **Cause:** the update reused the full "create" body built from the row, so empty cells became empty values.
- **Fix:** each checked row now records which columns were filled. An update changes only those fields, merging price, rental and location field by field. The map pin changes only if both latitude and longitude are filled.
  - Files: `apps/api/src/modules/imports/columns.ts`, `importBatch.model.ts`, `imports.service.ts` (`updateFromSheet`).
- **Regression test:** *"updating a duplicate changes only the filled cells; empty cells keep the existing details"*.
- **UI wording:** the update option now explains this.

### BUG-02: Importing "as Published" put Sold / Booked properties back on the market (High, ✅ fixed)

- **Found by:** the STS-01 re-check after run 4. Plot A had been marked **Sold** in STS-02, but the list showed it as **Published** after IMP-06.
- **Steps:** a property is Sold. An Excel row matches it. Import with "Published" and "Update the existing properties".
- **Expected:** the details update; the property stays Sold.
- **Actual:** the import moved it to Published. Sold → Published is a valid manual "relist" move, so nothing stopped it.
- **Fix:** "Import as Published" now publishes new properties and drafts only. An updated property that is Sold, Booked, Unpublished, Rented or Leased keeps its status.
  - File: `imports.service.ts`.
- **Regression test:** *"an updated Sold property stays Sold, even when importing as Published"*.
- **Live re-check:** RCK-02. UI hint and TRD §13 / checklist updated.

### Observations (not bugs; no action needed for Phase 2 sign-off)

| ID | Observation | Suggestion |
| --- | --- | --- |
| OBS-01 | During manual use, the page once looked blank right after **Publish**. Not reproducible: a dedicated script captured the page at 300 ms, 1 s, 3 s and 6 s after Publish, and the detail page was always there with no console errors. | Watch for it; report it with a screenshot if seen again. |
| OBS-02 | Sorting by price (low → high) lists **Price on request** properties first. | Consider putting them last in both directions. |
| OBS-03 | List search covers code, name, city, area and pincode, as specified, but not **plot number**. | Small enhancement if staff often search by plot number. |
| OBS-04 | On the import review screen the Price column shows lease rent as "₹22,000". The list shows "₹22,000/month". | Show the price basis on the review screen too. |

**Data note:** in the development app, the existing property "siva garden" (RE-PLT-000001) has an area of **4.5 sq.ft**, which looks like a typing slip.

Expected behaviour seen during testing (not issues):
- the browser's "Leave site?" prompt appears when leaving a form with unsaved changes;
- pages with a map keep loading map tiles in the background.

### Test-script issues fixed during testing (not app faults)

| Run | Issue | Fix |
| --- | --- | --- |
| 1 | Run stopped at the browser "Leave site?" prompt (correct app behaviour) | Script accepts the prompt |
| 1 | SET-03 used "corner plot", already in Plot, so reuse was correctly not offered | Used "LIFT" (an Apartment attribute) |
| 2 (18 / 47) | Page addresses joined twice; Excel column named "Road width" instead of "Road width (ft)"; role logins reused the previous session | Fixed addresses, column name, fresh browser session per login |
| 3 (41 / 47) | Pages read mid-navigation; map kept the network busy; one wrong query; wrong expected values for a sheet row | Wait for the page itself; corrected query and expectations |
| 4 (46 / 47) | STS-01 timeout (map network) | Re-checked with a page-ready wait: 3 / 3 |
| Dev run 1 (4 / 10) | Expected a rounded 1,742 sq.ft; used an amenity not enabled for plots in the dev app; searched by plot number | Corrected expectations and data; resumed without re-adding plots |

---

## 8. Not covered in this round

- **Commercial and Other categories:** on hold until they are set up. Only their "set up later" state was checked.
- **Cloud photo storage** (Cloudinary, planned later): photos were stored in the local upload folder.
- **Browsers:** Chrome only (no Firefox, Safari or Edge). Phone layout was checked by viewport emulation, not on real devices.
- **Load and very large files:** sheets of 30 and 12 rows were used. Import time for thousands of rows wasn't measured.
- **Accessibility audit:** not done beyond the labelled controls the tests rely on.

---

## 9. Overall Phase 2 status

| Area | Status |
| --- | --- |
| 2.1 Property types & amenities | ✅ Pass |
| 2.2 Properties data, API & media | ✅ Pass |
| 2.3 Property list, form, detail & map | ✅ Pass |
| 2.4 Bulk import from Excel | ✅ Pass. 2 bugs found and fixed |
| Roles & access | ✅ Pass |
| Quality (tests, lint, types, console) | ✅ Pass |

**Phase 2 passes testing and is ready for the demo.** The two import fixes (BUG-01, BUG-02), their tests and this report are in the working copy and will be committed only after approval.

---

## 10. Files

| File | What it is |
| --- | --- |
| [`phase-2-e2e-residential-plots.xlsx`](phase-2-e2e-residential-plots.xlsx) | 30-row E2E sheet (24 valid, 4 invalid, 2 duplicates) |
| [`phase-2-dev-residential-plots.xlsx`](phase-2-dev-residential-plots.xlsx) | 12-row sheet imported into the development app |
