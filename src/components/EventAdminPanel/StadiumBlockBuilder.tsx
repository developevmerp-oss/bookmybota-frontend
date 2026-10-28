"use client";
/**
 * StadiumBlockBuilder
 * --------------------
 * Visual drag-and-drop admin tool for defining a stadium seating_config JSONB.
 * Features:
 * 1. EDITABLE PITCH SECTION:
 *    - Click pitch or click "Edit Pitch" to select
 *    - Drag to reposition anywhere on canvas (X, Y)
 *    - Resize via transformer handles or numerical controls (Width, Height)
 *    - Rotate pitch with rotation handle or slider
 *    - Quick action buttons: "Center Pitch", "Reset Size", "Rotate 90°"
 * 2. Complete 6 Sport Ground Visuals (Football, Cricket, Basketball, Tennis, Concert, Custom)
 * 3. Add Custom Elements (Stage, Giant Screen, Gates, Dugouts, VIP Lounges, Food, Custom Labels)
 * 4. Drop stands and tiers with real-time Organizer capacity validation
 * 5. Interactive cursor wheel zoom & pan, high-contrast UI, permanently visible footer.
 */
import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Stage, Layer, Rect, Text, Group, Transformer, Circle, Line, Ellipse, Arc } from "react-konva";
import Konva from "konva";
import {
  Plus,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp,
  Grid3X3,
  Loader2,
  Check,
  AlertCircle,
  Zap,
  Sparkles,
  ExternalLink,
  Wand2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Maximize2,
  X,
  RefreshCw,
  ShieldAlert,
  Sliders,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  Layers,
  Palette,
  Tv,
  Mic,
  DoorOpen,
  Coffee,
  Armchair,
  Tag,
  Square,
  Settings2,
  Crosshair,
  Ticket,
  Eye,
  Send,
  ArrowLeft,
  ShoppingBag,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useGenerateStadiumSeatsMutation } from "@/services/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StadiumTierDef {
  id: string;
  name: string;
  color?: string;
  ticket_type_id: string;
  row_start: string;
  row_end: string;
  seats_per_row: number;
  price?: number;
  row_seat_overrides?: Record<string, number>;
  row_gaps?: string[];
  excluded_seats?: string[];
}

export interface StadiumBlockDef {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  capacity: number;
  price?: number;
  shape?: "rectangle" | "pill" | "curved" | "oval" | "arc";
  corner_radius?: number;
  // Radial / Arc Stadium Properties (for 360° Circular Stadiums like ACA Stadium Guwahati)
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  sweepAngle?: number;
  stadiumCenterX?: number;
  stadiumCenterY?: number;
  // Admission Type: "seated" (Numbered seats) vs "standing" (General admission / Standing pass / VIP Fan Pit)
  stand_type?: "seated" | "standing";
  // Dynamic Structure: "direct" (Single-Level Direct Seats) vs "tiered" (Multi-Tier Stand)
  seating_type?: "direct" | "tiered";
  ticket_type_id?: string;
  row_start?: string;
  row_end?: string;
  seats_per_row?: number;
  row_seat_overrides?: Record<string, number>;
  row_gaps?: string[];
  excluded_seats?: string[];
  tier_split_direction?: "vertical" | "horizontal";
  tier_order_reversed?: boolean;
  stand_level?: "lower" | "upper" | "multi";
  tiers: StadiumTierDef[];
}

export interface StadiumElementDef {
  id: string;
  name: string;
  type: "stage" | "screen" | "gate" | "dugout" | "lounge" | "amenity" | "text" | "custom";
  icon?: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  shape?: "rectangle" | "circle";
}

export interface StadiumGroundConfig {
  enabled?: boolean;
  sport_type: "football" | "cricket" | "basketball" | "tennis" | "concert" | "festival_t_stage" | "custom";
  pitch_label: string;
  stage_label?: string;
  catwalk_label?: string;
  turf_color: string;
  track_color?: string;
  shape?: "rectangle" | "oval" | "capsule";
  corner_radius?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
}

export interface StadiumSeatingConfigOutput {
  layout_mode: "stadium";
  canvasWidth: number;
  canvasHeight: number;
  stadium_name: string;
  pitch_label: string;
  ground?: StadiumGroundConfig;
  blocks: StadiumBlockDef[];
  elements?: StadiumElementDef[];
}

const CANVAS_W = 1600;
const CANVAS_H = 1200;
const PITCH_X = CANVAS_W * 0.22;
const PITCH_Y = CANVAS_H * 0.22;
const PITCH_W = CANVAS_W * 0.56;
const PITCH_H = CANVAS_H * 0.56;

const BLOCK_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f97316",
  "#a855f7",
  "#f59e0b",
  "#06b6d4",
  "#ec4899",
  "#ef4444",
  "#84cc16",
  "#6366f1",
];

const PRESET_BLOCKS: Omit<StadiumBlockDef, "tiers">[] = [
  {
    id: "north-stand",
    name: "North Stand",
    color: "#22c55e",
    x: PITCH_X,
    y: 40,
    width: PITCH_W,
    height: 140,
    rotation: 0,
    capacity: 5000,
    price: 700,
  },
  {
    id: "south-stand",
    name: "South Stand",
    color: "#f97316",
    x: PITCH_X,
    y: CANVAS_H - 180,
    width: PITCH_W,
    height: 140,
    rotation: 0,
    capacity: 5000,
    price: 700,
  },
  {
    id: "east-stand",
    name: "East Stand",
    color: "#3b82f6",
    x: CANVAS_W - 180,
    y: PITCH_Y,
    width: 140,
    height: PITCH_H,
    rotation: 0,
    capacity: 4000,
    price: 1200,
  },
  {
    id: "west-stand",
    name: "West Stand",
    color: "#a855f7",
    x: 40,
    y: PITCH_Y,
    width: 140,
    height: PITCH_H,
    rotation: 0,
    capacity: 4000,
    price: 1200,
  },
  {
    id: "vip-box",
    name: "VIP Box",
    color: "#f59e0b",
    x: PITCH_X + PITCH_W * 0.35,
    y: 190,
    width: PITCH_W * 0.3,
    height: 60,
    rotation: 0,
    capacity: 500,
    price: 2500,
  },
];

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

const ROW_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// Tier colour palette – cycles when multiple tiers are added
const TIER_COLORS = [
  "#f59e0b", // amber
  "#3b82f6", // blue
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#ef4444", // red
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
];

let _tierColorIdx = 0;

function defaultTier(): StadiumTierDef {
  const color = TIER_COLORS[_tierColorIdx % TIER_COLORS.length];
  _tierColorIdx++;
  return {
    id: makeId(),
    name: "General Tier",
    color,
    ticket_type_id: "",
    row_start: "A",
    row_end: "E",
    seats_per_row: 14,
    price: 500,
  };
}

export function autoFitRowsAndSeats(targetSeats: number): {
  rowStart: string;
  rowEnd: string;
  seatsPerRow: number;
} {
  if (!targetSeats || targetSeats <= 0) {
    return { rowStart: "A", rowEnd: "J", seatsPerRow: 20 };
  }

  let bestRows = 10;
  let bestSeatsPerRow = Math.round(targetSeats / bestRows);

  for (let r = 8; r <= 20; r++) {
    if (targetSeats % r === 0) {
      bestRows = r;
      bestSeatsPerRow = targetSeats / r;
      break;
    }
  }

  if (bestSeatsPerRow > 60) {
    bestRows = Math.min(26, Math.ceil(targetSeats / 50));
    bestSeatsPerRow = Math.round(targetSeats / bestRows);
  }

  const actualRows = Math.min(bestRows, 26);
  return {
    rowStart: "A",
    rowEnd: ROW_LETTERS[actualRows - 1] || "Z",
    seatsPerRow: Math.max(1, Math.round(targetSeats / actualRows)),
  };
}

export function computeTierSeatCount(tier: {
  row_start?: string;
  row_end?: string;
  seats_per_row?: number;
  row_seat_overrides?: Record<string, number>;
  excluded_seats?: string[];
}): number {
  const start = (tier.row_start || "A").toUpperCase().charCodeAt(0);
  const end = (tier.row_end || "A").toUpperCase().charCodeAt(0);
  if (isNaN(start) || isNaN(end) || end < start) return 0;
  const baseSpr = Math.max(1, tier.seats_per_row || 20);
  const overrides = tier.row_seat_overrides || {};
  const excluded = new Set(tier.excluded_seats || []);

  let total = 0;
  for (let c = start; c <= end; c++) {
    const rowLetter = String.fromCharCode(c);
    const rowSeats = overrides[rowLetter] != null ? Math.max(1, overrides[rowLetter]) : baseSpr;
    for (let s = 1; s <= rowSeats; s++) {
      if (!excluded.has(`${rowLetter}-${s}`) && !excluded.has(`${rowLetter}${s}`)) {
        total++;
      }
    }
  }
  return total;
}

export function computeBlockSeatCount(block: StadiumBlockDef): number {
  if (block.stand_type === "standing") {
    return Number(block.capacity) || 0;
  }
  const isDirect = block.seating_type === "direct" || !Array.isArray(block.tiers) || block.tiers.length <= 1;
  if (isDirect) {
    if (block.row_start && block.row_end) {
      return computeTierSeatCount(block as any);
    }
    if (block.tiers && block.tiers.length > 0) {
      return computeTierSeatCount(block.tiers[0]);
    }
    return Number(block.capacity) || 0;
  }
  return block.tiers.reduce((acc, t) => acc + computeTierSeatCount(t), 0);
}

/**
 * calculateOptimalBlockDimensions
 * --------------------------------
 * Dynamically calculates proportional width & height (or radial depth & sweep angle)
 * for a stand based on its seat capacity, row count, and seats-per-row.
 * If a block has 50 seats, it auto-sizes compactly (~180x75px).
 * If a block has 500+ seats, it scales proportionally up to pitch dimensions.
 */
export function calculateOptimalBlockDimensions(
  block: StadiumBlockDef,
  pitchW = CANVAS_W * 0.56,
  pitchH = CANVAS_H * 0.56
): {
  width: number;
  height: number;
  innerRadius?: number;
  outerRadius?: number;
  sweepAngle?: number;
} {
  const isDirect = block.seating_type === "direct" || !Array.isArray(block.tiers) || block.tiers.length <= 1;
  let rowCount = 0;
  let maxSeatsPerRow = 20;

  if (isDirect) {
    const start = (block.row_start || block.tiers?.[0]?.row_start || "A").charCodeAt(0);
    const end = (block.row_end || block.tiers?.[0]?.row_end || "J").charCodeAt(0);
    rowCount = Math.max(1, end - start + 1);
    maxSeatsPerRow = Math.max(1, block.seats_per_row || block.tiers?.[0]?.seats_per_row || 20);
    if (block.row_seat_overrides) {
      const overrideVals = Object.values(block.row_seat_overrides);
      if (overrideVals.length > 0) {
        maxSeatsPerRow = Math.max(...overrideVals, maxSeatsPerRow);
      }
    }
  } else {
    rowCount = (block.tiers || []).reduce((acc, t) => {
      const s = (t.row_start || "A").charCodeAt(0);
      const e = (t.row_end || "J").charCodeAt(0);
      return acc + Math.max(1, e - s + 1);
    }, 0);
    maxSeatsPerRow = Math.max(
      ...((block.tiers || []).map((t) => {
        let maxSpr = t.seats_per_row || 20;
        if (t.row_seat_overrides) {
          const ovs = Object.values(t.row_seat_overrides);
          if (ovs.length > 0) maxSpr = Math.max(...ovs, maxSpr);
        }
        return maxSpr;
      })),
      10
    );
  }

  // If Arc Stand (Radial ring arc)
  if (block.shape === "arc") {
    const radialDepth = Math.max(50, Math.min(240, 40 + rowCount * 8));
    const inR = block.innerRadius || 260;
    const outR = inR + radialDepth;
    const sweepA = Math.max(15, Math.min(85, Math.round(maxSeatsPerRow * 1.8)));
    return {
      width: outR * 2,
      height: outR * 2,
      innerRadius: inR,
      outerRadius: outR,
      sweepAngle: sweepA,
    };
  }

  // Rectangular / pill / curved / oval stand
  const isHorizontal = block.width >= block.height;

  if (isHorizontal) {
    // Horizontal stand (North/South): width follows seatsPerRow, height follows rowCount
    const autoW = Math.max(110, Math.min(pitchW, Math.round(maxSeatsPerRow * 14 + 50)));
    const autoH = Math.max(50, Math.min(250, Math.round(rowCount * 11 + 30)));
    return { width: autoW, height: autoH };
  } else {
    // Vertical stand (East/West): height follows seatsPerRow, width follows rowCount
    const autoH = Math.max(110, Math.min(pitchH, Math.round(maxSeatsPerRow * 14 + 50)));
    const autoW = Math.max(50, Math.min(250, Math.round(rowCount * 11 + 30)));
    return { width: autoW, height: autoH };
  }
}

// ─── Interactive Row, Aisle & Seat Customizer Modal ──────────────────────────

interface RowSeatCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  color?: string;
  rowStart: string;
  rowEnd: string;
  baseSeatsPerRow: number;
  initialOverrides?: Record<string, number>;
  initialGaps?: string[];
  initialExcluded?: string[];
  onApply: (data: {
    rowSeatOverrides: Record<string, number>;
    rowGaps: string[];
    excludedSeats: string[];
  }) => void;
}

function RowSeatCustomizerModal({
  isOpen,
  onClose,
  title,
  subtitle,
  color = "#f59e0b",
  rowStart,
  rowEnd,
  baseSeatsPerRow,
  initialOverrides,
  initialGaps,
  initialExcluded,
  onApply,
}: RowSeatCustomizerModalProps) {
  const [overrides, setOverrides] = useState<Record<string, number>>(() => initialOverrides || {});
  const [gaps, setGaps] = useState<string[]>(() => initialGaps || []);
  const [excluded, setExcluded] = useState<string[]>(() => initialExcluded || []);

  useEffect(() => {
    if (isOpen) {
      setOverrides(initialOverrides || {});
      setGaps(initialGaps || []);
      setExcluded(initialExcluded || []);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const startCharCode = (rowStart || "A").toUpperCase().charCodeAt(0);
  const endCharCode = (rowEnd || "A").toUpperCase().charCodeAt(0);
  const rows: string[] = [];
  if (!isNaN(startCharCode) && !isNaN(endCharCode) && endCharCode >= startCharCode) {
    for (let c = startCharCode; c <= endCharCode; c++) {
      rows.push(String.fromCharCode(c));
    }
  }

  const excludedSet = new Set(excluded);

  const getRowSeats = (row: string) => {
    return overrides[row] != null ? Math.max(1, overrides[row]) : Math.max(1, baseSeatsPerRow || 20);
  };

  const setRowSeats = (row: string, count: number) => {
    const val = Math.max(1, Math.min(150, count));
    setOverrides((prev) => ({ ...prev, [row]: val }));
  };

  const toggleGap = (row: string) => {
    setGaps((prev) =>
      prev.includes(row) ? prev.filter((r) => r !== row) : [...prev, row]
    );
  };

  const toggleSeat = (row: string, seatNum: number) => {
    const key1 = `${row}-${seatNum}`;
    const key2 = `${row}${seatNum}`;
    setExcluded((prev) => {
      if (prev.includes(key1) || prev.includes(key2)) {
        return prev.filter((k) => k !== key1 && k !== key2);
      } else {
        return [...prev, key1];
      }
    });
  };

  // Quick helper: Taper stand rows (+1, +2 per row from front to back)
  const quickTaper = (step: number) => {
    const newOverrides: Record<string, number> = {};
    rows.forEach((r, idx) => {
      newOverrides[r] = Math.max(1, baseSeatsPerRow + idx * step);
    });
    setOverrides(newOverrides);
    toast.success(`Applied ${step > 0 ? `+${step}` : step} seats/row taper across ${rows.length} rows!`);
  };

  const resetOverrides = () => {
    setOverrides({});
    toast.info("Reset all rows to base capacity.");
  };

  const clearExcluded = () => {
    setExcluded([]);
    toast.success("Restored all voided seats!");
  };

  // Live total calculations
  let totalActiveSeats = 0;
  let totalExcludedCount = 0;
  rows.forEach((r) => {
    const spr = getRowSeats(r);
    for (let s = 1; s <= spr; s++) {
      if (excludedSet.has(`${r}-${s}`) || excludedSet.has(`${r}${s}`)) {
        totalExcludedCount++;
      } else {
        totalActiveSeats++;
      }
    }
  });

  const handleSave = () => {
    onApply({
      rowSeatOverrides: overrides,
      rowGaps: gaps,
      excludedSeats: excluded,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 select-none animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-white">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-4 h-4 rounded-full ring-2 ring-white/30 shrink-0"
              style={{ backgroundColor: color }}
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-white truncate">{title}</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Fully Dynamic Layout
                </span>
              </div>
              {subtitle && (
                <p className="text-xs text-slate-400 truncate mt-0.5 font-medium">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                🟢 {totalActiveSeats.toLocaleString()} Active Seats
              </span>
              {totalExcludedCount > 0 && (
                <span className="text-xs font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                  ✕ {totalExcludedCount} Voided
                </span>
              )}
              {gaps.length > 0 && (
                <span className="text-xs font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2.5 py-1 rounded-lg">
                  🚶 {gaps.length} Aisles
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close without applying"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Toolbar */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold text-[11px] mr-1">Quick Tools:</span>
            <button
              type="button"
              onClick={() => quickTaper(1)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-medium text-[11px] transition-all active:scale-95"
              title="Add 1 seat progressively on each row from front to back"
            >
              📐 Taper Stand (+1 / Row)
            </button>
            <button
              type="button"
              onClick={() => quickTaper(2)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-medium text-[11px] transition-all active:scale-95"
              title="Add 2 seats progressively on each row"
            >
              📐 Taper Stand (+2 / Row)
            </button>
            <button
              type="button"
              onClick={resetOverrides}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-medium text-[11px] transition-all active:scale-95"
            >
              🔄 Equalize All Rows
            </button>
            {totalExcludedCount > 0 && (
              <button
                type="button"
                onClick={clearExcluded}
                className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-medium text-[11px] transition-all active:scale-95"
              >
                🧹 Restore All Voided Seats
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
            <span>💡 Click any seat to void for pillars/exits</span>
          </div>
        </div>

        {/* Scrollable Rows Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3 bg-slate-950/40">
          {rows.map((rowLetter, rIdx) => {
            const rowSeats = getRowSeats(rowLetter);
            const isGapAfter = gaps.includes(rowLetter);
            const isLastRow = rIdx === rows.length - 1;

            return (
              <div key={rowLetter} className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800/90 hover:border-slate-700 transition-colors">
                  {/* Left: Row Stepper */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-14 text-center py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-extrabold text-amber-400">
                      Row {rowLetter}
                    </span>

                    <div className="flex items-center gap-1 bg-slate-950 rounded-lg p-1 border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setRowSeats(rowLetter, rowSeats - 1)}
                        className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-xs transition-colors active:scale-95"
                        title="Decrease seat count for this row"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={150}
                        value={rowSeats}
                        onChange={(e) => setRowSeats(rowLetter, parseInt(e.target.value) || 1)}
                        className="w-12 text-center text-xs font-mono font-bold bg-transparent text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setRowSeats(rowLetter, rowSeats + 1)}
                        className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-xs transition-colors active:scale-95"
                        title="Increase seat count for this row"
                      >
                        +
                      </button>
                    </div>

                    <span className="text-[10px] text-slate-400 font-mono">
                      {rowSeats} seats
                    </span>
                  </div>

                  {/* Right: Seat Chips Grid */}
                  <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-0 pt-1 sm:pt-0">
                    {Array.from({ length: rowSeats }, (_, sIdx) => {
                      const seatNum = sIdx + 1;
                      const isVoided =
                        excludedSet.has(`${rowLetter}-${seatNum}`) ||
                        excludedSet.has(`${rowLetter}${seatNum}`);

                      return (
                        <button
                          key={seatNum}
                          type="button"
                          onClick={() => toggleSeat(rowLetter, seatNum)}
                          title={
                            isVoided
                              ? `Seat ${rowLetter}-${seatNum} is VOIDED (Click to restore)`
                              : `Seat ${rowLetter}-${seatNum} is ACTIVE (Click to delete/void for pillar/stairs)`
                          }
                          className={`w-7 h-7 rounded-lg text-[9px] font-mono font-extrabold flex items-center justify-center transition-all select-none ${
                            isVoided
                              ? "border border-dashed border-rose-500/60 bg-rose-950/30 text-rose-400 opacity-60 hover:opacity-100 hover:scale-105"
                              : "border shadow-sm hover:scale-110 active:scale-95 text-slate-950"
                          }`}
                          style={{
                            backgroundColor: isVoided ? undefined : color,
                            borderColor: isVoided ? undefined : "rgba(255,255,255,0.4)",
                          }}
                        >
                          {isVoided ? "✕" : seatNum}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Walkway Aisle Gap Divider between rows */}
                {!isLastRow && (
                  <div className="relative py-1 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className={`w-full border-t ${isGapAfter ? "border-amber-400/50 border-dashed" : "border-slate-800 border-dashed"}`} />
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleGap(rowLetter)}
                      className={`relative z-10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-sm ${
                        isGapAfter
                          ? "bg-amber-500 text-slate-950 ring-2 ring-amber-400/30 font-extrabold"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700"
                      }`}
                    >
                      <span>🚶</span>
                      <span>{isGapAfter ? `Walkway Aisle after Row ${rowLetter} (Click to remove)` : `+ Add Walkway Aisle Gap after Row ${rowLetter}`}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400">
            Configuring <strong className="text-white">{rows.length} rows</strong> · <strong className="text-emerald-400">{totalActiveSeats} active seats</strong>
            {totalExcludedCount > 0 && <span> · <strong className="text-rose-400">{totalExcludedCount} voided</strong></span>}
            {gaps.length > 0 && <span> · <strong className="text-sky-400">{gaps.length} walkway aisles</strong></span>}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-extrabold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 transition-all shadow-md active:scale-95"
            >
              Apply Custom Rows & Seats
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tier Editor ─────────────────────────────────────────────────────────────

function TierEditor({
  tier,
  ticketTypes,
  onChange,
  onDelete,
}: {
  tier: StadiumTierDef;
  ticketTypes: any[];
  onChange: (updated: StadiumTierDef) => void;
  onDelete: () => void;
}) {
  const [showCustomizer, setShowCustomizer] = useState(false);
  const rowCount = Math.max(
    0,
    tier.row_end.charCodeAt(0) - tier.row_start.charCodeAt(0) + 1
  );
  const tierSeatTotal = computeTierSeatCount(tier);

  const matchedTicket = ticketTypes.find((tt) => tt.id === tier.ticket_type_id);
  const targetCapacity = matchedTicket ? Number(matchedTicket.total_count) || 0 : null;

  const handleAutoFit = () => {
    if (!targetCapacity || targetCapacity <= 0) return;
    const fitted = autoFitRowsAndSeats(targetCapacity);
    onChange({
      ...tier,
      row_start: fitted.rowStart,
      row_end: fitted.rowEnd,
      seats_per_row: fitted.seatsPerRow,
    });
    toast.success(
      `Auto-fitted to ${targetCapacity} seats (${fitted.rowStart}–${fitted.rowEnd} × ${fitted.seatsPerRow})`
    );
  };

  const tierColor = tier.color || "#f59e0b";

  return (
    <div
      className="rounded-xl border bg-white p-3 space-y-2.5 shadow-sm text-slate-900"
      style={{ borderColor: `${tierColor}55` }}
    >
      {/* Tier Header: colour swatch + name + colour picker + delete */}
      <div className="flex items-center justify-between gap-2 border-b pb-2" style={{ borderColor: `${tierColor}30` }}>
        {/* Left: colour dot + name input */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Colour swatch that opens the hidden colour input */}
          <label
            className="w-5 h-5 rounded-md flex-shrink-0 cursor-pointer ring-1 ring-slate-300 shadow-sm hover:ring-2 hover:ring-offset-1 transition-all"
            style={{ backgroundColor: tierColor }}
            title="Tier Colour"
          >
            <input
              type="color"
              className="sr-only"
              value={tierColor}
              onChange={(e) => onChange({ ...tier, color: e.target.value })}
            />
          </label>
          <input
            className="text-xs font-bold bg-slate-50 border border-slate-300 focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-400/20 text-slate-900 px-2.5 py-1 rounded-lg flex-1 shadow-inner transition-all"
            value={tier.name}
            onChange={(e) => onChange({ ...tier, name: e.target.value })}
            placeholder="Tier Name (e.g. Ground Floor)"
          />
        </div>
        {/* Right: quick colour presets dropdown trigger + delete */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Quick colour chips */}
          <div className="flex gap-1">
            {TIER_COLORS.slice(0, 4).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange({ ...tier, color: c })}
                className={`w-4 h-4 rounded-full border transition-transform hover:scale-110 ${
                  tierColor === c ? "ring-2 ring-offset-1 ring-slate-500 scale-110" : "border-slate-300"
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onDelete}
            className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded hover:bg-slate-100 ml-1"
            title="Delete Tier"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Ticket Type Assignment */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] uppercase font-extrabold text-slate-600 tracking-wider">
            Organizer Ticket Type
          </label>
          {matchedTicket && targetCapacity !== null && (
            <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              Target: {targetCapacity.toLocaleString()} seats
            </span>
          )}
        </div>
        <select
          className={`w-full text-xs font-semibold bg-white border rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20 shadow-sm transition-all ${
            !tier.ticket_type_id
              ? "border-rose-400 bg-rose-50/50 text-rose-800"
              : "border-slate-300"
          }`}
          value={tier.ticket_type_id}
          onChange={(e) => onChange({ ...tier, ticket_type_id: e.target.value })}
        >
          <option value="">-- Choose Organizer Ticket Type --</option>
          {ticketTypes.map((tt: any) => (
            <option key={tt.id} value={tt.id}>
              {tt.name || tt.ticket_type || "Ticket"} · Capacity: {tt.total_count || 0}
              {tt.price != null ? ` · ETB ${tt.price}` : ""}
            </option>
          ))}
        </select>
        {!tier.ticket_type_id && (
          <p className="text-[10px] text-rose-600 font-bold mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Ticket type required for buyer bookings
          </p>
        )}
      </div>

      {/* Row Configuration Grid */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200">
          <label className="text-[9px] uppercase font-extrabold text-slate-500 block mb-0.5">
            Start Row
          </label>
          <select
            className="w-full text-xs font-bold bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-900 focus:outline-none focus:border-amber-500 shadow-sm"
            value={tier.row_start}
            onChange={(e) => onChange({ ...tier, row_start: e.target.value })}
          >
            {ROW_LETTERS.map((r) => (
              <option key={r} value={r}>
                Row {r}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200">
          <label className="text-[9px] uppercase font-extrabold text-slate-500 block mb-0.5">
            End Row
          </label>
          <select
            className="w-full text-xs font-bold bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-900 focus:outline-none focus:border-amber-500 shadow-sm"
            value={tier.row_end}
            onChange={(e) => onChange({ ...tier, row_end: e.target.value })}
          >
            {ROW_LETTERS.map((r) => (
              <option key={r} value={r}>
                Row {r}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200">
          <label className="text-[9px] uppercase font-extrabold text-slate-500 block mb-0.5">
            Seats / Row
          </label>
          <input
            type="number"
            min={1}
            max={150}
            className="w-full text-xs font-bold bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-900 focus:outline-none focus:border-amber-500 shadow-sm"
            value={tier.seats_per_row}
            onChange={(e) =>
              onChange({ ...tier, seats_per_row: parseInt(e.target.value) || 1 })
            }
          />
        </div>
      </div>

      {/* Calculation & Match Banner */}
      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-600 font-medium">
            {rowCount} rows ({tier.row_start}–{tier.row_end}) × {tier.seats_per_row} seats:
          </span>
          <strong className="text-amber-700 font-mono text-xs font-extrabold">
            {tierSeatTotal.toLocaleString()} seats
          </strong>
        </div>

        {matchedTicket && targetCapacity !== null && (
          <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between text-[11px]">
            <span className="text-slate-600">
              Target: <strong className="text-slate-900 font-mono font-bold">{targetCapacity}</strong>
            </span>

            {tierSeatTotal === targetCapacity ? (
              <span className="text-[10px] text-emerald-800 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 100% Matched
              </span>
            ) : tierSeatTotal < targetCapacity ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-amber-700 font-bold">
                  -{targetCapacity - tierSeatTotal} short
                </span>
                <button
                  type="button"
                  onClick={handleAutoFit}
                  className="text-[10px] text-slate-900 bg-amber-300 hover:bg-amber-400 font-bold px-2 py-0.5 rounded transition-all active:scale-95 shadow-sm"
                >
                  Auto-Fit
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-rose-700 font-bold">
                  +{tierSeatTotal - targetCapacity} over
                </span>
                <button
                  type="button"
                  onClick={handleAutoFit}
                  className="text-[10px] text-white bg-rose-600 hover:bg-rose-500 font-bold px-2 py-0.5 rounded transition-all active:scale-95 shadow-sm"
                >
                  Auto-Fit
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dynamic Row, Aisle & Seat Customizer Button */}
      <button
        type="button"
        onClick={() => setShowCustomizer(true)}
        className="w-full mt-2 flex items-center justify-between text-xs font-bold text-slate-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 py-2 px-3 rounded-xl transition-all shadow-sm active:scale-95"
      >
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-amber-600" />
          <span>Customise Rows, Aisles & Seats</span>
        </div>
        <span className="text-[10px] font-mono bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md font-bold">
          {tierSeatTotal.toLocaleString()} seats
        </span>
      </button>

      <RowSeatCustomizerModal
        isOpen={showCustomizer}
        onClose={() => setShowCustomizer(false)}
        title={`Customise ${tier.name}`}
        subtitle={`Rows ${tier.row_start}–${tier.row_end} · Base ${tier.seats_per_row} seats/row`}
        color={tierColor}
        rowStart={tier.row_start}
        rowEnd={tier.row_end}
        baseSeatsPerRow={tier.seats_per_row}
        initialOverrides={tier.row_seat_overrides}
        initialGaps={tier.row_gaps}
        initialExcluded={tier.excluded_seats}
        onApply={({ rowSeatOverrides, rowGaps, excludedSeats }) => {
          onChange({
            ...tier,
            row_seat_overrides: rowSeatOverrides,
            row_gaps: rowGaps,
            excluded_seats: excludedSeats,
          });
        }}
      />
    </div>
  );
}

// ─── Stand Panel ─────────────────────────────────────────────────────────────

function BlockPanel({
  block,
  isSelected,
  ticketTypes,
  pitchW = CANVAS_W * 0.56,
  pitchH = CANVAS_H * 0.56,
  onUpdate,
  onDelete,
  onSelect,
  onDuplicateAsUpperTier,
}: {
  block: StadiumBlockDef;
  isSelected: boolean;
  ticketTypes: any[];
  pitchW?: number;
  pitchH?: number;
  onUpdate: (b: StadiumBlockDef) => void;
  onDelete: () => void;
  onSelect: () => void;
  onDuplicateAsUpperTier?: (b: StadiumBlockDef) => void;
}) {
  const [open, setOpen] = useState(true);
  const [showDirectCustomizer, setShowDirectCustomizer] = useState(false);

  const isStanding = block.stand_type === "standing";
  const isDirect = (block.seating_type || (block.tiers.length <= 1 ? "direct" : "tiered")) === "direct";
  const totalSeats = computeBlockSeatCount(block);

  const directTicketId = block.ticket_type_id || block.tiers[0]?.ticket_type_id || "";
  const matchedDirectTicket = ticketTypes.find((tt) => tt.id === directTicketId);
  const directTargetCapacity = matchedDirectTicket ? Number(matchedDirectTicket.total_count) || 0 : null;

  const directRowStart = block.row_start || block.tiers[0]?.row_start || "A";
  const directRowEnd = block.row_end || block.tiers[0]?.row_end || "J";
  const directSeatsPerRow = block.seats_per_row || block.tiers[0]?.seats_per_row || 25;

  const standingTicketId = block.ticket_type_id || block.tiers?.[0]?.ticket_type_id || "";
  const matchedStandingTicket = ticketTypes.find((tt) => tt.id === standingTicketId);
  const standingTargetCapacity = matchedStandingTicket ? Number(matchedStandingTicket.total_count) || 0 : null;

  const unassignedCount = isStanding
    ? (standingTicketId ? 0 : 1)
    : isDirect
    ? (directTicketId ? 0 : 1)
    : block.tiers.filter((t) => !t.ticket_type_id).length;

  const assignedTicketNames = isStanding
    ? (matchedStandingTicket ? [matchedStandingTicket.name || matchedStandingTicket.ticket_type] : [])
    : isDirect
    ? (matchedDirectTicket ? [matchedDirectTicket.name || matchedDirectTicket.ticket_type] : [])
    : block.tiers
        .map((t) => {
          const tt = ticketTypes.find((item) => item.id === t.ticket_type_id);
          return tt ? tt.name || tt.ticket_type : null;
        })
        .filter(Boolean);

  const handleStandSeatCountChange = (targetCount: number) => {
    if (targetCount <= 0) return;
    if (isStanding) {
      onUpdate({
        ...block,
        capacity: targetCount,
      });
      return;
    }
    const fitted = autoFitRowsAndSeats(targetCount);
    if (isDirect) {
      const updatedFirstTier: StadiumTierDef = {
        id: block.tiers[0]?.id || `t-${Date.now()}`,
        name: block.tiers[0]?.name || block.name,
        color: block.tiers[0]?.color || block.color,
        ticket_type_id: directTicketId,
        row_start: fitted.rowStart,
        row_end: fitted.rowEnd,
        seats_per_row: fitted.seatsPerRow,
        price: block.price,
      };
      const updatedBlock: StadiumBlockDef = {
        ...block,
        seating_type: "direct",
        row_start: fitted.rowStart,
        row_end: fitted.rowEnd,
        seats_per_row: fitted.seatsPerRow,
        row_seat_overrides: undefined,
        excluded_seats: undefined,
        tiers: [updatedFirstTier],
      };
      const dims = calculateOptimalBlockDimensions(updatedBlock, pitchW, pitchH);
      onUpdate({
        ...updatedBlock,
        width: dims.width,
        height: dims.height,
        innerRadius: dims.innerRadius ?? block.innerRadius,
        outerRadius: dims.outerRadius ?? block.outerRadius,
        sweepAngle: dims.sweepAngle ?? block.sweepAngle,
      });
      return;
    }

    if (!block.tiers || block.tiers.length <= 1) {
      const newTiers = [
        {
          id: block.tiers?.[0]?.id || `t-${Date.now()}`,
          name: block.tiers?.[0]?.name || "Tier 1",
          color: block.tiers?.[0]?.color || block.color,
          row_start: fitted.rowStart,
          row_end: fitted.rowEnd,
          seats_per_row: fitted.seatsPerRow,
          ticket_type_id: block.tiers?.[0]?.ticket_type_id || ticketTypes[0]?.id || "",
        },
      ];
      const updatedBlock = { ...block, tiers: newTiers };
      const dims = calculateOptimalBlockDimensions(updatedBlock, pitchW, pitchH);
      onUpdate({
        ...updatedBlock,
        width: dims.width,
        height: dims.height,
        innerRadius: dims.innerRadius ?? block.innerRadius,
        outerRadius: dims.outerRadius ?? block.outerRadius,
        sweepAngle: dims.sweepAngle ?? block.sweepAngle,
      });
      return;
    }

    const currentTotal = totalSeats || 1;
    let remaining = targetCount;
    const newTiers = block.tiers.map((t, idx) => {
      const tierCurr = computeTierSeatCount(t);
      const share =
        idx === block.tiers.length - 1
          ? remaining
          : Math.round((tierCurr / currentTotal) * targetCount);
      remaining -= share;
      const f = autoFitRowsAndSeats(Math.max(1, share));
      return {
        ...t,
        row_start: f.rowStart,
        row_end: f.rowEnd,
        seats_per_row: f.seatsPerRow,
      };
    });
    const updatedBlock = { ...block, tiers: newTiers };
    const dims = calculateOptimalBlockDimensions(updatedBlock, pitchW, pitchH);
    onUpdate({
      ...updatedBlock,
      width: dims.width,
      height: dims.height,
      innerRadius: dims.innerRadius ?? block.innerRadius,
      outerRadius: dims.outerRadius ?? block.outerRadius,
      sweepAngle: dims.sweepAngle ?? block.sweepAngle,
    });
  };

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm ${isSelected
        ? "border-amber-400 bg-white ring-2 ring-amber-400/25 shadow-md"
        : "border-slate-200 bg-white hover:border-slate-300"
        }`}
    >
      {/* Sleek Accordion Card Header */}
      <div
        className="flex items-center gap-2.5 p-3 cursor-pointer select-none bg-slate-50 hover:bg-slate-100/80 transition-colors border-b border-slate-200"
        onClick={() => {
          onSelect();
          setOpen((p) => !p);
        }}
      >
        <div
          className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm ring-1 ring-slate-300"
          style={{ backgroundColor: block.color }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5">
            <h4 className="text-xs font-bold text-slate-900 truncate" title={block.name}>
              {block.name}
            </h4>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                  isStanding
                    ? "text-purple-800 bg-purple-50 border-purple-200"
                    : "text-amber-800 bg-amber-50 border-amber-200"
                }`}
              >
                {isStanding ? `🧍 ${totalSeats.toLocaleString()} passes` : `${totalSeats.toLocaleString()} seats`}
              </span>
              {unassignedCount > 0 ? (
                <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                  Needs Ticket
                </span>
              ) : (
                <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                  Configured
                </span>
              )}
            </div>
          </div>
          {assignedTicketNames.length > 0 && (
            <p className="text-[10px] text-slate-500 truncate mt-0.5 font-medium">
              {assignedTicketNames.join(", ")}
            </p>
          )}
        </div>

        <div className="text-slate-400 p-0.5">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {open && (
        <div className="p-3.5 space-y-3.5 bg-white text-slate-900">
          {/* Stand Name & Theme Color */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-600 tracking-wider block">
              Stand Name & Theme Color
            </label>
            <div className="flex gap-2">
              <input
                className="flex-1 text-xs font-semibold bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors shadow-sm"
                value={block.name}
                onChange={(e) => onUpdate({ ...block, name: e.target.value })}
                placeholder="e.g. North Stand"
              />
              <div className="relative flex items-center">
                <input
                  type="color"
                  className="w-10 h-8.5 rounded-xl border border-slate-300 cursor-pointer bg-white p-1 shadow-sm"
                  value={block.color}
                  onChange={(e) => onUpdate({ ...block, color: e.target.value })}
                  title="Stand Theme Color"
                />
              </div>
            </div>
          </div>

          {/* Stand Level / Tier Mode Selector */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-600 tracking-wider block">
              Stand Level Mode
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  onUpdate({
                    ...block,
                    stand_level: "lower",
                  });
                }}
                className={`py-1.5 px-1.5 rounded-lg text-[10px] font-bold text-center transition-all ${
                  block.stand_level === "lower"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 bg-white border border-slate-200 shadow-sm"
                }`}
              >
                🌱 Lower Stand
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdate({
                    ...block,
                    stand_level: "upper",
                  });
                }}
                className={`py-1.5 px-1.5 rounded-lg text-[10px] font-bold text-center transition-all ${
                  block.stand_level === "upper"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 bg-white border border-slate-200 shadow-sm"
                }`}
              >
                🏛️ Upper Stand
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdate({
                    ...block,
                    stand_level: "multi",
                  });
                }}
                className={`py-1.5 px-1.5 rounded-lg text-[10px] font-bold text-center transition-all ${
                  block.stand_level === "multi" || !block.stand_level
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-slate-600 hover:text-slate-900 bg-white border border-slate-200 shadow-sm"
                }`}
              >
                🥞 Multi-Tier
              </button>
            </div>
          </div>

          {/* Stand Capacity & Price (Two Column Card - Seated mode) */}
          {!isStanding && (
            <div className="grid grid-cols-2 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] uppercase font-bold text-amber-700 flex items-center gap-1">
                    <Ticket className="w-3 h-3 text-amber-600" /> Seats
                  </label>
                  <span className="text-[9px] text-slate-500 font-medium">Auto-fits</span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={99999}
                  value={totalSeats}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    if (val > 0) handleStandSeatCountChange(val);
                  }}
                  className="w-full text-xs font-mono font-bold bg-white border border-slate-300 text-slate-900 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-sm"
                  placeholder="Seats"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] uppercase font-bold text-emerald-700 flex items-center gap-1">
                    Price
                  </label>
                  <span className="text-[9px] text-slate-500 font-medium">ETB / Seat</span>
                </div>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={block.price ?? 500}
                  onChange={(e) => {
                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                    onUpdate({
                      ...block,
                      price: val,
                      tiers: block.tiers.map((t) => ({ ...t, price: val })),
                    });
                  }}
                  className="w-full text-xs font-mono font-bold bg-white border border-slate-300 text-slate-900 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-sm"
                  placeholder="500"
                />
              </div>
            </div>
          )}

          {/* Stand Geometric Shape Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-600 tracking-wider block">
              Stand Shape & Geometry
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { id: "rectangle", label: "Rect", icon: "🔲" },
                { id: "pill", label: "Pill", icon: "🏟️" },
                { id: "curved", label: "Bowl", icon: "🌙" },
                { id: "oval", label: "Circle", icon: "🔘" },
                { id: "arc", label: "Ring Arc", icon: "⭕" },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    const newShape = s.id as any;
                    if (newShape === "arc" && !block.innerRadius) {
                      onUpdate({
                        ...block,
                        shape: "arc",
                        innerRadius: 260,
                        outerRadius: 335,
                        startAngle: 0,
                        sweepAngle: 45,
                        stadiumCenterX: CANVAS_W / 2,
                        stadiumCenterY: CANVAS_H / 2,
                      });
                    } else {
                      onUpdate({ ...block, shape: newShape });
                    }
                  }}
                  className={`p-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition-all ${(block.shape || "rectangle") === s.id
                    ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                >
                  <span className="text-sm">{s.icon}</span>
                  <span className="truncate w-full text-center text-[9px]">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Special Radial Ring Arc Controls (when Arc shape selected) */}
          {block.shape === "arc" ? (
            <div className="p-3 bg-sky-50/70 rounded-xl border border-sky-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-sky-800 flex items-center gap-1.5">
                  <span>⭕</span> 360° Ring Arc Geometry
                </span>
                <span className="text-[9px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded font-bold border border-sky-300">
                  RADIAL SECTOR
                </span>
              </div>

              {/* Quick Floor / Ring Level Presets */}
              <div>
                <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                  Floor / Ring Level:
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { label: "Gr. Floor", inR: 260, outR: 335 },
                    { label: "1st Floor", inR: 342, outR: 415 },
                    { label: "2nd/3rd Fl.", inR: 423, outR: 515 },
                  ].map((fl) => (
                    <button
                      key={fl.label}
                      type="button"
                      onClick={() =>
                        onUpdate({
                          ...block,
                          innerRadius: fl.inR,
                          outerRadius: fl.outR,
                        })
                      }
                      className="py-1 px-1.5 rounded-lg bg-white hover:bg-sky-100 border border-slate-200 text-slate-700 text-[10px] font-semibold transition-all text-center shadow-sm"
                    >
                      {fl.label}
                    </button>
                  ))}
                </div>
                {/* Duplicate Arc as Concentric Upper Tier Ring */}
                {onDuplicateAsUpperTier && (
                  <button
                    type="button"
                    onClick={() => {
                      const inR = block.outerRadius ? block.outerRadius + 8 : 342;
                      const depth = Math.max(50, (block.outerRadius || 335) - (block.innerRadius || 260));
                      const outR = inR + depth;
                      const defaultTicket = ticketTypes[1]?.id || ticketTypes[0]?.id || "";
                      const newUpperBlock: StadiumBlockDef = {
                        ...block,
                        id: makeId(),
                        name: `${block.name.replace(/gr\. floor|ground floor|lower tier/i, "").trim()} Upper Tier`,
                        color: "#9d174d",
                        stand_level: "upper",
                        innerRadius: inR,
                        outerRadius: outR,
                        tiers: [
                          {
                            id: makeId(),
                            name: "Upper Grandstand",
                            ticket_type_id: defaultTicket,
                            row_start: "A",
                            row_end: "M",
                            seats_per_row: 25,
                          },
                        ],
                      };
                      onDuplicateAsUpperTier(newUpperBlock);
                      toast.success(`Created concentric Upper Tier ring for ${block.name}!`);
                    }}
                    className="w-full mt-1.5 py-1.5 px-2 rounded-lg bg-sky-100 hover:bg-sky-200 border border-sky-300 text-sky-900 text-[11px] font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <span>⭕ + Add Concentric Upper Tier Ring</span>
                  </button>
                )}
              </div>

              {/* Rotate Ring Arc Slider & Quick Rotate Buttons */}
              <div className="space-y-1.5 pt-1 border-t border-sky-200">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-sky-900 flex items-center gap-1">
                    🔄 Rotate Arc ({Math.round(block.startAngle ?? 0)}°)
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Rotate -15°"
                      onClick={() =>
                        onUpdate({
                          ...block,
                          startAngle: ((block.startAngle ?? 0) - 15 + 360) % 360,
                        })
                      }
                      className="px-1.5 py-0.5 rounded bg-white hover:bg-sky-100 border border-slate-300 text-[10px] font-bold text-slate-700 shadow-sm transition-all"
                    >
                      ↺ -15°
                    </button>
                    <button
                      type="button"
                      title="Rotate +15°"
                      onClick={() =>
                        onUpdate({
                          ...block,
                          startAngle: ((block.startAngle ?? 0) + 15) % 360,
                        })
                      }
                      className="px-1.5 py-0.5 rounded bg-white hover:bg-sky-100 border border-slate-300 text-[10px] font-bold text-slate-700 shadow-sm transition-all"
                    >
                      ↻ +15°
                    </button>
                    <button
                      type="button"
                      title="Rotate +45°"
                      onClick={() =>
                        onUpdate({
                          ...block,
                          startAngle: ((block.startAngle ?? 0) + 45) % 360,
                        })
                      }
                      className="px-1.5 py-0.5 rounded bg-white hover:bg-sky-100 border border-slate-300 text-[10px] font-bold text-slate-700 shadow-sm transition-all"
                    >
                      ↻ +45°
                    </button>
                    <button
                      type="button"
                      title="Rotate +90°"
                      onClick={() =>
                        onUpdate({
                          ...block,
                          startAngle: ((block.startAngle ?? 0) + 90) % 360,
                        })
                      }
                      className="px-1.5 py-0.5 rounded bg-white hover:bg-sky-100 border border-slate-300 text-[10px] font-bold text-slate-700 shadow-sm transition-all"
                    >
                      ↻ +90°
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={Math.round(block.startAngle ?? 0)}
                  onChange={(e) =>
                    onUpdate({ ...block, startAngle: Number(e.target.value) || 0 })
                  }
                  className="w-full h-1.5 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* Angle & Radius Inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-600 uppercase tracking-wider block mb-0.5">Start Angle (°)</label>
                  <input
                    type="number"
                    min={0}
                    max={360}
                    className="w-full text-xs font-mono font-semibold bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-900 focus:border-amber-500 focus:outline-none shadow-sm"
                    value={Math.round(block.startAngle ?? 0)}
                    onChange={(e) =>
                      onUpdate({ ...block, startAngle: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-600 uppercase tracking-wider block mb-0.5">Sweep Angle (°)</label>
                  <input
                    type="number"
                    min={10}
                    max={360}
                    className="w-full text-xs font-mono font-semibold bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-900 focus:border-amber-500 focus:outline-none shadow-sm"
                    value={Math.round(block.sweepAngle ?? 45)}
                    onChange={(e) =>
                      onUpdate({ ...block, sweepAngle: Math.max(10, Number(e.target.value) || 10) })
                    }
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-600 uppercase tracking-wider block mb-0.5">Inner Radius (px)</label>
                  <input
                    type="number"
                    min={50}
                    className="w-full text-xs font-mono font-semibold bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-900 focus:border-amber-500 focus:outline-none shadow-sm"
                    value={Math.round(block.innerRadius ?? 260)}
                    onChange={(e) =>
                      onUpdate({ ...block, innerRadius: Math.max(50, Number(e.target.value) || 50) })
                    }
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-600 uppercase tracking-wider block mb-0.5">Outer Radius (px)</label>
                  <input
                    type="number"
                    min={100}
                    className="w-full text-xs font-mono font-semibold bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-900 focus:border-amber-500 focus:outline-none shadow-sm"
                    value={Math.round(block.outerRadius ?? 335)}
                    onChange={(e) =>
                      onUpdate({ ...block, outerRadius: Math.max(100, Number(e.target.value) || 100) })
                    }
                  />
                </div>
              </div>

              {/* Quick Compass Sector Buttons */}
              <div>
                <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                  Compass Sector Presets:
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { name: "North", deg: 247.5 },
                    { name: "NE", deg: 292.5 },
                    { name: "East", deg: 337.5 },
                    { name: "SE", deg: 22.5 },
                    { name: "South", deg: 67.5 },
                    { name: "SW", deg: 112.5 },
                    { name: "West", deg: 157.5 },
                    { name: "NW", deg: 202.5 },
                  ].map((comp) => (
                    <button
                      key={comp.name}
                      type="button"
                      onClick={() =>
                        onUpdate({
                          ...block,
                          startAngle: comp.deg,
                          sweepAngle: 45,
                        })
                      }
                      className="py-1 px-1 rounded-md bg-white hover:bg-sky-100 border border-slate-200 text-slate-700 text-[10px] font-semibold text-center transition-colors shadow-sm"
                    >
                      {comp.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <div className="flex-1 grid grid-cols-4 gap-1 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-200 font-mono font-semibold text-center">
                  <span>X: {Math.round(block.x)}</span>
                  <span>Y: {Math.round(block.y)}</span>
                  <span>W: {Math.round(block.width)}</span>
                  <span>H: {Math.round(block.height)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const dims = calculateOptimalBlockDimensions(block, pitchW, pitchH);
                    onUpdate({
                      ...block,
                      width: dims.width,
                      height: dims.height,
                      innerRadius: dims.innerRadius ?? block.innerRadius,
                      outerRadius: dims.outerRadius ?? block.outerRadius,
                      sweepAngle: dims.sweepAngle ?? block.sweepAngle,
                    });
                    toast.success(`Auto-adjusted ${block.name} size to fit ${totalSeats} seats!`);
                  }}
                  className="py-2 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold flex items-center gap-1 shadow-sm shrink-0 transition-colors"
                  title="Auto-calculate and set optimal width and height for this stand based on its seats & rows"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>Auto-Fit Size</span>
                </button>
              </div>

              {/* Stand Rotation Controls */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-600 tracking-wider flex items-center gap-1">
                    🔄 Stand Rotation ({Math.round(block.rotation || 0)}°)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdate({
                          ...block,
                          rotation: ((block.rotation || 0) + 90) % 360,
                        })
                      }
                      className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-[10px] font-bold text-slate-700 shadow-sm transition-all"
                    >
                      🔄 Rotate 90°
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdate({
                          ...block,
                          rotation: 0,
                        })
                      }
                      className="px-1.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-[10px] font-bold text-slate-500 shadow-sm transition-all"
                      title="Reset rotation to 0°"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={5}
                  value={Math.round(block.rotation || 0)}
                  onChange={(e) => onUpdate({ ...block, rotation: Number(e.target.value) || 0 })}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>
          )}

          {/* Stand Admission Type Selector: Seated vs Standing */}
          <div className="space-y-1.5 pt-1 border-t border-slate-200">
            <label className="text-[10px] uppercase font-bold text-slate-600 tracking-wider block">
              Admission Type
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  onUpdate({
                    ...block,
                    stand_type: "seated",
                  });
                }}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  !isStanding
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>💺 Numbered Seating</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const defaultTicket = block.ticket_type_id || block.tiers?.[0]?.ticket_type_id || ticketTypes[0]?.id || "";
                  const matched = ticketTypes.find((t) => t.id === defaultTicket);
                  const passCap = matched && Number(matched.total_count) > 0 ? Number(matched.total_count) : (block.capacity || 1000);
                  const passPrice = matched && Number(matched.price) > 0 ? Number(matched.price) : (block.price ?? 500);
                  onUpdate({
                    ...block,
                    stand_type: "standing",
                    capacity: passCap,
                    price: passPrice,
                    ticket_type_id: defaultTicket,
                  });
                }}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  isStanding
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>🧍 Standing / VIP Pit</span>
              </button>
            </div>
          </div>

          {isStanding ? (
            /* Standing / General Admission Zone Configuration */
            <div className="rounded-xl border border-purple-300 bg-purple-50/40 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-purple-900 flex items-center gap-1.5">
                  <span>🧍</span> Standing / VIP Fan Pit Zone
                </span>
                <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                  NO CHAIRS / PASS CAPACITY
                </span>
              </div>

              {/* Linked Ticket Type */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-600 tracking-wider">
                    Ticket Category
                  </label>
                  {standingTargetCapacity !== null && (
                    <span className="text-[10px] font-mono font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      Target: {standingTargetCapacity.toLocaleString()} passes
                    </span>
                  )}
                </div>
                <select
                  value={standingTicketId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    const matched = ticketTypes.find((t) => t.id === nextId);
                    onUpdate({
                      ...block,
                      ticket_type_id: nextId,
                      price: matched ? Number(matched.price) : block.price,
                      capacity: matched && Number(matched.total_count) > 0 ? Number(matched.total_count) : block.capacity,
                      tiers: block.tiers.map((t) => ({ ...t, ticket_type_id: nextId })),
                    });
                  }}
                  className={`w-full text-xs font-bold bg-white border rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-purple-500 shadow-sm ${
                    !standingTicketId
                      ? "border-rose-400 bg-rose-50/50 text-rose-800"
                      : "border-slate-300"
                  }`}
                >
                  <option value="">-- Select Event Ticket Type --</option>
                  {ticketTypes.map((tt) => (
                    <option key={tt.id} value={tt.id}>
                      {tt.name || tt.ticket_type} (ETB {Number(tt.price).toLocaleString()} · Cap: {Number(tt.total_count).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Standing Capacity & Price */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-purple-800 block mb-1">
                    Standing Capacity
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={block.capacity || 1000}
                    onChange={(e) => {
                      const cap = Math.max(1, parseInt(e.target.value) || 0);
                      onUpdate({
                        ...block,
                        capacity: cap,
                      });
                    }}
                    className="w-full text-xs font-mono font-bold bg-white border border-purple-200 text-slate-900 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-purple-500 shadow-sm"
                    placeholder="1000"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-emerald-700 block mb-1">
                    Price (ETB / Pass)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={block.price ?? 500}
                    onChange={(e) => {
                      const p = Math.max(0, parseFloat(e.target.value) || 0);
                      onUpdate({
                        ...block,
                        price: p,
                        tiers: block.tiers.map((t) => ({ ...t, price: p })),
                      });
                    }}
                    className="w-full text-xs font-mono font-bold bg-white border border-slate-300 text-slate-900 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 shadow-sm"
                    placeholder="500"
                  />
                </div>
              </div>
              <p className="text-[11px] text-purple-700/90 leading-tight">
                General Admission zone. Customers select ticket quantities directly without row or seat dots.
              </p>
            </div>
          ) : (
            <>
              {/* Stand Seating Structure Mode Selector */}
          <div className="space-y-1.5 pt-1 border-t border-slate-200">
            <label className="text-[10px] uppercase font-bold text-slate-600 tracking-wider block">
              Stand Seating Structure
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  const firstTier = block.tiers[0];
                  onUpdate({
                    ...block,
                    seating_type: "direct",
                    ticket_type_id: block.ticket_type_id || firstTier?.ticket_type_id || ticketTypes[0]?.id || "",
                    row_start: block.row_start || firstTier?.row_start || "A",
                    row_end: block.row_end || firstTier?.row_end || "J",
                    seats_per_row: block.seats_per_row || firstTier?.seats_per_row || 25,
                    row_seat_overrides: block.row_seat_overrides || firstTier?.row_seat_overrides,
                    row_gaps: block.row_gaps || firstTier?.row_gaps,
                    excluded_seats: block.excluded_seats || firstTier?.excluded_seats,
                    tiers: block.tiers.length > 0 ? [block.tiers[0]] : [defaultTier()],
                  });
                }}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${isDirect
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>🎯 Direct Seats</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onUpdate({
                    ...block,
                    seating_type: "tiered",
                    tiers: block.tiers.length > 0 ? block.tiers : [defaultTier()],
                  });
                }}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${!isDirect
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>🥞 Multi-Tier Stand</span>
                <span className="text-[10px] opacity-80">({block.tiers.length})</span>
              </button>
            </div>
          </div>

          {/* If Direct Seating: Single Level configuration */}
          {isDirect ? (
            <div className="rounded-xl border border-amber-300/80 bg-amber-50/20 p-3 space-y-3">
              {/* Ticket Type Assignment */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-600 tracking-wider">
                    Stand Ticket Type
                  </label>
                  {matchedDirectTicket && directTargetCapacity !== null && (
                    <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Target: {directTargetCapacity.toLocaleString()} seats
                    </span>
                  )}
                </div>
                <select
                  className={`w-full text-xs font-semibold bg-white border rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-amber-500 shadow-sm transition-all ${
                    !directTicketId
                      ? "border-rose-400 bg-rose-50/50 text-rose-800"
                      : "border-slate-300"
                  }`}
                  value={directTicketId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    const updatedTiers = block.tiers.map((t) => ({ ...t, ticket_type_id: newId }));
                    onUpdate({
                      ...block,
                      ticket_type_id: newId,
                      tiers: updatedTiers.length > 0 ? updatedTiers : [{ ...defaultTier(), ticket_type_id: newId }],
                    });
                  }}
                >
                  <option value="">-- Choose Organizer Ticket Type --</option>
                  {ticketTypes.map((tt: any) => (
                    <option key={tt.id} value={tt.id}>
                      {tt.name || tt.ticket_type || "Ticket"} · Capacity: {tt.total_count || 0}
                      {tt.price != null ? ` · ETB ${tt.price}` : ""}
                    </option>
                  ))}
                </select>
                {!directTicketId && (
                  <p className="text-[10px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Ticket type required for buyer bookings
                  </p>
                )}
              </div>

              {/* Row Configuration Grid */}
              <div className="grid grid-cols-3 gap-1.5">
                <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm">
                  <label className="text-[9px] uppercase font-extrabold text-slate-500 block mb-0.5">
                    Start Row
                  </label>
                  <select
                    className="w-full text-xs font-bold bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-900 focus:outline-none focus:border-amber-500 shadow-sm"
                    value={directRowStart}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      const updatedTiers = block.tiers.map((t) => ({ ...t, row_start: newStart }));
                      onUpdate({
                        ...block,
                        row_start: newStart,
                        tiers: updatedTiers.length > 0 ? updatedTiers : [{ ...defaultTier(), row_start: newStart }],
                      });
                    }}
                  >
                    {ROW_LETTERS.map((r) => (
                      <option key={r} value={r}>
                        Row {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm">
                  <label className="text-[9px] uppercase font-extrabold text-slate-500 block mb-0.5">
                    End Row
                  </label>
                  <select
                    className="w-full text-xs font-bold bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-900 focus:outline-none focus:border-amber-500 shadow-sm"
                    value={directRowEnd}
                    onChange={(e) => {
                      const newEnd = e.target.value;
                      const updatedTiers = block.tiers.map((t) => ({ ...t, row_end: newEnd }));
                      onUpdate({
                        ...block,
                        row_end: newEnd,
                        tiers: updatedTiers.length > 0 ? updatedTiers : [{ ...defaultTier(), row_end: newEnd }],
                      });
                    }}
                  >
                    {ROW_LETTERS.map((r) => (
                      <option key={r} value={r}>
                        Row {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm">
                  <label className="text-[9px] uppercase font-extrabold text-slate-500 block mb-0.5">
                    Seats / Row
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={150}
                    className="w-full text-xs font-bold bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-900 focus:outline-none focus:border-amber-500 shadow-sm"
                    value={directSeatsPerRow}
                    onChange={(e) => {
                      const newSpr = parseInt(e.target.value) || 1;
                      const updatedTiers = block.tiers.map((t) => ({ ...t, seats_per_row: newSpr }));
                      onUpdate({
                        ...block,
                        seats_per_row: newSpr,
                        tiers: updatedTiers.length > 0 ? updatedTiers : [{ ...defaultTier(), seats_per_row: newSpr }],
                      });
                    }}
                  />
                </div>
              </div>

              {/* Match Banner */}
              <div className="bg-white p-2 rounded-lg border border-slate-200 text-xs flex flex-col gap-1 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-600 font-medium">
                    Rows {directRowStart}–{directRowEnd} (Base: {directSeatsPerRow}/row):
                  </span>
                  <strong className="text-amber-700 font-mono text-xs font-extrabold">
                    {totalSeats.toLocaleString()} seats
                  </strong>
                </div>

                {matchedDirectTicket && directTargetCapacity !== null && (
                  <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">
                      Target: <strong className="text-slate-900 font-mono font-bold">{directTargetCapacity}</strong>
                    </span>

                    {totalSeats === directTargetCapacity ? (
                      <span className="text-[10px] text-emerald-800 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 100% Matched
                      </span>
                    ) : totalSeats < directTargetCapacity ? (
                      <span className="text-[10px] text-amber-700 font-bold">
                        -{directTargetCapacity - totalSeats} short
                      </span>
                    ) : (
                      <span className="text-[10px] text-rose-700 font-bold">
                        +{totalSeats - directTargetCapacity} over
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Customise Rows, Aisles & Seats Button for Direct Stand */}
              <button
                type="button"
                onClick={() => setShowDirectCustomizer(true)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 py-2.5 px-3 rounded-xl transition-all shadow-md active:scale-95"
              >
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-slate-950" />
                  <span>Customise Rows, Aisles & Seats</span>
                </div>
                <span className="text-[10px] font-mono bg-slate-950 text-amber-300 px-2 py-0.5 rounded-md font-bold">
                  {totalSeats.toLocaleString()} seats
                </span>
              </button>

              {/* Quick Split into Lower & Upper Tier Stand */}
              <button
                type="button"
                onClick={() => {
                  const defaultTicket = ticketTypes[0]?.id || "";
                  const premiumTicket = ticketTypes[1]?.id || defaultTicket;
                  const total = totalSeats || 1000;
                  const lowerCount = Math.round(total * 0.45);
                  const upperCount = total - lowerCount;
                  const fLower = autoFitRowsAndSeats(lowerCount);
                  const fUpper = autoFitRowsAndSeats(upperCount);

                  onUpdate({
                    ...block,
                    seating_type: "tiered",
                    stand_level: "multi",
                    tier_split_direction: "vertical",
                    tiers: [
                      {
                        id: `tier-${Date.now()}-lower`,
                        name: "Lower Tier (Ground)",
                        color: "#10b981",
                        ticket_type_id: defaultTicket,
                        row_start: "A",
                        row_end: String.fromCharCode("A".charCodeAt(0) + Math.max(0, fLower.rowEnd.charCodeAt(0) - fLower.rowStart.charCodeAt(0))),
                        seats_per_row: fLower.seatsPerRow,
                      },
                      {
                        id: `tier-${Date.now()}-upper`,
                        name: "Upper Grandstand",
                        color: "#3b82f6",
                        ticket_type_id: premiumTicket,
                        row_start: String.fromCharCode("A".charCodeAt(0) + Math.max(0, fLower.rowEnd.charCodeAt(0) - fLower.rowStart.charCodeAt(0)) + 1),
                        row_end: "P",
                        seats_per_row: fUpper.seatsPerRow,
                      },
                    ],
                  });
                  toast.success(`Split ${block.name} into Lower Tier & Upper Grandstand!`);
                }}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-300 py-2 px-3 rounded-xl transition-all shadow-sm active:scale-95"
              >
                <span>⚡ Split into Lower & Upper Tier Stand</span>
              </button>

              <RowSeatCustomizerModal
                isOpen={showDirectCustomizer}
                onClose={() => setShowDirectCustomizer(false)}
                title={`Customise ${block.name} (Direct Seating)`}
                subtitle={`Rows ${directRowStart}–${directRowEnd} · Base ${directSeatsPerRow} seats/row`}
                color={block.color}
                rowStart={directRowStart}
                rowEnd={directRowEnd}
                baseSeatsPerRow={directSeatsPerRow}
                initialOverrides={block.row_seat_overrides || block.tiers[0]?.row_seat_overrides}
                initialGaps={block.row_gaps || block.tiers[0]?.row_gaps}
                initialExcluded={block.excluded_seats || block.tiers[0]?.excluded_seats}
                onApply={({ rowSeatOverrides, rowGaps, excludedSeats }) => {
                  const updatedTier: StadiumTierDef = {
                    ...(block.tiers[0] || defaultTier()),
                    ticket_type_id: directTicketId,
                    row_start: directRowStart,
                    row_end: directRowEnd,
                    seats_per_row: directSeatsPerRow,
                    row_seat_overrides: rowSeatOverrides,
                    row_gaps: rowGaps,
                    excluded_seats: excludedSeats,
                  };
                  const updatedBlock: StadiumBlockDef = {
                    ...block,
                    row_seat_overrides: rowSeatOverrides,
                    row_gaps: rowGaps,
                    excluded_seats: excludedSeats,
                    tiers: [updatedTier],
                  };
                  const dims = calculateOptimalBlockDimensions(updatedBlock, pitchW, pitchH);
                  onUpdate({
                    ...updatedBlock,
                    width: dims.width,
                    height: dims.height,
                    innerRadius: dims.innerRadius ?? block.innerRadius,
                    outerRadius: dims.outerRadius ?? block.outerRadius,
                    sweepAngle: dims.sweepAngle ?? block.sweepAngle,
                  });
                }}
              />
            </div>
          ) : (
            /* Multi-Tier Stand: List of Tiers */
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-700">
                  Seating Tiers ({block.tiers.length})
                </span>
                <div className="flex items-center gap-1">
                  {/* Split Tier Orientation: Stacked (Upper/Lower) vs Side-by-Side (Horizontal) */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextDir = block.tier_split_direction === "horizontal" ? "vertical" : "horizontal";
                      onUpdate({
                        ...block,
                        tier_split_direction: nextDir,
                      });
                      toast.info(
                        nextDir === "horizontal"
                          ? "Tiers split horizontally (Side-by-side Left/Right)"
                          : "Tiers split vertically (Stacked Upper/Lower)"
                      );
                    }}
                    className="text-[10px] text-slate-700 font-bold flex items-center gap-1 bg-white hover:bg-slate-100 px-2 py-1 rounded-lg border border-slate-300 shadow-sm transition-all active:scale-95"
                    title="Rotate tier split between Upper/Lower (stacked) and Left/Right (side-by-side)"
                  >
                    <span>🔄 Split: {block.tier_split_direction === "horizontal" ? "Horizontal" : "Upper/Lower"}</span>
                  </button>

                  {/* Reverse / Flip Tiers */}
                  {block.tiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdate({
                          ...block,
                          tiers: [...block.tiers].reverse(),
                          tier_order_reversed: !block.tier_order_reversed,
                        });
                        toast.info("Reversed tier order (Upper ↔ Lower)!");
                      }}
                      className="text-[10px] text-slate-700 font-bold flex items-center gap-1 bg-white hover:bg-slate-100 px-2 py-1 rounded-lg border border-slate-300 shadow-sm transition-all active:scale-95"
                      title="Flip tier order (Lower at front vs Upper at front)"
                    >
                      <span>⇄ Flip</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      onUpdate({ ...block, tiers: [...block.tiers, defaultTier()] })
                    }
                    className="text-xs text-amber-700 hover:text-amber-800 font-bold flex items-center gap-1 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300 transition-all active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Tier
                  </button>
                </div>
              </div>

              {block.tiers.map((tier, ti) => (
                <TierEditor
                  key={tier.id}
                  tier={tier}
                  ticketTypes={ticketTypes}
                  onChange={(updated) => {
                    const tiers = [...block.tiers];
                    tiers[ti] = updated;
                    onUpdate({ ...block, tiers });
                  }}
                  onDelete={() => {
                    const tiers = block.tiers.filter((_, i) => i !== ti);
                    onUpdate({ ...block, tiers });
                  }}
                />
              ))}

              {block.tiers.length === 0 && (
                <div className="text-xs text-rose-700 font-medium text-center py-3 bg-rose-50 rounded-xl border border-rose-200">
                  ⚠️ This stand has no tiers. Click &ldquo;Add Tier&rdquo; to define seats.
                </div>
              )}
            </div>
          )}
        </>
      )}

          <button
            type="button"
            onClick={onDelete}
            className="w-full text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-rose-200 hover:border-rose-300 bg-rose-50/60 hover:bg-rose-100/80 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove Stand
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Element Panel ───────────────────────────────────────────────────────────

function ElementPanel({
  element,
  isSelected,
  onUpdate,
  onDelete,
  onSelect,
}: {
  element: StadiumElementDef;
  isSelected: boolean;
  onUpdate: (e: StadiumElementDef) => void;
  onDelete: () => void;
  onSelect: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border transition-all duration-200 p-3.5 space-y-3 shadow-sm ${isSelected
        ? "border-amber-400 bg-white ring-2 ring-amber-400/25 shadow-md"
        : "border-slate-200 bg-white hover:border-slate-300"
        }`}
    >
      <div
        className="flex items-center justify-between gap-2 cursor-pointer select-none"
        onClick={onSelect}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold border border-slate-200 shadow-sm"
            style={{ backgroundColor: element.color }}
          >
            {element.icon || "★"}
          </div>
          <input
            className="text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none flex-1 truncate shadow-sm placeholder:text-slate-400"
            value={element.name}
            onChange={(e) => onUpdate({ ...element, name: e.target.value })}
            placeholder="Element Name"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <input
            type="color"
            className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer bg-white p-0.5 shadow-sm"
            value={element.color}
            onChange={(e) => onUpdate({ ...element, color: e.target.value })}
            title="Element Color"
          />
          <button
            type="button"
            onClick={onDelete}
            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
            title="Remove Element"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5 text-xs text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-200 font-mono text-center font-medium">
        <span>X: {Math.round(element.x)}</span>
        <span>Y: {Math.round(element.y)}</span>
        <span>W: {Math.round(element.width)}</span>
        <span>H: {Math.round(element.height)}</span>
      </div>
    </div>
  );
}

// ─── Customer View Simulation Modal (Level 1 Stadium -> Level 2/3 Stand Zoom & Seat Picker) ───

function describeArcSvg(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  sweepAngle: number
) {
  const endAngle = startAngle + sweepAngle;
  const rad1 = (startAngle * Math.PI) / 180;
  const rad2 = (endAngle * Math.PI) / 180;

  const p1 = { x: cx + outerR * Math.cos(rad1), y: cy + outerR * Math.sin(rad1) };
  const p2 = { x: cx + outerR * Math.cos(rad2), y: cy + outerR * Math.sin(rad2) };
  const p3 = { x: cx + innerR * Math.cos(rad2), y: cy + innerR * Math.sin(rad2) };
  const p4 = { x: cx + innerR * Math.cos(rad1), y: cy + innerR * Math.sin(rad1) };

  const largeArcFlag = sweepAngle > 180 ? 1 : 0;

  return `M ${p1.x} ${p1.y} A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${p4.x} ${p4.y} Z`;
}

interface CustomerPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  stadiumName: string;
  groundConfig: StadiumGroundConfig;
  blocks: StadiumBlockDef[];
  elements: StadiumElementDef[];
  ticketTypes: Array<{ id: string; name?: string; ticket_type?: string; price?: number }>;
  onPublish: () => Promise<void>;
  isPublishing: boolean;
}

function CustomerStadiumPreviewModal({
  isOpen,
  onClose,
  stadiumName,
  groundConfig,
  blocks,
  elements,
  ticketTypes,
  onPublish,
  isPublishing,
}: CustomerPreviewModalProps) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [activeTierIdx, setActiveTierIdx] = useState<number>(0);
  const [selectedSeats, setSelectedSeats] = useState<
    Array<{
      id: string;
      standName: string;
      tierName: string;
      row: string;
      seat: number;
      price: number;
    }>
  >([]);

  // Reset selected block when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedBlockId(null);
      setActiveTierIdx(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentBlock = blocks.find((b) => b.id === selectedBlockId) || null;
  const currentTier = currentBlock?.tiers?.[activeTierIdx] || currentBlock?.tiers?.[0];

  const getTierPrice = (tier?: StadiumTierDef) => {
    if (!tier) return 500;
    const tt = ticketTypes.find((t) => t.id === tier.ticket_type_id);
    return tt?.price != null ? Number(tt.price) : Number(tier.price) || 500;
  };

  const getBlockPrice = (block: StadiumBlockDef) => {
    const tier = block.tiers?.[0];
    return getTierPrice(tier);
  };

  const toggleSeatSelection = (
    block: StadiumBlockDef,
    tier: StadiumTierDef,
    row: string,
    seatNum: number
  ) => {
    const seatId = `${block.id}-${tier.id}-${row}-${seatNum}`;
    const price = getTierPrice(tier);

    setSelectedSeats((prev) => {
      const exists = prev.some((s) => s.id === seatId);
      if (exists) {
        return prev.filter((s) => s.id !== seatId);
      } else {
        return [
          ...prev,
          {
            id: seatId,
            standName: block.name,
            tierName: tier.name,
            row,
            seat: seatNum,
            price,
          },
        ];
      }
    });
  };

  const totalCartPrice = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-7xl h-[94vh] bg-slate-900 border border-slate-700/80 rounded-2xl flex flex-col overflow-hidden shadow-2xl relative text-white">
        {/* ── Top Bar ── */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 bg-slate-950/90 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <span className="px-2.5 py-1 rounded-md bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 shrink-0">
              <Eye className="w-3.5 h-3.5" />
              <span>Customer Experience Preview</span>
            </span>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 truncate">
              <span className="text-white font-extrabold">{stadiumName}</span>
              <span>/</span>
              {selectedBlockId && currentBlock ? (
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-extrabold">{currentBlock.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBlockId(null);
                      setActiveTierIdx(0);
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 text-[11px] transition-colors"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Back to Full Stadium</span>
                  </button>
                </div>
              ) : (
                <span className="text-slate-400">Full Stadium Overview (Level 1)</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                await onPublish();
                onClose();
              }}
              disabled={isPublishing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50 transition-all"
              title="Save, generate seats and publish this layout for ticket buyers"
            >
              {isPublishing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Save & Publish Layout</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              title="Close Preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Guidance Banner ── */}
        <div className="shrink-0 px-4 py-2 bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
            {!selectedBlockId ? (
              <span>
                <strong className="text-white">Customer Step 1:</strong> Buyers see the complete 360° stadium map.{" "}
                <span className="text-sky-300 font-semibold underline decoration-sky-400 underline-offset-2">
                  Click on any stand below
                </span>{" "}
                to zoom inside and test seat selection.
              </span>
            ) : (
              <span>
                <strong className="text-white">Customer Step 2 & 3:</strong> Buyers view row letters & seat dots. Click
                any available seat circle to select it into your cart.
              </span>
            )}
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-3">
            <span>Stands: {blocks.length}</span>
            <span>•</span>
            <span>Total Capacity: {blocks.reduce((acc, b) => acc + computeBlockSeatCount(b), 0).toLocaleString()} seats</span>
          </div>
        </div>

        {/* ── Main Interactive Content Area ── */}
        <div className="flex-1 relative overflow-auto bg-slate-950 flex flex-col items-center justify-center p-3">
          {!selectedBlockId ? (
            /* ═════════ LEVEL 1: FULL STADIUM OVERVIEW ═════════ */
            <div className="w-full h-full flex flex-col items-center justify-center relative select-none">
              {(() => {
                const gx = groundConfig.x ?? PITCH_X;
                const gy = groundConfig.y ?? PITCH_Y;
                const gw = groundConfig.width ?? PITCH_W;
                const gh = groundConfig.height ?? PITCH_H;

                return (
                  <svg
                    viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
                    className="w-full h-full max-h-[72vh] object-contain drop-shadow-2xl"
                  >
                    {/* Stadium Grass / Ground Canvas Background */}
                    <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#090d16" />

                    {/* Pitch / Sport Ground in Center */}
                    {groundConfig.shape === "capsule" ? (
                      <rect
                        x={gx}
                        y={gy}
                        width={gw}
                        height={gh}
                        rx={gw / 2}
                        fill={groundConfig.track_color || "#7f1d1d"}
                        stroke="#ffffff"
                        strokeWidth={2}
                        strokeOpacity={0.2}
                      />
                    ) : groundConfig.shape === "oval" ? (
                      <ellipse
                        cx={gx + gw / 2}
                        cy={gy + gh / 2}
                        rx={gw / 2}
                        ry={gh / 2}
                        fill={groundConfig.turf_color || "#15803d"}
                        stroke="#ffffff"
                        strokeWidth={2}
                        strokeOpacity={0.3}
                      />
                    ) : (
                      <rect
                        x={gx}
                        y={gy}
                        width={gw}
                        height={gh}
                        rx={12}
                        fill={groundConfig.turf_color || "#15803d"}
                        stroke="#ffffff"
                        strokeWidth={2}
                        strokeOpacity={0.2}
                      />
                    )}

                    {/* Ground Field Markings */}
                    {groundConfig.sport_type === "cricket" ? (
                      <rect
                        x={gx + gw / 2 - 25}
                        y={gy + gh / 2 - 80}
                        width={50}
                        height={160}
                        fill="#d97706"
                        opacity={0.8}
                        rx={4}
                      />
                    ) : gw >= gh ? (
                      <>
                        <circle
                          cx={gx + gw / 2}
                          cy={gy + gh / 2}
                          r={gh * 0.16}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth={2}
                          strokeOpacity={0.4}
                        />
                        <line
                          x1={gx + gw / 2}
                          y1={gy}
                          x2={gx + gw / 2}
                          y2={gy + gh}
                          stroke="#ffffff"
                          strokeWidth={2}
                          strokeOpacity={0.4}
                        />
                        <rect
                          x={gx}
                          y={gy + (gh - gh * 0.52) / 2}
                          width={gw * 0.16}
                          height={gh * 0.52}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth={1.5}
                          strokeOpacity={0.35}
                        />
                        <rect
                          x={gx + gw - gw * 0.16}
                          y={gy + (gh - gh * 0.52) / 2}
                          width={gw * 0.16}
                          height={gh * 0.52}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth={1.5}
                          strokeOpacity={0.35}
                        />
                      </>
                    ) : (
                      <>
                        <circle
                          cx={gx + gw / 2}
                          cy={gy + gh / 2}
                          r={70}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth={2}
                          strokeOpacity={0.4}
                        />
                        <line
                          x1={gx}
                          y1={gy + gh / 2}
                          x2={gx + gw}
                          y2={gy + gh / 2}
                          stroke="#ffffff"
                          strokeWidth={2}
                          strokeOpacity={0.4}
                        />
                      </>
                    )}

                    {/* Pitch Text Label */}
                    <text
                      x={gx + gw / 2}
                      y={gy + gh / 2 + 5}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={14}
                      fontWeight="bold"
                      opacity={0.85}
                      letterSpacing={2}
                    >
                      {groundConfig.pitch_label || "STADIUM GROUND"}
                    </text>

                    {/* Custom Elements (Stage, Gates, Dugouts) */}
                    {elements.map((el) => (
                      <g key={el.id} transform={`translate(${el.x}, ${el.y})`}>
                        <rect
                          width={el.width}
                          height={el.height}
                          rx={8}
                          fill={el.color || "#475569"}
                          stroke="#ffffff"
                          strokeWidth={1.5}
                          strokeOpacity={0.4}
                        />
                        <text
                          x={el.width / 2}
                          y={el.height / 2 + 4}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize={11}
                          fontWeight="bold"
                        >
                          {el.name}
                        </text>
                      </g>
                    ))}

                {/* All Stadium Stands / Blocks */}
                {blocks.map((block) => {
                  const isArc = block.shape === "arc";
                  const price = getBlockPrice(block);
                  const capacity = computeBlockSeatCount(block);
                  const blockColor = block.color || "#2563eb";

                  if (isArc) {
                    const cx = block.stadiumCenterX ?? CANVAS_W / 2;
                    const cy = block.stadiumCenterY ?? CANVAS_H / 2;
                    const innerR = block.innerRadius ?? 260;
                    const outerR = block.outerRadius ?? 335;
                    const startA = block.startAngle ?? 0;
                    const sweepA = block.sweepAngle ?? 45;

                    const dPath = describeArcSvg(cx, cy, innerR, outerR, startA, sweepA);

                    const midA = ((startA + sweepA / 2) * Math.PI) / 180;
                    const midR = (innerR + outerR) / 2;
                    const lblX = cx + midR * Math.cos(midA);
                    const lblY = cy + midR * Math.sin(midA);

                    return (
                      <g
                        key={block.id}
                        className="cursor-pointer transition-transform hover:opacity-95"
                        onClick={() => {
                          setSelectedBlockId(block.id);
                          setActiveTierIdx(0);
                        }}
                      >
                        <path
                          d={dPath}
                          fill={blockColor}
                          stroke="#ffffff"
                          strokeWidth={2}
                          strokeOpacity={0.6}
                          className="hover:stroke-sky-300 hover:stroke-[3.5] transition-all"
                        />
                        <rect
                          x={lblX - 55}
                          y={lblY - 14}
                          width={110}
                          height={28}
                          rx={14}
                          fill="#090d16"
                          stroke="#ffffff"
                          strokeWidth={1}
                          strokeOpacity={0.4}
                        />
                        <text
                          x={lblX}
                          y={lblY - 1}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize={10}
                          fontWeight="bold"
                        >
                          {block.name}
                        </text>
                        <text
                          x={lblX}
                          y={lblY + 10}
                          textAnchor="middle"
                          fill="#38bdf8"
                          fontSize={8}
                          fontWeight="bold"
                        >
                          ETB {price.toLocaleString()} · {capacity} seats
                        </text>
                      </g>
                    );
                  }

                  // Rectangular / Curved Block
                  const bx = block.x;
                  const by = block.y;
                  const bw = block.width;
                  const bh = block.height;
                  const rot = block.rotation || 0;

                  return (
                    <g
                      key={block.id}
                      transform={`translate(${bx}, ${by}) rotate(${rot}, ${bw / 2}, ${bh / 2})`}
                      className="cursor-pointer transition-transform hover:opacity-95"
                      onClick={() => {
                        setSelectedBlockId(block.id);
                        setActiveTierIdx(0);
                      }}
                    >
                      <rect
                        x={0}
                        y={0}
                        width={bw}
                        height={bh}
                        rx={block.shape === "pill" ? 16 : 8}
                        fill={blockColor}
                        stroke="#ffffff"
                        strokeWidth={2}
                        strokeOpacity={0.6}
                        className="hover:stroke-sky-300 hover:stroke-[3.5] transition-all"
                      />
                      <rect
                        x={bw / 2 - 60}
                        y={bh / 2 - 16}
                        width={120}
                        height={32}
                        rx={8}
                        fill="#090d16"
                        stroke="#ffffff"
                        strokeWidth={1}
                        strokeOpacity={0.4}
                      />
                      <text
                        x={bw / 2}
                        y={bh / 2 - 2}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize={11}
                        fontWeight="bold"
                      >
                        {block.name}
                      </text>
                      <text
                        x={bw / 2}
                        y={bh / 2 + 11}
                        textAnchor="middle"
                        fill="#38bdf8"
                        fontSize={9}
                        fontWeight="bold"
                      >
                        ETB {price.toLocaleString()} · {capacity} seats
                      </text>
                    </g>
                  );
                })}
                  </svg>
                );
              })()}
            </div>
          ) : (
            /* ═════════ LEVEL 2 & 3: STAND ZOOM & INTERACTIVE SEAT PICKER ═════════ */
            <div className="w-full h-full flex flex-col bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              {/* Stand Header & Tier Tabs */}
              <div className="shrink-0 p-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBlockId(null);
                      setActiveTierIdx(0);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-bold transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Stadium Bowl</span>
                  </button>

                  <div>
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <span>{currentBlock?.name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {currentBlock?.stand_type === "standing"
                          ? "Standing Fan Zone"
                          : currentBlock && currentBlock.tiers.length > 1
                          ? "Multi-Tier Stand"
                          : "Seated Stand"}
                      </span>
                    </h3>
                  </div>
                </div>

                {/* Tier Tabs (if multi-tier stand) */}
                {currentBlock && currentBlock.tiers.length > 1 && (
                  <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                    {currentBlock.tiers.map((t, idx) => {
                      const isActive = activeTierIdx === idx;
                      const price = getTierPrice(t);
                      return (
                        <button
                          key={t.id || idx}
                          type="button"
                          onClick={() => setActiveTierIdx(idx)}
                          className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                            isActive
                              ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: t.color || "#22c55e" }}
                          />
                          <span>{t.name}</span>
                          <span className="opacity-80 text-[10px]">• ETB {price}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Seat Legend */}
                <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full border border-sky-400 bg-sky-500/20" />
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center text-[9px] text-slate-950 font-bold">
                      ✓
                    </span>
                    <span className="text-emerald-400">Selected</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-slate-700 opacity-60 text-center text-[9px]">✕</span>
                    <span>Booked</span>
                  </div>
                </div>
              </div>

              {/* Pitch Direction Indicator */}
              <div className="shrink-0 py-1.5 bg-slate-950/60 border-b border-slate-800/80 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                🏟️ Ground / Pitch This Way ↑
              </div>

              {/* Stand Virtual Seat Map Canvas */}
              <div className="flex-1 overflow-auto p-6 flex flex-col items-center justify-center">
                {currentBlock?.stand_type === "standing" ? (
                  <div className="p-8 rounded-2xl bg-slate-800/60 border border-slate-700 text-center max-w-md space-y-4">
                    <Users className="w-12 h-12 text-sky-400 mx-auto" />
                    <div>
                      <h4 className="text-base font-bold text-white">Standing Only Fan Zone</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        General admission area with total capacity of {currentBlock.capacity || 500} guests.
                      </p>
                    </div>
                    <div className="text-sm font-extrabold text-amber-400">
                      ETB {getBlockPrice(currentBlock).toLocaleString()} per ticket
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 select-none">
                    {(() => {
                      const tier = currentTier;
                      if (!tier) return null;

                      const startCode = (tier.row_start || "A").toUpperCase().charCodeAt(0);
                      const endCode = (tier.row_end || "E").toUpperCase().charCodeAt(0);
                      const spr = Math.max(1, tier.seats_per_row || 14);

                      const rows: string[] = [];
                      for (let c = startCode; c <= endCode; c++) {
                        rows.push(String.fromCharCode(c));
                      }

                      return rows.map((rLabel) => (
                        <div key={rLabel} className="flex items-center justify-center gap-3">
                          {/* Left Row Label */}
                          <span className="w-7 text-right font-mono font-bold text-xs text-slate-400 shrink-0">
                            {rLabel}
                          </span>

                          {/* Seats in Row */}
                          <div className="flex items-center gap-2">
                            {Array.from({ length: spr }, (_, i) => i + 1).map((seatNum) => {
                              const seatId = `${currentBlock.id}-${tier.id}-${rLabel}-${seatNum}`;
                              const isSelected = selectedSeats.some((s) => s.id === seatId);
                              // Simulate a realistic 10% booked seats for demonstration
                              const isBooked = (seatNum * 7 + rLabel.charCodeAt(0)) % 11 === 0;

                              return (
                                <button
                                  key={seatNum}
                                  type="button"
                                  disabled={isBooked}
                                  onClick={() => toggleSeatSelection(currentBlock, tier, rLabel, seatNum)}
                                  className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${
                                    isSelected
                                      ? "bg-emerald-500 text-slate-950 font-extrabold shadow-md shadow-emerald-500/40 ring-2 ring-emerald-300 scale-110"
                                      : isBooked
                                      ? "bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700/50"
                                      : "bg-slate-800 hover:bg-sky-500 text-slate-300 hover:text-slate-950 border border-slate-600 hover:border-sky-400 active:scale-95"
                                  }`}
                                  title={`Row ${rLabel} · Seat ${seatNum} · ETB ${getTierPrice(tier)}`}
                                >
                                  {isSelected ? "✓" : isBooked ? "✕" : seatNum}
                                </button>
                              );
                            })}
                          </div>

                          {/* Right Row Label */}
                          <span className="w-7 text-left font-mono font-bold text-xs text-slate-400 shrink-0">
                            {rLabel}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom Cart & Order Summary Bar (Customer Experience Simulation) ── */}
        <div className="shrink-0 p-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0 flex items-center gap-1.5 font-bold">
              <ShoppingBag className="w-4 h-4" />
              <span>{selectedSeats.length} Seat(s) Selected</span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-xl">
              {selectedSeats.length === 0 ? (
                <span className="text-slate-500 text-xs italic">
                  No seats selected yet. Click any seat circle above to simulate customer booking.
                </span>
              ) : (
                selectedSeats.map((s) => (
                  <span
                    key={s.id}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold text-[11px] flex items-center gap-1.5 shrink-0"
                  >
                    <span>
                      {s.standName}: {s.row}-{s.seat}
                    </span>
                    <span className="text-emerald-400 font-extrabold">ETB {s.price}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedSeats((prev) => prev.filter((x) => x.id !== s.id))}
                      className="text-slate-400 hover:text-rose-400 ml-0.5"
                    >
                      ✕
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {selectedSeats.length > 0 && (
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Amount</span>
                <span className="text-sm font-extrabold text-emerald-400">
                  ETB {totalCartPrice.toLocaleString()}
                </span>
              </div>
            )}

            {selectedSeats.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedSeats([])}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors font-bold text-xs"
              >
                Clear
              </button>
            )}

            <button
              type="button"
              onClick={async () => {
                await onPublish();
                onClose();
              }}
              disabled={isPublishing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50 transition-all"
            >
              {isPublishing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Save & Publish Stadium</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main StadiumBlockBuilder Component ──────────────────────────────────────

export default function StadiumBlockBuilder({
  ticketTypes,
  initialConfig,
  onSave,
  saving = false,
  eventId,
  isVenueRequest = false,
  isEventOrgRequest = false,
}: {
  ticketTypes: Array<{
    id: string;
    name?: string;
    ticket_type?: string;
    price?: number;
    total_count?: number;
  }>;
  initialConfig?: StadiumSeatingConfigOutput | null;
  onSave: (config: StadiumSeatingConfigOutput, options?: { publish?: boolean }) => Promise<void>;
  saving?: boolean;
  eventId?: string;
  isVenueRequest?: boolean;
  isEventOrgRequest?: boolean;
}) {
  const [stadiumName, setStadiumName] = useState(
    initialConfig?.stadium_name ?? "National Stadium"
  );
  const [pitchLabel, setPitchLabel] = useState(
    initialConfig?.pitch_label ?? "FOOTBALL PITCH"
  );

  // Ground Configuration state (Editable Position, Size & Rotation)
  const [groundConfig, setGroundConfig] = useState<StadiumGroundConfig>(
    initialConfig?.ground
      ? { ...initialConfig.ground, enabled: initialConfig.ground.enabled !== false }
      : {
          enabled: true,
          sport_type: "football",
          pitch_label: initialConfig?.pitch_label ?? "FOOTBALL PITCH",
          turf_color: "#14532d",
          track_color: "#7f1d1d",
          shape: "rectangle",
          x: PITCH_X,
          y: PITCH_Y,
          width: PITCH_W,
          height: PITCH_H,
          rotation: 0,
        }
  );

  // Blocks (Stands) & Custom Elements State
  const [blocks, setBlocks] = useState<StadiumBlockDef[]>(
    initialConfig?.blocks ?? PRESET_BLOCKS.map((b) => ({ ...b, tiers: [defaultTier()] }))
  );
  const [elements, setElements] = useState<StadiumElementDef[]>(
    initialConfig?.elements ?? []
  );

  // Selected object ID: stand id OR "ground-pitch" OR element id
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Sidebar Tab: "stands" | "elements" | "ground"
  const [activeSidebarTab, setActiveSidebarTab] = useState<"stands" | "elements" | "ground">(
    "stands"
  );

  // Validation modal state
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);

  // Customer Preview & Publishing State
  const [showCustomerPreview, setShowCustomerPreview] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const [generateSeats, { isLoading: isGenerating }] =
    useGenerateStadiumSeatsMutation();
  const [generationStats, setGenerationStats] = useState<{
    generated: number;
    blocks: number;
    tiers: number;
  } | null>(null);

  // Canvas Stage & Zoom/Pan state
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const selectedRef = useRef<Konva.Group | null>(null);
  const selectedElementRef = useRef<Konva.Group | null>(null);
  const groundRef = useRef<Konva.Group | null>(null);

  const [stageDimensions, setStageDimensions] = useState({ width: 900, height: 600 });
  const [zoomScale, setZoomScale] = useState(0.5);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });

  // Pitch coordinates and dimensions
  const pitchX = groundConfig.x ?? PITCH_X;
  const pitchY = groundConfig.y ?? PITCH_Y;
  const pitchW = groundConfig.width ?? PITCH_W;
  const pitchH = groundConfig.height ?? PITCH_H;
  const pitchRot = groundConfig.rotation ?? 0;
  const isPitchSelected = selectedId === "ground-pitch";

  // Update container dimensions
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const w = el.clientWidth || 900;
      const h = el.clientHeight || 600;
      setStageDimensions({ width: w, height: h });
    };
    updateSize();
    const obs = new ResizeObserver(updateSize);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Fit View initially
  const resetToFitView = useCallback(() => {
    const w = stageDimensions.width;
    const h = stageDimensions.height;
    const fitScale = Math.min((w - 60) / CANVAS_W, (h - 60) / CANVAS_H, 0.75);
    const fitX = (w - CANVAS_W * fitScale) / 2;
    const fitY = (h - CANVAS_H * fitScale) / 2;

    setZoomScale(fitScale);
    setStagePosition({ x: fitX, y: fitY });

    if (stageRef.current) {
      stageRef.current.to({
        x: fitX,
        y: fitY,
        scaleX: fitScale,
        scaleY: fitScale,
        duration: 0.25,
        easing: Konva.Easings.EaseInOut,
      });
    }
  }, [stageDimensions]);

  useEffect(() => {
    resetToFitView();
  }, [resetToFitView]);

  // Connect transformer to selected block OR selected element OR ground pitch
  useEffect(() => {
    if (!trRef.current) return;
    if (selectedId === "ground-pitch" && groundRef.current) {
      trRef.current.nodes([groundRef.current]);
      trRef.current.getLayer()?.batchDraw();
    } else if (selectedId && selectedRef.current) {
      trRef.current.nodes([selectedRef.current]);
      trRef.current.getLayer()?.batchDraw();
    } else if (selectedElementId && selectedElementRef.current) {
      trRef.current.nodes([selectedElementRef.current]);
      trRef.current.getLayer()?.batchDraw();
    } else {
      trRef.current.nodes([]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selectedId, selectedElementId, blocks, elements, groundConfig]);

  // ── Delete / Remove Ground Handler ──
  const deleteGround = useCallback(() => {
    setGroundConfig((prev) => ({ ...prev, enabled: false }));
    if (selectedId === "ground-pitch") setSelectedId(null);
    toast.success("Ground section removed from layout!");
  }, [selectedId]);

  // ── Restore / Add Ground Handler ──
  const restoreGround = useCallback(() => {
    setGroundConfig((prev) => ({ ...prev, enabled: true }));
    setSelectedId("ground-pitch");
    setSelectedElementId(null);
    setActiveSidebarTab("ground");
    toast.success("Ground section added back to layout!");
  }, []);

  // ── Switch Sport Ground Handler ──
  const handleSportTypeChange = (type: StadiumGroundConfig["sport_type"] | "none") => {
    if (type === "none") {
      deleteGround();
      return;
    }

    let label = "FOOTBALL PITCH";
    let color = "#14532d";
    let track = "#7f1d1d";

    if (type === "cricket") {
      label = "CRICKET GROUND";
      color = "#15803d";
      track = "#052e16";
    } else if (type === "basketball") {
      label = "BASKETBALL ARENA COURT";
      color = "#b45309";
      track = "#0f172a";
    } else if (type === "tennis") {
      label = "CENTRE TENNIS COURT";
      color = "#1d4ed8";
      track = "#0c4a6e";
    } else if (type === "concert") {
      label = "LIVE CONCERT ARENA";
      color = "#18181b";
      track = "#030712";
    } else if (type === "festival_t_stage") {
      label = "FESTIVAL T-STAGE & ARENA";
      color = "#ffffff";
      track = "#ffffff";
    } else if (type === "custom") {
      label = "MULTI-PURPOSE FIELD";
      color = "#334155";
      track = "#1e293b";
    }

    setGroundConfig((prev) => ({
      ...prev,
      enabled: true,
      sport_type: type,
      pitch_label: label,
      stage_label: type === "festival_t_stage" ? (prev.stage_label || "MAIN STAGE") : prev.stage_label,
      catwalk_label: type === "festival_t_stage" ? (prev.catwalk_label || "") : prev.catwalk_label,
      turf_color: color,
      track_color: track,
      shape: type === "cricket" ? "oval" : "rectangle",
    }));
    setPitchLabel(label);
    toast.info(`Switched sport ground to ${type === "festival_t_stage" ? "FESTIVAL T-STAGE" : type.toUpperCase()} layout!`);
  };

  // ── Mouse Wheel Zoom at Cursor Pointer ──
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const scaleBy = 1.08;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.max(
      0.15,
      Math.min(3.5, direction > 0 ? oldScale * scaleBy : oldScale / scaleBy)
    );

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    stage.scale({ x: newScale, y: newScale });
    stage.position(newPos);
    stage.batchDraw();

    setZoomScale(newScale);
    setStagePosition(newPos);
  };

  const zoomIn = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const newScale = Math.min(3.5, oldScale * 1.25);
    const center = { x: stage.width() / 2, y: stage.height() / 2 };
    const mousePointTo = {
      x: (center.x - stage.x()) / oldScale,
      y: (center.y - stage.y()) / oldScale,
    };
    const newPos = {
      x: center.x - mousePointTo.x * newScale,
      y: center.y - mousePointTo.y * newScale,
    };
    stage.to({
      scaleX: newScale,
      scaleY: newScale,
      x: newPos.x,
      y: newPos.y,
      duration: 0.2,
    });
    setZoomScale(newScale);
    setStagePosition(newPos);
  };

  const zoomOut = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const newScale = Math.max(0.15, oldScale / 1.25);
    const center = { x: stage.width() / 2, y: stage.height() / 2 };
    const mousePointTo = {
      x: (center.x - stage.x()) / oldScale,
      y: (center.y - stage.y()) / oldScale,
    };
    const newPos = {
      x: center.x - mousePointTo.x * newScale,
      y: center.y - mousePointTo.y * newScale,
    };
    stage.to({
      scaleX: newScale,
      scaleY: newScale,
      x: newPos.x,
      y: newPos.y,
      duration: 0.2,
    });
    setZoomScale(newScale);
    setStagePosition(newPos);
  };

  // ── Real-Time Ticket Type Capacity Reconciliation ──
  const ticketTypeCapacities = useMemo(() => {
    return ticketTypes.map((tt) => {
      const organizerTarget = Number(tt.total_count) || 0;
      let layoutSeats = 0;

      blocks.forEach((b) => {
        const isDirect = b.seating_type === "direct" || !b.tiers || b.tiers.length <= 1;
        if (isDirect) {
          const directTicket = b.ticket_type_id || b.tiers?.[0]?.ticket_type_id;
          if (directTicket === tt.id) {
            layoutSeats += computeBlockSeatCount(b);
          }
        } else {
          b.tiers.forEach((t) => {
            if (t.ticket_type_id === tt.id) {
              layoutSeats += computeTierSeatCount(t);
            }
          });
        }
      });

      return {
        ...tt,
        organizerTarget,
        layoutSeats,
        isMatched: organizerTarget > 0 && layoutSeats === organizerTarget,
        isOver: organizerTarget > 0 && layoutSeats > organizerTarget,
        isUnder: organizerTarget > 0 && layoutSeats < organizerTarget,
        diff: layoutSeats - organizerTarget,
      };
    });
  }, [ticketTypes, blocks]);

  const totalOrganizerCapacity = useMemo(() => {
    return ticketTypes.reduce(
      (sum, tt) => sum + (Number(tt.total_count) || 0),
      0
    );
  }, [ticketTypes]);

  const totalEstSeats = useMemo(() => {
    return blocks.reduce((acc, b) => acc + computeBlockSeatCount(b), 0);
  }, [blocks]);

  const unassignedTiersCount = useMemo(() => {
    return blocks.reduce((acc, b) => {
      const isDirect = b.seating_type === "direct" || !b.tiers || b.tiers.length <= 1;
      if (isDirect) {
        return acc + (b.ticket_type_id || b.tiers?.[0]?.ticket_type_id ? 0 : 1);
      }
      return acc + b.tiers.filter((t) => !t.ticket_type_id).length;
    }, 0);
  }, [blocks]);

  // ── Auto-Build Layout directly from Organizer Ticket Types ──
  const handleAutoBuildFromTickets = () => {
    if (ticketTypes.length === 0) {
      toast.error("No ticket types found on this event. Please create ticket types first.");
      return;
    }

    const generatedBlocks: StadiumBlockDef[] = [];
    const positions = [
      { id: "north-stand", name: "North Stand", x: pitchX, y: 40, w: pitchW, h: 130 },
      { id: "south-stand", name: "South Stand", x: pitchX, y: CANVAS_H - 170, w: pitchW, h: 130 },
      { id: "east-stand", name: "East Stand", x: CANVAS_W - 170, y: pitchY, w: 130, h: pitchH },
      { id: "west-stand", name: "West Stand", x: 40, y: pitchY, w: 130, h: pitchH },
      { id: "vip-box", name: "VIP Pavilion", x: pitchX + pitchW * 0.35, y: 190, w: pitchW * 0.3, h: 60 },
    ];

    ticketTypes.forEach((tt, idx) => {
      const target = Number(tt.total_count) || 200;
      const fitted = autoFitRowsAndSeats(target);
      const pos = positions[idx % positions.length];
      const color = BLOCK_COLORS[idx % BLOCK_COLORS.length];

      const initialBlock: StadiumBlockDef = {
        id: `stand-${tt.id.slice(0, 6)}`,
        name: tt.name || tt.ticket_type || pos.name,
        color,
        x: pos.x,
        y: pos.y,
        width: pos.w,
        height: pos.h,
        rotation: 0,
        capacity: target,
        seating_type: "direct",
        ticket_type_id: tt.id,
        row_start: fitted.rowStart,
        row_end: fitted.rowEnd,
        seats_per_row: fitted.seatsPerRow,
        tiers: [
          {
            id: makeId(),
            name: `${tt.name || tt.ticket_type || "General"} Tier`,
            ticket_type_id: tt.id,
            row_start: fitted.rowStart,
            row_end: fitted.rowEnd,
            seats_per_row: fitted.seatsPerRow,
          },
        ],
      };

      const dims = calculateOptimalBlockDimensions(initialBlock, pitchW, pitchH);
      let posX = pos.x;
      let posY = pos.y;

      if (pos.id === "north-stand") {
        posX = pitchX + (pitchW - dims.width) / 2;
        posY = Math.max(20, pitchY - dims.height - 20);
      } else if (pos.id === "south-stand") {
        posX = pitchX + (pitchW - dims.width) / 2;
        posY = pitchY + pitchH + 20;
      } else if (pos.id === "east-stand") {
        posX = pitchX + pitchW + 20;
        posY = pitchY + (pitchH - dims.height) / 2;
      } else if (pos.id === "west-stand") {
        posX = Math.max(20, pitchX - dims.width - 20);
        posY = pitchY + (pitchH - dims.height) / 2;
      } else if (pos.id === "vip-box") {
        posX = pitchX + (pitchW - dims.width) / 2;
        posY = pitchY + 30;
      }

      generatedBlocks.push({
        ...initialBlock,
        x: Math.max(10, Math.min(CANVAS_W - dims.width - 10, Math.round(posX))),
        y: Math.max(10, Math.min(CANVAS_H - dims.height - 10, Math.round(posY))),
        width: dims.width,
        height: dims.height,
      });
    });

    setBlocks(generatedBlocks);
    setSelectedId(null);
    toast.success(`🎉 Auto-generated ${generatedBlocks.length} stands with auto-fitted dimensions!`);
  };

  // ── Auto-Adjust All Stand Sizes to match seat capacities ──
  const handleAutoAdjustAllStandSizes = () => {
    if (blocks.length === 0) {
      toast.error("No stands on canvas to adjust.");
      return;
    }

    setBlocks((prev) =>
      prev.map((b) => {
        const dims = calculateOptimalBlockDimensions(b, pitchW, pitchH);
        let newX = b.x;
        let newY = b.y;

        if (b.shape !== "arc") {
          // If stand is above pitch
          if (b.y < pitchY && b.y + b.height <= pitchY + 30) {
            newX = pitchX + (pitchW - dims.width) / 2;
            newY = Math.max(20, pitchY - dims.height - 20);
          }
          // If stand is below pitch
          else if (b.y >= pitchY + pitchH - 30) {
            newX = pitchX + (pitchW - dims.width) / 2;
            newY = pitchY + pitchH + 20;
          }
          // If stand is left of pitch
          else if (b.x < pitchX && b.x + b.width <= pitchX + 30) {
            newX = Math.max(20, pitchX - dims.width - 20);
            newY = pitchY + (pitchH - dims.height) / 2;
          }
          // If stand is right of pitch
          else if (b.x >= pitchX + pitchW - 30) {
            newX = pitchX + pitchW + 20;
            newY = pitchY + (pitchH - dims.height) / 2;
          } else {
            // General: keep centered on current position
            newX = Math.round(b.x + (b.width - dims.width) / 2);
            newY = Math.round(b.y + (b.height - dims.height) / 2);
          }
        }

        return {
          ...b,
          x: Math.max(10, Math.min(CANVAS_W - dims.width - 10, newX)),
          y: Math.max(10, Math.min(CANVAS_H - dims.height - 10, newY)),
          width: dims.width,
          height: dims.height,
          innerRadius: dims.innerRadius ?? b.innerRadius,
          outerRadius: dims.outerRadius ?? b.outerRadius,
          sweepAngle: dims.sweepAngle ?? b.sweepAngle,
        };
      })
    );
    toast.success("⚡ All stand dimensions auto-adjusted proportionally to seat capacities!");
  };

  // Auto-fit all tiers
  const handleAutoFitAllTiers = () => {
    setBlocks((prev) =>
      prev.map((b) => ({
        ...b,
        tiers: b.tiers.map((t) => {
          const tt = ticketTypes.find((item) => item.id === t.ticket_type_id);
          const target = Number(tt?.total_count) || 0;
          if (target > 0) {
            const fitted = autoFitRowsAndSeats(target);
            return {
              ...t,
              row_start: fitted.rowStart,
              row_end: fitted.rowEnd,
              seats_per_row: fitted.seatsPerRow,
            };
          }
          return t;
        }),
      }))
    );
    setShowValidationModal(false);
    toast.success("All tiers auto-fitted to match organizer ticket capacities!");
  };

  // Add block manually
  const addBlock = () => {
    const colorIdx = blocks.length % BLOCK_COLORS.length;
    const defaultTicket = ticketTypes[0]?.id || "";
    const newBlock: StadiumBlockDef = {
      id: makeId(),
      name: `Stand ${blocks.length + 1}`,
      color: BLOCK_COLORS[colorIdx],
      x: 300 + (blocks.length % 5) * 40,
      y: 300 + (blocks.length % 5) * 40,
      width: 220,
      height: 120,
      rotation: 0,
      capacity: 1000,
      tiers: [
        {
          id: makeId(),
          name: "Main Tier",
          ticket_type_id: defaultTicket,
          row_start: "A",
          row_end: "J",
          seats_per_row: 25,
        },
      ],
    };
    setBlocks((p) => [...p, newBlock]);
    setSelectedId(newBlock.id);
    setSelectedElementId(null);
    setActiveSidebarTab("stands");
  };

  // Add custom element
  const addElement = (
    type: StadiumElementDef["type"],
    name: string,
    color: string,
    w = 160,
    h = 80,
    icon?: string
  ) => {
    const newEl: StadiumElementDef = {
      id: makeId(),
      name,
      type,
      color,
      icon,
      x: pitchX + pitchW / 2 - w / 2,
      y: pitchY + pitchH / 2 - h / 2,
      width: w,
      height: h,
      rotation: 0,
      shape: "rectangle",
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedElementId(newEl.id);
    setSelectedId(null);
    setActiveSidebarTab("elements");
    toast.success(`Added ${name} to stadium map!`);
  };

  const updateBlock = useCallback((updated: StadiumBlockDef) => {
    setBlocks((p) => p.map((b) => (b.id === updated.id ? updated : b)));
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setBlocks((p) => p.filter((b) => b.id !== id));
    setSelectedId((s) => (s === id ? null : s));
  }, []);

  const updateElement = useCallback((updated: StadiumElementDef) => {
    setElements((prev) => prev.map((el) => (el.id === updated.id ? updated : el)));
  }, []);

  const deleteElement = useCallback((id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    setSelectedElementId((s) => (s === id ? null : s));
  }, []);

  // ── STRICT VALIDATION ──
  // Per requirement: When venue requests stadium layout, NO validation check is performed.
  // Validation is only enforced when an event organizer requests a custom layout (isEventOrgRequest).
  const performStrictValidation = (): { isValid: boolean; errors: string[] } => {
    if (isVenueRequest || !isEventOrgRequest) {
      return { isValid: true, errors: [] };
    }

    const errors: string[] = [];

    if (blocks.length === 0) {
      errors.push("No stadium stands exist. Please add at least one stand or click 'Auto-Build from Tickets'.");
      return { isValid: false, errors };
    }

    blocks.forEach((b) => {
      const isDirect = b.seating_type === "direct" || !b.tiers || b.tiers.length <= 1;
      if (isDirect) {
        const ticketId = b.ticket_type_id || b.tiers?.[0]?.ticket_type_id;
        if (!ticketId) {
          errors.push(
            `Stand "${b.name}" has NO ticket type assigned. Please choose an organizer ticket type.`
          );
        }
        const seatCount = computeBlockSeatCount(b);
        if (seatCount <= 0) {
          errors.push(`Stand "${b.name}" has an invalid configuration (0 seats).`);
        }
      } else {
        if (b.tiers.length === 0) {
          errors.push(`Stand "${b.name}" has no tiers. Add at least one tier to define seats.`);
        }
        b.tiers.forEach((t) => {
          if (!t.ticket_type_id) {
            errors.push(
              `Tier "${t.name}" in Stand "${b.name}" has NO ticket type assigned. Please link it to an organizer ticket type.`
            );
          }
          const tSeats = computeTierSeatCount(t);
          if (tSeats <= 0) {
            errors.push(
              `Tier "${t.name}" in Stand "${b.name}" has an invalid configuration (0 seats).`
            );
          }
        });
      }
    });

    ticketTypes.forEach((tt) => {
      const target = Number(tt.total_count) || 0;
      if (target > 0) {
        let layoutSeats = 0;
        blocks.forEach((b) => {
          const isDirect = b.seating_type === "direct" || !b.tiers || b.tiers.length <= 1;
          if (isDirect) {
            const ticketId = b.ticket_type_id || b.tiers?.[0]?.ticket_type_id;
            if (ticketId === tt.id) {
              layoutSeats += computeBlockSeatCount(b);
            }
          } else {
            b.tiers.forEach((t) => {
              if (t.ticket_type_id === tt.id) {
                layoutSeats += computeTierSeatCount(t);
              }
            });
          }
        });

        if (layoutSeats === 0) {
          errors.push(
            `Ticket Type "${tt.name || tt.ticket_type}" (Capacity: ${target}) has 0 seats in the layout. Please assign it to a stand or tier.`
          );
        } else if (layoutSeats !== target) {
          const diff = layoutSeats - target;
          errors.push(
            `Ticket Type "${tt.name || tt.ticket_type}" capacity mismatch: Organizer specified ${target} tickets, but layout has ${layoutSeats} seats configured (${diff > 0 ? `+${diff} over capacity` : `${diff} seats missing`}).`
          );
        }
      }
    });

    return { isValid: errors.length === 0, errors };
  };

  const handleSaveAndGenerate = async (options?: { publish?: boolean }) => {
    if (!isVenueRequest && isEventOrgRequest) {
      const { isValid, errors } = performStrictValidation();

      if (!isValid) {
        setValidationErrors(errors);
        setShowValidationModal(true);
        toast.error(`Cannot submit: ${errors.length} validation issue(s) detected. Check the alert modal.`);
        return;
      }
    }

    const config: StadiumSeatingConfigOutput = {
      layout_mode: "stadium",
      canvasWidth: CANVAS_W,
      canvasHeight: CANVAS_H,
      stadium_name: stadiumName,
      pitch_label: groundConfig.pitch_label || pitchLabel,
      ground: groundConfig,
      blocks,
      elements,
    };

    await onSave(config, options);

    if (eventId && !isVenueRequest) {
      try {
        const res = await generateSeats({
          eventId,
          seating_config: config,
          replace: true,
        }).unwrap();
        setGenerationStats({
          generated: res.generated,
          blocks: res.blocks,
          tiers: res.tiers,
        });
        if (options?.publish) {
          toast.success(
            `🚀 Stadium layout published successfully! Generated ${res.generated.toLocaleString()} seats across ${res.blocks} stands for live booking.`
          );
        } else {
          toast.success(
            `🎉 Generated ${res.generated.toLocaleString()} seats across ${res.blocks} stands!`
          );
        }
      } catch (err: any) {
        toast.error(
          err?.data?.error || err?.message || "Failed to generate stadium seats."
        );
      }
    } else {
      if (options?.publish) {
        toast.success("🚀 Stadium layout published successfully!");
      } else {
        toast.success("Stadium layout saved successfully!");
      }
    }
  };

  const handlePublish = async () => {
    try {
      setIsPublishing(true);
      await handleSaveAndGenerate({ publish: true });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleOptimizeSpacingAntiOverlap = () => {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id === "euro-north") {
          return {
            ...block,
            x: 540,
            y: 155,
            width: 520,
            height: 185,
            tiers: block.tiers.map((t) => ({
              ...t,
              seats_per_row: Math.min(t.seats_per_row || 24, 24),
            })),
          };
        }
        if (block.id === "euro-south") {
          return {
            ...block,
            x: 540,
            y: 860,
            width: 520,
            height: 185,
            tiers: block.tiers.map((t) => ({
              ...t,
              seats_per_row: Math.min(t.seats_per_row || 24, 24),
            })),
          };
        }
        if (block.id === "euro-west") {
          return {
            ...block,
            x: 235,
            y: 440,
            width: 195,
            height: 320,
            tiers: block.tiers.map((t) => ({
              ...t,
              seats_per_row: Math.min(t.seats_per_row || 18, 18),
            })),
          };
        }
        if (block.id === "euro-east") {
          return {
            ...block,
            x: 1170,
            y: 440,
            width: 195,
            height: 320,
            tiers: block.tiers.map((t) => ({
              ...t,
              seats_per_row: Math.min(t.seats_per_row || 18, 18),
            })),
          };
        }
        if (block.id === "euro-corner-nw") {
          return {
            ...block,
            startAngle: 205,
            sweepAngle: 22,
            innerRadius: 440,
            outerRadius: 575,
            tiers: block.tiers.map((t) => ({
              ...t,
              seats_per_row: Math.min(t.seats_per_row || 10, 10),
            })),
          };
        }
        if (block.id === "euro-corner-ne") {
          return {
            ...block,
            startAngle: 313,
            sweepAngle: 22,
            innerRadius: 440,
            outerRadius: 575,
            tiers: block.tiers.map((t) => ({
              ...t,
              seats_per_row: Math.min(t.seats_per_row || 10, 10),
            })),
          };
        }
        if (block.id === "euro-corner-se") {
          return {
            ...block,
            startAngle: 25,
            sweepAngle: 22,
            innerRadius: 440,
            outerRadius: 575,
            tiers: block.tiers.map((t) => ({
              ...t,
              seats_per_row: Math.min(t.seats_per_row || 10, 10),
            })),
          };
        }
        if (block.id === "euro-corner-sw") {
          return {
            ...block,
            startAngle: 133,
            sweepAngle: 22,
            innerRadius: 440,
            outerRadius: 575,
            tiers: block.tiers.map((t) => ({
              ...t,
              seats_per_row: Math.min(t.seats_per_row || 10, 10),
            })),
          };
        }
        return {
          ...block,
          tiers: block.tiers.map((t) => ({
            ...t,
            seats_per_row: Math.min(t.seats_per_row || 14, 14),
            row_end:
              (t.row_start || "A") === "A" && t.row_end && t.row_end > "E"
                ? "D"
                : t.row_end || "D",
          })),
        };
      })
    );
    toast.success("🛡️ Stand capacities & spacing optimized! Zero overlap across all sections.");
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-white rounded-2xl overflow-hidden border border-slate-800 select-none relative">
      {/* ── Top Bar: Stadium Settings & Actions (Fixed Header) ── */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 p-3.5 border-b border-slate-800 bg-slate-900 z-30">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
            <Grid3X3 className="w-5 h-5" />
          </div>

          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
            <div>
              <label className="text-xs uppercase font-extrabold text-slate-300 block mb-1">
                Stadium Name
              </label>
              <input
                className="text-xs font-bold bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400 w-44"
                value={stadiumName}
                onChange={(e) => setStadiumName(e.target.value)}
                placeholder="Stadium Name"
              />
            </div>

            <div>
              <label className="text-xs uppercase font-extrabold text-slate-300 block mb-1">
                Sport Ground
              </label>
              <select
                className="text-xs font-bold bg-slate-800 text-amber-400 border border-slate-600 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
                value={groundConfig.enabled === false ? "none" : groundConfig.sport_type}
                onChange={(e) => handleSportTypeChange(e.target.value as any)}
              >
                <option value="football">⚽ Football / Soccer Pitch</option>
                <option value="cricket">🏏 Cricket Ground Oval</option>
                <option value="basketball">🏀 Basketball / Arena Court</option>
                <option value="tennis">🎾 Tennis Court</option>
                <option value="concert">🎤 Concert Arena & Stage</option>
                <option value="festival_t_stage">🎸 Festival T-Stage (Stage, Fan Pit, Platinum, Gold, Silver)</option>
                <option value="custom">🔲 Custom Pitch</option>
                <option value="none">🚫 No Ground Section (Remove / Hide)</option>
              </select>
            </div>

            {/* Quick Pitch Edit / Add / Delete Buttons */}
            <div>
              <label className="text-xs uppercase font-extrabold text-slate-300 block mb-1">
                Ground Mode
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (groundConfig.enabled === false) {
                      restoreGround();
                    } else if (isPitchSelected) {
                      setSelectedId(null);
                    } else {
                      setSelectedId("ground-pitch");
                      setSelectedElementId(null);
                      setActiveSidebarTab("ground");
                    }
                  }}
                  className={`flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-lg border transition-all active:scale-95 ${groundConfig.enabled === false
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20"
                    : isPitchSelected
                    ? "bg-sky-500 text-slate-950 border-sky-400 shadow-md shadow-sky-500/20"
                    : "bg-slate-800 hover:bg-slate-700 text-sky-400 border-slate-600"
                    }`}
                  title={groundConfig.enabled === false ? "Ground is deleted/hidden. Click to restore" : "Click to select pitch and move/resize on canvas"}
                >
                  {groundConfig.enabled === false ? (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Ground Section</span>
                    </>
                  ) : (
                    <>
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>{isPitchSelected ? "Pitch Active" : "Edit Pitch Section"}</span>
                    </>
                  )}
                </button>
                {groundConfig.enabled !== false && (
                  <button
                    type="button"
                    onClick={deleteGround}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-400 border border-slate-600 hover:border-rose-700 transition-colors"
                    title="Delete / Remove Ground Section"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Add Element Dropdown */}
            <div>
              <label className="text-xs uppercase font-extrabold text-slate-300 block mb-1">
                + Add Element
              </label>
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value === "stage") addElement("stage", "Main Stage", "#9333ea", 220, 90, "🎤");
                  if (e.target.value === "screen") addElement("screen", "Giant Screen", "#2563eb", 140, 50, "📺");
                  if (e.target.value === "gate") addElement("gate", "Main Gate", "#059669", 110, 40, "🚪");
                  if (e.target.value === "dugout") addElement("dugout", "Player Dugout", "#ea580c", 130, 45, "⚽");
                  if (e.target.value === "lounge") addElement("lounge", "VIP Hospitality Lounge", "#d97706", 180, 70, "🛋️");
                  if (e.target.value === "food") addElement("amenity", "Food Court", "#dc2626", 130, 50, "🍔");
                  if (e.target.value === "custom") addElement("custom", "Custom Area", "#475569", 140, 60, "★");
                  e.target.value = "";
                }}
                className="text-xs font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-700/80 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
              >
                <option value="">✨ Add Element / Feature...</option>
                <option value="stage">🎤 Concert Stage</option>
                <option value="screen">📺 Giant Screen / Jumbotron</option>
                <option value="gate">🚪 Entrance Gate / Turnstile</option>
                <option value="dugout">⚽ Player Dugout Benches</option>
                <option value="lounge">🛋️ VIP Lounge & Bar</option>
                <option value="food">🍔 Food Court / Concessions</option>
                <option value="custom">★ Custom Zone / Label</option>
              </select>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {ticketTypes.length > 0 && (
            <button
              type="button"
              onClick={handleAutoBuildFromTickets}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md shadow-indigo-600/20 active:scale-95"
              title="Automatically creates and balances stands for every ticket type added by organizer!"
            >
              <Wand2 className="w-4 h-4" />
              <span>Auto-Build from Tickets</span>
            </button>
          )}

          {blocks.length > 0 && (
            <button
              type="button"
              onClick={handleAutoAdjustAllStandSizes}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md shadow-amber-500/20 active:scale-95"
              title="Automatically adjusts width & height of all stands proportionally based on their seats and rows!"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Auto-Adjust Sizes</span>
            </button>
          )}

          {blocks.length > 0 && (
            <button
              type="button"
              onClick={handleOptimizeSpacingAntiOverlap}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold text-xs px-3 py-2 rounded-xl transition-all active:scale-95"
              title="Adjusts all stands to clean, comfortable seat densities so customer-side seat dots never overlap"
            >
              <span>🛡️ Anti-Overlap Seats</span>
            </button>
          )}

          {/* Customer Side View Simulation Button */}
          <button
            type="button"
            onClick={() => setShowCustomerPreview(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-sky-600 via-indigo-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md shadow-sky-600/30 active:scale-95 shrink-0 ring-1 ring-sky-400/30"
            title="Preview how customers view, explore stands, and select seats on this stadium layout"
          >
            <Eye className="w-4 h-4" />
            <span>Customer Preview</span>
          </button>

          <button
            type="button"
            onClick={() => void handleSaveAndGenerate()}
            disabled={saving || isGenerating || isPublishing}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-extrabold text-xs px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95 shrink-0 disabled:opacity-50"
          >
            {saving || isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{eventId ? "Save & Generate" : "Save Config"}</span>
          </button>

          {/* Direct Publish Layout Button */}
          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={saving || isGenerating || isPublishing}
            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-600/30 active:scale-95 shrink-0 disabled:opacity-50"
            title="Save, generate all seats and publish layout live for ticket buyers"
          >
            {isPublishing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>🚀 Publish Layout</span>
          </button>

          {eventId && (
            <a
              href={`/events/${eventId}`}
              target="_blank"
              rel="noreferrer"
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Preview Stadium on Public Event Page"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* ── Capacity Reconciliation Dashboard Bar (Fixed) ── */}
      {!isVenueRequest && isEventOrgRequest && ticketTypes.length > 0 && (
        <div className="shrink-0 bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs z-20">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-slate-200 uppercase tracking-wider text-xs">
              Organizer Capacity Reconciliation:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {ticketTypeCapacities.map((tt) => (
                <div
                  key={tt.id}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold transition-all ${tt.isMatched
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : tt.isOver
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    }`}
                >
                  <span>{tt.name || tt.ticket_type}:</span>
                  <strong className="font-mono text-white text-sm">
                    {tt.layoutSeats}/{tt.organizerTarget}
                  </strong>
                  {tt.isMatched ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : tt.isOver ? (
                    <span className="text-xs text-rose-400 font-extrabold">
                      (+{tt.diff} over)
                    </span>
                  ) : (
                    <span className="text-xs text-amber-400 font-extrabold">
                      ({tt.diff} short)
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 text-slate-300 text-xs font-semibold">
            <span>
              Total Configured:{" "}
              <strong className="text-white font-mono text-sm">{totalEstSeats.toLocaleString()}</strong> /{" "}
              <strong className="text-amber-400 font-mono text-sm">
                {totalOrganizerCapacity.toLocaleString()}
              </strong>{" "}
              tickets
            </span>
            {totalOrganizerCapacity > 0 && totalEstSeats === totalOrganizerCapacity ? (
              <span className="text-emerald-400 font-extrabold flex items-center gap-1 bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                <Check className="w-4 h-4" /> 100% Balanced
              </span>
            ) : (
              <button
                type="button"
                onClick={handleAutoFitAllTiers}
                className="text-xs text-amber-400 hover:text-amber-300 underline font-extrabold"
              >
                Auto-Fit All
              </button>
            )}
          </div>
        </div>
      )}

      {generationStats && (
        <div className="shrink-0 bg-emerald-950/80 border-b border-emerald-800 px-4 py-2.5 flex items-center justify-between text-xs text-emerald-300 z-20">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Check className="w-5 h-5 text-emerald-400" />
            <span>
              Seats Successfully Generated: <strong>{generationStats.generated.toLocaleString()} seats</strong> across {generationStats.blocks} stands and {generationStats.tiers} tiers!
            </span>
          </div>
          <span
            className="text-xs text-emerald-400 underline cursor-pointer hover:text-emerald-300 font-bold"
            onClick={() => setGenerationStats(null)}
          >
            Dismiss
          </span>
        </div>
      )}

      {/* ── Main Canvas & High-Visibility Right Sidebar ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Canvas Area with Mouse Wheel Zoom & Floating Controls */}
        <div
          ref={containerRef}
          className="flex-1 min-w-0 h-full relative overflow-hidden flex flex-col bg-[#061009] cursor-grab active:cursor-grabbing"
        >
          <Stage
            ref={stageRef}
            width={stageDimensions.width}
            height={stageDimensions.height}
            draggable
            onWheel={handleWheel}
            onDragEnd={(e) => {
              if (e.target === stageRef.current) {
                setStagePosition({ x: e.target.x(), y: e.target.y() });
              }
            }}
            onClick={(e) => {
              if (e.target === e.target.getStage()) {
                setSelectedId(null);
                setSelectedElementId(null);
              }
            }}
          >
            <Layer>
              {/* Outer Concourse Track */}
              <Rect
                x={0}
                y={0}
                width={CANVAS_W}
                height={CANVAS_H}
                fill="#06120b"
                perfectDrawEnabled={false}
              />

              {/* ── Ground / Pitch Section (Fully Editable, Draggable & Resizable) ── */}
              {groundConfig.enabled !== false && (
                <Group
                  ref={isPitchSelected ? (n) => { groundRef.current = n; } : undefined}
                  x={pitchX + pitchW / 2}
                  y={pitchY + pitchH / 2}
                  offsetX={pitchW / 2}
                  offsetY={pitchH / 2}
                  rotation={pitchRot}
                  draggable
                  onClick={(e) => {
                    e.cancelBubble = true;
                    setSelectedId("ground-pitch");
                    setSelectedElementId(null);
                    setActiveSidebarTab("ground");
                  }}
                onTap={(e) => {
                  e.cancelBubble = true;
                  setSelectedId("ground-pitch");
                  setSelectedElementId(null);
                  setActiveSidebarTab("ground");
                }}
                onDragEnd={(e) => {
                  const node = e.target;
                  setGroundConfig((prev) => ({
                    ...prev,
                    x: Math.round(node.x() - pitchW / 2),
                    y: Math.round(node.y() - pitchH / 2),
                  }));
                }}
                onTransformEnd={(e) => {
                  const node = e.target;
                  const scaleX = node.scaleX();
                  const scaleY = node.scaleY();
                  node.scaleX(1);
                  node.scaleY(1);
                  const newW = Math.round(Math.max(160, pitchW * scaleX));
                  const newH = Math.round(Math.max(120, pitchH * scaleY));
                  setGroundConfig((prev) => ({
                    ...prev,
                    x: Math.round(node.x() - newW / 2),
                    y: Math.round(node.y() - newH / 2),
                    width: newW,
                    height: newH,
                    rotation: Math.round(node.rotation()),
                  }));
                }}
              >
                {/* Running Track / Arena Surround */}
                <Rect
                  x={-50}
                  y={-50}
                  width={pitchW + 100}
                  height={pitchH + 100}
                  fill={
                    groundConfig.track_color ||
                    (groundConfig.sport_type === "cricket"
                      ? "#052e16"
                      : groundConfig.sport_type === "basketball"
                        ? "#0f172a"
                        : groundConfig.sport_type === "tennis"
                          ? "#0c4a6e"
                          : groundConfig.sport_type === "festival_t_stage"
                            ? (groundConfig.turf_color || "#ffffff")
                            : groundConfig.sport_type === "concert"
                              ? "#020617"
                              : "#7f1d1d")
                  }
                  stroke={isPitchSelected ? "#38bdf8" : (groundConfig.sport_type === "festival_t_stage" && (groundConfig.turf_color === "#ffffff" || !groundConfig.turf_color)) ? "#e2e8f0" : "rgba(255,255,255,0.15)"}
                  strokeWidth={isPitchSelected ? 3.5 : 1.5}
                  cornerRadius={groundConfig.sport_type === "cricket" ? (pitchW + 100) / 2 : 40}
                  perfectDrawEnabled={false}
                />

                {/* ── Dynamic Sports Ground Visuals ── */}
                {groundConfig.sport_type === "cricket" ? (
                  // 🏏 1. CRICKET GROUND OVAL
                  <>
                    <Ellipse
                      x={pitchW / 2}
                      y={pitchH / 2}
                      radiusX={pitchW * 0.48}
                      radiusY={pitchH * 0.48}
                      fill={groundConfig.turf_color || "#15803d"}
                      stroke="#ffffff"
                      strokeWidth={3}
                      perfectDrawEnabled={false}
                    />
                    {/* 30-yard inner circle */}
                    <Circle
                      x={pitchW / 2}
                      y={pitchH / 2}
                      radius={pitchH * 0.28}
                      stroke="#ffffff"
                      strokeWidth={2}
                      dash={[8, 8]}
                      perfectDrawEnabled={false}
                    />
                    {/* Center Pitch Wicket Strip */}
                    <Rect
                      x={pitchW / 2 - 25}
                      y={pitchH / 2 - 80}
                      width={50}
                      height={160}
                      fill="#ca8a04"
                      stroke="#a16207"
                      strokeWidth={2}
                      cornerRadius={4}
                      perfectDrawEnabled={false}
                    />
                    {/* Bowling & Batting Creases */}
                    <Line
                      points={[pitchW / 2 - 25, pitchH / 2 - 60, pitchW / 2 + 25, pitchH / 2 - 60]}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                    <Line
                      points={[pitchW / 2 - 25, pitchH / 2 + 60, pitchW / 2 + 25, pitchH / 2 + 60]}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                    <Circle x={pitchW / 2} y={pitchH / 2 - 68} radius={3} fill="#ffffff" />
                    <Circle x={pitchW / 2} y={pitchH / 2 + 68} radius={3} fill="#ffffff" />
                  </>
                ) : groundConfig.sport_type === "basketball" ? (
                  // 🏀 2. BASKETBALL ARENA COURT
                  <>
                    <Rect
                      x={0}
                      y={0}
                      width={pitchW}
                      height={pitchH}
                      fill={groundConfig.turf_color || "#b45309"}
                      stroke="#f59e0b"
                      strokeWidth={4}
                      cornerRadius={12}
                    />
                    {Array.from({ length: 12 }).map((_, i) => (
                      <Line
                        key={`bb-plank-${i}`}
                        points={[0, (i * pitchH) / 12, pitchW, (i * pitchH) / 12]}
                        stroke="rgba(0,0,0,0.08)"
                        strokeWidth={1}
                      />
                    ))}
                    <Line
                      points={[0, pitchH / 2, pitchW, pitchH / 2]}
                      stroke="#ffffff"
                      strokeWidth={3}
                    />
                    <Circle
                      x={pitchW / 2}
                      y={pitchH / 2}
                      radius={pitchH * 0.18}
                      stroke="#ffffff"
                      strokeWidth={3}
                    />
                    <Rect
                      x={pitchW * 0.35}
                      y={0}
                      width={pitchW * 0.3}
                      height={pitchH * 0.25}
                      fill="rgba(255,255,255,0.1)"
                      stroke="#ffffff"
                      strokeWidth={3}
                    />
                    <Circle
                      x={pitchW / 2}
                      y={pitchH * 0.25}
                      radius={pitchW * 0.12}
                      stroke="#ffffff"
                      strokeWidth={2}
                      dash={[6, 6]}
                    />
                    <Rect
                      x={pitchW * 0.35}
                      y={pitchH - pitchH * 0.25}
                      width={pitchW * 0.3}
                      height={pitchH * 0.25}
                      fill="rgba(255,255,255,0.1)"
                      stroke="#ffffff"
                      strokeWidth={3}
                    />
                    <Circle
                      x={pitchW / 2}
                      y={pitchH - pitchH * 0.25}
                      radius={pitchW * 0.12}
                      stroke="#ffffff"
                      strokeWidth={2}
                      dash={[6, 6]}
                    />
                    <Circle x={pitchW / 2} y={20} radius={10} stroke="#ea580c" strokeWidth={3} />
                    <Circle x={pitchW / 2} y={pitchH - 20} radius={10} stroke="#ea580c" strokeWidth={3} />
                  </>
                ) : groundConfig.sport_type === "tennis" ? (
                  // 🎾 3. TENNIS COURT
                  <>
                    <Rect
                      x={0}
                      y={0}
                      width={pitchW}
                      height={pitchH}
                      fill={groundConfig.turf_color || "#1d4ed8"}
                      stroke="#ffffff"
                      strokeWidth={4}
                      cornerRadius={8}
                    />
                    <Rect
                      x={45}
                      y={35}
                      width={pitchW - 90}
                      height={pitchH - 70}
                      stroke="#ffffff"
                      strokeWidth={3}
                    />
                    <Line points={[110, 35, 110, pitchH - 35]} stroke="#ffffff" strokeWidth={2.5} />
                    <Line points={[pitchW - 110, 35, pitchW - 110, pitchH - 35]} stroke="#ffffff" strokeWidth={2.5} />
                    <Line points={[110, pitchH * 0.28, pitchW - 110, pitchH * 0.28]} stroke="#ffffff" strokeWidth={2.5} />
                    <Line points={[110, pitchH * 0.72, pitchW - 110, pitchH * 0.72]} stroke="#ffffff" strokeWidth={2.5} />
                    <Line points={[pitchW / 2, pitchH * 0.28, pitchW / 2, pitchH * 0.72]} stroke="#ffffff" strokeWidth={2.5} />
                    <Line points={[30, pitchH / 2, pitchW - 30, pitchH / 2]} stroke="#ffffff" strokeWidth={5} />
                    <Circle x={30} y={pitchH / 2} radius={6} fill="#f59e0b" />
                    <Circle x={pitchW - 30} y={pitchH / 2} radius={6} fill="#f59e0b" />
                  </>
                ) : groundConfig.sport_type === "concert" ? (
                  // 🎤 4. CONCERT ARENA & STAGE
                  <>
                    <Rect
                      x={0}
                      y={0}
                      width={pitchW}
                      height={pitchH}
                      fill={groundConfig.turf_color || "#18181b"}
                      stroke="#7c3aed"
                      strokeWidth={3}
                      cornerRadius={16}
                    />
                    <Rect
                      x={pitchW * 0.2}
                      y={20}
                      width={pitchW * 0.6}
                      height={110}
                      fill="#6b21a8"
                      stroke="#c084fc"
                      strokeWidth={3}
                      cornerRadius={12}
                      shadowColor="#a855f7"
                      shadowBlur={20}
                    />
                    <Text
                      text="🎤 MAIN STAGE"
                      x={pitchW * 0.2}
                      y={55}
                      width={pitchW * 0.6}
                      align="center"
                      fontSize={20}
                      fontStyle="bold"
                      fill="#ffffff"
                    />
                    <Rect x={pitchW * 0.12} y={30} width={40} height={90} fill="#1e1b4b" stroke="#818cf8" strokeWidth={2} cornerRadius={6} />
                    <Rect x={pitchW * 0.88 - 40} y={30} width={40} height={90} fill="#1e1b4b" stroke="#818cf8" strokeWidth={2} cornerRadius={6} />
                    <Line
                      points={[pitchW * 0.15, 160, pitchW * 0.85, 160]}
                      stroke="#fbbf24"
                      strokeWidth={3}
                      dash={[10, 6]}
                    />
                    <Text
                      text="GOLDEN CIRCLE / VIP FAN PIT"
                      x={0}
                      y={170}
                      width={pitchW}
                      align="center"
                      fontSize={13}
                      fontStyle="bold"
                      fill="#fbbf24"
                    />
                    <Rect
                      x={pitchW / 2 - 70}
                      y={pitchH * 0.65}
                      width={140}
                      height={65}
                      fill="#09090b"
                      stroke="#64748b"
                      strokeWidth={2}
                      cornerRadius={8}
                    />
                    <Text
                      text="🎛️ FOH SOUND & LIGHTS"
                      x={pitchW / 2 - 70}
                      y={pitchH * 0.65 + 24}
                      width={140}
                      align="center"
                      fontSize={10}
                      fontStyle="bold"
                      fill="#94a3b8"
                    />
                  </>
                ) : groundConfig.sport_type === "festival_t_stage" ? (
                  // 🎸 5. FESTIVAL T-STAGE & PERFORMANCE ARENA
                  <>
                    {/* Arena Base Floor */}
                    <Rect
                      x={0}
                      y={0}
                      width={pitchW}
                      height={pitchH}
                      fill={groundConfig.turf_color || "#ffffff"}
                      stroke={groundConfig.turf_color === "#ffffff" || !groundConfig.turf_color ? "#e2e8f0" : "#6366f1"}
                      strokeWidth={2}
                      cornerRadius={16}
                    />

                    {/* Stage Ambient Glow Effect */}
                    <Rect
                      x={pitchW * 0.10}
                      y={pitchH * 0.02}
                      width={pitchW * 0.80}
                      height={pitchH * 0.18}
                      fill="#4c1d95"
                      opacity={groundConfig.turf_color === "#ffffff" || !groundConfig.turf_color ? 0.12 : 0.35}
                      cornerRadius={12}
                      shadowColor="#a855f7"
                      shadowBlur={20}
                    />

                    {/* 1. Main Stage (Top Wide Rectangle) */}
                    <Rect
                      x={pitchW * 0.12}
                      y={pitchH * 0.03}
                      width={pitchW * 0.76}
                      height={pitchH * 0.16}
                      fill="#4c1d95"
                      stroke="#c084fc"
                      strokeWidth={3}
                      cornerRadius={8}
                      shadowColor="#a855f7"
                      shadowBlur={16}
                    />

                    {/* Stage Rig / Spotlight Accents */}
                    <Circle x={pitchW * 0.15} y={pitchH * 0.06} radius={6} fill="#fbbf24" opacity={0.85} />
                    <Circle x={pitchW * 0.20} y={pitchH * 0.06} radius={6} fill="#ec4899" opacity={0.85} />
                    <Circle x={pitchW * 0.80} y={pitchH * 0.06} radius={6} fill="#ec4899" opacity={0.85} />
                    <Circle x={pitchW * 0.85} y={pitchH * 0.06} radius={6} fill="#fbbf24" opacity={0.85} />

                    {/* Stage Label (Editable via Sidebar) */}
                    {((groundConfig.stage_label ?? groundConfig.pitch_label) || "MAIN STAGE").trim().length > 0 && (
                      <Text
                        text={`🎤 ${((groundConfig.stage_label ?? groundConfig.pitch_label) || "MAIN STAGE").trim().toUpperCase()}`}
                        x={pitchW * 0.12}
                        y={pitchH * 0.03 + pitchH * 0.05}
                        width={pitchW * 0.76}
                        align="center"
                        fontSize={Math.max(14, pitchH * 0.04)}
                        fontStyle="bold"
                        fill="#ffffff"
                      />
                    )}

                    {/* 2. Catwalk / T-Runway (Projecting Down into Audience) */}
                    <Rect
                      x={pitchW * 0.42}
                      y={pitchH * 0.19}
                      width={pitchW * 0.16}
                      height={pitchH * 0.18}
                      fill="#581c87"
                      stroke="#d8b4fe"
                      strokeWidth={2.5}
                      cornerRadius={[0, 0, 8, 8]}
                    />

                    {/* Catwalk Runway Floor Edge Lights */}
                    <Line
                      points={[
                        pitchW * 0.435, pitchH * 0.20,
                        pitchW * 0.435, pitchH * 0.35
                      ]}
                      stroke="#e9d5ff"
                      strokeWidth={1.5}
                      dash={[4, 6]}
                      opacity={0.7}
                    />
                    <Line
                      points={[
                        pitchW * 0.565, pitchH * 0.20,
                        pitchW * 0.565, pitchH * 0.35
                      ]}
                      stroke="#e9d5ff"
                      strokeWidth={1.5}
                      dash={[4, 6]}
                      opacity={0.7}
                    />

                    {/* Optional Catwalk Text (Only shown if user explicitly typed a label; static 'CATWALK' removed) */}
                    {groundConfig.catwalk_label && groundConfig.catwalk_label.trim().length > 0 && (
                      <Text
                        text={groundConfig.catwalk_label.trim().toUpperCase()}
                        x={pitchW * 0.42}
                        y={pitchH * 0.19 + pitchH * 0.06}
                        width={pitchW * 0.16}
                        align="center"
                        fontSize={Math.max(10, pitchH * 0.026)}
                        fontStyle="bold"
                        fill="#f3e8ff"
                      />
                    )}

                    {/* Stage Barricade Guidelines */}
                    <Line
                      points={[
                        pitchW * 0.10, pitchH * 0.19,
                        pitchW * 0.41, pitchH * 0.19
                      ]}
                      stroke="#64748b"
                      strokeWidth={1.5}
                      dash={[6, 4]}
                      opacity={0.5}
                    />
                    <Line
                      points={[
                        pitchW * 0.59, pitchH * 0.19,
                        pitchW * 0.90, pitchH * 0.19
                      ]}
                      stroke="#64748b"
                      strokeWidth={1.5}
                      dash={[6, 4]}
                      opacity={0.5}
                    />

                    {/* FOH Audio Console / Sound Booth */}
                    <Rect
                      x={pitchW * 0.44}
                      y={pitchH * 0.92}
                      width={pitchW * 0.12}
                      height={pitchH * 0.06}
                      fill="#1e1b4b"
                      stroke="#4338ca"
                      strokeWidth={1.5}
                      cornerRadius={4}
                      opacity={0.65}
                    />
                    <Text
                      text="🎛️ FOH / AUDIO"
                      x={pitchW * 0.44}
                      y={pitchH * 0.92 + pitchH * 0.015}
                      width={pitchW * 0.12}
                      align="center"
                      fontSize={9}
                      fontStyle="bold"
                      fill="#818cf8"
                      opacity={0.75}
                    />
                  </>
                ) : groundConfig.sport_type === "custom" ? (
                  // 🔲 5. CUSTOM / MULTI-PURPOSE PITCH
                  <>
                    <Rect
                      x={0}
                      y={0}
                      width={pitchW}
                      height={pitchH}
                      fill={groundConfig.turf_color || "#334155"}
                      stroke="#ffffff"
                      strokeWidth={3}
                      cornerRadius={14}
                    />
                    <Line points={[0, pitchH / 2, pitchW, pitchH / 2]} stroke="#ffffff" strokeWidth={2} />
                    <Circle x={pitchW / 2} y={pitchH / 2} radius={pitchH * 0.2} stroke="#ffffff" strokeWidth={2} />
                  </>
                ) : (
                  // ⚽ 6. FOOTBALL / SOCCER PITCH (Default)
                  <>
                    <Rect
                      x={0}
                      y={0}
                      width={pitchW}
                      height={pitchH}
                      fill={groundConfig.turf_color || "#14532d"}
                      stroke="#22c55e"
                      strokeWidth={4}
                      cornerRadius={20}
                      shadowColor="#000000"
                      shadowBlur={25}
                      shadowOpacity={0.6}
                    />
                    {Array.from({ length: 8 }).map((_, idx) => {
                      const stripeH = pitchH / 8;
                      return (
                        <Rect
                          key={`stripe-${idx}`}
                          x={0}
                          y={idx * stripeH}
                          width={pitchW}
                          height={stripeH}
                          fill={idx % 2 === 0 ? "#15803d" : "#166534"}
                          opacity={0.35}
                          listening={false}
                        />
                      );
                    })}
                    <Rect
                      x={25}
                      y={25}
                      width={pitchW - 50}
                      height={pitchH - 50}
                      fill="transparent"
                      stroke="#ffffff"
                      strokeWidth={2}
                      opacity={0.75}
                      listening={false}
                    />
                    {pitchW >= pitchH ? (
                      <>
                        <Line
                          points={[pitchW / 2, 25, pitchW / 2, pitchH - 25]}
                          stroke="#ffffff"
                          strokeWidth={2}
                          opacity={0.75}
                          listening={false}
                        />
                        <Circle
                          x={pitchW / 2}
                          y={pitchH / 2}
                          radius={Math.min(pitchW, pitchH) * 0.16}
                          stroke="#ffffff"
                          strokeWidth={2}
                          opacity={0.75}
                          listening={false}
                        />
                        <Circle
                          x={pitchW / 2}
                          y={pitchH / 2}
                          radius={7}
                          fill="#ffffff"
                          opacity={0.9}
                          listening={false}
                        />
                        <Rect
                          x={25}
                          y={(pitchH - pitchH * 0.52) / 2}
                          width={pitchW * 0.16}
                          height={pitchH * 0.52}
                          stroke="#ffffff"
                          strokeWidth={2}
                          opacity={0.75}
                          listening={false}
                        />
                        <Rect
                          x={pitchW - 25 - pitchW * 0.16}
                          y={(pitchH - pitchH * 0.52) / 2}
                          width={pitchW * 0.16}
                          height={pitchH * 0.52}
                          stroke="#ffffff"
                          strokeWidth={2}
                          opacity={0.75}
                          listening={false}
                        />
                      </>
                    ) : (
                      <>
                        <Line
                          points={[25, pitchH / 2, pitchW - 25, pitchH / 2]}
                          stroke="#ffffff"
                          strokeWidth={2}
                          opacity={0.75}
                          listening={false}
                        />
                        <Circle
                          x={pitchW / 2}
                          y={pitchH / 2}
                          radius={pitchH * 0.16}
                          stroke="#ffffff"
                          strokeWidth={2}
                          opacity={0.75}
                          listening={false}
                        />
                        <Circle
                          x={pitchW / 2}
                          y={pitchH / 2}
                          radius={7}
                          fill="#ffffff"
                          opacity={0.9}
                          listening={false}
                        />
                        <Rect
                          x={pitchW * 0.3}
                          y={25}
                          width={pitchW * 0.4}
                          height={pitchH * 0.18}
                          stroke="#ffffff"
                          strokeWidth={2}
                          opacity={0.75}
                          listening={false}
                        />
                        <Rect
                          x={pitchW * 0.3}
                          y={pitchH - 25 - pitchH * 0.18}
                          width={pitchW * 0.4}
                          height={pitchH * 0.18}
                          stroke="#ffffff"
                          strokeWidth={2}
                          opacity={0.75}
                          listening={false}
                        />
                      </>
                    )}
                  </>
                )}

                {/* Pitch Label */}
                {groundConfig.sport_type !== "festival_t_stage" && (
                  <Text
                    text={groundConfig.pitch_label || pitchLabel}
                    x={0}
                    y={pitchH / 2 - 14}
                    width={pitchW}
                    align="center"
                    fontSize={Math.max(16, Math.min(pitchW, pitchH) * 0.05)}
                    fontStyle="bold"
                    fill="#ffffff"
                    opacity={0.9}
                    listening={false}
                    perfectDrawEnabled={false}
                  />
                )}
              </Group>
            )}

              {/* ── Custom Elements (Stages, Screens, Gates, Lounges) ── */}
              {elements.map((el) => {
                const isElSelected = selectedElementId === el.id;
                return (
                  <Group
                    key={el.id}
                    id={el.id}
                    ref={isElSelected ? (n) => { selectedElementRef.current = n; } : undefined}
                    x={el.x + el.width / 2}
                    y={el.y + el.height / 2}
                    offsetX={el.width / 2}
                    offsetY={el.height / 2}
                    rotation={el.rotation}
                    draggable
                    onClick={() => {
                      setSelectedElementId(el.id);
                      setSelectedId(null);
                      setActiveSidebarTab("elements");
                    }}
                    onTap={() => {
                      setSelectedElementId(el.id);
                      setSelectedId(null);
                      setActiveSidebarTab("elements");
                    }}
                    onDragEnd={(e) => {
                      const node = e.target;
                      updateElement({
                        ...el,
                        x: node.x() - el.width / 2,
                        y: node.y() - el.height / 2,
                      });
                    }}
                    onTransformEnd={(e) => {
                      const node = e.target;
                      const scaleX = node.scaleX();
                      const scaleY = node.scaleY();
                      node.scaleX(1);
                      node.scaleY(1);
                      updateElement({
                        ...el,
                        x: node.x() - (el.width * scaleX) / 2,
                        y: node.y() - (el.height * scaleY) / 2,
                        width: Math.max(40, el.width * scaleX),
                        height: Math.max(30, el.height * scaleY),
                        rotation: node.rotation(),
                      });
                    }}
                  >
                    <Rect
                      x={0}
                      y={0}
                      width={el.width}
                      height={el.height}
                      fill={el.color}
                      opacity={0.9}
                      stroke={isElSelected ? "#ffffff" : "rgba(255,255,255,0.4)"}
                      strokeWidth={isElSelected ? 3.5 : 1.5}
                      cornerRadius={8}
                      shadowColor="#000000"
                      shadowBlur={isElSelected ? 15 : 6}
                    />
                    <Text
                      text={`${el.icon ? `${el.icon} ` : ""}${el.name.toUpperCase()}`}
                      x={4}
                      y={el.height / 2 - 8}
                      width={el.width - 8}
                      align="center"
                      fontSize={Math.max(11, Math.min(el.width, el.height) * 0.22)}
                      fontStyle="bold"
                      fill="#ffffff"
                      shadowColor="#000000"
                      shadowBlur={4}
                      listening={false}
                      wrap="none"
                      ellipsis={true}
                    />
                  </Group>
                );
              })}

              {/* ── Stands (Blocks) ── */}
              {blocks.map((block) => {
                const isSelected = selectedId === block.id;
                const totalSeats = computeBlockSeatCount(block);

                const assignedTicket = ticketTypes.find(
                  (tt) => tt.id === (block.ticket_type_id || block.tiers?.[0]?.ticket_type_id)
                );
                const isTiered =
                  (block.seating_type === "tiered" || (!block.seating_type && (block.tiers?.length ?? 0) > 1)) &&
                  (block.tiers?.length ?? 0) > 1;

                if (block.shape === "arc") {
                  const sCenterX = block.stadiumCenterX ?? CANVAS_W / 2;
                  const sCenterY = block.stadiumCenterY ?? CANVAS_H / 2;
                  const innerR = block.innerRadius ?? 260;
                  const outerR = block.outerRadius ?? 335;
                  const startA = block.startAngle ?? 0;
                  const sweepA = block.sweepAngle ?? 45;

                  const midAngleDeg = startA + sweepA / 2;
                  const midAngleRad = (midAngleDeg * Math.PI) / 180;
                  const midRadius = (innerR + outerR) / 2;
                  const labelX = Math.cos(midAngleRad) * midRadius;
                  const labelY = Math.sin(midAngleRad) * midRadius;

                  return (
                    <Group
                      key={block.id}
                      id={block.id}
                      ref={isSelected ? (n) => { selectedRef.current = n; } : undefined}
                      x={sCenterX}
                      y={sCenterY}
                      draggable
                      onDragEnd={(e) => {
                        const node = e.target;
                        const newCenterX = Math.round(node.x());
                        const newCenterY = Math.round(node.y());
                        updateBlock({
                          ...block,
                          stadiumCenterX: newCenterX,
                          stadiumCenterY: newCenterY,
                          x: newCenterX,
                          y: newCenterY,
                        });
                      }}
                      onTransformEnd={(e) => {
                        const node = e.target;
                        const rot = node.rotation();
                        node.rotation(0);
                        const currentStart = block.startAngle ?? 0;
                        const newStart = Math.round((currentStart + rot + 3600) % 360);
                        const newCenterX = Math.round(node.x());
                        const newCenterY = Math.round(node.y());
                        updateBlock({
                          ...block,
                          startAngle: newStart,
                          stadiumCenterX: newCenterX,
                          stadiumCenterY: newCenterY,
                          x: newCenterX,
                          y: newCenterY,
                        });
                      }}
                      onClick={() => {
                        setSelectedId(block.id);
                        setSelectedElementId(null);
                        setActiveSidebarTab("stands");
                      }}
                      onTap={() => {
                        setSelectedId(block.id);
                        setSelectedElementId(null);
                        setActiveSidebarTab("stands");
                      }}
                    >
                      {isTiered ? (
                        <>
                          {block.tiers.map((tier, tIdx) => {
                            const numTiers = block.tiers.length;
                            const radialSpan = (outerR - innerR) / numTiers;
                            const tierInR = innerR + tIdx * radialSpan;
                            const tierOutR = tierInR + radialSpan;
                            const tierColor = tier.color || (tIdx === 0 ? "#f59e0b" : "#10b981");
                            const midR = (tierInR + tierOutR) / 2;
                            const tierLabelX = Math.cos(midAngleRad) * midR;
                            const tierLabelY = Math.sin(midAngleRad) * midR;
                            const tierSeats = computeTierSeatCount(tier);

                            return (
                              <Group key={tier.id || `arc-tier-${tIdx}`}>
                                <Arc
                                  x={0}
                                  y={0}
                                  innerRadius={tierInR}
                                  outerRadius={tierOutR}
                                  angle={sweepA}
                                  rotation={startA}
                                  fill={tierColor}
                                  stroke={isSelected ? "#ffffff" : "rgba(255,255,255,0.35)"}
                                  strokeWidth={isSelected ? 3.5 : 1}
                                  shadowColor={isSelected ? "#ffffff" : "#000000"}
                                  shadowBlur={isSelected ? 16 : 4}
                                  shadowOpacity={isSelected ? 0.8 : 0.3}
                                />
                                <Text
                                  text={`${tier.name.toUpperCase()} · ${tierSeats} seats`}
                                  x={tierLabelX - 70}
                                  y={tierLabelY - 6}
                                  width={140}
                                  align="center"
                                  fontSize={9}
                                  fontStyle="bold"
                                  fill="#ffffff"
                                  shadowColor="#000000"
                                  shadowBlur={4}
                                  listening={false}
                                  wrap="none"
                                  ellipsis={true}
                                />
                              </Group>
                            );
                          })}
                          {/* Stand Name Label at Arc Centroid */}
                          <Group x={labelX} y={labelY}>
                            <Rect
                              x={-50}
                              y={-9}
                              width={100}
                              height={18}
                              cornerRadius={9}
                              fill="#090d16"
                              stroke={isSelected ? "#ffffff" : "rgba(255,255,255,0.5)"}
                              strokeWidth={1}
                              shadowColor="#000000"
                              shadowBlur={4}
                            />
                            <Text
                              text={block.name.toUpperCase()}
                              x={-50}
                              y={-5}
                              width={100}
                              align="center"
                              fontSize={9}
                              fontStyle="bold"
                              fill="#ffffff"
                              listening={false}
                              wrap="none"
                              ellipsis={true}
                            />
                          </Group>
                        </>
                      ) : (
                        <>
                          <Arc
                            x={0}
                            y={0}
                            innerRadius={innerR}
                            outerRadius={outerR}
                            angle={sweepA}
                            rotation={startA}
                            fill={block.tiers?.[0]?.color || block.color}
                            stroke={isSelected ? "#ffffff" : "rgba(255,255,255,0.4)"}
                            strokeWidth={isSelected ? 4.5 : 1.5}
                            shadowColor={isSelected ? "#ffffff" : "#000000"}
                            shadowBlur={isSelected ? 20 : 6}
                            shadowOpacity={isSelected ? 0.9 : 0.4}
                          />
                          {/* Stand Name Label at Arc Centroid */}
                          <Group x={labelX} y={labelY}>
                            <Text
                              text={block.name.toUpperCase()}
                              x={-80}
                              y={-12}
                              width={160}
                              align="center"
                              fontSize={11}
                              fontStyle="bold"
                              fill="#ffffff"
                              shadowColor="#000000"
                              shadowBlur={4}
                              listening={false}
                              wrap="none"
                              ellipsis={true}
                            />
                            <Text
                              text={
                                block.stand_type === "standing"
                                  ? `🧍 STANDING · ${totalSeats.toLocaleString()} passes`
                                  : assignedTicket
                                  ? `${assignedTicket.name || assignedTicket.ticket_type} · ${totalSeats} seats`
                                  : `${totalSeats} seats`
                              }
                              x={-80}
                              y={3}
                              width={160}
                              align="center"
                              fontSize={9}
                              fontStyle="bold"
                              fill={block.stand_type === "standing" ? "#e9d5ff" : "#fde047"}
                              shadowColor="#000000"
                              shadowBlur={3}
                              listening={false}
                              wrap="none"
                              ellipsis={true}
                            />
                          </Group>
                        </>
                      )}
                    </Group>
                  );
                }

                return (
                  <Group
                    key={block.id}
                    id={block.id}
                    ref={isSelected ? (n) => { selectedRef.current = n; } : undefined}
                    x={block.x + block.width / 2}
                    y={block.y + block.height / 2}
                    offsetX={block.width / 2}
                    offsetY={block.height / 2}
                    rotation={block.rotation}
                    draggable
                    onClick={() => {
                      setSelectedId(block.id);
                      setSelectedElementId(null);
                      setActiveSidebarTab("stands");
                    }}
                    onTap={() => {
                      setSelectedId(block.id);
                      setSelectedElementId(null);
                      setActiveSidebarTab("stands");
                    }}
                    onDragEnd={(e) => {
                      const node = e.target;
                      updateBlock({
                        ...block,
                        x: node.x() - block.width / 2,
                        y: node.y() - block.height / 2,
                      });
                    }}
                    onTransformEnd={(e) => {
                      const node = e.target;
                      const scaleX = node.scaleX();
                      const scaleY = node.scaleY();
                      node.scaleX(1);
                      node.scaleY(1);
                      updateBlock({
                        ...block,
                        x: node.x() - (block.width * scaleX) / 2,
                        y: node.y() - (block.height * scaleY) / 2,
                        width: Math.max(60, block.width * scaleX),
                        height: Math.max(60, block.height * scaleY),
                        rotation: node.rotation(),
                      });
                    }}
                  >
                    {block.shape === "oval" ? (
                      <Ellipse
                        x={block.width / 2}
                        y={block.height / 2}
                        radiusX={block.width / 2}
                        radiusY={block.height / 2}
                        fill={block.tiers?.[0]?.color || block.color}
                        opacity={0.92}
                        stroke={isSelected ? "#ffffff" : "rgba(255,255,255,0.4)"}
                        strokeWidth={isSelected ? 4.5 : 2}
                        shadowColor={isSelected ? "#ffffff" : "#000000"}
                        shadowBlur={isSelected ? 18 : 8}
                        shadowOpacity={isSelected ? 0.9 : 0.4}
                      />
                    ) : isTiered && block.tiers ? (
                      // ── Multi-Tier Stand: render divided tier slices with their distinct colors ──
                      <>
                        {/* Stand container background with shadow and selection outline */}
                        <Rect
                          x={0}
                          y={0}
                          width={block.width}
                          height={block.height}
                          fill="#0f172a"
                          stroke={isSelected ? "#ffffff" : "rgba(255,255,255,0.4)"}
                          strokeWidth={isSelected ? 4.5 : 2}
                          cornerRadius={14}
                          shadowColor={isSelected ? "#ffffff" : "#000000"}
                          shadowBlur={isSelected ? 18 : 8}
                          shadowOpacity={isSelected ? 0.9 : 0.4}
                        />

                        {/* Render each tier as its own slice (horizontal or vertical split) */}
                        {block.tiers.map((tier, tIdx) => {
                          const numTiers = block.tiers.length;
                          const isHorizontal = block.tier_split_direction === "horizontal";
                          const tierW = isHorizontal ? block.width / numTiers : block.width;
                          const tierH = isHorizontal ? block.height : block.height / numTiers;
                          const tierX = isHorizontal ? tIdx * tierW : 0;
                          const tierY = isHorizontal ? 0 : tIdx * tierH;
                          const tierColor = tier.color || (tIdx === 0 ? "#f59e0b" : "#10b981");
                          const isFirst = tIdx === 0;
                          const isLast = tIdx === numTiers - 1;
                          const tierSeats = computeTierSeatCount(tier);
                          const assigned = ticketTypes.find((tt) => tt.id === tier.ticket_type_id);

                          return (
                            <Group key={tier.id || `tier-slice-${tIdx}`}>
                              <Rect
                                x={tierX}
                                y={tierY}
                                width={tierW}
                                height={tierH}
                                fill={tierColor}
                                opacity={0.92}
                                cornerRadius={
                                  isFirst && isLast
                                    ? 14
                                    : isHorizontal
                                    ? isFirst
                                      ? [14, 0, 0, 14]
                                      : isLast
                                      ? [0, 14, 14, 0]
                                      : 0
                                    : isFirst
                                    ? [14, 14, 0, 0]
                                    : isLast
                                    ? [0, 0, 14, 14]
                                    : 0
                                }
                              />
                              {tIdx > 0 && (
                                <Line
                                  points={
                                    isHorizontal
                                      ? [tierX, 8, tierX, block.height - 8]
                                      : [8, tierY, block.width - 8, tierY]
                                  }
                                  stroke="rgba(255,255,255,0.5)"
                                  strokeWidth={1.5}
                                  dash={[5, 4]}
                                />
                              )}
                              {/* Tier Name & Seats */}
                              <Text
                                text={tier.name.toUpperCase()}
                                x={tierX + 4}
                                y={tierY + Math.max(3, tierH * 0.15)}
                                width={tierW - 8}
                                align="center"
                                fontSize={Math.max(9, Math.min(tierW * 0.08, tierH * 0.32))}
                                fontStyle="bold"
                                fill="#ffffff"
                                shadowColor="#000000"
                                shadowBlur={4}
                                listening={false}
                                wrap="none"
                                ellipsis={true}
                              />
                              <Text
                                text={`${tierSeats} seats (${tier.row_start}–${tier.row_end})${assigned ? ` · ${assigned.name || assigned.ticket_type}` : ""}`}
                                x={tierX + 4}
                                y={tierY + Math.max(16, tierH * 0.55)}
                                width={tierW - 8}
                                align="center"
                                fontSize={Math.max(8, Math.min(tierW * 0.06, tierH * 0.24))}
                                fontStyle="bold"
                                fill="#fde047"
                                shadowColor="#000000"
                                shadowBlur={3}
                                listening={false}
                                wrap="none"
                                ellipsis={true}
                              />
                            </Group>
                          );
                        })}

                        {/* Top Pill with Stand Name */}
                        <Group x={block.width / 2} y={-8}>
                          <Rect
                            x={-Math.min(75, block.width * 0.45)}
                            y={-9}
                            width={Math.min(150, block.width * 0.9)}
                            height={18}
                            cornerRadius={9}
                            fill="#090d16"
                            stroke={isSelected ? "#ffffff" : "rgba(255,255,255,0.5)"}
                            strokeWidth={1}
                            shadowColor="#000000"
                            shadowBlur={4}
                          />
                          <Text
                            text={block.name.toUpperCase()}
                            x={-Math.min(75, block.width * 0.45)}
                            y={-5}
                            width={Math.min(150, block.width * 0.9)}
                            align="center"
                            fontSize={9.5}
                            fontStyle="bold"
                            fill="#ffffff"
                            listening={false}
                            wrap="none"
                            ellipsis={true}
                          />
                        </Group>
                      </>
                    ) : (
                      // ── Single-Tier Stand: standard single rectangle ──
                      <>
                        <Rect
                          x={0}
                          y={0}
                          width={block.width}
                          height={block.height}
                          fill={block.tiers?.[0]?.color || block.color}
                          opacity={0.92}
                          stroke={isSelected ? "#ffffff" : "rgba(255,255,255,0.4)"}
                          strokeWidth={isSelected ? 4.5 : 2}
                          cornerRadius={
                            block.shape === "pill"
                              ? Math.min(block.width, block.height) / 2
                              : block.shape === "curved"
                                ? [
                                  Math.min(block.width, block.height) * 0.45,
                                  Math.min(block.width, block.height) * 0.45,
                                  14,
                                  14,
                                ]
                                : 14
                          }
                          shadowColor={isSelected ? "#ffffff" : "#000000"}
                          shadowBlur={isSelected ? 18 : 8}
                          shadowOpacity={isSelected ? 0.9 : 0.4}
                        />
                        <Text
                          text={block.name.toUpperCase()}
                          x={4}
                          y={Math.max(6, block.height * 0.15)}
                          width={block.width - 8}
                          align="center"
                          fontSize={Math.max(14, Math.min(block.width, block.height) * 0.16)}
                          fontStyle="bold"
                          fill="#ffffff"
                          shadowColor="#000000"
                          shadowBlur={4}
                          listening={false}
                          wrap="none"
                          ellipsis={true}
                        />
                        <Text
                          text={
                            block.stand_type === "standing"
                              ? `🧍 STANDING · ${totalSeats.toLocaleString()} passes`
                              : assignedTicket
                              ? `${assignedTicket.name || assignedTicket.ticket_type} · ${totalSeats} seats`
                              : `${totalSeats} seats`
                          }
                          x={4}
                          y={Math.max(28, block.height * 0.55)}
                          width={block.width - 8}
                          align="center"
                          fontSize={Math.max(11, Math.min(block.width, block.height) * 0.12)}
                          fontStyle="bold"
                          fill={block.stand_type === "standing" ? "#e9d5ff" : "#fde047"}
                          shadowColor="#000000"
                          shadowBlur={3}
                          listening={false}
                          wrap="none"
                          ellipsis={true}
                        />
                      </>
                    )}
                  </Group>
                );
              })}

              <Transformer
                ref={trRef}
                rotateEnabled={true}
                enabledAnchors={[
                  "top-left",
                  "top-right",
                  "bottom-left",
                  "bottom-right",
                  "middle-left",
                  "middle-right",
                  "top-center",
                  "bottom-center",
                ]}
                boundBoxFunc={(_, newBox) => ({
                  ...newBox,
                  width: Math.max(60, newBox.width),
                  height: Math.max(50, newBox.height),
                })}
              />
            </Layer>
          </Stage>

          {/* Floating Zoom & Pan Controls */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700 shadow-2xl">
            <button
              type="button"
              onClick={zoomIn}
              className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={zoomOut}
              className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={resetToFitView}
              className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Fit to Screen"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-bold text-amber-400 px-2 border-l border-slate-700">
              {Math.round(zoomScale * 100)}%
            </span>
          </div>

          {/* Navigation Hint */}
          <div className="absolute bottom-4 left-4 z-20 bg-slate-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-700 shadow-xl text-xs font-medium text-slate-300 flex items-center gap-2 pointer-events-none">
            <Move className="w-3.5 h-3.5 text-amber-400" />
            <span>
              <strong>Mouse Wheel:</strong> Zoom at cursor • <strong>Drag pitch/stands:</strong> Position & resize
            </span>
          </div>
        </div>

        {/* ── High-Visibility Right Sidebar ── */}
        <div className="w-96 xl:w-[420px] h-full flex flex-col shrink-0 bg-white border-l border-slate-200 shadow-xl overflow-hidden text-slate-900">
          {/* Sidebar Tab Selector: Stands | Elements | Ground */}
          <div className="shrink-0 p-3 border-b border-slate-200 bg-slate-50 flex items-center gap-1.5 z-10">
            <button
              type="button"
              onClick={() => setActiveSidebarTab("stands")}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${activeSidebarTab === "stands"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
            >
              <Grid3X3 className="w-3.5 h-3.5 text-amber-500" />
              <span>Stands ({blocks.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSidebarTab("elements")}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${activeSidebarTab === "elements"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              <span>Elements ({elements.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSidebarTab("ground")}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${activeSidebarTab === "ground"
                ? "bg-sky-50 text-sky-800 shadow-sm border border-sky-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              title="Ground / Pitch Editable Settings"
            >
              <Settings2 className="w-3.5 h-3.5 text-sky-600" />
              <span>Pitch</span>
            </button>
          </div>

          {/* ── Tab Content Area (Scrollable) ── */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {activeSidebarTab === "stands" && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Stands & Seating Tiers
                  </span>
                  <div className="flex items-center gap-1.5">
                    {blocks.length > 0 && (
                      <button
                        type="button"
                        onClick={handleAutoAdjustAllStandSizes}
                        className="flex items-center gap-1 text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1.5 rounded-xl shadow-sm transition-all active:scale-95"
                        title="Auto-adjust all stand dimensions proportionally based on their seat capacities"
                      >
                        <Maximize2 className="w-3 h-3 text-amber-600" />
                        <span>Auto-Size All</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={addBlock}
                      className="flex items-center gap-1 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-xl shadow-sm transition-all active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Stand
                    </button>
                  </div>
                </div>

                {blocks.map((block) => (
                  <BlockPanel
                    key={block.id}
                    block={block}
                    isSelected={selectedId === block.id}
                    ticketTypes={ticketTypes}
                    pitchW={pitchW}
                    pitchH={pitchH}
                    onUpdate={updateBlock}
                    onDelete={() => deleteBlock(block.id)}
                    onDuplicateAsUpperTier={(newUpper) => {
                      setBlocks((prev) => [...prev, newUpper]);
                      setSelectedId(newUpper.id);
                    }}
                    onSelect={() => {
                      setSelectedId(block.id);
                      setSelectedElementId(null);
                    }}
                  />
                ))}

                {blocks.length === 0 && (
                  <div className="flex flex-col items-center gap-3 py-12 text-center px-4 bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm">
                    <AlertCircle className="w-10 h-10 text-slate-400" />
                    <p className="text-sm text-slate-800 font-bold">No stands created yet.</p>
                    <p className="text-xs text-slate-500 max-w-xs">
                      Click &ldquo;Auto-Build from Tickets&rdquo; at the top or &ldquo;Add Stand&rdquo; to build your stadium.
                    </p>
                  </div>
                )}
              </>
            )}

            {activeSidebarTab === "elements" && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Elements & Facilities
                  </span>
                </div>

                {/* Quick Add Element Buttons Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => addElement("stage", "Main Stage", "#9333ea", 220, 90, "🎤")}
                    className="p-2.5 rounded-xl bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 flex items-center gap-2 text-xs font-bold text-slate-800 shadow-sm transition-all"
                  >
                    <Mic className="w-4 h-4 text-purple-600" />
                    <span>+ Concert Stage</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => addElement("screen", "Giant Screen", "#2563eb", 140, 50, "📺")}
                    className="p-2.5 rounded-xl bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 flex items-center gap-2 text-xs font-bold text-slate-800 shadow-sm transition-all"
                  >
                    <Tv className="w-4 h-4 text-blue-600" />
                    <span>+ Jumbotron Screen</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => addElement("gate", "Main Gate", "#059669", 110, 40, "🚪")}
                    className="p-2.5 rounded-xl bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 flex items-center gap-2 text-xs font-bold text-slate-800 shadow-sm transition-all"
                  >
                    <DoorOpen className="w-4 h-4 text-emerald-600" />
                    <span>+ Entry Gate</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => addElement("lounge", "VIP Lounge", "#d97706", 180, 70, "🛋️")}
                    className="p-2.5 rounded-xl bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 flex items-center gap-2 text-xs font-bold text-slate-800 shadow-sm transition-all"
                  >
                    <Armchair className="w-4 h-4 text-amber-600" />
                    <span>+ VIP Lounge</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => addElement("amenity", "Food Court", "#dc2626", 130, 50, "🍔")}
                    className="p-2.5 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 flex items-center gap-2 text-xs font-bold text-slate-800 shadow-sm transition-all"
                  >
                    <Coffee className="w-4 h-4 text-rose-600" />
                    <span>+ Food Court</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => addElement("custom", "Custom Area", "#475569", 140, 60, "★")}
                    className="p-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 flex items-center gap-2 text-xs font-bold text-slate-800 shadow-sm transition-all"
                  >
                    <Tag className="w-4 h-4 text-slate-500" />
                    <span>+ Custom Label</span>
                  </button>
                </div>

                {elements.map((el) => (
                  <ElementPanel
                    key={el.id}
                    element={el}
                    isSelected={selectedElementId === el.id}
                    onUpdate={updateElement}
                    onDelete={() => deleteElement(el.id)}
                    onSelect={() => {
                      setSelectedElementId(el.id);
                      setSelectedId(null);
                    }}
                  />
                ))}

                {elements.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-8 text-center px-4 bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm">
                    <Sparkles className="w-8 h-8 text-slate-400" />
                    <p className="text-xs text-slate-700 font-bold">No custom elements added yet.</p>
                    <p className="text-[11px] text-slate-500">
                      Add a Stage, Giant Screen, Entrance Gates, or Lounges above.
                    </p>
                  </div>
                )}
              </>
            )}

            {activeSidebarTab === "ground" && (
              <div className="space-y-4">
                {groundConfig.enabled === false ? (
                  <div className="p-6 rounded-2xl bg-white border border-dashed border-slate-300 text-center space-y-3.5 shadow-sm">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto text-2xl shadow-inner">
                      🏟️
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">Ground Section is Deleted (Hidden)</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                        This venue layout currently has no center pitch/ground. Your stands, stages, and custom elements will render freely.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={restoreGround}
                      className="px-4 py-2.5 rounded-xl text-xs font-extrabold bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20 inline-flex items-center gap-2 mx-auto transition-all active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Add / Restore Ground Section</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {/* 🎯 Pitch Active Selection Banner */}
                    <div
                      className={`p-3.5 rounded-2xl border transition-all ${isPitchSelected
                        ? "bg-sky-50 border-sky-300 ring-2 ring-sky-400/25 shadow-sm"
                        : "bg-white border-slate-200 shadow-sm"
                        }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base shrink-0">🎯</span>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 truncate">
                              {isPitchSelected ? "Pitch Selected (Handles Active)" : "Pitch Section"}
                            </h4>
                            <p className="text-[11px] text-slate-500 truncate">
                              {isPitchSelected ? "Drag on canvas to position, pull handles to resize" : "Click to select pitch on canvas"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (isPitchSelected) {
                                setSelectedId(null);
                              } else {
                                setSelectedId("ground-pitch");
                                setSelectedElementId(null);
                              }
                            }}
                            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm active:scale-95 ${isPitchSelected
                              ? "bg-sky-600 text-white hover:bg-sky-700"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                              }`}
                          >
                            {isPitchSelected ? "Deselect" : "Select Pitch"}
                          </button>
                          <button
                            type="button"
                            onClick={deleteGround}
                            className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors shadow-sm"
                            title="Delete / Remove Ground Section"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                {/* 📏 Numerical Position & Dimension Controls */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3.5 shadow-sm">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between">
                    <span>📏 Position & Size Controls</span>
                    {isPitchSelected && (
                      <span className="text-[10px] text-sky-700 font-bold bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                        ACTIVE
                      </span>
                    )}
                  </h4>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">X Position (px)</label>
                      <input
                        type="number"
                        className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 shadow-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                        value={Math.round(pitchX)}
                        onChange={(e) => setGroundConfig((p) => ({ ...p, x: Number(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Y Position (px)</label>
                      <input
                        type="number"
                        className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 shadow-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                        value={Math.round(pitchY)}
                        onChange={(e) => setGroundConfig((p) => ({ ...p, y: Number(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Width (px)</label>
                      <input
                        type="number"
                        min={150}
                        className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 shadow-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                        value={Math.round(pitchW)}
                        onChange={(e) =>
                          setGroundConfig((p) => ({ ...p, width: Math.max(150, Number(e.target.value) || 150) }))
                        }
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Height (px)</label>
                      <input
                        type="number"
                        min={100}
                        className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 shadow-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                        value={Math.round(pitchH)}
                        onChange={(e) =>
                          setGroundConfig((p) => ({ ...p, height: Math.max(100, Number(e.target.value) || 100) }))
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-600">Rotation Angle</label>
                      <span className="text-xs font-mono text-amber-700 font-bold">{pitchRot}°</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      step={5}
                      className="w-full cursor-pointer accent-amber-600"
                      value={pitchRot}
                      onChange={(e) => setGroundConfig((p) => ({ ...p, rotation: Number(e.target.value) || 0 }))}
                    />
                  </div>

                  {/* Quick Layout Presets */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        const newX = Math.round((CANVAS_W - pitchW) / 2);
                        const newY = Math.round((CANVAS_H - pitchH) / 2);
                        setGroundConfig((p) => ({ ...p, x: newX, y: newY }));
                        toast.success("Pitch centered!");
                      }}
                      className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold transition-colors shadow-sm"
                    >
                      ⌖ Center
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGroundConfig((p) => ({
                          ...p,
                          x: CANVAS_W * 0.22,
                          y: CANVAS_H * 0.22,
                          width: CANVAS_W * 0.56,
                          height: CANVAS_H * 0.56,
                          rotation: 0,
                        }));
                        toast.success("Pitch reset to default size!");
                      }}
                      className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold transition-colors shadow-sm"
                    >
                      ⟲ Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGroundConfig((p) => ({
                          ...p,
                          rotation: ((p.rotation || 0) + 90) % 360,
                        }));
                      }}
                      className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold transition-colors shadow-sm"
                    >
                      🔄 Rotate 90°
                    </button>
                  </div>
                </div>

                {/* ⚙️ Sport Type, Label & Colors */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3.5 shadow-sm">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    ⚙️ Field Styling & Sport Type
                  </h4>

                  {/* Ground Geometric Shape Selector */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Ground / Arena Shape
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "rectangle", label: "Rectangle", icon: "🔲" },
                        { id: "oval", label: "Oval / Circle", icon: "🔘" },
                        { id: "capsule", label: "Olympic Stadium", icon: "🏟️" },
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setGroundConfig((p) => ({ ...p, shape: s.id as any }))}
                          className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${(groundConfig.shape || "rectangle") === s.id
                            ? "bg-sky-600 text-white border-sky-700 shadow-sm"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-sm"
                            }`}
                        >
                          <span className="text-base">{s.icon}</span>
                          <span className="text-[10px] text-center">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Shape Layout Presets */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-[11px] uppercase font-bold text-slate-600 tracking-wider block">
                      ⚡ Quick Stadium Architecture Presets
                    </span>
                    {/* Hero Preset: Festival T-Stage Architecture (Stage + Catwalk + Fan Pit + Platinum + Gold + Silver) */}
                    <button
                      type="button"
                      onClick={() => {
                        setGroundConfig({
                          enabled: true,
                          sport_type: "festival_t_stage",
                          pitch_label: "FESTIVAL T-STAGE & ARENA",
                          stage_label: "MAIN STAGE",
                          catwalk_label: "",
                          turf_color: "#ffffff",
                          track_color: "#ffffff",
                          shape: "rectangle",
                          x: CANVAS_W * 0.22,
                          y: CANVAS_H * 0.16,
                          width: CANVAS_W * 0.56,
                          height: CANVAS_H * 0.68,
                          rotation: 0,
                        });
                        setPitchLabel("FESTIVAL T-STAGE & ARENA");

                        const defaultTicket = ticketTypes[0]?.id || "";
                        const premiumTicket = ticketTypes[1]?.id || defaultTicket;
                        const vipTicket = ticketTypes[2]?.id || premiumTicket;

                        const festivalBlocks: StadiumBlockDef[] = [
                          // 1. Fan Pit (Left)
                          {
                            id: "block-fan-pit-left",
                            name: "Fan Pit (Left)",
                            color: "#ec4899",
                            stand_level: "lower",
                            stand_type: "standing",
                            shape: "rectangle",
                            x: CANVAS_W * 0.29,
                            y: CANVAS_H * 0.31,
                            width: 140,
                            height: 100,
                            rotation: 0,
                            capacity: 400,
                            ticket_type_id: vipTicket,
                            tiers: [
                              { id: "fpl-1", name: "Fan Pit Left", color: "#ec4899", ticket_type_id: vipTicket, row_start: "A", row_end: "E", seats_per_row: 20 },
                            ],
                          },
                          // 2. Fan Pit (Right)
                          {
                            id: "block-fan-pit-right",
                            name: "Fan Pit (Right)",
                            color: "#ec4899",
                            stand_level: "lower",
                            stand_type: "standing",
                            shape: "rectangle",
                            x: CANVAS_W * 0.57,
                            y: CANVAS_H * 0.31,
                            width: 140,
                            height: 100,
                            rotation: 0,
                            capacity: 400,
                            ticket_type_id: vipTicket,
                            tiers: [
                              { id: "fpr-1", name: "Fan Pit Right", color: "#ec4899", ticket_type_id: vipTicket, row_start: "A", row_end: "E", seats_per_row: 20 },
                            ],
                          },
                          // 3. Platinum Stand
                          {
                            id: "block-platinum",
                            name: "Platinum Stand",
                            color: "#0284c7",
                            stand_level: "lower",
                            shape: "rectangle",
                            x: CANVAS_W * 0.28,
                            y: CANVAS_H * 0.44,
                            width: CANVAS_W * 0.44,
                            height: 90,
                            rotation: 0,
                            capacity: 800,
                            ticket_type_id: premiumTicket,
                            tiers: [
                              { id: "plat-1", name: "Platinum Tier", color: "#38bdf8", ticket_type_id: premiumTicket, row_start: "A", row_end: "F", seats_per_row: 28 },
                            ],
                          },
                          // 4. Gold Stand
                          {
                            id: "block-gold",
                            name: "Gold Stand",
                            color: "#d97706",
                            stand_level: "multi",
                            shape: "rectangle",
                            x: CANVAS_W * 0.28,
                            y: CANVAS_H * 0.55,
                            width: CANVAS_W * 0.44,
                            height: 90,
                            rotation: 0,
                            capacity: 1000,
                            ticket_type_id: defaultTicket,
                            tiers: [
                              { id: "gold-1", name: "Gold Tier", color: "#f59e0b", ticket_type_id: defaultTicket, row_start: "G", row_end: "M", seats_per_row: 30 },
                            ],
                          },
                          // 5. Silver Stand
                          {
                            id: "block-silver",
                            name: "Silver Stand",
                            color: "#64748b",
                            stand_level: "upper",
                            shape: "rectangle",
                            x: CANVAS_W * 0.28,
                            y: CANVAS_H * 0.66,
                            width: CANVAS_W * 0.44,
                            height: 90,
                            rotation: 0,
                            capacity: 1200,
                            ticket_type_id: defaultTicket,
                            tiers: [
                              { id: "silver-1", name: "Silver Tier", color: "#94a3b8", ticket_type_id: defaultTicket, row_start: "N", row_end: "T", seats_per_row: 32 },
                            ],
                          },
                        ];

                        setBlocks(festivalBlocks);
                        setSelectedId(festivalBlocks[0].id);
                        toast.success("Applied Festival T-Stage Layout with Fan Pit, Platinum, Gold & Silver stands!");
                      }}
                      className="w-full p-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white font-extrabold text-xs shadow-md shadow-pink-600/20 flex items-center justify-between gap-2 transition-all active:scale-95 group"
                    >
                      <div className="flex items-center gap-2 text-left">
                        <span className="text-base">🎸</span>
                        <div>
                          <div className="text-white font-black">⚡ Generate Festival T-Stage Architecture</div>
                          <div className="text-[10px] text-pink-100 font-semibold">Stage + Catwalk + Fan Pit L/R + Platinum + Gold + Silver</div>
                        </div>
                      </div>
                      <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded font-mono font-bold shrink-0">1-Click</span>
                    </button>
                    {/* Hero Preset 0: Modern European Football Arena (4 Stands + 4 Corner Arcs as in photo) */}
                    <button
                      type="button"
                      onClick={() => {
                        setGroundConfig({
                          sport_type: "football",
                          pitch_label: "NATIONAL FOOTBALL ARENA",
                          turf_color: "#15803d",
                          track_color: "#1e293b",
                          shape: "rectangle",
                          x: 520,
                          y: 425,
                          width: 560,
                          height: 350,
                          rotation: 0,
                        });
                        setPitchLabel("NATIONAL FOOTBALL ARENA");

                        const defaultTicket = ticketTypes[0]?.id || "";
                        const premiumTicket = ticketTypes[1]?.id || defaultTicket;
                        const vipTicket = ticketTypes[2]?.id || premiumTicket;

                        const cx = CANVAS_W / 2; // 800
                        const cy = CANVAS_H / 2; // 600

                        const euroBlocks: StadiumBlockDef[] = [
                          // 1. North Grandstand (Top Sideline)
                          {
                            id: "euro-north",
                            name: "North Grandstand (Sideline)",
                            color: "#0284c7",
                            stand_level: "multi",
                            shape: "rectangle",
                            x: 540,
                            y: 155,
                            width: 520,
                            height: 185,
                            rotation: 0,
                            capacity: 3200,
                            tiers: [
                              {
                                id: "tier-en-upper",
                                name: "Upper Grandstand",
                                color: "#0284c7",
                                ticket_type_id: premiumTicket,
                                row_start: "I",
                                row_end: "N",
                                seats_per_row: 24,
                              },
                              {
                                id: "tier-en-vip",
                                name: "VIP Executive Suites",
                                color: "#f59e0b",
                                ticket_type_id: vipTicket,
                                row_start: "G",
                                row_end: "H",
                                seats_per_row: 18,
                              },
                              {
                                id: "tier-en-lower",
                                name: "Lower Tier",
                                color: "#38bdf8",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "F",
                                seats_per_row: 22,
                              },
                            ],
                          },

                          // 2. South Grandstand (Bottom Sideline)
                          {
                            id: "euro-south",
                            name: "South Grandstand (Sideline)",
                            color: "#dc2626",
                            stand_level: "multi",
                            shape: "rectangle",
                            x: 540,
                            y: 860,
                            width: 520,
                            height: 185,
                            rotation: 0,
                            capacity: 3200,
                            tiers: [
                              {
                                id: "tier-es-lower",
                                name: "Lower Tier",
                                color: "#f87171",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "F",
                                seats_per_row: 22,
                              },
                              {
                                id: "tier-es-vip",
                                name: "VIP Executive Suites",
                                color: "#f59e0b",
                                ticket_type_id: vipTicket,
                                row_start: "G",
                                row_end: "H",
                                seats_per_row: 18,
                              },
                              {
                                id: "tier-es-upper",
                                name: "Upper Grandstand",
                                color: "#b91c1c",
                                ticket_type_id: premiumTicket,
                                row_start: "I",
                                row_end: "N",
                                seats_per_row: 24,
                              },
                            ],
                          },

                          // 3. West Grandstand (Left Goal End)
                          {
                            id: "euro-west",
                            name: "West Goal Stand",
                            color: "#ea580c",
                            stand_level: "multi",
                            shape: "rectangle",
                            x: 235,
                            y: 440,
                            width: 195,
                            height: 320,
                            rotation: 0,
                            tier_split_direction: "horizontal",
                            capacity: 2600,
                            tiers: [
                              {
                                id: "tier-ew-upper",
                                name: "Upper Grandstand",
                                color: "#c2410c",
                                ticket_type_id: premiumTicket,
                                row_start: "I",
                                row_end: "N",
                                seats_per_row: 18,
                              },
                              {
                                id: "tier-ew-vip",
                                name: "VIP Executive Suites",
                                color: "#f59e0b",
                                ticket_type_id: vipTicket,
                                row_start: "G",
                                row_end: "H",
                                seats_per_row: 14,
                              },
                              {
                                id: "tier-ew-lower",
                                name: "Lower Tier",
                                color: "#fb923c",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "F",
                                seats_per_row: 16,
                              },
                            ],
                          },

                          // 4. East Grandstand (Right Goal End)
                          {
                            id: "euro-east",
                            name: "East Goal Stand",
                            color: "#9333ea",
                            stand_level: "multi",
                            shape: "rectangle",
                            x: 1170,
                            y: 440,
                            width: 195,
                            height: 320,
                            rotation: 0,
                            tier_split_direction: "horizontal",
                            capacity: 2600,
                            tiers: [
                              {
                                id: "tier-ee-lower",
                                name: "Lower Tier",
                                color: "#c084fc",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "F",
                                seats_per_row: 16,
                              },
                              {
                                id: "tier-ee-vip",
                                name: "VIP Executive Suites",
                                color: "#f59e0b",
                                ticket_type_id: vipTicket,
                                row_start: "G",
                                row_end: "H",
                                seats_per_row: 14,
                              },
                              {
                                id: "tier-ee-upper",
                                name: "Upper Grandstand",
                                color: "#7e22ce",
                                ticket_type_id: premiumTicket,
                                row_start: "I",
                                row_end: "N",
                                seats_per_row: 18,
                              },
                            ],
                          },

                          // 5. North-West Corner Arc
                          {
                            id: "euro-corner-nw",
                            name: "Stand NW Corner Arc",
                            color: "#0ea5e9",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: 440,
                            outerRadius: 575,
                            startAngle: 205,
                            sweepAngle: 22,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1150,
                            height: 1150,
                            rotation: 0,
                            capacity: 1000,
                            tiers: [
                              {
                                id: "tier-cnw-lower",
                                name: "Lower Tier",
                                color: "#7dd3fc",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "D",
                                seats_per_row: 10,
                              },
                              {
                                id: "tier-cnw-upper",
                                name: "Upper Tier",
                                color: "#0369a1",
                                ticket_type_id: premiumTicket,
                                row_start: "E",
                                row_end: "H",
                                seats_per_row: 12,
                              },
                            ],
                          },

                          // 6. North-East Corner Arc
                          {
                            id: "euro-corner-ne",
                            name: "Stand NE Corner Arc",
                            color: "#0ea5e9",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: 440,
                            outerRadius: 575,
                            startAngle: 313,
                            sweepAngle: 22,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1150,
                            height: 1150,
                            rotation: 0,
                            capacity: 1000,
                            tiers: [
                              {
                                id: "tier-cne-lower",
                                name: "Lower Tier",
                                color: "#7dd3fc",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "D",
                                seats_per_row: 10,
                              },
                              {
                                id: "tier-cne-upper",
                                name: "Upper Tier",
                                color: "#0369a1",
                                ticket_type_id: premiumTicket,
                                row_start: "E",
                                row_end: "H",
                                seats_per_row: 12,
                              },
                            ],
                          },

                          // 7. South-East Corner Arc
                          {
                            id: "euro-corner-se",
                            name: "Stand SE Corner Arc",
                            color: "#ef4444",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: 440,
                            outerRadius: 575,
                            startAngle: 25,
                            sweepAngle: 22,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1150,
                            height: 1150,
                            rotation: 0,
                            capacity: 1000,
                            tiers: [
                              {
                                id: "tier-cse-lower",
                                name: "Lower Tier",
                                color: "#fca5a5",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "D",
                                seats_per_row: 10,
                              },
                              {
                                id: "tier-cse-upper",
                                name: "Upper Tier",
                                color: "#b91c1c",
                                ticket_type_id: premiumTicket,
                                row_start: "E",
                                row_end: "H",
                                seats_per_row: 12,
                              },
                            ],
                          },

                          // 8. South-West Corner Arc
                          {
                            id: "euro-corner-sw",
                            name: "Stand SW Corner Arc",
                            color: "#ef4444",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: 440,
                            outerRadius: 575,
                            startAngle: 133,
                            sweepAngle: 22,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1150,
                            height: 1150,
                            rotation: 0,
                            capacity: 1000,
                            tiers: [
                              {
                                id: "tier-csw-lower",
                                name: "Lower Tier",
                                color: "#fca5a5",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "D",
                                seats_per_row: 10,
                              },
                              {
                                id: "tier-csw-upper",
                                name: "Upper Tier",
                                color: "#b91c1c",
                                ticket_type_id: premiumTicket,
                                row_start: "E",
                                row_end: "H",
                                seats_per_row: 12,
                              },
                            ],
                          },
                        ];

                        const euroElements: StadiumElementDef[] = [
                          {
                            id: "gate-nw",
                            name: "Gate 1 (NW)",
                            type: "gate",
                            icon: "🚪",
                            color: "#15803d",
                            x: 465,
                            y: 365,
                            width: 45,
                            height: 45,
                            rotation: 0,
                          },
                          {
                            id: "gate-ne",
                            name: "Gate 2 (NE)",
                            type: "gate",
                            icon: "🚪",
                            color: "#15803d",
                            x: 1090,
                            y: 365,
                            width: 45,
                            height: 45,
                            rotation: 0,
                          },
                          {
                            id: "gate-se",
                            name: "Gate 3 (SE)",
                            type: "gate",
                            icon: "🚪",
                            color: "#15803d",
                            x: 1090,
                            y: 790,
                            width: 45,
                            height: 45,
                            rotation: 0,
                          },
                          {
                            id: "gate-sw",
                            name: "Gate 4 (SW)",
                            type: "gate",
                            icon: "🚪",
                            color: "#15803d",
                            x: 465,
                            y: 790,
                            width: 45,
                            height: 45,
                            rotation: 0,
                          },
                        ];

                        setBlocks(euroBlocks);
                        setElements(euroElements);
                        setSelectedId(euroBlocks[0].id);
                        toast.success("Generated Modern Football Arena with zero overlap!");
                      }}
                      className="w-full p-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-sky-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-md shadow-sky-700/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <span className="text-base">🏟️</span>
                      <span>⚡ Generate European Arena (4 Stands + 4 Corner Arcs)</span>
                    </button>

                    {/* Hero Preset 0B: Seamless European Arena (Snug Stands & Corners · Zero Gap) */}
                    <button
                      type="button"
                      onClick={() => {
                        setGroundConfig({
                          sport_type: "football",
                          pitch_label: "NATIONAL FOOTBALL ARENA",
                          turf_color: "#15803d",
                          track_color: "#1e293b",
                          shape: "rectangle",
                          x: 520,
                          y: 425,
                          width: 560,
                          height: 350,
                          rotation: 0,
                        });
                        setPitchLabel("NATIONAL FOOTBALL ARENA");

                        const defaultTicket = ticketTypes[0]?.id || "";
                        const premiumTicket = ticketTypes[1]?.id || defaultTicket;
                        const vipTicket = ticketTypes[2]?.id || premiumTicket;

                        const cx = CANVAS_W / 2; // 800
                        const cy = CANVAS_H / 2; // 600

                        const snugEuroBlocks: StadiumBlockDef[] = [
                          // 1. North Grandstand (Sideline)
                          {
                            id: "euro-north",
                            name: "North Grandstand (Sideline)",
                            color: "#0284c7",
                            stand_level: "multi",
                            shape: "rectangle",
                            x: 500,
                            y: 155,
                            width: 600,
                            height: 185,
                            rotation: 0,
                            capacity: 3400,
                            tiers: [
                              {
                                id: "tier-en-upper",
                                name: "Upper Grandstand",
                                color: "#0284c7",
                                ticket_type_id: premiumTicket,
                                row_start: "I",
                                row_end: "N",
                                seats_per_row: 24,
                              },
                              {
                                id: "tier-en-vip",
                                name: "VIP Executive Suites",
                                color: "#f59e0b",
                                ticket_type_id: vipTicket,
                                row_start: "G",
                                row_end: "H",
                                seats_per_row: 18,
                              },
                              {
                                id: "tier-en-lower",
                                name: "Lower Tier",
                                color: "#38bdf8",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "F",
                                seats_per_row: 22,
                              },
                            ],
                          },

                          // 2. South Grandstand (Sideline)
                          {
                            id: "euro-south",
                            name: "South Grandstand (Sideline)",
                            color: "#dc2626",
                            stand_level: "multi",
                            shape: "rectangle",
                            x: 500,
                            y: 860,
                            width: 600,
                            height: 185,
                            rotation: 0,
                            capacity: 3400,
                            tiers: [
                              {
                                id: "tier-es-lower",
                                name: "Lower Tier",
                                color: "#f87171",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "F",
                                seats_per_row: 22,
                              },
                              {
                                id: "tier-es-vip",
                                name: "VIP Executive Suites",
                                color: "#f59e0b",
                                ticket_type_id: vipTicket,
                                row_start: "G",
                                row_end: "H",
                                seats_per_row: 18,
                              },
                              {
                                id: "tier-es-upper",
                                name: "Upper Grandstand",
                                color: "#b91c1c",
                                ticket_type_id: premiumTicket,
                                row_start: "I",
                                row_end: "N",
                                seats_per_row: 24,
                              },
                            ],
                          },

                          // 3. West Grandstand (Goal End)
                          {
                            id: "euro-west",
                            name: "West Goal Stand",
                            color: "#ea580c",
                            stand_level: "multi",
                            shape: "rectangle",
                            x: 235,
                            y: 400,
                            width: 195,
                            height: 400,
                            rotation: 0,
                            tier_split_direction: "horizontal",
                            capacity: 2800,
                            tiers: [
                              {
                                id: "tier-ew-upper",
                                name: "Upper Grandstand",
                                color: "#c2410c",
                                ticket_type_id: premiumTicket,
                                row_start: "I",
                                row_end: "N",
                                seats_per_row: 18,
                              },
                              {
                                id: "tier-ew-vip",
                                name: "VIP Executive Suites",
                                color: "#f59e0b",
                                ticket_type_id: vipTicket,
                                row_start: "G",
                                row_end: "H",
                                seats_per_row: 14,
                              },
                              {
                                id: "tier-ew-lower",
                                name: "Lower Tier",
                                color: "#fb923c",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "F",
                                seats_per_row: 16,
                              },
                            ],
                          },

                          // 4. East Grandstand (Goal End)
                          {
                            id: "euro-east",
                            name: "East Goal Stand",
                            color: "#9333ea",
                            stand_level: "multi",
                            shape: "rectangle",
                            x: 1170,
                            y: 400,
                            width: 195,
                            height: 400,
                            rotation: 0,
                            tier_split_direction: "horizontal",
                            capacity: 2800,
                            tiers: [
                              {
                                id: "tier-ee-lower",
                                name: "Lower Tier",
                                color: "#c084fc",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "F",
                                seats_per_row: 16,
                              },
                              {
                                id: "tier-ee-vip",
                                name: "VIP Executive Suites",
                                color: "#f59e0b",
                                ticket_type_id: vipTicket,
                                row_start: "G",
                                row_end: "H",
                                seats_per_row: 14,
                              },
                              {
                                id: "tier-ee-upper",
                                name: "Upper Grandstand",
                                color: "#7e22ce",
                                ticket_type_id: premiumTicket,
                                row_start: "I",
                                row_end: "N",
                                seats_per_row: 18,
                              },
                            ],
                          },

                          // 5. North-West Corner Arc (Snug to West & North with zero space)
                          {
                            id: "euro-corner-nw",
                            name: "Stand NW Corner Arc",
                            color: "#0ea5e9",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: 385,
                            outerRadius: 535,
                            startAngle: 196,
                            sweepAngle: 38,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1070,
                            height: 1070,
                            rotation: 0,
                            capacity: 1200,
                            tiers: [
                              {
                                id: "tier-cnw-lower",
                                name: "Lower Tier",
                                color: "#7dd3fc",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "D",
                                seats_per_row: 12,
                              },
                              {
                                id: "tier-cnw-upper",
                                name: "Upper Tier",
                                color: "#0369a1",
                                ticket_type_id: premiumTicket,
                                row_start: "E",
                                row_end: "H",
                                seats_per_row: 14,
                              },
                            ],
                          },

                          // 6. North-East Corner Arc (Snug to North & East with zero space)
                          {
                            id: "euro-corner-ne",
                            name: "Stand NE Corner Arc",
                            color: "#0ea5e9",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: 385,
                            outerRadius: 535,
                            startAngle: 306,
                            sweepAngle: 38,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1070,
                            height: 1070,
                            rotation: 0,
                            capacity: 1200,
                            tiers: [
                              {
                                id: "tier-cne-lower",
                                name: "Lower Tier",
                                color: "#7dd3fc",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "D",
                                seats_per_row: 12,
                              },
                              {
                                id: "tier-cne-upper",
                                name: "Upper Tier",
                                color: "#0369a1",
                                ticket_type_id: premiumTicket,
                                row_start: "E",
                                row_end: "H",
                                seats_per_row: 14,
                              },
                            ],
                          },

                          // 7. South-East Corner Arc (Snug to East & South with zero space)
                          {
                            id: "euro-corner-se",
                            name: "Stand SE Corner Arc",
                            color: "#ef4444",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: 385,
                            outerRadius: 535,
                            startAngle: 16,
                            sweepAngle: 38,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1070,
                            height: 1070,
                            rotation: 0,
                            capacity: 1200,
                            tiers: [
                              {
                                id: "tier-cse-lower",
                                name: "Lower Tier",
                                color: "#fca5a5",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "D",
                                seats_per_row: 12,
                              },
                              {
                                id: "tier-cse-upper",
                                name: "Upper Tier",
                                color: "#b91c1c",
                                ticket_type_id: premiumTicket,
                                row_start: "E",
                                row_end: "H",
                                seats_per_row: 14,
                              },
                            ],
                          },

                          // 8. South-West Corner Arc (Snug to South & West with zero space)
                          {
                            id: "euro-corner-sw",
                            name: "Stand SW Corner Arc",
                            color: "#ef4444",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: 385,
                            outerRadius: 535,
                            startAngle: 126,
                            sweepAngle: 38,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1070,
                            height: 1070,
                            rotation: 0,
                            capacity: 1200,
                            tiers: [
                              {
                                id: "tier-csw-lower",
                                name: "Lower Tier",
                                color: "#fca5a5",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "D",
                                seats_per_row: 12,
                              },
                              {
                                id: "tier-csw-upper",
                                name: "Upper Tier",
                                color: "#b91c1c",
                                ticket_type_id: premiumTicket,
                                row_start: "E",
                                row_end: "H",
                                seats_per_row: 14,
                              },
                            ],
                          },
                        ];

                        const snugEuroElements: StadiumElementDef[] = [
                          {
                            id: "gate-nw",
                            name: "Gate 1 (NW)",
                            type: "gate",
                            icon: "🚪",
                            color: "#15803d",
                            x: 440,
                            y: 350,
                            width: 40,
                            height: 40,
                            rotation: 0,
                          },
                          {
                            id: "gate-ne",
                            name: "Gate 2 (NE)",
                            type: "gate",
                            icon: "🚪",
                            color: "#15803d",
                            x: 1120,
                            y: 350,
                            width: 40,
                            height: 40,
                            rotation: 0,
                          },
                          {
                            id: "gate-se",
                            name: "Gate 3 (SE)",
                            type: "gate",
                            icon: "🚪",
                            color: "#15803d",
                            x: 1120,
                            y: 810,
                            width: 40,
                            height: 40,
                            rotation: 0,
                          },
                          {
                            id: "gate-sw",
                            name: "Gate 4 (SW)",
                            type: "gate",
                            icon: "🚪",
                            color: "#15803d",
                            x: 440,
                            y: 810,
                            width: 40,
                            height: 40,
                            rotation: 0,
                          },
                        ];

                        setBlocks(snugEuroBlocks);
                        setElements(snugEuroElements);
                        setSelectedId(snugEuroBlocks[0].id);
                        toast.success("Generated Seamless European Arena with snug zero-gap stands!");
                      }}
                      className="w-full p-2.5 rounded-xl bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 hover:from-sky-500 hover:to-purple-500 text-white font-extrabold text-xs shadow-md shadow-indigo-700/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <span className="text-base">✨</span>
                      <span>⚡ Generate European Arena (Zero Gap · Snug Stands)</span>
                    </button>

                    {/* Hero Preset 0C: 360° Continuous European Arena Bowl (Concentric Zero-Gap Bowl) */}
                    <button
                      type="button"
                      onClick={() => {
                        setGroundConfig({
                          sport_type: "football",
                          pitch_label: "NATIONAL FOOTBALL ARENA",
                          turf_color: "#15803d",
                          track_color: "#1e293b",
                          shape: "rectangle",
                          x: 520,
                          y: 425,
                          width: 560,
                          height: 350,
                          rotation: 0,
                        });
                        setPitchLabel("NATIONAL FOOTBALL ARENA");

                        const defaultTicket = ticketTypes[0]?.id || "";
                        const premiumTicket = ticketTypes[1]?.id || defaultTicket;
                        const vipTicket = ticketTypes[2]?.id || premiumTicket;

                        const cx = CANVAS_W / 2; // 800
                        const cy = CANVAS_H / 2; // 600

                        const inR = 375;
                        const outR = 535;

                        const bowlBlocks: StadiumBlockDef[] = [
                          // 1. North Sideline Stand (246° to 294°)
                          {
                            id: "bowl-north",
                            name: "North Grandstand (Sideline)",
                            color: "#0284c7",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: inR,
                            outerRadius: outR,
                            startAngle: 246,
                            sweepAngle: 48,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1070,
                            height: 1070,
                            rotation: 0,
                            capacity: 3400,
                            tiers: [
                              {
                                id: "tier-bn-lower",
                                name: "Lower Tier",
                                color: "#38bdf8",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "F",
                                seats_per_row: 22,
                              },
                              {
                                id: "tier-bn-vip",
                                name: "VIP Executive Suites",
                                color: "#f59e0b",
                                ticket_type_id: vipTicket,
                                row_start: "G",
                                row_end: "H",
                                seats_per_row: 18,
                              },
                              {
                                id: "tier-bn-upper",
                                name: "Upper Grandstand",
                                color: "#0284c7",
                                ticket_type_id: premiumTicket,
                                row_start: "I",
                                row_end: "N",
                                seats_per_row: 24,
                              },
                            ],
                          },

                          // 2. Stand NE Corner Arc (294° to 336° - exactly meets North at 294° and East at 336°)
                          {
                            id: "bowl-corner-ne",
                            name: "Stand NE Corner Arc",
                            color: "#0ea5e9",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: inR,
                            outerRadius: outR,
                            startAngle: 294,
                            sweepAngle: 42,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1070,
                            height: 1070,
                            rotation: 0,
                            capacity: 1800,
                            tiers: [
                              {
                                id: "tier-bne-lower",
                                name: "Lower Tier",
                                color: "#7dd3fc",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "D",
                                seats_per_row: 14,
                              },
                              {
                                id: "tier-bne-vip",
                                name: "VIP Executive Suites",
                                color: "#f59e0b",
                                ticket_type_id: vipTicket,
                                row_start: "G",
                                row_end: "H",
                                seats_per_row: 12,
                              },
                              {
                                id: "tier-bne-upper",
                                name: "Upper Tier",
                                color: "#0369a1",
                                ticket_type_id: premiumTicket,
                                row_start: "E",
                                row_end: "H",
                                seats_per_row: 16,
                              },
                            ],
                          },

                          // 3. East Goal Stand (336° to 24° - spans 48° across 0°)
                          {
                            id: "bowl-east",
                            name: "East Goal Stand",
                            color: "#9333ea",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: inR,
                            outerRadius: outR,
                            startAngle: 336,
                            sweepAngle: 48,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1070,
                            height: 1070,
                            rotation: 0,
                            capacity: 3400,
                            tiers: [
                              {
                                id: "tier-be-lower",
                                name: "Lower Tier",
                                color: "#c084fc",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "F",
                                seats_per_row: 22,
                              },
                              {
                                id: "tier-be-vip",
                                name: "VIP Executive Suites",
                                color: "#f59e0b",
                                ticket_type_id: vipTicket,
                                row_start: "G",
                                row_end: "H",
                                seats_per_row: 18,
                              },
                              {
                                id: "tier-be-upper",
                                name: "Upper Grandstand",
                                color: "#7e22ce",
                                ticket_type_id: premiumTicket,
                                row_start: "I",
                                row_end: "N",
                                seats_per_row: 24,
                              },
                            ],
                          },

                          // 4. Stand SE Corner Arc (24° to 66° - exactly meets East at 24° and South at 66°)
                          {
                            id: "bowl-corner-se",
                            name: "Stand SE Corner Arc",
                            color: "#ef4444",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: inR,
                            outerRadius: outR,
                            startAngle: 24,
                            sweepAngle: 42,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1070,
                            height: 1070,
                            rotation: 0,
                            capacity: 1800,
                            tiers: [
                              {
                                id: "tier-bse-lower",
                                name: "Lower Tier",
                                color: "#fca5a5",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "D",
                                seats_per_row: 14,
                              },
                              {
                                id: "tier-bse-vip",
                                name: "VIP Executive Suites",
                                color: "#f59e0b",
                                ticket_type_id: vipTicket,
                                row_start: "G",
                                row_end: "H",
                                seats_per_row: 12,
                              },
                              {
                                id: "tier-bse-upper",
                                name: "Upper Tier",
                                color: "#b91c1c",
                                ticket_type_id: premiumTicket,
                                row_start: "E",
                                row_end: "H",
                                seats_per_row: 16,
                              },
                            ],
                          },

                          // 5. South Sideline Stand (66° to 114° - exactly meets SE at 66° and SW at 114°)
                          {
                            id: "bowl-south",
                            name: "South Grandstand (Sideline)",
                            color: "#dc2626",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: inR,
                            outerRadius: outR,
                            startAngle: 66,
                            sweepAngle: 48,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1070,
                            height: 1070,
                            rotation: 0,
                            capacity: 3400,
                            tiers: [
                              {
                                id: "tier-bs-lower",
                                name: "Lower Tier",
                                color: "#f87171",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "F",
                                seats_per_row: 22,
                              },
                              {
                                id: "tier-bs-vip",
                                name: "VIP Executive Suites",
                                color: "#f59e0b",
                                ticket_type_id: vipTicket,
                                row_start: "G",
                                row_end: "H",
                                seats_per_row: 18,
                              },
                              {
                                id: "tier-bs-upper",
                                name: "Upper Grandstand",
                                color: "#b91c1c",
                                ticket_type_id: premiumTicket,
                                row_start: "I",
                                row_end: "N",
                                seats_per_row: 24,
                              },
                            ],
                          },

                          // 6. Stand SW Corner Arc (114° to 156° - exactly meets South at 114° and West at 156°)
                          {
                            id: "bowl-corner-sw",
                            name: "Stand SW Corner Arc",
                            color: "#ef4444",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: inR,
                            outerRadius: outR,
                            startAngle: 114,
                            sweepAngle: 42,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1070,
                            height: 1070,
                            rotation: 0,
                            capacity: 1800,
                            tiers: [
                              {
                                id: "tier-bsw-lower",
                                name: "Lower Tier",
                                color: "#fca5a5",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "D",
                                seats_per_row: 14,
                              },
                              {
                                id: "tier-bsw-vip",
                                name: "VIP Executive Suites",
                                color: "#f59e0b",
                                ticket_type_id: vipTicket,
                                row_start: "G",
                                row_end: "H",
                                seats_per_row: 12,
                              },
                              {
                                id: "tier-bsw-upper",
                                name: "Upper Tier",
                                color: "#b91c1c",
                                ticket_type_id: premiumTicket,
                                row_start: "E",
                                row_end: "H",
                                seats_per_row: 16,
                              },
                            ],
                          },

                          // 7. West Goal Stand (156° to 204° - exactly meets SW at 156° and NW at 204°)
                          {
                            id: "bowl-west",
                            name: "West Goal Stand",
                            color: "#ea580c",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: inR,
                            outerRadius: outR,
                            startAngle: 156,
                            sweepAngle: 48,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1070,
                            height: 1070,
                            rotation: 0,
                            capacity: 3400,
                            tiers: [
                              {
                                id: "tier-bw-lower",
                                name: "Lower Tier",
                                color: "#fb923c",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "F",
                                seats_per_row: 22,
                              },
                              {
                                id: "tier-bw-vip",
                                name: "VIP Executive Suites",
                                color: "#f59e0b",
                                ticket_type_id: vipTicket,
                                row_start: "G",
                                row_end: "H",
                                seats_per_row: 18,
                              },
                              {
                                id: "tier-bw-upper",
                                name: "Upper Grandstand",
                                color: "#c2410c",
                                ticket_type_id: premiumTicket,
                                row_start: "I",
                                row_end: "N",
                                seats_per_row: 24,
                              },
                            ],
                          },

                          // 8. Stand NW Corner Arc (204° to 246° - exactly meets West at 204° and North at 246°)
                          {
                            id: "bowl-corner-nw",
                            name: "Stand NW Corner Arc",
                            color: "#0ea5e9",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: inR,
                            outerRadius: outR,
                            startAngle: 204,
                            sweepAngle: 42,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1070,
                            height: 1070,
                            rotation: 0,
                            capacity: 1800,
                            tiers: [
                              {
                                id: "tier-bnw-lower",
                                name: "Lower Tier",
                                color: "#7dd3fc",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "D",
                                seats_per_row: 14,
                              },
                              {
                                id: "tier-bnw-vip",
                                name: "VIP Executive Suites",
                                color: "#f59e0b",
                                ticket_type_id: vipTicket,
                                row_start: "G",
                                row_end: "H",
                                seats_per_row: 12,
                              },
                              {
                                id: "tier-bnw-upper",
                                name: "Upper Tier",
                                color: "#0369a1",
                                ticket_type_id: premiumTicket,
                                row_start: "E",
                                row_end: "H",
                                seats_per_row: 16,
                              },
                            ],
                          },
                        ];

                        setBlocks(bowlBlocks);
                        setElements([]);
                        setSelectedId(bowlBlocks[0].id);
                        toast.success("Generated 360° Continuous European Bowl Arena with Zero Gaps and Zero Overlap!");
                      }}
                      className="w-full p-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white font-extrabold text-xs shadow-md shadow-purple-700/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <span className="text-base">🏟️</span>
                      <span>⚡ Generate Continuous European Bowl (360° Seamless · Zero Gap)</span>
                    </button>

                    {/* Hero Preset 1: Olympic Football Stadium (Ethiopian National Stadium Style) */}
                    <button
                      type="button"
                      onClick={() => {
                        setGroundConfig({
                          sport_type: "football",
                          pitch_label: "ETHIOPIAN NATIONAL STADIUM",
                          turf_color: "#15803d",
                          track_color: "#7f1d1d",
                          shape: "capsule",
                          x: CANVAS_W * 0.33,
                          y: CANVAS_H * 0.20,
                          width: CANVAS_W * 0.34,
                          height: CANVAS_H * 0.60,
                          rotation: 0,
                        });
                        setPitchLabel("ETHIOPIAN NATIONAL STADIUM");

                        const defaultTicket = ticketTypes[0]?.id || "";
                        const premiumTicket = ticketTypes[1]?.id || defaultTicket;
                        const vipTicket = ticketTypes[2]?.id || premiumTicket;

                        const cx = CANVAS_W / 2; // 800
                        const cy = CANVAS_H / 2; // 600

                        const newBlocks: StadiumBlockDef[] = [
                          // 1. Stand A: North Goal (North Stand Arc)
                          {
                            id: "eth-stand-a",
                            name: "Stand A (North Goal)",
                            color: "#0284c7",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: 370,
                            outerRadius: 515,
                            startAngle: 246,
                            sweepAngle: 48,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1030,
                            height: 1030,
                            rotation: 0,
                            capacity: 1200,
                            tiers: [
                              {
                                id: "tier-a-lower",
                                name: "Lower Tier",
                                color: "#38bdf8",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "D",
                                seats_per_row: 12,
                              },
                              {
                                id: "tier-a-upper",
                                name: "Upper Grandstand",
                                color: "#0284c7",
                                ticket_type_id: premiumTicket,
                                row_start: "E",
                                row_end: "H",
                                seats_per_row: 14,
                              },
                            ],
                          },

                          // 2. Stand E: North-East Corner Arc
                          {
                            id: "eth-stand-e",
                            name: "Stand E (NE Corner)",
                            color: "#0ea5e9",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: 370,
                            outerRadius: 515,
                            startAngle: 296,
                            sweepAngle: 32,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1030,
                            height: 1030,
                            rotation: 0,
                            capacity: 900,
                            tiers: [
                              {
                                id: "tier-e-lower",
                                name: "Lower Tier",
                                color: "#7dd3fc",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "D",
                                seats_per_row: 10,
                              },
                              {
                                id: "tier-e-upper",
                                name: "Upper Grandstand",
                                color: "#0369a1",
                                ticket_type_id: premiumTicket,
                                row_start: "E",
                                row_end: "H",
                                seats_per_row: 12,
                              },
                            ],
                          },

                          // 3. Stand F: East Sideline North Arc
                          {
                            id: "eth-stand-f",
                            name: "Stand F (East Sideline North)",
                            color: "#4f46e5",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: 370,
                            outerRadius: 515,
                            startAngle: 330,
                            sweepAngle: 28,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1030,
                            height: 1030,
                            rotation: 0,
                            capacity: 900,
                            tiers: [
                              {
                                id: "tier-f-lower",
                                name: "Lower Tier",
                                color: "#818cf8",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "D",
                                seats_per_row: 10,
                              },
                              {
                                id: "tier-f-upper",
                                name: "Upper Grandstand",
                                color: "#4338ca",
                                ticket_type_id: premiumTicket,
                                row_start: "E",
                                row_end: "H",
                                seats_per_row: 12,
                              },
                            ],
                          },

                          // 4. Stand G: East Sideline South Arc
                          {
                            id: "eth-stand-g",
                            name: "Stand G (East Sideline South)",
                            color: "#4f46e5",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: 370,
                            outerRadius: 515,
                            startAngle: 2,
                            sweepAngle: 28,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1030,
                            height: 1030,
                            rotation: 0,
                            capacity: 900,
                            tiers: [
                              {
                                id: "tier-g-lower",
                                name: "Lower Tier",
                                color: "#818cf8",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "D",
                                seats_per_row: 10,
                              },
                              {
                                id: "tier-g-upper",
                                name: "Upper Grandstand",
                                color: "#4338ca",
                                ticket_type_id: premiumTicket,
                                row_start: "E",
                                row_end: "H",
                                seats_per_row: 12,
                              },
                            ],
                          },

                          // 5. Stand H (SE): South-East Corner Arc
                          {
                            id: "eth-stand-h-se",
                            name: "Stand H (SE Corner)",
                            color: "#7c3aed",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: 370,
                            outerRadius: 515,
                            startAngle: 32,
                            sweepAngle: 32,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1030,
                            height: 1030,
                            rotation: 0,
                            capacity: 900,
                            tiers: [
                              {
                                id: "tier-hse-lower",
                                name: "Lower Tier",
                                color: "#c4b5fd",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "D",
                                seats_per_row: 10,
                              },
                              {
                                id: "tier-hse-upper",
                                name: "Upper Grandstand",
                                color: "#6d28d9",
                                ticket_type_id: premiumTicket,
                                row_start: "E",
                                row_end: "H",
                                seats_per_row: 12,
                              },
                            ],
                          },

                          // 6. Stand I: South Goal (South Stand Arc)
                          {
                            id: "eth-stand-i",
                            name: "Stand I (South Goal)",
                            color: "#9333ea",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: 370,
                            outerRadius: 515,
                            startAngle: 66,
                            sweepAngle: 48,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1030,
                            height: 1030,
                            rotation: 0,
                            capacity: 1200,
                            tiers: [
                              {
                                id: "tier-i-lower",
                                name: "Lower Tier",
                                color: "#d8b4fe",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "D",
                                seats_per_row: 12,
                              },
                              {
                                id: "tier-i-upper",
                                name: "Upper Grandstand",
                                color: "#7e22ce",
                                ticket_type_id: premiumTicket,
                                row_start: "E",
                                row_end: "H",
                                seats_per_row: 14,
                              },
                            ],
                          },

                          // 7. Stand H (SW): South-West Corner Arc
                          {
                            id: "eth-stand-h-sw",
                            name: "Stand H (SW Corner)",
                            color: "#7c3aed",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: 370,
                            outerRadius: 515,
                            startAngle: 116,
                            sweepAngle: 32,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1030,
                            height: 1030,
                            rotation: 0,
                            capacity: 900,
                            tiers: [
                              {
                                id: "tier-hsw-lower",
                                name: "Lower Tier",
                                color: "#c4b5fd",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "D",
                                seats_per_row: 10,
                              },
                              {
                                id: "tier-hsw-upper",
                                name: "Upper Grandstand",
                                color: "#6d28d9",
                                ticket_type_id: premiumTicket,
                                row_start: "E",
                                row_end: "H",
                                seats_per_row: 12,
                              },
                            ],
                          },

                          // 8. Stand C: West Sideline South Arc
                          {
                            id: "eth-stand-c",
                            name: "Stand C (West Sideline South)",
                            color: "#059669",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: 370,
                            outerRadius: 515,
                            startAngle: 150,
                            sweepAngle: 28,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1030,
                            height: 1030,
                            rotation: 0,
                            capacity: 900,
                            tiers: [
                              {
                                id: "tier-c-lower",
                                name: "Lower Tier",
                                color: "#34d399",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "D",
                                seats_per_row: 10,
                              },
                              {
                                id: "tier-c-upper",
                                name: "Upper Grandstand",
                                color: "#047857",
                                ticket_type_id: premiumTicket,
                                row_start: "E",
                                row_end: "H",
                                seats_per_row: 12,
                              },
                            ],
                          },

                          // 9. Stand B: West Sideline North Arc
                          {
                            id: "eth-stand-b",
                            name: "Stand B (West Sideline North)",
                            color: "#059669",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: 370,
                            outerRadius: 515,
                            startAngle: 182,
                            sweepAngle: 28,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1030,
                            height: 1030,
                            rotation: 0,
                            capacity: 900,
                            tiers: [
                              {
                                id: "tier-b-lower",
                                name: "Lower Tier",
                                color: "#34d399",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "D",
                                seats_per_row: 10,
                              },
                              {
                                id: "tier-b-upper",
                                name: "Upper Grandstand",
                                color: "#047857",
                                ticket_type_id: premiumTicket,
                                row_start: "E",
                                row_end: "H",
                                seats_per_row: 12,
                              },
                            ],
                          },

                          // 10. Stand J: North-West Corner Arc
                          {
                            id: "eth-stand-j",
                            name: "Stand J (NW Corner)",
                            color: "#0ea5e9",
                            stand_level: "multi",
                            shape: "arc",
                            innerRadius: 370,
                            outerRadius: 515,
                            startAngle: 212,
                            sweepAngle: 32,
                            stadiumCenterX: cx,
                            stadiumCenterY: cy,
                            x: cx,
                            y: cy,
                            width: 1030,
                            height: 1030,
                            rotation: 0,
                            capacity: 900,
                            tiers: [
                              {
                                id: "tier-j-lower",
                                name: "Lower Tier",
                                color: "#7dd3fc",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "D",
                                seats_per_row: 10,
                              },
                              {
                                id: "tier-j-upper",
                                name: "Upper Grandstand",
                                color: "#0369a1",
                                ticket_type_id: premiumTicket,
                                row_start: "E",
                                row_end: "H",
                                seats_per_row: 12,
                              },
                            ],
                          },
                        ];

                        setBlocks(newBlocks);
                        setSelectedId(newBlocks[0].id);
                        toast.success("Generated Olympic Football Stadium Layout — All Stands in Ring Arc!");
                      }}
                      className="w-full p-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white font-extrabold text-xs shadow-md shadow-blue-700/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <span className="text-base">⚽</span>
                      <span>⚡ Generate Olympic Football Stadium (Ethiopian Style)</span>
                    </button>

                    {/* Hero Preset 2: 360° Circular Cricket Stadium (BookMyShow / Guwahati style) */}
                    <button
                      type="button"
                      onClick={() => {
                        setGroundConfig({
                          sport_type: "cricket",
                          pitch_label: "CRICKET GROUND",
                          turf_color: "#15803d",
                          track_color: "#052e16",
                          shape: "oval",
                          x: CANVAS_W * 0.23,
                          y: CANVAS_H * 0.23,
                          width: CANVAS_W * 0.54,
                          height: CANVAS_H * 0.54,
                          rotation: 0,
                        });
                        setPitchLabel("CRICKET GROUND");

                        const sectors = [
                          { name: "North Stand Block A", deg: 247.5, color: "#831843", colorLower: "#cbd5e1" },
                          { name: "North Stand Block G", deg: 292.5, color: "#9d174d", colorLower: "#cbd5e1" },
                          { name: "East Stand Block B", deg: 337.5, color: "#f43f5e", colorLower: "#cbd5e1" },
                          { name: "East Stand Block D", deg: 22.5, color: "#e11d48", colorLower: "#cbd5e1" },
                          { name: "South Stand Block C", deg: 67.5, color: "#a21caf", colorLower: "#cbd5e1" },
                          { name: "VIP Boxes / Lounge", deg: 112.5, color: "#d97706", colorLower: "#fde047" },
                          { name: "West Stand Block E", deg: 157.5, color: "#64748b", colorLower: "#cbd5e1" },
                          { name: "West Stand Block F", deg: 202.5, color: "#475569", colorLower: "#cbd5e1" },
                        ];

                        const defaultTicket = ticketTypes[0]?.id || "";
                        const premiumTicket = ticketTypes[1]?.id || defaultTicket;

                        const newBlocks: StadiumBlockDef[] = [];

                        sectors.forEach((sec, idx) => {
                          // Lower Ring: Ground Floor (closer to field)
                          newBlocks.push({
                            id: `circular-sec-${idx}-gr`,
                            name: `${sec.name} Gr. Floor`,
                            color: sec.colorLower,
                            stand_level: "lower",
                            x: CANVAS_W / 2,
                            y: CANVAS_H / 2,
                            width: 335 * 2,
                            height: 335 * 2,
                            rotation: 0,
                            capacity: 1200,
                            shape: "arc",
                            innerRadius: 260,
                            outerRadius: 335,
                            startAngle: sec.deg,
                            sweepAngle: 43,
                            stadiumCenterX: CANVAS_W / 2,
                            stadiumCenterY: CANVAS_H / 2,
                            tiers: [
                              {
                                id: `tier-${idx}-gr`,
                                name: "Ground Floor",
                                ticket_type_id: defaultTicket,
                                row_start: "A",
                                row_end: "D",
                                seats_per_row: 10,
                              },
                            ],
                          });

                          // Upper Ring: 2nd / 3rd Floor (grandstand)
                          newBlocks.push({
                            id: `circular-sec-${idx}-upper`,
                            name: `${sec.name} Upper Tier`,
                            color: sec.color,
                            stand_level: "upper",
                            x: CANVAS_W / 2,
                            y: CANVAS_H / 2,
                            width: 480 * 2,
                            height: 480 * 2,
                            rotation: 0,
                            capacity: 1800,
                            shape: "arc",
                            innerRadius: 342,
                            outerRadius: 475,
                            startAngle: sec.deg,
                            sweepAngle: 43,
                            stadiumCenterX: CANVAS_W / 2,
                            stadiumCenterY: CANVAS_H / 2,
                            tiers: [
                              {
                                id: `tier-${idx}-upper`,
                                name: "Upper Grandstand",
                                ticket_type_id: premiumTicket,
                                row_start: "E",
                                row_end: "H",
                                seats_per_row: 12,
                              },
                            ],
                          });
                        });

                        setBlocks(newBlocks);
                        setSelectedId(newBlocks[0].id);
                        toast.success("Generated 360° Concentric Circular Cricket Stadium!");
                      }}
                      className="w-full p-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <span className="text-base">🏏</span>
                      <span>⚡ Generate 360° Circular Cricket Stadium (BookMyShow Style)</span>
                    </button>

                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      {/* Preset 3: Classic Rectangular Stadium */}
                      <button
                        type="button"
                        onClick={() => {
                          setGroundConfig({
                            sport_type: "football",
                            pitch_label: "RECTANGULAR ARENA",
                            turf_color: "#15803d",
                            track_color: "#1e293b",
                            shape: "rectangle",
                            x: 500,
                            y: 330,
                            width: 600,
                            height: 540,
                            rotation: 0,
                          });
                          setPitchLabel("RECTANGULAR ARENA");

                          const defaultTicket = ticketTypes[0]?.id || "";
                          const premiumTicket = ticketTypes[1]?.id || defaultTicket;
                          const vipTicket = ticketTypes[2]?.id || premiumTicket;

                          const rectBlocks: StadiumBlockDef[] = [
                            // North Stand (Lower + Upper)
                            {
                              id: "rect-north",
                              name: "North Grandstand",
                              color: "#2563eb",
                              stand_level: "multi",
                              shape: "rectangle",
                              x: 500,
                              y: 155,
                              width: 600,
                              height: 155,
                              rotation: 0,
                              capacity: 2500,
                              tiers: [
                                {
                                  id: "t-rn-lower",
                                  name: "Lower Tier",
                                  color: "#60a5fa",
                                  ticket_type_id: defaultTicket,
                                  row_start: "A",
                                  row_end: "H",
                                  seats_per_row: 30,
                                },
                                {
                                  id: "t-rn-upper",
                                  name: "Upper Grandstand",
                                  color: "#1d4ed8",
                                  ticket_type_id: premiumTicket,
                                  row_start: "I",
                                  row_end: "P",
                                  seats_per_row: 32,
                                },
                              ],
                            },
                            // South Stand (Lower + Upper)
                            {
                              id: "rect-south",
                              name: "South Grandstand",
                              color: "#7c3aed",
                              stand_level: "multi",
                              shape: "rectangle",
                              x: 500,
                              y: 890,
                              width: 600,
                              height: 155,
                              rotation: 0,
                              capacity: 2500,
                              tiers: [
                                {
                                  id: "t-rs-lower",
                                  name: "Lower Tier",
                                  color: "#a78bfa",
                                  ticket_type_id: defaultTicket,
                                  row_start: "A",
                                  row_end: "H",
                                  seats_per_row: 30,
                                },
                                {
                                  id: "t-rs-upper",
                                  name: "Upper Grandstand",
                                  color: "#6d28d9",
                                  ticket_type_id: premiumTicket,
                                  row_start: "I",
                                  row_end: "P",
                                  seats_per_row: 32,
                                },
                              ],
                            },
                            // West Stand (Lower + Upper)
                            {
                              id: "rect-west",
                              name: "West Grandstand",
                              color: "#059669",
                              stand_level: "multi",
                              shape: "rectangle",
                              x: 270,
                              y: 330,
                              width: 210,
                              height: 540,
                              rotation: 0,
                              tier_split_direction: "horizontal",
                              capacity: 2800,
                              tiers: [
                                {
                                  id: "t-rw-lower",
                                  name: "Lower Tier",
                                  color: "#34d399",
                                  ticket_type_id: defaultTicket,
                                  row_start: "A",
                                  row_end: "H",
                                  seats_per_row: 26,
                                },
                                {
                                  id: "t-rw-upper",
                                  name: "Upper Grandstand",
                                  color: "#047857",
                                  ticket_type_id: premiumTicket,
                                  row_start: "I",
                                  row_end: "P",
                                  seats_per_row: 28,
                                },
                              ],
                            },
                            // East Stand (Lower + Upper)
                            {
                              id: "rect-east",
                              name: "East Grandstand",
                              color: "#d97706",
                              stand_level: "multi",
                              shape: "rectangle",
                              x: 1120,
                              y: 330,
                              width: 210,
                              height: 540,
                              rotation: 0,
                              tier_split_direction: "horizontal",
                              capacity: 2800,
                              tiers: [
                                {
                                  id: "t-re-lower",
                                  name: "Lower Tier",
                                  color: "#fbbf24",
                                  ticket_type_id: defaultTicket,
                                  row_start: "A",
                                  row_end: "H",
                                  seats_per_row: 26,
                                },
                                {
                                  id: "t-re-upper",
                                  name: "Upper Grandstand",
                                  color: "#b45309",
                                  ticket_type_id: premiumTicket,
                                  row_start: "I",
                                  row_end: "P",
                                  seats_per_row: 28,
                                },
                              ],
                            },
                            // 4 Corner Stands
                            {
                              id: "rect-nw",
                              name: "North-West Corner",
                              color: "#3b82f6",
                              shape: "rectangle",
                              x: 270,
                              y: 155,
                              width: 210,
                              height: 155,
                              rotation: 0,
                              capacity: 800,
                              tiers: [{ id: "t-rnw", name: "Corner Seats", ticket_type_id: defaultTicket, row_start: "A", row_end: "H", seats_per_row: 16 }],
                            },
                            {
                              id: "rect-ne",
                              name: "North-East Corner",
                              color: "#3b82f6",
                              shape: "rectangle",
                              x: 1120,
                              y: 155,
                              width: 210,
                              height: 155,
                              rotation: 0,
                              capacity: 800,
                              tiers: [{ id: "t-rne", name: "Corner Seats", ticket_type_id: defaultTicket, row_start: "A", row_end: "H", seats_per_row: 16 }],
                            },
                            {
                              id: "rect-sw",
                              name: "South-West Corner",
                              color: "#8b5cf6",
                              shape: "rectangle",
                              x: 270,
                              y: 890,
                              width: 210,
                              height: 155,
                              rotation: 0,
                              capacity: 800,
                              tiers: [{ id: "t-rsw", name: "Corner Seats", ticket_type_id: defaultTicket, row_start: "A", row_end: "H", seats_per_row: 16 }],
                            },
                            {
                              id: "rect-se",
                              name: "South-East Corner",
                              color: "#8b5cf6",
                              shape: "rectangle",
                              x: 1120,
                              y: 890,
                              width: 210,
                              height: 155,
                              rotation: 0,
                              capacity: 800,
                              tiers: [{ id: "t-rse", name: "Corner Seats", ticket_type_id: defaultTicket, row_start: "A", row_end: "H", seats_per_row: 16 }],
                            },
                            // VIP Director Box
                            {
                              id: "rect-vip",
                              name: "Presidential VIP Box",
                              color: "#dc2626",
                              stand_level: "lower",
                              shape: "rectangle",
                              x: 700,
                              y: 345,
                              width: 200,
                              height: 65,
                              rotation: 0,
                              capacity: 150,
                              tiers: [{ id: "t-rvip", name: "VIP Box", color: "#f87171", ticket_type_id: vipTicket, row_start: "A", row_end: "C", seats_per_row: 20 }],
                            },
                          ];

                          setBlocks(rectBlocks);
                          setSelectedId(rectBlocks[0].id);
                          toast.success("Generated Classic Rectangular Stadium with 4 Grandstands + Corners!");
                        }}
                        className="p-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-[11px] font-bold text-left flex items-center gap-1.5 shadow-sm transition-colors"
                      >
                        <span>🔲</span>
                        <span>Classic Rect</span>
                      </button>

                      {/* Preset 4: Olympic Pill Bowl */}
                      <button
                        type="button"
                        onClick={() => {
                          setGroundConfig({
                            sport_type: "football",
                            pitch_label: "OLYMPIC TRACK & FIELD",
                            turf_color: "#14532d",
                            track_color: "#7f1d1d",
                            shape: "capsule",
                            x: CANVAS_W * 0.25,
                            y: CANVAS_H * 0.22,
                            width: CANVAS_W * 0.50,
                            height: CANVAS_H * 0.56,
                            rotation: 0,
                          });
                          setPitchLabel("OLYMPIC TRACK & FIELD");

                          const defaultTicket = ticketTypes[0]?.id || "";
                          const premiumTicket = ticketTypes[1]?.id || defaultTicket;

                          const pillBlocks: StadiumBlockDef[] = [
                            {
                              id: "pill-north-curve",
                              name: "North Curve Bow",
                              color: "#0369a1",
                              stand_level: "multi",
                              shape: "curved",
                              x: CANVAS_W * 0.28,
                              y: 90,
                              width: CANVAS_W * 0.44,
                              height: 150,
                              rotation: 0,
                              capacity: 2000,
                              tiers: [
                                { id: "pnc-1", name: "Lower Bow", color: "#38bdf8", ticket_type_id: defaultTicket, row_start: "A", row_end: "H", seats_per_row: 28 },
                                { id: "pnc-2", name: "Upper Grandstand", color: "#0284c7", ticket_type_id: premiumTicket, row_start: "I", row_end: "P", seats_per_row: 30 },
                              ],
                            },
                            {
                              id: "pill-south-curve",
                              name: "South Curve Bow",
                              color: "#7e22ce",
                              stand_level: "multi",
                              shape: "curved",
                              x: CANVAS_W * 0.28,
                              y: CANVAS_H - 240,
                              width: CANVAS_W * 0.44,
                              height: 150,
                              rotation: 180,
                              capacity: 2000,
                              tiers: [
                                { id: "psc-1", name: "Lower Bow", color: "#c084fc", ticket_type_id: defaultTicket, row_start: "A", row_end: "H", seats_per_row: 28 },
                                { id: "psc-2", name: "Upper Grandstand", color: "#9333ea", ticket_type_id: premiumTicket, row_start: "I", row_end: "P", seats_per_row: 30 },
                              ],
                            },
                            {
                              id: "pill-west-straight",
                              name: "West Trackside Grandstand",
                              color: "#059669",
                              stand_level: "multi",
                              shape: "pill",
                              x: 170,
                              y: CANVAS_H * 0.24,
                              width: 210,
                              height: CANVAS_H * 0.52,
                              rotation: 0,
                              tier_split_direction: "horizontal",
                              capacity: 2400,
                              tiers: [
                                { id: "pws-1", name: "Trackside Lower", color: "#34d399", ticket_type_id: defaultTicket, row_start: "A", row_end: "H", seats_per_row: 24 },
                                { id: "pws-2", name: "Upper Grandstand", color: "#047857", ticket_type_id: premiumTicket, row_start: "I", row_end: "P", seats_per_row: 26 },
                              ],
                            },
                            {
                              id: "pill-east-straight",
                              name: "East Trackside Grandstand",
                              color: "#ea580c",
                              stand_level: "multi",
                              shape: "pill",
                              x: CANVAS_W - 380,
                              y: CANVAS_H * 0.24,
                              width: 210,
                              height: CANVAS_H * 0.52,
                              rotation: 0,
                              tier_split_direction: "horizontal",
                              capacity: 2400,
                              tiers: [
                                { id: "pes-1", name: "Trackside Lower", color: "#fb923c", ticket_type_id: defaultTicket, row_start: "A", row_end: "H", seats_per_row: 24 },
                                { id: "pes-2", name: "Upper Grandstand", color: "#c2410c", ticket_type_id: premiumTicket, row_start: "I", row_end: "P", seats_per_row: 26 },
                              ],
                            },
                          ];

                          setBlocks(pillBlocks);
                          setSelectedId(pillBlocks[0].id);
                          toast.success("Applied Olympic Stadium with Running Track!");
                        }}
                        className="p-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-[11px] font-bold text-left flex items-center gap-1.5 shadow-sm transition-colors"
                      >
                        <span>🏟️</span>
                        <span>Olympic Pill</span>
                      </button>

                      {/* Preset 5: Curved Cricket Bowl */}
                      <button
                        type="button"
                        onClick={() => {
                          setGroundConfig({
                            sport_type: "cricket",
                            pitch_label: "CRICKET GROUND",
                            turf_color: "#15803d",
                            track_color: "#052e16",
                            shape: "oval",
                            x: CANVAS_W * 0.22,
                            y: CANVAS_H * 0.22,
                            width: CANVAS_W * 0.56,
                            height: CANVAS_H * 0.56,
                            rotation: 0,
                          });
                          setPitchLabel("CRICKET GROUND");

                          const defaultTicket = ticketTypes[0]?.id || "";
                          const premiumTicket = ticketTypes[1]?.id || defaultTicket;

                          const curvedBlocks: StadiumBlockDef[] = [
                            {
                              id: "crv-north",
                              name: "North Pavilion Bowl",
                              color: "#831843",
                              stand_level: "multi",
                              shape: "curved",
                              x: CANVAS_W * 0.28,
                              y: 110,
                              width: CANVAS_W * 0.44,
                              height: 140,
                              rotation: 0,
                              capacity: 1800,
                              tiers: [
                                { id: "cn-1", name: "Ground Floor", color: "#f472b6", ticket_type_id: defaultTicket, row_start: "A", row_end: "G", seats_per_row: 24 },
                                { id: "cn-2", name: "Upper Tier", color: "#9d174d", ticket_type_id: premiumTicket, row_start: "H", row_end: "N", seats_per_row: 26 },
                              ],
                            },
                            {
                              id: "crv-south",
                              name: "South Pavilion Bowl",
                              color: "#4338ca",
                              stand_level: "multi",
                              shape: "curved",
                              x: CANVAS_W * 0.28,
                              y: CANVAS_H - 250,
                              width: CANVAS_W * 0.44,
                              height: 140,
                              rotation: 180,
                              capacity: 1800,
                              tiers: [
                                { id: "cs-1", name: "Ground Floor", color: "#818cf8", ticket_type_id: defaultTicket, row_start: "A", row_end: "G", seats_per_row: 24 },
                                { id: "cs-2", name: "Upper Tier", color: "#3730a3", ticket_type_id: premiumTicket, row_start: "H", row_end: "N", seats_per_row: 26 },
                              ],
                            },
                            {
                              id: "crv-west",
                              name: "West Wing Stand",
                              color: "#059669",
                              stand_level: "multi",
                              shape: "curved",
                              x: 180,
                              y: CANVAS_H * 0.28,
                              width: 170,
                              height: CANVAS_H * 0.44,
                              rotation: 270,
                              capacity: 1600,
                              tiers: [
                                { id: "cw-1", name: "Lower Stand", color: "#34d399", ticket_type_id: defaultTicket, row_start: "A", row_end: "G", seats_per_row: 22 },
                                { id: "cw-2", name: "Upper Stand", color: "#047857", ticket_type_id: premiumTicket, row_start: "H", row_end: "N", seats_per_row: 24 },
                              ],
                            },
                            {
                              id: "crv-east",
                              name: "East Wing Stand",
                              color: "#d97706",
                              stand_level: "multi",
                              shape: "curved",
                              x: CANVAS_W - 350,
                              y: CANVAS_H * 0.28,
                              width: 170,
                              height: CANVAS_H * 0.44,
                              rotation: 90,
                              capacity: 1600,
                              tiers: [
                                { id: "ce-1", name: "Lower Stand", color: "#fbbf24", ticket_type_id: defaultTicket, row_start: "A", row_end: "G", seats_per_row: 22 },
                                { id: "ce-2", name: "Upper Stand", color: "#b45309", ticket_type_id: premiumTicket, row_start: "H", row_end: "N", seats_per_row: 24 },
                              ],
                            },
                          ];

                          setBlocks(curvedBlocks);
                          setSelectedId(curvedBlocks[0].id);
                          toast.success("Applied Oval Cricket Ground with Curved Stands!");
                        }}
                        className="p-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-[11px] font-bold text-left flex items-center gap-1.5 shadow-sm transition-colors"
                      >
                        <span>🏏</span>
                        <span>Curved Cricket</span>
                      </button>

                      {/* Preset 6: Indoor Basketball Arena */}
                      <button
                        type="button"
                        onClick={() => {
                          setGroundConfig({
                            sport_type: "basketball",
                            pitch_label: "BASKETBALL ARENA",
                            turf_color: "#b45309",
                            track_color: "#0f172a",
                            shape: "rectangle",
                            x: CANVAS_W * 0.32,
                            y: CANVAS_H * 0.28,
                            width: CANVAS_W * 0.36,
                            height: CANVAS_H * 0.44,
                            rotation: 0,
                          });
                          setPitchLabel("BASKETBALL ARENA");

                          const defaultTicket = ticketTypes[0]?.id || "";
                          const premiumTicket = ticketTypes[1]?.id || defaultTicket;
                          const courtsideTicket = ticketTypes[2]?.id || premiumTicket;

                          const courtBlocks: StadiumBlockDef[] = [
                            // Courtside VIP Rows
                            {
                              id: "court-vip-north",
                              name: "Courtside VIP Floor North",
                              color: "#f59e0b",
                              stand_level: "lower",
                              shape: "rectangle",
                              x: CANVAS_W * 0.32,
                              y: CANVAS_H * 0.28 - 60,
                              width: CANVAS_W * 0.36,
                              height: 50,
                              rotation: 0,
                              capacity: 100,
                              tiers: [{ id: "cvip-n", name: "Floor VIP Row", color: "#fbbf24", ticket_type_id: courtsideTicket, row_start: "A", row_end: "B", seats_per_row: 25 }],
                            },
                            {
                              id: "court-vip-south",
                              name: "Courtside VIP Floor South",
                              color: "#f59e0b",
                              stand_level: "lower",
                              shape: "rectangle",
                              x: CANVAS_W * 0.32,
                              y: CANVAS_H * 0.72 + 10,
                              width: CANVAS_W * 0.36,
                              height: 50,
                              rotation: 0,
                              capacity: 100,
                              tiers: [{ id: "cvip-s", name: "Floor VIP Row", color: "#fbbf24", ticket_type_id: courtsideTicket, row_start: "A", row_end: "B", seats_per_row: 25 }],
                            },
                            // North Bleachers
                            {
                              id: "court-bleacher-north",
                              name: "North Tiered Bleachers",
                              color: "#2563eb",
                              stand_level: "multi",
                              shape: "rectangle",
                              x: CANVAS_W * 0.28,
                              y: 110,
                              width: CANVAS_W * 0.44,
                              height: 150,
                              rotation: 0,
                              capacity: 1500,
                              tiers: [
                                { id: "cbn-1", name: "Lower Bleachers", color: "#60a5fa", ticket_type_id: defaultTicket, row_start: "A", row_end: "G", seats_per_row: 24 },
                                { id: "cbn-2", name: "Upper Level", color: "#1d4ed8", ticket_type_id: premiumTicket, row_start: "H", row_end: "N", seats_per_row: 26 },
                              ],
                            },
                            // South Bleachers
                            {
                              id: "court-bleacher-south",
                              name: "South Tiered Bleachers",
                              color: "#7c3aed",
                              stand_level: "multi",
                              shape: "rectangle",
                              x: CANVAS_W * 0.28,
                              y: CANVAS_H * 0.72 + 70,
                              width: CANVAS_W * 0.44,
                              height: 150,
                              rotation: 0,
                              capacity: 1500,
                              tiers: [
                                { id: "cbs-1", name: "Lower Bleachers", color: "#a78bfa", ticket_type_id: defaultTicket, row_start: "A", row_end: "G", seats_per_row: 24 },
                                { id: "cbs-2", name: "Upper Level", color: "#6d28d9", ticket_type_id: premiumTicket, row_start: "H", row_end: "N", seats_per_row: 26 },
                              ],
                            },
                            // West Bleachers
                            {
                              id: "court-bleacher-west",
                              name: "West Sideline Bleachers",
                              color: "#059669",
                              stand_level: "multi",
                              shape: "rectangle",
                              x: 270,
                              y: CANVAS_H * 0.26,
                              width: 190,
                              height: CANVAS_H * 0.48,
                              rotation: 0,
                              tier_split_direction: "horizontal",
                              capacity: 1600,
                              tiers: [
                                { id: "cbw-1", name: "Lower Level", color: "#34d399", ticket_type_id: defaultTicket, row_start: "A", row_end: "G", seats_per_row: 22 },
                                { id: "cbw-2", name: "Upper Level", color: "#047857", ticket_type_id: premiumTicket, row_start: "H", row_end: "N", seats_per_row: 24 },
                              ],
                            },
                            // East Bleachers
                            {
                              id: "court-bleacher-east",
                              name: "East Sideline Bleachers",
                              color: "#ea580c",
                              stand_level: "multi",
                              shape: "rectangle",
                              x: CANVAS_W * 0.68 + 60,
                              y: CANVAS_H * 0.26,
                              width: 190,
                              height: CANVAS_H * 0.48,
                              rotation: 0,
                              tier_split_direction: "horizontal",
                              capacity: 1600,
                              tiers: [
                                { id: "cbe-1", name: "Lower Level", color: "#fb923c", ticket_type_id: defaultTicket, row_start: "A", row_end: "G", seats_per_row: 22 },
                                { id: "cbe-2", name: "Upper Level", color: "#c2410c", ticket_type_id: premiumTicket, row_start: "H", row_end: "N", seats_per_row: 24 },
                              ],
                            },
                          ];

                          setBlocks(courtBlocks);
                          setSelectedId(courtBlocks[0].id);
                          toast.success("Applied Indoor Arena Bowl!");
                        }}
                        className="p-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-[11px] font-bold text-left flex items-center gap-1.5 shadow-sm transition-colors"
                      >
                        <span>🏀</span>
                        <span>Indoor Arena</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Sport Ground Type</label>
                    <select
                      className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-sm"
                      value={groundConfig.sport_type}
                      onChange={(e) => handleSportTypeChange(e.target.value as any)}
                    >
                      <option value="football">⚽ Football / Soccer Pitch</option>
                      <option value="cricket">🏏 Cricket Ground (Oval & Wicket)</option>
                      <option value="basketball">🏀 Basketball / Indoor Court</option>
                      <option value="tennis">🎾 Tennis Court</option>
                      <option value="concert">🎤 Concert Arena Floor</option>
                      <option value="festival_t_stage">🎸 Festival T-Stage (Stage, Fan Pit, Platinum, Gold, Silver)</option>
                      <option value="custom">🔲 Custom Rectangular Field</option>
                      <option value="none">🚫 No Ground Section (Remove / Hide)</option>
                    </select>
                  </div>

                  {groundConfig.sport_type === "festival_t_stage" ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">🎤 Stage Deck Label</label>
                        <input
                          className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-sm"
                          value={groundConfig.stage_label ?? groundConfig.pitch_label}
                          onChange={(e) =>
                            setGroundConfig((prev) => ({
                              ...prev,
                              stage_label: e.target.value,
                              pitch_label: e.target.value,
                            }))
                          }
                          placeholder="e.g. MAIN STAGE or ARTIST / FESTIVAL NAME"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-slate-700">T-Runway / Catwalk Label</label>
                          <span className="text-[10px] text-slate-400 font-semibold">Optional</span>
                        </div>
                        <input
                          className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-sm"
                          value={groundConfig.catwalk_label ?? ""}
                          onChange={(e) =>
                            setGroundConfig((prev) => ({
                              ...prev,
                              catwalk_label: e.target.value,
                            }))
                          }
                          placeholder="Leave empty for clean runway (No text)"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                          Text on catwalk is removed by default. Type here only if you wish to label it.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Center Ground Label</label>
                      <input
                        className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-sm"
                        value={groundConfig.pitch_label}
                        onChange={(e) =>
                          setGroundConfig((prev) => ({
                            ...prev,
                            pitch_label: e.target.value,
                          }))
                        }
                        placeholder="e.g. MAIN PITCH or STAGE"
                      />
                    </div>
                  )}

                  {groundConfig.sport_type === "festival_t_stage" && (
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Arena Floor Theme</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setGroundConfig((prev) => ({
                              ...prev,
                              turf_color: "#ffffff",
                              track_color: "#ffffff",
                            }))
                          }
                          className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                            groundConfig.turf_color === "#ffffff" || !groundConfig.turf_color
                              ? "bg-sky-50 border-sky-500 text-sky-700 shadow-sm"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>⚪</span>
                          <span>Clean White Arena</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setGroundConfig((prev) => ({
                              ...prev,
                              turf_color: "#090d16",
                              track_color: "#020617",
                            }))
                          }
                          className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                            groundConfig.turf_color === "#090d16"
                              ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>⚫</span>
                          <span>Dark Night Arena</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Turf / Floor Color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        className="w-12 h-10 rounded-xl border border-slate-300 cursor-pointer bg-white p-1 shadow-sm"
                        value={groundConfig.turf_color || "#14532d"}
                        onChange={(e) =>
                          setGroundConfig((prev) => ({
                            ...prev,
                            turf_color: e.target.value,
                          }))
                        }
                      />
                      <div className="flex flex-wrap gap-1.5 flex-1">
                        {["#ffffff", "#f8fafc", "#090d16", "#14532d", "#064e3b", "#b45309", "#1d4ed8", "#1e293b"].map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setGroundConfig((p) => ({ ...p, turf_color: c }))}
                            className={`w-6 h-6 rounded-md border shadow-sm hover:scale-110 transition-transform ${groundConfig.turf_color === c ? "border-sky-500 ring-2 ring-sky-300" : "border-slate-300"}`}
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Surround Track / Outer Color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        className="w-12 h-10 rounded-xl border border-slate-300 cursor-pointer bg-white p-1 shadow-sm"
                        value={groundConfig.track_color || "#7f1d1d"}
                        onChange={(e) =>
                          setGroundConfig((prev) => ({
                            ...prev,
                            track_color: e.target.value,
                          }))
                        }
                      />
                      <div className="flex flex-wrap gap-1.5 flex-1">
                        {["#ffffff", "#f1f5f9", "#020617", "#7f1d1d", "#052e16", "#0f172a", "#0c4a6e", "#334155"].map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setGroundConfig((p) => ({ ...p, track_color: c }))}
                            className={`w-6 h-6 rounded-md border shadow-sm hover:scale-110 transition-transform ${groundConfig.track_color === c ? "border-sky-500 ring-2 ring-sky-300" : "border-slate-300"}`}
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Remove / Delete Ground Button */}
                  <div className="pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={deleteGround}
                      className="w-full text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-rose-200 hover:border-rose-300 bg-rose-50/60 hover:bg-rose-100/80 transition-colors shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" /> Remove / Delete Ground Section
                    </button>
                  </div>
                </div>
              </>
            )}
              </div>
            )}
          </div>

          {/* High-Visibility Sticky Summary Footer */}
          <div className="shrink-0 p-3.5 border-t border-slate-200 bg-white shadow-xl space-y-2 z-10">
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Layout</span>
                <span className="font-extrabold text-amber-700 font-mono text-sm">
                  {totalEstSeats.toLocaleString()} seats
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Organizer Target</span>
                <span className="font-extrabold text-emerald-700 font-mono text-sm">
                  {totalOrganizerCapacity.toLocaleString()} tickets
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center text-[11px] px-1">
              <span className="text-slate-500 font-medium">
                {blocks.length} stands · {elements.length} elements
              </span>

              {isVenueRequest || !isEventOrgRequest || (unassignedTiersCount === 0 && (totalOrganizerCapacity === 0 || totalEstSeats === totalOrganizerCapacity)) ? (
                <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Ready to Submit
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const { errors } = performStrictValidation();
                    setValidationErrors(errors);
                    setShowValidationModal(true);
                  }}
                  className="text-rose-700 hover:text-rose-800 font-bold text-[11px] flex items-center gap-1 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 transition-colors"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Issues to Resolve
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Strict Validation Alert Modal */}
      {showValidationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-rose-100 flex items-center justify-between bg-rose-50">
              <div className="flex items-center gap-2.5 text-rose-700">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Cannot Submit: Validation Issues Detected
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowValidationModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 bg-white">
              <p className="text-xs text-slate-600 font-medium">
                To guarantee ticket buyers have valid seats without overselling or missing tickets, all stands and ticket capacities must be reconciled:
              </p>

              <div className="space-y-2">
                {validationErrors.map((err, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-xs text-rose-800 font-semibold"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span className="flex-1">{err}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleAutoFitAllTiers}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
              >
                <Wand2 className="w-4 h-4" />
                <span>Auto-Fit All to Match Organizer</span>
              </button>

              <button
                type="button"
                onClick={() => setShowValidationModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-sm"
              >
                Review & Edit Manually
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Experience Simulation Modal (Level 1 Stadium -> Level 2/3 Seat Picker & Publishing) */}
      <CustomerStadiumPreviewModal
        isOpen={showCustomerPreview}
        onClose={() => setShowCustomerPreview(false)}
        stadiumName={stadiumName}
        groundConfig={groundConfig}
        blocks={blocks}
        elements={elements}
        ticketTypes={ticketTypes}
        onPublish={handlePublish}
        isPublishing={isPublishing}
      />
    </div>
  );
}
