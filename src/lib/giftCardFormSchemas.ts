import * as yup from "yup";
import { DEFAULT_DESIGN_GRADIENT } from "@/lib/giftCardDesigns";
import { GIFT_CARD_DENOMINATIONS } from "@/lib/giftCardDenominations";
import { GIFT_CARD_VALIDITY_OPTIONS } from "@/lib/giftCardValidity";

export const MAX_GIFT_CARD_QTY = 10;
export const GIFT_CARD_MESSAGE_MAX = 250;

const denominationList = GIFT_CARD_DENOMINATIONS as unknown as number[];

/** Superadmin — Add / Edit gift card design */
export const adminGiftCardDesignSchema = yup.object({
  title: yup
    .string()
    .trim()
    .required("Title is required.")
    .min(2, "Title must be at least 2 characters.")
    .max(120, "Title must be at most 120 characters."),
  category: yup
    .string()
    .trim()
    .required("Category is required.")
    .min(1, "Select a category."),
  image_url: yup.string().trim().default(""),
  color_gradient: yup.string().trim().default(""),
  caption_color: yup
    .string()
    .trim()
    .required("Caption color is required.")
    .matches(/^#[0-9A-Fa-f]{6}$/, "Use a valid hex color (e.g. #FFFFFF)."),
  text_color: yup
    .string()
    .trim()
    .required("Text color is required.")
    .matches(/^#[0-9A-Fa-f]{6}$/, "Use a valid hex color (e.g. #FFFFFF)."),
  status: yup
    .string()
    .oneOf(["DRAFT", "ACTIVE", "PAUSED"], "Select a valid status.")
    .required("Status is required."),
}).test(
  "image-or-gradient",
  "Upload an image or keep a color gradient.",
  function (values) {
    const hasImage = Boolean(String(values?.image_url || "").trim());
    const hasGradient = Boolean(String(values?.color_gradient || "").trim());
    if (hasImage || hasGradient) return true;
    return this.createError({
      path: "image_url",
      message: "Upload an image or keep a color gradient.",
    });
  }
);

export type AdminGiftCardDesignValues = yup.InferType<typeof adminGiftCardDesignSchema>;

export const emptyAdminGiftCardDesignValues = (
  defaultCategory = ""
): AdminGiftCardDesignValues => ({
  title: "",
  category: defaultCategory,
  image_url: "",
  color_gradient: DEFAULT_DESIGN_GRADIENT,
  caption_color: "#FFFFFF",
  text_color: "#FFFFFF",
  status: "DRAFT",
});

/** Superadmin — gift card design category master */
export const adminGiftCardCategorySchema = yup.object({
  name: yup
    .string()
    .trim()
    .required("Category name is required.")
    .min(2, "Name must be at least 2 characters.")
    .max(80, "Name must be at most 80 characters."),
  description: yup
    .string()
    .trim()
    .default("")
    .max(500, "Description must be at most 500 characters."),
});

export type AdminGiftCardCategoryValues = yup.InferType<typeof adminGiftCardCategorySchema>;

export const emptyAdminGiftCardCategoryValues = (): AdminGiftCardCategoryValues => ({
  name: "",
  description: "",
});

/** Superadmin — gift card validity setting */
export const adminGiftCardValiditySchema = yup.object({
  validity_days: yup
    .number()
    .typeError("Select a validity period.")
    .required("Validity is required.")
    .oneOf(
      [...GIFT_CARD_VALIDITY_OPTIONS],
      "Choose 90, 180, 365, or 730 days."
    ),
});

export type AdminGiftCardValidityValues = yup.InferType<typeof adminGiftCardValiditySchema>;

/** Customer — buy gift card (BookMyShow-style gift-only) */
export const customerGiftCardBuySchema = yup.object({
  sender_name: yup
    .string()
    .trim()
    .required("Sender name is required.")
    .min(2, "Sender name must be at least 2 characters.")
    .max(80, "Sender name must be at most 80 characters."),
  recipient_name: yup
    .string()
    .trim()
    .required("Recipient name is required.")
    .min(2, "Recipient name must be at least 2 characters.")
    .max(80, "Recipient name must be at most 80 characters."),
  recipient_email: yup
    .string()
    .trim()
    .required("Recipient email is required.")
    .email("Enter a valid recipient email."),
  recipient_phone: yup
    .string()
    .trim()
    .required("Mobile number is required.")
    .min(8, "Enter a valid mobile number.")
    .max(20, "Mobile number is too long.")
    .matches(/^[+\d][\d\s()-]{7,19}$/, "Enter a valid mobile number."),
  personal_message: yup
    .string()
    .trim()
    .max(GIFT_CARD_MESSAGE_MAX, `Message must be at most ${GIFT_CARD_MESSAGE_MAX} characters.`)
    .default(""),
  /** When the gift email is delivered to the recipient (today = send now). */
  delivery_date: yup
    .string()
    .trim()
    .required("Please choose a delivery date.")
    .matches(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid delivery date.")
    .test("not-past", "Delivery date cannot be in the past.", (value) => {
      if (!value) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const picked = new Date(`${value}T00:00:00`);
      return !Number.isNaN(picked.getTime()) && picked >= today;
    }),
  denomination: yup
    .number()
    .typeError("Select an amount.")
    .required("Amount is required.")
    .oneOf(denominationList, "Select a valid gift card amount."),
});

export type CustomerGiftCardBuyValues = yup.InferType<typeof customerGiftCardBuySchema>;

/** Customer — claim gift card code */
export const customerGiftCardClaimSchema = yup.object({
  code: yup
    .string()
    .trim()
    .required("Gift card code is required.")
    .min(8, "Enter a valid gift card code."),
});

export type CustomerGiftCardClaimValues = yup.InferType<typeof customerGiftCardClaimSchema>;
