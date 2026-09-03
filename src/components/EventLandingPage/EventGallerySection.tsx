"use client";

import { useState } from "react";
import EventGalleryModal from "@/components/EventLandingPage/EventGalleryModal";
import { resolveMediaUrl } from "@/lib/mediaUrl";

type Props = {
  eventName: string;
  images: string[];
};

/** How many clear thumbs before the "See the Entire Gallery" tile */
const PREVIEW_COUNT = 2;

export default function EventGallerySection({ eventName, images }: Props) {
  const gallery = images.filter(Boolean).map((url) => resolveMediaUrl(url));
  const [modalOpen, setModalOpen] = useState(false);
  const [startIndex, setStartIndex] = useState(0);

  if (gallery.length === 0) return null;

  const preview = gallery.slice(0, PREVIEW_COUNT);
  const overlaySrc = gallery[PREVIEW_COUNT] || gallery[gallery.length - 1];

  const openAt = (i: number) => {
    setStartIndex(i);
    setModalOpen(true);
  };

  return (
    <section className="mt-6 sm:mt-8 lg:mt-9">
      <h2 className="text-[1.25rem] sm:text-[1.375rem] lg:text-[1.5rem] font-bold text-[#1A1A1A] mb-2.5 sm:mb-3">
        Gallery
      </h2>
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {preview.map((src, i) => (
          <button
            key={`${src}-${i}`}
            type="button"
            onClick={() => openAt(i)}
            className="relative shrink-0 w-[8.5rem] h-[8.5rem] sm:w-[9.5rem] sm:h-[9.5rem] lg:w-[10.5rem] lg:h-[10.5rem] rounded-[0.75rem] overflow-hidden bg-slate-200 cursor-pointer"
          >
            <img src={src} alt={`Gallery ${i + 1}`} className="absolute inset-0 w-full h-full object-cover" />
          </button>
        ))}
        <button
          type="button"
          onClick={() => openAt(Math.min(PREVIEW_COUNT, gallery.length - 1))}
          className="relative shrink-0 w-[8.5rem] h-[8.5rem] sm:w-[9.5rem] sm:h-[9.5rem] lg:w-[10.5rem] lg:h-[10.5rem] rounded-[0.75rem] overflow-hidden bg-slate-800 group cursor-pointer"
        >
          {overlaySrc && (
            <img
              src={overlaySrc}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-50 transition-opacity"
              aria-hidden
            />
          )}
          <span className="absolute inset-0 bg-black/50" />
          <span className="absolute inset-0 flex items-center justify-center px-3 text-center text-white font-bold text-[1rem] sm:text-[1.0625rem] lg:text-[1.125rem] leading-snug">
            See the Entire Gallery
          </span>
        </button>
      </div>

      <EventGalleryModal
        open={modalOpen}
        eventName={eventName}
        images={gallery}
        startIndex={startIndex}
        onClose={() => setModalOpen(false)}
      />
    </section>
  );
}
