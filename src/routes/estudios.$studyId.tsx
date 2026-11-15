import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useHydrated } from "@tanstack/react-router";
import { Masthead } from "@/components/kimedia/Masthead";
import { PlatformMark } from "@/components/kimedia/PlatformMark";
import { PLATFORMS, parseSocialUrl, splitUrls, type Platform } from "@/lib/platforms";
import { addSources, kindOf, removeSource, updateSource, useStudy, type Source } from "@/lib/studies";

export const Route = createFileRoute("/estudios/$studyId")({
  head: () => ({
    meta: [
      { title: "Ingesta de URLs — KiMedia Listening Lab" },
      { name: "description", content: "Agrega y valida publicaciones de Instagram, TikTok, YouTube, Facebook y X para un estudio." },
      { property: "og:title", content: "Ingesta de URLs — KiMedia Listening Lab" },
      { property: "og:description", content: "Agrega y valida publicaciones de redes sociales para un estudio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudyPage,
});

const STATUS: Record<Source["status"], string> = { pendiente: "Pendiente", lista: "Lista", extrayendo: "Extrayendo", extraida: "Extraída", error: "Error" };

function StudyPage() {
  const { studyId } = Route.useParams();
  const hydrated = useHydrated();
  const study = useStudy(studyId);
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<Platform | "all">("all");

  const parsed = useMemo(() => splitUrls(text).map(parseSocialUrl), [text]);
  const valid = parsed.filter((p) => p.ok);
  const existing = new Set(study?.sources.map((s) => s.url));
  const newValid = valid.filter((p) => p.ok && !existing.has(p.url));

  if (!hydrated) return <div className="min-h-screen"><Masthead /></div>;
  if (!study) return (
    <div className="min-h-screen"><Masthead />
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="font-display text-4xl italic">Estudio no encontrado.</p>
        <Link to="/" className="mt-4 inline-block underline">Volver a estudios</Link>
      </div>
    </div>
  );

  const quick = kindOf(study) === "quick";
  const quickFull = quick && study.sources.length >= 2;
  const sources = study.sources.filter((s) => filter === "all" || s.platform === filter);
  const counts = (Object.keys(PLATFORMS) as Platform[]).map((p) => [p, study.sources.filter((s) => s.platform === p).length] as const);
  const readyCount = study.sources.filter((s) => s.status === "lista").length;
  const estComments = study.sources.filter((s) => s.status === "lista").reduce((n, s) => n + s.maxComments, 0);

  function commit() {
    addSources(study!.id, (kindOf(study!) === "quick" ? newValid.slice(0, Math.max(0, 2 - study!.sources.length)) : newValid).map((p) => p.ok ? { url: p.url, platform: p.platform, postId: p.postId } : null!).filter(Boolean));
    setText("");
  }

  return (
    <div className="min-h-screen">
      <Masthead mode={quick ? "quick" : "deep"} />
      <main className="mx-auto max-w-7xl px-6 py-10">
        {quick ? <Link to="/" className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-accent">← Escucha Rápida</Link>
          : <Link to="/estudios" className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-accent">← Estudios Profundos</Link>}
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-accent">{quick ? "⚡ Quick Pulse · Lectura exprés" : "Deep Dive"}</p>
        <h1 className="mt-3 font-display text-5xl md:text-7xl">{study.title}</h1>
        <p className="mt-2 text-muted-foreground">{[study.topic, study.client].filter(Boolean).join(" · ")}</p>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem]">
          <div>
            {quick && (
              <section className="mb-10 border-2 border-accent bg-card p-6">
                <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Alerta rápida</h2>
                <p className="mt-3 font-display text-3xl">La lectura exprés — sentimiento dominante, narrativa principal, cita clave y un hook listo para postear — aparecerá aquí.</p>
                <p className="mt-2 text-sm text-muted-foreground">Se generará automáticamente al conectar la extracción con Apify y el análisis con IA.</p>
              </section>
            )}
            {!quickFull && <section className="border border-foreground bg-card p-6">
              <h2 className="font-mono text-xs uppercase tracking-[0.2em]">01 — Ingesta de URLs</h2>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
                placeholder={"Pega una o varias URLs (una por línea)\nhttps://www.instagram.com/reel/…\nhttps://www.tiktok.com/@cuenta/video/…"}
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
              <div className="mt-4 flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">{newValid.length} nuevas válidas · {parsed.length - valid.length} inválidas</span>
                <button onClick={commit} disabled={!newValid.length} className="bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-accent disabled:opacity-40">Agregar {newValid.length || ""} al {quick ? "pulso" : "estudio"}</button>
              </div>
            </section>}

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
                  {sources.map((s) => <SourceCard key={s.id} s={s} studyId={study.id} />)}
                </ul>
              )}
            </section>
          </div>

          <aside className="h-fit border border-foreground p-6 lg:sticky lg:top-6">
            <h2 className="font-mono text-xs uppercase tracking-[0.2em]">{quick ? "Extracción exprés" : "02 — Preparación de extracción"}</h2>
            <p className="mt-4 font-display text-6xl">{readyCount}<span className="text-2xl text-muted-foreground"> / {study.sources.length}</span></p>
            <p className="text-sm text-muted-foreground">fuentes marcadas como listas</p>
            <dl className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
              <Row k="Comentarios estimados (máx.)" v={estComments.toLocaleString("es-MX")} />
              {counts.filter(([, n]) => n).map(([p, n]) => <Row key={p} k={PLATFORMS[p].label} v={String(n)} />)}
            </dl>
            <button onClick={() => study.sources.forEach((s) => s.status === "pendiente" && updateSource(study.id, s.id, { status: "lista" }))} disabled={!study.sources.some((s) => s.status === "pendiente")}
              className="mt-6 w-full border border-foreground px-4 py-2.5 text-sm hover:bg-secondary disabled:opacity-40">Marcar todas como listas</button>
            <button disabled className="mt-3 w-full bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground opacity-50">Extraer comentarios con Apify</button>
            <p className="mt-2 text-xs text-muted-foreground">La extracción se activará al conectar Apify en la siguiente fase.</p>
          </aside>
        </div>
      </main>
    </div>
  );
}

function SourceCard({ s, studyId }: { s: Source; studyId: string }) {
  const u = new URL(s.url);
  const ytId = s.platform === "youtube" ? s.postId : null;
  return (
    <li className="flex flex-col border border-border bg-card">
      {ytId ? (
        <img src={`https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`} alt="" className="aspect-video w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex aspect-video items-center justify-center bg-secondary">
          <span className="font-display text-5xl italic">{PLATFORMS[s.platform].label}</span>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <PlatformMark platform={s.platform} />
          <div className="min-w-0 flex-1">
            <a href={s.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium hover:text-accent">{u.hostname.replace("www.", "")}{u.pathname}</a>
            <p className="font-mono text-[11px] text-muted-foreground">ID {s.postId ?? "—"}</p>
          </div>
          <span className={`font-mono text-[11px] uppercase ${s.status === "lista" ? "text-success" : "text-muted-foreground"}`}>{STATUS[s.status]}</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3 text-sm">
          <label className="flex items-center gap-2">Máx.
            <select value={s.maxComments} onChange={(e) => updateSource(studyId, s.id, { maxComments: +e.target.value })} className="border border-border bg-background px-1 py-0.5">
              {[100, 250, 500, 1000, 2500, 5000].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={s.includeReplies} onChange={(e) => updateSource(studyId, s.id, { includeReplies: e.target.checked })} /> Respuestas
          </label>
          <div className="ml-auto flex gap-3 font-mono text-xs uppercase">
            <button onClick={() => updateSource(studyId, s.id, { status: s.status === "lista" ? "pendiente" : "lista" })} className="hover:text-accent">{s.status === "lista" ? "Desmarcar" : "Lista"}</button>
            <button onClick={() => removeSource(studyId, s.id)} className="text-muted-foreground hover:text-destructive">Quitar</button>
          </div>
        </div>
      </div>
    </li>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`border px-3 py-1 font-mono text-xs ${active ? "border-foreground bg-primary text-primary-foreground" : "border-border hover:border-foreground"}`}>{children}</button>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="font-mono">{v}</dd></div>;
}
