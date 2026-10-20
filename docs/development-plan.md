# ContractRipple — Development Plan

## Product scope

ContractRipple is a developer tool for reviewing API contract changes and understanding their
potential impact on frontend integrations. The application will:

1. Create and manage projects.
2. Upload and validate OpenAPI JSON/YAML contracts.
3. Compare two API contract versions.
4. Classify changes and explain compatibility risk.
5. Analyze supported TypeScript/JavaScript source via ZIP upload.
6. Analyze GitHub repositories through a real, configured integration.
7. Show affected files and source evidence where detectable.
8. Visualize API-to-source relationships in an interactive graph.
9. Save analysis history.
10. Export analysis reports.
11. Suggest regression tests based on actual findings.
12. Add authentication and server-side authorization in the final phase.

Everything must be computed from real input. Demo content must stay clearly labeled and must never
be presented as real analysis.

## Architecture summary

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS.
- **Backend:** Node.js, Express, TypeScript, versioned REST API at `/api/v1`.
- **Database:** PostgreSQL via Prisma ORM.
- **Shared package:** schemas and types used by both apps.
- **Repository:** npm workspaces monorepo.
- **Deployment:** frontend and backend deployed independently.

See `docs/architecture.md` for boundaries and data flow.

## Implementation phases

| Phase | Scope | Key deliverables | Status |
| --- | --- | --- | --- |
| **0** | Permanent instructions | `AGENTS.md` | **Done** |
| **1** | Audit + foundation | audit report, `docs/development-plan.md`, `docs/architecture.md`, `docs/design-review.md`, scripts, env examples, Express/Prisma scaffold | **Done** |
| **2** | OpenAPI engine | parsing, validation, comparison, classification, tests, clean engine interface | **Done** |
| **3** | Backend + database | Prisma models, migrations, `/api/v1`, persistence, real frontend integration | **Done** |
| **4** | Source analysis | AST matching, secure ZIP pipeline, real GitHub integration, evidence | **Done** |
| **5** | Impact graph + UI | evidence-backed graph, filterable findings, accessible views | **In review** |
| **6** | Reports + history | saved history, JSON/readable exports, regression suggestions | Planned |
| **7** | Auth + security + deploy | sessions, authorization, IDOR tests, hardening, release checklist | Planned |

Each phase ends with a completion report and stops. No phase starts automatically.

## Phase 1 decisions (this phase)

- **Monorepo migration is incremental.** The deployed Next.js app stays at the repository root so
  the live Vercel deployment keeps working. `apps/api` and `packages/shared` are added as npm
  workspaces. Moving the frontend to `apps/web` is deferred to a separate, approved migration
  because it requires changing the Vercel project's root directory and could break the live site.
- **Package manager:** npm with `package-lock.json`. No second lockfile will be introduced.
- **Build tooling:** `next dev/build --webpack` because Turbopack native bindings are unavailable on
  the current Windows development host.
- **Backend scaffold only.** Health endpoint plus configuration and Prisma schema. No analysis
  engine, persistence models, authentication, GitHub integration, or source analysis yet.

## Phase 2 decisions (this phase)

- **Engine package:** `packages/engine` is a standalone npm workspace with no
  HTTP, database, auth, GitHub, ZIP, or graph dependencies. The public entry
  point is `compareContracts`.
- **Parser:** `@readme/openapi-parser` 9.1.0 validates OpenAPI 3.0.x/3.1.x.
  External and file resolution are disabled. Because `validate()` mutates and
  dereferences its input, the engine validates a clone while keeping the
  original `$ref` structure for its own cycle-safe normalizer.
- **YAML:** `yaml` 2.9.1 with strict parsing, unique keys, `maxAliasCount: 100`,
  and the core schema. No executable/custom tags.
- **Custom comparator:** `openapi-diff` was evaluated but not selected because
  it does not expose stable JSON Pointers/evidence for every change and its
  OpenAPI 3.1 support was unverified. A controlled comparator guarantees
  deterministic ordering, direction-aware classifications, and explicit
  `unknown` handling.
- **Risk model:** `non_breaking`, `potentially_breaking`, and `unknown`, with
  request-versus-response rules and human-readable explanations. The rules live
  in `classify.ts`, separate from traversal.
- **Determinism:** parameters and `oneOf`/`anyOf` alternatives are canonicalized
  before normalization; findings are sorted and assigned deterministic IDs.
- **Security limits:** 5 MiB per document by default (50 MiB cap), 128-level
  nesting, circular-alias rejection, 5-second validation timeout, external refs
  disabled, and a 5,000-finding default cap (100,000 cap).

See `docs/engine.md` for the full interface, classification table, and
limitations.

## Phase 3 decisions (this phase)

- **Persistence models:** `Project`, `Contract`, `ContractVersion`,
  `AnalysisRun`, and `Finding` in PostgreSQL. `ContractVersion` stores the raw
  JSON/YAML text plus a SHA-256 checksum and parsed metadata; `AnalysisRun`
  stores summary counts, engine limitations, and the baseline/candidate
  summaries; `Finding` stores one row per engine finding with its original
  order (`position`) so reads are stable.
- **Migrations without a shadow database:** the initial migration was generated
  with `prisma migrate diff --from-empty --to-schema-datamodel` and applied with
  `prisma migrate deploy`, because the managed Prisma Postgres instance does not
  provide a shadow database for `migrate dev`. A second incremental migration
  adds `Finding.position`.
- **Repository boundary:** services depend on a `Repository` interface. A
  Prisma implementation is used in production and an in-memory implementation is
  used by route/service tests. This keeps HTTP and engine tests independent of a
  database.
- **Request validation:** `zod` schemas live in `packages/shared` and are reused
  by the API; the client imports their inferred types. Unknown fields are
  stripped, and body size is bounded before the engine runs.
- **Upload size handling:** contract text is sent as a JSON string, so the
  Express JSON body limit is 8 MiB, slightly above the engine's 5 MiB
  per-document limit. Comparisons reference stored version IDs, so comparison
  requests stay small.
- **Errors:** services throw typed `HttpError`s; engine failures are mapped to
  `400`/`413`/`422` with stable codes and sanitized details. The API never
  returns raw spec contents or stack traces.
- **Frontend wiring:** the `/contracts` route is a client workspace that talks
  to the API through `NEXT_PUBLIC_API_BASE_URL`, showing real loading, empty,
  error, and result states. The marketing page keeps clearly labeled demo
  content.
- **No authentication yet:** as agreed, auth and ownership checks are deferred to
  Phase 7. Until then the API must not be exposed publicly with real user data.

See `docs/api.md` for the endpoint reference.

## Phase 4 decisions (this phase)

- **Separate source package:** `packages/source-analysis` owns TypeScript AST
  parsing, call detection, path matching, and evidence generation. The API layer
  only handles input transport (ZIP/GitHub), persistence, and HTTP errors.
- **Parser:** the TypeScript compiler API is used at runtime. It is already a
  repository dependency, handles TS/TSX/JS/JSX without executing code, and is
  error-tolerant for partially invalid files.
- **Conservative detection:** only calls with a statically resolvable method and
  path are reported. Supported shapes are `fetch`, Axios member/config calls,
  API-client member calls, and request helpers. A detected call is only returned
  when it matches an operation changed by an existing comparison, which keeps
  heuristic false positives out of the results.
- **Matching:** exact normalized path matches are `high` confidence; shared
  API-prefix suffix matches are `medium`; template-literal paths with
  interpolations are capped at `medium`. OpenAPI `{param}`, Express `:param`,
  and template `{}` segments are treated as single-segment wildcards.
- **ZIP security:** uploads are held in memory (never extracted to disk), checked
  for ZIP magic, bounded by compressed size (10 MiB), entry count (5,000),
  source files (2,000), total uncompressed size (25 MiB), and per-file size
  (1 MiB). Absolute paths, drive letters, null bytes, empty segments, and `..`
  traversal are rejected. Only UTF-8 TS/JS files are read. The analyzer also
  enforces a 20-second wall-clock budget.
- **GitHub integration:** server-side `GITHUB_TOKEN` (GitHub App installation
  token or fine-grained PAT with read-only Contents permission). The API uses the
  official REST API to resolve the ref, read the recursive tree, and fetch
  bounded blobs with a 15-second per-request timeout and a 60-second overall
  budget. It never clones or executes repository code. Without a token it
  returns `503 github_not_configured`; it never fakes a connection.
- **Persistence:** `SourceSnapshot`, `SourceFile`, and `SourceImpact` store
  analysis metadata, scanned/skipped file paths, and ordered evidence snippets.
  Full source contents are not persisted.
- **Frontend:** the `/contracts` workspace gains a source-impact panel after a
  comparison, with ZIP upload, GitHub repository analysis (disabled honestly when
  the server has no token), evidence grouped by file, limitations, and snapshot
  history.
- **Migration:** generated with `prisma migrate diff --from-schema-datasource`
  and applied with `prisma migrate deploy`, because the managed database has no
  shadow database.

See `docs/source-analysis.md` and `docs/api.md` for details.

## Non-goals for Phase 4

- OAuth login or per-user GitHub App installation flows (deferred to Phase 7
  with authentication/session handling).
- Impact graph construction and interactive visualization (Phase 5).
- Report exports and regression-test suggestions (Phase 6).
- Runtime/dynamic URL resolution, code execution, dependency installation, or
  repository cloning.
- Background queues, per-user rate limits, or analysis caching.

## Phase 5 decisions (this phase)

- **Standalone graph builder:** `packages/impact-graph` is dependency-free and
  deterministic. It groups findings into operations, matches persisted source
  impacts by normalized method + path, and emits evidence-bearing nodes and
  edges. The UI never invents relationships; anything that cannot be graphed is
  reported as a limitation.
- **No graph API or table:** the graph is a client-side projection of
  `AnalysisRunDetailDto.findings` and `SourceSnapshotDetailDto.impacts`. The
  backend and Prisma schema are unchanged in this phase.
- **Conservative key matching:** methods are lower-cased and trimmed; paths get
  a leading slash, collapsed duplicate slashes, and no trailing slash (except
  root). Backslashes are normalized so Windows-created ZIP paths match.
- **Proof before drawing:** an edge exists only when a persisted `SourceImpact`
  names a changed operation. A file node exists only through an edge. Risk is
  the highest finding risk for the operation; confidence is the highest match
  confidence for the relationship.
- **Deterministic limits:** 200 operations, 400 files, 800 relationships, and 20
  evidence entries per node/relationship. Limits are applied in that order so
  no edge points at a dropped node, and every truncation is reported.
- **Custom SVG instead of a graph library:** React Flow, d3-force, and Cytoscape
  were evaluated. A small deterministic SVG layout keeps the client bundle
  lean, produces a stable two-column layout, and pairs naturally with an
  equivalent semantic table for keyboard and screen-reader users. Details are in
  `docs/impact-graph.md`.
- **Dense findings table:** the card-per-finding comparison list is replaced by
  a filterable table (risk, category, method, search) with expandable evidence
  rows and incremental "Show more". Long paths are truncated visually but
  available through the title attribute and expanded evidence.
- **Accessibility and shell polish:** the graph has a Map/Relationships toggle;
  the relationships table is always the accessible equivalent. The workspace
  gains a sticky context bar with section anchors, the navbar drops dead links
  and gains a mobile menu, the loaded Geist font is applied, focus-visible
  outlines are global, and Tailwind dark mode follows the same
  `prefers-color-scheme` strategy as the CSS variables.
- **Honest empty/partial states:** filters, unmatched findings/impacts, missing
  source analysis, no matches, and truncation each have explicit text. The graph
  never hides an unmatched operation behind a fabricated file edge.

## Non-goals for Phase 5

- Report export, saved-history pagination, and regression-test suggestions
  (Phase 6).
- Authentication, authorization, per-user ownership, and public deployment
  hardening (Phase 7).
- Graph editing, drag-and-drop, zoom/pan canvases, or a new graph database.
- Runtime verification, code execution, or fetching additional source files.
- Changing the frontend's repository location or Vercel deployment settings.
- Replacing the landing page's clearly labeled demo content with fabricated
  analysis results.

## Non-goals for Phase 3

- Authentication/authorization and per-user ownership.
- Source analysis (ZIP upload, AST matching) and GitHub integration.
- Impact graph construction and report exports.
- Regression-test suggestions.
- Rate limiting, request quotas, and background/queued analysis.

## Non-goals for Phase 1

- OpenAPI comparison logic.
- Database models or migrations.
- Authentication/authorization.
- GitHub OAuth/App integration.
- ZIP/source analysis.
- Impact graph.
- Full UI redesign.

## Non-goals for Phase 2

- Database models, migrations, and persistence.
- Express routes that accept or store contracts.
- Authentication/authorization.
- GitHub OAuth/App integration.
- ZIP/source analysis, AST matching, and graph construction.
- Frontend wiring to real comparison results.
- Full JSON Schema validation or example-payload validation.

## Risks and open questions

- **Vercel root directory:** if the frontend later moves to `apps/web`, the Vercel project root must
  be updated in the same change window.
- **Lint dependency corruption:** `hermes-parser` was partially installed; Phase 1 repairs the local
  install and verifies lint. CI should use a clean `npm ci`.
- **Windows/SWC:** native `@next/swc-win32-x64-msvc` fails to load; Next falls back to WASM. Keep
  `--webpack` until the environment is verified otherwise.
- **Demo data:** the landing page (`/`) is still hardcoded and must stay labeled as demo. The
  `/contracts` workspace now shows real analysis only; do not reintroduce hardcoded results there.
- **Parser mutation:** `@readme/openapi-parser` dereferences in place and can
  create circular object graphs. The engine validates a clone; do not remove
  that isolation in the API/engine integration.
- **External references:** uploaded contracts may contain external `$ref`s.
  They are never fetched; changes involving them are `unknown`, not silently
  assumed safe.
- **Static source analysis:** dynamic URLs, custom wrappers, generated clients,
  GraphQL/WebSockets, and runtime composition are out of scope. Results are
  evidence-backed matches, not a guarantee of complete impact discovery.
- **Graph is a projection, not new evidence:** the impact graph can only show
  relationships already present in persisted comparison/source records. Keep it
  downstream of validation and matching; do not add inferred imports, call
  graphs, or speculative edges to make the visualization denser.
- **Graph limits and accessibility:** large analyses are capped at 200
  operations, 400 files, and 800 relationships, with 20 evidence entries per
  relation. Truncation is reported. The SVG map is pointer-oriented; preserve
  the equivalent semantic table when changing the graph UI.
- **GitHub credential scope:** Phase 4 uses one server-side `GITHUB_TOKEN`
  (installation token or fine-grained PAT). Per-user OAuth/App installation and
  token storage require the authentication/session work in Phase 7. Rotate the
  token if it is ever exposed; it must never be logged or returned to clients.
- **YAML resource exhaustion:** alias bombs and circular aliases are bounded or
  rejected. Keep these limits when adding alternate parsers.
