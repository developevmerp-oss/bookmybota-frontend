"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { SeatType } from "../types";
import { newSeatTypeId } from "../utils/presets";

interface SeatTypesPanelProps {
  seatTypes: SeatType[];
  /** How many rows/tables use each seat type, by id */
  usage: Record<string, number>;
  onChange: (next: SeatType[]) => void;
}

const field =
  "bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-[11px] focus:outline-none focus:border-red-500";

/** Seat types are defined once per layout: a name, a colour and a ticket price. Rows pick from them. */
export default function SeatTypesPanel({ seatTypes, usage, onChange }: SeatTypesPanelProps) {
  const patch = (id: string, next: Partial<SeatType>) =>
    onChange(seatTypes.map((t) => (t.id === id ? { ...t, ...next } : t)));

  const add = () =>
    onChange([...seatTypes, { id: newSeatTypeId(), name: `Seat type ${seatTypes.length + 1}`, color: "#22c55e", price: 250 }]);

  return (
    <div className="p-4 space-y-3 text-xs">
      <div>
        <span className="font-bold text-[11px] text-amber-300 block">Seat types</span>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Name each kind of seat, give it a colour and a price, then pick it for any row.
        </p>
      </div>

      <div className="space-y-2">
        {seatTypes.map((t) => {
          const used = usage[t.id] || 0;
          return (
            <div key={t.id} className="rounded-lg border border-slate-800 bg-slate-950 p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={t.color}
                  onChange={(e) => patch(t.id, { color: e.target.value })}
                  className="w-7 h-7 rounded border-0 bg-transparent cursor-pointer shrink-0"
                  aria-label={`${t.name} colour`}
                />
                <input
                  value={t.name}
                  onChange={(e) => patch(t.id, { name: e.target.value })}
                  className={`${field} flex-1 min-w-0 font-bold`}
                  aria-label="Seat type name"
                />
                <button
                  type="button"
                  onClick={() => onChange(seatTypes.filter((x) => x.id !== t.id))}
                  className="p-1 text-red-400 hover:text-red-300"
                  title={used > 0 ? `Used by ${used} row(s); those rows go back to the stand colour` : "Remove seat type"}
                  aria-label={`Remove ${t.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-slate-400">Price (ETB)</label>
                <input
                  type="number"
                  min={0}
                  value={t.price}
                  onChange={(e) => patch(t.id, { price: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className={`${field} w-24 text-emerald-400 font-bold`}
                  aria-label={`${t.name} price`}
                />
                <span className="ml-auto text-[10px] text-slate-500">{used > 0 ? `${used} row${used === 1 ? "" : "s"}` : "unused"}</span>
              </div>
            </div>
          );
        })}
        {seatTypes.length === 0 && <p className="text-[11px] text-slate-500 text-center py-3">No seat types. Add one.</p>}
      </div>

      <button
        type="button"
        onClick={add}
        className="w-full flex items-center justify-center gap-1 py-1.5 rounded border border-dashed border-slate-700 text-[11px] font-semibold text-slate-300 hover:text-white hover:border-red-500"
      >
        <Plus className="w-3 h-3" /> Add seat type
      </button>
    </div>
  );
}
