import * as yup from 'yup';
import { PHONE_MAX_DIGITS, PHONE_MIN_DIGITS, sanitizePhoneInput } from '@/lib/validation';

const phoneSchema = yup
  .string()
  .required('Phone number is required.')
  .test(
    'phone-digits',
    `Phone must be ${PHONE_MIN_DIGITS}–${PHONE_MAX_DIGITS} digits (numbers only).`,
    (value) => {
      const digits = sanitizePhoneInput(String(value ?? ''));
      return digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS;
    }
  );

export const phoneLoginSchema = yup.object({
  phone: phoneSchema,
});

export const otpVerifySchema = yup.object({
  otp: yup
    .string()
    .required('OTP is required.')
    .matches(/^\d{6}$/, 'Enter the 6-digit OTP.'),
});

export const customerRegisterSchema = yup.object({
  name: yup
    .string()
    .trim()
    .required('Full name is required.')
    .min(2, 'Name must be at least 2 characters.'),
  email: yup
    .string()
    .trim()
    .required('Email is required.')
    .email('Enter a valid email address.'),
  phone: phoneSchema,
});

export const businessLoginSchema = yup.object({
  email: yup
    .string()
    .trim()
    .required('Email is required.')
    .email('Enter a valid email address.'),
  password: yup.string().required('Password is required.'),
});

export const confirmBookingSchema = yup.object({
  name: yup
    .string()
    .trim()
    .required('Full name is required.')
    .matches(/^[\p{L}\s]+$/u, 'Name can only contain letters.'),
  phone: yup
    .string()
    .required('Phone number is required.')
    .matches(/^\d+$/, 'Only numbers are allowed — no letters or special characters.')
    .min(PHONE_MIN_DIGITS, `Phone must be ${PHONE_MIN_DIGITS}–${PHONE_MAX_DIGITS} digits.`)
    .max(PHONE_MAX_DIGITS, `Phone must be ${PHONE_MIN_DIGITS}–${PHONE_MAX_DIGITS} digits.`),
  arrivalTime: yup.string().trim().required('Arrival time is required.'),
});

export type PhoneLoginValues = yup.InferType<typeof phoneLoginSchema>;
export type OtpVerifyValues = yup.InferType<typeof otpVerifySchema>;
export type CustomerRegisterValues = yup.InferType<typeof customerRegisterSchema>;
export type BusinessLoginValues = yup.InferType<typeof businessLoginSchema>;
export type ConfirmBookingValues = yup.InferType<typeof confirmBookingSchema>;
