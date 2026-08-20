import * as yup from "yup";

export const eventReviewFormSchema = yup.object({
  user_name: yup
    .string()
    .trim()
    .required("Name is required.")
    .min(2, "Name must be at least 2 characters.")
    .max(80, "Name must be at most 80 characters."),
  rating: yup
    .number()
    .typeError("Please select a rating.")
    .required("Please select a rating.")
    .min(1, "Rating must be at least 1 star.")
    .max(5, "Rating cannot be more than 5 stars.")
    .test("half-star", "Use whole or half stars (e.g. 3.5, 4.5).", (value) => {
      if (value == null || Number.isNaN(value)) return false;
      return Math.abs(value * 2 - Math.round(value * 2)) < 1e-9;
    }),
  text: yup
    .string()
    .trim()
    .required("Review text is required.")
    .min(10, "Please write at least 10 characters.")
    .max(1000, "Review must be at most 1000 characters."),
});

export type EventReviewFormValues = yup.InferType<typeof eventReviewFormSchema>;
