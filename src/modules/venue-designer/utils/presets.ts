"use client";

import { LayoutCategory, SeatType, ShapePreset, VenueType } from "../types";

/** Starting seat types for every new layout. Users can rename, recolour, reprice, add and remove them. */
export const DEFAULT_SEAT_TYPES: SeatType[] = [
  { id: "st_regular", name: "Regular", color: "#3b82f6", price: 200 },
  { id: "st_premium", name: "Premium", color: "#8b5cf6", price: 400 },
  { id: "st_vip", name: "VIP", color: "#f59e0b", price: 800 },
  { id: "st_recliner", name: "Recliner", color: "#ec4899", price: 600 },
  { id: "st_couple", name: "Couple", color: "#ef4444", price: 500 },
  { id: "st_wheelchair", name: "Wheelchair", color: "#14b8a6", price: 200 },
];

/** Basic shapes the user can draw */
export const BASIC_SHAPES: ShapePreset[] = [
  { id: "shape_rect", name: "Rectangle", shapeKind: "rect", width: 160, height: 90, color: "#475569", label: "" },
  { id: "shape_ellipse", name: "Circle / Oval", shapeKind: "ellipse", width: 140, height: 140, color: "#0ea5e9", label: "" },
  { id: "shape_triangle", name: "Triangle", shapeKind: "triangle", width: 140, height: 120, color: "#f97316", label: "" },
  { id: "shape_diamond", name: "Diamond", shapeKind: "diamond", width: 120, height: 120, color: "#a855f7", label: "" },
  { id: "shape_line", name: "Line / Wall", shapeKind: "line", width: 240, height: 6, color: "#e2e8f0", label: "" },
];

/** Ready-made venue elements. They are shapes with a name, colour and label already set. */
export const ELEMENT_PRESETS: ShapePreset[] = [
  { id: "el_screen", name: "Cinema Screen", shapeKind: "rect", width: 520, height: 26, color: "#e2e8f0", label: "SCREEN" },
  { id: "el_exit", name: "Exit", shapeKind: "rect", width: 90, height: 34, color: "#16a34a", label: "EXIT" },
  { id: "el_entrance", name: "Entrance", shapeKind: "rect", width: 110, height: 34, color: "#2563eb", label: "ENTRANCE" },
  { id: "el_restroom", name: "Restroom", shapeKind: "rect", width: 90, height: 60, color: "#0891b2", label: "WC" },
  { id: "el_food", name: "Food Counter", shapeKind: "rect", width: 140, height: 50, color: "#ea580c", label: "FOOD" },
  { id: "el_bar", name: "Bar", shapeKind: "rect", width: 180, height: 44, color: "#7c2d12", label: "BAR" },
  { id: "el_pillar", name: "Pillar", shapeKind: "ellipse", width: 36, height: 36, color: "#64748b", label: "" },
  { id: "el_dance", name: "Dance Floor", shapeKind: "rect", width: 260, height: 180, color: "#be185d", label: "DANCE FLOOR" },
  { id: "el_runway", name: "Runway", shapeKind: "rect", width: 70, height: 280, color: "#d946ef", label: "RUNWAY" },
  { id: "el_pitch", name: "Pitch Circle", shapeKind: "ellipse", width: 120, height: 120, color: "#15803d", label: "" },
  { id: "el_booth", name: "Control Booth", shapeKind: "rect", width: 110, height: 60, color: "#334155", label: "SOUND" },
];

/** Layout category for each venue type, used to group saved templates */
export function categoryForVenueType(venueType: VenueType): LayoutCategory {
  switch (venueType) {
    case "stadium_football":
    case "stadium_cricket":
      return "stadium";
    case "cinema":
      return "movie";
    case "auditorium":
    case "theatre":
    case "concert_hall":
      return "auditorium";
    case "indoor_arena":
      return "ground";
    case "wedding_hall":
    case "conference_hall":
    case "exhibition_hall":
    case "restaurant":
    case "standing_only":
      return "event";
    default:
      return "venue";
  }
}

/** A sensible venue type for a category when the user picks the category by hand */
export function venueTypeForCategory(category: LayoutCategory): VenueType {
  switch (category) {
    case "stadium":
      return "stadium_football";
    case "movie":
      return "cinema";
    case "auditorium":
      return "auditorium";
    case "ground":
      return "indoor_arena";
    case "event":
      return "wedding_hall";
    default:
      return "custom";
  }
}

let seatTypeCounter = 0;
export function newSeatTypeId(): string {
  seatTypeCounter += 1;
  return `st_${Date.now().toString(36)}_${seatTypeCounter}`;
}
