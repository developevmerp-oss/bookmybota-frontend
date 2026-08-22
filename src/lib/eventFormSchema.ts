import * as yup from 'yup';
import {
  fromDateAndTime,
  fromDatetimeLocal,
  showtimeEndErrorMessage,
  validateShowtimeEnd,
} from './dateFormat';
import { parseYouTubeId } from './youtube';

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
  name: yup.string().trim().required('Artist name is required'),
  role_title: yup.string().trim().default(''),
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
  about_event: yup.string().default(''),
  age_group: yup.string().default(''),
  duration_minutes: yup.number().nullable().default(null),
  showtimes: yup.array().of(showtimeSchema).default([]),
  artists: yup.array().of(artistSchema).default([]),
});

export const eventSubmitSchema = eventDraftSchema.shape({
  name: yup.string().trim().required('Event name is required'),
  category_type_id: yup.number().required('Event category is required'),
  genres: yup.array().of(yup.string().required()).min(1, 'Select at least one genre'),
  poster_horizontal_url: yup.string().trim().required('Horizontal poster is required'),
  languages: yup.array().of(yup.string().required()).min(1, 'Select at least one language'),
  about_event: yup.string().trim().required('About event is required'),
  age_group: yup.string().trim().required('Age group is required'),
  duration_minutes: yup
    .number()
    .typeError('Duration is required')
    .min(1, 'Duration must be greater than 0')
    .required('Duration is required'),
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
      for (const s of showtimes) {
        if (!s.ticket_types?.length) {
          return this.createError({
            message: `Add at least one ticket type for venue "${s.venue_name || 'this venue'}".`,
          });
        }
        const { start, end } = showtimeRangeIso(s);
        if (!start) {
          return this.createError({
            message: `Set start date and time for venue "${s.venue_name || 'this venue'}".`,
          });
        }
        if (!end) {
          return this.createError({
            message: `Set end time for venue "${s.venue_name || 'this venue'}".`,
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
  ticket_types: [{ ticket_type: '', total_count: 100, price: 0 }],
});

export const defaultArtist = (): EventFormValues['artists'][number] => ({
  artist_source: 'external',
  artist_business_id: null,
  name: '',
  role_title: '',
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
    showtimes: [defaultVenue()],
    artists: [],
  };
}

export function showtimeToIso(s: EventFormValues['showtimes'][number]): { starts_at: string; ends_at: string } {
  const { start, end } = showtimeRangeIso(s);
  return { starts_at: start, ends_at: end };
}

/** True when a showtime row has enough data to persist (needs valid start datetime). */
export function isShowtimePersistable(s: EventFormValues['showtimes'][number]): boolean {
  const { starts_at } = showtimeToIso(s);
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
