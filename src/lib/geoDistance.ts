export type GeoCoords = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;

export function parseCoords(lat: unknown, lng: unknown): GeoCoords | null {
  if (lat === undefined || lat === null || lat === '' || lng === undefined || lng === null || lng === '') {
    return null;
  }
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a < -90 || a > 90 || b < -180 || b > 180) return null;
  return { lat: a, lng: b };
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Straight-line (great-circle) distance in kilometers. */
export function haversineKm(a: GeoCoords, b: GeoCoords): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Display helper: "750 m" / "2.8 km" / "12 km". */
export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "";
  if (km < 1) {
    const meters = Math.round(km * 1000);
    return `${meters} m`;
  }
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function formatDistanceBetween(
  user: GeoCoords | null | undefined,
  placeLat: unknown,
  placeLng: unknown
): string | null {
  if (!user) return null;
  const place = parseCoords(placeLat, placeLng);
  if (!place) return null;
  const km = haversineKm(user, place);
  const label = formatDistanceKm(km);
  return label || null;
}

/** Approximate city centers for Ethiopia (and common BookMyBota markets). */
export const CITY_CENTER_COORDS: Record<string, GeoCoords> = {
  "addis ababa": { lat: 9.03, lng: 38.74 },
  hawassa: { lat: 7.0621, lng: 38.476 },
  "bahir dar": { lat: 11.5742, lng: 37.3614 },
  gondar: { lat: 12.603, lng: 37.4521 },
  mekelle: { lat: 13.4967, lng: 39.4753 },
  dire: { lat: 9.5931, lng: 41.866 },
  "dire dawa": { lat: 9.5931, lng: 41.866 },
  adama: { lat: 8.54, lng: 39.27 },
  jimma: { lat: 7.673, lng: 36.836 },
};

export function coordsForCityName(city: string | null | undefined): GeoCoords | null {
  const key = String(city || "")
    .trim()
    .toLowerCase();
  if (!key) return null;
  if (CITY_CENTER_COORDS[key]) return CITY_CENTER_COORDS[key];
  for (const [name, coords] of Object.entries(CITY_CENTER_COORDS)) {
    if (key.includes(name) || name.includes(key)) return coords;
  }
  return null;
}

export const USER_GEO_STORAGE_KEY = "bmb_user_geo_v1";

export type StoredUserGeo = {
  lat: number;
  lng: number;
  source: "gps" | "ip" | "city";
  city?: string;
  updatedAt: number;
};

export function readStoredUserGeo(): StoredUserGeo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(USER_GEO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUserGeo;
    const coords = parseCoords(parsed.lat, parsed.lng);
    if (!coords) return null;
    return { ...parsed, lat: coords.lat, lng: coords.lng };
  } catch {
    return null;
  }
}

export function writeStoredUserGeo(geo: StoredUserGeo) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(USER_GEO_STORAGE_KEY, JSON.stringify(geo));
    window.dispatchEvent(new Event("bmb_user_geo_changed"));
  } catch {
    /* ignore quota */
  }
}
