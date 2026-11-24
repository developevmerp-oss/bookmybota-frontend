"use client";

import { VenueType, UniversalVenueObject } from "../types";
import { generateSeatsForObject } from "../utils/geometryEngine";
import { GROUND_PRESETS, arcSectorPoints, blockLabelMetrics, keyholeRing, recentre, rectForGrid, roundedRectPoints } from "../utils/blockGeometry";

export interface UniversalTemplateDef {
  id: string;
  name: string;
  venueType: VenueType;
  description: string;
  badge: string;
  objects: UniversalVenueObject[];
}

const CX = 800;
const CY = 600;

/** One ring of sector blocks around the ground. Each block keeps its rows curved around the middle of the stadium. */
function sectorRing(opts: {
  prefix: string;
  level: string;
  count: number;
  innerR: number;
  outerR: number;
  color: string;
  price: number;
  gapDeg?: number;
  startDeg?: number;
}): UniversalVenueObject[] {
  const gap = opts.gapDeg ?? 2.2;
  const step = 360 / opts.count;
  return Array.from({ length: opts.count }).map((_, i) => {
    const start = (opts.startDeg ?? -90) + i * step + gap / 2;
    const raw = arcSectorPoints(0, 0, opts.innerR, opts.outerR, start, start + step - gap, 8);
    const r = recentre(raw);
    return {
      id: `blk_${opts.prefix}_${i + 1}`,
      name: `${opts.prefix} ${i + 1}`,
      type: "block",
      x: Math.round(CX + r.cx),
      y: Math.round(CY + r.cy),
      width: 200,
      height: 120,
      rotation: 0,
      color: opts.color,
      price: opts.price,
      level: opts.level,
      points: r.points.map((v) => Math.round(v)),
      blockRowMode: "arc",
      blockArcCenter: [Math.round(-r.cx), Math.round(-r.cy)],
      seatSpacing: 16,
      rowSpacing: 18,
      blockInset: 8,
      showSeatNumbers: true,
    } as UniversalVenueObject;
  });
}

/**
 * A ring of blocks around a pill-shaped (racetrack) ground: straight blocks along the two long sides,
 * curved blocks round the two ends. `a` and `b` are the inner and outer distance from the ground's centre line.
 */
function pillRing(opts: {
  prefix: string;
  level: string;
  a: number;
  b: number;
  half: number;
  straight: number;
  caps: number;
  color: string;
  price: number;
}): UniversalVenueObject[] {
  const out: UniversalVenueObject[] = [];
  let n = 0;
  const make = (raw: number[], mode: "straight" | "arc", centre?: [number, number]) => {
    const r = recentre(raw);
    n += 1;
    out.push({
      id: `blk_${opts.prefix}_${n}`,
      name: `${opts.prefix} ${n}`,
      type: "block",
      x: Math.round(CX + r.cx),
      y: Math.round(CY + r.cy),
      width: 200,
      height: 120,
      rotation: 0,
      color: opts.color,
      price: opts.price,
      level: opts.level,
      points: r.points.map((v) => Math.round(v)),
      blockRowMode: mode,
      blockArcCenter: centre ? [Math.round(centre[0] - r.cx), Math.round(centre[1] - r.cy)] : undefined,
      seatSpacing: 16,
      rowSpacing: 18,
      blockInset: 8,
      showSeatNumbers: true,
    } as UniversalVenueObject);
  };
  const gap = 5;
  const len = (opts.half * 2) / opts.straight;
  const capStep = 180 / opts.caps;
  // top side, left to right
  for (let i = 0; i < opts.straight; i += 1) {
    const x1 = -opts.half + i * len + gap / 2;
    const x2 = -opts.half + (i + 1) * len - gap / 2;
    make([x1, -opts.b, x2, -opts.b, x2, -opts.a, x1, -opts.a], "straight");
  }
  // right end, top to bottom
  for (let i = 0; i < opts.caps; i += 1) {
    const st = -90 + i * capStep + 1.2;
    make(arcSectorPoints(opts.half, 0, opts.a, opts.b, st, st + capStep - 2.4, 8), "arc", [opts.half, 0]);
  }
  // bottom side, right to left
  for (let i = 0; i < opts.straight; i += 1) {
    const x2 = opts.half - i * len - gap / 2;
    const x1 = opts.half - (i + 1) * len + gap / 2;
    make([x1, opts.a, x2, opts.a, x2, opts.b, x1, opts.b], "straight");
  }
  // left end, bottom to top
  for (let i = 0; i < opts.caps; i += 1) {
    const st = 90 + i * capStep + 1.2;
    make(arcSectorPoints(-opts.half, 0, opts.a, opts.b, st, st + capStep - 2.4, 8), "arc", [-opts.half, 0]);
  }
  return out;
}

/**
 * Stadium with a ground in the middle, a running track around it, and big blocks of 50 rows × 20 seats on all four sides.
 * Seats are small (the overview shows only blocks); tapping a block zooms in until every seat is easy to read.
 */
function trackStadiumBlocks(): UniversalVenueObject[] {
  const seatGap = 10;
  const rowGap = 9;
  const inset = 8;
  const pts = rectForGrid(50, 20, seatGap, rowGap, inset).map((v) => Math.round(v));
  const w = pts[2] - pts[0];
  const h = pts[5] - pts[1];
  const inner = 128; // distance from the middle line of the ground to the first row's edge
  const step = w + 6;
  const half = 200; // half the straight part of the ground
  const out: UniversalVenueObject[] = [];
  const add = (name: string, level: string, x: number, y: number, rotation: number, color: string, price: number) =>
    out.push({
      id: `blk_${name.toLowerCase().replace(/\s+/g, "_")}`,
      name,
      type: "block",
      x: Math.round(x),
      y: Math.round(y),
      width: 200,
      height: 120,
      rotation,
      color,
      price,
      level,
      points: pts,
      blockRowMode: "straight",
      seatSpacing: seatGap,
      rowSpacing: rowGap,
      blockInset: inset,
      showSeatNumbers: true,
    } as UniversalVenueObject);
  const side = "North & South stands";
  const end = "East & West stands";
  // Row A is always the row nearest the ground, so each block is turned so its first row faces the pitch
  [-1, 0, 1].forEach((i, n) => add(`North ${n + 1}`, side, CX + i * step, CY - inner - h / 2, 180, "#7c3aed", 2500));
  [-1, 0, 1].forEach((i, n) => add(`South ${n + 1}`, side, CX + i * step, CY + inner + h / 2, 0, "#7c3aed", 2500));
  [-2, -1, 0, 1, 2].forEach((i, n) => add(`West ${n + 1}`, end, CX - half - inner - h / 2, CY + i * step, 90, "#2563eb", 1500));
  [-2, -1, 0, 1, 2].forEach((i, n) => add(`East ${n + 1}`, end, CX + half + inner + h / 2, CY + i * step, -90, "#2563eb", 1500));
  return out;
}

/**
 * Two tiers of blocks (a lower and an upper stand) around a ground and running track.
 * Every block is 40 rows × 30 seats, with its row names inside the block border.
 */
function twoTierBlocks(): UniversalVenueObject[] {
  const seat = { seatSize: 5, seatSpacing: 6, rowSpacing: 6, blockInset: 4, blockLabelsInside: true } as UniversalVenueObject;
  const lm = blockLabelMetrics(seat, 5);
  const pts = rectForGrid(40, 30, 6, 6, 4, lm.gap + lm.fs + 2).map((v) => Math.round(v));
  const w = pts[2] - pts[0];
  const h = pts[5] - pts[1];
  const step = w + 4;
  const half = 140; // half the straight part of the ground
  const lowerIn = 96; // from the ground's centre line to the first lower row
  const upperIn = lowerIn + h + 8;
  const out: UniversalVenueObject[] = [];
  const tier = (name: string, level: string, a: number, nTop: number, nEnd: number, color: string, price: number) => {
    const put = (side: string, n: number, x: number, y: number, rotation: number) =>
      out.push({
        ...seat,
        id: `blk_${name}_${side}_${n}`.toLowerCase().replace(/\s+/g, "_"),
        name: `${name} ${side} ${n}`,
        type: "block",
        x: Math.round(x),
        y: Math.round(y),
        width: 200,
        height: 120,
        rotation,
        color,
        price,
        level,
        points: pts,
        blockRowMode: "straight",
        showSeatNumbers: true,
      } as UniversalVenueObject);
    // Row A is the row nearest the ground, so each block is turned to face it
    for (let i = 0; i < nTop; i += 1) put("North", i + 1, CX + (i - (nTop - 1) / 2) * step, CY - a - h / 2, 180);
    for (let i = 0; i < nTop; i += 1) put("South", i + 1, CX + (i - (nTop - 1) / 2) * step, CY + a + h / 2, 0);
    for (let i = 0; i < nEnd; i += 1) put("West", i + 1, CX - half - a - h / 2, CY + (i - (nEnd - 1) / 2) * step, 90);
    for (let i = 0; i < nEnd; i += 1) put("East", i + 1, CX + half + a + h / 2, CY + (i - (nEnd - 1) / 2) * step, -90);
  };
  tier("Lower", "Lower stand", lowerIn, Math.floor((2 * (half + lowerIn)) / step), Math.floor((2 * upperIn) / step), "#7c3aed", 2500);
  tier("Upper", "Upper stand", upperIn, Math.floor((2 * (half + upperIn)) / step), Math.floor(1160 / step), "#2563eb", 1200);
  return out;
}

/**
 * Oval (racetrack) stadium: straight blocks along the two long sides and wedge blocks round the two ends,
 * in a lower and an upper ring. Every block has exactly 40 rows × 30 seats; wedge blocks are made just wide
 * enough to hold 30 seats in their first row.
 */
function ovalTrackBlocks(): UniversalVenueObject[] {
  const ROWS = 40;
  const COLS = 30;
  const seat = { seatSize: 4, seatSpacing: 5, rowSpacing: 5, blockInset: 4, blockLabelsInside: true } as UniversalVenueObject;
  const lm = blockLabelMetrics(seat, 4);
  const extra = lm.gap + lm.fs + 2;
  const rect = rectForGrid(ROWS, COLS, 5, 5, 4, extra).map((v) => Math.round(v * 2) / 2);
  const w = rect[2] - rect[0];
  const h = rect[5] - rect[1];
  const half = 190; // half the straight part of the ground
  const trackR = 166; // outer radius of the running track
  const lowerIn = trackR + 6;
  const upperIn = lowerIn + h + 8;
  const out: UniversalVenueObject[] = [];

  const fits = (a: number): number => {
    for (let deg = 4; deg <= 120; deg += 0.25) {
      const probe = {
        ...seat,
        id: "probe",
        name: "probe",
        type: "block",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        color: "#000",
        points: arcSectorPoints(0, 0, a, a + h, -deg / 2, deg / 2, 8),
        blockRowMode: "arc",
        blockArcCenter: [0, 0],
      } as UniversalVenueObject;
      const rowA = generateSeatsForObject(probe, []).filter((s) => s.rowLabel === "A").length;
      if (rowA >= COLS) return deg;
    }
    return 120;
  };

  const ring = (tier: string, level: string, a: number, color: string, price: number) => {
    const common = { ...seat, type: "block", width: 200, height: 120, color, price, level, showSeatNumbers: true } as Partial<UniversalVenueObject>;
    let n = 0;
    const straight = (side: string, i: number, count: number, y: number, rotation: number) => {
      n += 1;
      out.push({
        ...common,
        id: `blk_${tier}_${n}`.toLowerCase(),
        name: `${tier} ${side} ${i + 1}`,
        x: Math.round(CX + (i - (count - 1) / 2) * (w + 4)),
        y: Math.round(y),
        rotation,
        points: rect,
        blockRowMode: "straight",
      } as UniversalVenueObject);
    };
    const wedge = (side: string, i: number, centreX: number, startDeg: number, endDeg: number) => {
      const raw = arcSectorPoints(centreX, 0, a, a + h, startDeg, endDeg, 8);
      const r = recentre(raw);
      n += 1;
      out.push({
        ...common,
        id: `blk_${tier}_${n}`.toLowerCase(),
        name: `${tier} ${side} ${i + 1}`,
        x: Math.round(CX + r.cx),
        y: Math.round(CY + r.cy),
        rotation: 0,
        points: r.points.map((v) => Math.round(v * 2) / 2),
        blockRowMode: "arc",
        blockArcCenter: [Math.round((centreX - r.cx) * 2) / 2, Math.round(-r.cy * 2) / 2],
      } as UniversalVenueObject);
    };
    const count = Math.max(1, Math.floor((2 * half) / (w + 4)));
    for (let i = 0; i < count; i += 1) straight("North", i, count, CY - a - h / 2, 180);
    for (let i = 0; i < count; i += 1) straight("South", i, count, CY + a + h / 2, 0);
    const span = fits(a);
    const m = Math.max(1, Math.floor(180 / (span + 3)));
    const stepAng = 180 / m;
    for (let k = 0; k < m; k += 1) {
      const mid = -90 + (k + 0.5) * stepAng;
      wedge("East", k, half, mid - span / 2, mid + span / 2);
    }
    for (let k = 0; k < m; k += 1) {
      const mid = 90 + (k + 0.5) * stepAng;
      wedge("West", k, -half, mid - span / 2, mid + span / 2);
    }
  };
  ring("Lower", "Lower stand", lowerIn, "#7c3aed", 2500);
  ring("Upper", "Upper stand", upperIn, "#2563eb", 1200);
  return out;
}

/**
 * Make every block hold exactly `target` seats: tighten the seat and row gaps until at least `target` fit,
 * then take out the surplus seats from the back of the last rows.
 */
function exactSeatsPerBlock(blocks: UniversalVenueObject[], target: number): UniversalVenueObject[] {
  return blocks.map((b) => {
    const baseGap = b.seatSpacing || 16;
    const baseRow = b.rowSpacing || 18;
    let chosen: UniversalVenueObject = b;
    let count = 0;
    for (let k = 1.6; k >= 0.25; k -= 0.02) {
      const probe = { ...b, seatSpacing: Math.round(baseGap * k * 100) / 100, rowSpacing: Math.round(baseRow * k * 100) / 100 } as UniversalVenueObject;
      const n = generateSeatsForObject(probe, []).length;
      if (n >= target) {
        chosen = probe;
        count = n;
        break;
      }
    }
    if (count > target) {
      const all = generateSeatsForObject(chosen, []);
      const surplus = all.slice(target);
      const overrides: Record<string, { removed: boolean }> = {};
      surplus.forEach((seat) => {
        if (seat.slotKey) overrides[seat.slotKey] = { removed: true };
      });
      chosen = { ...chosen, seatOverrides: overrides } as UniversalVenueObject;
    }
    return chosen;
  });
}

/** Narendra Modi Stadium (Ahmedabad): a round cricket ground, an inner bowl of 12 blocks and an outer bowl of 9 blocks, 100 seats each */
export const NARENDRA_MODI_BLOCKS: Array<{ name: string; ring: "inner" | "outer"; centre: number; half: number; color: string; level: string; price: number }> = [
  { name: "North Corporate Box", ring: "inner", centre: 0, half: 13.5, color: "#f4a6b8", level: "Inner bowl", price: 4500 },
  { name: "Block E", ring: "inner", centre: 30, half: 13.5, color: "#f5a24b", level: "Inner bowl", price: 3000 },
  { name: "Block F", ring: "inner", centre: 60, half: 13.5, color: "#f5a24b", level: "Inner bowl", price: 3000 },
  { name: "Block G", ring: "inner", centre: 90, half: 13.5, color: "#f5a24b", level: "Inner bowl", price: 3000 },
  { name: "Block H", ring: "inner", centre: 120, half: 13.5, color: "#f5a24b", level: "Inner bowl", price: 3000 },
  { name: "South Premium East", ring: "inner", centre: 150, half: 13.5, color: "#f7b567", level: "Inner bowl", price: 4500 },
  { name: "South Premium Centre", ring: "inner", centre: 180, half: 13.5, color: "#f7b567", level: "Inner bowl", price: 4500 },
  { name: "South Premium West", ring: "inner", centre: 210, half: 13.5, color: "#f7b567", level: "Inner bowl", price: 4500 },
  { name: "Block A", ring: "inner", centre: 240, half: 13.5, color: "#f5a24b", level: "Inner bowl", price: 3000 },
  { name: "Block B", ring: "inner", centre: 270, half: 13.5, color: "#f5a24b", level: "Inner bowl", price: 3000 },
  { name: "Block C", ring: "inner", centre: 300, half: 13.5, color: "#f5a24b", level: "Inner bowl", price: 3000 },
  { name: "Block D", ring: "inner", centre: 330, half: 13.5, color: "#f5a24b", level: "Inner bowl", price: 3000 },
  { name: "Block N", ring: "outer", centre: 0, half: 18, color: "#2f6fd6", level: "Outer bowl", price: 1500 },
  { name: "Block P", ring: "outer", centre: 40, half: 18, color: "#9b6fd0", level: "Outer bowl", price: 1500 },
  { name: "Block Q", ring: "outer", centre: 80, half: 18, color: "#4cc15a", level: "Outer bowl", price: 1200 },
  { name: "Block R", ring: "outer", centre: 120, half: 18, color: "#ef5da8", level: "Outer bowl", price: 1200 },
  { name: "Bay Gallery", ring: "outer", centre: 160, half: 18, color: "#9aa3b2", level: "Outer bowl", price: 2500 },
  { name: "Block J", ring: "outer", centre: 200, half: 18, color: "#ef5da8", level: "Outer bowl", price: 1200 },
  { name: "Block K", ring: "outer", centre: 240, half: 18, color: "#4cc15a", level: "Outer bowl", price: 1200 },
  { name: "Block L", ring: "outer", centre: 280, half: 18, color: "#b08be0", level: "Outer bowl", price: 1500 },
  { name: "Block M", ring: "outer", centre: 320, half: 18, color: "#52cfe0", level: "Outer bowl", price: 1500 },
];

function narendraModiObjects(): UniversalVenueObject[] {
  const ring = { inner: [300, 395], outer: [418, 520] } as const;
  const circle = (r: number) => Array.from({ length: 48 }, (_, i) => [Math.round(r * Math.cos((i / 48) * Math.PI * 2)), Math.round(r * Math.sin((i / 48) * Math.PI * 2))]).flat();
  const base: UniversalVenueObject[] = [
    { id: "shp_ground", name: "Ground", type: "shape", shapeKind: "polygon", points: circle(285), x: CX, y: CY, width: 200, height: 120, rotation: 0, color: "#2f8f3f", label: "", opacity: 0.95 } as UniversalVenueObject,
    { id: "shp_pitch", name: "Pitch", type: "shape", shapeKind: "polygon", points: [-9, -48, 9, -48, 9, 48, -9, 48], x: CX, y: CY, width: 200, height: 120, rotation: 0, color: "#d8c08a", label: "", opacity: 1 } as UniversalVenueObject,
  ];
  const blocks = NARENDRA_MODI_BLOCKS.map((b) => {
    const [ri, ro] = ring[b.ring];
    const raw = arcSectorPoints(0, 0, ri, ro, b.centre - 90 - b.half, b.centre - 90 + b.half, 8);
    const r = recentre(raw);
    return {
      id: `blk_${b.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      name: b.name,
      type: "block",
      x: Math.round(CX + r.cx),
      y: Math.round(CY + r.cy),
      width: 200,
      height: 120,
      rotation: 0,
      color: b.color,
      price: b.price,
      level: b.level,
      points: r.points.map((v) => Math.round(v)),
      blockRowMode: "arc",
      blockArcCenter: [Math.round(-r.cx), Math.round(-r.cy)],
      seatSpacing: 16,
      rowSpacing: 18,
      blockInset: 8,
      showSeatNumbers: true,
    } as UniversalVenueObject;
  });
  return [...base, ...exactSeatsPerBlock(blocks, 100)];
}

const GROUND = GROUND_PRESETS.find((g) => g.id === "oval-ground")!;
const T_STAGE = GROUND_PRESETS.find((g) => g.id === "t-stage")!;

export const UNIVERSAL_TEMPLATES: UniversalTemplateDef[] = [
  // Narendra Modi Stadium, Ahmedabad
  {
    id: "stadium_narendra_modi",
    name: "Narendra Modi Stadium (Cricket, 21 blocks of 100 seats)",
    venueType: "stadium_cricket",
    badge: "Blocks",
    description: "Round cricket ground with an inner bowl of 12 blocks (A to H, corporate and south premium) and an outer bowl of 9 blocks (J to R and the bay gallery). Every block has 100 seats.",
    objects: narendraModiObjects(),
  },
  // 0d. Oval stadium: ground, running track, lower and upper rings of 40 × 30 blocks
  {
    id: "stadium_oval_track_40x30",
    name: "Oval Stadium with Track (Lower & Upper, 40 × 30)",
    venueType: "stadium_football",
    badge: "Blocks",
    description: "Oval ground with a running track, and a lower and an upper ring of straight and wedge blocks. Every block has 40 rows × 30 seats, with row names inside.",
    objects: [
      {
        id: "shp_ov_ground",
        name: "Ground",
        type: "shape",
        shapeKind: "polygon",
        points: roundedRectPoints(652, 272, 136, 12).map((v) => Math.round(v)),
        x: CX,
        y: CY,
        width: 200,
        height: 120,
        rotation: 0,
        color: "#4d8f3a",
        label: "",
        opacity: 0.95,
      },
      {
        id: "shp_ov_pitch",
        name: "Pitch",
        type: "shape",
        shapeKind: "polygon",
        points: [-190, -80, 190, -80, 190, 80, -190, 80],
        x: CX,
        y: CY,
        width: 200,
        height: 120,
        rotation: 0,
        color: "#6aa84f",
        label: "PITCH",
        textColor: "#ffffff",
        fontSize: 16,
        opacity: 0.95,
      },
      {
        id: "shp_ov_track",
        name: "Running track",
        type: "shape",
        shapeKind: "polygon",
        points: keyholeRing(roundedRectPoints(712, 332, 166, 12), roundedRectPoints(652, 272, 136, 12)).map((v) => Math.round(v)),
        x: CX,
        y: CY,
        width: 200,
        height: 120,
        rotation: 0,
        color: "#c2573a",
        label: "",
        opacity: 0.95,
      },
      ...ovalTrackBlocks(),
    ],
  },

  // 0c. Ground, running track, lower and upper stands of 40 × 30 blocks
  {
    id: "stadium_two_tier_blocks",
    name: "Two-Tier Stadium with Track (Lower & Upper, 40 × 30)",
    venueType: "stadium_football",
    badge: "Blocks",
    description: "Ground and running track in the middle, a lower stand and an upper stand around them. Every block has 40 rows × 30 seats, with row names inside the block.",
    objects: [
      {
        id: "shp_tt_ground",
        name: "Ground",
        type: "shape",
        shapeKind: "polygon",
        points: roundedRectPoints(400, 120, 60, 10).map((v) => Math.round(v)),
        x: CX,
        y: CY,
        width: 200,
        height: 120,
        rotation: 0,
        color: "#4d8f3a",
        label: "",
        opacity: 0.95,
      },
      {
        id: "shp_tt_pitch",
        name: "Pitch",
        type: "shape",
        shapeKind: "polygon",
        points: [-110, -35, 110, -35, 110, 35, -110, 35],
        x: CX,
        y: CY,
        width: 200,
        height: 120,
        rotation: 0,
        color: "#6aa84f",
        label: "PITCH",
        textColor: "#ffffff",
        fontSize: 12,
        opacity: 0.95,
      },
      {
        id: "shp_tt_track",
        name: "Running track",
        type: "shape",
        shapeKind: "polygon",
        points: keyholeRing(roundedRectPoints(460, 180, 90, 10), roundedRectPoints(400, 120, 60, 10)).map((v) => Math.round(v)),
        x: CX,
        y: CY,
        width: 200,
        height: 120,
        rotation: 0,
        color: "#c2573a",
        label: "",
        opacity: 0.95,
      },
      ...twoTierBlocks(),
    ],
  },

  // 0b. Ground, running track and 16 big blocks (50 rows × 20 seats each)
  {
    id: "stadium_track_blocks",
    name: "Stadium with Running Track (16 blocks, 50 × 20)",
    venueType: "stadium_football",
    badge: "Blocks",
    description: "Ground in the middle, a running track around it, and sixteen blocks of 50 rows × 20 seats on four sides. Tap a block to zoom in on its seats.",
    objects: [
      {
        id: "shp_track_ground",
        name: "Ground",
        type: "shape",
        shapeKind: "polygon",
        points: roundedRectPoints(560, 160, 80, 10).map((v) => Math.round(v)),
        x: CX,
        y: CY,
        width: 200,
        height: 120,
        rotation: 0,
        color: "#4d8f3a",
        label: "",
        opacity: 0.95,
      },
      {
        id: "shp_track_pitch",
        name: "Pitch",
        type: "shape",
        shapeKind: "polygon",
        points: [-150, -50, 150, -50, 150, 50, -150, 50],
        x: CX,
        y: CY,
        width: 200,
        height: 120,
        rotation: 0,
        color: "#6aa84f",
        label: "PITCH",
        textColor: "#ffffff",
        fontSize: 14,
        opacity: 0.95,
      },
      {
        id: "shp_track",
        name: "Running track",
        type: "shape",
        shapeKind: "polygon",
        points: keyholeRing(roundedRectPoints(640, 240, 120, 10), roundedRectPoints(560, 160, 80, 10)).map((v) => Math.round(v)),
        x: CX,
        y: CY,
        width: 200,
        height: 120,
        rotation: 0,
        color: "#c2573a",
        label: "",
        opacity: 0.95,
      },
      ...trackStadiumBlocks(),
    ],
  },

  // 0b. Oval (racetrack) stadium with exactly 100 seats in every block
  {
    id: "stadium_oval_rings_100",
    name: "Oval Stadium (Lower & Upper Rings, 100 seats per block)",
    venueType: "stadium_football",
    badge: "Blocks",
    description: "Pill-shaped ground with a pitch, a lower ring of 14 blocks and an upper ring of 18 blocks. Every block has exactly 100 seats. Tap a block to see its seats.",
    objects: [
      {
        id: "shp_pill_ground",
        name: "Ground",
        type: "shape",
        shapeKind: "polygon",
        points: roundedRectPoints(980, 380, 190, 10).map((v) => Math.round(v)),
        x: CX,
        y: CY,
        width: 200,
        height: 120,
        rotation: 0,
        color: "#4d8f3a",
        label: "",
        opacity: 0.95,
      },
      {
        id: "shp_pitch",
        name: "Pitch",
        type: "shape",
        shapeKind: "polygon",
        points: [-250, -110, 250, -110, 250, 110, -250, 110],
        x: CX,
        y: CY,
        width: 200,
        height: 120,
        rotation: 0,
        color: "#6aa84f",
        label: "PITCH",
        textColor: "#ffffff",
        fontSize: 16,
        opacity: 0.95,
      },
      ...exactSeatsPerBlock(pillRing({ prefix: "Lower", level: "Lower stand", a: 205, b: 300, half: 300, straight: 4, caps: 3, color: "#7c3aed", price: 2500 }), 100),
      ...exactSeatsPerBlock(pillRing({ prefix: "Upper", level: "Upper stand", a: 315, b: 410, half: 300, straight: 5, caps: 4, color: "#2563eb", price: 1200 }), 100),
    ],
  },

  // 0a. Oval (racetrack) stadium: pill-shaped ground, lower ring and upper ring cut into blocks
  {
    id: "stadium_oval_rings",
    name: "Oval Stadium (Lower & Upper Rings)",
    venueType: "stadium_football",
    badge: "Blocks",
    description: "Pill-shaped ground with a pitch in the middle, a lower ring and an upper ring split into straight and curved blocks. Tap a block to see its seats.",
    objects: [
      {
        id: "shp_pill_ground",
        name: "Ground",
        type: "shape",
        shapeKind: "polygon",
        points: roundedRectPoints(980, 380, 190, 10).map((v) => Math.round(v)),
        x: CX,
        y: CY,
        width: 200,
        height: 120,
        rotation: 0,
        color: "#4d8f3a",
        label: "",
        opacity: 0.95,
      },
      {
        id: "shp_pitch",
        name: "Pitch",
        type: "shape",
        shapeKind: "polygon",
        points: [-250, -110, 250, -110, 250, 110, -250, 110],
        x: CX,
        y: CY,
        width: 200,
        height: 120,
        rotation: 0,
        color: "#6aa84f",
        label: "PITCH",
        textColor: "#ffffff",
        fontSize: 16,
        opacity: 0.95,
      },
      ...pillRing({ prefix: "Lower", level: "Lower stand", a: 205, b: 300, half: 300, straight: 4, caps: 3, color: "#7c3aed", price: 2500 }),
      ...pillRing({ prefix: "Upper", level: "Upper stand", a: 315, b: 410, half: 300, straight: 5, caps: 4, color: "#2563eb", price: 1200 }),
    ],
  },

  // 0. Stadium with blocks: lower and upper stands, tap a block to see its seats
  {
    id: "stadium_blocks",
    name: "Stadium with Blocks (Lower & Upper Stand)",
    venueType: "stadium_football",
    badge: "Blocks",
    description: "Ground with a T-shaped stage, a lower stand and an upper stand made of blocks. Customers see the blocks first and tap one to see its seats.",
    objects: [
      {
        id: "shp_ground",
        name: "Ground",
        type: "shape",
        shapeKind: "polygon",
        points: GROUND.build().map((v) => Math.round(v * 0.62)),
        x: CX,
        y: CY,
        width: 200,
        height: 120,
        rotation: 0,
        color: "#cbd5e1",
        label: "",
        opacity: 0.6,
      },
      {
        id: "shp_stage",
        name: "Stage",
        type: "shape",
        shapeKind: "polygon",
        points: T_STAGE.build().map((v) => Math.round(v * 0.8)),
        x: CX,
        y: CY - 20,
        width: 200,
        height: 120,
        rotation: 0,
        color: T_STAGE.color,
        label: "STAGE",
        textColor: "#ffffff",
        fontSize: 16,
        opacity: 0.95,
      },
      ...sectorRing({ prefix: "Lower", level: "Lower stand", count: 12, innerR: 285, outerR: 400, color: "#7c3aed", price: 2500 }),
      ...sectorRing({ prefix: "Upper", level: "Upper stand", count: 14, innerR: 425, outerR: 540, color: "#2563eb", price: 1200 }),
    ],
  },


  // 1. Oval Football Stadium
  {
    id: "stadium_football",
    name: "Oval Football Stadium",
    venueType: "stadium_football",
    badge: "Sports Arena",
    description: "Full athletic oval stadium with 4 concentric stands, VIP grandstand, turnstile gates, and grass football pitch.",
    objects: [
      {
        id: "obj_pitch_football",
        name: "Main Football Pitch",
        type: "sports_court",
        x: CX,
        y: CY,
        width: 360,
        height: 230,
        rotation: 0,
        color: "#15803d",
      },
      {
        id: "sec_north_stand",
        name: "North Stand",
        type: "curved_stand",
        x: CX,
        y: CY,
        width: 400,
        height: 140,
        rotation: 0,
        color: "#3b82f6",
        innerRadius: 220,
        outerRadius: 360,
        startAngle: 215,
        sweepAngle: 110,
        rowStart: "A",
        rowEnd: "L",
        seatsPerRow: 28,
        aisleGaps: [9, 19],
        price: 250,
      },
      {
        id: "sec_south_stand",
        name: "South Stand",
        type: "curved_stand",
        x: CX,
        y: CY,
        width: 400,
        height: 140,
        rotation: 0,
        color: "#10b981",
        innerRadius: 220,
        outerRadius: 360,
        startAngle: 35,
        sweepAngle: 110,
        rowStart: "A",
        rowEnd: "L",
        seatsPerRow: 28,
        aisleGaps: [9, 19],
        price: 250,
      },
      {
        id: "sec_east_stand",
        name: "East Popular Stand",
        type: "curved_stand",
        x: CX,
        y: CY,
        width: 440,
        height: 150,
        rotation: 0,
        color: "#f59e0b",
        innerRadius: 220,
        outerRadius: 390,
        startAngle: 305,
        sweepAngle: 70,
        rowStart: "A",
        rowEnd: "P",
        seatsPerRow: 32,
        aisleGaps: [11, 22],
        price: 400,
      },
      {
        id: "sec_west_grandstand",
        name: "West VIP Pavilion",
        type: "curved_stand",
        x: CX,
        y: CY,
        width: 440,
        height: 150,
        rotation: 0,
        color: "#8b5cf6",
        innerRadius: 220,
        outerRadius: 370,
        startAngle: 125,
        sweepAngle: 70,
        rowStart: "A",
        rowEnd: "N",
        seatsPerRow: 28,
        aisleGaps: [10, 20],
        price: 900,
      },
    ],
  },

  // 2. Cricket Stadium
  {
    id: "stadium_cricket",
    name: "Cricket Oval Arena",
    venueType: "stadium_cricket",
    badge: "Sports Arena",
    description: "Circular cricket ground with central rectangular pitch, 360-degree tiered pavilions, and long-on/long-off stands.",
    objects: [
      {
        id: "obj_cricket_pitch",
        name: "Cricket 22-Yard Pitch",
        type: "sports_court",
        x: CX,
        y: CY,
        width: 140,
        height: 40,
        rotation: 0,
        color: "#b45309",
      },
      {
        id: "sec_pavilion_stand",
        name: "Clubhouse Pavilion",
        type: "curved_stand",
        x: CX,
        y: CY,
        width: 400,
        height: 120,
        rotation: 0,
        color: "#ec4899",
        innerRadius: 240,
        outerRadius: 380,
        startAngle: 60,
        sweepAngle: 60,
        rowStart: "A",
        rowEnd: "J",
        seatsPerRow: 24,
        price: 1200,
      },
      {
        id: "sec_media_stand",
        name: "Press & Media Stand",
        type: "curved_stand",
        x: CX,
        y: CY,
        width: 400,
        height: 120,
        rotation: 0,
        color: "#3b82f6",
        innerRadius: 240,
        outerRadius: 380,
        startAngle: 240,
        sweepAngle: 60,
        rowStart: "A",
        rowEnd: "J",
        seatsPerRow: 24,
        price: 1000,
      },
    ],
  },

  // 3. Indoor Arena
  {
    id: "indoor_arena",
    name: "Indoor Sports Arena",
    venueType: "indoor_arena",
    badge: "Multi-Purpose",
    description: "Basketball/volleyball court with 4 orthogonal bleacher banks and courtside VIP seats.",
    objects: [
      {
        id: "obj_court_indoor",
        name: "Basketball Hardwood Court",
        type: "sports_court",
        x: CX,
        y: CY,
        width: 320,
        height: 180,
        rotation: 0,
        color: "#ca8a04",
      },
      {
        id: "sec_court_north",
        name: "North Bleachers",
        type: "grid_stand",
        x: CX,
        y: CY - 180,
        width: 420,
        height: 120,
        rotation: 0,
        color: "#2563eb",
        rowStart: "A",
        rowEnd: "H",
        seatsPerRow: 22,
        price: 350,
      },
      {
        id: "sec_court_south",
        name: "South Bleachers",
        type: "grid_stand",
        x: CX,
        y: CY + 180,
        width: 420,
        height: 120,
        rotation: 0,
        color: "#2563eb",
        rowStart: "A",
        rowEnd: "H",
        seatsPerRow: 22,
        price: 350,
      },
    ],
  },

  // 4. Theatre (Proscenium)
  {
    id: "theatre",
    name: "Classic Proscenium Theatre",
    venueType: "theatre",
    badge: "Performing Arts",
    description: "Deep theatre stage with fan-shaped orchestra stalls and elevated royal dress circle.",
    objects: [
      {
        id: "obj_theatre_stage",
        name: "Main Proscenium Stage",
        type: "stage",
        x: CX,
        y: 180,
        width: 440,
        height: 100,
        rotation: 0,
        color: "#991b1b",
      },
      {
        id: "sec_orchestra_stalls",
        name: "Orchestra Stalls",
        type: "curved_stand",
        x: CX,
        y: 220,
        width: 480,
        height: 220,
        rotation: 0,
        color: "#b91c1c",
        innerRadius: 140,
        outerRadius: 360,
        startAngle: 45,
        sweepAngle: 90,
        rowStart: "A",
        rowEnd: "P",
        seatsPerRow: 24,
        aisleGaps: [8, 16],
        price: 600,
      },
      {
        id: "sec_royal_circle",
        name: "Royal Dress Circle (Balcony)",
        type: "curved_stand",
        x: CX,
        y: 220,
        width: 540,
        height: 160,
        rotation: 0,
        color: "#4338ca",
        innerRadius: 390,
        outerRadius: 520,
        startAngle: 45,
        sweepAngle: 90,
        rowStart: "AA",
        rowEnd: "HH",
        seatsPerRow: 28,
        aisleGaps: [9, 19],
        price: 450,
      },
    ],
  },

  // 5. Cinema Multiplex
  {
    id: "cinema",
    name: "Cinema Multiplex Hall",
    venueType: "cinema",
    badge: "Screen Entertainment",
    description: "Curved movie screen at front with VIP recliners, prime tier, and classic stadium rows.",
    objects: [
      {
        id: "obj_cinema_screen",
        name: "CURVED CINEMA SCREEN",
        type: "stage",
        x: CX,
        y: 140,
        width: 600,
        height: 28,
        rotation: 0,
        color: "#0284c7",
      },
      {
        id: "sec_cinema_recliners",
        name: "VIP Luxury Recliners",
        type: "grid_stand",
        x: CX,
        y: 280,
        width: 420,
        height: 80,
        rotation: 0,
        color: "#ec4899",
        rowStart: "R1",
        rowEnd: "R3",
        seatsPerRow: 14,
        price: 500,
      },
      {
        id: "sec_cinema_prime",
        name: "Prime Seating Tier",
        type: "grid_stand",
        x: CX,
        y: 450,
        width: 520,
        height: 140,
        rotation: 0,
        color: "#f59e0b",
        rowStart: "A",
        rowEnd: "G",
        seatsPerRow: 20,
        aisleGaps: [7, 14],
        price: 350,
      },
      {
        id: "sec_cinema_classic",
        name: "Classic Seating Tier",
        type: "grid_stand",
        x: CX,
        y: 650,
        width: 560,
        height: 160,
        rotation: 0,
        color: "#3b82f6",
        rowStart: "H",
        rowEnd: "N",
        seatsPerRow: 22,
        aisleGaps: [8, 15],
        price: 250,
      },
    ],
  },

  // 6. Fan Auditorium
  {
    id: "auditorium",
    name: "Fan-Shaped Auditorium",
    venueType: "auditorium",
    badge: "Keynote & Assembly",
    description: "Amphitheater curved fan seating with speaker podium and excellent acoustic sightlines.",
    objects: [
      {
        id: "obj_auditorium_podium",
        name: "Speaker Stage & Presentation Screen",
        type: "stage",
        x: CX,
        y: 160,
        width: 460,
        height: 70,
        rotation: 0,
        color: "#475569",
      },
      {
        id: "sec_auditorium_fan",
        name: "Main Auditorium Tier",
        type: "curved_stand",
        x: CX,
        y: 190,
        width: 580,
        height: 320,
        rotation: 0,
        color: "#0284c7",
        innerRadius: 150,
        outerRadius: 460,
        startAngle: 35,
        sweepAngle: 110,
        rowStart: "A",
        rowEnd: "R",
        seatsPerRow: 26,
        aisleGaps: [9, 18],
        price: 300,
      },
    ],
  },

  // 7. Concert Music Festival
  {
    id: "concert_hall",
    name: "Concert Festival Arena",
    venueType: "concert_hall",
    badge: "Live Music",
    description: "Massive outdoor or arena stage with front VIP Golden Circle standing pit and sound console.",
    objects: [
      {
        id: "obj_concert_stage",
        name: "Main Festival Concert Stage",
        type: "stage",
        x: CX,
        y: 140,
        width: 520,
        height: 100,
        rotation: 0,
        color: "#6366f1",
      },
      {
        id: "sec_golden_pit",
        name: "VIP Golden Circle (Standing Pit)",
        type: "general_admission",
        x: CX,
        y: 330,
        width: 460,
        height: 140,
        rotation: 0,
        color: "#f59e0b",
        standingCapacity: 2500,
        price: 1200,
      },
      {
        id: "sec_general_lawn",
        name: "General Admission Lawn",
        type: "general_admission",
        x: CX,
        y: 540,
        width: 620,
        height: 180,
        rotation: 0,
        color: "#10b981",
        standingCapacity: 5000,
        price: 450,
      },
    ],
  },

  // 8. Wedding & Banquet Hall
  {
    id: "wedding_hall",
    name: "Grand Wedding Banquet Hall",
    venueType: "wedding_hall",
    badge: "Hospitality & Dinner",
    description: "Central bridal stage with 16 round banquet tables and a central dance floor.",
    objects: [
      {
        id: "obj_wedding_stage",
        name: "Bridal Stage & Head Table",
        type: "stage",
        x: CX,
        y: 160,
        width: 380,
        height: 80,
        rotation: 0,
        color: "#be185d",
      },
      {
        id: "obj_wedding_dancefloor",
        name: "Central Dance Floor",
        type: "general_admission",
        x: CX,
        y: 310,
        width: 280,
        height: 120,
        rotation: 0,
        color: "#f59e0b",
        standingCapacity: 150,
        price: 0,
      },
      // 12 Banquet round tables
      ...Array.from({ length: 12 }).map((_, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        return {
          id: `tbl_wedding_${i + 1}`,
          name: `Table ${i + 1}`,
          type: "table_round" as const,
          x: CX - 330 + col * 220,
          y: 470 + row * 160,
          width: 70,
          height: 70,
          rotation: 0,
          color: row === 0 ? "#ec4899" : "#6366f1",
          tableShape: "round" as const,
          tableSeatCount: 10,
          defaultCategory: (row === 0 ? "vip" : "standard") as any,
          price: row === 0 ? 1200 : 800,
        };
      }),
    ],
  },

  // 9. Conference Room
  {
    id: "conference_hall",
    name: "Corporate Conference Center",
    venueType: "conference_hall",
    badge: "Business & Summit",
    description: "Presentation screen with rectangular delegate boardroom tables and rear gallery.",
    objects: [
      {
        id: "obj_conf_screen",
        name: "Main Presentation Screen & Lectern",
        type: "stage",
        x: CX,
        y: 160,
        width: 420,
        height: 70,
        rotation: 0,
        color: "#334155",
      },
      // Delegate tables
      ...Array.from({ length: 6 }).map((_, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        return {
          id: `tbl_conf_${i + 1}`,
          name: `Delegate Table ${i + 1}`,
          type: "table_rect" as const,
          x: CX - 180 + col * 360,
          y: 330 + row * 150,
          width: 200,
          height: 60,
          rotation: 0,
          color: "#0284c7",
          tableShape: "rectangle" as const,
          tableSeatCount: 10,
          price: 500,
        };
      }),
    ],
  },

  // 10. Exhibition Hall
  {
    id: "exhibition_hall",
    name: "Trade Exhibition Hall",
    venueType: "exhibition_hall",
    badge: "Trade Fair",
    description: "Wide open floor plan with registration atrium, sponsor pavilions, and product zones.",
    objects: [
      {
        id: "obj_expo_atrium",
        name: "Main Registration Atrium",
        type: "general_admission",
        x: CX,
        y: 200,
        width: 600,
        height: 120,
        rotation: 0,
        color: "#4f46e5",
        standingCapacity: 1000,
        price: 150,
      },
      {
        id: "obj_expo_zone_a",
        name: "Exhibition Zone A (Pavilion)",
        type: "general_admission",
        x: CX - 220,
        y: 440,
        width: 320,
        height: 240,
        rotation: 0,
        color: "#059669",
        standingCapacity: 800,
        price: 200,
      },
      {
        id: "obj_expo_zone_b",
        name: "Exhibition Zone B (Tech Hub)",
        type: "general_admission",
        x: CX + 220,
        y: 440,
        width: 320,
        height: 240,
        rotation: 0,
        color: "#0891b2",
        standingCapacity: 800,
        price: 200,
      },
    ],
  },

  // 11. Standing-Only Event
  {
    id: "standing_only",
    name: "Standing-Only Open Ground",
    venueType: "standing_only",
    badge: "Festival Ground",
    description: "High-capacity open ground with front stage, security barrier, and emergency exit gates.",
    objects: [
      {
        id: "obj_standing_stage",
        name: "Headline Festival Stage",
        type: "stage",
        x: CX,
        y: 150,
        width: 480,
        height: 90,
        rotation: 0,
        color: "#dc2626",
      },
      {
        id: "sec_standing_arena",
        name: "Main Standing Festival Arena",
        type: "general_admission",
        x: CX,
        y: 460,
        width: 720,
        height: 380,
        rotation: 0,
        color: "#16a34a",
        standingCapacity: 8000,
        price: 350,
      },
    ],
  },

  // 12. Blank Custom Venue
  {
    id: "custom",
    name: "Blank Custom Canvas",
    venueType: "custom",
    badge: "From Scratch",
    description: "Completely blank canvas ready to draw any custom venue or trace an uploaded blueprint image.",
    objects: [
      {
        id: "obj_reference_stage",
        name: "Center Reference Stage / Court",
        type: "stage",
        x: CX,
        y: CY,
        width: 320,
        height: 180,
        rotation: 0,
        color: "#334155",
      },
    ],
  },
];
