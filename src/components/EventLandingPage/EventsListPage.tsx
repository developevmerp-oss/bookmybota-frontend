"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, Search, Ticket } from "lucide-react";
import { useGetPublicEventsQuery, useGetBusinessTypesQuery } from "@/services/api";
import { formatDateTime12h } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/currencyFormat";

function EventCard({
  event,
}: {
  event: {
    id: string;
    name: string;
    poster_horizontal_url?: string;
    poster_vertical_url?: string;
    category_name?: string;
    organizer_name?: string;
    next_showtime?: string;
    min_price?: number | string;
  };
}) {
  const image =
    event.poster_horizontal_url ||
    event.poster_vertical_url ||
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80";

  return (
    <Link
      href={`/events/${event.id}`}
      className="group bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all"
    >
      <div className="aspect-[16/10] overflow-hidden bg-slate-100">
        <img
          src={image}
          alt={event.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="p-4 space-y-2">
        {event.category_name && (
          <span className="text-xs font-semibold text-violet-600 uppercase tracking-wide">
            {event.category_name}
          </span>
        )}
        <h3 className="font-bold text-slate-900 group-hover:text-rose-600 transition-colors line-clamp-2">
          {event.name}
        </h3>
        {event.organizer_name && (
          <p className="text-xs text-slate-500">{event.organizer_name}</p>
        )}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
          {event.next_showtime && (
            <span className="flex items-center gap-1">
              <CalendarDays size={13} />
              {formatDateTime12h(event.next_showtime)}
            </span>
          )}
          {event.min_price !== undefined && event.min_price !== null && (
            <span className="flex items-center gap-1 font-semibold text-slate-700">
              <Ticket size={13} />
              From {formatMoney(event.min_price, { compact: true })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function PublicEventsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const { data: businessTypes = [] } = useGetBusinessTypesQuery();

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("selected_city") : "";
    if (stored && stored !== "All Cities") setCity(stored);
  }, []);

  const categories = useMemo(
    () => businessTypes.filter((t) => t.module_key === "event" && t.parent_type_id),
    [businessTypes]
  );

  const queryArg = useMemo(
    () => ({
      ...(search.trim() ? { q: search.trim() } : {}),
      ...(category ? { category } : {}),
      ...(city ? { city } : {}),
    }),
    [search, category, city]
  );

  const { data: events = [], isLoading } = useGetPublicEventsQuery(queryArg);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-violet-950 via-slate-900 to-slate-950 text-white py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-violet-300 text-sm font-medium mb-3">
            <CalendarDays size={16} />
            Events & Experiences
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
            Discover events near you
          </h1>
          <p className="text-slate-300 max-w-xl">
            Comedy nights, concerts, music shows and more — book tickets from verified organizers.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events..."
              className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/30 sm:min-w-[180px]"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          {city && (
            <button
              type="button"
              onClick={() => setCity("")}
              className="px-4 py-3 rounded-xl border border-rose-100 bg-rose-50 text-rose-700 text-sm font-semibold"
            >
              {city} ×
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-slate-500">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 glass-panel rounded-2xl border border-slate-200 bg-white">
            <MapPin className="mx-auto text-slate-300 mb-3" size={32} />
            <p className="text-slate-600 font-medium">No events available right now</p>
            <p className="text-slate-400 text-sm mt-1">
              Check back soon — new events appear after organizer approval.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
