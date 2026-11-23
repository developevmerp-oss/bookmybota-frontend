"use client";

import { Plus, Trash2 } from "lucide-react";

export type SeatSection = { seat_type: "regular" | "recliner" | "couple"; name: string; seats: number };

const TYPE_LABEL: Record<SeatSection["seat_type"], string> = { regular: "Regular", recliner: "Recliner", couple: "Couple" };

const input =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100";

/** Split each seat type into named sections, for example Regular: Section 1 = 100, Section 2 = 50. */
export default function SeatSectionsEditor({
  value,
  onChange,
  totals,
}: {
  value: SeatSection[];
  onChange: (next: SeatSection[]) => void;
  /** Seats per type already entered, to show how many are still to place */
  totals?: { regular: number; recliner: number; couple: number };
}) {
  const update = (i: number, patch: Partial<SeatSection>) => onChange(value.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const placed = (type: SeatSection["seat_type"]) => value.filter((s) => s.seat_type === type).reduce((a, s) => a + (Number(s.seats) || 0), 0);

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-700">Sections (optional)</p>
        <button
          type="button"
          onClick={() => onChange([...value, { seat_type: "regular", name: `Section ${value.length + 1}`, seats: 0 }])}
          className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-500"
        >
          <Plus size={13} /> Add section
        </button>
      </div>
      <p className="text-[11px] text-slate-500">Split a seat type into areas, for example 200 regular seats as 100 in section 1, 50 in section 2 and 50 in section 3.</p>

      {value.length === 0 ? null : (
        <div className="space-y-2">
          {value.map((s, i) => (
            <div key={i} className="grid grid-cols-[6.5rem_minmax(0,1fr)_5rem_2rem] items-center gap-2">
              <select className={input} value={s.seat_type} onChange={(e) => update(i, { seat_type: e.target.value as SeatSection["seat_type"] })} aria-label="Seat type">
                {(Object.keys(TYPE_LABEL) as Array<SeatSection["seat_type"]>).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              <input className={input} value={s.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Section name" aria-label="Section name" />
              <input
                className={input}
                type="text"
                inputMode="numeric"
                value={s.seats ? String(s.seats) : ""}
                onChange={(e) => update(i, { seats: Number(e.target.value.replace(/\D/g, "").slice(0, 5)) || 0 })}
                placeholder="Seats"
                aria-label="Seats in this section"
              />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                aria-label="Remove section"
                className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {totals && value.length > 0 ? (
        <ul className="space-y-0.5 text-[11px]">
          {(Object.keys(TYPE_LABEL) as Array<SeatSection["seat_type"]>)
            .filter((t) => totals[t] > 0 || placed(t) > 0)
            .map((t) => {
              const left = totals[t] - placed(t);
              return (
                <li key={t} className={left === 0 ? "text-emerald-600" : left < 0 ? "text-rose-600" : "text-slate-500"}>
                  {TYPE_LABEL[t]} {totals[t]}: {placed(t)} placed
                  {left > 0 ? `, ${left} still to place` : left < 0 ? `, over by ${-left}` : ", all placed"}
                </li>
              );
            })}
        </ul>
      ) : null}
    </div>
  );
}

export function cleanSections(value: SeatSection[]): SeatSection[] {
  return value
    .map((s) => ({ seat_type: s.seat_type, name: String(s.name || "").trim(), seats: Math.max(0, Math.floor(Number(s.seats) || 0)) }))
    .filter((s) => s.name && s.seats > 0);
}
