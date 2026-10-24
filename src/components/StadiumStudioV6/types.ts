"use client";

import {
  BMSVenueArchetype,
  BMSSectionType,
  BMSSeatType,
  BMSAmenityType,
  BMSSeatMatrixItemV4,
  BMSTableDefV4,
  BMSAmenityPOIV4,
  BMSSectionDefV4,
  BMSStageGroundDefV4,
  StadiumSeatingConfigOutputV4,
} from "../StadiumStudioV4/types";
import { GeneratedSeatV4, BMSV4CapacitySummary } from "../StadiumStudioV4/SeatingGeneratorEngineV4";

export interface MasterVenueTemplate {
  id: string;
  name: string;
  city: string;
  country: string;
  archetype: BMSVenueArchetype;
  description: string;
  badge?: string;
  groundConfig: BMSStageGroundDefV4;
  sections: BMSSectionDefV4[];
  amenities: BMSAmenityPOIV4[];
  defaultBlueprintUrl?: string;
  totalCapacity: number;
  seatedCapacity: number;
  standingCapacity: number;
}

export type {
  BMSVenueArchetype,
  BMSSectionType,
  BMSSeatType,
  BMSAmenityType,
  BMSSeatMatrixItemV4,
  BMSTableDefV4,
  BMSAmenityPOIV4,
  BMSSectionDefV4,
  BMSStageGroundDefV4,
  StadiumSeatingConfigOutputV4,
  GeneratedSeatV4,
  BMSV4CapacitySummary,
};
