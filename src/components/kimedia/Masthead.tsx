import { Link } from "@tanstack/react-router";

export function Masthead() {
  return (
    <header className="border-b border-foreground">
      <div className="mx-auto flex max-w-7xl items-end justify-between px-6 py-5">
        <Link to="/" className="leading-none">
          <span className="font-display text-3xl italic">KiMedia</span>
          <span className="ml-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Listening Lab</span>
        </Link>
        <span className="hidden font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground sm:block">
          Social listening · Análisis de tendencias
        </span>
      </div>
    </header>
  );
}
