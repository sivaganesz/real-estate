# EstateOS — Status

Last updated: 2026-11-23

**Overall:** All planned phases are complete, committed and tested. Waiting on two things from you: the Gemini API key and the git remote to push to.

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
| Gemini switch | Assistant uses Google Gemini | ✅ Done (code + tests) | `aad82e1` | [00-foundation.md](docs/00-foundation.md) |
| Inventory insights | Most-enquired properties, slow-moving projects; counters pre-approve | ✅ Done | `1e882d0` | — |
| End-to-end tests | Playwright journeys for each role, desktop and phone | ✅ Done | `70c43a1` | — |
| Docs refresh | README, STATUS and docs pass | ✅ Done | — | — |

## Done since last update

**Inventory insights** (`1e882d0`)

- **Property interest ranking:** enquiries, shares, visits/likes and deals per property.
- **Project sales pace:** units sold or booked in the last 90 days and months of stock left; slow movers are flagged on the Projects cards.
- Assistant tools `property_interest` and `project_movement`. Offline, it answers "Which properties receive the most enquiries?" and "Which projects have low inventory movement?".

**Counters pre-approve** (`1e882d0`)

- A manager's counter now counts as approval up to that price. An executive agreeing at the countered price is agreed at once, with no second approval.

**End-to-end tests** (`70c43a1`)

- 11 Playwright journeys, run on desktop and phone:
  - Executive's Today, and working a new lead
  - Matches with reasons, and WhatsApp share of two properties
  - Executives can't open other executives' customers
  - Manager adds a property by describing it, and publishes
  - Manager imports `docs/samples/owner-sheet-sri-balaji.xlsx` through the Check screen
  - Manager approves a discount
  - A stage move without evidence asks for it
  - Assistant answers business questions offline
  - Buyer share page hides internal notes
- The offline reader now recognises a locality it hasn't seen before ("in Kodambakkam, Chennai") and flags it for a spelling check.

**Assistant on Google Gemini** (`aad82e1`): uses `GEMINI_API_KEY` in `apps/api/.env`, model from `GEMINI_MODEL` (default `gemini-2.5-flash`). Without a key it runs in the labelled offline mode. Tested with a scripted fake Gemini client only; nothing has called real Gemini yet.

## Next up

Suggestions once the key arrives:

1. Try real Gemini on the sample brochure (describe-a-property) and in the assistant chat.
2. Push to your git remote.
3. Pick up any of the deferred items below.

**Deferred by design** (documented in `docs/`, not planned for this build):

- Google Maps and nearby places
- Tamil/English language switch
- Public website
- Sending WhatsApp/SMS messages and reminders
- Auto-import of leads from portals and the website

## Decisions needed from you

| # | Decision | Why it matters |
|---|---|---|
| 1 | **Gemini API key** | Needed for the live AI assistant. Until then it runs in offline mode. |
| 2 | **Git remote URL** | There is no remote yet; the code can't be pushed until you share the repo link. |
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

Demo sign-ins (password `demo1234`):

| Role | Email |
|---|---|
| Admin | admin@estate.test |
| Sales manager | manager@estate.test |
| Sales executive | priya@estate.test, arun@estate.test, divya@estate.test |

## Quality checks

| Check | Command | Last result |
|---|---|---|
| API tests (vitest + supertest, in-memory MongoDB) | `pnpm test` | 65 passing |
| End-to-end (Playwright, desktop + phone) | `pnpm e2e` | 11 journeys passing |
| Typecheck | `pnpm typecheck` | Clean |
| Web build | `pnpm build` | Clean |

`pnpm e2e` starts its own API on port 4190 (fresh in-memory database, offline AI) and web on 5190, so it doesn't touch your dev server.
