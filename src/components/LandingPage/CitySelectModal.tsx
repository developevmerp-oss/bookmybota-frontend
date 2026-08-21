"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, ChevronDown, ChevronUp, Locate, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useGetCitiesQuery, type CityMaster } from "@/services/api";

type CitySelectModalProps = {
  open: boolean;
  selected: string;
  onClose: () => void;
  onSelect: (city: string) => void;
};

const ACCENT = "#6900AA";

async function reverseGeocodeCity(lat: number, lon: number): Promise<string> {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
  const res = await fetch(url);
  if (!res.ok) return "";
  const data = (await res.json()) as {
    city?: string;
    locality?: string;
    principalSubdivision?: string;
  };
  return data.city || data.locality || data.principalSubdivision || "";
}

function matchCity(detected: string, cities: CityMaster[]) {
  const q = detected.trim().toLowerCase();
  if (!q) return null;
  return (
    cities.find((c) => c.name.toLowerCase() === q) ||
    cities.find((c) => q.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(q)) ||
    null
  );
}

function PopularCityIcon({ city }: { city: CityMaster }) {
  if (city.icon_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={city.icon_url}
        alt=""
        className="w-10 h-10 object-contain"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return <Building2 size={28} strokeWidth={1.5} className="text-slate-400" />;
}

export default function CitySelectModal({
  open,
  selected,
  onClose,
  onSelect,
}: CitySelectModalProps) {
  const { data: cities = [], isLoading } = useGetCitiesQuery(undefined, { skip: !open });
  const [query, setQuery] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [showOtherCities, setShowOtherCities] = useState(true);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setShowOtherCities(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const popularCities = useMemo(
    () => cities.filter((c) => c.is_popular).slice(0, 10),
    [cities]
  );

  const filteredCities = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.state || "").toLowerCase().includes(q) ||
        (c.country || "").toLowerCase().includes(q)
    );
  }, [cities, query]);

  const otherCities = useMemo(() => {
    const popularIds = new Set(popularCities.map((c) => c.id));
    return filteredCities
      .filter((c) => !popularIds.has(c.id))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredCities, popularCities]);

  const searching = Boolean(query.trim());
  const searchResults = searching ? filteredCities : [];

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location is not supported in this browser");
      return;
    }
    if (cities.length === 0) {
      toast.message("No cities configured yet. Ask Super Admin to add cities.");
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const detected = await reverseGeocodeCity(pos.coords.latitude, pos.coords.longitude);
          const match = matchCity(detected, cities);
          if (match) {
            onSelect(match.name);
            onClose();
            toast.success(`Showing ${match.name}`);
          } else {
            toast.message("Could not match your location to a listed city. Please pick one.");
          }
        } catch {
          toast.error("Could not detect your city");
        } finally {
          setDetecting(false);
        }
      },
      () => {
        setDetecting(false);
        toast.error("Location permission denied");
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  const pickCity = (city: string) => {
    onSelect(city);
    onClose();
  };

  const clearCity = () => {
    onSelect("");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-3 sm:px-4">
      <button
        type="button"
        aria-label="Close city picker"
        className="absolute inset-0 bg-black/45 cursor-pointer"
        onClick={onClose}
      />

      <div className="relative w-full max-w-[920px] mt-8 sm:mt-12 max-h-[85vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 shrink-0 border-b border-slate-100">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">Select City</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3">
          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for your city"
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[color:var(--city-accent)] focus:ring-1 focus:ring-[color:var(--city-accent)]"
              style={{ ["--city-accent" as string]: ACCENT }}
              autoFocus
            />
          </div>

          {/* Detect */}
          <button
            type="button"
            onClick={detectLocation}
            disabled={detecting}
            className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-medium cursor-pointer disabled:opacity-60"
            style={{ color: ACCENT }}
          >
            <Locate size={15} />
            {detecting ? "Detecting..." : "Detect my location"}
          </button>

          {isLoading ? (
            <p className="text-sm text-slate-400 text-center py-10">Loading cities…</p>
          ) : searching ? (
            <div className="mt-4">
              <p className="text-center text-xs font-semibold text-slate-500 mb-2">Search results</p>
              {searchResults.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No cities match “{query.trim()}”.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-1">
                  {searchResults.map((city) => (
                    <button
                      key={city.id}
                      type="button"
                      onClick={() => pickCity(city.name)}
                      className={`text-left text-[13px] py-1 hover:underline ${
                        city.name === selected ? "font-semibold" : "text-slate-600"
                      }`}
                      style={city.name === selected ? { color: ACCENT } : undefined}
                    >
                      {city.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Popular */}
              {popularCities.length > 0 && (
                <div className="mt-4">
                  <p className="text-center text-xs font-semibold text-slate-500 mb-3">Popular Cities</p>
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2 sm:gap-3">
                    {popularCities.map((city) => {
                      const active = city.name === selected;
                      return (
                        <button
                          key={city.id}
                          type="button"
                          onClick={() => pickCity(city.name)}
                          className={`flex flex-col items-center gap-1 py-1.5 px-0.5 rounded-lg transition-colors ${
                            active ? "bg-[#F3EEFF]" : "hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`w-11 h-11 flex items-center justify-center ${
                              active ? "text-[#6900AA]" : "text-slate-400"
                            }`}
                          >
                            <PopularCityIcon city={city} />
                          </span>
                          <span
                            className={`text-[11px] font-medium text-center leading-tight ${
                              active ? "text-[#6900AA]" : "text-slate-600"
                            }`}
                          >
                            {city.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Other cities */}
              <div className="mt-5">
                <p className="text-center text-xs font-semibold text-slate-500 mb-2.5">Other Cities</p>
                {showOtherCities ? (
                  otherCities.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">
                      {cities.length === 0
                        ? "No cities yet. Super Admin can add them under City Masters."
                        : "No other cities."}
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-0.5">
                      {otherCities.map((city) => (
                        <button
                          key={city.id}
                          type="button"
                          onClick={() => pickCity(city.name)}
                          className={`text-left text-[13px] py-1 hover:underline ${
                            city.name === selected ? "font-semibold" : "text-slate-500"
                          }`}
                          style={city.name === selected ? { color: ACCENT } : undefined}
                        >
                          {city.name}
                        </button>
                      ))}
                    </div>
                  )
                ) : null}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 px-4 py-2.5 flex items-center justify-center gap-5">
          {!searching && (
            <button
              type="button"
              onClick={() => setShowOtherCities((v) => !v)}
              className="inline-flex items-center gap-1 text-sm font-medium"
              style={{ color: ACCENT }}
            >
              {showOtherCities ? (
                <>
                  Hide all cities <ChevronUp size={16} />
                </>
              ) : (
                <>
                  View all cities <ChevronDown size={16} />
                </>
              )}
            </button>
          )}
          {selected ? (
            <button
              type="button"
              onClick={clearCity}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2"
            >
              Clear City
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
