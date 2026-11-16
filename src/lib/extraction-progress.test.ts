import { describe, expect, it } from "vitest";
import { extractionProgress } from "./extraction-progress";

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