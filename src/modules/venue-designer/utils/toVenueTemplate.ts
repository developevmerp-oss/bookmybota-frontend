import { SeatType, UniversalVenueLayout, UniversalVenueObject } from "../types";
import { generateSeatsForObject } from "./geometryEngine";
import { rotatePoints } from "./blockGeometry";

/**
 * Turns what was drawn in the Universal Venue Designer into the seat list and picture settings that the
 * venue / cinema layout flow stores and that the booking pages read. Rows, blocks, curved stands and tables
 * become seats; stages, grounds, gates, shapes and text become the shapes and labels around them.
 */

export interface VenueTemplatePayload {
  seating_config: {
    canvasWidth: number;
    canvasHeight: number;
    labels: unknown[];
    shapes: unknown[];
    bgImageUrl?: string | null;
    /** The designer's own copy, so the layout can be opened and edited again as drawn */
    universal_layout: UniversalVenueLayout;
  };
  seats: Array<Record<string, unknown>>;
}

const SEAT_BEARING: UniversalVenueObject["type"][] = ["curved_stand", "grid_stand", "block", "table_round", "table_rect"];

function seatTypeName(seatTypes: SeatType[], id: string | undefined, fallback: string): string {
  const t = id ? seatTypes.find((s) => s.id === id) : undefined;
  return t?.name || fallback;
}

export function layoutToVenueTemplate(layout: UniversalVenueLayout): VenueTemplatePayload {
  const seatTypes = layout.seatTypes || [];
  const seats: Array<Record<string, unknown>> = [];
  const seenIds = new Set<string>();

  for (const obj of layout.objects) {
    if (!SEAT_BEARING.includes(obj.type)) continue;
    const list = generateSeatsForObject(obj, seatTypes);
    list.forEach((seat, i) => {
      let id = String(seat.id || `${obj.id}-${i}`);
      while (seenIds.has(id)) id = `${id}~`;
      seenIds.add(id);
      seats.push({
        id,
        internalId: id,
        ticket_type_id: null,
        section_name: seatTypeName(seatTypes, seat.seatTypeId, obj.name),
        row_label: seat.rowLabel || "A",
        seat_label: seat.seatNumber || String(i + 1),
        coordinate_x: Math.round(seat.x),
        coordinate_y: Math.round(seat.y),
        status: seat.status && seat.status !== "AVAILABLE" ? seat.status : "AVAILABLE",
        grid_id: obj.id,
        color: seat.color || obj.color || null,
      });
    });
  }

  const shapes: unknown[] = [];
  const labels: unknown[] = [];
  for (const obj of layout.objects) {
    if (SEAT_BEARING.includes(obj.type)) continue;
    const w = Math.max(1, obj.width || 0);
    const h = Math.max(1, obj.height || 0);
    if (obj.type === "text_label") {
      labels.push({ x: obj.x - w / 2, y: obj.y - h / 2, text: obj.label || obj.name, fontSize: obj.fontSize || 16, rotation: obj.rotation || 0 });
      continue;
    }
    if (obj.type === "shape" && obj.shapeKind === "icon") {
      labels.push({ x: obj.x - w / 2, y: obj.y - h / 2, text: obj.iconGlyph || obj.label || "", fontSize: Math.max(14, h * 0.6), rotation: 0 });
      continue;
    }
    const polygon = obj.type === "shape" && obj.shapeKind === "polygon" && obj.points && obj.points.length >= 6;
    if (polygon) {
      const pts = rotatePoints(obj.points as number[], obj.rotation || 0).map((v, i) => Math.round(i % 2 === 0 ? v + obj.x : v + obj.y));
      const xs = pts.filter((_, i) => i % 2 === 0);
      const ys = pts.filter((_, i) => i % 2 === 1);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      shapes.push({
        type: "polygon",
        points: pts,
        x,
        y,
        width: Math.max(...xs) - x,
        height: Math.max(...ys) - y,
        fill: obj.color,
        opacity: obj.opacity ?? 0.95,
        text: obj.label || "",
      });
      continue;
    }
    const kind =
      obj.type === "stage" || obj.type === "sports_court"
        ? "stage"
        : obj.type === "general_admission" || obj.type === "gate"
          ? "zone"
          : obj.shapeKind === "ellipse"
            ? "ellipse"
            : obj.shapeKind === "triangle"
              ? "triangle"
              : obj.shapeKind === "diamond"
                ? "diamond"
                : "rect";
    shapes.push({
      type: kind,
      x: Math.round(obj.x - w / 2),
      y: Math.round(obj.y - h / 2),
      width: Math.round(w),
      height: Math.round(h),
      rotation: obj.rotation || 0,
      fill: obj.color,
      opacity: obj.opacity ?? 0.95,
      cornerRadius: obj.cornerRadius,
      text: obj.type === "shape" ? obj.label || "" : obj.name || obj.label || "",
    });
  }

  return {
    seating_config: {
      canvasWidth: layout.canvasWidth || 1600,
      canvasHeight: layout.canvasHeight || 1200,
      labels,
      shapes,
      bgImageUrl: layout.blueprintUrl || null,
      universal_layout: layout,
    },
    seats,
  };
}

/** Seats per section name, to compare with the seating types the partner asked for */
export function seatCountsBySection(seats: Array<Record<string, unknown>>): Record<string, number> {
  const out: Record<string, number> = {};
  seats.forEach((s) => {
    const k = String(s.section_name || "General");
    out[k] = (out[k] || 0) + 1;
  });
  return out;
}
