import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { analysisQuery, fn, useListeningMutation } from "@/lib/listening";
import { PLATFORMS, type Platform } from "@/lib/platforms";
import { PlatformMark } from "./PlatformMark";
import { useQueryClient } from "@tanstack/react-query";

type Quote = { text: string; author: string | null; likes: number; platform: string; url: string | null; is_reply: boolean };
type Result = {
  headline: string; executive_summary: string; total_comments: number; analyzed_comments: number;
  temperature: { score: number; label: string; summary: string };
  sentiment: { positive: number; neutral: number; negative: number };
  narratives: { title: string; description: string; traction: "alta" | "media" | "baja"; share: number; sentiment: string; examples: Quote[] }[];
  archetypes: { name: string; description: string; stance: string; tone: string; arguments: string[]; share: number; example: Quote | null }[];
  verbatims: (Quote & { why: string })[];
  keywords: { term: string; weight: number }[];
  hooks: { channel: "linkedin" | "x" | "carrusel"; text: string }[];
};

const STEPS = ["Leyendo comentarios", "Midiendo sentimiento", "Agrupando narrativas", "Infiriendo arquetipos", "Seleccionando citas", "Redactando hooks"];
const CHANNEL = { linkedin: "LinkedIn", x: "X", carrusel: "Carrusel" };

export function AnalysisPanel({ studyId, commentCount, quick }: { studyId: string; commentCount: number; quick: boolean }) {
  const qc = useQueryClient();
  const { data: analysis } = useQuery({ ...analysisQuery(studyId), refetchInterval: (q) => (q.state.data?.status === "procesando" ? 5000 : false) });
  const run = useListeningMutation(fn.analyzeStudy, studyId);
  const busy = run.isPending || analysis?.status === "procesando";
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!busy) { setStep(0); return; }
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 9000);
    return () => clearInterval(t);
  }, [busy]);
  useEffect(() => { if (run.isSuccess || run.isError) qc.invalidateQueries({ queryKey: ["analysis", studyId] }); }, [run.isSuccess, run.isError, qc, studyId]);

  const r = analysis?.status === "completado" ? (analysis.result as unknown as Result) : null;
  const err = run.error?.message ?? (analysis?.status === "error" ? analysis.error : null);

  return (
    <section className={`${quick ? "border-2 border-accent" : "border border-foreground"} bg-card p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-accent">{quick ? "Alerta rápida" : "03 — Informe de inteligencia"}</h2>
          {r && <p className="mt-1 font-mono text-[11px] text-muted-foreground">{r.analyzed_comments} de {r.total_comments} comentarios · {new Date(analysis!.created_at).toLocaleString("es-MX")}</p>}
        </div>
        <button onClick={() => run.mutate({ studyId })} disabled={busy || commentCount < 5}
          className="bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-accent disabled:opacity-40">
          {busy ? "Analizando…" : r ? "Volver a analizar" : "✦ Analizar con IA"}
        </button>
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Sentimiento">
          <div className="flex h-4 w-full overflow-hidden">
            <div className="bg-success" style={{ width: `${r.sentiment.positive}%` }} />
            <div className="bg-muted-foreground/40" style={{ width: `${r.sentiment.neutral}%` }} />
            <div className="bg-destructive" style={{ width: `${r.sentiment.negative}%` }} />
          </div>
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

      <div>
        <SectionTitle>Narrativas dominantes</SectionTitle>
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

      <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
        <Card title="Conceptos más repetidos">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            {r.keywords.map((k) => (
              <span key={k.term} className="font-display leading-none" style={{ fontSize: `${14 + (k.weight / 100) * 26}px`, opacity: 0.45 + (k.weight / 100) * 0.55 }}>{k.term}</span>
            ))}
          </div>
        </Card>
        <Card title="Hooks sociales">
          <ul className="space-y-3">
            {r.hooks.map((h, i) => <Hook key={i} channel={CHANNEL[h.channel]} text={h.text} />)}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Hook({ channel, text }: { channel: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <li className="flex gap-3 border-b border-border pb-3 last:border-0">
      <span className="w-20 shrink-0 font-mono text-[11px] uppercase text-accent">{channel}</span>
      <p className="flex-1 text-sm">{text}</p>
      <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="shrink-0 font-mono text-[11px] uppercase text-muted-foreground hover:text-accent">{copied ? "Copiado" : "Copiar"}</button>
    </li>
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
