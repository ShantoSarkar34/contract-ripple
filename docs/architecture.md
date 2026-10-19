# ContractRipple — Architecture

## Current state (Phase 1)

The repository currently contains one application: a Next.js App Router frontend at the repository
root. It renders a single marketing/demo page from hardcoded component data. There is no backend,
database, authentication, or analysis code yet.

```
contract-ripple/            # git repo root
├── src/app/                # Next.js App Router (frontend)
├── src/components/         # presentation components (demo data)
├── apps/api/               # Express API scaffold (new)
├── packages/shared/        # shared types/schemas (new)
├── docs/                   # plans, architecture, design review
├── .env.example            # frontend placeholders
└── apps/api/.env.example   # backend placeholders
```

## Monorepo strategy

**Incremental, not destructive.** The frontend remains at the root so the existing Vercel
deployment (`contractripple.vercel.app`) is unaffected. npm workspaces attach `apps/api` and
`packages/shared`.

Future target (requires separate approval and a Vercel root-directory change):

```
apps/web/        # moved Next.js frontend
apps/api/        # Express backend
packages/shared/ # shared schemas/types
docs/
prompts/
```

Moving the frontend is not performed in Phase 1 because it risks breaking the live deployment.

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

### Analysis engine (Phase 2)
Separate, independently testable modules:

```
parse (JSON/YAML) → validate → normalize → compare → classify → serialize findings
```

- Parsing/validation must not be coupled to HTTP.
- Comparison results are normalized into a stable finding model.
- Classification labels: `non_breaking`, `potentially_breaking`, `unknown`.
- Every finding carries an explanation and an evidence path/JSON Pointer where available.

## Data flow (target)

```
Contract upload (JSON/YAML)
        │
        ▼
Validate + normalize ──► ContractVersion (PostgreSQL)
        │
        ▼
Compare baseline ↔ candidate ──► Findings (normalized, classified)
        │
        ├──► Source analysis (ZIP / GitHub) ──► SourceReferences + evidence
        │
        ├──► Impact graph (nodes/edges from real findings + references)
        │
        └──► Reports (JSON / readable) + regression suggestions
```

## API surface (planned, Phase 3+)

Under `/api/v1`:

- `GET /health` — liveness (implemented in Phase 1 scaffold).
- `GET /ready` — readiness, including database connectivity (Phase 3).
- Projects: create/list/read/update.
- Contract versions: upload/validate/read.
- Comparisons: run comparison, read saved analysis runs and findings.
- Source analysis: ZIP upload and GitHub-connected analysis (Phase 4).
- Reports/exports (Phase 6).

All mutating endpoints will require authentication and ownership checks in Phase 7.

## Security boundaries

- Contract and source content are **untrusted input**.
- Never execute uploaded or repository code.
- Enforce upload size, decompressed size, entry count, and processing time limits.
- Reject path traversal, absolute paths, symlinks, and malformed archives.
- GitHub credentials remain server-side, are redacted from logs, and are never returned to clients.
- No secrets in logs, client responses, or repository files.
- CORS uses an explicit origin allowlist from environment configuration.

## Persistence (planned, Phase 3)

Prisma + PostgreSQL. Planned models: `Project`, `Contract`, `ContractVersion`, `AnalysisRun`,
`Finding`. Ownership fields are added with authentication in Phase 7. No models exist yet; the
Phase 1 `schema.prisma` contains only the datasource/generator so model design happens with the API.

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
- OpenAPI parser/diff library choice (evaluated and documented in Phase 2).
- Graph library choice (evaluated and documented in Phase 5).
