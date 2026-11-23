import { describe, expect, it } from "vitest";
import { buildInput, normalize, xSearchTerms } from "./apify.server";

describe("expanded X extraction", () => {
  it("searches recent and top replies within the requested publication", () => {
    const input = buildInput("x", "https://x.com/alessandrardlv/status/2123888236414079215", "2123888236414079215", 5000, true) as { searchTerms: string[]; maxItems: number; sort: string };
    expect(input.maxItems).toBe(5000);
    expect(input.sort).toBe("Latest + Top");
    // 13 quarter-hour slices + 21 hourly + 4 twelve-hour + 1 open tail
    expect(xSearchTerms("2123888236414079215", 4e9)).toHaveLength(39);
    expect(input.searchTerms.every((term) => term.startsWith("conversation_id:2123888236414079215 since_time:"))).toBe(true);
  });
  it("skips slices that have not happened yet for a young post", () => {
    const start = Math.floor((Number(BigInt("2123888236414079215") >> 22n) + 1288834974657) / 1000);
    const terms = xSearchTerms("2123888236414079215", start + 2 * 3600);
    // from -15 min to +2h in 15-min steps
    expect(terms).toHaveLength(10);
  });
  it("keeps the same external ID across both indexes for deduplication", () => {
    const recent = normalize("x", { id: "123", text: "Comentario" }, "456");
    const top = normalize("x", { id: "123", text: "Comentario", likeCount: 12 }, "456");
    expect(recent?.external_id).toBe("123");
    expect(top?.external_id).toBe("123");
  });
  it("excludes the original publication from the comment sample", () => {
    expect(normalize("x", { id: "456", text: "Publicación" }, "456")).toBeNull();
  });
});