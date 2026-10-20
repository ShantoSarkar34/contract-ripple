import { describe, expect, it } from "vitest";
import {
  isDynamicSegment,
  isIgnoredSourcePath,
  isSupportedSourcePath,
  matchOperation,
  normalizeCallPath,
  splitPath,
} from "./paths.js";
import type { ChangedOperation } from "./types.js";

const operations: ChangedOperation[] = [
  { method: "get", path: "/pets", operationId: "listPets" },
  { method: "post", path: "/pets", operationId: "createPet" },
  { method: "get", path: "/pets/{petId}", operationId: "getPet" },
  { method: "get", path: "/owners/{ownerId}/pets", operationId: "listOwnerPets" },
];

describe("normalizeCallPath", () => {
  it("normalizes relative, absolute, and trailing-slash paths", () => {
    expect(normalizeCallPath("pets")).toBe("/pets");
    expect(normalizeCallPath("/pets/")).toBe("/pets");
    expect(normalizeCallPath("https://api.example.com/pets?x=1#y")).toBe("/pets");
    expect(normalizeCallPath("//pets//42")).toBe("/pets/42");
  });

  it("rejects empty, whitespace, and malformed values", () => {
    expect(normalizeCallPath("")).toBeNull();
    expect(normalizeCallPath("not a path")).toBeNull();
    expect(normalizeCallPath("http://")).toBeNull();
  });
});

describe("isSupportedSourcePath", () => {
  it("accepts TypeScript and JavaScript extensions only", () => {
    expect(isSupportedSourcePath("src/a.ts")).toBe(true);
    expect(isSupportedSourcePath("src/a.tsx")).toBe(true);
    expect(isSupportedSourcePath("src/a.mjs")).toBe(true);
    expect(isSupportedSourcePath("src/a.json")).toBe(false);
    expect(isSupportedSourcePath("src/a.css")).toBe(false);
  });
});

describe("isIgnoredSourcePath", () => {
  it("ignores dependency and build directories", () => {
    expect(isIgnoredSourcePath("node_modules/pkg/a.ts")).toBe(true);
    expect(isIgnoredSourcePath("dist/a.ts")).toBe(true);
    expect(isIgnoredSourcePath("src/a.ts")).toBe(false);
  });
});

describe("isDynamicSegment", () => {
  it("recognizes OpenAPI, Express, and template placeholders", () => {
    expect(isDynamicSegment("{petId}")).toBe(true);
    expect(isDynamicSegment(":petId")).toBe(true);
    expect(isDynamicSegment("{}")).toBe(true);
    expect(isDynamicSegment("pets")).toBe(false);
  });
});

describe("matchOperation", () => {
  it("prefers an exact match", () => {
    expect(matchOperation("get", "/pets", operations)).toMatchObject({
      confidence: "high",
      operation: { operationId: "listPets" },
    });
  });

  it("matches literal path parameters", () => {
    expect(matchOperation("get", "/pets/42", operations)).toMatchObject({
      confidence: "high",
      operation: { operationId: "getPet" },
    });
  });

  it("requires the HTTP method to match", () => {
    expect(matchOperation("delete", "/pets", operations)).toBeNull();
  });

  it("supports suffix matching for a shared API prefix", () => {
    expect(matchOperation("get", "/api/pets", operations)).toMatchObject({
      confidence: "medium",
      operation: { operationId: "listPets" },
    });
    expect(matchOperation("get", "/api/owners/7/pets", operations)).toMatchObject({
      confidence: "medium",
      operation: { operationId: "listOwnerPets" },
    });
  });

  it("prefers the most specific suffix", () => {
    expect(matchOperation("get", "/api/pets/9", operations)).toMatchObject({
      operation: { operationId: "getPet" },
    });
  });

  it("returns null for unrelated paths", () => {
    expect(matchOperation("get", "/owners", operations)).toBeNull();
  });
});

describe("splitPath", () => {
  it("splits paths without empty segments", () => {
    expect(splitPath("/pets/{petId}")).toEqual(["pets", "{petId}"]);
    expect(splitPath("/")).toEqual([]);
  });
});
