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
};

export default function PartnerPhotoGalleryFields({
  value,
  onChange,
  max = VENUE_GALLERY_MAX,
  title = "Photo gallery",
  description = "Add photos customers will see on your public profile.",
  disabled = false,
}: Props) {
  const [uploadImage, { isLoading: uploading }] = useUploadImageMutation();
  const images = value || [];

  return (
    <section className="org-card p-5 sm:p-6 space-y-4">
      <div>
        <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          {description} Up to {max} photos.
        </p>
      </div>

      {images.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center space-y-3">
          <ImagePlus className="mx-auto text-muted-foreground" size={28} />
          <p className="text-sm text-muted-foreground">No gallery photos yet.</p>
          {!disabled ? (
            <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer">
              <Upload size={16} />
              {uploading ? "Uploading…" : "Add first photo"}
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
            </label>
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((url, idx) => (
              <div
                key={`${url}-${idx}`}
                className="relative group rounded-xl overflow-hidden border border-border aspect-[4/3] bg-muted"
              >
                <img src={resolveMediaUrl(url)} alt="" className="w-full h-full object-cover" />
                {!disabled ? (
                  <button
                    type="button"
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 text-destructive opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    onClick={() => onChange(images.filter((_, i) => i !== idx))}
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {!disabled && images.length < max ? (
            <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border text-sm font-semibold text-foreground hover:border-primary cursor-pointer w-fit">
              <Upload size={16} className="text-primary" />
              {uploading ? "Uploading…" : "Add gallery photo"}
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
            </label>
          ) : null}
        </>
      )}
    </section>
  );
}
