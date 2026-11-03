"use client";

import {
  RowConfig,
  SeatType,
  UniversalVenueObject,
  UniversalSeat,
  UniversalTableSeat,
  UniversalVenueLayout,
} from "../types";

/** Expand "A" -> "Z" into ["A", "B", "C", ...] */
export function expandRowRange(rowStart = "A", rowEnd = "J"): string[] {
  const startChar = (rowStart || "A").trim().toUpperCase();
  const endChar = (rowEnd || "J").trim().toUpperCase();

  // If numbers like "1".."20"
  const startNum = parseInt(startChar, 10);
  const endNum = parseInt(endChar, 10);
  if (!isNaN(startNum) && !isNaN(endNum) && endNum >= startNum) {
    return Array.from({ length: endNum - startNum + 1 }, (_, i) => String(startNum + i));
  }

  // Alphabetical range
  const startCode = startChar.charCodeAt(0);
  const endCode = endChar.charCodeAt(0);
  if (isNaN(startCode) || isNaN(endCode) || endCode < startCode) return ["A"];
  return Array.from({ length: endCode - startCode + 1 }, (_, i) => String.fromCharCode(startCode + i));
}

/** Next row label after the given one: A -> B, Z -> AA, 9 -> 10, "Row 3" -> "Row 4" */
export function nextRowLabel(label: string): string {
  const raw = (label || "").trim();
  if (!raw) return "A";
  const trailingNum = raw.match(/^(.*?)(\d+)$/);
  if (trailingNum) return `${trailingNum[1]}${parseInt(trailingNum[2], 10) + 1}`;
  const upper = raw.toUpperCase();
  if (/^[A-Z]+$/.test(upper)) {
    const chars = upper.split("");
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
  return `${raw}2`;
}

let rowCounter = 0;
export function newRowId(): string {
  rowCounter += 1;
  return `row_${Date.now().toString(36)}_${rowCounter}`;
}

/** Build rows from a start label, a count and a seat count, e.g. A, B, C ... */
export function buildRows(startLabel: string, rowCount: number, seatCount: number, seatTypeId?: string): RowConfig[] {
  const rows: RowConfig[] = [];
  let label = (startLabel || "A").trim() || "A";
  const count = Math.max(1, Math.min(200, Math.floor(rowCount) || 1));
  for (let i = 0; i < count; i += 1) {
    rows.push({ id: newRowId(), label, seatCount: Math.max(1, Math.floor(seatCount) || 1), seatTypeId });
    label = nextRowLabel(label);
  }
  return rows;
}

/**
 * Rows of a stand. Custom rows win; older layouts fall back to the row range
 * (rowStart to rowEnd) with one seat count for every row.
 */
export function resolveRows(obj: UniversalVenueObject): RowConfig[] {
  if (obj.rows && obj.rows.length > 0) return obj.rows;
  const labels = expandRowRange(obj.rowStart || "A", obj.rowEnd || "H");
  const perRow = obj.seatsPerRow || (obj.type === "curved_stand" ? 24 : 20);
  return labels.map((label) => ({
    id: `legacy_${label}`,
    label,
    seatCount: perRow,
    seatTypeId: obj.seatTypeId,
    gaps: obj.aisleGaps,
  }));
}

/** Seats a row really has, after aisle gaps are left out */
export function rowSeatTotal(row: RowConfig): number {
  const gaps = new Set((row.gaps || []).filter((g) => g >= 1 && g <= row.seatCount));
  return Math.max(0, row.seatCount - gaps.size);
}

function seatTypeFor(
  seatTypes: SeatType[] | undefined,
  row: RowConfig | undefined,
  obj: UniversalVenueObject
): SeatType | undefined {
  const id = row?.seatTypeId || obj.seatTypeId;
  return id ? seatTypes?.find((t) => t.id === id) : undefined;
}

/** Price and colour of a row: its seat type first, then the stand's own price and colour */
export function rowAppearance(
  obj: UniversalVenueObject,
  row: RowConfig,
  seatTypes?: SeatType[]
): { color: string; price: number; seatTypeId?: string } {
  const type = seatTypeFor(seatTypes, row, obj);
  return {
    color: type?.color || obj.color,
    price: type ? type.price : obj.price || 0,
    seatTypeId: type?.id,
  };
}

/** Box that wraps all rows of a grid stand, so the selection frame always matches the seats */
export function gridStandSize(obj: UniversalVenueObject): { width: number; height: number } {
  const rows = resolveRows(obj);
  const widest = rows.reduce((max, r) => Math.max(max, r.seatCount), 1);
  const seatSpacing = obj.seatSpacing || 18;
  const rowSpacing = obj.rowSpacing || 22;
  return {
    width: Math.max(80, (widest - 1) * seatSpacing + 56),
    height: Math.max(48, (rows.length - 1) * rowSpacing + 40),
  };
}

/**
 * Generate all physical seats for a specific venue object (Curved Stand, Grid Stand, Table)
 */
export function generateSeatsForObject(obj: UniversalVenueObject, seatTypes?: SeatType[]): UniversalSeat[] {
  const seats: UniversalSeat[] = [];
  // Two rows with the same name would give two seats the same id, so later ones get a suffix
  const usedIds = new Map<string, number>();
  const uniqueId = (id: string) => {
    const seen = usedIds.get(id) || 0;
    usedIds.set(id, seen + 1);
    return seen === 0 ? id : `${id}~${seen + 1}`;
  };

  // 1. Curved Stand (Annular Arc)
  if (obj.type === "curved_stand") {
    const rows = resolveRows(obj);
    const innerR = obj.innerRadius || 200;
    const outerR = obj.outerRadius || 320;
    const startAngDeg = obj.startAngle || 0;
    const sweepAngDeg = obj.sweepAngle || 90;

    const rowCount = rows.length;
    const radialStep = rowCount > 1 ? (outerR - innerR) / (rowCount - 1) : 0;

    rows.forEach((row, rIdx) => {
      const radius = innerR + rIdx * radialStep;
      const gaps = new Set(row.gaps || []);
      const angleStep = sweepAngDeg / Math.max(row.seatCount - 1, 1);
      const look = rowAppearance(obj, row, seatTypes);

      let currentSeatNum = 1;
      for (let sIdx = 0; sIdx < row.seatCount; sIdx++) {
        if (gaps.has(sIdx + 1)) continue;

        const angleDeg = startAngDeg + sIdx * angleStep;
        const angleRad = (angleDeg * Math.PI) / 180;

        const sx = Math.round(obj.x + radius * Math.cos(angleRad));
        const sy = Math.round(obj.y + radius * Math.sin(angleRad));
        const seatId = uniqueId(`${obj.name.replace(/\s+/g, "_")}-${row.label}-${currentSeatNum}`);

        seats.push({
          id: seatId,
          sectionId: obj.id,
          rowLabel: row.label,
          seatNumber: String(currentSeatNum),
          x: sx,
          y: sy,
          category: obj.defaultCategory || (rIdx < 2 ? "vip" : "standard"),
          price: look.price || 250,
          seatTypeId: look.seatTypeId,
          color: look.color,
          status: "AVAILABLE",
        });
        currentSeatNum++;
      }
    });

    return seats;
  }

  // 2. Seated Grid (Orthogonal rows & columns)
  if (obj.type === "grid_stand") {
    const rows = resolveRows(obj);
    const seatSpacing = obj.seatSpacing || 18;
    const rowSpacing = obj.rowSpacing || 22;

    const totalGridH = (rows.length - 1) * rowSpacing;
    const startY = obj.y - totalGridH / 2;

    rows.forEach((row, rIdx) => {
      const gaps = new Set(row.gaps || []);
      const rowWidth = (row.seatCount - 1) * seatSpacing;
      const startX = obj.x - rowWidth / 2;
      const look = rowAppearance(obj, row, seatTypes);

      let currentSeatNum = 1;
      for (let sIdx = 0; sIdx < row.seatCount; sIdx++) {
        if (gaps.has(sIdx + 1)) continue;

        const sx = Math.round(startX + sIdx * seatSpacing);
        const sy = Math.round(startY + rIdx * rowSpacing);
        const seatId = uniqueId(`${obj.name.replace(/\s+/g, "_")}-${row.label}-${currentSeatNum}`);

        seats.push({
          id: seatId,
          sectionId: obj.id,
          rowLabel: row.label,
          seatNumber: String(currentSeatNum),
          x: sx,
          y: sy,
          category: obj.defaultCategory || "standard",
          price: look.price || 300,
          seatTypeId: look.seatTypeId,
          color: look.color,
          status: "AVAILABLE",
        });
        currentSeatNum++;
      }
    });

    return seats;
  }

  // 3. Round Table with Surrounding Seats
  if (obj.type === "table_round") {
    const count = obj.tableSeatCount || 8;
    const tableRadius = Math.min(obj.width, obj.height) / 2;
    const chairDistance = tableRadius + 16;
    const type = seatTypeFor(seatTypes, undefined, obj);

    for (let i = 0; i < count; i++) {
      const angleRad = (i / count) * 2 * Math.PI - Math.PI / 2;
      const sx = Math.round(obj.x + chairDistance * Math.cos(angleRad));
      const sy = Math.round(obj.y + chairDistance * Math.sin(angleRad));
      const seatId = `${obj.name.replace(/\s+/g, "_")}-TSeat-${i + 1}`;

      seats.push({
        id: seatId,
        sectionId: obj.id,
        rowLabel: obj.name,
        seatNumber: String(i + 1),
        x: sx,
        y: sy,
        category: obj.defaultCategory || "vip",
        price: (type ? type.price : obj.price) || 500,
        seatTypeId: type?.id,
        color: type?.color || obj.color,
        status: "AVAILABLE",
      });
    }

    return seats;
  }

  // 4. Rectangular Table with Surrounding Seats
  if (obj.type === "table_rect") {
    const count = obj.tableSeatCount || 10;
    const halfW = obj.width / 2;
    const halfH = obj.height / 2;
    const sideCount = Math.floor(count / 2);
    const type = seatTypeFor(seatTypes, undefined, obj);
    const price = (type ? type.price : obj.price) || 400;
    const color = type?.color || obj.color;

    for (let i = 0; i < sideCount; i++) {
      const stepX = sideCount > 1 ? (obj.width - 24) / (sideCount - 1) : 0;
      const posX = obj.x - halfW + 12 + i * stepX;

      // Top seat
      seats.push({
        id: `${obj.name.replace(/\s+/g, "_")}-TTop-${i + 1}`,
        sectionId: obj.id,
        rowLabel: obj.name,
        seatNumber: String(i + 1),
        x: Math.round(posX),
        y: Math.round(obj.y - halfH - 14),
        category: obj.defaultCategory || "standard",
        price,
        seatTypeId: type?.id,
        color,
        status: "AVAILABLE",
      });

      // Bottom seat
      seats.push({
        id: `${obj.name.replace(/\s+/g, "_")}-TBot-${i + 1}`,
        sectionId: obj.id,
        rowLabel: obj.name,
        seatNumber: String(sideCount + i + 1),
        x: Math.round(posX),
        y: Math.round(obj.y + halfH + 14),
        category: obj.defaultCategory || "standard",
        price,
        seatTypeId: type?.id,
        color,
        status: "AVAILABLE",
      });
    }

    return seats;
  }

  return seats;
}

/**
 * Compute total metrics for layout
 */
export function computeLayoutCapacity(objects: UniversalVenueObject[], seatTypes?: SeatType[]) {
  let seatedCapacity = 0;
  let standingCapacity = 0;
  let totalTables = 0;
  let totalGates = 0;
  let estimatedRevenue = 0;

  objects.forEach((obj) => {
    if (obj.type === "general_admission") {
      const cap = obj.standingCapacity || 500;
      standingCapacity += cap;
      estimatedRevenue += cap * (obj.price || 200);
    } else if (obj.type === "curved_stand" || obj.type === "grid_stand") {
      resolveRows(obj).forEach((row) => {
        const count = rowSeatTotal(row);
        seatedCapacity += count;
        estimatedRevenue += count * (rowAppearance(obj, row, seatTypes).price || 300);
      });
    } else if (obj.type === "table_round" || obj.type === "table_rect") {
      totalTables += 1;
      const count = obj.tableSeatCount || 8;
      const type = seatTypeFor(seatTypes, undefined, obj);
      seatedCapacity += count;
      estimatedRevenue += count * ((type ? type.price : obj.price) || 500);
    } else if (obj.type === "gate") {
      totalGates += 1;
    }
  });

  return {
    totalCapacity: seatedCapacity + standingCapacity,
    seatedCapacity,
    standingCapacity,
    totalTables,
    totalGates,
    estimatedRevenue,
  };
}

/**
 * Validate layout geometry and prevent duplicate seat identifiers
 */
export function validateLayout(
  objects: UniversalVenueObject[],
  seatTypes?: SeatType[]
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const typeIds = new Set((seatTypes || []).map((t) => t.id));

  objects.forEach((obj) => {
    if (seenIds.has(obj.id)) {
      warnings.push(`Duplicate object ID detected: ${obj.id}`);
    }
    seenIds.add(obj.id);

    if (!obj.name || !obj.name.trim()) {
      warnings.push("An element has no name. Give every element a name.");
    } else if (seenNames.has(obj.name)) {
      warnings.push(`Duplicate section name "${obj.name}". Names should be unique.`);
    }
    seenNames.add(obj.name);

    if (obj.type === "curved_stand") {
      if ((obj.innerRadius || 0) >= (obj.outerRadius || 0)) {
        warnings.push(`Section "${obj.name}": Inner radius must be smaller than outer radius.`);
      }
      if ((obj.sweepAngle || 0) <= 0 || (obj.sweepAngle || 0) > 360) {
        warnings.push(`Section "${obj.name}": Sweep angle must be between 1° and 360°.`);
      }
    }

    if (obj.type === "curved_stand" || obj.type === "grid_stand") {
      const rows = resolveRows(obj);
      const seenRows = new Set<string>();
      rows.forEach((row) => {
        const label = (row.label || "").trim();
        if (!label) {
          warnings.push(`Section "${obj.name}": every row needs a name.`);
        } else if (seenRows.has(label.toLowerCase())) {
          warnings.push(`Section "${obj.name}": row "${label}" is used twice.`);
        }
        seenRows.add(label.toLowerCase());
        if (!(row.seatCount >= 1)) {
          warnings.push(`Section "${obj.name}": row "${label || "?"}" needs at least 1 seat.`);
        }
        if (row.seatTypeId && !typeIds.has(row.seatTypeId)) {
          warnings.push(`Section "${obj.name}": row "${label}" uses a seat type that was removed.`);
        }
      });
      if (rows.reduce((sum, r) => sum + rowSeatTotal(r), 0) === 0) {
        warnings.push(`Section "${obj.name}" has no seats.`);
      }
    }

    if (obj.type === "general_admission" && (!obj.standingCapacity || obj.standingCapacity <= 0)) {
      warnings.push(`Standing zone "${obj.name}" has zero or negative capacity.`);
    }

    if (obj.type === "shape" && (!(obj.width > 0) || !(obj.height > 0)) && obj.shapeKind !== "line") {
      warnings.push(`Shape "${obj.name}" needs a width and height above zero.`);
    }
  });

  return {
    isValid: warnings.length === 0,
    warnings,
  };
}

/**
 * Rule-based natural language prompt layout generator
 */
export function generateDraftFromTextPrompt(prompt: string): UniversalVenueObject[] {
  const text = prompt.toLowerCase();
  const objects: UniversalVenueObject[] = [];
  const cx = 800;
  const cy = 600;

  // 1. Wedding / Banquet Hall with round tables and stage
  if (text.includes("wedding") || text.includes("banquet") || text.includes("table")) {
    // Stage
    objects.push({
      id: "obj_stage_banquet",
      name: "Main Wedding Stage & Head Table",
      type: "stage",
      x: cx,
      y: 180,
      width: 400,
      height: 90,
      rotation: 0,
      color: "#991b1b",
    });

    // Dance floor / Lawn
    objects.push({
      id: "obj_dance_floor",
      name: "Central Dance Floor",
      type: "general_admission",
      x: cx,
      y: 340,
      width: 320,
      height: 140,
      rotation: 0,
      color: "#f59e0b",
      standingCapacity: 200,
      price: 0,
    });

    // 16 Round Tables in a grid arrangement
    const cols = 4;
    const rows = 4;
    let tableNum = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tx = cx - 360 + c * 240;
        const ty = 480 + r * 160;
        objects.push({
          id: `obj_tbl_${tableNum}`,
          name: `Table ${tableNum}`,
          type: "table_round",
          x: tx,
          y: ty,
          width: 70,
          height: 70,
          rotation: 0,
          color: r === 0 ? "#ec4899" : "#6366f1",
          tableShape: "round",
          tableSeatCount: 10,
          defaultCategory: r === 0 ? "vip" : "standard",
          price: r === 0 ? 1200 : 800,
        });
        tableNum++;
      }
    }

    return objects;
  }

  // 2. Auditorium / Theatre
  if (text.includes("auditorium") || text.includes("theatre") || text.includes("theater")) {
    // Proscenium stage
    objects.push({
      id: "obj_theatre_stage",
      name: "Proscenium Stage",
      type: "stage",
      x: cx,
      y: 180,
      width: 500,
      height: 100,
      rotation: 0,
      color: "#991b1b",
    });

    // Fan curved stalls
    objects.push({
      id: "obj_theatre_stalls",
      name: "Orchestra Stalls (Curved)",
      type: "curved_stand",
      x: cx,
      y: 220,
      width: 500,
      height: 250,
      rotation: 0,
      color: "#e11d48",
      innerRadius: 150,
      outerRadius: 400,
      startAngle: 40,
      sweepAngle: 100,
      rowStart: "A",
      rowEnd: "R",
      seatsPerRow: 28,
      aisleGaps: [9, 19],
      price: 500,
    });

    // Balcony Tier
    objects.push({
      id: "obj_theatre_balcony",
      name: "Upper Balcony",
      type: "curved_stand",
      x: cx,
      y: 220,
      width: 600,
      height: 160,
      rotation: 0,
      color: "#4f46e5",
      innerRadius: 440,
      outerRadius: 580,
      startAngle: 40,
      sweepAngle: 100,
      rowStart: "AA",
      rowEnd: "JJ",
      seatsPerRow: 32,
      aisleGaps: [11, 22],
      price: 350,
    });

    return objects;
  }

  // 3. Sports Stadium / Arena (Default)
  // Center pitch
  objects.push({
    id: "obj_pitch_main",
    name: "Central Sports Turf / Court",
    type: "sports_court",
    x: cx,
    y: cy,
    width: 360,
    height: 240,
    rotation: 0,
    color: "#15803d",
  });

  // 4 Concentric stands
  const angles = [
    { name: "North Stand", start: 215, sweep: 110, color: "#3b82f6", price: 300 },
    { name: "South Stand", start: 35, sweep: 110, color: "#10b981", price: 300 },
    { name: "East Popular Stand", start: 305, sweep: 70, color: "#f59e0b", price: 450 },
    { name: "West VIP Grandstand", start: 125, sweep: 70, color: "#8b5cf6", price: 1000 },
  ];

  angles.forEach((a, idx) => {
    objects.push({
      id: `obj_stand_${idx + 1}`,
      name: a.name,
      type: "curved_stand",
      x: cx,
      y: cy,
      width: 400,
      height: 140,
      rotation: 0,
      color: a.color,
      innerRadius: 220,
      outerRadius: 360,
      startAngle: a.start,
      sweepAngle: a.sweep,
      rowStart: "A",
      rowEnd: "M",
      seatsPerRow: 28,
      aisleGaps: [9, 19],
      price: a.price,
    });
  });

  // Gates
  objects.push({
    id: "obj_gate_north",
    name: "Gate 1 (North Entrance)",
    type: "gate",
    x: cx,
    y: cy - 420,
    width: 90,
    height: 24,
    rotation: 0,
    color: "#7c3aed",
    gateNumber: "1",
    gateType: "entry",
  });

  objects.push({
    id: "obj_gate_south",
    name: "Gate 2 (South Entrance)",
    type: "gate",
    x: cx,
    y: cy + 420,
    width: 90,
    height: 24,
    rotation: 0,
    color: "#7c3aed",
    gateNumber: "2",
    gateType: "entry",
  });

  return objects;
}
