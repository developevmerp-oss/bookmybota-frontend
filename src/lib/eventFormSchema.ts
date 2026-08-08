import * as yup from 'yup';
import { showtimeEndErrorMessage, validateShowtimeEnd } from './dateFormat';

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
  starts_at: yup.string().required('Show start date & time is required'),
  ends_at: yup
    .string()
    .default('')
    .test('end-after-start', function (endsAt) {
      const { starts_at: startsAt } = this.parent as { starts_at: string };
      const result = validateShowtimeEnd(startsAt, endsAt || '');
      const msg = showtimeEndErrorMessage(result);
      if (msg) return this.createError({ message: msg });
      return true;
    }),
});

export const eventDraftSchema = yup.object({
  name: yup.string().trim().required('Event name is required'),
  category_type_id: yup.number().nullable().default(null),
  genres: yup.array().of(yup.string().required()).default([]),
  poster_horizontal_url: yup.string().default(''),
  poster_vertical_url: yup.string().default(''),
  language: yup.string().default(''),
  about_event: yup.string().default(''),
  age_group: yup.string().default(''),
  duration_minutes: yup.number().nullable().default(null),
  ticket_types: yup.array().of(ticketSchema).default([]),
  showtimes: yup.array().of(showtimeSchema).default([]),
});

export const eventSubmitSchema = eventDraftSchema.shape({
  category_type_id: yup.number().required('Event category is required'),
  genres: yup.array().of(yup.string().required()).min(1, 'Select at least one genre'),
  poster_horizontal_url: yup.string().trim().required('Horizontal poster is required'),
  language: yup.string().trim().required('Language is required'),
  about_event: yup.string().trim().required('About event is required'),
  age_group: yup.string().trim().required('Age group is required'),
  duration_minutes: yup
    .number()
    .typeError('Duration is required')
    .min(1, 'Duration must be greater than 0')
    .required('Duration is required'),
  ticket_types: yup
    .array()
    .of(ticketSchema)
    .min(1, 'At least one ticket type is required')
    .required(),
  showtimes: yup
    .array()
    .of(showtimeSchema)
    .min(1, 'At least one venue / showtime is required')
    .required(),
});

export type EventFormValues = yup.InferType<typeof eventDraftSchema>;

export function defaultEventFormValues(): EventFormValues {
  return {
    name: '',
    category_type_id: null,
    genres: [],
    poster_horizontal_url: '',
    poster_vertical_url: '',
    language: '',
    about_event: '',
    age_group: '',
    duration_minutes: null,
    ticket_types: [{ ticket_type: '', total_count: 100, price: 0 }],
    showtimes: [{ venue_name: '', venue_address: '', starts_at: '', ends_at: '' }],
  };
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
