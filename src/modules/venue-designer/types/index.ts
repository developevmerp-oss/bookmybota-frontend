"use client";

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
  | "barrier";

export type SeatCategory = "standard" | "vip" | "vvip" | "premium" | "wheelchair" | "companion" | "blocked";

export interface UniversalSeat {
  id: string; // unique: e.g. "SEC_N-A-12"
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
