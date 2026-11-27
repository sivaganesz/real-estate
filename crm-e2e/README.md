# RealSpec CRM (crm-e2e)

A frontend-only real-estate CRM demo for Indian sales teams: leads, qualification, properties and matching, appointments, tasks, pipeline, bulk import, reports, team and an AI assistant. All data lives in the browser (localStorage), seeded with realistic relative-date demo data, so the app always looks "live" on the day you open it.

React 19 · TypeScript · Vite · Tailwind CSS 4 · shadcn/ui · zustand + immer · react-router · i18next (English + Tamil) · Recharts · Vitest · Playwright.

## Setup

Requirements: Node 24, pnpm (v12 used here). Microsoft Edge for the end-to-end tests.

```sh
cd crm-e2e
pnpm i
pnpm dev            # http://localhost:5174
```

The dev port is fixed (`strictPort`) because the demo data is stored per origin: if 5174 is busy, Vite stops instead of moving to another port.

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Dev server on 5174 |
| `pnpm build` | Type-check and build to `dist/` |
| `pnpm preview` | Serve the build on 5175 |
| `pnpm typecheck` | TypeScript only |
| `pnpm lint` | oxlint |
| `pnpm test` / `pnpm test:watch` | Vitest unit tests |
| `pnpm verify` | typecheck + lint + test + build (run before every hand-over) |
| `pnpm e2e` | Playwright journeys against a fresh build served on 5176 (Edge) |
| `pnpm e2e:dev` | The same journeys against the dev server on 5174 |

Playwright uses the installed Microsoft Edge (`channel: 'msedge'`), so no browser download is needed. Without Edge, run `PW_CHANNEL=chrome pnpm e2e` (installed Chrome), or `pnpm exec playwright install chromium` and point `PW_CHANNEL` at it.

## Environment

Copy `.env.example` to `.env` if you need to change anything; the defaults work without a `.env`.

| Variable | Default | Meaning |
|---|---|---|
| `VITE_AI_PROVIDER` | `simulated` | `simulated` or `live` |
| `VITE_AI_ENDPOINT` | — | URL of **your backend proxy** for live AI. Required for live mode. |
| `VITE_AI_MODEL` | — | Model name passed through to the proxy |

There is deliberately **no API-key variable**. Anything prefixed `VITE_` is compiled into the public JavaScript bundle, so a key there would be visible to every visitor.

## AI: simulated vs live

- **Simulated (default).** A rule-based provider in `src/ai/simulated/` handles extraction from pasted text (lead, property, appointment), lead scoring and qualification, property matching, message drafts, summaries and commands in the assistant panel. It runs offline and instantly. Everything it produces is labelled **"Demo AI"**.
- **Live.** Set `VITE_AI_PROVIDER=live` **and** `VITE_AI_ENDPOINT`. The live provider (`src/ai/live/provider.ts`) POSTs `{ task, input, context, model }` to the endpoint and expects the same JSON shapes as the simulated provider (`src/ai/types.ts`). If a call fails, times out (15 s) or is not implemented, that call falls back to the simulated provider and the result is labelled as such. Property matching always stays rule-based.
- **Backend proxy required.** This repo is frontend only. The proxy (not included) holds the vendor API key, calls the model, and returns the shapes in `src/ai/types.ts`. Never point `VITE_AI_ENDPOINT` at a vendor URL with a key.
- **Nothing runs without confirmation.** AI fills forms and proposes actions; the user reviews and clicks Save / Confirm. Every proposal is re-checked against the current user's permissions.

## Demo profiles

Switch with the profile switcher at the bottom of the sidebar (topbar avatar on phones). Switching is instant (no reload) and remembered across reloads; if the current page is not allowed for the new profile you land on Today.

| Profile | Role | Sees |
|---|---|---|
| Meera Iyer | Admin | Everything: all leads, team, settings, bulk import of leads and properties, business reports, demo reset |
| Rohit Khanna | Sales Manager | His team's leads and unassigned leads, assignment rules, team view, lead import, team reports |
| Arjun Mehta (default) | Sales Executive | Own leads, tasks and appointments; all properties; "My performance" |
| Sneha Reddy | Sales Executive | Same scope, her own records |
| Vikram Singh | Sales Executive | Same scope, his own records |

Farhan Qureshi (on leave) and Kavya Joshi (deactivated) exist in the data to show availability and deactivation in Team, but are not switchable. The full permission matrix is in `notes/foundation-plan.md` §3 and `src/lib/permissions.ts`.

## Data

- Stored in localStorage under `crm-e2e-db` (data), `crm-e2e-session` (profile, sidebar, AI panel), `crm-e2e-theme` and `crm-e2e-lang`.
- Seed dates are relative to today. On load, if the stored anchor date is not today, every date is shifted forward, so "today's visits" stay today.
- Admins reset the demo data from Settings → Demo (`/settings/demo`, built in Phase 2 by M8; the service is `services/demo.ts#resetDemo`). Clearing the site data does the same.
- Theme: light / dark / system. Language: English / தமிழ் (Tamil is drafted and awaits review by a fluent speaker).

## More

- `CONVENTIONS.md` — folder structure, import rules, ownership, patterns, commands.
- `DESIGN_SYSTEM.md` — visual spec and tokens.
- `ROLE_RESEARCH.md` — role and permission research.
- `notes/foundation-plan.md` — architecture plan.
- `PROGRESS.md` — current status.

Known limitations: image OCR downloads its language data on first use (needs internet; paste text as a fallback); voice input needs Chrome or Edge; images are stored as compressed data URLs (about 4 MB cap); WhatsApp and calls open `wa.me` / `tel:` links and are logged when clicked.
