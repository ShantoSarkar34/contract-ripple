import type { HealthResponse, ReadyResponse } from "@contract-ripple/shared";
import type { Repository } from "../db/types.js";

const SERVICE_NAME = "contract-ripple-api";

export type BuildHealthOptions = {
  now?: Date;
  uptimeSeconds?: number;
};

/**
 * Builds the public health payload. Kept pure so it can be tested without
 * starting an HTTP server.
 */
export function buildHealthResponse(options: BuildHealthOptions = {}): HealthResponse {
  const now = options.now ?? new Date();
  const uptimeSeconds = options.uptimeSeconds ?? Math.round(process.uptime());

  return {
    status: "ok",
    service: SERVICE_NAME,
    timestamp: now.toISOString(),
    uptimeSeconds,
  };
}

export type ReadinessResult = {
  ready: boolean;
  response: ReadyResponse;
};

/**
 * Checks database connectivity for readiness probes. A failure is reported as
 * `degraded`, never thrown, so the route can return the correct status code.
 */
export async function checkReadiness(
  repository: Repository,
  now: Date = new Date(),
): Promise<ReadinessResult> {
  try {
    await repository.ping();
    return {
      ready: true,
      response: { status: "ok", database: "up", timestamp: now.toISOString() },
    };
  } catch {
    return {
      ready: false,
      response: { status: "degraded", database: "down", timestamp: now.toISOString() },
    };
  }
}
