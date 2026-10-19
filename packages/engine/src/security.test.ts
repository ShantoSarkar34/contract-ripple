import { describe, expect, it } from "vitest";
import { compareContracts } from "./compare-contracts.js";
import { json, specWithOperation } from "./testing/spec-fixtures.js";
import { expectEngineErrorAsync } from "./testing/assertions.js";

describe("compareContracts input safety", () => {
  it("rejects invalid maxBytes values", async () => {
    const spec = specWithOperation();
    for (const maxBytes of [0, -1, 1.5, 51 * 1024 * 1024]) {
      await expectEngineErrorAsync(
        compareContracts({
          baseline: { content: json(spec) },
          candidate: { content: json(spec) },
          options: { maxBytes },
        }),
        "invalid_options",
      );
    }
  });

  it("rejects invalid maxFindings values", async () => {
    const spec = specWithOperation();
    for (const maxFindings of [0, -1, 1.5, 100_001]) {
      await expectEngineErrorAsync(
        compareContracts({
          baseline: { content: json(spec) },
          candidate: { content: json(spec) },
          options: { maxFindings },
        }),
        "invalid_options",
      );
    }
  });

  it("rejects a non-object input", async () => {
    await expectEngineErrorAsync(
      compareContracts(null as never),
      "invalid_options",
    );
  });

  it("rejects missing document content", async () => {
    const spec = specWithOperation();
    await expectEngineErrorAsync(
      compareContracts({
        baseline: {} as never,
        candidate: { content: json(spec) },
      }),
      "empty_input",
    );
  });

  it("does not echo a secret from malformed JSON", async () => {
    const secret = "super-secret-token-value";
    const malformed = `{"openapi":"3.1.0","secret":"${secret}",`;
    const error = await expectEngineErrorAsync(
      compareContracts({
        baseline: { content: malformed },
        candidate: { content: json(specWithOperation()) },
      }),
      "invalid_json",
    );
    expect(error.message).not.toContain(secret);
  });

  it("applies the byte limit to both documents", async () => {
    const large = specWithOperation({
      description: "x".repeat(2_000),
    });
    await expectEngineErrorAsync(
      compareContracts({
        baseline: { content: json(specWithOperation()) },
        candidate: { content: json(large) },
        options: { maxBytes: 500 },
      }),
      "input_too_large",
    );
  });

  it("supports an explicit format override", async () => {
    const yaml = `openapi: 3.1.0
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
    const result = await compareContracts({
      baseline: { content: yaml, format: "yaml" },
      candidate: { content: yaml.replace("listPets", "getPets"), format: "yaml" },
    });
    expect(result.findings).toHaveLength(1);
  });
});
