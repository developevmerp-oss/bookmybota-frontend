"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";

export type AccessibilityCategoryOption = {
  name: string;
  price: number;
  rows: Array<{
    label: string;
    availableCount: number;
    seatIds: string[];
  }>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  qty: number;
  categories: AccessibilityCategoryOption[];
  onQtyChange: (qty: number) => void;
  onSelectSeats: (seatIds: string[]) => void;
};

export default function MovieAccessibilitySeatModal({
  open,
  onClose,
  qty,
  categories,
  onQtyChange,
  onSelectSeats,
}: Props) {
  const [categoryName, setCategoryName] = useState("");
  const [rowLabel, setRowLabel] = useState("");

  useEffect(() => {
    if (!open) return;
    setCategoryName("");
    setRowLabel("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.name === categoryName) || null,
    [categories, categoryName]
  );

  const selectedRow = useMemo(
    () => selectedCategory?.rows.find((r) => r.label === rowLabel) || null,
    [selectedCategory, rowLabel]
  );

  if (!open || typeof document === "undefined") return null;

  const selectClass =
    "w-full appearance-none rounded-lg border border-slate-200 bg-white px-3.5 py-3 pr-10 text-sm font-semibold text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-[var(--primary-glow)] cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed";

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="access-seat-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-[0_20px_50px_rgba(105,0,170,0.18)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 id="access-seat-title" className="text-base sm:text-lg font-bold text-slate-800">
            Accessibility Seat Selection
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-brand-50 hover:text-brand-4 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-3.5">
          <div className="relative">
            <select
              value={qty}
              onChange={(e) => onQtyChange(Number(e.target.value))}
              className={selectClass}
              aria-label="Number of tickets"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} Ticket{n === 1 ? "" : "s"}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400"
              aria-hidden
            />
          </div>

          <div className="relative">
            <select
              value={categoryName}
              onChange={(e) => {
                setCategoryName(e.target.value);
                setRowLabel("");
              }}
              className={selectClass}
              aria-label="Seat category"
              disabled={categories.length === 0}
            >
              <option value="">Select Category</option>
              {categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400"
              aria-hidden
            />
          </div>

          <div className="relative">
            <select
              value={rowLabel}
              onChange={(e) => setRowLabel(e.target.value)}
              className={selectClass}
              aria-label="Seat row"
              disabled={!selectedCategory}
            >
              <option value="">
                {selectedCategory ? "Select Row" : "Select Category First"}
              </option>
              {(selectedCategory?.rows || []).map((r) => (
                <option key={r.label} value={r.label}>
                  Row {r.label} ({r.availableCount} available)
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400"
              aria-hidden
            />
          </div>

          {categories.length === 0 ? (
            <p className="text-center text-sm text-slate-500 pt-2">
              No accessibility seats are available for this show.
            </p>
          ) : !categoryName ? (
            <p className="text-center text-sm text-slate-500 pt-2">
              Please select a category to view available rows.
            </p>
          ) : selectedCategory && selectedCategory.rows.length === 0 ? (
            <p className="text-center text-sm text-slate-500 pt-2">
              No accessible seats left in this category.
            </p>
          ) : selectedRow ? (
            <button
              type="button"
              onClick={() => {
                const ids = selectedRow.seatIds.slice(0, qty);
                onSelectSeats(ids);
                onClose();
              }}
              className="mt-1 flex w-full h-11 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold cursor-pointer hover:bg-brand-5 transition-colors"
            >
              Select {Math.min(qty, selectedRow.availableCount)} accessible seat
              {Math.min(qty, selectedRow.availableCount) === 1 ? "" : "s"}
            </button>
          ) : (
            <p className="text-center text-sm text-slate-500 pt-2">
              Select a row to pick accessible seats.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
