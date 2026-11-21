/** A reproducible synthesis sample with proportional coverage of each publication. */
export function synthesisSample<T extends { source_id: string; likes: number }>(comments: T[], limit: number): T[] {
  if (comments.length <= limit) return comments;
  const groups = new Map<string, T[]>();
  for (const comment of comments) {
    const group = groups.get(comment.source_id) ?? [];
    group.push(comment);
    groups.set(comment.source_id, group);
  }
  const entries = [...groups.values()];
  const quotas = entries.map((group) => Math.min(group.length, Math.max(1, Math.floor(group.length / comments.length * limit))));
  while (quotas.reduce((sum, quota) => sum + quota, 0) < limit) {
    const i = entries.findIndex((group, index) => group.length > (quotas[index] ?? 0));
    if (i < 0) break;
    quotas[i] = (quotas[i] ?? 0) + 1;
  }
  const out: T[] = [];
  entries.forEach((group, i) => {
    const quota = quotas[i] ?? 0;
    const sorted = [...group].sort((a, b) => b.likes - a.likes);
    const topCount = Math.ceil(quota * 0.3);
    out.push(...sorted.slice(0, topCount));
    const rest = sorted.slice(topCount);
    const spread = quota - topCount;
    for (let j = 0; j < spread; j++) {
      const comment = rest[Math.floor(j * rest.length / spread)];
      if (comment) out.push(comment);
    }
  });
  return out.slice(0, limit);
}