"use client";

import { useRef } from "react";
import Link from "next/link";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

const CITIES = [
  {
    name: "Addis Ababa",
    events: "250+",
    dining: "500+",
    image: "https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&q=80",
  },
  {
    name: "Hawassa",
    events: "80+",
    dining: "200+",
    image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80",
  },
  {
    name: "Bahir Dar",
    events: "60+",
    dining: "150+",
    image: "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&q=80",
  },
  {
    name: "Gondar",
    events: "40+",
    dining: "120+",
    image: "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800&q=80",
  },
  {
    name: "Dire Dawa",
    events: "30+",
    dining: "90+",
    image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80",
  },
  {
    name: "Adama",
    events: "50+",
    dining: "180+",
    image: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800&q=80",
  },
];

type ExploreByLocationSectionProps = {
  onCityChange?: (city: string) => void;
};

export default function ExploreByLocationSection({
  onCityChange,
}: ExploreByLocationSectionProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.7), behavior: "smooth" });
  };

  return (
    <section className="bg-white py-14 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Explore Ethiopia</h2>
          <p className="mt-2 text-slate-500">
            Discover events and dining places in your favorite cities.
          </p>
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label="Previous cities"
            onClick={() => scrollBy(-1)}
            className="hidden md:flex absolute -left-4 lg:-left-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm items-center justify-center text-slate-400 hover:text-[#1B5E3B] cursor-pointer"
          >
            <FaChevronLeft size={14} />
          </button>

          <div
            ref={scrollerRef}
            className="flex gap-4 lg:gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {CITIES.map((city) => (
              <Link
                key={city.name}
                href="/dining"
                onClick={() => onCityChange?.(city.name)}
                className="group snap-start shrink-0 w-[82%] sm:w-[260px] md:w-[280px] lg:w-[300px] bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="h-44 sm:h-48 lg:h-52 overflow-hidden">
                  <img
                    src={city.image}
                    alt={city.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-lg text-slate-900">{city.name}</h3>
                  <p className="mt-2 text-sm text-slate-500">{city.events} Events</p>
                  <p className="mt-0.5 text-sm text-slate-500">{city.dining} Dining Places</p>
                </div>
              </Link>
            ))}
          </div>

          <button
            type="button"
            aria-label="Next cities"
            onClick={() => scrollBy(1)}
            className="hidden md:flex absolute -right-4 lg:-right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm items-center justify-center text-slate-400 hover:text-[#1B5E3B] cursor-pointer"
          >
            <FaChevronRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
