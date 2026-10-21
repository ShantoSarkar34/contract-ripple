import { createHash } from "node:crypto";
import type { Repository } from "../db/types.js";
import { HttpError } from "../middleware/http-error.js";

export type RateLimitPolicy = {
  limit: number;
  windowMs: number;
};

export type RateLimitConfig = {
  registerPerIp: RateLimitPolicy;
  loginPerIp: RateLimitPolicy;
  loginPerEmail: RateLimitPolicy;
  createProjectPerUser: RateLimitPolicy;
  createComparisonPerUser: RateLimitPolicy;
  sourceAnalysisPerUser: RateLimitPolicy;
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  registerPerIp: { limit: 10, windowMs: HOUR },
  loginPerIp: { limit: 30, windowMs: 15 * MINUTE },
  loginPerEmail: { limit: 10, windowMs: 15 * MINUTE },
  createProjectPerUser: { limit: 60, windowMs: HOUR },
  createComparisonPerUser: { limit: 120, windowMs: HOUR },
  sourceAnalysisPerUser: { limit: 30, windowMs: HOUR },
};

export function mergeRateLimits(
  overrides: Partial<RateLimitConfig> | undefined,
): RateLimitConfig {
  return { ...DEFAULT_RATE_LIMITS, ...overrides };
}

function opaqueKey(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function rateLimitKey(
  scope: string,
  identifier: string,
): string {
  return `${scope}:${opaqueKey(identifier)}`;
}

/**
 * Fixed-window counters live in the database so limits are shared across
 * serverless instances. The table stores only opaque hashes of IPs/emails.
 */
export async function enforceRateLimit(
  repository: Repository,
  key: string,
  policy: RateLimitPolicy,
  now?: Date,
): Promise<void> {
  const result = await repository.consumeRateLimit({
    key,
    limit: policy.limit,
    windowMs: policy.windowMs,
    now,
  });

  if (!result.allowed) {
    throw new HttpError(
      429,
      "rate_limited",
      "Too many requests. Try again later.",
      { retryAfterSeconds: result.retryAfterSeconds },
      { "Retry-After": String(result.retryAfterSeconds) },
    );
  }
}
