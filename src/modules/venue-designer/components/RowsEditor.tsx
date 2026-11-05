"use client";

import React, { useState } from "react";
import { Copy, Plus, Trash2, Wand2 } from "lucide-react";
import { RowConfig, SeatType, UniversalVenueObject } from "../types";
import { buildRows, newRowId, nextRowLabel, resolveRows, rowBlocks, rowSeatTotal } from "../utils/geometryEngine";

interface RowsEditorProps {
  obj: UniversalVenueObject;
  seatTypes: SeatType[];
  onChange: (rows: RowConfig[]) => void;
}

const field =
  "bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-900 text-[11px] focus:outline-none focus:border-red-500";

/** Add, rename, resize and re-type every row of a stand. Row names can be anything: A, AA, 1, "Balcony 1" ... */
export default function RowsEditor({ obj, seatTypes, onChange }: RowsEditorProps) {
  const rows = resolveRows(obj);
  const [genStart, setGenStart] = useState("A");
  const [genCount, setGenCount] = useState(10);
  const [genSeats, setGenSeats] = useState(20);
  const [genType, setGenType] = useState<string>("");
  const [genBlocks, setGenBlocks] = useState<string>("");

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
        blocks: last ? (rowBlocks(last).length > 1 ? [...rowBlocks(last)] : undefined) : undefined,
      },
    ]);
  };

  const duplicateRow = (index: number) => {
    const src = rows[index];
    const blocks = rowBlocks(src);
    const copy: RowConfig = {
      ...src,
      id: newRowId(),
      label: freshLabel(src.label),
      gaps: undefined,
      blocks: blocks.length > 1 ? [...blocks] : undefined,
      seatCount: rowSeatTotal(src),
    };
    onChange([...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)]);
  };

  const removeRow = (id: string) => onChange(rows.filter((r) => r.id !== id));

  /** "10, 20, 10" -> [10, 20, 10]. Empty or invalid input gives []. */
  const parseBlocks = (raw: string): number[] =>
    raw
      .split(/[,\s]+/)
      .map((v) => parseInt(v, 10))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 500);

  /** Apply typed blocks to a row: the seat count becomes their sum, one number means no aisles */
  const applyBlocks = (row: RowConfig, raw: string) => {
    const list = parseBlocks(raw);
    if (list.length === 0) {
      patchRow(row.id, { blocks: undefined, gaps: undefined });
      return;
    }
    const total = list.reduce((a, b) => a + b, 0);
    patchRow(row.id, { blocks: list.length > 1 ? list : undefined, gaps: undefined, seatCount: total });
  };

  return (
    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-bold text-[11px] text-blue-600">Rows &amp; Seats</span>
        <span className="text-[10px] font-mono text-slate-500">
          {rows.length} rows · {total} seats
        </span>
      </div>

      {/* Quick generator */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1">
          <Wand2 className="w-3 h-3 text-purple-600" /> Generate rows
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          <label className="text-[10px] text-slate-500">
            First row
            <input value={genStart} onChange={(e) => setGenStart(e.target.value)} className={`${field} w-full mt-0.5 text-center font-bold`} aria-label="First row name" />
          </label>
          <label className="text-[10px] text-slate-500">
            Rows
            <input type="number" min={1} max={200} value={genCount} onChange={(e) => setGenCount(parseInt(e.target.value, 10) || 1)} className={`${field} w-full mt-0.5`} aria-label="Number of rows" />
          </label>
          <label className="text-[10px] text-slate-500">
            Seats each
            <input type="number" min={1} max={200} value={genSeats} onChange={(e) => setGenSeats(parseInt(e.target.value, 10) || 1)} className={`${field} w-full mt-0.5`} aria-label="Seats per row" />
          </label>
        </div>
        <label className="text-[10px] text-slate-500 block">
          Seat blocks (optional, e.g. 10,20,10)
          <input
            value={genBlocks}
            onChange={(e) => setGenBlocks(e.target.value)}
            placeholder="10,20,10 = 10 left, 20 centre, 10 right"
            className={`${field} w-full mt-0.5`}
            aria-label="Seat blocks for generated rows"
          />
        </label>
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
            onClick={() => onChange(buildRows(genStart, genCount, genSeats, genType || undefined, parseBlocks(genBlocks)))}
            className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold"
          >
            Generate
          </button>
        </div>
        <p className="text-[10px] text-slate-500">Replaces the current rows. Names count up: A, B, C … Z, AA or 1, 2, 3 …</p>
      </div>

      {/* Row list */}
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5 custom-scrollbar">
        <div className="grid grid-cols-[2.5rem_2.5rem_minmax(0,1fr)_5rem_2.6rem] gap-1 text-[9px] uppercase tracking-wide text-slate-500 px-0.5">
          <span>Row</span>
          <span>Seats</span>
          <span>Type</span>
          <span>Blocks</span>
          <span />
        </div>
        {rows.map((row, index) => {
          const type = row.seatTypeId ? typeById.get(row.seatTypeId) : undefined;
          return (
            <div key={row.id} className="grid grid-cols-[2.5rem_2.5rem_minmax(0,1fr)_5rem_2.6rem] gap-1 items-center">
              <input
                value={row.label}
                onChange={(e) => patchRow(row.id, { label: e.target.value })}
                className={`${field} w-full text-center font-bold`}
                aria-label={`Row ${index + 1} name`}
              />
              <input
                type="number"
                min={1}
                value={rowSeatTotal(row)}
                onChange={(e) => {
                  const count = Math.max(1, parseInt(e.target.value, 10) || 1);
                  const blocks = rowBlocks(row);
                  if (blocks.length > 1) {
                    // Keep the aisles; the last block takes the difference, or the aisles go if it no longer fits
                    const before = blocks.slice(0, -1).reduce((a, b) => a + b, 0);
                    const last = count - before;
                    if (last >= 1) patchRow(row.id, { seatCount: count, blocks: [...blocks.slice(0, -1), last], gaps: undefined });
                    else patchRow(row.id, { seatCount: count, blocks: undefined, gaps: undefined });
                  } else {
                    patchRow(row.id, { seatCount: count, gaps: undefined });
                  }
                }}
                className={`${field} w-full`}
                aria-label={`Row ${index + 1} seats`}
              />
              <div className="flex items-center gap-1 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-slate-300" style={{ backgroundColor: type?.color || obj.color }} />
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
                key={`${row.id}-${rowBlocks(row).join(",")}`}
                defaultValue={rowBlocks(row).length > 1 ? rowBlocks(row).join(",") : ""}
                placeholder="10,20,10"
                onBlur={(e) => applyBlocks(row, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className={`${field} w-full`}
                aria-label={`Row ${index + 1} seat blocks`}
              />
              <div className="flex items-center justify-end gap-0.5">
                <button type="button" onClick={() => duplicateRow(index)} className="p-1 text-slate-500 hover:text-slate-900" title="Duplicate row" aria-label={`Duplicate row ${row.label}`}>
                  <Copy className="w-3 h-3" />
                </button>
                <button type="button" onClick={() => removeRow(row.id)} className="p-1 text-red-500 hover:text-red-500" title="Delete row" aria-label={`Delete row ${row.label}`}>
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
        className="w-full flex items-center justify-center gap-1 py-1.5 rounded border border-dashed border-slate-300 text-[11px] font-semibold text-slate-700 hover:text-slate-900 hover:border-red-500"
      >
        <Plus className="w-3 h-3" /> Add row
      </button>
      <p className="text-[10px] text-slate-500">
        Blocks split a row with aisles: type the seats in each block, left to right. 10,20,10 gives 10 on the left, 20 in the centre and
        10 on the right. The row's seat count becomes the total.
      </p>
    </div>
  );
}
