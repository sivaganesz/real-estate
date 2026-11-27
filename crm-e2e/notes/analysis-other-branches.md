I could not write `E:\real-estate\crm-e2e\notes\analysis-other-branches.md`: the harness refused it with "Subagents should return findings as text, not write report files". The full analysis is below, ready to save to that path as-is. The two verbatim copies were written with `git show` redirects:
- `E:\real-estate\crm-e2e\notes\ref-estate-matching.ts.txt` (273 lines, `origin/feat/estate-platform:apps/api/src/services/matching.ts`)
- `E:\real-estate\crm-e2e\notes\ref-estate-matching.test.ts.txt` (87 lines, `apps/api/test/matching.test.ts`)

Nothing else was modified, and no branch was checked out.

**Summary**
1. **estate-platform matching** gives each property a label (strong ≥85 with no misses, good ≥65 with at most one miss, otherwise partial) plus reasons in words, and never shows the score. Points are budget 35, location 30, bedrooms 15, size 10, must-haves 10, minus 15 when on hold; anything under 40 is dropped. It has hard filters and remembers each lead's shortlist (a rejected property never comes back). It also caps results at 2 units per project, picks Today's best matches, counts how many leads fit each listing, and has a WhatsApp share template.
2. **wireframe-rebuild matching** follows the approved PRD v2 §11: hard filters, then `M = 0.30B + 0.25L + 0.20S + 0.15A + 0.10P` with weights from Settings. Labels are strong, good, weak, conditional, budget mismatch and excluded. Reasons are translation keys (English and Tamil). It has no tests and no shortlist memory, and it does not check sale vs rent.
3. **Tests:** there are 7 pure unit cases (U1–U7) and 4 database/seed behaviour cases (I1–I4), all restated as input → expected. I worked out the scores the unit cases imply: U1 = 97, strong; U2 = 74, good.
4. **Property statuses v2** (10 statuses plus a transition table that is tested exactly), **catalogue v2** (8 types, 48 attributes, 12 amenities, legal checklists), the property form and page tabs, the photo collage with its full-screen viewer, and the Playwright setup are all documented in detail.
5. **Recommendation:** build the unified engine on wireframe-rebuild's weighted model and add estate-platform's concrete reasons, shortlist memory, per-project cap, Today picks, share flow, and leads-fit counts. Port its unit tests plus new tests for the PRD rules.

---

# Analysis: other branches (read-only)

Phase 0 analysis. Sources were read with `git show` / `git ls-tree` only; no branch was checked out.

- `origin/feat/estate-platform` (EstateOS monorepo: Express + Mongoose API, React 18 + Tailwind 3 + TanStack Query web, `packages/shared`, Playwright `e2e/`)
- `origin/feat/property-management-system` (PRD v2.1, catalogue v2, statuses v2; already merged into `main`)
- Compared with `wireframe-rebuild/src/lib/matching.ts` (current branch)

Verbatim copies for porting:
- `crm-e2e/notes/ref-estate-matching.ts.txt` = `origin/feat/estate-platform:apps/api/src/services/matching.ts`
- `crm-e2e/notes/ref-estate-matching.test.ts.txt` = `origin/feat/estate-platform:apps/api/test/matching.test.ts`

---

## 1. estate-platform: overview

`CLAUDE.md` is just `@AGENTS.md`. `AGENTS.md` describes the layout (apps/api, apps/web, packages/shared, e2e) and frontend rules:
- Tailwind palette classes used directly (no design tokens). That is the opposite of what we want (tokens + light/dark).
- Never use `alert`/`confirm`/`prompt`: use `useConfirm()` and `useToast()`. **Keep this rule.**
- Lucide icons only. Feature modules add panels through slot registries (`slots.ts`, `slots-leads.ts`).
- AI (Gemini) only from the API. The key never reaches the web app.

`STATUS.md` reports phases 0–8 done (foundation, property management, bulk import, leads, pipeline, activities, **matching (Phase 6)**, deals/bookings, projects v2), 74 API tests and 16 Playwright journeys. Deferred items: Maps, Tamil, WhatsApp sending, portal auto-import.

Docs `docs/00`–`08` are one doc per module. The relevant one here is `docs/06-property-matching.md` (summarised in section 2.8).

---

## 2. estate-platform matching algorithm (`apps/api/src/services/matching.ts`)

### 2.1 Philosophy
"Rules with reasons, not a black box." Each property gets a **fit label** (`strong | good | partial`) plus **reasons in words**. A numeric score exists **only to order** results and is **never shown** to users. The AI tool description says: "Explain matches with these reasons; never invent a score."

### 2.2 Inputs
`scoreMatch(r: Partial<Requirement>, p: Property, shortlist = [])`

Requirement (`packages/shared/src/sales.ts`):
- `purpose`: 'sale' | 'rent' | 'lease', default 'sale'
- `types: PropertyType[]`: apartment, villa, plot, commercial, agricultural, industrial
- `budgetMin?`, `budgetMax?`, `city?`, `localities: string[]`, `bedrooms?` (1–10), `areaMin?`
- `mustHaves: string[]`: free text such as "Lift", "East facing", "Borewell", "50 kVA power", "Near a school"
- `timeline`, `financing`, `intent` and `notes` are not used by matching.

Property fields used:
- `type`, `purpose`, `price`, `areaSqft`, `city`, `locality`, `_id`
- `details{bedrooms, facing, waterSource, powerKva}`, `amenities[]`
- `availability`: 'available' | 'held' | 'booked' | 'sold'
- `listing`: 'draft' | 'live' | 'archived'
- `heldUntil`, `approvals[{name, documentUrl}]`

Shortlist (stored on the lead): `{propertyId, status: 'suggested'|'shared'|'liked'|'rejected'|'visited', at}[]`.

`isQualified(r)` = has a budget (min or max) AND a location (city or localities) AND at least one type.

### 2.3 Hard filters (return `null`, so the property is excluded)
In this order:
1. `listing !== 'live'`, or `availability` is `booked` or `sold`.
2. `(r.purpose ?? 'sale') !== p.purpose`.
3. `r.types` is non-empty and does not include `p.type`.
4. The shortlist entry for this property has status `rejected`.
5. Budget: price > `budgetMax × 1.2` (only when the property has a price and the lead has a budget).
6. Location:
   - localities are given, the locality is not one of them, **and** `r.city` is set and differs from `p.city`; or
   - no localities are given, `r.city` is set, and it differs from `p.city`.
7. Bedrooms (apartment/villa only, when `r.bedrooms` is set): the property has bedrooms > 0 and **fewer** than wanted.
8. After scoring: `score < 40`.

### 2.4 Scored factors (maximum 100)

**Budget (up to 35).** Applies only when `p.price` is set and the lead has `budgetMax` or `budgetMin`. `max = budgetMax ?? ∞`.
- price ≤ max → **+35**.
  - If `budgetMin` is set and price < 0.75 × budgetMin: **−10** more (net 25), `near` "`{₹price}` — well under their budget; may feel too small".
  - Otherwise `yes` "`{₹price}`, within budget", plus " (up to `{₹budgetMax}`)" when budgetMax is set.
- price ≤ 1.1 × max → **+20**, `near` "`{₹(price−max)}` over budget (`{round(%)}`%) — worth a try if negotiable".
- price ≤ 1.2 × max → **+5**, one miss, `no` "`{₹(price−max)}` over budget (`{%}`%)".
- Above that → excluded.
- No price on the property → `info` "Price on request", **+0**.
- A price but no budget on the lead → **+15**.

**Location (up to 30).**
- Localities given and the property's locality equals one of them (case-insensitive, trimmed) → **+30**, `yes` "In `{locality}`, a preferred area".
- Localities given, no locality match, and (r.city set ? p.city equals r.city : true) → **+12**, `near` "In `{locality ?? city}`, not one of their areas (`{localities joined ', '}`)".
- Localities given and neither of the above → excluded.
- No localities but a city: same city → **+25**, `yes` "In `{city}`"; another city → excluded.
- Neither localities nor city → **+15**.

**Bedrooms (up to 15).** Applies only when `r.bedrooms` is set and the type is apartment or villa. `b = details.bedrooms ?? 0`.
- b equals wanted → **+15**, `yes` "`{b}` BHK as wanted".
- b greater than wanted → **+11**, `yes` "`{b}` BHK (wanted `{wanted}`+)".
- 0 < b < wanted → excluded.
- b = 0 (unknown) → +0 and no reason (quirk).
- Not applicable (no bedrooms wanted, or another type) → **+10**.

**Size (up to 10).** Applies when `r.areaMin` and `p.areaSqft` are both set.
- area ≥ areaMin → **+10**, `yes` "`{area en-IN}` sq.ft (wanted `{areaMin}`+)".
- area ≥ 0.9 × areaMin → **+5**, `near` "`{area}` sq.ft, slightly smaller than wanted".
- Smaller → **+0**, one miss, `no` "`{area}` sq.ft, smaller than the `{areaMin}` wanted".
- Not given → **+7**.

**Must-haves (up to 10).** Each must-have `m` is lower-cased and checked in this order:
- **Facing**, regex `/(north|east|south|west)(?:[\s-](east|west))?\s*facing/`: true when `details.facing`, lower-cased with its first `-` turned into a space, equals the captured words joined by a space.
- **Amenity**: true when either string contains the other (case-insensitive).
- **Water**: `/borewell|water/` and `details.waterSource` contains "borewell" → true.
- **Power**: `/kva|power/` and `details.powerKva` is set → true when powerKva ≥ the first number in `m` (0 if none).
- **Can't know**: `/near|school|metro/` → unknown (null).
- Anything else → false.

Results:
- true → a hit, `yes` "`{m}`" (the original text).
- false → one miss, `no` "No `{m lower}` listed".
- null → `info` "`{m}` — check".

Points = **round(hits / count × 10)**. No must-haves → **+7**.

**On hold (−15).** `availability === 'held'` → **−15**, `near` "On hold" + " until `{relativeDay(heldUntil)}`" + " for another buyer".

**Legal (no points).** Approvals without `documentUrl` → `info` "`{names joined ', '}` claimed; document pending".

**History (no points).**
- liked → `yes` "They liked this one", **put first** (unshift).
- visited → `info` "Already visited".
- shared → `info` "Already shared" + " `{relativeDay(at)` lower-cased`}`".

With an empty requirement the score is 15+15+10+7+7 = **54**: partial, but included.

### 2.5 Fit label
```
fit = score >= 85 && misses === 0 ? 'strong'
    : score >= 65 && misses <= 1 ? 'good'
    : 'partial'
if (score < 40) return null
```
Misses come from: budget 10–20% over, size below 90%, or a must-have known to be missing.

### 2.6 Service functions around it

**`matchesForLead(leadId, actor, {limit = 6, includeShared = true})`**
- First releases expired holds.
- Database pre-filter: listing live; availability ∈ {available, held}; same purpose; type ∈ types; price ≤ budgetMax × 1.2; exact city match (case-insensitive) when only a city is given. Up to 500 candidates.
- Scores them, drops nulls, optionally drops anything already on the shortlist, and sorts by score descending.
- Keeps **at most 2 per project** (`projectId`) so one tower cannot flood the list.
- Returns `{qualified: isQualified(r), total, items: [{property, fit, reasons, score}]}`.

**`leadsForProperty(propertyId, actor, {limit = 8})`**
- Leads in the **actor's scope** (an executive sees only their own), with stage in OPEN_STAGES and the same purpose.
- Keeps leads that are qualified or have types, scores each with its own shortlist, sorts, and caps the list.
- Returns `lead{id, name, phone, stage, temperature, owner}` + fit, reasons and score.

**`shareWithLead(leadId, propertyIds, actor, {origin})`**
- Errors: "Choose at least one property" for an empty list; "Only live properties can be shared" for non-live properties.
- Ensures each property has a share token and builds the link `${origin}/p/${token}`.
- Creates the shortlist entry as `shared`, or upgrades it from `suggested`.
- Builds the WhatsApp message (exact template below).
- Logs an `Activity` (type whatsapp, status done, outcome "Shared N property/properties", propertyIds), writes an audit entry, and recomputes the lead's next action.
- Returns `{links, message, phone}`.

```
Hi {firstName}, as discussed, here {is an option | are N options} that fit what you're looking for:

• *{title}* — {₹price | price on request}{, locality}
  {url}
(blank line between items)

Happy to arrange a visit at your convenience.
```

**`rateShortlist(leadId, propertyId, 'liked'|'rejected'|'shared')`**: adds or updates the shortlist entry with `at = now`.

**`shortlistOf(leadId)`**: shortlist items with their property.

**`bestMatchesToday(actor)`** (feeds Today "New matches to send"):
- Leads in scope with stage ∈ {qualified, visit, contacted}, sorted by temperature, up to 30.
- For each qualified lead, takes the top unshared match (limit 1, includeShared false) if its fit is not partial.
- Stops at 5.

**`fitCounts(properties, actor)`** (feeds the list's "N leads fit" column and the "Most leads" sort): for a page of listings, the number of open leads in scope (qualified or with types, same purpose) whose `scoreMatch` is not null.

### 2.7 API, AI tools and offline intents (`apps/api/src/modules/matching.ts`)

Routes:
- `GET /matching/lead/:id?limit&all=false`
- `GET /matching/property/:id`
- `GET /matching/today`
- `GET|POST /matching/shortlist/:leadId` (status ∈ liked / rejected / shared)
- `POST /matching/share/:leadId` (1–10 ids)

Reason text for the AI uses the glyphs `✓` yes, `≈` near, `✗` no, `•` info, joined with `; `.

AI tools:
- `match_properties_for_lead`: read, permission property.view.
- `match_leads_for_property`: read, permission lead.create.
- `share_properties_with_lead`: write, permission property.share. It logs and drafts the message; the user still presses send.

Offline intents:
- **On a lead page**, the regex `match|fit|suit|options|properties|recommend` (or "for <name>") replies `"{total} fit. Best:\n• **title** — price, fit fit\n  why"` for up to 4 items. With nothing found:
  - qualified lead: "Nothing live fits right now. Widen the budget or areas…"
  - not qualified: "Their requirement is incomplete (budget, location or type)…"
- **On a property page**, the regexes `leads?|buyers?|customers?|who` + `fit|match|like|interest|want` reply with up to 5 bullet lines. Non-executives also see the owner's name.

### 2.8 Spec doc 06 extras
- Journeys:
  - Customer page → "Properties" card right below the stage bar, with two tabs:
    - "Fits {name}": up to 6 matches; 👍 like, 👎 hide for good; select several → **Send to {name}**.
    - "Shortlist".
  - Property page → "Buyers who fit".
  - Today → "New matches to send" with a Send button.
  - Assistant: "Find properties that fit Ramesh", "Which of my leads would like this?", "Send the top two to Irfan".
- Unqualified customers get **no matches**, with a note on what is missing.
- Listed next steps: learned weights per customer; distance-based location (needs coordinates).

---

## 3. estate-platform matching tests, restated for vitest

Fixture `base` (a property):
```ts
const base = { _id: 'p1', type: 'apartment', purpose: 'sale', listing: 'live', availability: 'available',
  city: 'Chennai', locality: 'Porur', areaSqft: 1080, amenities: ['Lift', 'Car parking'],
  details: { bedrooms: 2, facing: 'East' }, approvals: [] }
```
`formatINR(n)`: ≥ 1 Cr gives `₹{n/1e7 trimmed} Cr`; ≥ 1 L gives `₹{n/1e5 trimmed} L` (trimmed to 2 decimals, no trailing zeros); otherwise `₹{en-IN}`.

### Pure unit tests (port directly)

**U1. Strong fit with reasons.**
- Requirement: `{types:['apartment'], bedrooms:2, budgetMax:7_500_000, localities:['Porur'], mustHaves:['Lift','East facing']}`
- Property: base + `price: 6_800_000`
- Expected: not null; `fit === 'strong'`; reason texts contain (any order) `'₹68 L, within budget (up to ₹75 L)'`, `'In Porur, a preferred area'`, `'2 BHK as wanted'`, `'Lift'`, `'East facing'`.
- Derived: score 35+30+15+7+10 = **97**, misses 0.

**U2. Slightly over budget.**
- Requirement: `{types:['apartment'], budgetMax:6_500_000, localities:['Porur']}`
- Property: base + `price: 6_900_000`
- Expected: not null; the first reason with `ok === 'near'` matches `/₹4 L over budget \(6%\)/`. Full text: "₹4 L over budget (6%) — worth a try if negotiable".
- Derived: 20+30+10+7+7 = **74**, misses 0, so fit is `good`.

**U3. Far over budget.** `{budgetMax:5_000_000}` with base + `price: 6_900_000` → `null` (38% over, beyond 20%).

**U4. Wrong type.** `{types:['plot']}` with base + `price: 1` → `null`.

**U5. Sold.** `{}` with base + `availability:'sold'` → `null`.

**U6. Rejected before.** `{}` with base + `price: 6_000_000` and shortlist `[{propertyId:'p1', status:'rejected'}]` → `null`.

**U7. Fewer bedrooms.** `{bedrooms:3}` with base + `price: 6_000_000` (a 2 BHK) → `null`.

### Integration tests (need the database and seed; port as store-level tests against our seed)

**I1. Matches for a lead.** Executive Priya, lead "Ramesh":
- `qualified === true`; more than 1 item; `items[0].fit !== 'partial'`;
- every item is type `apartment` with price ≤ 7_500_000 × 1.2;
- at most 2 items per `projectId`.

**I2. Buyers for a property.** Manager, the Sunrise Enclave plot (30×40, not corner, available):
- lead names include "Suresh Kumar" and "Sangeetha Raman";
- as executive Arun, every returned lead's owner is "Arun Kumar" (role scoping).

**I3. Share, then reject.** Priya shares the top 2 matches with lead "Irfan" (Mohammed Irfan):
- message matches `/^Hi Mohammed, as discussed, here are 2 options/`;
- `links[0].url` matches `/\/p\/[\w-]+$/`;
- the newest timeline item's title matches `/Shared 2 properties/`.

Then property A is marked `rejected`: A is no longer in the matches, and B is still there with a reason matching `/Already shared/`.

**I4. Today and the assistant.**
- Today best matches for Priya: length > 0.
- Assistant (offline) on Ramesh's lead page, "Find properties that fit them": the reply matches `/fit\. Best:/` and contains `✓`; `records[0].kind === 'property'`.

### Suggested extra unit tests
These come from the code; upstream does not test them.
- Held: −15 and a near reason "On hold…".
- `budgetMin` with price below 75% of it: net 25 and "well under".
- 10–20% over budget: counts as a miss and gives a `no` reason.
- Area at 90–100% of areaMin: +5 and near; below 90%: a miss.
- "Near a school": an info reason ending "— check".
- Liked: put at the front of the reasons.
- No price: the "Price on request" info reason.
- Another city, with localities set and r.city set: null.
- `score < 40`: null.

---

## 4. Matching UI (estate-platform)

### 4.1 Lead page: `features/matching.tsx`
Registered as the "Matches" tab through `leadSlots.tabs`; the tab count is the match total.

- **Header:** "✨ Properties" with a Segmented control: `Fits {first} (total)` / `Shortlist (n)`.
- **States:**
  - lost or booked: "Booked: no more matches needed." / "Reopen the lead to see matches again."
  - loading: "Finding matches…"
  - not qualified: amber note "Matches need their budget, location and type. Fill those in “Looking for”…"
  - empty: "Nothing live fits right now. Try widening their budget or areas."
- **Row:**
  - a select checkbox (aria-label "Select"), a 64×56 cover thumbnail, the price (a link) and the title;
  - a **fit badge**: Strong green, Good brand, Partial amber;
  - inline reasons with the glyphs `✓ ≈ ✗ •`, coloured emerald, amber, rose and slate;
  - 👍 (liked) and 👎 (rejected, which hides it).
- **List:** shows 3 with "Show N more". The footer reads "N selected" next to **Send to {first}** (disabled when nothing is selected).
- **`ShareDialog` modal:**
  - calls share once when it opens (a ref guards against StrictMode's double run);
  - editable message textarea, with the note "Logged on their timeline and added to their shortlist. The links show photos, price and facts — never internal notes.";
  - **Open WhatsApp** (a `wa.me` link) and **Copy** (shows a toast);
  - afterwards invalidates matches, timeline, shortlist, best-matches and the lead.
- **Shortlist tab:** thumbnail, title, price · key facts, and a status badge (Liked green, Not for them red, Visited ai, Shared slate).

### 4.2 Property page: `components/property/MatchingTab.tsx`
- When `!canMatch(p)` (not live, or booked/sold): EmptyState "Not matching right now", explaining why.
- **Summary card:**
  - a big count "N customers fit this property", plus " among yours" when the user lacks `lead.viewAll`;
  - fit filter chips (toggles) with coloured dots and counts: Strong emerald-500, Good brand-400, Partial amber-300;
  - a **stacked proportion bar** by fit;
  - the note "Only open customers, after the hard checks (type, purpose, city, budget). A strong fit meets everything they asked for."
- **Customer cards** (1, 2 or 3 columns):
  - avatar initial with a temperature dot, name link, stage · temperature · owner, fit badge;
  - up to 4 reasons in a slate box;
  - **Send to {first}** (opens ShareDialog with this property) and "Open customer".

Elsewhere:
- The Overview tab sidebar has `TopBuyers`: "Buyers who fit · N", the fit proportion bar, the top 3 with one reason each, and "See all" (opens the matching tab).
- The property list shows "N leads fit" on card footers, a fit column linking to `?tab=matching`, and a "Most leads" sort.

### 4.3 wireframe-rebuild matching UI (for comparison)
- `features/leads/matches-tab.tsx` shows the five part scores (`MATCH_PARTS`) and an "excluded" list (`excludedForLead`, budget near-misses first).
- `share-panel.tsx` scores leads for a property.
- The lead page, Today and Add lead (a live count of matches while typing) all call `propertiesForLead`.

**Design takeaway for crm-e2e:**
- Keep estate-platform's interaction model: reasons with glyphs, multi-select Send, 👍/👎 memory, fit filter chips with a proportion bar, TopBuyers on the overview, and "N leads fit" on list cards.
- Add the master prompt's "match-score ring" on property cards.
- Add wireframe-rebuild's transparent breakdown (five part bars) behind a "Why this score" disclosure, so the default view stays plain words.

---

## 5. Comparison: estate-platform vs wireframe-rebuild

| Aspect | estate-platform `scoreMatch` | wireframe-rebuild `matchScore` (= PRD v2 §11) |
|---|---|---|
| Model | Additive points (35/30/15/10/10), hidden score | Weighted 0–100 parts: `M = 0.30B + 0.25L + 0.20S + 0.15A + 0.10P`; weights in Settings (`matchWeights`) |
| Output | `null`, or `{fit strong/good/partial, reasons[{ok yes/near/no/info, text}], score}` | Always `{score, label, excluded, reasons[{ok true/false/null, key, values}], parts, ceiling}` |
| Labels | strong ≥ 85 with 0 misses; good ≥ 65 with ≤ 1 miss; partial; dropped below 40 | excluded / budgetMismatch (hard fail); conditional (legal pending, or S < 60, i.e. size off by more than 20%); strong ≥ 80; good ≥ 65; weak |
| Hard filters | live and not booked/sold; purpose; type; rejected; over 120% of budget; other city; fewer BHK | status `available` (not archived); type; city ∈ cities; price ≤ max × (1 + flexPct) |
| Budget | ≤ max: 35; ≤ 110%: 20; ≤ 120%: 5 + a miss; well under the minimum: −10 | B = 100 up to preferred, linear 100→70 from preferred to max, 55 within the flex, else 0 (and a hard fail) |
| Location | preferred locality 30, same city 12, city only 25 | L = 100 for a preferred locality (or no preference), 70 for the same city, else 0 |
| Size | areaMin: ≥ 100% gives 10, ≥ 90% gives 5, else a miss | `sizeSqft` target: S = 100 − 200 × \|dev\| (two points per 1%), clamped 0–100 |
| Amenities | Free-text must-haves with facing/borewell/kVA parsers; unknown gives info | A = infrastructure score by type, averaged 50/50 with requested amenities met. Plot: water, electricity, drainage, road. House: water, power, condition. Flat: lift or low floor, parking, power backup, security. Commercial: road ≥ 30 ft, parking, permitted usage |
| Preferences | Bedrooms (exact, more, or fewer → excluded) | P = share of preferences met. Plot: facing, min road, corner. Flat: BHK, parking, possession. House: bedrooms ≥, parking. Commercial: category, occupancy |
| Legal | Info only | A pending approval makes it conditional, never the top pick; `approvalRequired` flag on the lead |
| History memory | Shortlist: rejected excluded, liked first, shared/visited labelled | None |
| Purpose (sale/rent) | Hard filter | Not checked |
| Held | −15 penalty | Not available, so excluded |
| Ranking extras | Max 2 per project; Today best matches; fitCounts | Clean before conditional; `closeOnBudget` (budgetMismatch within ceiling × 1.15); `excludedForLead` |
| Languages | English strings built in | Reason keys + values through i18next (English and Tamil) |
| Tests | 7 unit + 4 integration | None |

**Where the wireframe engine falls short of PRD §11:**
- House preferences lack parking, ready-to-move and minimum land area. It checks bedrooms and parking only.
- House infrastructure lacks "approvals complete".
- Conditional is triggered by any `pending` approval, not by an **open mandatory legal check**.

**Where it falls short of master prompt §14** (which asks for budget, location, configuration, area, **possession**, property type, amenities and **facing**):
- Facing and possession exist only per type, inside P.
- Configuration (BHK) is covered by P.
- The master prompt also wants both directions; the actions shortlist, WhatsApp share, schedule a visit and mark not interested; and "Sold/Booked removes it from matching".

---

## 6. Property status model v2 (property-management-system, PRD §6.8, R1.1)

Statuses: `draft`, `available`, `under_negotiation`, `reserved`, `booked`, `on_hold`, `sold`, `rented`, `leased`, `archived`. The closed status must match the purpose: sale → sold, rent → rented, lease → leased.

| Status | Visible to customers / matching |
|---|---|
| Draft | No |
| Available | **Yes** (passes the publish checklist) |
| Under negotiation | No (excluded from matching, ⚑ D12) |
| Reserved (token received) | No |
| Booked | No |
| On hold | No |
| Sold / Rented / Leased | No |
| Archived | No (hidden; data kept) |

Transition table (PROP-43), tested exactly in `packages/shared/src/schemas/statuses.test.ts`:
```
draft:              available, archived
available:          under_negotiation, reserved, booked, on_hold, sold, rented, leased, archived
under_negotiation:  available, reserved, booked, on_hold, sold, rented, leased, archived
reserved:           available, booked, sold, rented, leased, archived
booked:             available, sold, rented, leased, archived
on_hold:            available, archived
sold|rented|leased: available (relist), archived
archived:           draft (restore)
```
`canChangeStatus(from, to, purpose)` also enforces the purpose rule:
- `available → rented` is false for a sale;
- `reserved → leased` is true for a lease;
- `booked → sold` is false for a rent.

Rules:
- **Publish checklist** before Draft → Available (PROP-42): price or Price on request, area, city, locality, pincode, all required attributes, at least one photo.
- **Changing status** works from the header dropdown (allowed moves only), the row menu and **bulk**. Every change is logged.
- **v1 aliases:** `published → available`, `unpublished → on_hold`.
- **Archive** needs confirmation:
  - the dialog lists linked customers and warns about upcoming appointments;
  - it takes an optional reason (Sold outside the system, Withdrawn by owner, Listing expired, Duplicate listing, Other);
  - it logs to each linked customer's timeline;
  - **Restore** brings it back as Draft.
- **Delete** is allowed only when the property is not linked to any customer; otherwise the dialog offers "Archive instead". When allowed, the user must tick "I understand that ‹code› will be permanently deleted", and a tombstone is kept.

Other branches:
- wireframe-rebuild has `draft | available | negotiation | reserved | booked | onHold | sold` plus an `archived` audit record. That is close; we need to add `rented`/`leased` and the transition table.
- estate-platform uses two axes instead: `listing (draft/live/archived)` × `availability (available/held/booked/sold)`, with `heldUntil` and automatic release of expired holds. The hold-with-expiry idea is worth keeping as `on_hold` plus an optional `heldUntil`.

---

## 7. Catalogue v2 (`docs/v2/PROPERTY-CATALOGUE.md`, approved 2026-11-16)

### Types
| Category | Type | Code | Purposes | Main area means |
|---|---|---|---|---|
| Residential | Residential plot | `PLT` | Sale, Lease | Plot / land area |
| Residential | Flat / Apartment | `APT` | Sale, Rent, Lease | Built-up area |
| Residential | Independent house / Villa | `VIL` | Sale, Rent, Lease | Built-up area |
| Commercial | Office space | `OFC` | Sale, Rent, Lease | Carpet / usable area |
| Commercial | Shop / Showroom | `SHP` | Sale, Rent, Lease | Carpet / usable area |
| Commercial | Warehouse / Godown | `WHS` | Sale, Rent, Lease | Carpet / usable area |
| Commercial | Commercial building | `CBD` | Sale, Rent, Lease | Carpet / usable area |
| Commercial | Industrial shed | `ISH` | Sale, Rent, Lease | Carpet / usable area |

- Removed: CLD, AGR and IND. The "Other" category is kept but inactive.
- Choice A: each commercial kind is its own type.
- The property code is `RE-{PREFIX}-…`. It is generated on first save and never changes.

### Core fields
ID, title (5–150 characters), category/type, purpose, state, city, locality, pincode, and:
- area: the label comes from the type's main-area meaning, with a unit; also stored in sq.ft;
- asking price with a basis (Total / Per sq.ft / Per month), Negotiable, Price on request;
- ₹/sq.ft: automatic (price ÷ sq.ft), shown with its basis, e.g. "₹2,333 / sq.ft. (plot area)";
- status and listing date;
- rent and lease add a security deposit and lock-in months;
- Featured flag.

### Common attributes
Facing (8 directions), Road type (Tar, Concrete, Gravel, Mud, Main, Highway service, Industrial road), Road width (ft), Description. Road details are asked **once**, on the Location tab (Choice B).

### Type attributes
**PLT (12):**
- Length (ft), Width (ft)
- Road access: Public road / Layout road / Private-pathway
- Corner: Non-corner / Corner
- Topography: Level, Gentle slope, Elevated, Low-lying
- Survey number, Subdivision, Layout approval details
- Land-use: Residential, Mixed residential, Commercial, Agricultural (conversion required)
- Water supply ⇄ (shared)
- Electricity: Available at site / Line nearby — connection to apply / Not available
- Drainage: Underground / Open drain / Not available

**APT (11):**
- BHK: 1, 2, 3, 4, 4+ BHK
- Carpet area, Super built-up area, Floor number, Total floors, Lifts
- Parking allocation: None, 1 covered, 2 covered, 1 open, Shared
- UDS (sq.ft), Maintenance ⇄ (₹/month)
- Possession status: Ready to move / Under construction
- Expected possession (a new **month** attribute type)

**VIL (13):**
- House or villa: Independent house / Villa (gated community) / Row house
- Land area, Floors, Bedrooms, Bathrooms
- Car parking: None, 1, 2, 3+ cars
- Construction year
- Construction quality: Premium / Standard / Basic
- Condition: New, Good, Needs minor repair, Needs major repair
- Private garden, Water supply ⇄
- Power arrangement: EB; EB + inverter; EB + generator backup; EB + solar
- Approval & completion documents: Approval + completion available / Approval only / Not available

**Commercial (10, shared by all 5 types):**
- Floor (text), Frontage (ft)
- Parking: None, Street parking, Dedicated 1–5, Dedicated 5+
- Permitted usage
- Occupancy: Vacant / Tenanted / Owner-occupied
- Rental income (₹/month), Lease duration, Lease terms, Maintenance ⇄, Operating expenses (₹/year)

Water supply options: Municipal supply, Borewell, Municipal + borewell, Tanker dependent, Not available. In total: 4 common + 44 type-specific = 48 attribute definitions.

### Amenities (12)
| Amenity | Applies to |
|---|---|
| Gated community | Residential |
| Security | All |
| Park / open space | Residential |
| Power backup | All |
| Lift | Flat, House, all commercial |
| Gym, Swimming pool, Clubhouse | Flat, House |
| Rainwater harvesting | All |
| CCTV | All |
| Visitor parking | Flat, House, all commercial |
| Loading bay | Warehouse, Industrial shed |

### Legal checklist defaults
★ = mandatory; a property is never a top recommendation while one is open.
- **PLT:** Parent documents, Sale deed★, EC★, Patta, FMB/survey, Land-use, Layout approval★, RERA, Tax receipts.
- **APT:** Parent documents, Sale deed★, EC★, Patta, Building plan★, Completion/OC, RERA★, Tax receipts.
- **VIL:** Parent documents, Sale deed★, EC★, Patta, FMB, Building plan★, Completion/OC, Tax receipts.
- **Commercial:** Parent documents, Sale deed★, EC★, Patta, Land-use, Building plan★, Completion/OC, Fire NOC, Tax receipts.

Each check has exactly three statuses: **Not collected · Collected, pending verification · Verified by authorised legal professional**. Uploading a document sets it to pending, never to verified. Customer wording reads "8 of 9 document checks verified…"; the product **never** says "100% legally clear".

### Configurable attributes
- Category → Type → Attributes. Attribute types: text, long text, number with unit, yes/no, dropdown, multi-select, date and **month**.
- "+ Add attribute" on the form offers "Only this property" (the default) or "All ‹type› properties". The second goes through a **confirmation step** that shows how many properties it affects, then gets a "New — added from ‹code›" review tag.

The master prompt also asks for RERA number, new booking vs resale, furnishing, Vastu, approval authority (BBMP/BDA/DTCP/CMDA/HMDA), khata/patta and loan eligibility. These must be added on top of catalogue v2.

---

## 8. Property form and page tabs (PRD 2.1, R1.2/R1.3)

### Form (PROP-59..63)
One card with numbered sections:
1. **Main information:**
   - ID "Auto: RE-PLT-…", title, type (grouped), derived category, purpose;
   - state, city, locality, pincode, facing;
   - area with unit, price with basis, live ₹/sq.ft;
   - status (allowed moves only; choosing Available runs the checklist on save) and listing date;
   - rent deposit and lock-in;
   - checkboxes Negotiable / Price on request / Featured; Description.
2. **Type-specific specifications:** a type chip; optional fields can be removed from one property; "+ Add attribute".
3. **Amenities:** checkboxes.
4. **A note** pointing to the Location, Legal, Pricing and Media tabs.

Photos are **not** on the form (they live on the Media tab). Road details and the map pin live on the Location tab.

Behaviour:
- "Save property" creates a Draft and opens the Location tab.
- In edit mode the heading is "Edit ‹title›" and Save is disabled when nothing changed.
- Cancel and Save are sticky, and unsaved changes are protected.
- Changing the type swaps section 2 without losing section 1.

### Page tabs (PROP-66)
Routes: `/properties/:id`, `/location`, `/media`, `/history`.
- **Specifications:** description grid, "Not recorded" for empty values, amenity chips.
- **Location:**
  - address, landmark, lat/lng pin, road type and width;
  - highway: name, km, how it was measured;
  - **nearby places**: category, name, measured road km, route checked, status (Existing / Under construction / Planned / Proposed);
  - "OK to advertise" only when Existing **and** route checked;
  - customer preview: "Nearby (measured by road)" vs "Future infrastructure — not yet existing", plus a count of hidden places.
- **Legal & documents** (n/total badge): summary tiles, an amber banner while a mandatory check is open, and a note that checks are not interchangeable.
- **Pricing & valuation:**
  - price review date and the ₹/sq.ft formula;
  - comparables: Asking or Transaction, date, source, differences;
  - averages and range;
  - a neutral position line (within, below or above the range; never "bargain");
  - a bar chart;
  - transaction costs = price × (stamp 7% + registration 4% + other 1%, from Settings), labelled as assumptions;
  - the valuer's report.
- **Matching customers:** hidden until R5.
- **Media:**
  - photos with a cover, floor plans, brochures, documents, videos;
  - limits: JPG/PNG/WebP up to 10 MB (resized to WebP), MP4/WebM up to 50 MB, PDF up to 20 MB, 60 files max;
  - ordering, cover pick, drag and drop, captions, delete confirmation.
- **History:** who, what, when, before → after.

### Header (PROP-64)
- type icon and name;
- chips: code, category, type, purpose, status;
- meta line: locality, city, state · area · facing · listed date;
- price + ₹/sq.ft with basis;
- actions: status dropdown, Edit, Archive, Delete / Restore.

Inline tab edits save field by field and are logged.

### estate-platform's newer page (`pages/PropertyDetail.tsx`)
- **Tabs:** `overview | legal | price | matching | history`.
  - The current tab is kept in `?tab=`.
  - Count chips: Legal & documents shows the document count; Matching customers shows the buyer count.
  - An underline tab list that scrolls horizontally.
- **Header card:**
  - a status pill with a coloured dot: available emerald, held amber, booked sky, sold slate, draft amber, archived slate;
  - "For rent" and "Part of a project" chips;
  - the title with an inline edit pencil, the code in monospace, type, locality and city;
  - **HeaderFacts**, four icon tiles that depend on the type:
    - apartment: BHK, area, floor "x of y", facing;
    - plot: W×L, area, facing, road width;
    - villa: BHK, built-up, land, facing;
    - commercial, agricultural and industrial have their own sets;
  - approval chips: a green ShieldCheck for each uploaded approval, and an amber "N documents pending" link to the Legal tab;
  - on the right: the big price, ₹/sq.ft (₹/acre for land) · Negotiable;
  - actions: availability dropdown, Publish (disabled with a "Still needed: …" tooltip), Share, Edit;
  - a ⋯ menu: AI "Draft a buyer message", Archive (with confirmation), Restore as draft.
- **Overview tab:** a two-column grid, `1fr 340px`.
  - Left: Gallery; DetailsCard (every spec of the type, including empty ones, so gaps are visible); Highlights; Other details (with an "Internal" badge).
  - Right: PriceCheck (comparables verdict), TopBuyers, ToDo (missing items), and LocationCard last.

**Recommendation:**
- Use the PRD tabs as the structure: Specifications (call it Overview), Location, Legal & documents, Pricing & valuation, Matching customers, Media, History, and add Appointments.
- From estate-platform, keep the header facts, the overview sidebar (price check, top buyers, to-do) and the `?tab=` URL state.

---

## 9. Photo gallery approach (estate-platform `OverviewTab.tsx`)

**Collage.** Airbnb-style, with the layout chosen by the number of photos:
- 1: a full-width hero (220 px, 300 px from `sm`);
- 2: a `1.4fr 1fr` split;
- 3: one large tile spanning 2 rows on the left, two stacked on the right;
- 4: a 4-column grid with the hero `col-span-2 row-span-2`, two small tiles and one wide tile;
- 5 or more: the hero plus a 2×2 grid; the last tile carries a "+N more photos" overlay (slate-900/55 with backdrop blur).

Details:
- 1–1.5 px gaps, `rounded-3xl`, `scale-105` on hover, and a gradient on the hero holding a "N photos" pill.
- The first image loads `eager`, the rest `lazy`.
- Each tile is a `<button>` with the aria-label "Open photo i of n".

**No photos yet.**
- Shows **demo SVG photos** (`/demo/facade, living, kitchen, bedroom, amenities, balcony.svg`) labelled "Sample preview".
- An "Add photos" pill (top-right, editors only) opens a hidden `<input type=file accept=image/* multiple>`.
- The code copies the FileList before resetting `value`, so the same file can be picked again, and uploads through FormData.

**Viewer.**
- A portal dialog (`role=dialog aria-modal`) that focuses itself; Esc closes it and ←/→ move between photos.
- The photo is centred with `object-contain`; prev/next arrows wrap around (modulo); an "i of n" counter.
- A thumbnail strip: the current photo has a white ring, the others are at 50% opacity.

**For crm-e2e (no backend):**
- Port the collage and the viewer.
- Store uploads as downscaled data URLs, or as object URLs kept in IndexedDB, with a cover pick and ordering (PRD Media).
- Keep the demo placeholder art, but make it obviously a sample.
- Use Radix Dialog for focus trapping.

---

## 10. Playwright setup (estate-platform)

### `playwright.config.ts`
- `testDir ./e2e`; timeout 60 s; expect timeout 10 s; `fullyParallel: false`; `workers: 1`; list reporter.
- `baseURL http://localhost:5190`; `trace: retain-on-failure`.
- Projects:
  - `desktop` (Desktop Chrome);
  - `phone` (Pixel 7, `grep: /@phone/`, so only tests tagged `@phone` run on the phone).
- `webServer[]`:
  - **API** on port 4190 with `EPHEMERAL_DB=1` and an empty `GEMINI_API_KEY` (offline AI); health URL `/api/health`.
  - **Web:** `vite build --outDir dist-e2e`, then `vite preview --port 5190 --strictPort`, with its own Vite cache directory.
  - The tests run against the **built** app, which is steadier than the dev server. `reuseExistingServer: false` keeps them away from the user's dev server.

### `e2e/journeys.spec.ts` (254 lines, 16 journeys)
Helpers:
- `signIn(page, role)`: clicks the demo role button on `/login` and expects an h1 "Good morning/afternoon/evening".
- `openLead`.

Executive journeys:
- Today → log a call ("Interested" plus a note → "Logged"; the stage becomes Contacted). Tagged `@phone`.
- **Matches tab:** "Strong fit" and "within budget" are visible; select 2 → "Send to Mohammed" → the textarea reads "Hi Mohammed, as discussed, here are 2 options"; "Open WhatsApp" is visible.
- Book an appointment from the calendar.
- Cannot open someone else's lead.

Manager journeys:
- Add a property by describing it: the AI fills price 11500000; Save & publish shows "₹1.15 Cr" and "Available".
- **Walk the property tabs:** Price check; Price "Total for the buyer"; "Matching customers" with "customers fit this property" and a "Send to" button; History "All ·".
- Import a messy xlsx through the Check screen.
- Approve a discount.
- Deal steps.
- Pipeline move by menu or drag, with prompts for the missing evidence.

Other journeys:
- Assistant offline answers (`@phone`); the assistant page keeps the chat.
- The buyer share page shows no internal notes.
- Projects wizard, and starting a deal from the layout.

Selectors are role- and name-based (`getByRole('tab', {name: /Matches/})`, `getByRole('button', {name: 'Select'})`). There are no test ids.

**For crm-e2e:**
- Use the same pattern without an API: one `webServer` running `vite build --outDir dist-e2e && vite preview --port 5190 --strictPort`.
- Reset the seed through a URL flag, or with `localStorage.clear()` in `beforeEach`.
- Desktop + phone (`@phone` tag), 1 worker, role-based selectors.
- One spec file per role journey, plus a matching spec.

---

## 11. Decisions: port / improve / reference / drop

| Item | Decision | Reason |
|---|---|---|
| wireframe-rebuild `lib/matching.ts`: hard filters, five-part weighted score, Settings weights, labels incl. conditional/budgetMismatch, `closeOnBudget`, `excludedForLead`, i18n reason keys | **Port and improve** (the base of the unified engine) | It implements the approved PRD v2 §11, already uses our data model and Settings, and is bilingual. Missing: purpose filter, shortlist memory, house preferences and infrastructure per the PRD, facing and possession as master-prompt factors, conditional based on mandatory legal checks, tests. |
| estate-platform reasons: amounts and % over budget, "well under budget", "slightly smaller", must-have parsers (facing, borewell, kVA), the four tones `yes/near/no/info` | **Port the ideas into the unified engine** | Reasons a salesperson can say aloud are its best feature. Turn them into translation keys with values (e.g. `overBudget {amount, pct}`). |
| Additive 35/30/15/10/10 scoring and the hidden score | **Drop** as a scoring model | Conflicts with the approved PRD formula and with weights editable in Settings. Keep the "words first, numbers on demand" presentation: show the label and reasons first, with the score ring and breakdown secondary. |
| Shortlist memory (suggested / shared / liked / rejected / visited; rejected excluded forever, liked first, "Already shared {day}") | **Port** | Serves the master prompt's actions (shortlist, mark not interested) and prevents sending the same property twice. |
| Max 2 units per project | **Port** | Cheap, and good UX once projects exist. |
| `bestMatchesToday` (one unshared, non-partial match per qualified lead, max 5) | **Port** to the Today / My day view | The master prompt makes Today central for executives. |
| `fitCounts`: "N leads fit" on the list plus the "Most leads" sort | **Port** | Matches the master prompt's property list with matched leads. |
| `shareWithLead`: WhatsApp template, timeline log, shortlist | **Port** client-side (`wa.me` link; log the activity in the store) | Required action "share details on WhatsApp". Keep the exact template, made bilingual. |
| Qualified gate (budget + location + type) with a note on what is missing | **Port** | Avoids guessed matches. wireframe-rebuild's readiness and classification code can supply the list of gaps. |
| Held penalty (−15) and automatic release at `heldUntil` | **Reference** | v2 statuses exclude On hold from matching. Keep `heldUntil` only as data for the status chip. |
| "Claimed; document pending" approval info | **Improve**: make it a conditional label driven by open **mandatory legal checks** (PRD PROP-34) | The PRD is stricter and approved. |
| Matching UI: lead "Fits {name}" with select + Send and 👍/👎; property "Matching customers" with fit chips, proportion bar and cards; TopBuyers sidebar | **Port the interaction, redesign the visuals** | Proven flows with e2e coverage. The new visual design (score ring, tokens, dark mode) is required. |
| wireframe-rebuild `matches-tab` part-score bars and excluded list | **Port** behind "Why this score" and "Left out (n)" | PRD MATCH-01/03 transparency. |
| PRD MATCH-04 Matching engine page (Step 1 table of filters, Step 2 ranking) | **Port** as a manager/admin page | Explains the engine and helps tune the weights. |
| Property statuses v2, the transition table, the purpose rule for closing | **Port** (shared domain code; copy the tests from `statuses.test.ts`) | Approved, and wireframe-rebuild is close. Add rented/leased and `canChangeStatus`. |
| Catalogue v2 types, attributes, amenities and legal checklists | **Port** (merge with wireframe-rebuild `catalogue.ts`) and add the master-prompt attributes (RERA number, new/resale, furnishing, Vastu, authority, khata/patta, loan banks) | Approved data; the master prompt adds fields. |
| Property page tabs (PRD) plus estate-platform's header facts, overview sidebar and `?tab=` | **Port the structure, redesign** | Best of both. |
| Airbnb-style collage, viewer and demo placeholders | **Port and improve** (Radix Dialog, keyboard, swipe on phones, cover and ordering on the Media tab) | Strong, adaptive and accessible. |
| Location tab nearby rules ("OK to advertise" only when Existing and route checked) | **Port** (already in wireframe-rebuild `places.ts`) | Business rule. |
| Express/Mongo API and the Gemini server tools | **Drop** (reference only) | crm-e2e is frontend-only with a simulated AI provider. The tool names and descriptions are a good model for `AIService.matchProperties`. |
| Offline assistant intents for matching ("N fit. Best: …", "Which leads would like this?") | **Port** into the simulated AI provider | The master prompt asks for AI everywhere, with a simulated provider by default. |
| Playwright config pattern (built-app preview, own port, desktop + `@phone`, 1 worker) | **Port** | Proven setup. Drop the API webServer. |
| Tailwind palette classes without tokens (AGENTS.md) | **Drop** | We use design tokens with light and dark themes. |
| No `alert`/`confirm`/`prompt`; confirm hook + toast | **Port** as a rule in CONVENTIONS.md | Good practice. |

---

## 12. Recommendation: the unified matching engine (`crm-e2e/src/lib/matching.ts`, pure and synchronous)

### Functions
- `matchScore(lead, property, settings, ctx?: {shortlist, now}) → Match`
- `propertiesForLead(lead, properties, settings, opts?)`
- `leadsForProperty(property, leads, settings, opts?)`
- `excludedForLead(...)`, `closeOnBudget(...)`
- `bestMatchesToday(leads, properties, settings, scope)`
- `fitCounts(properties, leads, settings)`

The same scoring function serves both directions.

### Step 0: gate
If `isQualified(lead)` is false (no budget, no city/locality, or no type), the list functions return `{qualified: false, gaps}`. A single `matchScore` call still works, for the property side, the Add-lead live count and the AI.

### Step 1: hard filters
Any failure excludes the property. The label is budgetMismatch when the budget is the only failure.
1. Property status is `available` and the property is not archived. Draft, under_negotiation, reserved, booked, on_hold, sold, rented and leased are all excluded; this covers the master prompt's "Sold/Booked removes it".
2. Purpose: the lead's purpose (buy → sale, rent, lease) equals the property's purpose.
3. Type: the property type is one of the lead's types. Allow several; wireframe-rebuild has a single type, so extend it to an array.
4. City is one of the lead's cities.
5. Price ≤ max × (1 + flexPct).
6. Not rejected in the lead's shortlist.
7. Lead stage is not lost or closed (property → leads direction).

### Step 2: score
`M = Σ w·part`. Weights come from Settings and must sum to 1; defaults are B 0.30, L 0.25, S 0.20, A 0.15, P 0.10.
- **B (budget):** the PRD/wireframe curve (100 up to preferred, linear 100→70 to max, 55 within the flex). Add estate-platform's "well under the minimum" nudge as a reason, and optionally set B = 85 when price < 0.75 × min.
- **L (location):** 100 for a preferred locality or no preference, 70 for the same city. Distance can come later.
- **S (size):** 100 − 200 × |dev|.
- **A (amenities):** infrastructure by type (add "approvals complete" for houses, per the PRD), averaged 50/50 with requested amenities.
- **P (preferences):** fully per the PRD:
  - plot: facing, min road width, corner;
  - flat: BHK, parking, possession;
  - house: bedrooms ≥, parking, ready-to-move, min land area;
  - commercial: category (= the type in catalogue v2), occupancy;
  - plus **facing for every type** when the lead asks for it (master prompt), and furnishing/Vastu when present.
  - Each P check has three outcomes: unknown property data gives `info` ("check"), not `no` (from estate-platform).

### Labels
- `excluded` / `budgetMismatch` from the hard filters.
- `conditional` when a mandatory legal check is open or S < 60. A conditional match is never the ★ top recommendation, and clean results rank first.
- `strong` ≥ 80, `good` ≥ 65, otherwise `weak`.

On screen: strong, good and weak, plus a conditional badge carrying the legal caveat.

### Reasons
Shape: `{tone: 'yes'|'near'|'no'|'info', key, values}`, rendered through i18n (English and Tamil), carrying the concrete numbers:
- budget: `overBudget {amount, pct}`, `withinBudget {price, max}`, `wellUnder`;
- location: `preferredLocality {name}` / `otherLocality {name, wanted}`;
- size and layout: `bhkExact` / `bhkMore`, `sizeOff {pct}`, facing, possession;
- status and legal: `onHold`, `docPending {list}`;
- history: `liked` (put first), `shared {when}`, `visited`.

### Ranking
Clean before conditional, then score descending, then liked as a tie-break. At most 2 per `projectId`. Including already-shared properties is optional.

### Actions (store)
- `shortlist(leadId, propertyId, status)`: suggested / shared / liked / rejected / visited.
- `shareOnWhatsApp(leadId, propertyIds)`: uses the estate-platform template (bilingual), opens `wa.me`, logs a timeline activity and sets the status to shared.
- `scheduleVisit(leadId, propertyId)`: opens the appointment form.
- `markNotInterested`: the same as rejected.
- The PRD's "Recommend to customer" moves early stages to "Property recommended".

### AI
The simulated provider's `matchProperties` / `matchLeads` return the same Match objects. Replies follow the estate-platform format ("N fit. Best: • title — price, label\n ✓ … ≈ …") and never invent a score.

### Tests (vitest)

**(a) The 7 estate-platform unit cases, re-expressed on the new model:**
- U1: strong, with reasons within budget, preferred locality, 2 BHK, Lift, East facing.
- U2: a near reason "₹4 L over budget (6%)". This needs flexPct ≥ 6.2%, or the case becomes budgetMismatch, so set flexPct to 10 in the fixture.
- U3: excluded (budgetMismatch).
- U4: excluded (type).
- U5: excluded (sold).
- U6: excluded (rejected).
- U7: fewer bedrooms than wanted. Either a P miss with the label not strong, or excluded if "fewer BHK excludes" stays a hard filter. **Recommend keeping it as a hard filter for flats and villas**, to stay faithful to the ported test.

**(b) The I1–I4 behaviours against the crm-e2e seed:**
- properties of the right type and within the ceiling; at most 2 per project;
- role-scoped leads for a property;
- the share message template; a rejected property removed; the "Already shared" reason;
- Today's best matches not empty;
- the assistant reply format.

**(c) New PRD tests:**
- the weights sum to 1 and the formula is applied;
- the B curve breakpoints; S = 100 − 2 per 1%;
- an open mandatory legal check gives conditional, which is never the top pick; clean ranks before conditional;
- `closeOnBudget` within 15% of the ceiling;
- the order of the excluded list;
- the status transition table.