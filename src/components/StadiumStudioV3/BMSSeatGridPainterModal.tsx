"use client";
import React, { useState } from "react";
import {
  X,
  Check,
  Star,
  Armchair,
  ShieldAlert,
  Ban,
  ArrowLeftRight,
  Split,
  Tag,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { BMSBlockDef, BMSTierDef } from "./types";

interface BMSSeatGridPainterModalProps {
  isOpen: boolean;
  onClose: () => void;
  block: BMSBlockDef;
  tierIndex: number;
  ticketTypes: Array<{ id: string; name: string; price?: number }>;
  onSaveTier: (updatedTier: BMSTierDef) => void;
}

type PaintTool = "available" | "bestseller" | "accessible" | "blocked" | "exclude";

export default function BMSSeatGridPainterModal({
  isOpen,
  onClose,
  block,
  tierIndex,
  ticketTypes,
  onSaveTier,
}: BMSSeatGridPainterModalProps) {
  const tier = block.tiers[tierIndex] || block.tiers[0];
  if (!isOpen || !tier) return null;

  const [paintMode, setPaintMode] = useState<PaintTool>("bestseller");
  const [rowStart, setRowStart] = useState<string>(tier.row_start || "A");
  const [rowEnd, setRowEnd] = useState<string>(tier.row_end || "J");
  const [seatsPerRow, setSeatsPerRow] = useState<number>(tier.seats_per_row || 20);
  const [bestsellers, setBestsellers] = useState<string[]>(tier.bestseller_seats || []);
  const [accessibles, setAccessibles] = useState<string[]>(tier.accessible_seats || []);
  const [blockeds, setBlockeds] = useState<string[]>(tier.blocked_seats || []);
  const [excluded, setExcluded] = useState<string[]>(tier.excluded_seats || []);
  const [aisles, setAisles] = useState<number[]>(tier.aisle_positions || []);
  const [rowDirection, setRowDirection] = useState<"ltr" | "rtl">(tier.row_direction || "ltr");

  // Calculate row labels
  const startChar = (rowStart || "A").toUpperCase().charCodeAt(0);
  const endChar = (rowEnd || "J").toUpperCase().charCodeAt(0);
  const rowCount = isNaN(startChar) || isNaN(endChar) || endChar < startChar ? 1 : endChar - startChar + 1;
  const rows = Array.from({ length: rowCount }, (_, i) => String.fromCharCode(startChar + i));

  const handleSeatClick = (seatCode: string) => {
    // Remove from all custom sets first
    const removeAll = () => {
      setBestsellers((p) => p.filter((s) => s !== seatCode));
      setAccessibles((p) => p.filter((s) => s !== seatCode));
      setBlockeds((p) => p.filter((s) => s !== seatCode));
      setExcluded((p) => p.filter((s) => s !== seatCode));
    };

    if (paintMode === "available") {
      removeAll();
      return;
    }

    if (paintMode === "bestseller") {
      if (bestsellers.includes(seatCode)) {
        setBestsellers((p) => p.filter((s) => s !== seatCode));
      } else {
        removeAll();
        setBestsellers((p) => [...p, seatCode]);
      }
    } else if (paintMode === "accessible") {
      if (accessibles.includes(seatCode)) {
        setAccessibles((p) => p.filter((s) => s !== seatCode));
      } else {
        removeAll();
        setAccessibles((p) => [...p, seatCode]);
      }
    } else if (paintMode === "blocked") {
      if (blockeds.includes(seatCode)) {
        setBlockeds((p) => p.filter((s) => s !== seatCode));
      } else {
        removeAll();
        setBlockeds((p) => [...p, seatCode]);
      }
    } else if (paintMode === "exclude") {
      if (excluded.includes(seatCode)) {
        setExcluded((p) => p.filter((s) => s !== seatCode));
      } else {
        removeAll();
        setExcluded((p) => [...p, seatCode]);
      }
    }
  };

  const toggleAisleGap = (colIndex: number) => {
    if (aisles.includes(colIndex)) {
      setAisles((p) => p.filter((c) => c !== colIndex));
    } else {
      setAisles((p) => [...p, colIndex]);
    }
  };

  const handleApply = () => {
    onSaveTier({
      ...tier,
      row_start: rowStart,
      row_end: rowEnd,
      seats_per_row: seatsPerRow,
      bestseller_seats: bestsellers,
      accessible_seats: accessibles,
      blocked_seats: blockeds,
      excluded_seats: excluded,
      aisle_positions: aisles,
      row_direction: rowDirection,
    });
    toast.success(`Updated ${tier.name} seat grid!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md uppercase">
                BMS Grid Painter
              </span>
              <h3 className="text-base font-bold text-white">
                {block.name} · {tier.name}
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Paint prime bestseller seats, wheelchair accessible spots, and pillar obstructions.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Paint Tools */}
        <div className="px-6 py-2.5 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Active Paint Brush:
            </span>
            <button
              type="button"
              onClick={() => setPaintMode("bestseller")}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                paintMode === "bestseller"
                  ? "bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400/30"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              <Star className="w-3.5 h-3.5 text-amber-900 fill-amber-900" />
              <span>Bestseller / Prime Seat</span>
            </button>

            <button
              type="button"
              onClick={() => setPaintMode("accessible")}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                paintMode === "accessible"
                  ? "bg-purple-500 text-white shadow-md ring-2 ring-purple-400/30"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              <Armchair className="w-3.5 h-3.5 text-purple-200" />
              <span>Wheelchair / Accessible</span>
            </button>

            <button
              type="button"
              onClick={() => setPaintMode("blocked")}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                paintMode === "blocked"
                  ? "bg-rose-500 text-white shadow-md ring-2 ring-rose-400/30"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-200" />
              <span>Obstructed / Camera Pillar</span>
            </button>

            <button
              type="button"
              onClick={() => setPaintMode("exclude")}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                paintMode === "exclude"
                  ? "bg-slate-600 text-white shadow-md ring-2 ring-slate-400/30"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              <Ban className="w-3.5 h-3.5 text-slate-300" />
              <span>No Seat / Empty Space</span>
            </button>

            <button
              type="button"
              onClick={() => setPaintMode("available")}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                paintMode === "available"
                  ? "bg-emerald-500 text-slate-950 shadow-md ring-2 ring-emerald-400/30"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              <Check className="w-3.5 h-3.5 text-emerald-950" />
              <span>Clear / Standard</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRowDirection((d) => (d === "ltr" ? "rtl" : "ltr"))}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold flex items-center gap-1"
              title="Toggle Row Numbering: Left-to-Right vs Right-to-Left"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />
              <span>Direction: {rowDirection.toUpperCase()}</span>
            </button>
          </div>
        </div>

        {/* Interactive Matrix Display */}
        <div className="flex-1 overflow-auto p-6 bg-slate-950/80">
          <div className="inline-block min-w-full">
            {/* Column Aisle Insertion Toggles */}
            <div className="flex items-center mb-2 pl-12 gap-1.5">
              {Array.from({ length: seatsPerRow }).map((_, cIdx) => {
                const colNum = rowDirection === "ltr" ? cIdx + 1 : seatsPerRow - cIdx;
                const hasAisleAfter = aisles.includes(cIdx + 1);

                return (
                  <React.Fragment key={`col-hdr-${cIdx}`}>
                    <div className="w-7 text-center">
                      <button
                        type="button"
                        onClick={() => toggleAisleGap(cIdx + 1)}
                        className={`text-[9px] font-mono px-1 py-0.5 rounded transition-colors ${
                          hasAisleAfter
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold"
                            : "text-slate-500 hover:text-slate-300"
                        }`}
                        title="Click to toggle aisle stairs gap after this column"
                      >
                        {colNum}
                      </button>
                    </div>
                    {hasAisleAfter && (
                      <div className="w-6 flex items-center justify-center">
                        <span className="text-[8px] text-amber-400 font-bold tracking-tighter">
                          STAIRS
                        </span>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Rows & Seat Circles */}
            <div className="space-y-1.5">
              {rows.map((rowLabel) => (
                <div key={rowLabel} className="flex items-center gap-1.5">
                  {/* Row Label */}
                  <span className="w-10 text-right font-mono font-bold text-amber-400 text-xs pr-2 select-none">
                    Row {rowLabel}
                  </span>

                  {/* Seat Grid */}
                  {Array.from({ length: seatsPerRow }).map((_, cIdx) => {
                    const colNum = rowDirection === "ltr" ? cIdx + 1 : seatsPerRow - cIdx;
                    const seatCode = `${rowLabel}-${colNum}`;
                    const isBestseller = bestsellers.includes(seatCode);
                    const isAccessible = accessibles.includes(seatCode);
                    const isBlocked = blockeds.includes(seatCode);
                    const isExcluded = excluded.includes(seatCode);
                    const hasAisleAfter = aisles.includes(cIdx + 1);

                    return (
                      <React.Fragment key={seatCode}>
                        <button
                          type="button"
                          onClick={() => handleSeatClick(seatCode)}
                          className={`w-7 h-7 rounded-lg text-[9px] font-mono font-bold flex items-center justify-center transition-all ${
                            isExcluded
                              ? "opacity-15 border border-dashed border-slate-700 bg-transparent text-transparent hover:opacity-50"
                              : isBlocked
                              ? "bg-rose-500/30 text-rose-300 border border-rose-500 shadow-sm"
                              : isAccessible
                              ? "bg-purple-600 text-white border border-purple-400 shadow-sm"
                              : isBestseller
                              ? "bg-amber-500 text-slate-950 font-black border border-amber-300 ring-2 ring-amber-400/40 shadow-sm"
                              : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                          }`}
                          title={`Seat ${seatCode} ${
                            isBestseller
                              ? "(Bestseller Prime)"
                              : isAccessible
                              ? "(Wheelchair)"
                              : isBlocked
                              ? "(Obstructed)"
                              : ""
                          }`}
                        >
                          {isExcluded ? "" : isAccessible ? "♿" : isBestseller ? "★" : isBlocked ? "🚫" : colNum}
                        </button>

                        {/* Aisle Stairs Gap */}
                        {hasAisleAfter && (
                          <div className="w-6 h-7 border-l-2 border-r-2 border-dashed border-slate-800 flex items-center justify-center">
                            <span className="w-1 h-3 bg-slate-800 rounded-full" />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-500 inline-block" /> {bestsellers.length} Prime Bestsellers
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-purple-600 inline-block" /> {accessibles.length} Wheelchair Accessible
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-rose-500 inline-block" /> {blockeds.length} Obstructed Seats
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 border border-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg"
            >
              Save Grid Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
