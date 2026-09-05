import * as yup from "yup";
import {
  PHONE_MAX_DIGITS,
  PHONE_MIN_DIGITS,
  sanitizePhoneInput,
  isValidPhone,
} from "@/lib/validation";

/** Guest contact on movie seat checkout. */
export const movieCheckoutFormSchema = yup.object({
  guest_name: yup
    .string()
    .trim()
    .required("Full name is required.")
    .min(2, "Name must be at least 2 characters."),
  guest_phone: yup
    .string()
    .required("Phone number is required.")
    .transform((value) => sanitizePhoneInput(String(value ?? "")))
    .test(
      "phone-digits",
      `Phone must be ${PHONE_MIN_DIGITS}–${PHONE_MAX_DIGITS} digits (numbers only).`,
      (value) => isValidPhone(String(value ?? ""))
    ),
  guest_email: yup
    .string()
    .trim()
    .default("")
    .test("email-or-empty", "Enter a valid email address.", (value) => {
      const v = String(value ?? "").trim();
      if (!v) return true;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    }),
});

export type MovieCheckoutFormValues = yup.InferType<typeof movieCheckoutFormSchema>;

export const emptyMovieCheckoutFormValues = (): MovieCheckoutFormValues => ({
  guest_name: "",
  guest_phone: "",
  guest_email: "",
});
