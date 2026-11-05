"use client";

import React, { useMemo } from "react";
import { MousePointerSquareDashed } from "lucide-react";
import { UniversalSeat } from "../types";

interface SeatPickerProps {
  seats: UniversalSeat[];
  pickedCount: number;
  boxMode: boolean;
  onToggleBox: () => void;
  onPick: (keys: string[]) => void;
}

const select =
  "w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 text-[11px] focus:outline-none focus:border-red-500";

/** Quick ways to pick many seats at once (a whole block, a row, a seat number, or a box dragged on the canvas) */
export default function SeatPicker({ seats, pickedCount, boxMode, onToggleBox, onPick }: SeatPickerProps) {
  const rows = useMemo(() => Array.from(new Set(seats.map((s) => s.rowLabel))), [seats]);
  const numbers = useMemo(
    () => Array.from(new Set(seats.map((s) => s.seatNumber))).filter(Boolean).sort((a, b) => Number(a) - Number(b)),
    [seats]
  );
  const keysOf = (list: UniversalSeat[]) => list.map((s) => s.slotKey).filter((k): k is string => !!k);
  if (seats.length === 0) return null;

  return (
    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-bold text-[11px] text-slate-700">Pick many seats</span>
        {pickedCount > 0 && <span className="text-[10px] font-mono text-sky-700">{pickedCount} picked</span>}
      </div>
      <button
        type="button"
        onClick={onToggleBox}
        className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border font-bold text-[11px] ${
          boxMode ? "bg-sky-600 border-sky-600 text-white" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
        }`}
      >
        <MousePointerSquareDashed className="w-3.5 h-3.5" />
        {boxMode ? "Drag a box on the canvas… (click to stop)" : "Drag a box over seats"}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <select
          className={select}
          value=""
          aria-label="Pick a whole row"
          onChange={(e) => e.target.value && onPick(keysOf(seats.filter((s) => s.rowLabel === e.target.value)))}
        >
          <option value="">Whole row…</option>
          {rows.map((r) => (
            <option key={r} value={r}>
              Row {r}
            </option>
          ))}
        </select>
        <select
          className={select}
          value=""
          aria-label="Pick a seat number in every row"
          onChange={(e) => e.target.value && onPick(keysOf(seats.filter((s) => s.seatNumber === e.target.value)))}
        >
          <option value="">Seat no. in all rows…</option>
          {numbers.map((n) => (
            <option key={n} value={n}>
              Seat {n}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={() => onPick(keysOf(seats))}
        className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white font-bold text-[11px] text-slate-700 hover:bg-slate-100"
      >
        Select every seat in this block
      </button>
      <p className="text-[10px] text-slate-500">After picking, use “Remove seat” in the blue box above. Shift-click on a seat still adds or drops single seats.</p>
    </div>
  );
}
