import type { PublicMovieCinemaGroup, PublicMovieShowtimeItem } from "@/services/api";
import { isVenueWallTimeReached, venueDateStr } from "@/lib/dateFormat";

/** Match a showtimes API cinema row to route id, resolved UUID, or slug. */
export function cinemaGroupMatchesTarget(
  cinema: PublicMovieCinemaGroup,
  target: { id?: string | null; slug?: string | null; routeKey?: string | null }
): boolean {
  const keys = new Set(
    [target.id, target.slug, target.routeKey]
      .map((k) => (k == null ? "" : String(k).trim().toLowerCase()))
      .filter(Boolean)
  );
  if (!keys.size) return false;
  const id = (cinema.id || "").trim().toLowerCase();
  const slug = (cinema.slug || "").trim().toLowerCase();
  return keys.has(id) || Boolean(slug && keys.has(slug));
}

export type ShowtimeSortKey = "relevance" | "popularity" | "name";

export type AmenityFilterKey = "m_ticket" | "has_fnb";

export const PRICE_BAND_VALUES = [
  "0-200",
  "201-300",
  "301-400",
  "401-500",
  "501-600",
  "601-700",
  "701-800",
  "801+",
] as const;

export const PRICE_BAND_LABELS: Record<(typeof PRICE_BAND_VALUES)[number], string> = {
  "0-200": "ETB 0-200",
  "201-300": "ETB 201-300",
  "301-400": "ETB 301-400",
  "401-500": "ETB 401-500",
  "501-600": "ETB 501-600",
  "601-700": "ETB 601-700",
  "701-800": "ETB 701-800",
  "801+": "ETB 801+",
};

export type PreferredTimeBand = "morning" | "afternoon" | "evening" | "night";

/** Exclusive end hour for each preferred-time band (venue / Ethiopia clock). */
export const PREFERRED_TIME_END_HOUR: Record<PreferredTimeBand, number> = {
  morning: 12,
  afternoon: 16,
  evening: 19,
  night: 24,
};

export const PREFERRED_TIME_HINTS: Record<PreferredTimeBand, string> = {
  morning: "12:00 AM - 11:59 AM",
  afternoon: "12:00 PM - 3:59 PM",
  evening: "4:00 PM - 6:59 PM",
  night: "7:00 PM - 11:59 PM",
};

export function normalizeFilterKey(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

/** Case-insensitive membership for multi-select language/format filters. */
export function matchesAnyNormalized(
  value: string | null | undefined,
  selected: string[]
): boolean {
  if (!selected.length) return true;
  const key = normalizeFilterKey(value);
  if (!key) return false;
  return selected.some((s) => normalizeFilterKey(s) === key);
}

export function showtimeFormatLabel(st: {
  format?: string | null;
  screen_type?: string | null;
}): string {
  return ((st.format || st.screen_type || "") as string).trim();
}

export function showtimePrice(st: {
  min_price?: number | null;
  tier_pricing?: Array<{ price?: number | null }> | null;
}): number | null {
  if (st.min_price != null && Number.isFinite(Number(st.min_price))) {
    return Number(st.min_price);
  }
  const first = st.tier_pricing?.[0]?.price;
  if (first != null && Number.isFinite(Number(first))) return Number(first);
  return null;
}

export function priceInBands(price: number, bands: string[]): boolean {
  if (bands.length === 0) return true;
  return bands.some((band) => {
    if (band === "801+") return price >= 801;
    const [minStr, maxStr] = band.split("-");
    return price >= Number(minStr) && price <= Number(maxStr);
  });
}

export function parseShowHour(iso: string): number {
  if (!iso) return 0;
  const str = String(iso).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (match) return parseInt(match[4], 10);
  const dateObj = new Date(iso);
  return isNaN(dateObj.getTime()) ? 0 : dateObj.getHours();
}

export function matchesPreferredTime(iso: string, bands: string[]): boolean {
  if (bands.length === 0) return true;
  const h = parseShowHour(iso);
  return bands.some((band) => {
    if (band === "morning") return h >= 0 && h < 12;
    if (band === "afternoon") return h >= 12 && h < 16;
    if (band === "evening") return h >= 16 && h < 19;
    if (band === "night") return h >= 19 && h <= 23;
    return true;
  });
}

/** True when this band is fully in the past for the selected calendar day. */
export function isPreferredTimeBandPast(
  band: string,
  selectedDate: string,
  now = new Date()
): boolean {
  const today = venueDateStr(now);
  if (!today) return false;
  if (selectedDate > today) return false;
  if (selectedDate < today) return true;
  const endHour = PREFERRED_TIME_END_HOUR[band as PreferredTimeBand];
  if (endHour == null) return false;
  if (endHour >= 24) return false;
  return isVenueWallTimeReached(
    `${selectedDate}T${String(endHour).padStart(2, "0")}:00:00`,
    now
  );
}

export function cinemaMatchesAmenities(
  cinema: { m_ticket?: boolean; has_fnb?: boolean },
  amenities: string[]
): boolean {
  if (!amenities.length) return true;
  return amenities.every((key) => {
    if (key === "m_ticket") return cinema.m_ticket !== false;
    if (key === "has_fnb") return Boolean(cinema.has_fnb);
    return true;
  });
}

export type ShowtimeFilterState = {
  languages: string[];
  formats: string[];
  prices: string[];
  times: string[];
  amenities?: string[];
  search?: string;
  sortBy?: ShowtimeSortKey | "distance";
};

function filterShowtimesList(
  showtimes: PublicMovieShowtimeItem[],
  filters: ShowtimeFilterState
): PublicMovieShowtimeItem[] {
  let list = showtimes;
  if (filters.languages.length) {
    list = list.filter((st) => matchesAnyNormalized(st.language, filters.languages));
  }
  if (filters.formats.length) {
    list = list.filter((st) =>
      matchesAnyNormalized(showtimeFormatLabel(st), filters.formats)
    );
  }
  if (filters.prices.length) {
    list = list.filter((st) => {
      const price = showtimePrice(st);
      return price != null && priceInBands(price, filters.prices);
    });
  }
  if (filters.times.length) {
    list = list.filter((st) => matchesPreferredTime(st.starts_at, filters.times));
  }
  return list;
}

/** Filter + sort cinema groups (movie showtimes page). */
export function applyCinemaShowtimeFilters(
  cinemas: PublicMovieCinemaGroup[],
  filters: ShowtimeFilterState
): PublicMovieCinemaGroup[] {
  const q = (filters.search || "").trim().toLowerCase();
  let rows = cinemas
    .filter((cinema) => cinemaMatchesAmenities(cinema, filters.amenities || []))
    .map((cinema) => ({
      ...cinema,
      showtimes: filterShowtimesList(cinema.showtimes, filters),
    }))
    .filter((cinema) => cinema.showtimes.length > 0);

  if (q) {
    rows = rows.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || (c.address || "").toLowerCase().includes(q)
    );
  }

  const sortBy = filters.sortBy || "relevance";
  if (sortBy === "popularity") {
    rows = [...rows].sort((a, b) => b.showtimes.length - a.showtimes.length);
  } else if (sortBy === "distance" || sortBy === "name") {
    rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  }

  return rows;
}

/** Filter showtimes within a cinema-detail movie row. */
export function applyShowtimeItemFilters(
  showtimes: PublicMovieShowtimeItem[],
  filters: Omit<ShowtimeFilterState, "amenities" | "search" | "sortBy">
): PublicMovieShowtimeItem[] {
  return filterShowtimesList(showtimes, {
    ...filters,
    amenities: [],
    search: "",
    sortBy: "relevance",
  });
}

export type LanguageFormatPairGroup = {
  language: string;
  formats: string[];
};

function sortFormats(formats: string[]): string[] {
  const rank = (fmt: string) => {
    const u = fmt.toUpperCase();
    if (u === "2D") return 0;
    if (u.includes("IMAX") && u.includes("3D")) return 4;
    if (u.includes("IMAX")) return 2;
    if (u.includes("3D")) return 3;
    if (u.includes("4DX")) return 5;
    return 10;
  };
  return [...formats].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** Distinct language → formats from live showtimes (only combos that exist). */
export function languageFormatGroupsFromCinemas(
  cinemas: PublicMovieCinemaGroup[] | undefined | null
): LanguageFormatPairGroup[] {
  if (!cinemas?.length) return [];

  const byLanguage = new Map<string, { label: string; formats: Map<string, string> }>();

  for (const cinema of cinemas) {
    for (const st of cinema.showtimes) {
      const language = (st.language || "").trim();
      const format = showtimeFormatLabel(st);
      if (!language || !format) continue;

      const langKey = normalizeFilterKey(language);
      let row = byLanguage.get(langKey);
      if (!row) {
        row = { label: language, formats: new Map() };
        byLanguage.set(langKey, row);
      }
      const fmtKey = normalizeFilterKey(format);
      if (!row.formats.has(fmtKey)) row.formats.set(fmtKey, format);
    }
  }

  const groups: LanguageFormatPairGroup[] = [];
  for (const row of byLanguage.values()) {
    const formats = sortFormats(Array.from(row.formats.values()));
    if (formats.length) groups.push({ language: row.label, formats });
  }

  groups.sort((a, b) => a.language.localeCompare(b.language));
  return groups;
}
