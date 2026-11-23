# EstateOS — Status

Last updated: 2026-11-23

**Overall:** Phases 0–6 built and committed. Phase 7 (negotiations and bookings) is in progress: backend done and tested, web UI being built now. The AI assistant now uses Google Gemini at the owner's request (code and tests done; waiting for the key).

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
| 7 · Negotiations and bookings | Deals, price proposals with discount limits, holds, booking and confirmation, payment plan, registration, cancellation | 🟡 In progress | — | not written yet |
| Gemini switch | Assistant uses Google Gemini | ✅ Done (code + tests) | — | [00-foundation.md](docs/00-foundation.md) |
| Final polish | Manager Team/insights view, Settings for approval rules | ⬜ Not started | — | — |
| End-to-end tests | Playwright smoke tests | ⬜ Not started | — | — |
| Docs refresh | Final README and docs pass | ⬜ Not started | — | — |

## In progress now

**Phase 7 — Negotiations and bookings** (not committed yet)

- Backend: done and tested.
  - Deal model.
  - Price proposals with discount limits: executive up to 1%, manager up to 5%, anything above needs admin approval.
  - Holds on units.
  - Booking requested by the executive, confirmed by the manager.
  - Payment plan, registration, cancellation.
  - Assistant tools for deals.
- Web UI: being built now.
  - Deals page and deal drawer.
  - Deal card on the lead page.
  - Approvals on the Today page.
  - Admin settings for approval limits.

**Done — assistant switched to Google Gemini** (owner's request; not committed yet)

- Uses the official `@google/genai` SDK. Key from `GEMINI_API_KEY` in `apps/api/.env`; model from `GEMINI_MODEL`, default `gemini-2.5-flash`.
- Chat uses Gemini function calling over the same role-scoped tools. Confirm-before-acting proposals and "via assistant" in the audit log work as before.
- Brochure and text reading, unknown sheet headings and requirements use Gemini's JSON mode. Every answer is checked again, and if Gemini fails, typed text, PDFs and requirements fall back to the rule-based readers.
- Without a key the assistant runs in the labelled, rule-based offline mode, so the app works either way.
- Tested with a scripted fake Gemini client (`apps/api/test/gemini.test.ts`). No real Gemini call has been made yet; that needs the key.

## Next up

1. Finish Phase 7 web UI, test, commit.
2. Try the assistant against real Gemini once the key arrives.
3. Final polish: manager Team/insights view, Settings for approval rules.
4. Playwright end-to-end smoke tests.
5. Final README and docs refresh.
6. Push to the owner's git remote (none set up yet).

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
| 3 | **Confirm discount limits** — executive 1%, manager 5%, above that admin approval | Built into Phase 7 approvals. Admins will be able to change them in Settings, but the defaults should be right. |
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
| API tests (vitest + supertest, in-memory MongoDB) | `pnpm test` | 62 passing |
| Typecheck | `pnpm typecheck` | Clean as of Phase 6 |
| Web build | `pnpm build` | Clean as of Phase 6 |
| End-to-end (Playwright) | — | Not written yet |
