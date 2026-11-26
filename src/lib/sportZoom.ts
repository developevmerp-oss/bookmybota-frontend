/**
 * "sport_zoom" stadium layout: curved stand blocks + standing zones on one flat map.
 * The seat maths here must stay identical to backend/src/services/sportZoomSeats.service.ts.
 */

export type SportCategory = { id: string; name: string; color: string; price: number };

export type SportObject = {
  id: string;
  type: "block" | "standing" | "stage" | "pitch" | "ground";
  name: string;
  category_id?: string;
  x: number; // centre
  y: number;
  w: number;
  h: number;
  rotation?: number;
  rows?: number;
  seats_per_row?: number;
  row_start?: string;
  /** explicit row names (A, B … Z, AA, AB …) when a layout already uses its own names */
  row_labels?: string[];
  /** tier id the seats of this block were saved with (keeps re-saves matching existing seats) */
  tier_id?: string;
  /** 1 = row A on the top edge of the block, -1 = row A on the bottom edge */
  row_dir?: 1 | -1;
  curve?: number;
  capacity?: number;
  /** Curved stand: rows are arcs around (cx, cy). Angles in degrees, `flip` mirrors it for the left-hand end */
  arc?: SportArc;
  /** Free outline (pitch / ground): points as fractions of w and h, from the centre */
  outline?: number[];
};

export type SportArc = { cx: number; cy: number; r0: number; r1: number; a0: number; a1: number; flip?: boolean };

export type SportConfig = {
  layout_mode: "sport_zoom";
  canvas: { w: number; h: number };
  categories: SportCategory[];
  objects: SportObject[];
};

export const sportRowLabel = (index: number, start = "A"): string => {
  const base = Math.max(0, String(start || "A").trim().toUpperCase().charCodeAt(0) - 65);
  const n = index + (Number.isFinite(base) ? base : 0);
  return String.fromCharCode(65 + (n % 26)).repeat(Math.floor(n / 26) + 1);
};

const rot = (lx: number, ly: number, o: SportObject) => {
  const a = ((o.rotation || 0) * Math.PI) / 180;
  return { x: o.x + lx * Math.cos(a) - ly * Math.sin(a), y: o.y + lx * Math.sin(a) + ly * Math.cos(a) };
};

export function arcPoint(a: SportArc, radius: number, angleDeg: number) {
  const t = (angleDeg * Math.PI) / 180;
  return { x: a.cx + (a.flip ? -1 : 1) * radius * Math.cos(t), y: a.cy + radius * Math.sin(t) };
}

export function blockSeatPoint(b: SportObject, rowIdx: number, seatIdx: number) {
  const rows = Math.max(1, b.rows || 1);
  const n = Math.max(1, b.seats_per_row || 1);
  const pad = 0.07;
  if (b.arc) {
    const r = b.row_dir === -1 ? rows - 1 - rowIdx : rowIdx;
    const uRow = pad + (1 - 2 * pad) * (rows === 1 ? 0.5 : r / (rows - 1));
    const uSeat = pad + (1 - 2 * pad) * (n === 1 ? 0.5 : seatIdx / (n - 1));
    return arcPoint(b.arc, b.arc.r0 + (b.arc.r1 - b.arc.r0) * uRow, b.arc.a0 + (b.arc.a1 - b.arc.a0) * uSeat);
  }
  const r = b.row_dir === -1 ? rows - 1 - rowIdx : rowIdx;
  const lx = -b.w / 2 + b.w * pad + (n === 1 ? 0.5 * b.w * (1 - 2 * pad) : (seatIdx * b.w * (1 - 2 * pad)) / (n - 1));
  let ly = -b.h / 2 + b.h * pad + (rows === 1 ? 0.5 * b.h * (1 - 2 * pad) : (r * b.h * (1 - 2 * pad)) / (rows - 1));
  const u = (2 * lx) / b.w;
  ly += (b.curve || 0) * b.h * 0.25 * (1 - u * u);
  return rot(lx, ly, b);
}

/** Outline of a block: straight sides, top and bottom edges bent by the same curve as the rows */
export function blockOutline(b: SportObject): string {
  if (b.arc) {
    const out: { x: number; y: number }[] = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) out.push(arcPoint(b.arc, b.arc.r1, b.arc.a0 + ((b.arc.a1 - b.arc.a0) * i) / steps));
    for (let i = steps; i >= 0; i--) out.push(arcPoint(b.arc, b.arc.r0, b.arc.a0 + ((b.arc.a1 - b.arc.a0) * i) / steps));
    return out.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  }
  const pts: { x: number; y: number }[] = [];
  const steps = 14;
  const off = (lx: number) => (b.curve || 0) * b.h * 0.25 * (1 - ((2 * lx) / b.w) ** 2);
  for (let i = 0; i <= steps; i++) {
    const lx = -b.w / 2 + (b.w * i) / steps;
    pts.push(rot(lx, -b.h / 2 + off(lx), b));
  }
  for (let i = steps; i >= 0; i--) {
    const lx = -b.w / 2 + (b.w * i) / steps;
    pts.push(rot(lx, b.h / 2 + off(lx), b));
  }
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

export function rectOutline(o: SportObject): string {
  if (o.outline && o.outline.length >= 6) {
    const pts: string[] = [];
    for (let i = 0; i + 1 < o.outline.length; i += 2) {
      const p = rot(o.outline[i] * o.w, o.outline[i + 1] * o.h, o);
      pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    }
    return pts.join(" ");
  }
  return [rot(-o.w / 2, -o.h / 2, o), rot(o.w / 2, -o.h / 2, o), rot(o.w / 2, o.h / 2, o), rot(-o.w / 2, o.h / 2, o)]
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
}

export const rowLabelOf = (o: { row_labels?: string[]; row_start?: string }, index: number): string => o.row_labels?.[index] ?? sportRowLabel(index, o.row_start);

export const newId = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

export const DEFAULT_CATEGORIES: SportCategory[] = [
  { id: "cat_premium", name: "Premium Stand", color: "#7c3aed", price: 5000 },
  { id: "cat_standard", name: "Standard Stand", color: "#2563eb", price: 2500 },
  { id: "cat_standing", name: "Standing Zone", color: "#d97706", price: 1500 },
];

import stadium from "./sportStadiumSample.json";

/** A copy of the South Africa vs Brazil stadium: 32 stands of 20 rows x 30 seats, plus two standing zones */
export function sampleSportLayout(): SportConfig {
  return JSON.parse(JSON.stringify(stadium)) as SportConfig;
}
