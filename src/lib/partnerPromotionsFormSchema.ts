import * as yup from "yup";

export type PartnerPromoTargetType = "BUSINESS" | "RESTAURANT" | "EVENT" | "MOVIE";

function todayYmd(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
}

/** Partner portal — request / resubmit marketing promotion */
export const partnerPromotionsFormSchema = yup.object({
  plan_id: yup.string().trim().required("Select a plan."),
  title: yup
    .string()
    .trim()
    .required("Title is required.")
    .min(2, "Title must be at least 2 characters.")
    .max(120, "Title must be at most 120 characters."),
  banner_image_url: yup.string().trim().default(""),
  target_type: yup
    .mixed<PartnerPromoTargetType>()
    .oneOf(["BUSINESS", "RESTAURANT", "EVENT", "MOVIE"])
    .required("Target type is required."),
  target_id: yup.string().trim().default(""),
  start_date: yup
    .string()
    .trim()
    .required("Promotion start date is required.")
    .matches(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid start date.")
    .test("not-past", "Start date cannot be in the past.", (value) => {
      if (!value) return false;
      return value >= todayYmd();
    }),
  /** Synced from selected plan — drives conditional banner validation */
  landing_slider: yup.boolean().default(false),
  /** Synced from selected plan — drives conditional item-target validation */
  allows_item_target: yup.boolean().default(false),
}).test("banner-required", "Banner image is required for slider plans", function (values) {
  if (!values?.landing_slider) return true;
  if (String(values.banner_image_url || "").trim()) return true;
  return this.createError({
    path: "banner_image_url",
    message: "Banner image is required for slider plans",
  });
}).test("target-required", "Select what you want to promote", function (values) {
  if (!values?.allows_item_target) return true;
  const t = values.target_type;
  if (t === "BUSINESS" || t === "RESTAURANT") return true;
  if (String(values.target_id || "").trim()) return true;
  return this.createError({
    path: "target_id",
    message: "Select what you want to promote",
  });
});

export type PartnerPromotionsFormValues = yup.InferType<typeof partnerPromotionsFormSchema>;

export const emptyPartnerPromotionsFormValues = (
  module: "DINING" | "EVENTS" | "MOVIES"
): PartnerPromotionsFormValues => ({
  plan_id: "",
  title: "",
  banner_image_url: "",
  target_type: module === "DINING" ? "RESTAURANT" : module === "EVENTS" ? "EVENT" : "MOVIE",
  target_id: "",
  start_date: todayYmd(),
  landing_slider: false,
  allows_item_target: false,
});
