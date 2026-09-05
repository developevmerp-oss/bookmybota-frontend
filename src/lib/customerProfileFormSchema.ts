import * as yup from 'yup';
import {
  PHONE_MAX_DIGITS,
  PHONE_MIN_DIGITS,
  sanitizePhoneInput,
} from '@/lib/validation';

/** Optional phone: empty OR 9–12 digits (adminPhoneSchema pattern without required). */
const optionalPhoneSchema = yup
  .string()
  .transform((value) => sanitizePhoneInput(String(value ?? '')))
  .test(
    'phone-digits',
    `Phone must be ${PHONE_MIN_DIGITS}–${PHONE_MAX_DIGITS} digits (numbers only).`,
    (value) => {
      const digits = String(value ?? '');
      if (digits.length === 0) return true;
      return digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS;
    }
  );

export const customerProfileSchema = yup.object({
  name: yup
    .string()
    .trim()
    .required('Full name is required.')
    .min(2, 'Name must be at least 2 characters.'),
  phone: optionalPhoneSchema,
  email: yup
    .string()
    .trim()
    .transform((v) => (v === '' ? undefined : v))
    .email('Enter a valid email address.')
    .optional(),
  address: yup.string().trim().optional(),
  city: yup.string().trim().optional(),
  state: yup.string().trim().optional(),
});

export type CustomerProfileValues = yup.InferType<typeof customerProfileSchema>;
