export type Quote = { text: string; author: string | null; likes: number; platform: string; url: string | null; is_reply: boolean };
export type Dist = { key: string; count: number; share: number }[];
export type AnalysisResult = {
  topic_label?: string;
  headline: string; executive_summary: string; total_comments: number; analyzed_comments: number; classified_comments?: number;
  temperature: { score: number; label: string; summary: string };
  sentiment: { positive: number; neutral: number; negative: number };
  narratives: { title: string; description: string; traction: "alta" | "media" | "baja"; share: number; sentiment: string; examples: Quote[] }[];
  archetypes: { name: string; description: string; stance: string; tone: string; arguments: string[]; share: number; example: Quote | null }[];
  verbatims: (Quote & { why: string })[];
  keywords: { term: string; weight: number }[];
  stats?: {
    timeline: { day: string; count: number }[];
    by_platform: { platform: string; count: number; positive: number; neutral: number; negative: number }[];
    likes_top10_share: number; reply_share: number;
  };
  demographics?: {
    persons: number; account_type: Dist; gender: Dist; age: Dist; language: Dist; country: Dist;
    determinable: { gender: number; age: number; country: number };
  };
  methodology?: {
    generated_at: string;
    sources: { platform: string; url: string; target: number; collected: number; finished_at: string | null }[];
    period: { from: string; to: string } | null;
    collected: number; classified: number; classify_requested: number; synthesized: number;
    sampling: string; limitations: string[];
  };
};

export const LABELS: Record<string, string> = {
  m: "Hombres", f: "Mujeres", nd: "No determinable", persona: "Personas", marca: "Marcas", medio: "Medios",
  es: "Español", en: "Inglés", pt: "Portugués", fr: "Francés", it: "Italiano", de: "Alemán",
  MX: "México", US: "Estados Unidos", ES: "España", AR: "Argentina", CO: "Colombia", CL: "Chile", PE: "Perú", VE: "Venezuela", BR: "Brasil", EC: "Ecuador", GT: "Guatemala",
};
export const label = (k: string) => LABELS[k] ?? k;
