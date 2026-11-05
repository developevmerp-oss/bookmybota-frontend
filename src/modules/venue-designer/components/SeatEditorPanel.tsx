"use client";

import React from "react";
import { Eraser, RotateCcw, Trash2, X } from "lucide-react";
import { SeatType, UniversalSeat } from "../types";

interface SeatEditorPanelProps {
  seats: UniversalSeat[];
  seatTypes: SeatType[];
  onType: (seatTypeId: string | undefined) => void;
  onColor: (color: string) => void;
  onResetLook: () => void;
  onRemove: () => void;
  onRestore: () => void;
  onClear: () => void;
}

const field =
  "bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 text-[11px] focus:outline-none focus:border-red-500";

/** Edit the seats picked on the canvas: their own seat type or colour, or take them out of the layout */
export default function SeatEditorPanel({ seats, seatTypes, onType, onColor, onResetLook, onRemove, onRestore, onClear }: SeatEditorPanelProps) {
  const removedCount = seats.filter((s) => s.removed).length;
  const live = seats.filter((s) => !s.removed);
  const sameType = live.length > 0 && live.every((s) => s.seatTypeId === live[0].seatTypeId) ? live[0].seatTypeId || "" : "";
  const sameColor = live.length > 0 && live.every((s) => s.color === live[0].color) ? live[0].color || "#16a34a" : "#16a34a";
  const label = (s: UniversalSeat) => (s.removed ? `${s.rowLabel} (removed)` : `${s.rowLabel}${s.seatNumber}`);

  return (
    <div className="rounded-lg border-2 border-sky-300 bg-sky-50/60 p-3 space-y-2.5" role="group" aria-label="Selected seats">
      <div className="flex items-center justify-between">
        <span className="font-bold text-[11px] text-sky-700">
          {seats.length} seat{seats.length === 1 ? "" : "s"} selected
        </span>
        <button type="button" onClick={onClear} className="p-1 text-slate-500 hover:text-slate-900" aria-label="Clear seat selection" title="Clear selection">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
        {seats.slice(0, 40).map((s) => (
          <span key={s.slotKey} className="px-1.5 py-0.5 rounded bg-white border border-sky-200 text-[10px] font-mono text-slate-700">
            {label(s)}
          </span>
        ))}
        {seats.length > 40 && <span className="text-[10px] text-slate-500">+{seats.length - 40} more</span>}
      </div>

      <div>
        <span className="text-[10px] text-slate-500 block mb-0.5">Seat type for these seats</span>
        <select
          value={sameType}
          onChange={(e) => onType(e.target.value || undefined)}
          className={`${field} w-full`}
          aria-label="Selected seats seat type"
        >
          <option value="">Same as the row</option>
          {seatTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · ETB {t.price}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-500">Colour</span>
        <input
          type="color"
          value={sameColor}
          onChange={(e) => onColor(e.target.value)}
          className="w-8 h-7 rounded border-0 bg-transparent cursor-pointer"
          aria-label="Selected seats colour"
        />
        <button type="button" onClick={onResetLook} className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900" aria-label="Reset selected seats to the row">
          <RotateCcw className="w-3 h-3" /> Use row look
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRemove}
          disabled={live.length === 0}
          className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded border border-red-200 bg-white text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
          aria-label="Remove selected seats"
        >
          <Trash2 className="w-3 h-3" /> Remove seat{live.length === 1 ? "" : "s"}
        </button>
        {removedCount > 0 && (
          <button
            type="button"
            onClick={onRestore}
            className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded border border-emerald-200 bg-white text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50"
            aria-label="Restore selected seats"
          >
            <Eraser className="w-3 h-3" /> Bring back
          </button>
        )}
      </div>
      <p className="text-[10px] text-slate-500">Click a seat to select it. Shift-click adds more seats. Delete removes the selected seats.</p>
    </div>
  );
}
