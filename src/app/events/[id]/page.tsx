"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock, Languages, Ticket, Users } from "lucide-react";
import { useGetPublicEventQuery } from "@/services/api";
import { formatDateTime12h } from "@/lib/dateFormat";
import EventCheckout from "@/components/EventCheckout";

export default function PublicEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: event, isLoading, isError } = useGetPublicEventQuery(id);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  if (isLoading) {
    return <div className="text-center py-20 text-slate-500">Loading event...</div>;
  }

  if (isError || !event) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-600 mb-4">Event not found or not available.</p>
        <Link href="/events" className="text-rose-600 hover:text-rose-700 font-medium">
          Browse all events
        </Link>
      </div>
    );
  }

  const heroImage =
    event.poster_horizontal_url ||
    event.poster_vertical_url ||
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80";

  const minPrice = event.ticket_types?.length
    ? Math.min(...event.ticket_types.map((t) => Number(t.price)))
    : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative h-64 sm:h-80 lg:h-96 overflow-hidden">
        <img src={heroImage} alt={event.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
          <div className="max-w-5xl mx-auto">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white mb-4"
            >
              <ArrowLeft size={16} /> All events
            </Link>
            {event.category_name && (
              <span className="inline-block text-xs font-bold text-violet-300 uppercase tracking-wider mb-2">
                {event.category_name}
              </span>
            )}
            <h1 className="text-3xl sm:text-4xl font-black text-white">{event.name}</h1>
            {event.organizer_name && (
              <p className="text-slate-300 mt-2">By {event.organizer_name}</p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {event.about_event && (
            <section className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-3">About</h2>
              <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{event.about_event}</p>
            </section>
          )}

          {event.genres && event.genres.length > 0 && (
            <section className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-3">Genres</h2>
              <div className="flex flex-wrap gap-2">
                {event.genres.map((g) => (
                  <span
                    key={g}
                    className="px-3 py-1 rounded-full bg-violet-50 text-violet-700 text-sm font-medium"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Showtimes & venues</h2>
            {event.showtimes && event.showtimes.length > 0 ? (
              <ul className="space-y-4">
                {event.showtimes.map((s) => (
                  <li key={s.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    <p className="font-semibold text-slate-900">{s.venue_name}</p>
                    {s.venue_address && (
                      <p className="text-sm text-slate-500 mt-0.5">{s.venue_address}</p>
                    )}
                    <p className="text-sm text-slate-600 mt-2 flex items-center gap-1.5">
                      <CalendarDays size={14} />
                      {formatDateTime12h(s.starts_at)}
                      {s.ends_at ? ` → ${formatDateTime12h(s.ends_at)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 text-sm">Showtimes coming soon.</p>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 sticky top-24">
            {minPrice !== null && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Starting from</p>
                <p className="text-2xl font-black text-slate-900">₹{minPrice.toFixed(0)}</p>
              </div>
            )}

            <dl className="space-y-3 text-sm">
              {event.language && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Languages size={15} className="text-slate-400" />
                  {event.language}
                </div>
              )}
              {event.age_group && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Users size={15} className="text-slate-400" />
                  {event.age_group}
                </div>
              )}
              {event.duration_minutes && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock size={15} className="text-slate-400" />
                  {event.duration_minutes} minutes
                </div>
              )}
            </dl>

            {event.ticket_types && event.ticket_types.length > 0 && (
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Ticket size={15} /> Ticket types
                </h3>
                <ul className="space-y-2">
                  {event.ticket_types.map((t) => (
                    <li
                      key={t.id}
                      className="flex justify-between text-sm text-slate-600"
                    >
                      <span>
                        {t.ticket_type}
                        <span className="block text-[11px] text-slate-400 font-normal">
                          {Number(t.available_count) || 0} left
                        </span>
                      </span>
                      <span className="font-semibold text-slate-900">
                        ₹{Number(t.price).toFixed(0)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(() => {
              const isLive = event.status === "LIVE";
              const hasShowtimes = (event.showtimes?.length || 0) > 0;
              const hasTickets = (event.ticket_types || []).some(
                (t) => Number(t.available_count) > 0
              );
              const canBook = isLive && hasShowtimes && hasTickets;
              return (
                <button
                  type="button"
                  disabled={!canBook}
                  onClick={() => setCheckoutOpen(true)}
                  className={`w-full py-3 rounded-xl font-semibold text-sm ${
                    canBook
                      ? "bg-rose-600 hover:bg-rose-700 text-white"
                      : "bg-slate-200 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  {!isLive
                    ? "Tickets not on sale yet"
                    : !hasShowtimes
                      ? "Showtimes coming soon"
                      : !hasTickets
                        ? "Sold out"
                        : "Book tickets"}
                </button>
              );
            })()}
          </div>
        </div>
      </div>

      <EventCheckout
        event={event}
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
      />
    </div>
  );
}
