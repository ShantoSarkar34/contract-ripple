# Deployment

ContractRipple is deployed as two separate Vercel projects backed by one managed
PostgreSQL database.

| Layer | Vercel project | Root directory | Public URL |
| --- | --- | --- | --- |
| Frontend (Next.js) | `contractripple` | repository root (`.`) | <https://contractripple.vercel.app> |
| API (Express) | `contractripple-api` | `apps/api` | <https://contractripple-api.vercel.app/api/v1> |
| Database | — | — | private managed PostgreSQL |

The frontend calls the API at build time through `NEXT_PUBLIC_API_BASE_URL`, so
changing that value requires a new frontend deployment.

## Why the API has its own Vercel project

The repository root is a Next.js application, while `apps/api` is an Express
application for Node.js. Deploying both from the same Vercel project would make
Vercel choose one framework and one entry point. A separate project rooted at
`apps/api` keeps the frontend deployment unchanged and lets Vercel use its
zero-config Express integration for the API.

Important implementation details:

- `apps/api/src/index.ts` imports `express` directly and exports the configured
  app as its default export, which is how Vercel detects an Express entry point.
- `app.listen()` only runs when `VERCEL` is not set, so local development still
  starts a normal long-running server.
- The old `apps/api/src/app.ts` factory was renamed to
  `apps/api/src/create-app.ts`. Vercel treats `src/app.ts` as an entry point, and
  otherwise selected the factory instead of the configured app.
- `apps/api/vercel.json` generates the Prisma client and builds the workspace
  packages before Vercel bundles the function:

  ```json
  {
    "buildCommand": "npm --prefix ../.. run db:generate && npm --prefix ../.. run build:api"
  }
  ```

## Environment variables

Frontend project (`contractripple`) in Vercel:

| Variable | Production value |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `/api/v1` when `API_PROXY_TARGET` is set; otherwise `https://contractripple-api.vercel.app/api/v1` |
| `API_PROXY_TARGET` | Optional. API origin without the version prefix, for example `https://contractripple-api.vercel.app`. Enables the same-origin `/api/v1/*` rewrite. |

The same-origin proxy is recommended: the session cookie stays first-party and
is not subject to third-party-cookie blocking. If you call the API origin
directly, set `AUTH_COOKIE_SAME_SITE=none` and `AUTH_COOKIE_SECURE=true` on the
API, and expect that some browsers may still block the cookie.

API project (`contractripple-api`) in Vercel:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Managed PostgreSQL connection string. Append `connection_limit=1` for serverless functions unless the database provider supplies a pooler. |
| `CORS_ORIGINS` | Exact comma-separated origins, for example `https://contractripple.vercel.app`. Wildcards are not supported. Also used by the CSRF origin guard. |
| `AUTH_SECRET` | **Required in production**, at least 32 characters. Used for CSRF derivation. Keep it stable across deployments and API instances. |
| `AUTH_COOKIE_SECURE` | Defaults to `true` in production. Keep it true on HTTPS. |
| `AUTH_COOKIE_SAME_SITE` | `lax` (default), `strict`, or `none`. `none` requires secure cookies and is only needed for direct cross-site API calls. |
| `TRUST_PROXY` | Defaults to `true` in production (correct for Vercel). Set `false` if clients connect directly. |
| `GITHUB_TOKEN` | Optional. Server-side GitHub App or fine-grained PAT with read-only Contents access. Without it, GitHub analysis reports `github_not_configured`. |
| `GITHUB_API_BASE_URL` | Optional. Defaults to `https://api.github.com`. |

Generate `AUTH_SECRET` with a cryptographic random source:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

`NODE_ENV` is set to `production` by Vercel. Do not expose `DATABASE_URL`,
`AUTH_SECRET`, or `GITHUB_TOKEN` with a `NEXT_PUBLIC_` prefix.

Local values live in `.env.local` (frontend) and `apps/api/.env` (API). Neither
file is committed.

## Deploy the API from the CLI

The API project is rooted at `apps/api`, so deploy it **from the repository
root**, not from inside `apps/api`. Deploying only `apps/api` omits the workspace
packages and fails with a 404 for `@contract-ripple/engine`.

```powershell
# From the repository root
$env:VERCEL_ORG_ID = "<org id from apps/api/.vercel/project.json>"
$env:VERCEL_PROJECT_ID = "<project id from apps/api/.vercel/project.json>"
npx vercel deploy --prod --yes

Remove-Item Env:VERCEL_ORG_ID
Remove-Item Env:VERCEL_PROJECT_ID
```

The local link in `apps/api/.vercel` is ignored by Git. Project IDs are also
visible in the Vercel dashboard under **Settings → General**.

After deployment, verify both checks:

```text
https://contractripple-api.vercel.app/api/v1/health
https://contractripple-api.vercel.app/api/v1/ready
```

`/health` must return `200`. `/ready` must return `200` with
`"database":"up"`.

## Git-based deployments

`contractripple-api` is connected to the GitHub repository
`ShantoSarkar34/contract-ripple`. Its current settings are:

- **Root Directory:** `apps/api`
- **Include source files outside of the Root Directory:** enabled
- **Production Branch:** `main`
- **Framework Preset:** Express

The build command comes from `apps/api/vercel.json`. Do not run Prisma
migrations during the build or at server startup. Pushes to `open-branch` may
create preview deployments, but only Production has `DATABASE_URL` and
`CORS_ORIGINS`; preview API deployments are not expected to be ready.

The frontend project keeps **Root Directory** at `.` and deploys from `main`.
Do not deploy the local `open-branch` working tree to the production frontend;
merge it first.

## Database migrations

Migrations are committed in `apps/api/prisma/migrations` and must be applied
deliberately, **before** deploying API code that expects the new schema:

```powershell
# Point DATABASE_URL in apps/api/.env at the target database first.
npm run db:deploy
```

Phase 7 adds `apps/api/prisma/migrations/20261021120000_add_auth_and_ownership`.
It creates `User`, `Session`, and `RateLimitBucket`, adds nullable
`Project.ownerId`, and adds supporting indexes. Applying it is backward
compatible with the Phase 6 API, but existing projects have no owner and become
inaccessible once the Phase 7 API is live. Assign owners deliberately or delete
throwaway data before switching traffic.

Do not run `prisma migrate dev` against production. The managed Prisma Postgres
database used during development does not provide a shadow database, so new
migration SQL was generated with `prisma migrate diff` and applied with
`migrate deploy`.

## Vercel function limits that affect the API

- **Request body:** Vercel Functions accept at most **4.5 MB** per request.
  The application-level ZIP limit is 10 MiB, so a ZIP between 4.5 MiB and 10 MiB
  will be rejected by the platform before it reaches Express. Keep production
  uploads below 4.5 MB, or move the API to a Node host / use direct object
  storage for larger archives.
- **Duration:** Hobby functions have a 300-second default and maximum. The ZIP
  analyzer budget is 20 seconds and the GitHub budget is 60 seconds, so normal
  analyses fit.
- **Memory:** Hobby functions provide 2 GB. The build currently fits within the
  standard function size limit.
- **Connections:** each function instance can open its own PostgreSQL
  connection. `connection_limit=1` avoids exhausting small managed databases at
  the cost of serializing queries per instance.

## Health, CORS, and verification

The API returns `Access-Control-Allow-Origin` only for exact origins listed in
`CORS_ORIGINS`, with `Access-Control-Allow-Credentials: true`. It exposes
`Content-Disposition` so browser clients can read report download filenames.
CORS is not authentication and does not stop non-browser clients from calling the
API.

Post-deployment checks:

```powershell
curl.exe -sS https://contractripple-api.vercel.app/api/v1/health
curl.exe -sS https://contractripple-api.vercel.app/api/v1/ready
curl.exe -sS -o NUL -w "%{http_code}`n" https://contractripple-api.vercel.app/api/v1/projects
curl.exe -sS -o NUL -w "%{http_code}`n" https://contractripple-api.vercel.app/api/v1/auth/me
```

Expected: health `200`, ready `200` with `"database":"up"`, and both
authenticated probes `401` without a session cookie. Then open
`https://contractripple.vercel.app/login`, create an account, and confirm the
workspace loads with only that account's projects. Sign out and confirm
`/contracts` shows the sign-in prompt.

See `docs/release-checklist.md` for the complete pre- and post-deploy checklist.

## Security status

Phase 7 implements email/password authentication, opaque database-backed
sessions, CSRF protection, allowlisted credential-aware CORS, security headers,
ownership checks on every nested resource, and database-backed rate limits. No
data route is accessible without a session.

Remaining production prerequisites:

- Set `AUTH_SECRET` before deploying the Phase 7 API; the API refuses to start
  in production without it.
- Apply the Phase 7 migration before switching traffic.
- Decide what to do with pre-Phase-7 projects, which have `ownerId = null` and
  are inaccessible until assigned.
- Use HTTPS in every environment where the cookie is secure.

## Known limitations

- `GITHUB_TOKEN` is not configured in production yet, so GitHub source analysis
  reports `github_not_configured`.
- The API Vercel project is connected to GitHub and deploys production from
  `main`. The current live API was deployed from the CLI from `open-branch`
  before that branch was merged; it contains only deployment changes plus the
  same API behavior as `main`.
- The frontend production deployment still corresponds to `main`. Phase 5–7
  work on `open-branch` becomes live only after the user merges and Vercel
  redeploys. Report exports include the latest source snapshot, so a newly run
  source analysis requires a fresh export.
- Vercel's 4.5 MB request limit is lower than the application's documented
  10 MiB ZIP limit.
- Email verification, password reset, account recovery, OAuth, MFA, teams, and
  audit logging are not implemented.
- The fixed-window limiter is database-backed but not a distributed token
  bucket. It bounds abuse per window without smoothing bursts.
- Cross-site cookies depend on browser policy. Prefer the same-origin proxy
  (`API_PROXY_TARGET`) for the production frontend.
- Session cookies last seven days and are not refreshed on every request. An
  expired session returns `401 unauthenticated`, and the frontend prompts for
  sign-in again.
