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

export function getDefaultPriceForTier(tierName: string): number {
  const lower = (tierName || "").toLowerCase();
  if (lower.includes("couple")) return 500;
  if (lower.includes("vip") || lower.includes("premium")) return 400;
  if (lower.includes("recliner")) return 350;
  if (lower.includes("balcony")) return 300;
  if (lower.includes("gold")) return 300;
  if (lower.includes("silver")) return 200;
  return 200;
}

export interface ScreenWithLayout {
  seat_types_json?: { regular?: number; recliner?: number; couple?: number } | null;
  layout_seats_json?: unknown[] | null;
  layout_seating_config?: Record<string, unknown> | null;
  pending_seats_json?: unknown[] | null;
}

export function extractScreenTierNames(screen?: ScreenWithLayout | null): string[] {
  if (!screen) return ["Regular"];
  const seen = new Set<string>();
  const tiers: string[] = [];

  const addTier = (name: string) => {
    const trimmed = (name || "").trim();
    if (!trimmed || /^(undefined|null|none|n\/a)$/i.test(trimmed)) return;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      tiers.push(trimmed);
    }
  };

  // 1. From layout_seats_json (seats placed in layout builder)
  const seatsList = Array.isArray(screen.layout_seats_json) && screen.layout_seats_json.length > 0
    ? screen.layout_seats_json
    : Array.isArray(screen.pending_seats_json) && screen.pending_seats_json.length > 0
      ? screen.pending_seats_json
      : [];

  if (seatsList.length > 0) {
    for (const raw of seatsList) {
      if (!raw || typeof raw !== "object") continue;
      const s = raw as Record<string, unknown>;
      const name = String(s.section_name || s.section || s.tier_name || s.tier || s.seat_type || s.category || "");
      if (name) addTier(name);
    }
  }

  // 2. From layout_seating_config (section definitions)
  if (tiers.length === 0 && screen.layout_seating_config && typeof screen.layout_seating_config === "object") {
    const cfg = screen.layout_seating_config;
    if (Array.isArray(cfg.sections)) {
      for (const sec of cfg.sections) {
        if (!sec || typeof sec !== "object") continue;
        const s = sec as Record<string, unknown>;
        const name = String(s.name || s.tier_name || s.title || s.label || "");
        if (name) addTier(name);
      }
    }
  }

  // 3. From seat_types_json counts
  if (tiers.length === 0 && screen.seat_types_json && typeof screen.seat_types_json === "object") {
    const counts = screen.seat_types_json;
    if (Number(counts.regular) > 0) addTier("Regular");
    if (Number(counts.recliner) > 0) addTier("Recliner");
    if (Number(counts.couple) > 0) addTier("Couple");
  }

  // 4. Default fallback
  if (tiers.length === 0) {
    addTier("Regular");
  }

  return tiers;
}

export function buildScreenTierPricing(
  screen?: ScreenWithLayout | null,
  previousTiers?: Array<{ tier_name: string; price: number }>
): Array<{ tier_name: string; price: number }> {
  const tierNames = extractScreenTierNames(screen);
  const prevMap = new Map<string, number>();
  if (Array.isArray(previousTiers)) {
    for (const pt of previousTiers) {
      if (pt?.tier_name) {
        prevMap.set(pt.tier_name.toLowerCase(), Number(pt.price));
      }
    }
  }

  return tierNames.map((tierName) => {
    const existing = prevMap.get(tierName.toLowerCase());
    return {
      tier_name: tierName,
      price: existing !== undefined && !isNaN(existing) && existing >= 0 ? existing : getDefaultPriceForTier(tierName),
    };
  });
}

