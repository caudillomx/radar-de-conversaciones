import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./gateway.server.ts";

export const ANALYSIS_MODEL = "google/gemini-3.8-flash";

const sentimentEnum = z.enum(["positivo", "neutro", "negativo", "mixto"]);
export const analysisSchema = z.object({
  topic_label: z.string(),
  headline: z.string(),
  executive_summary: z.string(),
  temperature: z.object({ score: z.number(), label: z.string(), summary: z.string() }),
  narratives: z.array(z.object({
    title: z.string(), description: z.string(), traction: z.enum(["alta", "media", "baja"]),
    share: z.number(), sentiment: sentimentEnum, example_ids: z.array(z.number()),
  })),
  archetypes: z.array(z.object({
    name: z.string(), description: z.string(), stance: z.string(), tone: z.string(),
    arguments: z.array(z.string()), share: z.number(), example_id: z.number().nullable(),
  })),
  verbatims: z.array(z.object({ id: z.number(), why: z.string() })),
  keywords: z.array(z.object({ term: z.string(), weight: z.number() })),
  limitations: z.array(z.string()),
});
export type AnalysisOutput = z.infer<typeof analysisSchema>;

export const classificationSchema = z.array(z.object({
  i: z.number(),
  s: z.enum(["pos", "neu", "neg"]),
  g: z.enum(["m", "f", "nd"]),
  a: z.enum(["13-17", "18-24", "25-34", "35-44", "45+", "nd"]),
  t: z.enum(["persona", "marca", "medio", "nd"]),
  l: z.string(),
  p: z.string(),
  st: z.enum(["favor", "contra", "ambigua", "no_aplica"]).optional(),
}));
export type Classification = z.infer<typeof classificationSchema>[number];

const SYNTH = `Eres analista senior de social listening y netnografía de KiMedia Digital.
Recibes una muestra de comentarios públicos, cada uno con id numérico, plataforma, likes y si es respuesta.
Produce una síntesis en español, rigurosa y basada SOLO en los comentarios. No inventes datos ni citas.
- topic_label: 3 a 7 palabras que nombren el tema de la conversación (ej. "Lanzamiento iPhone 17 en México").
- temperature.score 0 (fría/apática) a 100 (muy caliente/polarizada).
- narratives: 3 a 6 ejes temáticos dominantes por tracción; share = % aproximado de comentarios; example_ids = 2-4 ids reales.
- archetypes: 3 a 5 arquetipos conversacionales netnográficos (nombre evocador, postura, tono, 2-3 argumentos); share en %; example_id = un id real.
- verbatims: 6 a 10 ids de citas de alto impacto con por qué importan.
- keywords: 10 a 20 conceptos más repetidos, weight 1-100.
- limitations: 2 a 4 limitaciones o sesgos concretos observados en esta muestra (ironía, spam, idioma, sesgo de plataforma…).
- headline: una frase editorial potente. executive_summary: 3-4 frases.
Devuelve SOLO un objeto JSON, sin markdown, con esta estructura exacta:
{"topic_label":"...","headline":"...","executive_summary":"...","temperature":{"score":0,"label":"...","summary":"..."},"narratives":[{"title":"...","description":"...","traction":"alta","share":0,"sentiment":"neutro","example_ids":[0]}],"archetypes":[{"name":"...","description":"...","stance":"...","tone":"...","arguments":["..."],"share":0,"example_id":0}],"verbatims":[{"id":0,"why":"..."}],"keywords":[{"term":"...","weight":1}],"limitations":["..."]}
Valores: traction = alta/media/baja; sentiment = positivo/neutro/negativo/mixto. example_id puede ser null.`;

const CLASSIFY = `Clasifica CADA comentario recibido. Para cada id devuelve:
s = sentimiento (pos/neu/neg); g = género probable del autor por nombre de usuario y forma de escribir (m/f/nd);
a = rango de edad probable por lenguaje, referencias y estilo (13-17/18-24/25-34/35-44/45+/nd);
t = tipo de cuenta (persona/marca/medio/nd); l = idioma ISO 639-1 (es, en, pt…);
p = país probable ISO 3166 alfa-2 solo si hay indicios claros (modismos, menciones), si no "nd".
Sé conservador: usa "nd" cuando no haya evidencia suficiente.
Devuelve SOLO un arreglo JSON sin markdown: [{"i":0,"s":"neu","g":"nd","a":"nd","t":"persona","l":"es","p":"nd"}]`;

function provider() {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("El motor de análisis no está configurado");
  return createLovableAiGatewayProvider(apiKey, undefined, { baseURL: "https://ai.gateway.lovable.dev/v1" });
}

function friendly(e: unknown): never {
  const status = (e as { statusCode?: number }).statusCode;
  if (status === 402) throw new Error("Sin créditos para el motor de análisis. Agrega créditos en Settings → Plans & credits.");
  if (status === 429) throw new Error("El motor de análisis está saturado; intenta en un minuto.");
  if (status === 403) throw new Error("El acceso al motor de análisis fue denegado para este espacio de trabajo.");
  throw e instanceof Error ? e : new Error("Error del motor de análisis");
}

async function json<T>(system: string, prompt: string, schema: z.ZodType<T>): Promise<T> {
  let text: string;
  try {
    text = (await generateText({ model: provider()(ANALYSIS_MODEL), system, prompt, maxRetries: 1 })).text;
  } catch (e) { friendly(e); }
  try {
    return schema.parse(JSON.parse(text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "")));
  } catch {
    throw new Error("El motor de análisis no devolvió un resultado válido. Intenta de nuevo.");
  }
}

export function runSynthesis(input: { studyTitle: string; topic: string; comments: string }) {
  return json(SYNTH, `Estudio: ${input.studyTitle}${input.topic ? `\nTema: ${input.topic}` : ""}\n\nComentarios:\n${input.comments}`, analysisSchema);
}

/** Classifies one batch; a failed batch returns [] so coverage is reported honestly. */
const stancePrompt = (target: string) => `${CLASSIFY}
ADEMÁS, agrega a cada objeto el campo st = postura del comentario frente a: «${target}».
Valores: favor / contra / ambigua / no_aplica. "no_aplica" = el comentario no se refiere a ese objeto.
IMPORTANTE: la postura NO es el sentimiento. Un comentario puede tener tono negativo (insulta, se queja de otros) y estar A FAVOR del objeto; o tono positivo y estar EN CONTRA. Juzga solo la posición frente al objeto.
Ejemplo de salida: [{"i":0,"s":"neg","g":"nd","a":"nd","t":"persona","l":"es","p":"nd","st":"favor"}]`;

export async function classifyBatch(lines: string, stanceTarget?: string | null) {
  try { return await json(stanceTarget ? stancePrompt(stanceTarget) : CLASSIFY, lines, classificationSchema); } catch (e) { console.error("classifyBatch", e); return []; }
}
