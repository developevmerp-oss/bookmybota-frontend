"use client";

import { FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  useGetPartnerDocumentMastersQuery,
  useUploadImageMutation,
  type PartnerDocumentMaster,
  type PartnerDocumentUpload,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";

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

export function validateRequiredPartnerDocuments(
  masters: PartnerDocumentMaster[] | undefined,
  docs: PartnerDocumentUpload[]
): string | null {
  if (!masters?.length) return null;
  const uploaded = new Set(
    docs.filter((d) => d.document_type_id > 0 && d.url?.trim()).map((d) => d.document_type_id)
  );
  const missing = masters.filter((m) => m.is_required && !uploaded.has(m.id));
  if (missing.length === 0) return null;
  return `Please upload required document(s): ${missing.map((m) => m.name).join(", ")}`;
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
  const [uploadImage, { isLoading: uploading }] = useUploadImageMutation();

  const isDark = variant === "dark";
  const sectionClass = isDark
    ? "rounded-xl border border-white/10 bg-zinc-900/40 p-4 space-y-3"
    : "rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3";
  const titleClass = isDark ? "text-white font-semibold" : "text-slate-800 font-semibold";
  const mutedClass = isDark ? "text-zinc-400 text-sm" : "text-slate-500 text-sm";
  const cardClass = isDark
    ? "p-3 rounded-lg border border-white/10 bg-zinc-950/40 space-y-2"
    : "p-3 rounded-lg border border-slate-200 bg-white space-y-2";
  const fileRowClass = isDark
    ? "flex items-center gap-3 p-2.5 rounded-lg bg-zinc-900 border border-white/10"
    : "flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200";
  const linkClass = isDark
    ? "text-sm text-zinc-200 truncate flex-1 hover:text-rose-300"
    : "text-sm text-slate-800 truncate flex-1 hover:text-rose-600";
  const uploadBtnClass = isDark
    ? "inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/20 text-sm text-zinc-300 hover:border-rose-400 cursor-pointer"
    : "inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 text-sm text-slate-600 hover:border-rose-400 cursor-pointer";

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    documentTypeId: number,
    documentName: string
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await uploadImage(formData).unwrap();
      onChange([
        ...value.filter((d) => d.document_type_id !== documentTypeId),
        {
          document_type_id: documentTypeId,
          url: res.url,
          document_name: documentName,
          uploaded_at: new Date().toISOString(),
        },
      ]);
      toast.success(`${documentName} uploaded`);
    } catch (err) {
      toast.error(extractApiError(err, `Failed to upload ${file.name}`));
    }
  };

  const removeDoc = (documentTypeId: number) => {
    onChange(value.filter((d) => d.document_type_id !== documentTypeId));
  };

  return (
    <div className={`${sectionClass} ${className || ""}`}>
      <div>
        <h3 className={titleClass}>Onboarding documents</h3>
        <p className={`${mutedClass} mt-1`}>
          {editable ? (
            <>
              Upload clear PDF or image files. Required documents marked{" "}
              <span className="text-rose-500">*</span>.
            </>
          ) : (
            <>Review uploaded files. Required documents marked{" "}
              <span className="text-rose-500">*</span>.
            </>
          )}
        </p>
      </div>

      {isLoading ? (
        <p className={mutedClass}>Loading document checklist...</p>
      ) : masters.length === 0 ? (
        <p className={isDark ? "text-amber-400 text-sm" : "text-amber-700 text-sm"}>
          No document types configured yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {masters.map((doc) => {
            const uploadedUrl = value.find((d) => d.document_type_id === doc.id)?.url;
            return (
              <div key={doc.id} className={cardClass}>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={isDark ? "text-zinc-100 font-medium text-sm" : "text-slate-800 font-medium text-sm"}>
                      {doc.name}
                    </span>
                    {doc.is_required && <span className="text-rose-500 text-sm">*</span>}
                  </div>
                  {doc.description && <p className={`${mutedClass} mt-1 leading-relaxed`}>{doc.description}</p>}
                </div>

                {uploadedUrl ? (
                  <div className={fileRowClass}>
                    <FileText size={16} className="text-rose-500 shrink-0" />
                    <a
                      href={uploadedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={linkClass}
                    >
                      View uploaded file
                    </a>
                    {editable && (
                      <button
                        type="button"
                        onClick={() => removeDoc(doc.id)}
                        className="text-zinc-400 hover:text-rose-500"
                        aria-label={`Remove ${doc.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ) : editable ? (
                  <label className={uploadBtnClass}>
                    <Upload size={16} />
                    {uploading ? "Uploading..." : "Upload PDF or image"}
                    <input
                      type="file"
                      accept={doc.accept || "image/*,.pdf"}
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => handleUpload(e, doc.id, doc.name)}
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
