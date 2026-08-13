"use client";

import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useUploadImageMutation } from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";

type Props = {
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
};

export default function SignaturePad({ value, onChange, label = "Your signature" }: Props) {
  const [uploadImage, { isLoading }] = useUploadImageMutation();
  const [localFileName, setLocalFileName] = useState<string>("");

  const uploadFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("image", file);
      const result = await uploadImage(fd).unwrap();
      if (!result.url) throw new Error("Upload returned no URL");
      onChange(result.url);
      setLocalFileName(file.name);
      toast.success("Signature uploaded.");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to upload signature"));
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-800">{label}</p>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs text-slate-500 mb-3">
          Upload signature image (PNG/JPG). The image will be placed on the digital contract.
        </p>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 cursor-pointer">
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Upload signature image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => uploadFile(e.target.files?.[0] || null)}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setLocalFileName("");
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-white"
          >
            Clear
          </button>
        </div>
        {localFileName && <p className="text-xs text-slate-500 mt-2">Selected: {localFileName}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer">
          Replace image
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => uploadFile(e.target.files?.[0] || null)}
          />
        </label>
      </div>
      {value && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs text-emerald-700 font-medium mb-2">Signature ready</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Signature preview" className="h-16 object-contain bg-white rounded border border-emerald-100" />
        </div>
      )}
    </div>
  );
}
