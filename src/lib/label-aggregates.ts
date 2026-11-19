import type { Dist, StanceResult } from "./analysis-types";

/** One persisted classification (shape of a comment_labels row plus the comment's platform). */
export type Label = {
  sentiment: string | null; stance: string | null; account_type: string | null; language: string | null;
  gender: string | null; age: string | null; country: string | null; platform: string;
};

const tally = <T,>(xs: T[], f: (x: T) => string) => xs.reduce<Record<string, number>>((m, x) => { const k = f(x); m[k] = (m[k] ?? 0) + 1; return m; }, {});
const pct = (counts: Record<string, number>): Dist => {
  const t = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count, share: Math.round((count / t) * 1000) / 10 }));
};
/** 95% margin of error for a proportion, in percentage points (worst case p = 0.5 when n is small is not assumed). */
export const moe95 = (p: number, n: number) => (n > 0 ? Math.round(1.96 * Math.sqrt((p * (1 - p)) / n) * 1000) / 10 : 0);

const STANCES = ["favor", "contra", "ambigua"] as const;

function stanceOf(ls: Label[]) {
  const withStance = ls.filter((l) => l.stance);
  const applies = withStance.filter((l) => l.stance !== "no_aplica");
  const n = applies.length;
  const t = tally(applies, (l) => l.stance!);
  return {
    total: withStance.length,
    no_aplica: withStance.length ? Math.round(((withStance.length - n) / withStance.length) * 1000) / 10 : 0,
    n_base: n,
    ...Object.fromEntries(STANCES.map((k) => { const p = n ? (t[k] ?? 0) / n : 0; return [k, { share: Math.round(p * 1000) / 10, count: t[k] ?? 0, moe: moe95(p, n) }]; })) as Record<(typeof STANCES)[number], { share: number; count: number; moe: number }>,
  };
}

export function computeStance(labels: Label[], target: string): StanceResult | null {
  if (!labels.some((l) => l.stance)) return null;
  const platforms = [...new Set(labels.map((l) => l.platform))];
  return { target, ...stanceOf(labels), by_platform: platforms.map((platform) => ({ platform, ...stanceOf(labels.filter((l) => l.platform === platform)) })) };
}

/** Recomputes every label-based aggregate; reused when labels are re-read from comment_labels. */
export function computeAggregates(labels: Label[], stanceTarget: string | null) {
  const n = labels.length || 1;
  const sent = tally(labels, (l) => l.sentiment ?? "neu");
  const positive = Math.round(((sent["pos"] ?? 0) / n) * 100);
  const negative = Math.round(((sent["neg"] ?? 0) / n) * 100);
  const by_platform = [...new Set(labels.map((l) => l.platform))].map((platform) => {
    const ls = labels.filter((l) => l.platform === platform); const t = tally(ls, (l) => l.sentiment ?? "neu"); const k = ls.length || 1;
    return { platform, count: ls.length, positive: Math.round(((t["pos"] ?? 0) / k) * 100), neutral: Math.round(((t["neu"] ?? 0) / k) * 100), negative: Math.round(((t["neg"] ?? 0) / k) * 100) };
  });
  const persons = labels.filter((l) => l.account_type === "persona");
  const det = (k: "gender" | "age" | "country") => Math.round((persons.filter((l) => l[k] && l[k] !== "nd").length / (persons.length || 1)) * 100);
  return {
    sentiment: { positive, neutral: Math.max(0, 100 - positive - negative), negative },
    by_platform,
    demographics: {
      persons: persons.length,
      account_type: pct(tally(labels, (l) => l.account_type ?? "nd")),
      gender: pct(tally(persons, (l) => l.gender ?? "nd")),
      age: pct(tally(persons, (l) => l.age ?? "nd")),
      language: pct(tally(labels, (l) => (l.language ?? "nd").toLowerCase())).slice(0, 6),
      country: pct(tally(persons.filter((l) => l.country && l.country !== "nd"), (l) => l.country!.toUpperCase())).slice(0, 8),
      determinable: { gender: det("gender"), age: det("age"), country: det("country") },
    },
    stance: stanceTarget ? computeStance(labels, stanceTarget) : null,
  };
}
