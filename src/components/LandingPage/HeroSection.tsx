"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FaCalendarAlt, FaChevronDown, FaMapMarkerAlt, FaSearch, FaUtensils } from "react-icons/fa";
import images from "@/Images";
import EventDiningCardsSection from "@/components/LandingPage/EventDiningCardsSection";

const CITIES = ["Addis Ababa", "Hawassa", "Bahir Dar", "Gondar", "Dire Dawa", "Adama"];

type HeroSectionProps = {
  city: string;
  onCityChange: (city: string) => void;
};

export default function HeroSection({ city, onCityChange }: HeroSectionProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const cityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setCityOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const goToEvents = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (city) params.set("city", city);
    router.push(`/events${params.toString() ? `?${params}` : ""}`);
  };

  const goToDining = () => {
    router.push("/dining");
  };

  const heroSrc = typeof images.hero === "string" ? images.hero : images.hero.src;

  return (
    <section className="relative min-h-[calc(100vh-88px)] lg:h-[calc(100vh-88px)] overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={heroSrc}
          alt="Discover events and dining across Ethiopia"
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white/85 via-white/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#f7f4ee] to-transparent" />
      </div>

      <div className="relative z-10 h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-between py-8 sm:py-10 lg:py-12">
        <div className="max-w-xl lg:max-w-2xl pt-2 sm:pt-6">
          <h1 className="text-[32px] sm:text-5xl lg:text-[52px] font-extrabold leading-[1.12] tracking-tight text-[#2b2b2b]">
            Discover Events &amp; Dining Experiences Across Ethiopia
          </h1>

          <p className="mt-4 sm:mt-5 text-base sm:text-lg text-slate-600 max-w-lg leading-relaxed">
            Find exciting events, restaurants, cafés, bars and unforgettable experiences in your city.
          </p>

          <form
            className="mt-7 sm:mt-8 flex flex-col sm:flex-row gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              goToEvents();
            }}
          >
            <div className="flex-1 flex items-center gap-2 bg-white rounded-full shadow-md px-5 min-h-[52px]">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search events, restaurants, cafés, bars..."
                className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
              <FaSearch size={16} className="text-slate-400 shrink-0" />
            </div>

            <div className="relative sm:w-[210px]" ref={cityRef}>
              <button
                type="button"
                onClick={() => setCityOpen((v) => !v)}
                className="w-full flex items-center gap-2 bg-white rounded-full shadow-md px-4 min-h-[52px] cursor-pointer"
              >
                <FaMapMarkerAlt size={15} className="text-[#C9A227] shrink-0" />
                <span className="flex-1 text-left text-sm font-semibold text-slate-800 truncate">
                  {city}
                </span>
                <FaChevronDown size={12} className="text-slate-400 shrink-0" />
              </button>

              {cityOpen && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-20">
                  {CITIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        onCityChange(c);
                        setCityOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm cursor-pointer hover:bg-emerald-50 ${
                        c === city ? "text-[#1B5E3B] font-semibold" : "text-slate-700"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </form>

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={goToEvents}
              className="inline-flex items-center justify-center gap-2 bg-[#1B5E3B] hover:bg-[#164e31] text-white font-semibold text-sm px-6 py-3.5 rounded-xl transition-colors cursor-pointer shadow-md"
            >
              <FaCalendarAlt size={16} />
              Explore Events
            </button>
            <button
              type="button"
              onClick={goToDining}
              className="inline-flex items-center justify-center gap-2 bg-[#C9A227] hover:bg-[#b4911f] text-white font-semibold text-sm px-6 py-3.5 rounded-xl transition-colors cursor-pointer shadow-md"
            >
              <FaUtensils size={16} />
              Explore Dining
            </button>
          </div>
        </div>

        <EventDiningCardsSection />
      </div>
    </section>
  );
}
