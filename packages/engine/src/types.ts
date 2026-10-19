/**
 * Public contract and result types for the OpenAPI comparison engine.
 *
 * The normalized types in this file are implementation details exported for
 * testing and for future report/graph work. They are intentionally stable and
 * free of parser-library types.
 */

export type ContractFormat = "json" | "yaml";

export type ContractInput = {
  /** Raw JSON or YAML text. */
  content: string;
  /** Optional override. When omitted, the format is detected from the content. */
  format?: ContractFormat;
};

export type CompareOptions = {
  /** Maximum UTF-8 bytes per document. Defaults to 5 MiB. */
  maxBytes?: number;
  /** Maximum findings to collect before truncating. Defaults to 5,000. */
  maxFindings?: number;
};

export type CompareContractsInput = {
  baseline: ContractInput;
  candidate: ContractInput;
  options?: CompareOptions;
};

export type RiskLevel = "non_breaking" | "potentially_breaking" | "unknown";

export type ChangeType = "added" | "removed" | "modified";

export type FindingCategory =
  | "operation"
  | "operation_id"
  | "parameter"
  | "request_body"
  | "response"
  | "required_property"
  | "schema_property"
  | "reference"
  | "combinator";

export type Finding = {
  /** Deterministic identifier derived from the finding's stable fields. */
  id: string;
  category: FindingCategory;
  changeType: ChangeType;
  risk: RiskLevel;
  path?: string;
  method?: string;
  operationId?: string;
  /** JSON Pointer into the candidate document (or baseline for removals). */
  location: string;
  summary: string;
  explanation: string;
  before?: string;
  after?: string;
};

export type ContractSummary = {
  openapi: string;
  title?: string;
  version?: string;
  warnings: string[];
};

export type ComparisonSummary = {
  total: number;
  nonBreaking: number;
  potentiallyBreaking: number;
  unknown: number;
};

export type ComparisonResult = {
  baseline: ContractSummary;
  candidate: ContractSummary;
  findings: Finding[];
  summary: ComparisonSummary;
  limitations: string[];
  truncated: boolean;
};

/* -------------------------------------------------------------------------- */
/* Normalized contract model                                                  */
/* -------------------------------------------------------------------------- */

export type NormalizedProperty = {
  name: string;
  schema: NormalizedSchema;
};

export type NormalizedSchema = {
  /** JSON Pointer to the resolved schema definition. */
  pointer: string;
  /** Original `$ref` value, when this schema came from a reference. */
  ref?: string;
  unresolved?: boolean;
  externalRef?: boolean;
  circular?: boolean;
  /** OpenAPI 3.1 allows boolean JSON Schemas (`true` accepts anything, `false` accepts nothing). */
  booleanSchema?: boolean;
  /** Normalized, sorted type names. `null` is included for nullable schemas. */
  types: string[];
  format?: string;
  /** Stable stringified enum values, sorted. */
  enumValues: string[];
  properties: NormalizedProperty[];
  required: string[];
  items?: NormalizedSchema;
  oneOf: NormalizedSchema[];
  anyOf: NormalizedSchema[];
  /**
   * Validation constraints we compare conservatively, serialized to stable
   * strings (for example `minLength=1`).
   */
  constraints: Record<string, string>;
  /**
   * Keywords this phase does not model. Changes are surfaced as `unknown`
   * rather than silently ignored.
   */
  unsupported: string[];
};

export type NormalizedParameter = {
  name: string;
  in: string;
  required: boolean;
  schema?: NormalizedSchema;
  /** JSON Pointer to the parameter usage in the operation. */
  pointer: string;
  /** Serialization keywords, serialized to stable strings. */
  serialization: Record<string, string>;
};

export type NormalizedMediaType = {
  mediaType: string;
  schema?: NormalizedSchema;
  pointer: string;
};

export type NormalizedRequestBody = {
  required: boolean;
  content: NormalizedMediaType[];
  pointer: string;
};

export type NormalizedResponse = {
  status: string;
  description?: string;
  content: NormalizedMediaType[];
  pointer: string;
};

export type NormalizedOperation = {
  method: string;
  path: string;
  operationId?: string;
  pointer: string;
  parameters: NormalizedParameter[];
  requestBody?: NormalizedRequestBody;
  responses: NormalizedResponse[];
};

export type NormalizedContract = {
  summary: ContractSummary;
  operations: NormalizedOperation[];
  limitations: string[];
};
