"use client";

/** Where a layout is used. Standard templates are grouped by this. */
export type LayoutCategory = "event" | "stadium" | "venue" | "movie" | "ground" | "auditorium";

export const LAYOUT_CATEGORIES: Array<{ value: LayoutCategory; label: string }> = [
  { value: "event", label: "Event" },
  { value: "stadium", label: "Stadium" },
  { value: "venue", label: "Venue" },
  { value: "movie", label: "Movie / Cinema" },
  { value: "ground", label: "Ground" },
  { value: "auditorium", label: "Auditorium" },
];

export type VenueType =
  | "stadium_football"
  | "stadium_cricket"
  | "indoor_arena"
  | "theatre"
  | "cinema"
  | "auditorium"
  | "concert_hall"
  | "wedding_hall"
  | "conference_hall"
  | "exhibition_hall"
  | "restaurant"
  | "standing_only"
  | "custom";

export type ObjectType =
  | "curved_stand"
  | "grid_stand"
  | "general_admission"
  | "table_round"
  | "table_rect"
  | "stage"
  | "sports_court"
  | "gate"
  | "aisle"
  | "text_label"
  | "barrier"
  | "shape";

/** Free shapes and ready-made venue elements (screen, exit, restroom ...) */
export type ShapeKind = "rect" | "ellipse" | "triangle" | "diamond" | "line";

export interface ShapePreset {
  id: string;
  name: string;
  shapeKind: ShapeKind;
  width: number;
  height: number;
  color: string;
  label: string;
}

/** A named seat type with its own colour and price, defined once per layout */
export interface SeatType {
  id: string;
  name: string;
  color: string;
  price: number;
}

/** One row of a stand. Rows can have any label, seat count and seat type. */
export interface RowConfig {
  id: string;
  label: string;
  seatCount: number;
  seatTypeId?: string;
  /** Seat positions (1-based) where an aisle gap is left in this row */
  gaps?: number[];
}

export type SeatCategory = "standard" | "vip" | "vvip" | "premium" | "wheelchair" | "companion" | "blocked";

export interface UniversalSeat {
  id: string; // unique: e.g. "SEC_N-A-12"
  seatTypeId?: string;
  color?: string;
  sectionId: string;
  rowLabel: string;
  seatNumber: string;
  x: number;
  y: number;
  category: SeatCategory;
  price: number;
  status?: "AVAILABLE" | "HELD" | "BOOKED" | "BLOCKED";
  isAccessible?: boolean;
}

export interface UniversalTableSeat {
  id: string;
  tableId: string;
  seatNumber: number;
  angle: number;
  x: number;
  y: number;
  category: SeatCategory;
  price: number;
}

export interface UniversalVenueObject {
  id: string;
  name: string;
  type: ObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  strokeColor?: string;
  opacity?: number;
  zIndex?: number;

  // Curved stand parameters (Annular wedge)
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  sweepAngle?: number;

  // Custom rows (labels, seat counts and seat types per row). When set, they replace rowStart/rowEnd/seatsPerRow.
  rows?: RowConfig[];
  // Default seat type for seats that do not name one
  seatTypeId?: string;
  // Free shapes
  shapeKind?: ShapeKind;
  cornerRadius?: number;
  strokeWidth?: number;
  textColor?: string;
  // Grid / Stand row parameters
  rowStart?: string;
  rowEnd?: string;
  seatsPerRow?: number;
  seatSpacing?: number;
  rowSpacing?: number;
  aisleGaps?: number[]; // indices of aisle gaps

  // Table parameters
  tableShape?: "round" | "rectangle";
  tableSeatCount?: number;
  seats?: UniversalTableSeat[];

  // General Admission / Standing
  standingCapacity?: number;

  // Gate / Exit
  gateNumber?: string;
  gateType?: "entry" | "exit" | "emergency";

  // Label text
  label?: string;
  fontSize?: number;

  // Pricing & Category
  defaultCategory?: SeatCategory;
  price?: number;
}

export interface UniversalVenueLayout {
  id: string;
  venueId?: string;
  name: string;
  venueType: VenueType;
  category?: LayoutCategory;
  seatTypes?: SeatType[];
  description?: string;
  version: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  canvasWidth: number;
  canvasHeight: number;
  gridSnap: boolean;
  gridSize: number;
  blueprintUrl?: string | null;
  blueprintOpacity?: number;
  objects: UniversalVenueObject[];
  metadata: {
    totalCapacity: number;
    seatedCapacity: number;
    standingCapacity: number;
    totalTables: number;
    totalGates: number;
    estimatedRevenue: number;
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
  };
}

export interface LayoutHistorySnapshot {
  objects: UniversalVenueObject[];
  canvasWidth: number;
  canvasHeight: number;
}

/** A saved standard layout that can be reused to start a new layout */
export interface LayoutStandardTemplate {
  id: string;
  name: string;
  description?: string | null;
  category: LayoutCategory;
  canvas_width: number;
  canvas_height: number;
  objects_json: UniversalVenueObject[];
  seat_types_json: SeatType[];
  capacity: number;
  is_shared: boolean;
  is_owner: boolean;
  created_at?: string;
  updated_at?: string;
}
