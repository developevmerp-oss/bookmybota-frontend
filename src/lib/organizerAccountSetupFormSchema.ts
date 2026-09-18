import * as yup from "yup";
import { adminPhoneSchema } from "@/lib/adminFormSchemas";

export const MAX_CONTACT_PERSONS = 5;

export type ContactPersonFormValues = {
  name: string;
  email: string;
  phone: string;
};

export type OrganizerAccountSetupFormValues = {
  name: string;
  address: string;
  contacts: ContactPersonFormValues[];
  subtypeId: string;
};

const contactPersonSchema = yup.object({
  name: yup
    .string()
    .trim()
    .required("Contact name is required.")
    .min(2, "Contact name must be at least 2 characters."),
  email: yup
    .string()
    .trim()
    .required("Email is required.")
    .email("Enter a valid email address."),
  phone: adminPhoneSchema,
});

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
    contacts: yup
      .array()
      .of(contactPersonSchema)
      .min(1, "At least one contact person is required.")
      .max(MAX_CONTACT_PERSONS, `You can add at most ${MAX_CONTACT_PERSONS} contact persons.`)
      .required()
      .test("unique-emails", "Each contact must use a different email.", (rows) => {
        if (!rows?.length) return true;
        const emails = rows.map((r) => String(r?.email || "").trim().toLowerCase()).filter(Boolean);
        return new Set(emails).size === emails.length;
      }),
    subtypeId: opts.needsSubtype
      ? yup.string().trim().required("Please select a type.")
      : yup.string().trim().default(""),
  });
}

export const emptyContactPerson = (): ContactPersonFormValues => ({
  name: "",
  email: "",
  phone: "",
});

export const emptyOrganizerAccountSetupFormValues =
  (): OrganizerAccountSetupFormValues => ({
    name: "",
    address: "",
    contacts: [emptyContactPerson()],
    subtypeId: "",
  });
