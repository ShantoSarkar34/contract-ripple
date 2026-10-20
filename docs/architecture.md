# ContractRipple — Architecture

## Current state (Phase 5)

The repository contains one Next.js application at the repository root, an
Express API with persistence, a shared types/schemas package, a standalone
OpenAPI comparison engine, a source-analysis package, and a standalone impact
graph builder. The `/contracts` route is wired to the real API and database;
source analysis (ZIP and GitHub) is available for a comparison, and the
source-impact panel renders an evidence-backed operation→file map with a
filterable findings table and an accessible relationships view. The marketing
page (`/`) still renders clearly labeled demo content.

```
contract-ripple/            # git repo root
├── src/app/                # Next.js App Router (frontend)
│   └── contracts/          # real workspace (client component)
├── src/components/         # presentation components (demo + contracts workspace)
├── src/lib/                # frontend API client and view helpers
├── apps/api/               # Express API (routes, services, repositories)
│   └── prisma/             # Prisma schema + migrations
├── packages/shared/        # shared types/schemas (zod request schemas)
├── packages/engine/        # OpenAPI parse/validate/normalize/compare/classify
├── packages/source-analysis/ # TypeScript AST call detection + path matching
├── packages/impact-graph/  # deterministic findings + impacts → operation/file graph
├── docs/                   # plans, architecture, design review, engine/API/source/graph docs
├── .env.example            # frontend placeholders
└── apps/api/.env.example   # backend placeholders
```

Tests live beside the source in `packages/shared`, `packages/engine`,
`packages/source-analysis`, `packages/impact-graph`, and `apps/api` and run
through Vitest. One database integration test is skipped unless
`RUN_DB_TESTS=1` is set.

## Monorepo strategy

**Incremental, not destructive.** The frontend remains at the root so the existing Vercel
deployment (`contractripple.vercel.app`) is unaffected. npm workspaces attach `apps/api`,
`packages/shared`, `packages/engine`, `packages/source-analysis`, and `packages/impact-graph`.

Future target (requires separate approval and a Vercel root-directory change):

```
apps/web/        # moved Next.js frontend
apps/api/        # Express backend
packages/shared/ # shared schemas/types
packages/engine/ # OpenAPI comparison engine
packages/source-analysis/ # source AST analysis
packages/impact-graph/    # graph construction
docs/
prompts/
```

Moving the frontend is not performed in this phase because it risks breaking the live deployment.

## Boundaries

### Frontend (`src/`)
- Rendering, routing, interaction, and presentation only.
- Calls the backend through a configurable base URL (`NEXT_PUBLIC_API_BASE_URL`).
- Must display real loading, empty, success, error, and partial states.
- Must not embed business logic that belongs in the engine or API.
- Must never silently substitute demo findings when a request fails.

### Backend (`apps/api/`)
- Express application exposing a versioned REST API under `/api/v1`.
- Validates requests, enforces limits, applies CORS allowlists, and returns consistent errors.
- Calls the analysis engine; the engine is not duplicated in the API layer.
- Owns persistence through Prisma.
- Never trusts client-side authorization.

### Shared (`packages/shared/`)
- Genuinely shared types and schemas only.
- No framework-specific code, no database access, no analysis implementation.

### Analysis engine (`packages/engine`)
Independent, testable modules:

```
parse (JSON/YAML) → validate → canonicalize → normalize → compare → classify → serialize findings
```

- Parsing/validation is not coupled to HTTP.
- Comparison results are normalized into a stable finding model with
  deterministic IDs and ordering.
- Classification labels: `non_breaking`, `potentially_breaking`, `unknown`.
- Every finding carries an explanation and an evidence JSON Pointer where
  available.
- External references are never fetched. Circular references are detected.
- See `docs/engine.md` for the public interface, classification rules,
  library evaluation, and limitations.

### Source analysis (`packages/source-analysis/`)
- Framework-agnostic TypeScript/JavaScript AST analysis using the TypeScript
  compiler API.
- Detects statically resolvable HTTP calls (`fetch`, Axios, API-client wrappers,
  request helpers) and matches them against changed OpenAPI operations.
- Produces evidence (file, line, column, snippet, detected and matched
  method/path, confidence) and explicit limitations.
- Never executes source, never fetches external URLs, and never resolves
  dynamic values.
- See `docs/source-analysis.md` for supported patterns, matching rules, and
  security limits.

### Impact graph (`packages/impact-graph/`)
- Dependency-free, deterministic builder that groups comparison findings into
  changed operations and connects them to persisted source impacts by normalized
  method + path.
- Emits operation nodes, file nodes, and evidence-bearing relationships; never
  invents a relationship that is not present in the inputs.
- Applies risk/category/method/confidence/query filters and explicit operation,
  file, relationship, and evidence limits. Unmapped findings and unmatched
  impacts become limitations rather than being silently dropped or reattached.
- Built in the browser from existing DTOs; there is no graph-specific API or
  database table.
- See `docs/impact-graph.md` for the model, construction rules, limits, library
  evaluation, and UI/accessibility behavior.

## Data flow (implemented in Phase 5)

```
Contract upload (JSON/YAML text, ≤ 5 MiB)
        │
        ▼
Engine parse + validate + normalize ──► ContractVersion (PostgreSQL, raw text + checksum)
        │
        ▼
Compare stored baseline ↔ candidate ──► AnalysisRun + Finding rows (classified)
        │
        ├──► /contracts workspace: filterable findings table + JSON Pointer evidence
        │
        ├──► Source analysis (ZIP / GitHub) ──► SourceSnapshot + SourceFile + SourceImpact
        │                                      (evidence: file, line, snippet, confidence)
        ├──► Impact graph (client-side: changed operations ↔ persisted source matches,
        │                  map + accessible relationships table, evidence details)
        └──► Reports (JSON / readable) + regression suggestions               (Phase 6)
```

## API surface (implemented in Phase 5)

Under `/api/v1`:

- `GET /health` — liveness.
- `GET /ready` — readiness, including database connectivity (`200`/`503`).
- Projects: `POST /projects`, `GET /projects`, `GET /projects/:projectId`,
  `PATCH /projects/:projectId`.
- Contracts: `POST /projects/:projectId/contracts`,
  `GET /projects/:projectId/contracts`, `GET /contracts/:contractId`.
- Versions: `POST /contracts/:contractId/versions` (validates before saving),
  `GET /contracts/:contractId/versions`, `GET /versions/:versionId`.
- Comparisons: `POST /projects/:projectId/comparisons`,
  `GET /projects/:projectId/comparisons`, `GET /comparisons/:comparisonId`.
- Source analysis: `POST /projects/:projectId/source/zip` (multipart),
  `POST /projects/:projectId/source/github`,
  `GET /projects/:projectId/source`, `GET /source/:snapshotId`,
  `GET /github/status`.
- Reports/exports (Phase 6).

The impact graph is a client-side projection of the comparison and source DTOs;
it adds no endpoints or database tables.

See `docs/api.md` for request/response shapes and error codes. All mutating
endpoints will require authentication and ownership checks in Phase 7.

## Security boundaries

- Contract and source content are **untrusted input**.
- Never execute uploaded or repository code.
- Enforce upload size, decompressed size, entry count, and processing time limits.
- Reject path traversal and absolute paths. ZIPs are extracted in memory only, so
  symlink entries cannot escape or write outside a controlled location.
- GitHub credentials remain server-side, are redacted from logs, and are never returned to clients.
- No secrets in logs, client responses, or repository files.
- CORS uses an explicit origin allowlist from environment configuration.

## Persistence (implemented in Phase 5)

Prisma + PostgreSQL. Models: `Project`, `Contract`, `ContractVersion`,
`AnalysisRun`, `Finding`, `SourceSnapshot`, `SourceFile`, and `SourceImpact`,
with `AnalysisStatus` as a Postgres enum. Phase 5 adds no schema changes; the
impact graph is derived from these records. Cascading deletes remove contracts,
versions, runs, findings, and source snapshots with their parent project (source
snapshots keep their comparison via `onDelete: SetNull`). `ContractVersion`
stores untrusted spec text plus a SHA-256 checksum; `Finding` and `SourceImpact`
keep their order via `position`. Source snapshots store file metadata and
evidence snippets, not full file contents. Ownership fields are added with
authentication in Phase 7. Migrations live in `apps/api/prisma/migrations` and
are applied with `prisma migrate deploy`.

## Deployment

- **Frontend:** Vercel, repository root (current). If moved to `apps/web`, update the Vercel root
  directory in the same change.
- **Backend:** separate host capable of running Node/Express and Prisma migrations.
- **Database:** managed PostgreSQL.
- Environment-based configuration; HTTPS; CORS allowlists; safe migrations; no destructive
  production operations without authorization.

## Open decisions

- Backend hosting provider (decided in Phase 7 after runtime requirements are verified).
- Full monorepo move of the frontend to `apps/web` (separate approved migration).
- OpenAPI parser/diff library choice — resolved in Phase 2 and documented in
  `docs/engine.md`.
- Graph library choice — resolved in Phase 5: a dependency-free, deterministic
  SVG layout with an accessible table fallback was chosen over React Flow,
  d3-force, and Cytoscape. See `docs/impact-graph.md`.
