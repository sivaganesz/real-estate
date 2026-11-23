# 03 · Customers and leads

**Status:** built · **Commit:** Phase 3 · **Users:** executives (their own customers), managers and admins (everyone).

## 1. How it works in practice

| Moment | Reality in an Indian real-estate office |
|---|---|
| Enquiry arrives | Portal (99acres, MagicBricks, Housing), website form, Facebook or Google ad, WhatsApp, a walk-in, a phone call, a referral, a channel partner. Often the same person comes through two channels, or months apart. |
| Who handles it | A manager assigns it, or it goes round-robin. Executives guard "their" customers; disputes come from duplicate entries. |
| First call | Within hours, or the lead goes cold. Half aren't reachable the first time. |
| Qualifying | Budget, location, type, when, and how they'll pay (own funds or loan, loan approved?). Captured in a WhatsApp chat or a notebook, rarely typed into a system. |
| Over weeks | Calls, WhatsApps, shared properties, site visits, family visits, negotiations. The record of *what was said* is what the next conversation needs. |

## 2. Decisions

| Question | Decision | Why |
|---|---|---|
| "Customer" vs "lead": two records? | **One record per person**, identified by mobile number, with a list of enquiries | Two records split the history; one record per person is what salespeople actually think in |
| Same phone comes in again | Detected **while typing** the number; becomes a new enquiry on the existing record. A lost customer is reopened as New. They stay with their owner unless that person has left. | Kills duplicate entries and ownership disputes |
| Who sees what | Executives see only their own customers (others look like they don't exist, including to the assistant). Managers and admins see all. | Matches how commissions and ownership work |
| Assignment | Manual by a manager, "whoever has the fewest open leads" when adding, or **Assign unassigned evenly** in one click. Reassigning moves planned follow-ups too. | Simple and fair; no rules engine to configure |
| Requirement capture | Type it the way they said it ("2-3 BHK near Porur, 70-80 L, home loan, by March"); it becomes structured fields you can correct | Nobody fills ten dropdowns during a call |
| Qualified means | Budget **and** location **and** type are known | Without these, matching (Phase 6) can't work, so it is the honest definition |
| Hot / warm / cold | Set by the salesperson in one click; "Not interested" on a call makes it cold | A judgement call, not a formula |

## 3. Journeys

- **Executive: phone rings.**
  1. **New lead**, then type the number. If they're known, the app says so and switches to "Add as a new enquiry".
  2. Otherwise add a name, the source and what they said, then **Understand**. The requirement is filled in; check it and add the lead.
- **Executive: after a call.** On the customer page, **Log a call**: pick the outcome chip, note what was said, save.
  - The stage moves itself (New → Contacted after a real conversation; → Qualified once budget, location and type are known).
  - The history shows each step, including "via assistant" when the AI did it.
- **Manager: morning.**
  1. Leads shows "Assign 4 unassigned evenly".
  2. Use the *Needs attention* filter.
  3. Open any customer and change the owner from the header.
- **Anyone: before a call.** The assistant's *Summarise*, *What next?* and *Draft a follow-up* use the customer's actual history.

## 4. Screens

- **Leads**: one list ("My leads" for executives).
  - Each row shows the temperature dot, stage, days in stage when it's overdue for that stage, what they want, the next step (or "No next step" in amber), and when you last spoke.
  - Filters: *Needs attention*, stages, owner. The pipeline view arrives in Phase 4.
- **New lead** (drawer): mobile number first, the known-customer check, then a describe box with **Understand** and the requirement editor.
- **Customer page:**
  - header with call and WhatsApp buttons, temperature and owner;
  - **History** with a composer (log a call with outcome chips, WhatsApp, note);
  - **Looking for**, with gaps highlighted ("Still unknown: budget");
  - assistant buttons and enquiries.

## 5. AI

| Tool | Kind | Notes |
|---|---|---|
| `search_leads` | read | Role-scoped; filters for stuck, no follow-up, overdue, temperature, owner |
| `get_lead` | read | Requirement with gaps, and the last 20 timeline items: the basis for summaries and drafts |
| `create_lead` | write | Refuses duplicates and returns the existing customer instead |
| `add_enquiry_to_existing_lead`, `update_lead_requirement`, `set_lead_temperature`, `add_lead_note`, `log_interaction` | write | Marked "via assistant" in history |
| `assign_lead` | **confirm** | Changes ownership, so a person confirms |

Offline mode handles "summarise this customer", "unassigned / hot / new / stuck leads", and reading requirements with rules.

## 6. Open questions

1. **Portal and website enquiries arriving automatically.**
   - Needs each source's webhook or email-parsing format.
   - The `addEnquiry` path is ready for it.
   - Perfox conversations could arrive the same way.
2. **Should a returning customer go back to their old owner** after, say, 6 months of no contact, or to the queue? Currently they stay with the old owner if that person is active.
