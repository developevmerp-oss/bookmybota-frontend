"use client";

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { lockBodyScroll } from "@/lib/lockBodyScroll";
import { hasDiningPolicyContent, sanitizeDiningPolicyHtml } from "@/lib/diningPolicyHtml";

export type DiningBookingPolicySection = "terms" | "cancellation";

type DiningBookingPolicyModalProps = {
  open: boolean;
  focusSection?: DiningBookingPolicySection;
  onClose: () => void;
  /** Restaurant-authored terms HTML/text from settings. */
  termsText?: string | null;
  /** Restaurant-authored cancellation policy HTML/text from settings. */
  cancellationText?: string | null;
};

export default function DiningBookingPolicyModal({
  open,
  focusSection = "terms",
  onClose,
  termsText,
  cancellationText,
}: DiningBookingPolicyModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const unlock = lockBodyScroll();
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const isCancellation = focusSection === "cancellation";
  const title = isCancellation ? "Cancellation Policy" : "Terms & Conditions";
  const raw = isCancellation ? cancellationText : termsText;
  const html = useMemo(() => sanitizeDiningPolicyHtml(raw), [raw]);

  if (!open || typeof document === "undefined") return null;
  if (!hasDiningPolicyContent(raw)) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4 md:p-6"
      onClick={onClose}
      role="presentation"
    >
      <button
        type="button"
        aria-label={`Close ${title}`}
        className="absolute inset-0 cursor-pointer bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dining-booking-policy-title"
        className="relative z-10 flex w-full max-h-[92vh] sm:max-h-[90vh] sm:max-w-[440px] md:max-w-[480px] flex-col overflow-hidden rounded-t-[1.5rem] bg-white shadow-2xl sm:rounded-[1.5rem] pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 bg-white px-6 pt-6 sm:px-8 sm:pt-8 pb-3">
          <h2
            id="dining-booking-policy-title"
            className="text-[1.375rem] sm:text-[1.5rem] font-bold text-[#1A1A1A] leading-tight pr-2"
          >
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-[#E8E8E8] text-[#555555] hover:bg-[#DEDEDE] transition-colors cursor-pointer"
          >
            <X size={18} strokeWidth={2.25} />
          </button>
        </div>

        <div
          data-scroll-lock-container
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 sm:px-8 pb-6 sm:pb-8 pt-2 [scrollbar-width:thin] [scrollbar-color:#C8C8C8_#F0F0F0]"
        >
          <div
            className="dining-policy-html text-[0.9375rem] sm:text-[1rem] leading-[1.55] text-[#333333]"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
