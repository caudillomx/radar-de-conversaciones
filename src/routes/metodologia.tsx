import { createFileRoute } from "@tanstack/react-router";
import { Masthead } from "@/components/kimedia/Masthead";

export const Route = createFileRoute("/metodologia")({
  head: () => ({
    meta: [
      { title: "Metodología — WIZR · KiMedia Intelligence" },
      { name: "description", content: "Cómo WIZR recolecta, muestrea, codifica e interpreta conversaciones sociales públicas." },
      { property: "og:title", content: "Metodología — WIZR · KiMedia Intelligence" },
      { property: "og:description", content: "Marco netnográfico, muestreo, codificación y límites de los análisis de WIZR." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

const STEPS = [
  ["Recolección", "Se extraen comentarios públicos de las publicaciones indicadas con extractores especializados por red. Se guardan autor público, texto, fecha, interacciones, enlace y si es respuesta. Se eliminan duplicados por identificador de origen."],
  ["Universo y cobertura", "Cada informe declara cuántos comentarios se pidieron, cuántos se obtuvieron y de qué fuentes. Las redes no muestran todas las respuestas a visitantes externos, por lo que el universo es la conversación públicamente visible."],
  ["Muestreo", "Se analizan uno a uno hasta 2,000 comentarios en Escucha Rápida y hasta 5,000 en Estudios Profundos. Si hay más, se toma una muestra estratificada por plataforma: 30% de mayor interacción, para no perder las voces con más alcance, y 70% aleatorio, para representar la conversación cotidiana."],
  ["Codificación individual", "Cada comentario recibe sentimiento (positivo, neutro, negativo), tipo de cuenta, idioma y un perfil inferido. Los porcentajes de sentimiento y perfil se calculan contando estas etiquetas, no por estimación global."],
  ["Síntesis netnográfica", "Sobre los comentarios de mayor interacción y una selección aleatoria se identifican narrativas (ejes temáticos recurrentes) y arquetipos conversacionales (posturas y tonos típicos), siguiendo la lógica de codificación temática de la netnografía."],
  ["Trazabilidad de citas", "El motor solo puede señalar comentarios por su número; el sistema recupera el texto original. Así ninguna cita puede ser inventada o parafraseada."],
  ["Perfil inferido", "Género, edad y país se infieren del nombre de usuario, el idioma, los modismos y el estilo. Se usa “no determinable” ante falta de evidencia y se informa qué porcentaje fue determinable. Es una estimación orientativa, no un censo."],
  ["Limitaciones", "Ironía, sarcasmo, bots y cuentas coordinadas pueden distorsionar lecturas. Cada informe lista las limitaciones observadas en su propia muestra y su fecha de corte."],
];

function Page() {
  return (
    <div className="min-h-screen">
      <Masthead />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Marco metodológico</p>
        <h1 className="mt-3 font-display text-6xl leading-[0.95]">Cómo leemos la conversación</h1>
        <p className="mt-4 text-lg text-muted-foreground">Cada análisis de WIZR combina conteo sistemático con interpretación cualitativa, y declara su universo, muestra y límites para que sus conclusiones puedan sostenerse y replicarse.</p>
        <ol className="mt-10 divide-y divide-border border-y border-foreground">
          {STEPS.map(([t, b], i) => (
            <li key={t} className="grid gap-2 py-6 md:grid-cols-[4rem_14rem_1fr]">
              <span className="font-mono text-sm text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              <h2 className="font-display text-2xl">{t}</h2>
              <p className="text-muted-foreground">{b}</p>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
