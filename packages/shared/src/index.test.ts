import { describe, expect, it } from "vitest";
import { isApiErrorResponse } from "./index";

describe("isApiErrorResponse", () => {
  it("accepts a well-formed error envelope", () => {
    expect(
      isApiErrorResponse({ error: { code: "not_found", message: "Missing" } }),
    ).toBe(true);
  });

  it("accepts an envelope with details", () => {
    expect(
      isApiErrorResponse({
        error: { code: "validation_error", message: "Invalid", details: { field: "name" } },
      }),
    ).toBe(true);
  });

  it.each([
    ["null", null],
    ["a string", "error"],
    ["an empty object", {}],
    ["an error without a code", { error: { message: "Missing" } }],
    ["an error with a non-string code", { error: { code: 42, message: "Missing" } }],
    ["an error that is not an object", { error: "boom" }],
  ])("rejects %s", (_label, value) => {
    expect(isApiErrorResponse(value)).toBe(false);
  });
});
