import { BMSBlockDef, BMSTierDef } from "./types";
import { isPointInPolygon } from "../StadiumStudioV2/SeatingGeneratorEngine";

export interface GeneratedSeatV3 {
  internalId: string;
  grid_id: string;
  row_label: string;
  seat_label: string;
  coordinate_x: number;
  coordinate_y: number;
  section_name: string;
  color?: string | null;
  status: "AVAILABLE";
  ticket_type_id: string | null;
  block_id: string;
  tier_id?: string;
  // BMS attributes
  is_bestseller?: boolean;
  is_accessible?: boolean;
  is_blocked?: boolean;
  gate_info?: string;
}

/**
 * Generate seats for a stand block based on BMS V3 parameters
 */
export function generateBlockSeatsV3(
  block: BMSBlockDef,
  canvasW = 1600,
  canvasH = 1200
): GeneratedSeatV3[] {
  const seats: GeneratedSeatV3[] = [];
  const isArc = block.shape === "arc";
  const isPolygon = block.shape === "polygon" && Array.isArray(block.points) && block.points.length >= 6;

  const tiers: BMSTierDef[] = Array.isArray(block.tiers) && block.tiers.length > 0 ? block.tiers : [
    {
      id: `t-${block.id}`,
      name: block.name,
      ticket_type_id: block.ticket_type_id || "",
      row_start: block.row_start || "A",
      row_end: block.row_end || "J",
      seats_per_row: block.seats_per_row || 20,
    }
  ];

  // ── 1. ARC GEOMETRY (Oval / Ring Bowls) ──────────────────────────────────
  if (isArc) {
    const sCenterX = block.stadiumCenterX != null ? Number(block.stadiumCenterX) : canvasW / 2;
    const sCenterY = block.stadiumCenterY != null ? Number(block.stadiumCenterY) : canvasH / 2;
    const startAngle = Number(block.startAngle) || 0;
    const sweepAngle = Number(block.sweepAngle) || 45;
    const innerR = Number(block.innerRadius) || 200;
    const outerR = Number(block.outerRadius) || 350;

    const totalTiers = tiers.length;
    const tierRadialSpan = (outerR - innerR) / totalTiers;

    tiers.forEach((tier, tIdx) => {
      const tierInR = innerR + tIdx * tierRadialSpan;
      const tierOutR = tierInR + tierRadialSpan;

      const s = String(tier.row_start || "A").toUpperCase().charCodeAt(0);
      const e = String(tier.row_end || "J").toUpperCase().charCodeAt(0);
      const rowCount = isNaN(s) || isNaN(e) || e < s ? 1 : e - s + 1;
      const spr = Math.max(1, Number(tier.seats_per_row) || 20);
      const tierName = tier.name || `Tier ${tIdx + 1}`;
      const secName = `${block.name}${tierName ? " - " + tierName : ""}`;
      const isRtl = tier.row_direction === "rtl";

      for (let rIdx = 0; rIdx < rowCount; rIdx++) {
        const rowLabel = String.fromCharCode(s + rIdx);
        if (tier.row_gaps?.includes(rowLabel)) continue;

        const rowSeatsCount = tier.row_seat_overrides?.[rowLabel] ?? spr;
        const r = tierInR + ((rIdx + 0.5) / rowCount) * (tierOutR - tierInR);

        for (let seatIdx = 0; seatIdx < rowSeatsCount; seatIdx++) {
          const seatNum = isRtl ? (rowSeatsCount - seatIdx) : (seatIdx + 1);
          const seatCode = `${rowLabel}-${seatNum}`;
          if (tier.excluded_seats?.includes(seatCode)) continue;

          const angleDeg = startAngle + ((seatIdx + 0.5) / rowSeatsCount) * sweepAngle;
          const angleRad = (angleDeg * Math.PI) / 180;
          const seatX = Math.round((sCenterX + r * Math.cos(angleRad)) * 10) / 10;
          const seatY = Math.round((sCenterY + r * Math.sin(angleRad)) * 10) / 10;

          seats.push({
            internalId: `${block.id}-${tier.id}-${rowLabel}-${seatNum}`,
            grid_id: `${block.id}-${tier.id}`,
            row_label: rowLabel,
            seat_label: String(seatNum),
            coordinate_x: seatX,
            coordinate_y: seatY,
            section_name: secName,
            color: tier.color || block.color,
            status: "AVAILABLE",
            ticket_type_id: tier.ticket_type_id || block.ticket_type_id || null,
            block_id: block.id,
            tier_id: tier.id,
            is_bestseller: tier.bestseller_seats?.includes(seatCode),
            is_accessible: tier.accessible_seats?.includes(seatCode),
            is_blocked: tier.blocked_seats?.includes(seatCode),
            gate_info: block.gate_info,
          });
        }
      }
    });

    return seats;
  }

  // ── 2. POLYGON GEOMETRY ───────────────────────────────────────────────────
  if (isPolygon && block.points) {
    const pts = block.points;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < pts.length; i += 2) {
      const px = pts[i];
      const py = pts[i + 1];
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }

    const polyW = maxX - minX;
    const polyH = maxY - minY;

    tiers.forEach((tier, tIdx) => {
      const s = String(tier.row_start || "A").toUpperCase().charCodeAt(0);
      const e = String(tier.row_end || "J").toUpperCase().charCodeAt(0);
      const rowCount = isNaN(s) || isNaN(e) || e < s ? 1 : e - s + 1;
      const spr = Math.max(1, Number(tier.seats_per_row) || 20);
      const tierName = tier.name || `Tier ${tIdx + 1}`;
      const secName = `${block.name}${tierName ? " - " + tierName : ""}`;

      const tierH = polyH / tiers.length;
      const tierMinY = minY + tIdx * tierH;

      for (let rIdx = 0; rIdx < rowCount; rIdx++) {
        const rowLabel = String.fromCharCode(s + rIdx);
        if (tier.row_gaps?.includes(rowLabel)) continue;

        const rowSeatsCount = tier.row_seat_overrides?.[rowLabel] ?? spr;
        const candidateY = tierMinY + ((rIdx + 0.5) / rowCount) * tierH;

        let seatNum = 1;
        for (let sIdx = 0; sIdx < rowSeatsCount; sIdx++) {
          const candidateX = minX + ((sIdx + 0.5) / rowSeatsCount) * polyW;

          if (isPointInPolygon(candidateX, candidateY, pts)) {
            const seatCode = `${rowLabel}-${seatNum}`;
            if (!tier.excluded_seats?.includes(seatCode)) {
              seats.push({
                internalId: `${block.id}-${tier.id}-${rowLabel}-${seatNum}`,
                grid_id: `${block.id}-${tier.id}`,
                row_label: rowLabel,
                seat_label: String(seatNum),
                coordinate_x: Math.round(candidateX * 10) / 10,
                coordinate_y: Math.round(candidateY * 10) / 10,
                section_name: secName,
                color: tier.color || block.color,
                status: "AVAILABLE",
                ticket_type_id: tier.ticket_type_id || block.ticket_type_id || null,
                block_id: block.id,
                tier_id: tier.id,
                is_bestseller: tier.bestseller_seats?.includes(seatCode),
                is_accessible: tier.accessible_seats?.includes(seatCode),
                is_blocked: tier.blocked_seats?.includes(seatCode),
                gate_info: block.gate_info,
              });
            }
            seatNum++;
          }
        }
      }
    });

    return seats;
  }

  // ── 3. RECTANGLE / PILL GEOMETRY ──────────────────────────────────────────
  const bx = Number(block.x) || 0;
  const by = Number(block.y) || 0;
  const bw = Number(block.width) || 200;
  const bh = Number(block.height) || 100;

  tiers.forEach((tier, tIdx) => {
    const s = String(tier.row_start || "A").toUpperCase().charCodeAt(0);
    const e = String(tier.row_end || "J").toUpperCase().charCodeAt(0);
    const rowCount = isNaN(s) || isNaN(e) || e < s ? 1 : e - s + 1;
    const spr = Math.max(1, Number(tier.seats_per_row) || 20);
    const tierName = tier.name || `Tier ${tIdx + 1}`;
    const secName = `${block.name}${tierName ? " - " + tierName : ""}`;
    const isRtl = tier.row_direction === "rtl";

    const numTiers = tiers.length;
    const tierH = bh / numTiers;
    const tierY = by + tIdx * tierH;

    for (let rIdx = 0; rIdx < rowCount; rIdx++) {
      const rowLabel = String.fromCharCode(s + rIdx);
      if (tier.row_gaps?.includes(rowLabel)) continue;

      const rowSeatsCount = tier.row_seat_overrides?.[rowLabel] ?? spr;
      const seatY = tierY + ((rIdx + 0.5) / rowCount) * tierH;

      for (let seatIdx = 0; seatIdx < rowSeatsCount; seatIdx++) {
        const seatNum = isRtl ? (rowSeatsCount - seatIdx) : (seatIdx + 1);
        const seatCode = `${rowLabel}-${seatNum}`;
        if (tier.excluded_seats?.includes(seatCode)) continue;

        const seatX = bx + ((seatIdx + 0.5) / rowSeatsCount) * bw;

        seats.push({
          internalId: `${block.id}-${tier.id}-${rowLabel}-${seatNum}`,
          grid_id: `${block.id}-${tier.id}`,
          row_label: rowLabel,
          seat_label: String(seatNum),
          coordinate_x: Math.round(seatX * 10) / 10,
          coordinate_y: Math.round(seatY * 10) / 10,
          section_name: secName,
          color: tier.color || block.color,
          status: "AVAILABLE",
          ticket_type_id: tier.ticket_type_id || block.ticket_type_id || null,
          block_id: block.id,
          tier_id: tier.id,
          is_bestseller: tier.bestseller_seats?.includes(seatCode),
          is_accessible: tier.accessible_seats?.includes(seatCode),
          is_blocked: tier.blocked_seats?.includes(seatCode),
          gate_info: block.gate_info,
        });
      }
    }
  });

  return seats;
}

/**
 * Generate all seats across all stadium blocks in V3
 */
export function generateAllStadiumSeatsV3(
  blocks: BMSBlockDef[],
  canvasW = 1600,
  canvasH = 1200
): GeneratedSeatV3[] {
  if (!Array.isArray(blocks)) return [];
  const allSeats: GeneratedSeatV3[] = [];
  for (const block of blocks) {
    if (block.stand_type === "standing") continue;
    const blockSeats = generateBlockSeatsV3(block, canvasW, canvasH);
    allSeats.push(...blockSeats);
  }
  return allSeats;
}
