import { describe, expect, it } from "vitest";
import { MemoryRepository } from "../db/memory-repository.js";
import { enforceRateLimit, rateLimitKey } from "./rate-limit.js";

describe("rate limiting", () => {
  it("allows requests up to the limit and rejects the next one", async () => {
    const repository = new MemoryRepository();
    const policy = { limit: 2, windowMs: 60_000 };
    const key = rateLimitKey("login:ip", "203.0.113.10");

    await enforceRateLimit(repository, key, policy);
    await enforceRateLimit(repository, key, policy);

    await expect(enforceRateLimit(repository, key, policy)).rejects.toMatchObject({
      status: 429,
      code: "rate_limited",
      headers: { "Retry-After": expect.any(String) },
    });
  });

  it("resets the counter after the window elapses", async () => {
    const repository = new MemoryRepository();
    const policy = { limit: 1, windowMs: 60_000 };
    const start = new Date("2026-01-01T00:00:00.000Z");

    await enforceRateLimit(repository, "scope:key", policy, start);
    await expect(
      enforceRateLimit(repository, "scope:key", policy, start),
    ).rejects.toMatchObject({ status: 429 });

    await expect(
      enforceRateLimit(repository, "scope:key", policy, new Date(start.getTime() + 60_001)),
    ).resolves.toBeUndefined();
  });

  it("does not put the raw identifier in the bucket key", () => {
    const key = rateLimitKey("login:email", "person@example.com");
    expect(key.startsWith("login:email:")).toBe(true);
    expect(key).not.toContain("person@example.com");
  });
});
