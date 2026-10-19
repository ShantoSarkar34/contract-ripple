import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_BYTES,
  detectFormat,
  MAX_DOCUMENT_DEPTH,
  MAX_YAML_ALIASES,
  parseContractInput,
} from "./parse.js";
import { expectEngineError } from "./testing/assertions.js";
import type { ContractFormat } from "./types.js";

const minimalJson = JSON.stringify({
  openapi: "3.1.0",
  info: { title: "Pets", version: "1.0.0" },
  paths: {},
});

const minimalYaml = `openapi: 3.1.0
info:
  title: Pets
  version: 1.0.0
paths: {}
`;

describe("detectFormat", () => {
  it("detects JSON objects and arrays", () => {
    expect(detectFormat("  {\"openapi\":\"3.1.0\"}")).toBe("json");
    expect(detectFormat("[1, 2, 3]")).toBe("json");
  });

  it("defaults to YAML", () => {
    expect(detectFormat("openapi: 3.1.0")).toBe("yaml");
  });
});

describe("parseContractInput", () => {
  it("parses JSON", () => {
    expect(parseContractInput({ content: minimalJson }, "baseline")).toMatchObject({
      openapi: "3.1.0",
    });
  });

  it("parses YAML", () => {
    expect(parseContractInput({ content: minimalYaml }, "candidate")).toMatchObject({
      openapi: "3.1.0",
      info: { title: "Pets" },
    });
  });

  it("honors an explicit format override", () => {
    expect(
      parseContractInput({ content: minimalYaml, format: "yaml" }, "baseline"),
    ).toMatchObject({ openapi: "3.1.0" });
  });

  it("rejects unsupported explicit formats", () => {
    const error = expectEngineError(
      () =>
        parseContractInput(
          { content: minimalJson, format: "xml" as ContractFormat },
          "baseline",
        ),
      "invalid_options",
    );
    expect(error.message).toContain('"json" or "yaml"');
  });

  it("rejects empty input", () => {
    expectEngineError(
      () => parseContractInput({ content: "   \n" }, "baseline"),
      "empty_input",
    );
  });

  it("rejects non-string content", () => {
    expectEngineError(
      () => parseContractInput({ content: 42 as unknown as string }, "baseline"),
      "empty_input",
    );
  });

  it("rejects content over the byte limit", () => {
    const error = expectEngineError(
      () => parseContractInput({ content: minimalJson }, "baseline", 10),
      "input_too_large",
    );
    expect(error.message).toContain("10-byte limit");
  });

  it("counts UTF-8 bytes rather than characters", () => {
    expectEngineError(
      () => parseContractInput({ content: "ééééé" }, "baseline", 5),
      "input_too_large",
    );
  });

  it("has a 5 MiB default limit", () => {
    expect(DEFAULT_MAX_BYTES).toBe(5 * 1024 * 1024);
  });

  it("rejects excessively nested documents", () => {
    let nested: unknown = "leaf";
    for (let index = 0; index < MAX_DOCUMENT_DEPTH + 2; index += 1) {
      nested = [nested];
    }

    const error = expectEngineError(
      () => parseContractInput({ content: JSON.stringify(nested) }, "baseline"),
      "input_too_deep",
    );
    expect(error.message).toContain("nesting exceeds");
  });

  it("rejects circular YAML aliases", () => {
    const circular = `openapi: 3.1.0
info:
  title: Pets
  version: 1.0.0
paths: {}
loop: &loop [*loop]
`;
    const error = expectEngineError(
      () => parseContractInput({ content: circular }, "baseline"),
      "circular_input",
    );
    expect(error.message).toContain("circular");
  });

  it("rejects malformed JSON with a safe message", () => {
    const error = expectEngineError(
      () => parseContractInput({ content: "{ not json" }, "baseline"),
      "invalid_json",
    );
    expect(error.message).toContain("baseline contract is not valid JSON");
  });

  it("rejects malformed YAML", () => {
    expectEngineError(
      () => parseContractInput({ content: "openapi: [3.1.0" }, "candidate"),
      "invalid_yaml",
    );
  });

  it("rejects YAML alias expansion attacks", () => {
    const bomb = `a: &a [x,x,x,x,x,x,x,x,x,x]
b: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a,*a]
c: &c [*b,*b,*b,*b,*b,*b,*b,*b,*b,*b]
d: [*c,*c,*c,*c,*c,*c,*c,*c,*c,*c]
`;
    const error = expectEngineError(
      () => parseContractInput({ content: bomb }, "baseline"),
      "invalid_yaml",
    );
    expect(error.message).toMatch(/alias|resource/i);
    expect(MAX_YAML_ALIASES).toBe(100);
  });

  it("allows a small amount of aliasing", () => {
    const aliased = `openapi: 3.1.0
info:
  title: Pets
  version: 1.0.0
paths:
  /pets: &path
    get:
      responses:
        "200":
          description: OK
  /animals: *path
`;
    expect(parseContractInput({ content: aliased }, "baseline")).toMatchObject({
      openapi: "3.1.0",
    });
  });
});
