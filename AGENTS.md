# ContractRipple — Permanent Project Instructions

These instructions apply to every phase of this project. Read them fully before editing any file. Do not start the next phase automatically.

---

## 0. Phase workflow (mandatory)

Before each phase:

1. Open the actual `contract-ripple` repository in OpenCode.
2. Check `git status` and commit or back up current work.
3. Give OpenCode only the prompt for the current phase.
4. Review the files changed and test the result.
5. Do not proceed until the phase's acceptance criteria are satisfied.

### Branch policy (mandatory)

- Do all phase work on the `open-branch` branch. Do not create a separate branch for each phase.
- Commit and push each phase to `origin/open-branch`.
- Never push to `main`. The user reviews and merges `open-branch` into `main` manually.
- If `open-branch` is behind `origin/main`, fast-forward it from `origin/main` before starting a phase.

Before editing any files, inspect the existing repository, its Git status, package manager, dependencies, application structure, tests, and deployment configuration.

At the end of every phase, produce the completion report defined in section 9 and then stop.

---

## 1. Project mission

ContractRipple is a full-stack developer tool that:

- compares OpenAPI specifications,
- identifies potentially breaking API changes,
- analyzes frontend source code to identify potentially affected integrations,
- visualizes evidence-backed relationships, and
- generates analysis reports and regression-test suggestions.

This must become a real, working application — not just a dashboard with hardcoded content.

---

## 2. Technology stack

Target architecture:

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS.
- **Backend:** Node.js, Express.js, TypeScript.
- **Database:** PostgreSQL.
- **ORM:** Prisma.
- **Repository:** monorepo with independently deployable frontend and backend.
- **Source input:** ZIP archive upload and GitHub repository integration.
- **Testing:** automated unit, integration, and frontend tests.

Suggested target structure:

- `apps/web` — Next.js frontend.
- `apps/api` — Express backend.
- `packages/shared` — genuinely shared schemas and types.
- `docs` — architecture, setup, security, and development documentation.
- `prompts` — phase-specific implementation prompts.

This structure is a **target**, not permission to rewrite the existing repository without inspection. Determine the safest migration path first and obtain approval before restructuring.

**Current baseline (inspected at Phase 7):** the Next.js app lives at the repository root (`src/app`), not in `apps/web`. The Express API (`apps/api`) has Prisma models, migrations, REST routes, persistence, auth/session/rate-limit services, report exports, and regression suggestions; `packages/shared` holds shared types plus zod request/query/auth schemas; `packages/engine` holds the OpenAPI comparison engine; `packages/source-analysis` holds the TypeScript AST analyzer; `packages/impact-graph` builds the evidence-backed operation→file graph. Tests and `docs` exist. See section 10 for verified details. Migration to the monorepo layout must be planned and approved as its own task.

---

## 3. Mandatory coding rules

1. Inspect actual files before modifying them.
2. Preserve working functionality and the existing deployed frontend (`contractripple.vercel.app`).
3. Implement only the phase explicitly requested.
4. Do not replace the application wholesale without explaining why and obtaining approval.
5. Use small, focused modules and reusable components.
6. Use TypeScript properly; avoid unnecessary `any`, unsafe casts, and suppressed compiler errors.
7. Add tests for core business logic and edge cases.
8. Use maintained libraries when appropriate instead of reinventing complex parsers.
9. Never fabricate findings, API responses, metrics, successful tests, or integration status.
10. Clearly label demo content. Never silently display demo results as real analysis.
11. Validate all API inputs, uploaded files, repository contents, and external responses.
12. Never execute uploaded source code or install dependencies from an uploaded repository.
13. Never expose credentials, tokens, secrets, or sensitive source code in logs or client responses.
14. Do not commit `.env` files or real credentials.
15. Keep README, environment examples, and setup instructions synchronized with the actual implementation.
16. Do not perform destructive database operations, force pushes, or production changes without explicit authorization.
17. Run available tests, lint, type checks, and production builds after changes. Report actual results honestly.
18. Do not start the next phase automatically.

---

## 4. Product requirements

The completed product should support:

1. Creating projects.
2. Uploading and validating OpenAPI JSON/YAML contracts.
3. Comparing two API contract versions.
4. Classifying changes and explaining potential compatibility risks.
5. Analyzing supported TypeScript/JavaScript source code through ZIP uploads.
6. Analyzing GitHub repositories through a real, configured integration.
7. Showing affected files and source evidence where detectable.
8. Visualizing API-to-source relationships in an interactive graph.
9. Saving analysis history.
10. Exporting reports.
11. Suggesting regression tests based on actual findings.
12. Adding authentication and server-side authorization in the final phase.

---

## 5. Analysis accuracy

- Separate contract parsing, validation, normalization, comparison, risk classification, source parsing, source matching, graph construction, and report generation into testable modules.
- Distinguish observed differences from inferred risks.
- Use labels such as `non_breaking`, `potentially_breaking`, and `unknown` where appropriate.
- Do not claim complete frontend impact discovery. Dynamic URLs, custom API wrappers, generated clients, and runtime behavior may prevent static analysis from finding every affected file.
- Every graph relationship and source impact must be supported by actual analysis evidence.

---

## 6. ZIP and GitHub security

### ZIP uploads

- Enforce upload, decompressed-size, entry-count, and processing-time limits.
- Reject path traversal and unsafe archive entries.
- Extract into a controlled temporary directory and clean it up.
- Analyze supported source files only.
- Never execute uploaded code.

### GitHub

- Use the official GitHub API and an appropriate OAuth or GitHub App flow.
- Request minimum required permissions.
- Keep credentials server-side and protected.
- Handle rate limits, revoked access, permissions, and API failures.
- Never fake a successful connection when credentials are missing.
- Never execute repository code or install its dependencies.

---

## 7. Design standards

- Create a professional developer-tool interface with consistent typography, spacing, hierarchy, accessible controls, and restrained colors.
- Avoid generic dashboard filler, fake metrics, unnecessary gradients, decorative graphs, and excessive animation.
- Provide clear loading, empty, success, error, and partial-result states.
- Preserve useful existing components.

---

## 8. Authentication and deployment

- Authentication is deliberately deferred until Phase 7. Before production user data is exposed, implement authentication and server-side ownership checks, or obtain explicit approval for a documented, appropriately restricted alternative.
- Deploy the frontend and backend separately.
- Use environment-based configuration, HTTPS, appropriate CORS, secure file handling, rate limits, and safe database migrations.

---

## 9. Required completion report

At the end of every phase, report:

- Summary of changes.
- Important files changed.
- Commands actually run and their results.
- Tests added and outcomes.
- Acceptance criteria marked pass, fail, or not tested.
- Known limitations and security concerns.
- Manual setup required.
- Recommended next step.

Stop after the requested phase.

---

## 10. Current repository baseline (Phase 7 inspection)

Recorded so future phases start from verified facts. Update this section only when the baseline actually changes.

- **Repository root:** `contract-ripple` (the workspace parent `contract-ripple-full-project` is not currently a git repository).
- **Remote:** `https://github.com/ShantoSarkar34/contract-ripple.git`, branch `main`.
- **Deployment:** frontend deployed at `contractripple.vercel.app` (Vercel project `contractripple`, root `.`); API deployed at `contractripple-api.vercel.app/api/v1` (Vercel project `contractripple-api`, root `apps/api`, GitHub production branch `main`); both use managed PostgreSQL. See `docs/deployment.md`.
- **Package manager:** npm with workspaces (`apps/*`, `packages/*`); `package-lock.json` is the single lockfile. Do not introduce a second lockfile without approval.
- **Frontend:** Next.js `16.4.2`, React `19.3.0`, TypeScript `^5`, Tailwind CSS `3.4.19`, ESLint `9` with `eslint-config-next`.
- **App structure:** App Router under `src/app`; UI components under `src/components`; client API helper under `src/lib`; path alias `@/* -> ./src/*`. The `/contracts` route is a real client workspace gated by `AuthProvider`, with a dense, filterable comparison table, source-impact panel, an evidence-backed impact map with Map/Relationships views, cursor-paginated saved history, JSON/Markdown report downloads, and operation-scoped regression suggestions. `/login` provides sign-in and account creation; the navbar shows the session email and sign-out. `/` remains labeled demo content. Tailwind uses `darkMode: "media"` to match the `prefers-color-scheme` CSS variables.
- **Build tooling:** `npm run dev` and `npm run build` use `next dev --webpack` / `next build --webpack`. `npm run typecheck` builds `packages/shared`, `packages/engine`, `packages/source-analysis`, and `packages/impact-graph` first and type-checks the API; `npm run build` builds `packages/shared` and `packages/impact-graph` before Next because the frontend consumes them; `npm run build:api` builds shared/engine/source-analysis before the API.
- **Next.js config:** `cacheComponents: true` and `partialPrefetching: true`, plus an optional `/api/v1/:path*` rewrite to `API_PROXY_TARGET` for same-origin API calls and first-party session cookies. Data fetching for the workspace happens client-side, so pages stay static.
- **Backend (`apps/api`):** Express 5 + TypeScript ESM. Exposes public `GET /api/v1/health` and `/ready`, auth routes (`POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`), project/contract/version/comparison routes (history supports `limit` + cursor), source-analysis routes (ZIP multipart + GitHub), and `GET /comparisons/:comparisonId/report?format=json|markdown`. All data routes require a session and are scoped to the caller's project ownership. Request validation uses zod schemas from `packages/shared`, a `Repository` boundary (Prisma implementation + in-memory test implementation), consistent error envelopes, credential-aware CORS allowlisting, Helmet security headers, `cookie-parser`, and hashed fixed-window rate limits. `services/regression-tests.ts` is a pure deterministic suggestion generator; `services/reports.ts` builds the shared report DTO and Markdown on request from persisted records and the latest attached source snapshot. `services/password.ts` uses `scrypt`; `services/session.ts` owns opaque tokens, SHA-256 token hashes, CSRF derivation, and expiry; `services/authorization.ts` centralizes project ownership checks. Depends on `@contract-ripple/engine`, `@contract-ripple/shared`, `@contract-ripple/source-analysis`, `@prisma/client` 6.19.3, `express` 5, `cors`, `cookie-parser`, `dotenv`, `fflate`, `helmet`, `multer`, and `zod`. Vercel entry: `src/index.ts` imports `express`, exports the configured app, and only calls `app.listen()` when `VERCEL` is unset; `src/create-app.ts` holds the app factory. `apps/api/vercel.json` generates Prisma and builds workspace packages before bundling.
- **Database:** Prisma + PostgreSQL. Models: `Project`, `Contract`, `ContractVersion`, `AnalysisRun`, `Finding`, `SourceSnapshot`, `SourceFile`, `SourceImpact`, `User`, `Session`, `RateLimitBucket`, with the `AnalysisStatus` enum. Phase 7 adds `User` (unique lowercased email, scrypt password hash), `Session` (unique SHA-256 token hash, expiry, cascade to user), `RateLimitBucket` (opaque hashed key, window start, count), and nullable `Project.ownerId` with indexes/relations. Migrations live in `apps/api/prisma/migrations` (generated with `migrate diff` because the managed Prisma Postgres instance provides no shadow database; applied with `prisma migrate deploy`). Source snapshots store metadata, file paths, and evidence snippets, not full source contents. The Phase 7 migration is `20261021120000_add_auth_and_ownership`; it was not applied to production in this phase.
- **Shared package (`packages/shared`):** framework-agnostic types plus zod request/query schemas and DTO types, including `AnalysisReportDto`, `RegressionSuggestionDto`, `RegisterRequest`, `LoginRequest`, `AuthUserDto`, `AuthSessionResponse`, and history/report/auth query schemas, with Vitest tests. Depends on `zod` 4.
- **Engine package (`packages/engine`):** standalone OpenAPI 3.0.x/3.1.x comparison engine. Pipeline: size/depth/cycle checks → JSON/YAML parse → OpenAPI validation → canonicalization → normalization → comparison → risk classification → deterministic serialization. Public entry point: `compareContracts`. Dependencies: `@readme/openapi-parser` 9.1.0, `yaml` 2.9.1, `openapi-types` 12.1.3. See `docs/engine.md`.
- **Source-analysis package (`packages/source-analysis`):** TypeScript AST analysis with the TypeScript compiler API. Detects `fetch`, Axios/API-client methods, request helpers, template-literal paths, and config-object calls; matches against changed operations; emits file/line/column/snippet evidence, confidence, and explicit limitations. See `docs/source-analysis.md`.
- **Impact-graph package (`packages/impact-graph`):** dependency-free, deterministic builder that groups comparison findings into changed operations and links them to persisted source impacts by normalized method + path. Emits evidence-bearing operation/file nodes and edges, applies risk/category/method/confidence/query filters, enforces limits (200 operations, 400 files, 800 edges, 20 evidence entries per relation), and reports unmatched findings/impacts as limitations. The frontend renders a custom SVG map plus an equivalent semantic relationships table; there is no graph API or database table. See `docs/impact-graph.md`.
- **Source inputs:** ZIP uploads use in-memory extraction with traversal/absolute-path rejection and limits (10 MiB compressed, 5,000 entries, 2,000 source files, 25 MiB uncompressed, 1 MiB/file) plus a 20-second analyzer budget. GitHub uses the official REST API with a server-side `GITHUB_TOKEN` (optional; absent means `github_not_configured`), bounded blob fetching, a 15-second per-request timeout, a 60-second overall budget, and no clone/execution.
- **Testing:** Vitest from the repository root (`263 passed, 1 skipped` at Phase 7). Coverage includes shared request/query/auth schemas, API services/routes (in-memory repository and real HTTP), password hashing and malformed hashes, session expiry and revocation, CSRF and origin rejection, login/registration rate limits, security headers, cross-user IDOR checks for every resource family, history cursor pagination, JSON/Markdown report downloads, regression-suggestion grouping/evidence/order, the engine's parsing/validation/comparison/classification/reference/security cases, source-analysis AST/path/limit cases, and impact-graph grouping/matching/filter/limit/evidence cases. One PostgreSQL integration test runs only with `RUN_DB_TESTS=1`.
- **Docs:** `docs/development-plan.md`, `docs/architecture.md`, `docs/design-review.md`, `docs/engine.md`, `docs/api.md`, `docs/source-analysis.md`, `docs/impact-graph.md`, `docs/reports.md`, `docs/deployment.md`, `docs/release-checklist.md`.
- **API auth:** Phase 7 implements email/password auth, opaque database-backed sessions, CSRF, ownership checks, rate limits, and security headers. The session cookie is `HttpOnly` and `SameSite=Lax` by default; `AUTH_COOKIE_SAME_SITE=none` plus secure cookies is required for direct cross-site API calls. Production startup requires `AUTH_SECRET` (32+ characters). Pre-Phase-7 projects have `ownerId = null` and are inaccessible until deliberately assigned.
- **Not present yet:** email verification, password reset, account recovery/deletion, OAuth/social login, MFA, teams/roles/invitations, audit logging, a distributed rate limiter, per-user GitHub OAuth tokens, scheduled/emailed reports, stored report artifacts, and generated executable test files. Report/history exports, saved-history pagination, regression review prompts, and authentication/authorization are implemented.
- **Data:** the landing page renders hardcoded demo content and remains clearly labeled as demo. The `/contracts` workspace is authenticated and shows real comparison, source-analysis, graph, history, report, and regression-suggestion results only, scoped to the signed-in owner. Report exports include the latest source snapshot attached to the comparison and never invent test code or expected status codes.
- **Frontend AGENTS note:** the block at the end of this file is generated by `next dev`; keep it intact.

**Known structural issue to resolve with approval:** the git repository is nested inside the workspace root. A monorepo (`apps/web`, `apps/api`, `packages/shared`) will eventually need a single repository root at the intended monorepo location. Plan that migration explicitly; do not move the repo or change Vercel settings without authorization. The current deployment split keeps the frontend Vercel project at `.` and the API Vercel project at `apps/api`; any future root-directory change affects both deployments.

---

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
