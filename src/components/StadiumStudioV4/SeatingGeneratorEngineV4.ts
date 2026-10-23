"use client";

import { BMSSectionDefV4, BMSVenueArchetype, BMSTableDefV4 } from "./types";

export interface GeneratedSeatV4 {
  id: string;
  internalId: string;
  section_id: string;
  section_name: string;
  row_label: string;
  seat_label: string;
  ticket_type_id: string | null;
  coordinate_x: number;
  coordinate_y: number;
  status: string;
  color?: string | null;
  is_bestseller?: boolean;
  type?: string;
}

export interface BMSV4CapacitySummary {
  totalCapacity: number;
  seatedCapacity: number;
  standingCapacity: number;
  totalTables: number;
  totalGrossRevenue: number;
}

/** Expand "A" -> "Z" alphabetically */
export function expandRowRangeV4(rowStart: string = "A", rowEnd: string = "J"): string[] {
  const start = (rowStart || "A").toUpperCase().charCodeAt(0);
  const end = (rowEnd || "J").toUpperCase().charCodeAt(0);
  if (isNaN(start) || isNaN(end) || end < start) return ["A"];
  return Array.from({ length: end - start + 1 }, (_, i) => String.fromCharCode(start + i));
}

/**
 * Generate seats for a single section based on its sectionType:
 * - seated_grid
 * - curved_stand
 * - table_cluster
 * - general_admission (standing)
 */
export function generateSectionSeatsV4(
  section: BMSSectionDefV4,
  ticketTypeMap: Map<string, { id: string; price: number; name: string }>,
  canvasW = 1600,
  canvasH = 1200
): GeneratedSeatV4[] {
  const seats: GeneratedSeatV4[] = [];

  // 1. Table Cluster (Banquet)
  if (section.sectionType === "table_cluster") {
    const tables: BMSTableDefV4[] = section.tables || [];
    tables.forEach((tbl) => {
      const seatCount = tbl.seatCount || 8;
      const radius = (tbl.radius || 45) + 18;
      const ticketId = tbl.ticketTypeId || section.ticketTypeId || null;

      for (let i = 0; i < seatCount; i++) {
        const angle = (i / seatCount) * 2 * Math.PI - Math.PI / 2;
        const sx = Math.round(tbl.x + radius * Math.cos(angle));
        const sy = Math.round(tbl.y + radius * Math.sin(angle));
        const seatNo = `${i + 1}`;

        seats.push({
          id: `tbl_${tbl.id}_seat_${i + 1}`,
          internalId: `tbl_${tbl.id}_seat_${i + 1}`,
          section_id: section.id,
          section_name: section.name,
          row_label: tbl.tableNumber,
          seat_label: seatNo,
          ticket_type_id: ticketId,
          coordinate_x: sx,
          coordinate_y: sy,
          status: "AVAILABLE",
          color: section.color,
          type: "standard",
        });
      }
    });
    return seats;
  }

  // 2. General Admission (Standing pit) - no individual fixed coordinate seats
  if (section.sectionType === "general_admission") {
    return seats;
  }

  // 3. Curved Stand (Arc / Radial Rows)
  if (section.sectionType === "curved_stand") {
    const rows = expandRowRangeV4(section.rowStart, section.rowEnd);
    const seatsPerRow = section.seatsPerRow || 24;
    const innerR = section.innerRadius || 210;
    const outerR = section.outerRadius || 310;
    const startAngDeg = section.startAngle || 0;
    const sweepAngDeg = section.sweepAngle || 90;
    const cx = section.x;
    const cy = section.y;

    const radialThickness = Math.max(30, outerR - innerR);
    const rowStep = rows.length > 1 ? radialThickness / (rows.length - 1) : 0;

    rows.forEach((rowLetter, rIdx) => {
      const currentRadius = innerR + rIdx * rowStep;
      for (let s = 1; s <= seatsPerRow; s++) {
        const t = seatsPerRow > 1 ? (s - 1) / (seatsPerRow - 1) : 0.5;
        const angleDeg = startAngDeg + t * sweepAngDeg;
        const angleRad = (angleDeg * Math.PI) / 180;

        const sx = Math.round(cx + currentRadius * Math.cos(angleRad));
        const sy = Math.round(cy + currentRadius * Math.sin(angleRad));
        const overrideKey = `${rowLetter}-${s}`;
        const seatType = section.seatMatrixOverrides?.[overrideKey] || "standard";

        if (seatType === "blocked") continue;

        seats.push({
          id: `${section.id}_${rowLetter}_${s}`,
          internalId: `${section.id}_${rowLetter}_${s}`,
          section_id: section.id,
          section_name: section.name,
          row_label: rowLetter,
          seat_label: `${s}`,
          ticket_type_id: section.ticketTypeId || null,
          coordinate_x: sx,
          coordinate_y: sy,
          status: "AVAILABLE",
          color: section.color,
          type: seatType,
        });
      }
    });
    return seats;
  }

  // 4. Seated Grid (Orthogonal rows with aisle walkways)
  const rows = expandRowRangeV4(section.rowStart, section.rowEnd);
  const seatsPerRow = section.seatsPerRow || 20;
  const aisleGaps = section.aisleGaps || [];

  const left = section.x - section.width / 2;
  const top = section.y - section.height / 2;
  const rowHeight = rows.length > 1 ? (section.height - 20) / (rows.length - 1) : 0;

  rows.forEach((rowLetter, rIdx) => {
    const cy = top + 10 + rIdx * rowHeight;
    let extraAisleShift = 0;
    const baseColWidth = section.width / (seatsPerRow + aisleGaps.length * 1.5);

    for (let s = 1; s <= seatsPerRow; s++) {
      if (aisleGaps.includes(s)) {
        extraAisleShift += baseColWidth * 1.5;
      }
      const cx = left + 15 + (s - 1) * baseColWidth + extraAisleShift;

      // Handle section rotation
      let finalX = cx;
      let finalY = cy;
      if (section.rotation) {
        const rad = (section.rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const dx = cx - section.x;
        const dy = cy - section.y;
        finalX = Math.round(section.x + dx * cos - dy * sin);
        finalY = Math.round(section.y + dx * sin + dy * cos);
      } else {
        finalX = Math.round(finalX);
        finalY = Math.round(finalY);
      }

      const overrideKey = `${rowLetter}-${s}`;
      const seatType = section.seatMatrixOverrides?.[overrideKey] || "standard";
      if (seatType === "blocked") continue;

      seats.push({
        id: `${section.id}_${rowLetter}_${s}`,
        internalId: `${section.id}_${rowLetter}_${s}`,
        section_id: section.id,
        section_name: section.name,
        row_label: rowLetter,
        seat_label: `${s}`,
        ticket_type_id: section.ticketTypeId || null,
        coordinate_x: finalX,
        coordinate_y: finalY,
        status: "AVAILABLE",
        color: section.color,
        type: seatType,
      });
    }
  });

  return seats;
}

/**
 * Generate all seats across all sections in the V4 layout
 */
export function generateAllSeatsV4(
  sections: BMSSectionDefV4[],
  ticketTypes: Array<{ id: string; price?: number; name?: string; ticket_type?: string }> = []
): GeneratedSeatV4[] {
  const ticketMap = new Map<string, { id: string; price: number; name: string }>();
  ticketTypes.forEach((tt) => {
    ticketMap.set(tt.id, {
      id: tt.id,
      price: Number(tt.price) || 0,
      name: tt.name || tt.ticket_type || "Ticket",
    });
  });

  const allSeats: GeneratedSeatV4[] = [];
  sections.forEach((sec) => {
    const secSeats = generateSectionSeatsV4(sec, ticketMap);
    allSeats.push(...secSeats);
  });

  return allSeats;
}

/**
 * Compute real-time capacity and gross box office potential
 */
export function computeBMSCapacitySummaryV4(
  sections: BMSSectionDefV4[],
  ticketTypes: Array<{ id: string; price?: number }> = []
): BMSV4CapacitySummary {
  const priceMap = new Map<string, number>();
  ticketTypes.forEach((tt) => {
    priceMap.set(tt.id, Number(tt.price) || 0);
  });

  let seatedCapacity = 0;
  let standingCapacity = 0;
  let totalTables = 0;
  let totalGrossRevenue = 0;

  sections.forEach((sec) => {
    const secPrice = (sec.ticketTypeId ? priceMap.get(sec.ticketTypeId) : sec.price) || 0;

    if (sec.sectionType === "general_admission") {
      const cap = sec.standingCapacity || 0;
      standingCapacity += cap;
      totalGrossRevenue += cap * secPrice;
    } else if (sec.sectionType === "table_cluster") {
      const tbls = sec.tables || [];
      totalTables += tbls.length;
      tbls.forEach((t) => {
        const count = t.seatCount || 8;
        const seatP = (t.ticketTypeId ? priceMap.get(t.ticketTypeId) : t.pricePerSeat) || secPrice;
        seatedCapacity += count;
        totalGrossRevenue += count * seatP;
      });
    } else {
      const rows = expandRowRangeV4(sec.rowStart, sec.rowEnd);
      const seatsPerRow = sec.seatsPerRow || 20;
      const count = rows.length * seatsPerRow;
      seatedCapacity += count;
      totalGrossRevenue += count * secPrice;
    }
  });

  return {
    totalCapacity: seatedCapacity + standingCapacity,
    seatedCapacity,
    standingCapacity,
    totalTables,
    totalGrossRevenue,
  };
}
