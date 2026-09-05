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
    { tier_name: "VIP", price: 350 },
    { tier_name: "Standard", price: 200 },
  ],
  ...overrides,
});

/** Cinema partner — add screen */
export const cinemaScreenFormSchema = yup.object({
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
    .required("Expected capacity is required.")
    .test("capacity-number", "Capacity must be a positive whole number.", (value) => {
      if (value == null || value === "") return false;
      const n = Number(value);
      return Number.isFinite(n) && Number.isInteger(n) && n >= 1;
    }),
  description: yup.string().trim().default(""),
});

export type CinemaScreenFormValues = yup.InferType<typeof cinemaScreenFormSchema>;

export const emptyCinemaScreenFormValues = (): CinemaScreenFormValues => ({
  name: "",
  screen_type: "standard",
  capacity: "200",
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
