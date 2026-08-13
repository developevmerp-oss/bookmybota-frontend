"use client";

import Link from "next/link";

const CITIES = [
  {
    name: "Addis Ababa",
    events: 48,
    dining: 120,
    image: "https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&q=80",
  },
  {
    name: "Hawassa",
    events: 12,
    dining: 34,
    image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80",
  },
  {
    name: "Bahir Dar",
    events: 9,
    dining: 22,
    image: "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&q=80",
  },
  {
    name: "Gondar",
    events: 7,
    dining: 18,
    image: "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800&q=80",
  },
  {
    name: "Dire Dawa",
    events: 6,
    dining: 16,
    image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80",
  },
  {
    name: "Adama",
    events: 8,
    dining: 20,
    image: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800&q=80",
  },
];

type ExploreByLocationSectionProps = {
  onCityChange?: (city: string) => void;
};

export default function ExploreByLocationSection({
  onCityChange,
}: ExploreByLocationSectionProps) {
  return (
    <section className="bg-white py-14 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Explore Ethiopia</h2>
          <p className="mt-2 text-slate-500">
            Discover events and dining places in your favorite cities.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {CITIES.map((city) => (
            <Link
              key={city.name}
              href="/dining"
              onClick={() => onCityChange?.(city.name)}
              className="group rounded-xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-shadow bg-white"
            >
              <div className="h-28 overflow-hidden">
                <img
                  src={city.image}
                  alt={city.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-3">
                <h3 className="font-bold text-sm text-slate-900">{city.name}</h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  {city.events} events · {city.dining} dining
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
