# 00 · Product foundation

**Status:** built · **Commit:** Phase 0

This is the base every module sits on: who uses the product, how they move through it, how the AI fits, and what was kept or dropped from the earlier build.

## 1. What I reviewed

From `E:\SKILLMINE\real-estate` (branch `spec-system-wireframe`):

- PRD v2.0 and TRD (Nov 2026);
- *Properties without forms* proposal (17 and 20 Nov);
- the CTO revamp plan (23 Nov);
- the clickable wireframe (`spec-system-wireframe/`) and the earlier `before-sample/wireframes`.

## 2. Kept, changed, dropped

| From the earlier build | Decision | Why |
|---|---|---|
| Describe a property to the AI, and a short form fills itself | **Kept**, central to Add property | It's the biggest time saver and the CTO approved it |
| Only two key details per type are required to publish | **Kept** | Stops 30-field forms; everything else becomes a gentle to-do |
| Bulk import that reads *any* sheet, with a Check screen before saving | **Kept** | Real owners' sheets never match a template |
| Saved column formats per sender | **Kept** | Second import from the same sender needs no AI and no mapping |
| "Salespeople don't load properties" (CTO, 23 Nov) | **Kept** | Executives view, share and match; managers and admins load |
| Role home pages: *My day* for executives, *Team* for managers | **Kept** | The CTO's main point: organise by daily journey, not modules |
| Matching at the top of leads and properties | **Kept** | Matching is the reason a salesperson opens a property |
| One `status` field mixing publish state and sale state (Draft / Published / Booked / Sold / Archived) | **Changed** into two fields: **listing** (draft → review → live → archived) and **availability** (available → held → booked → sold) | A unit can be live *and* on hold during negotiation; the old model couldn't say that |
| Property "groups" with admin-defined fields and a field builder | **Dropped** for now, replaced by fixed types with known key details plus free-form *extra details* | The field builder was the most complex screen and nobody needs it on day 1; extras keep anything unusual |
| Leads, conversations and calls read live from Perfox | **Changed**: leads live in our database | The new brief needs a pipeline, history, assignment and matching; that can't sit on a read-only API. A Perfox sync can feed leads in later |
| Appointments as a separate module with slot capacity settings | **Changed**: calls, meetings, site visits and follow-ups are all **activities** on a lead | One timeline per customer, one "what's next" per lead, one calendar |
| Separate pipeline page | **Changed**: the pipeline is a board view of Leads | Fewer pages, same data |
| Nearby places from Google, route checks | **Deferred** | Needs a Google Maps account and budget decision (open in the old proposal) |
| English and Tamil switch | **Deferred** | Not in this brief; all screen text is plain strings, so moving them to language files later is mechanical |
| Public website | **Deferred** | The Share page covers what a buyer sees for now |

## 3. Who uses it

| Role | Their day | Home | Menu |
|---|---|---|---|
| **Sales executive** | Calls and WhatsApps leads, hosts site visits, sends property options, pushes interested buyers to book | **Today**: overdue and today's follow-ups and visits, new leads, best matches | Today · Leads · Properties · Calendar · Deals |
| **Sales manager** | Assigns leads, watches the pipeline, unblocks stuck deals, approves prices, loads inventory | **Today** with a team strip: unassigned leads, overdue follow-ups per person, approvals waiting | the above + Team |
| **Admin** | Sets up the company, users and rules; sees everything | Same as manager | the above + Settings |

There is one version of each screen. Roles change what data you see (an executive sees their own leads) and which buttons appear, not the layout.

## 4. How the AI fits

The assistant is a panel on every screen (button in the top bar, **Ctrl/⌘ K**, or type into the top search box).

- **It knows where you are.** Each screen tells it the page and the record you're looking at, so "find matches for her" works on a lead page.
- **It only uses your data, through your role.** It calls the same services as the screens, and it only sees the tools your role allows. An executive's assistant has no tool to publish a property.
- **It shows its sources.** Records it relied on appear as links under each answer.
- **Three kinds of action:**
  - *read*: search, summarise, match, report;
  - *write*: safe, reversible changes done straight away (add a note, schedule a follow-up, create a **draft** property), each marked as done by the AI in the audit log;
  - *confirm*: consequential changes (publish, reassign, approve a discount, confirm a booking). These become a proposal card with **Confirm** and **Not now**. Nothing happens until the person confirms.
- **Offline mode.** Without an AI key the same panel understands a fixed set of requests ("2 BHK under 70 L in Porur", "leads without follow-ups") by pattern-matching and calling the same tools. It says plainly that it's offline.

Model: Google Gemini through the official `@google/genai` SDK. The key comes from `GEMINI_API_KEY`; the model from `GEMINI_MODEL`, default `gemini-2.5-flash` (configurable because Google renames Flash models often). Chat uses Gemini function calling, with the tool list generated from the same role-filtered tool registry. Structured reads (brochures and text, unknown sheet headings, requirements) use Gemini's JSON mode, and every answer is checked again on our side; if Gemini fails or returns something unusable, typed text, PDFs and requirements fall back to the rule-based readers.

## 5. Architecture

- **Monorepo:** `packages/shared` holds the domain rules (roles and permissions, property types and key details, pipeline stages, Indian money and area parsing). `apps/api` is Express 5 + MongoDB (Mongoose). `apps/web` is React + Vite + Tailwind.
- **Permissions:** one table (`packages/shared/src/roles.ts`) used by the API routes, the UI and the AI tool list.
- **Audit:** every change records who, when, what, and whether the AI did it.
- **Zero-setup dev:** without `MONGODB_URI`, the API starts an embedded MongoDB and seeds demo data.

## 6. Assumptions to confirm

1. One company per installation (no multi-tenant yet).
2. Executives see only their own leads; managers see all leads.
3. India only: INR, lakh/crore, sq.ft/cent/ground/acre.
