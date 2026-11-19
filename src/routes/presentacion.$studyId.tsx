import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { analysisQuery, studyQuery } from "@/lib/listening";
import { label, type AnalysisResult, type Dist } from "@/lib/analysis-types";
import { PLATFORMS, type Platform } from "@/lib/platforms";
import logo from "@/assets/wizr-logo.png.asset.json";

export const Route = createFileRoute("/presentacion/$studyId")({
  head: () => ({
    meta: [
      { title: "Presentación — WIZR · KiMedia Intelligence" },
      { name: "description", content: "Reporte visual descargable del análisis de conversación social." },
      { property: "og:title", content: "Presentación — WIZR · KiMedia Intelligence" },
      { property: "og:description", content: "Reporte visual en diapositivas del análisis de conversación social." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Deck,
});

const PRINT = `@page { size: 1920px 1080px; margin: 0 }
@media print { .no-print { display: none !important } .deck { gap: 0 !important; padding: 0 !important } .slide-wrap { width: 1920px !important; height: 1080px !important; break-after: page; box-shadow: none !important; border-radius: 0 !important } .slide { transform: none !important } }
.slide, .slide * { -webkit-print-color-adjust: exact; print-color-adjust: exact }
.slide { font-family: Arial, "Helvetica Neue", Helvetica, "Liberation Sans", sans-serif }
.slide h1, .slide h2, .slide h3 { font-family: inherit; letter-spacing: -0.03em }`;

type Ctx = { r: AnalysisResult; topic: string; date: string; quick: boolean };

function Deck() {
  const { studyId } = Route.useParams();
  const { data: study } = useQuery(studyQuery(studyId));
  const { data: analysis, isLoading } = useQuery(analysisQuery(studyId));
  const r = analysis?.status === "completado" ? (analysis.result as unknown as AnalysisResult) : null;
  if (isLoading) return <p className="p-10 font-mono text-sm">Cargando…</p>;
  if (!r || !study) return <p className="p-10">No hay un análisis completado. <Link to="/estudios/$studyId" params={{ studyId }} className="underline">Volver</Link></p>;
  const m = r.methodology;
  const fmt = (d: string) => new Date(d).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  const date = m?.period ? `${fmt(m.period.from)} — ${fmt(m.period.to)}` : fmt(analysis!.created_at);
  const ctx: Ctx = { r, topic: study.topic || r.topic_label || study.title, date, quick: study.kind === "quick" };
  const slides = buildSlides(ctx);
  return (
    <div className="min-h-screen bg-muted">
      <style>{PRINT}</style>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-6 py-3">
        <Link to="/estudios/$studyId" params={{ studyId }} className="font-mono text-xs uppercase hover:text-accent">← Volver al análisis</Link>
        <p className="font-mono text-xs text-muted-foreground">{slides.length} diapositivas · 16:9</p>
        <button onClick={() => window.print()} className="bg-accent px-5 py-2 text-sm font-medium text-accent-foreground">Descargar PDF</button>
      </div>
      <div className="deck flex flex-col items-center gap-8 p-8">
        {slides.map((s, i) => (
          <div key={i} className="slide-wrap relative overflow-hidden rounded-md shadow-lg" style={{ width: "min(100%, 1280px)", aspectRatio: "16 / 9" }}>
            <Scaled>{s.node}{!s.bare && <Chrome section={s.section} topic={ctx.topic} n={i + 1} total={slides.length} />}</Scaled>
          </div>
        ))}
      </div>
    </div>
  );
}

function Scaled({ children }: { children: React.ReactNode }) {
  return (
    <div className="slide absolute left-0 top-0 origin-top-left bg-background text-foreground" style={{ width: 1920, height: 1080, transform: "scale(var(--s))" }}
      ref={(el) => { if (!el) return; const fit = () => el.style.setProperty("--s", String(el.parentElement!.clientWidth / 1920)); fit(); new ResizeObserver(fit).observe(el.parentElement!); }}>
      {children}
    </div>
  );
}

function Chrome({ section, topic, n, total }: { section?: string | undefined; topic: string; n: number; total: number }) {
  return (
    <>
      <img src={logo.url} alt="WIZR" className="absolute left-20 top-12 h-12" />
      {section && <p className="absolute right-20 top-16 text-base font-bold uppercase tracking-[0.3em] text-muted-foreground">{section}</p>}
      <p className="absolute bottom-12 left-20 max-w-[1000px] truncate text-base font-bold uppercase tracking-[0.15em] text-muted-foreground">{topic}</p>
      <p className="absolute bottom-12 right-20 text-base font-bold tracking-[0.15em] text-muted-foreground">{String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}</p>
    </>
  );
}

const Head = ({ k, title }: { k: string; title: string }) => (
  <div>
    <p className="text-base font-bold uppercase tracking-[0.3em] text-primary">{k}</p>
    <h2 className="mt-3 text-[56px] font-bold leading-[1.05]">{title}</h2>
  </div>
);
const Body = ({ children }: { children: React.ReactNode }) => <div className="absolute inset-x-20 bottom-28 top-36 flex flex-col gap-8">{children}</div>;
const Panel = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <div className={`rounded-3xl bg-secondary p-8 ${className}`}>{children}</div>;
const Lectura = ({ children, title = "Lectura" }: { children: React.ReactNode; title?: string }) => (
  <div className="rounded-2xl border-l-4 border-primary bg-primary/10 px-8 py-5 text-xl leading-snug"><span className="mr-4 text-sm font-bold uppercase tracking-[0.3em] text-primary">{title}</span>{children}</div>
);
const SENT: Record<string, [string, string]> = { positivo: ["bg-success", "text-success"], negativo: ["bg-destructive", "text-destructive"], mixto: ["bg-accent", "text-accent"], neutro: ["bg-muted-foreground", "text-muted-foreground"] };
const Pill = ({ s }: { s: string }) => <span className={`rounded-md px-2 py-0.5 text-sm font-bold uppercase tracking-wider ${SENT[s]?.[1] ?? ""} bg-current/10`} style={{ backgroundColor: "color-mix(in oklab, currentColor 12%, transparent)" }}>{s}</span>;
const Star = ({ size, className }: { size: number; className: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={`absolute fill-accent ${className}`}><path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0Z" /></svg>
);

function HBars({ data, max }: { data: { label: string; value: number; suffix?: string }[]; max?: number }) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-4">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[220px_1fr_110px] items-center gap-5 text-xl">
          <span className="truncate text-right font-bold">{d.label}</span>
          <span className="h-7 rounded-md bg-background"><span className="block h-full rounded-md bg-primary" style={{ width: `${Math.max(1, (d.value / top) * 100)}%` }} /></span>
          <span className="font-bold">{d.value.toLocaleString("es-MX")}<span className="ml-1 text-sm text-muted-foreground">{d.suffix}</span></span>
        </li>
      ))}
    </ul>
  );
}
const distRows = (d: Dist) => d.filter((x) => x.key !== "nd" && x.key !== "und" && x.share >= 1).map((x) => ({ label: label(x.key), value: Math.round(x.share), suffix: "%" }));

function buildSlides({ r, topic, date, quick }: Ctx) {
  const S: { node: React.ReactNode; section?: string; bare?: boolean }[] = [];
  const n = r.classified_comments ?? r.analyzed_comments;
  const count = (p: number) => Math.round((p / 100) * n);
  let idx = 0;
  const k = (t: string) => `${String(++idx).padStart(2, "0")} · ${t}`;

  // Cover
  S.push({ bare: true, node: (
    <div className="absolute inset-0 flex">
      <div className="relative w-[57.5%] overflow-hidden bg-foreground text-background">
        <div className="absolute -left-40 bottom-[-200px] h-[700px] w-[700px] rounded-full bg-primary/40 blur-[120px]" />
        <div className="absolute right-[-100px] top-[-100px] h-[500px] w-[500px] rounded-full bg-accent/25 blur-[120px]" />
        <Star size={120} className="right-24 top-14" /><Star size={56} className="right-[260px] top-48" /><Star size={80} className="right-0 top-40" />
        <div className="absolute left-24 top-24 flex items-center gap-3 rounded-full border border-background/20 bg-background/10 px-5 py-2 text-sm font-bold uppercase tracking-[0.25em]"><span className="h-3 w-3 rounded-full bg-accent" />Reporte visual · {quick ? "Escucha rápida" : "Estudio profundo"}</div>
        <div className="absolute left-24 right-24 top-[340px]">
          <p className="flex items-center gap-5 text-base"><span className="h-0.5 w-16 bg-accent" /><span className="font-bold uppercase tracking-[0.3em] opacity-60">Periodo</span><span>{date}</span></p>
          <h1 className="mt-8 text-[110px] font-bold leading-[0.95]">{topic}</h1>
          <p className="mt-8 max-w-[880px] text-[28px] leading-snug opacity-75">{r.headline}</p>
        </div>
        <div className="absolute bottom-24 left-24 right-24 flex justify-between border-t border-background/15 pt-6 text-sm font-bold uppercase tracking-[0.25em]"><span><span className="opacity-50">Elaborado por</span> <span className="ml-2 normal-case tracking-normal">Wizr · KiMedia Intelligence</span></span><span className="opacity-50">Confidencial</span></div>
      </div>
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-background">
        <div className="absolute -right-24 -top-24 h-[340px] w-[340px] rounded-full bg-secondary" />
        <div className="absolute -bottom-40 -left-10 h-[460px] w-[460px] rounded-t-full bg-secondary" />
        <img src={logo.url} alt="WIZR Análisis Estratégico" className="relative w-[380px]" />
        <p className="relative mt-12 flex items-center gap-4 text-base font-bold uppercase tracking-[0.3em] text-primary"><span className="h-px w-10 bg-primary" />KiMedia Intelligence<span className="h-px w-10 bg-primary" /></p>
      </div>
    </div>
  ) });

  // Executive summary
  S.push({ section: "Resumen", node: (
    <Body>
      <div className="grid flex-1 grid-cols-[1.35fr_1fr] gap-16">
        <div><Head k={k("Resumen ejecutivo")} title={r.headline} /><div className="mt-6 h-1 w-16 bg-accent" /><p className="mt-8 text-2xl leading-relaxed text-muted-foreground">{r.executive_summary}</p></div>
        <div className="flex flex-col justify-center gap-5">
          {([["Comentarios", r.total_comments.toLocaleString("es-MX"), "bg-primary/10", "text-primary"], ["Positivo", `${r.sentiment.positive}%`, "bg-success/10", "text-success"], ["Negativo", `${r.sentiment.negative}%`, "bg-destructive/10", "text-destructive"], ["Temperatura", `${Math.round(r.temperature.score)}°`, "bg-secondary", "text-foreground"]] as const).map(([l, v, bg, c]) => (
            <div key={l} className={`flex items-center justify-between rounded-2xl px-8 py-6 ${bg}`}><span className="text-base font-bold uppercase tracking-[0.25em] text-muted-foreground">{l}</span><span className={`text-6xl font-bold ${c}`}>{v}</span></div>
          ))}
        </div>
      </div>
    </Body>
  ) });

  // Sentiment
  const p = r.sentiment;
  const dom = p.negative >= p.positive && p.negative >= p.neutral ? ["Negativo", "text-destructive"] : p.positive >= p.neutral ? ["Positivo", "text-success"] : ["Neutral", "text-muted-foreground"];
  S.push({ section: "Sentimiento", node: (
    <Body>
      <Head k={k("Pulso de sentimiento")} title="¿Cómo se siente la conversación?" />
      <div className="grid grid-cols-[520px_1fr] gap-16">
        <Panel className="flex items-center justify-center py-12">
          <div className="relative h-[400px] w-[400px] rounded-full" style={{ background: `conic-gradient(var(--color-success) 0 ${p.positive}%, var(--color-muted-foreground) 0 ${p.positive + p.neutral}%, var(--color-destructive) 0 100%)` }}>
            <div className="absolute inset-[60px] flex flex-col items-center justify-center rounded-full bg-secondary">
              <p className="text-[84px] font-bold leading-none">{n.toLocaleString("es-MX")}</p>
              <p className="mt-2 text-lg uppercase tracking-[0.2em] text-muted-foreground">comentarios</p>
              <p className={`mt-2 text-xl font-bold uppercase ${dom[1]}`}>{dom[0]}</p>
            </div>
          </div>
        </Panel>
        <div className="space-y-4">
          {([["Positivo", p.positive, "bg-success", "text-success"], ["Neutral", p.neutral, "bg-muted-foreground", "text-muted-foreground"], ["Negativo", p.negative, "bg-destructive", "text-destructive"]] as const).map(([l, v, bar, c]) => (
            <div key={l} className="flex items-center gap-5 rounded-2xl border border-border bg-background px-6 py-5"><span className={`h-10 w-3 rounded-full ${bar}`} /><span className="flex-1 text-2xl font-bold">{l}</span><span className="text-lg text-muted-foreground">{v}%</span><span className={`w-28 text-right text-4xl font-bold ${c}`}>{count(v).toLocaleString("es-MX")}</span></div>
          ))}
          <div className="rounded-2xl bg-primary/10 p-7">
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-primary">Lectura estratégica · {Math.round(r.temperature.score)}° {r.temperature.label}</p>
            <p className="mt-3 text-xl leading-relaxed">{r.temperature.summary}</p>
          </div>
        </div>
      </div>
    </Body>
  ) });

  // Timeline
  const tl = r.stats?.timeline ?? [];
  if (tl.length >= 2) {
    const max = Math.max(...tl.map((d) => d.count)); const peak = tl.find((d) => d.count === max)!;
    const W = 1760, H = 520; const pts = tl.map((d, i) => [(i / (tl.length - 1)) * W, H - (d.count / max) * (H - 40)] as const);
    const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
    const pk = pts[tl.indexOf(peak)]!;
    const f = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });
    if (!quick) S.push({ section: "Timeline", node: (
      <Body>
        <div className="flex items-end justify-between"><Head k={k("Volumen en el tiempo")} title="Evolución diaria" />
          <div className="flex gap-12 text-right"><div><p className="text-sm font-bold uppercase tracking-[0.25em] text-muted-foreground">Comentarios</p><p className="text-5xl font-bold">{r.total_comments.toLocaleString("es-MX")}</p></div><div><p className="text-sm font-bold uppercase tracking-[0.25em] text-muted-foreground">Pico</p><p className="text-5xl font-bold text-accent">{max.toLocaleString("es-MX")}</p></div></div></div>
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" style={{ height: H }}>
            <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--color-primary)" stopOpacity="0.3" /><stop offset="1" stopColor="var(--color-primary)" stopOpacity="0" /></linearGradient></defs>
            {[0.25, 0.5, 0.75].map((t) => <line key={t} x1="0" x2={W} y1={H * t} y2={H * t} stroke="var(--color-border)" strokeDasharray="6 6" />)}
            <path d={`${path} L${W},${H} L0,${H} Z`} fill="url(#g)" />
            <path d={path} fill="none" stroke="var(--color-primary)" strokeWidth="4" />
            <line x1={pk[0]} x2={pk[0]} y1={pk[1]} y2={H} stroke="var(--color-accent)" strokeDasharray="6 6" strokeWidth="2" />
            <circle cx={pk[0]} cy={pk[1]} r="10" fill="var(--color-accent)" />
          </svg>
          <span className="absolute -translate-x-1/2 rounded-md bg-accent px-3 py-1 text-sm font-bold text-accent-foreground" style={{ left: `${Math.min(94, Math.max(5, (pk[0] / W) * 100))}%`, top: pk[1] - 50 }}>PICO · {f(peak.day)}</span>
          <div className="mt-3 flex justify-between text-base text-muted-foreground"><span>{f(tl[0]!.day)}</span><span>{f(tl[Math.floor(tl.length / 2)]!.day)}</span><span>{f(tl[tl.length - 1]!.day)}</span></div>
        </div>
        <Lectura>La conversación alcanzó su pico el {f(peak.day)} con {max.toLocaleString("es-MX")} comentarios; el 10% de comentarios más populares concentra el {r.stats!.likes_top10_share}% de los likes.</Lectura>
      </Body>
    ) });
  }

  // Narratives
  const nar = r.narratives.slice(0, 6); const nmax = Math.max(1, ...nar.map((x) => x.share));
  S.push({ section: "Narrativas", node: (
    <Body>
      <Head k={k("Narrativas dominantes")} title={`Las ${nar.length} ideas que circularon`} />
      <Panel className="py-6">
        <p className="mb-4 text-sm font-bold uppercase tracking-[0.25em] text-muted-foreground">Peso por narrativa</p>
        <div className="flex h-[200px] items-end justify-around gap-10">
          {nar.map((x, i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end">
              <p className="text-3xl font-bold">{Math.round(x.share)}%</p>
              <div className={`mt-2 w-full rounded-t-lg ${SENT[x.sentiment]?.[0] ?? "bg-primary"}`} style={{ height: `${Math.max(3, (x.share / nmax) * 70)}%` }} />
              <p className="mt-3 text-2xl font-bold">N{String(i + 1).padStart(2, "0")}</p>
            </div>
          ))}
        </div>
      </Panel>
      <div className="grid grid-cols-3 gap-5">
        {nar.map((x, i) => (
          <div key={i} className={`rounded-2xl border border-border border-l-4 bg-background px-6 py-4 ${x.sentiment === "positivo" ? "border-l-success" : x.sentiment === "negativo" ? "border-l-destructive" : x.sentiment === "mixto" ? "border-l-accent" : "border-l-muted-foreground"}`}>
            <div className="flex items-center gap-3"><span className="text-sm font-bold tracking-[0.2em] text-primary">N{String(i + 1).padStart(2, "0")}</span><Pill s={x.sentiment} /><span className="ml-auto text-sm text-muted-foreground">tracción {x.traction}</span></div>
            <p className="mt-2 text-xl font-bold leading-tight">{x.title}</p>
            <p className="mt-1 line-clamp-2 text-base text-muted-foreground">{x.description}</p>
          </div>
        ))}
      </div>
    </Body>
  ) });

  // Archetypes
  S.push({ section: "Arquetipos", node: (
    <Body>
      <Head k={k("Arquetipos conversacionales")} title="Quiénes hablan y desde dónde" />
      <div className="grid flex-1 gap-6" style={{ gridTemplateColumns: `repeat(${Math.min(5, r.archetypes.length)}, 1fr)` }}>
        {r.archetypes.slice(0, 5).map((a, i) => (
          <div key={i} className="flex flex-col rounded-3xl bg-secondary p-7">
            <p className="text-5xl font-bold text-primary">{Math.round(a.share)}%</p>
            <h3 className="mt-3 text-[30px] font-bold leading-tight">{a.name}</h3>
            <p className="mt-3 text-lg leading-snug text-muted-foreground">{a.description}</p>
            <div className="mt-auto space-y-1 pt-5 text-base"><p><b>Postura:</b> {a.stance}</p><p><b>Tono:</b> {a.tone}</p></div>
          </div>
        ))}
      </div>
    </Body>
  ) });

  // Vocabulary
  if (!quick) S.push({ section: "Términos", node: (
    <Body>
      <div><Head k={k("Términos destacados")} title="El vocabulario de la conversación" /><p className="mt-2 text-xl text-muted-foreground">Conceptos más repetidos, dimensionados por frecuencia relativa</p></div>
      <Panel className="flex flex-1 flex-wrap content-center items-center justify-center gap-5 px-16">
        {r.keywords.map((w) => <span key={w.term} className="rounded-full border-2 border-destructive/30 bg-background px-6 py-2 font-bold text-destructive" style={{ fontSize: 22 + (w.weight / 100) * 36, opacity: 0.55 + (w.weight / 100) * 0.45 }}>{w.term}</span>)}
      </Panel>
    </Body>
  ) });

  // Voices
  S.push({ section: "Voces clave", node: (
    <Body>
      <Head k={k("Voces de mayor impacto")} title="Lo que más resonó" />
      <div className="space-y-4">
        {r.verbatims.slice(0, quick ? 5 : 6).map((v, i) => (
          <div key={i} className={`flex items-center gap-6 rounded-2xl border px-6 py-4 ${i === 0 ? "border-primary bg-primary/10" : "border-border bg-background"}`}>
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-lg font-bold ${i === 0 ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"}`}>{String(i + 1).padStart(2, "0")}</span>
            <div className="min-w-0 flex-1"><p className="line-clamp-2 text-xl leading-snug">“{v.text}”</p><p className="mt-1 text-base text-muted-foreground">@{(v.author ?? "anónimo").replace(/^@+/, "")} · {PLATFORMS[v.platform as Platform]?.label}</p></div>
            <div className="text-right"><p className="text-3xl font-bold">{v.likes.toLocaleString("es-MX")}</p><p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">likes</p></div>
          </div>
        ))}
      </div>
    </Body>
  ) });

  // Platforms
  const bp = r.stats?.by_platform ?? [];
  if (!quick && bp.length) S.push({ section: "Plataformas", node: (
    <Body>
      <Head k={k("Mix de plataformas")} title="¿Dónde sucede la conversación?" />
      <Panel className="flex flex-1 flex-col justify-center gap-10 px-16">
        <HBars data={bp.map((x) => ({ label: PLATFORMS[x.platform as Platform]?.label ?? x.platform, value: x.count, suffix: "coment." }))} />
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(bp.length, 4)}, 1fr)` }}>
          {bp.map((x) => (
            <div key={x.platform} className="rounded-2xl bg-background p-5"><p className="text-lg font-bold">{PLATFORMS[x.platform as Platform]?.label}</p>
              <div className="mt-3 flex h-4 overflow-hidden rounded-full"><div className="bg-success" style={{ width: `${x.positive}%` }} /><div className="bg-muted-foreground" style={{ width: `${x.neutral}%` }} /><div className="bg-destructive" style={{ width: `${x.negative}%` }} /></div>
              <p className="mt-2 text-base text-muted-foreground">{x.positive}% positivo · {x.negative}% negativo</p></div>
          ))}
        </div>
      </Panel>
    </Body>
  ) });

  // Demographics
  if (!quick && r.demographics) { const d = r.demographics; S.push({ section: "Perfil", node: (
    <Body>
      <div><Head k={k("Perfil inferido")} title="¿Quién participa?" /><p className="mt-2 text-xl text-muted-foreground">Estimación probabilística sobre {d.persons.toLocaleString("es-MX")} cuentas personales · no es dato declarado</p></div>
      <div className="grid flex-1 grid-cols-3 gap-6">
        {([["Género", distRows(d.gender), d.determinable.gender], ["Edad", distRows([...d.age].sort((a, b) => a.key.localeCompare(b.key))), d.determinable.age], ["País", distRows(d.country).slice(0, 6), d.determinable.country]] as const).map(([t, rows, det]) => (
          <Panel key={t} className="flex flex-col">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-muted-foreground">{t}</p>
            <ul className="mt-6 space-y-4">{rows.map((x) => (
              <li key={x.label}><div className="flex justify-between text-xl"><span className="font-bold">{x.label}</span><span>{x.value}%</span></div><div className="mt-1 h-3 rounded-full bg-background"><div className="h-full rounded-full bg-primary" style={{ width: `${x.value}%` }} /></div></li>
            ))}</ul>
            <p className="mt-auto pt-4 text-base text-muted-foreground">Determinable en {det}% de las cuentas</p>
          </Panel>
        ))}
      </div>
    </Body>
  ) }); }

  // Key takeaways
  const pts = (r.executive_summary.match(/[^.!?]+[.!?]+/g) ?? [r.executive_summary]).map((x) => x.trim()).filter(Boolean).slice(0, 4);
  if (!quick) S.push({ section: "Hallazgos", node: (
    <Body>
      <Head k={k("Hallazgos clave")} title="Lo más importante del periodo" />
      <div className="space-y-4">
        {pts.map((t, i) => (
          <div key={i} className="flex overflow-hidden rounded-2xl border border-border bg-background">
            <div className="flex w-36 shrink-0 flex-col items-center justify-center bg-primary py-5 text-primary-foreground"><span className="text-xs font-bold uppercase tracking-[0.25em] opacity-70">Hallazgo</span><span className="text-5xl font-bold">{String(i + 1).padStart(2, "0")}</span></div>
            <p className="flex items-center px-8 text-2xl leading-snug">{t}</p>
          </div>
        ))}
      </div>
    </Body>
  ) });

  // Methodology
  const m = r.methodology ?? { collected: r.total_comments, sources: [], sampling: `Se analizaron ${r.analyzed_comments.toLocaleString("es-MX")} de ${r.total_comments.toLocaleString("es-MX")} comentarios, priorizando los de mayor interacción.`, classified: n, synthesized: r.analyzed_comments, limitations: ["Solo se observa lo que cada red muestra públicamente."] };
  S.push({ section: "Metodología", node: (
    <Body>
      <div><Head k={k("Metodología")} title="Cómo se construyó este reporte" /><p className="mt-2 text-xl text-muted-foreground">Ficha técnica para sostener y replicar los hallazgos</p></div>
      <div className="grid grid-cols-2 gap-5">
        {([["Universo", `${m.collected.toLocaleString("es-MX")} comentarios públicos de ${m.sources.length} ${m.sources.length === 1 ? "publicación" : "publicaciones"} (${[...new Set(m.sources.map((x) => PLATFORMS[x.platform as Platform]?.label))].join(", ")}).`],
          ["Muestreo", m.sampling],
          ["Codificación", `${m.classified.toLocaleString("es-MX")} comentarios clasificados uno a uno; ${m.synthesized} para síntesis netnográfica. Cada cita es trazable a su comentario original.`],
          ["Limitaciones", [...m.limitations.slice(0, 2), "El perfil demográfico es una inferencia probabilística."].join(" ")]] as const).map(([t, b], i) => (
          <div key={t} className="flex overflow-hidden rounded-2xl border border-border bg-background">
            <div className="flex w-32 shrink-0 flex-col items-center justify-center bg-foreground py-5 text-background"><span className="text-xs font-bold uppercase tracking-[0.2em] opacity-60">{t}</span><span className="text-4xl font-bold">{String(i + 1).padStart(2, "0")}</span></div>
            <p className="px-6 py-5 text-lg leading-snug">{b}</p>
          </div>
        ))}
      </div>
    </Body>
  ) });

  // Closing
  if (!quick) S.push({ bare: true, node: (
    <div className="absolute inset-0 overflow-hidden bg-foreground text-background">
      <div className="absolute -left-40 bottom-[-240px] h-[700px] w-[700px] rounded-full bg-primary/40 blur-[120px]" />
      <Star size={140} className="right-40 top-24" /><Star size={60} className="right-[340px] top-56" /><Star size={80} className="right-20 top-72" />
      <img src={logo.url} alt="WIZR" className="absolute left-20 top-12 h-12 brightness-0 invert" />
      <div className="absolute left-24 right-[480px] top-[300px]">
        <div className="inline-flex items-center gap-3 rounded-full border border-background/20 bg-background/10 px-5 py-2 text-sm font-bold uppercase tracking-[0.25em]"><span className="h-3 w-3 rounded-full bg-accent" />Conclusión del periodo</div>
        <p className="mt-10 text-[52px] font-bold leading-tight">{r.headline}</p>
      </div>
      <div className="absolute bottom-24 left-24 right-24 flex justify-between border-t border-background/15 pt-6 text-base"><span><span className="text-sm font-bold uppercase tracking-[0.25em] opacity-50">Wizr</span><br />KiMedia Intelligence</span><span className="text-right"><span className="text-sm font-bold uppercase tracking-[0.25em] opacity-50">Tema</span><br />{topic}</span></div>
    </div>
  ) });
  return S;
}
