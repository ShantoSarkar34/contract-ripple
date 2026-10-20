# ContractRipple — Reports and regression suggestions

## Purpose

Phase 6 turns a persisted comparison into a downloadable report and derives
review prompts from its findings. Everything comes from records that already
exist in PostgreSQL:

- `AnalysisRun` summary counts, duration, truncation, and limitations.
- `Finding` rows in their deterministic engine order.
- The latest `SourceSnapshot` attached to the comparison, with its
  `SourceImpact` evidence.

There is no report table, no stored export artifact, and no background job.
Generation is deterministic for the stored records (apart from `generatedAt`).

## API

```text
GET /api/v1/comparisons/:comparisonId/report?format=json
GET /api/v1/comparisons/:comparisonId/report?format=markdown
```

- `format` defaults to `json`.
- Responses are attachments with `Cache-Control: no-store`.
- JSON: `application/json`, complete report model.
- Markdown: `text/markdown`, readable report.
- Missing comparison: `404 comparison_not_found`.
- Invalid format: `400 validation_error`.

The shared model is `AnalysisReportDto` in `packages/shared/src/api.ts`. It adds
the project name, report schema version, generation timestamp, comparison
summary, findings, suggestions, source snapshot, limitations, and notes.

## Latest source snapshot

A comparison can have multiple source snapshots (for example a ZIP run followed
by a GitHub run). The report includes only the newest snapshot attached to that
comparison and records `availableSnapshotCount`. This keeps exports focused and
avoids duplicating the same evidence. The `/contracts` source panel still lets
the user inspect every snapshot.

If no snapshot is attached, `includedSnapshotId` and `snapshot` are `null`.

## Regression suggestions

`generateRegressionSuggestions(findings)` is a pure function in
`apps/api/src/services/regression-tests.ts`.

1. Ignore findings without both `method` and `path`; those cannot identify one
   operation-level test.
2. Group the remaining findings by lower-cased method + exact path.
3. Keep every finding id in the group, set the suggestion risk to the highest
   finding risk, and take the first non-null operation id.
4. Derive unique checks from the finding categories and change types. For
   example, a removed operation suggests exercising the client path and
   confirming graceful removal; a parameter change suggests exercising the
   changed parameter set; a composition change suggests testing the affected
   `oneOf`/`anyOf`/`allOf` branch.
5. Sort by risk (`potentially_breaking`, `unknown`, `non_breaking`), then method
   and path. Keep at most 20 evidence strings per suggestion while retaining all
   finding ids.

The generated text never invents an expected status code, test framework,
runtime result, or source file. The UI and Markdown export label these as review
prompts, not executable tests.

Findings without a method/path are still shown in the findings table and full
report; they simply do not produce an operation-level suggestion.

## JSON export

The JSON export is the complete machine-readable form. It includes:

- project and comparison identity;
- baseline/candidate contract summaries;
- all finding fields, including `before`/`after` values;
- regression suggestions with finding ids and evidence;
- latest source snapshot metadata and all impacts;
- comparison limitations and fixed report notes.

It deliberately omits raw contract contents and raw source files. Source
snippets are persisted evidence only, not full file contents.

## Markdown export

The Markdown export contains:

- report metadata and summary counts;
- limitations;
- regression suggestions with rationale, checks, and evidence;
- latest source snapshot metadata and impacts with snippets;
- a findings table;
- before/after code fences for findings that have them;
- notes and the static-analysis caveat.

Values are escaped for Markdown tables/inline text, and code fences grow when the
content contains backticks so evidence is not truncated or broken.

## Frontend behavior

- `ReportActions` in `src/components/contracts/report-actions.tsx` downloads the
  API response as a Blob and triggers a browser download. Object URLs are
  revoked after the click.
- The comparison report header shows JSON and Markdown export controls.
- `RegressionSuggestions` renders the persisted suggestions, with risk,
  method/path, checks, and expandable evidence. It shows 20 at a time and never
  fabricates a suggestion when none exist.
- Saved history loads 20 comparisons at a time and offers "Load more". It shows
  the loaded/total count, active comparison, date, change counts, and truncation.
- Errors from saving history, loading more, or exporting are displayed without
  replacing real data with demo content.

## Limits and security

- History page size: 1–50, default 20. Cursor is validated against the project.
- Reports use the same unauthenticated API as every other route until Phase 7.
  Do not expose real user data yet. CORS is not authorization.
- Reports are generated on request and not cached; no report artifacts are
  written to disk or object storage.
- Source evidence and contract-derived findings may be sensitive. Treat
  downloaded reports as project data and keep them out of logs.
- Only the latest source snapshot is exported; this is a deliberate clarity and
  size decision, not a claim that older snapshots are irrelevant.

## Tests

- `apps/api/src/services/regression-tests.test.ts` covers grouping, risk,
  category-derived checks, operation-scope filtering, evidence bounds, and
  stable order.
- `apps/api/src/services/reports.test.ts` covers JSON report contents, latest
  snapshot selection, no-source reports, Markdown rendering, and missing
  comparisons.
- `apps/api/src/services/comparisons.test.ts` covers cursor pagination,
  cross-project cursors, and deterministic suggestions in detail responses.
- `apps/api/src/routes/reports.test.ts` covers real HTTP pagination, JSON and
  Markdown downloads, headers, invalid formats, and unknown comparisons.
- `packages/shared/src/api.test.ts` covers the history/report query schemas.
