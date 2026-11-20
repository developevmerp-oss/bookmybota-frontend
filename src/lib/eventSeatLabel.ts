/** Format a single event seat as checkout does, e.g. Row A + Seat 12 → "A12". */
export function formatEventSeatCode(item: {
  row_label?: string | null;
  seat_label?: string | null;
}): string {
  const row = String(item.row_label || "").trim();
  const seat = String(item.seat_label || "").trim();
  if (row && seat) return `${row}${seat}`;
  if (seat) return seat;
  if (row) return row;
  return "";
}

/** Comma-separated unique seat codes from booking items (empty when GA / no seats). */
export function eventBookingSeatsLabel(
  items?:
    | Array<{
        row_label?: string | null;
        seat_label?: string | null;
        event_seat_id?: string | null;
      }>
    | null
): string {
  if (!items?.length) return "";
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
