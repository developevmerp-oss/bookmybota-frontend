import * as yup from "yup";
import {
  PHONE_MAX_DIGITS,
  PHONE_MIN_DIGITS,
  sanitizePhoneInput,
} from "@/lib/validation";
import type { DiningOfferStatus } from "@/lib/diningOffers";

/** Required phone: 9–12 digits. */
const requiredPhoneSchema = yup
  .string()
  .required("Phone number is required.")
  .transform((value) => sanitizePhoneInput(String(value ?? "")))
  .test(
    "phone-digits",
    `Phone must be ${PHONE_MIN_DIGITS}–${PHONE_MAX_DIGITS} digits (numbers only).`,
    (value) => {
      const digits = String(value ?? "");
      return digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS;
    }
  );

/** Optional phone: empty OR 9–12 digits. */
const optionalPhoneSchema = yup
  .string()
  .transform((value) => sanitizePhoneInput(String(value ?? "")))
  .test(
    "phone-digits",
    `Phone must be ${PHONE_MIN_DIGITS}–${PHONE_MAX_DIGITS} digits (numbers only).`,
    (value) => {
      const digits = String(value ?? "");
      if (digits.length === 0) return true;
      return digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS;
    }
  );

const positiveNumberString = (label: string, allowZero = false) =>
  yup
    .string()
    .required(`${label} is required.`)
    .test("positive-number", `Enter a valid ${label.toLowerCase()}.`, (value) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return false;
      return allowZero ? n >= 0 : n > 0;
    });

// ── Offers ────────────────────────────────────────────────────────────────────

export type DiningOfferFormValues = {
  title: string;
  promo_code: string;
  type: string;
  discount_type: "PERCENT" | "FLAT";
  discount_value: string;
  max_discount: string;
  min_bill_amount: string;
  per_day_limit: string;
  start_at: string;
  end_at: string;
  status: DiningOfferStatus;
};

export const diningOfferFormSchema = yup.object({
  title: yup
    .string()
    .trim()
    .required("Offer title is required.")
    .min(2, "Title must be at least 2 characters."),
  promo_code: yup
    .string()
    .trim()
    .required("Promo code is required.")
    .min(2, "Promo code must be at least 2 characters."),
  type: yup.string().trim().default(""),
  discount_type: yup
    .mixed<"PERCENT" | "FLAT">()
    .oneOf(["PERCENT", "FLAT"])
    .required("Discount type is required."),
  discount_value: yup
    .string()
    .required("Discount value is required.")
    .test("non-negative", "Enter a valid discount value.", (value) => {
      const n = Number(value);
      return Number.isFinite(n) && n >= 0;
    })
    .test("percent-max", "Percentage discount cannot exceed 100.", function (value) {
      if (this.parent.discount_type !== "PERCENT") return true;
      const n = Number(value);
      return Number.isFinite(n) && n <= 100;
    }),
  max_discount: yup
    .string()
    .default("")
    .test("max-discount", "Max discount must be a non-negative number.", (value) => {
      if (!value || !String(value).trim()) return true;
      const n = Number(value);
      return Number.isFinite(n) && n >= 0;
    }),
  min_bill_amount: yup
    .string()
    .default("0")
    .test("min-bill", "Min bill must be a non-negative number.", (value) => {
      if (value == null || value === "") return true;
      const n = Number(value);
      return Number.isFinite(n) && n >= 0;
    }),
  per_day_limit: yup
    .string()
    .default("")
    .test("per-day", "Daily limit must be a whole number ≥ 1.", (value) => {
      if (!value || !String(value).trim()) return true;
      const n = Number(value);
      return Number.isFinite(n) && Number.isInteger(n) && n >= 1;
    }),
  start_at: yup.string().default(""),
  end_at: yup
    .string()
    .default("")
    .test("after-from", "End date must be on or after start date.", function (value) {
      const from = String(this.parent.start_at || "");
      if (!value || !from) return true;
      return value >= from;
    }),
  status: yup
    .mixed<DiningOfferStatus>()
    .oneOf(["DRAFT", "ACTIVE", "PAUSED", "SCHEDULED", "EXPIRED", "ARCHIVED"])
    .required("Status is required."),
});

export const emptyDiningOfferFormValues = (): DiningOfferFormValues => ({
  title: "",
  promo_code: "",
  type: "Pre-Book Offer",
  discount_type: "PERCENT",
  discount_value: "10",
  max_discount: "",
  min_bill_amount: "0",
  per_day_limit: "",
  start_at: "",
  end_at: "",
  status: "DRAFT",
});

// ── Tables ────────────────────────────────────────────────────────────────────

export const diningTableFormSchema = yup.object({
  table_number: yup
    .string()
    .trim()
    .required("Table identifier is required.")
    .min(1, "Table identifier is required."),
  capacity: positiveNumberString("Seating capacity").test(
    "integer",
    "Capacity must be a whole number.",
    (value) => {
      const n = Number(value);
      return Number.isFinite(n) && Number.isInteger(n) && n >= 1;
    }
  ),
});

export type DiningTableFormValues = yup.InferType<typeof diningTableFormSchema>;

export const emptyDiningTableFormValues = (): DiningTableFormValues => ({
  table_number: "",
  capacity: "4",
});

// ── Walk-in seating ───────────────────────────────────────────────────────────

export const diningWalkInFormSchema = yup.object({
  customer_name: yup.string().trim().default("Walk-in Guest"),
  customer_phone: optionalPhoneSchema,
  guests: positiveNumberString("Party size")
    .test("integer", "Party size must be a whole number.", (value) => {
      const n = Number(value);
      return Number.isFinite(n) && Number.isInteger(n) && n >= 1;
    })
    .test("max", "Party size cannot exceed 20.", (value) => {
      const n = Number(value);
      return Number.isFinite(n) && n <= 20;
    }),
});

export type DiningWalkInFormValues = yup.InferType<typeof diningWalkInFormSchema>;

export const emptyDiningWalkInFormValues = (): DiningWalkInFormValues => ({
  customer_name: "Walk-in Guest",
  customer_phone: "",
  guests: "2",
});

// ── Review reply ──────────────────────────────────────────────────────────────

export const diningReviewReplySchema = yup.object({
  text: yup
    .string()
    .trim()
    .required("Reply is required.")
    .min(2, "Reply must be at least 2 characters.")
    .max(2000, "Reply must be at most 2000 characters."),
});

export type DiningReviewReplyValues = yup.InferType<typeof diningReviewReplySchema>;

export const emptyDiningReviewReplyValues = (): DiningReviewReplyValues => ({
  text: "",
});

// ── Profile (core text fields) ────────────────────────────────────────────────

export const diningPartnerProfileSchema = yup.object({
  name: yup
    .string()
    .trim()
    .required("Venue name is required.")
    .min(2, "Name must be at least 2 characters.")
    .max(120, "Name must be at most 120 characters."),
  phone: requiredPhoneSchema,
  address: yup
    .string()
    .trim()
    .required("Address is required.")
    .min(5, "Address must be at least 5 characters."),
  city_id: yup.string().default(""),
  description: yup.string().trim().default(""),
  average_cost: yup
    .string()
    .default("")
    .test("avg-cost", "Average cost must be a non-negative whole number.", (value) => {
      if (!value || !String(value).trim()) return true;
      const n = Number(value);
      return Number.isFinite(n) && Number.isInteger(n) && n >= 0;
    }),
  open_time: yup.string().default("08:00"),
  close_time: yup.string().default("23:30"),
});

export type DiningPartnerProfileValues = yup.InferType<typeof diningPartnerProfileSchema>;

export const emptyDiningPartnerProfileValues = (): DiningPartnerProfileValues => ({
  name: "",
  phone: "",
  address: "",
  city_id: "",
  description: "",
  average_cost: "",
  open_time: "08:00",
  close_time: "23:30",
});

// ── Scan (token lookup / bill) ────────────────────────────────────────────────

export const diningScanTokenSchema = yup.object({
  token: yup
    .string()
    .trim()
    .required("QR token is required.")
    .min(3, "Enter a valid QR token."),
});

export type DiningScanTokenValues = yup.InferType<typeof diningScanTokenSchema>;

export const diningScanBillSchema = yup.object({
  bill_amount: positiveNumberString("Bill amount"),
});

export type DiningScanBillValues = yup.InferType<typeof diningScanBillSchema>;
