"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import { formatMoney } from "@/lib/currencyFormat";

export type AccessibilitySeatOption = {
  id: string;
  number: string;
  isBooked: boolean;
};

export type AccessibilityCategoryOption = {
  name: string;
  price: number;
  rows: Array<{
    label: string;
    availableCount: number;
    seatIds: string[];
    seats: AccessibilitySeatOption[];
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

  const pickFromSeat = (startSeatId: string) => {
    if (!selectedRow) return;
    const available = selectedRow.seats.filter((s) => !s.isBooked);
    const startIdx = available.findIndex((s) => s.id === startSeatId);
    if (startIdx < 0) return;
    const ids = available.slice(startIdx, startIdx + qty).map((s) => s.id);
    if (ids.length === 0) return;
    onSelectSeats(ids);
    onClose();
  };

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
        className="w-full max-w-lg rounded-2xl bg-white shadow-[0_20px_50px_rgba(105,0,170,0.18)] overflow-hidden max-h-[min(92vh,640px)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
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

        <div className="px-5 py-5 space-y-3.5 overflow-y-auto min-h-0 flex-1">
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
                  {c.name} - {formatMoney(c.price)}
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
                  {selectedCategory.name} Row {r.label}
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
              No seats are available for this show.
            </p>
          ) : !categoryName ? (
            <p className="text-center text-sm text-slate-500 pt-2">
              Please select a category to view available rows.
            </p>
          ) : selectedCategory && selectedCategory.rows.length === 0 ? (
            <p className="text-center text-sm text-slate-500 pt-2">
              No seats left in this category.
            </p>
          ) : selectedRow ? (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-left text-slate-600">
                    <th className="px-3 py-2.5 font-semibold">Seat Number</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRow.seats.map((seat) => {
                    const booked = seat.isBooked;
                    const canSelect = !booked && selectedRow.seatIds.includes(seat.id);
                    return (
                      <tr
                        key={seat.id}
                        className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-3 py-2.5 font-medium text-slate-800 tabular-nums">
                          {seat.number}
                        </td>
                        <td
                          className={`px-3 py-2.5 font-medium ${
                            booked ? "text-slate-500" : "text-emerald-600"
                          }`}
                        >
                          {booked ? "Booked" : "Available"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {canSelect ? (
                            <button
                              type="button"
                              onClick={() => pickFromSeat(seat.id)}
                              className="inline-flex min-w-[72px] cursor-pointer items-center justify-center rounded-md border border-[#F84464] bg-white px-3 py-1.5 text-xs font-semibold text-[#F84464] transition-colors hover:bg-[#F84464] hover:text-white"
                            >
                              Select
                            </button>
                          ) : (
                            <span className="inline-flex min-w-[72px] items-center justify-center rounded-md bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500">
                              Booked
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-sm text-slate-500 pt-2">
              Select a row to view seats.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
