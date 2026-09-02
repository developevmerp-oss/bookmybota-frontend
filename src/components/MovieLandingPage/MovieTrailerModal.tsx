"use client";

import { useEffect, useState, useMemo } from "react";
import { X, Play, Film, ExternalLink } from "lucide-react";

export function getEmbedVideoUrl(url?: string): string {
  if (!url || !url.trim()) return "";
  const trimmed = url.trim();

  // If already an embed URL
  if (trimmed.includes("youtube.com/embed/")) {
    return trimmed.includes("autoplay") ? trimmed : `${trimmed}${trimmed.includes("?") ? "&" : "?"}autoplay=1`;
  }

  // standard YouTube: https://www.youtube.com/watch?v=VIDEO_ID or &v=VIDEO_ID or short youtu.be/VIDEO_ID
  const ytMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
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

interface MovieTrailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  movieTitle: string;
  initialTrailerUrl?: string;
  initialLanguage?: string;
  trailers?: Array<{ language: string; trailerUrl: string }>;
}

export default function MovieTrailerModal({
  isOpen,
  onClose,
  movieTitle,
  initialTrailerUrl,
  initialLanguage,
  trailers = [],
}: MovieTrailerModalProps) {
  const [activeUrl, setActiveUrl] = useState<string>("");
  const [activeLang, setActiveLang] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      const url = initialTrailerUrl || (trailers.length > 0 ? trailers[0].trailerUrl : "");
      const lang = initialLanguage || (trailers.length > 0 ? trailers[0].language : "");
      setActiveUrl(url);
      setActiveLang(lang);
    }
  }, [isOpen, initialTrailerUrl, initialLanguage, trailers]);

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const embedUrl = useMemo(() => getEmbedVideoUrl(activeUrl), [activeUrl]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 md:p-8 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      {/* Click outside backdrop to close */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal Box */}
      <div className="relative z-10 w-full max-w-5xl bg-slate-950 border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col scale-100 animate-in zoom-in-95 duration-150">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-white/10 bg-slate-900/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 rounded-lg bg-rose-500/20 text-[#F84464] flex items-center justify-center shrink-0">
              <Film className="size-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-white truncate">
                {movieTitle} — Official Trailer
              </h3>
              {activeLang && (
                <p className="text-xs text-rose-400 font-semibold">{activeLang} Version</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Language Switcher Tabs if multiple trailers available */}
            {trailers && trailers.length > 1 && (
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10">
                {trailers.map((t, idx) => {
                  const active = t.trailerUrl === activeUrl;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setActiveUrl(t.trailerUrl);
                        setActiveLang(t.language);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        active
                          ? "bg-gradient-to-r from-[#F84464] to-[#6900AA] text-white shadow"
                          : "text-white/70 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {t.language}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="size-8 sm:size-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close Trailer (Esc)"
            >
              <X className="size-4 sm:size-5" />
            </button>
          </div>
        </div>

        {/* Video Player 16:9 Frame */}
        <div className="relative w-full aspect-video bg-black">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={`${movieTitle} Trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 w-full h-full border-0"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400 px-4 text-center">
              <Play className="size-10 text-white/30" />
              <p className="text-sm">Trailer video link is not available for this movie.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
