/** Every kind of screen a cinema can have. One list, used by the cinema panel and the Super Admin layout flow. */
export const CINEMA_SCREEN_TYPES = [
  { value: "standard", label: "Standard" },
  { value: "2d", label: "2D" },
  { value: "3d", label: "3D" },
  { value: "imax", label: "IMAX" },
  { value: "4dx", label: "4DX" },
  { value: "screenx", label: "ScreenX" },
  { value: "dolby_atmos", label: "Dolby Atmos" },
  { value: "dolby_cinema", label: "Dolby Cinema" },
  { value: "dbox", label: "D-BOX" },
  { value: "premium", label: "Premium / Large format" },
  { value: "luxury", label: "Luxury / Recliner lounge" },
  { value: "gold", label: "Gold class / VIP" },
  { value: "kids", label: "Kids" },
  { value: "private", label: "Private / Couple screen" },
  { value: "outdoor", label: "Outdoor / Open air" },
  { value: "drive_in", label: "Drive-in" },
  { value: "other", label: "Other" },
] as const;

export const CINEMA_SCREEN_TYPE_VALUES: string[] = CINEMA_SCREEN_TYPES.map((t) => t.value);
