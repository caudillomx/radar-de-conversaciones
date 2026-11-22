import { describe, expect, it } from "vitest";
import { buildInput, normalize } from "./apify.server";

describe("expanded X extraction", () => {
  it("searches recent and top replies within the requested publication", () => {
    const input = buildInput("x", "https://x.com/alessandrardlv/status/2123888236414079215", "2123888236414079215", 5000, true) as { searchTerms: string[]; maxItems: number; sort: string };
    expect(input.maxItems).toBe(5000);
    expect(input.sort).toBe("Latest + Top");
    // 13 two-hour slices + 4 twelve-hour slices + 1 open tail
    expect(input.searchTerms).toHaveLength(18);
    expect(input.searchTerms.every((term) => term.startsWith("conversation_id:2123888236414079215 since_time:"))).toBe(true);
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