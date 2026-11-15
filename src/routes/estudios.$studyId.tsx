import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Masthead } from "@/components/kimedia/Masthead";
import { PlatformMark } from "@/components/kimedia/PlatformMark";
import { AnalysisPanel } from "@/components/kimedia/AnalysisPanel";
import { PLATFORMS, parseSocialUrl, splitUrls, type Platform } from "@/lib/platforms";
import { commentsQuery, fn, studyQuery, useListeningMutation, type SourceRow } from "@/lib/listening";

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

  // Poll Apify for every running source.
  const sync = useServerFn(fn.syncExtraction);
  const running = study?.sources.filter((s) => RUNNING.has(s.status)).map((s) => s.id).join(",") ?? "";
  useEffect(() => {
    if (!running) return;
    let stop = false;
    const tick = async () => {
      await Promise.allSettled(running.split(",").map((id) => sync({ data: { sourceId: id } })));
      if (stop) return;
      qc.invalidateQueries({ queryKey: ["study", studyId] });
      qc.invalidateQueries({ queryKey: ["comments", studyId] });
    };
    const t = setInterval(tick, 6000);
    tick();
    return () => { stop = true; clearInterval(t); };
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
  const done = study.sources.filter((s) => s.status === "extraida").length;
  const runningCount = study.sources.filter((s) => RUNNING.has(s.status)).length;
  const totalComments = study.sources.reduce((n, s) => n + s.comment_count, 0);
  const progress = study.sources.length ? Math.round(((done + study.sources.filter((s) => s.status === "error").length) / study.sources.length) * 100) : 0;

  function commit() {
    const items = (quick ? newValid.slice(0, Math.max(0, 2 - study!.sources.length)) : newValid).map((p) => p.ok ? { url: p.url, platform: p.platform, postId: p.postId } : null!);
    add.mutate({ studyId, items, ready: quick, maxComments: quick ? 250 : 500 }, { onSuccess: () => setText("") });
  }

  return (
    <Shell mode={quick ? "quick" : "deep"}>
      {quick ? <Link to="/" className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-accent">← Escucha Rápida</Link>
        : <Link to="/estudios" className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-accent">← Estudios Profundos</Link>}
      <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-accent">{quick ? "⚡ Quick Pulse · Lectura exprés" : "Deep Dive"}</p>
      <h1 className="mt-3 font-display text-5xl md:text-7xl">{study.title}</h1>
      <p className="mt-2 text-muted-foreground">{[study.topic, study.client].filter(Boolean).join(" · ")}</p>

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
          <p className="mt-4 font-display text-6xl">{totalComments.toLocaleString("es-MX")}</p>
          <p className="text-sm text-muted-foreground">comentarios extraídos</p>

          <div className="mt-6">
            <div className="flex justify-between font-mono text-[11px] uppercase text-muted-foreground">
              <span>{runningCount ? `Extrayendo ${runningCount}…` : "Progreso"}</span><span>{progress}%</span>
            </div>
            <div className="mt-1 h-2 w-full bg-secondary">
              <div className={`h-full bg-accent transition-all ${runningCount ? "animate-pulse" : ""}`} style={{ width: `${runningCount && !progress ? 8 : progress}%` }} />
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
            {start.isPending ? "Iniciando…" : runningCount ? "Extracción en curso…" : `Extraer comentarios con Apify${ready.length ? ` (${ready.length})` : ""}`}
          </button>
          {start.error && <p className="mt-2 text-xs text-destructive">{start.error.message}</p>}
          <p className="mt-2 text-xs text-muted-foreground">Cada fuente usa un Actor especializado de Apify según su red. Las extracciones pueden tardar de 1 a 5 minutos.</p>
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
            <p className="font-mono text-[11px] text-muted-foreground">ID {s.post_id ?? "—"}{s.comment_count ? ` · ${s.comment_count} comentarios` : ""}</p>
          </div>
          <span className={`font-mono text-[11px] uppercase ${st.cls} ${locked ? "animate-pulse" : ""}`}>{st.label}</span>
        </div>
        {s.error && <p className="text-xs text-destructive">{s.error}</p>}
        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3 text-sm">
          <label className="flex items-center gap-2">Máx.
            <select disabled={locked} value={s.max_comments} onChange={(e) => update.mutate({ id: s.id, patch: { max_comments: +e.target.value } })} className="border border-border bg-background px-1 py-0.5">
              {[50, 100, 250, 500, 1000, 2500, 5000].map((n) => <option key={n} value={n}>{n}</option>)}
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
  const [sourceId, setSourceId] = useState<string | null>(null);
  const { data, isLoading } = useQuery(commentsQuery(studyId, sourceId));
  if (!sources.some((s) => s.comment_count > 0)) return null;
  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-center gap-2 border-b border-foreground pb-3">
        <h2 className="mr-auto font-display text-3xl">Comentarios extraídos</h2>
        <select value={sourceId ?? ""} onChange={(e) => setSourceId(e.target.value || null)} className="border border-border bg-background px-2 py-1 font-mono text-xs">
          <option value="">Todas las fuentes</option>
          {sources.filter((s) => s.comment_count).map((s) => <option key={s.id} value={s.id}>{PLATFORMS[s.platform as Platform].label} · {s.post_id}</option>)}
        </select>
      </div>
      {isLoading ? <p className="py-6 font-mono text-sm text-muted-foreground">Cargando…</p> : (
        <>
          <p className="pt-3 font-mono text-xs text-muted-foreground">Mostrando {data?.rows.length ?? 0} de {data?.total ?? 0}, ordenados por likes</p>
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
        </>
      )}
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`border px-3 py-1 font-mono text-xs ${active ? "border-foreground bg-primary text-primary-foreground" : "border-border hover:border-foreground"}`}>{children}</button>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="font-mono">{v}</dd></div>;
}
