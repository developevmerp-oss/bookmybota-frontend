/** Resolve display label for a marketing campaign target (frontend-only, no API shape changes). */

type TargetLike = {
  target_type?: string | null;
  target_id?: string | null;
};

function lookupName(
  id: string | null | undefined,
  map?: Map<string, string> | Record<string, string>
): string {
  if (!id || !map) return "";
  if (map instanceof Map) return map.get(String(id)) || "";
  return map[String(id)] || "";
}

/** Movie / event name when targeted; otherwise a short scope label. */
export function promotionTargetLabel(
  camp: TargetLike,
  lookups?: {
    movieTitleById?: Map<string, string> | Record<string, string>;
    eventNameById?: Map<string, string> | Record<string, string>;
  }
): string {
  const targetType = String(camp.target_type || "BUSINESS").toUpperCase();
  const tid = camp.target_id ? String(camp.target_id) : "";

  if (targetType === "MOVIE") {
    return lookupName(tid, lookups?.movieTitleById) || "Single movie";
  }
  if (targetType === "EVENT") {
    return lookupName(tid, lookups?.eventNameById) || "Single event";
  }
  return "Whole business";
}
