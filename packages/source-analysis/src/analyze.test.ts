import { describe, expect, it } from "vitest";
import { analyzeSource } from "./analyze.js";
import { SourceAnalysisError, type ChangedOperation } from "./types.js";

const operations: ChangedOperation[] = [
  { method: "get", path: "/pets", operationId: "listPets" },
  { method: "post", path: "/pets", operationId: "createPet" },
  { method: "get", path: "/pets/{petId}", operationId: "getPet" },
  { method: "delete", path: "/pets/{petId}", operationId: "deletePet" },
  { method: "patch", path: "/pets/{petId}", operationId: "updatePet" },
];

function analyze(content: string, path = "src/api.ts") {
  return analyzeSource([{ path, content }], operations);
}

describe("analyzeSource", () => {
  it("detects a default-GET fetch call", () => {
    const result = analyze(`fetch("/pets");`);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      method: "get",
      path: "/pets",
      matchedMethod: "get",
      matchedPath: "/pets",
      operationId: "listPets",
      confidence: "high",
      line: 1,
    });
    expect(result.matches[0]?.evidence).toContain("src/api.ts:1:");
  });

  it("reads the method from fetch options", () => {
    const result = analyze(`fetch("/pets", { method: "POST", body: "{}" });`);

    expect(result.matches[0]).toMatchObject({
      method: "post",
      matchedMethod: "post",
      operationId: "createPet",
    });
  });

  it("detects axios member calls and literal path parameters", () => {
    const result = analyze(`axios.delete("/pets/42");`);

    expect(result.matches[0]).toMatchObject({
      call: "axios.delete",
      method: "delete",
      path: "/pets/42",
      matchedPath: "/pets/{petId}",
      operationId: "deletePet",
      confidence: "high",
    });
  });

  it("treats template interpolations as path parameters", () => {
    const result = analyze(`api.get(\`/pets/\${petId}\`);`);

    expect(result.matches[0]).toMatchObject({
      method: "get",
      path: "/pets/{}",
      matchedPath: "/pets/{petId}",
      operationId: "getPet",
      confidence: "medium",
    });
    expect(result.limitations.join(" ")).toContain("Template-literal paths");
  });

  it("reduces absolute URLs to their pathname and strips query strings", () => {
    const result = analyze(`fetch("https://api.example.com/pets?limit=10");`);

    expect(result.matches[0]).toMatchObject({
      path: "/pets",
      matchedPath: "/pets",
      confidence: "high",
    });
  });

  it("falls back to suffix matching with lower confidence", () => {
    const result = analyze(`fetch("/api/pets");`);

    expect(result.matches[0]).toMatchObject({
      path: "/api/pets",
      matchedPath: "/pets",
      confidence: "medium",
    });
  });

  it("supports axios object configuration and request helpers", () => {
    const axiosResult = analyze(`axios({ url: "/pets", method: "post" });`);
    const helperResult = analyze(`request("/pets/42", { method: "PATCH" });`);

    expect(axiosResult.matches[0]).toMatchObject({ method: "post", operationId: "createPet" });
    expect(helperResult.matches[0]).toMatchObject({ method: "patch", operationId: "updatePet" });
  });

  it("ignores calls that do not look like HTTP client calls", () => {
    const result = analyze(`
      console.log("/pets");
      cache.get("/pets");
      const value = "/pets/{petId}";
    `);

    expect(result.matches).toHaveLength(0);
  });

  it("ignores API calls that do not match a changed operation", () => {
    const result = analyze(`fetch("/owners"); fetch("/pets/42/photos");`);

    expect(result.matches).toHaveLength(0);
  });

  it("requires the method to match", () => {
    const result = analyze(`fetch("/pets", { method: "PUT" });`);

    expect(result.matches).toHaveLength(0);
  });

  it("captures evidence with line, column, and a trimmed snippet", () => {
    const result = analyze(`\n\n    await api.get("/pets");\n`);

    expect(result.matches[0]).toMatchObject({ line: 3, column: 11 });
    expect(result.matches[0]?.snippet).toBe('await api.get("/pets");');
  });

  it("skips unsupported files and ignored directories", () => {
    const result = analyzeSource(
      [
        { path: "README.md", content: `fetch("/pets")` },
        { path: "node_modules/pkg/index.ts", content: `fetch("/pets")` },
        { path: "src/app.ts", content: `fetch("/pets")` },
      ],
      operations,
    );

    expect(result.filesScanned).toBe(1);
    expect(result.filesSkipped).toBe(2);
    expect(result.matches).toHaveLength(1);
  });

  it("rejects too many files", () => {
    const files = Array.from({ length: 3 }, (_, index) => ({
      path: `src/file-${index}.ts`,
      content: `fetch("/pets")`,
    }));

    expect(() => analyzeSource(files, operations, { maxFiles: 2 })).toThrow(SourceAnalysisError);
  });

  it("rejects source over the total byte limit", () => {
    const files = [{ path: "src/big.ts", content: `fetch("/pets");${" ".repeat(200)}` }];

    expect(() =>
      analyzeSource(files, operations, { maxFiles: 10, maxFileBytes: 10_000, maxTotalBytes: 50 }),
    ).toThrow(SourceAnalysisError);
  });

  it("enforces a wall-clock budget", () => {
    expect(() =>
      analyzeSource([{ path: "src/api.ts", content: `fetch("/pets");` }], operations, {
        maxDurationMs: -1,
      }),
    ).toThrow(expect.objectContaining({ code: "analysis_timeout" }));
  });

  it("truncates matches and records a limitation", () => {
    const result = analyze(`fetch("/pets"); fetch("/pets"); fetch("/pets");`, "src/api.ts");
    const truncated = analyzeSource(
      [{ path: "src/api.ts", content: `fetch("/pets"); fetch("/pets");` }],
      operations,
      { maxMatches: 1 },
    );

    expect(result.matches).toHaveLength(3);
    expect(truncated.matches).toHaveLength(1);
    expect(truncated.limitations.join(" ")).toContain("truncated");
  });

  it("always reports the static-analysis limitation", () => {
    const result = analyze(`fetch("/pets");`);

    expect(result.limitations.join(" ")).toContain("Static analysis only detects API calls");
  });
});
