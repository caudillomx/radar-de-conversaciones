import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Masthead } from "@/components/kimedia/Masthead";
import { PlatformMark } from "@/components/kimedia/PlatformMark";
import { fn, studiesQuery, useListeningMutation } from "@/lib/listening";
import type { Platform } from "@/lib/platforms";

export const Route = createFileRoute("/estudios/")({
  head: () => ({
    meta: [
      { title: "Estudios Profundos — KiMedia Listening Lab" },
      { name: "description", content: "Dashboard de estudios de social listening y tendencias de KiMedia Digital." },
      { property: "og:title", content: "Estudios Profundos — KiMedia Listening Lab" },
      { property: "og:description", content: "Dashboard de estudios de social listening y tendencias de KiMedia Digital." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: all = [], isLoading } = useQuery(studiesQuery());
  const studies = all.filter((s) => s.kind === "deep");
  const create = useListeningMutation(fn.createStudy);
  const del = useListeningMutation(fn.deleteStudy);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", topic: "", client: "", stance: "" });
  const totalSources = studies.reduce((n, s) => n + s.sources.length, 0);
  const ready = studies.reduce((n, s) => n + s.sources.reduce((m, x) => m + x.comment_count, 0), 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    create.mutate({ kind: "deep", title: form.title.trim(), topic: form.topic.trim(), client: form.client.trim() || null, stance_target: form.stance.trim() || null }, {
      onSuccess: (s) => navigate({ to: "/estudios/$studyId", params: { studyId: (s as { id: string }).id } }),
    });
  }

  return (
    <div className="min-h-screen">
      <Masthead />
      <main className="mx-auto max-w-7xl px-6 py-12">
        <section className="grid gap-8 border-b border-foreground pb-10 md:grid-cols-[2fr_1fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Deep Dive · {new Date().toLocaleDateString("es-MX", { month: "long", year: "numeric" })}</p>
            <h1 className="mt-3 font-display text-6xl leading-[0.95] md:text-8xl">Estudios <em className="text-accent">profundos</em>.</h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">Investigaciones con múltiples URLs y redes, agrupadas por tema, cliente o campaña, con entregables completos.</p>
          </div>
          <dl className="grid grid-cols-3 gap-4 self-end md:grid-cols-1">
            {[["Estudios", studies.length], ["Fuentes", totalSources], ["Comentarios extraídos", ready]].map(([k, v]) => (
              <div key={k} className="border-t border-foreground pt-2">
                <dt className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{k}</dt>
                <dd className="font-display text-5xl">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-4xl">Tus estudios</h2>
            <button onClick={() => setOpen((o) => !o)} className="bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-accent">
              {open ? "Cancelar" : "+ Nuevo estudio"}
            </button>
          </div>

          {open && (
            <form onSubmit={submit} className="mt-6 grid gap-4 border border-foreground bg-card p-6 md:grid-cols-3">
              <Field label="Título del estudio *" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Reforma judicial: reacción digital" autoFocus />
              <Field label="Tema / coyuntura" value={form.topic} onChange={(v) => setForm({ ...form, topic: v })} placeholder="Política nacional" />
              <Field label="Cliente o prospecto" value={form.client} onChange={(v) => setForm({ ...form, client: v })} placeholder="Opcional" />
              <div className="md:col-span-3">
                <Field label="¿Postura frente a qué?" value={form.stance} onChange={(v) => setForm({ ...form, stance: v })} placeholder="la reforma al Poder Judicial" />
                <p className="mt-1 text-xs text-muted-foreground">Define un objeto concreto: una persona, decisión o propuesta. Si lo dejas vacío, solo se mide sentimiento.</p>
              </div>
              <div className="md:col-span-3">
                <button className="bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-40" disabled={!form.title.trim() || create.isPending}>{create.isPending ? "Creando…" : "Crear y agregar URLs →"}</button>
              </div>
            </form>
          )}

          {isLoading ? <p className="mt-8 font-mono text-sm text-muted-foreground">Cargando…</p> : studies.length === 0 ? (
            <div className="mt-8 border border-dashed border-border p-16 text-center">
              <p className="font-display text-3xl italic">Aún no hay estudios.</p>
              <p className="mt-2 text-muted-foreground">Crea el primero para empezar a reunir publicaciones.</p>
            </div>
          ) : (
            <ul className="mt-8 divide-y divide-border border-y border-foreground">
              {studies.map((s, i) => {
                const platforms = [...new Set(s.sources.map((x) => x.platform))] as Platform[];
                const comments = s.sources.reduce((n, x) => n + x.comment_count, 0);
                return (
                  <li key={s.id} className="group grid items-center gap-4 py-6 md:grid-cols-[3rem_1fr_auto_auto_auto]">
                    <span className="font-mono text-sm text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                    <Link to="/estudios/$studyId" params={{ studyId: s.id }} className="min-w-0">
                      <h3 className="font-display text-3xl group-hover:text-accent">{s.title}</h3>
                      <p className="text-sm text-muted-foreground">{[s.topic, s.client].filter(Boolean).join(" · ") || "Sin tema"}</p>
                    </Link>
                    <div className="flex -space-x-2">{platforms.map((p) => <PlatformMark key={p} platform={p} className="bg-background" />)}</div>
                    <span className="font-mono text-sm">{s.sources.length} fuentes · {comments} com.</span>
                    <button onClick={() => confirm(`¿Eliminar "${s.title}"?`) && del.mutate({ id: s.id })} className="font-mono text-xs uppercase text-muted-foreground hover:text-destructive">Eliminar</button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, autoFocus }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <input autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full border-b border-foreground bg-transparent py-2 text-lg outline-none focus:border-accent" />
    </label>
  );
}
