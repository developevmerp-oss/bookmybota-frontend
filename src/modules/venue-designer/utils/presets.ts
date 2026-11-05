"use client";

import { LayoutCategory, SeatType, ShapePreset, VenueType } from "../types";

/** Starting seat types for every new layout. Users can rename, recolour, reprice, add and remove them. */
export const DEFAULT_SEAT_TYPES: SeatType[] = [
  { id: "st_regular", name: "Regular", color: "#16a34a", price: 200, shape: "square" },
  { id: "st_premium", name: "Premium", color: "#2563eb", price: 400, shape: "square" },
  { id: "st_vip", name: "VIP", color: "#d97706", price: 800, shape: "round" },
  { id: "st_recliner", name: "Recliner", color: "#db2777", price: 600, shape: "recliner" },
  { id: "st_couple", name: "Couple", color: "#dc2626", price: 500, shape: "couple" },
  { id: "st_wheelchair", name: "Wheelchair", color: "#0d9488", price: 200, shape: "wheelchair" },
];

/** Basic shapes the user can draw */
export const BASIC_SHAPES: ShapePreset[] = [
  { id: "shape_rect", name: "Rectangle", shapeKind: "rect", width: 160, height: 90, color: "#475569", label: "" },
  { id: "shape_ellipse", name: "Circle / Oval", shapeKind: "ellipse", width: 140, height: 140, color: "#0ea5e9", label: "" },
  { id: "shape_triangle", name: "Triangle", shapeKind: "triangle", width: 140, height: 120, color: "#f97316", label: "" },
  { id: "shape_diamond", name: "Diamond", shapeKind: "diamond", width: 120, height: 120, color: "#a855f7", label: "" },
  { id: "shape_line", name: "Line / Wall", shapeKind: "line", width: 240, height: 6, color: "#94a3b8", label: "" },
  { id: "shape_curve", name: "Curve / Arc", shapeKind: "curve", width: 300, height: 80, color: "#475569", label: "" },
];

/** Ready-made venue elements. They are shapes with a name, colour and label already set. */
export const ELEMENT_PRESETS: ShapePreset[] = [
  { id: "el_screen_curved", name: "Curved Screen", shapeKind: "curve", width: 620, height: 70, color: "#64748b", label: "All eyes this way please" },
  { id: "el_screen", name: "Flat Screen", shapeKind: "rect", width: 520, height: 18, color: "#94a3b8", label: "SCREEN" },
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

export interface IconPreset {
  id: string;
  name: string;
  glyph: string;
  color: string;
}

/** Signs and symbols users drop onto a layout: washrooms, exits, no smoking, parking ... */
export const ICON_PRESETS: IconPreset[] = [
  { id: "ic_nosmoking", name: "No smoking", glyph: "🚭", color: "#dc2626" },
  { id: "ic_washroom", name: "Washroom", glyph: "🚻", color: "#0891b2" },
  { id: "ic_men", name: "Men", glyph: "🚹", color: "#2563eb" },
  { id: "ic_women", name: "Women", glyph: "🚺", color: "#db2777" },
  { id: "ic_wheelchair", name: "Wheelchair access", glyph: "♿", color: "#2563eb" },
  { id: "ic_exit", name: "Exit", glyph: "🚪", color: "#16a34a" },
  { id: "ic_emergency", name: "Emergency exit", glyph: "🏃", color: "#16a34a" },
  { id: "ic_fire", name: "Fire extinguisher", glyph: "🧯", color: "#dc2626" },
  { id: "ic_firstaid", name: "First aid", glyph: "⛑️", color: "#dc2626" },
  { id: "ic_alarm", name: "Alarm", glyph: "🚨", color: "#dc2626" },
  { id: "ic_lift", name: "Lift", glyph: "🛗", color: "#475569" },
  { id: "ic_stairs", name: "Stairs", glyph: "🪜", color: "#475569" },
  { id: "ic_parking", name: "Parking", glyph: "🅿️", color: "#2563eb" },
  { id: "ic_food", name: "Food", glyph: "🍔", color: "#ea580c" },
  { id: "ic_drinks", name: "Drinks", glyph: "🥤", color: "#ea580c" },
  { id: "ic_coffee", name: "Coffee", glyph: "☕", color: "#92400e" },
  { id: "ic_water", name: "Drinking water", glyph: "🚰", color: "#0ea5e9" },
  { id: "ic_ticket", name: "Ticket counter", glyph: "🎟️", color: "#7c3aed" },
  { id: "ic_info", name: "Information", glyph: "ℹ️", color: "#2563eb" },
  { id: "ic_atm", name: "ATM", glyph: "🏧", color: "#0f766e" },
  { id: "ic_baby", name: "Baby care", glyph: "🚼", color: "#db2777" },
  { id: "ic_nophone", name: "No phones", glyph: "📵", color: "#dc2626" },
  { id: "ic_noentry", name: "No entry", glyph: "⛔", color: "#dc2626" },
  { id: "ic_security", name: "Security", glyph: "🛡️", color: "#334155" },
  { id: "ic_camera", name: "Camera", glyph: "📷", color: "#334155" },
  { id: "ic_speaker", name: "Speaker", glyph: "🔊", color: "#334155" },
  { id: "ic_projector", name: "Projector", glyph: "📽️", color: "#334155" },
  { id: "ic_mic", name: "Stage mic", glyph: "🎤", color: "#7c3aed" },
  { id: "ic_ac", name: "Air conditioning", glyph: "❄️", color: "#0ea5e9" },
  { id: "ic_smoking", name: "Smoking area", glyph: "🚬", color: "#92400e" },
  { id: "ic_litter", name: "Dustbin", glyph: "🚮", color: "#16a34a" },
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
export const SHAPE_DEFAULT_TEXT = "#0f172a";

export function newSeatTypeId(): string {
  seatTypeCounter += 1;
  return `st_${Date.now().toString(36)}_${seatTypeCounter}`;
}
