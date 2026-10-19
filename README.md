# ContractRipple

ContractRipple is a developer tool for reviewing API contract changes and understanding their
potential impact on frontend integrations. It compares OpenAPI specifications, classifies
potentially breaking changes, and (in later phases) analyzes frontend source code to surface
evidence-backed impact.

> **Status:** Phase 3. The OpenAPI engine is wired to an Express API with
> PostgreSQL persistence, and the `/contracts` workspace runs real comparisons
> and shows classified findings with JSON Pointer evidence. The landing page
> (`/`) still renders clearly labeled demo content. Source analysis, the impact
> graph, reports, and authentication are not implemented yet.

## Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 3.
- **Backend:** Node.js, Express 5, TypeScript (`apps/api`).
- **Database:** PostgreSQL via Prisma (`apps/api/prisma`).
- **Shared:** framework-agnostic types (`packages/shared`).
- **Engine:** standalone OpenAPI comparison engine (`packages/engine`).
- **Package manager:** npm (workspaces). Commit `package-lock.json`; do not introduce a second lockfile.

## Repository layout

```
contract-ripple/            # git repo root (frontend + workspaces)
├── src/                    # Next.js frontend
│   ├── app/
│   ├── components/
│   └── lib/
├── apps/
│   └── api/                # Express API (routes, services, repositories)
│       ├── src/
│       └── prisma/         # schema + migrations
├── packages/
│   ├── engine/             # OpenAPI parse/validate/normalize/compare/classify
│   └── shared/             # shared types and zod request schemas
├── docs/                   # plan, architecture, design review, engine/API docs
├── AGENTS.md               # permanent project instructions
└── .env.example
```

The frontend intentionally stays at the repository root so the existing Vercel deployment keeps
working. A later, approved migration can move it to `apps/web` (requires updating the Vercel root
directory).

## Prerequisites

- Node.js **20.9+** (developed on Node 24).
- npm (bundled with Node).
- PostgreSQL (a managed instance is fine; migrations are applied with `prisma migrate deploy`).

## Setup

```bash
# from the repository root
npm install

# frontend environment
cp .env.example .env.local        # Windows: copy .env.example .env.local

# backend environment
cp apps/api/.env.example apps/api/.env   # Windows: copy apps/api/.env.example apps/api/.env
# then set DATABASE_URL in apps/api/.env

# generate the Prisma client and apply migrations
npm run db:generate
npm run db:deploy
```

## Run

```bash
# Frontend → http://localhost:3000  (workspace at /contracts)
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
| `npm run build` | Build shared, then production-build the frontend (Webpack) |
| `npm run start` | Start the production frontend |
| `npm run lint` | ESLint on the frontend source |
| `npm run typecheck` | Build shared + engine, type-check the frontend, type-check the API |
| `npm test` | Run unit tests with Vitest (DB integration test skipped) |
| `npm run test:watch` | Vitest watch mode |
| `npm run api:dev` | Start the Express API in watch mode (loads `apps/api/.env`) |
| `npm run api:start` | Start the compiled API |
| `npm run build:shared` | Build the shared types package |
| `npm run build:engine` | Build the OpenAPI engine |
| `npm run build:api` | Build shared + engine + API |
| `npm run build:all` | Build frontend + shared + engine + API |
| `npm run db:validate` | Validate the Prisma schema |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:migrate` | Create/apply a dev migration (`prisma migrate dev`) |
| `npm run db:deploy` | Apply committed migrations (`prisma migrate deploy`) |

## OpenAPI engine

`packages/engine` exposes a clean, HTTP-independent interface:

```ts
import { compareContracts } from "@contract-ripple/engine";

const result = await compareContracts({
  baseline: { content: baselineJsonOrYaml },
  candidate: { content: candidateJsonOrYaml },
});
```

It supports OpenAPI 3.0.x/3.1.x JSON and YAML, resolves internal `$ref`s,
detects circular references, never fetches external references, and returns
deterministic findings with JSON Pointers, explanations, and
`non_breaking`/`potentially_breaking`/`unknown` labels.

See `docs/engine.md` for classification rules, security limits, library
evaluation, and known limitations.

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

Base URL `/api/v1`. All responses are JSON; errors use a consistent
`{ error: { code, message, details? } }` envelope.

- `GET /health` — liveness.
- `GET /ready` — readiness including database connectivity (`200`/`503`).
- `POST /projects`, `GET /projects`, `GET /projects/:projectId`,
  `PATCH /projects/:projectId`
- `POST /projects/:projectId/contracts`, `GET /projects/:projectId/contracts`,
  `GET /contracts/:contractId`
- `POST /contracts/:contractId/versions` (validates before saving),
  `GET /contracts/:contractId/versions`, `GET /versions/:versionId`
- `POST /projects/:projectId/comparisons`, `GET /projects/:projectId/comparisons`,
  `GET /comparisons/:comparisonId`

See `docs/api.md` for request/response fields, error codes, and limits.

> **No authentication yet.** The API is unauthenticated by design until Phase 7.
> Do not expose it publicly with real user data before then.

## Testing

Unit and route tests use Vitest and live next to the code they cover:

- `packages/shared/src/*.test.ts` — error guards and API request schemas.
- `packages/engine/src/*.test.ts` — parsing, validation, comparison, classification, security.
- `apps/api/src/services/*.test.ts` — project/contract/comparison services with an in-memory repository.
- `apps/api/src/routes/app.test.ts` — real HTTP requests against an ephemeral server.

```bash
npm test
```

The engine tests cover parsing/validation failures, all required change classes,
references, circular references, external references, deterministic ordering,
JSON Pointer escaping, input limits, and security cases. The API tests cover
input validation, engine error mapping, persistence DTOs, cross-project checks,
and the full project → contract → version → comparison flow.

One PostgreSQL integration test is skipped by default. Run it against a
configured `apps/api/.env` database with:

```bash
# Windows (cmd)
set RUN_DB_TESTS=1&& npx vitest run apps/api/src/db

# macOS/Linux
RUN_DB_TESTS=1 npx vitest run apps/api/src/db
```

It creates a project, uploads two versions, runs a comparison, reads it back, and
deletes the project at the end.

## Deployment

- **Frontend:** Vercel at the repository root (current live site: `contractripple.vercel.app`).
- **Backend:** deploy `apps/api` separately to a Node-capable host with PostgreSQL.
- Set environment variables per environment; use HTTPS and explicit CORS origins.
- Run Prisma migrations deliberately, never automatically on server start.

## Documentation

- `AGENTS.md` — permanent project rules.
- `docs/development-plan.md` — scope, phases, and decisions.
- `docs/architecture.md` — boundaries and data flow.
- `docs/api.md` — REST endpoint reference, error codes, and limits.
- `docs/engine.md` — OpenAPI engine interface, rules, and limitations.
- `docs/design-review.md` — UI review and improvement priorities.

## Demo data

The landing page (`/`) uses hardcoded demo data and is labeled as demo. The
`/contracts` workspace performs real analysis against the API and database. Demo
content is never presented as real analysis.
