import * as yup from "yup";

/** Manual QR / booking-code lookup on organizer scan page. */
export const organizerScanTokenSchema = yup.object({
  manualToken: yup.string().trim().required("Booking code is required."),
});

export type OrganizerScanTokenValues = yup.InferType<typeof organizerScanTokenSchema>;

/** Public reply on an event review. */
export const organizerReviewReplySchema = yup.object({
  text: yup
    .string()
    .trim()
    .required("Reply text is required.")
    .min(2, "Reply must be at least 2 characters.")
    .max(1000, "Reply must be at most 1000 characters."),
});

export type OrganizerReviewReplyValues = yup.InferType<typeof organizerReviewReplySchema>;

/** Notes when approving or requesting layout changes. */
export function buildOrganizerLayoutNotesSchema(action: "approve" | "request_changes") {
  if (action === "request_changes") {
    return yup.object({
      notes: yup
        .string()
        .trim()
        .required("Notes are required when requesting changes.")
        .min(2, "Please provide at least 2 characters."),
    });
  }
  return yup.object({
    notes: yup.string().trim().default(""),
  });
}

export type OrganizerLayoutNotesValues = { notes: string };
