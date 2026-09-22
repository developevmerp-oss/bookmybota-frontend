"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { resolveMediaUrl } from "@/lib/mediaUrl";

type Props = {
  open: boolean;
  items: string[];
  startIndex?: number;
  kind?: "image" | "video";
  label?: string;
  onClose: () => void;
};

export default function PartnerMediaLightbox({
  open,
  items,
  startIndex = 0,
  kind = "image",
  label = "Gallery",
  onClose,
}: Props) {
  const media = items.filter(Boolean).map((url) => resolveMediaUrl(url));
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setIndex(Math.min(Math.max(0, startIndex), Math.max(0, media.length - 1)));
  }, [open, startIndex, media.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => (media.length === 0 ? 0 : i <= 0 ? media.length - 1 : i - 1));
  }, [media.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (media.length === 0 ? 0 : i >= media.length - 1 ? 0 : i + 1));
  }, [media.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    const html = document.documentElement;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = html.style.overflow;
    document.body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      html.style.overflow = prevHtmlOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, goPrev, goNext]);

  if (!open || media.length === 0) return null;

  const current = media[index] || media[0];

  return (
    <div
      className="fixed inset-0 z-[90] h-dvh max-h-dvh w-screen overflow-hidden bg-black/95 flex flex-col justify-between py-4 sm:py-6 px-3 sm:px-4 select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <div
        className="flex justify-between items-center max-w-7xl mx-auto w-full text-white shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-semibold tracking-wider text-slate-300 tabular-nums">
          {index + 1} of {media.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-full transition-colors text-white cursor-pointer"
          aria-label="Close"
        >
          <X size={24} />
        </button>
      </div>

      <div
        className="flex-1 flex items-center container mx-auto px-2 sm:px-6 lg:px-10 justify-between w-full gap-1.5 sm:gap-4 my-3 sm:my-4 relative min-h-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {media.length > 1 ? (
          <button
            type="button"
            onClick={goPrev}
            className="p-2 sm:p-3 bg-white/5 hover:bg-white/15 active:scale-95 text-white rounded-full transition-all cursor-pointer backdrop-blur-sm border border-white/10 shrink-0"
            aria-label="Previous"
          >
            <ChevronLeft size={24} />
          </button>
        ) : (
          <div className="w-10 sm:w-12 shrink-0" />
        )}

        <div className="flex-1 h-full flex items-center justify-center overflow-hidden px-1 sm:px-2 min-w-0">
          {kind === "video" ? (
            <video
              key={current}
              src={current}
              controls
              autoPlay
              playsInline
              className="max-h-[65vh] sm:max-h-[70vh] max-w-full rounded-xl shadow-2xl bg-black"
            />
          ) : (
            <img
              src={current}
              alt={`${label} ${index + 1}`}
              className="max-h-[65vh] sm:max-h-[70vh] max-w-full object-contain rounded-xl shadow-2xl select-none"
            />
          )}
        </div>

        {media.length > 1 ? (
          <button
            type="button"
            onClick={goNext}
            className="p-2 sm:p-3 bg-white/5 hover:bg-white/15 active:scale-95 text-white rounded-full transition-all cursor-pointer backdrop-blur-sm border border-white/10 shrink-0"
            aria-label="Next"
          >
            <ChevronRight size={24} />
          </button>
        ) : (
          <div className="w-10 sm:w-12 shrink-0" />
        )}
      </div>

      {media.length > 1 ? (
        <div
          className="max-w-4xl mx-auto w-full overflow-x-auto overflow-y-hidden py-2 flex justify-center gap-2 sm:gap-2.5 px-2 sm:px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {media.map((url, i) => {
            const active = i === index;
            return (
              <button
                key={`${url}-${i}`}
                type="button"
                onClick={() => setIndex(i)}
                className={`w-14 h-10 sm:w-16 sm:h-12 rounded-lg overflow-hidden shrink-0 transition-all border-2 cursor-pointer ${
                  active
                    ? "border-[#6900AA] scale-105 opacity-100 shadow-md"
                    : "border-transparent opacity-50 hover:opacity-80"
                }`}
              >
                {kind === "video" ? (
                  <video
                    src={url}
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-cover pointer-events-none"
                    aria-hidden
                  />
                ) : (
                  <img src={url} alt="" className="w-full h-full object-cover" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
