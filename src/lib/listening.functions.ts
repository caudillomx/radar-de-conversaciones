import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ANALYSIS_TIMEOUT_MS, ANALYSIS_EXPIRED_MESSAGE, isAnalysisExpired } from "./analysis-lifecycle";

const platform = z.enum(["instagram", "tiktok", "youtube", "facebook", "x"]);
const chk = (r: { error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); };
const db = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;
const must = <T,>(r: { data: T; error: { message: string } | null }): NonNullable<T> => {
  if (r.error) throw new Error(r.error.message);
  if (r.data == null) throw new Error("No encontrado");
  return r.data as NonNullable<T>;
};

export const listStudies = createServerFn({ method: "GET" }).handler(async () => {
  const s = await db();
  return must(await s.from("studies").select("*, sources(id, platform, status, comment_count)").order("created_at", { ascending: false }));
});

export const getStudy = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const s = await db();
    const r = await s.from("studies").select("*, sources(*)").eq("id", data.id).order("created_at", { referencedTable: "sources" }).maybeSingle();
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });

export const createStudy = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ title: z.string().min(1).max(200), topic: z.string().max(200), client: z.string().max(200).nullable(), kind: z.enum(["quick", "deep"]) }).parse(d))
  .handler(async ({ data }) => {
    const s = await db();
    return must(await s.from("studies").insert(data).select("id").single());
  });

export const deleteStudy = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => { chk(await (await db()).from("studies").delete().eq("id", data.id)); return { ok: true }; });

const srcItem = z.object({ url: z.string().url(), platform, postId: z.string().nullable() });

export const addSources = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ studyId: z.string().uuid(), items: z.array(srcItem).max(100), ready: z.boolean().optional(), maxComments: z.number().int().optional() }).parse(d))
  .handler(async ({ data }) => {
    const s = await db();
    const rows = data.items.map((i) => ({ study_id: data.studyId, url: i.url, platform: i.platform, post_id: i.postId, status: data.ready ? "lista" : "pendiente", max_comments: data.maxComments ?? 500 }));
    chk(await s.from("sources").upsert(rows, { onConflict: "study_id,url", ignoreDuplicates: true }));
    await s.from("studies").update({ updated_at: new Date().toISOString() }).eq("id", data.studyId);
    return { ok: true };
  });

export const createQuickPulse = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ items: z.array(srcItem).min(1).max(2) }).parse(d))
  .handler(async ({ data }) => {
    const s = await db();
    const title = `Pulso · ${new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
    const st = must(await s.from("studies").insert({ kind: "quick", title, topic: "" }).select("id").single());
    chk(await s.from("sources").insert(data.items.map((i) => ({ study_id: st.id, url: i.url, platform: i.platform, post_id: i.postId, status: "lista", max_comments: 250 }))));
    return st;
  });

export const updateSource = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), patch: z.object({ status: z.enum(["pendiente", "lista"]).optional(), max_comments: z.number().int().min(10).max(10000).optional(), include_replies: z.boolean().optional() }) }).parse(d))
  .handler(async ({ data }) => { chk(await (await db()).from("sources").update(Object.fromEntries(Object.entries(data.patch).filter(([, v]) => v !== undefined)) as { status?: string; max_comments?: number; include_replies?: boolean }).eq("id", data.id)); return { ok: true }; });

export const removeSource = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => { chk(await (await db()).from("sources").delete().eq("id", data.id)); return { ok: true }; });

/* ---------- Extraction ---------- */

export const startExtraction = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ sourceIds: z.array(z.string().uuid()).min(1).max(50) }).parse(d))
  .handler(async ({ data }) => {
    const { buildInput, startRun } = await import("./apify.server");
    const s = await db();
    const sources = must(await s.from("sources").select("*").in("id", data.sourceIds));
    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const src of sources) {
      if (src.status === "iniciando" || src.status === "extrayendo") { results.push({ id: src.id, ok: true }); continue; }
      try {
        if (src.platform === "x" && !src.post_id) throw new Error("No se pudo leer el ID del post de X");
        await s.from("sources").update({ status: "iniciando", error: null, started_at: new Date().toISOString(), finished_at: null }).eq("id", src.id);
        const run = await startRun(src.platform as never, buildInput(src.platform as never, src.url, src.post_id, src.max_comments, src.include_replies), src.max_comments);
        await s.from("sources").update({ status: "extrayendo", apify_run_id: run.id, apify_dataset_id: run.defaultDatasetId }).eq("id", src.id);
        results.push({ id: src.id, ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error desconocido";
        await s.from("sources").update({ status: "error", error: msg }).eq("id", src.id);
        results.push({ id: src.id, ok: false, error: msg });
      }
    }
    return results;
  });

/** Ingests available dataset snapshots while running, then finalizes on success. */
export const syncExtraction = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ sourceId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { getRun, getItems, normalize } = await import("./apify.server");
    const s = await db();
    const src = must(await s.from("sources").select("*").eq("id", data.sourceId).single());
    if (!src.apify_run_id || (src.status !== "extrayendo" && src.status !== "iniciando")) return { status: src.status, apifyStatus: null };
    const run = await getRun(src.apify_run_id);
    const active = ["READY", "RUNNING", "TIMING-OUT", "ABORTING"].includes(run.status);
    if (!active && run.status !== "SUCCEEDED") {
      const err = `La extracción terminó con estado ${run.status}${run.statusMessage ? `: ${run.statusMessage}` : ""}`;
      await s.from("sources").update({ status: "error", error: err, finished_at: new Date().toISOString() }).eq("id", src.id);
      return { status: "error", apifyStatus: run.status };
    }
    const items = await getItems(run.defaultDatasetId, Math.min(src.max_comments * 3, 10000));
    const seen = new Set<string>();
    const rows = items.flatMap((it, i) => {
      const n = normalize(src.platform as never, it, src.post_id);
      if (!n || (!src.include_replies && n.is_reply)) return [];
      const ext = n.external_id ?? `idx-${i}`;
      if (seen.has(ext)) return [];
      seen.add(ext);
      return [{ ...n, external_id: ext, source_id: src.id, raw: it as never }];
    });
    // Existing IDs make repeated partial snapshots idempotent without rewriting
    // thousands of already stored comments on every poll.
    const existing = must(await s.from("comments").select("external_id").eq("source_id", src.id).limit(30000));
    const stored = new Set(existing.map((comment) => comment.external_id));
    const fresh = rows.filter((comment) => !stored.has(comment.external_id));
    for (let i = 0; i < fresh.length; i += 500) {
      chk(await s.from("comments").upsert(fresh.slice(i, i + 500), { onConflict: "source_id,external_id", ignoreDuplicates: true }));
    }
    const countResult = await s.from("comments").select("id", { count: "exact", head: true }).eq("source_id", src.id);
    chk(countResult);
    const count = countResult.count ?? rows.length;
    if (active) {
      chk(await s.from("sources").update({ comment_count: count }).eq("id", src.id).eq("apify_run_id", run.id));
      return { status: "extrayendo", apifyStatus: run.status, ingested: fresh.length, collected: count, message: run.statusMessage ?? null };
    }
    const fin = rows.length === 0 && items.length > 0 ? { status: "error", error: "Apify devolvió datos, pero ninguno parece un comentario" } : { status: "extraida", error: null };
    chk(await s.from("sources").update({ ...fin, comment_count: count, finished_at: new Date().toISOString() }).eq("id", src.id).eq("apify_run_id", run.id));
    return { status: fin.status, apifyStatus: run.status, ingested: rows.length };
  });

export const listComments = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ studyId: z.string().uuid(), sourceId: z.string().uuid().nullable(), limit: z.number().int().max(500).default(100) }).parse(d))
  .handler(async ({ data }) => {
    const s = await db();
    let q = s.from("comments").select("id, source_id, author, text, published_at, likes, url, is_reply, sources!inner(study_id, platform)", { count: "exact" })
      .eq("sources.study_id", data.studyId).order("likes", { ascending: false }).limit(data.limit);
    if (data.sourceId) q = q.eq("source_id", data.sourceId);
    const r = await q;
    if (r.error) throw new Error(r.error.message);
    return { rows: r.data, total: r.count ?? 0 };
  });

/* ---------- AI analysis ---------- */

const MAX_FOR_AI = 400;

export const getLatestAnalysis = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ studyId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const s = await db();
    const r = await s.from("analyses").select("*").eq("study_id", data.studyId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (r.error) throw new Error(r.error.message);
    if (r.data?.status === "procesando" && isAnalysisExpired(r.data.created_at)) {
      const expired = await s.from("analyses").update({ status: "error", error: ANALYSIS_EXPIRED_MESSAGE, finished_at: new Date().toISOString() }).eq("id", r.data.id).eq("status", "procesando").select("*").maybeSingle();
      if (expired.error) throw new Error(expired.error.message);
      if (expired.data) return expired.data;
      return must(await s.from("analyses").select("*").eq("id", r.data.id).single());
    }
    return r.data;
  });

export const analyzeStudy = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ studyId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { runAnalysis, ANALYSIS_MODEL } = await import("./ai/analysis.server");
    const s = await db();
    const study = must(await s.from("studies").select("title, topic").eq("id", data.studyId).single());
    chk(await s.from("analyses").update({ status: "error", error: ANALYSIS_EXPIRED_MESSAGE, finished_at: new Date().toISOString() }).eq("study_id", data.studyId).eq("status", "procesando").lte("created_at", new Date(Date.now() - ANALYSIS_TIMEOUT_MS).toISOString()));
    const busy = await s.from("analyses").select("id").eq("study_id", data.studyId).eq("status", "procesando").limit(1);
    if (busy.error) throw new Error(busy.error.message);
    if (busy.data?.length) throw new Error("Ya hay un análisis en curso para este estudio.");
    const cr = await s.from("comments").select("author, text, likes, is_reply, url, published_at, sources!inner(study_id, platform)")
      .eq("sources.study_id", data.studyId).order("likes", { ascending: false }).limit(MAX_FOR_AI);
    if (cr.error) throw new Error(cr.error.message);
    const comments = cr.data;
    if (comments.length < 5) throw new Error("Se necesitan al menos 5 comentarios extraídos para analizar.");
    const total = (await s.from("comments").select("id, sources!inner(study_id)", { count: "exact", head: true }).eq("sources.study_id", data.studyId)).count ?? comments.length;

    const row = must(await s.from("analyses").insert({ study_id: data.studyId, model: ANALYSIS_MODEL, comment_count: comments.length }).select("id, created_at").single());
    // Expire the stored attempt, without aborting billed upstream generation.
    const expiryTimer = setTimeout(() => {
      void s.from("analyses").update({ status: "error", error: ANALYSIS_EXPIRED_MESSAGE, finished_at: new Date().toISOString() }).eq("id", row.id).eq("status", "procesando").then(() => {}, () => {});
    }, Math.max(0, ANALYSIS_TIMEOUT_MS - (Date.now() - Date.parse(row.created_at))));
    try {
      const lines = comments.map((c, i) => `[${i}] (${c.sources.platform}${c.is_reply ? ", respuesta" : ""}, ${c.likes} likes) ${c.text.replace(/\s+/g, " ").slice(0, 400)}`).join("\n");
      const out = await runAnalysis({ studyTitle: study.title, topic: study.topic, comments: lines });
      if (isAnalysisExpired(row.created_at)) throw new Error(ANALYSIS_EXPIRED_MESSAGE);
      const quote = (i: number | null) => {
        const c = i != null ? comments[i] : undefined;
        return c ? { text: c.text, author: c.author, likes: c.likes, platform: c.sources.platform, url: c.url, is_reply: c.is_reply } : null;
      };
      const result = {
        ...out,
        total_comments: total,
        analyzed_comments: comments.length,
        narratives: out.narratives.map((n) => ({ ...n, examples: n.example_ids.map(quote).filter(Boolean) })),
        archetypes: out.archetypes.map((a) => ({ ...a, example: quote(a.example_id) })),
        verbatims: out.verbatims.flatMap((v) => { const q = quote(v.id); return q ? [{ ...q, why: v.why }] : []; }).sort((a, b) => b.likes - a.likes),
      };
      const saved = await s.from("analyses").update({ status: "completado", result: result as never, finished_at: new Date().toISOString() }).eq("id", row.id).eq("status", "procesando").select("id").maybeSingle();
      chk(saved);
      if (!saved.data) throw new Error(ANALYSIS_EXPIRED_MESSAGE);
      return { id: row.id };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      console.error("analyzeStudy", e);
      await s.from("analyses").update({ status: "error", error: msg, finished_at: new Date().toISOString() }).eq("id", row.id).eq("status", "procesando");
      throw new Error(msg);
    } finally {
      clearTimeout(expiryTimer);
    }
  });
