"use client";

import { UniversalVenueObject, UniversalSeat, UniversalTableSeat, UniversalVenueLayout } from "../types";

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

/**
 * Generate all physical seats for a specific venue object (Curved Stand, Grid Stand, Table)
 */
export function generateSeatsForObject(obj: UniversalVenueObject): UniversalSeat[] {
  const seats: UniversalSeat[] = [];

  // 1. Curved Stand (Annular Arc)
  if (obj.type === "curved_stand") {
    const rows = expandRowRange(obj.rowStart || "A", obj.rowEnd || "H");
    const seatsPerRow = obj.seatsPerRow || 24;
    const innerR = obj.innerRadius || 200;
    const outerR = obj.outerRadius || 320;
    const startAngDeg = obj.startAngle || 0;
    const sweepAngDeg = obj.sweepAngle || 90;
    const aisleGaps = new Set(obj.aisleGaps || []);

    const rowCount = rows.length;
    const radialStep = rowCount > 1 ? (outerR - innerR) / (rowCount - 1) : 0;

    rows.forEach((rowLabel, rIdx) => {
      const radius = innerR + rIdx * radialStep;
      // Angle per seat
      const angleStep = sweepAngDeg / Math.max(seatsPerRow - 1, 1);

      let currentSeatNum = 1;
      for (let sIdx = 0; sIdx < seatsPerRow; sIdx++) {
        // Skip aisle gaps if specified
        if (aisleGaps.has(sIdx + 1)) {
          continue;
        }

        const angleDeg = startAngDeg + sIdx * angleStep;
        const angleRad = (angleDeg * Math.PI) / 180;

        const sx = Math.round(obj.x + radius * Math.cos(angleRad));
        const sy = Math.round(obj.y + radius * Math.sin(angleRad));
        const seatId = `${obj.name.replace(/\s+/g, "_")}-${rowLabel}-${currentSeatNum}`;

        seats.push({
          id: seatId,
          sectionId: obj.id,
          rowLabel,
          seatNumber: String(currentSeatNum),
          x: sx,
          y: sy,
          category: obj.defaultCategory || (rIdx < 2 ? "vip" : "standard"),
          price: obj.price || 250,
          status: "AVAILABLE",
        });
        currentSeatNum++;
      }
    });

    return seats;
  }

  // 2. Seated Grid (Orthogonal rows & columns)
  if (obj.type === "grid_stand") {
    const rows = expandRowRange(obj.rowStart || "A", obj.rowEnd || "H");
    const seatsPerRow = obj.seatsPerRow || 20;
    const aisleGaps = new Set(obj.aisleGaps || []);
    const seatSpacing = obj.seatSpacing || 18;
    const rowSpacing = obj.rowSpacing || 22;

    const totalGridW = (seatsPerRow - 1) * seatSpacing;
    const totalGridH = (rows.length - 1) * rowSpacing;

    const startX = obj.x - totalGridW / 2;
    const startY = obj.y - totalGridH / 2;

    rows.forEach((rowLabel, rIdx) => {
      let currentSeatNum = 1;
      for (let sIdx = 0; sIdx < seatsPerRow; sIdx++) {
        if (aisleGaps.has(sIdx + 1)) continue;

        const sx = Math.round(startX + sIdx * seatSpacing);
        const sy = Math.round(startY + rIdx * rowSpacing);
        const seatId = `${obj.name.replace(/\s+/g, "_")}-${rowLabel}-${currentSeatNum}`;

        seats.push({
          id: seatId,
          sectionId: obj.id,
          rowLabel,
          seatNumber: String(currentSeatNum),
          x: sx,
          y: sy,
          category: obj.defaultCategory || "standard",
          price: obj.price || 300,
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
        price: obj.price || 500,
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
        price: obj.price || 400,
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
        price: obj.price || 400,
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
export function computeLayoutCapacity(objects: UniversalVenueObject[]) {
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
      const rows = expandRowRange(obj.rowStart, obj.rowEnd);
      const perRow = obj.seatsPerRow || 20;
      const count = rows.length * perRow;
      seatedCapacity += count;
      estimatedRevenue += count * (obj.price || 300);
    } else if (obj.type === "table_round" || obj.type === "table_rect") {
      totalTables += 1;
      const count = obj.tableSeatCount || 8;
      seatedCapacity += count;
      estimatedRevenue += count * (obj.price || 500);
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
export function validateLayout(objects: UniversalVenueObject[]): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  objects.forEach((obj) => {
    if (seenIds.has(obj.id)) {
      warnings.push(`Duplicate object ID detected: ${obj.id}`);
    }
    seenIds.add(obj.id);

    if (seenNames.has(obj.name)) {
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

    if (obj.type === "general_admission" && (!obj.standingCapacity || obj.standingCapacity <= 0)) {
      warnings.push(`Standing zone "${obj.name}" has zero or negative capacity.`);
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
