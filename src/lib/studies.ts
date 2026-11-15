import { useSyncExternalStore } from "react";
import type { Platform } from "./platforms";

export type SourceStatus = "pendiente" | "lista" | "extrayendo" | "extraida" | "error";
export type Source = {
  id: string; url: string; platform: Platform; postId: string | null;
  addedAt: string; status: SourceStatus; maxComments: number; includeReplies: boolean; note?: string;
};
export type StudyKind = "quick" | "deep";
export type Study = {
  id: string; kind?: StudyKind; title: string; topic: string; client?: string | undefined;
  createdAt: string; updatedAt: string; sources: Source[];
};

const KEY = "kimedia.studies.v1";
const listeners = new Set<() => void>();
let cache: Study[] | null = null;
const EMPTY: Study[] = [];

function read(): Study[] {
  if (typeof window === "undefined") return EMPTY;
  if (!cache) {
    try { cache = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { cache = []; }
  }
  return cache!;
}
function write(next: Study[]) {
  cache = next;
  localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}
const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

export function useStudies() {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), read, () => EMPTY);
}
export function useStudy(id: string) {
  return useStudies().find((s) => s.id === id);
}
export function createStudy(data: { title: string; topic: string; client?: string | undefined; kind?: StudyKind }) {
  const s: Study = { id: uid(), kind: "deep", ...data, createdAt: now(), updatedAt: now(), sources: [] };
  write([s, ...read()]);
  return s;
}
export function deleteStudy(id: string) { write(read().filter((s) => s.id !== id)); }
function patch(id: string, fn: (s: Study) => Study) {
  write(read().map((s) => (s.id === id ? { ...fn(s), updatedAt: now() } : s)));
}
export function addSources(id: string, items: Omit<Source, "id" | "addedAt" | "status" | "maxComments" | "includeReplies">[]) {
  patch(id, (s) => {
    const seen = new Set(s.sources.map((x) => x.url));
    const fresh = items.filter((i) => !seen.has(i.url)).map((i) => ({
      ...i, id: uid(), addedAt: now(), status: "pendiente" as const, maxComments: 500, includeReplies: true,
    }));
    return { ...s, sources: [...s.sources, ...fresh] };
  });
}
export function updateSource(id: string, sid: string, p: Partial<Source>) {
  patch(id, (s) => ({ ...s, sources: s.sources.map((x) => (x.id === sid ? { ...x, ...p } : x)) }));
}
export function removeSource(id: string, sid: string) {
  patch(id, (s) => ({ ...s, sources: s.sources.filter((x) => x.id !== sid) }));
}

export const kindOf = (s: Study): StudyKind => s.kind ?? "deep";

/** Quick Pulse: no form, 1–2 URLs, auto-titled, ready immediately. */
export function createQuickPulse(items: { url: string; platform: Platform; postId: string | null }[]) {
  const s = createStudy({ title: `Pulso · ${new Date().toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`, topic: "", kind: "quick" });
  addSources(s.id, items);
  read().find((x) => x.id === s.id)!.sources.forEach((src) => updateSource(s.id, src.id, { status: "lista", maxComments: 250 }));
  return s;
}
