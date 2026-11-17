# Property Catalogue v2: proposal for approval
**Status:** ✅ Approved on 2026-11-16, with choices A–D as recommended. For E, no other environment holds real data, and the reset is an explicit dev-only command.
**Source:** the approved wireframe (`spec-system-wireframe/data.js`, `PROPERTY_TYPES`, `AMENITIES`, `LEGAL_BY_TYPE`).
**Decision D2 (your instruction):**
- replace the existing property types, attributes and amenities with the wireframe's;
- keep attributes that suit every property type as **common**;
- make everything else **specific to its property type**.

The configurable model stays (Category → Property type → Attributes, editable in Settings). Only the starting data changes.

---

## 1. Categories and property types

| Category | Property type | Code | Purposes | Main area means | Change |
|---|---|---|---|---|---|
| Residential | **Residential plot** | `PLT` | Sale, Lease | Plot / land area | Kept, renamed |
| Residential | **Flat / Apartment** | `APT` | Sale, Rent, Lease | Built-up area | Kept, renamed |
| Residential | **Independent house / Villa** | `VIL` | Sale, Rent, Lease | Built-up area | Kept, renamed |
| Commercial | **Office space** | `OFC` | Sale, Rent, Lease | Carpet / usable area | Kept |
| Commercial | **Shop / Showroom** | `SHP` | Sale, Rent, Lease | Carpet / usable area | Kept |
| Commercial | **Warehouse / Godown** | `WHS` | Sale, Rent, Lease | Carpet / usable area | Kept |
| Commercial | **Commercial building** | `CBD` | Sale, Rent, Lease | Carpet / usable area | **New** |
| Commercial | **Industrial shed** | `ISH` | Sale, Rent, Lease | Carpet / usable area | **New** |

**Removed:**
- Commercial land (`CLD`);
- the whole **Other** category: Agricultural land (`AGR`) and Industrial land (`IND`).

None of these are in the wireframe. The Other category stays in the system as inactive, so an Admin can bring it back later from Settings.

> **Choice A: how to model Commercial.** The wireframe has one type, “Commercial property”, with a *Commercial category* dropdown listing Office space, Shop / Showroom, Warehouse / Godown, Commercial building and Industrial shed.
> - **Recommended:** make each of these a property type, as in the table above. All five share the same commercial specification fields. This gives:
>   - meaningful property codes (`RE-OFC-…`);
>   - list filters by type;
>   - matching on the customer's commercial category;
>   - one Bulk Import template per type.
>
>   The form looks the same as the wireframe: the user picks “Commercial › Office space” instead of “Commercial property” plus a dropdown.
> - **Alternative:** one type “Commercial property” (`COM`) with a “Commercial category” dropdown attribute, exactly as in the wireframe.

---

## 2. Main information: the same for every property

These fields are **core fields**: always present, required to publish and locked in Settings (unchanged from today). They match section 1 of the wireframe form.

Property ID (auto) · Property title · Category / Property type · Listing purpose · State · City / district · Locality · Area (label follows “main area means”) · Asking price (₹) · Price per sq.ft. (auto) · Status · Listing date

## 3. Common attributes: every property type

| Attribute | Type | Options / unit | Filter | Note |
|---|---|---|---|---|
| Facing | Dropdown | East, North, West, South, North-East, North-West, South-East, South-West | ✔ | From the wireframe's main information |
| Road type | Dropdown | Tar road, Concrete road, Gravel road, Mud road, Main road, Highway service road, Industrial road | ✔ | **Choice B** |
| Road width | Number | ft | ✔ | **Choice B** |
| Description | Long text | — | | **Choice C** |

> **Choice B: road type and width asked once.** The wireframe asks for road details twice: in the plot and commercial specifications (“Road width”, “Road infrastructure”) and again in the Location tab for every property. **Recommended:** one common value per property, shown in both places, so the data can't disagree and matching uses one value.
>
> **Choice C: Description.** It isn't in the wireframe, but every listing needs a free-text description (it already exists today). **Recommended:** keep it as a common attribute.

## 4. Property-type attributes

All of them are optional when the system starts. In Settings an Admin can make any attribute required, reorder them, or add new ones. Attributes used by more than one type are defined once and shared (marked ⇄).

### 4.1 Residential plot (`PLT`): 12 attributes

| Attribute | Type | Options / unit | Filter |
|---|---|---|---|
| Length | Number | ft | |
| Width | Number | ft | |
| Road access | Dropdown | Public road, Layout road, Private / pathway access | ✔ |
| Corner / non-corner | Dropdown | Non-corner, Corner | ✔ |
| Topography | Dropdown | Level, Gentle slope, Elevated, Low-lying | |
| Survey number | Text | — | |
| Subdivision | Text | — | |
| Layout approval details | Text | hint: authority + approval number as stated on the document | |
| Land-use classification | Dropdown | Residential, Mixed residential, Commercial, Agricultural (conversion required) | ✔ |
| Water supply ⇄ | Dropdown | Municipal supply, Borewell, Municipal + borewell, Tanker dependent, Not available | |
| Electricity | Dropdown | Available at site, Line nearby — connection to apply, Not available | |
| Drainage | Dropdown | Underground drainage, Open drain, Not available | |

### 4.2 Flat / Apartment (`APT`): 11 attributes

| Attribute | Type | Options / unit | Filter |
|---|---|---|---|
| BHK configuration | Dropdown | 1 BHK, 2 BHK, 3 BHK, 4 BHK, 4+ BHK | ✔ |
| Carpet area | Number | sq.ft. | |
| Super built-up area | Number | sq.ft. (if applicable) | |
| Floor number | Number | — | |
| Total floors | Number | — | |
| Number of lifts | Number | — | |
| Parking allocation | Dropdown | None, 1 covered, 2 covered, 1 open, Shared | ✔ |
| UDS (undivided share of land) | Number | sq.ft. | |
| Maintenance ⇄ | Number | ₹ / month | |
| Possession status | Dropdown | Ready to move, Under construction | ✔ |
| Expected possession | Month | month and year | |

### 4.3 Independent house / Villa (`VIL`): 13 attributes

| Attribute | Type | Options / unit | Filter |
|---|---|---|---|
| House or villa | Dropdown | Independent house, Villa (gated community), Row house | ✔ |
| Land area | Number | sq.ft. | |
| Number of floors | Number | — | |
| Bedrooms | Number | — | ✔ |
| Bathrooms | Number | — | |
| Car parking | Dropdown | None, 1 car, 2 cars, 3+ cars | ✔ |
| Construction year | Number | — | |
| Construction quality | Dropdown | Premium, Standard, Basic | |
| Condition | Dropdown | New, Good, Needs minor repair, Needs major repair | |
| Private garden / amenities | Text | — | |
| Water supply ⇄ | Dropdown | (as 4.1) | |
| Power arrangement | Dropdown | EB connection, EB + inverter, EB + generator backup, EB + solar | |
| Approval & completion documents | Dropdown | Approval + completion available, Approval only, Not available | |

### 4.4 Commercial: all 5 commercial types (`OFC` `SHP` `WHS` `CBD` `ISH`): 10 attributes

| Attribute | Type | Options / unit | Filter |
|---|---|---|---|
| Floor | Text | e.g. “Ground”, “4th of 7” | |
| Frontage | Number | ft | |
| Parking | Dropdown | None, Street parking, Dedicated 1–5, Dedicated 5+ | ✔ |
| Permitted usage | Text | — | |
| Occupancy status | Dropdown | Vacant, Tenanted, Owner-occupied | ✔ |
| Rental income | Number | ₹ / month (if tenanted) | |
| Lease duration | Text | — | |
| Lease terms | Text | — | |
| Maintenance ⇄ | Number | ₹ / month | |
| Operating expenses | Number | ₹ / year | |

**Differences from the wireframe field lists, apart from Choices B and C:**
- “Water availability” (plot) and “Water arrangement” (house) become one shared **Water supply** with the combined options.
- “Monthly maintenance” (flat) and “Maintenance” (commercial) become one shared **Maintenance**.
- **Expected possession** needs a new attribute type, **Month** (month + year picker). Today there is only Date.

**Total:** 4 common + 44 type-specific = **48 attribute definitions** (shared ones counted once), replacing the current 43.

---

## 5. Amenities (wireframe list)

| Amenity | Residential | Commercial |
|---|---|---|
| Gated community | all | — |
| Security | all | all |
| Park / open space | all | — |
| Power backup | all | all |
| Lift | Flat, House | all |
| Gym | Flat, House | — |
| Swimming pool | Flat, House | — |
| Clubhouse | Flat, House | — |
| Rainwater harvesting | all | all |
| CCTV | all | all |
| Visitor parking | Flat, House | all |
| Loading bay | — | Warehouse, Industrial shed |

The current amenities (for example Children's play area, Fire safety, Cafeteria, Drip irrigation) are removed.

## 6. Legal checklist defaults (from the wireframe)

| Property type | Checks (★ = mandatory: if unresolved, never a top recommendation) |
|---|---|
| Residential plot | Parent documents, Sale deed ★, EC ★, Patta, FMB / survey, Land-use classification, Layout approval ★, RERA, Tax receipts |
| Flat / Apartment | Parent documents, Sale deed ★, EC ★, Patta, Building plan approval ★, Completion / occupancy certificate, RERA ★, Tax receipts |
| Independent house / Villa | Parent documents, Sale deed ★, EC ★, Patta, FMB / survey, Building plan approval ★, Completion / occupancy certificate, Tax receipts |
| All commercial types | Parent documents, Sale deed ★, EC ★, Patta, Land-use classification, Building plan approval ★, Completion / occupancy certificate, Fire NOC, Tax receipts |

These still need confirmation from the client's legal advisor (D11). An Admin can edit them in Settings.

---

## 7. Existing data: what happens to it

The local database (`real_estate`) currently holds **test data only**:
- 19 properties: 18 residential plots and 1 shop. Most came from import tests.
- 12 media files, 4 import batches.
- 9 property types, 43 attributes (1 created by a user), and the current amenities.

**Recommended (Choice D): a clean reset of property data.**
1. Delete the test properties, their media files and the import batches, then the current property types, attributes and amenities.
2. Seed the v2 catalogue above.
3. Optionally load the wireframe's **12 sample properties** (plots, flats, houses, shop, office, warehouse, with location, legal and valuation data) as demo data (`pnpm seed:demo`). The team then sees the same examples as in the wireframe.

**Kept:** users, company settings, change logs.

**Alternative:** if any other environment (staging or client) holds real properties, I'll write a migration that moves them to the new types and keeps their values, instead of a reset.

---

## 8. What changes in the code

| Area | Change |
|---|---|
| `apps/api/src/modules/propertyTypes/propertyTypes.defaults.ts` | Replaced by the v2 catalogue (sections 1–5) |
| Migrations (`migrate-mongo`, R1.0) | `catalogue-v2`: idempotent reset + seed (Choice D), plus `seed:demo` for the sample properties |
| `packages/shared` | New attribute type `month`; `mainAreaMeaning` per type; road type and width as common location values |
| Admin UI | Settings → Property types shows the new data automatically. The property form follows the wireframe layout (R1.2) |
| Bulk Import | Templates are generated per property type, so they follow automatically |
| Tests | Fixtures that use AGR, IND, CLD and the old attribute keys are updated |
| Docs | PRD §6.1, §6.3, §6.6 and D2 updated; TRD §7.13 migration #3; checklist R1.1 |

## 9. Please confirm

| # | Question | Recommended |
|---|---|---|
| A | Commercial: five property types, or one type with a dropdown? | Five types |
| B | Road type and width asked once (common), not repeated in specifications? | Yes |
| C | Keep Description as a common attribute? | Yes |
| D | Reset the test data, and load the wireframe's 12 sample properties? | Yes and yes |
| E | Any environment other than local with real property data? | — (your answer) |
