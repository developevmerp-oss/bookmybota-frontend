import * as yup from "yup";

export const venuePartnerProfileSchema = yup.object({
  name: yup.string().trim().required("Venue name is required").max(200, "Keep the name under 200 characters"),
  phone: yup.string().trim().required("Phone number is required"),
  address: yup.string().trim().required("Venue address is required").max(500, "Address is too long"),
  aboutText: yup.string().trim().max(2000, "About text is too long").default(""),
  contactName: yup
    .string()
    .trim()
    .required("Contact person name is required")
    .max(120, "Keep the contact name under 120 characters"),
  countryId: yup
    .mixed<number | "">()
    .test("country", "Country is required", (v) => v !== "" && v != null && Number(v) > 0),
  cityId: yup
    .mixed<number | "">()
    .test("city", "City is required", (v) => v !== "" && v != null && Number(v) > 0),
});

export type VenuePartnerProfileValues = yup.InferType<typeof venuePartnerProfileSchema>;

export const artistPartnerProfileSchema = yup.object({
  name: yup
    .string()
    .trim()
    .required("Artist / stage name is required")
    .max(200, "Keep the name under 200 characters"),
  phone: yup.string().trim().required("Phone number is required"),
  address: yup
    .string()
    .trim()
    .required("Address / base city is required")
    .max(500, "Address is too long"),
  description: yup
    .string()
    .trim()
    .required("Bio / description is required")
    .max(2000, "Bio is too long"),
});

export type ArtistPartnerProfileValues = yup.InferType<typeof artistPartnerProfileSchema>;
