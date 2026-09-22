"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import PartnerMediaLightbox from "@/components/Shared/PartnerMediaLightbox";

type Props = {
  images: string[];
  title?: string;
  label?: string;
  /** Matches existing artist/venue gallery spacing while staying responsive. */
  dense?: boolean;
};

export default function PartnerPublicGallery({
  images,
  title = "Gallery",
  label = "Gallery",
  dense = false,
}: Props) {
  const gallery = images.filter((u): u is string => typeof u === "string" && !!u.trim());
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [startIndex, setStartIndex] = useState(0);

  if (gallery.length === 0) return null;

  const hasMore = gallery.length > 3;
  const preview = hasMore ? gallery.slice(0, 3) : gallery;

  const openAt = (i: number) => {
    setStartIndex(i);
    setLightboxOpen(true);
  };

  return (
    <section>
      <h2 className="text-xl font-bold tracking-tight text-[#111111] sm:text-2xl">{title}</h2>
      <div
        className={`mt-4 grid grid-cols-2 sm:grid-cols-3 ${
          dense ? "gap-2.5 sm:gap-4" : "gap-3 sm:gap-4"
        }`}
      >
        {preview.map((url, idx) => {
          const showMoreOverlay = hasMore && idx === 2;
          const src = resolveMediaUrl(url);
          return (
            <button
              key={`${url}-${idx}`}
              type="button"
              onClick={() => openAt(showMoreOverlay ? 0 : idx)}
              className="relative aspect-[4/3] overflow-hidden rounded-xl border border-[#F3F4F6] bg-[#FAFAFA] cursor-pointer group text-left"
              aria-label={
                showMoreOverlay
                  ? `View all ${gallery.length} photos`
                  : `View photo ${idx + 1}`
              }
            >
              <img
                src={src}
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
              {showMoreOverlay ? (
                <span className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white transition-colors group-hover:bg-black/70">
                  <ImageIcon size={22} className="mb-1" strokeWidth={1.75} />
                  <span className="font-bold text-sm tracking-wide">View all photos</span>
                  <span className="text-[0.625rem] text-white/70 mt-0.5">
                    {gallery.length} Photos
                  </span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <PartnerMediaLightbox
        open={lightboxOpen}
        items={gallery}
        startIndex={startIndex}
        kind="image"
        label={label}
        onClose={() => setLightboxOpen(false)}
      />
    </section>
  );
}
