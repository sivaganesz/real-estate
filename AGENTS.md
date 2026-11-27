# EstateOS: notes for AI coding tools

AI-first real-estate sales and inventory app for admins, sales managers and
sales executives. Progress is tracked in `STATUS.md`. Feature docs are in `docs/`.

## Layout

| Folder | What |
| --- | --- |
| `apps/api` | Express 5 + Mongoose + zod, run with tsx. Gemini assistant in `src/ai/`. |
| `apps/web` | React 18 + Vite 6 + Tailwind CSS 3 + React Router 6 + TanStack Query 5. |
| `packages/shared` | Types, roles and permissions, formatting (₹ lakh/crore), domain rules. |
| `e2e` | Playwright journeys (desktop, and phone for `@phone` tests). |

## Commands

- `pnpm dev`: API on 4000 (built-in MongoDB in `.data/mongo`) and web on 5173.
- `pnpm typecheck`
- `cd apps/api && GEMINI_API_KEY= pnpm test`: API tests, offline AI.
- `pnpm e2e`: starts its own API (4190) and web (5190, own Vite cache).
- `pnpm --filter ./apps/web build`
- `pnpm seed`: resets the database to the demo data. It wipes local changes.

## Working rules

- Never commit or push without the user's explicit approval.
- Work on branch `feat/estate-platform`. Never push `main`.
- Never commit `.env` or any key. `GEMINI_API_KEY` lives only in `apps/api/.env`
  and in Render.
- Deploy: web on Vercel (Root Directory `apps/web`, `apps/web/vercel.json`), API
  on Render (`render.yaml`).

## Project decisions (frontend)

These win over general frontend standards, including the `frontend-review` skill
in `.claude/skills/`.

- **Design.**
  - Tailwind palette classes (`bg-white`, `text-slate-500`, `brand-*`, `ai-*`)
    are used directly. There are no design tokens.
  - Tiles use `rounded-xl` to `rounded-3xl` and soft shadows (`shadow-card`,
    `shadow-pop`). Dashboards are bento tiles (`components/Bento.tsx`).
- **Inputs.**
  - The shared `Select` (a styled native select), `<datalist>` suggestions and
    the browser's date and time inputs are allowed.
  - Standard fields come from `components/ui.tsx`.
- **Buttons.** `Button` is for standard actions. Pill and chip buttons may be
  styled in place.
- **Never use the browser's `alert`, `confirm` or `prompt`.**
  - For "are you sure?", use `useConfirm()` from `components/confirm.tsx`.
  - For feedback, use `useToast()`.
- **API and login.**
  - All requests go through `src/lib/api.ts`.
  - Login is an httpOnly session cookie. Never keep tokens in browser storage.
  - Permissions are checked on the API. The UI only hides what a role can't use.
- **AI.** Gemini is called only from the API. The key never reaches the web app.
- **Routes** are declared in `App.tsx` (pages load lazily) and the menu in
  `nav.tsx`. Inline paths in links are fine.
- **Keys.** Index keys are fine for lists that only grow or never reorder.
- **Icons:** Lucide only.
- **Feature modules** (`features/*`) add panels through the slot registries
  (`slots.ts`, `slots-leads.ts`) instead of editing pages.

## How the UI is built

Read `docs/09-ui-patterns.md` (with screenshots) before adding or redesigning a
page. In short:

- **Page shape:** `PageHeader` → a row of tiles → a list card with tabs, and on
  screens 1280 px and wider a preview panel for the selected row. Row actions
  appear on hover or focus only.
- **Reuse first:** `components/ui.tsx` (incl. `Segmented size="lg"`, `Avatar soft`),
  `components/leadBits.tsx` (`ScoreRing`, `StageLabel`, `budgetText`,
  `whatAndWhere`), `components/DealSteps.tsx` (`StepTrack`, `PriceTrack`,
  `NextStepNote`), `components/SearchBar.tsx`, `components/Bento.tsx`
  (`DayHeadline`, `greeting()`).
- **Colours by meaning:** teal `brand` = brand and main actions; emerald = booked,
  done; rose = lost, overdue; amber = today, warning; violet `ai` = AI and
  approvals. There is no `ai-400` shade; use `ai-500`.
- **Slots:** `slots.ts` (`propertyTop`, `propertySide`); `slots-leads.ts`
  (`hero`, `next`, `top`, `side`, `tabs`, `actions`, and `views.board` for the
  Pipeline). Modules in `features/*` push into them.

## Domain notes

- **Lead score** (0–100) and buyer type are rules in
  `packages/shared/src/leadScore.ts`; the API adds `score` and `segment` to each
  lead. Hot = 80+. Weights are still to be confirmed by the client.
- **Switch role** (demo accounts only) is on when `ROLE_SWITCH=1`, or by default
  outside production. Endpoints in `apps/api/src/routes/auth.ts`.
- **Neighbourhood places** come from OpenStreetMap via Overpass (`OVERPASS_URL`).
- Feature docs per phase: `docs/00`–`09`. Open work: the *Next up* checklist in
  `STATUS.md`. Keep both up to date with each change.

## Gotchas

- **Local DB** is an embedded MongoDB at `127.0.0.1:27027` (`.data/mongo`).
  `pnpm seed` wipes it; to add data, write a small targeted script instead.
- **Playwright's own browsers aren't installed.** Run with installed Chrome:
  a throwaway config that spreads `playwright.config.ts` and sets
  `use.channel: 'chrome'` on each project. Delete it afterwards.
- **Drag tests:** `dragTo` doesn't start the HTML5 drag here; use slow
  `page.mouse` moves after scrolling the card and lane into view.
- **`useEffect` must not return a value.** Write `useEffect(() => { … })` with
  braces; newer Chrome returns a Promise from a smooth `scrollTo`, and returning
  it crashed a page.
- **Prettier isn't installed**, so there is no format step. Match the
  surrounding style.
- The frontend scanner flags inline `style`; computed sizes need a
  `/* scan-ok: reason */` comment.

## Working with this user

- **Every UI change:** send before and after screenshots of the main change
  (desktop, plus phone when the layout changes there). The user does the other
  checks.
- **Ask before any commit or push.** "commit this" approves one commit; "push it"
  approves one push.
- Reference screenshots mean "this layout", not "copy it pixel for pixel", unless
  the user says "exactly". When a request is unclear, describe the plan in the
  terminal and wait for approval.
- Write plain English in UI text and docs (short sentences, no jargon).

## Reviewing the frontend

Use the project skill `.claude/skills/frontend-review`. Run its scanner with
`node .claude/skills/frontend-review/scripts/scan.mjs apps/web`. Rules this
project decided against are switched off there.
