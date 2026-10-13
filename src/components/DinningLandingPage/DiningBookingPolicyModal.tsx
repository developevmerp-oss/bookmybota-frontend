"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { lockBodyScroll } from "@/lib/lockBodyScroll";

export type DiningBookingPolicySection = "terms" | "cancellation";

const TERMS_ITEMS = [
  "Please provide correct booking details, including your name, contact information, date, time, and number of guests.",
  "Your table is confirmed only after you receive the booking confirmation.",
  "Please arrive at the restaurant on time.",
  "Late arrival may result in your table being released, depending on restaurant availability.",
  "Your booking is valid only for the number of guests mentioned in the booking.",
  "Any booking fee, convenience fee, deposit, or other applicable charges will be shown before confirmation.",
  "Food, beverages, and restaurant services are subject to the restaurant's own menu, pricing, and policies.",
  "Any changes to your booking are subject to availability.",
  "Promotional offers and discounts may have additional terms and conditions.",
  "BookMyBota may not be responsible for changes or issues caused by the restaurant or circumstances beyond its control.",
  "By making a booking, you agree to these Terms & Conditions.",
];

const CANCELLATION_ITEMS: Array<string | { text: string; bold?: string }> = [
  "You can cancel your booking through BookMyBota, subject to the applicable cancellation terms.",
  "Free cancellation is available only within the cancellation period mentioned on your booking.",
  "Cancellations made after the allowed period may be subject to a cancellation fee.",
  {
    text: "If you do not arrive for your booking and do not cancel it, it may be treated as a no-show.",
    bold: "no-show",
  },
  "No-show bookings may be non-refundable.",
  "Some restaurants or special bookings may have different cancellation policies.",
  "If the restaurant cancels your booking, you may be eligible for a refund of the applicable amount.",
  "Refunds, where applicable, will generally be processed to the original payment method.",
  "Refund processing time may depend on your bank or payment provider.",
  "The cancellation policy shown at the time of booking will apply to your booking.",
  "For any cancellation or refund-related issue, please contact BookMyBota support.",
];

type DiningBookingPolicyModalProps = {
  open: boolean;
  focusSection?: DiningBookingPolicySection;
  onClose: () => void;
};

function renderCancellationItem(item: (typeof CANCELLATION_ITEMS)[number], index: number) {
  if (typeof item === "string") {
    return (
      <li key={index} className="text-[0.9375rem] sm:text-[1rem] leading-[1.55] text-[#333333]">
        {item}
      </li>
    );
  }

  const parts = item.bold ? item.text.split(item.bold) : [item.text];
  return (
    <li key={index} className="text-[0.9375rem] sm:text-[1rem] leading-[1.55] text-[#333333]">
      {parts[0]}
      {item.bold && <strong className="font-semibold text-[#111111]">{item.bold}</strong>}
      {parts[1] ?? ""}
    </li>
  );
}

export default function DiningBookingPolicyModal({
  open,
  focusSection = "terms",
  onClose,
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

  if (!open || typeof document === "undefined") return null;

  const isCancellation = focusSection === "cancellation";
  const title = isCancellation ? "Cancellation Policy" : "Terms & Conditions";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/50 overscroll-none"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dining-booking-policy-title"
        className="relative flex w-full max-w-[560px] max-h-[min(85vh,40rem)] flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 px-6 sm:px-8 pt-6 sm:pt-8 pb-3">
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
          {isCancellation ? (
            <ul className="list-disc pl-5 space-y-3.5 marker:text-[#111111]">
              {CANCELLATION_ITEMS.map((item, index) => renderCancellationItem(item, index))}
            </ul>
          ) : (
            <ul className="list-disc pl-5 space-y-3.5 marker:text-[#111111]">
              {TERMS_ITEMS.map((item, index) => (
                <li
                  key={index}
                  className="text-[0.9375rem] sm:text-[1rem] leading-[1.55] text-[#333333]"
                >
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
