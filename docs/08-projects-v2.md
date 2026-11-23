# 08 · Projects v2

**Status:** built · **Commit:** `a885a80` · **Users:** managers and admins set up, price and publish projects; executives see published projects and start deals from the layout.

## 1. What the wireframes proposed

The owner asked to bring in their earlier wireframes, sections 8–11 (`E:\before-sample\wireframes`). In short:

| # | Screen | What it proposed |
|---|---|---|
| 8 | Project listing | One card per project with an inventory bar. Available / Booked / Sold counts open the layout filtered. Draft and Published tabs, a completion % per project. |
| 9 | Add project | Three steps: basics → towers and units (or blocks and plots) with a live preview → amenities, media and approvals. Pricing by base rate plus floor rise or corner premium. Upload the DTCP / CMDA layout drawing and the AI reads the plots. |
| 10, 10b | Project layout | Building view (floors × flats) or site plan (blocks, roads, park); 10b is the same screen for a plotted layout. Click a unit to see its details and mark it Booked, Sold or Available with a customer name. |
| 11, 11b | Master plan | An illustrated site plan (roads, entrance, park, pond) and a tower elevation (sky, balconies, lobby). Every unit is clickable and coloured by status. |

Almost all of it was built as drawn. One part was changed on purpose: see section 3.

This replaces the Phase 1 way of loading a project (an "Add units" form that made a block of identical floors × units). Projects are now set up from their layout.

## 2. Decisions

| Question | Decision |
|---|---|
| How is a project's layout entered? | **Described once**, and every unit follows from it. **Apartments and commercial:** towers, each with floors and a **per-floor plan** (the flat type at each position; every floor repeats it). **Plotted layouts:** blocks of plots, each plot **width × length** in feet. **Villa communities:** rows of villas, with **bedrooms and built-up area** per row. |
| Flat types | Studio, 1–5 BHK (Shop and Office for commercial). Each has a default area the manager can change for the project, e.g. 2 BHK 1,150 sq.ft. |
| Facing | From the unit's position. In a tower: the first flat on a floor faces **East**, the last **West**, the ones between alternate **North / South**. In a plotted layout, blocks alternate **North** and **South** facing, as back-to-back rows do. |
| Unit numbers | **A503** = tower A, floor 5, flat 03. **A-07** = block A, plot 7. Tower and block codes are up to 4 letters and must be unique in the project. |
| Pricing | Optional, set once for the project. **Base rate** in ₹ per sq.ft. Towers add a **floor rise** (₹ per sq.ft for each floor above the first). Plots and villas add a **corner premium** (default 5%) to the first and last plot in each block. Plots are priced on land area, villas on built-up area. |
| Re-pricing | Saving the layout with a new rate re-prices **available and held** units. **Booked and sold units keep the price they were sold at.** |
| Saving a changed layout | New positions become new units. Existing ones get their size and details refreshed. Positions that disappeared are archived. |
| Protection | Saving **refuses** to remove any unit that is **held, booked, sold or under negotiation** (an open deal). Nothing is saved, and the units are listed: "Can't save: 2 units with a buyer would be removed (A101, A102). Keep them in the layout, or release them first." |
| Size limits | Up to 20 towers, 80 floors, 20 flats per floor; up to 40 blocks of 300 plots; 2,000 units per project. The project type can't change once it has units. |
| Draft and publish | A new project is a **draft**: managers and admins can see it, the sales team can't. **To publish**, it needs a type, name, city, locality, construction status and the layout. Everything else raises the completion % but doesn't block. |
| What publishing does | Every **complete** unit goes on sale. Units missing something (e.g. no price because no base rate was set) stay in draft and are counted: "Published · 40 units on sale · 4 need details". In a published project, new units added later go on sale straight away if they're complete. |
| What unpublishing does | Unsold, **available** units go back to draft and the sales team stops seeing the project. Held, booked and sold units are left as they are. |
| Who sees what | **Executives only see published projects**, and none of their draft units. Managers and admins see drafts too. |
| Construction status | Worded by layout: towers are *Pre-launch / Under construction / Ready to move*; plots and villas are *Pre-launch / Under development / Ready for registration*. |
| Approvals | RERA, DTCP / CMDA, Bank approved, OC / CC. Claimed once on the project and **flow to every unit**. The document is uploaded once on the project page and every unit links to it. Amenities flow down the same way. |

**Two worked examples from the demo data:**

- **Green Meadows A503:** Tower A's plan is 3 BHK, 2 BHK, 2 BHK, 3 BHK, so flat 03 is a 2 BHK (1,080 sq.ft), facing South. At ₹6,300 base and ₹50 floor rise: 1,080 × (6,300 + 4 × 50) = **₹70.2 L**.
- **Sunrise Enclave A-07:** a 30 × 40 ft plot (1,200 sq.ft) in Block A, facing North. At ₹3,000: **₹36 L**. A-01 is a corner plot of 30 × 50 ft, so 1,500 × 3,000 + 5% = **₹47.25 L**.

**Completion %** (shown in the wizard, on the project card and the draft banner):

| Part | Weight | How it's earned |
|---|---|---|
| Basics | 25 | 4 each for type, name, city, locality, construction status; 3 for the developer; 2 for possession date or land area |
| Layout | 20 | At least one unit |
| Pricing | 15 | A base rate |
| Amenities | 15 | Pro rata, up to four |
| Description | 10 | A short description |
| Approvals | 15 | 7 for claiming any; 8 more as their documents are uploaded |

The three most valuable next steps are shown with their gain, e.g. "Add pricing +15%".

## 3. The one change from the wireframe

**The wireframe let anyone click a unit and mark it Booked or Sold with a buyer's name.** We didn't build that. **Deals stay the only route to Booked and Sold**, so every booking has:

- a price agreed within the discount limits, or approved (Phase 7);
- a booking amount, confirmed by a manager;
- a payment plan;
- the customer's stage moved, and other negotiations on that unit closed.

A click-to-book would skip all of that and let two people "book" the same unit.

What clicking a unit does instead:

| Unit is | The panel shows |
|---|---|
| Available | Its facts (type or size, area, floor, facing, corner, price) and **Start a deal for a customer**. Pick the customer (executives pick from their own), optionally type their first offer in lakhs, and the deal opens. The customer moves to *Negotiation*. |
| Held or under negotiation | "In negotiation with {customer}", the deal status and current price. |
| Booked or registered | "Booked by {customer}", the agreed price and the amount received. |
| Draft | What it still needs before it can go on sale. |

**Executives see the customer's name, and Open the deal, only for their own customers.** For anyone else's it says "Another customer". Managers and admins see every name.

**Sold outside the app** (e.g. sold before launch) stays on the unit's own page, for managers and admins. Marking booked or sold by hand needs a reason, which goes into the unit's history.

The wireframe had three states. We show five: Available, On hold (Phase 7 holds), Booked, Sold, and Draft.

## 4. Screens

- **Projects tab** (Properties → Projects):
  - **Totals** across published projects: total units (and how many projects), then available, on hold or booked, and sold, each with its share of units.
  - **All / Draft / Published** tabs (managers and admins) and a search by name or locality.
  - **One card per project:** name, locality, developer, Draft or Published, type and status, approval badges (green once the document is uploaded), price range, configurations (flat types) or plot sizes.
  - An **inventory bar** with "% sold or booked", and **count pills** (available, on hold, booked, sold) that open the layout filtered to those units.
  - **Sales pace:** "8 sold or booked in 90 days · ~6 months of stock at this pace", flagged ⚠ Slow when it's slow.
  - **Completion %** at the foot of each card (managers and admins). A project with no units yet shows its completion bar and what's needed in place of the inventory bar, with **Continue setup**.
- **Add / edit project** (managers and admins), three steps:
  - A **completion bar** across the top: the %, what's needed to publish, and the next steps.
  - **1 · Basics:** what you're building (Apartments, Plotted layout, Villa community, Commercial), name, developer, city, locality, land area, address, construction status, expected possession.
  - **2 · Towers & units** (or **Blocks & plots**, **Rows & villas**): the flat types and their areas; each tower's floors, flats per floor and the type at each position (with its facing); or each block's plot count, width and length. Then pricing, with the resulting price range. On a plotted layout, **Upload layout map** sits on top.
  - A **live preview** beside it: the building (one tower at a time) or the site plan. When editing, existing units show their status, new ones are marked *New*, and it says how many units are protected.
  - **3 · Amenities & approvals:** amenities, a short description, approvals (badge now, documents later) and the RERA number.
  - **Save draft** or **Publish project**. Publish stays disabled ("Publish · 2 needed") until the required parts are in.
- **Project page:**
  - Header with approval badges, status, possession, developer and price range; **Grid / Master plan** switch; **Edit project**; **Unpublish**. A draft shows a banner with **Publish project**.
  - **Filter tiles:** All, Available, On hold, Booked, Sold, with counts. The others are dimmed, not hidden.
  - **Tower tabs** when there's more than one tower, and **type chips** (2 BHK, 3 BHK; or plot sizes).
  - **Grid:** a tower's floors × flats, top floor first, above the ground floor; or plots in rows by block, with roads and the park.
  - **Master plan:** for plots and villas, a **site plan**: 40 ft main road and entrance at the top, blocks with 30 ft and 24 ft internal roads (long blocks split into two back-to-back rows), corner plots marked, a park with a pond and trees, and a compass. For towers, an **elevation**: every flat a window with a balcony, floor numbers, the lobby and parking. On a phone the drawing keeps a readable size and scrolls sideways.
  - **Side panel:** with nothing selected, available / booked / sold by type or size; with a unit selected, the unit panel (section 3). Managers and admins also get an **Approvals** card with an **Upload** per approval.

## 5. AI

The AI runs on **Google Gemini** (see [00-foundation.md](00-foundation.md)).

- **Reading a layout drawing:** on a plotted layout, upload the approved DTCP / CMDA layout as a PDF or photo. Gemini lists each block and, in order, each plot with its width and length in feet (metres converted). Anything unclear goes in notes, e.g. a plot with no printed size gets the block's common size, and it says so. The blocks fill in for checking: "Read 44 plots in 4 blocks. Check the sizes below before saving." Nothing is saved until the manager saves.
- **Offline (no key):** it says "Reading layout drawings needs the AI. Ask an admin to set the Gemini key, or enter the blocks by hand." If Gemini can't read the drawing, it asks for a clearer scan.
- Only the no-key path is tested. It hasn't been tried on a real drawing yet.

No new assistant tools in this phase. Project sales pace comes from `project_movement` (Inventory insights).

## 6. Tests

**API tests** (`apps/api/test/projects.test.ts`), 6 new:

| Test | Checks |
|---|---|
| Planner | One tower, 3 floors × 3 flats makes 9 units with the right type, facing and floor rise; plot blocks add the corner premium to the first and last plot. |
| Draft and publish | Publishing without a layout is refused; executives don't see the draft; publishing puts all 9 units on sale with the project's RERA badge. |
| Re-pricing and protection | A new rate re-prices unsold units and the sold one keeps its price; dropping the top floor removes 3 available units; renaming the tower (which would remove the sold A101) is refused with A101 listed, and nothing changes. |
| Approvals flow | A RERA document uploaded on the project reaches every unit. |
| Deal visibility | A manager sees customer names on the layout; another executive sees "Another customer". |
| Layout map needs the key | Without a Gemini key, reading a drawing is refused with the key message. |

**End-to-end** (`e2e/journeys.spec.ts`), 2 new journeys:

- **Wizard → publish → master plan:** a manager creates a plotted layout with one block of 10 plots at ₹2,800 per sq.ft, sees "10 plots" and "₹33.6 L – ₹35.28 L" in the preview, publishes, and opens the master plan.
- **Click a unit → start a deal:** a manager opens Green Meadows, clicks A503, starts a deal for Mohammed Irfan, and the deal opens at *Negotiating*.

**Totals:** 71 API tests and 13 end-to-end journeys passing (11 on desktop, 2 of them also on a phone). Typecheck and build are clean.

## 7. Left out, and next

- **Per-plot sizes by hand.** Typing a block's size makes every plot in it the same. Mixed sizes (e.g. bigger corner plots) only come from the layout map for now.
- **A site plan from the actual drawing.** The master plan is drawn from the blocks: rows, standard roads, the park at the bottom. It isn't the real shape of the site, and road widths are labels, not data.
- **More than one flat plan per tower.** Every floor repeats one plan, so penthouse or podium floors with a different mix can't be described yet.
- **Project photos and brochure.** The wireframe's "Photos, brochure & plans" in step 3 isn't built. Photos are still added per unit, on the unit's page.
