"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Mic2, Search, X } from "lucide-react";
import { useGetPublicRegisteredVenuesQuery } from "@/services/api";
import PartnerDirectorySection from "@/components/Shared/PartnerDirectorySection";
import { preferCityOrAll } from "@/components/LandingPage/homeUtils";
import CityLocationEmptyState from "@/components/LandingPage/CityLocationEmptyState";
import { usePublicArtistsCatalog } from "@/lib/usePublicArtistsCatalog";

const BRAND = "#6900AA";

type PartnerListingKind = "artist" | "venue";

export default function PartnerListingPage({ kind }: { kind: PartnerListingKind }) {
  const [q, setQ] = useState("");
  /** Header city when set; empty means show all partners. */
  const [city, setCity] = useState("");

  useEffect(() => {
    const applyCity = () => {
      const stored = localStorage.getItem("selected_city") || "";
      setCity(stored && stored !== "All Cities" ? stored : "");
    };
    applyCity();
    window.addEventListener("selected_city_changed", applyCity);
    window.addEventListener("storage", applyCity);
    return () => {
      window.removeEventListener("selected_city_changed", applyCity);
      window.removeEventListener("storage", applyCity);
    };
  }, []);

  const searchArg = useMemo(() => {
    const trimmed = q.trim();
    return trimmed ? { q: trimmed } : {};
  }, [q]);

  const cityQueryArgs = useMemo(
    () => ({
      ...searchArg,
      ...(city.trim() ? { city: city.trim() } : {}),
    }),
    [searchArg, city]
  );

  const artistsCatalog = usePublicArtistsCatalog({
    q: q.trim() || undefined,
    city: city.trim() || undefined,
  });

  const venuesCityQuery = useGetPublicRegisteredVenuesQuery(cityQueryArgs, {
    skip: kind !== "venue",
  });
  const venuesAllQuery = useGetPublicRegisteredVenuesQuery(searchArg, {
    skip: kind !== "venue" || !city.trim(),
  });

  const cityVenues = venuesCityQuery.data ?? [];
  const allVenues = venuesAllQuery.data ?? [];
  const venuePartners = preferCityOrAll(cityVenues, allVenues, Boolean(city.trim()));

  const partners = kind === "artist" ? artistsCatalog.artists : venuePartners;
  const isLoading =
    kind === "artist"
      ? artistsCatalog.isLoading
      : venuesCityQuery.isLoading ||
        (Boolean(city.trim()) && cityVenues.length === 0 && venuesAllQuery.isLoading);

  const usedCityFallback =
    kind === "artist"
      ? Boolean(artistsCatalog.usedCityFallback)
      : Boolean(city.trim()) &&
        !venuesCityQuery.isLoading &&
        cityVenues.length === 0 &&
        allVenues.length > 0;

  const title = kind === "artist" ? "Artists" : "Venues";
  const subtitle =
    kind === "artist"
      ? "Browse registered and event artists — open a profile for details and live shows."
      : "Browse all registered venues, check free dates, and send a booking inquiry.";
  const searchPlaceholder =
    kind === "artist" ? "Search artists by name or type…" : "Search venues by name or type…";
  const Icon = kind === "artist" ? Mic2 : Building2;

  return (
    <div className="min-h-screen bg-[#faf7fc]">
      {city.trim() ? (
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5">
          <CityLocationEmptyState
            city={city.trim()}
            forceShow={usedCityFallback}
            currentModule={kind === "artist" ? "artists" : "venues"}
          />
        </div>
      ) : null}
      <div className="bg-white border-b border-[#F3E8FF]">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <span
                className="mt-1 inline-flex h-11 w-11 items-center justify-center rounded-xl text-white shrink-0"
                style={{ backgroundColor: BRAND }}
              >
                <Icon size={22} />
              </span>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#111111]">
                  {title}
                </h1>
                <p className="mt-1.5 text-sm sm:text-base text-[#5c5c5c] max-w-2xl">{subtitle}</p>
                {!isLoading ? (
                  <p className="mt-2 text-xs font-semibold text-[#6900AA]">
                    {partners.length} {kind === "artist" ? "artist" : "venue"}
                    {partners.length === 1 ? "" : "s"}
                    {city.trim() ? ` · ${city.trim()}` : ""}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-[#6900AA]/40"
              />
            </div>
            <div className="relative sm:w-56">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Filter by city (optional)"
                className="w-full h-11 px-4 pr-9 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-[#6900AA]/40"
              />
              {city.trim() ? (
                <button
                  type="button"
                  onClick={() => setCity("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700"
                  aria-label="Clear city filter"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <PartnerDirectorySection
        title={kind === "artist" ? "All artists" : "All venues"}
        subtitle=""
        kind={kind}
        partners={partners}
        isLoading={isLoading}
        showHeader={false}
        emptyMessage={
          q.trim() || city.trim()
            ? `No ${kind === "artist" ? "artists" : "venues"} match your search.`
            : `No ${kind === "artist" ? "artists" : "venues"} to show yet.`
        }
      />
    </div>
  );
}
