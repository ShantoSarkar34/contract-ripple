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

**Current baseline (inspected at Phase 0):** the Next.js app lives at the repository root (`src/app`), not in `apps/web`. The backend, Prisma schema, PostgreSQL setup, shared package, tests, and `docs`/`prompts` folders do not exist yet. Migration to the monorepo layout must be planned and approved as its own task.

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

## 10. Current repository baseline (Phase 0 inspection)

Recorded so future phases start from verified facts. Update this section only when the baseline actually changes.

- **Repository root:** `contract-ripple` (the workspace parent `contract-ripple-full-project` is not currently a git repository).
- **Remote:** `https://github.com/ShantoSarkar34/contract-ripple.git`, branch `main`.
- **Deployment:** frontend deployed at `contractripple.vercel.app`.
- **Package manager:** npm (`package-lock.json` present). Do not introduce a second lockfile without approval.
- **Frontend:** Next.js `16.4.2`, React `19.3.0`, TypeScript `^5`, Tailwind CSS `3.4.19`, ESLint `9` with `eslint-config-next`.
- **App structure:** App Router under `src/app`; UI components under `src/components`; path alias `@/* -> ./src/*`.
- **Build tooling:** `npm run dev` and `npm run build` use `next dev --webpack` / `next build --webpack`. Turbopack native bindings are unavailable in the current Windows environment, so do not switch back to Turbopack without testing.
- **Next.js config:** `cacheComponents: true` and `partialPrefetching: true`.
- **Not present yet:** backend, Express, Prisma, PostgreSQL, shared package, tests, `docs`, `prompts`, environment examples.
- **Data:** the current UI renders hardcoded demo content and must remain clearly labeled as demo until wired to real analysis.
- **Frontend AGENTS note:** the block at the end of this file is generated by `next dev`; keep it intact.

**Known structural issue to resolve with approval:** the git repository is nested inside the workspace root. A monorepo (`apps/web`, `apps/api`, `packages/shared`) will eventually need a single repository root at the intended monorepo location. Plan that migration explicitly; do not move the repo or change Vercel settings without authorization.

---

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
