import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./gateway.server.ts";

export const ANALYSIS_MODEL = "google/gemini-3.8-flash";

const sentimentEnum = z.enum(["positivo", "neutro", "negativo", "mixto"]);
export const analysisSchema = z.object({
  headline: z.string(),
  executive_summary: z.string(),
  temperature: z.object({ score: z.number(), label: z.string(), summary: z.string() }),
  sentiment: z.object({ positive: z.number(), neutral: z.number(), negative: z.number() }),
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
  hooks: z.array(z.object({ channel: z.enum(["linkedin", "x", "carrusel"]), text: z.string() })),
});
export type AnalysisOutput = z.infer<typeof analysisSchema>;

const INSTRUCTIONS = `Eres analista senior de social listening y netnografía de KiMedia Digital.
Recibes comentarios públicos de redes sociales, cada uno con un id numérico, plataforma, likes y si es respuesta.
Produce una síntesis en español, rigurosa y basada SOLO en los comentarios. No inventes datos ni citas.
- sentiment: porcentajes (0-100) que sumen 100. temperature.score 0 (fría/apática) a 100 (muy caliente/polarizada).
- narratives: 3 a 6 ejes temáticos dominantes, ordenados por tracción; share = % aproximado de comentarios; example_ids = 2-4 ids reales.
- archetypes: 3 a 5 arquetipos conversacionales netnográficos (nombre evocador, postura, tono, 2-3 argumentos típicos); share en %; example_id = un id real.
- verbatims: 6 a 10 ids de citas de alto impacto (por fuerza, representatividad o likes) con por qué importan.
- keywords: 10 a 20 conceptos más repetidos, weight 1-100.
- hooks: 6 ganchos (2 linkedin, 2 x, 2 carrusel) que posicionen a KiMedia como autoridad, sin citar nombres de usuarios.
- headline: una frase editorial potente. executive_summary: 3-4 frases.
Devuelve SOLO un objeto JSON, sin markdown ni texto adicional, con esta estructura exacta (repite elementos según las cantidades anteriores):
{"headline":"...","executive_summary":"...","temperature":{"score":0,"label":"...","summary":"..."},"sentiment":{"positive":0,"neutral":100,"negative":0},"narratives":[{"title":"...","description":"...","traction":"alta","share":0,"sentiment":"neutro","example_ids":[0]}],"archetypes":[{"name":"...","description":"...","stance":"...","tone":"...","arguments":["..."],"share":0,"example_id":0}],"verbatims":[{"id":0,"why":"..."}],"keywords":[{"term":"...","weight":1}],"hooks":[{"channel":"linkedin","text":"..."}]}
Valores permitidos: traction = alta/media/baja; sentiment narrativo = positivo/neutro/negativo/mixto; channel = linkedin/x/carrusel. example_id puede ser null.`;

export async function runAnalysis(input: { studyTitle: string; topic: string; comments: string }) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY no está configurada");
  const provider = createLovableAiGatewayProvider(apiKey, undefined, { baseURL: "https://ai.gateway.lovable.dev/v1" });
  const result = streamText({
    model: provider(ANALYSIS_MODEL),
    system: INSTRUCTIONS,
    prompt: `Estudio: ${input.studyTitle}${input.topic ? `\nTema: ${input.topic}` : ""}\n\nComentarios:\n${input.comments}`,
    output: Output.object({ schema: analysisSchema }),
    maxRetries: 0,
  });
  try {
    return await result.output;
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e)) {
      try {
        if (!e.text) throw new Error("Sin respuesta estructurada");
        return analysisSchema.parse(JSON.parse(e.text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "")));
      } catch {
        throw new Error("La IA no devolvió un análisis válido. Intenta de nuevo.");
      }
    }
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 402) throw new Error("Sin créditos de IA. Agrega créditos en Settings → Plans & credits.");
    if (status === 429) throw new Error("Límite de peticiones de IA alcanzado; intenta en un minuto.");
    if (status === 403) throw new Error("El acceso a la IA fue denegado para este espacio de trabajo.");
    throw e;
  }
}
