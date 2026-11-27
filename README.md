# EstateOS

Real-estate sales and inventory, built around each person's day and an AI assistant that does the busywork.

## Run it

```bash
pnpm install          # also downloads an embedded MongoDB the first time
cp .env.example apps/api/.env   # optional: add GEMINI_API_KEY
pnpm dev              # API on :4000, web on http://localhost:5173
```

No database setup is needed: without `MONGODB_URI` the API starts an embedded MongoDB (data kept in `.data/mongo`) and seeds demo data on first run.

Demo sign-ins (password `demo1234`):

| Role | Email |
|---|---|
| Admin | admin@estate.test |
| Sales manager | manager@estate.test |
| Sales executive | priya@estate.test, arun@estate.test, divya@estate.test |

`pnpm seed` resets the database to the demo data.

**Switch role:** signed in as any demo account, the profile menu has *Switch role* to jump straight into another demo account's view (Admin, Sales manager, each Sales executive). It only works between the demo accounts, is on outside production, and in production only with `ROLE_SWITCH=1` on the API.

## AI

Set `GEMINI_API_KEY` in `apps/api/.env` to use Google Gemini (`gemini-2.5-flash` by default; change it with `GEMINI_MODEL`, since Google renames Flash models often). Without a key the assistant runs in a clearly labelled offline mode that understands common requests.

## Checks

```bash
pnpm test        # API tests against an in-memory MongoDB
pnpm e2e         # Playwright journeys on desktop and phone; runs its own API (:4190) and web (:5190)
pnpm typecheck
pnpm build
```

## Status

Where the build stands, and what's waiting on the owner: [STATUS.md](STATUS.md).

## Docs

Product and UX decisions, one file per phase, in [`docs/`](docs/).
