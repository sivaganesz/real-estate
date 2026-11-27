# DEMO_SCRIPT — RealSpec CRM (crm-e2e)

Click-by-click demo, one segment per role. Each segment runs 3 to 5 minutes. Master spec §6 (the "What do I do today?" Today view) leads every segment. ROLE_RESEARCH.md §5 sets what each role sees first. The script shows the AI-first flows: paste-and-fill, the global assistant, auto-assignment, matching, pipeline drag, import and Today actions.

Every label, route and result below comes from the code. Each was checked by running the app (`vite --port 5211`) and clicking through this exact order on fresh demo data. The run was on 27 Nov 2026 at about 10 AM. Counts that depend on the clock ("Good morning", "25 min since the enquiry", "Now" line) will differ slightly at other times. Labels and record names will not.

> **Run the three segments in this order: Admin → Sales Manager → Sales Executive.** Later segments rely on what earlier ones did. Examples: leads imported by the Admin show up in Sneha's Today, the lead Rohit assigns shows up first in Arjun's Today, and Rahul Verma, auto-assigned by Rohit, shows up for Vikram. To show one segment on its own, reset first (step 0). The owner names in the "Expected" lines can then differ, because auto-assignment depends on current workloads.

---

## 0. Reset before demo (1 minute, before the audience arrives)

| # | Click | Expected |
|---|---|---|
| 0.1 | Start the app (`pnpm dev`, or the built preview) and open `/today` in a 1440 px-wide window (Edge or Chrome). | The app opens on **Today** with the left sidebar. There is no login page. |
| 0.2 | Bottom-left of the sidebar: click the profile card (**Switch profile**). Pick **Admin**. | The picker closes and the heading says "Good morning, Meera". |
| 0.3 | Sidebar **Settings** → **Demo data** → **Reset demo data** → in the dialog "Reset all demo data?" click **Reset everything**. | Toast "Demo data reset · Fresh sample data for today is loaded." All dates move to around today. |
| 0.4 | Top bar: check that the theme is Light (**Theme**) and the language is English (the **Language** toggle shows "தமிழ் (Tamil)" as the other option). | English UI, light theme. Profile, theme and language survive the reset. |
| 0.5 | *(Fallback if Settings isn't reachable)* DevTools console: `localStorage.clear()`, then reload. | Fresh seed. The profile goes back to the default executive (Arjun Mehta). |

Keyboard: **Ctrl+K** (or **/** when not typing) opens the assistant and **Esc** closes it. Every AI surface has a **DEMO AI** badge. The assistant never changes data before you click **Confirm**.

---

## 1. Admin: Meera Iyer (about 5 min)

*Story: the data owner runs the business. She gets the overview first, then imports, rules and users.*

| # | Click | Expected |
|---|---|---|
| A1 | Profile card → **Admin** (already selected after the reset). | Heading "Good morning, Meera". The sidebar has every group: Work, Sales, Inventory, Insights (**Reports**, **Activity log**) and Admin (**Team**, **Settings**). The **Leads** badge reads "5 unassigned". |
| A2 | Read the AI day summary at the top (no clicks). | "6 new leads and 4 site visits today, 2 bookings this month and ₹31.92 Cr in the open pipeline. 3 system alerts need a look." with a DEMO AI badge. |
| A3 | Scroll down slowly through the KPI cards: **New leads today**, **Visits today**, **Bookings (month)**, **Pipeline value**, **Conversion**, **Inventory**. | Six cards, each with a change against the previous period. Inventory shows Available 12 / On hold 2 / Booked 3 / Sold 3. |
| A4 | Point at **System alerts**. Do **not** click **Auto-assign** (the Manager does that in segment 2). | Three alerts: "5 leads without an owner" (**Auto-assign**), "Kavya Joshi is deactivated and still owns 1 open lead" (**Redistribute**), "1 possible duplicate: Mohd Irfan ↔ Mohammed Irfan". |
| A5 | In **AI business insights**, click "Housing.com converts best: 50% of its 4 leads booked." | Opens **Reports → Sources** (`/reports/sources`): the insight links to its evidence. |
| A6 | Sidebar **Today**. Press **Ctrl+K**. Click the chip **Business summary for today**. | The panel shows "On: Today · Admin". Answer: "The business at a glance", with stat tiles for New leads today, Visits today, Pipeline value and Conversion, and an **Open Reports** link. |
| A7 | Type `Which project has most unsold inventory?` and press Enter. | "Orchid Villas has the most unsold inventory: 1 unit worth ₹3.1 Cr. In all: 14 unsold units worth ₹19.86 Cr." with property links. |
| A8 | Type `any duplicate leads?` (different wording from the "Find duplicate leads" chip). | "1 possible duplicate pair (same phone or e-mail): Mohammed Irfan (LEAD-1004) and Mohd Irfan (LEAD-1023)". |
| A9 | Type `add property 2.5BHK 1200 sqft east facing in Kondapur, Hyderabad 85 L ready to move owner Ramesh 98450 12345` → **Confirm**. | Before Confirm, an **Add property** card shows "2.5 BHK Apartment in Kondapur · Kondapur, Hyderabad · ₹85 L · 1,200 sq ft · East · Ready to move", read from Indian formats. After Confirm the card says **Done**, with **Undo** and a link to the new property. |
| A10 | Type `mark Priya as booked`. | It refuses to do this in one click: "Booking Priya Sharma needs the property and the booking amount. Open the lead and use Mark as booked." |
| A11 | **Esc**. Sidebar **Import**. | The **Import** hub shows five template cards (Apartments / Flats, Villas / Houses, Plots / Land, Commercial, Leads), each with .xlsx and .csv downloads, plus sample files. |
| A12 | *(Optional)* Click **Download the Leads template as .csv**. | `leads-template.csv` downloads. The template is generated in the browser. |
| A13 | Next to sample **leads-99acres-export.csv** click **Try**. | Column step: "12 rows · 10 columns · headings on row 1 · Custom layout · 97% average match confidence" (DEMO AI). Each column shows its matched CRM field and confidence. "Still to map: Source" is pre-set to **99acres**. |
| A14 | Click **Check 12 rows**. | Check step: 8 ready, 2 duplicates, 2 need fixing. Row #6 Priya Sharma "Already in the CRM (same phone)". Row #9 "Same as row 2 (same phone)". Row #10 Lakshmi Prasad "Phone: "12345" is not a 10-digit mobile". |
| A15 | Row #10 → **Fix**. Set phone `98765 43210` and e-mail `lakshmi.p@example.com`, then click **Re-check row**. | Row #10 turns **Ready**. Row #12 (no name, no phone) stays "Needs fixing" and will be left out. |
| A16 | Click **Import 9 rows** → in "Import 9 rows?" click **Import 9 rows**. | Done step: "9 records are in the CRM", with **Auto-assigned** to Sneha Reddy 5, Vikram Singh 3, Arjun Mehta 1 (one batched notification each). Also shows **Download 3 rows not imported (.csv)** and **Undo import**. |
| A17 | **Import another file** → next to **apartment-brochure.pdf** click **Try**. | Read → Review: "Looks like a Property (97%)", "32 fields auto-filled", one entry per unit (2 BHK and 3 BHK), and "1 field needs a check" (Project · "Please check · 70% sure"). |
| A18 | Click **Save 2 drafts**. | "0 saved · 2 kept as drafts", with **Open draft DRF-…** links. Uncertain extractions wait in Drafts and never go straight into the CRM. |
| A19 | *(Optional, if time)* `/import/apartments?sample=builder-price-list-custom.xlsx`. | The messy builder sheet: "Instructions" tab ignored, totals row skipped, "Super built-up area" mapped. A "Call" price is flagged to fix. |
| A20 | Sidebar **Settings** → **Assignment rules** → **Add rule**. Under **Describe the rule** type `Leads from Chennai who speak Tamil go to Sneha` → **Fill** → **Save**. | The editor fills itself (DEMO AI) with Language: Tamil → Sneha Reddy, and notes "One condition per rule: I also saw Location. Add a second rule for it." After **Save**, the rule list shows "Language: Tamil · Goes to Sneha Reddy". |
| A21 | Sidebar **Team** → **Add user**. Paste `Add Priya Nair as a sales executive under Rohit, priya.nair@example.com, 98450 11122, covers Chennai and Bangalore, speaks Tamil and English` → **Extract**. Then click **Cancel**. | Name, role, manager, e-mail, phone, cities and languages fill in from one sentence. Nothing is saved until **Add user**. Cancel here so the later auto-assign results stay as scripted. Point out Kavya Joshi (Deactivated) and Farhan Qureshi (On leave) in the list. |
| A22 | Sidebar **Activity log**. In the ask box type `changes by Arjun this week` and press Enter. | The log narrows to Arjun Mehta (filter chip "Person: Arjun Mehta"). The header tile "Done with AI" shows the share of AI-made changes, including the ones just made. |
| A23 | Sidebar **Reports** → click the AI summary line "52 new leads came in this period." | A drill-down drawer lists the exact 52 leads: every number can be traced. Point out the period buttons (**This week** … **Last 6 months**) and **Export CSV**. |

---

## 2. Sales Manager: Rohit Khanna (about 5 min)

*Story: the team lead clears the unassigned queue, covers for absences, and pushes stalled deals.*

| # | Click | Expected |
|---|---|---|
| M1 | Profile card → **Sales Manager**. | Toast "Now viewing as Rohit Khanna · Sales Manager". Heading "Good morning, Rohit". The view changes at once without a reload. |
| M2 | Read the summary (no clicks). | "5 leads are waiting for an owner, the team has 9 overdue follow-ups and 7 visits today. 1 new lead has not been called past the escalation time. 1 executive on leave still holds open leads. 5 deals are stalled." Quick chips: **Auto-assign 5 new leads**, **Reassign Farhan's 2 leads**, **Review 5 stalled deals**. |
| M3 | **Unassigned queue**: point at the suggested owner and reason on each row. On **Aditya Rao** click **Assign**. | Each row carries a DEMO AI suggestion with its reason ("Lowest workload", "Location rule", "Round-robin (tied workload)"). Toast "Aditya Rao assigned to Arjun Mehta". The row leaves the queue. |
| M4 | Click **Auto-assign all**. | Preview dialog "Auto-assign 4 leads?": Rajesh Nair → Sneha (Location rule), Mohd Irfan → Vikram, Tanvi Shah → Arjun (Lowest workload), Sunita Patil → Vikram. It also says "People on leave are skipped." |
| M5 | Click **Assign 4**. | Toast "4 leads auto-assigned · Undo". The queue is empty and the **Leads** badge clears. |
| M6 | **Needs your attention** → "Farhan Qureshi is on leave with 2 open leads" → **Reassign with auto-assign**. | Toast "2 leads of Farhan Qureshi reassigned · Undo". |
| M7 | Point at **Team board** (availability, open, calls, visits, overdue, TAT breach per person), **Overdue follow-ups by executive**, **Deals to push** (Stalled / Negotiation) and **Team visits today** (timeline coloured by executive). | Everything a manager checks each morning is on one screen with no clicks (ROLE_RESEARCH §5.2). |
| M8 | Sidebar **Leads** → **Add lead**. Type name `Irfan M` and mobile `98450 98765`. | A duplicate warning appears before saving: "2 possible duplicates: Mohammed Irfan (with Arjun Mehta), Mohd Irfan (with Vikram Singh)", with **Open existing** links. |
| M9 | Press **Esc** → **Discard**. Click **Paste a message**. Paste: `Hi, I'm Rahul Verma, 9845012345. Looking for a 3BHK in Whitefield or Sarjapur, budget around 1.2 Cr, ready to move, need it in 2–3 months. Wife will also decide.` → **Extract**. | "13 fields auto-filled", with AI-filled fields marked ✦. A note says "Around" budget was read as preferred and maximum. "A few quick questions · 1 left: Where did this enquiry come from?" offers source chips. **Assign to** shows "✦ Auto-assign (recommended) · Goes to Vikram Singh · Round-robin (tied workload)". |
| M10 | Click the chip **Walk-in** → **Next**. | Step 2, "What they want": Sale, 3 BHK, Bengaluru, Whitefield + Sarjapur Road and Ready to move are pre-selected. Fit line: "1 property already fits (1 strong or good)". |
| M11 | **Next**. | Step 3: Budget up to ₹1.2 Cr ("₹1,20,00,000"), When will they buy = **In 1–3 months**, Who decides = **Spouse**. "4 of 4 known" (budget, decision maker, requirement, timeline). The word BANT never appears. |
| M12 | **Save lead**. | Toast "Rahul Verma added · Assigned to Vikram Singh · Round-robin (tied workload)". The lead page opens with "Added … ✦ by AI", Mobile +91 98450 12345, and a NEXT BEST ACTION "Make the first call now". |
| M13 | Click **Why this score?** | "Score 55 / 100 · Five parts add up to the score": Qualification, Engagement and recency, Budget and inventory fit ("Best match Aranya Greens 3 BHK, Whitefield (87%)"), and the rest. |
| M14 | **Edit with AI** box: type `budget is now 1.4 Cr, also add Hebbal` → **Read changes** → **Apply 2 changes**. | Diff preview: "Localities: Whitefield, Sarjapur Road → Whitefield, Sarjapur Road, Hebbal · Budget up to: ₹1.2 Cr → ₹1.4 Cr". Toast "2 changes applied · Undo". |
| M15 | **Message** card → **Hinglish**. | The draft is rewritten in Hinglish for WhatsApp. **Open WhatsApp** opens wa.me prefilled and logs the send. |
| M16 | Sidebar **Pipeline**. Drag the **Rahul Verma** card from **New** to **Contacted**. | Toast "Rahul Verma moved to Contacted · Undo". Column totals (₹) and counts update. Cards show days-in-stage and an AI win %. |
| M17 | Drag **Gaurav Bansal** onto **Lost**. | Dialog "Move Gaurav Bansal · Why was the lead lost? (Required)". **Move to Lost** won't run without a reason. Click **Cancel** and the card returns to Contacted. |
| M18 | **Stalled deals** (DEMO AI) → on Sanjay Gupta click **Plan it**. | A **Create follow-up** proposal: "Qualify Sanjay Gupta: budget, timeline, decision maker", for Sneha Reddy, with the reason ("stalled for 18 days, more than twice the target"). It is only added on confirm. |
| M19 | **Pipeline assistant** → click chip **Who is close to booking?** | "5 leads look close to booking: Karthik Subramanian · Negotiation · 82% likely, Harish Reddy · 74%, Deepak Verma · 63% …". |
| M20 | Press **Ctrl+K**. Type `Who is overloaded today?` | A per-person load list with stat tiles, the lightest load named, and a suggested follow-up chip. (After the import, all three executives carry 10 to 11 open leads.) |
| M21 | Type `give Sanjay's lead to Vikram` → **Confirm**, then **Undo** on the same card. | An **Assign lead** card "Sanjay Gupta · From Sneha Reddy · To Vikram Singh". After Confirm: **Done** with links. After **Undo**, Sanjay is back with Sneha. |
| M22 | Type `Summarise team performance this week`. | "Your team this week: calls 19 · site visits 1 · bookings 1", one line per executive, with **Open Team** and **Open Reports** links. |
| M23 | Type `delete property Aranya Greens`. | A polite refusal with the reason: "I can't do that for you: Only the admin can delete properties. Change its status to On hold or Sold instead." |
| M24 | **Esc** → sidebar **Matching** → under **Choose a buyer** click **Ananya Iyer** → click **100% match. Why?** on Neelam Heights. | Ranked properties for the buyer. The explanation lists ✓ reasons, ✗ gaps and amber notes. **Shortlist**, **Share**, **Schedule visit** and **Not interested** are one click each. |

---

## 3. Sales Executive: Arjun → Vikram → Sneha (about 5 min)

*Story: a field executive's day. Each of the three accounts sees only its own work, and the work the Manager just handed out shows up for the right person.*

### 3a. Arjun Mehta (primary account)

| # | Click | Expected |
|---|---|---|
| E1 | Profile card → **Sales Executive** → **Arjun Mehta** (each executive shows status and active-lead count, e.g. "Vikram Singh · In a visit"). | Heading "Good morning, Arjun". The sidebar has no **Team** or **Activity log**, and Settings is profile-only. |
| E2 | Read the brief (no clicks). | "Today you have 1 site visit and 9 follow-ups (6 overdue), plus 4 new leads. Start with Aditya Rao: Not called yet…" Aditya is the lead Rohit assigned in M3, now at the top of Arjun's list. |
| E3 | **Your priorities**: point at the rank number, the temperature, the reason chip, the due time and the score on each row. On row 1 (Aditya Rao) click **Log outcome** → **Connected** → **Save**. | Toast "Logged: Aditya Rao · Connected". The row leaves and the list re-ranks at once. |
| E4 | On Karthik Subramanian ("Collect PAN copy… · Overdue") click **Done**, then **Undo** in the toast. | "Done: Collect PAN copy from Karthik for the offer letter". The row leaves, then comes back after Undo. |
| E5 | Type in the Today **Ask** box: `Reschedule Mohammed Irfan's follow-up to tomorrow 5 PM` and press Enter → **Confirm**. | A **Reschedule follow-up** card (From 26 Nov, 4:00 PM → tomorrow 5:00 PM). Nothing changes until **Confirm**. Then Mohammed Irfan leaves today's list. |
| E6 | **Today's appointments** → on the 3:00 PM Ananya Iyer call click **Send confirmation**. | WhatsApp (wa.me) opens prefilled in a new tab (close it). The appointment is marked **Confirmed**. |
| E7 | Point at **My targets** ("19 / 600 Calls, 2 / 20 Site visits, 0 / 3 Bookings, #2 of 4 in the team") and **New matches to send** (Neelam Heights for Ananya Iyer 100%) → **Share**. | The "Share on WhatsApp" dialog has an English/Hinglish toggle and **Write with AI**. Opening WhatsApp logs the share on the lead. |
| E8 | **Ctrl+K**. Type `who do I call next` (lower-case, no "should"). | "Call Tanvi Shah next. Not called yet…", then Neha Kulkarni and others, as linked cards. Tanvi came from Rohit's auto-assign in M5. |
| E9 | Type `Priya ka visit kal 11 baje fix karo` → **Cancel**. | "Read as: "schedule Priya's visit tomorrow at 11"". A **Book appointment** card: Site visit · Priya Sharma · tomorrow 11:00 AM · Aranya Greens (the shortlisted property is picked). Heads-up: "there is already an appointment at … 11:00 AM". Cancel → "Cancelled. Nothing was changed." |
| E10 | Type `remind me to call Karthik tomorrow 10am about PAN` → **Confirm**. | **Create follow-up**: "Call Karthik about PAN · Call · tomorrow 10:00 AM · Karthik Subramanian" → **Done** with **Undo**. |
| E11 | Type `reassign Priya Sharma to Sneha`. | Refused: "Sales Executives can't reassign leads. You can ask your manager: Request reassignment." It offers the chip **Ask my manager to reassign Priya**. |
| E12 | Type `Who is overloaded today?` | Refused: "The team view is for managers and admins." The AI follows the same permission map as the UI. |
| E13 | Type `What's left for my target this month?` | "4 days left this month: 580 calls to go (about 145 a day), 18 site visits to go, 3 bookings to go", with progress tiles. |
| E14 | **Esc** → sidebar **Appointments** → **Paste & book**. Type `Site visit with Priya tomorrow 11 am at Aranya Greens` → **Extract**. | "7 fields auto-filled": Lead Priya Sharma · Site visit · tomorrow 11:00 AM · Aranya Greens 3 BHK. Free-slot chips (DEMO AI). A **Double booking** warning: "Arjun Mehta already has Karthik Subramanian at 11:00 AM." The button becomes **Book anyway** (warns, never blocks). Click a free slot chip, then **Book appointment**, or **Cancel**. |
| E15 | Sidebar **Pipeline**. Drag **Deepak Verma** from **Visited** to **Negotiation**. | Toast "Deepak Verma moved to Negotiation · Undo". Arjun's board shows only his own deals and has no "Executive" filter. |
| E16 | Sidebar **Import**. | "Bulk import is for admins and managers. You can read one document at a time…" There are no templates, and "MY DRAFTS TO REVIEW" is shown. |

### 3b. Switch to Vikram Singh

| # | Click | Expected |
|---|---|---|
| E17 | Profile card → **Sales Executive** → **Vikram Singh**. | Brief: "Today you have 2 site visits and 12 follow-ups (4 overdue), plus 6 new leads. Start with Vivek Malhotra: Not called yet: 20 h…". Vikram's list differs from Arjun's and includes Mohd Irfan and Sunita Patil from the manager's auto-assign. |
| E18 | Sidebar **Leads** → open **Rahul Verma**. | The lead pasted by Rohit was auto-assigned to Vikram. It shows the ✦ AI-filled fields, the ₹1.4 Cr budget and Hebbal from M14, and stage Contacted from M16. |
| E19 | On Rahul's page, click **Request** (request reassignment). Type `Client prefers a Kannada speaker` → **Send request**. | The dialog closes and the manager gets a notification. Executives cannot reassign; they ask. |

### 3c. Switch to Sneha Reddy

| # | Click | Expected |
|---|---|---|
| E20 | Profile card → **Sales Executive** → **Sneha Reddy**. | Brief: "…plus 6 new leads. Start with Rajesh Nair…". The priorities include Rohit Verma, Sangeetha Raman and Lakshmi Prasad, the 99acres rows the Admin imported in A16 and auto-assigned to her. |
| E21 | Sidebar **Import** → **Read a document** → **Paste text instead**. Paste `Suresh Kumar 98840 11223 wants a 2 BHK in Velachery, Chennai, budget 80 L, from MagicBricks` → **Extract** → **Save as draft**. | The text is read as a Lead (DEMO AI) and saved to Sneha's own Drafts. Each executive sees only their own drafts. |
| E22 | *(Close)* Top bar **Language** → **தமிழ் (Tamil)**, then switch back. | The whole UI, including the AI answers, switches language instantly and survives a reload. |

---

## Notes for the presenter

- **Undo everywhere.** Every write (assign, auto-assign, stage move, AI change, import) shows an **Undo** toast. You can undo a mis-click without resetting.
- **Rahul Verma's owner** comes from live workloads. Followed exactly, this script gives Vikram Singh (round-robin on a tie). If you run the Manager segment alone after a reset, the sheet's ✦ line will say "Goes to Arjun Mehta". In that case, show E18 to E19 as Arjun instead of Vikram.
- **Phone layout.** Resize to 375 px to show the bottom tabs (Today, Leads, Calendar, Pipeline/Properties, More) and the full-screen assistant.
- **Images and OCR.** `visiting-card.png` and `handwritten-requirement.jpg` use tesseract.js, which needs its CDN on first use. Use them only when online. The PDF and pasted-text flows work offline.
- **Known minor gaps** (notes/phase2-reports.md, OPEN): AI-made assignments are still logged as manual (R1/R2), and the docked assistant at 1440 px can squeeze some page layouts (R5). Neither affects this script.
