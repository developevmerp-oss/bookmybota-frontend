"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type Props = {
  open: boolean;
  eventName: string;
  images: string[];
  startIndex?: number;
  onClose: () => void;
};

export default function EventGalleryModal({
  open,
  eventName,
  images,
  startIndex = 0,
  onClose,
}: Props) {
  const gallery = images.filter(Boolean);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    const next = Math.min(Math.max(0, startIndex), Math.max(0, gallery.length - 1));
    setIndex(next);
  }, [open, startIndex, gallery.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => (gallery.length === 0 ? 0 : i <= 0 ? gallery.length - 1 : i - 1));
  }, [gallery.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (gallery.length === 0 ? 0 : i >= gallery.length - 1 ? 0 : i + 1));
  }, [gallery.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, goPrev, goNext]);

  if (!open || gallery.length === 0) return null;

  const current = gallery[index] || gallery[0];

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/90 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`${eventName} gallery`}
    >
      <div className="shrink-0 flex items-center gap-3 px-3 sm:px-5 pt-3 sm:pt-4 pb-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close gallery"
          className="h-9 w-9 sm:h-10 sm:w-10 rounded-full text-white/90 hover:bg-white/10 flex items-center justify-center cursor-pointer shrink-0"
        >
          <X size={22} strokeWidth={2} />
        </button>
        <h2 className="flex-1 min-w-0 text-center text-white font-bold uppercase tracking-wide text-[0.875rem] sm:text-[1rem] lg:text-[1.125rem] truncate px-2">
          {eventName}
        </h2>
        <span className="shrink-0 text-white/90 font-semibold text-[0.875rem] sm:text-[1rem] tabular-nums w-12 sm:w-14 text-right">
          {index + 1}/{gallery.length}
        </span>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center px-10 sm:px-14 lg:px-16 py-2">
        {gallery.length > 1 && (
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous image"
            className="absolute left-2 sm:left-4 z-10 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
          >
            <ChevronLeft size={28} />
          </button>
        )}
        <img
          src={current}
          alt={`${eventName} ${index + 1}`}
          className="max-h-full max-w-full object-contain rounded-[0.25rem]"
        />
        {gallery.length > 1 && (
          <button
            type="button"
            onClick={goNext}
            aria-label="Next image"
            className="absolute right-2 sm:right-4 z-10 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
          >
            <ChevronRight size={28} />
          </button>
        )}
      </div>

      <div className="shrink-0 px-3 sm:px-5 pb-4 sm:pb-5 pt-2">
        <div className="flex gap-2 sm:gap-2.5 overflow-x-auto justify-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-1">
          {gallery.map((src, i) => {
            const active = i === index;
            return (
              <button
                key={`${src}-${i}`}
                type="button"
                onClick={() => setIndex(i)}
                className={`relative shrink-0 w-[3.5rem] h-[2.5rem] sm:w-[4.25rem] sm:h-[3rem] rounded-[0.25rem] overflow-hidden cursor-pointer ${
                  active ? "ring-2 ring-white ring-offset-1 ring-offset-black" : "opacity-70 hover:opacity-100"
                }`}
              >
                <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
