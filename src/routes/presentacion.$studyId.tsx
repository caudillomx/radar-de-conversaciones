import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { analysisQuery, studyQuery } from "@/lib/listening";
import type { AnalysisResult, Quote } from "@/lib/analysis-types";
import { DistBars, NarrativeMap, PlatformSentiment, SentimentBar, Timeline } from "@/components/kimedia/charts";
import { PLATFORMS, type Platform } from "@/lib/platforms";

export const Route = createFileRoute("/presentacion/$studyId")({
  head: () => ({
    meta: [
      { title: "Presentación — WIZR · KiMedia Intelligence" },
      { name: "description", content: "Presentación descargable del análisis de conversación social." },
      { property: "og:title", content: "Presentación — WIZR · KiMedia Intelligence" },
      { property: "og:description", content: "Diapositivas del análisis de conversación social." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Deck,
});

const PRINT = `@page { size: 1920px 1080px; margin: 0 }
@media print { .no-print { display: none !important } body { background: none } .deck { gap: 0 !important; padding: 0 !important } .slide-wrap { width: 1920px !important; height: 1080px !important; break-after: page; box-shadow: none !important } .slide { transform: none !important } }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact }`;

function Deck() {
  const { studyId } = Route.useParams();
  const { data: study } = useQuery(studyQuery(studyId));
  const { data: analysis, isLoading } = useQuery(analysisQuery(studyId));
  const r = analysis?.status === "completado" ? (analysis.result as unknown as AnalysisResult) : null;
  if (isLoading) return <p className="p-10 font-mono text-sm">Cargando…</p>;
  if (!r || !study) return <p className="p-10">No hay un análisis completado. <Link to="/estudios/$studyId" params={{ studyId }} className="underline">Volver</Link></p>;
  const date = new Date(analysis!.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  const title = study.topic || r.topic_label || study.title;
  const slides = buildSlides(r, title, date, study.kind === "quick");
  return (
    <div className="min-h-screen bg-secondary">
      <style>{PRINT}</style>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-foreground bg-background px-6 py-3">
        <Link to="/estudios/$studyId" params={{ studyId }} className="font-mono text-xs uppercase hover:text-accent">← Volver al análisis</Link>
        <p className="font-mono text-xs text-muted-foreground">{slides.length} diapositivas · 16:9</p>
        <button onClick={() => window.print()} className="bg-accent px-5 py-2 text-sm font-medium text-accent-foreground">Descargar PDF</button>
      </div>
      <div className="deck flex flex-col items-center gap-8 p-8">
        {slides.map((s, i) => (
          <div key={i} className="slide-wrap relative overflow-hidden shadow-lg" style={{ width: "min(100%, 1280px)", aspectRatio: "16 / 9" }}>
            <ScaledSlide>{s}<Footer n={i + 1} total={slides.length} /></ScaledSlide>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScaledSlide({ children }: { children: React.ReactNode }) {
  return (
    <div className="slide absolute left-0 top-0 origin-top-left bg-background text-foreground" style={{ width: 1920, height: 1080, transform: "scale(var(--s))" }}
      ref={(el) => { if (!el) return; const fit = () => el.style.setProperty("--s", String(el.parentElement!.clientWidth / 1920)); fit(); new ResizeObserver(fit).observe(el.parentElement!); }}>
      {children}
    </div>
  );
}

function Footer({ n, total }: { n: number; total: number }) {
  return <div className="absolute bottom-10 left-24 right-24 flex justify-between font-mono text-lg text-muted-foreground"><span>WIZR · KiMedia Intelligence</span><span>{String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}</span></div>;
}

const Kicker = ({ children }: { children: React.ReactNode }) => <p className="font-mono text-xl uppercase tracking-[0.25em] text-accent">{children}</p>;
const Body = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <div className={`absolute inset-0 px-24 pb-28 pt-24 ${className}`}>{children}</div>;
const Q = ({ q, big }: { q: Quote; big?: boolean }) => (
  <figure className="border-l-8 border-accent pl-8">
    <blockquote className={`font-display leading-tight ${big ? "text-5xl" : "text-3xl"}`}>“{q.text.length > 220 ? q.text.slice(0, 220) + "…" : q.text}”</blockquote>
    <figcaption className="mt-3 font-mono text-lg text-muted-foreground">@{(q.author ?? "anónimo").replace(/^@+/, "")} · {PLATFORMS[q.platform as Platform]?.label} · ♥ {q.likes.toLocaleString("es-MX")}</figcaption>
  </figure>
);
const Zoom = ({ children }: { children: React.ReactNode }) => <div style={{ zoom: 1.6 }}>{children}</div>;

function buildSlides(r: AnalysisResult, title: string, date: string, quick: boolean) {
  const s: React.ReactNode[] = [];
  s.push(
    <div className="absolute inset-0 bg-primary text-primary-foreground">
      <Body className="flex flex-col justify-between">
        <p className="font-mono text-2xl uppercase tracking-[0.3em]">WIZR <span className="text-accent">·</span> KiMedia Intelligence</p>
        <div>
          <p className="font-mono text-2xl uppercase tracking-[0.25em] text-accent">{quick ? "Escucha rápida" : "Estudio profundo"} · {date}</p>
          <h1 className="mt-6 max-w-[1500px] font-display text-[120px] leading-[0.95]">{title}</h1>
          <p className="mt-8 max-w-[1400px] text-4xl opacity-80">{r.headline}</p>
        </div>
        <p className="font-mono text-2xl opacity-70">{r.total_comments.toLocaleString("es-MX")} comentarios públicos analizados</p>
      </Body>
    </div>,
  );
  s.push(<Body><Kicker>Resumen ejecutivo</Kicker><h2 className="mt-6 max-w-[1600px] font-display text-7xl leading-tight">{r.headline}</h2><p className="mt-10 max-w-[1500px] text-4xl leading-snug text-muted-foreground">{r.executive_summary}</p></Body>);
  s.push(
    <Body>
      <Kicker>Clima de la conversación</Kicker>
      <div className="mt-12 grid grid-cols-2 gap-24">
        <div>
          <h3 className="font-display text-5xl">Sentimiento</h3>
          <SentimentBar s={r.sentiment} className="mt-8 h-12" />
          <div className="mt-8 grid grid-cols-3">
            {([["Positivo", r.sentiment.positive, "text-success"], ["Neutro", r.sentiment.neutral, "text-muted-foreground"], ["Negativo", r.sentiment.negative, "text-destructive"]] as const).map(([k, v, c]) => (
              <div key={k}><p className={`font-display text-[110px] leading-none ${c}`}>{Math.round(v)}%</p><p className="font-mono text-xl uppercase text-muted-foreground">{k}</p></div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-display text-5xl">Temperatura</h3>
          <div className="relative mt-8 h-12 bg-gradient-to-r from-chart-3 via-chart-4 to-destructive"><div className="absolute -top-3 h-[72px] w-2 bg-foreground" style={{ left: `${Math.min(99, Math.max(0, r.temperature.score))}%` }} /></div>
          <p className="mt-8 font-display text-[110px] leading-none">{Math.round(r.temperature.score)}° <span className="text-6xl italic text-accent">{r.temperature.label}</span></p>
          <p className="mt-4 text-3xl text-muted-foreground">{r.temperature.summary}</p>
        </div>
      </div>
    </Body>,
  );
  if (r.stats) s.push(
    <Body>
      <Kicker>Dinámica de la conversación</Kicker>
      <div className="mt-12 grid grid-cols-[1.4fr_1fr] gap-20">
        <div><h3 className="mb-8 font-display text-5xl">Volumen en el tiempo</h3><Timeline data={r.stats.timeline} height={420} /></div>
        <div><h3 className="mb-8 font-display text-5xl">Por plataforma</h3><Zoom><PlatformSentiment data={r.stats.by_platform} /></Zoom>
          <p className="mt-12 font-display text-7xl">{r.stats.likes_top10_share}%</p><p className="text-2xl text-muted-foreground">de los likes se concentra en el 10% de comentarios más populares</p></div>
      </div>
    </Body>,
  );
  s.push(<Body><Kicker>Narrativas dominantes</Kicker><h2 className="mt-4 font-display text-6xl">Lo que estructura la conversación</h2><div className="mt-14 max-w-[1500px]"><Zoom><NarrativeMap r={r} /></Zoom></div></Body>);
  r.narratives.slice(0, quick ? 3 : 6).forEach((n, i) => s.push(
    <Body>
      <Kicker>Narrativa {String(i + 1).padStart(2, "0")} · tracción {n.traction} · {Math.round(n.share)}%</Kicker>
      <div className="mt-8 grid grid-cols-[1fr_1fr] gap-20">
        <div><h2 className="font-display text-7xl leading-tight">{n.title}</h2><p className="mt-8 text-3xl leading-snug text-muted-foreground">{n.description}</p></div>
        <div className="space-y-12">{n.examples.slice(0, 2).map((q, j) => <Q key={j} q={q} />)}</div>
      </div>
    </Body>,
  ));
  s.push(
    <Body>
      <Kicker>Arquetipos conversacionales</Kicker>
      <div className="mt-12 grid gap-8" style={{ gridTemplateColumns: `repeat(${Math.min(r.archetypes.length, 5)}, 1fr)` }}>
        {r.archetypes.map((a, i) => (
          <div key={i} className="flex flex-col border-2 border-foreground p-8">
            <p className="font-mono text-xl text-accent">{Math.round(a.share)}%</p>
            <h3 className="mt-2 font-display text-4xl italic leading-tight">{a.name}</h3>
            <p className="mt-4 text-2xl text-muted-foreground">{a.description}</p>
            <p className="mt-auto pt-6 text-xl"><b>Tono:</b> {a.tone}</p>
          </div>
        ))}
      </div>
    </Body>,
  );
  if (r.demographics) { const d = r.demographics; s.push(
    <Body>
      <Kicker>Perfil inferido de participantes</Kicker>
      <p className="mt-4 text-2xl text-muted-foreground">Estimación a partir de {d.persons.toLocaleString("es-MX")} cuentas personales · no es dato declarado</p>
      <div className="mt-12 grid grid-cols-3 gap-16"><Zoom><h3 className="mb-4 font-display text-2xl">Género</h3><DistBars data={d.gender} /></Zoom><Zoom><h3 className="mb-4 font-display text-2xl">Edad</h3><DistBars data={[...d.age].sort((a, b) => a.key.localeCompare(b.key))} /></Zoom><Zoom><h3 className="mb-4 font-display text-2xl">País</h3><DistBars data={d.country.slice(0, 5)} /></Zoom></div>
    </Body>,
  ); }
  const v = r.verbatims.slice(0, 4);
  if (v.length) s.push(<Body><Kicker>Voces de alto impacto</Kicker><div className="mt-12 grid grid-cols-2 gap-16">{v.map((q, i) => <Q key={i} q={q} />)}</div></Body>);
  s.push(<Body><Kicker>Conceptos más repetidos</Kicker><div className="mt-14 flex flex-wrap items-baseline gap-x-12 gap-y-6">{r.keywords.map((k) => <span key={k.term} className="font-display leading-none" style={{ fontSize: 32 + (k.weight / 100) * 70, opacity: 0.4 + (k.weight / 100) * 0.6 }}>{k.term}</span>)}</div></Body>);
  if (r.methodology) { const m = r.methodology; s.push(
    <Body>
      <Kicker>Metodología</Kicker>
      <div className="mt-10 grid grid-cols-2 gap-16 text-2xl">
        <dl className="space-y-6">
          <div><dt className="font-mono text-lg uppercase text-accent">Universo</dt><dd>{m.collected.toLocaleString("es-MX")} comentarios de {m.sources.length} publicaciones ({[...new Set(m.sources.map((x) => PLATFORMS[x.platform as Platform]?.label))].join(", ")})</dd></div>
          <div><dt className="font-mono text-lg uppercase text-accent">Muestreo</dt><dd>{m.sampling}</dd></div>
          <div><dt className="font-mono text-lg uppercase text-accent">Codificación</dt><dd>{m.classified.toLocaleString("es-MX")} comentarios clasificados uno a uno; {m.synthesized} para síntesis cualitativa. Citas trazables al original.</dd></div>
        </dl>
        <div><p className="font-mono text-lg uppercase text-accent">Limitaciones</p><ul className="mt-2 list-disc space-y-3 pl-8">{m.limitations.map((l, i) => <li key={i}>{l}</li>)}<li>El perfil demográfico es una inferencia probabilística.</li></ul></div>
      </div>
    </Body>,
  ); }
  s.push(<div className="absolute inset-0 flex flex-col items-center justify-center bg-primary text-primary-foreground"><p className="font-display text-[160px] leading-none">WIZR</p><p className="mt-6 font-mono text-3xl uppercase tracking-[0.3em]">KiMedia Intelligence</p></div>);
  return s;
}
