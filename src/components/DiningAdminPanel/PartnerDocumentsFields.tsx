"use client";

import { useState } from "react";
import { Eye, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  useGetPartnerDocumentMastersQuery,
  useUploadImageMutation,
  type PartnerDocumentMaster,
  type PartnerDocumentUpload,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { resolveMediaUrl } from "@/lib/mediaUrl";

type Variant = "light" | "dark";

interface PartnerDocumentsFieldsProps {
  module: "dining" | "event" | "venue" | "artist" | "cinema";
  value: PartnerDocumentUpload[];
  onChange: (docs: PartnerDocumentUpload[]) => void;
  variant?: Variant;
  /** When false, only show uploaded files (read-only review) */
  editable?: boolean;
  className?: string;
}

export function hasPartnerDocumentSelected(d: PartnerDocumentUpload): boolean {
  return Boolean(d.pending_file) || Boolean(d.url?.trim());
}

export function hasPartnerDocumentUploaded(d: PartnerDocumentUpload): boolean {
  return Boolean(d.url?.trim()) && !d.pending_file;
}

export function validateRequiredPartnerDocuments(
  masters: PartnerDocumentMaster[] | undefined,
  docs: PartnerDocumentUpload[]
): string | null {
  if (!masters?.length) return null;
  const uploaded = new Set(
    docs
      .filter((d) => d.document_type_id > 0 && hasPartnerDocumentUploaded(d))
      .map((d) => d.document_type_id)
  );
  const missing = masters.filter((m) => m.is_required && !uploaded.has(m.id));
  if (missing.length === 0) return null;
  const pendingOnly = masters.filter(
    (m) =>
      m.is_required &&
      !uploaded.has(m.id) &&
      docs.some((d) => d.document_type_id === m.id && d.pending_file)
  );
  if (pendingOnly.length > 0) {
    return `Click Submit to upload: ${pendingOnly.map((m) => m.name).join(", ")}`;
  }
  return `Please upload required document(s): ${missing.map((m) => m.name).join(", ")}`;
}

/** Upload any locally selected files, then return API-safe document payloads. */
export async function resolvePartnerDocumentsForSubmit(
  docs: PartnerDocumentUpload[],
  uploadFn: (formData: FormData) => Promise<{ url: string }>
): Promise<
  Array<{
    document_type_id: number;
    url: string;
    document_name?: string;
    uploaded_at?: string;
  }>
> {
  const out: Array<{
    document_type_id: number;
    url: string;
    document_name?: string;
    uploaded_at?: string;
  }> = [];

  for (const d of docs) {
    if (d.pending_file) {
      const formData = new FormData();
      formData.append("image", d.pending_file);
      const res = await uploadFn(formData);
      if (d.pending_preview_url) {
        try {
          URL.revokeObjectURL(d.pending_preview_url);
        } catch {
          /* ignore */
        }
      }
      out.push({
        document_type_id: d.document_type_id,
        url: res.url,
        document_name: d.document_name,
        uploaded_at: new Date().toISOString(),
      });
    } else if (d.url?.trim()) {
      out.push({
        document_type_id: d.document_type_id,
        url: d.url,
        document_name: d.document_name,
        uploaded_at: d.uploaded_at,
      });
    }
  }

  return out;
}

export default function PartnerDocumentsFields({
  module,
  value,
  onChange,
  variant = "light",
  editable = true,
  className,
}: PartnerDocumentsFieldsProps) {
  const { data: masters = [], isLoading } = useGetPartnerDocumentMastersQuery(module, {
    refetchOnMountOrArgChange: true,
  });
  const [uploadImage] = useUploadImageMutation();
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  void variant;

  const sectionClass = "org-card p-5 sm:p-6 space-y-3";
  const titleClass = "font-display text-lg font-bold text-foreground";
  const mutedClass = "text-muted-foreground text-sm";
  const cardClass = "p-3 rounded-xl border border-border bg-muted/30 space-y-2";
  const fileRowClass = "flex items-center gap-3 p-2.5 rounded-lg bg-card border border-border";
  const uploadBtnClass =
    "inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary cursor-pointer";

  const handleSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    documentTypeId: number,
    documentName: string
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const prev = value.find((d) => d.document_type_id === documentTypeId);
    if (prev?.pending_preview_url) {
      try {
        URL.revokeObjectURL(prev.pending_preview_url);
      } catch {
        /* ignore */
      }
    }

    onChange([
      ...value.filter((d) => d.document_type_id !== documentTypeId),
      {
        document_type_id: documentTypeId,
        url: "",
        document_name: documentName,
        pending_file: file,
        pending_file_name: file.name,
        pending_preview_url: URL.createObjectURL(file),
      },
    ]);
  };

  const handleSubmitDoc = async (documentTypeId: number) => {
    const entry = value.find((d) => d.document_type_id === documentTypeId);
    if (!entry?.pending_file) return;

    setUploadingId(documentTypeId);
    const formData = new FormData();
    formData.append("image", entry.pending_file);
    try {
      const res = await uploadImage(formData).unwrap();
      if (entry.pending_preview_url) {
        try {
          URL.revokeObjectURL(entry.pending_preview_url);
        } catch {
          /* ignore */
        }
      }
      onChange([
        ...value.filter((d) => d.document_type_id !== documentTypeId),
        {
          document_type_id: documentTypeId,
          url: res.url,
          document_name: entry.document_name,
          uploaded_at: new Date().toISOString(),
        },
      ]);
      toast.success(`${entry.document_name || "Document"} uploaded`);
    } catch (err) {
      toast.error(extractApiError(err, `Failed to upload ${entry.pending_file_name || "document"}`));
    } finally {
      setUploadingId(null);
    }
  };

  const removeDoc = (documentTypeId: number) => {
    const prev = value.find((d) => d.document_type_id === documentTypeId);
    if (prev?.pending_preview_url) {
      try {
        URL.revokeObjectURL(prev.pending_preview_url);
      } catch {
        /* ignore */
      }
    }
    onChange(value.filter((d) => d.document_type_id !== documentTypeId));
  };

  return (
    <div className={`${sectionClass} ${className || ""}`}>
      <div>
        <h3 className={titleClass}>Onboarding documents</h3>
        <p className={`${mutedClass} mt-1`}>
          {editable ? (
            <>
              Choose a file, then click <span className="font-semibold text-foreground">Submit</span> on
              that field to upload it. Required documents marked <span className="text-rose-500">*</span>.
            </>
          ) : (
            <>
              Review uploaded files. Required documents marked <span className="text-rose-500">*</span>.
            </>
          )}
        </p>
      </div>

      {isLoading ? (
        <p className={mutedClass}>Loading document checklist...</p>
      ) : masters.length === 0 ? (
        <p className="text-amber-700 text-sm">No document types configured yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {masters.map((doc) => {
            const entry = value.find((d) => d.document_type_id === doc.id);
            const hasFile = entry ? hasPartnerDocumentSelected(entry) : false;
            const isPending = Boolean(entry?.pending_file);
            const isUploading = uploadingId === doc.id;
            const viewHref = entry?.pending_preview_url
              ? entry.pending_preview_url
              : entry?.url
                ? resolveMediaUrl(entry.url)
                : "";
            const fileLabel = entry?.pending_file_name || entry?.document_name || doc.name;

            return (
              <div key={doc.id} className={cardClass}>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-foreground font-medium text-sm">{doc.name}</span>
                    {doc.is_required && <span className="text-rose-500 text-sm">*</span>}
                  </div>
                  {doc.description && (
                    <p className={`${mutedClass} mt-1 leading-relaxed`}>{doc.description}</p>
                  )}
                </div>

                {hasFile ? (
                  <div className="space-y-2">
                    <div className={`${fileRowClass} flex-wrap`}>
                      <a
                        href={viewHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                        title="View document"
                        aria-label={`View ${doc.name}`}
                      >
                        <Eye size={18} />
                      </a>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-foreground truncate" title={fileLabel}>
                          {fileLabel}
                        </p>
                        {isPending ? (
                          <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                            Selected — click Submit to upload
                          </p>
                        ) : (
                          <p className="text-[11px] text-emerald-700 font-medium mt-0.5">Uploaded</p>
                        )}
                      </div>
                      {editable && (
                        <button
                          type="button"
                          onClick={() => removeDoc(doc.id)}
                          disabled={isUploading}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                          title="Remove document"
                          aria-label={`Remove ${doc.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    {editable && isPending && (
                      <button
                        type="button"
                        onClick={() => void handleSubmitDoc(doc.id)}
                        disabled={isUploading}
                        className="w-full h-9 rounded-lg bg-[#e11d48] text-white text-sm font-semibold hover:bg-[#be123c] disabled:opacity-50 inline-flex items-center justify-center gap-2"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Uploading…
                          </>
                        ) : (
                          "Submit"
                        )}
                      </button>
                    )}
                  </div>
                ) : editable ? (
                  <label className={uploadBtnClass}>
                    <Upload size={16} />
                    Choose PDF or image
                    <input
                      type="file"
                      accept={doc.accept || "image/*,.pdf"}
                      className="hidden"
                      onChange={(e) => handleSelect(e, doc.id, doc.name)}
                    />
                  </label>
                ) : (
                  <p className={doc.is_required ? "text-amber-400 text-sm" : mutedClass}>
                    {doc.is_required ? "Required — not uploaded" : "Not uploaded"}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
