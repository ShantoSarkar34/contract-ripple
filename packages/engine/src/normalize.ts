import { canonicalizeContract } from "./canonicalize.js";
import { appendPointer, isInternalRef, resolvePointer } from "./pointer.js";
import { schemaSignature, stableStringify } from "./schema-signature.js";
import type {
  ContractSummary,
  NormalizedContract,
  NormalizedMediaType,
  NormalizedOperation,
  NormalizedParameter,
  NormalizedProperty,
  NormalizedRequestBody,
  NormalizedResponse,
  NormalizedSchema,
} from "./types.js";

const HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as const;

const MAX_SCHEMA_DEPTH = 32;

const CONSTRAINT_KEYWORDS = [
  "minLength",
  "maxLength",
  "pattern",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minProperties",
  "maxProperties",
  "additionalProperties",
  "readOnly",
  "writeOnly",
  "const",
] as const;

const UNSUPPORTED_KEYWORDS = [
  "prefixItems",
  "patternProperties",
  "not",
  "if",
  "then",
  "else",
  "contains",
  "minContains",
  "maxContains",
  "dependentSchemas",
  "dependentRequired",
  "propertyNames",
  "unevaluatedProperties",
  "unevaluatedItems",
  "discriminator",
  "xml",
  "externalDocs",
  "contentEncoding",
  "contentMediaType",
] as const;

const PARAMETER_SERIALIZATION_KEYWORDS = [
  "style",
  "explode",
  "allowReserved",
  "allowEmptyValue",
] as const;

const GLOBAL_LIMITATIONS = [
  "Only operations under `paths` are analyzed; webhooks, callbacks, and links are not.",
  "Changes to servers, security schemes, tags, and external documentation are not analyzed.",
  "Response headers and request/response encodings are not analyzed.",
  "Descriptions, summaries, examples, defaults, and deprecation flags are ignored.",
  "Only internal `$ref` values are resolved; external references are left unresolved.",
  "JSON Schema composition (`oneOf`, `anyOf`, `not`, `if`, `then`, `else`) is not fully interpreted; changes are reported as unknown.",
  "Schema constraints are classified conservatively rather than by full JSON Schema validation.",
  "Tuple-style arrays, `patternProperties`, discriminators, and `additionalProperties` schemas are reported as unknown.",
  "If a schema object has `$ref` siblings, the resolved target is used and the siblings are ignored.",
] as const;

type LimitationSet = Set<string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function unionSorted(left: string[], right: string[]): string[] {
  return [...new Set([...left, ...right])].sort();
}

function intersectSorted(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value)).sort();
}

function putProperty(properties: NormalizedProperty[], property: NormalizedProperty): void {
  const index = properties.findIndex((item) => item.name === property.name);
  if (index === -1) {
    properties.push(property);
  } else {
    properties[index] = property;
  }
}

function sortProperties(properties: NormalizedProperty[]): void {
  properties.sort((left, right) => left.name.localeCompare(right.name));
}

function emptySchema(pointer: string): NormalizedSchema {
  return {
    pointer,
    types: [],
    enumValues: [],
    properties: [],
    required: [],
    oneOf: [],
    anyOf: [],
    constraints: {},
    unsupported: [],
  };
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isComparableScalar(value: unknown): value is string | number | boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/**
 * Follows a chain of internal `$ref` values for non-schema objects such as
 * parameters, request bodies, responses, and path items. Circular chains are
 * stopped and surfaced as a limitation.
 */
function dereferenceObject(
  root: unknown,
  input: unknown,
  fallbackPointer: string,
  limitations: LimitationSet,
): { value: unknown; pointer: string } {
  let current = input;
  let currentPointer = fallbackPointer;
  const seen = new Set<string>();

  while (isRecord(current) && typeof current.$ref === "string") {
    if (Object.keys(current).length > 1) {
      limitations.add(
        "A referenced object contains `$ref` siblings; only the resolved target is used.",
      );
    }
    const ref = current.$ref;
    if (!isInternalRef(ref)) {
      limitations.add(
        "External `$ref` values are not resolved; changes involving them are reported as unknown.",
      );
      return { value: current, pointer: currentPointer };
    }
    if (seen.has(ref)) {
      limitations.add(
        "Circular `$ref` values are not expanded; changes involving them are reported as unknown.",
      );
      return { value: current, pointer: currentPointer };
    }
    seen.add(ref);

    const resolved = resolvePointer(root, ref);
    if (resolved === undefined) {
      limitations.add(`An internal \`$ref\` could not be resolved: ${ref}`);
      return { value: current, pointer: currentPointer };
    }

    current = resolved;
    currentPointer = ref;
  }

  return { value: current, pointer: currentPointer };
}

function normalizeSchema(
  root: unknown,
  input: unknown,
  schemaPointer: string,
  limitations: LimitationSet,
  seenRefs: Set<string>,
  depth: number,
): NormalizedSchema {
  if (depth > MAX_SCHEMA_DEPTH) {
    limitations.add("Schema normalization stopped at the maximum depth.");
    return { ...emptySchema(schemaPointer), unresolved: true };
  }

  if (input === true || input === false) {
    return { ...emptySchema(schemaPointer), booleanSchema: input };
  }

  if (!isRecord(input)) {
    return emptySchema(schemaPointer);
  }

  if (typeof input.$ref === "string") {
    const ref = input.$ref;

    if (Object.keys(input).length > 1) {
      limitations.add(
        "A schema object contains `$ref` siblings; only the resolved target is compared.",
      );
    }

    if (!isInternalRef(ref)) {
      limitations.add(
        "External `$ref` values are not resolved; changes involving them are reported as unknown.",
      );
      return {
        ...emptySchema(schemaPointer),
        ref,
        unresolved: true,
        externalRef: true,
      };
    }

    if (seenRefs.has(ref)) {
      limitations.add(
        "Circular schema references are detected and not expanded; nested changes are not compared.",
      );
      return { ...emptySchema(schemaPointer), ref, circular: true };
    }

    const resolved = resolvePointer(root, ref);
    if (resolved === undefined) {
      limitations.add(`An internal \`$ref\` could not be resolved: ${ref}`);
      return { ...emptySchema(schemaPointer), ref, unresolved: true };
    }

    const nextSeen = new Set(seenRefs);
    nextSeen.add(ref);
    const normalized = normalizeSchema(
      root,
      resolved,
      ref,
      limitations,
      nextSeen,
      depth + 1,
    );
    return { ...normalized, ref, pointer: normalized.pointer };
  }

  const result = emptySchema(schemaPointer);

  if (Array.isArray(input.allOf)) {
    for (let index = 0; index < input.allOf.length; index += 1) {
      const part = normalizeSchema(
        root,
        input.allOf[index],
        appendPointer(schemaPointer, "allOf", index),
        limitations,
        seenRefs,
        depth + 1,
      );
      mergeAllOfPart(result, part, limitations);
    }
  }

  applySchemaKeywords(
    root,
    result,
    input,
    schemaPointer,
    limitations,
    seenRefs,
    depth,
  );

  sortProperties(result.properties);
  return result;
}

function mergeAllOfPart(
  target: NormalizedSchema,
  part: NormalizedSchema,
  limitations: LimitationSet,
): void {
  if (part.unresolved) {
    target.unresolved = true;
    target.ref = part.ref;
    target.externalRef = part.externalRef;
  }
  if (part.circular) {
    target.circular = true;
    target.ref = target.ref ?? part.ref;
  }

  if (part.booleanSchema !== undefined) {
    limitations.add(
      "Boolean schemas inside `allOf` are not fully interpreted; changes are reported as unknown.",
    );
    target.unsupported = unionSorted(target.unsupported, [
      `allOfBoolean=${part.booleanSchema ? "true" : "false"}`,
    ]);
  }

  if (part.types.length > 0) {
    if (target.types.length === 0) {
      target.types = [...part.types];
    } else {
      const intersection = intersectSorted(target.types, part.types);
      if (intersection.length === 0) {
        limitations.add(
          "`allOf` schemas with incompatible types were merged conservatively.",
        );
        target.types = unionSorted(target.types, part.types);
      } else {
        target.types = intersection;
      }
    }
  }

  if (!target.format && part.format) {
    target.format = part.format;
  }
  if (!target.items && part.items) {
    target.items = part.items;
  }

  target.required = unionSorted(target.required, part.required);

  if (part.enumValues.length > 0) {
    if (target.enumValues.length === 0) {
      target.enumValues = [...part.enumValues];
    } else {
      const intersection = intersectSorted(target.enumValues, part.enumValues);
      if (intersection.length === 0) {
        limitations.add(
          "`allOf` schemas with incompatible enum values were merged conservatively.",
        );
      }
      target.enumValues = intersection;
    }
  }

  for (const property of part.properties) {
    putProperty(target.properties, property);
  }

  target.constraints = { ...target.constraints, ...part.constraints };
  target.unsupported = unionSorted(target.unsupported, part.unsupported);

  if (part.oneOf.length > 0 || part.anyOf.length > 0) {
    limitations.add(
      "`allOf` containing `oneOf` or `anyOf` is merged conservatively; changes are reported as unknown.",
    );
    target.oneOf.push(...part.oneOf);
    target.anyOf.push(...part.anyOf);
  }
}

function applySchemaKeywords(
  root: unknown,
  result: NormalizedSchema,
  input: Record<string, unknown>,
  schemaPointer: string,
  limitations: LimitationSet,
  seenRefs: Set<string>,
  depth: number,
): void {
  if (typeof input.type === "string") {
    result.types = unionSorted(result.types, [input.type]);
  } else if (Array.isArray(input.type)) {
    result.types = unionSorted(
      result.types,
      input.type.filter((value): value is string => typeof value === "string"),
    );
  }

  if (input.nullable === true) {
    result.types = unionSorted(result.types, ["null"]);
  }

  if (typeof input.format === "string") {
    result.format = input.format;
  }

  if (Array.isArray(input.enum)) {
    result.enumValues = unionSorted(
      result.enumValues,
      input.enum.map((value) => stableStringify(value)),
    );
  }

  if (Array.isArray(input.required)) {
    result.required = unionSorted(
      result.required,
      input.required.filter((value): value is string => typeof value === "string"),
    );
  }

  if (isRecord(input.properties)) {
    for (const name of Object.keys(input.properties).sort()) {
      const propertySchema = normalizeSchema(
        root,
        input.properties[name],
        appendPointer(schemaPointer, "properties", name),
        limitations,
        seenRefs,
        depth + 1,
      );
      putProperty(result.properties, { name, schema: propertySchema });
    }
  }

  if (isRecord(input.items)) {
    result.items = normalizeSchema(
      root,
      input.items,
      appendPointer(schemaPointer, "items"),
      limitations,
      seenRefs,
      depth + 1,
    );
  } else if (Array.isArray(input.items)) {
    result.unsupported = unionSorted(result.unsupported, [
      `items=${stableStringify(input.items)}`,
    ]);
    limitations.add(
      "Tuple-style `items` arrays are not fully interpreted; changes are reported as unknown.",
    );
  }

  if (Array.isArray(input.oneOf)) {
    const variants = input.oneOf.map((variant, index) =>
      normalizeSchema(
        root,
        variant,
        appendPointer(schemaPointer, "oneOf", index),
        limitations,
        seenRefs,
        depth + 1,
      ),
    );
    result.oneOf = variants.sort((left, right) =>
      schemaSignature(left).localeCompare(schemaSignature(right)),
    );
  }

  if (Array.isArray(input.anyOf)) {
    const variants = input.anyOf.map((variant, index) =>
      normalizeSchema(
        root,
        variant,
        appendPointer(schemaPointer, "anyOf", index),
        limitations,
        seenRefs,
        depth + 1,
      ),
    );
    result.anyOf = variants.sort((left, right) =>
      schemaSignature(left).localeCompare(schemaSignature(right)),
    );
  }

  for (const keyword of CONSTRAINT_KEYWORDS) {
    if (!hasOwn(input, keyword)) {
      continue;
    }

    const value = input[keyword];
    if (keyword === "additionalProperties" && isRecord(value)) {
      result.unsupported = unionSorted(result.unsupported, [
        "additionalProperties=<schema>",
      ]);
      limitations.add(
        "`additionalProperties` schemas are not fully interpreted; changes are reported as unknown.",
      );
      continue;
    }

    if (isComparableScalar(value)) {
      result.constraints[keyword] = stableStringify(value);
    } else {
      result.unsupported = unionSorted(result.unsupported, [
        `${keyword}=${stableStringify(value)}`,
      ]);
    }
  }

  for (const keyword of UNSUPPORTED_KEYWORDS) {
    if (hasOwn(input, keyword)) {
      result.unsupported = unionSorted(result.unsupported, [
        `${keyword}=${stableStringify(input[keyword])}`,
      ]);
    }
  }
}

function normalizeContent(
  root: unknown,
  content: unknown,
  basePointer: string,
  limitations: LimitationSet,
): NormalizedMediaType[] {
  if (!isRecord(content)) {
    return [];
  }

  return Object.keys(content)
    .sort()
    .map((mediaType) => {
      const mediaPointer = appendPointer(basePointer, "content", mediaType);
      const media = content[mediaType];
      const schema =
        isRecord(media) && (isRecord(media.schema) || typeof media.schema === "boolean")
          ? normalizeSchema(
              root,
              media.schema,
              appendPointer(mediaPointer, "schema"),
              limitations,
              new Set(),
              0,
            )
          : undefined;
      return { mediaType, schema, pointer: mediaPointer };
    });
}

function normalizeParameter(
  root: unknown,
  input: unknown,
  parameterPointer: string,
  limitations: LimitationSet,
): NormalizedParameter | undefined {
  const dereferenced = dereferenceObject(root, input, parameterPointer, limitations);
  if (!isRecord(dereferenced.value)) {
    return undefined;
  }

  const parameter = dereferenced.value;
  const name = asString(parameter.name);
  const location = asString(parameter.in);
  if (!name || !location) {
    return undefined;
  }

  let schema: NormalizedSchema | undefined;
  if (isRecord(parameter.schema) || typeof parameter.schema === "boolean") {
    schema = normalizeSchema(
      root,
      parameter.schema,
      appendPointer(dereferenced.pointer, "schema"),
      limitations,
      new Set(),
      0,
    );
  } else if (isRecord(parameter.content)) {
    const mediaType = Object.keys(parameter.content).sort()[0];
    if (mediaType) {
      const media = parameter.content[mediaType];
      if (isRecord(media) && (isRecord(media.schema) || typeof media.schema === "boolean")) {
        schema = normalizeSchema(
          root,
          media.schema,
          appendPointer(dereferenced.pointer, "content", mediaType, "schema"),
          limitations,
          new Set(),
          0,
        );
      }
    }
  }

  const serialization: Record<string, string> = {};
  for (const keyword of PARAMETER_SERIALIZATION_KEYWORDS) {
    if (hasOwn(parameter, keyword)) {
      serialization[keyword] = stableStringify(parameter[keyword]);
    }
  }

  return {
    name,
    in: location,
    required: parameter.required === true,
    schema,
    pointer: dereferenced.pointer,
    serialization,
  };
}

function normalizeParameters(
  root: unknown,
  input: unknown,
  basePointer: string,
  limitations: LimitationSet,
): NormalizedParameter[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const result: NormalizedParameter[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const parameter = normalizeParameter(
      root,
      input[index],
      appendPointer(basePointer, index),
      limitations,
    );
    if (parameter) {
      result.push(parameter);
    }
  }
  return result;
}

function mergeParameters(
  pathParameters: NormalizedParameter[],
  operationParameters: NormalizedParameter[],
): NormalizedParameter[] {
  const merged = new Map<string, NormalizedParameter>();
  for (const parameter of [...pathParameters, ...operationParameters]) {
    merged.set(`${parameter.in}:${parameter.name}`, parameter);
  }
  return [...merged.values()].sort((left, right) => {
    const location = left.in.localeCompare(right.in);
    return location !== 0 ? location : left.name.localeCompare(right.name);
  });
}

function normalizeRequestBody(
  root: unknown,
  input: unknown,
  requestPointer: string,
  limitations: LimitationSet,
): NormalizedRequestBody | undefined {
  const dereferenced = dereferenceObject(root, input, requestPointer, limitations);
  if (!isRecord(dereferenced.value)) {
    return undefined;
  }

  return {
    required: dereferenced.value.required === true,
    content: normalizeContent(
      root,
      dereferenced.value.content,
      dereferenced.pointer,
      limitations,
    ),
    pointer: dereferenced.pointer,
  };
}

function normalizeResponse(
  root: unknown,
  status: string,
  input: unknown,
  responsePointer: string,
  limitations: LimitationSet,
): NormalizedResponse | undefined {
  const dereferenced = dereferenceObject(root, input, responsePointer, limitations);
  if (!isRecord(dereferenced.value)) {
    return undefined;
  }

  return {
    status,
    description: asString(dereferenced.value.description),
    content: normalizeContent(
      root,
      dereferenced.value.content,
      dereferenced.pointer,
      limitations,
    ),
    pointer: dereferenced.pointer,
  };
}

function responseSortValue(status: string): [number, string] {
  if (status === "default") {
    return [Number.MAX_SAFE_INTEGER, status];
  }
  const numeric = Number(status);
  return Number.isFinite(numeric) ? [numeric, status] : [Number.MAX_SAFE_INTEGER - 1, status];
}

function normalizeOperation(
  root: unknown,
  path: string,
  method: string,
  input: Record<string, unknown>,
  pathParameters: NormalizedParameter[],
  limitations: LimitationSet,
): NormalizedOperation {
  const operationPointer = appendPointer("#", "paths", path, method);
  const operationParameters = normalizeParameters(
    root,
    input.parameters,
    appendPointer(operationPointer, "parameters"),
    limitations,
  );

  if (hasOwn(input, "callbacks")) {
    limitations.add("Callbacks are not analyzed.");
  }

  const responses: NormalizedResponse[] = [];
  if (isRecord(input.responses)) {
    const statuses = Object.keys(input.responses).sort((left, right) => {
      const [leftNumeric, leftText] = responseSortValue(left);
      const [rightNumeric, rightText] = responseSortValue(right);
      return leftNumeric - rightNumeric || leftText.localeCompare(rightText);
    });

    for (const status of statuses) {
      const response = normalizeResponse(
        root,
        status,
        input.responses[status],
        appendPointer(operationPointer, "responses", status),
        limitations,
      );
      if (response) {
        responses.push(response);
      }
    }
  }

  return {
    method,
    path,
    operationId: asString(input.operationId),
    pointer: operationPointer,
    parameters: mergeParameters(pathParameters, operationParameters),
    requestBody: hasOwn(input, "requestBody")
      ? normalizeRequestBody(
          root,
          input.requestBody,
          appendPointer(operationPointer, "requestBody"),
          limitations,
        )
      : undefined,
    responses,
  };
}

function compareOperations(left: NormalizedOperation, right: NormalizedOperation): number {
  const path = left.path.localeCompare(right.path);
  if (path !== 0) {
    return path;
  }
  return HTTP_METHODS.indexOf(left.method as (typeof HTTP_METHODS)[number]) -
    HTTP_METHODS.indexOf(right.method as (typeof HTTP_METHODS)[number]);
}

export function normalizeContract(
  document: unknown,
  summary: ContractSummary,
): NormalizedContract {
  const limitations: LimitationSet = new Set(GLOBAL_LIMITATIONS);
  const operations: NormalizedOperation[] = [];

  const root = canonicalizeContract(document);
  if (!isRecord(root)) {
    return { summary, operations, limitations: [...limitations].sort() };
  }

  if (hasOwn(root, "webhooks")) {
    limitations.add("Webhooks are not analyzed.");
  }

  const paths = isRecord(root.paths) ? root.paths : {};

  for (const path of Object.keys(paths).sort()) {
    const pathItemPointer = appendPointer("#", "paths", path);
    const dereferenced = dereferenceObject(
      root,
      paths[path],
      pathItemPointer,
      limitations,
    );
    if (!isRecord(dereferenced.value)) {
      continue;
    }

    const pathItem = dereferenced.value;
    const pathParameters = normalizeParameters(
      root,
      pathItem.parameters,
      appendPointer(pathItemPointer, "parameters"),
      limitations,
    );

    for (const method of HTTP_METHODS) {
      if (!isRecord(pathItem[method])) {
        continue;
      }
      operations.push(
        normalizeOperation(
          root,
          path,
          method,
          pathItem[method] as Record<string, unknown>,
          pathParameters,
          limitations,
        ),
      );
    }
  }

  operations.sort(compareOperations);

  return {
    summary,
    operations,
    limitations: [...limitations].sort(),
  };
}

export const SCHEMA_LIMITS = {
  maxDepth: MAX_SCHEMA_DEPTH,
} as const;
