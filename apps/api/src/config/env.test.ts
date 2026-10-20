import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

describe("loadEnv GitHub settings", () => {
  it("disables GitHub by default and uses the official API base URL", () => {
    const env = loadEnv({});

    expect(env.githubToken).toBe("");
    expect(env.githubApiBaseUrl).toBe("https://api.github.com");
  });

  it("trims the token and normalizes a custom API base URL", () => {
    const env = loadEnv({
      GITHUB_TOKEN: "  token-value  ",
      GITHUB_API_BASE_URL: "https://github.example.test/api/v3/",
    });

    expect(env.githubToken).toBe("token-value");
    expect(env.githubApiBaseUrl).toBe("https://github.example.test/api/v3");
  });

  it("rejects an invalid API base URL without echoing the value", () => {
    expect(() => loadEnv({ GITHUB_API_BASE_URL: "ftp://example.test" })).toThrow(
      "GITHUB_API_BASE_URL must be a valid http(s) URL.",
    );
    expect(() => loadEnv({ GITHUB_API_BASE_URL: "not-a-url" })).toThrow(
      "GITHUB_API_BASE_URL must be a valid http(s) URL.",
    );
  });
});
