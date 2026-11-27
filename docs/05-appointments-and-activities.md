# 05 · Appointments and activities

**Status:** built · **Commit:** Phase 5 · **Users:** everyone. Executives run their day from here; managers watch who is behind.

## 1. What happens in practice

A salesperson's day is calls and WhatsApps in the morning, site visits from late morning (weekends are the busiest), and meetings in the evening. Things go wrong in predictable ways:

- **Follow-ups are forgotten.** The promise "I'll call you Thursday" lives in someone's head.
- **Visits clash**, or the customer doesn't turn up.
- **Visit feedback is lost.** "Liked the clubhouse, worried about possession" is the most valuable fact in the sale, and it's rarely written down.
- **Leads go cold silently** because nothing was planned after the last conversation.

## 2. Decisions

| Question | Decision |
|---|---|
| Separate modules for appointments, follow-ups, tasks and notes? | **No: one "activity"** with a type (call, meeting, site visit, WhatsApp, email, note, task) and a state (planned, done, missed, cancelled). One customer timeline, one calendar, one "what's next". |
| What is a lead's "next step"? | Always its **earliest planned activity**, kept on the lead, so lists, the board and Today can show it without searching. |
| How do we stop leads going cold? | **Finishing an activity asks what's next**, with one-tap time picks. If nothing is planned afterwards, the app asks again ("A lead without a next step usually goes cold"). Leads with no next step are listed on Today. |
| Clashes | Visits and meetings block time; two at once for the same person is flagged with who it clashes with, and can be overridden. Calls don't block. |
| Visit feedback | Interest (very interested … not interested), what they liked, concerns, and per-property 👍/👎. It updates the customer's **shortlist** (used by matching in Phase 6) and their temperature. |
| No-shows | "They didn't come" marks it missed, kept in history. |
| Reminders | In-app: a bell with what's due in the next hour, and a toast 15 minutes before. SMS and WhatsApp reminders need a provider (deferred, as in the PRD). |
| Time zone | All times are Indian time, wherever the server runs. |
| Slot capacity rules (old PRD) | **Dropped.** They were designed for customers booking themselves through the AI agent. For staff-planned visits, clash detection is enough. If customer self-booking returns, capacity comes back with it. |

## 3. Screens

- **Today** (home for everyone):
  - **executive**: a one-line brief, then Overdue (red), Today (time-ordered, each with call/WhatsApp, **Done**, **Reschedule**, **Cancel**), New leads to call, and No next step planned;
  - **manager**: the same for the whole team, plus a **Team** table (open, overdue, no next step, stuck, booked per person) and an "unassigned leads" card;
  - **Plan my day / Brief me** asks the assistant.
- **Today** greets by first name ("Good morning, Priya") through `greeting()` in `components/Bento.tsx`.
- **Calendar** (`pages/Calendar.tsx`):
  - tiles: Today (left to do, done), Overdue (earlier days plus missed today), Left this week, Site visits;
  - a **Today** card: overdue items in a rose box, then today's items on a time rail with a red "Now" line; done items fade;
  - the week grid in a card, each item coloured by kind (calls and messages, site visits, meetings, tasks). Managers filter by person;
  - on phones: pick a day and see its plan; the Today card shows only the overdue part, so nothing appears twice.
- **Customer page:** a **Plan next** tab in the composer (type; quick times like "Tomorrow 11 am" or "Saturday 11 am"; properties for a site visit; clash warning). Planned items in the history have Done / Reschedule / Cancel.
- **Finish dialog:** call outcome chips, or visit interest with liked, concerns and per-property feedback, plus notes and the next step.

## 4. AI

| Tool | Kind |
|---|---|
| `schedule_activity` ("schedule a site visit for Lakshmi on Saturday at 11 with the two Palm Grove villas") | write |
| `reschedule_activity`, `cancel_activity`, `complete_activity` (with visit feedback and next step) | write |
| `agenda` (overdue, planned, new leads to call, open leads without a next step) | read |
| `overdue_follow_ups_by_person` (managers) | read |

Offline, these work by rules:

- "Schedule a call with Vignesh tomorrow at 11am", with times like "sat 4:30 pm", "at 4" (= 4 pm), "on 3 Dec morning";
- "What's on my plate today?";
- "Show leads without follow-ups";
- "Which executives have overdue follow-ups?".

## 5. Rules

- Executives see and change only their own customers' activities. Managers see all and can plan for someone else.
- Can't plan in the past, or for a customer closed as lost (reopen first).
- Scheduling a site visit for a qualified customer moves them to *Site visit*, and the visit's properties go on their shortlist.
- Reassigning a customer moves their planned activities to the new owner.
- Closing a customer as lost cancels what was planned.
