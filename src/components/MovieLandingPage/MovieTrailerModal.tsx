"use client";

import { useEffect, useState, useMemo, type MouseEvent } from "react";
import { X, Play } from "lucide-react";

export function getEmbedVideoUrl(url?: string): string {
  if (!url || !url.trim()) return "";
  const trimmed = url.trim();

  // If already an embed URL
  if (trimmed.includes("youtube.com/embed/")) {
    return trimmed.includes("autoplay")
      ? trimmed
      : `${trimmed}${trimmed.includes("?") ? "&" : "?"}autoplay=1`;
  }

  // standard YouTube: https://www.youtube.com/watch?v=VIDEO_ID or &v=VIDEO_ID or short youtu.be/VIDEO_ID
  const ytMatch = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
  );
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`;
  }

  // Vimeo: https://vimeo.com/123456789
  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  if (vimeoMatch && vimeoMatch[1]) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
  }

  return trimmed;
}

type TrailerItem = { language: string; trailerUrl: string };

const EMPTY_TRAILERS: TrailerItem[] = [];

interface MovieTrailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  movieTitle: string;
  initialTrailerUrl?: string;
  initialLanguage?: string;
  trailers?: TrailerItem[];
}

export default function MovieTrailerModal({
  isOpen,
  onClose,
  movieTitle,
  initialTrailerUrl,
  initialLanguage,
  trailers: trailersProp,
}: MovieTrailerModalProps) {
  const trailers = trailersProp ?? EMPTY_TRAILERS;
  /** -1 = multi-trailer picker (no video yet); >=0 = playing that index */
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const hasMultiple = trailers.length > 1;
  const activeTrailer =
    activeIndex >= 0 && activeIndex < trailers.length
      ? trailers[activeIndex]
      : null;
  const activeUrl = activeTrailer?.trailerUrl || "";
  const activeLang = activeTrailer?.language || "";
  const awaitingPick = hasMultiple && activeIndex < 0;

  // Reset selection only when the modal opens.
  useEffect(() => {
    if (!isOpen) {
      setActiveIndex(-1);
      return;
    }

    if (hasMultiple && !initialTrailerUrl) {
      setActiveIndex(-1);
      return;
    }

    if (initialTrailerUrl) {
      const byUrl = trailers.findIndex((t) => t.trailerUrl === initialTrailerUrl);
      if (byUrl >= 0) {
        setActiveIndex(byUrl);
        return;
      }
    }
    if (initialLanguage) {
      const byLang = trailers.findIndex(
        (t) => t.language.toLowerCase() === initialLanguage.toLowerCase()
      );
      if (byLang >= 0) {
        setActiveIndex(byLang);
        return;
      }
    }
    setActiveIndex(trailers.length > 0 ? 0 : -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open-gate reset
  }, [isOpen]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const embedUrl = useMemo(() => getEmbedVideoUrl(activeUrl), [activeUrl]);

  if (!isOpen) return null;

  const selectTrailer = (idx: number, e?: MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    setActiveIndex(idx);
  };

  const languageButtons = (
    <div
      className="relative z-30 flex flex-wrap items-center justify-center gap-2"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {trailers.map((t, idx) => {
        const active = activeIndex === idx;
        return (
          <button
            key={`${t.language}-${idx}`}
            type="button"
            onClick={(e) => selectTrailer(idx, e)}
            onMouseDown={(e) => e.stopPropagation()}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer pointer-events-auto ${
              active
                ? "bg-white text-black shadow-md ring-2 ring-white/40"
                : "bg-black/70 text-white hover:bg-black/90 border border-white/35"
            }`}
          >
            <Play className="size-3.5 fill-current" />
            {t.language}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80"
      role="dialog"
      aria-modal="true"
      aria-label={`${movieTitle} trailer`}
    >
      {/* Click outside to close */}
      <div className="absolute inset-0 z-0" onClick={onClose} aria-hidden="true" />

      {/* Floating close — District-style top-right */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-3 right-3 sm:top-5 sm:right-5 z-40 size-10 sm:size-11 rounded-full bg-black/55 hover:bg-black/75 border border-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shadow-lg"
        title="Close Trailer (Esc)"
        aria-label="Close trailer"
      >
        <X className="size-5 sm:size-6" strokeWidth={2.25} />
      </button>

      <div
        className="relative z-20 w-full max-w-[min(92vw,56rem)] mx-3 sm:mx-6"
        onClick={(e) => e.stopPropagation()}
      >
        {awaitingPick ? (
          <div className="flex flex-col items-center gap-5 rounded-2xl border border-white/15 bg-black/60 px-6 py-10 sm:px-10 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
            <div className="text-center">
              <p className="text-base sm:text-lg font-bold text-white">
                {movieTitle}
              </p>
              <p className="mt-1.5 text-sm text-white/70">
                Choose a trailer language
              </p>
            </div>
            {languageButtons}
          </div>
        ) : (
          <>
            {hasMultiple ? <div className="mb-3">{languageButtons}</div> : null}

            <div className="relative z-10 w-full aspect-video bg-black overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
              {embedUrl ? (
                <iframe
                  key={`trailer-${activeIndex}-${activeUrl}`}
                  src={embedUrl}
                  title={`${movieTitle} Trailer${activeLang ? ` (${activeLang})` : ""}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full border-0"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/50 px-4 text-center">
                  <Play className="size-10 text-white/30" />
                  <p className="text-sm">
                    Trailer video link is not available for this movie.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
