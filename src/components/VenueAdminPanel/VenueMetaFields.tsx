"use client";

import { useMemo } from "react";
import { FileText, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { CroppedImageField } from "@/components/Shared/ImageCropPicker";
import { extractApiError } from "@/lib/apiErrors";
import {
  defaultVenueMeta,
  getVenueMetaFields,
  getVenueTypeFields,
  groupVenueFieldsBySection,
  type VenueFieldDef,
  type VenueMeta,
} from "@/lib/venueCategoryConfig";
import { useUploadImageMutation } from "@/services/api";

type VenueMetaFieldsProps = {
  venueTypeSlug?: string | null;
  value?: VenueMeta | null;
  onChange: (next: VenueMeta) => void;
  disabled?: boolean;
  variant?: "light" | "dark";
};

const lightInput =
  "w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#6900AA]/30 focus:border-[#6900AA]";
const darkInput =
  "w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white";

export default function VenueMetaFields({
  venueTypeSlug,
  value,
  onChange,
  disabled = false,
  variant = "light",
}: VenueMetaFieldsProps) {
  const [uploadImage, { isLoading: uploading }] = useUploadImageMutation();
  const fields = useMemo(() => getVenueTypeFields(venueTypeSlug), [venueTypeSlug]);
  const sections = useMemo(() => groupVenueFieldsBySection(fields), [fields]);
  const meta = value && typeof value === "object" ? value : defaultVenueMeta();
  const fieldValues = getVenueMetaFields(meta);

  const inputClass = variant === "dark" ? darkInput : lightInput;
  const labelClass =
    variant === "dark"
      ? "block text-sm font-medium text-zinc-400 mb-2"
      : "block text-sm font-medium text-[#1a1a2e] mb-2";
  const sectionClass =
    variant === "dark"
      ? "rounded-xl border border-white/10 bg-zinc-900/30 p-4 space-y-4"
      : "rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4";

  const patchField = (key: string, val: string | number | boolean) => {
    onChange({
      ...defaultVenueMeta(),
      ...meta,
      fields: { ...fieldValues, [key]: val },
    });
  };

  const uploadFile = async (key: string, file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    try {
      const res = await uploadImage(fd).unwrap();
      if (res.url) {
        patchField(key, res.url);
        toast.success("File uploaded");
      }
    } catch (err) {
      toast.error(extractApiError(err, "Failed to upload file"));
    }
  };

  if (!fields.length) {
    return (
      <p className={variant === "dark" ? "text-zinc-500 text-sm" : "text-slate-500 text-sm"}>
        No venue-specific fields for this type yet.
      </p>
    );
  }

  const renderField = (field: VenueFieldDef) => {
    const current = fieldValues[field.key];

    if (field.type === "boolean") {
      return (
        <label key={field.key} className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            disabled={disabled}
            checked={current === true || current === "true"}
            onChange={(e) => patchField(field.key, e.target.checked)}
            className="rounded border-slate-300 text-[#6900AA] focus:ring-[#6900AA]"
          />
          <span className={variant === "dark" ? "text-sm text-zinc-300" : "text-sm text-slate-700"}>
            {field.label}
          </span>
        </label>
      );
    }

    if (field.type === "select" && field.options?.length) {
      return (
        <div key={field.key}>
          <label className={labelClass}>{field.label}</label>
          <select
            disabled={disabled}
            className={inputClass}
            value={current != null ? String(current) : ""}
            onChange={(e) => patchField(field.key, e.target.value)}
          >
            <option value="">Select…</option>
            {field.options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (field.type === "file") {
      const url = typeof current === "string" ? current : "";
      const isImage = /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(url) || url.includes("cloudinary");
      return (
        <div key={field.key}>
          <label className={labelClass}>{field.label}</label>
          {url && isImage ? (
            <CroppedImageField
              value={url}
              aspect={16 / 9}
              disabled={disabled || uploading}
              previewClassName="w-full max-w-sm aspect-video rounded-lg border border-slate-200"
              emptyClassName="flex flex-col items-center justify-center w-full max-w-sm aspect-video rounded-lg border border-dashed border-slate-300"
              onRemove={() => patchField(field.key, "")}
              onCroppedFile={(file) => void uploadFile(field.key, file)}
              emptyContent={
                <>
                  <ImagePlus size={20} className="text-slate-400 mb-1" />
                  <span className="text-xs text-slate-500">{uploading ? "Uploading…" : "Upload plan"}</span>
                </>
              }
            />
          ) : url ? (
            <div className="flex items-center gap-3">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-violet-700 hover:underline"
              >
                <FileText size={16} /> View uploaded file
              </a>
              {!disabled && (
                <button
                  type="button"
                  className="text-xs text-rose-600"
                  onClick={() => patchField(field.key, "")}
                >
                  Remove
                </button>
              )}
            </div>
          ) : (
            <label
              className={`flex flex-col items-center justify-center w-full max-w-sm aspect-video rounded-lg border border-dashed cursor-pointer ${
                variant === "dark"
                  ? "border-white/20 hover:border-amber-400"
                  : "border-slate-300 hover:border-[#6900AA]"
              } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
            >
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                disabled={disabled || uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadFile(field.key, file);
                  e.target.value = "";
                }}
              />
              <FileText size={22} className={variant === "dark" ? "text-zinc-500" : "text-slate-400"} />
              <span className={`text-xs mt-1 ${variant === "dark" ? "text-zinc-500" : "text-slate-500"}`}>
                {uploading ? "Uploading…" : "Upload seating plan / blueprint"}
              </span>
            </label>
          )}
        </div>
      );
    }

    return (
      <div key={field.key}>
        <label className={labelClass}>{field.label}</label>
        <input
          disabled={disabled}
          type={field.type === "number" ? "number" : "text"}
          className={inputClass}
          value={current != null ? String(current) : ""}
          placeholder={field.placeholder}
          onChange={(e) => {
            const raw = e.target.value;
            if (field.type === "number") {
              if (raw === "") {
                const next = { ...fieldValues };
                delete next[field.key];
                onChange({
                  ...defaultVenueMeta(),
                  ...meta,
                  fields: next,
                });
              } else {
                patchField(field.key, Number(raw));
              }
            } else {
              patchField(field.key, raw);
            }
          }}
        />
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {sections.map(({ section, fields: sectionFields }) => (
        <div key={section} className={sectionClass}>
          <h4
            className={
              variant === "dark"
                ? "text-sm font-semibold text-white"
                : "text-sm font-semibold text-slate-800"
            }
          >
            {section}
          </h4>
          <div className="grid sm:grid-cols-2 gap-4">
            {sectionFields.map((field) => (
              <div
                key={field.key}
                className={
                  field.type === "boolean" || field.type === "file" ? "sm:col-span-2" : ""
                }
              >
                {renderField(field)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
