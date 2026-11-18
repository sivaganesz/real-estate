# Properties without forms — proposal

**Date:** 17 November 2026, revised 19 November 2026 · **For:** leadership and the development team · **Status:** for CTO review
**Scope:** properties only. Covers action items 2, 3, 4, 5 and 9 from the [17 Nov demo review](../meetings/MoM-2026-11-17-Demo-Review.pdf). Leads, matching and site visits come in a later proposal.

**What changed in this revision.** Since 17 Nov the design has been built in the clickable wireframe (`spec-system-wireframe/`, branch `spec-system-wireframe`). This version describes what was built:
- the AI assistant and a short form, side by side;
- what is required to publish;
- the location and nearby places;
- the simpler Legal & documents section.

Sections 1, 4, 5, 6 and 9 changed the most.

---

## 1. What changes for the user

**Before:** pick a type, fill about 30 fields, then fill the Location, Legal and Pricing tabs.

**Now:** describe the property; the system fills in the rest.

1. **Describe.** Type or speak it to the AI assistant, e.g. *"2 BHK flat for sale in Porur, Chennai, 980 sq.ft., 62 lakhs, RERA registered"*. The details appear in a short form beside the chat, and anyone can check or correct them there.
2. **Answer a few questions.** The assistant asks only for what is required and still missing, one short question at a time, with quick-answer buttons. Example: "What's the floor number?"
3. **Publish.** One click by an Admin or Sales manager. A Sales executive submits the property for approval instead.

**Required to publish:**
- the title, which the AI suggests and the team can change at any time;
- purpose, type, city, locality, price and area;
- **two key details per type**:

| Type | Required key details |
|---|---|
| Residential plot | Length, width |
| Flat / apartment | BHK, floor |
| House / villa | House or villa, bedrooms |
| Commercial | Category, occupancy |
| Agricultural land | Acres, water source |
| Industrial | Industrial type, power load |

Everything else is optional: more details, photos, the exact location, approvals and documents.

**After publishing**, the property page keeps nudging until the listing is complete. Every change lands in the same record and in History. There are three ways to update a property:
- **✨ Edit with AI**, e.g. "price is now 30 L" or "add: borewell water";
- the **To do** card and the **＋ Add** chips, which open the exact field that is missing;
- direct edits on the page: status, photos, location and documents.

**Target:** under 3 minutes of a person's time to list a property.

---

## 2. The data pattern (action item 2)

**Fixed sections:** Main information, Location, Specifications, Legal & documents, Pricing, Amenities, Highlights and Media.

**Inside each section, an open list of facts.** Each fact holds:

| Part | Example |
|---|---|
| Label | Carpet area |
| Value and unit | 1,080 sq.ft. |
| Known fact it matches (if any) | `carpet_area` |
| Source | Brochure p.2, "Carpet 1,080 sq.ft" |
| Confidence | High / Check |
| Confirmed by | Priya, 17 Nov |

- **Known facts.** The system keeps a list of the common facts for each property type. Today's *Settings → Property types* catalogue becomes this list.
  - The AI maps what it reads onto known facts ("BUA", "built-up", "SBA" → built-up area) so that search, matching and website filters work.
  - The list also tells the system what to ask for. Users never see it as a long form.
- **Any other fact is kept exactly as written**, for example "Paint: Asian Paints Royale, ivory". It is searchable as text.
- **One value, one place.** Each value is stored once and every screen reads it from there. For example, the road type and width live in the property details; the location card, the location dialog and matching all read them from there.
- **Search** combines filters on known facts (type, city, price, BHK) with text search over all facts.
- **Existing build:** the database already stores property values as an open set plus custom attributes. The change is mainly:
  - the input screens;
  - the AI step;
  - the location and legal models described below.

---

## 3. How information gets in (action items 3 and 4)

| Input | How it is read | In the wireframe |
|---|---|---|
| Chat (typed) | The AI reads the sentence | Yes (simulated) |
| Pasted Google Maps link or WhatsApp location | Read as the exact location | Yes (simulated) |
| Voice | Speech-to-text, then the AI | Search box only |
| Brochure PDF, one or many pages | The AI reads the text and the page images | Planned |
| Photos (a sign board, a printed page) | The AI reads the image; also offered as listing photos | Planned |
| Excel | Existing bulk import; later, columns matched by the AI | Yes (template) |

**The AI step:**
- One request per input. It sends the text, the instructions and the known-facts list.
- The AI returns facts in a fixed shape: section → fact, each with its source and a confidence level.
- Code then checks the numbers: lakh and crore units, area × rate against the price, and impossible values.

**When two sources disagree** (the brochure says 2,650 sq.ft., the deed says 2,600), the person is shown both and chooses one.

---

## 4. Missing information

- **Required facts:** the assistant asks only for the ones it couldn't find.
- **Everything else** goes on the property's **To do** card, each item with a button that opens the right place:
  - photos;
  - the exact location;
  - approval documents;
  - more key details;
  - a price review.
- **Nothing blocks publishing** except the required facts.

---

## 5. Location and nearby places (action item 5)

**At creation only the city and locality are needed.**
- The map shows the locality as an **approximate area**.
- Distances are marked with "~".
- Nothing more is asked.

**The exact location is optional**, and can be given at creation or any time later in one of three ways:
- 📍 **Use my current location**, when standing at the property;
- **paste a Google Maps link or a WhatsApp location**, which owners usually send anyway;
- **search, then click on the map.**

The address and pincode are filled in from the pin. Only the door number and street are typed by hand.

**Nearby places:**
1. **Shown by default.** Every new property shows the nearest bus stop, railway station, school, hospital and market, from Google Places.
2. **↻ Find more places.**
   - Looks up everything else around the property.
   - The results come back as suggestions with tick boxes, and the team keeps the ones that matter.
   - It runs once on its own when the exact location is first set.
3. **＋ Add place.**
   - Search for one particular place, e.g. "Apollo hospital".
   - Or add one Google doesn't have yet, e.g. a planned metro station. These are marked *Planned / Proposed — not advertised as existing*.

**Advertising rule (decided):**
- **A route check is needed only for everyday places close by:** bus stop, metro station, school, hospital, market.
  - A person records the measured distance, how it was checked (driven, walked, by bus) and the conditions on the way.
  - Who checked it and when are saved.
- **Far, well-known places** (railway station, airport, college, mall, bank, temple, park, highway) are advertised with Google's approximate distance.
- **Both switches live in Settings → Nearby place categories:**
  - *Route check*;
  - *Shown by default*.

  The list of categories is editable there too.
- **Customer view.** The card has a *Team view / Customer view* switch. Customer view shows exactly what the listing, brochure and WhatsApp message may say.

**Storage (for development):**
- **One `places` collection**, keyed by Google's place ID. It holds the name, category, location point and status, and is shared by all properties.
- **On each property, a link to each place** with what belongs to that property:
  - the distance and time;
  - whether the route was checked, by whom and when.
- **Google is called only when someone asks**, or once per new property. The API key stays on the server.
- **Google's terms** allow keeping place IDs permanently but limit how long other details may be stored. We refresh them now and then.

---

## 6. Legal & documents (new in this revision)

**The whole section is optional.** The team uploads what they have.

**Approvals:**
- **RERA approval** and **Building approval** come by default.
- The team can create more, e.g. Fire NOC or DTCP approval. A new approval is available on every property and is listed in *Settings → Approval badges*.
- Approvals can be ticked while creating the property ("RERA registered" in the chat ticks it) or later on the property page.

**A ticked approval starts as ⚠ *Document pending*.**
- **Uploading the document** removes the warning, and the badge then shows on the listing.
- **✓ Verified** is an optional extra step for an Admin or Sales manager (the legal team). Nothing depends on it.

**Other documents:**
- Any document can be uploaded and given a name.
- The usual ones for the type (sale deed, EC, patta…) are one-click suggestions.
- There are no "not collected" rows and no warnings.

**The only legal warning is an approval claimed without its document.** It shows:
- in the header and on the tab;
- in the To do card;
- on the sales dashboard;
- in matching, where the property is a *Conditional match* until the document is uploaded.

A property with no approval badges is not penalised.

**This replaces the original spec's fixed checklist**, which had three statuses and mandatory documents per type. The spec has been updated to match.

---

## 7. What the agent may do (properties)

| By itself | Suggests, then a person confirms | Never |
|---|---|---|
| Read the input and fill the facts | Publishing | Mark a document verified |
| Suggest the title; write the description and highlights | Changing the price or status | Add a fact without a source |
| Show the important nearby places; work out price per sq.ft. | Keeping the extra nearby places it found | Advertise planned infrastructure as existing |
| Find similar properties in our records and compare the price with them | Leaving out ones that aren't really similar; adding outside ones | Call a price a "bargain" or "best price" |
| Flag possible duplicates; list what's missing | Merging duplicates; choosing between conflicting facts | Mark a route as checked |

---

## 8. Facts → website

- **Each property's landing page is generated from its facts:**
  - title and highlights;
  - specifications and photos;
  - the nearby places in Customer view;
  - the approval badges whose documents are uploaded.
- **Only confirmed facts appear.** The listing never says "100% legally clear".
- **Documents are shared with a customer only on request.**
- The experiment includes one generated landing page. The full website comes later.

---

## 9. Decisions

**Settled in the wireframe (for CTO confirmation):**
1. **Required to publish:** title, purpose, type, city, locality, price, area, and two key details per type (section 1).
2. **Exact location is optional.** The locality is shown as approximate until it is set (section 5).
3. **Advertising rule for distances:** a route check only for everyday places close by, set per category in Settings (section 5).
4. **Legal & documents is optional.** An approval badge shows on the listing once its document is uploaded, and *Verified* is an optional extra (section 6).

**Still open:**
1. **AI service.**
   - Recommendation: the Claude API (Anthropic). It reads text, multi-page PDFs and images, and returns structured data.
   - Rough cost: ₹10–30 per brochure, to be measured.
2. **Document privacy.**
   - Sale deeds and ECs contain personal details.
   - Options: let the AI read them, or only file them.
3. **Google Maps Platform** account and monthly budget.
   - A new property makes about 5 lookups for the default places plus the route distances.
   - "Find more places" makes about 6–8.
4. **Who can publish:** Admin and Sales manager only (current rule), or Sales executives as well.
5. **Who can create approval badges:** everyone (current) or Admin and Sales manager only.
6. **Voice-note languages:** Tamil, English, or both mixed.
7. **Sample data:** 5–10 real brochures from a client for the experiment.

**Risks and how we handle them:**
- **AI mistakes in numbers:** every fact has a source, code checks the numbers, and a person reviews before publishing.
- **Poor scans:** the AI asks for a better copy, or lists the missing facts.
- **Thin Google data in smaller towns:** people can still add places by hand.
- **Rising cost:** we measure the cost per property from day 1, and Google is called only on demand.

---

## 10. Experiment plan (7–10 working days)

| Days | Work | Result |
|---|---|---|
| 1–2 | Fact format; AI extraction tried on 5–10 real brochures | Accuracy sheet |
| 3–4 | Chat and short form, fact review, edits with AI | Working screens |
| 5 | Google Places, map pin and default nearby places | Nearby places filled automatically |
| 6 | Voice notes; Excel without a template | |
| 7 | Landing page preview | |
| 8–10 | Measure, fix, prepare the demo | Demo with no long forms |

**How we judge it:**
- at least 90% of required facts correct without edits on the sample brochures;
- under 3 minutes of a person's time per property;
- the cost per property;
- how many facts are captured compared with the old form.
