# ContractRipple — API reference (Phase 6)

Base URL: `/api/v1` (configure the frontend with `NEXT_PUBLIC_API_BASE_URL`,
for example `http://localhost:4000/api/v1`).

Most request and response bodies are JSON. Contract text may be JSON or YAML, but
it is sent as a JSON string inside the request body. Source ZIP analysis uses
`multipart/form-data`.

> **Authentication is not implemented yet.** It is deferred to Phase 7. Do not
> expose this API publicly with real user data until then. There are currently no
> ownership checks between projects.

## Error envelope

Every non-2xx response uses:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed.",
    "details": [{ "path": "name", "message": "Too small: expected string to have >=1 characters" }]
  }
}
```

`details` is optional and only present for some codes. Messages are safe to
return: no stack traces, file paths, or raw contract contents.

| Code | Status | Meaning |
| --- | --- | --- |
| `validation_error` | 400 | Request body or query failed schema validation |
| `invalid_request` | 400 | Missing route parameter |
| `empty_input` | 400 | Contract content was empty |
| `invalid_json` | 400 | Contract was not valid JSON |
| `invalid_yaml` | 400 | Contract was not valid YAML |
| `input_too_deep` | 400 | Contract nesting exceeded the limit |
| `circular_input` | 400 | Contract contained circular structures |
| `invalid_options` | 400 | Unsupported format override |
| `version_project_mismatch` | 400 | Compared versions belong to different projects |
| `invalid_cursor` | 400 | History cursor is unknown or belongs to another project |
| `comparison_project_mismatch` | 400 | Source analysis comparison belongs to another project |
| `no_comparison` | 400 | Source analysis requires an existing comparison |
| `archive_required` | 400 | ZIP request had no `archive` file |
| `invalid_upload` | 400 | ZIP upload was rejected by the multipart parser |
| `invalid_zip` | 400 | Uploaded archive could not be read |
| `unsafe_path` | 400 | Archive contained traversal or absolute paths |
| `no_supported_source` | 400 | No supported TypeScript/JavaScript files were found |
| `github_invalid_repository` | 400 | Repository was not `owner/name` or a github.com URL |
| `github_forbidden` | 403 | Token lacks access to the repository |
| `analysis_timeout` | 408 | Source analysis exceeded its wall-clock budget |
| `project_not_found` | 404 | Unknown project |
| `contract_not_found` | 404 | Unknown contract |
| `version_not_found` | 404 | Unknown contract version |
| `comparison_not_found` | 404 | Unknown analysis run |
| `source_snapshot_not_found` | 404 | Unknown source analysis snapshot |
| `github_not_found` | 404 | Repository/ref not found or token cannot access it |
| `not_found` | 404 | Unknown route |
| `input_too_large` | 413 | Contract exceeded the byte limit |
| `archive_too_large` | 413 | ZIP upload or decompressed source exceeded the limit |
| `too_many_entries` | 413 | ZIP contained too many entries |
| `too_many_files` | 413 | ZIP or analysis contained too many source files |
| `source_too_large` | 413 | Source analysis byte limit exceeded |
| `invalid_openapi` | 422 | OpenAPI validation failed |
| `unsupported_version` | 422 | Only OpenAPI 3.0.x / 3.1.x are supported |
| `github_rate_limited` | 429 | GitHub API rate limit exceeded |
| `internal_error` | 500 | Unexpected server error |
| `github_unavailable` | 502 | GitHub API was unreachable or returned an error |
| `github_not_configured` | 503 | `GITHUB_TOKEN` is not set |
| `github_unauthorized` | 503 | GitHub rejected the configured token |
| `github_timeout` | 504 | GitHub source analysis exceeded its 60 second budget |

## Limits

- Contract content: 5 MiB (UTF-8 bytes) per document, enforced by the engine.
- Request body: 8 MiB (JSON string escaping overhead).
- Findings: 5,000 by default before truncation (`truncated: true`).
- Validation timeout: 5 seconds.
- External `$ref`s are never fetched; changes involving them are `unknown`.
- Source ZIP upload: 10 MiB compressed, 5,000 entries, 2,000 source files,
  25 MiB total uncompressed, 1 MiB per file.
- Source analysis wall-clock budget: 20 seconds (`analysis_timeout`, HTTP 408).
- GitHub source: 2,000 source files, 25 MiB total, 1 MiB per file; only files
  reported by the Git Trees API are fetched (no clone, no execution).
- Saved history: 1–50 comparisons per page (default 20), ordered by creation
  time descending with id as tie-breaker.
- Reports: generated on request from the comparison plus the latest attached
  source snapshot. JSON includes all findings and the latest snapshot's
  impacts. Regression suggestions keep up to 20 evidence strings each; all
  finding ids remain present.
- Reports are not cached (`Cache-Control: no-store`).

## Health

### `GET /health`

Liveness. Always `200`.

```json
{ "status": "ok", "service": "contract-ripple-api", "timestamp": "2026-01-01T00:00:00.000Z", "uptimeSeconds": 12 }
```

### `GET /ready`

Readiness with a database ping. `200` when the database is reachable, `503`
otherwise.

```json
{ "status": "ok", "database": "up", "timestamp": "2026-01-01T00:00:00.000Z" }
```

## Projects

### `POST /projects`

Request: `{ "name": string (1–120), "description"?: string (≤2000) }`

Response `201`:

```json
{
  "id": "cm...",
  "name": "Payments",
  "description": null,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "contractCount": 0
}
```

### `GET /projects`

Response `200`: `{ "projects": ProjectDto[] }` ordered by creation time.

### `GET /projects/:projectId`

Response `200`: `ProjectDto`. `404 project_not_found` if missing.

### `PATCH /projects/:projectId`

Request: at least one of `name` or `description`. Response `200`: `ProjectDto`.

## Contracts

### `POST /projects/:projectId/contracts`

Request: `{ "name": string (1–200) }`. Response `201`: `ContractDto`.

### `GET /projects/:projectId/contracts`

Response `200`: `{ "contracts": ContractDto[] }` with `versionCount`.

### `GET /contracts/:contractId`

Response `200`: `ContractDto` plus `versions: ContractVersionDto[]`.

## Contract versions

### `POST /contracts/:contractId/versions`

Request:

```json
{ "content": "<OpenAPI JSON or YAML text>", "format": "json" | "yaml" (optional), "label": "v1.4.0" (optional) }
```

The contract is parsed and validated before anything is stored. On success
(`201`) the response is a `ContractVersionDto`:

```json
{
  "id": "cm...",
  "contractId": "cm...",
  "label": "v1.4.0",
  "format": "json",
  "openapiVersion": "3.0.3",
  "title": "Pets API",
  "infoVersion": "1.0.0",
  "checksum": "<sha256 hex>",
  "contentBytes": 1532,
  "warnings": [],
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

Invalid contracts are rejected with `invalid_json`, `invalid_yaml`,
`input_too_large`, `invalid_openapi`, or `unsupported_version` and are not saved.

### `GET /contracts/:contractId/versions`

Response `200`: `{ "versions": ContractVersionDto[] }` in insertion order.

### `GET /versions/:versionId`

Response `200`: `ContractVersionDto` plus `content` (the original text).

## Comparisons

### `POST /projects/:projectId/comparisons`

Request:

```json
{ "baselineVersionId": "cm...", "candidateVersionId": "cm...", "label": "v1 → v2" (optional) }
```

Both versions must belong to contracts in the given project. The engine runs and
the result is stored. Response `201` is an `AnalysisRunDetailDto`:

```json
{
  "id": "cm...",
  "projectId": "cm...",
  "label": "v1 → v2",
  "status": "completed",
  "truncated": false,
  "totalFindings": 3,
  "nonBreakingCount": 1,
  "potentiallyBreakingCount": 2,
  "unknownCount": 0,
  "durationMs": 18,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "baselineVersionId": "cm...",
  "candidateVersionId": "cm...",
  "baselineVersionLabel": "v1",
  "candidateVersionLabel": "v2",
  "baseline": { "openapi": "3.0.3", "title": "Pets API", "version": "1.0.0", "warnings": [], "contractId": "cm...", "contractName": "pets-api", "versionId": "cm...", "versionLabel": "v1" },
  "candidate": { "...": "..." },
  "limitations": ["External references are not fetched; ..."],
  "findings": [
    {
      "id": "f_...",
      "category": "operation",
      "changeType": "removed",
      "risk": "potentially_breaking",
      "path": "/pets",
      "method": "post",
      "operationId": "createPet",
      "location": "#/paths/~1pets/post",
      "summary": "Operation `POST /pets` was removed",
      "explanation": "Clients that call this operation will fail or receive an error response.",
      "before": "{...}",
      "after": null
    }
  ],
  "regressionSuggestions": [
    {
      "id": "suggestion:post:/pets",
      "method": "post",
      "path": "/pets",
      "operationId": "createPet",
      "risk": "potentially_breaking",
      "title": "Regression checks for POST /pets",
      "rationale": "Derived from 2 classified findings for this operation; highest risk: potentially breaking.",
      "findingIds": ["f_..."],
      "evidence": ["Operation `POST /pets` was removed (#/paths/~1pets/post)"],
      "suggestedChecks": [
        "Exercise the client path that used this operation and confirm it fails gracefully or has been removed."
      ]
    }
  ]
}
```

`category` is one of `operation`, `operation_id`, `parameter`, `request_body`,
`response`, `required_property`, `schema_property`, `reference`, `combinator`.
`changeType` is `added`, `removed`, or `modified`. `risk` is `non_breaking`,
`potentially_breaking`, or `unknown`. Findings are returned in deterministic
engine order.

`regressionSuggestions` are derived from findings that have both a method and a
path. Each suggestion groups those findings, keeps the highest risk, and lists
review checks based on the finding categories and change types. Suggestions are
not executable tests and do not invent expected status codes or runtime
behavior. Findings without an operation scope remain in `findings` but do not
produce a suggestion.

### `GET /projects/:projectId/comparisons`

Query:

- `limit`: optional integer, 1–50, default 20.
- `cursor`: optional `nextCursor` from a previous response.

Response `200`:

```json
{
  "analyses": [],
  "nextCursor": null,
  "totalCount": 0
}
```

`analyses` is ordered newest first (createdAt descending, id descending) and
omits findings. `nextCursor` is the id to pass to the next request, or `null` on
the last page. `totalCount` is the number of saved comparisons in the project.
An unknown cursor, or one from another project, returns `400 invalid_cursor`.

### `GET /comparisons/:comparisonId`

Response `200`: the full `AnalysisRunDetailDto`, including findings and
regression suggestions.

### `GET /comparisons/:comparisonId/report`

Query: `format=json` (default) or `format=markdown`.

The response is a file attachment generated from the persisted comparison. It
contains the summary, baseline/candidate metadata, all findings, regression
suggestions, limitations, notes, and the latest source snapshot attached to the
comparison with its impacts (`availableSnapshotCount` reports how many snapshots
exist). JSON is `application/json`; Markdown is `text/markdown`. Both use
`Cache-Control: no-store` and a `Content-Disposition` filename. Unknown
comparisons return `404 comparison_not_found`.

Example JSON report shape:

```json
{
  "schemaVersion": "contract-ripple.report.v1",
  "generatedAt": "2026-01-01T00:00:00.000Z",
  "project": { "id": "cm...", "name": "Pets" },
  "comparison": { "id": "cm...", "label": "v1 → v2", "totalFindings": 3, "...": "..." },
  "baseline": { "...": "..." },
  "candidate": { "...": "..." },
  "findings": [],
  "regressionSuggestions": [],
  "sourceAnalysis": {
    "availableSnapshotCount": 1,
    "includedSnapshotId": "cm...",
    "snapshot": { "id": "cm...", "sourceType": "zip", "impactCount": 2, "impacts": [] }
  },
  "limitations": [],
  "notes": ["..."]
}
```

The Markdown export is the readable version: summary tables, regression checks,
the latest source evidence, a findings table, before/after evidence, limitations,
and notes. See `docs/reports.md` for generation rules and limitations.

## Source analysis

Source analysis compares statically detectable HTTP calls in TypeScript and
JavaScript files against the operations changed by an existing comparison. It
never executes uploaded or repository code. Every match includes the file path,
line, column, snippet, detected method/path, matched operation, and confidence.

If `analysisRunId` is omitted, the newest comparison for the project is used.
Run a comparison first; otherwise the API returns `no_comparison`.

### `GET /github/status`

Response `200`: `{ "configured": boolean }`. This only reports whether
`GITHUB_TOKEN` is set; the token is never returned.

### `POST /projects/:projectId/source/zip`

`multipart/form-data` with:

- `archive`: the ZIP file (required, ≤10 MiB).
- `analysisRunId`: optional comparison id.

Response `201`: a `SourceSnapshotDetailDto`:

```json
{
  "id": "cm...",
  "projectId": "cm...",
  "analysisRunId": "cm...",
  "sourceType": "zip",
  "repository": null,
  "ref": null,
  "fileCount": 12,
  "skippedCount": 3,
  "totalBytes": 48210,
  "impactCount": 2,
  "limitations": ["Static analysis only detects API calls ..."],
  "createdAt": "2026-01-01T00:00:00.000Z",
  "files": [{ "path": "src/api.ts", "bytes": 1820, "skipped": false, "reason": null }],
  "impacts": [
    {
      "id": "cm...",
      "filePath": "src/api.ts",
      "line": 12,
      "column": 3,
      "snippet": "await api.post(\"/pets\", body);",
      "call": "api.post",
      "method": "post",
      "path": "/pets",
      "matchedMethod": "post",
      "matchedPath": "/pets",
      "operationId": "createPet",
      "confidence": "high",
      "evidence": "api.post call at src/api.ts:12:3 matched POST /pets"
    }
  ]
}
```

`sourceType` is `zip` or `github`. `confidence` is `high`, `medium`, or `low`.
Unsafe archives are rejected before analysis; only UTF-8 TypeScript/JavaScript
files are read, and dependency/build directories are skipped.

### `POST /projects/:projectId/source/github`

Request:

```json
{
  "repository": "owner/repository",
  "ref": "main",
  "analysisRunId": "cm..."
}
```

`repository` accepts `owner/repository` or a `https://github.com/owner/repository`
URL. `ref` and `analysisRunId` are optional. Requires `GITHUB_TOKEN` on the
server; without it the response is `503 github_not_configured`. Rate limits,
missing access, revoked tokens, and upstream failures are reported explicitly
and never replaced with fake results. Response `201`: a
`SourceSnapshotDetailDto` with `sourceType: "github"`, `repository`, and `ref`.

### `GET /projects/:projectId/source`

Response `200`: `{ "snapshots": SourceSnapshotDto[] }`, newest first. Each item
includes `impactCount` but not files/impacts.

### `GET /source/:snapshotId`

Response `200`: the full `SourceSnapshotDetailDto`, including scanned/skipped
file metadata and ordered impacts. `404 source_snapshot_not_found` if missing.
