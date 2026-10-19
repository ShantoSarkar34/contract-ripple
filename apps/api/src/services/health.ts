import type { HealthResponse } from "@contract-ripple/shared";

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
