import { describe, expect, it } from "vitest";
import { validateContract } from "./validate.js";
import { baseSpec, specWithOperation, withComponents } from "./testing/spec-fixtures.js";
import { expectEngineErrorAsync } from "./testing/assertions.js";

describe("validateContract", () => {
  it("accepts OpenAPI 3.0.x and 3.1.x", async () => {
    await expect(validateContract(specWithOperation(), "baseline")).resolves.toMatchObject({
      openapi: "3.1.0",
      title: "Test API",
    });

    const v30 = baseSpec({
      "/pets": { get: { responses: { "200": { description: "OK" } } } },
    });
    v30.openapi = "3.0.3";
    await expect(validateContract(v30, "candidate")).resolves.toMatchObject({
      openapi: "3.0.3",
    });
  });

  it("rejects an invalid OpenAPI document", async () => {
    const invalid = specWithOperation();
    delete (invalid.info as Record<string, unknown>).version;
    const error = await expectEngineErrorAsync(
      validateContract(invalid, "baseline"),
      "invalid_openapi",
    );
    expect(error.details.length).toBeGreaterThan(0);
  });

  it("rejects Swagger 2.0", async () => {
    const swagger = {
      swagger: "2.0",
      info: { title: "Old", version: "1.0.0" },
      paths: {},
    };
    await expectEngineErrorAsync(
      validateContract(swagger, "baseline"),
      "unsupported_version",
    );
  });

  it("rejects unsupported OpenAPI versions", async () => {
    const future = specWithOperation();
    future.openapi = "3.2.0";
    await expectEngineErrorAsync(
      validateContract(future, "candidate"),
      "unsupported_version",
    );
  });

  it("rejects non-object roots", async () => {
    await expectEngineErrorAsync(validateContract([], "baseline"), "invalid_openapi");
    await expectEngineErrorAsync(validateContract("openapi", "baseline"), "invalid_openapi");
  });

  it("does not mutate the validated document", async () => {
    const ref = "#/components/schemas/Pet";
    const spec = withComponents(
      specWithOperation({
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: ref } } },
        },
      }),
      {
        Pet: {
          type: "object",
          properties: { name: { type: "string" } },
        },
      },
    );

    await validateContract(spec, "baseline");

    const schema = (
      (spec.paths as Record<string, unknown>)["/pets"] as Record<string, unknown>
    ).get as Record<string, unknown>;
    const requestBody = schema.requestBody as Record<string, unknown>;
    const content = requestBody.content as Record<string, unknown>;
    const media = content["application/json"] as Record<string, unknown>;
    expect(media.schema).toEqual({ $ref: ref });
  });

  it("does not fetch external references", async () => {
    const spec = specWithOperation({
      responses: {
        "200": {
          description: "OK",
          content: {
            "application/json": {
              schema: { $ref: "http://127.0.0.1:1/never-fetch.json" },
            },
          },
        },
      },
    });

    await expect(validateContract(spec, "baseline")).resolves.toMatchObject({
      openapi: "3.1.0",
    });
  });
});
