"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Building2, X } from "lucide-react";

const VENUE_IMAGE_FALLBACK_CLASS =
  "flex h-full w-full items-center justify-center bg-[#F7E9FF] text-[#6900AA]";

type Props = {
  open: boolean;
  onClose: () => void;
  name: string;
  typeName?: string | null;
  coverSrc: string;
  description?: string | null;
  place?: string;
};

export default function AboutVenueModal({
  open,
  onClose,
  name,
  typeName,
  coverSrc,
  description,
  place,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const onCloseRef = useRef(onClose);
  const scrollYRef = useRef(0);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const scrollY = window.scrollY || window.pageYOffset || 0;
    scrollYRef.current = scrollY;

    const body = document.body;
    const html = document.documentElement;
    const scrollbarGap = Math.max(0, window.innerWidth - html.clientWidth);

    const prev = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyPaddingRight: body.style.paddingRight,
      htmlOverflow: html.style.overflow,
    };

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    if (scrollbarGap > 0) {
      body.style.paddingRight = `${scrollbarGap}px`;
    }
    html.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.left = prev.bodyLeft;
      body.style.right = prev.bodyRight;
      body.style.width = prev.bodyWidth;
      body.style.paddingRight = prev.bodyPaddingRight;
      html.style.overflow = prev.htmlOverflow;
      window.removeEventListener("keydown", onKey);
      window.scrollTo(0, scrollYRef.current);
    };
  }, [open]);

  if (!mounted || !open) return null;

  const bio = description?.trim() || "";
  const meta = [typeName, place].filter(Boolean).join(" · ");

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4 md:p-6"
      role="presentation"
      onClick={() => onCloseRef.current()}
    >
      <button
        type="button"
        aria-label="Close about venue"
        className="absolute inset-0 cursor-pointer bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-venue-title"
        className="relative z-10 flex w-full max-h-[92vh] sm:max-h-[90vh] sm:max-w-[520px] md:max-w-[560px] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-[#F3F4F6] bg-white px-4 py-3.5 sm:px-5 sm:py-4">
          <h2
            id="about-venue-title"
            className="text-lg font-bold text-[#111111] sm:text-xl"
          >
            About venue
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => onCloseRef.current()}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#555] hover:bg-[#F3F4F6] cursor-pointer"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-5 sm:pb-7 sm:pt-5">
          <div className="overflow-hidden rounded-2xl border border-[#EFEFEF] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <div className="w-full overflow-hidden bg-white">
              {coverSrc ? (
                <img
                  src={coverSrc}
                  alt={name}
                  className="block h-auto w-full"
                />
              ) : (
                <div className={`aspect-[16/10] ${VENUE_IMAGE_FALLBACK_CLASS}`}>
                  <Building2 size={40} strokeWidth={1.4} />
                </div>
              )}
            </div>
            <div className="px-4 py-4 sm:px-5 sm:py-5">
              <p className="text-base font-bold text-[#111111] sm:text-lg">{name}</p>
              {meta ? (
                <p className="mt-0.5 text-sm text-[#8A8A8A]">{meta}</p>
              ) : null}
              {bio ? (
                <div className="mt-4">
                  <p className="text-[0.8125rem] font-bold uppercase tracking-[0.08em] text-[#9AA0A6]">
                    About the venue
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#333] whitespace-pre-wrap sm:text-[15px]">
                    {bio}
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-[#9ca3af]">No description yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
