"use client";

import { Plus, Trash2 } from "lucide-react";
import PhoneInput from "@/components/Shared/PhoneInput";
import { MAX_CONTACT_PERSONS } from "@/lib/organizerAccountSetupFormSchema";

export type ContactPersonFieldValue = {
  name: string;
  email: string;
  phone: string;
};

type FieldErrors = {
  name?: { message?: string };
  email?: { message?: string };
  phone?: { message?: string };
};

type Props = {
  contacts: ContactPersonFieldValue[];
  errors?: Array<FieldErrors | undefined>;
  rootError?: string;
  onChange: (index: number, field: keyof ContactPersonFieldValue, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  labelClass: string;
  inputClass: string;
  fieldErrorClass: string;
  reqStar: React.ReactNode;
  /** When true, primary contact email cannot be edited (admin edit mode). */
  lockPrimaryEmail?: boolean;
  phoneVariant?: "light" | "dark";
};

export default function ContactPersonsFields({
  contacts,
  errors,
  rootError,
  onChange,
  onAdd,
  onRemove,
  labelClass,
  inputClass,
  fieldErrorClass,
  reqStar,
  lockPrimaryEmail = false,
  phoneVariant = "light",
}: Props) {
  const canAdd = contacts.length < MAX_CONTACT_PERSONS;
  const canRemove = contacts.length > 1;

  return (
    <div className="space-y-5">
      {contacts.map((contact, index) => {
        const err = errors?.[index];
        const isPrimary = index === 0;
        return (
          <div
            key={index}
            className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800">
                {isPrimary ? "Primary contact (admin login)" : `Contact person ${index + 1}`}
              </p>
              {canRemove ? (
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700"
                >
                  <Trash2 size={14} /> Remove
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Full Name {reqStar}</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Enter full name"
                  value={contact.name}
                  onChange={(e) => onChange(index, "name", e.target.value)}
                />
                {err?.name?.message ? (
                  <p className={fieldErrorClass}>{err.name.message}</p>
                ) : null}
              </div>
              <div>
                <label className={labelClass}>
                  {isPrimary ? "Email (Admin Login Email)" : "Email"} {reqStar}
                </label>
                <input
                  type="email"
                  className={`${inputClass} ${
                    lockPrimaryEmail && isPrimary ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                  placeholder="Enter email address"
                  value={contact.email}
                  disabled={lockPrimaryEmail && isPrimary}
                  readOnly={lockPrimaryEmail && isPrimary}
                  onChange={(e) => onChange(index, "email", e.target.value)}
                />
                {err?.email?.message ? (
                  <p className={fieldErrorClass}>{err.email.message}</p>
                ) : null}
                {isPrimary ? (
                  <p className="mt-1 text-xs text-slate-400">
                    Password is auto-generated and emailed after onboarding.
                  </p>
                ) : null}
              </div>
              <div>
                <PhoneInput
                  label="Phone Number"
                  labelClassName={labelClass}
                  variant={phoneVariant}
                  value={contact.phone}
                  onChange={(v) => onChange(index, "phone", v)}
                  required
                  error={err?.phone?.message}
                  showError={!!err?.phone}
                  placeholder="Enter mobile number"
                  inputClassName={inputClass}
                  helperText="9–12 digits, numbers only"
                />
              </div>
            </div>
          </div>
        );
      })}

      {rootError ? <p className={fieldErrorClass}>{rootError}</p> : null}

      {canAdd ? (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-lg border border-dashed border-rose-300 bg-rose-50/50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
        >
          <Plus size={16} /> Add contact person
          <span className="font-normal text-rose-500/80">
            ({contacts.length}/{MAX_CONTACT_PERSONS})
          </span>
        </button>
      ) : (
        <p className="text-xs text-slate-500">Maximum {MAX_CONTACT_PERSONS} contact persons reached.</p>
      )}
    </div>
  );
}
