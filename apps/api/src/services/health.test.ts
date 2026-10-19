import { describe, expect, it } from "vitest";
import { buildHealthResponse } from "./health";

describe("buildHealthResponse", () => {
  it("returns an ok payload with a deterministic timestamp", () => {
    const response = buildHealthResponse({
      now: new Date("2026-01-01T00:00:00.000Z"),
      uptimeSeconds: 42,
    });

    expect(response).toEqual({
      status: "ok",
      service: "contract-ripple-api",
      timestamp: "2026-01-01T00:00:00.000Z",
      uptimeSeconds: 42,
    });
  });

  it("computes uptime when not provided", () => {
    const response = buildHealthResponse();

    expect(response.status).toBe("ok");
    expect(response.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(new Date(response.timestamp).toString()).not.toBe("Invalid Date");
  });
});
