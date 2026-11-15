import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

/** Checks run status in Apify; on success, ingests the dataset into comments. */
export const syncExtraction = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ sourceId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { getRun, getItems, normalize } = await import("./apify.server");
    const s = await db();
    const src = must(await s.from("sources").select("*").eq("id", data.sourceId).single());
    if (!src.apify_run_id || (src.status !== "extrayendo" && src.status !== "iniciando")) return { status: src.status, apifyStatus: null };
    const run = await getRun(src.apify_run_id);
    if (run.status === "READY" || run.status === "RUNNING") return { status: "extrayendo", apifyStatus: run.status, message: run.statusMessage ?? null };
    if (run.status !== "SUCCEEDED") {
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
    for (let i = 0; i < rows.length; i += 500) {
      chk(await s.from("comments").upsert(rows.slice(i, i + 500), { onConflict: "source_id,external_id" }));
    }
    const { count } = await s.from("comments").select("id", { count: "exact", head: true }).eq("source_id", src.id);
    const fin = rows.length === 0 && items.length > 0 ? { status: "error", error: "Apify devolvió datos, pero ninguno parece un comentario" } : { status: "extraida", error: null };
    await s.from("sources").update({ ...fin, comment_count: count ?? rows.length, finished_at: new Date().toISOString() }).eq("id", src.id);
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
