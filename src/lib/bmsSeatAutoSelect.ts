/**
 * BookMyShow-style contiguous seat auto-select.
 *
 * When the user has chosen a ticket count N and taps a seat:
 * - Prefer a contiguous available block of size N on the same row
 *   (fill right first, then left; never jump aisles).
 * - If fewer than N are free in that segment, return the largest
 *   contiguous block including the clicked seat (caller can let the
 *   user fill the remainder with another tap on another row).
 */

export type BmsSeatLike = {
  id: string;
  isBooked: boolean;
  /** Gap after this seat before the next (aisle). */
  gapAfter?: number;
  /** Alternate flag used by movie grid (gap after this seat). */
  isAisleGap?: boolean;
};

function hasAisleAfter(seat: BmsSeatLike): boolean {
  if (typeof seat.gapAfter === "number") return seat.gapAfter >= 2;
  return Boolean(seat.isAisleGap);
}

/** Split a row into segments that do not cross aisle gaps. */
export function splitRowByAisles<T extends BmsSeatLike>(
  rowSeats: T[]
): Array<{ seats: T[]; offset: number }> {
  const segments: Array<{ seats: T[]; offset: number }> = [];
  let buf: T[] = [];
  let bufStart = 0;
  for (let i = 0; i < rowSeats.length; i++) {
    if (buf.length === 0) bufStart = i;
    buf.push(rowSeats[i]);
    if (hasAisleAfter(rowSeats[i]) || i === rowSeats.length - 1) {
      segments.push({ seats: buf, offset: bufStart });
      buf = [];
    }
  }
  if (buf.length) segments.push({ seats: buf, offset: bufStart });
  return segments;
}

/**
 * Pick contiguous available seats of size `need` in `rowSeats` that include `clickIndex`.
 * Returns [] if the clicked seat is booked / invalid.
 */
export function pickContiguousBlock<T extends BmsSeatLike>(
  rowSeats: T[],
  clickIndex: number,
  need: number
): T[] {
  if (!rowSeats.length || need < 1) return [];
  if (clickIndex < 0 || clickIndex >= rowSeats.length) return [];
  if (rowSeats[clickIndex].isBooked) return [];

  const segments = splitRowByAisles(rowSeats);
  const segment = segments.find(
    (seg) => clickIndex >= seg.offset && clickIndex < seg.offset + seg.seats.length
  );
  if (!segment) return [];

  const localIdx = clickIndex - segment.offset;
  const segSeats = segment.seats;
  const qty = Math.min(Math.max(1, need), segSeats.length);

  if (qty === 1) return [segSeats[localIdx]];

  const windows: Array<{ block: T[]; start: number }> = [];
  for (let start = 0; start <= segSeats.length - qty; start++) {
    const end = start + qty - 1;
    if (localIdx < start || localIdx > end) continue;
    const block = segSeats.slice(start, start + qty);
    if (block.every((s) => !s.isBooked)) windows.push({ block, start });
  }

  if (windows.length > 0) {
    const fillRight = windows.find((w) => w.start === localIdx);
    if (fillRight) return fillRight.block;
    const fillLeft = windows.find((w) => w.start + qty - 1 === localIdx);
    if (fillLeft) return fillLeft.block;
    windows.sort((a, b) => {
      const aCenter = a.start + (qty - 1) / 2;
      const bCenter = b.start + (qty - 1) / 2;
      return Math.abs(localIdx - aCenter) - Math.abs(localIdx - bCenter);
    });
    return windows[0].block;
  }

  // Partial contiguous fill: right first, then left
  const partial: T[] = [segSeats[localIdx]];
  for (let i = localIdx + 1; i < segSeats.length && partial.length < qty; i++) {
    if (segSeats[i].isBooked) break;
    partial.push(segSeats[i]);
  }
  for (let i = localIdx - 1; i >= 0 && partial.length < qty; i--) {
    if (segSeats[i].isBooked) break;
    partial.unshift(segSeats[i]);
  }
  return partial;
}
