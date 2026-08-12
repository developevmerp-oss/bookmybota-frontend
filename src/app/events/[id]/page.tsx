"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  ExternalLink,
  Languages,
  MapPin,
  Phone,
  Tag,
  Ticket,
  Users,
} from "lucide-react";
import { useGetPublicEventQuery, useGetPublicEventOffersQuery } from "@/services/api";
import { formatDateTime12h } from "@/lib/dateFormat";
import EventCheckout from "@/components/EventCheckout";
import EventReviewsSection from "@/components/EventReviewsSection";

function parseGenres(genres?: string[] | string | null): string[] {
  if (!genres) return [];
  if (Array.isArray(genres)) return genres.map(String).map((g) => g.trim()).filter(Boolean);
  try {
    const parsed = JSON.parse(genres);
    return Array.isArray(parsed) ? parsed.map(String).map((g) => g.trim()).filter(Boolean) : [];
  } catch {
    return String(genres)
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);
  }
}

function formatInr(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function PublicEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: event, isLoading, isError } = useGetPublicEventQuery(id);
  const { data: offers = [] } = useGetPublicEventOffersQuery(id);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState("");

  const genres = useMemo(() => parseGenres(event?.genres), [event?.genres]);
  const showtimes = event?.showtimes || [];
  const ticketTypes = event?.ticket_types || [];

  const minPrice = ticketTypes.length
    ? Math.min(...ticketTypes.map((t) => Number(t.price) || 0))
    : null;

  const nextShowtime = showtimes.find((s) => new Date(s.starts_at).getTime() >= Date.now())
    || showtimes[0];

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

  const isLive = event.status === "LIVE";
  const hasShowtimes = showtimes.length > 0;
  const hasTickets = ticketTypes.some((t) => Number(t.available_count) > 0);
  const canBook = isLive && hasShowtimes && hasTickets;

  const openCheckout = (showtimeId?: string) => {
    setSelectedShowtimeId(showtimeId || "");
    setCheckoutOpen(true);
  };

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
            {nextShowtime && (
              <p className="text-white/80 text-sm mt-2 flex items-center gap-1.5">
                <CalendarDays size={15} />
                Next show: {formatDateTime12h(nextShowtime.starts_at)}
                {nextShowtime.venue_name ? ` · ${nextShowtime.venue_name}` : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {event.poster_vertical_url && (
            <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-3">Posters</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {event.poster_horizontal_url && (
                  <img
                    src={event.poster_horizontal_url}
                    alt="Horizontal poster"
                    className="w-full h-48 object-cover rounded-xl border border-slate-100"
                  />
                )}
                <img
                  src={event.poster_vertical_url}
                  alt="Vertical poster"
                  className="w-full h-48 object-cover rounded-xl border border-slate-100"
                />
              </div>
            </section>
          )}

          <section className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-3">About</h2>
            {event.about_event ? (
              <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{event.about_event}</p>
            ) : (
              <p className="text-slate-400 text-sm">Details will be updated soon.</p>
            )}
            <dl className="grid sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-slate-100 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400 mb-1">Language</dt>
                <dd className="text-slate-800 font-medium flex items-center gap-1.5">
                  <Languages size={14} className="text-slate-400" />
                  {event.language || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400 mb-1">Age group</dt>
                <dd className="text-slate-800 font-medium flex items-center gap-1.5">
                  <Users size={14} className="text-slate-400" />
                  {event.age_group || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400 mb-1">Duration</dt>
                <dd className="text-slate-800 font-medium flex items-center gap-1.5">
                  <Clock size={14} className="text-slate-400" />
                  {event.duration_minutes ? `${event.duration_minutes} min` : "—"}
                </dd>
              </div>
            </dl>
          </section>

          {genres.length > 0 && (
            <section className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-3">Genres</h2>
              <div className="flex flex-wrap gap-2">
                {genres.map((g) => (
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
            {showtimes.length > 0 ? (
              <ul className="space-y-4">
                {showtimes.map((s) => {
                  const mapsQuery = [s.venue_name, s.venue_address].filter(Boolean).join(", ");
                  const mapsUrl = mapsQuery
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
                    : null;
                  const isPast = new Date(s.starts_at).getTime() < Date.now();
                  return (
                    <li
                      key={s.id}
                      className={`border border-slate-100 rounded-xl p-4 ${isPast ? "opacity-60" : "bg-slate-50/60"}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {s.venue_name || "Venue TBA"}
                          </p>
                          {s.venue_address && (
                            <p className="text-sm text-slate-500 mt-0.5 flex items-start gap-1.5">
                              <MapPin size={14} className="mt-0.5 shrink-0" />
                              {s.venue_address}
                            </p>
                          )}
                          <p className="text-sm text-slate-700 mt-2 flex items-center gap-1.5">
                            <CalendarDays size={14} className="text-slate-400" />
                            {formatDateTime12h(s.starts_at)}
                            {s.ends_at ? ` → ${formatDateTime12h(s.ends_at)}` : ""}
                          </p>
                          {isPast && (
                            <p className="text-xs text-slate-400 mt-1">This show has ended</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {mapsUrl && (
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1"
                            >
                              Directions <ExternalLink size={12} />
                            </a>
                          )}
                          {canBook && !isPast && (
                            <button
                              type="button"
                              onClick={() => openCheckout(s.id)}
                              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                            >
                              Book this show
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-slate-500 text-sm">Showtimes coming soon.</p>
            )}
          </section>

          {(event.organizer_name || event.organizer_phone || event.organizer_address) && (
            <section className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-3">Organizer</h2>
              <p className="font-semibold text-slate-800">{event.organizer_name || "—"}</p>
              {event.organizer_address && (
                <p className="text-sm text-slate-500 mt-1 flex items-start gap-1.5">
                  <MapPin size={14} className="mt-0.5 shrink-0" />
                  {event.organizer_address}
                </p>
              )}
              {event.organizer_phone && (
                <p className="text-sm text-slate-600 mt-1 flex items-center gap-1.5">
                  <Phone size={14} />
                  {event.organizer_phone}
                </p>
              )}
            </section>
          )}

          {offers.length > 0 && (
            <section className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Tag size={18} className="text-violet-600" /> Offers
              </h2>
              <ul className="space-y-3">
                {offers.map((o) => (
                  <li
                    key={o.id}
                    className="rounded-xl border border-violet-100 bg-violet-50/50 p-4"
                  >
                    <p className="font-semibold text-slate-900">{o.title}</p>
                    {o.description && (
                      <p className="text-sm text-slate-600 mt-1">{o.description}</p>
                    )}
                    <p className="text-sm font-bold text-violet-700 mt-2">
                      {o.discount_type === "PERCENT"
                        ? `${o.discount_value}% off`
                        : `₹${Number(o.discount_value).toLocaleString("en-IN")} off`}
                      {o.promo_code ? ` · Use code ${o.promo_code}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <EventReviewsSection
            eventId={id}
            eventRating={(event as { rating?: number }).rating}
            reviewsCount={(event as { reviews_count?: number }).reviews_count}
          />
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 sticky top-24">
            {minPrice !== null && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Starting from</p>
                <p className="text-2xl font-black text-slate-900">{formatInr(minPrice)}</p>
              </div>
            )}

            <dl className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Languages size={15} className="text-slate-400" />
                {event.language || "Language TBA"}
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Users size={15} className="text-slate-400" />
                {event.age_group || "All ages"}
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Clock size={15} className="text-slate-400" />
                {event.duration_minutes ? `${event.duration_minutes} minutes` : "Duration TBA"}
              </div>
              {nextShowtime && (
                <div className="flex items-start gap-2 text-slate-600">
                  <CalendarDays size={15} className="text-slate-400 mt-0.5 shrink-0" />
                  <span>
                    {formatDateTime12h(nextShowtime.starts_at)}
                    {nextShowtime.venue_name ? ` · ${nextShowtime.venue_name}` : ""}
                  </span>
                </div>
              )}
            </dl>

            {ticketTypes.length > 0 && (
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Ticket size={15} /> Ticket types
                </h3>
                <ul className="space-y-2">
                  {ticketTypes.map((t) => (
                    <li key={t.id} className="flex justify-between text-sm text-slate-600">
                      <span>
                        {t.ticket_type}
                        <span className="block text-[11px] text-slate-400 font-normal">
                          {Number(t.available_count) || 0} left
                        </span>
                      </span>
                      <span className="font-semibold text-slate-900">
                        {formatInr(Number(t.price) || 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              disabled={!canBook}
              onClick={() => openCheckout()}
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
          </div>
        </div>
      </div>

      <EventCheckout
        event={event}
        open={checkoutOpen}
        initialShowtimeId={selectedShowtimeId}
        onClose={() => {
          setCheckoutOpen(false);
          setSelectedShowtimeId("");
        }}
      />
    </div>
  );
}
