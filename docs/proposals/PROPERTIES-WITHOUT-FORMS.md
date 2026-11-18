# Properties without forms — proposal

**Date:** 17 November 2026 · **For:** leadership and the development team · **Status:** draft for review
**Scope:** properties only. Covers action items 2, 3, 4, 5 and 9 from the [17 Nov demo review](../meetings/MoM-2026-11-17-Demo-Review.pdf). Leads, matching and site visits come in a later proposal.

---

## 1. What changes for the user

**Today:** pick a type, fill about 30 fields, then fill the Location, Legal and Pricing tabs.

**Proposed:** three steps, with no form.

1. **Give.** Drop a brochure (PDF or photos, any number of pages), paste a message or record a voice note. Several sources at once is fine, and more can be added later.
2. **Check.** The system shows a **fact sheet**: what it found, grouped by section, each fact with where it came from. Facts it is unsure about are highlighted. Facts it couldn't find are listed as *still needed*, not shown as empty boxes.
3. **Publish.** One click by an Admin or Sales manager.

The system does the rest: nearby places, price per sq.ft., title, description, highlights and the landing page.

**Later changes** are made in chat ("price is now 30 L", "add: borewell water") or by dropping another document. There is never a form.

**Target:** under 3 minutes of a person's time to list a property from a brochure.

**Next demo (no forms):**
1. Drop a builder's brochure; the fact sheet is ready in about a minute.
2. Correct two facts in chat.
3. Nearby schools and hospitals appear on their own.
4. Publish.
5. Open the landing page.

---

## 2. The data pattern (action item 2)

**Eight fixed sections:** Main information, Location, Specifications, Legal, Pricing, Amenities, Highlights and Media.

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
  - The list also tells the system what to ask for.
  - Users never see it as a form.
- **Core facts needed to publish:**
  - property type;
  - purpose (sale / rent / lease);
  - location (an address is enough);
  - price, or "price on request";
  - main area.

  Everything else is optional.
- **Any other fact is kept exactly as written**, for example "Paint: Asian Paints Royale, ivory". It is searchable as text on the website and in the agent's answers.
- **Search** combines filters on known facts (type, city, price, BHK) with text search over all facts.
- **Existing build:**
  - The database already stores property values as an open set plus custom attributes. The change is mainly the input screens, the AI step, and turning the type catalogue into a hint list.
  - Roles, history, media, the legal checklist and the location rules carry over.
  - The current system stays deployable for a client who needs to go live now, as agreed in the meeting.

---

## 3. How information gets in (action items 3 and 4)

| Input | How it is read | Notes |
|---|---|---|
| Brochure PDF, one or many pages | The AI reads the text and the page images directly | Scanned brochures work too |
| Photos (a sign board, a printed page) | The AI reads the image | Also offered as listing photos |
| Pasted text (WhatsApp, email, notes) | The AI | Tamil and English mixed text to be tested |
| Voice note | Speech-to-text first, then the AI reads the transcript | Needs a speech-to-text service |
| Excel | Existing bulk import, with columns matched by the AI instead of a fixed template | |
| Chat | "price 30 L", "is the price fair?" | For edits and questions |

**The AI step:**
- One request per property sends the sources, the instructions and the known-facts list.
- The AI returns facts in a fixed shape: sections → facts, each with its source page and a confidence level.
- Code then checks the numbers: lakh and crore units, area × rate against the price, and impossible values.

**When two sources disagree** (the brochure says 2,650 sq.ft., the deed says 2,600), the person is shown both and chooses one.

---

## 4. Missing information

- **Core facts:** the system asks only for the core facts it couldn't find, one short question at a time in chat or with quick-answer buttons.
- **Everything else** goes on the property's **still needed** list, with reminders: legal documents, a GPS pin (the address is enough until then), more photos, a price review.
- **Legal documents:**
  - Uploaded documents are read and filed against the checklist as *Collected, pending verification*.
  - Only an authorised legal professional marks a check as verified. This rule doesn't change.

---

## 5. Nearby places from Google (action item 5)

**How it works:**
1. Google turns the address into a map pin, which the user can drag to correct.
2. A Google Places search finds schools, hospitals, bus and rail stops, markets and malls within a set radius.
3. Google gives the driving distance to each place.
4. Each place is saved as "Found by Google" with the date.

**Rules to keep:**
- **Advertising** — *decision needed*.
  - Today a person must check the route before a distance is advertised.
  - Recommendation: show Google distances labelled as approximate ("about 1.4 km by road"), and add a "route checked" badge only after a person confirms the route.
- **Planned infrastructure** isn't in Google Places (metro lines, ring roads). It still comes from the brochure or a person, marked *Planned — not existing*.
- **Cost and terms:**
  - Google charges per request, so we need a monthly budget; the cost per property is small.
  - Google's terms limit how long Places data may be stored. We would keep the place IDs and refresh the details. To be confirmed during the experiment.

---

## 6. What the agent may do (properties)

| By itself | Suggests, then a person confirms | Never |
|---|---|---|
| Read the sources and fill the facts | Publishing | Mark a legal check verified |
| Write the title, description and highlights | Changing the price or status | Add a fact without a source |
| Fetch nearby places; work out price per sq.ft. | Merging duplicates | Advertise planned infrastructure as existing |
| Flag possible duplicates; list what's missing; send reminders | Choosing between conflicting facts | |

---

## 7. Facts → website

- Each property's **landing page is generated from its facts**:
  - title and highlights;
  - specifications;
  - nearby places;
  - photos;
  - the legal wording ("x of y checks verified by a legal professional").
- **Only confirmed facts appear.**
- The experiment includes one generated landing page. The full website comes later.

---

## 8. Experiment plan (7–10 working days)

| Days | Work | Result |
|---|---|---|
| 1–2 | Fact format; AI extraction tried on 5–10 real brochures | Accuracy sheet |
| 3–4 | "Give" screen, fact sheet review, chat edits | Working screens |
| 5 | Google Places and the map pin | Nearby places filled automatically |
| 6 | Voice notes; Excel without a template | |
| 7 | Landing page preview | |
| 8–10 | Measure, fix, prepare the demo | Demo with no manual forms |

**How we judge it:**
- at least 90% of core facts correct without edits on the sample brochures;
- under 3 minutes of a person's time per property;
- the cost per property;
- how many facts are captured compared with the old form.

---

## 9. Decisions needed

1. **AI service.**
   - Recommendation: the Claude API (Anthropic). It reads multi-page PDFs and images directly and returns structured data.
   - Rough cost: ₹10–30 per brochure, to be measured during the experiment.
2. **Document privacy.**
   - Brochures are public, but sale deeds and ECs contain personal details and would be sent to the AI service.
   - Options: allow it, or keep legal documents out of AI reading and only file them.
3. **Google Maps Platform** account and monthly budget.
4. **Advertising rule** for Google distances (section 5).
5. **Who can publish:** Admin and Sales manager only (current rule), or Sales executives as well.
6. **Voice-note languages:** Tamil, English, or both mixed.
7. **Sample data:** 5–10 real brochures from a client for the experiment.

**Risks and how we handle them:**
- **AI mistakes in numbers:** every fact has a source, code checks the numbers, and a person reviews before publishing.
- **Poor scans:** the AI asks for a better copy, or lists the missing facts.
- **Thin Google data in smaller towns:** people can still add places.
- **Rising cost:** we measure the cost per property from day 1.
