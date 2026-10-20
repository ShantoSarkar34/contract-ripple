# ContractRipple

ContractRipple is a developer tool for reviewing API contract changes and understanding their
potential impact on frontend integrations. It compares OpenAPI specifications, classifies
potentially breaking changes, analyzes frontend source code for affected calls, and visualizes
the evidence-backed relationships.

> **Status:** Phase 5. The OpenAPI engine is wired to an Express API with
> PostgreSQL persistence, and the `/contracts` workspace runs real comparisons,
> shows classified findings in a filterable table with JSON Pointer evidence,
> analyzes ZIP/GitHub source for affected integrations with file/line evidence,
> and renders an evidence-backed operation→file impact graph with an accessible
> relationships view. The landing page (`/`) still renders clearly labeled demo
> content. Report exports, saved-history pagination, regression suggestions, and
> authentication are not implemented yet.

## Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 3.
- **Backend:** Node.js, Express 5, TypeScript (`apps/api`).
- **Database:** PostgreSQL via Prisma (`apps/api/prisma`).
- **Shared:** framework-agnostic types (`packages/shared`).
- **Engine:** standalone OpenAPI comparison engine (`packages/engine`).
- **Source analysis:** TypeScript AST matching (`packages/source-analysis`).
- **Impact graph:** deterministic graph construction (`packages/impact-graph`).
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
│   ├── source-analysis/    # TypeScript AST call detection + operation matching
│   ├── impact-graph/       # deterministic operation→source graph builder
│   └── shared/             # shared types and zod request schemas
├── docs/                   # plan, architecture, design review, engine/API/source/graph docs
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
| `npm run build` | Build shared + impact graph, then production-build the frontend (Webpack) |
| `npm run start` | Start the production frontend |
| `npm run lint` | ESLint on the frontend source |
| `npm run typecheck` | Build shared + engine + source-analysis + impact-graph, type-check the frontend, type-check the API |
| `npm test` | Run unit tests with Vitest (DB integration test skipped) |
| `npm run test:watch` | Vitest watch mode |
| `npm run api:dev` | Build shared/engine/source-analysis, then start the Express API in watch mode (loads `apps/api/.env`) |
| `npm run api:start` | Start the compiled API |
| `npm run build:shared` | Build the shared types package |
| `npm run build:engine` | Build the OpenAPI engine |
| `npm run build:source` | Build the source-analysis package |
| `npm run build:graph` | Build the impact-graph package |
| `npm run build:api` | Build shared + engine + source-analysis + API |
| `npm run build:all` | Build frontend + impact graph + shared + engine + source-analysis + API |
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

## Source analysis

After a comparison, the `/contracts` workspace can analyze frontend source
against the operations that changed. Two inputs are supported:

- **ZIP upload** — up to 10 MiB, analyzed in memory. Path traversal, oversized
  entries, and unsupported files are rejected or skipped.
- **GitHub repository** — requires `GITHUB_TOKEN` on the API server. The server
  uses the official REST API to read the selected ref; it never clones or
  executes repository code.

`packages/source-analysis` parses TypeScript/JavaScript with the TypeScript
compiler API and detects statically resolvable calls (`fetch`, Axios,
API-client wrappers, request helpers, template-literal paths). Detected calls
are matched only against operations changed by the comparison. Each result
includes file, line, column, snippet, matched operation, and confidence.

Static analysis cannot see runtime-composed URLs, custom wrappers that hide
method and path, generated clients, or GraphQL/WebSocket traffic. Results are
evidence-backed matches, not a guarantee of complete impact discovery. See
`docs/source-analysis.md`.

## Impact graph

When a source snapshot is selected, the `/contracts` workspace renders an
impact map: changed operations on the left, affected source files on the right,
and one line per persisted match. Selecting a node or relationship shows the
comparison findings or the exact source evidence (file, line, column, snippet).

- The graph is built in the browser by `packages/impact-graph` from the stored
  comparison findings and source impacts. It adds no API endpoint and no
  database table.
- An edge exists only when a persisted source match names the same normalized
  method + path as a changed operation. Unmatched findings and impacts are
  reported as limitations, never drawn as speculative links.
- Filters cover risk, category, method, confidence, and free text. Defaults are
  200 operations, 400 files, 800 relationships, and 20 evidence entries per
  relation; truncation is explicit.
- A Map/Relationships toggle exposes the same evidence as a semantic table for
  keyboard and screen-reader users. Operations with no match stay visible.

See `docs/impact-graph.md` for the model, construction rules, library
evaluation, limits, and known limitations.

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
| `GITHUB_TOKEN` | Optional server-side GitHub App/PAT token with read-only Contents access |
| `GITHUB_API_BASE_URL` | GitHub REST base URL (default `https://api.github.com`) |

Never commit real `.env` files. `.gitignore` ignores them but allows `.env.example`.
`GITHUB_TOKEN` is never returned by the API, written to logs, or included in
error responses. Leave it empty to disable GitHub analysis; the API then reports
`github_not_configured` instead of faking a connection.

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
- `POST /projects/:projectId/source/zip` (multipart), `POST /projects/:projectId/source/github`,
  `GET /projects/:projectId/source`, `GET /source/:snapshotId`, `GET /github/status`

See `docs/api.md` for request/response fields, error codes, and limits.

> **No authentication yet.** The API is unauthenticated by design until Phase 7.
> Do not expose it publicly with real user data before then.

## Testing

Unit and route tests use Vitest and live next to the code they cover:

- `packages/shared/src/*.test.ts` — error guards and API request schemas.
- `packages/engine/src/*.test.ts` — parsing, validation, comparison, classification, security.
- `packages/source-analysis/src/*.test.ts` — AST call detection, path matching, template paths, limits.
- `packages/impact-graph/src/*.test.ts` — graph grouping, matching, filters, limits, evidence, and deterministic ordering.
- `apps/api/src/services/*.test.ts` — project/contract/comparison/source services with an in-memory repository.
- `apps/api/src/routes/app.test.ts`, `apps/api/src/routes/source.test.ts` — real HTTP requests against an ephemeral server.

```bash
npm test
```

The engine tests cover parsing/validation failures, all required change classes,
references, circular references, external references, deterministic ordering,
JSON Pointer escaping, input limits, and security cases. The graph tests cover
grouping, normalized matching, unmatched evidence, filters, limits, deterministic
ordering, and the no-missing-endpoints guarantee. The API tests cover input
validation, engine error mapping, persistence DTOs, cross-project checks, ZIP
traversal and size limits, GitHub error mapping, and the full project → contract
→ version → comparison → source-analysis flow.

One PostgreSQL integration test is skipped by default. Run it against a
configured `apps/api/.env` database with:

```bash
# Windows (cmd)
set RUN_DB_TESTS=1&& npx vitest run apps/api/src/db

# macOS/Linux
RUN_DB_TESTS=1 npx vitest run apps/api/src/db
```

It creates a project, uploads two versions, runs a comparison, analyzes a ZIP
source archive, reads the snapshot back, and deletes the project at the end.

## Deployment

- **Frontend:** Vercel project `contractripple`, rooted at the repository root
  (current live site: `contractripple.vercel.app`).
- **Backend:** Vercel project `contractripple-api`, rooted at `apps/api`
  (current live API: `contractripple-api.vercel.app/api/v1`).
- **Database:** managed PostgreSQL; migrations are run deliberately with
  `npm run db:deploy`, never automatically on server start.
- Set `NEXT_PUBLIC_API_BASE_URL` on the frontend, and `DATABASE_URL`,
  `CORS_ORIGINS`, and the optional `GITHUB_TOKEN` on the API. Use HTTPS and
  exact CORS origins.
- Vercel Functions limit request bodies to 4.5 MB, below the application's
  10 MiB ZIP limit. See `docs/deployment.md` for the full deployment topology,
  CLI commands, limits, and security status.

## Documentation

- `AGENTS.md` — permanent project rules.
- `docs/development-plan.md` — scope, phases, and decisions.
- `docs/architecture.md` — boundaries and data flow.
- `docs/api.md` — REST endpoint reference, error codes, and limits.
- `docs/engine.md` — OpenAPI engine interface, rules, and limitations.
- `docs/source-analysis.md` — source detection, matching, ZIP/GitHub security, and limits.
- `docs/impact-graph.md` — graph model, construction rules, limits, accessibility, and library evaluation.
- `docs/deployment.md` — Vercel frontend/API topology, environment variables, limits, and security status.
- `docs/design-review.md` — UI review and improvement priorities.

## Demo data

The landing page (`/`) uses hardcoded demo data and is labeled as demo. The
`/contracts` workspace performs real analysis against the API and database. Demo
content is never presented as real analysis.
