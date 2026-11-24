type ProgressSource = { comment_count: number; max_comments: number };

export function extractionState(sources: { status: string }[]) {
  if (sources.some((source) => source.status === "iniciando" || source.status === "extrayendo")) return "running";
  if (sources.some((source) => source.status === "error")) return "error";
  if (sources.length > 0 && sources.every((source) => source.status === "extraida")) return "completed";
  return "pending";
}

export function extractionProgress(sources: ProgressSource[]) {
  const collected = sources.reduce((sum, source) => sum + source.comment_count, 0);
  const target = sources.reduce((sum, source) => sum + source.max_comments, 0);
  return { collected, target, percent: target > 0 ? Math.min(100, Math.round(collected / target * 100)) : 0 };
}