import type { EventDocumentMaster, EventFormPayload, EventGenreMaster } from '@/services/api';
import { validateShowtimeEnd, showtimeEndErrorMessage } from './dateFormat';

export const AGE_GROUP_OPTIONS = ['All Ages', '13+', '16+', '18+', '21+'] as const;

export const LANGUAGE_OPTIONS = [
  'English',
  'Hindi',
  'Gujarati',
  'Marathi',
  'Tamil',
  'Telugu',
  'Multi-language',
];

export function parseEventLanguages(raw?: string | string[] | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function validateEventForm(
  body: EventFormPayload,
  forSubmit: boolean,
  masters?: { genres: EventGenreMaster[]; documents: EventDocumentMaster[] }
): string | null {
  if (!forSubmit) {
    if (body.name !== undefined && !String(body.name).trim()) {
      return 'Event name cannot be empty.';
    }
    return null;
  }

  if (!body.name?.trim()) return 'Event name is required.';
  if (!body.category_type_id) return 'Event category is required.';
  if (!body.about_event?.trim()) return 'About event is required.';
  if (!body.language?.trim() && !(body as { languages?: string[] }).languages?.length) {
    return 'Language is required.';
  }
  if (!body.age_group?.trim()) return 'Age group is required.';
  // Duration is derived from show start/end; require it only when showtimes already define a range.
  {
    const showtimes = body.showtimes ?? [];
    let derived: number | null = null;
    for (const s of showtimes) {
      if (!s.starts_at || !s.ends_at) continue;
      const startMs = new Date(s.starts_at).getTime();
      const endMs = new Date(s.ends_at).getTime();
      if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) continue;
      derived = Math.max(1, Math.round((endMs - startMs) / 60000));
      break;
    }
    const minutes = body.duration_minutes && body.duration_minutes > 0 ? body.duration_minutes : derived;
    if (!minutes || minutes <= 0) {
      return 'Set venue start and end times so event duration can be calculated.';
    }
    body.duration_minutes = minutes;
  }
  if (!body.poster_horizontal_url?.trim()) {
    return 'Horizontal poster is required.';
  }

  if (masters && masters.genres.length > 0) {
    const allowed = new Set(masters.genres.map((g) => g.name));
    if (!body.genres?.length) return 'Select at least one genre for this category.';
    for (const g of body.genres) {
      if (!allowed.has(g)) return `Genre "${g}" is not valid for the selected category.`;
    }
  }

  if (masters) {
    const uploaded = new Set(
      (body.documents ?? []).filter((d) => d.document_type_id > 0).map((d) => d.document_type_id)
    );
    for (const doc of masters.documents) {
      if (doc.is_required && !uploaded.has(doc.id)) {
        return `Required document missing: ${doc.name}.`;
      }
    }
  }

  const tickets = body.ticket_types ?? [];
  if (tickets.length === 0) return 'At least one ticket type is required.';
  for (const t of tickets) {
    if (!t.ticket_type?.trim()) return 'Each ticket type must have a name.';
    if (!t.total_count || t.total_count <= 0) return 'Ticket count must be greater than 0.';
    if (t.price === undefined || t.price === null || Number(t.price) < 0) {
      return 'Ticket price must be 0 or greater.';
    }
    const maxPer =
      (t as { max_per_order?: number }).max_per_order == null
        ? 10
        : Number((t as { max_per_order?: number }).max_per_order);
    if (!Number.isFinite(maxPer) || maxPer < 1) {
      return `Purchase limit for "${t.ticket_type}" must be at least 1.`;
    }
    if (maxPer > Number(t.total_count)) {
      return `Purchase limit for "${t.ticket_type}" cannot exceed total seats.`;
    }
  }

  const showtimes = body.showtimes ?? [];
  if (showtimes.length === 0) return 'At least one venue / showtime is required.';
  for (const s of showtimes) {
    if (!s.venue_name?.trim()) return 'Venue name is required for each showtime.';
    if (!s.starts_at) return 'Show start date/time is required.';
    const endCheck = validateShowtimeEnd(s.starts_at, s.ends_at || '');
    const endMsg = showtimeEndErrorMessage(endCheck);
    if (endMsg) return endMsg;
  }

  return null;
}

export { toDatetimeLocal, fromDatetimeLocal, formatDate, formatDateTime12h } from './dateFormat';
