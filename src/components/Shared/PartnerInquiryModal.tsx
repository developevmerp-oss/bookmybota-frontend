"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { lockBodyScroll } from "@/lib/lockBodyScroll";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

/** Compact booking-inquiry dialog (artists and venues). */
export default function PartnerInquiryModal({
  open,
  onClose,
  title,
  subtitle,
  children,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const unlock = lockBodyScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      unlock();
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-[#1B1B3A]/45 p-0 sm:p-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="partner-inquiry-title"
        data-scroll-lock-container
        className="relative w-full sm:max-w-[440px] max-h-[min(92vh,720px)] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-[0_24px_60px_rgba(17,17,17,0.18)]"
      >
        <div className="sticky top-0 z-[1] flex items-start justify-between gap-3 bg-white px-5 pt-5 pb-3 sm:px-6">
          <div className="min-w-0">
            <h2 id="partner-inquiry-title" className="text-lg font-bold tracking-tight text-[#111111]">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-xs leading-relaxed text-[#6B7280]">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}
