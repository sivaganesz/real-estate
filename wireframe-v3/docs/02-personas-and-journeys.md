# 2. Personas and day journeys

**Status:** draft for review, 23 November 2026

Each journey decides two things for the role: its **home page** and its **top tasks**. The top tasks get the shortest paths in the design; everything else can be one level deeper.

**Click budget:** the maximum number of taps or clicks a task may take, counted from the home page. The design must meet it on a phone.

The journeys are drafted from common real-estate sales practice. They should be checked with a real salesperson or property dealer before the low-fidelity layouts (section 5).

---

## 2.1 Sales executive — "Who do I call, where do I go, what do I show them?"

**Context**
- Out in the field for most of the day, between site visits, on a **phone**, often one-handed.
- At a desk only in the morning and the evening.
- Thinks in Tamil and English, and would rather speak a note than type one.
- Measured on visits and bookings, so wants to see their own leads and their own next step, nothing else.

**A typical day**

| Time | Moment | What they need on screen | Click budget |
|---|---|---|---|
| 9:00 | **Plan the day** | Today's visits in time order, follow-ups due and overdue, new leads assigned to them, and new matches ("a new plot in Porur fits Arun and Meena") | 0: it's the home page |
| 9:30 | **Call a lead** | The phone number, what the lead wants, the last activity and the best matches, all on one screen | 1 to open the lead, 1 to call |
| | **Log the call** | An outcome (interested, call back, not reachable, not interested), a spoken or typed note, and the next step the AI suggests (stage, next follow-up date), confirmed in one tap | 3 |
| 10:15 | **A new enquiry comes in** (walk-in, phone call, referral) | Quick add: type or speak *"Ravi, 98xxx xxxxx, 2 BHK in Porur under 70 L, ready to move"*; the AI fills the requirement and shows the matches straight away | 2, about 1 minute |
| 10:20 | **Recommend and share** | Pick 1–3 matching properties, send the Share page link on WhatsApp (or as a PDF). It's logged on the lead, and the lead moves to *Property recommended* | 3 |
| 11:00 | **Book a site visit** | The free times for the property and for themselves; confirm | 3 |
| 12:00 | **At the site visit** | Directions, the property's key facts and photos, and the lead's wishes beside them. Optional: check the route to a nearby school or bus stop | 1 from the home page |
| 12:45 | **After the visit** | Outcome (liked it, didn't, wants to negotiate), feedback, next step | 2 |
| 15:00 | **A caller asks "anything in Madurai under 30 L?"** | One search box in plain words, photo-first results, share from the result | 2 to search, 2 to share |
| 18:00 | **Wrap up** | What's still open: visits without an outcome, leads with no next follow-up, tomorrow's plan | 0: it's on the home page |
| Weekly | **Check their pipeline** | Their own leads as a board with stage counts; move a lead by dragging or tapping | 1 |

**Home page: My day**
1. Today's timeline (visits, meetings, calls)
2. Follow-ups due and overdue
3. New leads assigned to them
4. New matches for their leads
5. End-of-day loose ends

**Never does:** add or edit properties, change a property's status, bulk import, settings, or reassign leads.

---

## 2.2 Sales manager — "Is the team moving deals, and is the inventory right?"

**Context**
- Mostly at a **desktop or tablet** in the office; a phone in the evening.
- Two jobs: **load and keep the inventory** correct, and **keep the team's pipeline moving**.
- Receives property details as owners' sheets, builders' brochures and photos on WhatsApp.

**A typical day**

| Time | Moment | What they need on screen | Click budget |
|---|---|---|---|
| 9:00 | **Morning check** | The team pipeline with stage counts; stuck leads (too long in one stage); overdue follow-ups per executive; unassigned leads; today's team visits | 0: it's the home page |
| 9:15 | **Assign new leads** | Unassigned leads, with a suggested executive (by area and workload); assign in one tap each | 2 per lead |
| 10:00 | **Load a property an owner sent** | Add: describe it, or drop the brochure or photos; the AI fills it; answer what's missing; publish | 2 to start, under 3 minutes |
| 10:30 | **Load a whole sheet or catalogue** | The same drop zone: column mapping, then the Check screen; save | 3 + review |
| 10:45 | **"Who wants this?"** | The moment a property is published: "4 leads fit", with their executives; notify the executives | 1 from the property |
| 11:30 | **Keep the inventory right** | Price changes, status changes (Under negotiation, Sold), and finishing the To do list (photos, exact location, documents) | 2 |
| 14:00 | **Help a stuck deal** | Open a lead from the stuck list; see its history; reassign it or add a note for the executive | 2 |
| 16:00 | **Close deals** | The leads in Negotiation; mark Booking / Closed; mark the property Booked or Sold | 3 |
| Weekly | **See how the team is doing** | Each executive's numbers (leads, visits, bookings), where leads are lost and why. This lives on the home page, not in a separate Reports module | 1 |

**Home page: Team today**
1. The pipeline with stage counts
2. Needs attention: stuck leads, overdue follow-ups, unassigned leads
3. Today's team visits
4. Inventory to do: drafts, missing photos, documents pending
5. Team numbers

**Also does everything an executive can**, for leads assigned to themselves.

---

## 2.3 Admin — "Set it up, then keep out of the way"

**Context**
- Usually the owner or an office lead, at a **desktop**.
- Most days they work like a Sales manager. Setup is occasional.

**Journey**
- **Daily:** the same home page and tasks as a Sales manager.
- **Occasional, in Settings:**
  - add or deactivate users, change roles, create a custom role;
  - company details and logo;
  - property types and their facts, amenities, approval badges, nearby place categories;
  - visit hours, pipeline stages, the "stuck after N days" rule;
  - languages.

**Design implication:** Settings is not part of the daily navigation. It sits under the profile or gear menu, so it doesn't add weight to anyone's day.

---

## 2.4 Customer touchpoints (no login)

| Touchpoint | What the customer does | What it creates in the system |
|---|---|---|
| **Share page** (opened from a WhatsApp link, on a phone) | Looks at photos, price and the approximate total cost, key facts and nearby places; taps "Book a visit" or "Call me" | A note on the lead's timeline ("opened the link", "asked for a visit"), shown to the executive |
| **Public enquiry form** | States what they're looking for | A new lead in the manager's unassigned list |

---

## 2.5 What the journeys mean for the design

1. **Each role has its own home page.** My day for executives; Team today for managers and admins.
2. **Matching appears in three places:**
   - **My day:** new matches;
   - **a lead's page:** the top section;
   - **a property's page:** the top section.
3. **One quick ＋ button**, available everywhere. *New lead* for everyone; *Add property* and *Import* for managers and admins.
4. **One search box**, in plain words, across leads and properties.
5. **Phone-first for executives**, with every top task reachable by thumb. **Desktop-first for managers**, with dense overviews and side-by-side review.
6. **Speak instead of type** wherever a note or a description is entered.
7. **The AI proposes the next step; a person confirms it.**

---

## Open questions

1. **Which leads does an executive see?** Only their own (recommended, and it matches "my leads"), or every lead?
2. **Who can create leads?** I've assumed anyone, and that a lead created by an executive is assigned to them. A form submission goes to the manager's unassigned list.
3. **Property status:** may an executive mark a property *Under negotiation*, or only ask the manager to? I've assumed only the manager changes it.
4. **Route checks:** I've assumed executives may record them during visits (an optional task). Is that right?
5. **Real-user check:** can we speak with one salesperson or dealer (Vimal's contacts) before section 5?
