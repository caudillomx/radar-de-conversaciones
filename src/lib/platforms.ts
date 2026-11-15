export type Platform = "instagram" | "tiktok" | "youtube" | "facebook" | "x";

export const PLATFORMS: Record<Platform, { label: string; short: string }> = {
  instagram: { label: "Instagram", short: "IG" },
  tiktok: { label: "TikTok", short: "TT" },
  youtube: { label: "YouTube", short: "YT" },
  facebook: { label: "Facebook", short: "FB" },
  x: { label: "X / Twitter", short: "X" },
};

const HOSTS: [RegExp, Platform][] = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)(facebook\.com|fb\.watch|fb\.com)$/, "facebook"],
  [/(^|\.)(x\.com|twitter\.com)$/, "x"],
];

// Post-level path patterns per platform (profiles/home pages are rejected).
const POST_PATHS: Record<Platform, RegExp[]> = {
  instagram: [/^\/(p|reel|reels|tv)\/[\w-]+/],
  tiktok: [/^\/@[\w.-]+\/(video|photo)\/\d+/, /^\/t\/\w+/, /^\/\w{6,}\/?$/],
  youtube: [/^\/watch$/, /^\/shorts\/[\w-]+/, /^\/live\/[\w-]+/, /^\/[\w-]{11}$/],
  facebook: [/\/posts\//, /\/videos\//, /^\/watch/, /^\/reel\//, /^\/permalink\.php/, /^\/share\/[prv]\//, /^\/story\.php/, /^\/photo/, /^\/[\w-]+$/],
  x: [/^\/\w{1,15}\/status\/\d+/],
};

export type ParsedUrl =
  | { ok: true; url: string; platform: Platform; postId: string | null; host: string }
  | { ok: false; input: string; reason: string; platform?: Platform };

export function parseSocialUrl(raw: string): ParsedUrl {
  const input = raw.trim();
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return { ok: false, input, reason: "No es una URL válida" };
  }
  const host = u.hostname.toLowerCase().replace(/^(www|m|mobile|vm|vt)\./, "");
  const match = HOSTS.find(([re]) => re.test(host));
  if (!match) return { ok: false, input, reason: "Plataforma no soportada" };
  const platform = match[1];
  const path = u.pathname.replace(/\/+$/, "") || "/";
  let ok = POST_PATHS[platform].some((re) => re.test(path));
  if (platform === "youtube" && path === "/watch") ok = !!u.searchParams.get("v");
  if (platform === "tiktok" && /^(vm|vt)\./.test(u.hostname)) ok = path.length > 1;
  if (!ok) return { ok: false, input, platform, reason: "Parece un perfil o página, no una publicación" };
  return { ok: true, url: u.toString(), platform, host, postId: extractId(platform, u, path) };
}

function extractId(p: Platform, u: URL, path: string): string | null {
  const seg = path.split("/").filter(Boolean);
  switch (p) {
    case "instagram": return seg[1] ?? null;
    case "tiktok": return seg[2] ?? seg.at(-1) ?? null;
    case "youtube": return u.searchParams.get("v") ?? seg.at(-1) ?? null;
    case "x": return seg[2] ?? null;
    case "facebook": return u.searchParams.get("story_fbid") ?? u.searchParams.get("v") ?? seg.at(-1) ?? null;
  }
}

export function splitUrls(text: string): string[] {
  return text.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
}
