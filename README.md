# Real Estate Platform

AI-powered real estate management platform: an **Admin Portal** for properties, users and appointments, an **AI agent** (Perfox) that answers property questions and books site visits through our MCP tools, and later a **Public Website**.

- Product requirements: [docs/PRD.md](docs/PRD.md)
- Technical design: [docs/TRD.md](docs/TRD.md)
- Development checklist: [docs/DEVELOPMENT-CHECKLIST.md](docs/DEVELOPMENT-CHECKLIST.md)
- Wireframes: [docs/wireframes/](docs/wireframes/)

## Tech stack

| Part         | Technology                                           |
| ------------ | ---------------------------------------------------- |
| Admin portal | React + Vite + TypeScript, Tailwind CSS, shadcn/ui   |
| API          | Node.js + Express + TypeScript, Zod, OpenAPI/Swagger |
| Database     | MongoDB (Mongoose)                                   |
| Files        | Local server storage (`apps/api/uploads/`)           |
| Email        | Resend (swappable email module)                      |
| AI agent     | Perfox (connects to our MCP server)                  |
| Monorepo     | pnpm workspaces                                      |

## Repository structure

```
apps/
  api/        Express API + MCP server
  admin/      Admin portal (React + Vite)
  web/        Public website (later phase)
packages/
  shared/     Roles, permissions, schemas and formatters shared by API and apps
docs/         PRD, TRD, checklist, wireframes
```

## Prerequisites

- Node.js 22 (see `.nvmrc`)
- pnpm (version pinned in `package.json` → `packageManager`)
- Docker (for the local MongoDB)

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Start MongoDB locally (Docker, host port 27018, so it never clashes with an
#    installed MongoDB on the default port 27017)
pnpm db:up

# 3. Create the API environment file, then fill in the JWT secrets and SEED_SUPERADMIN_* values
cp apps/api/.env.example apps/api/.env

# 4. Create the first Super Admin and default company settings (safe to run again)
pnpm --filter @real-estate/api seed

# 5. Start the apps
pnpm dev:api          # API on http://localhost:4000
pnpm dev:admin        # admin portal on http://localhost:5173
```

Open the admin portal at `http://localhost:5173` and sign in with the `SEED_SUPERADMIN_*` email and password. In development the admin app proxies `/api` and `/uploads` to the API, so no extra configuration is needed (see `apps/admin/.env.example`).

Once the API is running:

- `http://localhost:4000/health`: API and database status
- `http://localhost:4000/api/docs`: Swagger UI (the raw spec is at `/api/openapi.json`)

In local development `EMAIL_PROVIDER=console` prints emails to the API log instead of sending them. Uploaded files are stored in `apps/api/uploads/` (git-ignored).

## Scripts (run from the repository root)

| Script                              | What it does                             |
| ----------------------------------- | ---------------------------------------- |
| `pnpm dev`                          | Start all apps in development mode       |
| `pnpm dev:api` / `pnpm dev:admin`   | Start one app                            |
| `pnpm build`                        | Build every package                      |
| `pnpm lint` / `pnpm lint:fix`       | Check / fix code with ESLint             |
| `pnpm format` / `pnpm format:check` | Format / check formatting with Prettier  |
| `pnpm typecheck`                    | Type-check every package                 |
| `pnpm test`                         | Run all tests                            |
| `pnpm db:up` / `pnpm db:down`       | Start / stop the local MongoDB container |

## Development rules

- Work phase by phase as listed in the development checklist; each phase is demoed before the next starts.
- Keep it simple: no background workers, queues, cron jobs or data-sync processes.
- Branch from `main`. Commits and pushes happen only after the project owner approves them.
