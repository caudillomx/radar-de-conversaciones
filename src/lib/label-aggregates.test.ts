import { describe, expect, it } from "vitest";
import { computeAggregates, computeNarratives, moe95, type Label } from "./label-aggregates";

const L = (stance: string | null, platform = "x", sentiment = "neu"): Label => ({ sentiment, stance, account_type: "persona", language: "es", gender: "nd", age: "nd", country: "nd", platform });

describe("stance aggregates", () => {
  it("reports no_aplica over all and favor/contra/ambigua only over applicable comments", () => {
    const labels = [...Array(6)].map(() => L("favor")).concat([L("contra"), L("contra"), L("no_aplica"), L("no_aplica")]);
    const s = computeAggregates(labels, "la reforma")!.stance!;
    expect(s.no_aplica).toBe(20);
    expect(s.n_base).toBe(8);
    expect(s.favor.share).toBe(75);
    expect(s.contra.share).toBe(25);
    expect(s.favor.moe).toBe(moe95(0.75, 8));
  });
  it("computes the 95% margin of error", () => { expect(moe95(0.5, 400)).toBe(4.9); });
  it("omits stance when the study has no target", () => { expect(computeAggregates([L("favor")], null).stance).toBeNull(); });
  it("stance is independent of sentiment: a negative comment can be in favor", () => {
    const s = computeAggregates([L("favor", "x", "neg"), L("favor", "x", "neg")], "obj");
    expect(s.sentiment.negative).toBe(100);
    expect(s.stance!.favor.share).toBe(100);
  });
  it("breaks stance down by platform", () => {
    const s = computeAggregates([L("favor", "x"), L("contra", "tiktok")], "obj").stance!;
    expect(s.by_platform.find((p) => p.platform === "tiktok")!.contra.share).toBe(100);
  });
});

describe("narrative shares", () => {
  it("counts real shares and folds unknown ids into the residual 'otra'", () => {
    const mk = (narrative: string | null): Label => ({ ...L(null), narrative });
    const r = computeNarratives([mk("n1"), mk("n1"), mk("n2"), mk("zzz")], [{ id: "n1" }, { id: "n2" }]);
    expect(r.find((x) => x.id === "n1")!.share).toBe(50);
    expect(r.find((x) => x.id === "otra")!.count).toBe(1);
    expect(r.find((x) => x.id === "n1")!.moe).toBe(moe95(0.5, 4));
  });
});
