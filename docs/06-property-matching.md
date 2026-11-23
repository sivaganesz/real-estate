# 06 · Property matching

**Status:** built · **Commit:** Phase 6 · **Where:** at the top of every customer page, on every property page, on Today, and in the assistant.

## 1. Why it matters, and how it goes wrong

Matching is why a salesperson opens a property list at all. Done badly it's either:

- a filter that returns nothing because the budget is ₹2 L short; or
- an opaque "87% match" nobody trusts or can explain to the customer.

## 2. Approach: rules with reasons, not a black box

Each property is checked against the customer's requirement. The result is a **fit label** plus **reasons in words**. A score exists only to order the list; it is never shown.

| Check | Fits ✓ | Close ≈ | Doesn't ✗ / excluded |
|---|---|---|---|
| Can it be sold? | Live and available | On hold ("on hold until Thu for another buyer") | Booked, sold, draft: excluded |
| For sale or rent | Same | — | Different: excluded |
| Type | In their types | — | Excluded |
| Budget | Within ("₹68 L, within budget (up to ₹75 L)") | Up to 10% over ("₹4 L over budget (6%), worth a try if negotiable"); far under ("may feel too small") | 10–20% over is a ✗; beyond 20% excluded |
| Location | A preferred locality | Same city, other locality ("not one of their areas") | Other city: excluded |
| BHK | Same, or more ("3 BHK (wanted 2+)") | — | Fewer: excluded |
| Size | At least what they want | Within 10% smaller | Smaller: ✗ |
| Must-haves | Each found (amenity, facing, borewell, power) | "Near a school — check" (we can't know) | "No gym listed" |
| History | "They liked this one" | "Already shared Tue", "Already visited" | Rejected by them: excluded |
| Legal | — | "RERA claimed; document pending" | — |

**Fit labels:**

- **Strong:** everything important fits.
- **Good:** close, with at most one miss.
- **Partial:** worth a look.

At most **two units per project** are shown, so one tower doesn't fill the list with identical flats.

**Customers who aren't qualified** (no budget, location or type) get no matches, with a note saying what's missing. Guessing would waste their time.

## 3. Journeys

- **Customer page → "Properties" card** (right below the stage bar, because matching comes first, as the CTO asked):
  - **Fits {name}**: up to six matches with reasons; 👍 marks liked and 👎 hides it for good. Select several and **Send to {name}**: a ready WhatsApp message with buyer links opens. It's logged on their timeline and the properties go on their shortlist.
  - **Shortlist**: everything shared, visited, liked or rejected, with status.
- **Property page → "Buyers who fit":** open customers (your own, if you're an executive) with fit and the top reasons.
- **Today → "New matches to send":** one fresh, unshared strong or good match per qualified customer, with a **Send** button.
- **Assistant:**
  - "Find properties that fit Ramesh";
  - "Which of my leads would like this?";
  - "Send the top two to Irfan" (logs the share and drafts the message).

## 4. Learning from the customer

The shortlist is the memory:

- Site visit feedback (Phase 5) and 👍/👎 set each property's status there.
- Rejected properties never come back.
- Liked ones are flagged.
- Already-shared ones are labelled, so nobody sends the same flat twice.

## 5. AI

| Tool | Kind |
|---|---|
| `match_properties_for_lead` | read; returns fit and reasons, and the assistant is told to explain with them and never invent a score |
| `match_leads_for_property` | read; role-scoped |
| `share_properties_with_lead` | write; logs and drafts; the person still presses send in WhatsApp |

Offline: "find properties that fit them" on a lead page, and "which leads would like this?" on a property page.

## 6. Possible next steps

- **Learned weights per customer:** if they keep rejecting ground floors, down-rank ground floors. It needs a few months of shortlist data first.
- **Distance-based location** ("within 5 km of Porur") needs coordinates and the maps decision deferred in Phase 1.
