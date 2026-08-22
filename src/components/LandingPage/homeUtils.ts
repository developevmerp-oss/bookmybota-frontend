import type { Business, PublicEvent } from "@/services/api";

export function hasCityFilter(city?: string) {
  return Boolean(city && city !== "All Cities");
}

export function eventPortrait(event: PublicEvent) {
  return event.poster_vertical_url || event.poster_horizontal_url || "";
}

export function eventLandscape(event: PublicEvent) {
  return event.poster_horizontal_url || event.poster_vertical_url || "";
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

export function eventPlaceLine(event: PublicEvent, fallbackCity?: string) {
  const venue = event.venue_name?.trim() || event.organizer_name?.trim();
  const city =
    event.city_name?.trim() ||
    (fallbackCity && fallbackCity !== "All Cities" && fallbackCity !== "Ethiopia" ? fallbackCity : "");
  if (venue && city) return `${venue}: ${city}`;
  if (venue) return venue;
  if (city) return city;
  return "";
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
