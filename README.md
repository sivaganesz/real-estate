# EstateOS

Real-estate sales and inventory, built around each person's day and an AI assistant that does the busywork.

## Run it

```bash
pnpm install          # also downloads an embedded MongoDB the first time
cp .env.example apps/api/.env   # optional: add ANTHROPIC_API_KEY
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

## AI

Set `ANTHROPIC_API_KEY` in `apps/api/.env` to use Claude (`claude-opus-5-5` by default; change it with `AI_MODEL`). Without a key the assistant runs in a clearly labelled offline mode that understands common requests.

## Checks

```bash
pnpm test        # API tests against an in-memory MongoDB
pnpm typecheck
pnpm build
```

## Docs

Product and UX decisions, one file per phase, in [`docs/`](docs/).
