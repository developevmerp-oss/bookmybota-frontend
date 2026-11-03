"use client";

import React, { useState } from "react";
import { Copy, Plus, Trash2, Wand2 } from "lucide-react";
import { RowConfig, SeatType, UniversalVenueObject } from "../types";
import { buildRows, newRowId, nextRowLabel, resolveRows, rowSeatTotal } from "../utils/geometryEngine";

interface RowsEditorProps {
  obj: UniversalVenueObject;
  seatTypes: SeatType[];
  onChange: (rows: RowConfig[]) => void;
}

const field =
  "bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white text-[11px] focus:outline-none focus:border-red-500";

/** Add, rename, resize and re-type every row of a stand. Row names can be anything: A, AA, 1, "Balcony 1" ... */
export default function RowsEditor({ obj, seatTypes, onChange }: RowsEditorProps) {
  const rows = resolveRows(obj);
  const [genStart, setGenStart] = useState("A");
  const [genCount, setGenCount] = useState(10);
  const [genSeats, setGenSeats] = useState(20);
  const [genType, setGenType] = useState<string>("");

  const total = rows.reduce((sum, r) => sum + rowSeatTotal(r), 0);
  const typeById = new Map(seatTypes.map((t) => [t.id, t]));

  /** The next row name after `from` that no other row uses yet */
  const freshLabel = (from: string) => {
    const used = new Set(rows.map((r) => r.label.trim().toLowerCase()));
    let label = nextRowLabel(from);
    let guard = 0;
    while (used.has(label.trim().toLowerCase()) && guard < 500) {
      label = nextRowLabel(label);
      guard += 1;
    }
    return label;
  };

  const patchRow = (id: string, patch: Partial<RowConfig>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRow = () => {
    const last = rows[rows.length - 1];
    onChange([
      ...rows,
      {
        id: newRowId(),
        label: last ? freshLabel(last.label) : "A",
        seatCount: last?.seatCount || 12,
        seatTypeId: last?.seatTypeId,
        gaps: last?.gaps ? [...last.gaps] : undefined,
      },
    ]);
  };

  const duplicateRow = (index: number) => {
    const src = rows[index];
    const copy: RowConfig = { ...src, id: newRowId(), label: freshLabel(src.label), gaps: src.gaps ? [...src.gaps] : undefined };
    onChange([...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)]);
  };

  const removeRow = (id: string) => onChange(rows.filter((r) => r.id !== id));

  const parseGaps = (raw: string, seatCount: number): number[] | undefined => {
    const list = Array.from(
      new Set(
        raw
          .split(/[,\s]+/)
          .map((v) => parseInt(v, 10))
          .filter((n) => Number.isFinite(n) && n >= 1 && n <= seatCount)
      )
    ).sort((a, b) => a - b);
    return list.length > 0 ? list : undefined;
  };

  return (
    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-bold text-[11px] text-blue-300">Rows &amp; Seats</span>
        <span className="text-[10px] font-mono text-slate-400">
          {rows.length} rows · {total} seats
        </span>
      </div>

      {/* Quick generator */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1">
          <Wand2 className="w-3 h-3 text-purple-400" /> Generate rows
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          <label className="text-[10px] text-slate-400">
            First row
            <input value={genStart} onChange={(e) => setGenStart(e.target.value)} className={`${field} w-full mt-0.5 text-center font-bold`} aria-label="First row name" />
          </label>
          <label className="text-[10px] text-slate-400">
            Rows
            <input type="number" min={1} max={200} value={genCount} onChange={(e) => setGenCount(parseInt(e.target.value, 10) || 1)} className={`${field} w-full mt-0.5`} aria-label="Number of rows" />
          </label>
          <label className="text-[10px] text-slate-400">
            Seats each
            <input type="number" min={1} max={200} value={genSeats} onChange={(e) => setGenSeats(parseInt(e.target.value, 10) || 1)} className={`${field} w-full mt-0.5`} aria-label="Seats per row" />
          </label>
        </div>
        <div className="flex gap-1.5">
          <select value={genType} onChange={(e) => setGenType(e.target.value)} className={`${field} flex-1`} aria-label="Seat type for generated rows">
            <option value="">Stand colour</option>
            {seatTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onChange(buildRows(genStart, genCount, genSeats, genType || undefined))}
            className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold"
          >
            Generate
          </button>
        </div>
        <p className="text-[10px] text-slate-500">Replaces the current rows. Names count up: A, B, C … Z, AA or 1, 2, 3 …</p>
      </div>

      {/* Row list */}
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5 custom-scrollbar">
        <div className="grid grid-cols-[2.8rem_2.8rem_minmax(0,1fr)_3rem_2.7rem] gap-1 text-[9px] uppercase tracking-wide text-slate-500 px-0.5">
          <span>Row</span>
          <span>Seats</span>
          <span>Type</span>
          <span>Gaps</span>
          <span />
        </div>
        {rows.map((row, index) => {
          const type = row.seatTypeId ? typeById.get(row.seatTypeId) : undefined;
          return (
            <div key={row.id} className="grid grid-cols-[2.8rem_2.8rem_minmax(0,1fr)_3rem_2.7rem] gap-1 items-center">
              <input
                value={row.label}
                onChange={(e) => patchRow(row.id, { label: e.target.value })}
                className={`${field} w-full text-center font-bold`}
                aria-label={`Row ${index + 1} name`}
              />
              <input
                type="number"
                min={1}
                value={row.seatCount}
                onChange={(e) => {
                  const count = Math.max(1, parseInt(e.target.value, 10) || 1);
                  patchRow(row.id, { seatCount: count, gaps: row.gaps?.filter((g) => g <= count) });
                }}
                className={`${field} w-full`}
                aria-label={`Row ${index + 1} seats`}
              />
              <div className="flex items-center gap-1 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-slate-700" style={{ backgroundColor: type?.color || obj.color }} />
                <select
                  value={row.seatTypeId || ""}
                  onChange={(e) => patchRow(row.id, { seatTypeId: e.target.value || undefined })}
                  className={`${field} w-full min-w-0`}
                  aria-label={`Row ${index + 1} seat type`}
                >
                  <option value="">Stand colour</option>
                  {seatTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <input
                key={`${row.id}-${(row.gaps || []).join(",")}`}
                defaultValue={(row.gaps || []).join(",")}
                placeholder="5,12"
                onBlur={(e) => patchRow(row.id, { gaps: parseGaps(e.target.value, row.seatCount) })}
                className={`${field} w-full`}
                aria-label={`Row ${index + 1} aisle gaps`}
              />
              <div className="flex items-center justify-end gap-0.5">
                <button type="button" onClick={() => duplicateRow(index)} className="p-1 text-slate-400 hover:text-white" title="Duplicate row" aria-label={`Duplicate row ${row.label}`}>
                  <Copy className="w-3 h-3" />
                </button>
                <button type="button" onClick={() => removeRow(row.id)} className="p-1 text-red-400 hover:text-red-300" title="Delete row" aria-label={`Delete row ${row.label}`}>
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-[11px] text-slate-500 py-2 text-center">No rows yet. Add one or generate several.</p>}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="w-full flex items-center justify-center gap-1 py-1.5 rounded border border-dashed border-slate-700 text-[11px] font-semibold text-slate-300 hover:text-white hover:border-red-500"
      >
        <Plus className="w-3 h-3" /> Add row
      </button>
      <p className="text-[10px] text-slate-500">Gaps are seat positions left empty for an aisle, e.g. 5,12.</p>
    </div>
  );
}
