# ContractRipple

ContractRipple is a developer tool for reviewing API contract changes and understanding their
potential impact on frontend integrations. It compares OpenAPI specifications, classifies
potentially breaking changes, and (in later phases) analyzes frontend source code to surface
evidence-backed impact.

> **Status:** Phase 1 foundation. The UI currently renders clearly labeled demo content. The
> OpenAPI engine, persistence, source analysis, graph, and authentication are not implemented yet.

## Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 3.
- **Backend:** Node.js, Express 5, TypeScript (`apps/api`).
- **Database:** PostgreSQL via Prisma (`apps/api/prisma`).
- **Shared:** framework-agnostic types (`packages/shared`).
- **Package manager:** npm (workspaces). Commit `package-lock.json`; do not introduce a second lockfile.

## Repository layout

```
contract-ripple/            # git repo root (frontend + workspaces)
├── src/                    # Next.js frontend
│   ├── app/
│   └── components/
├── apps/
│   └── api/                # Express API scaffold
│       ├── src/
│       └── prisma/
├── packages/
│   └── shared/             # shared types
├── docs/                   # plan, architecture, design review
├── AGENTS.md               # permanent project instructions
└── .env.example
```

The frontend intentionally stays at the repository root so the existing Vercel deployment keeps
working. A later, approved migration can move it to `apps/web` (requires updating the Vercel root
directory).

## Prerequisites

- Node.js **20.9+** (developed on Node 24).
- npm (bundled with Node).
- PostgreSQL (only needed from Phase 3 onward).

## Setup

```bash
# from the repository root
npm install

# frontend environment
cp .env.example .env.local        # Windows: copy .env.example .env.local

# backend environment (Phase 3+)
cp apps/api/.env.example apps/api/.env   # Windows: copy apps/api/.env.example apps/api/.env
```

## Run

```bash
# Frontend → http://localhost:3000
npm run dev

# API → http://localhost:4000/api/v1/health
npm run api:dev
```

> On this Windows host Turbopack's native bindings are unavailable, so the dev/build scripts use
> `--webpack`. Do not switch to Turbopack without verifying the platform support first.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js dev server (Webpack) |
| `npm run build` | Production build of the frontend |
| `npm run start` | Start the production frontend |
| `npm run lint` | ESLint on the frontend source |
| `npm run typecheck` | Type-check the frontend, build shared types, type-check the API |
| `npm test` | Run unit tests with Vitest |
| `npm run test:watch` | Vitest watch mode |
| `npm run api:dev` | Start the Express API in watch mode |
| `npm run api:start` | Start the compiled API |
| `npm run build:api` | Build shared types and the API |
| `npm run build:all` | Build frontend + shared + API |
| `npm run db:validate` | Validate the Prisma schema |

## Environment variables

Frontend (`.env.local`, see `.env.example`):

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | API base URL including `/api/v1` |

Backend (`apps/api/.env`, see `apps/api/.env.example`):

| Variable | Description |
| --- | --- |
| `NODE_ENV` | `development`, `test`, or `production` |
| `PORT` | API port (default `4000`) |
| `CORS_ORIGINS` | Comma-separated allowed browser origins |
| `DATABASE_URL` | PostgreSQL connection string (Phase 3+) |

Never commit real `.env` files. `.gitignore` ignores them but allows `.env.example`.

## API (current)

`GET /api/v1/health` → `{ status: "ok", service, timestamp, uptimeSeconds }`

Unknown routes return a consistent `{ error: { code, message } }` envelope.

## Testing

Unit tests use Vitest and live next to the code they cover:

- `packages/shared/src/index.test.ts`
- `apps/api/src/services/health.test.ts`

```bash
npm test
```

No database-dependent tests exist yet; Phase 3 will add an isolated test database setup.

## Deployment

- **Frontend:** Vercel at the repository root (current live site: `contractripple.vercel.app`).
- **Backend:** deploy `apps/api` separately to a Node-capable host with PostgreSQL.
- Set environment variables per environment; use HTTPS and explicit CORS origins.
- Run Prisma migrations deliberately, never automatically on server start.

## Documentation

- `AGENTS.md` — permanent project rules.
- `docs/development-plan.md` — scope, phases, and decisions.
- `docs/architecture.md` — boundaries and data flow.
- `docs/design-review.md` — UI review and improvement priorities.

## Demo data

The landing page uses hardcoded demo data. It is labeled as demo and must never be presented as real
analysis. Real analysis replaces it in Phase 3+.
