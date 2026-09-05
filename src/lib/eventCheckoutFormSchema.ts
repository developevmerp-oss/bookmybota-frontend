import * as yup from "yup";
import {
  PHONE_MAX_DIGITS,
  PHONE_MIN_DIGITS,
  sanitizePhoneInput,
  isValidPhone,
} from "@/lib/validation";

/** Guest / customer contact for event checkout (and edit-contact modal). */
export const eventCheckoutContactSchema = yup.object({
  name: yup
    .string()
    .trim()
    .required("Name is required.")
    .min(2, "Name must be at least 2 characters."),
  phone: yup
    .string()
    .required("Phone number is required.")
    .transform((value) => sanitizePhoneInput(String(value ?? "")))
    .test(
      "phone-digits",
      `Phone must be ${PHONE_MIN_DIGITS}–${PHONE_MAX_DIGITS} digits (numbers only).`,
      (value) => isValidPhone(String(value ?? ""))
    ),
  email: yup
    .string()
    .trim()
    .required("Email is required.")
    .email("Enter a valid email address."),
});

export type EventCheckoutContactValues = yup.InferType<typeof eventCheckoutContactSchema>;

export const emptyEventCheckoutContactValues = (): EventCheckoutContactValues => ({
  name: "",
  phone: "",
  email: "",
});

/**
 * Delivery address — street/city required only when `needs_delivery` is true
 * (PHYSICAL_DELIVERY ticket mode).
 */
export const eventCheckoutDeliverySchema = yup.object({
  needs_delivery: yup.boolean().default(false),
  delivery_address_line: yup
    .string()
    .trim()
    .when("needs_delivery", {
      is: true,
      then: (schema) => schema.required("Enter the delivery street address."),
      otherwise: (schema) => schema.default(""),
    }),
  delivery_city: yup
    .string()
    .trim()
    .when("needs_delivery", {
      is: true,
      then: (schema) => schema.required("Enter the delivery city."),
      otherwise: (schema) => schema.default(""),
    }),
  delivery_notes: yup.string().trim().default(""),
});

export type EventCheckoutDeliveryValues = yup.InferType<typeof eventCheckoutDeliverySchema>;

export const emptyEventCheckoutDeliveryValues = (
  needsDelivery = false
): EventCheckoutDeliveryValues => ({
  needs_delivery: needsDelivery,
  delivery_address_line: "",
  delivery_city: "",
  delivery_notes: "",
});
