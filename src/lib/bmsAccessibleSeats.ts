/** Detect accessibility / wheelchair seats from layout seat objects. */

export function seatHasAccessibleFlag(seat: unknown): boolean {
  if (!seat || typeof seat !== "object") return false;
  const s = seat as Record<string, unknown>;
  if (
    s.is_accessible === true ||
    s.accessible === true ||
    s.isAccessible === true ||
    s.wheelchair === true ||
    s.is_wheelchair === true
  ) {
    return true;
  }
  const seatType = String(s.seat_type || s.type || s.category || "").toLowerCase();
  if (
    seatType.includes("wheelchair") ||
    seatType.includes("accessible") ||
    seatType.includes("handicap") ||
    seatType.includes("disabled") ||
    seatType.includes("companion")
  ) {
    return true;
  }
  const tags = s.tags;
  if (Array.isArray(tags)) {
    return tags.some((t) => {
      const v = String(t).toLowerCase();
      return (
        v.includes("wheelchair") ||
        v.includes("accessible") ||
        v.includes("handicap") ||
        v.includes("disabled")
      );
    });
  }
  if (typeof tags === "string") {
    const v = tags.toLowerCase();
    return (
      v.includes("wheelchair") ||
      v.includes("accessible") ||
      v.includes("handicap") ||
      v.includes("disabled")
    );
  }
  return false;
}
