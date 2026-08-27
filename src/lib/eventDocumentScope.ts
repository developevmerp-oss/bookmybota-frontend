import type { EventDocumentMaster } from "@/services/api";

export type EventDocumentAppliesTo = "event" | "venue" | "artist";

/** Prefer DB `applies_to`; fall back to name heuristics for older rows. */
export function resolveDocumentAppliesTo(doc: {
  name?: string | null;
  applies_to?: string | null;
}): EventDocumentAppliesTo {
  const scoped = String(doc.applies_to || "")
    .trim()
    .toLowerCase();
  if (scoped === "venue" || scoped === "artist" || scoped === "event") {
    return scoped;
  }

  const name = String(doc.name || "").toLowerCase();
  if (/\bartist\b/.test(name)) return "artist";
  if (
    /\bvenue\b/.test(name) ||
    /\blease\b/.test(name) ||
    /\boccupancy\b/.test(name) ||
    /\bcapacity certificate\b/.test(name) ||
    /\bfire safety\b/.test(name) ||
    /\bstructural\b/.test(name) ||
    /\baccessibility\b/.test(name)
  ) {
    return "venue";
  }
  return "event";
}

export function filterDocumentsByAppliesTo(
  documents: EventDocumentMaster[] | undefined,
  appliesTo: EventDocumentAppliesTo
): EventDocumentMaster[] {
  return (documents || []).filter((d) => resolveDocumentAppliesTo(d) === appliesTo);
}

export function countWords(text: string | null | undefined): number {
  const trimmed = String(text || "").trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/** Live character count for About event (includes spaces the user typed). */
export function countChars(text: string | null | undefined): number {
  return String(text || "").length;
}
