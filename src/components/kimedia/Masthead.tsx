import { Link } from "@tanstack/react-router";

const nav = "font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground";
const active = { className: "text-foreground underline decoration-accent decoration-2 underline-offset-8" };

export function Masthead({ mode }: { mode?: "quick" | "deep" | undefined } = {}) {
  return (
    <header className="border-b border-foreground">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-6 py-5">
        <Link to="/" aria-label="WIZR · KiMedia Intelligence" className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 border border-foreground px-3 py-2 leading-none">
          <span className="font-display text-3xl">WIZR</span>
          <span aria-hidden="true" className="text-accent">·</span>
          <span className="font-mono text-xs text-muted-foreground">KiMedia Intelligence</span>
        </Link>
        <nav className="flex flex-wrap gap-6">
          <Link to="/" className={`${nav} ${mode === "quick" ? active.className : ""}`} activeProps={active} activeOptions={{ exact: true }}>⚡ Escucha Rápida</Link>
          <Link to="/estudios" className={nav} activeProps={mode === "quick" ? {} : active}>Estudios Profundos</Link>
          <Link to="/metodologia" className={nav} activeProps={active}>Metodología</Link>
        </nav>
      </div>
    </header>
  );
}
