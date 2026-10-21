# Release checklist — Phase 7

Use this checklist for the authentication/security release. Nothing here was
applied to production during Phase 7; the phase stops before deployment.

## 1. Review and merge

- [ ] Review the `open-branch` diff and the Phase 7 completion report.
- [ ] Confirm the branch is up to date with `origin/main` and CI is green.
- [ ] Merge `open-branch` into `main` manually.
- [ ] Confirm the frontend and API Vercel projects both build from `main`.

## 2. Before deploying the API

- [ ] Back up the production database or confirm the provider's point-in-time
      recovery is available.
- [ ] Decide what happens to pre-Phase-7 projects. Their `ownerId` is `null`,
      so they are inaccessible after this release.
  - [ ] Assign an owner deliberately, or
  - [ ] delete throwaway projects, or
  - [ ] keep them inaccessible and document that decision.
  - To assign all unowned projects to one existing account, create that account
    first and run this deliberately in the target database:
    `UPDATE "Project" SET "ownerId" = '<user-id>' WHERE "ownerId" IS NULL;`
    Confirm the user id with `SELECT "id", "email" FROM "User";` before running
    the update. This is a production data change, not part of the migration.
- [ ] Generate and store `AUTH_SECRET` (at least 32 characters) in the API
      project's environment:
      `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
- [ ] Confirm `CORS_ORIGINS` contains the exact production frontend origin.
- [ ] Confirm `TRUST_PROXY=true` and `AUTH_COOKIE_SECURE=true`.
- [ ] Choose the cookie mode:
  - [ ] Same-origin proxy (recommended): set `AUTH_COOKIE_SAME_SITE=lax`.
  - [ ] Direct cross-site API: set `AUTH_COOKIE_SAME_SITE=none`; expect browser
        cookie restrictions.
- [ ] Apply the migration with `npm run db:deploy` from the repository root and
      a `DATABASE_URL` pointed at production.
- [ ] Verify the migration created `User`, `Session`, `RateLimitBucket`, and
      `Project.ownerId` before deploying the new API code.

## 3. Deploy

- [ ] Deploy the API first. `apps/api/vercel.json` regenerates Prisma and builds
      workspace packages.
- [ ] Confirm `/api/v1/health` returns `200`.
- [ ] Confirm `/api/v1/ready` returns `200` with `"database":"up"`.
- [ ] Confirm `/api/v1/projects` and `/api/v1/auth/me` return `401` without a
      session cookie.
- [ ] Deploy the frontend with `NEXT_PUBLIC_API_BASE_URL` (and
      `API_PROXY_TARGET` if using the same-origin proxy).
- [ ] If using the proxy, confirm `/api/v1/health` is reachable from the
      frontend domain and that the browser sends the session cookie with the
      request.

## 4. Post-deploy verification

- [ ] Visit `/login`, create a new account, and land in the workspace.
- [ ] Create a project, contract, two versions, and a comparison.
- [ ] Upload a ZIP or run GitHub analysis if `GITHUB_TOKEN` is configured.
- [ ] Download the JSON and Markdown report.
- [ ] Sign out and confirm `/contracts` shows the sign-in prompt.
- [ ] Sign in again and confirm the project and history are still present.
- [ ] From a second browser profile, create a second account and confirm it
      cannot see the first account's project by id (expect `404`).
- [ ] Confirm an unsafe request without `x-csrf-token` returns `403
      invalid_csrf`.
- [ ] Confirm repeated failed logins eventually return `429 rate_limited` with
      `Retry-After`.
- [ ] Confirm response headers include `X-Content-Type-Options: nosniff`,
      `X-Frame-Options`/frame-ancestors protection, and a referrer policy.
- [ ] Confirm no password, session token, CSRF secret, or `AUTH_SECRET` appears
      in responses, logs, or client bundles.

## 5. Rollback

- [ ] If the migration must be rolled back, take a fresh backup first. The
      migration is additive: dropping the new tables/column removes auth data
      and requires the Phase 6 API to be redeployed.
- [ ] If only the API deployment is bad, roll back the Vercel deployment while
      keeping the migration in place; the Phase 6 API ignores the new tables.
- [ ] Rotating `AUTH_SECRET` invalidates every existing session and derived
      CSRF token. Users must sign in again.

## 6. Follow-up

- [ ] Monitor API error rates for `401`, `403`, and `429` after release.
- [ ] Add password reset/email verification before inviting external users who
      cannot recover an account.
- [ ] If traffic grows, replace the fixed-window limiter with a distributed
      limiter (for example Redis) without changing the client contract.
