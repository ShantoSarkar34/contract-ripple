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
| **2** | OpenAPI engine | parsing, validation, comparison, classification, tests, clean engine interface | **In review** |
| **3** | Backend + database | Prisma models, `/api/v1`, persistence, real frontend integration | Planned |
| **4** | Source analysis | AST matching, secure ZIP pipeline, real GitHub integration, evidence | Planned |
| **5** | Impact graph + UI | evidence-backed graph, filterable findings, accessible views | Planned |
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
- **Demo data:** the current UI is hardcoded. It must remain labeled until Phase 3 wires real APIs.
- **Parser mutation:** `@readme/openapi-parser` dereferences in place and can
  create circular object graphs. The engine validates a clone; do not remove
  that isolation when wiring Phase 3.
- **External references:** uploaded contracts may contain external `$ref`s.
  They are never fetched; changes involving them are `unknown`, not silently
  assumed safe.
- **YAML resource exhaustion:** alias bombs and circular aliases are bounded or
  rejected. Keep these limits when adding alternate parsers.
