"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  FaBicycle,
  FaBus,
  FaCar,
  FaCarSide,
  FaMotorcycle,
  FaShuttleVan,
} from "react-icons/fa";
import { MdAirportShuttle, MdElectricRickshaw } from "react-icons/md";
import type { IconType } from "react-icons";
import type { MovieShowtimeTierAvailability } from "@/services/api";
import { formatMoney } from "@/lib/currencyFormat";

export type SeatQtyTier = {
  tier_name: string;
  price: number;
  status?: MovieShowtimeTierAvailability["status"] | string;
};

type Props = {
  open: boolean;
  onClose?: () => void;
  /** When false, close is hidden (must pick a count) — BMS first-entry behavior. */
  dismissible?: boolean;
  initialQty?: number;
  tiers?: SeatQtyTier[];
  onConfirm: (qty: number) => void;
};

type VehicleSpec = {
  Icon: IconType;
  label: string;
};

/**
 * Seat count → vehicle type (from BMS reference photos), rendered with react-icons.
 * 1 cycle · 2 scooter · 3 auto · 4 small car · 5 sedan · 6 SUV · 7–8 van · 9–10 bus
 */
function vehicleForQty(qty: number): VehicleSpec {
  const n = Math.min(10, Math.max(1, qty));
  switch (n) {
    case 1:
      return { Icon: FaBicycle, label: "Cycle" };
    case 2:
      return { Icon: FaMotorcycle, label: "Scooter" };
    case 3:
      return { Icon: MdElectricRickshaw, label: "Auto" };
    case 4:
      return { Icon: FaCarSide, label: "Car" };
    case 5:
      return { Icon: FaCar, label: "Sedan" };
    case 6:
      return { Icon: FaCarSide, label: "SUV" };
    case 7:
      return { Icon: FaShuttleVan, label: "Van" };
    case 8:
      return { Icon: MdAirportShuttle, label: "Van" };
    case 9:
      return { Icon: FaBus, label: "Bus" };
    case 10:
    default:
      return { Icon: FaBus, label: "Bus" };
  }
}

function statusLabel(status?: string) {
  if (status === "FILLING_FAST") return "FILLING FAST";
  if (status === "SOLD_OUT") return "SOLD OUT";
  if (status === "ALMOST_FULL") return "ALMOST FULL";
  return "AVAILABLE";
}

function statusClass(status?: string) {
  if (status === "FILLING_FAST") return "text-amber-500";
  if (status === "SOLD_OUT") return "text-rose-600";
  if (status === "ALMOST_FULL") return "text-amber-600";
  return "text-emerald-600";
}

/**
 * “How many seats?” picker — colors follow customer theme (purple primary).
 * Vehicle react-icon changes with the selected number (1–10).
 */
export default function MovieSeatQtyModal({
  open,
  onClose,
  dismissible = true,
  initialQty = 2,
  tiers = [],
  onConfirm,
}: Props) {
  const [qty, setQty] = useState(initialQty);

  useEffect(() => {
    if (open) setQty(Math.min(10, Math.max(1, initialQty || 2)));
  }, [open, initialQty]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, dismissible, onClose]);

  const vehicle = useMemo(() => vehicleForQty(qty), [qty]);
  const VehicleIcon = vehicle.Icon;
  const displayTiers = tiers.slice(0, 4);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/55 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="seat-qty-title"
      onClick={() => {
        if (dismissible) onClose?.();
      }}
    >
      <div
        className="w-full sm:max-w-[26rem] max-h-[min(92dvh,640px)] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-[0_20px_50px_rgba(105,0,170,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-5 pt-5 pb-2 text-center">
          {dismissible ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-500 hover:bg-brand-50 hover:text-brand-4 cursor-pointer"
            >
              <X size={18} />
            </button>
          ) : null}
          <h2 id="seat-qty-title" className="text-lg sm:text-xl font-bold text-slate-900">
            How many seats?
          </h2>
        </div>

        <div className="flex flex-col items-center px-5 pb-3 pt-1">
          <div
            key={qty}
            className="flex h-[88px] w-full items-center justify-center text-brand-4"
          >
            <VehicleIcon className="text-[64px] sm:text-[72px]" aria-hidden />
          </div>
        </div>

        <div className="px-3 sm:px-5 pb-4">
          <div className="flex items-center justify-between gap-0.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const selected = qty === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setQty(n)}
                  aria-pressed={selected}
                  aria-label={`${n} seat${n === 1 ? "" : "s"}`}
                  className={`flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-full text-[13px] sm:text-sm font-bold transition-colors cursor-pointer ${
                    selected
                      ? "bg-primary text-primary-foreground shadow-md shadow-[var(--primary-glow)]"
                      : "text-slate-800 hover:bg-brand-50 hover:text-brand-4"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        {displayTiers.length > 0 ? (
          <div className="border-t border-brand-100 px-3 sm:px-4 py-4">
            <div
              className={`grid gap-2 ${
                displayTiers.length === 1
                  ? "grid-cols-1"
                  : displayTiers.length === 2
                    ? "grid-cols-2"
                    : displayTiers.length === 3
                      ? "grid-cols-3"
                      : "grid-cols-2 sm:grid-cols-4"
              }`}
            >
              {displayTiers.map((tier, idx) => (
                <div
                  key={`${tier.tier_name}-${tier.price}`}
                  className={`min-w-0 text-center px-1 ${
                    idx > 0 ? "sm:border-l sm:border-brand-100" : ""
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 truncate">
                    {tier.tier_name}
                  </p>
                  <p className="mt-0.5 text-[13px] font-bold text-slate-900 tabular-nums">
                    {formatMoney(Number(tier.price) || 0)}
                  </p>
                  <p
                    className={`mt-0.5 text-[10px] font-bold uppercase tracking-wide ${statusClass(
                      tier.status
                    )}`}
                  >
                    {statusLabel(tier.status)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="border-t border-brand-100 bg-brand-50 px-4 py-2.5 flex items-center justify-center gap-1.5 text-center">
          <span
            className="inline-block size-3.5 shrink-0 rounded-[2px] border-2 border-amber-400 bg-white"
            aria-hidden
            title="Bestseller seat"
          />
          <p className="text-[12px] sm:text-[13px] text-slate-600 leading-snug">
            Book the <span className="font-bold text-slate-800">Bestseller Seats</span> in this
            cinema at no extra cost!
          </p>
        </div>

        <div className="p-4 sm:px-5 sm:pb-5 sm:pt-4">
          <button
            type="button"
            onClick={() => onConfirm(Math.min(10, Math.max(1, qty)))}
            className="flex w-full h-12 items-center justify-center rounded-md text-base font-bold text-primary-foreground bg-primary cursor-pointer hover:bg-brand-5 transition-colors shadow-md shadow-[var(--primary-glow)]"
          >
            Select Seats
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
