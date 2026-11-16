import { describe, expect, it } from "vitest";
import { ANALYSIS_TIMEOUT_MS, isAnalysisExpired } from "./analysis-lifecycle";

describe("analysis expiration", () => {
  it("expires at exactly two minutes, not before", () => {
    const start = "2026-11-16T00:00:00.000Z";
    const time = Date.parse(start);
    expect(ANALYSIS_TIMEOUT_MS).toBe(120_000);
    expect(isAnalysisExpired(start, time + 119_999)).toBe(false);
    expect(isAnalysisExpired(start, time + 120_000)).toBe(true);
  });
});