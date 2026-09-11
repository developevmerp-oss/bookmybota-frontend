"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";
import { formatMoneyDisplay } from "@/lib/currencyFormat";

export type PlanInfoDetails = {
  duration_days?: number | null;
  price?: number | null;
  listing_boost?: boolean | null;
  landing_slider?: boolean | null;
  category_rail?: boolean | null;
};

type PlanInfoButtonProps = {
  title: string;
  description?: string | null;
  details?: PlanInfoDetails | null;
  className?: string;
  /** darker surfaces (admin) vs light partner panels */
  tone?: "light" | "dark";
  /**
   * When this key changes to a new non-empty value (e.g. selected plan id),
   * the plan details modal opens automatically. Does not open on first mount.
   */
  autoOpenKey?: string | null;
};

function yesNo(v?: boolean | null) {
  return v ? "Yes" : "No";
}

/** Round “i” control — opens a Terms-style modal with plan description & features. */
export default function PlanInfoButton({
  title,
  description,
  details,
  className = "",
  tone = "light",
  autoOpenKey,
}: PlanInfoButtonProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const prevAutoKey = useRef<string | null | undefined>(undefined);
  const text = String(description || "").trim();
  const hasDetails = Boolean(
    details &&
      (details.duration_days != null ||
        details.price != null ||
        details.listing_boost != null ||
        details.landing_slider != null ||
        details.category_rail != null)
  );
  const hasContent = Boolean(text) || hasDetails;
  const canOpen = Boolean(title?.trim()) && hasContent;

  useEffect(() => {
    const key = autoOpenKey || null;
    // First mount: remember key, do not auto-open (avoids pop on "Edit promotion")
    if (prevAutoKey.current === undefined) {
      prevAutoKey.current = key;
      return;
    }
    if (!key || key === prevAutoKey.current) {
      prevAutoKey.current = key;
      return;
    }
    prevAutoKey.current = key;
    // After native <select> closes, open on next tick so click-through does not fight the parent modal
    const t = window.setTimeout(() => setOpen(true), 50);
    return () => window.clearTimeout(t);
  }, [autoOpenKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const btnTone =
    tone === "dark"
      ? canOpen
        ? "border-white/20 text-zinc-300 hover:border-rose-400/50 hover:text-rose-300 hover:bg-rose-500/10"
        : "border-white/10 text-zinc-600 cursor-not-allowed opacity-50"
      : canOpen
        ? "border-slate-300 text-slate-500 hover:border-[#e11d48] hover:text-[#e11d48] hover:bg-[#fff0f3]"
        : "border-slate-200 text-slate-300 cursor-not-allowed opacity-60";

  const modal =
    open && canOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[220] bg-black/50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={panelId}
            onMouseDown={(e) => {
              // mousedown-only close avoids native <select> option click-through
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div
              className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                <h3 id={panelId} className="text-[#111111] font-semibold text-base sm:text-lg truncate">
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-slate-500 hover:text-slate-800 p-1 rounded-lg hover:bg-slate-100 shrink-0"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
                {text ? (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Description
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{text}</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No written description for this plan yet.</p>
                )}

                {hasDetails ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Plan details
                    </p>
                    {details?.duration_days != null ? (
                      <div className="flex justify-between gap-3 text-sm text-slate-700">
                        <span>Duration</span>
                        <span className="font-semibold">{details.duration_days} days</span>
                      </div>
                    ) : null}
                    {details?.price != null ? (
                      <div className="flex justify-between gap-3 text-sm text-slate-700">
                        <span>Price</span>
                        <span className="font-semibold">{formatMoneyDisplay(details.price)}</span>
                      </div>
                    ) : null}
                    {details?.listing_boost != null ? (
                      <div className="flex justify-between gap-3 text-sm text-slate-700">
                        <span>Listing boost</span>
                        <span className="font-semibold">{yesNo(details.listing_boost)}</span>
                      </div>
                    ) : null}
                    {details?.landing_slider != null ? (
                      <div className="flex justify-between gap-3 text-sm text-slate-700">
                        <span>Landing slider</span>
                        <span className="font-semibold">{yesNo(details.landing_slider)}</span>
                      </div>
                    ) : null}
                    {details?.category_rail != null ? (
                      <div className="flex justify-between gap-3 text-sm text-slate-700">
                        <span>Category rail</span>
                        <span className="font-semibold">{yesNo(details.category_rail)}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="px-5 py-4 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#e11d48] hover:bg-[#be123c] cursor-pointer"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <button
        type="button"
        disabled={!canOpen}
        aria-label={canOpen ? `About ${title}` : "Select a plan to view details"}
        aria-expanded={open}
        title={canOpen ? "View plan details" : "Select a plan first"}
        onClick={() => canOpen && setOpen(true)}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${btnTone}`}
      >
        <Info size={13} strokeWidth={2.25} />
      </button>
      {modal}
    </div>
  );
}
