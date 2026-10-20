# ContractRipple — Evidence-backed impact graph

The impact graph links **changed OpenAPI operations** to **frontend source files**
using only the comparison findings and source impacts that were actually stored
for the selected analysis. It is the visual companion to the findings table and
the source-impact evidence list.

There is no separate graph API and no new persistence model. The graph is built
in the browser from:

- `AnalysisRunDetailDto.findings` — the classified comparison findings.
- `SourceSnapshotDetailDto.impacts` — persisted static-analysis matches for a
  ZIP or GitHub snapshot.

The deterministic builder lives in `packages/impact-graph` and is covered by
unit tests. The UI lives in
`src/components/contracts/impact-graph.tsx`.

## What a node or relationship means

| Element | Meaning | Evidence carried |
| --- | --- | --- |
| Operation node | Changed operation, grouped by normalized HTTP method + path. | Risk (highest among its findings), finding count, and up to 20 findings (category, change type, risk, summary, JSON Pointer location). |
| File node | Source file referenced by at least one persisted match. | Path, total matched calls, highest confidence. |
| Relationship | One operation → one file, backed by one or more persisted `SourceImpact` rows. | Match count, highest confidence, and up to 20 impacts (file, line, column, call, path, snippet, confidence, evidence text). |

A file node exists only if at least one relationship points to it. A
relationship exists only if a persisted source impact names the same normalized
operation. The graph does **not** draw speculative links, inferred imports,
unmatched files, or operations without findings.

## Construction rules

1. **Group findings into operations.** Findings must have both a method and a
   path. Methods are trimmed and lower-cased. Paths are trimmed, backslashes are
   normalized to `/`, a leading `/` is added, repeated slashes are collapsed, and
   trailing slashes are removed (except the root path).
2. **Select the operation's risk.** The highest risk among its findings wins:
   `potentially_breaking` > `unknown` > `non_breaking`.
3. **Normalize impact matches.** `matchedMethod` and `matchedPath` follow the
   same rules as findings. The normalized method + path must equal an operation
   created from the findings.
4. **Aggregate by operation + file.** Multiple calls in the same file for the
   same operation become one relationship with several evidence entries.
5. **Rank deterministically.** Operations are sorted by risk, then finding
   count, then method, then path. Files are sorted by impact count, then path.
   Relationships are sorted by impact count, then operation, then file.
6. **Report what cannot be graphed.** Findings without a method/path and impacts
   that do not correspond to a changed operation become explicit limitations;
   they are never silently attached to a different node.
7. **Apply limits last.** Limits are applied to operations, then relationships,
   then files, so a limited graph never contains an edge whose operation or file
   was dropped. Truncation is reported in the summary and limitations.

### Important limitation: filters and query

Structural filters (risk, category, method, confidence) are applied while the
graph is built. The free-text query matches operation fields and impact evidence.
If an operation matches the query, all of its matched source relationships are
kept; if only an impact matches, its operation is kept so the relationship has a
visible endpoint. When a filter removes an operation, impacts for that operation
are reported as unmatched rather than silently reattached.

## UI behavior

The source-impact panel shows the graph only when a source snapshot is selected.
The graph includes:

- **Map view** — a deterministic SVG with operations on the left and source files
  on the right. Edges are colored by highest confidence and dashed for medium or
  low confidence. Operation edges are tinted by risk. Hovering highlights related
  edges; clicking a node opens its evidence.
- **Relationships view** — a semantic table with the same operations, files,
  confidence, and evidence. This is the keyboard and screen-reader equivalent of
  the pointer-oriented map. It also shows operations with no persisted match
  instead of hiding them.
- **Filters** — risk, category, method, confidence, and free-text search, with a
  live result count and an explicit "Clear filters" action.
- **Evidence detail** — selected operation findings or the exact source calls
  (file, line, column, snippet, evidence text).
- **Limitations** — graph-specific limitations, including unmatched findings,
  unmatched impacts, active filters, truncation, and the static-analysis
  caveat.

Risk is always labeled with text as well as color. The page has visible
focus outlines, the map is labeled as a visual view, and the relationships table
remains available without pointer input. The map and table use the same graph
object, so their contents cannot disagree.

## Limits

Defaults are defined in `packages/impact-graph/src/types.ts`:

| Limit | Default | Effect |
| --- | --- | --- |
| Operations per graph | 200 | Highest-risk operations are kept first. |
| Files per graph | 400 | Files with the most matches are kept first. |
| Relationships per graph | 800 | Highest-impact relationships are kept first. |
| Evidence per node/relationship | 20 | The full evidence remains in the source-impact list below the graph. |

Source analysis itself is bounded before the graph is built: 10 MiB compressed
ZIP, 5,000 entries, 2,000 source files, 1 MiB per file, 25 MiB uncompressed, and
a 20-second analyzer budget. The API persists at most the matches reported by
the analyzer; the graph never enlarges that set.

## Library evaluation

The graph is rendered with a small custom SVG layout. This was chosen over
graph libraries because:

- **React Flow** adds a large client bundle and interactive canvas primitives
  for drag/zoom/connection editing, none of which this read-only view needs.
- **d3-force** produces a different layout on each run unless seeded, and force
  layouts are harder to scan and test for a two-column operation/file graph.
- **Cytoscape** is a substantial graph engine with its own rendering and styling
  model; the bundle and API surface are disproportionate for this bounded view.
- **Custom SVG** keeps the dependency footprint at zero, makes layout
  deterministic, supports keyboard-friendly table fallback cleanly, and is easy
  to test at the builder level.

The existing ESLint React Compiler rules also make a minimal component tree
easier to keep memoization-safe.

## Testing

`packages/impact-graph/src/build.test.ts` covers:

- grouping findings by normalized method/path and risk aggregation;
- exact, normalized, and non-matching impact keys;
- unmatched findings/impacts and source-null behavior;
- risk, category, method, confidence, and query filters;
- deterministic ordering;
- operation, file, edge, and evidence limits;
- truncation and limitation messages;
- the guarantee that edges never reference missing operations or files.

The frontend was also checked against a live comparison and ZIP snapshot:
two changed operations and two persisted matches produced two edges to one
file in both the map and relationships views. This is a manual smoke test, not
a substitute for the unit tests.

## Known limitations

- Static analysis cannot see runtime-composed URLs, custom wrappers that hide
  method/path, generated clients, GraphQL/WebSocket traffic, or server-side
  integrations. The graph inherits every source-analysis limitation.
- Findings are grouped by method + path. If the comparison omits a method or
  path, the finding cannot be placed on the graph and is reported instead.
- A source match is only shown for an operation the comparison changed. A file
  that calls an unchanged operation is intentionally not drawn.
- There is no authentication or per-user ownership yet; the API and graph must
  not be exposed publicly with real user data before Phase 7.
- The graph is a client-side projection of persisted evidence. It does not
  re-run the analyzer, and it does not verify the code at runtime.
