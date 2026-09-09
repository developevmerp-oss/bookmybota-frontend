"use client";

import { ImagePlus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useUploadImageMutation } from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { VENUE_GALLERY_MAX } from "@/lib/artistMeta";

export function normalizeImageList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

type Props = {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  title?: string;
  description?: string;
  disabled?: boolean;
  /** Tighter spacing for dense admin layouts */
  compact?: boolean;
};

export default function PartnerPhotoGalleryFields({
  value,
  onChange,
  max = VENUE_GALLERY_MAX,
  title = "Photo gallery",
  description = "Add photos customers will see on your public profile.",
  disabled = false,
  compact = false,
}: Props) {
  const [uploadImage, { isLoading: uploading }] = useUploadImageMutation();
  const images = value || [];

  const uploadInput = (
    <input
      type="file"
      accept="image/*"
      className="hidden"
      disabled={uploading}
      onChange={async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        const fd = new FormData();
        fd.append("image", file);
        try {
          const res = await uploadImage(fd).unwrap();
          if (res.url) {
            onChange([...images, res.url].slice(0, max));
            toast.success("Gallery photo uploaded");
          }
        } catch (err) {
          toast.error(extractApiError(err, "Failed to upload photo"));
        }
      }}
    />
  );

  return (
    <section className={`org-card ${compact ? "p-4 sm:p-5 space-y-3" : "p-5 sm:p-6 space-y-4"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className={`font-display font-bold text-foreground ${compact ? "text-base" : "text-lg"}`}>
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {description} Up to {max} photos.
          </p>
        </div>
        {!disabled && images.length > 0 && images.length < max ? (
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-border text-xs font-semibold text-foreground hover:border-primary cursor-pointer shrink-0">
            <Upload size={14} className="text-primary" />
            {uploading ? "Uploading…" : "Add photo"}
            {uploadInput}
          </label>
        ) : null}
      </div>

      {images.length === 0 ? (
        <div
          className={`rounded-xl border border-dashed border-border bg-muted/20 text-center space-y-2 ${
            compact ? "px-3 py-5" : "px-4 py-10 space-y-3"
          }`}
        >
          <ImagePlus className="mx-auto text-muted-foreground" size={compact ? 22 : 28} />
          <p className="text-sm text-muted-foreground">No gallery photos yet.</p>
          {!disabled ? (
            <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer">
              <Upload size={15} />
              {uploading ? "Uploading…" : "Add first photo"}
              {uploadInput}
            </label>
          ) : null}
        </div>
      ) : (
        <div
          className={`grid gap-2.5 ${
            compact
              ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5"
              : "grid-cols-2 sm:grid-cols-3"
          }`}
        >
          {images.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              className="relative group rounded-xl overflow-hidden border border-border aspect-[4/3] bg-muted"
            >
              <img src={resolveMediaUrl(url)} alt="" className="w-full h-full object-cover" />
              {!disabled ? (
                <button
                  type="button"
                  className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-white/90 text-destructive opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  onClick={() => onChange(images.filter((_, i) => i !== idx))}
                  title="Remove"
                >
                  <Trash2 size={13} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
