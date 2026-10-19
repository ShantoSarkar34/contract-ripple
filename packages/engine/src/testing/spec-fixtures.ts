import { compareContracts } from "../compare-contracts.js";
import type { ComparisonResult, CompareOptions } from "../types.js";

export type JsonObject = Record<string, unknown>;

export function baseSpec(paths: JsonObject = {}): JsonObject {
  return {
    openapi: "3.1.0",
    info: { title: "Test API", version: "1.0.0" },
    paths,
  };
}

export function specWithOperation(
  operation: JsonObject = {},
  path = "/pets",
  method = "get",
): JsonObject {
  return baseSpec({
    [path]: {
      [method]: {
        responses: { "200": { description: "OK" } },
        ...operation,
      },
    },
  });
}

export function requestBodySpec(schema: unknown, required = true): JsonObject {
  return specWithOperation(
    {
      requestBody: {
        required,
        content: { "application/json": { schema } },
      },
    },
    "/pets",
    "post",
  );
}

export function responseSchemaSpec(schema: unknown): JsonObject {
  return specWithOperation({
    responses: {
      "200": {
        description: "OK",
        content: { "application/json": { schema } },
      },
    },
  });
}

export function objectSchema(
  properties: JsonObject,
  required: string[] = [],
): JsonObject {
  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

export function withComponents(spec: JsonObject, schemas: JsonObject): JsonObject {
  return {
    ...spec,
    components: {
      ...(typeof spec.components === "object" && spec.components !== null
        ? (spec.components as JsonObject)
        : {}),
      schemas,
    },
  };
}

export function json(value: unknown): string {
  return JSON.stringify(value);
}

export async function compareSpecs(
  before: unknown,
  after: unknown,
  options?: CompareOptions,
): Promise<ComparisonResult> {
  return compareContracts({
    baseline: { content: json(before) },
    candidate: { content: json(after) },
    options,
  });
}

export function findingsWith(
  result: ComparisonResult,
  predicate: (finding: ComparisonResult["findings"][number]) => boolean,
): ComparisonResult["findings"] {
  return result.findings.filter(predicate);
}
