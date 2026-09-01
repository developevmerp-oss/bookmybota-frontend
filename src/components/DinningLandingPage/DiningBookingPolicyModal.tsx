"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

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
      <li key={index} className="text-[0.875rem] sm:text-[0.9375rem] leading-relaxed text-[#4A4A4A]">
        {item}
      </li>
    );
  }

  const parts = item.bold ? item.text.split(item.bold) : [item.text];
  return (
    <li key={index} className="text-[0.875rem] sm:text-[0.9375rem] leading-relaxed text-[#4A4A4A]">
      {parts[0]}
      {item.bold && <strong className="font-semibold text-[#333]">{item.bold}</strong>}
      {parts[1] ?? ""}
    </li>
  );
}

export default function DiningBookingPolicyModal({
  open,
  focusSection = "terms",
  onClose,
}: DiningBookingPolicyModalProps) {
  const termsRef = useRef<HTMLDivElement>(null);
  const cancellationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const target = focusSection === "cancellation" ? cancellationRef.current : termsRef.current;
    const frame = requestAnimationFrame(() => {
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, focusSection]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/55"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dining-booking-policy-title"
        className="relative w-full sm:max-w-[560px] max-h-[90vh] sm:max-h-[85vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-5 sm:px-8 pt-5 sm:pt-7 pb-2 border-b border-slate-100">
          <h2
            id="dining-booking-policy-title"
            className="text-[1.125rem] sm:text-[1.375rem] font-extrabold text-[#333] leading-tight pr-8"
          >
            Booking Policies
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8E8E8] text-[#555] hover:bg-[#ddd] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 sm:px-8 pb-6 sm:pb-8 pt-4 max-h-[calc(90vh-4.5rem)] sm:max-h-[calc(85vh-5rem)]">
          <div ref={termsRef} className="scroll-mt-4">
            <h3 className="text-[1rem] sm:text-[1.0625rem] font-bold text-[#1A1A1A] mb-3">
              Terms &amp; Conditions
            </h3>
            <ul className="list-disc pl-5 space-y-2.5">
              {TERMS_ITEMS.map((item, index) => (
                <li
                  key={index}
                  className="text-[0.875rem] sm:text-[0.9375rem] leading-relaxed text-[#4A4A4A]"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div ref={cancellationRef} className="scroll-mt-4 mt-8 pt-6 border-t border-slate-100">
            <h3 className="text-[1rem] sm:text-[1.0625rem] font-bold text-[#1A1A1A] mb-3">
              Cancellation Policy
            </h3>
            <ul className="list-disc pl-5 space-y-2.5">
              {CANCELLATION_ITEMS.map((item, index) => renderCancellationItem(item, index))}
            </ul>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
