import * as yup from "yup";
import { DEFAULT_DESIGN_GRADIENT } from "@/lib/giftCardDesigns";
import { GIFT_CARD_DENOMINATIONS } from "@/lib/giftCardDenominations";
import { GIFT_CARD_VALIDITY_OPTIONS } from "@/lib/giftCardValidity";

export const MAX_GIFT_CARD_QTY = 10;
export const GIFT_CARD_MESSAGE_MAX = 120;

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
    .oneOf(["ENTERTAINING", "LOVE"], "Select a valid category.")
    .required("Category is required."),
  image_url: yup.string().trim().default(""),
  color_gradient: yup.string().trim().default(""),
  caption_color: yup
    .string()
    .trim()
    .required("Caption color is required.")
    .matches(/^#[0-9A-Fa-f]{6}$/, "Use a valid hex color (e.g. #FFFFFF)."),
  status: yup
    .string()
    .oneOf(["DRAFT", "ACTIVE", "PAUSED"], "Select a valid status.")
    .required("Status is required."),
  sort_order: yup
    .string()
    .trim()
    .required("Sort order is required.")
    .test("sort-number", "Sort order must be a whole number.", (value) => {
      if (value == null || value === "") return false;
      const n = Number(value);
      return Number.isFinite(n) && Number.isInteger(n) && n >= 0;
    }),
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

export const emptyAdminGiftCardDesignValues = (): AdminGiftCardDesignValues => ({
  title: "",
  category: "ENTERTAINING",
  image_url: "",
  color_gradient: DEFAULT_DESIGN_GRADIENT,
  caption_color: "#FFFFFF",
  status: "DRAFT",
  sort_order: "0",
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

/** Customer — buy gift card */
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
  personal_message: yup
    .string()
    .trim()
    .max(GIFT_CARD_MESSAGE_MAX, `Message must be at most ${GIFT_CARD_MESSAGE_MAX} characters.`)
    .default(""),
  denomination: yup
    .number()
    .typeError("Select an amount.")
    .required("Amount is required.")
    .oneOf(denominationList, "Select a valid gift card amount."),
  quantity: yup
    .number()
    .typeError("Quantity is required.")
    .required("Quantity is required.")
    .integer("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(MAX_GIFT_CARD_QTY, `Please enter value less than or equal to ${MAX_GIFT_CARD_QTY}`),
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
