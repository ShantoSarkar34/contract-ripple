import { describe, expect, it } from "vitest";
import {
  IMPACT_GRAPH_LIMITS,
  buildImpactGraph,
  collectFilterValues,
  normalizeMethod,
  normalizePath,
  type FindingLike,
  type ImpactGraphSource,
  type ImpactLike,
} from "./index.js";

function makeFinding(overrides: Partial<FindingLike> & { id: string }): FindingLike {
  return {
    category: "response",
    changeType: "modified",
    risk: "non_breaking",
    path: "/pets",
    method: "get",
    operationId: null,
    location: "#/paths/~1pets/get",
    summary: "Change",
    ...overrides,
  };
}

function makeImpact(overrides: Partial<ImpactLike> & { id: string }): ImpactLike {
  return {
    filePath: "src/api.ts",
    line: 3,
    column: 1,
    snippet: 'fetch("/pets")',
    call: "fetch",
    method: "get",
    path: "/pets",
    matchedMethod: "get",
    matchedPath: "/pets",
    operationId: null,
    confidence: "high",
    evidence: "fetch matches GET /pets",
    ...overrides,
  };
}

const source: ImpactGraphSource = {
  snapshotId: "snap-1",
  sourceType: "zip",
  repository: null,
  ref: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const getPets = makeFinding({
  id: "f1",
  risk: "potentially_breaking",
  operationId: "listPets",
  summary: "A response property was removed",
});
const getPetsParam = makeFinding({
  id: "f2",
  category: "parameter",
  changeType: "added",
  operationId: "listPets",
  summary: "An optional query parameter was added",
});
const postPets = makeFinding({
  id: "f3",
  method: "post",
  changeType: "added",
  operationId: "createPet",
  summary: "A new operation was added",
});
const unmapped = makeFinding({
  id: "f4",
  method: null,
  path: null,
  risk: "unknown",
  category: "schema_property",
  summary: "A component schema changed",
});

const apiTs = makeImpact({ id: "i1", filePath: "src/api.ts" });
const petsTsx = makeImpact({
  id: "i2",
  filePath: "src/pets.tsx",
  matchedMethod: "post",
  matchedPath: "/pets",
  method: "post",
  path: "/pets",
  confidence: "medium",
});
const legacyTs = makeImpact({
  id: "i3",
  filePath: "src/legacy.ts",
  matchedMethod: "delete",
  matchedPath: "/pets/{id}",
  method: "delete",
  path: "/pets/42",
  confidence: "low",
});

describe("normalizeMethod / normalizePath", () => {
  it("normalizes method casing and path spellings", () => {
    expect(normalizeMethod(" GET ")).toBe("get");
    expect(normalizeMethod("")).toBeNull();
    expect(normalizeMethod(null)).toBeNull();
    expect(normalizePath("pets/")).toBe("/pets");
    expect(normalizePath("//pets//42")).toBe("/pets/42");
    expect(normalizePath("\\pets\\42")).toBe("/pets/42");
    expect(normalizePath("")).toBeNull();
  });
});

describe("buildImpactGraph", () => {
  it("groups findings into changed operations and keeps the highest risk", () => {
    const graph = buildImpactGraph([getPets, getPetsParam, postPets], []);

    expect(graph.operations).toHaveLength(2);
    const list = graph.operations[0];
    expect(list).toMatchObject({
      id: "operation:get /pets",
      kind: "operation",
      method: "get",
      path: "/pets",
      operationId: "listPets",
      risk: "potentially_breaking",
      findingCount: 2,
    });
    expect(list?.findings.map((finding) => finding.id).sort()).toEqual(["f1", "f2"]);
    expect(graph.operations[1]).toMatchObject({ method: "post", risk: "non_breaking" });
    expect(graph.files).toEqual([]);
    expect(graph.edges).toEqual([]);
    expect(graph.summary).toMatchObject({
      operationCount: 2,
      fileCount: 0,
      relationCount: 0,
      unmappedFindingCount: 0,
      truncated: false,
    });
    expect(graph.limitations.join(" ")).toContain("No source analysis is selected");
  });

  it("creates file nodes and evidence-backed edges from matching impacts", () => {
    const graph = buildImpactGraph([getPets, postPets], [apiTs, petsTsx, legacyTs], { source });

    expect(graph.files.map((file) => file.filePath)).toEqual(["src/api.ts", "src/pets.tsx"]);
    expect(graph.edges).toHaveLength(2);
    const edge = graph.edges.find((candidate) => candidate.target === "file:src/api.ts");
    expect(edge).toMatchObject({
      source: "operation:get /pets",
      impactCount: 1,
      highestConfidence: "high",
      evidenceTruncated: false,
    });
    expect(edge?.impacts[0]).toMatchObject({
      id: "i1",
      filePath: "src/api.ts",
      line: 3,
      column: 1,
      method: "get",
      path: "/pets",
      confidence: "high",
    });
    expect(graph.summary).toMatchObject({
      operationCount: 2,
      fileCount: 2,
      relationCount: 2,
      impactCount: 2,
      unmatchedImpactCount: 1,
    });
    expect(graph.limitations.join(" ")).toContain("did not correspond to a shown changed operation");
  });

  it("ignores impacts when no source snapshot is selected", () => {
    const graph = buildImpactGraph([getPets], [apiTs], { source: null });

    expect(graph.edges).toEqual([]);
    expect(graph.files).toEqual([]);
    expect(graph.source).toBeNull();
    expect(graph.limitations.join(" ")).toContain("No source analysis is selected");
  });

  it("counts findings without a method and path as unmapped", () => {
    const graph = buildImpactGraph([unmapped], [], { source });

    expect(graph.operations).toEqual([]);
    expect(graph.summary.unmappedFindingCount).toBe(1);
    expect(graph.limitations.join(" ")).toContain("do not identify both an HTTP method and a path");
  });

  it("filters operations by risk, category, and method", () => {
    const byRisk = buildImpactGraph([getPets, getPetsParam, postPets], [], {
      filters: { risk: "potentially_breaking" },
    });
    expect(byRisk.operations.map((node) => node.id)).toEqual(["operation:get /pets"]);
    expect(byRisk.operations[0]?.findingCount).toBe(1);

    const byCategory = buildImpactGraph([getPets, getPetsParam, postPets], [], {
      filters: { category: "parameter" },
    });
    expect(byCategory.operations).toHaveLength(1);
    expect(byCategory.operations[0]?.findings.map((finding) => finding.id)).toEqual(["f2"]);

    const byMethod = buildImpactGraph([getPets, postPets], [], {
      filters: { method: "POST" },
    });
    expect(byMethod.operations.map((node) => node.id)).toEqual(["operation:post /pets"]);
  });

  it("filters relationships by confidence without dropping the operation", () => {
    const graph = buildImpactGraph([getPets, postPets], [apiTs, petsTsx], {
      source,
      filters: { confidence: "medium" },
    });

    expect(graph.operations.map((node) => node.id)).toEqual([
      "operation:get /pets",
      "operation:post /pets",
    ]);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({
      source: "operation:post /pets",
      target: "file:src/pets.tsx",
      highestConfidence: "medium",
    });
  });

  it("matches a query against operations and their impacts", () => {
    const byOperation = buildImpactGraph([getPets, postPets], [apiTs, petsTsx], {
      source,
      filters: { query: "listPets" },
    });
    expect(byOperation.operations.map((node) => node.id)).toEqual(["operation:get /pets"]);
    expect(byOperation.edges.map((edge) => edge.target)).toEqual(["file:src/api.ts"]);

    const byFile = buildImpactGraph([getPets, postPets], [apiTs, petsTsx], {
      source,
      filters: { query: "pets.tsx" },
    });
    expect(byFile.operations.map((node) => node.id)).toEqual(["operation:post /pets"]);
    expect(byFile.edges.map((edge) => edge.target)).toEqual(["file:src/pets.tsx"]);
  });

  it("returns an empty graph with an explanation when the query matches nothing", () => {
    const graph = buildImpactGraph([getPets], [apiTs], { source, filters: { query: "zzz" } });

    expect(graph.operations).toEqual([]);
    expect(graph.edges).toEqual([]);
    expect(graph.limitations.join(" ")).toContain("No changed operations match the current filters.");
    expect(graph.limitations.join(" ")).toContain("current filters are hiding");
  });

  it("is deterministic regardless of input order", () => {
    const findings = [postPets, getPets, unmapped, getPetsParam];
    const impacts = [legacyTs, apiTs, petsTsx];
    const shuffled = buildImpactGraph(findings, impacts, { source });
    const sorted = buildImpactGraph([...findings].reverse(), [...impacts].reverse(), { source });

    expect(shuffled.operations).toEqual(sorted.operations);
    expect(shuffled.files).toEqual(sorted.files);
    expect(shuffled.edges).toEqual(sorted.edges);
    expect(shuffled.summary).toEqual(sorted.summary);
  });

  it("truncates operations and reports the limit", () => {
    const findings = [
      makeFinding({ id: "a", path: "/a", risk: "potentially_breaking" }),
      makeFinding({ id: "b", path: "/b", risk: "unknown" }),
      makeFinding({ id: "c", path: "/c", risk: "non_breaking" }),
    ];
    const graph = buildImpactGraph(findings, [], {
      limits: { maxOperations: 1 },
    });

    expect(graph.summary.truncated).toBe(true);
    expect(graph.operations).toHaveLength(1);
    expect(graph.summary.totalOperationCount).toBe(3);
    expect(graph.limitations.join(" ")).toContain(
      "Showing the highest-risk 1 of 3 changed operations.",
    );
  });

  it("truncates relationships and reports the limit", () => {
    const findings = [
      makeFinding({ id: "a", path: "/a" }),
      makeFinding({ id: "b", path: "/b" }),
      makeFinding({ id: "c", path: "/c" }),
    ];
    const impacts = [
      makeImpact({ id: "a", filePath: "src/a.ts", matchedPath: "/a", path: "/a" }),
      makeImpact({ id: "b", filePath: "src/b.ts", matchedPath: "/b", path: "/b" }),
      makeImpact({ id: "c", filePath: "src/c.ts", matchedPath: "/c", path: "/c" }),
    ];
    const graph = buildImpactGraph(findings, impacts, { source, limits: { maxEdges: 1 } });

    expect(graph.summary.truncated).toBe(true);
    expect(graph.edges).toHaveLength(1);
    expect(graph.summary.totalRelationCount).toBe(3);
    expect(graph.limitations.join(" ")).toContain("of 3 operation-to-file relationships");
  });

  it("truncates files and reports the limit", () => {
    const findings = [
      makeFinding({ id: "a", path: "/a" }),
      makeFinding({ id: "b", path: "/b" }),
      makeFinding({ id: "c", path: "/c" }),
    ];
    const impacts = [
      makeImpact({ id: "a", filePath: "src/a.ts", matchedPath: "/a", path: "/a" }),
      makeImpact({ id: "b", filePath: "src/b.ts", matchedPath: "/b", path: "/b" }),
      makeImpact({ id: "c", filePath: "src/c.ts", matchedPath: "/c", path: "/c" }),
    ];
    const graph = buildImpactGraph(findings, impacts, { source, limits: { maxFiles: 1 } });

    expect(graph.summary.truncated).toBe(true);
    expect(graph.files).toHaveLength(1);
    expect(graph.edges).toHaveLength(1);
    expect(graph.summary.totalFileCount).toBe(3);
    expect(graph.limitations.join(" ")).toContain("most affected of 3 source files");
  });

  it("caps evidence embedded in nodes and relationships", () => {
    const graph = buildImpactGraph(
      [getPets, getPetsParam],
      [apiTs, makeImpact({ id: "i4", filePath: "src/api.ts", line: 9 })],
      { source, limits: { maxEvidencePerRelation: 1 } },
    );

    expect(graph.operations[0]).toMatchObject({ findingCount: 2, evidenceTruncated: true });
    expect(graph.operations[0]?.findings).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({ impactCount: 2, evidenceTruncated: true });
    expect(graph.edges[0]?.impacts).toHaveLength(1);
    expect(graph.limitations.join(" ")).toContain("evidence lists in the graph are truncated");
  });

  it("reports no matches when operations exist but the snapshot has none", () => {
    const graph = buildImpactGraph([getPets], [], { source });

    expect(graph.limitations.join(" ")).toContain(
      "No statically resolvable source calls matched the changed operations",
    );
  });

  it("returns an empty graph with an explanation when there are no findings", () => {
    const graph = buildImpactGraph([], [], { source });

    expect(graph.summary).toMatchObject({ operationCount: 0, fileCount: 0, relationCount: 0 });
    expect(graph.limitations.join(" ")).toContain("comparison reported no findings");
  });

  it("keeps the source metadata on the graph", () => {
    const githubSource: ImpactGraphSource = {
      snapshotId: "snap-2",
      sourceType: "github",
      repository: "octo/pets",
      ref: "main",
      createdAt: "2026-01-02T00:00:00.000Z",
    };
    const graph = buildImpactGraph([getPets], [apiTs], { source: githubSource });

    expect(graph.source).toEqual(githubSource);
  });

  it("exposes the documented default limits", () => {
    expect(IMPACT_GRAPH_LIMITS.maxOperations).toBe(200);
    expect(IMPACT_GRAPH_LIMITS.maxFiles).toBe(400);
    expect(IMPACT_GRAPH_LIMITS.maxEdges).toBe(800);
    expect(IMPACT_GRAPH_LIMITS.maxEvidencePerRelation).toBe(20);
  });
});

describe("collectFilterValues", () => {
  it("collects sorted, unique filter options", () => {
    const values = collectFilterValues(
      [getPetsParam, unmapped, postPets, getPets],
      [apiTs, legacyTs, petsTsx],
    );

    expect(values.risks).toEqual(["potentially_breaking", "unknown", "non_breaking"]);
    expect(values.categories).toEqual(["parameter", "response", "schema_property"]);
    expect(values.methods).toEqual(["get", "post"]);
    expect(values.confidences).toEqual(["high", "medium", "low"]);
  });

  it("returns empty lists for empty inputs", () => {
    expect(collectFilterValues([], [])).toEqual({
      risks: [],
      categories: [],
      methods: [],
      confidences: [],
    });
  });
});
