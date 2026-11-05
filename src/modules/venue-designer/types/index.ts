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
  | "shape"
  | "block";

/** Free shapes and ready-made venue elements (screen, exit, restroom ...) */
export type ShapeKind = "rect" | "ellipse" | "triangle" | "diamond" | "line" | "curve" | "icon" | "polygon";

export interface ShapePreset {
  id: string;
  name: string;
  shapeKind: ShapeKind;
  width: number;
  height: number;
  color: string;
  label: string;
}

/** How a seat is drawn: a rounded square, a wide recliner, a double couple seat, a wheelchair bay or a round seat */
export type SeatShape = "square" | "round" | "recliner" | "couple" | "wheelchair";

export const SEAT_SHAPES: Array<{ value: SeatShape; label: string; widthFactor: number }> = [
  { value: "square", label: "Standard seat", widthFactor: 1 },
  { value: "round", label: "Round seat", widthFactor: 1 },
  { value: "recliner", label: "Recliner", widthFactor: 1.6 },
  { value: "couple", label: "Couple seat", widthFactor: 2.1 },
  { value: "wheelchair", label: "Wheelchair bay", widthFactor: 1.2 },
];

export function seatWidthFactor(shape?: SeatShape): number {
  return SEAT_SHAPES.find((s) => s.value === shape)?.widthFactor ?? 1;
}

/** A named seat type with its own colour, price and drawn shape, defined once per layout */
export interface SeatType {
  id: string;
  name: string;
  color: string;
  price: number;
  shape?: SeatShape;
}

/** One row of a stand. Rows can have any label, seat count and seat type. */
export interface RowConfig {
  id: string;
  label: string;
  seatCount: number;
  seatTypeId?: string;
  /**
   * Seats in each block of the row, left to right, with an aisle between blocks.
   * [10, 20, 10] is 10 seats, an aisle, 20 seats, an aisle, 10 seats. The row's seat count is their sum.
   */
  blocks?: number[];
  /** Older layouts: seat positions (1-based) left empty for an aisle. Read as blocks. */
  gaps?: number[];
}

export type SeatCategory = "standard" | "vip" | "vvip" | "premium" | "wheelchair" | "companion" | "blocked";

/** A change to one seat: its own seat type or colour, or the seat taken out */
export interface SeatOverride {
  seatTypeId?: string;
  color?: string;
  removed?: boolean;
}

export interface UniversalSeat {
  id: string; // unique: e.g. "SEC_N-A-12"
  /** Which row and position along it this seat is, used to find it again on the canvas */
  rowId?: string;
  slotKey?: string;
  /** Room this seat has along its row (grid stands), so a wide seat in a row of narrow ones is drawn to fit */
  slotWidth?: number;
  /** Drawn size of a standard seat in canvas pixels (it follows the block's seat gap) */
  size?: number;
  removed?: boolean;
  seatTypeId?: string;
  color?: string;
  shape?: SeatShape;
  /** Drawn width relative to a standard seat (recliners and couple seats are wider) */
  widthFactor?: number;
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

  // Show the row names (A, B, C ...) at both ends of the rows, for admins and customers. On unless set to false.
  showRowLabels?: boolean;
  // Show the seat number inside each seat. On unless set to false.
  showSeatNumbers?: boolean;
  // Show the price and block name above the block, with a line under it. On unless set to false.
  showTierHeading?: boolean;
  // Where the row names go: "layout" (default) puts them in a column at the far left and right of the whole layout,
  // "block" puts them right beside this block.
  rowLabelPlacement?: "layout" | "block";
  // The text above a grid block (price and name). Leave empty for the automatic "ETB 200  NAME".
  headingText?: string;
  // Move that text: pixels right (+) / down (+) from its normal place
  headingOffsetX?: number;
  headingOffsetY?: number;
  headingAlign?: "left" | "center" | "right";
  headingFontSize?: number;
  // Free text (type "text_label"): style of the text. `label` holds the words, `textColor` the colour.
  textBold?: boolean;
  textItalic?: boolean;
  textAlign?: "left" | "center" | "right";
  // Width of an aisle between seat blocks, in seat widths (1 = one seat). Default 1.2.
  aisleWidth?: number;
  // Single-seat changes, keyed by "rowId#position" (see UniversalSeat.slotKey)
  seatOverrides?: Record<string, SeatOverride>;
  // Custom rows (labels, seat counts and seat types per row). When set, they replace rowStart/rowEnd/seatsPerRow.
  rows?: RowConfig[];
  // Default seat type for seats that do not name one
  seatTypeId?: string;
  // Stadium blocks and polygon shapes: corner points as [x1, y1, x2, y2 ...] relative to x / y
  points?: number[];
  // Stadium blocks: which stand it belongs to ("Lower stand", "Upper stand" ...) and how its rows run
  level?: string;
  blockRowMode?: "straight" | "arc";
  blockArcCenter?: [number, number];
  blockRowAngle?: number;
  blockInset?: number;
  blockStartRow?: string;
  /** Stadium blocks: drawn seat size (the seat gap and row gap stay as set) */
  seatSize?: number;
  /** Stadium blocks: space between a row's end seat and its row name */
  blockLabelGap?: number;
  /** Stadium blocks: keep the row names inside the block's border instead of beyond the seats */
  blockLabelsInside?: boolean;
  // Free shapes
  shapeKind?: ShapeKind;
  /** Icon elements only: the sign shown inside the badge (an emoji such as a no-smoking or washroom sign) */
  iconGlyph?: string;
  /** Curved shapes only: how far the middle bows up, as a share of the height (0 flat, 1 deep) */
  curveDepth?: number;
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
