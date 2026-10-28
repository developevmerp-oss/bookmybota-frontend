export interface BackgroundPlanDef {
  url: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  isLocked: boolean;
}

export interface StadiumTierDefV2 {
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
}

export interface StadiumBlockDefV2 {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  capacity: number;
  price?: number;
  shape?: "rectangle" | "pill" | "curved" | "oval" | "arc" | "polygon";
  // For freeform polygon blocks
  points?: number[]; // [x1, y1, x2, y2, x3, y3, ...] relative to block (x, y) or absolute
  tension?: number; // 0 for straight lines, 0.2-0.5 for curved bezier edges
  // Radial / Arc Stadium Properties
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  sweepAngle?: number;
  stadiumCenterX?: number;
  stadiumCenterY?: number;
  // Admission Type
  stand_type?: "seated" | "standing";
  seating_type?: "direct" | "tiered";
  ticket_type_id?: string;
  row_start?: string;
  row_end?: string;
  seats_per_row?: number;
  row_seat_overrides?: Record<string, number>;
  row_gaps?: string[];
  excluded_seats?: string[];
  tiers: StadiumTierDefV2[];
}

export interface StadiumElementDefV2 {
  id: string;
  name: string;
  type: "stage" | "screen" | "gate" | "dugout" | "lounge" | "amenity" | "text" | "custom";
  icon?: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  shape?: "rectangle" | "circle";
}

export interface StadiumGroundConfigV2 {
  enabled?: boolean;
  sport_type: "football" | "cricket" | "basketball" | "tennis" | "concert" | "festival_t_stage" | "custom";
  pitch_label: string;
  stage_label?: string;
  catwalk_label?: string;
  stage_color?: string;
  catwalk_width?: number;
  catwalk_length?: number;
  turf_color: string;
  track_color?: string;
  shape?: "rectangle" | "oval" | "capsule";
  corner_radius?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
}

export interface StadiumSeatingConfigOutputV2 {
  layout_mode: "stadium";
  studio_version: "2.0";
  canvasWidth: number;
  canvasHeight: number;
  stadium_name: string;
  groundConfig: StadiumGroundConfigV2;
  blocks: StadiumBlockDefV2[];
  elements?: StadiumElementDefV2[];
  backgroundPlan?: BackgroundPlanDef;
}

export type StudioToolMode = "select" | "draw_polygon" | "pan";
