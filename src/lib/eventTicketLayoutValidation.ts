export type TicketTypeInput = {
  ticket_type?: string;
  total_count?: number;
  price?: number;
  max_per_order?: number;
};

export type ShowtimeTicketValidationInput = {
  venue_name?: string;
  layout_mode?: string;
  custom_layout_capacity?: number | null;
  layout_capacity_snapshot?: number | null;
  layout_seat_count_snapshot?: number | null;
  ticket_types?: TicketTypeInput[];
};

export function sumTicketCounts(tickets?: TicketTypeInput[]): number {
  return (tickets || []).reduce((sum, t) => sum + Math.max(0, Number(t.total_count) || 0), 0);
}

/** Effective sellable capacity from layout selection (standard) or custom expected capacity. */
export function resolveEffectiveLayoutCapacity(
  showtime: ShowtimeTicketValidationInput
): number | null {
  const mode = showtime.layout_mode || 'none';
  if (mode === 'custom') {
    const n = Number(showtime.custom_layout_capacity);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  }
  if (mode === 'standard') {
    const seatCount = Number(showtime.layout_seat_count_snapshot);
    const cap = Number(showtime.layout_capacity_snapshot);
    if (Number.isFinite(seatCount) && seatCount > 0) return Math.floor(seatCount);
    if (Number.isFinite(cap) && cap > 0) return Math.floor(cap);
    return null;
  }
  return null;
}

export function getDuplicateTicketTypeNames(tickets?: TicketTypeInput[]): string[] {
  const seen = new Map<string, number>();
  for (const t of tickets || []) {
    const name = String(t.ticket_type || '').trim().toLowerCase();
    if (!name) continue;
    seen.set(name, (seen.get(name) || 0) + 1);
  }
  return [...seen.entries()].filter(([, count]) => count > 1).map(([name]) => name);
}

export function validateShowtimeTickets(
  showtime: ShowtimeTicketValidationInput,
  opts?: { forSubmit?: boolean }
): string | null {
  const forSubmit = opts?.forSubmit === true;
  const venueLabel = showtime.venue_name?.trim() || 'this venue';
  const tickets = showtime.ticket_types || [];

  if (!tickets.length) {
    return `Add at least one ticket type for venue "${venueLabel}".`;
  }

  const dupes = getDuplicateTicketTypeNames(tickets);
  if (dupes.length) {
    return `Duplicate ticket type name(s) for "${venueLabel}": ${dupes.join(', ')}. Use unique names per venue.`;
  }

  let totalTickets = 0;
  for (const t of tickets) {
    const name = String(t.ticket_type || '').trim();
    if (!name) return 'Each ticket type must have a name.';
    const count = Number(t.total_count);
    if (!Number.isFinite(count) || count < 1) {
      return `Total seats for "${name}" must be at least 1.`;
    }
    const price = Number(t.price);
    if (!Number.isFinite(price) || price < 0) {
      return `Price for "${name}" must be 0 or greater.`;
    }
    const maxPer = t.max_per_order == null ? 10 : Number(t.max_per_order);
    if (!Number.isFinite(maxPer) || maxPer < 1) {
      return `Purchase limit for "${name}" must be at least 1.`;
    }
    if (maxPer > count) {
      return `Purchase limit for "${name}" cannot exceed total seats (${count}).`;
    }
    totalTickets += count;
  }

  const mode = showtime.layout_mode || 'none';

  if (mode === 'custom') {
    const cap = Number(showtime.custom_layout_capacity);
    if (forSubmit && (!Number.isFinite(cap) || cap < 1)) {
      return `Enter expected capacity for the custom layout at "${venueLabel}".`;
    }
    if (Number.isFinite(cap) && cap > 0 && totalTickets > cap) {
      return `Total ticket seats (${totalTickets}) exceed custom layout capacity (${cap}) for "${venueLabel}".`;
    }
  }

  if (mode === 'standard') {
    const layoutCap = resolveEffectiveLayoutCapacity(showtime);
    if (forSubmit && !layoutCap) {
      return `Select a published layout with a known seat capacity for "${venueLabel}".`;
    }
    if (layoutCap != null && totalTickets > layoutCap) {
      return `Total ticket seats (${totalTickets}) exceed layout capacity (${layoutCap}) for "${venueLabel}". Reduce ticket counts or choose a larger layout.`;
    }
  }

  return null;
}

export type TicketCapacitySummary = {
  layoutCapacity: number | null;
  totalTickets: number;
  remaining: number | null;
  overCapacity: boolean;
};

export function getTicketCapacitySummary(
  showtime: ShowtimeTicketValidationInput
): TicketCapacitySummary {
  const layoutCapacity = resolveEffectiveLayoutCapacity(showtime);
  const totalTickets = sumTicketCounts(showtime.ticket_types);
  const remaining =
    layoutCapacity != null ? Math.max(0, layoutCapacity - totalTickets) : null;
  return {
    layoutCapacity,
    totalTickets,
    remaining,
    overCapacity: layoutCapacity != null && totalTickets > layoutCapacity,
  };
}
