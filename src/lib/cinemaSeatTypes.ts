/** Cinema seating type labels used across Movie Admin + Super Admin. */

export type CinemaSeatTypeCounts = {
  regular: number;
  recliner: number;
  couple: number;
};

export const CINEMA_SEAT_TYPE_FIELDS = [
  { key: "regular" as const, label: "Regular seats", short: "Regular" },
  { key: "recliner" as const, label: "Recliner seats", short: "Recliner" },
  { key: "couple" as const, label: "Couple seats", short: "Couple" },
];

export function buildCinemaSeatTypeZones(counts: CinemaSeatTypeCounts) {
  return CINEMA_SEAT_TYPE_FIELDS.filter((f) => Number(counts[f.key]) > 0).map((f) => ({
    name: f.short,
    capacity: Math.floor(Number(counts[f.key]) || 0),
    seat_type: f.key,
  }));
}

export function seatTypesTotal(counts: CinemaSeatTypeCounts): number {
  return (
    Math.max(0, Math.floor(Number(counts.regular) || 0)) +
    Math.max(0, Math.floor(Number(counts.recliner) || 0)) +
    Math.max(0, Math.floor(Number(counts.couple) || 0))
  );
}

export const PRICE_DURATION_OPTIONS = [
  { value: "showtime", label: "This showtime only" },
  { value: "1_day", label: "1 day" },
  { value: "1_week", label: "1 week" },
  { value: "2_weeks", label: "2 weeks" },
  { value: "1_month", label: "1 month" },
] as const;

export type PriceDurationValue = (typeof PRICE_DURATION_OPTIONS)[number]["value"];
