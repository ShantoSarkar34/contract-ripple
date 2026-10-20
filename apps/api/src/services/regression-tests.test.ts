import { describe, expect, it } from "vitest";
import type { FindingDto } from "@contract-ripple/shared";
import { generateRegressionSuggestions } from "./regression-tests.js";

function finding(overrides: Partial<FindingDto>): FindingDto {
  return {
    id: "f1",
    category: "operation",
    changeType: "modified",
    risk: "non_breaking",
    path: "/pets",
    method: "get",
    operationId: "listPets",
    location: "#/paths/~1pets/get",
    summary: "Operation changed",
    explanation: "Explanation",
    before: null,
    after: null,
    ...overrides,
  };
}

describe("generateRegressionSuggestions", () => {
  it("groups findings by normalized method and path and keeps the highest risk", () => {
    const suggestions = generateRegressionSuggestions([
      finding({
        id: "f1",
        method: "GET",
        path: "/pets",
        risk: "non_breaking",
        summary: "Added parameter",
      }),
      finding({
        id: "f2",
        method: "get",
        path: "/pets",
        risk: "potentially_breaking",
        category: "parameter",
        summary: "Removed parameter",
      }),
      finding({
        id: "f3",
        method: "post",
        path: "/pets",
        risk: "unknown",
        operationId: "createPet",
        category: "request_body",
        summary: "Request body changed",
      }),
    ]);

    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]).toMatchObject({
      method: "get",
      path: "/pets",
      risk: "potentially_breaking",
      operationId: "listPets",
    });
    expect(suggestions[0]?.findingIds).toEqual(["f1", "f2"]);
    expect(suggestions[0]?.suggestedChecks).toHaveLength(2);
    expect(suggestions[1]).toMatchObject({
      method: "post",
      path: "/pets",
      risk: "unknown",
      operationId: "createPet",
    });
  });

  it("ignores findings that are not scoped to an operation", () => {
    const suggestions = generateRegressionSuggestions([
      finding({ id: "f1", method: null, path: null, category: "schema_property" }),
      finding({ id: "f2", method: "get", path: null }),
      finding({ id: "f3", method: null, path: "/pets" }),
    ]);

    expect(suggestions).toEqual([]);
  });

  it("creates checks from the actual category and change type", () => {
    const removed = generateRegressionSuggestions([
      finding({
        id: "f1",
        category: "operation",
        changeType: "removed",
        risk: "potentially_breaking",
      }),
    ]);
    expect(removed[0]?.suggestedChecks[0]).toContain("fails gracefully or has been removed");

    const parameter = generateRegressionSuggestions([
      finding({
        id: "f2",
        category: "parameter",
        changeType: "added",
        risk: "potentially_breaking",
      }),
    ]);
    expect(parameter[0]?.suggestedChecks[0]).toContain("newly required values");

    const composition = generateRegressionSuggestions([
      finding({ id: "f3", category: "combinator", changeType: "modified" }),
    ]);
    expect(composition[0]?.suggestedChecks[0]).toContain("oneOf/anyOf/allOf");
  });

  it("bounds evidence while retaining every finding id", () => {
    const findings = Array.from({ length: 25 }, (_, index) =>
      finding({
        id: `f${index + 1}`,
        summary: `Change ${index + 1}`,
        location: `#/paths/~1pets/get/${index + 1}`,
      }),
    );

    const [suggestion] = generateRegressionSuggestions(findings);

    expect(suggestion?.findingIds).toHaveLength(25);
    expect(suggestion?.evidence).toHaveLength(20);
    expect(suggestion?.rationale).toContain("25 classified findings");
    expect(suggestion?.evidence[0]).toContain("Change 1");
  });

  it("produces a stable order for equal-risk suggestions", () => {
    const suggestions = generateRegressionSuggestions([
      finding({ id: "f1", method: "post", path: "/owners" }),
      finding({ id: "f2", method: "get", path: "/pets" }),
      finding({ id: "f3", method: "delete", path: "/pets" }),
    ]);

    expect(suggestions.map((suggestion) => `${suggestion.method} ${suggestion.path}`)).toEqual([
      "delete /pets",
      "get /pets",
      "post /owners",
    ]);
  });
});
