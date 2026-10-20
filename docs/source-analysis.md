# ContractRipple — Source analysis (Phase 4)

Source analysis answers a narrow, evidence-based question:

> Which statically detectable HTTP calls in this TypeScript/JavaScript source
> match operations that changed between two OpenAPI contracts?

It is deliberately conservative. It does not claim complete frontend impact
discovery, does not execute code, and does not install dependencies.

## Pipeline

```
ZIP upload ─┐
            ├─► file filtering ─► TypeScript AST ─► call detection
GitHub API ─┘                                      │
                                                   ▼
                              changed operations from a comparison
                                                   │
                                                   ▼
                                    path/method matching + evidence
                                                   │
                                                   ▼
                         SourceSnapshot / SourceFile / SourceImpact
```

1. **Input** — a ZIP archive or a GitHub repository (official REST API).
2. **File filtering** — only UTF-8 TypeScript/JavaScript files
   (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, `.cts`) are read.
   `node_modules`, `.git`, `.next`, `dist`, `build`, `coverage`, `vendor`, `out`,
   `.turbo`, and `.cache` are ignored.
3. **Parsing** — files are parsed with the TypeScript compiler API. Parsing is
   error-tolerant and never executes the source.
4. **Call detection** — static calls are detected only when the HTTP method and
   path are resolvable from the source text.
5. **Operation matching** — changed operations are derived from the findings of
   an existing comparison (unique method + path pairs). Matching is exact first,
   then suffix-based (for example `/api/pets` against `/pets`).
6. **Evidence** — every match records file path, line, column, trimmed snippet,
   detected call, detected method/path, matched operation, operation id, and
   confidence.
7. **Persistence** — a snapshot stores file metadata and ordered impacts. Source
   file contents are not persisted; only bounded evidence snippets are stored.

## Detected patterns

| Pattern | Example | Method |
| --- | --- | --- |
| `fetch` | `fetch("/pets")` | `GET` by default |
| `fetch` with options | `fetch("/pets", { method: "POST" })` | from `method` |
| Axios member call | `axios.delete("/pets/42")` | from the member name |
| API client member call | `apiClient.get("/pets")` | from the member name |
| Axios config object | `axios({ url: "/pets", method: "post" })` | from `method` |
| Request helper | `request("/pets", { method: "PATCH" })` | from `method` |
| Absolute URL | `fetch("https://api.example.com/pets?limit=10")` | URL pathname, query stripped |
| Template literal | `` api.get(`/pets/${id}`) `` | interpolation treated as a path parameter |

Receiver names containing `api`, `client`, `http`, `request`, `axios`, `ky`, etc.
are treated as likely HTTP clients. This is a heuristic; unrelated matches are
filtered out because a result is only reported when it matches a changed
operation.

## Matching rules

- Methods are compared case-insensitively and must match.
- OpenAPI `{param}`, Express `:param`, and template `{}` segments match any single
  path segment.
- Literal path parameters (for example `/pets/42`) match `{petId}`.
- Exact normalized matches are `high` confidence.
- Suffix matches (for example `/api/pets` vs `/pets`) are `medium` confidence.
- A template-literal path with interpolation is capped at `medium` confidence.
- Paths are normalized: absolute URLs become pathnames; query strings, fragments,
  duplicate slashes, and trailing slashes are removed.

## Limits

| Limit | Value |
| --- | --- |
| ZIP upload (compressed) | 10 MiB |
| ZIP entries (including directories) | 5,000 |
| Source files per analysis | 2,000 |
| Total uncompressed source | 25 MiB |
| Per source file | 1 MiB |
| Persisted impacts | 1,000 |
| Evidence snippet | 280 characters |
| Wall-clock budget | 20 seconds |

These are enforced in both the ZIP/GitHub input layers and the analyzer.

## ZIP security

- The archive is never written to disk; extraction is in memory.
- ZIP magic bytes are checked before decompression.
- Absolute paths, drive-letter paths, null bytes, empty segments, and `..`
  traversal entries are rejected.
- Entry count, declared per-file size, total declared uncompressed size, and
  actual decoded sizes are bounded.
- Unsupported compression methods are skipped.
- Non-UTF-8 files are skipped and reported as skipped metadata.
- Uploaded code is never executed.

## GitHub integration

Set `GITHUB_TOKEN` on the API server. Use a GitHub App installation token or a
fine-grained personal access token with read-only `Contents` permission. The
token stays server-side and is never returned to the browser or included in
errors/logs.

The integration:

- uses the official REST API (`GITHUB_API_BASE_URL`, default
  `https://api.github.com`),
- resolves the repository default branch when `ref` is omitted,
- resolves the ref to a commit SHA,
- reads the recursive Git tree,
- fetches only supported blobs (bounded concurrency),
- enforces a per-request timeout (15 s) and an overall analysis budget (60 s),
- handles `401`, `403`, `404`, `429`, rate-limit resets, network failures, and
  truncated trees explicitly,
- never clones the repository or installs dependencies.

If `GITHUB_TOKEN` is absent, the API returns `503 github_not_configured`. It
never fakes a successful connection.

## Limitations

- Calls with runtime-composed URLs, variables, dynamic methods, or non-literal
  configuration are not detected.
- Custom wrappers that hide both method and path are not detected unless their
  call shape matches the supported patterns.
- Generated clients, GraphQL, WebSockets, and non-HTTP integrations are out of
  scope.
- Base-path differences are handled only through suffix matching; ambiguous
  matches prefer the most specific operation.
- The analyzer reports observed source calls and inferred matches, not runtime
  failures or guaranteed breakage.
