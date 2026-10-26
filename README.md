# ContractRipple

ContractRipple is a developer tool for reviewing API contract changes and understanding their
potential impact on frontend integrations. It compares OpenAPI specifications, classifies
potentially breaking changes, analyzes frontend source code for affected calls, and visualizes
the evidence-backed relationships.

> **Status:** Phase 8, Stage 6. The OpenAPI engine is wired to an Express API
> with PostgreSQL persistence. The authenticated workspace includes a dashboard,
> project and contract views, a real comparison workspace, saved history, and
> read-only analysis pages. Comparisons show classified findings with JSON
> Pointer evidence, ZIP/GitHub source analysis with file/line evidence, an
> evidence-backed operation→file impact graph with an accessible relationships
> view, JSON/Markdown report downloads, and regression review prompts derived
> from persisted findings. Phase 7 added email/password authentication with
> database-backed sessions, CSRF protection, server-side project ownership
> checks, security headers, and database-backed rate limits. The landing page
> (`/`) still renders clearly labeled demo content.

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
│       ├── src/            # services include reports + regression suggestions
│       └── prisma/         # schema + migrations
├── packages/
│   ├── engine/             # OpenAPI parse/validate/normalize/compare/classify
│   ├── source-analysis/    # TypeScript AST call detection + operation matching
│   ├── impact-graph/       # deterministic operation→source graph builder
│   └── shared/             # shared types and zod request schemas
├── docs/                   # plan, architecture, design review, engine/API/source/graph/report/release docs
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
# then set DATABASE_URL and AUTH_SECRET in apps/api/.env
# generate a secret with:
#   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# generate the Prisma client and apply migrations
npm run db:generate
npm run db:deploy
```

## Authentication

Accounts are email/password only. Passwords are hashed with `scrypt` and never
stored or returned. A successful register/login creates an opaque session token
that is stored in an `HttpOnly` cookie (`cr_session`); only its SHA-256 hash is
persisted. Unsafe requests must also send the session-derived CSRF token in
`x-csrf-token`, which the frontend keeps in memory.

Every project and nested resource is checked against the signed-in user on the
server. Another user's ids return `404`, not `403`. The first account you create
via `/login` is a normal account; there is no admin role.

For local development, `AUTH_SECRET` may be omitted (a development-only fallback
is used), but production startup fails without a real secret of at least 32
characters. See `docs/api.md` for auth endpoints and `docs/release-checklist.md`
before deploying.

## Run

```bash
# Frontend → http://localhost:3000  (sign in at /login; then /dashboard)
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

## Reports and regression checks

The comparison report header downloads the persisted analysis as JSON or
Markdown. Both exports include findings, limitations, notes, and the latest
source snapshot attached to that comparison; the JSON form is complete and the
Markdown form is readable, with summary tables, source evidence, and before/after
code blocks.

The workspace also renders operation-scoped regression suggestions derived from
the findings. They are review prompts, not generated executable tests or claims
that the API is broken. Nothing is invented for findings without a method and
path. Saved history loads in pages of 20 with a validated cursor.

See `docs/reports.md` for the report model, suggestion rules, latest-snapshot
policy, limits, and tests.

## Environment variables

Frontend (`.env.local`, see `.env.example`):

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | API base URL including `/api/v1`, or `/api/v1` when using the proxy |
| `API_PROXY_TARGET` | Optional API origin (no `/api/v1`) for the same-origin rewrite |

Backend (`apps/api/.env`, see `apps/api/.env.example`):

| Variable | Description |
| --- | --- |
| `NODE_ENV` | `development`, `test`, or `production` |
| `PORT` | API port (default `4000`) |
| `CORS_ORIGINS` | Comma-separated allowed browser origins (also used by the CSRF origin guard) |
| `DATABASE_URL` | PostgreSQL connection string (Phase 3+) |
| `AUTH_SECRET` | Session/CSRF secret; required in production, at least 32 characters |
| `AUTH_COOKIE_SECURE` | Session cookie `Secure` flag; defaults to true in production |
| `AUTH_COOKIE_SAME_SITE` | `lax` (default), `strict`, or `none` (requires secure cookies) |
| `TRUST_PROXY` | Trust forwarded client-IP headers; defaults to true in production |
| `GITHUB_TOKEN` | Optional server-side GitHub App/PAT token with read-only Contents access |
| `GITHUB_API_BASE_URL` | GitHub REST base URL (default `https://api.github.com`) |

Never commit real `.env` files. `.gitignore` ignores them but allows `.env.example`.
`AUTH_SECRET`, `DATABASE_URL`, and `GITHUB_TOKEN` are never returned by the API,
written to logs, or included in error responses. Leave `GITHUB_TOKEN` empty to
disable GitHub analysis; the API then reports `github_not_configured` instead of
faking a connection.

## API (current)

Base URL `/api/v1`. All responses are JSON; errors use a consistent
`{ error: { code, message, details? } }` envelope.

- `GET /health` — liveness.
- `GET /ready` — readiness including database connectivity (`200`/`503`).
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`
- `POST /projects`, `GET /projects`, `GET /projects/:projectId`,
  `PATCH /projects/:projectId`
- `POST /projects/:projectId/contracts`, `GET /projects/:projectId/contracts`,
  `GET /contracts/:contractId`
- `POST /contracts/:contractId/versions` (validates before saving),
  `GET /contracts/:contractId/versions`, `GET /versions/:versionId`
- `POST /projects/:projectId/comparisons`,
  `GET /projects/:projectId/comparisons` (cursor pagination),
  `GET /comparisons/:comparisonId`
- `GET /comparisons/:comparisonId/report?format=json|markdown` (download)
- `POST /projects/:projectId/source/zip` (multipart), `POST /projects/:projectId/source/github`,
  `GET /projects/:projectId/source`, `GET /source/:snapshotId`, `GET /github/status`

See `docs/api.md` for request/response fields, error codes, and limits.

> **Authentication is required.** Except for `/health`, `/ready`, and `/auth/*`,
> every route needs a session cookie and, for unsafe methods, `x-csrf-token`.
> Data routes are scoped to the authenticated user's projects.

## Testing

Unit and route tests use Vitest and live next to the code they cover:

- `packages/shared/src/*.test.ts` — error guards and API request schemas.
- `packages/engine/src/*.test.ts` — parsing, validation, comparison, classification, security.
- `packages/source-analysis/src/*.test.ts` — AST call detection, path matching, template paths, limits.
- `packages/impact-graph/src/*.test.ts` — graph grouping, matching, filters, limits, evidence, and deterministic ordering.
- `apps/api/src/services/*.test.ts` — project/contract/comparison/source/report services with an in-memory repository; auth, password hashing, session expiry, and rate limiting; regression-suggestion grouping, evidence bounds, and stable ordering.
- `apps/api/src/routes/app.test.ts`, `apps/api/src/routes/auth.test.ts`, `apps/api/src/routes/authorization.test.ts`, `apps/api/src/routes/source.test.ts`, `apps/api/src/routes/reports.test.ts` — real HTTP requests against an ephemeral server, including auth cookies/CSRF, cross-user IDOR checks, security headers, pagination, and JSON/Markdown downloads.

```bash
npm test
```

The engine tests cover parsing/validation failures, all required change classes,
references, circular references, external references, deterministic ordering,
JSON Pointer escaping, input limits, and security cases. The graph tests cover
grouping, normalized matching, unmatched evidence, filters, limits, deterministic
ordering, and the no-missing-endpoints guarantee. The API tests cover input
validation, engine error mapping, persistence DTOs, authentication and CSRF,
session expiry, rate limiting, security headers, cross-user IDOR checks for every
resource family, ZIP traversal and size limits, GitHub error mapping,
saved-history pagination, report downloads, regression-suggestion generation,
and the full authenticated project → contract → version → comparison →
source-analysis flow.

One PostgreSQL integration test is skipped by default. Run it against a
configured `apps/api/.env` database with:

```bash
# Windows (cmd)
set RUN_DB_TESTS=1&& npx vitest run apps/api/src/db

# macOS/Linux
RUN_DB_TESTS=1 npx vitest run apps/api/src/db
```

It creates a user, project, two versions, a comparison, and a ZIP source
snapshot, reads them back, then deletes the project and user.

## Deployment

- **Frontend:** Vercel project `contractripple`, rooted at the repository root
  (current live site: `contractripple.vercel.app`).
- **Backend:** Vercel project `contractripple-api`, rooted at `apps/api`
  (current live API: `contractripple-api.vercel.app/api/v1`).
- **Database:** managed PostgreSQL; migrations are run deliberately with
  `npm run db:deploy`, never automatically on server start.
- Set `NEXT_PUBLIC_API_BASE_URL` on the frontend (plus optional
  `API_PROXY_TARGET`), and `DATABASE_URL`, `CORS_ORIGINS`, `AUTH_SECRET`, and
  the optional `GITHUB_TOKEN` on the API. Use HTTPS and exact CORS origins.
- Apply the Phase 7 migration before switching traffic. Review
  `docs/release-checklist.md` first; pre-Phase-7 projects have no owner and are
  inaccessible until assigned.
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
- `docs/reports.md` — report exports, regression suggestions, latest-snapshot policy, and limits.
- `docs/deployment.md` — Vercel frontend/API topology, environment variables, limits, and security status.
- `docs/release-checklist.md` — pre-merge, migration, deploy, verification, and rollback checklist.
- `docs/design-review.md` — UI review and improvement priorities.

## Demo data

The landing page (`/`) uses hardcoded demo data and is labeled as demo. The
`/contracts` workspace performs real analysis against the API and database. Demo
content is never presented as real analysis.
