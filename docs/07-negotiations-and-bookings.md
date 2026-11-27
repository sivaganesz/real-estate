# 07 · Negotiations and bookings

**Status:** built · **Commit:** `51cd35b` (counter rule `1e882d0`) · **Users:** executives negotiate and send bookings; managers approve discounts, confirm bookings and record payments; admins approve big discounts and set the limits.

## 1. What happens in practice

In Indian residential sales the price is haggled **per unit**, not per project. Two flats in the same tower differ by floor rise, facing, corner position and view, and the customer knows it.

- **Haggling is in small steps.** The customer quotes a number, the executive "checks with the manager", and it goes back and forth. Often the gap closes with something other than money: a free car park, waived club membership, a modular kitchen.
- **Discount authority is informal.** Everyone knows the executive can give a little and the manager more, but nobody writes down who agreed what, so the same flat is quoted three different prices.
- **The token or booking amount** closes the deal: usually 5–10% of the price, paid by cheque, NEFT/RTGS, UPI or demand draft. Under RERA a builder can't take more than 10% before a registered agreement for sale. Until it's in the bank, nothing is booked.
- **Holds are verbal.** "Keep it for me till Saturday" is promised to one buyer while another executive shows the same flat to someone else.
- **Agreement for sale** follows within weeks, with the next instalment.
- **Home loans pay in stages.** The bank disburses as construction milestones are reached, so most of the money arrives months after booking, and someone has to chase each instalment.
- **Registration** of the sale deed at the sub-registrar office (with stamp duty and registration fee) is when the unit is truly sold. Handover comes with or after it.
- **Cancellations happen**: loan rejected, family objection, a cheaper flat elsewhere. The unit has to go back on sale quickly, and the builder usually keeps a cancellation charge and refunds the rest weeks later.

## 2. Decisions

| Question | Decision |
|---|---|
| What is a "deal"? | **One customer on one unit**, from the first offer through booking and payments to registration. A customer can negotiate on two units at once (two deals); the same customer and unit never have two open deals. Starting again returns the existing one. |
| Offers | Every offer is kept: who made it (customer or us), the amount, a note ("free car park instead of discount"), who recorded it and when. Amounts far from the list price (below 50% or above 150%) are refused as likely typos. |
| Who may agree how much discount? | **Executive up to 1%, manager up to 5%, above that an admin.** Within your own limit the price is agreed at once. Above it, it goes to a manager, or straight to an admin if it's beyond the manager limit. |
| Can the limits change? | Yes. An admin sets them in **Settings** (executive 0–10%, manager 0–25%; the executive limit can't exceed the manager's). |
| Approving | Approve, reject, or **counter** with a price you can approve (recorded as our offer, and the deal goes back to negotiating). **A counter counts as approval down to that price**: if the executive then agrees at the countered price, it's agreed at once, with no second approval. **Nobody approves their own request.** Admins never need to: their prices are agreed at once. While a price waits for approval, no other price can be proposed. |
| Holds | **Hold the unit** for the customer, default **3 days** (admin can change it). A held unit can't be negotiated by another customer. Holds **release themselves** when they expire. |
| Booking | The executive records the booking amount received (amount, cheque/NEFT/RTGS/UPI/DD/cash, reference, date) and **sends it for confirmation**. A **manager confirms**. Only a deal with an agreed price can be booked. |
| What confirming does | All at once: the unit is **booked**; the customer moves to **Booked**; a **payment plan** is created; **other open negotiations on that unit are closed** ("Unit booked by another customer"). If someone else booked it first, confirmation is refused. |
| Payment plan | Four instalments: booking amount (paid), agreement for sale (+1 month), loan disbursement / construction milestones (+4 months), registration and handover (+7 months). The balance after the booking amount is split 20 : 60 : 10, and the last line absorbs rounding, so **the plan always adds up to the agreed price**. |
| Payments received | A manager marks each instalment received, with date and reference. Unpaid instalments past their date show as **overdue**. |
| Registration | **Sale registered** marks the unit **sold**. It's allowed with instalments still due (common when the last loan tranche is pending); the history notes how many. |
| Cancellation | Before booking, anyone working the deal can drop it; a booking needs a manager. Cancelling **releases the unit** (if it was booked, or held for this customer). Then either **keep negotiating** with the customer, or **close them as lost** (only if they have no other open deal). A reason is required. |
| Pipeline link | **Dragging a lead to Negotiation opens a deal** on the property they're negotiating on (the liked one on their shortlist, or the one picked). Moving to *Booked* by hand is blocked: bookings are confirmed from the deal, with the money. |

**Deal statuses:** Negotiating → Waiting for approval → Price approved → Booked → Registered, or Cancelled.

## 3. Journeys

- **Executive**
  1. On the customer's page, **Deals → + Negotiate**, pick a property from their shortlist, optionally type their first offer. The customer moves to *Negotiation*.
  2. In the deal drawer, record **They offered / We offered** as the haggling goes on. **Hold the unit** if they need a few days.
  3. **Agree at this price**: within 1% it's agreed; above it the drawer says it's gone for approval.
  4. Once agreed, record the booking amount and **Send for confirmation**.
  5. If the customer backs out: **Drop this negotiation**, with a reason, and keep working with them or close them as lost.
- **Manager**
  1. Today shows **"N waiting for you"**: price approvals and bookings to confirm. The Deals page lists them.
  2. Open one: **Approve**, **Reject**, or **Counter** at a price you can live with, with a note for the team.
  3. For a booking, check the amount and reference against the bank, then **Confirm booking**.
  4. As money arrives, mark instalments **Received**. Watch **Overdue payments** on the Deals page.
  5. When the sale deed is registered, press **Sale registered**.
  6. If a booking falls through (loan rejected), **Cancel this booking**; the unit goes back on sale.
- **Admin:** approves discounts above the manager limit, and changes the limits and hold length in Settings.

## 4. Screens

- **Deals page** (`pages/Deals.tsx`):
  - **Tiles:** Negotiating, Waiting for approval, Booked this month, Payments due in 30 days. A tile filters the list to its step.
  - **Needs your action:** price approvals at your level, bookings to confirm and overdue payments.
  - **Step tabs:** All, then one per step (Price, Approval, Booking, Payments, Registered), and Dropped when there are any.
  - Rows with the step track; on wide screens a **preview panel** with the price track, payments, the next step and *Open deal*. Managers see whose customer each deal is.
- **Deal drawer:** the property and customer; a **price ladder** (list price, every offer with % off, the agreed price and who agreed it); then only the next sensible step: negotiate, decide, book, payments, register. Cancel sits at the bottom.
- **Lead page → Deals** (a profile-card section, `features/deals.tsx`): their deals with the price track, and **+ Negotiate**.
- **Today:** a **"waiting for you"** card for managers and admins, linking to Deals.
- **Settings → Price approvals and holds** (admin): drawn as a ladder (green: the executive agrees; amber: a manager approves; violet: an admin approves), with the executive limit, manager limit and hold days below, and *Save rules* / *Undo changes*.

## 5. AI

The assistant runs on **Google Gemini** (see [00-foundation.md](00-foundation.md)).

| Tool | Kind |
|---|---|
| `list_deals` | read; role-scoped, filter by status |
| `deals_overview` (money summary, payments due in 30 days with overdue flagged, idle deals, what's waiting on you) | read |
| `start_negotiation` ("start a negotiation for Usha on the Saravanampatti flat, she offered 45 lakhs") | write |
| `record_offer` | write |
| `propose_price` | write; agreed at once within the user's limit, otherwise sent for approval, and the assistant says which |
| `decide_price_approval` (approve, reject, counter) | confirm |
| `confirm_booking` | confirm; asks for the amount and mode if no booking was sent |
| `cancel_deal` | confirm |

Offline, these work by rules:

- "What approvals are waiting for me?";
- "Which payments are due?" (next 30 days, overdue flagged).

## 6. Deliberately left out

- **Online payment collection** (payment links, gateway). Out of scope in the PRD; payments are recorded, not collected.
- **GST and stamp duty** are not computed. Both vary by state and by property (under construction or ready), and get wrong quickly.
- **Cost sheet.** Car park, club membership, maintenance deposit and floor rise are not separate lines; the deal has one price. Freebies go in the offer note.
- **Refund amounts** on cancellation (cancellation charge kept, amount refunded, refund date) are not tracked; only the reason is.
- **Joint bookings.** One customer per deal. Spouse or parent co-applicants (common for home loans) are not recorded.
- **Payment plan per project.** Every booking gets the same four-step plan. Builders with their own milestone schedules will want to set it per project.
