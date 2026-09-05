import * as yup from "yup";

/** Venue / Artist partner — add free-date range (From / To required) */
export const partnerAvailabilityRangeSchema = yup.object({
  range_from: yup.string().trim().required("From date is required."),
  range_to: yup
    .string()
    .trim()
    .required("To date is required.")
    .test("on-or-after-from", "From date must be on or before To date.", function (value) {
      const from = this.parent.range_from as string | undefined;
      if (!from || !value) return true;
      return from <= value;
    }),
});

export type PartnerAvailabilityRangeValues = yup.InferType<typeof partnerAvailabilityRangeSchema>;

export const emptyPartnerAvailabilityRangeValues = (): PartnerAvailabilityRangeValues => ({
  range_from: "",
  range_to: "",
});
