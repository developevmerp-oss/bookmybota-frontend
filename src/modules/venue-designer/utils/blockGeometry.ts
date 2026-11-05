"use client";

import { SeatShape, UniversalSeat, UniversalVenueObject } from "../types";

/**
 * Stadium blocks: any polygon you draw or pick from a preset, filled with seats on demand.
 * Everything here is pure geometry, so the canvas, the customer preview and the capacity counter share it.
 * Points are flat [x1, y1, x2, y2 ...] pairs, relative to the object's own x / y.
 */

const DEG = Math.PI / 180;
const MAX_SEATS_PER_BLOCK = 4000;

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function polyBounds(points: number[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < points.length; i += 2) {
    minX = Math.min(minX, points[i]);
    maxX = Math.max(maxX, points[i]);
    minY = Math.min(minY, points[i + 1]);
    maxY = Math.max(maxY, points[i + 1]);
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
}

/** Drawn size of a block's seats: set by the user, else a little less than the seat gap */
export function blockSeatSize(obj: UniversalVenueObject): number {
  if (obj.seatSize && obj.seatSize > 0) return obj.seatSize;
  return Math.max(8, Math.min(30, (obj.seatSpacing || 18) - 4));
}

/** Where a block's row names go: the gap to the end seat, the letter size, and the distance from the end seat's centre */
export function blockLabelMetrics(obj: UniversalVenueObject, size: number): { gap: number; fs: number; reach: number } {
  const gap = obj.blockLabelGap ?? Math.max(3, Math.round(size * 0.9));
  const fs = Math.max(3.5, Math.min(size * 1.1, (obj.rowSpacing || 22) * 0.95));
  return { gap, fs, reach: size / 2 + gap + fs / 2 };
}

/** Rectangle that holds exactly `rows` rows of `cols` seats at the given gaps (centred on 0,0) */
export function rectForGrid(rows: number, cols: number, seatGap = 18, rowGap = 22, inset = 10, extraH = 0): number[] {
  const w = (cols - 1) * seatGap + 2 * inset + 1 + 2 * extraH;
  const h = (rows - 0.5) * rowGap + 2 * inset + 1;
  return [-w / 2, -h / 2, w / 2, -h / 2, w / 2, h / 2, -w / 2, h / 2];
}

/** Turn flat points around 0,0 by `deg` degrees */
export function rotatePoints(points: number[], deg: number): number[] {
  if (!deg) return points;
  const a = deg * DEG;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const out: number[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) out.push(points[i] * c - points[i + 1] * s, points[i] * s + points[i + 1] * c);
  return out;
}

export function polyArea(points: number[]): number {
  let sum = 0;
  const n = points.length / 2;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    sum += points[i * 2] * points[j * 2 + 1] - points[j * 2] * points[i * 2 + 1];
  }
  return Math.abs(sum) / 2;
}

/** Centre of mass of the polygon (falls back to the middle of its box for a flat polygon) */
export function polyCentroid(points: number[]): { x: number; y: number } {
  const n = points.length / 2;
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const cross = points[i * 2] * points[j * 2 + 1] - points[j * 2] * points[i * 2 + 1];
    a += cross;
    cx += (points[i * 2] + points[j * 2]) * cross;
    cy += (points[i * 2 + 1] + points[j * 2 + 1]) * cross;
  }
  if (Math.abs(a) < 1e-6) {
    const b = polyBounds(points);
    return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

export function pointInPolygon(x: number, y: number, points: number[]): boolean {
  let inside = false;
  const n = points.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const xi = points[i * 2];
    const yi = points[i * 2 + 1];
    const xj = points[j * 2];
    const yj = points[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Shortest distance from a point to any edge of the polygon */
export function distanceToEdge(x: number, y: number, points: number[]): number {
  let best = Infinity;
  const n = points.length / 2;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const x1 = points[i * 2];
    const y1 = points[i * 2 + 1];
    const x2 = points[j * 2];
    const y2 = points[j * 2 + 1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
    best = Math.min(best, Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)));
  }
  return best;
}

/** Ring segment between two radii and two angles, as polygon points (absolute coordinates around cx, cy) */
export function arcSectorPoints(cx: number, cy: number, innerR: number, outerR: number, startDeg: number, endDeg: number, steps = 10): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = (startDeg + ((endDeg - startDeg) * i) / steps) * DEG;
    pts.push(cx + outerR * Math.cos(a), cy + outerR * Math.sin(a));
  }
  for (let i = steps; i >= 0; i -= 1) {
    const a = (startDeg + ((endDeg - startDeg) * i) / steps) * DEG;
    pts.push(cx + innerR * Math.cos(a), cy + innerR * Math.sin(a));
  }
  return pts;
}

export function ellipsePoints(rx: number, ry: number, steps = 56): number[] {
  const pts: number[] = [];
  for (let i = 0; i < steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    pts.push(rx * Math.cos(a), ry * Math.sin(a));
  }
  return pts;
}

/** Rectangle with rounded corners as polygon points, centred on 0,0 */
export function roundedRectPoints(w: number, h: number, r: number, stepsPerCorner = 5): number[] {
  const pts: number[] = [];
  const corners: Array<[number, number, number]> = [
    [w / 2 - r, -h / 2 + r, -90],
    [w / 2 - r, h / 2 - r, 0],
    [-w / 2 + r, h / 2 - r, 90],
    [-w / 2 + r, -h / 2 + r, 180],
  ];
  corners.forEach(([cx, cy, start]) => {
    for (let i = 0; i <= stepsPerCorner; i += 1) {
      const a = (start + (90 * i) / stepsPerCorner) * DEG;
      pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
  });
  return pts;
}

/** Move the polygon so its centre of mass is 0,0 and report where that centre was */
export function recentre(points: number[]): { points: number[]; cx: number; cy: number } {
  const c = polyCentroid(points);
  const out = points.map((v, i) => (i % 2 === 0 ? v - c.x : v - c.y));
  return { points: out, cx: c.x, cy: c.y };
}

export interface BlockPresetShape {
  points: number[];
  /** Fan-shaped blocks keep their rows curved around this point (relative to the block centre) */
  arcCenter?: [number, number];
  rowMode?: "straight" | "arc";
}

export interface BlockPreset {
  id: string;
  name: string;
  build: () => BlockPresetShape;
}

function fan(innerR: number, outerR: number, sweep: number): BlockPresetShape {
  const raw = arcSectorPoints(0, 0, innerR, outerR, -90 - sweep / 2, -90 + sweep / 2, 10);
  const r = recentre(raw);
  return { points: r.points, arcCenter: [-r.cx, -r.cy], rowMode: "arc" };
}


function hexPoints(rx: number, ry: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 6; i += 1) {
    const a = i * 60 * DEG;
    pts.push(Math.round(rx * Math.cos(a)), Math.round(ry * Math.sin(a)));
  }
  return pts;
}

function octPoints(r: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 8; i += 1) {
    const a = (22.5 + i * 45) * DEG;
    pts.push(Math.round(r * Math.cos(a)), Math.round(r * Math.sin(a)));
  }
  return pts;
}

/** A ring (outer edge, then inner edge walked the other way) joined by a seam, so one polygon shows a hole */
export function keyholeRing(outer: number[], inner: number[]): number[] {
  const rev: number[] = [inner[0], inner[1]];
  for (let i = inner.length - 2; i >= 2; i -= 2) rev.push(inner[i], inner[i + 1]);
  return [...outer, outer[0], outer[1], ...rev, inner[0], inner[1]];
}

/** Shapes the user can pick for a block. Every one of them can be reshaped afterwards by dragging its corners. */
export const BLOCK_PRESETS: BlockPreset[] = [
  { id: "grid-50x20", name: "Big block 50 rows × 20 seats", build: () => ({ points: rectForGrid(50, 20), rowMode: "straight" }) },
  { id: "grid-25x20", name: "Block 25 rows × 20 seats", build: () => ({ points: rectForGrid(25, 20), rowMode: "straight" }) },
  { id: "rect", name: "Rectangle", build: () => ({ points: [-130, -70, 130, -70, 130, 70, -130, 70], rowMode: "straight" }) },
  { id: "trapezoid", name: "Trapezoid", build: () => ({ points: [-90, -70, 90, -70, 150, 70, -150, 70], rowMode: "straight" }) },
  { id: "fan", name: "Fan (curved rows)", build: () => fan(170, 300, 38) },
  { id: "wide-fan", name: "Wide fan", build: () => fan(120, 280, 70) },
  {
    id: "chevron",
    name: "Chevron",
    build: () => ({ points: [-150, -50, 0, -90, 150, -50, 150, 20, 0, 60, -150, 20], rowMode: "straight" }),
  },
  {
    id: "corner",
    name: "Corner (L shape)",
    build: () => {
      const r = recentre([-120, -90, 40, -90, 40, 0, 120, 0, 120, 90, -120, 90]);
      return { points: r.points, rowMode: "straight" };
    },
  },
  {
    id: "parallelogram",
    name: "Parallelogram",
    build: () => ({ points: [-90, -70, 170, -70, 90, 70, -170, 70], rowMode: "straight" }),
  },
  {
    id: "inv-trapezoid",
    name: "Wide-top trapezoid",
    build: () => ({ points: [-150, -70, 150, -70, 90, 70, -90, 70], rowMode: "straight" }),
  },
  { id: "triangle", name: "Triangle", build: () => ({ points: [0, -100, 150, 80, -150, 80], rowMode: "straight" }) },
  {
    id: "pentagon",
    name: "Pentagon",
    build: () => {
      const pts: number[] = [];
      for (let i = 0; i < 5; i += 1) {
        const a = (-90 + i * 72) * DEG;
        pts.push(Math.round(120 * Math.cos(a)), Math.round(120 * Math.sin(a)));
      }
      return { points: pts, rowMode: "straight" };
    },
  },
  {
    id: "hexagon",
    name: "Hexagon",
    build: () => {
      const pts: number[] = [];
      for (let i = 0; i < 6; i += 1) {
        const a = (i * 60) * DEG;
        pts.push(Math.round(130 * Math.cos(a)), Math.round(110 * Math.sin(a)));
      }
      return { points: pts, rowMode: "straight" };
    },
  },
  {
    id: "octagon",
    name: "Octagon",
    build: () => {
      const pts: number[] = [];
      for (let i = 0; i < 8; i += 1) {
        const a = (22.5 + i * 45) * DEG;
        pts.push(Math.round(130 * Math.cos(a)), Math.round(130 * Math.sin(a)));
      }
      return { points: pts, rowMode: "straight" };
    },
  },
  { id: "rounded-rect", name: "Rounded rectangle", build: () => ({ points: roundedRectPoints(280, 150, 40), rowMode: "straight" }) },
  { id: "circle-block", name: "Circle", build: () => ({ points: ellipsePoints(110, 110, 40), rowMode: "straight" }) },
  { id: "oval-block", name: "Oval", build: () => ({ points: ellipsePoints(170, 95, 40), rowMode: "straight" }) },
  { id: "long-strip", name: "Long strip", build: () => ({ points: [-240, -34, 240, -34, 240, 34, -240, 34], rowMode: "straight" }) },
  { id: "tall-strip", name: "Tall strip", build: () => ({ points: [-50, -200, 50, -200, 50, 200, -50, 200], rowMode: "straight" }) },
  { id: "half-ring", name: "Half ring (curved)", build: () => fan(110, 230, 180) },
  { id: "quarter-ring", name: "Quarter ring (curved)", build: () => fan(120, 240, 90) },
  { id: "arc-strip", name: "Thin arc strip", build: () => fan(250, 320, 50) },
  { id: "narrow-fan", name: "Narrow fan", build: () => fan(200, 330, 24) },
  { id: "semicircle", name: "Semicircle", build: () => fan(8, 200, 180) },
  {
    id: "u-shape",
    name: "U shape",
    build: () => {
      const r = recentre([-150, -80, -70, -80, -70, 20, 70, 20, 70, -80, 150, -80, 150, 90, -150, 90]);
      return { points: r.points, rowMode: "straight" };
    },
  },
  {
    id: "stair-step",
    name: "Step shape",
    build: () => {
      const r = recentre([-150, -90, -50, -90, -50, -30, 50, -30, 50, 30, 150, 30, 150, 90, -150, 90]);
      return { points: r.points, rowMode: "straight" };
    },
  },
  {
    id: "cross",
    name: "Cross",
    build: () => {
      const r = recentre([-40, -130, 40, -130, 40, -40, 130, -40, 130, 40, 40, 40, 40, 130, -40, 130, -40, 40, -130, 40, -130, -40, -40, -40]);
      return { points: r.points, rowMode: "straight" };
    },
  },
  {
    id: "corner-r",
    name: "Corner (reversed L)",
    build: () => {
      const r = recentre([-40, -90, 120, -90, 120, 90, -120, 90, -120, 0, -40, 0]);
      return { points: r.points, rowMode: "straight" };
    },
  },
  {
    id: "cut-corner",
    name: "Cut-corner rectangle",
    build: () => ({ points: [-130, -70, 90, -70, 130, -30, 130, 70, -130, 70], rowMode: "straight" }),
  },
];

export interface GroundPreset {
  id: string;
  name: string;
  color: string;
  label: string;
  labelColor?: string;
  build: () => number[];
}

/** Ground and stage shapes drawn as editable polygons */
export const GROUND_PRESETS: GroundPreset[] = [
  { id: "oval-ground", name: "Oval ground", color: "#15803d", label: "GROUND", build: () => ellipsePoints(330, 210) },
  { id: "football-pitch", name: "Football pitch", color: "#15803d", label: "PITCH", build: () => roundedRectPoints(380, 240, 18) },
  { id: "cricket-oval", name: "Cricket oval", color: "#65a30d", label: "CRICKET", build: () => ellipsePoints(260, 260) },
  {
    id: "t-stage",
    name: "T-shaped stage",
    color: "#0f172a",
    label: "STAGE",
    labelColor: "#ffffff",
    build: () => {
      const r = recentre([-120, -50, 120, -50, 120, 10, 22, 10, 22, 150, -22, 150, -22, 10, -120, 10]);
      return r.points;
    },
  },
  {
    // Ring only (no centre ground): the outer edge, then the inner edge walked the other way, joined by a seam
    id: "running-track",
    name: "Running track (oval)",
    color: "#c2573a",
    label: "",
    build: () => {
      const outer = roundedRectPoints(640, 360, 180, 10);
      const inner = roundedRectPoints(520, 240, 120, 10);
      const rev: number[] = [inner[0], inner[1]];
      for (let i = inner.length - 2; i >= 2; i -= 2) rev.push(inner[i], inner[i + 1]);
      return [...outer, outer[0], outer[1], ...rev, inner[0], inner[1]];
    },
  },
  {
    id: "pill-ground",
    name: "Stadium pill ground",
    color: "#15803d",
    label: "GROUND",
    build: () => roundedRectPoints(660, 300, 150, 10),
  },
  { id: "rugby-oval", name: "Rugby / egg oval", color: "#15803d", label: "FIELD", build: () => ellipsePoints(300, 170, 60) },
  { id: "circle-ground", name: "Circle ground", color: "#15803d", label: "GROUND", build: () => ellipsePoints(220, 220) },
  { id: "basketball", name: "Basketball court", color: "#b45309", label: "COURT", build: () => roundedRectPoints(330, 190, 8, 2) },
  { id: "tennis", name: "Tennis court", color: "#1d4ed8", label: "COURT", build: () => roundedRectPoints(360, 170, 6, 2) },
  { id: "hex-ground", name: "Hexagon ground", color: "#15803d", label: "GROUND", build: () => hexPoints(240, 210) },
  { id: "octagon-ground", name: "Octagon ring-side", color: "#0f172a", label: "RING", labelColor: "#ffffff", build: () => octPoints(150) },
  { id: "circle-stage", name: "Circle stage", color: "#0f172a", label: "STAGE", labelColor: "#ffffff", build: () => ellipsePoints(90, 90, 40) },
  {
    id: "half-circle-stage",
    name: "Half-circle stage",
    color: "#0f172a",
    label: "STAGE",
    labelColor: "#ffffff",
    build: () => {
      const pts: number[] = [];
      for (let i = 0; i <= 24; i += 1) {
        const a = (180 + (180 * i) / 24) * DEG;
        pts.push(Math.round(180 * Math.cos(a)), Math.round(110 * Math.sin(a)) + 55);
      }
      return pts;
    },
  },
  { id: "runway", name: "Runway / catwalk", color: "#0f172a", label: "", labelColor: "#ffffff", build: () => [-260, -22, 260, -22, 260, 22, -260, 22] },
  {
    id: "plus-stage",
    name: "Plus stage",
    color: "#0f172a",
    label: "STAGE",
    labelColor: "#ffffff",
    build: () => [-35, -110, 35, -110, 35, -35, 110, -35, 110, 35, 35, 35, 35, 110, -35, 110, -35, 35, -110, 35, -110, -35, -35, -35],
  },
  {
    id: "b-stage",
    name: "Main + B stage",
    color: "#0f172a",
    label: "STAGE",
    labelColor: "#ffffff",
    build: () => {
      const r = recentre([-120, -60, 120, -60, 120, 0, 18, 0, 18, 60, 48, 60, 48, 100, -48, 100, -48, 60, -18, 60, -18, 0, -120, 0]);
      return r.points;
    },
  },
  {
    id: "circular-track",
    name: "Round running track",
    color: "#c2573a",
    label: "",
    build: () => keyholeRing(ellipsePoints(300, 220, 48), ellipsePoints(230, 150, 48)),
  },
  {
    id: "rect-track",
    name: "Rectangular track",
    color: "#c2573a",
    label: "",
    build: () => keyholeRing(roundedRectPoints(640, 380, 40, 6), roundedRectPoints(520, 260, 24, 6)),
  },
  {
    id: "wide-pill-ring",
    name: "Wide pill ring (walkway)",
    color: "#94a3b8",
    label: "",
    build: () => keyholeRing(roundedRectPoints(900, 460, 230, 10), roundedRectPoints(760, 320, 160, 10)),
  },
  {
    id: "thrust-stage",
    name: "Thrust stage",
    color: "#1e293b",
    label: "STAGE",
    labelColor: "#ffffff",
    build: () => roundedRectPoints(260, 120, 30),
  },
];

function nextLabel(label: string): string {
  const raw = (label || "").trim();
  if (!raw) return "A";
  const trailing = raw.match(/^(.*?)(\d+)$/);
  if (trailing) return `${trailing[1]}${parseInt(trailing[2], 10) + 1}`;
  const chars = raw.toUpperCase().split("");
  if (!chars.every((c) => c >= "A" && c <= "Z")) return `${raw}2`;
  let i = chars.length - 1;
  while (i >= 0) {
    if (chars[i] === "Z") {
      chars[i] = "A";
      i -= 1;
    } else {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
      return chars.join("");
    }
  }
  return `A${chars.join("")}`;
}

export interface BlockSeatLook {
  color: string;
  price: number;
  seatTypeId?: string;
  shape: SeatShape;
  widthFactor: number;
}

/**
 * Fill a block with seats. Rows run straight across the block (turned by `blockRowAngle`) or, for fan-shaped blocks,
 * curve around `blockArcCenter`. Seats only appear where the polygon has room, so any shape works.
 * `decorate` lets the caller apply per-seat changes (own seat type, colour, taken out).
 */
export function generateBlockSeats(
  obj: UniversalVenueObject,
  size: number,
  decorate: (slotKey: string) => { removed: boolean; look: BlockSeatLook },
  includeRemoved = false
): UniversalSeat[] {
  const pts = obj.points || [];
  if (pts.length < 6) return [];
  const gap = obj.seatSpacing || 18;
  const rowGap = obj.rowSpacing || 22;
  const inset = obj.blockInset ?? 10;
  const lm = blockLabelMetrics(obj, size);
  const labelSpace = obj.blockLabelsInside ? lm.gap + lm.fs + 2 : 0;
  const baseLook = decorate("__base__").look;
  const step = gap * baseLook.widthFactor;

  const seats: UniversalSeat[] = [];
  const usedIds = new Map<string, number>();
  let rowIndex = 0;
  let label = (obj.blockStartRow || "A").trim() || "A";

  const emit = (positions: Array<{ x: number; y: number }>) => {
    if (positions.length === 0 || seats.length >= MAX_SEATS_PER_BLOCK) return;
    let number = 1;
    positions.forEach((p, idx) => {
      const slotKey = `r${rowIndex}#${idx}`;
      const d = decorate(slotKey);
      if (d.removed && !includeRemoved) return;
      const baseId = `${obj.name.replace(/\s+/g, "_")}-${label}-${d.removed ? `gone${idx}` : number}`;
      const seen = usedIds.get(baseId) || 0;
      usedIds.set(baseId, seen + 1);
      seats.push({
        id: seen === 0 ? baseId : `${baseId}~${seen + 1}`,
        sectionId: obj.id,
        rowLabel: label,
        seatNumber: d.removed ? "" : String(number),
        x: Math.round(obj.x + p.x),
        y: Math.round(obj.y + p.y),
        category: "standard",
        price: d.look.price || 0,
        seatTypeId: d.look.seatTypeId,
        color: d.look.color,
        shape: d.look.shape,
        widthFactor: d.look.widthFactor,
        size,
        slotWidth: step,
        rowId: `r${rowIndex}`,
        slotKey,
        removed: d.removed,
        status: "AVAILABLE",
      });
      if (!d.removed) number += 1;
    });
    rowIndex += 1;
    label = nextLabel(label);
  };

  if (obj.blockRowMode === "arc") {
    const [cx, cy] = obj.blockArcCenter || [0, 0];
    let rMin = Infinity;
    let rMax = 0;
    for (let i = 0; i + 1 < pts.length; i += 2) {
      const r = Math.hypot(pts[i] - cx, pts[i + 1] - cy);
      rMin = Math.min(rMin, r);
      rMax = Math.max(rMax, r);
    }
    const mid = polyCentroid(pts);
    const startAngle = Math.atan2(mid.y - cy, mid.x - cx) - Math.PI;
    const radii: number[] = [];
    for (let r = rMin + inset + rowGap / 2; r <= rMax - inset + 0.5; r += rowGap) radii.push(r);

    // The longest stretch of each ring that lies inside the block
    const longestSegment = (r: number): [number, number] | null => {
      const probe = Math.max(0.0015, step / r / 6);
      const inside = (a: number) => {
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        return pointInPolygon(x, y, pts) && distanceToEdge(x, y, pts) >= inset * 0.8;
      };
      let best: [number, number] | null = null;
      let from: number | null = null;
      for (let a = startAngle; a <= startAngle + Math.PI * 2 + probe; a += probe) {
        if (inside(a)) {
          if (from === null) from = a;
        } else if (from !== null) {
          if (!best || a - probe - from > best[1] - best[0]) best = [from, a - probe];
          from = null;
        }
      }
      if (from !== null && (!best || startAngle + Math.PI * 2 - from > best[1] - best[0])) best = [from, startAngle + Math.PI * 2];
      return best;
    };

    const segs = radii.map(longestSegment);
    const usable = segs.every((g) => g !== null);
    if (usable && radii.length > 0) {
      // Every ring gets the same number of seats across the same angle, so seats line up in straight columns
      const margin = labelSpace / radii[0];
      const a0 = Math.max(...segs.map((g) => (g as [number, number])[0])) + margin;
      const a1 = Math.min(...segs.map((g) => (g as [number, number])[1])) - margin;
      if (a1 > a0) {
        const n = Math.max(1, Math.floor(((a1 - a0) * radii[0]) / step) + 1);
        radii.forEach((r) => {
          const positions: Array<{ x: number; y: number }> = [];
          for (let i = 0; i < n; i += 1) {
            const a = n === 1 ? (a0 + a1) / 2 : a0 + ((a1 - a0) * i) / (n - 1);
            positions.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
          }
          emit(positions);
        });
        return seats;
      }
    }
    // Odd shapes: fit each ring on its own
    radii.forEach((r, idx) => {
      const g = segs[idx];
      if (!g) return;
      const length = (g[1] - g[0]) * r;
      const n = Math.floor(length / step) + 1;
      const offset = (length - (n - 1) * step) / 2 / r;
      const positions: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < n; i += 1) {
        const ang = g[0] + offset + (i * step) / r;
        positions.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
      }
      emit(positions);
    });
    return seats;
  }

  // Straight rows: turn the polygon so the rows run left to right, scan it, and turn the seats back
  const angle = (obj.blockRowAngle || 0) * DEG;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const rotated: number[] = [];
  for (let i = 0; i + 1 < pts.length; i += 2) {
    rotated.push(pts[i] * c + pts[i + 1] * s, -pts[i] * s + pts[i + 1] * c);
  }
  const b = polyBounds(rotated);
  const n = rotated.length / 2;
  for (let y = b.minY + inset + rowGap / 2; y <= b.maxY - inset + 0.5 && seats.length < MAX_SEATS_PER_BLOCK; y += rowGap) {
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      const x1 = rotated[i * 2];
      const y1 = rotated[i * 2 + 1];
      const x2 = rotated[j * 2];
      const y2 = rotated[j * 2 + 1];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
    }
    xs.sort((p, q) => p - q);
    const positions: Array<{ x: number; y: number }> = [];
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const start = xs[k] + inset + labelSpace;
      const end = xs[k + 1] - inset - labelSpace;
      if (end < start) continue;
      const count = Math.floor((end - start) / step) + 1;
      const offset = (end - start - (count - 1) * step) / 2;
      for (let i = 0; i < count; i += 1) {
        const rx = start + offset + i * step;
        positions.push({ x: rx * c - y * s, y: rx * s + y * c });
      }
    }
    emit(positions);
  }
  return seats;
}
