"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  coordsForCityName,
  parseCoords,
  readStoredUserGeo,
  writeStoredUserGeo,
  type GeoCoords,
  type StoredUserGeo,
} from "@/lib/geoDistance";

export type UserGeoStatus = "idle" | "loading" | "ready" | "denied";

export type UseUserGeoResult = {
  coords: GeoCoords | null;
  status: UserGeoStatus;
  source: StoredUserGeo["source"] | null;
  refresh: (opts?: { forceGps?: boolean }) => Promise<void>;
};

async function fetchIpCoords(): Promise<{ coords: GeoCoords; city?: string } | null> {
  try {
    const res = await fetch("https://ipapi.co/json/", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      latitude?: number;
      longitude?: number;
      city?: string;
    };
    const coords = parseCoords(data.latitude, data.longitude);
    if (!coords) return null;
    return { coords, city: data.city };
  } catch {
    return null;
  }
}

function readDevicePosition(): Promise<GeoCoords | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(parseCoords(pos.coords.latitude, pos.coords.longitude)),
      () => resolve(null),
      { timeout: 8000, maximumAge: 1000 * 60 * 5, enableHighAccuracy: false }
    );
  });
}

/**
 * User location for dining distance.
 * - With selectedCity → city center (updates when city changes)
 * - Without city → GPS, then IP (current location)
 */
export function useUserGeo(options?: {
  selectedCity?: string | null;
  autoDetect?: boolean;
}): UseUserGeoResult {
  const selectedCity = options?.selectedCity?.trim() || null;
  const autoDetect = options?.autoDetect ?? true;

  const [coords, setCoords] = useState<GeoCoords | null>(null);
  const [status, setStatus] = useState<UserGeoStatus>("idle");
  const [source, setSource] = useState<StoredUserGeo["source"] | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const apply = useCallback((next: GeoCoords, src: StoredUserGeo["source"], city?: string) => {
    if (!mounted.current) return;
    const payload: StoredUserGeo = {
      ...next,
      source: src,
      city,
      updatedAt: Date.now(),
    };
    writeStoredUserGeo(payload);
    setCoords(next);
    setSource(src);
    setStatus("ready");
  }, []);

  const detectCurrentLocation = useCallback(async () => {
    if (!mounted.current) return;
    setStatus("loading");

    const gps = await readDevicePosition();
    if (gps) {
      apply(gps, "gps");
      return;
    }

    const ip = await fetchIpCoords();
    if (ip) {
      apply(ip.coords, "ip", ip.city);
      return;
    }

    if (mounted.current) {
      setStatus("denied");
      setCoords(null);
      setSource(null);
    }
  }, [apply]);

  const refresh = useCallback(
    async (opts?: { forceGps?: boolean }) => {
      if (selectedCity && !opts?.forceGps) {
        const cityCoords = coordsForCityName(selectedCity);
        if (cityCoords) {
          apply(cityCoords, "city", selectedCity);
          return;
        }
      }
      await detectCurrentLocation();
    },
    [apply, detectCurrentLocation, selectedCity]
  );

  // City selected → always use that city center
  useEffect(() => {
    if (!selectedCity) return;
    const cityCoords = coordsForCityName(selectedCity);
    if (!cityCoords) return;
    apply(cityCoords, "city", selectedCity);
  }, [selectedCity, apply]);

  // No city → use current location (GPS → IP)
  useEffect(() => {
    if (selectedCity) return;
    if (!autoDetect) return;

    const stored = readStoredUserGeo();
    // Reuse recent GPS/IP; never keep a previous "city" pin as "current location"
    if (
      stored &&
      (stored.source === "gps" || stored.source === "ip") &&
      Date.now() - stored.updatedAt < 1000 * 60 * 60 * 6
    ) {
      setCoords({ lat: stored.lat, lng: stored.lng });
      setSource(stored.source);
      setStatus("ready");
      // Still refresh GPS in background for fresher coords
      if (stored.source === "ip") {
        void detectCurrentLocation();
      }
      return;
    }

    void detectCurrentLocation();
  }, [selectedCity, autoDetect, detectCurrentLocation]);

  useEffect(() => {
    const onChange = () => {
      const stored = readStoredUserGeo();
      if (!stored) return;
      // While a city is selected, ignore non-city geo events
      if (selectedCity && stored.source !== "city") return;
      // With no city, ignore leftover city pins
      if (!selectedCity && stored.source === "city") return;
      setCoords({ lat: stored.lat, lng: stored.lng });
      setSource(stored.source);
      setStatus("ready");
    };
    window.addEventListener("bmb_user_geo_changed", onChange);
    return () => window.removeEventListener("bmb_user_geo_changed", onChange);
  }, [selectedCity]);

  return { coords, status, source, refresh };
}
