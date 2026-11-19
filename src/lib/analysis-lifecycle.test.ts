import { describe, expect, it } from "vitest";
import { ANALYSIS_STALL_MS, isAnalysisStalled, meetsCoverage, stageLabel } from "./analysis-lifecycle";

describe("analysis lifecycle", () => {
  it("fails only after 10 minutes without progress", () => {
    const t = Date.parse("2026-11-16T00:00:00.000Z");
    expect(ANALYSIS_STALL_MS).toBe(600_000);
    expect(isAnalysisStalled("2026-11-16T00:00:00.000Z", t + 599_999)).toBe(false);
    expect(isAnalysisStalled("2026-11-16T00:00:00.000Z", t + 600_000)).toBe(true);
  });
  it("requires at least 80% coverage", () => {
    expect(meetsCoverage(1600, 2000)).toBe(true);
    expect(meetsCoverage(1599, 2000)).toBe(false);
  });
  it("labels classification progress by batches", () => {
    expect(stageLabel("clasificacion", 6, 20)).toBe("Clasificando 6 de 20 lotes…");
  });
});
