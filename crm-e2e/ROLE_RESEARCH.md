# ROLE_RESEARCH — how Indian real estate sales teams work day to day

Phase 0 output for Section 3A of the master prompt. It covers three roles: Sales Admin, Sales Manager and Sales Executive. The sources are Indian CRM vendors (Sell.Do, LeadSquared, Zoho, Salesforce India customer stories), job descriptions from builders and brokerages, and industry articles. Most numbers come from vendors, so treat them as directional (see Sources). The findings feed the Today views (Section 6), navigation, dashboards, AI assistants and the permission map (Section 5.3).

---

## 0. Context: how an Indian sales floor is organised

- **Builders and developers** usually split work into **pre-sales**, **sales** and **CRM / post-sales**:
  - Pre-sales are telecallers who qualify portal and ad leads and book site visits.
  - Sales are "closing managers" who run visits, negotiation and booking.
  - CRM / post-sales handle agreements, demand letters and loans.
  - Our "Sales Executive" combines pre-sales and closing, which is typical of mid-size builders and brokerages.
- **Channel partners (CPs) and brokerages** bring a large share of walk-ins in NCR, Mumbai and Pune. When two CPs claim the same buyer, the payout dispute is expensive. This is why the source tag and the original owner have to be fixed at capture.
- **Lead sources** are 99acres, MagicBricks, Housing.com, NoBroker, Facebook / Instagram / Google ads, the website, IVR / missed calls, walk-ins, CPs and referrals.
  - Portal leads often arrive as email or CSV exports rather than through an API, so manual copying is common.
  - Portals sell the same buyer to several brokers, so the first callback wins.
- **WhatsApp is the main channel.** Enquiries, brochures, location pins and visit confirmations all go through it, mostly from personal phones. Open rates are far higher than email.
- **Speed matters.** Leads contacted within the first hour convert many times better (HBR, cited by Sell.Do). The typical Indian response time is reported at several hours. One LeadSquared customer cut first response from 2–3 days to 10–15 minutes.
- **Typical funnel** (vendor figures):
  - Lead → site visit: about 4–15%.
  - Site visit → booking: about 5–20%.
  - Most leads convert on the 4th to 7th touch, but teams often stop after two.
- **Leakage:** 15–25% of leads in Excel-run teams are never called or followed up.

---

## 1. Sales Executive (pre-sales + closing, field + phone)

### 1.1 Typical day (builder or brokerage, 6 days a week; weekends are the peak for visits)

| Time | What happens |
|---|---|
| 09:30–10:00 | Opens the phone and WhatsApp. Scans new leads assigned overnight (portal and ad leads). Checks today's visits and follow-ups, which usually live in a notebook, Excel or memory. |
| 10:00–11:00 | **Calling block 1.** Calls new leads first, because portal leads go cold fast. Qualifies budget, location, configuration, timeline, loan and decision maker. Sends brochure, price sheet and location pin on WhatsApp. |
| 11:00–13:30 | **Site visits.** Confirms with the client 1–2 hours ahead, shares the location or arranges a pickup cab, and shows the units. Notes what the client liked and their objections, usually on paper. |
| 13:30–14:30 | Lunch and travel. Logs the morning outcomes, often late or not at all. |
| 14:30–16:30 | **Calling block 2.** Follow-ups: post-visit calls, price clarifications, revisit booking. Sends cost sheets and offers. Coordinates with the manager on discount approval. |
| 16:30–18:30 | Evening visits and office meetings for negotiation. Helps with booking forms, the token cheque and KYC. |
| 18:30–19:30 | Updates the CRM or Excel sheet. Sends the daily report on WhatsApp (calls made, visits done, hot leads) and plans tomorrow's visits. |

### 1.2 Responsibilities

- **Daily:** call every new lead (TAT target 5–15 minutes) and complete due follow-ups. Confirm and conduct site visits. Log call and visit outcomes. Move pipeline stages. Send a WhatsApp update to the manager.
- **Weekly:** plan weekend visits, which is the peak load. Re-engage visited-but-not-booked buyers. Attend the team review (pipeline and lost reasons). Revisit warm leads with new offers or inventory.
- **Monthly:** meet the booking and revenue target. Push near-closures in the last week. Hand booked clients to the CRM / post-sales team. Learn new project and inventory launches.

### 1.3 Most time-consuming repetitive tasks

1. Copying enquiries from WhatsApp, portal emails and call notes into the CRM or Excel (name, phone, budget, BHK, location).
2. Remembering and scheduling follow-ups, then rescheduling them when the client does not pick up (2–4 attempts per lead).
3. Typing the same WhatsApp messages: intro, brochure, location pin, visit confirmation, thank-you after the visit.
4. Finding units that match a client's budget, location, BHK and possession from the inventory sheet or brochure.
5. Logging visit feedback (liked units, objections, decision maker present, next step).
6. Writing the end-of-day report for the manager (counts of calls, visits and hot leads).
7. Checking for duplicates ("Is this buyer already with someone?") by searching by phone.

### 1.4 Pain points: where executives lose leads

- New leads are not called within the first hour, because the executive is in a visit or the lead arrived after hours.
- Follow-ups are forgotten after 1–2 attempts. There is no reminder, or the reminder is on a personal phone.
- No call follows within 24 hours of a visit, which is the costliest leak in the funnel.
- Visit feedback stays in a notebook. Nobody else can act on it, and the lead is lost when the executive leaves.
- The unit the client liked gets booked by someone else, and no alternative is suggested.
- Conflicts with another executive or a CP over who owns the lead.
- Too many leads of mixed quality, with no idea which one to call first.

### 1.5 Decisions and the information needed

| Decision | Information needed |
|---|---|
| Whom to call first | Lead age / TAT, temperature, score, visit today, overdue follow-up, budget size |
| Is this lead real and qualified? | Budget, location, config, timeline, loan status, decision maker, purpose (the four qualification checks) |
| Which units to pitch | Requirement versus available inventory (price, area, possession, facing / Vastu), match score, what is already booked |
| When to follow up and on which channel | Last contact, client's preferred time, response history, visit outcome |
| Push for a visit, or nurture? | Qualification gaps, timeline, distance from site |
| Ask the manager for a discount or escalate | Deal value, negotiation history, competing offers |

### 1.6 KPIs

- First-response time (TAT).
- Calls made and connected per day (typically 40–80 dials).
- Site visits scheduled and done per week.
- Visit-to-booking conversion.
- Bookings and revenue against the monthly target.
- Follow-up compliance (overdue count, share of visits with a call within 24 hours).
- Lead aging.
- Incentive earned (incentive is a large part of pay).

---

## 2. Sales Manager (team lead / closing head, 3–10 executives)

### 2.1 Typical day

| Time | What happens |
|---|---|
| 09:00–09:30 | Reviews leads from overnight and the morning: unassigned leads, source mix, and hot or high-value (HNI / NRI) leads. Assigns them manually or checks round-robin. |
| 09:30–10:00 | **Morning huddle.** Today's visits per executive, targets, the offer of the week, and who is on leave. Reassigns leads of absent executives. |
| 10:00–13:00 | Monitors the floor: who has not called new leads, and which visits are confirmed. Joins high-value visits or negotiations. Approves discounts and payment plans. |
| 13:00–15:00 | Pipeline review: stalled deals (days in stage), negotiation-stage deals, lost reasons. Coaches executives on specific leads. Handles CP coordination and ownership disputes. |
| 15:00–17:30 | Closes bookings with executives, handles escalations (complaints, unhappy clients) and checks inventory availability with the admin or builder. |
| 17:30–19:00 | Collects executives' daily reports (WhatsApp, Excel), consolidates the team MIS and sends it to leadership. Plans tomorrow's allocation and the weekend visit roster. |

### 2.2 Responsibilities

- **Daily:**
  - Assign and reassign leads.
  - Chase TAT breaches and overdue follow-ups.
  - Approve discounts.
  - Join key visits.
  - Prepare the daily team MIS.
- **Weekly:**
  - Pipeline review per executive.
  - Weekend visit roster.
  - Lost-reason review.
  - Source quality review ("Which portal gives visits, not just enquiries?").
  - CP meetings.
- **Monthly:**
  - Track the target against bookings, and push for closures in the last week.
  - Executive performance reviews and incentive calculation.
  - Forecast.
  - Rebalance the workload across executives.

### 2.3 Most time-consuming repetitive tasks

1. Allocating leads one by one: checking who is free, on leave, in a visit or overloaded.
2. Chasing executives for updates on calls, visits and outcomes over WhatsApp.
3. Consolidating daily and weekly reports from several Excel files and WhatsApp messages.
4. Finding stalled or forgotten deals by scrolling sheets.
5. Reassigning leads when an executive is on leave or leaves the company.
6. Resolving duplicate and ownership disputes, internal or with a CP.

### 2.4 Pain points

- No real-time view of who called whom. The manager only learns of missed leads days later.
- Workload is uneven: top executives are overloaded and new ones sit idle. Round-robin in a WhatsApp group is not real routing.
- Visit feedback is missing, so the manager cannot coach on a specific deal or decide a discount.
- Stalled deals in negotiation are noticed too late.
- When an executive leaves, their leads and client history go with their phone.
- Reports take hours and are already stale when sent.

### 2.5 Decisions and the information needed

| Decision | Information needed |
|---|---|
| Who gets this lead | Active load, pending follow-ups, today's visits, availability (leave / in visit), conversion rate, language, project / location specialisation |
| Reassign a neglected lead? | Days since contact, missed follow-ups, owner's load |
| Where to step in today | High-value deals, negotiation stage, stalled more than X days, escalations |
| Approve a discount | Deal value, unit, competing offer, the executive's notes |
| Coach which executive | Per-executive funnel (calls → visits → bookings), overdue count, TAT |
| Which source to push | Visit and booking conversion by source |

### 2.6 KPIs

- Team bookings and revenue against target.
- Team visit-to-booking conversion.
- Average TAT and number of SLA breaches.
- Overdue follow-ups per executive.
- Pipeline value and stage drop-off.
- Lost-reason mix.
- Unassigned lead age.
- CP-sourced conversion.

---

## 3. Sales Admin (CRM / sales operations, MIS, data owner)

### 3.1 Typical day

| Time | What happens |
|---|---|
| 09:00–10:00 | Pulls portal and ad leads that did not sync automatically (CSV or email exports from 99acres, MagicBricks, Housing, Meta). Cleans, dedupes, tags the source and campaign, and imports. Checks the overnight import and sync status. |
| 10:00–11:30 | Updates inventory: unit availability (blocked / booked / sold), price revisions and new launches. Updates matching data so executives do not pitch sold units. |
| 11:30–13:00 | User management: onboarding new executives, deactivating leavers and transferring their leads, permission changes. Configures assignment rules and auto-distribution. |
| 14:00–16:00 | Data hygiene: duplicates, missing fields, wrong sources. CP lead tagging and resolving ownership claims. Answers "Why didn't I get leads?" queries. |
| 16:00–18:30 | Prepares the MIS: leads by source, cost per visit and cost per booking, team funnel, inventory status. Sends daily, weekly and monthly reports to management. Audits activity (backdated updates, fake visits). |

### 3.2 Responsibilities

- **Daily:**
  - Lead import and dedupe.
  - Inventory status sync.
  - User and access requests.
  - Monitoring assignment rules.
  - Daily MIS.
  - System alerts (failed imports, unassigned spikes).
- **Weekly:**
  - Source and campaign ROI report.
  - Data quality audit.
  - Update rules and templates (WhatsApp templates, pipeline stages, lost reasons).
- **Monthly:**
  - Management review pack: funnel, revenue, inventory sell-through.
  - Incentive data.
  - User access review.
  - New project / tower setup.

### 3.3 Most time-consuming repetitive tasks

1. Downloading, cleaning and mapping portal and ad exports, then importing them, every day.
2. Deduplicating by phone and merging histories. The earliest genuine source gets the credit.
3. Keeping inventory status in sync with bookings.
4. Building reports by hand in Excel (pivots by source, executive and stage).
5. Transferring leads in bulk when an executive leaves or changes team.
6. Entering properties and projects from brochures, price lists and PDFs.

### 3.4 Pain points

- Leads arrive in many formats, with inconsistent columns and phone formats (+91, spaces, a leading 0).
- Duplicates corrupt attribution and CP payouts.
- Reports are always manual and late. Management asks for "today's numbers" ad hoc.
- There is no audit trail of who changed what.
- Assignment rules live in people's heads.

### 3.5 Decisions and the information needed

| Decision | Information needed |
|---|---|
| Change assignment rules | Workload balance, conversion by executive and source, TAT breaches |
| Activate or deactivate a user, and transfer leads | User's open leads, appointments, tasks |
| Fix or trust imported data | Duplicate matches, missing required fields, mapping confidence |
| Budget and source advice to management | Cost per lead, visit and booking by source; pipeline value; inventory left |

### 3.6 KPIs

- Data completeness and duplicate rate.
- Import turnaround (lead visible to an executive within X minutes).
- Leakage: share of leads never contacted.
- Report timeliness.
- Business-level KPIs it reports on: leads, visits, bookings, revenue, pipeline value, inventory sold versus unsold, conversion by source.

---

## 4. Repetitive task → how the CRM reduces it

Mode key:
- **Auto** = automate fully (only when switched on).
- **AI+1** = AI drafts it and the user confirms in one click.
- **Fast** = a faster manual step.

| # | Role | Repetitive task | Mode | How | Screen / feature |
|---|---|---|---|---|---|
| 1 | Exec | Copy a WhatsApp or portal enquiry into a lead form | AI+1 | Paste or speak → fields filled and marked as AI-filled → only the missing essentials asked | Add lead sheet: Paste & Fill; global assistant |
| 2 | Exec | Decide whom to call first | Auto | Prioritised action list with a reason (new lead TAT, visit today, overdue, hot or high score) | Executive Today |
| 3 | Exec | Remember follow-ups and reschedule no-answers | Auto + Fast | Auto follow-up task after a "not reachable" log (+2h / next day). One-click Reschedule chips. | Today action list; log-call dialog |
| 4 | Exec | Type the same WhatsApp messages | AI+1 | Drafted message per context (intro, visit confirm, post-visit, offer). A Hinglish variant. Opens wa.me prefilled. | Lead page; Follow-up Assistant |
| 5 | Exec | Find matching units | Auto | Match score ranking that excludes Booked / Sold units, with "why it matches" chips | Lead page → Matches tab; Property Matching |
| 6 | Exec | Log visit feedback | Fast + AI+1 | Structured outcome form (liked units, objections, decision maker present, next step). AI suggests the stage and the next follow-up. | Appointment "Complete visit" dialog |
| 7 | Exec | Call within 24h after a visit | Auto | Completing a visit creates a call task due within 24h for the owner, and escalates to the manager if it is missed | Tasks; Today; Manager Today |
| 8 | Exec | Daily report to the manager | Auto | Activity counts are logged automatically. The manager sees them live, so no WhatsApp report is needed. | Executive Today targets; Manager Team activity |
| 9 | Exec | Duplicate check by phone | Auto | Duplicate warning on create and import (phone or email), showing the owner and a link | Add lead; Import |
| 10 | Exec | Fill qualification gaps | AI+1 | AI reads notes and asks only the missing questions with quick-pick chips | Lead page → qualification card |
| 11 | Exec | Visit reminders to self and client | Auto | Reminder notification before the visit. One-click WhatsApp confirmation with the location link. | Appointments; notifications |
| 12 | Mgr | Allocate each lead | Auto / Fast | Auto-assignment (lowest load, then round-robin, with rules by location, type, language and source). The manual dialog shows load, visits, leave and conversion. | Manager Today "Unassigned"; Assign dialog; Settings → rules |
| 13 | Mgr | Chase executives for updates | Auto | Live team board: calls, visits, overdue items per executive. Overdue and TAT breaches highlighted. | Manager Today; Team |
| 14 | Mgr | Find stalled deals | Auto | Stalled flag (days in stage above the threshold) with an AI next-action | Pipeline; Manager Today "Needs attention" |
| 15 | Mgr | Reassign leads of absent executives | AI+1 | "Executive on leave: reassign 6 leads?" proposal using auto-assign logic | Manager Today; Team → availability |
| 16 | Mgr | Consolidate the team MIS | Auto + AI | Reports generated live. AI writes a 3-line summary. Export. | Reports; Dashboard Insights Assistant |
| 17 | Mgr | Spot neglected high-value leads | Auto | Escalation list: HNI or high budget with no contact for X days, plus a reassignment suggestion | Manager Today |
| 18 | Admin | Clean, map and import portal exports | AI+1 | Column auto-mapping, phone normalisation, dedupe preview, source tagging, then confirm | Import (templates + custom mapping) |
| 19 | Admin | Enter properties from brochures or PDFs | AI+1 | Extract from PDF, image or text into the property form (marked as AI-filled) | Add property; Import documents |
| 20 | Admin | Sync inventory with bookings | Auto | Marking a deal Booked sets the unit to Booked and removes it from matching | Pipeline → Booked dialog |
| 21 | Admin | Transfer a leaver's leads | Fast / Auto | Deactivating a user prompts to redistribute their leads (auto or to a person) | Settings → Users |
| 22 | Admin | Build reports by hand | Auto | Dashboards by source, executive, stage and inventory. AI insights. | Admin Today; Reports |
| 23 | Admin | Data hygiene | Auto + Fast | Duplicate and missing-field queue with bulk fixes | Admin Today "System alerts"; Leads bulk actions |
| 24 | All | Search for a record or action | Fast | Ctrl/Cmd+K assistant and search with natural-language commands | Global assistant |

Show the effort saved where it is practical, for example "9 fields auto-filled" or "12 leads auto-assigned today".

---

## 5. Design implications

### 5.1 Sales Executive

**Today view.** Each item answers "Why this, now?".

1. AI greeting and day summary, for example: "3 visits, 5 follow-ups, 2 overdue. Start with Priya Sharma: hot, visit 11:00 at Whitefield."
2. **Priority action list**, ranked in this order:
   1. New leads not yet called, with the TAT clock.
   2. Visits in the next 2 hours.
   3. Overdue follow-ups.
   4. Post-visit calls due within 24 hours.
   5. Hot leads not contacted for 3 days or more.
   6. Stale leads.
   - Each row has: reason chip, due time, and the buttons Call, WhatsApp, Log outcome, Reschedule, Done, Open.
3. Today's visits on a timeline, with location map link, property and one-click "Send confirmation".
4. Targets: calls, visits and bookings this month (progress rings), plus rank or streak.
5. "Visited, not booked" re-engagement strip (last 7 and 14 days).

Done or Log immediately updates the item and the next action appears, so work flows like an inbox to zero.

**Navigation order:** Today → Leads → Appointments → Pipeline → Properties (with Match) → Tasks → My performance. The Paste & Fill "Add lead" sits as a top-bar primary button.

**AI assistant prompts (suggested chips):**
- "Who should I call next?"
- "Add lead from this WhatsApp message"
- "Draft visit confirmation for my 11 AM"
- "Match properties for Rahul under 1.2 Cr"
- "Reschedule Priya's follow-up to tomorrow 5 PM"
- "Summarise this lead before my call"
- "What's left for my target this month?"

### 5.2 Sales Manager

**Today view:**

1. **Unassigned queue** with age, source and budget. Buttons: "Auto-assign all" and per-row assign. Each row shows the AI-suggested executive.
2. **Team board:** one row per executive showing availability (Available / In visit / On leave), active load bar, today's calls and visits, overdue count and TAT breaches.
3. **Needs attention:**
   - Escalations, such as a missed 24h post-visit call.
   - High-value leads untouched for X days.
   - Stalled deals.
   - Negotiation-stage deals.
   - Reassignment suggestions.
4. Today's team visits on a timeline, coloured by executive.
5. Team target gauge: bookings and revenue against the monthly target, plus a funnel.

**Navigation order:** Today → Leads (team, with an Unassigned tab) → Pipeline → Team → Appointments → Reports → Properties → Import → Settings (team rules).

**AI assistant prompts:**
- "Assign new leads"
- "Who is overloaded today?"
- "Show stalled deals over 10 days"
- "Reassign Arjun's leads, he's on leave"
- "Summarise team performance this week"
- "Which source converts best to visits?"
- "Leads with no contact in 5 days"

### 5.3 Sales Admin

**Today view:**

1. Business KPIs with sparklines: new leads today, visits, bookings, pipeline value, conversion, and inventory (available / hold / booked / sold).
2. Source funnel: leads → visits → bookings by source.
3. Team performance snapshot.
4. Import activity: last jobs, rows imported, duplicates caught.
5. **System alerts:**
   - Unassigned leads older than X minutes.
   - Duplicates queue.
   - Records with missing data.
   - Deactivated users who still own leads.
6. AI business insights: 3–5 bullets with drill-down links.

**Navigation order:** Today → Reports → Leads → Properties → Import → Pipeline → Appointments → Team & Users → Settings (rules, stages, templates).

**AI assistant prompts:**
- "Import this CSV from 99acres"
- "How many leads did we lose to budget mismatch this month?"
- "Deactivate Kavya and redistribute her leads"
- "Which project has most unsold inventory?"
- "Business summary for today"
- "Find duplicate leads"

### 5.4 Cross-role implications

- **Required fields:**
  - Lead: name + phone + source. The source is mandatory because attribution and CP disputes depend on it.
  - Visit outcome: outcome + next step date.
  - Lost: a reason.
- **Lead ownership:** keep the original source and the first owner in an assignment history that cannot be edited. Duplicates are merged, never silently overwritten.
- **TAT and SLA:** show a TAT clock on new leads. A breach triggers a notification to the owner, then to the manager.
- **WhatsApp everywhere:** wa.me prefilled from templates. Log the "sent" activity after a click.
- **Mobile-first for executives:** they work from the phone during visits, so the Today and lead pages must work well at 375px.

---

## 6. Final permission matrix (proposed; supersedes Section 5.3)

Changes from Section 5.3, with the reason for each:

- **Executive lead deletion stays blocked.** The executive can only mark a lead Lost or Junk with a reason. Lost reasons drive analysis, and deletion hides leakage.
- **Executive property editing is limited to properties they created.** Builder inventory price and status are controlled by Admin and Manager to avoid pitching wrong prices.
- **Export is restricted.** Brokerages commonly worry about executives leaving with client data.
- **Executive bulk import is blocked.** The executive can still use single-document extraction (Paste & Fill / PDF to one record).
- **The manager can set executive availability (leave)** but cannot create users.

| Capability | Admin | Manager | Executive |
|---|---|---|---|
| Create / activate / deactivate users, change roles | ✅ | ❌ | ❌ |
| Set executive availability (available / on leave) | ✅ | ✅ (team) | Own status only |
| Configure assignment rules, auto-distribution on/off | ✅ (global) | ✅ (team level) | ❌ |
| Configure pipeline stages, lost reasons, message templates | ✅ | ❌ (view) | ❌ |
| View leads | All | Team + unassigned | Own |
| Create leads | ✅ | ✅ | ✅ (auto-owned by self, or auto-assigned if on) |
| Edit leads | All | Team | Own |
| Delete leads | ✅ | ✅ (team, with undo) | ❌ (mark Lost / Junk with reason) |
| Assign / reassign leads | ✅ | ✅ (within team) | ❌ (can request reassignment) |
| Move pipeline stage | All | Team | Own |
| Mark Booked (token) | ✅ | ✅ | ✅ (own; manager notified) |
| Create / edit appointments and tasks | All | Team | Own |
| View properties and run matching | ✅ | ✅ | ✅ |
| Create properties | ✅ | ✅ | ✅ |
| Edit properties (price, status) | All | All | Own-created only |
| Delete properties | ✅ | ❌ | ❌ |
| Bulk import (CSV / Excel / documents) | ✅ | ✅ (leads; assigns to team) | ❌ (single-record paste / document extract only) |
| Export data | ✅ | Team | ❌ |
| Reports | All (business, source, inventory) | Team | Personal |
| Global activity log / audit | ✅ | Team | Own records' timeline |
| Settings | All | Team rules + preferences | Profile + preferences (theme, language) |
| Reset demo data | ✅ | ❌ | ❌ |
| AI actions | Same as the role's permissions; the assistant refuses anything else and says why | Same | Same |

Implementation note: one `can(role, action, record?)` function. The `record` argument handles "own" and "team" scope. Navigation, routes, buttons and AI command execution all use it.

---

## Sources

Vendor claims are marked as such in the text.

- [Sell.Do – Real estate lead leakage for brokers (2026)](https://www.sell.do/blog/real-estate-lead-leakage-brokers-2026)
- [Sell.Do – Will a CRM improve site-visit-to-booking ratio](https://www.sell.do/blog/will-a-real-estate-crm-help-improve-site-visit-to-booking-ratio)
- [Sell.Do – Real estate CRM challenges and solutions in India](https://www.sell.do/blog/real-estate-crm-challenges-and-solutions-in-india)
- [Sell.Do – 6 pre-sales challenges for channel partners](https://www.sell.do/blog/6-pre-sales-challenges-for-channel-partners-in-real-estate)
- [Sell.Do – Sales & pre-sales: qualify, route, close](https://www.sell.do/real-estate-crm/sales-and-pre-sales)
- [Sell.Do – Site visit management](https://www.sell.do/real-estate-crm/sales-and-pre-sales/site-visit-management)
- [Sell.Do – Channel partner conflict management](https://www.sell.do/real-estate-crm/channel-partners/conflict-management)
- [Sell.Do – Real estate sales features](https://sell.do/sales/features)
- [LeadSquared – Real estate KPIs](https://www.leadsquared.com/industries/real-estate/real-estate-kpis/)
- [LeadSquared – LANSUM Properties case study (TAT 2–3 days to 10–15 min)](https://www.leadsquared.com/case-studies/lansum-properties-transforms-sales-with-leadsquared/)
- [LeadSquared – Real estate enterprise reduces lead leakage by 70%](https://www.leadsquared.com/case-studies/leading-real-estate-company-reduces-lead-leakage/)
- [LeadSquared – 99acres integration](https://www.leadsquared.com/99acres-integration/)
- [Zoho – Real Estate CRM](https://www.zoho.com/realestate/realestate-crm.html)
- [Salesforce India – Tata Realty customer story](https://www.salesforce.com/in/customer-stories/tata-realty-and-infrastructure-limited/)
- [Salesforce India – M3M unified customer view](https://www.salesforce.com/in/customer-stories/m3m-india/)
- [exchange4media – Realty's growing lead-to-sale gap](https://www.exchange4media.com/marketing-news/the-click-that-goes-nowhere-realtys-growing-lead-to-sale-gap-158636.html)
- [IJRPR – Pre-sales telecalling to site visits, Pune case study (PDF)](https://ijrpr.com/uploads/V7ISSUE11/IJRPR72144.pdf)
- Indian job descriptions for real estate sales executives and managers (Indeed India, foundit, apna): [Indeed – Real Estate Sales](https://in.indeed.com/browsejobs/Real-Estate/Real-Estate-Sales), [foundit – Sales Manager, Bengaluru](https://www.foundit.in/job/sales-manager-real-estate-experience-brad-realty-bengaluru-bangalore-55523567), [foundit – Channel Sales Manager](https://www.foundit.in/job/channel-sales-manager-salarpuria-group-kolkata-58167820)
- [DEV – Real estate automation CRM setup (vendor blog; India response-time claim)](https://dev.to/tatvatech_digitalpvtltd/real-estate-automation-crm-setup-to-boost-sales-in-2026-1ii8)
