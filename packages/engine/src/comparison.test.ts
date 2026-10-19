import { describe, expect, it } from "vitest";
import { compareContracts } from "./compare-contracts.js";
import {
  baseSpec,
  compareSpecs,
  objectSchema,
  requestBodySpec,
  responseSchemaSpec,
  specWithOperation,
  withComponents,
} from "./testing/spec-fixtures.js";
import type { ComparisonResult, Finding } from "./types.js";

function one(result: ComparisonResult, summaryIncludes: string): Finding {
  const matches = result.findings.filter((finding) =>
    finding.summary.includes(summaryIncludes),
  );
  expect(matches).toHaveLength(1);
  const match = matches[0];
  if (!match) {
    throw new Error(`Missing finding containing: ${summaryIncludes}`);
  }
  return match;
}

describe("compareContracts", () => {
  it("returns no findings for identical contracts", async () => {
    const spec = specWithOperation({ operationId: "listPets" });
    const result = await compareSpecs(spec, structuredClone(spec));
    expect(result.findings).toEqual([]);
    expect(result.summary).toEqual({
      total: 0,
      nonBreaking: 0,
      potentiallyBreaking: 0,
      unknown: 0,
    });
    expect(result.truncated).toBe(false);
  });

  it("accepts YAML documents", async () => {
    const before = `openapi: 3.1.0
info:
  title: Pets
  version: 1.0.0
paths:
  /pets:
    get:
      operationId: listPets
      responses:
        "200":
          description: OK
`;
    const after = before.replace("listPets", "getPets");
    const result = await compareContracts({
      baseline: { content: before, format: "yaml" },
      candidate: { content: after, format: "yaml" },
    });
    expect(one(result, "Operation ID changed").risk).toBe("potentially_breaking");
  });

  it("classifies added and removed operations", async () => {
    const before = specWithOperation();
    const after = baseSpec({
      "/pets": { get: { responses: { "200": { description: "OK" } } } },
      "/pets/{id}": {
        get: {
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: { "200": { description: "OK" } },
        },
      },
    });

    const added = await compareSpecs(before, after);
    const addedFinding = one(added, "Added operation `GET /pets/{id}`");
    expect(addedFinding.category).toBe("operation");
    expect(addedFinding.risk).toBe("non_breaking");
    expect(addedFinding.path).toBe("/pets/{id}");
    expect(addedFinding.method).toBe("get");

    const removed = await compareSpecs(after, before);
    const removedFinding = one(removed, "Removed operation `GET /pets/{id}`");
    expect(removedFinding.risk).toBe("potentially_breaking");
  });

  it("classifies optional and required added parameters", async () => {
    const before = specWithOperation();
    const after = specWithOperation({
      parameters: [
        { name: "limit", in: "query", schema: { type: "integer" } },
        { name: "cursor", in: "query", required: true, schema: { type: "string" } },
      ],
    });

    const result = await compareSpecs(before, after);
    expect(one(result, "Added optional query parameter `limit`").risk).toBe(
      "non_breaking",
    );
    expect(one(result, "Added required query parameter `cursor`").risk).toBe(
      "potentially_breaking",
    );
  });

  it("classifies parameter required changes in both directions", async () => {
    const optional = specWithOperation({
      parameters: [{ name: "limit", in: "query", schema: { type: "integer" } }],
    });
    const required = specWithOperation({
      parameters: [
        { name: "limit", in: "query", required: true, schema: { type: "integer" } },
      ],
    });

    const becameRequired = await compareSpecs(optional, required);
    expect(one(becameRequired, "became required").risk).toBe("potentially_breaking");

    const becameOptional = await compareSpecs(required, optional);
    expect(one(becameOptional, "is no longer required").risk).toBe("non_breaking");
  });

  it("classifies removed parameters as potentially breaking", async () => {
    const before = specWithOperation({
      parameters: [{ name: "limit", in: "query", schema: { type: "integer" } }],
    });
    const result = await compareSpecs(before, specWithOperation());
    expect(one(result, "Removed query parameter `limit`").risk).toBe(
      "potentially_breaking",
    );
  });

  it("classifies request body required changes", async () => {
    const schema = objectSchema({ name: { type: "string" } });
    const result = await compareSpecs(
      requestBodySpec(schema, false),
      requestBodySpec(schema, true),
    );
    expect(one(result, "Request body became required").risk).toBe(
      "potentially_breaking",
    );
  });

  it("classifies optional and required request property additions", async () => {
    const before = requestBodySpec(objectSchema({ name: { type: "string" } }));

    const optional = await compareSpecs(
      before,
      requestBodySpec(
        objectSchema({
          name: { type: "string" },
          nickname: { type: "string" },
        }),
      ),
    );
    expect(one(optional, "added optional property `nickname`").risk).toBe(
      "non_breaking",
    );

    const required = await compareSpecs(
      before,
      requestBodySpec(
        objectSchema(
          { name: { type: "string" }, nickname: { type: "string" } },
          ["nickname"],
        ),
      ),
    );
    expect(one(required, "added required property `nickname`").risk).toBe(
      "potentially_breaking",
    );
  });

  it("classifies removed request properties as potentially breaking", async () => {
    const result = await compareSpecs(
      requestBodySpec(
        objectSchema({
          name: { type: "string" },
          age: { type: "integer" },
        }),
      ),
      requestBodySpec(objectSchema({ name: { type: "string" } })),
    );
    expect(one(result, "removed property `age`").risk).toBe("potentially_breaking");
  });

  it("classifies request type changes as potentially breaking", async () => {
    const result = await compareSpecs(
      requestBodySpec(objectSchema({ age: { type: "integer" } })),
      requestBodySpec(objectSchema({ age: { type: "string" } })),
    );
    expect(
      one(result, "schema type changed from `integer` to `string`").risk,
    ).toBe("potentially_breaking");
  });

  it("classifies response property additions and removals", async () => {
    const before = responseSchemaSpec(
      objectSchema({ id: { type: "string" }, name: { type: "string" } }),
    );
    const after = responseSchemaSpec(objectSchema({ id: { type: "string" } }));

    const removed = await compareSpecs(before, after);
    expect(one(removed, "removed property `name`").risk).toBe(
      "potentially_breaking",
    );

    const added = await compareSpecs(after, before);
    expect(one(added, "added optional property `name`").risk).toBe("non_breaking");
  });

  it("classifies response status additions and removals", async () => {
    const before = specWithOperation({
      responses: {
        "200": { description: "OK" },
        "404": { description: "Not found" },
      },
    });
    const after = specWithOperation({ responses: { "200": { description: "OK" } } });

    const removed = await compareSpecs(before, after);
    expect(one(removed, "Removed response `404`").risk).toBe(
      "potentially_breaking",
    );

    const added = await compareSpecs(after, before);
    expect(one(added, "Added response `404`").risk).toBe("non_breaking");
  });

  it("classifies operationId changes as potentially breaking", async () => {
    const result = await compareSpecs(
      specWithOperation({ operationId: "listPets" }),
      specWithOperation({ operationId: "getPets" }),
    );
    const finding = one(result, "Operation ID changed from `listPets` to `getPets`");
    expect(finding.category).toBe("operation_id");
    expect(finding.risk).toBe("potentially_breaking");
  });

  it("resolves internal $refs and reports the component location", async () => {
    const ref = "#/components/schemas/Pet";
    const before = withComponents(
      requestBodySpec({ $ref: ref }),
      { Pet: objectSchema({ name: { type: "string" } }) },
    );
    const after = withComponents(
      requestBodySpec({ $ref: ref }),
      {
        Pet: objectSchema(
          { name: { type: "string" }, id: { type: "integer" } },
          ["id"],
        ),
      },
    );

    const result = await compareSpecs(before, after);
    const finding = one(result, "added required property `id`");
    expect(finding.risk).toBe("potentially_breaking");
    expect(finding.location).toBe("#/components/schemas/Pet/properties/id");
  });

  it("handles circular $refs without expanding indefinitely", async () => {
    const ref = "#/components/schemas/Pet";
    const before = withComponents(requestBodySpec({ $ref: ref }), {
      Pet: {
        type: "object",
        properties: {
          name: { type: "string" },
          friend: { $ref: ref },
        },
      },
    });
    const after = withComponents(requestBodySpec({ $ref: ref }), {
      Pet: {
        type: "object",
        required: ["id"],
        properties: {
          name: { type: "string" },
          friend: { $ref: ref },
          id: { type: "integer" },
        },
      },
    });

    const result = await compareSpecs(before, after);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.location).toBe("#/components/schemas/Pet/properties/id");
    expect(result.limitations).toContain(
      "Circular schema references are detected and not expanded; nested changes are not compared.",
    );
  });

  it("reports oneOf changes as unknown", async () => {
    const result = await compareSpecs(
      requestBodySpec({ oneOf: [{ type: "string" }, { type: "integer" }] }),
      requestBodySpec({ oneOf: [{ type: "string" }, { type: "boolean" }] }),
    );
    const finding = one(result, "oneOf variants changed");
    expect(finding.category).toBe("combinator");
    expect(finding.risk).toBe("unknown");
  });

  it("classifies enum changes by request/response direction", async () => {
    const requestAdded = await compareSpecs(
      requestBodySpec({ type: "string", enum: ["a", "b"] }),
      requestBodySpec({ type: "string", enum: ["a", "b", "c"] }),
    );
    expect(one(requestAdded, 'enum value "c" was added').risk).toBe("non_breaking");

    const requestRemoved = await compareSpecs(
      requestBodySpec({ type: "string", enum: ["a", "b"] }),
      requestBodySpec({ type: "string", enum: ["a"] }),
    );
    expect(one(requestRemoved, 'enum value "b" was removed').risk).toBe(
      "potentially_breaking",
    );

    const responseAdded = await compareSpecs(
      responseSchemaSpec({ type: "string", enum: ["a", "b"] }),
      responseSchemaSpec({ type: "string", enum: ["a", "b", "c"] }),
    );
    expect(one(responseAdded, 'enum value "c" was added').risk).toBe(
      "potentially_breaking",
    );

    const responseRemoved = await compareSpecs(
      responseSchemaSpec({ type: "string", enum: ["a", "b"] }),
      responseSchemaSpec({ type: "string", enum: ["a"] }),
    );
    expect(one(responseRemoved, 'enum value "b" was removed').risk).toBe(
      "non_breaking",
    );
  });

  it("classifies request and response constraint changes conservatively", async () => {
    const request = await compareSpecs(
      requestBodySpec({ type: "string", minLength: 1 }),
      requestBodySpec({ type: "string", minLength: 3 }),
    );
    expect(one(request, "constraint `minLength` changed from 1 to 3").risk).toBe(
      "potentially_breaking",
    );

    const response = await compareSpecs(
      responseSchemaSpec({ type: "string", minLength: 1 }),
      responseSchemaSpec({ type: "string", minLength: 3 }),
    );
    expect(one(response, "constraint `minLength` changed from 1 to 3").risk).toBe(
      "unknown",
    );
  });

  it("reports unsupported keyword changes as unknown", async () => {
    const result = await compareSpecs(
      responseSchemaSpec({
        type: "object",
        discriminator: { propertyName: "type" },
        properties: { type: { type: "string" } },
      }),
      responseSchemaSpec({
        type: "object",
        discriminator: { propertyName: "kind" },
        properties: { type: { type: "string" } },
      }),
    );
    const finding = one(result, "unsupported keyword `discriminator` changed");
    expect(finding.risk).toBe("unknown");
  });

  it("deduplicates repeated references within one operation", async () => {
    const ref = "#/components/schemas/Pet";
    const before = withComponents(
      requestBodySpec(
        objectSchema({
          primary: { $ref: ref },
          secondary: { $ref: ref },
        }),
      ),
      { Pet: objectSchema({ name: { type: "string" } }) },
    );
    const after = withComponents(
      requestBodySpec(
        objectSchema({
          primary: { $ref: ref },
          secondary: { $ref: ref },
        }),
      ),
      { Pet: objectSchema({ name: { type: "string" }, id: { type: "integer" } }, ["id"]) },
    );

    const result = await compareSpecs(before, after);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.summary).toContain("added required property `id`");
  });

  it("orders findings deterministically regardless of object key order", async () => {
    const baseline = baseSpec({
      "/b": {
        get: {
          operationId: "b",
          parameters: [
            { name: "z", in: "query", schema: { type: "string" } },
            { name: "a", in: "query", schema: { type: "string" } },
          ],
          responses: { "200": { description: "OK" } },
        },
      },
      "/a": {
        get: {
          operationId: "a",
          responses: { "200": { description: "OK" } },
        },
      },
    });

    const candidateA = baseSpec({
      "/b": {
        get: {
          operationId: "b2",
          parameters: [
            { name: "a", in: "query", required: true, schema: { type: "string" } },
            { name: "z", in: "query", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "OK" } },
        },
      },
      "/a": {
        get: {
          operationId: "a2",
          responses: { "200": { description: "OK" } },
        },
      },
    });

    const candidateB = baseSpec({
      "/a": {
        get: {
          responses: { "200": { description: "OK" } },
          operationId: "a2",
        },
      },
      "/b": {
        get: {
          responses: { "200": { description: "OK" } },
          parameters: [
            { name: "z", in: "query", required: true, schema: { type: "string" } },
            { name: "a", in: "query", required: true, schema: { type: "string" } },
          ],
          operationId: "b2",
        },
      },
    });

    const first = await compareSpecs(baseline, candidateA);
    const second = await compareSpecs(baseline, candidateB);

    expect(first.findings.map((finding) => finding.id)).toEqual(
      second.findings.map((finding) => finding.id),
    );
    expect(first.findings.map((finding) => finding.summary)).toEqual(
      second.findings.map((finding) => finding.summary),
    );
  });

  it("escapes JSON Pointer path and property segments", async () => {
    const before = specWithOperation(
      {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: objectSchema({ "a/b": { type: "string" } }),
              },
            },
          },
        },
      },
      "/pets/{id}",
    );
    const after = specWithOperation(
      {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: objectSchema({ "a/b": { type: "integer" } }),
              },
            },
          },
        },
      },
      "/pets/{id}",
    );

    const result = await compareSpecs(before, after);
    const finding = one(result, "schema type changed");
    expect(finding.location).toBe(
      "#/paths/~1pets~1{id}/get/responses/200/content/application~1json/schema/properties/a~1b",
    );
  });

  it("handles external references without fetching them", async () => {
    const external = "https://example.com/pet.json";
    const before = requestBodySpec({ $ref: external });
    const after = requestBodySpec({ $ref: external });

    const unchanged = await compareSpecs(before, after);
    expect(unchanged.findings).toEqual([]);
    expect(unchanged.limitations).toContain(
      "External `$ref` values are not resolved; changes involving them are reported as unknown.",
    );

    const changed = await compareSpecs(
      before,
      requestBodySpec({ $ref: "https://example.com/animal.json" }),
    );
    const finding = one(changed, "schema reference changed");
    expect(finding.category).toBe("reference");
    expect(finding.risk).toBe("unknown");
  });

  it("truncates findings at the configured limit", async () => {
    const before = specWithOperation();
    const after = specWithOperation({
      parameters: [
        { name: "a", in: "query", required: true, schema: { type: "string" } },
        { name: "b", in: "query", required: true, schema: { type: "string" } },
      ],
    });

    const result = await compareSpecs(before, after, { maxFindings: 1 });
    expect(result.findings).toHaveLength(1);
    expect(result.truncated).toBe(true);
    expect(result.limitations).toContain(
      "Finding limit reached; results are truncated.",
    );
  });

  it("ignores documentation-only changes", async () => {
    const before = specWithOperation({
      summary: "List pets",
      description: "Before",
      tags: ["pets"],
      parameters: [
        {
          name: "limit",
          in: "query",
          description: "Before",
          schema: { type: "integer", description: "Before" },
        },
      ],
    });
    const after = specWithOperation({
      summary: "List all pets",
      description: "After",
      tags: ["animals"],
      parameters: [
        {
          name: "limit",
          in: "query",
          description: "After",
          schema: { type: "integer", description: "After" },
        },
      ],
    });

    const result = await compareSpecs(before, after);
    expect(result.findings).toEqual([]);
  });

  it("supports OpenAPI 3.1 boolean schemas", async () => {
    const result = await compareSpecs(
      requestBodySpec(true),
      requestBodySpec(false),
    );
    const finding = one(result, "boolean schema changed");
    expect(finding.risk).toBe("potentially_breaking");
  });

  it("merges allOf properties and required lists", async () => {
    const before = requestBodySpec({
      allOf: [
        {
          type: "object",
          properties: { name: { type: "string" } },
        },
      ],
    });
    const after = requestBodySpec({
      allOf: [
        {
          type: "object",
          required: ["name"],
          properties: { name: { type: "string" } },
        },
      ],
    });

    const result = await compareSpecs(before, after);
    expect(one(result, "property `name` became required").risk).toBe(
      "potentially_breaking",
    );
  });

  it("detects array item type changes", async () => {
    const result = await compareSpecs(
      requestBodySpec({ type: "array", items: { type: "string" } }),
      requestBodySpec({ type: "array", items: { type: "integer" } }),
    );
    expect(
      one(result, "schema type changed from `string` to `integer`").risk,
    ).toBe("potentially_breaking");
  });

  it("keeps summary counts consistent with findings", async () => {
    const result = await compareSpecs(
      specWithOperation(),
      specWithOperation({
        operationId: "getPets",
        parameters: [
          { name: "cursor", in: "query", required: true, schema: { type: "string" } },
        ],
      }),
    );

    expect(result.summary.total).toBe(result.findings.length);
    expect(result.summary.potentiallyBreaking).toBe(
      result.findings.filter((finding) => finding.risk === "potentially_breaking").length,
    );
    expect(result.summary.nonBreaking).toBe(
      result.findings.filter((finding) => finding.risk === "non_breaking").length,
    );
    expect(result.summary.unknown).toBe(
      result.findings.filter((finding) => finding.risk === "unknown").length,
    );
  });
});
