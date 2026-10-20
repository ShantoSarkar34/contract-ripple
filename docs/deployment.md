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
| `NEXT_PUBLIC_API_BASE_URL` | `https://contractripple-api.vercel.app/api/v1` |

API project (`contractripple-api`) in Vercel:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Managed PostgreSQL connection string. Append `connection_limit=1` for serverless functions unless the database provider supplies a pooler. |
| `CORS_ORIGINS` | Exact comma-separated origins, for example `https://contractripple.vercel.app`. Wildcards are not supported. |
| `GITHUB_TOKEN` | Optional. Server-side GitHub App or fine-grained PAT with read-only Contents access. Without it, GitHub analysis reports `github_not_configured`. |
| `GITHUB_API_BASE_URL` | Optional. Defaults to `https://api.github.com`. |

`NODE_ENV` is set to `production` by Vercel. Do not expose `DATABASE_URL` or
`GITHUB_TOKEN` with a `NEXT_PUBLIC_` prefix.

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

To make future `main` pushes deploy the API automatically, connect
`contractripple-api` to the GitHub repository in Vercel and set:

- **Root Directory:** `apps/api`
- **Include source files outside of the Root Directory:** enabled
- **Production Branch:** `main`
- **Framework Preset:** Express

The build command comes from `apps/api/vercel.json`. Do not run Prisma
migrations during the build or at server startup.

The frontend project keeps **Root Directory** at `.` and deploys from `main`.
Do not deploy the local `open-branch` working tree to the production frontend;
merge it first.

## Database migrations

Migrations are committed in `apps/api/prisma/migrations` and must be applied
deliberately:

```powershell
# Point DATABASE_URL in apps/api/.env at the target database first.
npm run db:deploy
```

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
`CORS_ORIGINS`. CORS is not authentication and does not stop non-browser clients
from calling the API.

Current live checks used during deployment:

```powershell
curl.exe -sS https://contractripple-api.vercel.app/api/v1/health
curl.exe -sS https://contractripple-api.vercel.app/api/v1/ready
curl.exe -sS https://contractripple-api.vercel.app/api/v1/projects `
  -H "Origin: https://contractripple.vercel.app"
```

The browser workspace at `/contracts` should show the deployed API endpoint and
the **Connected** indicator, then load real projects, contracts, comparison
history, and source snapshots from PostgreSQL.

## Security status

Authentication and ownership checks are **not implemented yet**. The deployed
API is publicly reachable and can read and create data for every project. Use it
only with test or otherwise non-sensitive data until Phase 7 adds authentication,
server-side authorization, ownership checks, and rate limiting. CORS is not an
access-control boundary.

## Known limitations

- `GITHUB_TOKEN` is not configured in production yet, so GitHub source analysis
  reports `github_not_configured`.
- The API Vercel project is currently deployed from the CLI. Git-based automatic
  deployments require the GitHub connection described above.
- The frontend production deployment still corresponds to `main`. Phase 5 work
  on `open-branch` becomes live only after the user merges and Vercel redeploys.
- Vercel's 4.5 MB request limit is lower than the application's documented
  10 MiB ZIP limit.
