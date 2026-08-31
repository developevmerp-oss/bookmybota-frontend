"use client";

import { useEffect } from "react";
import {
  useGetCitiesQuery,
  useGetGeoCountriesQuery,
} from "@/services/api";

type VenueLocationFieldsProps = {
  countryId: number | "";
  cityId: number | "";
  onCountryChange: (id: number | "") => void;
  onCityChange: (id: number | "") => void;
  disabled?: boolean;
  variant?: "light" | "dark";
  required?: boolean;
};

export default function VenueLocationFields({
  countryId,
  cityId,
  onCountryChange,
  onCityChange,
  disabled = false,
  variant = "light",
  required = true,
}: VenueLocationFieldsProps) {
  const { data: countries = [], isLoading: countriesLoading } = useGetGeoCountriesQuery();
  const { data: cities = [], isLoading: citiesLoading } = useGetCitiesQuery(
    countryId ? { country_id: Number(countryId) } : undefined,
    { skip: !countryId }
  );

  const labelClass =
    variant === "dark"
      ? "block text-sm font-medium text-zinc-400 mb-2"
      : "block text-sm font-medium text-[#1a1a2e] mb-2";
  const inputClass =
    variant === "dark"
      ? "w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white"
      : "w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#6900AA]/30 focus:border-[#6900AA]";

  useEffect(() => {
    if (!cityId) return;
    if (!cities.some((c) => c.id === Number(cityId))) {
      onCityChange("");
    }
  }, [cities, cityId, onCityChange]);

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div>
        <label className={labelClass}>
          Country {required ? <span className="text-[#6900AA]">*</span> : null}
        </label>
        <select
          disabled={disabled || countriesLoading}
          className={inputClass}
          value={countryId}
          onChange={(e) => {
            onCountryChange(e.target.value ? Number(e.target.value) : "");
            onCityChange("");
          }}
        >
          <option value="">
            {countriesLoading ? "Loading countries…" : "Select country"}
          </option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>
          City {required ? <span className="text-[#6900AA]">*</span> : null}
        </label>
        <select
          disabled={disabled || !countryId || citiesLoading}
          className={inputClass}
          value={cityId}
          onChange={(e) => onCityChange(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">
            {!countryId
              ? "Select country first"
              : citiesLoading
                ? "Loading cities…"
                : cities.length
                  ? "Select city"
                  : "No cities for this country"}
          </option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.state ? `, ${c.state}` : ""}
            </option>
          ))}
        </select>
        {countryId && !citiesLoading && cities.length === 0 ? (
          <p className={variant === "dark" ? "text-xs text-amber-400 mt-1" : "text-xs text-amber-700 mt-1"}>
            No cities found for this country. Ask Super Admin to add cities under Geo / Cities.
          </p>
        ) : null}
      </div>
    </div>
  );
}
