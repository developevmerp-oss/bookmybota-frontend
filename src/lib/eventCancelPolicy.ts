/** Customers may cancel only if the show starts more than 24 hours from now. No refunds. */
export const EVENT_CANCEL_CUTOFF_MS = 24 * 60 * 60 * 1000;

export function canCancelEventTicket(
  startsAt: string | Date | null | undefined,
  status: string
): boolean {
  if (status !== 'CONFIRMED' && status !== 'PENDING') return false;
  if (!startsAt) return false;
  const startMs = new Date(startsAt).getTime();
  if (Number.isNaN(startMs)) return false;
  return startMs - Date.now() >= EVENT_CANCEL_CUTOFF_MS;
}

export const EVENT_CANCEL_CONFIRM_MESSAGE =
  'Cancel this ticket booking? Seats will be released. Ticket price is non-refundable. Cancellation is only allowed until 24 hours before the event.';
