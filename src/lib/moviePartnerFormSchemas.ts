import * as yup from "yup";

/** Cinema partner — schedule / edit movie showtime */
export const movieShowtimeFormSchema = yup.object({
  movie_id: yup.string().trim().required("Please select a movie."),
  cinema_screen_id: yup.string().trim().required("Please select a cinema screen."),
  show_date: yup.string().trim().required("Show date is required."),
  start_time: yup.string().trim().required("Start time is required."),
  language: yup.string().trim().default("English"),
  format: yup.string().trim().default("2D"),
  tier_pricing: yup
    .array()
    .of(
      yup.object({
        tier_name: yup.string().trim().required("Tier name is required."),
        price: yup
          .number()
          .typeError("Price is required.")
          .required("Price is required.")
          .min(0, "Price must be 0 or more."),
      })
    )
    .min(1, "Add at least one price tier.")
    .required("Add at least one price tier."),
  price_duration: yup
    .string()
    .oneOf(["showtime", "1_day", "1_week", "2_weeks", "1_month"], "Select a valid duration.")
    .default("showtime"),
});

export type MovieShowtimeFormValues = yup.InferType<typeof movieShowtimeFormSchema>;

export const emptyMovieShowtimeFormValues = (overrides?: Partial<MovieShowtimeFormValues>): MovieShowtimeFormValues => ({
  movie_id: "",
  cinema_screen_id: "",
  show_date: "",
  start_time: "14:00",
  language: "English",
  format: "2D",
  tier_pricing: [
    { tier_name: "Regular", price: 200 },
    { tier_name: "Recliner", price: 350 },
    { tier_name: "Couple", price: 500 },
  ],
  price_duration: "showtime",
  ...overrides,
});

/** Cinema partner — add screen */
const nonNegSeatCount = (label: string) =>
  yup
    .string()
    .trim()
    .transform((v) => (v == null || v === "" ? "0" : v))
    .test("seat-number", `${label} must be 0 or a whole number.`, (value) => {
      const n = Number(value);
      return Number.isFinite(n) && Number.isInteger(n) && n >= 0;
    });

export const cinemaScreenFormSchema = yup
  .object({
    name: yup
      .string()
      .trim()
      .required("Screen name is required.")
      .min(1, "Screen name is required.")
      .max(120, "Screen name must be at most 120 characters."),
    screen_type: yup
      .string()
      .oneOf(["standard", "imax", "4dx", "other"], "Select a valid screen type.")
      .required("Screen type is required."),
    capacity: yup
      .string()
      .trim()
      .required("Expected capacity (total seats) is required.")
      .test("capacity-number", "Total capacity must be a positive whole number.", (value) => {
        if (value == null || value === "") return false;
        const n = Number(value);
        return Number.isFinite(n) && Number.isInteger(n) && n >= 1;
      }),
    regular_seats: nonNegSeatCount("Regular seats"),
    recliner_seats: nonNegSeatCount("Recliner seats"),
    couple_seats: nonNegSeatCount("Couple seats"),
    description: yup.string().trim().default(""),
  })
  .test("seat-types-part-of-total", "Seat types must add up to total capacity.", function (values) {
    if (!values) return false;
    const cap = Number(values.capacity) || 0;
    const regular = Number(values.regular_seats) || 0;
    const recliner = Number(values.recliner_seats) || 0;
    const couple = Number(values.couple_seats) || 0;
    const sum = regular + recliner + couple;

    if (cap < 1) return true;

    if (sum < 1) {
      return this.createError({
        path: "regular_seats",
        message: "Split the total capacity across Regular, Recliner, and/or Couple seats.",
      });
    }

    if (sum > cap) {
      return this.createError({
        path: "regular_seats",
        message: `Regular + Recliner + Couple (${sum}) cannot exceed total capacity (${cap}). Reduce by ${sum - cap}.`,
      });
    }

    if (sum < cap) {
      return this.createError({
        path: "regular_seats",
        message: `Regular + Recliner + Couple (${sum}) must equal total capacity (${cap}). ${cap - sum} seat(s) still unassigned.`,
      });
    }

    return true;
  });

export type CinemaScreenFormValues = yup.InferType<typeof cinemaScreenFormSchema>;

export const emptyCinemaScreenFormValues = (): CinemaScreenFormValues => ({
  name: "",
  screen_type: "standard",
  capacity: "200",
  regular_seats: "",
  recliner_seats: "",
  couple_seats: "",
  description: "",
});

/** Cinema partner — reject layout reason modal */
export const layoutRejectReasonSchema = yup.object({
  reason: yup
    .string()
    .trim()
    .required("Rejection reason is required.")
    .min(3, "Please provide a short reason (at least 3 characters).")
    .max(500, "Reason must be at most 500 characters."),
});

export type LayoutRejectReasonValues = yup.InferType<typeof layoutRejectReasonSchema>;
