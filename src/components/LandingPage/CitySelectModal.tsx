"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Locate, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useGetCitiesQuery, type CityMaster } from "@/services/api";
import { lockBodyScroll } from "@/lib/lockBodyScroll";
import { ALPHABET, POPULAR_CITY_CONFIG, resolvePopularCityName } from "@/lib/cityLandmarkImages";

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

function cityFirstLetter(name: string) {
  const ch = name.trim()[0]?.toUpperCase() || "";
  return /[A-Z]/.test(ch) ? ch : null;
}

function PopularCityCard({
  displayName,
  image,
  pickName,
  active,
  onPick,
}: {
  displayName: string;
  image: string;
  pickName: string;
  active: boolean;
  onPick: (name: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(pickName)}
      className="flex flex-col items-center gap-2.5 w-full cursor-pointer group"
    >
      <span
        className={`w-full max-w-[132px] sm:max-w-[148px] aspect-[5/4] rounded-2xl overflow-hidden flex items-center justify-center p-2 sm:p-2.5 transition-all bg-purple-50 ${
          active
            ? "ring-2 ring-[#6900AA] shadow-[0_4px_14px_rgba(105,0,170,0.22)]"
            : "ring-1 ring-slate-200 group-hover:ring-[#6900AA]/40"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={displayName}
          className="w-full h-full object-contain"
        />
      </span>
      <span
        className={`text-sm sm:text-[0.9375rem] font-semibold text-center leading-tight px-1 ${
          active ? "text-[#6900AA]" : "text-slate-800 group-hover:text-[#6900AA]"
        }`}
      >
        {displayName}
      </span>
    </button>
  );
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
  const [activeLetter, setActiveLetter] = useState("A");

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const unlock = lockBodyScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const sortedCities = useMemo(
    () => cities.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [cities]
  );

  const popularCities = useMemo(
    () =>
      POPULAR_CITY_CONFIG.map((item) => ({
        ...item,
        pickName: resolvePopularCityName(item.displayName, item.aliases, sortedCities),
      })),
    [sortedCities]
  );

  const filteredCities = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedCities;
    return sortedCities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.state || "").toLowerCase().includes(q) ||
        (c.country || "").toLowerCase().includes(q)
    );
  }, [sortedCities, query]);

  const citiesByLetter = useMemo(() => {
    const map = new Map<string, CityMaster[]>();
    for (const city of sortedCities) {
      const letter = cityFirstLetter(city.name);
      if (!letter) continue;
      const list = map.get(letter) ?? [];
      list.push(city);
      map.set(letter, list);
    }
    return map;
  }, [sortedCities]);

  const availableLetters = useMemo(
    () => ALPHABET.filter((letter) => (citiesByLetter.get(letter)?.length ?? 0) > 0),
    [citiesByLetter]
  );

  useEffect(() => {
    if (!open || availableLetters.length === 0) return;
    setActiveLetter((prev) =>
      availableLetters.includes(prev) ? prev : availableLetters[0]
    );
  }, [open, availableLetters]);

  const letterCities = useMemo(() => {
    if (query.trim()) return [];
    return citiesByLetter.get(activeLetter) ?? [];
  }, [citiesByLetter, activeLetter, query]);

  const searching = Boolean(query.trim());

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

  const modal = (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center px-3 sm:px-4 py-6 sm:py-10"
      data-scroll-lock-container
    >
      <button
        type="button"
        aria-label="Close city picker"
        className="absolute inset-0 bg-black/50 cursor-pointer"
        onClick={onClose}
      />

      <div className="relative w-full max-w-[960px] max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 sm:px-8 pt-5 sm:pt-6 pb-2 shrink-0">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Select Location</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-8 pb-6 sm:pb-8">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search city, area or locality"
              className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-base text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#6900AA] focus:ring-1 focus:ring-[#6900AA]"
              autoFocus
            />
          </div>

          <button
            type="button"
            onClick={detectLocation}
            disabled={detecting}
            className="mt-4 inline-flex items-center gap-2 text-base font-semibold cursor-pointer disabled:opacity-60"
            style={{ color: ACCENT }}
          >
            <Locate size={18} />
            {detecting ? "Detecting..." : "Use Current Location"}
          </button>

          {isLoading ? (
            <p className="text-slate-400 text-center py-12">Loading cities…</p>
          ) : searching ? (
            <div className="mt-6">
              {filteredCities.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No cities match “{query.trim()}”.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2">
                  {filteredCities.map((city) => (
                    <button
                      key={city.id}
                      type="button"
                      onClick={() => pickCity(city.name)}
                      className={`text-left text-sm sm:text-base py-1.5 hover:text-[#6900AA] cursor-pointer ${
                        city.name === selected ? "font-bold text-[#6900AA]" : "text-slate-700"
                      }`}
                    >
                      {city.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {popularCities.length > 0 && (
                <section className="mt-6 sm:mt-8">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-4 sm:mb-5">
                    Popular Cities
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-3 gap-y-5 sm:gap-x-4 sm:gap-y-6">
                    {popularCities.map((city) => (
                      <PopularCityCard
                        key={city.displayName}
                        displayName={city.displayName}
                        image={city.image}
                        pickName={city.pickName}
                        active={
                          selected.toLowerCase() === city.pickName.toLowerCase() ||
                          selected.toLowerCase() === city.displayName.toLowerCase()
                        }
                        onPick={pickCity}
                      />
                    ))}
                  </div>
                </section>
              )}

              <section className="mt-8 sm:mt-10">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-4">All Cities</h3>

                <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto scrollbar-hide pb-3 border-b border-slate-100">
                  {ALPHABET.map((letter) => {
                    const hasCities = availableLetters.includes(letter);
                    const active = activeLetter === letter;
                    return (
                      <button
                        key={letter}
                        type="button"
                        disabled={!hasCities}
                        onClick={() => setActiveLetter(letter)}
                        className={`shrink-0 text-sm sm:text-base font-semibold pb-1 transition-colors cursor-pointer disabled:cursor-default ${
                          active
                            ? "text-[#6900AA] border-b-2 border-[#6900AA]"
                            : hasCities
                              ? "text-slate-500 hover:text-slate-800"
                              : "text-slate-300"
                        }`}
                      >
                        {letter}
                      </button>
                    );
                  })}
                </div>

                {letterCities.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">
                    {cities.length === 0
                      ? "No cities yet. Super Admin can add them under City Masters."
                      : `No cities starting with “${activeLetter}”.`}
                  </p>
                ) : (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-2">
                    {letterCities.map((city) => (
                      <button
                        key={city.id}
                        type="button"
                        onClick={() => pickCity(city.name)}
                        className={`text-left text-sm sm:text-base py-1.5 hover:text-[#6900AA] cursor-pointer ${
                          city.name === selected ? "font-bold text-[#6900AA]" : "text-slate-700"
                        }`}
                      >
                        {city.name}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {selected ? (
                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-center">
                  <button
                    type="button"
                    onClick={clearCity}
                    className="text-sm font-medium text-slate-500 hover:text-slate-800 underline underline-offset-2 cursor-pointer"
                  >
                    Clear City
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
