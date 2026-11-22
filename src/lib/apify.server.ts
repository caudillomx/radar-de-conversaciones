import type { Platform } from "./platforms";

const GATEWAY = "https://connector-gateway.lovable.dev/apify";

function headers() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const apify = process.env["APIFY_API_KEY"];
  if (!lovable) throw new Error("El motor de extracción no está configurado");
  if (!apify) throw new Error("El motor de extracción no está vinculado");
  return { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": apify, "Content-Type": "application/json" };
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${GATEWAY}${path}`, { ...init, headers: { ...headers(), ...(init.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Apify ${path} [${res.status}]: ${body}`);
        throw new Error(res.status === 402 ? "El motor de extracción no tiene saldo suficiente" : res.status === 429 ? "El motor de extracción está saturado, intenta en un momento" : `Error del motor de extracción (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** Specialized Actor per platform. */
export const ACTORS: Record<Platform, string> = {
  youtube: "streamers~youtube-comments-scraper",
  tiktok: "clockworks~tiktok-comments-scraper",
  instagram: "apify~instagram-comment-scraper",
  facebook: "apify~facebook-comments-scraper",
  x: "apidojo~twitter-scraper-lite",
};

export function buildInput(p: Platform, url: string, postId: string | null, max: number, replies: boolean) {
  switch (p) {
    case "youtube": return { startUrls: [{ url }], maxComments: max };
    case "tiktok": return { postURLs: [url], commentsPerPost: max, maxRepliesPerComment: replies ? 10 : 0 };
    case "instagram": return { directUrls: [url], resultsLimit: max, includeNestedComments: replies };
    case "facebook": return { startUrls: [{ url }], resultsLimit: max, includeNestedComments: replies };
    // Search both indexes: Latest alone can exhaust after a few hundred replies.
    // The actor may emit duplicates; syncExtraction deduplicates by external ID.
    case "x": return { searchTerms: xSearchTerms(postId ?? ""), maxItems: max, sort: "Latest + Top", includeSearchTerms: true, deliverMode: "perPost" };
  }
}

/** X caps each search at a few hundred results; time slices from the post's
 * snowflake timestamp recover many more replies (2h slices for 24h, 12h to 72h, then open). */
export function xSearchTerms(postId: string): string[] {
  const base = `conversation_id:${postId}`;
  let start: number;
  try { start = Math.floor((Number(BigInt(postId) >> 22n) + 1288834974657) / 1000); } catch { return [base]; }
  if (!Number.isFinite(start) || start < 1.2e9) return [base];
  const H = 3600, terms: string[] = [];
  let t = start - H;
  while (t < start + 24 * H) { terms.push(`${base} since_time:${t} until_time:${t + 2 * H}`); t += 2 * H; }
  while (t < start + 72 * H) { terms.push(`${base} since_time:${t} until_time:${t + 12 * H}`); t += 12 * H; }
  terms.push(`${base} since_time:${t}`);
  return terms;
}

type Run = { id: string; status: string; defaultDatasetId: string; statusMessage?: string };

export async function startRun(p: Platform, input: unknown, max: number) {
  const { data } = await call<{ data: Run }>(`/acts/${ACTORS[p]}/runs?maxItems=${max + 50}`, { method: "POST", body: JSON.stringify(input) });
  return data;
}
export async function getRun(runId: string) {
  return (await call<{ data: Run }>(`/actor-runs/${runId}`)).data;
}
export async function getItems(datasetId: string, limit: number) {
  return call<Record<string, unknown>[]>(`/datasets/${datasetId}/items?clean=true&limit=${limit}`);
}

export type NormalizedComment = {
  external_id: string | null; author: string | null; text: string; published_at: string | null;
  likes: number; url: string | null; is_reply: boolean; parent_external_id: string | null;
};

const pick = (o: Record<string, any>, ...keys: string[]) => {
  for (const k of keys) {
    const v = k.split(".").reduce<any>((a, s) => (a == null ? a : a[s]), o);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
};
const toDate = (v: unknown) => {
  if (v == null) return null;
  const d = typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v) : new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
};

export function normalize(p: Platform, item: Record<string, any>, sourcePostId: string | null): NormalizedComment | null {
  const text = pick(item, "text", "comment", "content", "fullText", "commentText");
  if (!text || typeof text !== "string") return null;
  const id = pick(item, "cid", "id", "commentId", "comment_id");
  let parent = pick(item, "repliesToId", "replyToCid", "parentId", "parentCommentId", "inReplyToId", "replyToId");
  let isReply = !!parent || item["type"] === "reply" || (typeof item["threadingDepth"] === "number" && item["threadingDepth"] > 0);
  if (p === "x") {
    if (String(id) === String(sourcePostId)) return null; // the original tweet itself
    isReply = true; parent = parent ?? sourcePostId;
  }
  return {
    external_id: id != null ? String(id) : null,
    author: pick(item, "author.userName", "author.name", "uniqueId", "ownerUsername", "profileName", "author", "user.uniqueId", "authorName"),
    text,
    published_at: toDate(pick(item, "createTimeISO", "createdAt", "timestamp", "date", "publishedAt", "createTime")),
    likes: Number(pick(item, "likeCount", "diggCount", "likesCount", "voteCount", "likes") ?? 0) || 0,
    url: pick(item, "commentUrl", "url", "twitterUrl"),
    is_reply: isReply,
    parent_external_id: parent != null ? String(parent) : null,
  };
}
