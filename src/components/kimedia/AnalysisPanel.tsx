import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { analysisQuery, fn, useListeningMutation } from "@/lib/listening";
import { PLATFORMS, type Platform } from "@/lib/platforms";
import { PlatformMark } from "./PlatformMark";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import type { AnalysisResult as Result, Quote } from "@/lib/analysis-types";
import { DistBars, NarrativeMap, PlatformSentiment, SentimentBar, StatTile, Timeline } from "./charts";
import { Methodology } from "./Methodology";
import { ANALYSIS_TIMEOUT_MS, ANALYSIS_EXPIRED_MESSAGE } from "@/lib/analysis-lifecycle";

const STEPS = ["Leyendo comentarios", "Midiendo sentimiento", "Agrupando narrativas", "Infiriendo arquetipos", "Perfilando participantes", "Seleccionando citas"];

export function AnalysisPanel({ studyId, commentCount, quick }: { studyId: string; commentCount: number; quick: boolean }) {
  const qc = useQueryClient();
  const run = useListeningMutation(fn.analyzeStudy, studyId);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const { data: analysis } = useQuery({ ...analysisQuery(studyId), refetchInterval: (q) => (run.isPending || q.state.data?.status === "procesando" ? 1000 : false) });
  const attemptStart = startedAt ?? (analysis?.status === "procesando" ? Date.parse(analysis.created_at) : null);
  const expired = attemptStart !== null && now - attemptStart >= ANALYSIS_TIMEOUT_MS && (run.isPending || analysis?.status === "procesando");
  const busy = !expired && (run.isPending || analysis?.status === "procesando");
  useEffect(() => {
    if (!run.isPending && analysis?.status !== "procesando") return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [run.isPending, analysis?.status]);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!busy) { setStep(0); return; }
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 9000);
    return () => clearInterval(t);
  }, [busy]);
  useEffect(() => { if (run.isSuccess || run.isError) qc.invalidateQueries({ queryKey: ["analysis", studyId] }); }, [run.isSuccess, run.isError, qc, studyId]);

  const r = analysis?.status === "completado" ? (analysis.result as unknown as Result) : null;
  const err = expired ? ANALYSIS_EXPIRED_MESSAGE : run.error?.message ?? (analysis?.status === "error" ? analysis.error : null);

  return (
    <section className={`${quick ? "border-2 border-accent" : "border border-foreground"} bg-card p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-accent">{quick ? "Alerta rápida" : "03 — Informe de inteligencia"}</h2>
          {r && analysis && <p className="mt-1 font-mono text-[11px] text-muted-foreground">{(r.classified_comments ?? r.analyzed_comments).toLocaleString("es-MX")} de {r.total_comments.toLocaleString("es-MX")} comentarios analizados · {new Date(analysis.created_at).toLocaleString("es-MX")}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
        {r && !busy && <Button asChild variant="outline" className="rounded-none px-5 py-2.5"><Link to="/presentacion/$studyId" params={{ studyId }}>Descargar presentación (PDF)</Link></Button>}
        <Button onClick={() => { run.reset(); setStartedAt(Date.now()); setNow(Date.now()); run.mutate({ studyId }); }} disabled={busy || commentCount < 5}
          className="rounded-none px-5 py-2.5 hover:bg-accent">
          {busy ? "Analizando…" : err ? "Reintentar análisis" : r ? "Volver a analizar" : "✦ Analizar con IA"}
        </Button>
        </div>
      </div>

      {busy && (
        <div className="mt-6">
          <div className="flex justify-between font-mono text-[11px] uppercase text-muted-foreground"><span>{STEPS[step]}…</span><span>{step + 1}/{STEPS.length}</span></div>
          <div className="mt-1 h-2 w-full bg-secondary"><div className="h-full animate-pulse bg-accent transition-all duration-1000" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
          <p className="mt-2 text-xs text-muted-foreground">Suele tardar entre 30 segundos y 2 minutos.</p>
        </div>
      )}
      {err && !busy && <p className="mt-4 text-sm text-destructive">{err}</p>}
      {!r && !busy && !err && (
        <p className="mt-4 font-display text-3xl">{commentCount >= 5 ? `${commentCount.toLocaleString("es-MX")} comentarios listos. Analízalos para obtener la lectura.` : "Extrae al menos 5 comentarios para poder analizar."}</p>
      )}
      {r && !busy && <Report r={r} quick={quick} />}
    </section>
  );
}

function Report({ r, quick }: { r: Result; quick: boolean }) {
  return (
    <div className="mt-6 space-y-10">
      <div>
        <h3 className="font-display text-4xl leading-tight md:text-5xl">{r.headline}</h3>
        <p className="mt-3 max-w-3xl text-lg text-muted-foreground">{r.executive_summary}</p>
      </div>

      {r.stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile value={r.total_comments.toLocaleString("es-MX")} label="Comentarios recolectados" />
          <StatTile value={(r.classified_comments ?? r.analyzed_comments).toLocaleString("es-MX")} label="Comentarios clasificados" />
          <StatTile value={`${r.stats.likes_top10_share}%`} label="Likes en el 10% más popular" />
          <StatTile value={`${r.stats.reply_share}%`} label="Son respuestas a otros" />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Sentimiento">
          <SentimentBar s={r.sentiment} />
          <dl className="mt-4 grid grid-cols-3 gap-2">
            {([["Positivo", r.sentiment.positive, "text-success"], ["Neutro", r.sentiment.neutral, "text-muted-foreground"], ["Negativo", r.sentiment.negative, "text-destructive"]] as const).map(([k, v, c]) => (
              <div key={k}><dt className="font-mono text-[11px] uppercase text-muted-foreground">{k}</dt><dd className={`font-display text-4xl ${c}`}>{Math.round(v)}%</dd></div>
            ))}
          </dl>
        </Card>
        <Card title="Temperatura de la conversación">
          <div className="relative h-4 w-full bg-gradient-to-r from-chart-3 via-chart-4 to-destructive">
            <div className="absolute -top-1 h-6 w-1 bg-foreground" style={{ left: `calc(${Math.min(100, Math.max(0, r.temperature.score))}% - 2px)` }} />
          </div>
          <p className="mt-4 font-display text-4xl">{Math.round(r.temperature.score)}° <span className="text-2xl italic text-accent">{r.temperature.label}</span></p>
          <p className="mt-1 text-sm text-muted-foreground">{r.temperature.summary}</p>
        </Card>
      </div>

      {r.stance && <StanceBlock s={r.stance} />}

      {r.stats && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Volumen de comentarios en el tiempo"><Timeline data={r.stats.timeline} /></Card>
          <Card title="Sentimiento por plataforma"><PlatformSentiment data={r.stats.by_platform} /></Card>
        </div>
      )}

      <div>
        <SectionTitle>Narrativas dominantes</SectionTitle>
        <div className="mb-6"><NarrativeMap r={r} /></div>
        <div className="divide-y divide-border border-y border-foreground">
          {r.narratives.map((n, i) => (
            <details key={i} className="group py-4" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center gap-4">
                <span className="font-mono text-sm text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1 font-display text-2xl group-open:text-accent">{n.title}</span>
                <span className="font-mono text-[11px] uppercase">tracción {n.traction} · {Math.round(n.share)}% · {n.sentiment}</span>
                <span className="font-mono text-lg transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="mt-3 pl-10">
                <div className="h-1 w-full bg-secondary"><div className="h-full bg-accent" style={{ width: `${n.share}%` }} /></div>
                <p className="mt-3 text-muted-foreground">{n.description}</p>
                <div className="mt-3 space-y-2">{n.examples.map((q, j) => <MiniQuote key={j} q={q} />)}</div>
              </div>
            </details>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>Arquetipos conversacionales</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {r.archetypes.map((a, i) => (
            <div key={i} className="flex flex-col border border-foreground p-5">
              <p className="font-mono text-[11px] uppercase text-accent">{Math.round(a.share)}% de la conversación</p>
              <h4 className="mt-1 font-display text-3xl italic">{a.name}</h4>
              <p className="mt-2 text-sm text-muted-foreground">{a.description}</p>
              <dl className="mt-3 space-y-1 text-sm"><div><dt className="inline font-medium">Postura: </dt><dd className="inline">{a.stance}</dd></div><div><dt className="inline font-medium">Tono: </dt><dd className="inline">{a.tone}</dd></div></dl>
              <ul className="mt-3 list-disc space-y-1 pl-4 text-sm">{a.arguments.map((x, j) => <li key={j}>{x}</li>)}</ul>
              {a.example && <div className="mt-auto pt-4"><MiniQuote q={a.example} /></div>}
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>Citas de alto impacto</SectionTitle>
        <div className="grid gap-6 md:grid-cols-2">
          {r.verbatims.slice(0, quick ? 4 : 10).map((v, i) => (
            <figure key={i} className="border-l-4 border-accent pl-5">
              <blockquote className="font-display text-2xl leading-snug">“{v.text.length > 280 ? v.text.slice(0, 280) + "…" : v.text}”</blockquote>
              <figcaption className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                <PlatformMark platform={v.platform as Platform} className="h-5 w-5 text-[8px]" />
                @{(v.author ?? "anónimo").replace(/^@+/, "")} · ♥ {v.likes.toLocaleString("es-MX")}
                {v.url && <a href={v.url} target="_blank" rel="noreferrer" className="hover:text-accent">ver ↗</a>}
              </figcaption>
              <p className="mt-1 text-xs italic text-muted-foreground">{v.why}</p>
            </figure>
          ))}
        </div>
      </div>

      {r.demographics && <Demographics d={r.demographics} />}

      <Card title="Conceptos más repetidos">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          {r.keywords.map((k) => (
            <span key={k.term} className="font-display leading-none" style={{ fontSize: `${14 + (k.weight / 100) * 26}px`, opacity: 0.45 + (k.weight / 100) * 0.55 }}>{k.term}</span>
          ))}
        </div>
      </Card>

      {r.methodology && <Methodology m={r.methodology} />}
    </div>
  );
}

function Demographics({ d }: { d: NonNullable<Result["demographics"]> }) {
  return (
    <div>
      <SectionTitle>Perfil inferido de participantes</SectionTitle>
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">Estimación, no dato declarado: se infiere del nombre de usuario, el idioma y la forma de escribir de {d.persons.toLocaleString("es-MX")} cuentas personales. Género determinable en {d.determinable.gender}% · edad en {d.determinable.age}% · país en {d.determinable.country}%.</p>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card title="Género probable"><DistBars data={d.gender} /></Card>
        <Card title="Edad probable"><DistBars data={[...d.age].sort((a, b) => a.key.localeCompare(b.key))} /></Card>
        <Card title="Tipo de cuenta"><DistBars data={d.account_type} color="bg-accent" /></Card>
        <Card title="Idioma"><DistBars data={d.language} color="bg-accent" /></Card>
        <Card title="País probable (con indicios)"><DistBars data={d.country} /></Card>
      </div>
    </div>
  );
}
const STANCE_ROWS = [["favor", "A favor", "bg-success", "text-success"], ["contra", "En contra", "bg-destructive", "text-destructive"], ["ambigua", "Ambigua", "bg-muted-foreground", "text-muted-foreground"]] as const;
function StanceBlock({ s }: { s: NonNullable<Result["stance"]> }) {
  return (
    <div>
      <SectionTitle>Postura frente a: {s.target}</SectionTitle>
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">{s.no_aplica}% de los comentarios clasificados no se refiere a este objeto. Sobre los {s.n_base.toLocaleString("es-MX")} que sí (n base), con margen de error al 95%. La postura se mide aparte del sentimiento.</p>
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Distribución de postura">
          <div className="flex h-4 w-full overflow-hidden">{STANCE_ROWS.map(([k, , bg]) => <div key={k} className={bg} style={{ width: `${s[k].share}%` }} />)}</div>
          <dl className="mt-4 grid grid-cols-3 gap-2">
            {STANCE_ROWS.map(([k, l, , c]) => <div key={k}><dt className="font-mono text-[11px] uppercase text-muted-foreground">{l}</dt><dd className={`font-display text-4xl ${c}`}>{Math.round(s[k].share)}%</dd><dd className="font-mono text-[11px] text-muted-foreground">±{s[k].moe} pts · {s[k].count.toLocaleString("es-MX")}</dd></div>)}
          </dl>
        </Card>
        <Card title="Postura por plataforma">
          <div className="space-y-3">
            {s.by_platform.map((p) => (
              <div key={p.platform}>
                <div className="flex justify-between font-mono text-[11px] uppercase"><span>{PLATFORMS[p.platform as Platform]?.label ?? p.platform}</span><span className="text-muted-foreground">n={p.n_base} · no aplica {p.no_aplica}%</span></div>
                <div className="mt-1 flex h-3 w-full overflow-hidden bg-secondary">{STANCE_ROWS.map(([k, , bg]) => <div key={k} className={bg} style={{ width: `${p[k].share}%` }} />)}</div>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">{STANCE_ROWS.map(([k, l]) => `${l} ${Math.round(p[k].share)}% ±${p[k].moe}`).join(" · ")}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
function MiniQuote({ q }: { q: Quote }) {
  return (
    <p className="border-l-2 border-border pl-3 text-sm italic">“{q.text.length > 200 ? q.text.slice(0, 200) + "…" : q.text}”
      <span className="ml-2 not-italic font-mono text-[10px] text-muted-foreground">— @{(q.author ?? "anónimo").replace(/^@+/, "")} · {PLATFORMS[q.platform as Platform]?.short} · ♥ {q.likes}</span></p>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="border border-border bg-background p-5"><h4 className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{title}</h4>{children}</div>;
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-4 font-display text-3xl">{children}</h4>;
}
