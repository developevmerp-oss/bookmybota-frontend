"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export type LanguageFormatGroup = {
  language: string;
  formats: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  movieTitle: string;
  showtimesPath: string;
  /** Languages with their available formats (from movie masters / showtimes). */
  groups: LanguageFormatGroup[];
};

/** Build language → formats from flat movie lists (fallback when showtimes not loaded). */
export function groupsFromMovieLists(
  languages: string[],
  formats: string[]
): LanguageFormatGroup[] {
  const langs = languages.map((l) => l.trim()).filter(Boolean);
  const fmts = formats.map((f) => f.trim()).filter(Boolean);
  if (langs.length === 0 && fmts.length === 0) return [];
  if (langs.length === 0) {
    return [{ language: "All", formats: fmts.length ? fmts : ["2D"] }];
  }
  return langs.map((language) => ({
    language,
    formats: fmts.length ? fmts : ["2D"],
  }));
}

/** True when the BMS picker should appear before showtimes. */
export function shouldShowLanguageFormatPicker(groups: LanguageFormatGroup[]): boolean {
  if (groups.length === 0) return false;
  if (groups.length > 1) return true;
  return (groups[0]?.formats.length ?? 0) > 1;
}

function showtimesHref(
  basePath: string,
  opts: { language?: string; format?: string }
): string {
  const params = new URLSearchParams();
  if (opts.language && opts.language !== "All") params.set("language", opts.language);
  if (opts.format) params.set("format", opts.format);
  const q = params.toString();
  return q ? `${basePath}?${q}` : basePath;
}

/**
 * BMS-style “Select language and format” modal shown after Book tickets
 * when the movie has more than one language/format option.
 */
export default function MovieLanguageFormatModal({
  open,
  onClose,
  movieTitle,
  showtimesPath,
  groups,
}: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const go = (language?: string, format?: string) => {
    onClose();
    router.push(showtimesHref(showtimesPath, { language, format }));
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/55 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lang-format-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[min(88dvh,640px)] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white px-5 pt-4 pb-3">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-[#6900AA] truncate">{movieTitle}</p>
            <h2
              id="lang-format-title"
              className="mt-0.5 text-lg sm:text-xl font-extrabold text-[#111111]"
            >
              Select language and format
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="pb-5">
          {groups.map((group) => (
            <div key={group.language}>
              <div className="bg-[#F3F4F6] px-5 py-2.5 text-[12px] font-bold uppercase tracking-wide text-[#6B7280]">
                {group.language}
              </div>
              <div className="flex flex-wrap gap-2.5 px-5 py-3.5">
                {group.formats.map((fmt) => (
                  <button
                    key={`${group.language}-${fmt}`}
                    type="button"
                    onClick={() => go(group.language, fmt)}
                    className="inline-flex items-center rounded-full border border-[#6900AA] bg-white px-4 py-2 text-sm font-semibold text-[#6900AA] hover:bg-[#F7E9FF] cursor-pointer transition-colors"
                  >
                    {fmt}
                  </button>
                ))}
                {group.formats.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => go(group.language)}
                    className="inline-flex items-center rounded-full border border-[#6900AA] bg-white px-4 py-2 text-sm font-semibold text-[#6900AA] hover:bg-[#F7E9FF] cursor-pointer transition-colors"
                  >
                    Select all
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {groups.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500 text-center">
              No language or format options available.
            </p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
