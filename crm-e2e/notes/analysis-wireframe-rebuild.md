I could not write `E:\real-estate\crm-e2e\notes\analysis-wireframe-rebuild.md`: the Write tool refused it with "Subagents should return findings as text, not write report files". I did not get around that, so the file does not exist. The full analysis is below, ready to paste into that path. Nothing in the repo was changed.

**Summary**
- **Stack:** React 19.3.1, Vite 8.3, TypeScript ~7.0.2, Tailwind 4.3.5 (`@theme inline`), shadcn radix-nova, react-router 8.5.2, i18next 27 with en and ta, sonner, oxlint, pnpm. There are no tests.
- **Theme:** every token lives in `src/index.css`. A `.dark` class on `<html>` switches it, set by `lib/theme.ts` (light, dark or match device) and an inline script in `index.html` that runs before the page draws.
- **Language:** one `translation` namespace with about 2,156 keys. The rule code returns i18n keys, never finished sentences.
- **Rules to port:** matching (hard filters, then weights 0.30 / 0.25 / 0.20 / 0.15 / 0.10), the ready-to-buy score out of 100 (points 25 / 20 / 20 / 15 / 10 / 10), the classification order, the consent rule, the property AI that asks one question at a time, and the lead AI that shows a preview, applies on confirm and offers Undo.
- **Main problems:**
  - The demo date is fixed (`DEMO_TODAY` = 16 Nov 2026), and cities are Tamil Nadu only.
  - The spec's paste-and-fill example fails: the name comes out as "Hi".
  - There are five money parsers that read a bare number differently.
  - The pipeline stages don't match the spec.
  - There are no Appointment, Task, Notification, Client or Assignment records.
  - Permissions are only 4 flags, with no route guards.
  - The store copies the whole database on every change, and new ids can be duplicated.
  - Demo phone numbers are masked, so call and WhatsApp links can't work.
  - Auto-assign has no round-robin tie-break.

---

# Analysis — `wireframe-rebuild/` (React rebuild of the wireframe)

Phase 0, read-only. Source: `E:\real-estate\wireframe-rebuild\` on `feature/crm-e2e` (identical to `spec-system-wireframe`). About 22,300 lines in `src/` (about 4,870 of them locale JSON). No tests.

## 1. Stack and versions

| Area | Package | Version |
|---|---|---|
| UI | react, react-dom | 19.3.1 |
| Build | vite, @vitejs/plugin-react | 8.3.x, 6.1.2 |
| Language | typescript | ~7.0.2 ("tsgo" line); build is `tsc -b && vite build` |
| CSS | tailwindcss, @tailwindcss/vite | 4.3.5 (configured in CSS, no tailwind.config) |
| Components | shadcn (style radix-nova, base colour neutral, CSS variables), `radix-ui` meta package, class-variance-authority, tw-animate-css | 4.23, 1.8.1, 0.7.1, 1.4 |
| Class merge | `cn` package, **not** clsx/tailwind-merge | 0.5.2 |
| Icons | lucide-react (the nav still uses emoji) | 1.77 |
| Toasts | sonner | 2.0.8 |
| Router | react-router (BrowserRouter) | 8.5.2 |
| Language files | i18next, react-i18next | 27.2.3, 18.0.3 |
| Fonts | Inter Variable, Noto Sans Tamil (400 / 500 / 600) | |
| Lint | oxlint | 1.90 |
| Package manager | pnpm | |

Config notes:
- `vite.config.ts`: alias `@` → `src`. Dev port is **5180 with strictPort**, preview 5181. Browser storage is per address, so a port change looked like lost demo data.
- `tsconfig.app.json`:
  - target ES2023, bundler resolution, `@/*` paths
  - `verbatimModuleSyntax` and `erasableSyntaxOnly` (so no enums), no unused locals or parameters
  - **`strict` is not set explicitly**
- `index.html`: an inline script adds `.dark` before the first paint.
- `vercel.json`: a single-page-app rewrite.

## 2. Folders and routes

**Folders**
- `src/App.tsx` sets up StoreProvider > TooltipProvider > BrowserRouter > AppShell, plus the Toaster (top centre, rich colours).
- `src/main.tsx` loads i18n and the CSS, runs `initTheme()`, then renders.
- `index.css`, `i18n/` (index.ts, en.json, ta.json).
- `data/`: types.ts, catalogue.ts, seed.ts.
- `store/db.tsx`.
- `lib/`: amount, format, classification, readiness, matching, property, search, places, labels, consent, theme, utils, assistant (666 lines), and `ai/` (parse, understand, plan, answer).
- `hooks/use-media-query.ts`.
- `components/`: `ui` (27 shadcn parts), `layout` (app-shell, sidebar, top-bar, crumbs, nav.ts), `app` (shared parts, see section 9).
- `features/properties/`:
  - `pages`: properties, property, drafts, share
  - `tabs`: overview, legal, price, matching, history, neighbourhood-card
  - `assistant`: add-property-page, chat-panel, details-drawer, details-form, media-tab, summary-card, source-tag, use-fact-text
  - `components`: property-card, photo-gallery, list-actions, list-options, share-panel, fact-dialog, property-bits
  - `search`: prop-search.ts, search-bar.tsx
  - `pitch.ts`
- `features/leads/`:
  - pages: leads-page (table), leads-today, lead-page (955 lines), lead-form (543 lines), add-lead-sheet
  - parts: inline-edit, matches-tab, offer-dialog, visit-outcome, reschedule-button, done-button, consent-control
  - rule files: lead-list.ts, next-step.ts
- `features/assistant/`: ask-bar, assistant-box, use-speech.
- `features/settings/settings-page`.
- `pages/`: module-placeholder-page, ui-kit-page.
- `public/demo-photos/`: 14 cover JPGs.

**Routes**
- `/` goes to `/properties`. `*` also goes to `/properties`.
- Properties:
  - `/properties`
  - `/properties/new/:tab?`
  - `/properties/drafts`
  - `/properties/:id/edit/:tab?`
  - `/properties/:id/share`
  - `/properties/:id/:tab?`
- Leads:
  - `/leads` (`?design=new` shows the Today design)
  - `/leads/new`
  - `/leads/:id/edit`
  - `/leads/:id/:tab?`
- `/settings`, `/ui-kit`.
- Menu items not built yet open a placeholder page: dashboard, projects, import, pipeline, appointments, matching, hni, reports, enquiry.

**Navigation (`nav.ts`)**
- Four groups: Overview, Spec data, Sales & qualification, Tools. Items use emoji icons.
- Live counts:
  - Properties: available and not archived.
  - Leads: active leads.
  - Appointments: visits booked for the demo date.
- HNI is locked (🔒) for executives.

**Top bar**
- Breadcrumbs.
- The Ask bar (`/` or Ctrl K).
- ＋ Lead and ＋ Property.
- A "Viewing as" role switch.
- A Reset demo data icon.
- On phones, a ☰ sheet holds the sidebar.

## 3. Design tokens and theming

**Where it lives**
- Everything is in `src/index.css`. CSS variables are mapped to Tailwind utilities in `@theme inline`.
- Screens use token names only (`bg-primary`, `text-success`, `bg-warning-soft`), never raw colours.

**Token groups**
- The shadcn base: background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring.
- Seven status tones: neutral, primary, success, warning, danger, info, violet. Each has a `-soft` background and a `-foreground` for text on the solid colour.
- sidebar-*, chart-1 to chart-5.
- ribbon-* (unused since 26 Nov).
- `--shadow-card`.
- A rounding scale built from `--radius: 0.625rem` (sm is radius − 4 px … 4xl is radius + 16 px).

**Named text sizes**

| Name | Size (px) |
|---|---|
| `text-micro` | 10 |
| `text-caption` | 11 |
| `text-label` | 11.5 |
| `text-meta` | 12.5 |
| `text-ui` | 13 |
| `text-prompt` | 14.5 |

These sit alongside Tailwind's xs, sm, base and xl. They must be registered in `lib/utils.ts`, or `cn` drops them as colour conflicts.

**Colours and fonts**
- Light: blue `#2f5bea` on `#f3f4f7`, white cards.
- Dark: a different identity. Warm near-black `#0f0d12` with an **orange** primary `#f26a2e`.
- Font: Inter, falling back to Noto Sans Tamil for Tamil characters.

**Other CSS**
- At 1024 px and wider, `html` is set to 90% font size, so the desktop looks like 90% zoom.
- Thin scrollbars.
- A print rule that prints only the brochure.

**How the theme is switched (`lib/theme.ts`)**
- The choice is light, dark or system, stored under `realspec-rebuild-theme`.
- `apply()` toggles `.dark` and sets `color-scheme`.
- `initTheme()` follows the device setting while "system" is chosen.
- `useTheme()` is a `useSyncExternalStore` hook.
- People choose in Settings → Your preferences (three cards with previews).
- Dark styles use `@custom-variant dark (&:is(.dark *))`.

## 4. i18n (English and Tamil)

**Setup (`i18n/index.ts`)**
- One namespace, `translation`. Both language files are bundled.
- English is the fallback, and escaping is off.
- The language is stored under `realspec-rebuild-language` (read in try/catch).
- `setLanguage()` changes and saves it, and `<html lang>` follows.
- Adding a language means adding one file.

**How keys are organised (by feature prefix)**
- Shell: nav, role, demo, action, shell.
- Catalogue labels: type, status, purpose, facing, stage, stageShort, classShort, typeShort.
- Matching: match, reason.
- Properties: search, filters, property, price, location, nb, photos, documents, history, share, brochure, drafts, drawer, assistant (106 keys).
- Lead assistant: ai (64 keys).
- Leads: leads, today, lead, leadForm, addSheet, inline, lost, next, qual, hniTab, class.
- Settings and bulk import: settings, bulk.

**Rules**
- Rule code returns keys plus values, not finished sentences (`Reason {key, values}`, `Suggestion {key}`, pitch points, assistant items).
- Catalogue labels go through `useLabels()` (`fact.<key>`, falling back to the catalogue's English label).
- Dates are formatted with `en-IN` or `ta-IN`.
- What people type (names, notes, titles) is never translated.
- The Tamil file has every English key plus **66 extra keys that nothing uses**. The Tamil text has not been reviewed.

## 5. Data model (`data/types.ts`)

The types are written the way MongoDB collections would be: stable ids, references by id, and `Audit {by, at}` on changes.

**Users and properties**
- **Role**: admin, manager, executive.
- **User** `{id, name, role, phone}`. No status, availability, manager or targets fields.
- **PropertyTypeKey**: plot, flat, house, commercial, agri, industrial.
- **Purpose**: sale, rent, lease.
- **PropertyStatus**: draft, available, negotiation, reserved, booked, onHold, sold. Archiving is a separate `archived` audit field, not a status.
- **Facing**: 8 directions.
- **Media** `{kind: photo | video | floorPlan | brochure, url, isCover?}`.
- **NearbyPlace**:
  - `{categoryId, name, distanceKm, durationMin}`
  - `status`: existing, underConstruction, planned, proposed
  - route check: `routeChecked`, plus who, when and how
  - `source`: google or user
- **PropertyLocation** `{state, city, locality, exact, lat?, lng?, roadType?, roadWidthFt?, nearby}`.
- **ApprovalClaim** `{approvalId, status: pending | uploaded | verified}`. "Pending" means ticked but no document yet.
- **PropertyDocument**, **Comparable** `{areaSqft, pricePerSqft, kind: transaction | asking, …}`, **HistoryEntry**.
- **Property** fields:
  - Basics: `id` (PROP-1001), `title`, `description?`, `type`, `purpose`, `status`, `facing?`.
  - Size and price: `areaSqft` (what it measures depends on the type), `price` (₹ total), `priceOnRequest?`.
  - `specs: Record<factKey, SpecValue>`, the type's own fields from the catalogue.
  - `amenities[]`, `location`, `media`, `approvals`, `documents`, `comparables`.
  - Record-keeping: `listedAt`, `created`, `updated`, `history`, `archived?` (with a reason), `dismissedComparables?`.
  - `sources?`: where each value came from (ai, google, auto, file, team).
  - Workflow: `submitted?` (sent for approval), `assistant?` (the saved chat thread).
  - `extraDetails?` (label, value, public?), `shares?` (channel whatsapp, link or pdf, with leadId?).
  - Not covered: RERA number, furnishing, Vastu, carpet / built-up / super built-up as fields of their own (only flat specs have some of them), owner or builder, commission, 1 RK, 2.5 BHK.
- **ExtraFact**: a field the team added to one property type.

**Leads**
- **LeadStage**: new, contacted, qualified, recommended, visitScheduled, negotiation, closed, lost.
- **Requirement**, one property type per lead:
  - `type`, `cities`, `localities`, `sizeSqft?`, `facing?`, `minRoadFt?`
  - `corner?`, `bhk?`, `bedrooms?`, `landAreaSqft?`
  - `parking?`: required, preferred, notNeeded
  - `possession?`: any, ready, underConstruction
  - `commCategory?`, `occupancy?`, `amenities`, `approvalRequired`
- **Budget** `{min, preferred, max, flexPct, basis?: propertyOnly | withCosts | withLoan}`. No basis means "not clarified yet".
- **LeadActivity** `{type: call | whatsapp | email | meeting | visit | note | shared | recommended, text, propertyId?, ai?}`.
- **SiteVisit** `{propertyId, date, time?, status: scheduled | completed | cancelled | noShow, feedback?, interest?}`. Visits sit inside the lead; there is no Appointment record.
- **Lead** fields:
  - Contact: `id` (LEAD-1001), `name`, `phone`, `email?`, `source` (free text), `enquiryDate`, `ownerId | null`, `purpose?`, `purposeNote?`.
  - `qualification`:

    | Field | Values |
    |---|---|
    | need | clear, partly, exploring |
    | timeline | m1, m1to3, m3to6, m6to12, undecided |
    | authority | sole, joint, needsApproval, unknown |
    | funding | own, loan, combination |
    | fundingReady | ready, arranging, undecided |

  - `engagement {responded, docsRequested, siteVisited}`.
  - `budget`, `requirement`, `stage`, `stageSince`, `nextFollowUp?`.
  - `recommendedPropertyIds`, `visits`, `activity`.
  - `negotiation? {propertyId, offered, counter, notes}`.
  - `classification?` (a manager's override).
  - `hni? {status, potential, signals}`.
  - `consent? {followUp, at, how, withdrawnAt?}`.
  - `contactPref?`.
  - `lost? {reason, note, at, by}`.
- **LostReason**: boughtElsewhere, budget, noInventory, notResponding, postponed, loan, other.
- **Classification**: general, qualifiedBuyer, investor, highValue, potentialHni, verifiedHni.
- **HniSignal** (7): prevInvestment, portfolio, objective, range, fundingReadiness, decisionProcess, timeline.
- **HniStatus**: notDetermined, notVerified, potential, consentInProgress, verified, declined.
- **BuyerPurpose**: ownUse, investment, rentalIncome, businessUse, secondHome, other.

**Settings and database**
- **Settings**:
  - `matchWeights`: budget 0.3, location 0.25, size 0.2, amenities 0.15, preferences 0.1
  - `buyerCostsPct`: stamp duty 7, registration 4, other 1
  - `stuckDays`: 14
  - `placeCategories` (each with routeCheck and shownByDefault)
  - `approvalTypes`: DTCP and RERA
  - `amenities?`, `extraFacts?`
- **Database** `{version, users, properties, leads, settings, seedAdded?}`.

**Records that do not exist yet:** Client, Appointment, Task, Notification, Assignment, ImportJob, a global Activity log, Project.

**Catalogue (`catalogue.ts`)**
- Per type: label, category, areaBasis, areaLabel, purposes, `required` (two key details needed to publish), `core` (the details counted in the completion score) and `facts`.
- Each fact has `{key, label with its unit, kind: number | text | select | month, options, hint, money, plain, internal (never shown to customers)}`.
- Required details per type:

  | Type | Required |
  |---|---|
  | plot | length, width |
  | flat | bhk, floor |
  | house | subType, bedrooms |
  | commercial | commCategory, occupancy |
  | agri | acres, waterSource |
  | industrial | subType, powerKva |

- `REQUIRED_CORE`: title, purpose, type, city, locality, price, area.
- `STAGE_ORDER` leaves out lost.
- `CITIES` covers Tamil Nadu only: Madurai, Chennai, Coimbatore, Tiruchirappalli, Salem.
- 12 amenities.

**Seed (`seed.ts`)**
- `DEMO_TODAY = '2026-11-16'` is a fixed date.
- Users: Anand V (admin), Vasanth K (manager) and 4 executives: Priya S (u-ex01), Karthik R, Divya M, Naveen P. Phone numbers are masked (`+91 98xxxxxx9x`).
- 14 properties (2 of them drafts) and 24 leads, all in Tamil Nadu, with comparables, nearby places, approvals, documents, visits and negotiations.
- `DATA_VERSION` is 7; a version mismatch replaces the saved data with the seed. `addMissingSeedLeads` merges leads added to the seed later.

## 6. Store and saving (`store/db.tsx`)

**How data is held and saved**
- A React Context with `useState<Database>`.
- Every change copies the whole database (`structuredClone`), changes the copy and stores it.
- An effect saves the whole database to `realspec-rebuild-db` after each change. The role is saved under `realspec-rebuild-role` (default: manager).
- Every storage access is wrapped in try/catch.

**Actions** (each one is commented with the future API call it stands for)
- `updateProperty`, which also adds a history line.
- `addProperty`, with id `PROP-<highest + 1>`.
- `shareProperty`: share log, a line on the lead's timeline, and it counts as a recommendation.
- `recommendProperty`.
- `updateLead`. **Consent safety net:** a new follow-up date without consent is put back.
- `addLead`.
- `noteOnLeads`.
- `deleteProperty`. Linked leads lose the recommendation, booked visits are cancelled, the negotiation is cleared, and a note goes on their timeline.
- `updateSettings`.
- `resetDemo`.
- `checkpoint` and `restore`, used for the assistant's 10-second Undo.
- `markRecommended` moves new, contacted or qualified leads to recommended, forward only.

**Roles and permissions**
- One fixed demo user per role: admin u-admin, manager u-mgr, executive u-ex01.
- Four permissions: `property.add`, `property.manage`, `property.seeDrafts`, `lead.seeAll`. Executives have only `property.add`.
- `useCan` checks permissions. `useVisibleLeads` shows executives their own leads only. `userName` looks up a user's name.

## 7. lib modules and their business rules

### amount.ts
- An amount is entered as `{v, unit: 'L' | 'Cr'}`. L means × 1,00,000 and Cr means × 1,00,00,000.
- `toAmountField` picks Cr from ₹1 Cr up (4 decimals), otherwise L (2 decimals).
- `fromAmountField` returns nothing unless the number is positive.

### format.ts
- `inr()`: ₹45,00,000 (Indian grouping).
- `inrShort()`:
  - ₹1 Cr and above → "₹1.25 Cr" (2 decimals, trailing zeros trimmed)
  - ₹1 L and above → "₹62 L" (1 decimal)
  - otherwise the full figure
- `num`, `sqft` ("1,200 sq.ft."), `fmtDate` ("16 Nov 2026", en-IN or ta-IN), `daysBetween`, `initials`.
- `addDays` works in local time. Using `toISOString` would shift Indian midnight to the previous day.

### classification.ts
The first rule that matches wins:
1. HNI status is verified → **Verified HNI**.
2. `hni.potential` → **Potential HNI**.
3. Maximum budget of ₹1.5 Cr or more (`HIGH_VALUE_BUDGET`) → **High-value prospect**.
4. Purpose is investment or rental income → **Investor**.
5. Need is "clear" and at least one property matches → **Qualified buyer**.
6. Otherwise → **General lead**.

A manager's override takes precedence. A high budget never makes someone an HNI, and executives see HNI classes as "Restricted". The file imports `Tone` from the components folder, so rule code depends on UI code.

### readiness.ts (the "ready to buy" score out of 100; the word BANT is never shown)

| Part | Points | How the share is worked out |
|---|---|---|
| Budget | 25 | Full if a matching property costs no more than the maximum budget; half if matches exist only within the flexibility margin; none otherwise |
| Need | 20 | clear 1, partly 0.5, exploring 0.2 |
| Timeline | 20 | m1 1, m1to3 0.8, m3to6 0.5, m6to12 0.25, undecided 0 |
| Funding ready | 15 | ready 1, arranging 0.55, undecided 0 |
| Authority | 10 | sole 1, joint 0.7, needsApproval 0.4, unknown 0 |
| Engagement | 10 | responded 0.3 + docs requested 0.3 + site visited 0.4 |

- Each row is rounded, then the rows are added up.
- Bands: High-priority 80+, Qualified 60+, Developing 40+, otherwise Early.
- It returns the rows for the points table on screen.
- "Hot" in the Today design means an active lead in the High band.

### consent.ts
A lead has consent when `consent.followUp` is on and it has not been withdrawn. Without consent, no follow-up date can be set. A site visit the customer asked for is still allowed.

### matching.ts (two-way matching, ported from the old wireframe's `matchScore`)

**Step 1: hard filters.** Failing any one removes the property:
- the property is available
- its type is the lead's type
- its city is one the lead wants
- its price is at most the lead's ceiling, which is maximum budget × (1 + flexibility %)

**Step 2: weighted score.** Score = 0.30 × Budget + 0.25 × Location + 0.20 × Size + 0.15 × Amenities + 0.10 × Preferences. Each part is 0–100, and the weights come from Settings.
- **Budget:**
  - up to the preferred budget → 100
  - up to the maximum → 100 − 30 × (price − preferred) / (maximum − preferred)
  - within the flexibility margin → 55
  - otherwise 0
- **Location:**
  - city not wanted → 0
  - no localities given → 100
  - preferred locality → 100
  - another locality in the city → 70
- **Size:** 100 if no size was given; otherwise 100 − 200 × the deviation, kept between 0 and 100. A 10% difference scores 80; a 50% difference scores 0.
- **Amenities:**
  - Wanted amenities given: half the infrastructure score plus half the share of wanted amenities present.
  - None given: the infrastructure score alone.
  - Infrastructure checks per type:
    - plot: water, electricity, drainage, tar or concrete road
    - house: water not from tankers, power, condition new or good
    - flat: a lift or floor 0–1, parking, power backup, security
    - other types: road 30 ft or wider, parking, permitted usage
- **Preferences:** the share of checks that pass, or 100 if there are none. Checks per type:
  - plot: facing, minimum road width, corner
  - flat: BHK, parking required, possession
  - house: bedrooms at least the BHK asked for, parking
  - commercial: category, occupancy

**Labels**
- Failed only on price → budget mismatch.
- Failed anything else → excluded.
- Passed, but an approval document is pending or Size is below 60 → **Conditional**.
- 80 or more → **Strong**.
- 65 or more → **Good**.
- Otherwise → **Weak**.

**Reasons** (as i18n keys)
- Budget: within preferred / within maximum / uses flexibility.
- Size: exact or N% off.
- Locality: preferred or another one.
- The preference checks.
- Amber warnings (not reasons against): document pending, approvals pending, no approval badges.
- `fail_<filter>` for each failed hard filter.
- It also returns the five part scores and the ceiling.

**Functions**
- `propertiesForLead` and `leadsForProperty` list clean matches before conditional ones, then by score. They use active leads only, and a property must be on offer.
- `closeOnBudget`: everything fits but the price, and the price is within 15% above the ceiling.
- `excludedForLead`: price-only failures first, then the rest, cheapest first.
- Booked and sold properties are left out because of the "available" filter.

### property.ts
- `missingRequired`: the core fields plus the type's two required details.
- `isListed`, `isOnOffer`, `pendingApprovals`.
- `listingScore` (completion out of 100):

  | Item | Points |
  |---|---|
  | purpose, type, city, locality, price, area | 10 each |
  | core details filled | 15 (proportional) |
  | any photo | 10 |
  | legal: share of approvals with a document, or any document when there are no approvals | 10 |
  | any amenity | 5 |

- `attentionFor` flags:
  - completion below 80
  - price outside the range of similar properties
  - available, listed 45 or more days ago, and no visits
  - approval documents pending

  Sold, draft and archived properties are skipped.
- Similar properties are found automatically: same type and city, area within ±25%, listed in the last 365 days. Same-locality ones come first.
- `priceCheck` works out:
  - price per sq.ft.
  - the average, lowest and highest of similar properties, and the average of actual sales
  - below / within / above, worded neutrally, never "bargain"
  - the buyer's total cost (stamp duty, registration and other charges)
- `placesFor('customer')` hides everyday places near the property until someone has checked the route. Distances are approximate ("~") when the location or route is unchecked.
- `linkedLeads` finds leads that were recommended, visited, negotiating or sent the property, plus upcoming visits. The archive and delete dialogs use it.

### search.ts (a sentence → property filters)
- Price phrases: "between X and Y", "under / below / up to / within / max / budget X", "above / over / min / from X". Units: L, lakh(s), lac(s), Cr, crore(s), k. **A bare number below 1000 is read as lakhs.**
- "N BHK" (a BHK alone implies a flat); facing words, compound directions first.
- Purpose: rent, lease, sale.
- Type words: agricultural, industrial, plot / land / site, flat / apartment, house / villa, the commercial categories.
- Places: localities first, then cities, then nicknames (Trichy, Kovai, Madras).
- Words left over must all match the id, title, locality, city or description.
- `applyFilters`: a locality narrows only its own city.

### places.ts, labels.ts, theme.ts, utils.ts
- `places.ts` lists every city and locality for the place pickers.
- `labels.ts` gives translated labels and the key facts on cards ("40 × 30 ft", "2 BHK", "Floor 3"). **Bug:** `String(subType).replace(/s*(.*)/, '')` always returns an empty string.
- `theme.ts` and `utils.ts`: see section 3.

### assistant.ts (the property assistant: Add and Edit with AI; rules today, a real AI later with the same output shape `Fact {key, value, note?}`)

**What it reads from a message**
- Lines starting "title:" or "description:".
- A map link, which marks the exact location.
- Purpose.
- Type and sub-type: agricultural, industrial or shed, warehouse, shop, office, villa, row house, house, flat or BHK, plot.
- BHK (5 or more becomes "4+ BHK"; for a house it fills bedrooms), bedrooms, bathrooms, floor.
- Price.
- Area, converted from other units:

  | Unit | sq.ft. |
  |---|---|
  | sq.yd. | 9 |
  | sq.m. | 10.764 |
  | cent | 435.6 |
  | ground | 2400 |
  | acre | 43560 |

- Facing, corner, road width, amenities, status words, city and locality.

**Rules**
- A price below 1000 with no unit opens a "lakh or crore?" card.
- When the assistant has just asked something, a short reply ("4") answers that question.
- It never invents a fact.

**The flow**
- It records where each value came from.
- It suggests a title until a person edits it.
- It asks for one required fact at a time, in the order purpose, type, city, locality, price, area, then the type's two key details, with tap-to-answer options.
- Decision cards come one at a time:
  - possible duplicate (`findDuplicate`)
  - unusual price (`priceOutlier`)
  - new amenity or new detail (`readNewThings`)
  - lakh or crore
  - map pin
- Only managers can add to the master lists; executives get "Only here" or "Skip".
- Edit with AI shows the changes as a table (old → new).
- Steps: questions, then photos, then amenities, then ready. `draftScore` gives the draft's completion.
- `SAMPLE_BROCHURE` and `SAMPLE_SHEET` are fake file reads.

### ai/parse.ts (shared readers)
- `amounts()`:
  - Ranges with one unit at the end: "50–60 L", "1.2 – 1.5 Cr".
  - Units: L, lakh(s), lac(s), Cr, crore(s), and Tamil லட்சம் / கோடி.
  - **A number without a unit is ignored.**
- `amountAfter(text, word)`: the first amount after a word.
- `dateIn`:
  - day after tomorrow, tomorrow, today (also in Tamil), "in N days", next week
  - "21 Nov" or "Nov 21", "21/11" (day first; a past date moves to next year)
  - a weekday name, meaning the next one (never today)
- `timeIn`: "11 am", "3pm", "11:30", "15:00" become HH:MM.
- `phoneIn`: an optional +91, then a 10-digit mobile starting 6–9, formatted "+91 98765 43210".
- `leadsNamed`: by id, full name or first name, longest name first.
- `propertyNamed`: PROP-dddd, or at least 60% of the title's longer words.
- `placesIn`: cities and localities from the catalogue.

### ai/understand.ts (what a message is about, in a fixed shape)
**Kinds of message:** find leads, find properties, add a property, add a lead, an update to a lead, or unknown.

**Order of checks**
1. A question with no lead named becomes a lead question or a property search.
2. "new / add lead" (or enquiry, customer, buyer), or a phone number when no lead is named and no lead page is open → add a lead.
3. "new / add property" (or plot, flat …) or "for sale" → add a property.
4. Property words without action words → property search.
5. Otherwise, things that happen to the named lead (or the lead whose page is open):
   - **Lost**, with 5 reason patterns.
   - **Log** a call, WhatsApp or meeting, noting whether they answered.
   - **Visit outcome** (only when a visit is booked): no-show, cancelled, or completed with interest high, medium or low.
   - **Book** a visit (needs a date or time).
   - **Budget**: "budget / stretch / max / up to", with one or two amounts.
   - **Offer** and counter-offer. A bare number takes the offer's unit.
   - **Follow-up**: "try again / call back / follow up" plus a date.
   - **Share**: "send / share / forward" plus a property.
   - **Consent**.
   - If nothing else matches and the message has 3 or more words, it becomes a note.

**Lead questions**
- "hot" or "high priority" → ready score 80 or more; "ready" → 60 or more.
- Also understood: no visit, overdue, due today, no follow-up, a stage (negotiation, new, qualified), investors or another purpose, a property type, "how many …", and cities.

**A new lead**
- Fields read: phone, email, purpose, type, BHK, places, amounts (one amount is the maximum; two make a range), size, contact preference, source (walk-in, website, referral, portals including 99acres / MagicBricks / Housing.com, social media, channel partner, phone) and consent.
- **The name is the capitalised words after "lead / enquiry / customer / buyer", or at the very start of the message.** For the spec's example "Hi, I'm Rahul Verma…" the name comes out as **"Hi"**.
- It also never reads the timeline, "ready to move" or who else decides, and Whitefield and Sarjapur are not known places.

### ai/plan.ts (from what was understood to a proposed change)
- Each proposed item has `{title, detail, old → new, effect, blocked?, apply(store)}` with a tick box. There are also questions with quick replies (the reply is added to the message and read again) and warnings.
- `apply` calls the same store actions as the buttons, and timeline entries are marked ✨ (`ai: true`).
- Stage moves are forward only:
  - booking a visit → visit scheduled
  - an offer → negotiation
  - sharing → recommended
- Booking a visit also proposes a reminder the day before, when the lead has consented and no other follow-up is planned.
- A follow-up without consent is shown blocked.
- A budget change says how many more properties now fit.
- Lost clears the follow-up and records the reason.
- Visiting a property with a pending document raises a warning.
- When something is missing, it asks with quick replies:
  - which lead: the named ones, or the 4 most recently active
  - which property: recommended ones plus the top 3 fits
  - which day: tomorrow, Saturday, in 3 days
- `planNewLead`:
  - asks for purpose, city (**the options are hard-coded Tamil Nadu cities**), budget, name and phone
  - checks for a duplicate by the last 10 digits of the phone number
  - notes consent, and how many properties fit
  - it is ready only with name, phone, purpose, maximum budget and a city, and no duplicate
- `newLeadRecord` defaults the source to Walk-in and the type to plot.

### ai/answer.ts
Answers a question about leads from open leads only, after the query's filters and a minimum ready score. Results are sorted by ready score, with each lead's top matching property. Each condition shows as a chip that can be removed ("How I read it").

### Rule files kept inside features
- `features/leads/lead-list.ts`:
  - follow-up tabs: all, overdue, today, upcoming, closed
  - needs attention: overdue, no follow-up date, ready to buy but no visit
  - filters with several picks per section; sorts by ready score, follow-up date or newest
  - its own sentence reader, where **a bare number below 1,00,000 means lakhs**
- `features/leads/next-step.ts` suggests the next action in this order:
  1. record a visit outcome
  2. an upcoming visit (a variant when a home loan is ready)
  3. close the negotiation gap
  4. follow up after a visit
  5. first call for a new lead
  6. book a visit for a recommended property
  7. recommend the best fit not yet recommended
  8. check in after N days
- `features/properties/search/prop-search.ts`: a **second** property sentence reader, duplicating `lib/search.ts`.
- `features/properties/pitch.ts`: talking points by why the buyer is buying, using only facts customers may see.
- Auto-assign is in `lead-form.tsx`: the executive with the fewest open leads. There is no tie-break and no availability or leave check.

## 8. UX decisions worth keeping (from the README and CHECKLIST)

1. **Status tones as tokens:** seven tones, never raw colours. One file changes the theme.
2. **Light, dark or match device**, applied before the page draws. **English and Tamil** as a setting, with rule code returning i18n keys.
3. **Indian money:** amounts entered in L or Cr, `inrShort` everywhere, dates added in local time.
4. **Three separate assessments, never combined:** property fit (match %), ready to buy (out of 100), and the classification / HNI ladder. The word BANT never appears on screen.
5. **Matching that explains itself:**
   - the five parts with their weights
   - green, red and amber reason chips, and "Why N?"
   - buyers who are close on budget
   - properties left out, with the reason
6. **AI step A:**
   - The Ask bar (`/` or Ctrl K) knows the lead whose page is open.
   - Every change is previewed (old → new, tick boxes), a person applies it, Undo lasts 10 seconds, and ✨ marks it on the timeline.
   - It asks one question at a time with quick replies, and shows "How I read it" chips.
   - Add lead starts as a chat, with "Fill in the form instead".
   - Voice uses the browser's speech recognition (English, India); the mic is hidden where it isn't supported.
7. **Property assistant:**
   - It asks one question at a time and shows decision cards; Publish waits until the cards are answered.
   - Source badges show where each value came from (✨ AI, 🗺 Google, auto, 📄 file).
   - Edit with AI shows a table of changes.
   - Executives' drafts go to a manager for approval.
8. **Consent rules (DPDP):**
   - No follow-up date without consent, also checked in the store.
   - HNI is verified only after consent, and a high budget never means HNI.
   - HNI is restricted for executives.
9. **Lead page:**
   - Work on the left, the person on the right.
   - The stage as arrow steps, with time in stage. "Mark as lost" is its own button and needs a reason.
   - A Next step card with a ✨ suggestion, Schedule or Reschedule (Tomorrow, In 3 days, Next week, calendar) and ✓ Done.
   - Site-visit outcomes ("Needs outcome" once the day has passed).
   - Negotiation shown as a price scale (offer against counter).
10. **Automatic stage moves are forward only.**
11. **The leads "Today" design:**
    - summary tiles that filter the list (Active, Overdue, Due today, Hot, New this week)
    - saved views
    - a list grouped by follow-up, with Call / WhatsApp / ✓ Done on hover
    - a preview panel
    - a filter panel with a count on each option and "Show N leads"
12. **Properties list:**
    - Search: every keyword must match; a ✨ sentence search turns into removable filter pills.
    - Status tabs with counts (empty tabs hidden), and "Needs attention" on demand.
    - When nothing matches: "Show N without [filter]".
    - Layout: grid or table remembered per person, comfortable or compact rows.
    - Actions: a ⋯ menu on each row, and tick several for status, CSV or archive.
    - Columns adapt to screen size, and the ⋯ column stays in view.
13. **Property page:**
    - completion score with "add a detail" chips
    - neutral price check and the buyer's total cost
    - neighbourhood with a team view and a customer view (only checked routes are advertised; planned infrastructure is labelled)
    - never "100% legally clear"
    - archive (can be undone, linked leads get a note) is separate from delete (cascades only after a box is ticked)
14. **Brochure:**
    - "Prepared for …"
    - a list of what is never on the brochure (internal fields)
    - prints only the brochure as a PDF
    - a share log; WhatsApp sending is simulated
15. **Side panel:** on the right on desktop, from the bottom on phones. DataTable columns hide by screen width, and the actions column is pinned.
16. **Fixed dev port**, and try/catch around every storage access.
17. **Sidebar** stays fixed and collapses to icons. List pages fill the width; other pages are centred.

## 9. Shared components
- **`components/ui`** (27 shadcn parts): avatar, badge, breadcrumb, button, card, checkbox, dialog, dropdown-menu, input, label, popover, progress, scroll-area, select, separator, sheet, skeleton, sonner, switch, table, tabs, textarea, toggle, toggle-group, tooltip.
- **`components/app`**:
  - layout: Page, PageHeader, Crumbs, SectionCard
  - status and numbers: StatCard, StatusChip, Chip, Callout, Meter, EmptyState
  - data and filters: KeyValueGrid, FilterBar, Segmented, DataTable
  - panels and inputs: SidePanel, ConfirmDialog, UserAvatar, AmountInput, MiniCalendar
  - `tone.ts`, which maps tones to classes
- **`components/layout`**: app-shell, sidebar, top-bar, crumbs, nav.ts.

## 10. Not built yet
- Bulk import.
- Appointments as a module.
- The pipeline board.
- Settings → business rules.
- Dashboard, Projects, the Matching engine page, the HNI register, Reports, the public enquiry form.
- Roles and permissions, and "My day" per role.
- Stuck leads after 14 days.
- Notifications, tasks, clients, assignment history.

## 11. Problems found
1. **Fixed demo date.** `DEMO_TODAY = '2026-11-16'` is used by the store, nav, property.ts and the top bar. The spec wants dates relative to the real date.
2. **Tamil Nadu only.**
   - `CITIES` has 5 Tamil Nadu cities, and `planNewLead` hard-codes Tamil Nadu city options.
   - Missing from the catalogue:
     - more places: Bengaluru, Hyderabad, Pune, Mumbai, NCR
     - configurations: 1 RK and 2.5 BHK
     - property fields: RERA number, furnishing, Vastu, carpet / built-up / super built-up as their own fields, possession date for every type
     - approval authorities: BBMP, BDA, CMDA, HMDA …
     - units in the model: sq.yd and guntha (the assistant converts some units, but the model can't hold them)
3. **The spec's paste-and-fill example fails.** The name comes out as "Hi". It doesn't read "I'm …", the timeline ("2–3 months"), "ready to move", who else decides, or Whitefield and Sarjapur.
4. **Five money parsers that read a bare number differently:**

   | Parser | Bare number means |
   |---|---|
   | `ai/parse.amounts` | ignored (unit required) |
   | `lib/search.money` | lakhs if below 1000 |
   | `lib/assistant.money` | rupees; below 1000 it asks |
   | `lead-list.lakh` | lakhs if below 1,00,000 |
   | `prop-search.ts` | (its own reading) |

   They should become one module with one clear rule.
5. **Duplicate sentence readers:** two for properties (`lib/search.ts`, `prop-search.ts`) and two for leads (`lead-list.parseLeadSentence`, `understand.leadQuery`).
6. **Stages don't match the spec.**
   - The rebuild has: new, contacted, qualified, recommended, visitScheduled, negotiation, closed, lost.
   - The spec has: New, Contacted, Qualified, Site Visit Scheduled, Site Visit Done, Negotiation, Booked (token paid), Converted, Lost.

   "Recommended" should become a flag rather than a stage.
7. **Missing records:** Client, Appointment (visits have no executive, type, place, reminder or clash check), Task, Notification, Assignment, ImportJob, a global activity log. Users have no active, availability, manager or targets fields. There are 4 executives; the spec wants 3, plus inactive users.
8. **Roles are only for show.**
   - There is one fixed user per role, and no way to pick another executive.
   - Only 4 permissions exist.
   - Routes have no "No access" page, and the AI does not check permissions.
   - Managers see every lead (there are no teams).
9. **Store:**
   - Every change copies the whole database, and the whole app re-renders through Context.
   - New ids come from a possibly stale copy, so two quick adds can get the same id.
   - `checkpoint` uses that same stale copy.
   - Activity ids are fragile, and visit ids use `Date.now()`.
   - There is no data-access layer.

   It should move to Zustand with saving, plus a repository layer.
10. **Layering:** `lib/property.ts` imports from the seed, and `classification.ts` / `readiness.ts` import UI tones. The rules should be pure functions that take `today`.
11. **Masked phone numbers** (`+91 98xxxxxx01`) can't work with call (`tel:`) or WhatsApp (`wa.me`) links.
12. **Auto-assign** has no round-robin tie-break, doesn't skip inactive or on-leave people, and lives inside a component.
13. **No tests at all.**
14. **i18n:** 66 orphan Tamil keys, the Tamil is unreviewed, one namespace holds about 2,200 keys, and the nav uses emoji.
15. **Very large components** that mix screens and rules: lead-page 955 lines, leads-today 570, add-property-page 545, lead-form 543, leads-page 516.
16. **Small issues:**
    - the `labels.ts` subType bug
    - unused ribbon tokens
    - the temporary `/ui-kit` page
    - the `SAMPLE_*` fake file reads
    - `strict` not set in tsconfig
17. **The 90% root font size** on desktop is a workaround.
18. **No "Demo AI" label** on simulated AI output, and no AIService layer yet. It exists only as a plan ("understand.ts is replaced in step B").

## 12. Port decision table

| File (in wireframe-rebuild/) | Decision | Reason |
|---|---|---|
| package.json, pnpm, oxlint | port and improve | Same stack. Add zustand, a chart library, dnd-kit, xlsx, pdfjs, tesseract, vitest and playwright. Replace `cn` with clsx + tailwind-merge (or keep it with the text sizes registered). |
| vite.config.ts | port and improve | Keep the alias and the fixed-port idea with a new port; add vitest. |
| tsconfig*.json | port and improve | Set `strict: true`; keep verbatimModuleSyntax and erasableSyntaxOnly. |
| components.json | port | shadcn settings. |
| index.html (theme script) | port | Stops the dark-mode flash. Rename the storage key. |
| src/index.css | port and improve | Keep how it works (variables, tones with soft and foreground, named text sizes, chart tokens, print rule). **New palette and visual identity.** Drop the ribbon tokens and the 90% root size. |
| src/lib/theme.ts | port | A clean light / dark / system switch. |
| src/lib/utils.ts | port and improve | `cn` with the named text sizes. |
| src/i18n/index.ts | port and improve | Same setup; consider one namespace per module; new storage key. |
| src/i18n/locales/en.json, ta.json | port and improve | Reuse keys for what is ported; remove the 66 orphan Tamil keys. |
| src/data/types.ts | port and improve | Keep Property, Lead (qualification, engagement, budget basis, consent, HNI, classification, lost), Settings and source tracking. Add Client, Appointment, Task, Notification, Assignment, ImportJob and Activity. Extend User. Use the spec's stages. Add the Indian property fields. |
| src/data/catalogue.ts | port and improve | Keep the per-type facts and their required, core and internal flags. Add cities across India, more amenities, the lead sources list and approval authorities. |
| src/data/seed.ts | port and improve | Keep the builders and the rich detail. **Make dates relative to today**, use realistic phone numbers, 1 admin + 1 manager + 3 executives (+ inactive users), 15–20 linked records per module. |
| public/demo-photos/*.jpg | port | 14 real photos (check their licences). |
| src/store/db.tsx | port and improve | Keep how the actions behave: cascades, the consent safety net, forward-only stages, markRecommended, checkpoint / restore for Undo, history lines. Rebuild as Zustand with saving and a repository layer. Fix ids. One permission map with route guards; pick between executives. |
| src/lib/amount.ts | port | The L / Cr model is right. |
| src/lib/format.ts | port and improve | Add phone formatting and call / WhatsApp link builders. |
| src/lib/classification.ts | port and improve | Keep the order; make ₹1.5 Cr a setting; remove the UI import. |
| src/lib/readiness.ts | port and improve | Keep the points, shares and bands; make the points settings (total 100); feed the lead score; remove the UI import. |
| src/lib/consent.ts | port | The DPDP rule. |
| src/lib/matching.ts | port and improve | Keep the filters, formulas, labels and reasons. Merge in the estate-platform matching and its tests. Add possession, type, facing and amenity explanations ("missing: covered parking"). Write unit tests. |
| src/lib/property.ts | port and improve | Pass `today` in instead of importing the seed. |
| src/lib/search.ts | port and improve | Merge with prop-search.ts; use the one money parser; places across India. |
| src/lib/places.ts | port | Picker helper. |
| src/lib/labels.ts | port and improve | Fix the subType bug. |
| src/lib/assistant.ts | port and improve | Becomes `AIService.extractProperty`. Use the one money parser; drop the fake file reads. |
| src/lib/ai/parse.ts | port and improve | The core of the simulated AI. Extend: bare-number rule, sq.yd, timelines, possession, who decides. |
| src/lib/ai/understand.ts | port and improve | Becomes `AIService.parseCommand` / `extractLead`. Fix name reading. Add appointment, task, assign and summary requests, aware of the user's role. |
| src/lib/ai/plan.ts | port and improve | Already "preview → confirm". Extend to appointments, tasks and assignment with permission checks; remove the Tamil Nadu city options. |
| src/lib/ai/answer.ts | port | Lead questions with removable chips. |
| src/features/assistant/use-speech.ts | port | Speech hook; add a message where the browser can't do it. |
| src/features/assistant/assistant-box.tsx, ask-bar.tsx | port and improve | One reusable assistant: new look, a "Demo AI" badge, links to the changed records. |
| src/features/leads/lead-list.ts | port and improve | Keep the tabs, attention rules and filters; drop its sentence reader. |
| src/features/leads/next-step.ts | port and improve | Move to lib; feed the Today views. |
| src/features/leads/lead-form.tsx | reference only | Keep the fields and checks (10-digit mobile, min ≤ preferred ≤ max). Rebuild with the spec's smart required fields; move auto-assign to lib with round-robin. |
| src/features/leads/lead-page.tsx, leads-page.tsx, leads-today.tsx, add-lead-sheet.tsx, inline-edit.tsx, matches-tab.tsx, offer-dialog.tsx, visit-outcome.tsx, reschedule-button.tsx, done-button.tsx, consent-control.tsx | reference only | Carry the UX decisions over; rebuild in the new design as smaller components. |
| src/features/properties/pages/*, tabs/*, components/*, assistant/* (screens) | reference only | Keep the flows; rebuild with the new look. |
| src/features/properties/pitch.ts | port | Talking points. |
| src/features/properties/search/prop-search.ts | port and improve | Merge into one property search module. |
| src/features/settings/settings-page.tsx | reference only | The preferences screen; the new Settings is much bigger. |
| src/components/ui/* | port | shadcn parts, restyled through the tokens. |
| src/components/app/tone.ts | port | Tone-to-class maps. |
| src/components/app/* (data-table, side-panel, amount-input, mini-calendar, segmented, filter-bar, confirm-dialog, status-chip, chip, empty-state, stat-card, meter, callout, key-value-grid, user-avatar, section-card, page-header) | port and improve | Good APIs; restyle for the new graphical look; add loading (skeleton) and error states. |
| src/components/layout/app-shell, sidebar, top-bar, crumbs | port and improve | Redesign. Role-based nav, a profile switcher (3 roles, 3 executives), a notifications bell; Reset demo data moves to Settings. |
| src/components/layout/nav.ts | port and improve | Lucide icons instead of emoji, filtering by role, the new modules. |
| src/hooks/use-media-query.ts | port | Small helper. |
| src/pages/module-placeholder-page.tsx | drop | The spec forbids placeholder screens. |
| src/pages/ui-kit-page.tsx | drop | Temporary; a developer-only route at most. |
| src/App.tsx, main.tsx | reference only | Provider order; the new app needs route guards and lazy-loaded routes. |
| README.md, CHECKLIST.md | reference only | Source of the decisions in section 8 and the business rules (CHECKLIST section 10). |
| dist/, node_modules/, vercel.json | drop | Build output and installed packages. |