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

## Reviewing the frontend

Use the project skill `.claude/skills/frontend-review`. Run its scanner with
`node .claude/skills/frontend-review/scripts/scan.mjs apps/web`. Rules this
project decided against are switched off there.
