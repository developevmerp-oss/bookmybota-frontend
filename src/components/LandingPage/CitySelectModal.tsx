"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Locate, Search, X } from "lucide-react";
import { toast } from "sonner";

type CitySelectModalProps = {
  open: boolean;
  cities: string[];
  selected: string;
  onClose: () => void;
  onSelect: (city: string) => void;
};

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

function matchCity(detected: string, cities: string[]) {
  const q = detected.trim().toLowerCase();
  if (!q) return null;
  return (
    cities.find((c) => c.toLowerCase() === q) ||
    cities.find((c) => q.includes(c.toLowerCase()) || c.toLowerCase().includes(q)) ||
    null
  );
}

const ALL_ETHIOPIA_CITIES = [
  "Addis Ababa", "Dire Dawa", "Mekelle", "Adama", "Hawassa", "Bahir Dar",
  "Gondar", "Dessie", "Jimma", "Jijiga", "Shashamane", "Bishoftu", "Sodo",
  "Arba Minch", "Hosaena", "Harar", "Dilla", "Nekemte", "Debre Birhan",
  "Debre Markos", "Asella", "Debre Tabor", "Kombolcha", "Adigrat", "Weldiya",
  "Shire Inda Selassie", "Burayu", "Aksum", "Adwa", "Alamata", "Wukro",
  "Ambo", "Sebeta", "Fiche", "Mojo", "Batu", "Meki", "Waliso", "Arsi Negele",
  "Bale Robe", "Goba", "Negele Borana", "Bule Hora", "Yirgalem", "Aleta Wendo",
  "Areka", "Boditi", "Butajira", "Welkite", "Durame", "Alaba Kulito", "Jinka",
  "Sawla", "Tepi", "Mizan Teferi", "Bonga", "Metu", "Dembi Dolo", "Gimbi",
  "Agaro", "Dangila", "Finote Selam", "Mota", "Kobo", "Degehabur", "Gode",
  "Haramaya", "Chiro", "Assosa", "Gambela",
];

const POPULAR_CITIES = [
  "Addis Ababa", "Dire Dawa", "Mekelle", "Adama", "Hawassa", "Bahir Dar",
  "Gondar", "Dessie", "Jimma", "Jijiga", "Harar", "Bishoftu",
];

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const CITY_ICON: Record<string, string> = {
  "Addis Ababa": "🏛️",
  "Dire Dawa": "🕌",
  "Mekelle": "⛪",
  "Adama": "🏙️",
  "Hawassa": "🌊",
  "Bahir Dar": "🌅",
  "Gondar": "🏰",
  "Dessie": "⛰️",
  "Jimma": "☕",
  "Jijiga": "🐪",
  "Harar": "🏚️",
  "Bishoftu": "🌿",
};

export default function CitySelectModal({
  open,
  selected,
  onClose,
  onSelect,
}: CitySelectModalProps) {
  const [query, setQuery] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveLetter(null);
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

  const filteredCities = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_ETHIOPIA_CITIES;
    return ALL_ETHIOPIA_CITIES.filter((c) => c.toLowerCase().includes(q));
  }, [query]);

  const grouped = useMemo(() => {
    const map: Record<string, string[]> = {};
    filteredCities.forEach((city) => {
      const letter = city.charAt(0).toUpperCase();
      if (!map[letter]) map[letter] = [];
      if (!map[letter].includes(city)) map[letter].push(city);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.localeCompare(b)));
    return map;
  }, [filteredCities]);

  const visibleLetters = useMemo(() => {
    if (activeLetter && grouped[activeLetter]) return [activeLetter];
    return ALPHABET.filter((l) => grouped[l]?.length);
  }, [grouped, activeLetter]);

  const lettersWithCities = useMemo(
    () => new Set(ALPHABET.filter((l) => grouped[l]?.length)),
    [grouped]
  );

  const handleLetterClick = (letter: string) => {
    setActiveLetter(activeLetter === letter ? null : letter);
    rightPanelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location is not supported in this browser");
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const detected = await reverseGeocodeCity(pos.coords.latitude, pos.coords.longitude);
          const match = matchCity(detected, ALL_ETHIOPIA_CITIES);
          if (match) {
            onSelect(match);
            onClose();
            toast.success(`Showing ${match}`);
          } else {
            toast.message("Could not match your location to a city. Please pick one.");
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center">
      <button
        type="button"
        aria-label="Close city picker"
        className="absolute inset-0 bg-black/50 cursor-pointer"
        onClick={onClose}
      />

      <div className="relative w-full max-w-[1020px] mt-6 sm:mt-10 mx-4 max-h-[88vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-full border-2 border-[#6900AA] flex items-center justify-center text-[#6900AA]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Select City</h2>
              <p className="text-xs text-slate-500">Choose your city in Ethiopia</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center cursor-pointer text-slate-500"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-t border-slate-100" />

        {/* Body: two panels */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left Panel */}
          <div className="w-full sm:w-[350px] shrink-0 border-r border-slate-100 overflow-y-auto px-5 py-4 flex flex-col gap-4">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveLetter(null);
                }}
                placeholder="Search for your city"
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#6900AA] focus:ring-1 focus:ring-[#6900AA]"
              />
            </div>

            {/* Detect location */}
            <button
              type="button"
              onClick={detectLocation}
              disabled={detecting}
              className="inline-flex items-center gap-2 text-sm font-medium text-[#6900AA] hover:text-[#57008E] cursor-pointer disabled:opacity-60"
            >
              <Locate size={16} />
              {detecting ? "Detecting..." : "Detect my location"}
            </button>

            {/* Popular Cities */}
            <div>
              <p className="text-sm font-bold text-slate-900 mb-3">Popular Cities</p>
              <div className="grid grid-cols-3 gap-3">
                {POPULAR_CITIES.map((city) => {
                  const active = city === selected;
                  return (
                    <button
                      key={city}
                      type="button"
                      onClick={() => pickCity(city)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border px-1 py-3 cursor-pointer transition-colors ${
                        active
                          ? "border-[#6900AA] bg-[#F3EEFF] text-[#6900AA]"
                          : "border-slate-200 bg-[#F8F6FF] text-slate-800 hover:border-[#E3BCFF] hover:bg-[#F3EEFF]"
                      }`}
                    >
                      <span className="text-2xl leading-none">{CITY_ICON[city] || "🏙️"}</span>
                      <span className="text-[11px] font-semibold text-center leading-tight">{city}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="hidden sm:flex flex-1 flex-col min-h-0 overflow-hidden">
            {/* A-Z Bar */}
            <div className="px-5 pt-4 pb-2 shrink-0">
              <p className="text-sm font-bold text-slate-900 mb-3">All Cities in Ethiopia</p>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => { setActiveLetter(null); rightPanelRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    activeLetter === null
                      ? "bg-[#6900AA] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-[#F3EEFF] hover:text-[#6900AA]"
                  }`}
                >
                  All
                </button>
                {ALPHABET.map((letter) => {
                  const hasItems = lettersWithCities.has(letter);
                  const isActive = activeLetter === letter;
                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={!hasItems}
                      onClick={() => handleLetterClick(letter)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        isActive
                          ? "bg-[#6900AA] text-white"
                          : hasItems
                            ? "bg-slate-100 text-slate-600 hover:bg-[#F3EEFF] hover:text-[#6900AA]"
                            : "bg-white text-slate-300 cursor-not-allowed"
                      }`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* City List */}
            <div ref={rightPanelRef} className="flex-1 overflow-y-auto px-5 pb-4">
              {visibleLetters.length === 0 ? (
                <p className="text-sm text-slate-400 mt-6">
                  {query ? `No cities match "${query}".` : "No cities available."}
                </p>
              ) : (
                visibleLetters.map((letter) => (
                  <div key={letter} className="mt-4 first:mt-2">
                    <p className="text-sm font-bold text-[#6900AA] mb-2">{letter}</p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-1">
                      {grouped[letter].map((city) => (
                        <button
                          key={city}
                          type="button"
                          onClick={() => pickCity(city)}
                          className={`text-left text-sm py-1 cursor-pointer rounded hover:text-[#6900AA] transition-colors ${
                            city === selected
                              ? "text-[#6900AA] font-semibold"
                              : "text-slate-700"
                          }`}
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-3 flex justify-between shrink-0">
          <button
            type="button"
            onClick={() => { onSelect(""); }}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-[#6900AA] hover:bg-[#F3EEFF] cursor-pointer"
          >
            Clear All
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
