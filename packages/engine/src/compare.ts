import {
  classifyAddedMediaType,
  classifyAddedOperation,
  classifyAddedParameter,
  classifyAddedProperty,
  classifyAddedRequestBody,
  classifyAddedResponse,
  classifyArrayItemsChange,
  classifyCombinatorChange,
  classifyConstraintChange,
  classifyEnumConstraintAdded,
  classifyEnumConstraintRemoved,
  classifyEnumValueAdded,
  classifyEnumValueRemoved,
  classifyFormatChange,
  classifyObjectSchemaChange,
  classifyOperationIdChange,
  classifyParameterRequiredChange,
  classifyReferenceChange,
  classifyRemovedMediaType,
  classifyRemovedOperation,
  classifyRemovedParameter,
  classifyRemovedProperty,
  classifyRemovedRequestBody,
  classifyRemovedResponse,
  classifyRequestBodyRequiredChange,
  classifyRequiredPropertyChange,
  classifySchemaPresenceChange,
  classifySerializationChange,
  classifyTypeChange,
  classifyUntypedChange,
  classifyUnresolvedReferenceChange,
  classifyUnsupportedKeywordChange,
  type Classification,
  type Direction,
} from "./classify.js";
import { schemaSignature } from "./schema-signature.js";
import type {
  ChangeType,
  Finding,
  FindingCategory,
  NormalizedContract,
  NormalizedMediaType,
  NormalizedOperation,
  NormalizedParameter,
  NormalizedRequestBody,
  NormalizedResponse,
  NormalizedSchema,
} from "./types.js";

export const DEFAULT_MAX_FINDINGS = 5_000;

const METHOD_ORDER: Record<string, number> = {
  get: 0,
  put: 1,
  post: 2,
  delete: 3,
  options: 4,
  head: 5,
  patch: 6,
  trace: 7,
};

const CATEGORY_ORDER: Record<FindingCategory, number> = {
  operation: 0,
  operation_id: 1,
  parameter: 2,
  request_body: 3,
  response: 4,
  required_property: 5,
  schema_property: 6,
  reference: 7,
  combinator: 8,
};

export type CompareNormalizedOptions = {
  maxFindings?: number;
};

export type ComparisonOutcome = {
  findings: Finding[];
  limitations: string[];
  truncated: boolean;
};

type FindingInput = Omit<Finding, "id">;
type Emit = (finding: FindingInput) => void;

type SchemaContext = {
  operation: NormalizedOperation;
  direction: Direction;
  label: string;
};

function sameArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function djb2(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function findingId(finding: FindingInput): string {
  const key = [
    finding.category,
    finding.changeType,
    finding.path ?? "",
    finding.method ?? "",
    finding.location,
    finding.summary,
  ].join("|");
  return `f_${fnv1a(key)}${djb2(key)}`;
}

function contextFields(operation: NormalizedOperation): Pick<
  Finding,
  "path" | "method" | "operationId"
> {
  return {
    path: operation.path,
    method: operation.method,
    operationId: operation.operationId,
  };
}

function makeFinding(
  category: FindingCategory,
  changeType: ChangeType,
  classification: Classification,
  location: string,
  summary: string,
  context: { operation: NormalizedOperation },
  before?: string,
  after?: string,
): FindingInput {
  return {
    category,
    changeType,
    risk: classification.risk,
    ...contextFields(context.operation),
    location,
    summary,
    explanation: classification.explanation,
    ...(before === undefined ? {} : { before }),
    ...(after === undefined ? {} : { after }),
  };
}

function schemaFinding(
  category: FindingCategory,
  changeType: ChangeType,
  classification: Classification,
  location: string,
  summary: string,
  context: SchemaContext,
  before?: string,
  after?: string,
): FindingInput {
  return makeFinding(
    category,
    changeType,
    classification,
    location,
    `${context.label}: ${summary}`,
    context,
    before,
    after,
  );
}

function summarizeSchema(schema: NormalizedSchema): string {
  if (schema.booleanSchema !== undefined) {
    return schema.booleanSchema ? "true (accepts anything)" : "false (accepts nothing)";
  }
  if (schema.ref) {
    return schema.ref;
  }

  const parts: string[] = [];
  if (schema.types.length > 0) {
    parts.push(schema.types.join(" | "));
  }
  if (schema.format) {
    parts.push(`format=${schema.format}`);
  }
  if (schema.enumValues.length > 0) {
    parts.push(`enum=[${schema.enumValues.join(", ")}]`);
  }
  return parts.length > 0 ? parts.join(", ") : "(untyped)";
}

function compareFindings(left: Finding, right: Finding): number {
  return (
    (left.path ?? "").localeCompare(right.path ?? "") ||
    (METHOD_ORDER[left.method ?? ""] ?? 99) - (METHOD_ORDER[right.method ?? ""] ?? 99) ||
    CATEGORY_ORDER[left.category] - CATEGORY_ORDER[right.category] ||
    left.location.localeCompare(right.location) ||
    left.summary.localeCompare(right.summary) ||
    left.risk.localeCompare(right.risk) ||
    left.id.localeCompare(right.id)
  );
}

function asMediaTypeMap(content: NormalizedMediaType[]): Map<string, NormalizedMediaType> {
  return new Map(content.map((mediaType) => [mediaType.mediaType, mediaType]));
}

function sortedUnion<T>(left: Map<string, T>, right: Map<string, T>): string[] {
  return [...new Set([...left.keys(), ...right.keys()])].sort();
}

function formatSerialization(serialization: Record<string, string>): string {
  const keys = Object.keys(serialization).sort();
  return keys.length === 0
    ? "(defaults)"
    : keys.map((key) => `${key}=${serialization[key]}`).join(", ");
}

function sameSerialization(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (left[key] !== right[key]) {
      return false;
    }
  }
  return true;
}

function addedValues(before: string[], after: string[]): string[] {
  const beforeSet = new Set(before);
  return after.filter((value) => !beforeSet.has(value));
}

function removedValues(before: string[], after: string[]): string[] {
  const afterSet = new Set(after);
  return before.filter((value) => !afterSet.has(value));
}

function unsupportedMap(values: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const value of values) {
    const separator = value.indexOf("=");
    const keyword = separator === -1 ? value : value.slice(0, separator);
    map.set(keyword, value);
  }
  return map;
}

/**
 * Compares two already-normalized contracts. This function is pure and does
 * not parse or validate; callers should use `compareContracts` for untrusted
 * input.
 */
export function compareNormalizedContracts(
  baseline: NormalizedContract,
  candidate: NormalizedContract,
  options: CompareNormalizedOptions = {},
): ComparisonOutcome {
  const maxFindings = options.maxFindings ?? DEFAULT_MAX_FINDINGS;
  const findings: Finding[] = [];
  const limitations = new Set<string>();
  let truncated = false;

  const emit: Emit = (finding) => {
    if (findings.length >= maxFindings) {
      truncated = true;
      return;
    }
    findings.push({ ...finding, id: findingId(finding) });
  };

  const beforeOperations = new Map(
    baseline.operations.map((operation) => [
      `${operation.method} ${operation.path}`,
      operation,
    ]),
  );
  const afterOperations = new Map(
    candidate.operations.map((operation) => [
      `${operation.method} ${operation.path}`,
      operation,
    ]),
  );

  const operationKeys = [
    ...new Set([...beforeOperations.keys(), ...afterOperations.keys()]),
  ];

  operationKeys.sort((leftKey, rightKey) => {
    const left = beforeOperations.get(leftKey) ?? afterOperations.get(leftKey);
    const right = beforeOperations.get(rightKey) ?? afterOperations.get(rightKey);
    const leftPath = left?.path ?? "";
    const rightPath = right?.path ?? "";
    return (
      leftPath.localeCompare(rightPath) ||
      (METHOD_ORDER[left?.method ?? ""] ?? 99) - (METHOD_ORDER[right?.method ?? ""] ?? 99)
    );
  });

  for (const key of operationKeys) {
    const before = beforeOperations.get(key);
    const after = afterOperations.get(key);

    if (before === undefined && after !== undefined) {
      emit(
        makeFinding(
          "operation",
          "added",
          classifyAddedOperation(),
          after.pointer,
          `Added operation \`${after.method.toUpperCase()} ${after.path}\``,
          { operation: after },
        ),
      );
      continue;
    }

    if (before !== undefined && after === undefined) {
      emit(
        makeFinding(
          "operation",
          "removed",
          classifyRemovedOperation(),
          before.pointer,
          `Removed operation \`${before.method.toUpperCase()} ${before.path}\``,
          { operation: before },
        ),
      );
      continue;
    }

    if (before !== undefined && after !== undefined) {
      compareOperation(before, after, emit, limitations);
    }
  }

  if (truncated) {
    limitations.add("Finding limit reached; results are truncated.");
  }

  findings.sort(compareFindings);

  return {
    findings,
    limitations: [...limitations].sort(),
    truncated,
  };
}

function compareOperation(
  before: NormalizedOperation,
  after: NormalizedOperation,
  emit: Emit,
  limitations: Set<string>,
): void {
  const visited = new Set<string>();

  if (before.operationId !== after.operationId) {
    const beforeId = before.operationId ?? "(none)";
    const afterId = after.operationId ?? "(none)";
    emit(
      makeFinding(
        "operation_id",
        "modified",
        classifyOperationIdChange(),
        after.pointer,
        `Operation ID changed from \`${beforeId}\` to \`${afterId}\``,
        { operation: after },
        beforeId,
        afterId,
      ),
    );
  }

  const beforeParameters = new Map(
    before.parameters.map((parameter) => [
      `${parameter.in}:${parameter.name}`,
      parameter,
    ]),
  );
  const afterParameters = new Map(
    after.parameters.map((parameter) => [
      `${parameter.in}:${parameter.name}`,
      parameter,
    ]),
  );

  const parameterKeys = [
    ...new Set([...beforeParameters.keys(), ...afterParameters.keys()]),
  ];
  parameterKeys.sort((leftKey, rightKey) => {
    const left = beforeParameters.get(leftKey) ?? afterParameters.get(leftKey);
    const right = beforeParameters.get(rightKey) ?? afterParameters.get(rightKey);
    return (
      (left?.in ?? "").localeCompare(right?.in ?? "") ||
      (left?.name ?? "").localeCompare(right?.name ?? "")
    );
  });

  for (const key of parameterKeys) {
    const beforeParameter = beforeParameters.get(key);
    const afterParameter = afterParameters.get(key);

    if (beforeParameter === undefined && afterParameter !== undefined) {
      emit(
        makeFinding(
          "parameter",
          "added",
          classifyAddedParameter(afterParameter.required),
          afterParameter.pointer,
          `Added ${afterParameter.required ? "required" : "optional"} ${afterParameter.in} parameter \`${afterParameter.name}\``,
          { operation: after },
          undefined,
          afterParameter.required ? "required" : "optional",
        ),
      );
      continue;
    }

    if (beforeParameter !== undefined && afterParameter === undefined) {
      emit(
        makeFinding(
          "parameter",
          "removed",
          classifyRemovedParameter(),
          beforeParameter.pointer,
          `Removed ${beforeParameter.in} parameter \`${beforeParameter.name}\``,
          { operation: after },
          `${beforeParameter.in}:${beforeParameter.name}`,
        ),
      );
      continue;
    }

    if (beforeParameter !== undefined && afterParameter !== undefined) {
      compareParameter(beforeParameter, afterParameter, after, emit, limitations, visited);
    }
  }

  compareRequestBody(
    before.requestBody,
    after.requestBody,
    after,
    emit,
    limitations,
    visited,
  );

  compareResponses(before.responses, after.responses, after, emit, limitations, visited);
}

function compareParameter(
  before: NormalizedParameter,
  after: NormalizedParameter,
  operation: NormalizedOperation,
  emit: Emit,
  limitations: Set<string>,
  visited: Set<string>,
): void {
  if (before.required !== after.required) {
    emit(
      makeFinding(
        "parameter",
        "modified",
        classifyParameterRequiredChange(after.required),
        after.pointer,
        `Parameter \`${after.name}\` ${after.required ? "became required" : "is no longer required"}`,
        { operation },
        before.required ? "required" : "optional",
        after.required ? "required" : "optional",
      ),
    );
  }

  if (!sameSerialization(before.serialization, after.serialization)) {
    limitations.add(
      "Parameter serialization metadata changes are reported as unknown.",
    );
    emit(
      makeFinding(
        "parameter",
        "modified",
        classifySerializationChange(),
        after.pointer,
        `Parameter \`${after.name}\` serialization metadata changed`,
        { operation },
        formatSerialization(before.serialization),
        formatSerialization(after.serialization),
      ),
    );
  }

  if (before.schema !== undefined && after.schema !== undefined) {
    compareSchemas(
      before.schema,
      after.schema,
      {
        operation,
        direction: "request",
        label: `Parameter \`${after.name}\``,
      },
      emit,
      limitations,
      visited,
    );
    return;
  }

  if (before.schema !== undefined || after.schema !== undefined) {
    const schema = after.schema ?? before.schema;
    emit(
      makeFinding(
        "parameter",
        "modified",
        classifySchemaPresenceChange(),
        schema?.pointer ?? after.pointer,
        `Parameter \`${after.name}\` schema was added or removed`,
        { operation },
        before.schema ? summarizeSchema(before.schema) : "(none)",
        after.schema ? summarizeSchema(after.schema) : "(none)",
      ),
    );
  }
}

function compareRequestBody(
  before: NormalizedRequestBody | undefined,
  after: NormalizedRequestBody | undefined,
  operation: NormalizedOperation,
  emit: Emit,
  limitations: Set<string>,
  visited: Set<string>,
): void {
  if (before === undefined && after === undefined) {
    return;
  }

  if (before === undefined && after !== undefined) {
    emit(
      makeFinding(
        "request_body",
        "added",
        classifyAddedRequestBody(after.required),
        after.pointer,
        `Added ${after.required ? "required" : "optional"} request body`,
        { operation },
        undefined,
        after.required ? "required" : "optional",
      ),
    );
    return;
  }

  if (before !== undefined && after === undefined) {
    emit(
      makeFinding(
        "request_body",
        "removed",
        classifyRemovedRequestBody(),
        before.pointer,
        "Removed request body",
        { operation },
      ),
    );
    return;
  }

  if (before === undefined || after === undefined) {
    return;
  }

  if (before.required !== after.required) {
    emit(
      makeFinding(
        "request_body",
        "modified",
        classifyRequestBodyRequiredChange(after.required),
        after.pointer,
        `Request body ${after.required ? "became required" : "is no longer required"}`,
        { operation },
        before.required ? "required" : "optional",
        after.required ? "required" : "optional",
      ),
    );
  }

  compareContent(
    before.content,
    after.content,
    { operation, direction: "request", label: "Request body" },
    emit,
    limitations,
    visited,
  );
}

function compareResponses(
  before: NormalizedResponse[],
  after: NormalizedResponse[],
  operation: NormalizedOperation,
  emit: Emit,
  limitations: Set<string>,
  visited: Set<string>,
): void {
  const beforeResponses = new Map(before.map((response) => [response.status, response]));
  const afterResponses = new Map(after.map((response) => [response.status, response]));

  for (const status of sortedUnion(beforeResponses, afterResponses)) {
    const beforeResponse = beforeResponses.get(status);
    const afterResponse = afterResponses.get(status);

    if (beforeResponse === undefined && afterResponse !== undefined) {
      emit(
        makeFinding(
          "response",
          "added",
          classifyAddedResponse(),
          afterResponse.pointer,
          `Added response \`${status}\``,
          { operation },
        ),
      );
      continue;
    }

    if (beforeResponse !== undefined && afterResponse === undefined) {
      emit(
        makeFinding(
          "response",
          "removed",
          classifyRemovedResponse(),
          beforeResponse.pointer,
          `Removed response \`${status}\``,
          { operation },
        ),
      );
      continue;
    }

    if (beforeResponse !== undefined && afterResponse !== undefined) {
      compareContent(
        beforeResponse.content,
        afterResponse.content,
        {
          operation,
          direction: "response",
          label: `Response \`${status}\``,
        },
        emit,
        limitations,
        visited,
      );
    }
  }
}

function compareContent(
  before: NormalizedMediaType[],
  after: NormalizedMediaType[],
  context: SchemaContext,
  emit: Emit,
  limitations: Set<string>,
  visited: Set<string>,
): void {
  const beforeMediaTypes = asMediaTypeMap(before);
  const afterMediaTypes = asMediaTypeMap(after);

  for (const mediaType of sortedUnion(beforeMediaTypes, afterMediaTypes)) {
    const beforeMedia = beforeMediaTypes.get(mediaType);
    const afterMedia = afterMediaTypes.get(mediaType);
    const category: FindingCategory =
      context.direction === "request" ? "request_body" : "response";

    if (beforeMedia === undefined && afterMedia !== undefined) {
      emit(
        makeFinding(
          category,
          "added",
          classifyAddedMediaType(context.direction),
          afterMedia.pointer,
          `${context.label}: added media type \`${mediaType}\``,
          context,
          undefined,
          mediaType,
        ),
      );
      continue;
    }

    if (beforeMedia !== undefined && afterMedia === undefined) {
      emit(
        makeFinding(
          category,
          "removed",
          classifyRemovedMediaType(context.direction),
          beforeMedia.pointer,
          `${context.label}: removed media type \`${mediaType}\``,
          context,
          mediaType,
        ),
      );
      continue;
    }

    if (beforeMedia !== undefined && afterMedia !== undefined) {
      const mediaContext: SchemaContext = {
        ...context,
        label: `${context.label} (${mediaType})`,
      };

      if (beforeMedia.schema !== undefined && afterMedia.schema !== undefined) {
        compareSchemas(
          beforeMedia.schema,
          afterMedia.schema,
          mediaContext,
          emit,
          limitations,
          visited,
        );
      } else if (beforeMedia.schema !== undefined || afterMedia.schema !== undefined) {
        const schema = afterMedia.schema ?? beforeMedia.schema;
        emit(
          makeFinding(
            category,
            "modified",
            classifySchemaPresenceChange(),
            schema?.pointer ?? afterMedia.pointer,
            `${mediaContext.label}: schema was added or removed`,
            mediaContext,
            beforeMedia.schema ? summarizeSchema(beforeMedia.schema) : "(none)",
            afterMedia.schema ? summarizeSchema(afterMedia.schema) : "(none)",
          ),
        );
      }
    }
  }
}

function compareSchemas(
  before: NormalizedSchema,
  after: NormalizedSchema,
  context: SchemaContext,
  emit: Emit,
  limitations: Set<string>,
  visited: Set<string>,
  depth = 0,
): void {
  if (depth > 64) {
    limitations.add("Schema comparison stopped at the maximum depth.");
    return;
  }

  const visitedKey = `${context.direction}|${before.pointer}|${after.pointer}`;
  if (visited.has(visitedKey)) {
    return;
  }
  visited.add(visitedKey);

  if (before.ref !== after.ref) {
    const referenceKey = `ref|${before.pointer}|${after.pointer}|${before.ref ?? ""}|${after.ref ?? ""}`;
    if (!visited.has(referenceKey)) {
      visited.add(referenceKey);
      const unresolved = before.unresolved === true || after.unresolved === true;
      emit(
        schemaFinding(
          "reference",
          "modified",
          unresolved ? classifyUnresolvedReferenceChange() : classifyReferenceChange(),
          after.pointer,
          `schema reference changed from \`${before.ref ?? "inline"}\` to \`${after.ref ?? "inline"}\``,
          context,
          before.ref ?? "inline",
          after.ref ?? "inline",
        ),
      );
    }
  }

  if (before.unresolved === true || after.unresolved === true) {
    return;
  }

  if (before.circular === true || after.circular === true) {
    limitations.add(
      "Circular schema references are detected and not expanded; nested changes are not compared.",
    );
    return;
  }

  if (before.booleanSchema !== undefined || after.booleanSchema !== undefined) {
    if (
      before.booleanSchema !== undefined &&
      after.booleanSchema !== undefined &&
      before.booleanSchema === after.booleanSchema
    ) {
      return;
    }

    emit(
      schemaFinding(
        "schema_property",
        "modified",
        classifyObjectSchemaChange(),
        after.pointer,
        "boolean schema changed",
        context,
        summarizeSchema(before),
        summarizeSchema(after),
      ),
    );
    return;
  }

  if (!sameArray(before.types, after.types)) {
    if (before.types.length === 0 || after.types.length === 0) {
      emit(
        schemaFinding(
          "schema_property",
          "modified",
          classifyUntypedChange(),
          after.pointer,
          "schema type constraint was added or removed",
          context,
          before.types.length > 0 ? before.types.join(" | ") : "(untyped)",
          after.types.length > 0 ? after.types.join(" | ") : "(untyped)",
        ),
      );
    } else {
      const added = addedValues(before.types, after.types);
      const removed = removedValues(before.types, after.types);
      emit(
        schemaFinding(
          "schema_property",
          "modified",
          classifyTypeChange(context.direction, added, removed),
          after.pointer,
          `schema type changed from \`${before.types.join(" | ")}\` to \`${after.types.join(" | ")}\``,
          context,
          before.types.join(" | "),
          after.types.join(" | "),
        ),
      );
    }
  }

  if (before.format !== after.format) {
    emit(
      schemaFinding(
        "schema_property",
        "modified",
        classifyFormatChange(),
        after.pointer,
        `schema format changed from \`${before.format ?? "(none)"}\` to \`${after.format ?? "(none)"}\``,
        context,
        before.format ?? "(none)",
        after.format ?? "(none)",
      ),
    );
  }

  compareEnums(before, after, context, emit);

  const beforeProperties = new Map(
    before.properties.map((property) => [property.name, property]),
  );
  const afterProperties = new Map(
    after.properties.map((property) => [property.name, property]),
  );
  const addedProperties = [...afterProperties.keys()].filter(
    (name) => !beforeProperties.has(name),
  );
  const removedProperties = [...beforeProperties.keys()].filter(
    (name) => !afterProperties.has(name),
  );

  compareRequiredProperties(
    before,
    after,
    beforeProperties,
    afterProperties,
    addedProperties,
    removedProperties,
    context,
    emit,
  );

  for (const name of addedProperties.sort()) {
    const property = afterProperties.get(name);
    if (!property) {
      continue;
    }
    const required = after.required.includes(name);
    emit(
      schemaFinding(
        "schema_property",
        "added",
        classifyAddedProperty(context.direction, required),
        property.schema.pointer,
        `added ${required ? "required" : "optional"} property \`${name}\``,
        context,
        undefined,
        summarizeSchema(property.schema),
      ),
    );
  }

  for (const name of removedProperties.sort()) {
    const property = beforeProperties.get(name);
    if (!property) {
      continue;
    }
    emit(
      schemaFinding(
        "schema_property",
        "removed",
        classifyRemovedProperty(context.direction),
        property.schema.pointer,
        `removed property \`${name}\``,
        context,
        summarizeSchema(property.schema),
      ),
    );
  }

  for (const name of [...beforeProperties.keys()].sort()) {
    const beforeProperty = beforeProperties.get(name);
    const afterProperty = afterProperties.get(name);
    if (!beforeProperty || !afterProperty) {
      continue;
    }
    compareSchemas(
      beforeProperty.schema,
      afterProperty.schema,
      { ...context, label: `${context.label} property \`${name}\`` },
      emit,
      limitations,
      visited,
      depth + 1,
    );
  }

  if (before.items !== undefined && after.items !== undefined) {
    compareSchemas(
      before.items,
      after.items,
      { ...context, label: `${context.label}[]` },
      emit,
      limitations,
      visited,
      depth + 1,
    );
  } else if (before.items !== undefined || after.items !== undefined) {
    const items = after.items ?? before.items;
    emit(
      schemaFinding(
        "schema_property",
        "modified",
        classifyArrayItemsChange(),
        items?.pointer ?? after.pointer,
        "array item schema was added or removed",
        context,
        before.items ? summarizeSchema(before.items) : "(none)",
        after.items ? summarizeSchema(after.items) : "(none)",
      ),
    );
  }

  compareConstraints(before, after, context, emit);
  compareUnsupportedKeywords(before, after, context, emit, limitations);
  compareCombinators(before, after, context, emit, limitations);
}

function compareEnums(
  before: NormalizedSchema,
  after: NormalizedSchema,
  context: SchemaContext,
  emit: Emit,
): void {
  if (before.enumValues.length === 0 && after.enumValues.length === 0) {
    return;
  }

  if (before.enumValues.length === 0 && after.enumValues.length > 0) {
    emit(
      schemaFinding(
        "schema_property",
        "modified",
        classifyEnumConstraintAdded(context.direction),
        after.pointer,
        "enum constraint was added",
        context,
        "(no enum)",
        `[${after.enumValues.join(", ")}]`,
      ),
    );
    return;
  }

  if (before.enumValues.length > 0 && after.enumValues.length === 0) {
    emit(
      schemaFinding(
        "schema_property",
        "modified",
        classifyEnumConstraintRemoved(context.direction),
        after.pointer,
        "enum constraint was removed",
        context,
        `[${before.enumValues.join(", ")}]`,
        "(no enum)",
      ),
    );
    return;
  }

  for (const value of addedValues(before.enumValues, after.enumValues)) {
    emit(
      schemaFinding(
        "schema_property",
        "added",
        classifyEnumValueAdded(context.direction),
        after.pointer,
        `enum value ${value} was added`,
        context,
        undefined,
        value,
      ),
    );
  }

  for (const value of removedValues(before.enumValues, after.enumValues)) {
    emit(
      schemaFinding(
        "schema_property",
        "removed",
        classifyEnumValueRemoved(context.direction),
        after.pointer,
        `enum value ${value} was removed`,
        context,
        value,
      ),
    );
  }
}

function compareRequiredProperties(
  before: NormalizedSchema,
  after: NormalizedSchema,
  beforeProperties: Map<string, { name: string; schema: NormalizedSchema }>,
  afterProperties: Map<string, { name: string; schema: NormalizedSchema }>,
  addedProperties: string[],
  removedProperties: string[],
  context: SchemaContext,
  emit: Emit,
): void {
  const addedPropertySet = new Set(addedProperties);
  const removedPropertySet = new Set(removedProperties);

  for (const name of addedValues(before.required, after.required)) {
    if (addedPropertySet.has(name)) {
      continue;
    }
    const beforeProperty = beforeProperties.get(name);
    const afterProperty = afterProperties.get(name);
    if (beforeProperty && afterProperty) {
      emit(
        schemaFinding(
          "required_property",
          "modified",
          classifyRequiredPropertyChange(context.direction, true),
          afterProperty.schema.pointer,
          `property \`${name}\` became required`,
          context,
          "optional",
          "required",
        ),
      );
    } else {
      emit(
        schemaFinding(
          "required_property",
          "modified",
          classifySchemaPresenceChange(),
          afterProperty?.schema.pointer ?? after.pointer,
          `property \`${name}\` is required but was not present in both schemas`,
          context,
          "absent or optional",
          "required",
        ),
      );
    }
  }

  for (const name of removedValues(before.required, after.required)) {
    if (removedPropertySet.has(name)) {
      continue;
    }
    const beforeProperty = beforeProperties.get(name);
    const afterProperty = afterProperties.get(name);
    if (beforeProperty && afterProperty) {
      emit(
        schemaFinding(
          "required_property",
          "modified",
          classifyRequiredPropertyChange(context.direction, false),
          afterProperty.schema.pointer,
          `property \`${name}\` is no longer required`,
          context,
          "required",
          "optional",
        ),
      );
    } else {
      emit(
        schemaFinding(
          "required_property",
          "modified",
          classifySchemaPresenceChange(),
          afterProperty?.schema.pointer ?? after.pointer,
          `property \`${name}\` is no longer required but was not present in both schemas`,
          context,
          "required",
          "absent or optional",
        ),
      );
    }
  }
}

function compareConstraints(
  before: NormalizedSchema,
  after: NormalizedSchema,
  context: SchemaContext,
  emit: Emit,
): void {
  const keywords = new Set([
    ...Object.keys(before.constraints),
    ...Object.keys(after.constraints),
  ]);

  for (const keyword of [...keywords].sort()) {
    const beforeValue = before.constraints[keyword];
    const afterValue = after.constraints[keyword];
    if (beforeValue === afterValue) {
      continue;
    }

    const changeType: ChangeType =
      beforeValue === undefined ? "added" : afterValue === undefined ? "removed" : "modified";
    const summary =
      beforeValue === undefined
        ? `constraint \`${keyword}\` was added (${afterValue ?? ""})`
        : afterValue === undefined
          ? `constraint \`${keyword}\` was removed (was ${beforeValue})`
          : `constraint \`${keyword}\` changed from ${beforeValue} to ${afterValue}`;

    emit(
      schemaFinding(
        "schema_property",
        changeType,
        classifyConstraintChange(context.direction),
        after.pointer,
        summary,
        context,
        beforeValue,
        afterValue,
      ),
    );
  }
}

function compareUnsupportedKeywords(
  before: NormalizedSchema,
  after: NormalizedSchema,
  context: SchemaContext,
  emit: Emit,
  limitations: Set<string>,
): void {
  const beforeKeywords = unsupportedMap(before.unsupported);
  const afterKeywords = unsupportedMap(after.unsupported);

  for (const keyword of sortedUnion(beforeKeywords, afterKeywords)) {
    const beforeValue = beforeKeywords.get(keyword);
    const afterValue = afterKeywords.get(keyword);
    if (beforeValue === afterValue) {
      continue;
    }

    limitations.add(
      "Some schema keywords are not fully interpreted; changes are reported as unknown.",
    );
    emit(
      schemaFinding(
        "schema_property",
        "modified",
        classifyUnsupportedKeywordChange(keyword),
        after.pointer,
        `unsupported keyword \`${keyword}\` changed`,
        context,
        beforeValue,
        afterValue,
      ),
    );
  }
}

function compareCombinators(
  before: NormalizedSchema,
  after: NormalizedSchema,
  context: SchemaContext,
  emit: Emit,
  limitations: Set<string>,
): void {
  const beforeOneOf = before.oneOf.map((schema) => schemaSignature(schema));
  const afterOneOf = after.oneOf.map((schema) => schemaSignature(schema));
  if (!sameArray(beforeOneOf, afterOneOf)) {
    limitations.add("JSON Schema composition changes are reported as unknown.");
    emit(
      schemaFinding(
        "combinator",
        "modified",
        classifyCombinatorChange("oneOf"),
        after.pointer,
        `oneOf variants changed (${before.oneOf.length} to ${after.oneOf.length})`,
        context,
      ),
    );
  }

  const beforeAnyOf = before.anyOf.map((schema) => schemaSignature(schema));
  const afterAnyOf = after.anyOf.map((schema) => schemaSignature(schema));
  if (!sameArray(beforeAnyOf, afterAnyOf)) {
    limitations.add("JSON Schema composition changes are reported as unknown.");
    emit(
      schemaFinding(
        "combinator",
        "modified",
        classifyCombinatorChange("anyOf"),
        after.pointer,
        `anyOf variants changed (${before.anyOf.length} to ${after.anyOf.length})`,
        context,
      ),
    );
  }
}
