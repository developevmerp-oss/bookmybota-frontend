import * as yup from "yup";
import { adminPhoneSchema } from "@/lib/adminFormSchemas";

export type OrganizerAccountSetupFormValues = {
  name: string;
  address: string;
  contact: string;
  email: string;
  phone: string;
  subtypeId: string;
};

export function buildOrganizerAccountSetupFormSchema(opts: {
  needsSubtype: boolean;
  requireAddress: boolean;
}) {
  return yup.object({
    name: yup
      .string()
      .trim()
      .required("Name is required.")
      .min(2, "Name must be at least 2 characters."),
    address: opts.requireAddress
      ? yup
          .string()
          .trim()
          .required("Address is required.")
          .min(2, "Address must be at least 2 characters.")
      : yup.string().trim().default(""),
    contact: yup
      .string()
      .trim()
      .required("Contact name is required.")
      .min(2, "Contact name must be at least 2 characters."),
    email: yup
      .string()
      .trim()
      .required("Admin email is required.")
      .email("Enter a valid email address."),
    phone: adminPhoneSchema,
    subtypeId: opts.needsSubtype
      ? yup.string().trim().required("Please select a type.")
      : yup.string().trim().default(""),
  });
}

export const emptyOrganizerAccountSetupFormValues =
  (): OrganizerAccountSetupFormValues => ({
    name: "",
    address: "",
    contact: "",
    email: "",
    phone: "",
    subtypeId: "",
  });
