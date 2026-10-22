import { describe, expect, it } from "vitest";
import {
  analysisRange,
  analysisTitle,
  compareAnalysesNewestFirst,
  formatDuration,
} from "./analysis";

const labels = {
  label: null,
  baselineVersionLabel: "v1",
  candidateVersionLabel: "v2",
};

describe("analysis helpers", () => {
  it("prefers a trimmed user label", () => {
    expect(analysisTitle({ ...labels, label: "  Release review  " })).toBe("Release review");
  });

  it("falls back to the version range", () => {
    expect(analysisTitle(labels)).toBe("v1 → v2");
    expect(analysisRange({ ...labels, baselineVersionLabel: null, candidateVersionLabel: " " })).toBe(
      "Baseline → Candidate",
    );
  });

  it("formats millisecond and second durations", () => {
    expect(formatDuration(240)).toBe("240 ms");
    expect(formatDuration(1250)).toBe("1.3 s");
    expect(formatDuration(Number.NaN)).toBe("Unknown duration");
  });

  it("sorts newest first and uses the id as a deterministic tie-breaker", () => {
    const older = { id: "b", createdAt: "2026-10-20T10:00:00.000Z" };
    const newer = { id: "a", createdAt: "2026-10-21T10:00:00.000Z" };
    const sameTimeA = { id: "a", createdAt: "2026-10-21T10:00:00.000Z" };
    const sameTimeB = { id: "b", createdAt: "2026-10-21T10:00:00.000Z" };

    expect([older, newer].sort(compareAnalysesNewestFirst)[0]).toBe(newer);
    expect(
      [sameTimeB, sameTimeA].sort(compareAnalysesNewestFirst).map((entry) => entry.id),
    ).toEqual(["a", "b"]);
  });
});
