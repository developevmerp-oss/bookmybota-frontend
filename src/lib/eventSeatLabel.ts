/** Format a single event seat as checkout does, e.g. Row A + Seat 12 → "A12", or clean standing pass format. */
export function formatEventSeatCode(item: {
  row_label?: string | null;
  seat_label?: string | null;
}): string {
  const row = String(item.row_label || "").trim();
  const seat = String(item.seat_label || "").trim();

  // If this is a standing general admission pass
  if (/^standing$/i.test(row)) {
    if (/^pass\s*#?\d+$/i.test(seat)) {
      return seat.replace(/^pass\s*#?/i, "Pass #");
    }
    return seat || "Standing Pass";
  }

  if (row && seat) return `${row}${seat}`;
  if (seat) return seat;
  if (row) return row;
  return "";
}

/** Formatted seat summary from booking items.
 *  For standing passes:
 *   - If all items are standing passes: returns "2 Standing Passes" (or "1 Standing Pass", "10 Standing Passes")
 *   - For seated tickets: returns comma-separated unique seat codes (e.g. "A1, A2, A3")
 */
export function eventBookingSeatsLabel(
  items?:
    | Array<{
        row_label?: string | null;
        seat_label?: string | null;
        event_seat_id?: string | null;
        section_name?: string | null;
      }>
    | null
): string {
  if (!items?.length) return "";

  // Check if items are standing general admission passes
  const standingItems = items.filter((item) => {
    const row = String(item.row_label || "").trim();
    const seat = String(item.seat_label || "").trim();
    return /^standing$/i.test(row) || /standing\s*pass/i.test(seat) || /^pass\s*#?\d+$/i.test(seat);
  });

  if (standingItems.length > 0 && standingItems.length === items.length) {
    const count = items.length;
    return `${count} Standing Pass${count === 1 ? "" : "es"}`;
  }

  const seen = new Set<string>();
  const codes: string[] = [];
  for (const item of items) {
    const code = formatEventSeatCode(item);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  return codes.join(", ");
}
