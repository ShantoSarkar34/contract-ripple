import { describe, expect, it } from "vitest";
import {
  createComparisonRequestSchema,
  createContractRequestSchema,
  createContractVersionRequestSchema,
  createProjectRequestSchema,
  MAX_CONTRACT_BYTES,
  updateProjectRequestSchema,
  utf8ByteLength,
} from "./api";

describe("createProjectRequestSchema", () => {
  it("accepts a name and optional description", () => {
    const result = createProjectRequestSchema.safeParse({
      name: "Payments",
      description: "Payment APIs",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "Payments", description: "Payment APIs" });
    }
  });

  it("trims the name and rejects blank names", () => {
    expect(createProjectRequestSchema.safeParse({ name: "  Pets  " }).success).toBe(true);
    expect(createProjectRequestSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(createProjectRequestSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an over-long name", () => {
    expect(createProjectRequestSchema.safeParse({ name: "x".repeat(121) }).success).toBe(false);
  });
});

describe("updateProjectRequestSchema", () => {
  it("requires at least one field", () => {
    expect(updateProjectRequestSchema.safeParse({}).success).toBe(false);
    expect(updateProjectRequestSchema.safeParse({ name: "New" }).success).toBe(true);
    expect(updateProjectRequestSchema.safeParse({ description: "" }).success).toBe(true);
  });
});

describe("createContractRequestSchema", () => {
  it("requires a non-empty name", () => {
    expect(createContractRequestSchema.safeParse({ name: "pets-api" }).success).toBe(true);
    expect(createContractRequestSchema.safeParse({ name: " " }).success).toBe(false);
  });
});

describe("createContractVersionRequestSchema", () => {
  it("accepts content with an optional format and label", () => {
    const result = createContractVersionRequestSchema.safeParse({
      content: '{"openapi":"3.1.0"}',
      format: "json",
      label: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unsupported format", () => {
    expect(
      createContractVersionRequestSchema.safeParse({ content: "{}", format: "xml" }).success,
    ).toBe(false);
  });

  it("rejects empty content", () => {
    expect(createContractVersionRequestSchema.safeParse({ content: "" }).success).toBe(false);
  });

  it("rejects content beyond the byte limit", () => {
    const tooLarge = "a".repeat(MAX_CONTRACT_BYTES + 1);
    expect(createContractVersionRequestSchema.safeParse({ content: tooLarge }).success).toBe(false);
  });
});

describe("createComparisonRequestSchema", () => {
  it("requires both version identifiers", () => {
    expect(
      createComparisonRequestSchema.safeParse({
        baselineVersionId: "a",
        candidateVersionId: "b",
      }).success,
    ).toBe(true);
    expect(
      createComparisonRequestSchema.safeParse({ baselineVersionId: "a" }).success,
    ).toBe(false);
  });
});

describe("utf8ByteLength", () => {
  it("counts multi-byte characters", () => {
    expect(utf8ByteLength("abc")).toBe(3);
    expect(utf8ByteLength("é")).toBe(2);
    expect(utf8ByteLength("😀")).toBe(4);
  });
});
