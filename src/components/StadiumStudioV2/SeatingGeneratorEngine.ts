import { StadiumBlockDefV2, StadiumTierDefV2 } from "./types";

export interface GeneratedSeat {
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
}

/**
 * Standard Ray-casting algorithm to test if a 2D point (x, y) is inside a polygon
 * points is [x1, y1, x2, y2, x3, y3, ...]
 */
export function isPointInPolygon(px: number, py: number, points: number[]): boolean {
  let inside = false;
  const numPoints = points.length / 2;
  if (numPoints < 3) return false;

  for (let i = 0, j = numPoints - 1; i < numPoints; j = i++) {
    const xi = points[i * 2];
    const yi = points[i * 2 + 1];
    const xj = points[j * 2];
    const yj = points[j * 2 + 1];

    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Generate seats for a stand block based on its geometry and tiers
 */
export function generateBlockSeats(
  block: StadiumBlockDefV2,
  canvasW = 1600,
  canvasH = 1200
): GeneratedSeat[] {
  const seats: GeneratedSeat[] = [];
  const isArc = block.shape === "arc";
  const isPolygon = block.shape === "polygon" && Array.isArray(block.points) && block.points.length >= 6;

  // ── 1. ARC GEOMETRY ────────────────────────────────────────────────────────
  if (isArc) {
    const sCenterX = block.stadiumCenterX != null ? Number(block.stadiumCenterX) : canvasW / 2;
    const sCenterY = block.stadiumCenterY != null ? Number(block.stadiumCenterY) : canvasH / 2;
    const startAngle = Number(block.startAngle) || 0;
    const sweepAngle = Number(block.sweepAngle) || 45;
    const innerR = Number(block.innerRadius) || 200;
    const outerR = Number(block.outerRadius) || 350;

    const tiers = Array.isArray(block.tiers) && block.tiers.length > 0 ? block.tiers : [
      {
        id: `t-${block.id}`,
        name: block.name,
        ticket_type_id: block.ticket_type_id || "",
        row_start: block.row_start || "A",
        row_end: block.row_end || "J",
        seats_per_row: block.seats_per_row || 20,
      } as StadiumTierDefV2
    ];

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

      for (let rIdx = 0; rIdx < rowCount; rIdx++) {
        const rowLabel = String.fromCharCode(s + rIdx);
        if (tier.row_gaps?.includes(rowLabel)) continue;

        const rowSeatsCount = tier.row_seat_overrides?.[rowLabel] ?? spr;
        const r = tierInR + ((rIdx + 0.5) / rowCount) * (tierOutR - tierInR);

        for (let seatIdx = 0; seatIdx < rowSeatsCount; seatIdx++) {
          const seatNum = seatIdx + 1;
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

    const tiers = Array.isArray(block.tiers) && block.tiers.length > 0 ? block.tiers : [
      {
        id: `t-${block.id}`,
        name: block.name,
        ticket_type_id: block.ticket_type_id || "",
        row_start: block.row_start || "A",
        row_end: block.row_end || "J",
        seats_per_row: block.seats_per_row || 20,
      } as StadiumTierDefV2
    ];

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

        // Scan horizontally along candidateY to find valid interior segments
        let seatNum = 1;
        for (let sIdx = 0; sIdx < rowSeatsCount; sIdx++) {
          const candidateX = minX + ((sIdx + 0.5) / rowSeatsCount) * polyW;

          // Check if candidate point is inside polygon
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
              });
            }
            seatNum++;
          }
        }
      }
    });

    return seats;
  }

  // ── 3. RECTANGLE / PILL / OVAL GEOMETRY ─────────────────────────────────────
  const bx = Number(block.x) || 0;
  const by = Number(block.y) || 0;
  const bw = Number(block.width) || 200;
  const bh = Number(block.height) || 100;

  const tiers = Array.isArray(block.tiers) && block.tiers.length > 0 ? block.tiers : [
    {
      id: `t-${block.id}`,
      name: block.name,
      ticket_type_id: block.ticket_type_id || "",
      row_start: block.row_start || "A",
      row_end: block.row_end || "J",
      seats_per_row: block.seats_per_row || 20,
    } as StadiumTierDefV2
  ];

  tiers.forEach((tier, tIdx) => {
    const s = String(tier.row_start || "A").toUpperCase().charCodeAt(0);
    const e = String(tier.row_end || "J").toUpperCase().charCodeAt(0);
    const rowCount = isNaN(s) || isNaN(e) || e < s ? 1 : e - s + 1;
    const spr = Math.max(1, Number(tier.seats_per_row) || 20);
    const tierName = tier.name || `Tier ${tIdx + 1}`;
    const secName = `${block.name}${tierName ? " - " + tierName : ""}`;

    const numTiers = tiers.length;
    const tierH = bh / numTiers;
    const tierY = by + tIdx * tierH;

    for (let rIdx = 0; rIdx < rowCount; rIdx++) {
      const rowLabel = String.fromCharCode(s + rIdx);
      if (tier.row_gaps?.includes(rowLabel)) continue;

      const rowSeatsCount = tier.row_seat_overrides?.[rowLabel] ?? spr;
      const seatY = tierY + ((rIdx + 0.5) / rowCount) * tierH;

      for (let seatIdx = 0; seatIdx < rowSeatsCount; seatIdx++) {
        const seatNum = seatIdx + 1;
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
        });
      }
    }
  });

  return seats;
}

/**
 * Generate all seats across all stadium blocks
 */
export function generateAllStadiumSeats(
  blocks: StadiumBlockDefV2[],
  canvasW = 1600,
  canvasH = 1200
): GeneratedSeat[] {
  if (!Array.isArray(blocks)) return [];
  const allSeats: GeneratedSeat[] = [];
  for (const block of blocks) {
    if (block.stand_type === "standing") continue;
    const blockSeats = generateBlockSeats(block, canvasW, canvasH);
    allSeats.push(...blockSeats);
  }
  return allSeats;
}
