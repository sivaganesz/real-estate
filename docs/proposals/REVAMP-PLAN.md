# Wireframe revamp plan — after the CTO review

**Date:** 23 November 2026 · **Status:** draft, open questions below · **Branch:** `spec-system-wireframe`

**Why:** in the call on 20 Nov, the CTO approved the features: Add property with the AI, bulk import, natural-language search, matching and nearby places. He asked for a revamp before the next demo, built on three principles:
- **user journey**;
- **design system**;
- **user experience**.

**His main points:**
- organise the app by each person's daily journey, not by modules;
- put matching at the top;
- a more graphical look, with photo-first listings and a visual pipeline;
- a design system from a Dribbble reference;
- tested on phone, tablet and desktop;
- English and Tamil with a language switch;
- **salespeople don't load properties.**

---

## Step 1: Quick fixes (small, can start now)

- Sales executives can no longer add properties or use Bulk import. Only the Sales manager and Admin load properties.
- Leads moves above Properties in the menu.
- Update the spec and the proposal to match.

## Step 2: Persona journeys (a short write-up, then a review)

One page per role on what they do from morning to evening. It decides their menu and home page.

| Role | Home page | Menu |
|---|---|---|
| **Sales executive** | **My day:** today's follow-ups and visits, overdue leads, new leads assigned to me, the best property matches for each lead, and the next action button | My day · My leads · Pipeline · Calendar · Properties (view and share only) |
| **Sales manager** | **Team overview:** pipeline, stuck leads, who needs help, unassigned leads, properties waiting for approval | Overview · Leads · Pipeline · Properties · Import · Team · Reports |
| **Admin** | The same as Sales manager, plus Settings and users | The same, plus Settings |

**Matching moves to the top:**
- on **My day**;
- at the top of every lead's page ("3 properties fit Arun");
- on each property ("3 buyers fit").

## Step 3: Design system (needs the CTO's reference)

- Built from the Dribbble reference: colours, fonts, rounding, shadows, spacing, and the standard parts (buttons, cards, tables, chips, tiles).
- Published as a page for review before any screen is restyled.

## Step 4: Rebuild the screens with it

- the new home pages and the role-based menu;
- **photo-first property cards** instead of the table, with the table kept as an option;
- the lead page with matches on top;
- the pipeline compared with the CTO's reference;
- every screen updated to the new look.

## Step 5: English and Tamil

- A language switch in the top bar (**English | தமிழ்**), remembered per user.
- All screen text (menus, buttons, headings, labels, messages) is moved into an English file and a Tamil file. Adding Hindi or Kannada later means adding one more file.
- What people type (property titles, lead names, notes) stays as entered. Prices keep the Indian style (₹, lakh, crore).
- Claude drafts the Tamil, and someone fluent checks it.
- **Possible later, as separate decisions:**
  - the AI assistant understanding and replying in Tamil (or mixed Tamil and English);
  - the customer brochure generated in Tamil.

## Step 6: Testing on three sizes

- Every page checked on phone, tablet and desktop, with screenshots of each for review.

## Step 7: Brochure demo

The CTO asked: "If I put a full brochure, can you extract everything?"

| Option | What it means |
|---|---|
| **A. Simulated** | The version already in Bulk import, with a better sample result |
| **B. Real** | A small local server and an AI key, so the CTO can drop in any real brochure and see it read |

---

## Open questions

1. **Design reference:** the Dribbble link the CTO shared, or the pipeline screenshot taken during the call. Needed for step 3.
2. **Admin:** the same screens as Sales manager plus Settings (suggested), or a separate journey?
3. **Brochure demo:** option A or B?
4. **Tamil reviewer:** is anyone on the team able to check the translations?
5. **Research:** can we talk to one of Vimal's salesperson or property-dealer contacts before the journeys are final? Until then, the journeys are drafted from common real-estate sales practice.

## How we work through it

- Steps 1 and 2 start first, because they don't depend on anything.
- **There are two review points:**
  - after step 2 (the journeys);
  - after step 3 (the design system).

  These two decide everything that follows.
- Steps 3 to 6 follow once the design reference arrives.
- Nothing is committed or pushed without approval.
