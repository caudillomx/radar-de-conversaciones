import { Link } from "@tanstack/react-router";
import type { AnalysisResult } from "@/lib/analysis-types";
import { PLATFORMS, type Platform } from "@/lib/platforms";

const d = (x: string) => new Date(x).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });

export function Methodology({ m }: { m: NonNullable<AnalysisResult["methodology"]> }) {
  const coverage = m.classify_requested ? Math.round((m.classified / m.classify_requested) * 100) : 0;
  return (
    <section className="border-t-2 border-foreground pt-6">
      <h4 className="font-display text-3xl">Metodología</h4>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Ficha técnica de este análisis. El marco general está descrito en <Link to="/metodologia" className="underline hover:text-accent">nuestra metodología</Link>.</p>
      <dl className="mt-6 grid gap-x-8 gap-y-4 text-sm md:grid-cols-2">
        <Item k="Universo">{m.collected.toLocaleString("es-MX")} comentarios públicos recolectados de {m.sources.length} {m.sources.length === 1 ? "publicación" : "publicaciones"}.</Item>
        <Item k="Periodo de los comentarios">{m.period ? `${d(m.period.from)} – ${d(m.period.to)}` : "Sin fecha disponible"}</Item>
        <Item k="Muestreo">{m.sampling}</Item>
        <Item k="Clasificación individual">{m.classified.toLocaleString("es-MX")} comentarios codificados uno a uno (sentimiento, tipo de cuenta, idioma y perfil inferido); cobertura efectiva {coverage}%.</Item>
        <Item k="Síntesis cualitativa">{m.synthesized.toLocaleString("es-MX")} comentarios (los de mayor interacción más una selección aleatoria) para narrativas, arquetipos y citas.</Item>
        <Item k="Trazabilidad">Cada cita corresponde a un comentario real almacenado y enlazado a su origen; el motor no puede redactar citas.</Item>
        <Item k="Fecha de corte">{d(m.generated_at)}</Item>
      </dl>
      <div className="mt-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Fuentes</p>
        <ul className="mt-2 divide-y divide-border border-y border-border text-sm">
          {m.sources.map((s, i) => (
            <li key={i} className="flex flex-wrap gap-x-4 py-2">
              <span className="w-24">{PLATFORMS[s.platform as Platform]?.label ?? s.platform}</span>
              <a href={s.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground hover:text-accent">{s.url}</a>
              <span className="font-mono text-xs">{s.collected.toLocaleString("es-MX")} de {s.target.toLocaleString("es-MX")} solicitados</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Limitaciones de esta muestra</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {m.limitations.map((l, i) => <li key={i}>{l}</li>)}
          <li>Solo se observa lo que cada red muestra públicamente; respuestas ocultas, privadas o eliminadas quedan fuera.</li>
          <li>El perfil demográfico es una inferencia probabilística, no un dato declarado por los usuarios.</li>
        </ul>
      </div>
    </section>
  );
}

function Item({ k, children }: { k: string; children: React.ReactNode }) {
  return <div><dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">{k}</dt><dd className="mt-1">{children}</dd></div>;
}
