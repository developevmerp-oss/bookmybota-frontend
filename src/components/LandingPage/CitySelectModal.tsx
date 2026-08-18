"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function CitySelectModal({
  open,
  cities,
  selected,
  onClose,
  onSelect,
}: CitySelectModalProps) {
  const [query, setQuery] = useState("");
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery("");
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter((c) => c.toLowerCase().includes(q));
  }, [cities, query]);

  const popular = filtered.slice(0, 9);
  const others = filtered.slice(9);

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
          const match = matchCity(detected, cities);
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-16 sm:pt-20">
      <button
        type="button"
        aria-label="Close city picker"
        className="absolute inset-0 bg-black/50 cursor-pointer"
        onClick={onClose}
      />
      <div className="relative w-full max-w-3xl max-h-[80vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4 mb-5">
          <h2 className="text-xl font-semibold text-[#111111]">Select your city</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#F7F7F7] flex items-center justify-center cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for your city"
            className="w-full h-11 pl-10 pr-4 rounded-lg bg-[#F7F7F7] text-sm text-[#111111] placeholder:text-[#9A9A9A] outline-none focus:ring-2 focus:ring-[#6900AA]"
          />
        </div>

        <button
          type="button"
          onClick={detectLocation}
          disabled={detecting}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#6900AA] hover:text-[#57008E] mb-6 cursor-pointer disabled:opacity-60"
        >
          <Locate size={16} />
          {detecting ? "Detecting..." : "Detect my location"}
        </button>

        {cities.length === 0 ? (
          <p className="text-sm text-[#6B6B6B]">No cities available yet.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[#6B6B6B]">No cities match “{query}”.</p>
        ) : (
          <>
            <p className="text-xs font-semibold tracking-wide text-[#6B6B6B] uppercase mb-3">
              Popular cities
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-8">
              {popular.map((c) => {
                const active = c === selected;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      onSelect(c);
                      onClose();
                    }}
                    className={`rounded-xl border px-2 py-4 text-sm font-medium cursor-pointer ${
                      active
                        ? "border-[#6900AA] bg-[#F7E9FF] text-[#6900AA]"
                        : "border-[#EDEDED] bg-white text-[#111111] hover:border-[#E3BCFF] hover:bg-[#F7E9FF]"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>

            {others.length > 0 && (
              <>
                <p className="text-xs font-semibold tracking-wide text-[#6B6B6B] uppercase mb-3">
                  Other cities
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {others.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        onSelect(c);
                        onClose();
                      }}
                      className={`text-sm cursor-pointer hover:text-[#6900AA] ${
                        c === selected ? "text-[#6900AA] font-semibold" : "text-[#111111]"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
