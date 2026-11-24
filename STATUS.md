# EstateOS — Status

Last updated: 2026-11-25

**Overall:** Phases 0–8 are complete, committed and tested. Phase 8 brought in your wireframes 8–11 (projects). The AI assistant now runs on real Gemini. Admin and manager now each have their own Today dashboard. The git remote is set; work goes on branch `feat/estate-platform` (main is not pushed).

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

Suggestions:

1. Try real Gemini on a real DTCP layout drawing (chat and describe-a-property are verified).
2. Pick up any of the deferred items below.

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
| 1 | ~~**Gemini API key**~~ ✅ Received | Connected and verified (`9331bd4`). |
| 2 | ~~**Git remote URL**~~ ✅ Received | Set to https://github.com/sivaganesz/real-estate. Work goes on branch `feat/estate-platform`; main is not pushed. |
| 3 | **Confirm discount limits** — executive 1%, manager 5%, above that admin approval | Built into Phase 7 approvals. Admins can change them in Settings, but the defaults should be right. |
| 4 | **Google Maps budget** for nearby places | Maps/nearby places is deferred; it needs a paid Google Maps key before it can be built. |

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

Demo sign-ins (password `demo1234`):

| Role | Email |
|---|---|
| Admin | admin@estate.test |
| Sales manager | manager@estate.test |
| Sales executive | priya@estate.test, arun@estate.test, divya@estate.test |

## Quality checks

| Check | Command | Last result |
|---|---|---|
| API tests (vitest + supertest, in-memory MongoDB) | `pnpm test` | 73 passing |
| End-to-end (Playwright, desktop + phone) | `pnpm e2e` | 13 journeys passing (11 on desktop, 2 also on phone) |
| Typecheck | `pnpm typecheck` | Clean |
| Web build | `pnpm build` | Clean |

`pnpm e2e` starts its own API on port 4190 (fresh in-memory database, offline AI) and web on 5190, so it doesn't touch your dev server.
