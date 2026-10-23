import { BackgroundPlanDef, StadiumGroundConfigV2, StadiumElementDefV2 } from "../StadiumStudioV2/types";

export interface BMSTierDef {
  id: string;
  name: string;
  color?: string;
  ticket_type_id: string;
  row_start: string;
  row_end: string;
  seats_per_row: number;
  price?: number;
  row_seat_overrides?: Record<string, number>;
  row_gaps?: string[];
  excluded_seats?: string[];
  // BookMyShow Seat Metadata
  bestseller_seats?: string[]; // Prime view seats highlighted in orange
  accessible_seats?: string[]; // Wheelchair seats
  blocked_seats?: string[];    // Obstructed view seats (camera/pillars)
  aisle_positions?: number[];  // Aisle stair gaps (e.g. after seat 12)
  row_direction?: "ltr" | "rtl";
}

export interface BMSBlockDef {
  id: string;
  name: string;
  code?: string; // e.g. "N-LOWER", "VIP-WEST"
  color: string;
  gate_info?: string; // e.g. "Gate 3 & 4 (North Turnstile)"
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  capacity: number;
  price?: number;
  shape?: "rectangle" | "pill" | "curved" | "oval" | "arc" | "polygon";
  points?: number[]; // [x1, y1, x2, y2, ...]
  tension?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  sweepAngle?: number;
  stadiumCenterX?: number;
  stadiumCenterY?: number;
  stand_type?: "seated" | "standing";
  seating_type?: "direct" | "tiered";
  ticket_type_id?: string;
  row_start?: string;
  row_end?: string;
  seats_per_row?: number;
  row_seat_overrides?: Record<string, number>;
  row_gaps?: string[];
  excluded_seats?: string[];
  bestseller_seats?: string[];
  accessible_seats?: string[];
  blocked_seats?: string[];
  aisle_positions?: number[];
  row_direction?: "ltr" | "rtl";
  tiers: BMSTierDef[];
}

export interface StadiumSeatingConfigOutputV3 {
  layout_mode: "stadium";
  studio_version: "3.0-bms";
  canvasWidth: number;
  canvasHeight: number;
  stadium_name: string;
  venue_code?: string;
  groundConfig: StadiumGroundConfigV2;
  blocks: BMSBlockDef[];
  elements?: StadiumElementDefV2[];
  backgroundPlan?: BackgroundPlanDef;
  bms_metadata?: {
    total_gross_capacity: number;
    estimated_gross_value: number;
    gate_assignments: Record<string, string>;
  };
}

export type BMSToolMode = "select" | "draw_polygon" | "inspect_seat_grid" | "pan";
