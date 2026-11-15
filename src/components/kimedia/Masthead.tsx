import { Link } from "@tanstack/react-router";

const nav = "font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground";
const active = { className: "text-foreground underline decoration-accent decoration-2 underline-offset-8" };

export function Masthead({ mode }: { mode?: "quick" | "deep" } = {}) {
  return (
    <header className="border-b border-foreground">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-6 py-5">
        <Link to="/" className="leading-none">
          <span className="font-display text-3xl italic">KiMedia</span>
          <span className="ml-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Listening Lab</span>
        </Link>
        <nav className="flex gap-6">
          <Link to="/" className={`${nav} ${mode === "quick" ? active.className : ""}`} activeProps={active} activeOptions={{ exact: true }}>⚡ Escucha Rápida</Link>
          <Link to="/estudios" className={nav} activeProps={mode === "quick" ? {} : active}>Estudios Profundos</Link>
        </nav>
      </div>
    </header>
  );
}
