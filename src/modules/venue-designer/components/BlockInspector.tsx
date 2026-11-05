"use client";

import React, { useMemo, useState } from "react";
import { SeatType, UniversalVenueObject } from "../types";
import { generateSeatsForObject } from "../utils/geometryEngine";
import { BLOCK_PRESETS, GROUND_PRESETS, blockLabelMetrics, blockSeatSize, recentre, rectForGrid } from "../utils/blockGeometry";
import DraftNumberInput from "./DraftNumberInput";

interface BlockInspectorProps {
  obj: UniversalVenueObject;
  seatTypes: SeatType[];
  levels: string[];
  onPatch: (patch: Partial<UniversalVenueObject>) => void;
  onZoom: () => void;
}

const field = "w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900";
const label = "text-slate-500 block mb-1";

/** Make the whole shape bigger or smaller around its middle, keeping its proportions */
function SizeRow({ obj, onPatch }: { obj: UniversalVenueObject; onPatch: (patch: Partial<UniversalVenueObject>) => void }) {
  const scaleBy = (f: number) => {
    const points = (obj.points || []).map((v) => Math.round(v * f));
    const patch: Partial<UniversalVenueObject> = { points };
    if (obj.blockArcCenter) patch.blockArcCenter = [Math.round(obj.blockArcCenter[0] * f), Math.round(obj.blockArcCenter[1] * f)];
    onPatch(patch);
  };
  const btn = "px-2.5 py-1 rounded border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-100";
  return (
    <div>
      <label className={label}>Size of the whole shape</label>
      <div className="flex gap-1">
        <button type="button" className={btn} onClick={() => scaleBy(1 / 1.1)} aria-label="Make smaller">− Smaller</button>
        <button type="button" className={btn} onClick={() => scaleBy(1.1)} aria-label="Make bigger">+ Bigger</button>
        <button type="button" className={btn} onClick={() => scaleBy(1 / 1.5)}>½×</button>
        <button type="button" className={btn} onClick={() => scaleBy(1.5)}>1.5×</button>
      </div>
      <label className={`${label} mt-2`}>Rotate ({Math.round(obj.rotation || 0)}°)</label>
      <div className="flex gap-1">
        <button type="button" className={btn} onClick={() => onPatch({ rotation: ((obj.rotation || 0) - 15 + 360) % 360 })}>↺ 15°</button>
        <button type="button" className={btn} onClick={() => onPatch({ rotation: ((obj.rotation || 0) + 15) % 360 })}>↻ 15°</button>
        <button type="button" className={btn} onClick={() => onPatch({ rotation: ((obj.rotation || 0) + 90) % 360 })}>90°</button>
        <button type="button" className={btn} onClick={() => onPatch({ rotation: 0 })}>Reset</button>
      </div>
    </div>
  );
}

/** Settings of a stadium block (level, rows, seat gaps, shape) or of a polygon ground / stage shape */
export default function BlockInspector({ obj, seatTypes, levels, onPatch, onZoom }: BlockInspectorProps) {
  const [newLevel, setNewLevel] = useState("");
  const [gridRows, setGridRows] = useState(50);
  const [gridCols, setGridCols] = useState(20);
  const isBlock = obj.type === "block";
  const seatCount = useMemo(() => (isBlock ? generateSeatsForObject(obj, seatTypes).length : 0), [isBlock, obj, seatTypes]);

  if (!isBlock) {
    return (
      <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2.5">
        <span className="font-bold text-[11px] text-slate-700 block">Ground / stage shape</span>
        <SizeRow obj={obj} onPatch={onPatch} />
        <div>
          <label className={label}>Text on the shape</label>
          <input className={field} value={obj.label || ""} onChange={(e) => onPatch({ label: e.target.value })} />
        </div>
        <div>
          <label className={label}>Change the outline</label>
          <select
            className={field}
            value=""
            onChange={(e) => {
              const preset = GROUND_PRESETS.find((p) => p.id === e.target.value);
              if (preset) onPatch({ points: preset.build() });
            }}
          >
            <option value="">Pick a shape…</option>
            {GROUND_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <p className="text-[10px] text-slate-500">Drag the red corners to reshape. Click a white dot on an edge to add a corner. Double-click a corner to remove it.</p>
      </div>
    );
  }

  const mode = obj.blockRowMode || "straight";
  return (
    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="font-bold text-[11px] text-slate-700">Stadium block</span>
        <span className="text-[10px] font-mono text-slate-500">{seatCount} seats</span>
      </div>

      <SizeRow obj={obj} onPatch={onPatch} />

      <div>
        <label className={label}>Stand / level</label>
        <select className={field} value={obj.level || ""} onChange={(e) => onPatch({ level: e.target.value || undefined })}>
          <option value="">No level</option>
          {levels.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <div className="flex gap-1 mt-1">
          <input className={field} placeholder="New level, e.g. Club level" value={newLevel} onChange={(e) => setNewLevel(e.target.value)} />
          <button
            type="button"
            disabled={!newLevel.trim()}
            onClick={() => {
              onPatch({ level: newLevel.trim() });
              setNewLevel("");
            }}
            className="px-2 rounded bg-slate-800 text-white font-bold disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>

      <div>
        <label className={label}>Seat type</label>
        <select
          className={field}
          value={obj.seatTypeId || ""}
          onChange={(e) => {
            const t = seatTypes.find((s) => s.id === e.target.value);
            onPatch({ seatTypeId: e.target.value || undefined, ...(t ? { color: t.color, price: t.price } : {}) });
          }}
        >
          <option value="">Block colour and price</option>
          {seatTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.price})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label}>Rows run</label>
          <select className={field} value={mode} onChange={(e) => onPatch({ blockRowMode: e.target.value as "straight" | "arc" })}>
            <option value="straight">Straight</option>
            <option value="arc">Curved (around a centre)</option>
          </select>
        </div>
        {mode === "straight" ? (
          <div>
            <label className={label}>Row angle (°)</label>
            <DraftNumberInput
              aria-label="Row angle"
              className={field}
              value={obj.blockRowAngle || 0}
              min={-90}
              max={90}
              onCommit={(v) => onPatch({ blockRowAngle: v })}
            />
          </div>
        ) : (
          <div>
            <label className={label}>Curve centre</label>
            <button
              type="button"
              onClick={() => {
                const r = recentre(obj.points || []);
                onPatch({ blockArcCenter: [-r.cx, -r.cy] });
              }}
              className="w-full px-2 py-1 rounded border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-100"
            >
              Reset to ground
            </button>
          </div>
        )}
      </div>

      {mode === "arc" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>Centre X</label>
            <DraftNumberInput
              aria-label="Curve centre X"
              className={field}
              value={Math.round((obj.blockArcCenter || [0, 0])[0])}
              onCommit={(v) => onPatch({ blockArcCenter: [v, (obj.blockArcCenter || [0, 0])[1]] })}
            />
          </div>
          <div>
            <label className={label}>Centre Y</label>
            <DraftNumberInput
              aria-label="Curve centre Y"
              className={field}
              value={Math.round((obj.blockArcCenter || [0, 0])[1])}
              onCommit={(v) => onPatch({ blockArcCenter: [(obj.blockArcCenter || [0, 0])[0], v] })}
            />
          </div>
        </div>
      )}

      {(() => {
        const size = blockSeatSize(obj);
        const pitchX = obj.seatSpacing || 18;
        const pitchY = obj.rowSpacing || 22;
        const gapX = Math.max(0, +(pitchX - size).toFixed(1));
        const gapY = Math.max(0, +(pitchY - size).toFixed(1));
        const labelGap = obj.blockLabelGap ?? Math.max(3, Math.round(size * 0.9));
        return (
          <div className="p-2 rounded border border-slate-200 bg-slate-50 space-y-2">
            <span className="font-bold text-[11px] text-slate-700 block">Seat size &amp; spacing</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={label}>Seat size</label>
                <DraftNumberInput
                  aria-label="Seat size"
                  className={field}
                  value={size}
                  min={3}
                  max={40}
                  decimals={1}
                  onCommit={(v) => onPatch({ seatSize: v, seatSpacing: +(v + gapX).toFixed(1), rowSpacing: +(v + gapY).toFixed(1) })}
                />
              </div>
              <div>
                <label className={label}>Padding in block</label>
                <DraftNumberInput aria-label="Padding inside the block border" className={field} value={obj.blockInset ?? 10} min={0} max={80} decimals={1} onCommit={(v) => onPatch({ blockInset: v })} />
              </div>
              <div>
                <label className={label}>Space between seats</label>
                <DraftNumberInput aria-label="Space between seats" className={field} value={gapX} min={0} max={40} decimals={1} onCommit={(v) => onPatch({ seatSpacing: +(size + v).toFixed(1) })} />
              </div>
              <div>
                <label className={label}>Space between rows</label>
                <DraftNumberInput aria-label="Space between rows" className={field} value={gapY} min={0} max={40} decimals={1} onCommit={(v) => onPatch({ rowSpacing: +(size + v).toFixed(1) })} />
              </div>
              <div>
                <label className={label}>Seat to row name</label>
                <DraftNumberInput aria-label="Space between seats and row name" className={field} value={labelGap} min={0} max={40} decimals={1} onCommit={(v) => onPatch({ blockLabelGap: v })} />
              </div>
              <label className="flex items-end gap-2 pb-1 text-slate-700">
                <input type="checkbox" checked={!!obj.blockLabelsInside} onChange={(e) => onPatch({ blockLabelsInside: e.target.checked })} />
                Row names inside block
              </label>
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label}>First row name</label>
          <input className={field} value={obj.blockStartRow || "A"} onChange={(e) => onPatch({ blockStartRow: e.target.value.toUpperCase() })} />
        </div>
        <div>
          <label className={label}>Reshape</label>
          <select
            className={field}
            value=""
            onChange={(e) => {
              const preset = BLOCK_PRESETS.find((p) => p.id === e.target.value);
              if (!preset) return;
              const shape = preset.build();
              onPatch({ points: shape.points, blockRowMode: shape.rowMode, blockArcCenter: shape.arcCenter });
            }}
          >
            <option value="">Pick a shape…</option>
            {BLOCK_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-2 rounded border border-slate-200 bg-slate-50 space-y-1.5">
        <label className={label}>Fit a block to rows × seats</label>
        <div className="grid grid-cols-3 gap-2 items-end">
          <div>
            <span className="text-[10px] text-slate-500 block">Rows</span>
            <DraftNumberInput aria-label="Rows" className={field} value={gridRows} min={1} max={200} decimals={0} onCommit={setGridRows} />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">Seats / row</span>
            <DraftNumberInput aria-label="Seats per row" className={field} value={gridCols} min={1} max={100} decimals={0} onCommit={setGridCols} />
          </div>
          <button
            type="button"
            onClick={() =>
              onPatch({
                points: rectForGrid(
                  gridRows,
                  gridCols,
                  obj.seatSpacing || 18,
                  obj.rowSpacing || 22,
                  obj.blockInset ?? 10,
                  obj.blockLabelsInside ? blockLabelMetrics(obj, blockSeatSize(obj)).gap + blockLabelMetrics(obj, blockSeatSize(obj)).fs + 2 : 0
                ),
                blockRowMode: "straight",
                blockRowAngle: 0,
              })
            }
            className="px-2 py-1 rounded bg-slate-800 text-white font-bold"
          >
            Apply
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-slate-700">
        <input type="checkbox" checked={obj.showSeatNumbers !== false} onChange={(e) => onPatch({ showSeatNumbers: e.target.checked })} />
        Show seat numbers
      </label>

      <button type="button" onClick={onZoom} className="w-full px-2 py-1.5 rounded bg-slate-800 text-white font-bold hover:bg-slate-700">
        Zoom to this block
      </button>
      <p className="text-[10px] text-slate-500">Drag the red corners to reshape. Click a white dot on an edge to add a corner. Double-click a corner to remove it. Double-click the block to zoom in.</p>
    </div>
  );
}
