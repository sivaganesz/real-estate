# 01 · Property management

**Status:** built · **Commit:** Phase 1 · **Users:** sales managers and admins load and maintain; sales executives find, read and share.

## 1. How it works in a real-estate business

A business sells two kinds of stock:

| Kind | Example | How it's organised | How it's sold |
|---|---|---|---|
| **Project inventory** (builder or developer) | Green Meadows, Block A, Floor 4, Unit A402 | Project → block or tower → floor → unit; a plotted layout is project → (phase) → plot number | Off a price list: a base price, floor rise, and units held, booked and sold one by one |
| **Standalone listings** (resale, owner mandates, land, commercial) | 3 BHK in Anna Nagar, 2.5 acres near Thiruporur | One property, one owner | Each one negotiated |

**The relationship, as built:** a **Project** holds the shared facts (location, RERA number, amenities, possession date). Each **unit is a Property** with `projectId`, `block` and `unitNumber`; the floor is in its details. A standalone listing is a Property with no project. Search, matching, sharing and deals treat both the same way. There is no separate "Block" or "Floor" record: they are attributes of the unit, because nobody sells a floor. A floor has no price, status or buyer of its own.

## 2. Workflows found

| # | Workflow | Who | Trigger | Steps today (pain) | Designed journey |
|---|---|---|---|---|---|
| W1 | List a resale or owner property | Manager | Owner sends a WhatsApp message, photos or a brochure | Retypes into a 30-field form; half the fields are empty | Paste or attach → AI fills the short form with a source for each value → fix what's flagged → save as draft or publish |
| W2 | Load a new project | Manager | Builder mandate signed | Typing 48 units by hand | Create the project once → "Add units" makes a block's floors × units with floor rise → publish them together |
| W3 | Complete a listing | Manager | Draft missing facts | Unclear what's missing | The property page has a **To do** card; missing required facts block publishing, everything else is a nudge |
| W4 | Find something to offer | Executive | Buyer on the phone | Scrolls spreadsheets, asks the manager | One search box that understands "2 BHK under 70 L in Porur" (shows how it understood it), or ask the assistant |
| W5 | Share with a buyer | Executive | Buyer wants details | Forwards photos and types facts on WhatsApp | **Share** → a clean buyer page link and a ready WhatsApp message; internal notes never leak |
| W6 | Hold, book, sell | Manager / deals | Buyer is serious | Status changed by hand, stale "available" units | Holds expire on their own; booked and sold normally come from the deal (Phase 7); manual change needs a reason |
| W7 | Revise prices | Manager | Builder price revision | Edit each unit | Revise unsold units in a project by a percentage, logged per unit |
| W8 | Documents and approvals | Manager | RERA or DTCP claimed | Fixed checklists nobody fills | Approvals are claims; a claim shows "document pending" until uploaded; verifying is optional |

## 3. Business rules

1. **Two fields, not one status.**
   - **Listing:** `draft → live → archived`. Only live properties are seen by executives, the assistant's searches and buyers.
   - **Availability:** `available → held → booked → sold`.
2. **Publishing needs** a title (suggested automatically), price, area, city, locality, and the type's two key details:

   | Type | Key details |
   |---|---|
   | Apartment | BHK, floor |
   | Villa | BHK, land area |
   | Plot | Length, width |
   | Commercial | Usage, floor |
   | Agricultural | Water source, road access |
   | Industrial | Usage, power |

   Nothing else blocks publishing.
3. **A live property can't be edited into an incomplete state.**
4. **Only managers and admins** create, edit, publish or change availability (CTO decision, 23 Nov). Executives view live properties and share them.
5. **Duplicates.**
   - The same unit number in the same project and block is refused.
   - A near-identical listing (same locality and type, price within ±5%, area within ±2%) is flagged; the person can still save it.
6. **Holds expire** (3 days by default) and release themselves.
7. **Booked or sold by hand** needs a reason. The normal path is a deal.
8. **Nothing is deleted.** Archive hides a property; restore brings it back as a draft.
9. **Everything is logged:** price changes keep the old and new value, and changes made through the assistant are marked.
10. **Buyer page:** never shows internal details, documents, holds, owner notes or codes. An approval badge appears only when its document is uploaded.

## 4. Where the AI helps (and where it doesn't)

| Moment | AI does | Person does |
|---|---|---|
| Add property | Reads text, a PDF brochure or a photo into the short form, with a quote for each value; flags "onwards" prices and odd ₹/sq.ft rates; suggests a title | Checks the tinted fields, fills what's still missing, saves |
| Edit | "Price is now 58 L, add gym" changes only those fields | Reviews, saves |
| Find | Turns plain words into filters (also in the list's search box) | Picks |
| Share | Drafts the buyer WhatsApp message from the facts | Sends |
| Assistant actions | Creates drafts directly | Confirms **publish**, **price or fact edits** and **availability** changes |

Offline (no AI key), or if Gemini fails or returns something unusable, typed text and PDFs are read by rules. Photos need the AI.

## 5. Screens

1. **Properties** (`pages/Properties.tsx`, `PropertyList.tsx`, `ProjectsTab.tsx`):
   - one search row shared by both tabs (`components/SearchBar.tsx`) with the *All properties / Projects* switch beside it (`Segmented size="lg"`), and **Bulk import** at the top right;
   - status tabs (All, Available, …) with Filters, Sort and the Table / Grid view on the same row (stacked below `xl`);
   - *All properties* as photo-first cards or a table. The table's **Price** column; the Area cell shows icons with counts (bed and bath) for homes, and "L × W" for plots. Sold units are hidden unless asked for;
   - *Projects* with a sell-through bar per project.
2. **Add property** (drawer): the describe box, then the short form.
3. **Property page** (`pages/PropertyDetail.tsx`, parts in `components/property/`):
   - a header with the key facts for its type, an adaptive photo collage with a viewer, and five tabs (Overview, Legal & documents, Price, Matching customers, History);
   - key facts (✨ marks values read by AI; hover shows the source); a details card with the description (clamped, *Expand*) and collapsible sections per type;
   - land listed in acres, cents or grounds shows its rate in that unit (₹34 L/acre), see `packages/shared/src/format.ts`;
   - **Explore the neighbourhood** (`property/Neighbourhood.tsx`): places grouped by commute, schools, hospitals and shopping, with a distance sketch. *Team* and *Customer* views; each place can be marked "route checked" and "OK to advertise". *Find more places* looks them up on OpenStreetMap through the Overpass API (`OVERPASS_URL`; the free public server is often busy). New places start unchecked; the buyer page lists only advertised ones;
   - a side card with price, status and actions (Share, Publish, Edit, Availability, Draft a buyer message), and a To do card.
4. **Project page:** availability counts and the **inventory grid** (floors × units, colour by state), plus Add units, Publish drafts and Revise prices.
5. **Buyer page** `/p/:token`: no sign-in; photos, price with an approximate total including stamp duty and registration, facts, amenities, approval badges and the advertised nearby places.

## 6. Deliberately left out (for review)

- **A separate "review" listing state.** With only managers and admins loading, both of whom may publish, a review step adds a click but no check. If a data-entry role is added, it comes back as one state.
- **Admin-defined property fields** (the old field builder). The six types with known key details plus free-form extras cover the sample data. Revisit only if a client needs a field to be filterable.
- **A real map (Google Maps).** It needs a Google Maps account and budget. Nearby places are now covered without it: the neighbourhood explorer uses free OpenStreetMap data and draws a distance sketch, not a map.
