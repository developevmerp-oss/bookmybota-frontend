"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FaCalendarAlt, FaMapMarkerAlt, FaSearch, FaUtensils } from "react-icons/fa";

const CITIES = ["Addis Ababa", "Hawassa", "Bahir Dar", "Gondar", "Dire Dawa", "Adama"];

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1600&q=80";

type HeroSectionProps = {
  city: string;
  onCityChange: (city: string) => void;
};

export default function HeroSection({ city, onCityChange }: HeroSectionProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const goToEvents = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (city) params.set("city", city);
    router.push(`/events${params.toString() ? `?${params}` : ""}`);
  };

  const goToDining = () => {
    router.push("/dining");
  };

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={HERO_IMAGE}
          alt="Ethiopian city skyline at sunset"
          className="w-full h-screen object-contain object-center"
        />
        {/* <div className="absolute inset-0 bg-gradient-to-r from-white via-white/88 to-white/25" /> */}
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        <div className="max-w-2xl">
          <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold leading-tight text-[#1B5E3B]">
            Discover Events &amp; Dining Experiences Across Ethiopia.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-500 max-w-xl">
            Find exciting events, restaurants, cafes, bars and unforgettable experiences in your city.
          </p>

          <form
            className="mt-8 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 flex flex-col sm:flex-row gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              goToDining();
            }}
          >
            <div className="flex-1 flex items-center gap-2 px-3 min-h-12">
              <FaSearch size={18} className="text-slate-400 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search events, restaurants, cafes, bars..."
                className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
            <div className="hidden sm:block w-px bg-slate-200 my-2" />
            <div className="flex items-center gap-2 px-3 min-h-12 sm:w-48">
              <FaMapMarkerAlt size={16} className="text-[#1B5E3B] shrink-0" />
              <select
                value={city}
                onChange={(e) => onCityChange(e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-slate-700 focus:outline-none cursor-pointer"
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </form>

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={goToEvents}
              className="inline-flex items-center justify-center gap-2 bg-[#1B5E3B] hover:bg-[#164e31] text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors cursor-pointer"
            >
              <FaCalendarAlt size={18} />
              Explore Events
            </button>
            <button
              type="button"
              onClick={goToDining}
              className="inline-flex items-center justify-center gap-2 bg-[#C9A227] hover:bg-[#b4911f] text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors cursor-pointer"
            >
              <FaUtensils size={18} />
              Explore Dining
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
