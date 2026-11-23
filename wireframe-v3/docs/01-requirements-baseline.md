# 1. Requirements baseline

**Status:** approved 23 November 2026

## What the product is

An internal sales and inventory tool for one real-estate company in Tamil Nadu. The company owns every listing. An AI assistant does the data entry and the matching, so the team doesn't fill long forms.

The CTO judges it by one thing: **how simple a salesperson's day is**, not by how many features it has.

## Who uses it

| Persona | Their job | Key rule |
|---|---|---|
| **Sales executive** — the main user, often on a phone | Work their leads: follow-ups, site visits, recommending and sharing properties, moving deals forward | Doesn't add or edit properties |
| **Sales manager** | Load the inventory, set price and status, assign leads, watch the team's pipeline | The main person who loads properties |
| **Admin** | Everything a manager does, plus users, roles and settings | The only role that creates custom roles |
| **Customer** (indirect) | Receives the Share page, fills in the enquiry form | Sees only confirmed, public facts |

## What it must do

**Leads**
- A lead can be created from free text; the AI works out what they're looking for (type, place, budget, size, key details). BANT labels never appear on screen.
- Stages: New enquiry → Contacted → Qualified → Property recommended → Site visit scheduled → Negotiation → Booking / Closed, plus Lost (with a reason).
- Follow-ups, an activity timeline, the assigned executive, and a readiness indicator.

**Matching (two-way)**
- Properties that fit a lead, and leads that fit a property.
- A "Conditional match" when a property claims an approval but its document is missing.
- Matching is shown at the top of the screens where it matters, never 2–3 clicks deep.

**Properties**
- Added with the AI assistant: chat plus a live summary.
- Required to publish: title, purpose, type, city, locality, price, area, and 2 key details per type.
- Completion bar, To do list, Edit with AI, History.
- Statuses: Available, Under negotiation, Reserved, Booked, On hold, Sold, plus Draft and Waiting for approval.
- Location: approximate until an exact location is set. Nearby places, with route checks for everyday places close by.
- Legal: optional approval badges; a badge shows "document pending" until its document is uploaded.
- Photos and documents, a price check against similar properties, and the **Share page** (the customer's brochure).

**Bulk import**
- One drop zone for any file: an owner's sheet, a brochure, a catalogue or photos.
- AI column mapping, saved formats per sender, unmatched columns kept as extra details.
- A Check screen before anything is saved.

**Site visits and appointments**
- Site visits, office meetings and phone calls.
- Calendar, booking, reschedule, cancel (with a reason), outcome and feedback.

**Search**
- Natural-language search across properties and leads ("east-facing plots in Madurai under 30 L").

**Public enquiry form**
- A customer-facing form that creates a new lead.

**Settings**
- Company, users and roles, property types and their facts, amenities, approval badges, nearby place categories, visit hours, pipeline stages and rules.

## Rules that apply to every screen

- Built around each persona's day, with the fewest clicks and no deep left-hand menu.
- Photo-first listings and a visual pipeline with stage counts.
- A modern design system, based on the CTO's Dribbble references.
- Phone, tablet and desktop, all tested.
- English and Tamil with a language switch; all screen text kept in language files.
- Indian formats: ₹, lakh, crore.
- Data shaped like the real database (stable IDs, links between records, who and when), so the design moves into development without rework.

## Decisions made on 23 November

1. **Not in this design:** the PRD, Perfox (AI conversations, call logs, Perfox as the source of leads), HNI qualification, Projects and Reports.
2. **Features the CTO approved** (AI add property, bulk import, natural-language search, two-way matching, nearby places): their behaviour stays; their layout and flow are redesigned.
3. **Leads live in our own system.**
4. **Where:** the `wireframe-v3/` folder, on the `spec-system-wireframe` branch.
5. **Design references:**
   - Brickline Real Estate CRM Dashboard — https://dribbble.com/shots/27642297-Brickline-Real-Estate-CRM-Dashboard-UI-Design
   - Landify Real Estate CRM — https://dribbble.com/shots/27475433-Landify-Real-Estate-CRM-UI-UX-Design

## Not carried over from the old wireframe

- the left menu grouped as "Specification data / Sales & qualification";
- one dashboard for every role;
- a table-first property list;
- Matching as a separate page;
- "Test scenario" and "System map" as menu items.
