/** An analysis in progress fails only when it stops advancing for this long. */
export const ANALYSIS_STALL_MS = 10 * 60_000;
export const ANALYSIS_STALLED_MESSAGE = "El análisis no avanzó durante 10 minutos. Puedes reintentar el análisis.";
/** Minimum share of the sample that must be classified for results to be reported. */
export const MIN_COVERAGE = 0.8;
export const CLASSIFY_BATCH = 250;
export const CLASSIFY_CONCURRENCY = 3;
export const BATCH_MAX_ATTEMPTS = 3; // first try + 2 retries

export type AnalysisStage = "muestreo" | "sintesis" | "clasificacion" | "agregado" | "completado";

export function isAnalysisStalled(progressAt: string, now = Date.now()) {
  return now - Date.parse(progressAt) >= ANALYSIS_STALL_MS;
}
export const meetsCoverage = (classified: number, requested: number) => requested > 0 && classified / requested >= MIN_COVERAGE;

export function stageLabel(stage: string, done: number, total: number) {
  if (stage === "muestreo") return "Preparando la muestra…";
  if (stage === "sintesis") return "Definiendo narrativas…";
  if (stage === "clasificacion") return `Clasificando ${done} de ${total} lotes…`;
  if (stage === "agregado") return "Calculando resultados…";
  return "Listo";
}
