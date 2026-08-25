import * as yup from 'yup';
import { PHONE_MAX_DIGITS, PHONE_MIN_DIGITS, sanitizePhoneInput } from '@/lib/validation';

export const venueInquiryFormSchema = yup.object({
  event_date: yup
    .string()
    .required('Select a free date from the calendar.')
    .matches(/^\d{4}-\d{2}-\d{2}$/, 'Select a valid date.'),
  event_time: yup
    .string()
    .default('')
    .test('time', 'Enter a valid time (HH:MM).', (value) => {
      if (!value) return true;
      return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    }),
  contact_name: yup
    .string()
    .trim()
    .required('Your name is required.')
    .min(2, 'Name must be at least 2 characters.'),
  contact_email: yup
    .string()
    .trim()
    .required('Email is required.')
    .email('Enter a valid email address.'),
  contact_phone: yup
    .string()
    .required('Phone number is required.')
    .test(
      'phone-digits',
      `Phone must be ${PHONE_MIN_DIGITS}–${PHONE_MAX_DIGITS} digits (numbers only).`,
      (value) => {
        const digits = sanitizePhoneInput(String(value ?? ''));
        return digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS;
      }
    ),
  event_type: yup.string().trim().default(''),
  guest_count: yup
    .string()
    .default('')
    .test('guests', 'Guest count must be a positive number.', (value) => {
      if (!value) return true;
      const n = Number(value);
      return Number.isFinite(n) && n > 0;
    }),
  event_location: yup.string().trim().default(''),
  message: yup.string().trim().default('').max(2000, 'Message is too long.'),
});

export type VenueInquiryFormValues = yup.InferType<typeof venueInquiryFormSchema>;
