import { describe, expect, it } from "vitest";
import { synthesisSample } from "./synthesis-sample";

describe("synthesis publication coverage", () => {
  it("includes both publications, even when all highest-interaction comments come from the first", () => {
    const luna = Array.from({ length: 322 }, (_, id) => ({ id: `l${id}`, source_id: "luna", likes: 1000 - id }));
    const haces = Array.from({ length: 306 }, (_, id) => ({ id: `h${id}`, source_id: "haces", likes: 306 - id }));
    const sample = synthesisSample([...luna, ...haces], 400);
    expect(sample).toHaveLength(400);
    expect(sample.filter((c) => c.source_id === "luna")).toHaveLength(206);
    expect(sample.filter((c) => c.source_id === "haces")).toHaveLength(194);
    expect(new Set(sample.map((c) => c.id)).size).toBe(400);
  });
});