"use client";

export type BMSVenueArchetype = 
  | "stadium"           // Multi-stand sports arena (cricket, soccer, rugby)
  | "cinema"            // Movie multiplex with curved screen, recliners, prime, classic
  | "concert_festival"  // Live music fest with stage, VIP standing pit (GA), bleachers
  | "banquet"           // Gala awards, comedy club, cabaret with numbered dinner tables
  | "auditorium";       // Theatre, conference hall, fan-shaped amphitheater

export type BMSSectionType = 
  | "seated_grid"       // Orthogonal rows & columns with aisles
  | "curved_stand"      // Concentric curved radial rows
  | "general_admission" // Standing capacity zone (e.g. 500 max tickets)
  | "table_cluster";    // Banquet round or rectangular tables

export type BMSSeatType = 
  | "standard"
  | "vip"
  | "wheelchair"
  | "companion"
  | "couple_left"
  | "couple_right"
  | "obstructed"
  | "blocked";

export type BMSAmenityType = 
  | "gate"
  | "restroom"
  | "food_beverage"
  | "bar"
  | "sound_booth"
  | "emergency_exit"
  | "first_aid"
  | "merch_stand";

export interface BMSSeatMatrixItemV4 {
  row: string;
  col: number;
  seatNumber: string;
  type: BMSSeatType;
  ticketTypeId?: string;
  price?: number;
  customColor?: string;
  isBestseller?: boolean;
}

export interface BMSTableDefV4 {
  id: string;
  tableNumber: string;
  tableName?: string;
  shape: "round" | "rectangle";
  x: number;
  y: number;
  radius?: number;
  width?: number;
  height?: number;
  seatCount: number;
  ticketTypeId?: string;
  pricePerSeat?: number;
}

export interface BMSAmenityPOIV4 {
  id: string;
  type: BMSAmenityType;
  label: string;
  x: number;
  y: number;
  icon?: string;
  rotation?: number;
}

export interface BMSSectionDefV4 {
  id: string;
  name: string;
  code?: string;
  sectionType: BMSSectionType;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  shape?: "rectangle" | "pill" | "arc" | "polygon";
  
  // Curved Stand attributes
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  sweepAngle?: number;

  // Seated attributes
  rowStart?: string;
  rowEnd?: string;
  seatsPerRow?: number;
  ticketTypeId?: string;
  price?: number;
  rowGaps?: string[];
  aisleGaps?: number[]; // Column indices where aisle walkways occur
  seatMatrixOverrides?: Record<string, BMSSeatType>; // "A-5" -> "wheelchair"
  
  // General Admission / Standing Pit attributes
  standingCapacity?: number;
  
  // Table Cluster attributes (Banquet)
  tables?: BMSTableDefV4[];

  // Gate / Entrance routing
  gateEntrance?: string;
}

export interface BMSStageGroundDefV4 {
  type: "pitch" | "screen" | "stage" | "runway" | "podium";
  label: string;
  subType?: "football" | "cricket" | "cinema_screen" | "concert_stage" | "theatre_stage" | "banquet_stage";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  color?: string;
}

export interface StadiumSeatingConfigOutputV4 {
  layout_mode: "stadium" | "universal_bms";
  version: "v4";
  archetype: BMSVenueArchetype;
  venueName: string;
  canvasWidth: number;
  canvasHeight: number;
  groundConfig: BMSStageGroundDefV4;
  sections: BMSSectionDefV4[];
  amenities: BMSAmenityPOIV4[];
  metadata?: {
    totalCapacity: number;
    seatedCapacity: number;
    standingCapacity: number;
    estimatedGrossRevenue: number;
    lastEditedAt: string;
  };
}

export type BMSToolModeV4 = 
  | "select" 
  | "pan" 
  | "draw_section" 
  | "add_table" 
  | "add_amenity" 
  | "matrix_painter";
