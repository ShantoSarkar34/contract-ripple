import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

describe("loadEnv auth settings", () => {
  it("uses development defaults locally and requires a secret in production", () => {
    const development = loadEnv({});
    expect(development.authSecret.length).toBeGreaterThanOrEqual(32);
    expect(development.cookieSecure).toBe(false);
    expect(development.cookieSameSite).toBe("lax");

    expect(() => loadEnv({ NODE_ENV: "production" })).toThrow(
      "AUTH_SECRET is required in production",
    );
  });

  it("validates cookie settings", () => {
    expect(() =>
      loadEnv({ AUTH_COOKIE_SAME_SITE: "none" }),
    ).toThrow("AUTH_COOKIE_SAME_SITE=none requires AUTH_COOKIE_SECURE=true");

    expect(
      loadEnv({
        NODE_ENV: "production",
        AUTH_SECRET: "a".repeat(32),
        AUTH_COOKIE_SAME_SITE: "none",
        AUTH_COOKIE_SECURE: "true",
      }).cookieSameSite,
    ).toBe("none");
  });

  it("rejects short secrets and invalid booleans without echoing secrets", () => {
    expect(() =>
      loadEnv({ NODE_ENV: "production", AUTH_SECRET: "too-short" }),
    ).toThrow("AUTH_SECRET must be at least 32 characters.");
    expect(() => loadEnv({ AUTH_COOKIE_SECURE: "yes" })).toThrow(
      "Boolean environment values must be exactly",
    );
  });
});

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
