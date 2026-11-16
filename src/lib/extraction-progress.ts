type ProgressSource = { comment_count: number; max_comments: number };

export function extractionProgress(sources: ProgressSource[]) {
  const collected = sources.reduce((sum, source) => sum + source.comment_count, 0);
  const target = sources.reduce((sum, source) => sum + source.max_comments, 0);
  return { collected, target, percent: target > 0 ? Math.min(100, Math.round(collected / target * 100)) : 0 };
}