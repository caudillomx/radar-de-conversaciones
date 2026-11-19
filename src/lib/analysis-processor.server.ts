import { supabaseAdmin as s } from "@/integrations/supabase/client.server";
import { ANALYSIS_STALLED_MESSAGE, ANALYSIS_STALL_MS, BATCH_MAX_ATTEMPTS, CLASSIFY_BATCH, CLASSIFY_CONCURRENCY, meetsCoverage, MIN_COVERAGE } from "./analysis-lifecycle";
import { computeAggregates, computeNarratives, type Label } from "./label-aggregates";

type C = { id: string; author: string | null; text: string; likes: number; is_reply: boolean; url: string | null; published_at: string | null; platform: string };
type Code = { id: string; title: string; description: string };
type Quote = { text: string; author: string | null; likes: number; platform: string; url: string | null; is_reply: boolean };

const BUDGET_MS = 50_000; // each invocation finishes well under 60 s
const LEASE_MS = 3 * 60_000; // longer than one model call so invocations never overlap
const SYNTH_TOP = 250, SYNTH_MAX = 400;

const chk = (r: { error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); };
const tally = <T,>(xs: T[], f: (x: T) => string) => xs.reduce<Record<string, number>>((m, x) => { const k = f(x); m[k] = (m[k] ?? 0) + 1; return m; }, {});
export const line = (c: C, i: number) => `[${i}] (${c.platform}${c.is_reply ? ", respuesta" : ""}, ${c.likes} likes, autor: ${c.author ?? "?"}) ${c.text.replace(/\s+/g, " ").slice(0, 350)}`;
const quote = (c: C): Quote => ({ text: c.text, author: c.author, likes: c.likes, platform: c.platform, url: c.url, is_reply: c.is_reply });

/** Stratified by platform: high-impact comments plus a random spread. */
export function stratified<T extends { platform: string; likes: number }>(rows: T[], n: number) {
  if (rows.length <= n) return rows;
  const by = new Map<string, T[]>();
  rows.forEach((r) => by.set(r.platform, [...(by.get(r.platform) ?? []), r]));
  const out: T[] = [];
  for (const group of by.values()) {
    const quota = Math.max(1, Math.round((group.length / rows.length) * n));
    const sorted = [...group].sort((a, b) => b.likes - a.likes);
    const top = sorted.slice(0, Math.ceil(quota * 0.3));
    const rest = sorted.slice(top.length).sort(() => Math.random() - 0.5).slice(0, quota - top.length);
    out.push(...top, ...rest);
  }
  return out.slice(0, n);
}

async function loadComments(ids: string[]) {
  const out = new Map<string, C>();
  for (let i = 0; i < ids.length; i += 200) {
    const r = await s.from("comments").select("id, author, text, likes, is_reply, url, published_at, sources!inner(platform)").in("id", ids.slice(i, i + 200));
    if (r.error) throw new Error(r.error.message);
    r.data.forEach(({ sources, ...c }) => out.set(c.id, { ...c, platform: sources.platform }));
  }
  return ids.flatMap((id) => (out.has(id) ? [out.get(id)!] : []));
}
async function labeledIds(analysisId: string) {
  const ids = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const r = await s.from("comment_labels").select("comment_id").eq("analysis_id", analysisId).range(from, from + 999);
    if (r.error) throw new Error(r.error.message);
    r.data.forEach((x) => ids.add(x.comment_id));
    if (r.data.length < 1000) return ids;
  }
}

type A = { id: string; study_id: string; stage: string; sample: unknown; codebook: unknown; synthesis: unknown; batch_attempts: unknown; batches_total: number; created_at: string };
const touch = (id: string, patch: Record<string, unknown>) => s.from("analyses").update({ ...patch, progress_at: new Date().toISOString() } as never).eq("id", id).eq("status", "procesando");
const fail = (id: string, msg: string) => s.from("analyses").update({ status: "error", error: msg, finished_at: new Date().toISOString(), locked_until: null }).eq("id", id).eq("status", "procesando");

/** Advances every processing analysis (or just one) by one stage / one block of batches. Safe to call concurrently. */
export async function processAnalyses(onlyId?: string) {
  const started = Date.now();
  chk(await s.from("analyses").update({ status: "error", error: ANALYSIS_STALLED_MESSAGE, finished_at: new Date().toISOString() }).eq("status", "procesando").lt("progress_at", new Date(Date.now() - ANALYSIS_STALL_MS).toISOString()));
  let q = s.from("analyses").select("id").eq("status", "procesando").order("created_at");
  if (onlyId) q = q.eq("id", onlyId);
  const list = await q;
  if (list.error) throw new Error(list.error.message);
  const advanced: string[] = [];
  for (const { id } of list.data) {
    if (Date.now() - started > BUDGET_MS / 2) break;
    const now = new Date().toISOString();
    const lease = await s.from("analyses").update({ locked_until: new Date(Date.now() + LEASE_MS).toISOString() }).eq("id", id).eq("status", "procesando").or(`locked_until.is.null,locked_until.lt.${now}`).select("id, study_id, stage, sample, codebook, synthesis, batch_attempts, batches_total, created_at").maybeSingle();
    if (lease.error) throw new Error(lease.error.message);
    if (!lease.data) continue; // another invocation holds it
    try {
      await step(lease.data as A, started);
      advanced.push(id);
    } catch (e) {
      console.error("processAnalyses", id, e);
      const st = (e as { statusCode?: number }).statusCode;
      if (st === 402 || st === 403) await fail(id, e instanceof Error ? e.message : "Error del motor de análisis");
    } finally {
      await s.from("analyses").update({ locked_until: null }).eq("id", id);
    }
  }
  return { advanced };
}

async function step(a: A, started: number) {
  const { runSynthesis, classifyBatch } = await import("./ai/analysis.server");
  const sample = (a.sample as string[] | null) ?? [];
  const study = (await s.from("studies").select("title, topic, stance_target, sources(platform, url, max_comments, comment_count, finished_at)").eq("id", a.study_id).single());
  if (study.error) throw new Error(study.error.message);
  const stanceTarget = study.data.stance_target?.trim() || null;

  if (a.stage === "muestreo") {
    chk(await touch(a.id, { stage: "sintesis", batches_total: Math.ceil(sample.length / CLASSIFY_BATCH) }));
    return;
  }

  if (a.stage === "sintesis") {
    const comments = await loadComments(sample);
    const top = [...comments].sort((x, y) => y.likes - x.likes).slice(0, SYNTH_TOP);
    const set = new Set(top);
    const synth = [...top, ...comments.filter((c) => !set.has(c)).slice(0, SYNTH_MAX - top.length)];
    const out = await runSynthesis({ studyTitle: study.data.title, topic: study.data.topic, comments: synth.map(line).join("\n") });
    const q = (i: number | null) => (i != null && synth[i] ? quote(synth[i]!) : null);
    const codebook: Code[] = out.narratives.map((n, i) => ({ id: `n${i + 1}`, title: n.title, description: n.description }));
    const synthesis = {
      ...out,
      synthesized: synth.length,
      narratives: out.narratives.map((n, i) => ({ id: `n${i + 1}`, title: n.title, description: n.description, traction: n.traction, sentiment: n.sentiment, examples: n.example_ids.map(q).filter(Boolean) })),
      archetypes: out.archetypes.map((x) => ({ ...x, example: q(x.example_id) })),
      verbatims: out.verbatims.flatMap((v) => { const c = q(v.id); return c ? [{ ...c, why: v.why }] : []; }).sort((x, y) => y.likes - x.likes),
    };
    chk(await touch(a.id, { stage: "clasificacion", codebook, synthesis }));
    if (!study.data.topic && out.topic_label) await s.from("studies").update({ topic: out.topic_label.slice(0, 200) }).eq("id", a.study_id);
    return;
  }

  if (a.stage === "clasificacion") {
    const codebook = (a.codebook as Code[] | null) ?? [];
    const attempts = { ...((a.batch_attempts as Record<string, number> | null) ?? {}) };
    const done = await labeledIds(a.id);
    const batches = Array.from({ length: Math.ceil(sample.length / CLASSIFY_BATCH) }, (_, b) => sample.slice(b * CLASSIFY_BATCH, (b + 1) * CLASSIFY_BATCH));
    const finished = (b: number) => batches[b]!.every((id) => done.has(id)) || (attempts[b] ?? 0) >= BATCH_MAX_ATTEMPTS;
    while (Date.now() - started < BUDGET_MS / 2) {
      const pending = batches.map((_, b) => b).filter((b) => !finished(b)).slice(0, CLASSIFY_CONCURRENCY);
      if (!pending.length) break;
      await Promise.all(pending.map(async (b) => {
        const todo = await loadComments(batches[b]!.filter((id) => !done.has(id)));
        try {
          const labels = await classifyBatch(todo.map(line).join("\n"), stanceTarget, codebook);
          const rows = labels.flatMap((l) => { const c = todo[l.i]; return c ? [{ analysis_id: a.id, comment_id: c.id, sentiment: l.s, stance: stanceTarget ? l.st ?? null : null, narrative: codebook.length ? l.n ?? "otra" : null, account_type: l.t, language: l.l.toLowerCase(), gender: l.g, age: l.a, country: l.p }] : []; });
          for (let i = 0; i < rows.length; i += 500) chk(await s.from("comment_labels").upsert(rows.slice(i, i + 500), { onConflict: "analysis_id,comment_id", ignoreDuplicates: true }));
          rows.forEach((r) => done.add(r.comment_id));
          // A batch where the engine skipped comments counts as an attempt, so it cannot loop forever.
          if (!batches[b]!.every((id) => done.has(id))) attempts[b] = (attempts[b] ?? 0) + 1;
        } catch (e) {
          const st = (e as { statusCode?: number }).statusCode;
          if (st === 402 || st === 403) throw e;
          console.error("classify batch", b, e);
          attempts[b] = (attempts[b] ?? 0) + 1;
        }
      }));
      const doneCount = batches.filter((_, b) => finished(b)).length;
      chk(await touch(a.id, { batches_done: doneCount, batch_attempts: attempts }));
    }
    if (batches.every((_, b) => finished(b))) chk(await touch(a.id, { stage: "agregado" }));
    return;
  }

  if (a.stage === "agregado") {
    const labels: (Label & { comment_id: string })[] = [];
    for (let from = 0; ; from += 1000) {
      const r = await s.from("comment_labels").select("comment_id, sentiment, stance, narrative, account_type, language, gender, age, country, comments!inner(sources!inner(platform))").eq("analysis_id", a.id).range(from, from + 999);
      if (r.error) throw new Error(r.error.message);
      labels.push(...r.data.map(({ comments, ...l }) => ({ ...l, platform: comments.sources.platform })));
      if (r.data.length < 1000) break;
    }
    if (!meetsCoverage(labels.length, sample.length)) {
      await fail(a.id, `Solo se pudo clasificar ${labels.length.toLocaleString("es-MX")} de ${sample.length.toLocaleString("es-MX")} comentarios (mínimo ${MIN_COVERAGE * 100}%). Reintenta el análisis.`);
      return;
    }
    const all: { likes: number; is_reply: boolean; published_at: string | null }[] = [];
    for (let from = 0; ; from += 1000) {
      const r = await s.from("comments").select("likes, is_reply, published_at, sources!inner(study_id)").eq("sources.study_id", a.study_id).range(from, from + 999);
      if (r.error) throw new Error(r.error.message);
      all.push(...r.data);
      if (r.data.length < 1000) break;
    }
    const codebook = (a.codebook as Code[] | null) ?? [];
    const syn = a.synthesis as { synthesized: number; limitations: string[]; narratives: { id: string; title: string; description: string; traction: string; sentiment: string; examples: Quote[] }[] } & Record<string, unknown>;
    const agg = computeAggregates(labels, stanceTarget);
    const shares = computeNarratives(labels, codebook);
    const other = shares.find((x) => x.id === "otra")!;
    const narratives = [
      ...syn.narratives.map((n) => { const sh = shares.find((x) => x.id === n.id)!; return { ...n, share: sh.share, count: sh.count, moe: sh.moe }; }).sort((x, y) => y.share - x.share),
      { id: "otra", residual: true, title: "Otra", description: "Comentarios que no encajan en ninguna de las narrativas definidas.", traction: "baja", sentiment: "neutro", examples: [], share: other.share, count: other.count, moe: other.moe },
    ];
    const days = tally(all.filter((c) => c.published_at), (c) => c.published_at!.slice(0, 10));
    const likes = all.map((c) => c.likes).sort((x, y) => y - x);
    const likesTotal = likes.reduce((x, y) => x + y, 0) || 1;
    const top10 = likes.slice(0, Math.max(1, Math.ceil(all.length * 0.1))).reduce((x, y) => x + y, 0);
    const dates = all.flatMap((c) => (c.published_at ? [c.published_at] : [])).sort();
    const result = {
      ...syn,
      narratives,
      sentiment: agg.sentiment,
      stance: agg.stance,
      demographics: agg.demographics,
      total_comments: all.length,
      analyzed_comments: syn.synthesized,
      classified_comments: labels.length,
      stats: {
        timeline: Object.entries(days).sort().map(([day, count]) => ({ day, count })),
        by_platform: agg.by_platform,
        likes_top10_share: Math.round((top10 / likesTotal) * 100),
        reply_share: all.length ? Math.round((all.filter((c) => c.is_reply).length / all.length) * 100) : 0,
      },
      methodology: {
        generated_at: new Date().toISOString(),
        sources: study.data.sources.map((x) => ({ platform: x.platform, url: x.url, target: x.max_comments, collected: x.comment_count, finished_at: x.finished_at })),
        period: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
        collected: all.length, classified: labels.length, classify_requested: sample.length, synthesized: syn.synthesized,
        sampling: all.length > sample.length
          ? `Muestra estratificada por plataforma de ${sample.length.toLocaleString("es-MX")} de ${all.length.toLocaleString("es-MX")} comentarios (30% de mayor interacción + 70% aleatorio en cada red).`
          : `Censo: se clasificaron todos los comentarios recolectados (${all.length.toLocaleString("es-MX")}).`,
        limitations: syn.limitations,
      },
    };
    chk(await s.from("analyses").update({ status: "completado", stage: "completado", result: result as never, finished_at: new Date().toISOString(), progress_at: new Date().toISOString() }).eq("id", a.id).eq("status", "procesando"));
  }
}
