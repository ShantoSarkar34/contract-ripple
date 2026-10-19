# ContractRipple — OpenAPI Comparison Engine

## Status

Phase 2 implements an independent OpenAPI comparison engine in
`packages/engine`. It has no HTTP, database, authentication, GitHub, ZIP, or
graph dependencies. Phase 3 can call it from the Express API.

## Public interface

```ts
import { compareContracts } from "@contract-ripple/engine";

const result = await compareContracts({
  baseline: { content: baselineJsonOrYaml },
  candidate: { content: candidateJsonOrYaml },
  options: {
    maxBytes: 5 * 1024 * 1024, // optional, default 5 MiB
    maxFindings: 5_000,        // optional, default 5,000
  },
});
```

`compareContracts` is the supported entry point for untrusted input. It
returns a `ComparisonResult`:

```ts
type ComparisonResult = {
  baseline: ContractSummary;
  candidate: ContractSummary;
  findings: Finding[];
  summary: {
    total: number;
    nonBreaking: number;
    potentiallyBreaking: number;
    unknown: number;
  };
  limitations: string[];
  truncated: boolean;
};
```

Lower-level exports are available for tests and future callers:
`parseContractInput`, `validateContract`, `normalizeContract`,
`compareNormalizedContracts`, and `summarizeFindings`. They must not be used on
untrusted input without the same size/depth checks that `compareContracts`
applies.

## Pipeline

```
JSON/YAML text
  → size/depth/cycle checks
  → parse
  → OpenAPI 3.0/3.1 validation (external refs disabled)
  → canonicalize semantically unordered arrays
  → normalize operations/parameters/bodies/responses/schemas
  → compare
  → classify risk
  → sort + serialize findings
```

| Module | Responsibility |
| --- | --- |
| `parse.ts` | JSON/YAML parsing, format detection, UTF-8 byte limit, depth/cycle checks, YAML alias limit. |
| `validate.ts` | OpenAPI 3.0.x/3.1.x validation with external file/network resolution disabled. Validates a clone so the original `$ref` structure is preserved. |
| `canonicalize.ts` | Sorts parameters and `oneOf`/`anyOf` alternatives so pointers and finding IDs do not depend on semantically irrelevant input order. |
| `normalize.ts` | Resolves internal `$ref`s, applies path-level parameters, merges `allOf`, and produces a parser-independent model. |
| `compare.ts` | Walks operations, parameters, bodies, responses, media types, and schemas. Produces raw findings. |
| `classify.ts` | Pure risk rules with direction-aware explanations (`request` vs `response`). |
| `serialize.ts` | Deterministic finding IDs, sorting, summary counts, and deduplicated limitations. |
| `pointer.ts` | RFC 6901 JSON Pointer escaping/parsing/resolution. |
| `clone.ts` | Safe deep clone that preserves `__proto__` as data and handles shared/circular YAML aliases. |

## Supported input

- OpenAPI **3.0.x** and **3.1.x**.
- JSON and YAML. Format is detected from the first non-whitespace character
  (`{`/`[` → JSON) and can be overridden with `format`.
- Internal references only: `#/...` JSON Pointers inside the uploaded document.
- Swagger 2.0 and other OpenAPI versions are rejected with
  `unsupported_version`.

## Finding model

Every finding contains:

```ts
type Finding = {
  id: string;                 // deterministic hash of stable fields
  category:
    | "operation" | "operation_id" | "parameter" | "request_body"
    | "response" | "required_property" | "schema_property"
    | "reference" | "combinator";
  changeType: "added" | "removed" | "modified";
  risk: "non_breaking" | "potentially_breaking" | "unknown";
  path?: string;              // e.g. /pets/{id}
  method?: string;            // e.g. get
  operationId?: string;
  location: string;           // JSON Pointer into candidate, or baseline for removals
  summary: string;            // human-readable one-line description
  explanation: string;        // why the risk label was chosen
  before?: string;
  after?: string;
};
```

Findings are sorted by path, HTTP method, category, JSON Pointer, summary, and
ID. The same semantic inputs produce the same order and IDs, including when
parameters or `oneOf`/`anyOf` alternatives are reordered.

## Classification rules

The rules are intentionally conservative. `unknown` is used when the engine
cannot prove an impact rather than silently calling a change safe.

### Operations and parameters

| Change | Request impact | Risk |
| --- | --- | --- |
| Operation added | Additive | `non_breaking` |
| Operation removed | Existing calls fail | `potentially_breaking` |
| `operationId` changed/added/removed | Generated clients may rename methods | `potentially_breaking` |
| Optional parameter added | Existing requests valid | `non_breaking` |
| Required parameter added | Existing requests invalid | `potentially_breaking` |
| Parameter removed | Clients may still send it | `potentially_breaking` |
| Parameter becomes required | Existing requests invalid | `potentially_breaking` |
| Parameter becomes optional | Existing requests valid | `non_breaking` |
| Parameter serialization metadata (`style`, `explode`, …) changed | Encoding may change | `unknown` |

### Request bodies and media types

| Change | Risk |
| --- | --- |
| Optional request body added | `non_breaking` |
| Required request body added | `potentially_breaking` |
| Request body removed | `potentially_breaking` |
| Body becomes required | `potentially_breaking` |
| Body becomes optional | `non_breaking` |
| Request media type added | `non_breaking` |
| Request media type removed | `potentially_breaking` |

### Responses

| Change | Risk |
| --- | --- |
| Response status added | `non_breaking` |
| Response status removed | `potentially_breaking` |
| Response media type added | `non_breaking` |
| Response media type removed | `potentially_breaking` |

### Schemas

Schema findings are direction-aware. The same change can have different
client impact in a request and a response.

| Change | Request | Response |
| --- | --- | --- |
| Optional property added | `non_breaking` | `non_breaking` |
| Required property added | `potentially_breaking` | `non_breaking` |
| Property removed | `potentially_breaking` | `potentially_breaking` |
| Property becomes required | `potentially_breaking` | `non_breaking` |
| Property no longer required | `non_breaking` | `potentially_breaking` |
| Type set widens | `non_breaking` | `potentially_breaking` |
| Type set narrows | `potentially_breaking` | `non_breaking` |
| Type set otherwise changes | `potentially_breaking` | `potentially_breaking` |
| Type constraint added/removed on an untyped schema | `unknown` | `unknown` |
| Format changed | `potentially_breaking` | `potentially_breaking` |
| Enum value added | `non_breaking` | `potentially_breaking` |
| Enum value removed | `potentially_breaking` | `non_breaking` |
| Enum constraint added | `potentially_breaking` | `unknown` |
| Enum constraint removed | `non_breaking` | `potentially_breaking` |
| Validation constraint changed | `potentially_breaking` | `unknown` |
| Array item schema added/removed | `unknown` | `unknown` |
| Boolean schema changed | `potentially_breaking` | `potentially_breaking` |
| `$ref` target changed | `potentially_breaking` | `potentially_breaking` |
| Unresolved/external `$ref` changed | `unknown` | `unknown` |
| `oneOf`/`anyOf` variants changed | `unknown` | `unknown` |
| Unsupported keyword changed | `unknown` | `unknown` |

“Type constraint added/removed on an untyped schema” means one side has no
`type` (accepts anything). The engine does not infer implicit object types.

## Reference handling

- Internal `$ref`s are resolved with JSON Pointer semantics (`~0`, `~1`).
- External `$ref`s are never fetched and are reported as unresolved. Changes
  involving them are `unknown`.
- Circular schema references are detected and not expanded. Nested changes
  behind a cycle are not compared; the limitation is included in the result.
- Boolean schemas (`true`/`false`) are supported for OpenAPI 3.1.
- `$ref` siblings are ignored because the resolved target is used. This is
  recorded as a limitation when siblings are present.
- `allOf` object properties and `required` lists are merged. `oneOf`, `anyOf`,
  `not`, `if`, `then`, and `else` are not fully interpreted; changes are
  reported as `unknown`.

## Security

- **Size limit:** 5 MiB per document by default (UTF-8 bytes), configurable up
  to 50 MiB for trusted callers.
- **Depth limit:** 128 levels.
- **Circular YAML aliases:** rejected (`circular_input`).
- **YAML alias expansion:** `maxAliasCount: 100` (rejects “billion laughs”).
- **YAML schema:** `core`, strict, unique keys. No executable or custom YAML
  tags are used.
- **External refs:** disabled for both validation and normalization. No
  network or filesystem access based on uploaded content.
- **Validation timeout:** 5 seconds for the parser's internal dereferencing.
- **Finding limit:** 5,000 by default, configurable up to 100,000; truncation is
  explicit.
- **No execution:** uploaded content is never evaluated or executed.
- **Error hygiene:** parser messages are single-lined and length-capped.
  `EngineError` carries a code and safe details, not raw document contents.
- **Prototype safety:** clones use own data properties so keys such as
  `__proto__` cannot mutate prototypes.

## Library evaluation

### Selected

- **`@readme/openapi-parser` 9.1.0** (MIT) — OpenAPI 3.0/3.1 parsing,
  validation, and reference support, actively maintained. We use its
  `validate()` function only. External/file resolution is disabled. Note:
  `validate()` mutates the document it receives and dereferences in place, so
  the engine validates a clone and keeps the original `$ref` structure for its
  own cycle-safe normalizer.
- **`yaml` 2.9.1** (ISC) — maintained YAML parser with alias limits and strict
  parsing.
- **`openapi-types` 12.1.3** (MIT) — TypeScript types for the validator
  boundary.

### Evaluated and not selected

- **`openapi-diff` 0.24.1** (Apache-2.0) — provides a diff tree, but does not
  expose stable JSON Pointers/evidence for every change, and OpenAPI 3.1
  behavior was not verified. The project needs deterministic findings and
  evidence, so a controlled comparator was implemented instead.
- **`@apidevtools/swagger-parser` 13.1.0** — capable validator, but the
  selected parser directly supports the OpenAPI 3.1 validation rules needed
  here.
- **`@useoptic/openapi-utilities` 1.0.9** — useful utilities, but not a
  complete, evidence-oriented diff/classification pipeline.

A custom comparator is used to guarantee stable ordering, JSON Pointers,
direction-aware classifications, explicit unknown handling, and bounded
resource use.

## Known limitations

- Only operations under `paths` are analyzed. Webhooks, callbacks, and links
  are not.
- Servers, security schemes, tags, external documentation, response headers,
  and request/response encodings are not compared.
- Descriptions, summaries, examples, defaults, and deprecation flags are
  ignored as documentation/metadata.
- Full JSON Schema semantics are not implemented. Composition is partial and
  unsupported keywords are surfaced as `unknown`.
- Implicit object types are not inferred.
- Constraints are compared heuristically; the engine does not perform JSON
  Schema validation of example payloads.
- Schema normalization stops at 32 levels; comparison stops at 64. Deeper
  changes are reported as unknown/limitation rather than silently compared.
- Type names and property names are compared literally; renaming a component
  changes `$ref` evidence and is conservatively `potentially_breaking`.
- The engine reports observed structural changes and inferred compatibility
  risk. It does not claim to prove that a client is unaffected.

## Tests

Run:

```bash
npm test
```

Engine tests cover:

- JSON/YAML parsing, format override, empty/oversized/too-deep/circular input.
- YAML alias bombs.
- Invalid OpenAPI, Swagger 2.0, future OpenAPI versions, and non-object roots.
- Validation not mutating `$ref`s and not fetching external references.
- Unchanged contracts, added/removed operations, parameters, bodies, responses,
  media types, operation IDs, properties, required changes, types, formats,
  enums, constraints, arrays, boolean schemas, and `allOf`.
- Internal/circular/external references, `oneOf` changes, unsupported keywords.
- Request/response direction-aware risk labels.
- JSON Pointer escaping, deterministic ordering, deduplication, finding limits,
  and documentation-only changes.

## Phase 3 integration notes

- Call `compareContracts` from the API service layer; do not reimplement diff
  logic in route handlers.
- Persist the original documents and the returned finding model separately.
- Return `EngineError.code` and `details` in the API error envelope, but never
  return raw stack traces or document contents.
- Enforce the same or stricter upload limits at the HTTP boundary.
- Treat `unknown` and `truncated` results as partial analysis in the UI.
