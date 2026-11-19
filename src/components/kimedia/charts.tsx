import type { AnalysisResult, Dist } from "@/lib/analysis-types";
import { label } from "@/lib/analysis-types";
import { PLATFORMS, type Platform } from "@/lib/platforms";

export function SentimentBar({ s, className = "h-4" }: { s: AnalysisResult["sentiment"]; className?: string }) {
  return (
    <div className={`flex w-full overflow-hidden ${className}`}>
      <div className="bg-success" style={{ width: `${s.positive}%` }} />
      <div className="bg-muted-foreground/40" style={{ width: `${s.neutral}%` }} />
      <div className="bg-destructive" style={{ width: `${s.negative}%` }} />
    </div>
  );
}

export function DistBars({ data, hideNd = false, color = "bg-primary" }: { data: Dist; hideNd?: boolean; color?: string }) {
  const rows = data.filter((d) => d.share >= 1 && d.key !== "und" && !(hideNd && d.key === "nd"));
  const max = Math.max(1, ...rows.map((d) => d.share));
  if (!rows.length) return <p className="text-sm text-muted-foreground">Sin evidencia suficiente.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((d) => (
        <li key={d.key} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3 text-sm">
          <span className="truncate">{label(d.key)}</span>
          <span className="h-3 bg-secondary"><span className={`block h-full ${d.key === "nd" ? "bg-muted-foreground/40" : color}`} style={{ width: `${(d.share / max) * 100}%` }} /></span>
          <span className="text-right font-mono text-xs">{Math.round(d.share)}%</span>
        </li>
      ))}
    </ul>
  );
}

export function Timeline({ data, height = 120 }: { data: { day: string; count: number }[]; height?: number }) {
  if (data.length < 2) return <p className="text-sm text-muted-foreground">Los comentarios se concentran en un solo día o no traen fecha.</p>;
  const shown = data.slice(-45);
  const max = Math.max(...shown.map((d) => d.count));
  const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  return (
    <div>
      <div className="flex items-end gap-px" style={{ height }}>
        {shown.map((d) => <div key={d.day} title={`${fmt(d.day)}: ${d.count}`} className="flex-1 bg-primary" style={{ height: `${Math.max(2, (d.count / max) * 100)}%` }} />)}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[11px] text-muted-foreground"><span>{fmt(shown[0]!.day)}</span><span>pico {max.toLocaleString("es-MX")}/día</span><span>{fmt(shown[shown.length - 1]!.day)}</span></div>
    </div>
  );
}

export function PlatformSentiment({ data }: { data: NonNullable<AnalysisResult["stats"]>["by_platform"] }) {
  return (
    <ul className="space-y-3">
      {data.map((p) => (
        <li key={p.platform}>
          <div className="mb-1 flex justify-between text-sm"><span>{PLATFORMS[p.platform as Platform]?.label ?? p.platform}</span><span className="font-mono text-xs text-muted-foreground">{p.count.toLocaleString("es-MX")} comentarios</span></div>
          <SentimentBar s={p} className="h-3" />
        </li>
      ))}
    </ul>
  );
}

export function NarrativeMap({ r }: { r: AnalysisResult }) {
  const tone: Record<string, string> = { positivo: "bg-success", negativo: "bg-destructive", neutro: "bg-muted-foreground/50", mixto: "bg-accent" };
  const max = Math.max(1, ...r.narratives.map((n) => n.share));
  return (
    <ul className="space-y-2">
      {r.narratives.map((n, i) => (
        <li key={i} className="grid grid-cols-[1fr_2fr] items-center gap-3 text-sm">
          <span className="truncate">{n.title}</span>
          <span className="flex items-center gap-2"><span className={`block h-4 ${tone[n.sentiment] ?? "bg-primary"}`} style={{ width: `${(n.share / max) * 100}%` }} /><span className="font-mono text-xs">{Math.round(n.share)}%</span></span>
        </li>
      ))}
    </ul>
  );
}

export function StatTile({ value, label: l }: { value: string; label: string }) {
  return <div className="border border-border bg-background p-4"><p className="font-display text-4xl">{value}</p><p className="mt-1 font-mono text-[11px] uppercase text-muted-foreground">{l}</p></div>;
}
