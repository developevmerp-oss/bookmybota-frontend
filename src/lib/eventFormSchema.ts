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
  duration_type: yup.string().oneOf(['ONE_DAY', 'MULTI_DAY']).default('ONE_DAY'),
  event_date: yup.string().default(''),
  start_time: yup.string().default(''),
  end_time: yup.string().default(''),
  starts_at: yup.string().default(''),
  ends_at: yup.string().default(''),
  ticket_types: yup.array().of(ticketSchema).default([]),
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
  name: yup.string().trim().required('Event name is required'),
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
  artists: yup
    .array()
    .of(
      yup.object({
        name: yup.string().trim().default(''),
        role: yup.string().trim().default(''),
        description: yup.string().trim().default(''),
        image_url: yup.string().default(''),
      })
    )
    .default([]),
  languages: yup.array().of(yup.string().required()).default([]),
  about_event: yup.string().default(''),
  age_group: yup.string().default(''),
  duration_minutes: yup.number().nullable().default(null),
  showtimes: yup.array().of(showtimeSchema).default([]),
});

export const eventSubmitSchema = eventDraftSchema.shape({
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
    .of(showtimeSchema)
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
});

export type EventFormValues = yup.InferType<typeof eventDraftSchema>;

export const defaultVenue = (): EventFormValues['showtimes'][number] => ({
  venue_name: '',
  venue_address: '',
  duration_type: 'ONE_DAY',
  event_date: '',
  start_time: '',
  end_time: '',
  starts_at: '',
  ends_at: '',
  ticket_types: [{ ticket_type: '', total_count: 100, price: 0 }],
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
    artists: [],
    languages: [],
    about_event: '',
    age_group: '',
    duration_minutes: null,
    showtimes: [defaultVenue()],
  };
}

export function showtimeToIso(s: EventFormValues['showtimes'][number]): { starts_at: string; ends_at: string } {
  const { start, end } = showtimeRangeIso(s);
  return { starts_at: start, ends_at: end };
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
