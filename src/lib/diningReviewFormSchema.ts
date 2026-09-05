import * as yup from "yup";

/** Customer dining venue review form. */
export const diningReviewFormSchema = yup.object({
  user_name: yup
    .string()
    .trim()
    .required("Your name is required.")
    .min(2, "Name must be at least 2 characters.")
    .max(80, "Name must be at most 80 characters."),
  rating: yup
    .number()
    .typeError("Please select a rating.")
    .required("Please select a rating.")
    .min(1, "Rating must be at least 1 star.")
    .max(5, "Rating cannot be more than 5 stars."),
  text: yup
    .string()
    .trim()
    .required("Comment is required.")
    .min(5, "Please write at least 5 characters.")
    .max(1000, "Comment must be at most 1000 characters."),
});

export type DiningReviewFormValues = yup.InferType<typeof diningReviewFormSchema>;

export const emptyDiningReviewFormValues = (): DiningReviewFormValues => ({
  user_name: "",
  rating: 5,
  text: "",
});
