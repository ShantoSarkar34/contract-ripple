# ContractRipple — API reference (Phase 3)

Base URL: `/api/v1` (configure the frontend with `NEXT_PUBLIC_API_BASE_URL`,
for example `http://localhost:4000/api/v1`).

All request and response bodies are JSON. Contract text may be JSON or YAML, but
it is sent as a JSON string inside the request body.

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
| `validation_error` | 400 | Request body failed schema validation |
| `invalid_request` | 400 | Missing route parameter |
| `empty_input` | 400 | Contract content was empty |
| `invalid_json` | 400 | Contract was not valid JSON |
| `invalid_yaml` | 400 | Contract was not valid YAML |
| `input_too_deep` | 400 | Contract nesting exceeded the limit |
| `circular_input` | 400 | Contract contained circular structures |
| `invalid_options` | 400 | Unsupported format override |
| `version_project_mismatch` | 400 | Compared versions belong to different projects |
| `project_not_found` | 404 | Unknown project |
| `contract_not_found` | 404 | Unknown contract |
| `version_not_found` | 404 | Unknown contract version |
| `comparison_not_found` | 404 | Unknown analysis run |
| `not_found` | 404 | Unknown route |
| `input_too_large` | 413 | Contract exceeded the byte limit |
| `invalid_openapi` | 422 | OpenAPI validation failed |
| `unsupported_version` | 422 | Only OpenAPI 3.0.x / 3.1.x are supported |
| `internal_error` | 500 | Unexpected server error |

## Limits

- Contract content: 5 MiB (UTF-8 bytes) per document, enforced by the engine.
- Request body: 8 MiB (JSON string escaping overhead).
- Findings: 5,000 by default before truncation (`truncated: true`).
- Validation timeout: 5 seconds.
- External `$ref`s are never fetched; changes involving them are `unknown`.

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
  ]
}
```

`category` is one of `operation`, `operation_id`, `parameter`, `request_body`,
`response`, `required_property`, `schema_property`, `reference`, `combinator`.
`changeType` is `added`, `removed`, or `modified`. `risk` is `non_breaking`,
`potentially_breaking`, or `unknown`. Findings are returned in deterministic
engine order.

### `GET /projects/:projectId/comparisons`

Response `200`: `{ "analyses": AnalysisRunDto[] }` ordered newest first, without
findings.

### `GET /comparisons/:comparisonId`

Response `200`: the full `AnalysisRunDetailDto`, including findings.
