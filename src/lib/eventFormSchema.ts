import * as yup from 'yup';
import {
  fromDateAndTime,
  fromDatetimeLocal,
  showtimeEndErrorMessage,
  validateShowtimeEnd,
} from './dateFormat';
import { parseYouTubeId } from './youtube';
import { countChars } from './eventDocumentScope';

/** About event limit — characters so the counter rises as the user types. */
export const MAX_ABOUT_EVENT_CHARS = 2500;
/** @deprecated use MAX_ABOUT_EVENT_CHARS */
export const MAX_ABOUT_EVENT_WORDS = MAX_ABOUT_EVENT_CHARS;
const MAX_ABOUT_CHARS = MAX_ABOUT_EVENT_CHARS;
const aboutCharsTest = (value: string | undefined) => countChars(value) <= MAX_ABOUT_CHARS;

const ticketSchema = yup.object({
  ticket_type: yup.string().trim().required('Ticket type name is required'),
  total_count: yup
    .number()
    .typeError('Total seats must be a number')
    .integer('Total seats must be a whole number')
    .min(1, 'Total seats must be at least 1')
    .required('Total seats is required'),
  price: yup
    .number()
    .typeError('Price must be a number')
    .min(0, 'Price cannot be negative')
    .required('Price is required'),
  max_per_order: yup
    .number()
    .typeError('Purchase limit must be a number')
    .integer('Purchase limit must be a whole number')
    .min(1, 'Purchase limit must be at least 1')
    .default(10)
    .test('lte-total', 'Purchase limit cannot exceed total seats', function (value) {
      const total = Number(this.parent?.total_count);
      if (!Number.isFinite(total) || value == null) return true;
      return Number(value) <= total;
    }),
});

const showtimeSchema = yup.object({
  venue_name: yup.string().trim().required('Venue name is required'),
  venue_address: yup.string().trim().default(''),
  city_id: yup
    .number()
    .nullable()
    .transform((value, original) => (original === '' || original === null || original === undefined ? null : value))
    .default(null),
  venue_source: yup.string().oneOf(['manual', 'registered', 'auto_registered']).default('manual'),
  venue_business_id: yup.string().nullable().default(null),
  venue_layout_template_id: yup.string().nullable().default(null),
  layout_mode: yup.string().oneOf(['none', 'standard', 'custom']).default('none'),
  custom_layout_name: yup.string().trim().default(''),
  custom_layout_type: yup.string().trim().default('custom'),
  custom_layout_capacity: yup
    .number()
    .nullable()
    .transform((value, original) => (original === '' || original === null || original === undefined ? null : value))
    .default(null),
  custom_layout_notes: yup.string().trim().default(''),
  custom_layout_images: yup.array().of(yup.string().required()).default([]),
  location_id: yup
    .number()
    .nullable()
    .transform((value, original) => (original === '' || original === null || original === undefined ? null : value))
    .default(null),
  venue_proposal: yup
    .object({
      contact_name: yup.string().default(''),
      contact_phone: yup.string().default(''),
      contact_email: yup.string().default(''),
      capacity: yup.number().nullable().default(null),
      facilities: yup.array().of(yup.string().required()).default([]),
      image_urls: yup.array().of(yup.string().required()).default([]),
      notes: yup.string().default(''),
    })
    .nullable()
    .default(null),
  duration_type: yup.string().oneOf(['ONE_DAY', 'MULTI_DAY']).default('ONE_DAY'),
  event_date: yup.string().default(''),
  start_time: yup.string().default(''),
  end_time: yup.string().default(''),
  starts_at: yup.string().default(''),
  ends_at: yup.string().default(''),
  ticket_types: yup.array().of(ticketSchema).default([]),
});

const artistSchema = yup.object({
  artist_source: yup.string().oneOf(['registered', 'external', 'auto_registered']).default('external'),
  artist_business_id: yup.string().nullable().default(null),
  name: yup.string().trim().required('Name is required'),
  role_title: yup
    .string()
    .oneOf(['Artist', 'Guest', 'Chief Guest'], 'Select Artist, Guest, or Chief Guest')
    .required('Select Artist, Guest, or Chief Guest')
    .default('Artist'),
  description: yup.string().trim().default(''),
  image_url: yup.string().trim().default(''),
  documents: yup
    .array()
    .of(
      yup.object({
        document_type_id: yup.number().default(0),
        url: yup.string().required(),
        document_name: yup.string().default(''),
      })
    )
    .default([]),
  sort_order: yup.number().default(0),
});

/** Lineup person types shown on the event artists step. */
export const EVENT_LINEUP_ROLES = ['Artist', 'Guest', 'Chief Guest'] as const;
export type EventLineupRole = (typeof EVENT_LINEUP_ROLES)[number];

export function normalizeLineupRole(role?: string | null): EventLineupRole {
  const r = String(role || '').trim();
  if (r === 'Artist' || r === 'Guest' || r === 'Chief Guest') return r;
  if (/chief\s*guest/i.test(r)) return 'Chief Guest';
  if (/^guest$/i.test(r)) return 'Guest';
  return 'Artist';
}

export function isArtistLineupRole(role?: string | null): boolean {
  return normalizeLineupRole(role) === 'Artist';
}

function showtimeRangeIso(s: {
  duration_type?: string;
  event_date?: string;
  start_time?: string;
  end_time?: string;
  starts_at?: string;
  ends_at?: string;
}): { start: string; end: string } {
  if (s.duration_type === 'MULTI_DAY') {
    return {
      start: s.starts_at ? fromDatetimeLocal(s.starts_at) : '',
      end: s.ends_at ? fromDatetimeLocal(s.ends_at) : '',
    };
  }
  return {
    start: fromDateAndTime(s.event_date || '', s.start_time || ''),
    end: fromDateAndTime(s.event_date || '', s.end_time || ''),
  };
}

/** Add minutes to an ISO datetime; returns ISO string. */
export function addMinutesToIso(iso: string, minutes: number): string {
  if (!iso || !Number.isFinite(minutes) || minutes <= 0) return '';
  const startMs = new Date(iso).getTime();
  if (Number.isNaN(startMs)) return '';
  return new Date(startMs + minutes * 60000).toISOString();
}

/**
 * Resolve showtime start/end ISO.
 * When end is blank, derive it from start + durationMinutes (single-event flow).
 */
export function showtimeToIso(
  s: {
    duration_type?: string;
    event_date?: string;
    start_time?: string;
    end_time?: string;
    starts_at?: string;
    ends_at?: string;
  },
  durationMinutes?: number | null
): { starts_at: string; ends_at: string } {
  const { start, end } = showtimeRangeIso(s);
  if (end) return { starts_at: start, ends_at: end };
  const mins = Number(durationMinutes) || 0;
  if (start && mins > 0) {
    return { starts_at: start, ends_at: addMinutesToIso(start, mins) };
  }
  return { starts_at: start, ends_at: end };
}

export const eventDraftSchema = yup.object({
  name: yup.string().trim().default(''),
  category_type_id: yup.number().nullable().default(null),
  genres: yup.array().of(yup.string().required()).default([]),
  poster_horizontal_url: yup.string().default(''),
  poster_vertical_url: yup.string().default(''),
  gallery_images: yup.array().of(yup.string().required()).default([]),
  youtube_url: yup
    .string()
    .default('')
    .test('youtube', 'Enter a valid YouTube video link', (value) => {
      if (!value?.trim()) return true;
      return Boolean(parseYouTubeId(value));
    }),
  languages: yup.array().of(yup.string().required()).default([]),
  about_event: yup
    .string()
    .default('')
    .test('max-chars', `About event cannot exceed ${MAX_ABOUT_CHARS} characters.`, aboutCharsTest),
  age_group: yup.string().default(''),
  duration_minutes: yup
    .number()
    .nullable()
    .transform((value, original) => (original === '' || original === null || original === undefined ? null : value))
    .min(1, 'Duration must be at least 1 minute')
    .default(null),
  allowed_ticket_modes: yup
    .array()
    .of(yup.string().oneOf(['M_TICKET', 'BOX_OFFICE', 'PHYSICAL_DELIVERY']).required())
    .default([]),
  category_meta: yup.object().default({}),
  showtimes: yup.array().of(showtimeSchema).default([]),
  artists: yup.array().of(artistSchema).default([]),
});

export const eventSubmitSchema = eventDraftSchema.shape({
  name: yup.string().trim().required('Event name is required'),
  category_type_id: yup.number().required('Event category is required'),
  genres: yup.array().of(yup.string().required()).min(1, 'Select at least one genre'),
  poster_horizontal_url: yup.string().trim().required('Horizontal poster is required'),
  languages: yup.array().of(yup.string().required()).min(1, 'Select at least one language'),
  about_event: yup
    .string()
    .trim()
    .required('About event is required')
    .test('max-chars', `About event cannot exceed ${MAX_ABOUT_CHARS} characters.`, aboutCharsTest),
  age_group: yup.string().trim().required('Age group is required'),
  duration_minutes: yup
    .number()
    .nullable()
    .transform((value, original) => (original === '' || original === null || original === undefined ? null : value))
    .default(null)
    .test('positive-or-null', 'Duration must be at least 1 minute', (v) => v == null || Number(v) >= 1),
  allowed_ticket_modes: yup
    .array()
    .of(yup.string().oneOf(['M_TICKET', 'BOX_OFFICE', 'PHYSICAL_DELIVERY']).required())
    .min(1, 'Select at least one ticket delivery mode')
    .required('Select at least one ticket delivery mode'),
  showtimes: yup
    .array()
    .of(
      showtimeSchema.shape({
        city_id: yup
          .number()
          .typeError('City is required')
          .nullable()
          .required('City is required')
          .test('city-required', 'City is required', (v) => v != null && Number.isFinite(Number(v))),
        venue_business_id: yup
          .string()
          .nullable()
          .default(null)
          .when('venue_source', {
            is: 'registered',
            then: (schema) => schema.required('Select a registered venue partner'),
            otherwise: (schema) => schema.nullable(),
          }),
        venue_layout_template_id: yup
          .string()
          .nullable()
          .default(null)
          .when('layout_mode', {
            is: 'standard',
            then: (schema) => schema.required('Select a published layout for Standard mode'),
            otherwise: (schema) => schema.nullable(),
          }),
        custom_layout_name: yup
          .string()
          .trim()
          .default('')
          .when('layout_mode', {
            is: 'custom',
            then: (schema) => schema.required('Custom layout name is required'),
            otherwise: (schema) => schema,
          }),
      })
    )
    .min(1, 'At least one venue / showtime is required')
    .required()
    .test('venue-tickets-dates', function (showtimes) {
      if (!showtimes?.length) return true;
      const durationMinutes = Number(this.parent?.duration_minutes) || 0;
      for (const s of showtimes) {
        if (!s.ticket_types?.length) {
          return this.createError({
            message: `Add at least one ticket type for venue "${s.venue_name || 'this venue'}".`,
          });
        }
        const { starts_at: start, ends_at: end } = showtimeToIso(s, durationMinutes);
        if (!start) {
          return this.createError({
            message: `Set start date and time for venue "${s.venue_name || 'this venue'}".`,
          });
        }
        if (!end) {
          return this.createError({
            message: `Set end time, or set event duration (hours/minutes), for venue "${s.venue_name || 'this venue'}".`,
          });
        }
        const msg = showtimeEndErrorMessage(validateShowtimeEnd(start, end));
        if (msg) return this.createError({ message: msg });
      }
      return true;
    }),
  artists: yup
    .array()
    .of(
      artistSchema.shape({
        artist_business_id: yup
          .string()
          .nullable()
          .default(null)
          .when('artist_source', {
            is: 'registered',
            then: (schema) => schema.required('Select a registered artist partner'),
            otherwise: (schema) => schema.nullable(),
          }),
      })
    )
    .default([]),
});

export type EventFormValues = yup.InferType<typeof eventDraftSchema>;

export const defaultVenue = (): EventFormValues['showtimes'][number] => ({
  venue_name: '',
  venue_address: '',
  city_id: null,
  venue_source: 'manual',
  venue_business_id: null,
  venue_layout_template_id: null,
  layout_mode: 'none',
  custom_layout_name: '',
  custom_layout_type: 'custom',
  custom_layout_capacity: null,
  custom_layout_notes: '',
  custom_layout_images: [],
  location_id: null,
  venue_proposal: null,
  duration_type: 'ONE_DAY',
  event_date: '',
  start_time: '',
  end_time: '',
  starts_at: '',
  ends_at: '',
  ticket_types: [],
});

export const defaultTicketType = (): EventFormValues['showtimes'][number]['ticket_types'][number] => ({
  ticket_type: '',
  total_count: NaN,
  price: NaN,
  max_per_order: 10,
});

export const defaultArtist = (): EventFormValues['artists'][number] => ({
  artist_source: 'external',
  artist_business_id: null,
  name: '',
  role_title: 'Artist',
  description: '',
  image_url: '',
  documents: [],
  sort_order: 0,
});

export function defaultEventFormValues(): EventFormValues {
  return {
    name: '',
    category_type_id: null,
    genres: [],
    poster_horizontal_url: '',
    poster_vertical_url: '',
    gallery_images: [],
    youtube_url: '',
    languages: [],
    about_event: '',
    age_group: '',
    duration_minutes: null,
    allowed_ticket_modes: [],
    category_meta: {},
    showtimes: [defaultVenue()],
    artists: [],
  };
}

/** Duration in minutes from the first showtime that has valid start and end. */
export function computeDurationMinutesFromShowtimes(
  showtimes: EventFormValues['showtimes'] | undefined,
  fallbackDurationMinutes?: number | null
): number | null {
  if (!showtimes?.length) return Number(fallbackDurationMinutes) > 0 ? Number(fallbackDurationMinutes) : null;
  for (const s of showtimes) {
    if (!isShowtimePersistable(s, fallbackDurationMinutes)) continue;
    const { starts_at, ends_at } = showtimeToIso(s, fallbackDurationMinutes);
    if (!starts_at || !ends_at) continue;
    const startMs = new Date(starts_at).getTime();
    const endMs = new Date(ends_at).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) continue;
    return Math.max(1, Math.round((endMs - startMs) / 60000));
  }
  return Number(fallbackDurationMinutes) > 0 ? Number(fallbackDurationMinutes) : null;
}

/** True when a showtime row has enough data to persist (needs valid start datetime). */
export function isShowtimePersistable(
  s: EventFormValues['showtimes'][number],
  durationMinutes?: number | null
): boolean {
  const { starts_at } = showtimeToIso(s, durationMinutes);
  if (!starts_at) return false;
  const ms = new Date(starts_at).getTime();
  return !Number.isNaN(ms);
}

export function validateRequiredDocuments(
  documents: Array<{ document_type_id: number; url: string }>,
  requiredIds: number[],
  requiredNames: Record<number, string>
): string | null {
  const uploaded = new Set(documents.filter((d) => d.url?.trim()).map((d) => d.document_type_id));
  for (const id of requiredIds) {
    if (!uploaded.has(id)) {
      return `Required document missing: ${requiredNames[id] || 'document'}.`;
    }
  }
  return null;
}

export type EventStepCompletionId =
  | 'type'
  | 'details'
  | 'sport'
  | 'media'
  | 'venue'
  | 'artists'
  | 'documents'
  | 'review';

/** Which create-event steps have enough valid data for a green check. */
export function getCompletedEventStepIds(opts: {
  hostingType: 'single' | 'tour' | '';
  values: EventFormValues;
  documents: Array<{ document_type_id: number; url: string }>;
  requiredDocumentIds?: number[];
  genresConfigured?: boolean;
  categorySlug?: string | null;
}): EventStepCompletionId[] {
  const { hostingType, values, documents } = opts;
  const genresConfigured = opts.genresConfigured === true;
  const requiredDocumentIds = opts.requiredDocumentIds || [];
  const done: EventStepCompletionId[] = [];
  const isSports = String(opts.categorySlug || '').toLowerCase() === 'sports';

  if (hostingType === 'single' || hostingType === 'tour') {
    done.push('type');
  }

  const nameOk = Boolean(values.name?.trim());
  const categoryOk = values.category_type_id != null && Number.isFinite(Number(values.category_type_id));
  const languagesOk = (values.languages || []).length > 0;
  const ageOk = Boolean(values.age_group?.trim());
  const aboutOk = Boolean(values.about_event?.trim()) && countChars(values.about_event) <= MAX_ABOUT_CHARS;
  const modesOk = (values.allowed_ticket_modes || []).length > 0;
  const genresOk = !genresConfigured || (values.genres || []).length > 0;
  if (nameOk && categoryOk && languagesOk && ageOk && aboutOk && modesOk && genresOk) {
    done.push('details');
  }

  if (isSports) {
    const meta = values.category_meta as Record<string, any> | undefined;
    const sport = meta && typeof meta === 'object' ? meta.sport : undefined;
    if (sport && typeof sport === 'object' && sport.home_team?.trim() && sport.away_team?.trim() && (values.genres || []).length > 0) {
      done.push('sport');
    }
  }

  if (values.poster_horizontal_url?.trim()) {
    done.push('media');
  }

  const showtimes = values.showtimes || [];
  const durationMinutes = Number(values.duration_minutes) || 0;
  const venueOk =
    showtimes.length > 0 &&
    showtimes.every((s) => {
      if (!s.venue_name?.trim()) return false;
      if (s.city_id == null || !Number.isFinite(Number(s.city_id))) return false;
      if (!isShowtimePersistable(s, durationMinutes)) return false;
      const { starts_at, ends_at } = showtimeToIso(s, durationMinutes);
      if (ends_at) {
        const endMsg = showtimeEndErrorMessage(validateShowtimeEnd(starts_at, ends_at));
        if (endMsg) return false;
      }
      const tickets = s.ticket_types || [];
      if (!tickets.length) return false;
      return tickets.every(
        (t) =>
          Boolean(t.ticket_type?.trim()) &&
          Number(t.total_count) >= 1 &&
          Number(t.price) >= 0 &&
          Number.isFinite(Number(t.price))
      );
    });
  if (venueOk) done.push('venue');

  const artists = values.artists || [];
  if (artists.length > 0 && artists.every((a) => Boolean(a.name?.trim()))) {
    done.push('artists');
  }

  if (requiredDocumentIds.length > 0) {
    const docsErr = validateRequiredDocuments(
      documents.filter((d) => d.document_type_id > 0 && d.url?.trim()),
      requiredDocumentIds,
      Object.fromEntries(requiredDocumentIds.map((id) => [id, 'document']))
    );
    if (!docsErr) done.push('documents');
  }

  const requiredCore: EventStepCompletionId[] = ['type', 'details', 'media', 'venue'];
  if (requiredCore.every((id) => done.includes(id))) {
    done.push('review');
  }

  return done;
}
