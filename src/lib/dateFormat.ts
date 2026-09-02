/**
 * Project-wide date/time display: MM-DD-YYYY + 12-hour clock.
 * Storage/API continues to use ISO 8601; use these helpers for all UI display.
 */

const DISPLAY_LOCALE = 'en-US';

/** MM-DD-YYYY */
export function formatDate(value?: string | Date | null): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

/** MM-DD-YYYY, h:mm AM/PM */
export function formatDateTime12h(value?: string | Date | null): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const time = d.toLocaleTimeString(DISPLAY_LOCALE, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${formatDate(d)}, ${time}`;
}

/** h:mm AM/PM only */
export function formatTime12h(value?: string | Date | null): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(DISPLAY_LOCALE, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Convert stored HH:mm (24h) to 12-hour display, e.g. "18:57" → "6:57 PM" */
export function formatHm12h(hm?: string | null): string {
  if (!hm?.trim()) return '—';
  const match = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!match) return hm.trim();
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return hm.trim();
  const d = new Date(2000, 0, 1, hours, minutes);
  return formatTime12h(d);
}

/** Convert ISO / Date to `datetime-local` input value (YYYY-MM-DDTHH:mm) */
export function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convert `datetime-local` value to ISO string for API */
export function fromDatetimeLocal(val: string): string {
  if (!val) return '';
  return new Date(val).toISOString();
}

export function fromDateAndTime(dateYmd: string, timeHm: string): string {
  if (!dateYmd || !timeHm) return '';
  return fromDatetimeLocal(`${dateYmd}T${timeHm}`);
}

export function toDateInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toTimeInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function inferDurationType(startsAt?: string | null, endsAt?: string | null): 'ONE_DAY' | 'MULTI_DAY' {
  if (!startsAt || !endsAt) return 'ONE_DAY';
  const a = new Date(startsAt);
  const b = new Date(endsAt);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 'ONE_DAY';
  return a.toDateString() === b.toDateString() ? 'ONE_DAY' : 'MULTI_DAY';
}

export type ShowtimeEndValidation = 'ok' | 'missing_start' | 'before_start' | 'same_as_start';

/** Validate end vs start for a single showtime row */
export function validateShowtimeEnd(startsAt: string, endsAt: string): ShowtimeEndValidation {
  if (!endsAt) return 'ok';
  if (!startsAt) return 'missing_start';
  const startMs = new Date(startsAt).getTime();
  const endMs = new Date(endsAt).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 'ok';
  if (endMs < startMs) return 'before_start';
  if (endMs === startMs) return 'same_as_start';
  return 'ok';
}

export function showtimeEndErrorMessage(result: ShowtimeEndValidation): string | null {
  switch (result) {
    case 'before_start':
      return 'End date & time cannot be before the start date & time.';
    case 'same_as_start':
      return 'End date & time cannot be the same as the start. Please set a later end time.';
    case 'missing_start':
      return 'Set the start date & time before choosing an end time.';
    default:
      return null;
  }
}
