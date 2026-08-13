"use client";

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import { FaArrowRight, FaChevronLeft, FaChevronRight, FaMapMarkerAlt, FaStar } from "react-icons/fa";
import {
  useGetBusinessesQuery,
  useGetPublicEventsQuery,
  type Business,
  type PublicEvent,
} from "@/services/api";
import { formatMoney, normalizePriceRange } from "@/lib/currencyFormat";

function monthDay(value?: string) {
  if (!value) return { month: "TBA", day: "--" };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { month: "TBA", day: "--" };
  return {
    month: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
    day: String(d.getDate()).padStart(2, "0"),
  };
}

function Carousel({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.75), behavior: "smooth" });
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Previous ${label}`}
        onClick={() => scrollBy(-1)}
        className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white border border-slate-200 shadow items-center justify-center text-slate-600 hover:text-[#1B5E3B] cursor-pointer"
      >
        <FaChevronLeft size={20} />
      </button>
      <div
        ref={scrollerRef}
        className="flex gap-5 overflow-x-auto scroll-smooth pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <button
        type="button"
        aria-label={`Next ${label}`}
        onClick={() => scrollBy(1)}
        className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white border border-slate-200 shadow items-center justify-center text-slate-600 hover:text-[#1B5E3B] cursor-pointer"
      >
        <FaChevronRight size={20} />
      </button>
    </div>
  );
}

function EventCard({ event }: { event: PublicEvent }) {
  const image =
    event.poster_horizontal_url ||
    event.poster_vertical_url ||
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80";
  const { month, day } = monthDay(event.next_showtime);

  return (
    <Link
      href={`/events/${event.id}`}
      className="snap-start shrink-0 w-[260px] bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="relative h-40">
        <img src={image} alt={event.name} className="w-full h-full object-cover" />
        <div className="absolute top-3 left-3 w-12 h-12 rounded-lg bg-[#1B5E3B] text-white flex flex-col items-center justify-center leading-none">
          <span className="text-[9px] font-bold tracking-wider">{month}</span>
          <span className="text-lg font-extrabold">{day}</span>
        </div>
      </div>
      <div className="p-4 space-y-1.5">
        <h3 className="font-bold text-slate-900 line-clamp-1">{event.name}</h3>
        <p className="flex items-center gap-1 text-xs text-slate-500">
          <FaMapMarkerAlt size={12} className="text-[#1B5E3B]" />
          {event.organizer_name || "Ethiopia"}
        </p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-medium text-slate-500">
            {event.category_name || "Event"}
          </span>
          {event.min_price != null && (
            <span className="text-xs font-semibold text-slate-800">
              From {formatMoney(event.min_price, { compact: true })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function DiningCard({ place }: { place: Business }) {
  const image =
    place.cover_image_url ||
    "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=800&q=80";
  const rating = Number(place.rating || 4.5).toFixed(1);
  const locality = place.address?.split(",")[0] || "Ethiopia";

  return (
    <Link
      href={`/restaurant/${place.id}`}
      className="snap-start shrink-0 w-[260px] bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="h-40">
        <img src={image} alt={place.name} className="w-full h-full object-cover" />
      </div>
      <div className="p-4 space-y-1.5">
        <h3 className="font-bold text-slate-900 line-clamp-1">{place.name}</h3>
        <p className="flex items-center gap-1 text-xs text-slate-500">
          <FaMapMarkerAlt size={12} className="text-[#C9A227]" />
          {locality}
        </p>
        <p className="flex items-center gap-1 text-xs text-slate-600">
          <FaStar size={12} className="text-[#C9A227]" />
          <span className="font-semibold">{rating}</span>
          <span className="text-slate-400">({place.reviews_count || 0})</span>
        </p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-medium text-slate-500">
            {place.cuisine || place.type_name || "Dining"}
          </span>
          <span className="text-xs font-semibold text-slate-800">
            {normalizePriceRange(place.price_range) ||
              (place.average_cost
                ? formatMoney(place.average_cost, { compact: true })
                : "ETB 400 - 1,000")}
          </span>
        </div>
      </div>
    </Link>
  );
}

type PopularEventDiningSectionProps = {
  city: string;
};

export default function PopularEventDiningSection({ city }: PopularEventDiningSectionProps) {
  const { data: events = [], isLoading: eventsLoading } = useGetPublicEventsQuery({
    city,
  });
  const { data: allEvents = [] } = useGetPublicEventsQuery();
  const { data: places = [], isLoading: diningLoading } = useGetBusinessesQuery({
    module: "dining",
  });

  const cityDining = places.filter((p) =>
    (p.address || "").toLowerCase().includes(city.toLowerCase())
  );
  const diningPlaces = (cityDining.length > 0 ? cityDining : places).slice(0, 10);

  const upcoming = (events.length > 0 ? events : allEvents).slice(0, 10);

  return (
    <section className="bg-[#f7f4ee] py-12 sm:py-16 space-y-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Upcoming Events</h2>
          <Link
            href="/events"
            className="text-sm font-semibold text-[#1B5E3B] hover:underline inline-flex items-center gap-1"
          >
            View All Events <FaArrowRight size={14} />
          </Link>
        </div>
        {eventsLoading ? (
          <p className="text-sm text-slate-500 py-10">Loading events...</p>
        ) : upcoming.length === 0 ? (
          <p className="text-sm text-slate-500 py-10">No upcoming events in {city} yet.</p>
        ) : (
          <Carousel label="events">
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </Carousel>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Popular Dining Places
          </h2>
          <Link
            href="/dining"
            className="text-sm font-semibold text-[#1B5E3B] hover:underline inline-flex items-center gap-1"
          >
            Explore All <FaArrowRight size={14} />
          </Link>
        </div>
        {diningLoading ? (
          <p className="text-sm text-slate-500 py-10">Loading dining places...</p>
        ) : diningPlaces.length === 0 ? (
          <p className="text-sm text-slate-500 py-10">No dining places to show yet.</p>
        ) : (
          <Carousel label="dining places">
            {diningPlaces.map((place) => (
              <DiningCard key={place.id} place={place} />
            ))}
          </Carousel>
        )}
      </div>
    </section>
  );
}
