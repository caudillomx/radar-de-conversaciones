import { describe, expect, it } from "vitest";
import { extractionProgress, extractionState } from "./extraction-progress";

describe("live extraction progress", () => {
  it("measures collected comments against the configured 5,000 target", () => {
    expect(extractionProgress([{ comment_count: 1250, max_comments: 5000 }])).toEqual({ collected: 1250, target: 5000, percent: 25 });
  });
  it("aggregates sources without treating finished URLs as collected comments", () => {
    expect(extractionProgress([{ comment_count: 500, max_comments: 2500 }, { comment_count: 1500, max_comments: 2500 }])).toEqual({ collected: 2000, target: 5000, percent: 40 });
  });
  it("keeps progress bounded for replies beyond the target and empty studies", () => {
    expect(extractionProgress([{ comment_count: 5200, max_comments: 5000 }]).percent).toBe(100);
    expect(extractionProgress([]).percent).toBe(0);
  });
});

describe("extraction state", () => {
  it("finishes even when only 2,317 of 5,000 comments were collected", () => {
    const sources = [{ status: "extraida", comment_count: 2317, max_comments: 5000 }];
    expect(extractionProgress(sources).percent).toBe(46);
    expect(extractionState(sources)).toBe("completed");
  });
  it("stays running while any source is still extracting", () => {
    expect(extractionState([{ status: "extraida" }, { status: "extrayendo" }])).toBe("running");
  });
  it("does not report failures or unstarted sources as completed", () => {
    expect(extractionState([{ status: "extraida" }, { status: "error" }])).toBe("error");
    expect(extractionState([{ status: "extraida" }, { status: "lista" }])).toBe("pending");
    expect(extractionState([])).toBe("pending");
  });
});