import type { Business, PublicEvent } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";

export function hasCityFilter(city?: string) {
  return Boolean(city && city !== "All Cities");
}

export function eventPortrait(event: PublicEvent) {
  return resolveMediaUrl(event.poster_vertical_url || event.poster_horizontal_url || "");
}

export function eventLandscape(event: PublicEvent) {
  return resolveMediaUrl(event.poster_horizontal_url || event.poster_vertical_url || "");
}

export function formatShowDateBar(iso?: string) {
  return formatEventDateLine(iso);
}

/** Reference card date: "Sat, 10 Oct onwards" */
export function formatEventDateLine(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const weekday = d.toLocaleString("en-GB", { weekday: "short" });
  const day = d.getDate();
  const month = d.toLocaleString("en-GB", { month: "short" });
  return `${weekday}, ${day} ${month} onwards`;
}

/** Parts for the small date badge on poster images. */
export function eventDateParts(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    day: String(d.getDate()).padStart(2, "0"),
    month: d.toLocaleString("en-GB", { month: "short" }).toUpperCase(),
    weekday: d.toLocaleString("en-GB", { weekday: "short" }),
  };
}

/** Location line for cards: venue (+ city). Never organizer. */
export function eventPlaceLine(event: PublicEvent, fallbackCity?: string) {
  const venue = event.venue_name?.trim() || "";
  const city =
    event.city_name?.trim() ||
    (fallbackCity && fallbackCity !== "All Cities" && fallbackCity !== "Ethiopia"
      ? fallbackCity.trim()
      : "");
  if (venue && city && venue.toLowerCase() !== city.toLowerCase()) {
    return `${venue}: ${city}`;
  }
  if (venue) return venue;
  if (city) return city;
  return "";
}

/** Pick next showtime venue/city from a full public event detail payload. */
export function venueFromEventDetail(
  detail?: {
    showtimes?: Array<{
      starts_at: string;
      ends_at?: string;
      venue_name?: string | null;
      venue_business_name?: string | null;
      city_name?: string | null;
    }>;
  } | null
) {
  const shows = detail?.showtimes ?? [];
  if (!shows.length) return { venue_name: "", city_name: "" };
  const now = Date.now();
  const sorted = [...shows].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );
  const next =
    sorted.find((s) => new Date(s.ends_at || s.starts_at).getTime() >= now) || sorted[0];
  return {
    venue_name: (next.venue_name || next.venue_business_name || "").trim(),
    city_name: (next.city_name || "").trim(),
  };
}

export function isMusicEvent(event: PublicEvent) {
  const blob = `${event.category_slug || ""} ${event.category_name || ""} ${event.name || ""}`.toLowerCase();
  return blob.includes("music") || blob.includes("concert");
}

export function isComedyEvent(event: PublicEvent) {
  const blob = `${event.category_slug || ""} ${event.category_name || ""} ${event.name || ""}`.toLowerCase();
  return blob.includes("comedy") || blob.includes("stand") || blob.includes("laughter");
}

export function isOutdoorEvent(event: PublicEvent) {
  const blob = `${event.category_slug || ""} ${event.category_name || ""}`.toLowerCase();
  return (
    blob.includes("outdoor") ||
    blob.includes("open-air") ||
    blob.includes("open air") ||
    blob.includes("openair")
  );
}

export function isSportsEvent(event: PublicEvent) {
  const blob = `${event.category_slug || ""} ${event.category_name || ""} ${event.name || ""}`.toLowerCase();
  return blob.includes("sport") || blob.includes("football") || blob.includes("basketball") || blob.includes("wrestling");
}

export function formatShowDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function localityFromAddress(address?: string) {
  if (!address) return "";
  return address.split(",")[0]?.trim() || address;
}

export function matchesCity(text: string | undefined, city: string) {
  if (!hasCityFilter(city)) return true;
  return (text || "").toLowerCase().includes(city.toLowerCase());
}

export function diningInCity(places: Business[], city: string) {
  if (!hasCityFilter(city)) return places;
  return places.filter(
    (p) =>
      matchesCity(p.city_name || undefined, city) ||
      matchesCity(p.address, city)
  );
}

export function eventsWithImage(events: PublicEvent[]) {
  return events.filter((e) => eventLandscape(e) || eventPortrait(e));
}

export function uniqueStrings(values: Array<string | undefined>, limit = 12) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = (raw || "").trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}
