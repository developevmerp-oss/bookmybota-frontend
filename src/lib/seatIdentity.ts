/**
 * Shared seat identity helpers (movies + events).
 * Prefer UUID when present; fall back to physical section/row/number.
 */

export function normalizeSeatId(id: string): string {
  const clean = String(id || '').trim().toUpperCase();
  const m = clean.match(/^([A-Z]+)0*(\d+)$/);
  return m ? `${m[1]}${m[2]}` : clean;
}

export function physicalSeatKey(parts: {
  section?: string | null;
  row?: string | null;
  number?: string | number | null;
}): string {
  const section = String(parts.section || '')
    .trim()
    .toUpperCase();
  const row = String(parts.row || '')
    .trim()
    .toUpperCase();
  const numRaw = String(parts.number ?? '')
    .trim()
    .replace(/^0+(\d)/, '$1');
  const num = numRaw.toUpperCase();
  if (!row && !num) return '';
  return `${section}|${row}|${num}`;
}

export function seatPhysicalKeyFromAny(s: any): string {
  return physicalSeatKey({
    section: s?.section_name ?? s?.sectionName ?? s?.section,
    row: s?.row_label ?? s?.row,
    number: s?.seat_label ?? s?.seat_number ?? s?.number,
  });
}

export function isSameSeat(
  idA: string,
  idB: string,
  rowA?: string,
  rowB?: string,
  numA?: string | number,
  numB?: string | number,
  sectionA?: string,
  sectionB?: string
): boolean {
  if (!idA && !idB) return false;
  if (idA && idB && String(idA) === String(idB)) return true;
  const normA = normalizeSeatId(String(idA || ''));
  const normB = normalizeSeatId(String(idB || ''));
  if (normA && normB && normA === normB) return true;

  const keyA = physicalSeatKey({ section: sectionA, row: rowA, number: numA });
  const keyB = physicalSeatKey({ section: sectionB, row: rowB, number: numB });
  if (keyA && keyB && keyA === keyB) return true;

  if (rowA && rowB && numA != null && numB != null) {
    const rA = String(rowA).trim().toUpperCase();
    const rB = String(rowB).trim().toUpperCase();
    const nA = Number(String(numA).replace(/^0+/, ''));
    const nB = Number(String(numB).replace(/^0+/, ''));
    if (rA && rB && rA === rB && Number.isFinite(nA) && Number.isFinite(nB) && nA === nB) {
      // Without section, only treat as same if both sections empty/equal
      const sA = String(sectionA || '').trim().toUpperCase();
      const sB = String(sectionB || '').trim().toUpperCase();
      if (!sA || !sB || sA === sB) return true;
    }
  }
  return false;
}

/** Prefer booked/held over available when collapsing duplicates. */
export function dedupeSeatsByPhysicalKey<T extends Record<string, any>>(seats: T[]): T[] {
  const rank = (status: unknown) => {
    const s = String(status || '').toUpperCase();
    if (s === 'BOOKED' || s === 'SOLD') return 3;
    if (s === 'HELD' || s === 'LOCKED' || s === 'RESERVED') return 2;
    if (s === 'AVAILABLE') return 1;
    return 0;
  };

  const map = new Map<string, T>();
  for (const seat of seats) {
    const key =
      seatPhysicalKeyFromAny(seat) ||
      String(seat.id || seat.seat_identifier || seat.internalId || '');
    if (!key) continue;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, seat);
      continue;
    }
    if (rank(seat.status) > rank(prev.status)) {
      map.set(key, seat);
    }
  }
  return Array.from(map.values());
}
