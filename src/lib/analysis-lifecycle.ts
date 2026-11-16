export const ANALYSIS_TIMEOUT_MS = 120_000;
export const ANALYSIS_EXPIRED_MESSAGE = "El análisis expiró después de 2 minutos. Puedes reintentar el análisis.";

export function isAnalysisExpired(createdAt: string, now = Date.now()) {
  return now - Date.parse(createdAt) >= ANALYSIS_TIMEOUT_MS;
}