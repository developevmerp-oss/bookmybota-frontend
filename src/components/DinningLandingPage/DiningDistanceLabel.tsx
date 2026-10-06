"use client";

import { useMemo } from "react";
import {
  coordsForCityName,
  formatDistanceKm,
  haversineKm,
  parseCoords,
} from "@/lib/geoDistance";
import { useSelectedCity } from "@/lib/useSelectedCity";
import { useUserGeo } from "@/lib/useUserGeo";

type DiningDistanceLabelProps = {
  latitude?: number | string | null;
  longitude?: number | string | null;
  /** Restaurant city — used when pin coords are missing */
  placeCity?: string | null;
  /** Appended after the distance, e.g. " away" */
  suffix?: string;
  className?: string;
  /** Override header city; defaults to selected_city from localStorage */
  selectedCity?: string | null;
};

/**
 * Distance on dining cards:
 * - City selected → distance from that city center
 * - No city → distance from current location (GPS, then IP)
 */
export default function DiningDistanceLabel({
  latitude,
  longitude,
  placeCity,
  suffix = "",
  className,
  selectedCity: selectedCityProp,
}: DiningDistanceLabelProps) {
  const headerCity = useSelectedCity();
  const selectedCity = (
    selectedCityProp !== undefined && selectedCityProp !== null
      ? selectedCityProp
      : headerCity
  ).trim();

  const { coords: liveCoords } = useUserGeo({
    selectedCity: selectedCity || null,
    autoDetect: true,
  });

  const userCoords = useMemo(() => {
    if (selectedCity) {
      return coordsForCityName(selectedCity) ?? liveCoords;
    }
    return liveCoords;
  }, [selectedCity, liveCoords]);

  const placeCoords = useMemo(() => {
    return (
      parseCoords(latitude, longitude) ?? coordsForCityName(placeCity) ?? null
    );
  }, [latitude, longitude, placeCity]);

  const label = useMemo(() => {
    if (!userCoords || !placeCoords) return null;
    return formatDistanceKm(haversineKm(userCoords, placeCoords)) || null;
  }, [userCoords, placeCoords]);

  if (!label) return null;
  return (
    <span className={className}>
      {label}
      {suffix}
    </span>
  );
}
