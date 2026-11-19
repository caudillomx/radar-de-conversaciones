import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Masthead } from "@/components/kimedia/Masthead";
import { PlatformMark } from "@/components/kimedia/PlatformMark";
import { AnalysisPanel } from "@/components/kimedia/AnalysisPanel";
import { PLATFORMS, parseSocialUrl, splitUrls, type Platform } from "@/lib/platforms";
import { COMMENTS_PAGE, commentsQuery, fn, studyQuery, useListeningMutation, type SourceRow } from "@/lib/listening";
import { extractionProgress } from "@/lib/extraction-progress";

export const Route = createFileRoute("/estudios/$studyId")({
  head: () => ({
    meta: [
      { title: "Estudio — KiMedia Listening Lab" },
      { name: "description", content: "Ingesta de URLs, extracción de comentarios y lectura de la conversación." },
      { property: "og:title", content: "Estudio — KiMedia Listening Lab" },
      { property: "og:description", content: "Ingesta de URLs, extracción de comentarios y lectura de la conversación." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudyPage,
});

const STATUS: Record<string, { label: string; cls: string }> = {
  pendiente: { label: "Pendiente", cls: "text-muted-foreground" },
  lista: { label: "Lista", cls: "text-success" },
  iniciando: { label: "Iniciando", cls: "text-accent" },
  extrayendo: { label: "Extrayendo", cls: "text-accent" },
  extraida: { label: "Completado", cls: "text-success" },
  error: { label: "Error", cls: "text-destructive" },
};
const RUNNING = new Set(["iniciando", "extrayendo"]);

function StudyPage() {
  const { studyId } = Route.useParams();
  const qc = useQueryClient();
  const { data: study, isLoading, error } = useQuery({
    ...studyQuery(studyId),
    refetchInterval: (q) => (q.state.data?.sources.some((s) => RUNNING.has(s.status)) ? 5000 : false),
  });
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<Platform | "all">("all");
  const add = useListeningMutation(fn.addSources, studyId);
  const start = useListeningMutation(fn.startExtraction, studyId);
  const markReady = useListeningMutation(fn.updateSource, studyId);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Poll extraction for every running source.
  const sync = useServerFn(fn.syncExtraction);
  const running = study?.sources.filter((s) => RUNNING.has(s.status)).map((s) => s.id).join(",") ?? "";
  useEffect(() => {
    if (!running) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const tick = async () => {
      const results = await Promise.allSettled(running.split(",").map((id) => sync({ data: { sourceId: id } })));
      if (stop) return;
      const failed = results.find((result) => result.status === "rejected");
      failures = failed ? failures + 1 : 0;
      const message = failed?.status === "rejected" ? String(failed.reason?.message ?? "No se pudo actualizar la extracción.") : null;
      setSyncError(message);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["study", studyId] }),
        qc.invalidateQueries({ queryKey: ["comments", studyId] }),
      ]);
      // Do not overlap polls, and stop permanent failures instead of retrying forever.
      const permanent = message && /\[(400|401|402|403|404)\]/.test(message);
      if (!stop && !permanent && failures < 3) timer = setTimeout(tick, 6000 * 2 ** failures);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [running, studyId, sync, qc]);

  const parsed = useMemo(() => splitUrls(text).map(parseSocialUrl), [text]);
  const existing = new Set(study?.sources.map((s) => s.url));
  const newValid = parsed.flatMap((p) => (p.ok && !existing.has(p.url) ? [p] : []));

  if (isLoading) return <Shell><p className="py-24 text-center font-mono text-sm text-muted-foreground">Cargando…</p></Shell>;
  if (error || !study) return (
    <Shell><div className="py-24 text-center">
      <p className="font-display text-4xl italic">{error ? "No se pudo cargar." : "Estudio no encontrado."}</p>
      <Link to="/" className="mt-4 inline-block underline">Volver</Link>
    </div></Shell>
  );

  const quick = study.kind === "quick";
  const quickFull = quick && study.sources.length >= 2;
  const sources = study.sources.filter((s) => filter === "all" || s.platform === filter);
  const counts = (Object.keys(PLATFORMS) as Platform[]).map((p) => [p, study.sources.filter((s) => s.platform === p).length] as const);
  const ready = study.sources.filter((s) => s.status === "lista" || s.status === "error");
  const runningCount = study.sources.filter((s) => RUNNING.has(s.status)).length;
  const { collected: totalComments, target, percent: progress } = extractionProgress(study.sources);

  function commit() {
    const items = (quick ? newValid.slice(0, Math.max(0, 2 - study!.sources.length)) : newValid).map((p) => p.ok ? { url: p.url, platform: p.platform, postId: p.postId } : null!);
    add.mutate({ studyId, items, ready: quick, maxComments: quick ? 1000 : 2500 }, { onSuccess: () => setText("") });
  }

  return (
    <Shell mode={quick ? "quick" : "deep"}>
      {quick ? <Link to="/" className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-accent">← Escucha Rápida</Link>
        : <Link to="/estudios" className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-accent">← Estudios Profundos</Link>}
      <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-accent">{quick ? "⚡ Quick Pulse · Lectura exprés" : "Deep Dive"}</p>
      <h1 className="mt-3 font-display text-5xl md:text-7xl">{study.title}</h1>
      <p className="mt-2 text-muted-foreground">{[study.topic, study.client].filter(Boolean).join(" · ")}</p>
      <StanceField key={study.stance_target ?? ""} studyId={studyId} value={study.stance_target ?? ""} />

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0">
          {quick && <div className="mb-10"><AnalysisPanel studyId={studyId} commentCount={totalComments} quick /></div>}

          {!quickFull && (
            <section className="border border-foreground bg-card p-6">
              <h2 className="font-mono text-xs uppercase tracking-[0.2em]">01 — Ingesta de URLs</h2>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={quick ? 2 : 5}
                placeholder={"Pega una o varias URLs (una por línea)\nhttps://www.instagram.com/reel/…"}
                className="mt-4 w-full resize-y border border-border bg-background p-3 font-mono text-sm outline-none focus:border-accent" />
              {parsed.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {parsed.map((p, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      {p.ok ? <PlatformMark platform={p.platform} /> : <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-destructive font-mono text-xs text-destructive">!</span>}
                      <span className="min-w-0 flex-1 truncate font-mono">{p.ok ? p.url : p.input}</span>
                      <span className={p.ok ? (existing.has(p.url) ? "text-muted-foreground" : "text-success") : "text-destructive"}>
                        {p.ok ? (existing.has(p.url) ? "Duplicada" : `${PLATFORMS[p.platform].label} ✓`) : p.reason}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex items-center justify-between gap-4">
                <span className="font-mono text-xs text-muted-foreground">{add.error ? <span className="text-destructive">{add.error.message}</span> : `${newValid.length} nuevas válidas`}</span>
                <button onClick={commit} disabled={!newValid.length || add.isPending} className="bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-accent disabled:opacity-40">{add.isPending ? "Agregando…" : `Agregar al ${quick ? "pulso" : "estudio"}`}</button>
              </div>
            </section>
          )}

          <section className="mt-10">
            <div className="flex flex-wrap items-center gap-2 border-b border-foreground pb-3">
              <h2 className="mr-auto font-display text-3xl">Fuentes</h2>
              <Chip active={filter === "all"} onClick={() => setFilter("all")}>Todas {study.sources.length}</Chip>
              {counts.filter(([, n]) => n).map(([p, n]) => <Chip key={p} active={filter === p} onClick={() => setFilter(p)}>{PLATFORMS[p].label} {n}</Chip>)}
            </div>
            {sources.length === 0 ? (
              <p className="py-12 text-center font-display text-2xl italic text-muted-foreground">Sin fuentes todavía.</p>
            ) : (
              <ul className="grid gap-4 pt-6 md:grid-cols-2">
                {sources.map((s) => <SourceCard key={s.id} s={s} studyId={studyId} />)}
              </ul>
            )}
          </section>

          {!quick && <div className="mt-12"><AnalysisPanel studyId={studyId} commentCount={totalComments} quick={false} /></div>}

          <CommentsPanel studyId={studyId} sources={study.sources} />
        </div>

        <aside className="h-fit border border-foreground p-6 lg:sticky lg:top-6">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em]">{quick ? "Extracción exprés" : "02 — Extracción"}</h2>
          <div role="status" aria-live="polite" aria-atomic="true" className="mt-4">
            <p className="font-display text-5xl tabular-nums">{totalComments.toLocaleString("es-MX")}</p>
            <p className="mt-1 text-sm text-muted-foreground">de {target.toLocaleString("es-MX")} comentarios · {runningCount ? "recolectados hasta ahora" : "recolectados"}</p>
          </div>

          <div className="mt-6">
            <div className="flex justify-between font-mono text-[11px] uppercase text-muted-foreground">
              <span>{runningCount ? `Extrayendo ${runningCount}…` : "Progreso"}</span><span>{progress}%</span>
            </div>
            <div role="progressbar" aria-label="Comentarios recolectados" aria-valuemin={0} aria-valuemax={target || 1} aria-valuenow={Math.min(totalComments, target)} className="mt-1 h-2 w-full bg-secondary">
              <div className={`h-full bg-accent transition-all ${runningCount ? "animate-pulse" : ""}`} style={{ width: `${progress}%` }} />
            </div>
          </div>

          <dl className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
            {(["lista", "iniciando", "extrayendo", "extraida", "error"] as const).map((k) => {
              const n = study.sources.filter((s) => s.status === k).length;
              return n ? <Row key={k} k={STATUS[k]!.label} v={String(n)} /> : null;
            })}
          </dl>

          {!quick && study.sources.some((s) => s.status === "pendiente") && (
            <button onClick={() => study.sources.forEach((s) => s.status === "pendiente" && markReady.mutate({ id: s.id, patch: { status: "lista" } }))}
              className="mt-6 w-full border border-foreground px-4 py-2.5 text-sm hover:bg-secondary">Marcar todas como listas</button>
          )}
          <button onClick={() => start.mutate({ sourceIds: ready.map((s) => s.id) })} disabled={!ready.length || start.isPending}
            className="mt-3 w-full bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-40">
            {start.isPending ? "Iniciando…" : runningCount ? "Extracción en curso…" : `Extraer comentarios${ready.length ? ` (${ready.length})` : ""}`}
          </button>
          {start.error && <p className="mt-2 text-xs text-destructive">{start.error.message}</p>}
          {syncError && <p className="mt-2 text-xs text-destructive">{syncError} Recarga la página para volver a consultar el progreso.</p>}
          <p className="mt-2 text-xs text-muted-foreground">Cada fuente usa un extractor especializado según su red. Las extracciones pueden tardar de 1 a 5 minutos.</p>
        </aside>
      </div>
    </Shell>
  );
}

function Shell({ children, mode }: { children: React.ReactNode; mode?: "quick" | "deep" | undefined }) {
  return <div className="min-h-screen"><Masthead mode={mode} /><main className="mx-auto max-w-7xl px-6 py-10">{children}</main></div>;
}

function SourceCard({ s, studyId }: { s: SourceRow; studyId: string }) {
  const update = useListeningMutation(fn.updateSource, studyId);
  const remove = useListeningMutation(fn.removeSource, studyId);
  const u = new URL(s.url);
  const platform = s.platform as Platform;
  const st = STATUS[s.status] ?? STATUS["pendiente"]!;
  const locked = RUNNING.has(s.status);
  return (
    <li className="flex flex-col border border-border bg-card">
      {platform === "youtube" && s.post_id ? (
        <img src={`https://i.ytimg.com/vi/${s.post_id}/hqdefault.jpg`} alt="" className="aspect-video w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex aspect-video items-center justify-center bg-secondary"><span className="font-display text-5xl italic">{PLATFORMS[platform].label}</span></div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <PlatformMark platform={platform} />
          <div className="min-w-0 flex-1">
            <a href={s.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium hover:text-accent">{u.hostname.replace("www.", "")}{u.pathname}</a>
            <p className="font-mono text-[11px] text-muted-foreground">ID {s.post_id ?? "—"}</p>
          </div>
          <span className={`font-mono text-[11px] uppercase ${st.cls} ${locked ? "animate-pulse" : ""}`}>{st.label}</span>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">{s.comment_count.toLocaleString("es-MX")} de {s.max_comments.toLocaleString("es-MX")} comentarios</p>
        {s.error && <p className="text-xs text-destructive">{s.error}</p>}
        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3 text-sm">
          <label className="flex items-center gap-2">Máx.
            <select disabled={locked} value={s.max_comments} onChange={(e) => update.mutate({ id: s.id, patch: { max_comments: +e.target.value } })} className="border border-border bg-background px-1 py-0.5">
              {[50, 100, 250, 500, 1000, 2500, 5000, 10000].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input disabled={locked} type="checkbox" checked={s.include_replies} onChange={(e) => update.mutate({ id: s.id, patch: { include_replies: e.target.checked } })} /> Respuestas
          </label>
          {!locked && (
            <div className="ml-auto flex gap-3 font-mono text-xs uppercase">
              {(s.status === "pendiente" || s.status === "lista") && (
                <button onClick={() => update.mutate({ id: s.id, patch: { status: s.status === "lista" ? "pendiente" : "lista" } })} className="hover:text-accent">{s.status === "lista" ? "Desmarcar" : "Lista"}</button>
              )}
              <button onClick={() => remove.mutate({ id: s.id })} className="text-muted-foreground hover:text-destructive">Quitar</button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function CommentsPanel({ studyId, sources }: { studyId: string; sources: SourceRow[] }) {
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ ...commentsQuery(studyId, sourceId, page), enabled: open });
  const total = sources.reduce((a, s) => a + s.comment_count, 0);
  if (!total) return null;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / COMMENTS_PAGE));
  const download = async () => {
    setExporting(true); setExportError(null);
    try {
      const rows = await fn.exportComments({ data: { studyId } });
      const esc = (v: unknown) => { const t = String(v ?? ""); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
      const head = ["Red", "Publicación", "Autor", "Comentario", "Fecha", "Likes", "Es respuesta", "ID comentario", "Enlace"];
      const lines = rows.map((r) => [PLATFORMS[r.sources.platform as Platform]?.label ?? r.sources.platform, r.sources.url, (r.author ?? "").replace(/^@+/, ""), r.text, r.published_at ? new Date(r.published_at).toISOString().slice(0, 19).replace("T", " ") : "", r.likes, r.is_reply ? "Sí" : "No", r.external_id, r.url].map(esc).join(","));
      const blob = new Blob(["\uFEFF" + [head.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `comentarios-${studyId.slice(0, 8)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) { setExportError(e instanceof Error ? e.message : "No se pudo descargar."); }
    finally { setExporting(false); }
  };
  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-center gap-3 border-b border-foreground pb-3">
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mr-auto flex items-center gap-3 text-left">
          <span className={`font-mono text-lg transition-transform ${open ? "rotate-45" : ""}`}>+</span>
          <h2 className="font-display text-3xl">Comentarios extraídos</h2>
          <span className="font-mono text-xs text-muted-foreground">{total.toLocaleString("es-MX")}</span>
        </button>
        <button onClick={download} disabled={exporting} className="border border-foreground px-3 py-1.5 font-mono text-xs hover:bg-secondary disabled:opacity-50">{exporting ? "Preparando…" : "Descargar CSV / Excel"}</button>
      </div>
      {exportError && <p className="pt-2 text-xs text-destructive">{exportError}</p>}
      {open && (
        <>
          <div className="flex flex-wrap items-center gap-3 pt-3">
            <p className="mr-auto font-mono text-xs text-muted-foreground">{data ? `${(page * COMMENTS_PAGE + 1).toLocaleString("es-MX")}–${Math.min((page + 1) * COMMENTS_PAGE, data.total).toLocaleString("es-MX")} de ${data.total.toLocaleString("es-MX")}, ordenados por likes` : ""}</p>
            <select value={sourceId ?? ""} onChange={(e) => { setSourceId(e.target.value || null); setPage(0); }} className="border border-border bg-background px-2 py-1 font-mono text-xs">
              <option value="">Todas las fuentes</option>
              {sources.filter((s) => s.comment_count).map((s) => <option key={s.id} value={s.id}>{PLATFORMS[s.platform as Platform].label} · {s.post_id}</option>)}
            </select>
          </div>
          {isLoading ? <p className="py-6 font-mono text-sm text-muted-foreground">Cargando…</p> : (
            <ul className="divide-y divide-border">
              {data?.rows.map((c) => (
                <li key={c.id} className={`flex gap-4 py-4 ${c.is_reply ? "pl-8" : ""}`}>
                  <PlatformMark platform={c.sources.platform as Platform} className="h-6 w-6 text-[9px]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm"><span className="font-medium">@{(c.author ?? "anónimo").replace(/^@+/, "")}</span>
                      {c.is_reply && <span className="ml-2 font-mono text-[10px] uppercase text-muted-foreground">respuesta</span>}
                      <span className="ml-2 font-mono text-[11px] text-muted-foreground">{c.published_at ? new Date(c.published_at).toLocaleDateString("es-MX") : ""}</span></p>
                    <p className="mt-1 whitespace-pre-line">{c.text}</p>
                  </div>
                  <div className="shrink-0 text-right font-mono text-xs">
                    <p>♥ {c.likes.toLocaleString("es-MX")}</p>
                    {c.url && <a href={c.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-accent">ver ↗</a>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between border-t border-border pt-3 font-mono text-xs">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="border border-border px-3 py-1.5 hover:border-foreground disabled:opacity-40">← Anterior</button>
            <span>Página {page + 1} de {pages}</span>
            <button onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} className="border border-border px-3 py-1.5 hover:border-foreground disabled:opacity-40">Siguiente →</button>
          </div>
        </>
      )}
    </section>
  );
}

function StanceField({ studyId, value }: { studyId: string; value: string }) {
  const save = useListeningMutation(fn.updateStudy, studyId);
  const [v, setV] = useState(value);
  const dirty = v.trim() !== value.trim();
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate({ id: studyId, stance_target: v.trim() || null }); }} className="mt-6 max-w-2xl">
      <label className="block">
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">¿Postura frente a qué?</span>
        <div className="mt-1 flex gap-2">
          <input value={v} onChange={(e) => setV(e.target.value)} maxLength={300} placeholder="la gestión de la gobernadora" className="min-w-0 flex-1 border-b border-foreground bg-transparent py-2 text-lg outline-none focus:border-accent" />
          {dirty && <button disabled={save.isPending} className="border border-foreground px-3 text-sm hover:bg-secondary disabled:opacity-50">{save.isPending ? "Guardando…" : "Guardar"}</button>}
        </div>
      </label>
      <p className="mt-1 text-xs text-muted-foreground">Define un objeto concreto: una persona, decisión o propuesta. Si lo dejas vacío, solo se mide sentimiento. Se aplica en el próximo análisis.</p>
      {save.error && <p className="mt-1 text-xs text-destructive">{save.error.message}</p>}
    </form>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`border px-3 py-1 font-mono text-xs ${active ? "border-foreground bg-primary text-primary-foreground" : "border-border hover:border-foreground"}`}>{children}</button>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="font-mono">{v}</dd></div>;
}
