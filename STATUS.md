# EstateOS — Status

Last updated: 2026-11-27

**Overall:** Phases 0–8 are complete, committed and tested. Phase 8 brought in your wireframes 8–11 (projects). The AI assistant now runs on real Gemini. Admin and manager now each have their own Today dashboard. The git remote is set; work goes on branch `feat/estate-platform` (main is not pushed). The demo is deployed: web on Vercel, API on Render (free plan, data resets to the demo data on restart). Since 25 Nov the property page, Properties list, Leads list, lead page and Pipeline were redesigned, leads got a 0–100 score, and demo accounts can switch role.

## Phases

| Phase | Scope | Status | Commit | Doc |
|---|---|---|---|---|
| 0 · Foundation | Monorepo, roles, sign-in, audit log, AI assistant core; role home pages (*My day* for executives, *Team* for managers) | ✅ Done | `77ca5be` | [00-foundation.md](docs/00-foundation.md) |
| 1 · Property management | Projects and units, standalone listings; describe a property and the AI fills a short form; buyer share links | ✅ Done | `116185d` | [01-property-management.md](docs/01-property-management.md) |
| 2 · Bulk import | Import any sheet, saved column formats per sender, a Check screen before anything is saved | ✅ Done | `ba1af69` | [02-bulk-import.md](docs/02-bulk-import.md) |
| 3 · Customers and leads | One record per person (by mobile), duplicate detection while typing, requirements typed in plain words, one timeline | ✅ Done | `fb63ba7` | [03-customers-and-leads.md](docs/03-customers-and-leads.md) |
| 4 · Sales pipeline | Stages with checked entry rules and stuck-after limits, a board, lost reasons, where leads leak | ✅ Done | `784af33` | [04-sales-pipeline.md](docs/04-sales-pipeline.md) |
| 5 · Appointments and activities | One "activity" type for calls, visits, meetings, tasks; next step on every lead; clashes, visit feedback, in-app reminders | ✅ Done | `84a7334` | [05-appointments-and-activities.md](docs/05-appointments-and-activities.md) |
| 6 · Property matching | Fit labels with reasons (no black-box score), both directions (customer → properties, property → customers), one tap to send | ✅ Done | `4a05a72` | [06-property-matching.md](docs/06-property-matching.md) |
| 7 · Negotiations and bookings | Deals, offers, discount limits with approvals, holds, booking and confirmation, payment plan, registration, cancellation | ✅ Done | `51cd35b` | [07-negotiations-and-bookings.md](docs/07-negotiations-and-bookings.md) |
| Gemini switch | Assistant uses Google Gemini | ✅ Done, verified with a real key | `aad82e1`, `9331bd4` | [00-foundation.md](docs/00-foundation.md) |
| Inventory insights | Most-enquired properties, slow-moving projects; counters pre-approve | ✅ Done | `1e882d0` | — |
| End-to-end tests | Playwright journeys for each role, desktop and phone | ✅ Done | `70c43a1` | — |
| Docs refresh | README, STATUS and docs pass | ✅ Done | — | — |
| 8 · Projects v2 | From your wireframes 8–11: layout described once (towers or blocks of plots), master plan, draft/publish with completion %, protected units, deals started from the layout | ✅ Done | `a885a80` | [08-projects-v2.md](docs/08-projects-v2.md) |

## Done since last update

**Property page** (`99df1d2`, `3da0739`, `98f51b8`, `04eb266`)

- Header with key facts per type, five tabs, an adaptive photo collage with a viewer, and a details card with the description (clamped, Expand) and collapsible type sections.
- Land listed in acres, cents or grounds shows its rate in that unit (₹34 L/acre).
- **Explore the neighbourhood:** places by commute, schools, hospitals and shopping, with a distance sketch, Team and Customer views, "route checked" and "OK to advertise". *Find more places* looks them up on OpenStreetMap (Overpass, `OVERPASS_URL`); new places start unchecked. The buyer share page lists only advertised places.

**Leads list** (`9e9a96d`, `36a3e8a`)

- Tiles: Active leads (of the total, with the active / booked / lost split), Overdue, Due today, Hot (score 80+), New this week.
- Tabs: Active, Hot leads, Investors, HNI, Closed / Lost. Open leads grouped by when the follow-up is due.
- Rows show what and where, budget and buyer type; Call, WhatsApp and Done on hover.
- A preview panel on wide screens: score ring and band, timeline, buyer type, stage, what they want with the agent, next step, best match (expand to the top 3 with scores), last contact, and Call, WhatsApp, Done or plan the next step.
- **Lead score (0–100)** from requirement 30, timeline 20, payment 15, stage 25 and interest 10, less 5 each for an overdue follow-up or a stuck stage (`packages/shared/src/leadScore.ts`). **Buyer type:** Potential HNI (budget ₹2 Cr+), Investor, Qualified buyer, General lead.
- New requirement field **Buying for** (own use or investment): editor, lead page, AI and rule-based reading.
- Seven more demo leads (`LD-0027`–`LD-0033`) across stages, agents and buyer types, with follow-ups.

**Lead page** (`24e4ddc`)

- Left: a sales stage card with arrow steps (click to move, same checks), a Next step card (Reschedule and Done, or Plan next step), and tabs for Activity, Matches and Qualification.
- Right: a profile card with the agent, phone, Property fit / Ready to buy / HNI dials, Looking for, Money, Negotiating (offer, counter, asking) and Site visits.
- Feature modules plug in through new slots (`next`, `tabs`); shared helpers are in `components/leadBits.tsx`.

**Pipeline** (`1c0ede9`)

- Top row: status tiles (open leads, win rate, weakest step, needs attention, the last two act on the board), Booked (agreed-price total, build-up chart, recent bookings as avatars) and Lost (budgets lost, where leads were lost by stage).
- *How leads flow*: a 90-day band with conversion per step and rose markers for leads lost at each stage.
- Focus chips over five stage columns; cards with score, buyer type, next step and agent, and a *Move to* menu for keyboard and phones. While dragging, a drop bar offers *Book it* and *Close as lost*.

**Properties list** (`080b4f7`)

- All properties / Projects switch on the search row; one shared `SearchBar`; filters, sort and view beside the status tabs.
- Table: *Price* column; area with beds and toilets (icons and counts) for homes and length × width for plots. *Import* is now *Bulk import*.

**Switch role and greeting** (`2288b91`)

- *Switch role* in the profile menu (executive avatar menu, sidebar, a Role tab on phones) between the demo accounts; it opens that account's Today with its permissions. Demo accounts only, on outside production, in production only with `ROLE_SWITCH=1`; every switch is audited.
- Today greets by first name: "Good morning, Priya.", with the day and date above.

**Scrollbars** (`a50f2d1`): thin, light grey across the app.

**Fixes (27 Nov)**

- **Assistant page crash:** newer Chrome returns a Promise from a smooth `scrollTo`; one effect returned it, so React crashed the page when an answer arrived. Effects now never return a value. The e2e journey checks the answer's lead links instead of a lead that changes with the date.
- A seeded meeting moved to 9:30 so it can't clash with Lakshmi's Saturday visit on a Friday.
- Tests: 93 API, 18 e2e journeys pass.


**Demo polish** (`ce40bbd`)

- Budget, localities and must-haves type normally (e.g. 72.5, "Porur, Adyar").
- Save buttons can't fire twice (deal actions, add property, project wizard, plan next), and "Send to customer" prepares its message once.
- Today's demo meetings always fall today, whenever the data is created.
- **Properties** shows standalone listings by default; project units are under Projects or the "Include project units" chip, 24 at a time with "Show more".
- **Settings** lists permissions in plain words, grouped by area.
- The property page's Edit button is full width when alone.

**Review fixes** (`0c34950`)

- An in-app confirm dialog replaces the browser pop-ups.
- Pages load lazily and libraries get their own file: main JS went from 635 kB to 264 kB.
- The assistant sends each question only once.
- Imports are claimed before they run, so a double click can't import twice; there's a new API test for it.
- e2e runs against the built app (vite preview, `dist-e2e`).
- A project-only skill `.claude/skills/frontend-review` (adapted from Pandi2352/frontend-skills), plus `AGENTS.md` with the project's frontend decisions and a one-line `CLAUDE.md`.

**AI Assistant page** (`cf5d12a`): `/assistant` with a greeting, quick actions per role, a + menu, voice, and past chats per user in the browser; it shares its conversation with the side panel.

**Deployed** (`0e6d478`, `3fd4760`, `4b478c6`)

- **Web on Vercel:** `apps/web/vercel.json` rewrites `/api` and `/uploads` to the Render API and serves index.html for every route. Vercel Root Directory is `apps/web`.
- **API on Render:** `render.yaml` Blueprint, service `estateos-api`, https://estateos-api-iy6k.onrender.com. It runs its own built-in MongoDB, so no database account is needed, with a 0.25 GB WiredTiger cache to fit the free plan's 512 MB.
- **Free-plan limits:** the service sleeps after 15 minutes idle, and data plus uploaded files reset to the demo data on every restart or redeploy. Setting `MONGODB_URI` (e.g. Atlas) keeps data permanently.
- **Verified on Render:** health ok, demo login works, assistant mode is `gemini` (gemini-2.5-flash).

**Clearer customer page, leads list, calendar and deals** (`aed4da1`)

- **Customer page:** a header with four facts (next step, last spoke, days in stage, properties sent) and the stage steps; compact property matches showing 3 with "show more"; one About panel (looking for, contact, enquiries); activity counts in History.
- **Leads list:** count tiles that filter (needs attention, hot, no next step, new this week) and richer rows.
- **Calendar:** a Monday–Sunday week grid coloured by kind, a "New appointment" dialog, and add-on-a-day shortcuts; on phones, a day strip and list.
- **Deals:** explained by five steps (agree the price, approval, booking amount, payments, registered), a "Needs your action" list, and a plain "Your move" next step on every deal and in the deal drawer.
- **Demo data:** a fuller week of meetings at office hours, including Priya's.
- Tests: 73 API, 15 e2e.

**Executive Today** (`2b31051`): no gaps; follow-ups scroll; Spotlight and the property match rotate through the top 3 with arrows and dots.

**Role dashboards** (`87be5d3`)

- **Admin Today** shows the whole business: booked this month with negotiating / due in 30 days / stock for sale, decisions waiting (discounts above the manager's limit first), people active this week, inventory by state with drafts and project selling pace, funnel with best lead sources, sales team, recent imports, and the latest changes (including ones the assistant made).
- **Manager Today** shows the team: team follow-ups done today with who needs a hand and unassigned leads, decisions, booked this month, what's slipping (overdue and no next step, with owner), funnel, team health bars, and projects selling pace.
- New admin-only API `GET /api/insights/overview`. Shared tiles live in `apps/web/src/components/Bento.tsx`.
- The old Today panels and `slots-today.ts` were removed.
- Tests: 73 API, 13 e2e journeys pass.

**Gemini assistant connected** (`9331bd4`)

- **Verified with a real key:** assistant chat with tool calls and property extraction both returned mode `"gemini"`.
- **Fixes:** the `@google/genai` client uses `apiVersion: 'v1beta'` (v1 rejected function calling with this key type); the server logs the real Gemini error as `[gemini] status: message`; a dev restart reuses an embedded MongoDB already running on `127.0.0.1:27027` instead of crashing on the file lock.

**Projects v2, from your wireframes 8–11** (`a885a80`, details in [08-projects-v2.md](docs/08-projects-v2.md))

- **Layout described once:** towers with a per-floor plan of flat types, or blocks of plots (width × length), or rows of villas. Every unit, its number (A503, A-07), facing and price follow from it.
- **Pricing:** base ₹/sq.ft, floor rise, corner premium. Booked and sold units keep their price.
- **Protected units:** a layout change that would remove a held, booked, sold or negotiating unit is refused, and the units are listed.
- **Draft / publish** with a completion % and next steps. Executives only see published projects.
- **Approvals** (RERA, DTCP/CMDA, bank, OC/CC) uploaded once on the project, shown on every unit.
- **Screens:** Projects tab with totals and inventory bars; 3-step wizard with live preview; project page with filters, Grid and an illustrated Master plan (site plan or tower elevation).
- **One change from the wireframe:** units are not marked Booked/Sold by a click. Clicking an available unit offers **Start a deal for a customer**, so every booking still has its price approval, booking amount and payment plan. "Sold outside the app" stays on the unit's page, with a reason.
- **AI** reads a DTCP/CMDA layout drawing into blocks and plot sizes (Gemini; offline, it asks for the key).

**Earlier** (in the table above): inventory insights and counters that pre-approve (`1e882d0`), Playwright journeys (`70c43a1`), assistant on Gemini (`aad82e1`, `GEMINI_API_KEY` in `apps/api/.env`; now verified with a real key, see above).

## Next up

- **Demo to the team**, for UI approval. Checklist:
  - don't push on demo day (it redeploys Render and resets the data);
  - wake the site about 5 minutes before;
  - try one AI quick action;
  - use desktop Chrome and show Admin, then Manager, then Executive.
- **After approval, from the frontend review** (about 8–10 hours in batches):
  - High: dialog focus and Esc, and the project wizard's retry guard.
  - Medium: error states with retry, labels and screen-reader support, a phone "More" menu, keeping views fresh after changes, and shared pieces for duplicated code.
  - Low: cleanup.

**Projects, not built yet** (doc 08 §7): plot sizes edited one by one (only via the layout map today), a site plan drawn from the actual drawing, more than one flat plan per tower (e.g. penthouse floors), project photos and brochure.

**Deferred by design** (documented in `docs/`, not planned for this build):

- Google Maps and nearby places
- Tamil/English language switch
- Public website
- Sending WhatsApp/SMS messages and reminders
- Auto-import of leads from portals and the website

## Decisions needed from you

| # | Decision | Why it matters |
|---|---|---|
| 1 | **Confirm discount limits** — executive 1%, manager 5%, above that admin approval | Built into Phase 7 approvals. Admins can change them in Settings, but the defaults should be right. |
| 2 | **Google Maps budget** for nearby places | Maps/nearby places is deferred; it needs a paid Google Maps key before it can be built. |
| 3 | **Keep data permanently?** MongoDB Atlas plus cloud file storage | On Render's free plan, data and uploaded files reset to the demo data on every restart or redeploy. |
| 4 | **Remove the one-click demo sign-in** before real use | Anyone with the link can sign in as a demo user while it is there. |

## How to run

Needs Node 22+ and pnpm.

```bash
pnpm install                     # also downloads an embedded MongoDB the first time
cp .env.example apps/api/.env    # optional: add the AI key here
pnpm dev                         # API on :4000, web on http://localhost:5173
```

- No database setup: without `MONGODB_URI` the API starts an embedded MongoDB (data in `.data/mongo`) and seeds demo data on first run.
- `pnpm seed` resets the database to the demo data.
- **Gemini key:** put it in `apps/api/.env` as `GEMINI_API_KEY` (git-ignored, never committed). Node's `--env-file` does not override a variable that is already set, even to empty, so start the server from a fresh terminal. Run one dev server at a time: an old server holding port 4000 keeps answering in offline mode.

**Deploy:** Vercel with Root Directory `apps/web`; Render Blueprint from `render.yaml`, with `GEMINI_API_KEY` set in Render.

Demo sign-ins (password `demo1234`):

| Role | Email |
|---|---|
| Admin | admin@estate.test |
| Sales manager | manager@estate.test |
| Sales executive | priya@estate.test, arun@estate.test, divya@estate.test |

## Quality checks

| Check | Command | Last result |
|---|---|---|
| API tests (vitest + supertest, in-memory MongoDB) | `pnpm test` | 74 passing |
| End-to-end (Playwright, desktop + phone) | `pnpm e2e` | 16 journeys passing |
| Typecheck | `pnpm typecheck` | Clean |
| Web build | `pnpm build` | Clean, no size warning |
| Frontend review scanner | `node .claude/skills/frontend-review/scripts/scan.mjs apps/web` | 0 findings |

`pnpm e2e` starts its own API on port 4190 (fresh in-memory database, offline AI) and web on 5190, so it doesn't touch your dev server.
