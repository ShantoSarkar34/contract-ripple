/**
 * Test-only OpenAPI fixtures for the API suite.
 *
 * Excluded from the production build by `tsconfig.json`. The candidate spec is a
 * deliberate superset/subset of the baseline so tests can assert real
 * classifications with known evidence.
 */

export const baselinePetSpec = {
  openapi: "3.0.3",
  info: { title: "Pets API", version: "1.0.0" },
  paths: {
    "/pets": {
      get: {
        operationId: "listPets",
        parameters: [{ name: "limit", in: "query", required: false, schema: { type: "integer" } }],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Pet" } },
              },
            },
          },
        },
      },
      post: {
        operationId: "createPet",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/Pet" } } },
        },
        responses: { "201": { description: "Created" } },
      },
    },
  },
  components: {
    schemas: {
      Pet: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
      },
    },
  },
} as const;

export const candidatePetSpec = {
  openapi: "3.0.3",
  info: { title: "Pets API", version: "2.0.0" },
  paths: {
    "/pets": {
      get: {
        operationId: "listPets",
        parameters: [
          { name: "limit", in: "query", required: false, schema: { type: "integer" } },
          { name: "sort", in: "query", required: false, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Pet" } },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Pet: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "string" },
          name: { type: "integer" },
          nickname: { type: "string" },
        },
      },
    },
  },
} as const;

export const baselinePetJson = JSON.stringify(baselinePetSpec);
export const candidatePetJson = JSON.stringify(candidatePetSpec);
export const baselinePetYaml = [
  'openapi: "3.0.3"',
  "info:",
  "  title: Pets API",
  '  version: "1.0.0"',
  "paths:",
  "  /pets:",
  "    get:",
  "      operationId: listPets",
  "      responses:",
  '        "200":',
  "          description: OK",
  "",
].join("\n");

/** Valid JSON but structurally invalid OpenAPI 3.0. */
export const invalidOpenApiJson = JSON.stringify({
  openapi: "3.0.3",
  info: { title: "Broken API", version: "1.0.0" },
  paths: "not-an-object",
});

/** Well-formed JSON declaring an unsupported OpenAPI/Swagger version. */
export const unsupportedVersionJson = JSON.stringify({
  openapi: "2.0.0",
  info: { title: "Old API", version: "1.0.0" },
  paths: {},
});

/** Text that is not JSON or YAML. */
export const malformedContent = "openapi: [unterminated";
