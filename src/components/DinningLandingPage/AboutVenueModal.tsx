"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Copy, MapPin, Phone, X } from "lucide-react";
import { toast } from "sonner";
import SafeCoverImage, { DiningImageFallback } from "@/components/Shared/SafeCoverImage";

type Mode = "about" | "location" | "phone" | "hours";

export type OpeningHourRow = {
  day: string;
  hours: string;
  isToday?: boolean;
};

type Props = {
  open: boolean;
  mode: Mode;
  onClose: () => void;
  name: string;
  coverSrc?: string;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  openingHours?: OpeningHourRow[];
};

export default function AboutVenueModal({
  open,
  mode,
  onClose,
  name,
  coverSrc = "",
  description,
  address,
  phone,
  openingHours = [],
}: Props) {
  useEffect(() => {
    if (!open) return;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const title =
    mode === "about"
      ? "About the restaurant"
      : mode === "location"
        ? "Location"
        : mode === "hours"
          ? "Opening hours"
          : "Call";

  const copyText = async (value: string, successMsg: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMsg);
    } catch {
      toast.error("Could not copy");
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4 md:p-6"
      role="presentation"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label={`Close ${title}`}
        className="absolute inset-0 cursor-pointer bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-venue-title"
        className="relative z-10 flex w-full max-h-[92vh] sm:max-h-[90vh] sm:max-w-[440px] md:max-w-[480px] flex-col overflow-hidden rounded-t-[1.5rem] bg-white shadow-2xl sm:rounded-[1.5rem] pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-4 bg-white px-6 pt-6 sm:px-8 sm:pt-8 pb-3">
          <div className="min-w-0">
            <h2
              id="about-venue-title"
              className="text-[1.375rem] sm:text-[1.5rem] font-bold text-[#1A1A1A] leading-tight"
            >
              {title}
            </h2>
            {mode !== "hours" ? (
              <p className="mt-0.5 text-sm text-slate-500 font-medium truncate">{name}</p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-[#E8E8E8] text-[#555555] hover:bg-[#DEDEDE] transition-colors cursor-pointer"
          >
            <X size={18} strokeWidth={2.25} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-1 sm:px-6 sm:pb-7">
          {mode === "about" ? (
            <div className="pt-4">
              <div className="flex items-center gap-3 rounded-2xl border border-[#EFEFEF] bg-white px-4 py-3.5">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#F3F4F6]">
                  <SafeCoverImage
                    src={coverSrc}
                    alt={name}
                    className="h-full w-full object-cover"
                    fallbackClassName="flex h-full w-full items-center justify-center bg-[#F3F4F6] text-slate-300"
                    fallback={<DiningImageFallback size={22} />}
                  />
                </div>
                <p className="min-w-0 text-base font-bold text-[#111111] leading-snug">{name}</p>
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-[#4A4A4A] whitespace-pre-wrap sm:text-sm sm:leading-6">
                {description?.trim() ||
                  "This venue has not provided a description yet."}
              </p>
            </div>
          ) : null}

          {mode === "location" ? (
            address?.trim() ? (
              <div className="divide-y divide-[#EFEFEF]">
                <div className="flex items-center gap-3 py-4">
                  <MapPin size={18} className="text-[#292929] shrink-0" strokeWidth={2.25} />
                  <button
                    type="button"
                    onClick={() => {
                      window.open(
                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
                        "_blank",
                        "noopener,noreferrer"
                      );
                    }}
                    className="min-w-0 flex-1 text-left text-sm font-medium text-[#292929] leading-snug break-words border-b border-dotted border-[#292929]/45 pb-0.5 cursor-pointer hover:opacity-80"
                  >
                    {address}
                  </button>
                  <button
                    type="button"
                    aria-label="Copy address"
                    onClick={() => void copyText(address, "Address copied")}
                    className="shrink-0 p-1.5 rounded-md text-[#292929] hover:bg-slate-100 cursor-pointer"
                  >
                    <Copy size={16} strokeWidth={2.25} />
                  </button>
                </div>
              </div>
            ) : (
              <p className="py-4 text-sm font-medium text-slate-500">Address not available</p>
            )
          ) : null}

          {mode === "phone" ? (
            phone?.trim() ? (
              <div className="divide-y divide-[#EFEFEF]">
                <div className="flex items-center gap-3 py-4">
                  <Phone size={18} className="text-[#292929] shrink-0" strokeWidth={2.25} />
                  <a
                    href={`tel:${phone}`}
                    className="min-w-0 flex-1 text-sm font-medium text-[#292929] border-b border-dotted border-[#292929]/45 pb-0.5 hover:opacity-80"
                  >
                    {phone}
                  </a>
                  <button
                    type="button"
                    aria-label="Copy phone number"
                    onClick={() => void copyText(phone, "Phone number copied")}
                    className="shrink-0 p-1.5 rounded-md text-[#292929] hover:bg-slate-100 cursor-pointer"
                  >
                    <Copy size={16} strokeWidth={2.25} />
                  </button>
                </div>
              </div>
            ) : (
              <p className="py-4 text-sm font-medium text-slate-500">Phone not available</p>
            )
          ) : null}

          {mode === "hours" ? (
            openingHours.length > 0 ? (
              <div className="divide-y divide-[#EFEFEF]">
                {openingHours.map((row) => (
                  <div
                    key={row.day}
                    className="flex items-center justify-between gap-3 py-3.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-[#292929]">{row.day}</span>
                      {row.isToday ? (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Today
                        </span>
                      ) : null}
                    </div>
                    <span className="text-sm font-medium text-[#4A4A4A] shrink-0 tabular-nums">
                      {row.hours}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-sm font-medium text-slate-500">
                Opening hours not available
              </p>
            )
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
