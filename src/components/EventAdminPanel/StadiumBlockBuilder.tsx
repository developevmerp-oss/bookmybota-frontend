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
  sport_type: "football" | "cricket" | "basketball" | "tennis" | "concert" | "custom";
  pitch_label: string;
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
    row_end: "J",
    seats_per_row: 25,
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
  const rowCount = Math.max(
    0,
    tier.row_end.charCodeAt(0) - tier.row_start.charCodeAt(0) + 1
  );
  const tierSeatTotal = rowCount * (tier.seats_per_row || 0);

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
    </div>
  );
}

// ─── Stand Panel ─────────────────────────────────────────────────────────────

function BlockPanel({
  block,
  isSelected,
  ticketTypes,
  onUpdate,
  onDelete,
  onSelect,
}: {
  block: StadiumBlockDef;
  isSelected: boolean;
  ticketTypes: any[];
  onUpdate: (b: StadiumBlockDef) => void;
  onDelete: () => void;
  onSelect: () => void;
}) {
  const [open, setOpen] = useState(true);

  const totalSeats = block.tiers.reduce((acc, t) => {
    const rows = Math.max(
      0,
      t.row_end.charCodeAt(0) - t.row_start.charCodeAt(0) + 1
    );
    return acc + rows * (t.seats_per_row || 0);
  }, 0);

  const unassignedCount = block.tiers.filter((t) => !t.ticket_type_id).length;

  const assignedTicketNames = block.tiers
    .map((t) => {
      const tt = ticketTypes.find((item) => item.id === t.ticket_type_id);
      return tt ? tt.name || tt.ticket_type : null;
    })
    .filter(Boolean);

  const handleStandSeatCountChange = (targetCount: number) => {
    if (targetCount <= 0) return;
    if (!block.tiers || block.tiers.length === 0) {
      const fitted = autoFitRowsAndSeats(targetCount);
      onUpdate({
        ...block,
        tiers: [
          {
            id: `t-${Date.now()}`,
            name: "Tier 1",
            row_start: fitted.rowStart,
            row_end: fitted.rowEnd,
            seats_per_row: fitted.seatsPerRow,
            ticket_type_id: ticketTypes[0]?.id || "",
          },
        ],
      });
      return;
    }

    if (block.tiers.length === 1) {
      const fitted = autoFitRowsAndSeats(targetCount);
      onUpdate({
        ...block,
        tiers: [
          {
            ...block.tiers[0],
            row_start: fitted.rowStart,
            row_end: fitted.rowEnd,
            seats_per_row: fitted.seatsPerRow,
          },
        ],
      });
      return;
    }

    const currentTotal = totalSeats || 1;
    let remaining = targetCount;
    const newTiers = block.tiers.map((t, idx) => {
      const rows = Math.max(0, t.row_end.charCodeAt(0) - t.row_start.charCodeAt(0) + 1);
      const tierCurr = rows * (t.seats_per_row || 0);
      const share =
        idx === block.tiers.length - 1
          ? remaining
          : Math.round((tierCurr / currentTotal) * targetCount);
      remaining -= share;
      const fitted = autoFitRowsAndSeats(Math.max(1, share));
      return {
        ...t,
        row_start: fitted.rowStart,
        row_end: fitted.rowEnd,
        seats_per_row: fitted.seatsPerRow,
      };
    });
    onUpdate({ ...block, tiers: newTiers });
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
              <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                {totalSeats.toLocaleString()} seats
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

          {/* Stand Capacity & Price (Two Column Card) */}
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
            <div className="grid grid-cols-4 gap-1.5 text-xs text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-200 font-mono font-semibold text-center">
              <span>X: {Math.round(block.x)}</span>
              <span>Y: {Math.round(block.y)}</span>
              <span>W: {Math.round(block.width)}</span>
              <span>H: {Math.round(block.height)}</span>
            </div>
          )}

          {/* Tiers in this Stand */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-700">
                Seating Tiers ({block.tiers.length})
              </span>
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
  onSave: (config: StadiumSeatingConfigOutput) => Promise<void>;
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
    initialConfig?.ground ?? {
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

  // ── Switch Sport Ground Handler ──
  const handleSportTypeChange = (type: StadiumGroundConfig["sport_type"]) => {
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
    } else if (type === "custom") {
      label = "MULTI-PURPOSE FIELD";
      color = "#334155";
      track = "#1e293b";
    }

    setGroundConfig((prev) => ({
      ...prev,
      sport_type: type,
      pitch_label: label,
      turf_color: color,
      track_color: track,
      shape: type === "cricket" ? "oval" : "rectangle",
    }));
    setPitchLabel(label);
    toast.info(`Switched sport ground to ${type.toUpperCase()} layout!`);
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
        b.tiers.forEach((t) => {
          if (t.ticket_type_id === tt.id) {
            const rowCount = Math.max(
              0,
              t.row_end.charCodeAt(0) - t.row_start.charCodeAt(0) + 1
            );
            layoutSeats += rowCount * (t.seats_per_row || 0);
          }
        });
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
    return blocks.reduce((acc, b) => {
      return (
        acc +
        b.tiers.reduce((ta, t) => {
          const rows = Math.max(
            0,
            t.row_end.charCodeAt(0) - t.row_start.charCodeAt(0) + 1
          );
          return ta + rows * (t.seats_per_row || 0);
        }, 0)
      );
    }, 0);
  }, [blocks]);

  const unassignedTiersCount = useMemo(() => {
    return blocks.reduce(
      (acc, b) => acc + b.tiers.filter((t) => !t.ticket_type_id).length,
      0
    );
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

      generatedBlocks.push({
        id: `stand-${tt.id.slice(0, 6)}`,
        name: tt.name || tt.ticket_type || pos.name,
        color,
        x: pos.x,
        y: pos.y,
        width: pos.w,
        height: pos.h,
        rotation: 0,
        capacity: target,
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
      });
    });

    setBlocks(generatedBlocks);
    setSelectedId(null);
    toast.success(`🎉 Auto-generated ${generatedBlocks.length} stands matching organizer ticket capacities!`);
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
      if (b.tiers.length === 0) {
        errors.push(`Stand "${b.name}" has no tiers. Add at least one tier to define seats.`);
      }
      b.tiers.forEach((t) => {
        if (!t.ticket_type_id) {
          errors.push(
            `Tier "${t.name}" in Stand "${b.name}" has NO ticket type assigned. Please link it to an organizer ticket type.`
          );
        }
        const rowCount = Math.max(
          0,
          t.row_end.charCodeAt(0) - t.row_start.charCodeAt(0) + 1
        );
        if (rowCount <= 0 || (t.seats_per_row || 0) <= 0) {
          errors.push(
            `Tier "${t.name}" in Stand "${b.name}" has an invalid row or seat configuration (${rowCount} rows, ${t.seats_per_row} seats/row).`
          );
        }
      });
    });

    ticketTypes.forEach((tt) => {
      const target = Number(tt.total_count) || 0;
      if (target > 0) {
        let layoutSeats = 0;
        blocks.forEach((b) => {
          b.tiers.forEach((t) => {
            if (t.ticket_type_id === tt.id) {
              const rowCount = Math.max(
                0,
                t.row_end.charCodeAt(0) - t.row_start.charCodeAt(0) + 1
              );
              layoutSeats += rowCount * (t.seats_per_row || 0);
            }
          });
        });

        if (layoutSeats === 0) {
          errors.push(
            `Ticket Type "${tt.name || tt.ticket_type}" (Capacity: ${target}) has 0 seats in the layout. Please assign it to a stand tier.`
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

  const handleSaveAndGenerate = async () => {
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

    await onSave(config);

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
        toast.success(
          `🎉 Generated ${res.generated.toLocaleString()} seats across ${res.blocks} stands!`
        );
      } catch (err: any) {
        toast.error(
          err?.data?.error || err?.message || "Failed to generate stadium seats."
        );
      }
    } else {
      toast.success("Stadium layout saved successfully!");
    }
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
                value={groundConfig.sport_type}
                onChange={(e) => handleSportTypeChange(e.target.value as any)}
              >
                <option value="football">⚽ Football / Soccer Pitch</option>
                <option value="cricket">🏏 Cricket Ground Oval</option>
                <option value="basketball">🏀 Basketball / Arena Court</option>
                <option value="tennis">🎾 Tennis Court</option>
                <option value="concert">🎤 Concert Arena & Stage</option>
                <option value="custom">🔲 Custom Pitch</option>
              </select>
            </div>

            {/* Quick Pitch Edit Toggle Button */}
            <div>
              <label className="text-xs uppercase font-extrabold text-slate-300 block mb-1">
                Ground Mode
              </label>
              <button
                type="button"
                onClick={() => {
                  if (isPitchSelected) {
                    setSelectedId(null);
                  } else {
                    setSelectedId("ground-pitch");
                    setSelectedElementId(null);
                    setActiveSidebarTab("ground");
                  }
                }}
                className={`flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-lg border transition-all active:scale-95 ${isPitchSelected
                  ? "bg-sky-500 text-slate-950 border-sky-400 shadow-md shadow-sky-500/20"
                  : "bg-slate-800 hover:bg-slate-700 text-sky-400 border-slate-600"
                  }`}
                title="Click to select pitch and move/resize on canvas"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>{isPitchSelected ? "Pitch Active" : "Edit Pitch Section"}</span>
              </button>
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

          <button
            type="button"
            onClick={handleSaveAndGenerate}
            disabled={saving || isGenerating}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-lg active:scale-95 shrink-0"
          >
            {saving || isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {eventId ? "Save & Generate Seats" : "Save Stadium Config"}
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
                          : groundConfig.sport_type === "concert"
                            ? "#030712"
                            : "#7f1d1d")
                  }
                  stroke={isPitchSelected ? "#38bdf8" : "rgba(255,255,255,0.15)"}
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

                {/* Pitch Label */}
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
              </Group>

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
                const totalSeats = block.tiers.reduce((acc, t) => {
                  const rows = Math.max(
                    0,
                    t.row_end.charCodeAt(0) - t.row_start.charCodeAt(0) + 1
                  );
                  return acc + rows * (t.seats_per_row || 0);
                }, 0);

                const assignedTicket = ticketTypes.find(
                  (tt) => tt.id === block.tiers[0]?.ticket_type_id
                );

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
                  const labelX = sCenterX + Math.cos(midAngleRad) * midRadius;
                  const labelY = sCenterY + Math.sin(midAngleRad) * midRadius;

                  return (
                    <Group
                      key={block.id}
                      id={block.id}
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
                      {block.tiers && block.tiers.length > 1 ? (
                        <>
                          {block.tiers.map((tier, tIdx) => {
                            const numTiers = block.tiers.length;
                            const radialSpan = (outerR - innerR) / numTiers;
                            const tierInR = innerR + tIdx * radialSpan;
                            const tierOutR = tierInR + radialSpan;
                            const tierColor = tier.color || (tIdx === 0 ? "#f59e0b" : "#10b981");
                            const midR = (tierInR + tierOutR) / 2;
                            const tierLabelX = sCenterX + Math.cos(midAngleRad) * midR;
                            const tierLabelY = sCenterY + Math.sin(midAngleRad) * midR;
                            const rowCount = Math.max(
                              0,
                              tier.row_end.charCodeAt(0) - tier.row_start.charCodeAt(0) + 1
                            );
                            const tierSeats = rowCount * (tier.seats_per_row || 0);

                            return (
                              <Group key={tier.id || `arc-tier-${tIdx}`}>
                                <Arc
                                  x={sCenterX}
                                  y={sCenterY}
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
                            x={sCenterX}
                            y={sCenterY}
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
                                assignedTicket
                                  ? `${assignedTicket.name || assignedTicket.ticket_type} · ${totalSeats} seats`
                                  : `${totalSeats} seats`
                              }
                              x={-80}
                              y={3}
                              width={160}
                              align="center"
                              fontSize={9}
                              fontStyle="bold"
                              fill="#fde047"
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
                    ) : block.tiers && block.tiers.length > 1 ? (
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

                        {/* Render each tier as its own slice */}
                        {block.tiers.map((tier, tIdx) => {
                          const numTiers = block.tiers.length;
                          const tierH = block.height / numTiers;
                          const tierY = tIdx * tierH;
                          const tierColor = tier.color || (tIdx === 0 ? "#f59e0b" : "#10b981");
                          const isFirst = tIdx === 0;
                          const isLast = tIdx === numTiers - 1;
                          const rowCount = Math.max(
                            0,
                            tier.row_end.charCodeAt(0) - tier.row_start.charCodeAt(0) + 1
                          );
                          const tierSeats = rowCount * (tier.seats_per_row || 0);
                          const assigned = ticketTypes.find((tt) => tt.id === tier.ticket_type_id);

                          return (
                            <Group key={tier.id || `tier-slice-${tIdx}`}>
                              <Rect
                                x={0}
                                y={tierY}
                                width={block.width}
                                height={tierH}
                                fill={tierColor}
                                opacity={0.92}
                                cornerRadius={
                                  isFirst && isLast
                                    ? 14
                                    : isFirst
                                    ? [14, 14, 0, 0]
                                    : isLast
                                    ? [0, 0, 14, 14]
                                    : 0
                                }
                              />
                              {tIdx > 0 && (
                                <Line
                                  points={[8, tierY, block.width - 8, tierY]}
                                  stroke="rgba(255,255,255,0.5)"
                                  strokeWidth={1.5}
                                  dash={[5, 4]}
                                />
                              )}
                              {/* Tier Name & Seats */}
                              <Text
                                text={tier.name.toUpperCase()}
                                x={6}
                                y={tierY + Math.max(3, tierH * 0.15)}
                                width={block.width - 12}
                                align="center"
                                fontSize={Math.max(10, Math.min(block.width * 0.05, tierH * 0.32))}
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
                                x={6}
                                y={tierY + Math.max(16, tierH * 0.55)}
                                width={block.width - 12}
                                align="center"
                                fontSize={Math.max(9, Math.min(block.width * 0.038, tierH * 0.24))}
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
                            assignedTicket
                              ? `${assignedTicket.name || assignedTicket.ticket_type} · ${totalSeats} seats`
                              : `${totalSeats} seats`
                          }
                          x={4}
                          y={Math.max(28, block.height * 0.55)}
                          width={block.width - 8}
                          align="center"
                          fontSize={Math.max(11, Math.min(block.width, block.height) * 0.12)}
                          fontStyle="bold"
                          fill="#fde047"
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
                  <button
                    type="button"
                    onClick={addBlock}
                    className="flex items-center gap-1 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-xl shadow-sm transition-all active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Stand
                  </button>
                </div>

                {blocks.map((block) => (
                  <BlockPanel
                    key={block.id}
                    block={block}
                    isSelected={selectedId === block.id}
                    ticketTypes={ticketTypes}
                    onUpdate={updateBlock}
                    onDelete={() => deleteBlock(block.id)}
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
                {/* 🎯 Pitch Active Selection Banner */}
                <div
                  className={`p-3.5 rounded-2xl border transition-all ${isPitchSelected
                    ? "bg-sky-50 border-sky-300 ring-2 ring-sky-400/25 shadow-sm"
                    : "bg-white border-slate-200 shadow-sm"
                    }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">🎯</span>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">
                          {isPitchSelected ? "Pitch Selected (Handles Active)" : "Pitch Section"}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {isPitchSelected ? "Drag on canvas to position, pull handles to resize" : "Click to select pitch on canvas"}
                        </p>
                      </div>
                    </div>
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
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm active:scale-95 shrink-0 ${isPitchSelected
                        ? "bg-sky-600 text-white hover:bg-sky-700"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                        }`}
                    >
                      {isPitchSelected ? "Deselect" : "Select Pitch"}
                    </button>
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
                    {/* Primary Hero Preset: 360° Circular Cricket Stadium (BookMyShow / Guwahati style) */}
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
                                row_end: "J",
                                seats_per_row: 20,
                              },
                            ],
                          });

                          // Upper Ring: 2nd / 3rd Floor (grandstand)
                          newBlocks.push({
                            id: `circular-sec-${idx}-upper`,
                            name: `${sec.name} Upper Tier`,
                            color: sec.color,
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
                                row_start: "A",
                                row_end: "M",
                                seats_per_row: 25,
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
                          setBlocks((prev) =>
                            prev.map((b) => ({
                              ...b,
                              shape: "curved",
                            }))
                          );
                          toast.success("Applied Oval Cricket Ground with Curved Stands!");
                        }}
                        className="p-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-[11px] font-bold text-left flex items-center gap-1.5 shadow-sm transition-colors"
                      >
                        <span>🏏</span>
                        <span>Curved Cricket</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setGroundConfig({
                            sport_type: "football",
                            pitch_label: "OLYMPIC STADIUM",
                            turf_color: "#14532d",
                            track_color: "#7f1d1d",
                            shape: "capsule",
                            x: CANVAS_W * 0.22,
                            y: CANVAS_H * 0.22,
                            width: CANVAS_W * 0.56,
                            height: CANVAS_H * 0.56,
                            rotation: 0,
                          });
                          setBlocks((prev) =>
                            prev.map((b, i) => ({
                              ...b,
                              shape: i % 2 === 0 ? "pill" : "curved",
                            }))
                          );
                          toast.success("Applied Olympic Stadium with Running Track!");
                        }}
                        className="p-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-[11px] font-bold text-left flex items-center gap-1.5 shadow-sm transition-colors"
                      >
                        <span>🏟️</span>
                        <span>Olympic Pill</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setGroundConfig({
                            sport_type: "football",
                            pitch_label: "FOOTBALL ARENA",
                            turf_color: "#14532d",
                            track_color: "#1e293b",
                            shape: "rectangle",
                            x: CANVAS_W * 0.22,
                            y: CANVAS_H * 0.22,
                            width: CANVAS_W * 0.56,
                            height: CANVAS_H * 0.56,
                            rotation: 0,
                          });
                          setBlocks((prev) =>
                            prev.map((b) => ({
                              ...b,
                              shape: "rectangle",
                            }))
                          );
                          toast.success("Applied Classic Rectangular Stadium!");
                        }}
                        className="p-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-[11px] font-bold text-left flex items-center gap-1.5 shadow-sm transition-colors"
                      >
                        <span>🔲</span>
                        <span>Classic Rect</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setGroundConfig({
                            sport_type: "basketball",
                            pitch_label: "BASKETBALL ARENA",
                            turf_color: "#b45309",
                            track_color: "#0f172a",
                            shape: "rectangle",
                            x: CANVAS_W * 0.25,
                            y: CANVAS_H * 0.25,
                            width: CANVAS_W * 0.5,
                            height: CANVAS_H * 0.5,
                            rotation: 0,
                          });
                          setBlocks((prev) =>
                            prev.map((b) => ({
                              ...b,
                              shape: "pill",
                            }))
                          );
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
                      <option value="custom">🔲 Custom Rectangular Field</option>
                    </select>
                  </div>

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

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Turf / Court Color</label>
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
                        {["#14532d", "#064e3b", "#b45309", "#1d4ed8", "#b91c1c", "#1e293b"].map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setGroundConfig((p) => ({ ...p, turf_color: c }))}
                            className="w-6 h-6 rounded-md border border-slate-300 shadow-sm hover:scale-110 transition-transform"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Surround Track Color</label>
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
                        {["#7f1d1d", "#052e16", "#0f172a", "#0c4a6e", "#030712", "#334155"].map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setGroundConfig((p) => ({ ...p, track_color: c }))}
                            className="w-6 h-6 rounded-md border border-slate-300 shadow-sm hover:scale-110 transition-transform"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
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
    </div>
  );
}
