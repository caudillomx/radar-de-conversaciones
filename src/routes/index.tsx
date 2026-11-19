import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Masthead } from "@/components/kimedia/Masthead";
import { PlatformMark } from "@/components/kimedia/PlatformMark";
import { PLATFORMS, parseSocialUrl, splitUrls, type Platform } from "@/lib/platforms";
import { fn, studiesQuery, useListeningMutation } from "@/lib/listening";

export const QUICK_MAX = 2;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Escucha Rápida — KiMedia Listening Lab" },
      { name: "description", content: "Pega 1 o 2 URLs y obtén una lectura exprés de la conversación, o abre un Estudio Profundo." },
      { property: "og:title", content: "Escucha Rápida — KiMedia Listening Lab" },
      { property: "og:description", content: "Lectura exprés de la conversación social o estudios profundos multi-plataforma." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { data: all = [] } = useQuery(studiesQuery());
  const pulses = all.filter((s) => s.kind === "quick").slice(0, 6);
  const deep = all.filter((s) => s.kind === "deep");
  const create = useListeningMutation(fn.createQuickPulse);
  const del = useListeningMutation(fn.deleteStudy);
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const parsed = useMemo(() => splitUrls(text).map(parseSocialUrl), [text]);
  const valid = parsed.flatMap((p) => (p.ok ? [p] : []));
  const tooMany = valid.length > QUICK_MAX;
  const canGo = valid.length > 0 && !tooMany;

  function go(e: React.FormEvent) {
    e.preventDefault();
    if (!canGo || create.isPending) return;
    create.mutate({ items: valid.map((p) => ({ url: p.url, platform: p.platform, postId: p.postId })) }, {
      onSuccess: (s) => navigate({ to: "/estudios/$studyId", params: { studyId: (s as { id: string }).id } }),
    });
  }

  return (
    <div className="min-h-screen">
      <Masthead />
      <main className="mx-auto max-w-7xl px-6 py-12">
        <section className="border-b border-foreground pb-12">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Nivel Fast · Quick Pulse</p>
          <h1 className="mt-3 font-display text-6xl leading-[0.95] md:text-8xl">¿Qué está diciendo <em className="text-accent">la gente</em> ahora?</h1>
          <form onSubmit={go} className="mt-8">
            <div className="flex flex-col gap-3 border-2 border-foreground bg-card p-2 md:flex-row">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} autoFocus
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) go(e); }}
                placeholder="Pega 1 o 2 URLs de Instagram, TikTok, YouTube, Facebook o X…"
                className="min-h-12 flex-1 resize-none bg-transparent px-3 py-3 font-mono text-sm outline-none" />
              <button disabled={!canGo || create.isPending} className="bg-accent px-8 py-3 font-medium text-accent-foreground disabled:opacity-40">{create.isPending ? "Abriendo…" : "⚡ Escuchar ahora"}</button>
            </div>
            {parsed.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {parsed.map((p, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    {p.ok ? <PlatformMark platform={p.platform} className="h-6 w-6 text-[9px]" /> : <span className="w-6 text-center text-destructive">!</span>}
                    <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground">{p.ok ? p.url : p.input}</span>
                    <span className={p.ok ? "text-success" : "text-destructive"}>{p.ok ? PLATFORMS[p.platform].label : p.reason}</span>
                  </li>
                ))}
              </ul>
            )}
            {tooMany && (
              <p className="mt-3 text-sm text-destructive">
                La Escucha Rápida admite hasta {QUICK_MAX} URLs. Para más, <Link to="/estudios" className="underline">abre un Estudio Profundo</Link>.
              </p>
            )}
            {create.error && <p className="mt-3 text-sm text-destructive">{create.error.message}</p>}
            <p className="mt-3 font-mono text-xs text-muted-foreground">Sin formularios: entras directo a la lectura exprés.</p>
          </form>
        </section>

        <div className="mt-12 grid gap-12 md:grid-cols-2">
          <section>
            <h2 className="font-display text-3xl">Pulsos recientes</h2>
            {pulses.length === 0 ? (
              <p className="mt-4 text-muted-foreground">Tus escuchas rápidas aparecerán aquí.</p>
            ) : (
              <ul className="mt-4 divide-y divide-border border-y border-foreground">
                {pulses.map((s) => (
                  <li key={s.id} className="flex items-start gap-3 py-4">
                    <div className="flex -space-x-2 pt-1">{s.sources.map((x) => <PlatformMark key={x.id} platform={x.platform as Platform} className="bg-background" />)}</div>
                    <PulseSummary s={s} />
                    <button onClick={() => del.mutate({ id: s.id })} className="font-mono text-xs uppercase text-muted-foreground hover:text-destructive">Quitar</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border border-foreground p-8">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Nivel Deep Dive</p>
            <h2 className="mt-2 font-display text-5xl">Estudio Profundo</h2>
            <p className="mt-3 text-muted-foreground">Múltiples URLs y redes agrupadas por tema, cliente o campaña. Rigor metodológico, gráficas, perfil inferido y presentación descargable.</p>
            <p className="mt-6 font-mono text-sm">{deep.length} estudios activos</p>
            <Link to="/estudios" className="mt-4 inline-block bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-accent">Abrir o crear estudio →</Link>
          </section>
        </div>
      </main>
    </div>
  );
}

type PulseRow = Awaited<ReturnType<typeof fn.listStudies>>[number];
function PulseSummary({ s }: { s: PulseRow }) {
  const a = [...(s.analyses ?? [])].filter((x) => x.status === "completado").sort((x, y) => y.created_at.localeCompare(x.created_at))[0];
  const sent = a?.sentiment as { positive: number; neutral: number; negative: number } | null | undefined;
  const comments = s.sources.reduce((n, x) => n + (x.comment_count ?? 0), 0);
  const mood = sent ? (sent.negative > sent.positive + 10 ? ["Negativo", "text-destructive"] : sent.positive > sent.negative + 10 ? ["Positivo", "text-success"] : ["Dividido", "text-accent"]) : null;
  return (
    <Link to="/estudios/$studyId" params={{ studyId: s.id }} className="group min-w-0 flex-1">
      <p className="truncate font-display text-xl group-hover:text-accent">{s.topic || (a?.headline as string | undefined) || "Aún sin analizar"}</p>
      {s.topic && a?.headline && <p className="line-clamp-2 text-sm text-muted-foreground">{a.headline as string}</p>}
      <p className="mt-1 font-mono text-[11px] uppercase text-muted-foreground">
        {s.title.replace(/^Pulso · /, "")} · {comments.toLocaleString("es-MX")} comentarios{mood && <> · <span className={mood[1]}>{mood[0]}</span></>}
      </p>
    </Link>
  );
}
