/**
 * BookMyShow-style “Bestseller” seats: same price, orange outline when available.
 *
 * - Super Admin marks seats manually or via “Auto-mark” in the layout editor.
 * - Customer map only shows bestsellers when seats have an explicit flag.
 * - If a cinema never uses bestsellers, seats still book normally (no orange marks).
 */

import { splitRowByAisles, type BmsSeatLike } from "@/lib/bmsSeatAutoSelect";

export function seatHasExplicitBestsellerFlag(seat: unknown): boolean {
  if (!seat || typeof seat !== "object") return false;
  const s = seat as Record<string, unknown>;
  if (s.is_bestseller === true || s.bestseller === true || s.isBestseller === true) {
    return true;
  }
  const seatType = String(s.seat_type || s.type || "").toLowerCase();
  if (seatType.includes("bestseller") || seatType.includes("best-seller")) return true;
  const tags = s.tags;
  if (Array.isArray(tags)) {
    return tags.some((t) => String(t).toLowerCase().includes("bestseller"));
  }
  if (typeof tags === "string") {
    return tags.toLowerCase().includes("bestseller");
  }
  return false;
}

type MarkableSeat = BmsSeatLike & { isBestseller?: boolean };

/**
 * Auto-mark middle seats of each aisle block (leave first & last unmarked).
 * Segments shorter than 3 seats are skipped.
 */
export function markAutoBestsellersInRow<T extends MarkableSeat>(seats: T[]): T[] {
  if (!seats.length) return seats;
  const next = seats.map((s) => ({ ...s, isBestseller: false }));
  const segments = splitRowByAisles(next);
  for (const seg of segments) {
    if (seg.seats.length < 3) continue;
    for (let i = 1; i < seg.seats.length - 1; i++) {
      const idx = seg.offset + i;
      next[idx] = { ...next[idx], isBestseller: true };
    }
  }
  return next;
}

/**
 * Customer / display: only keep explicit bestseller flags (no silent auto-mark).
 * Cinemas that never set bestsellers simply show normal green available seats.
 */
export function finalizeBestsellerMarks<T extends MarkableSeat>(
  rows: Array<{ seats: T[] } & Record<string, unknown>>
): Array<{ seats: T[] } & Record<string, unknown>> {
  return rows.map((row) => ({
    ...row,
    seats: row.seats.map((s) => ({ ...s, isBestseller: Boolean(s.isBestseller) })),
  }));
}

/** Customer canvas path: read flags only — never invent bestsellers. */
export function applyBestsellerFlagsToRawSeats<T extends Record<string, unknown>>(
  seats: T[]
): Array<T & { is_bestseller: boolean }> {
  return seats.map((s) => ({
    ...s,
    is_bestseller: seatHasExplicitBestsellerFlag(s),
  }));
}

/**
 * Layout editor “Auto-mark bestsellers”: mid seats of each row/aisle block.
 * Always recomputes from geometry (clears previous then applies).
 */
export function autoAssignBestsellersToRawSeats<T extends Record<string, unknown>>(
  seats: T[]
): Array<T & { is_bestseller: boolean }> {
  if (!seats.length) return [];

  const result = seats.map((s) => ({ ...s, is_bestseller: false }));
  const groups = new Map<string, number[]>();
  result.forEach((s, idx) => {
    const key = `${String(s.section_name || "")}::${String(s.row_label || "")}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(idx);
  });

  for (const indices of groups.values()) {
    if (indices.length < 3) continue;
    const ordered = [...indices].sort((a, b) => {
      const ax = Number(result[a].coordinate_x ?? a);
      const bx = Number(result[b].coordinate_x ?? b);
      return ax - bx;
    });
    const steps: number[] = [];
    for (let i = 0; i < ordered.length - 1; i++) {
      const diff =
        Number(result[ordered[i + 1]].coordinate_x ?? 0) -
        Number(result[ordered[i]].coordinate_x ?? 0);
      if (diff > 5) steps.push(diff);
    }
    const normalStep = steps.length > 0 ? Math.min(...steps) : 40;

    let segment: number[] = [];
    const flush = () => {
      if (segment.length >= 3) {
        for (let i = 1; i < segment.length - 1; i++) {
          result[segment[i]] = { ...result[segment[i]], is_bestseller: true };
        }
      }
      segment = [];
    };

    for (let i = 0; i < ordered.length; i++) {
      segment.push(ordered[i]);
      const isLast = i === ordered.length - 1;
      const gap =
        !isLast &&
        Number(result[ordered[i + 1]].coordinate_x ?? 0) -
          Number(result[ordered[i]].coordinate_x ?? 0) >
          normalStep * 1.6;
      if (isLast || gap) flush();
    }
  }

  return result;
}
