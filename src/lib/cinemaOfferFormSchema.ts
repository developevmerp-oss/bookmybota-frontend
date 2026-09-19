import * as yup from "yup";

export type CinemaOfferApplyTo = "THIS_MOVIE" | "SELECTED_MOVIES" | "ALL_MY_MOVIES";
export type CinemaOfferStatus = "DRAFT" | "ACTIVE";

export type CinemaOfferFormValues = {
  apply_to: CinemaOfferApplyTo;
  movieId: string;
  movie_ids: string[];
  title: string;
  promo_code: string;
  description: string;
  discount_type: "PERCENT" | "FLAT";
  discount_value: string;
  min_booking_amount: string;
  usage_limit: string;
  per_customer_limit: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  status: CinemaOfferStatus;
  sort_order: string;
};

export function buildCinemaOfferFormSchema() {
  return yup.object({
    apply_to: yup
      .mixed<CinemaOfferApplyTo>()
      .oneOf(["THIS_MOVIE", "SELECTED_MOVIES", "ALL_MY_MOVIES"])
      .required("Choose where this offer applies."),
    movieId: yup.string().trim().default(""),
    movie_ids: yup
      .array()
      .of(yup.string().required())
      .default([])
      .test("movies-required", "Select at least one movie.", function (value) {
        const applyTo = this.parent.apply_to as CinemaOfferApplyTo;
        if (applyTo === "ALL_MY_MOVIES") return true;
        if (applyTo === "THIS_MOVIE") return Boolean(this.parent.movieId);
        return Array.isArray(value) && value.length > 0;
      }),
    title: yup
      .string()
      .trim()
      .required("Offer name is required.")
      .min(2, "Offer name must be at least 2 characters."),
    promo_code: yup
      .string()
      .trim()
      .required("Offer code is required.")
      .min(2, "Offer code must be at least 2 characters."),
    description: yup.string().trim().default(""),
    discount_type: yup
      .mixed<"PERCENT" | "FLAT">()
      .oneOf(["PERCENT", "FLAT"])
      .required("Discount type is required."),
    discount_value: yup
      .string()
      .required("Discount value is required.")
      .test("positive-number", "Enter a discount value greater than 0.", (value) => {
        const n = Number(value);
        return Number.isFinite(n) && n > 0;
      })
      .test("percent-max", "Percent discount cannot exceed 100.", function (value) {
        if (this.parent.discount_type !== "PERCENT") return true;
        const n = Number(value);
        return Number.isFinite(n) && n <= 100;
      }),
    min_booking_amount: yup
      .string()
      .default("0")
      .test("min-booking", "Minimum booking amount must be 0 or greater.", (value) => {
        if (value === "" || value == null) return true;
        const n = Number(value);
        return Number.isFinite(n) && n >= 0;
      }),
    usage_limit: yup
      .string()
      .default("")
      .test("usage-limit", "Total usage limit must be at least 1 when set.", (value) => {
        if (!value) return true;
        const n = Number(value);
        return Number.isFinite(n) && n >= 1;
      }),
    per_customer_limit: yup
      .string()
      .default("")
      .test("per-customer", "Per customer limit must be at least 1 when set.", (value) => {
        if (!value) return true;
        const n = Number(value);
        return Number.isFinite(n) && n >= 1;
      }),
    start_date: yup.string().required("Start date is required."),
    start_time: yup.string().default(""),
    end_date: yup
      .string()
      .required("End date is required.")
      .test("after-from", "End date must be on or after start date.", function (value) {
        const from = String(this.parent.start_date || "");
        if (!value || !from) return true;
        if (value > from) return true;
        if (value < from) return false;
        const startTime = String(this.parent.start_time || "00:00");
        const endTime = String(this.parent.end_time || "23:59");
        return endTime >= startTime;
      }),
    end_time: yup.string().default(""),
    status: yup.mixed<CinemaOfferStatus>().oneOf(["DRAFT", "ACTIVE"]).required(),
    sort_order: yup
      .string()
      .default("0")
      .test("sort-order", "Sort order must be 0 or greater.", (value) => {
        if (value === "" || value == null) return true;
        const n = Number(value);
        return Number.isFinite(n) && n >= 0;
      }),
  });
}

export const emptyCinemaOfferFormValues = (movieId = ""): CinemaOfferFormValues => ({
  apply_to: "THIS_MOVIE",
  movieId,
  movie_ids: movieId ? [movieId] : [],
  title: "",
  promo_code: "",
  description: "",
  discount_type: "PERCENT",
  discount_value: "",
  min_booking_amount: "0",
  usage_limit: "",
  per_customer_limit: "",
  start_date: "",
  start_time: "",
  end_date: "",
  end_time: "",
  status: "DRAFT",
  sort_order: "0",
});
