"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  FaArrowLeft,
  FaCalendarAlt,
  FaCheck,
  FaChevronDown,
  FaChevronRight,
  FaClock,
  FaFacebookF,
  FaHeart,
  FaLink,
  FaMapMarkerAlt,
  FaShareAlt,
  FaTimes,
  FaWhatsapp,
} from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import {
  useGetBusinessesQuery,
  useGetPublicEventLayoutQuery,
  useGetPublicEventOffersQuery,
  useGetPublicEventQuery,
  useGetPublicEventsQuery,
  type PublicEvent,
} from "@/services/api";
import { formatDateTime12h, formatTime12h } from "@/lib/dateFormat";
import { parseEventLanguages } from "@/lib/eventValidation";
import { formatMoney, formatOfferDiscount } from "@/lib/currencyFormat";
import EventCheckout from "@/components/EventLandingPage/EventCheckout";
import EventReviewsSection from "@/components/EventLandingPage/EventReviewsSection";
import Footer from "@/components/LandingPage/Footer";

type TabId = "about" | "schedule" | "reviews";

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

function formatDuration(minutes?: number | null) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function formatHostingSince(iso?: string | null) {
  if (!iso) return null;
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return null;
  const months = Math.max(
    1,
    Math.round((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  );
  if (months < 12) {
    return `${months} month${months === 1 ? "" : "s"}`;
  }
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (!rem) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years}y ${rem}m`;
}

const DEFAULT_EVENT_TERMS = [
  "Age Limit: 16+",
  "Tickets once booked cannot be exchanged or refunded.",
  "Seating is on a first-come-first-serve basis unless a seat is assigned.",
  "Please carry a valid ID for verification at the venue.",
  "The organizer reserves the right of admission.",
  "Recording or photography may be restricted as per venue policy.",
];

function formatLongDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ticketStatus(available: number, total: number) {
  if (available <= 0) return { label: "Sold Out", className: "text-slate-400" };
  if (total > 0 && available / total <= 0.15) return { label: "Few Left", className: "text-red-500" };
  if (available <= 10) return { label: "Few Left", className: "text-red-500" };
  return { label: "Available", className: "text-[#6900AA]" };
}

function RelatedCard({ event }: { event: PublicEvent }) {
  const image = event.poster_horizontal_url || event.poster_vertical_url;
  return (
    <Link
      href={`/events/${event.id}`}
      className="snap-start shrink-0 w-[200px] h-[260px] rounded-xl overflow-hidden relative shadow-sm"
    >
      {image ? (
        <img src={image} alt={event.name} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-slate-800" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <p className="absolute bottom-3 left-3 right-3 text-white font-extrabold text-sm leading-tight uppercase line-clamp-3">
        {event.name}
      </p>
    </Link>
  );
}

export default function PublicEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: event, isLoading, isError } = useGetPublicEventQuery(id);
  const { data: offers = [] } = useGetPublicEventOffersQuery(id);
  const { data: layout } = useGetPublicEventLayoutQuery(id);
  const { data: allEvents = [] } = useGetPublicEventsQuery();
  const { data: eventBusinesses = [] } = useGetBusinessesQuery({ module: "event" });
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState("");
  const [tab, setTab] = useState<TabId>("about");
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const relatedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = localStorage.getItem("saved_events");
    if (raw) {
      try {
        const ids: string[] = JSON.parse(raw);
        setSaved(ids.includes(id));
      } catch {
        setSaved(false);
      }
    }
  }, [id]);

  const genres = useMemo(() => parseGenres(event?.genres), [event?.genres]);
  const languages = useMemo(() => parseEventLanguages(event?.language), [event?.language]);
  const languageLabel = languages.join(", ") || "—";
  const gallery = event?.gallery_images || [];
  const showtimes = event?.showtimes || [];
  const ticketTypes = event?.ticket_types || [];
  const conveniencePct = Number(event?.convenience_fee_percent) || 0;
  const minPrice = ticketTypes.length
    ? Math.min(...ticketTypes.map((t) => Number(t.price) || 0))
    : null;
  const termsPoints = (
    event as { terms_points?: { selected?: Array<{ text?: string }>; custom?: string[] } } | undefined
  )?.terms_points;
  const termLines = [
    ...(termsPoints?.selected || []).map((t) => String(t.text || "").trim()).filter(Boolean),
    ...(termsPoints?.custom || []).map((t) => String(t).trim()).filter(Boolean),
  ];
  const displayTerms = termLines.length > 0 ? termLines : DEFAULT_EVENT_TERMS;

  useEffect(() => {
    if (!termsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTermsOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [termsOpen]);
  const nextShowtime =
    showtimes.find((s) => new Date(s.starts_at).getTime() >= Date.now()) || showtimes[0];

  const highlights = useMemo(() => {
    const points: string[] = [];
    const terms = event?.terms_points;
    terms?.selected?.forEach((p) => {
      const text = typeof p === "string" ? p : p?.text;
      if (text) points.push(text);
    });
    terms?.custom?.forEach((t) => {
      if (t) points.push(t);
    });
    if (!points.length) {
      if (event?.category_name) points.push(event.category_name);
      if (event?.age_group) points.push(event.age_group);
      if (event?.language) points.push(`Performed in ${event.language}`);
      genres.forEach((g) => points.push(g));
    }
    return points;
  }, [event, genres]);

  const related = useMemo(
    () => allEvents.filter((e) => e.id !== id).slice(0, 8),
    [allEvents, id]
  );

  const organizerBiz = useMemo(
    () => eventBusinesses.find((b) => b.id === event?.business_id),
    [eventBusinesses, event?.business_id]
  );

  const organizerEventsCount = useMemo(() => {
    const name = event?.organizer_name?.trim().toLowerCase();
    if (!name) return 1;
    const n = allEvents.filter((e) => e.organizer_name?.trim().toLowerCase() === name).length;
    return Math.max(n, 1);
  }, [allEvents, event?.organizer_name]);

  const hasLayout = Boolean(
    layout && (Array.isArray(layout) ? layout.length : layout?.seats || layout?.shapes || layout?.layout)
  );

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const toggleSave = () => {
    const raw = localStorage.getItem("saved_events");
    let ids: string[] = [];
    try {
      ids = raw ? JSON.parse(raw) : [];
    } catch {
      ids = [];
    }
    const next = saved ? ids.filter((x) => x !== id) : [...ids, id];
    localStorage.setItem("saved_events", JSON.stringify(next));
    setSaved(!saved);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      /* ignore */
    }
  };

  const addGoogleCalendar = () => {
    if (!event || !nextShowtime) return;
    const start = new Date(nextShowtime.starts_at);
    const end = nextShowtime.ends_at
      ? new Date(nextShowtime.ends_at)
      : new Date(start.getTime() + (event.duration_minutes || 60) * 60000);
    const fmt = (d: Date) =>
      d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      event.name
    )}&dates=${fmt(start)}/${fmt(end)}&location=${encodeURIComponent(
      [nextShowtime.venue_name, nextShowtime.venue_address].filter(Boolean).join(", ")
    )}`;
    window.open(url, "_blank");
  };

  const openCheckout = (showtimeId?: string) => {
    setSelectedShowtimeId(showtimeId || "");
    setCheckoutOpen(true);
  };

  if (isLoading) {
    return <div className="text-center py-20 text-slate-500">Loading event...</div>;
  }

  if (isError || !event) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-600 mb-4">Event not found or not available.</p>
        <Link href="/events" className="text-[#6900AA] font-medium">
          Browse all events
        </Link>
      </div>
    );
  }

  const poster = event.poster_horizontal_url || event.poster_vertical_url;
  const heroBg = event.poster_vertical_url || event.poster_horizontal_url;
  const aboutText = event.about_event || "";
  const aboutLong = aboutText.length > 280;
  const displayAbout = aboutExpanded || !aboutLong ? aboutText : `${aboutText.slice(0, 280)}...`;
  const durationLabel = formatDuration(event.duration_minutes);
  const isLive = event.status === "LIVE";
  const hasShowtimes = showtimes.length > 0;
  const hasTickets = ticketTypes.some((t) => Number(t.available_count) > 0);
  const canBook = (isLive || event.status === "APPROVED") && hasShowtimes && hasTickets;

  const tabs: { id: TabId; label: string }[] = [
    { id: "about", label: "About" },
    { id: "schedule", label: "Schedule" },
    { id: "reviews", label: "Reviews" },
  ];

  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      <section className="relative overflow-hidden">
        {heroBg && (
          <img src={heroBg} alt="" className="absolute inset-0 w-full h-full object-cover scale-110 blur-md" />
        )}
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
          <div className="flex items-center justify-between mb-6">
            <Link href="/events" className="text-white/90 hover:text-white" aria-label="Back">
              <FaArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSave}
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm px-3 py-1.5 rounded-lg cursor-pointer"
              >
                <FaHeart className={saved ? "text-red-400" : ""} />
                Save
              </button>
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm px-3 py-1.5 rounded-lg cursor-pointer"
              >
                <FaShareAlt />
                Share
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-8 items-start">
            {poster && (
              <div className="relative w-48 sm:w-56 shrink-0 rounded-xl overflow-hidden shadow-2xl">
                <img src={poster} alt={event.name} className="w-full aspect-[3/4] object-cover" />
              </div>
            )}
            <div className="text-white pt-1">
              <h1 className="text-2xl sm:text-4xl font-extrabold uppercase tracking-tight">
                {event.name}
              </h1>
              <div className="mt-5 space-y-2.5 text-sm sm:text-base text-white/90">
                {nextShowtime && (
                  <p className="flex items-center gap-2.5">
                    <FaCalendarAlt className="text-white/70" />
                    {formatLongDate(nextShowtime.starts_at)}
                  </p>
                )}
                {nextShowtime && (
                  <p className="flex items-center gap-2.5">
                    <FaClock className="text-white/70" />
                    {formatTime12h(nextShowtime.starts_at)} Onwards
                    {durationLabel ? ` · ${durationLabel}` : ""}
                  </p>
                )}
                {nextShowtime?.venue_name && (
                  <p className="flex items-start gap-2.5">
                    <FaMapMarkerAlt className="text-white/70 mt-1 shrink-0" />
                    <span>
                      {nextShowtime.venue_name}
                      {nextShowtime.venue_address ? `, ${nextShowtime.venue_address}` : ""}
                    </span>
                  </p>
                )}
              </div>
              {event.category_name && (
                <span className="mt-4 inline-block px-3 py-1 rounded-full border border-white/40 text-sm">
                  {event.category_name}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6 min-w-0">
          <section className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Select Tickets</h2>
              {hasLayout && (
                <button
                  type="button"
                  onClick={() => openCheckout()}
                  className="text-sm font-semibold text-[#6900AA] hover:underline cursor-pointer"
                >
                  View Seating Plan
                </button>
              )}
            </div>
            {ticketTypes.length === 0 ? (
              <p className="text-sm text-slate-500">Tickets will be listed soon.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {ticketTypes.map((t) => {
                  const available = Number(t.available_count) || 0;
                  const total = Number(t.total_count) || 0;
                  const status = ticketStatus(available, total);
                  return (
                    <div
                      key={t.id}
                      className="rounded-xl border border-slate-100 px-3 py-3 text-center"
                    >
                      <p className="font-semibold text-slate-900 text-sm">{t.ticket_type}</p>
                      {t.venue_name && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{t.venue_name}</p>
                      )}
                      <p className={`text-xs font-medium mt-0.5 ${status.className}`}>{status.label}</p>
                      <p className="font-bold text-slate-900 mt-2 text-sm">
                        {formatMoney(Number(t.price) || 0, { compact: true })}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              disabled={!canBook}
              onClick={() => openCheckout()}
              className={`mt-4 w-full py-3 rounded-xl font-semibold text-sm ${
                canBook
                  ? "bg-[#6900AA] hover:bg-[#57008E] text-white cursor-pointer"
                  : "bg-slate-200 text-slate-500 cursor-not-allowed"
              }`}
            >
              {canBook
                ? "Book Tickets"
                : !hasShowtimes
                  ? "Showtimes coming soon"
                  : !hasTickets
                    ? "Sold out"
                    : "Booking unavailable"}
            </button>
            <p className="mt-3 text-xs text-slate-500">
              {conveniencePct > 0
                ? `${conveniencePct}% convenience fee is added at checkout.`
                : "No convenience fee is charged for this event."}
            </p>
          </section>

          {gallery.length > 0 && (
            <section className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-3">Gallery</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {gallery.map((url, i) => (
                  <div key={`${url}-${i}`} className="rounded-xl overflow-hidden h-32 border border-slate-100">
                    <img src={url} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="border-b border-slate-200 flex gap-6 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`pb-3 text-sm font-semibold whitespace-nowrap cursor-pointer ${
                  tab === t.id
                    ? "text-[#6900AA] border-b-2 border-[#6900AA]"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "about" && (
            <div className="grid md:grid-cols-2 gap-8 bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-3">About Event</h3>
                {displayAbout ? (
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{displayAbout}</p>
                ) : (
                  <p className="text-slate-400 text-sm">Details will be updated soon.</p>
                )}
                {aboutLong && (
                  <button
                    type="button"
                    onClick={() => setAboutExpanded((v) => !v)}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#6900AA] cursor-pointer"
                  >
                    {aboutExpanded ? "Show Less" : "Show More"}
                    <FaChevronDown className={aboutExpanded ? "rotate-180" : ""} size={11} />
                  </button>
                )}
                <dl className="grid sm:grid-cols-2 gap-3 mt-5 pt-5 border-t border-slate-100 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400 mb-1">Language</dt>
                    <dd className="text-slate-800 font-medium">{languageLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400 mb-1">Age group</dt>
                    <dd className="text-slate-800 font-medium">{event.age_group || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400 mb-1">Duration</dt>
                    <dd className="text-slate-800 font-medium">{durationLabel || "—"}</dd>
                  </div>
                </dl>
                {genres.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {genres.map((g) => (
                      <span
                        key={g}
                        className="px-3 py-1 rounded-full bg-violet-50 text-violet-700 text-sm font-medium"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {highlights.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3">Highlights</h3>
                  <ul className="space-y-2">
                    {highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2 text-sm text-slate-700">
                        <FaCheck className="text-[#6900AA] mt-0.5 shrink-0" size={12} />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {tab === "schedule" && (
            <section className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Showtimes & venues</h2>
              {showtimes.length > 0 ? (
                <ul className="space-y-4">
                  {showtimes.map((s) => {
                    const mapsQuery = [s.venue_name, s.venue_address].filter(Boolean).join(", ");
                    const mapsUrl = mapsQuery
                      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
                      : null;
                    const isPast = new Date(s.starts_at).getTime() < Date.now();
                    const venueTickets =
                      s.ticket_types?.length
                        ? s.ticket_types
                        : ticketTypes.filter((t) => !t.showtime_id || t.showtime_id === s.id);
                    return (
                      <li
                        key={s.id}
                        className={`border border-slate-100 rounded-xl p-4 ${isPast ? "opacity-60" : "bg-slate-50/60"}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{s.venue_name || "Venue TBA"}</p>
                            {s.venue_address && (
                              <p className="text-sm text-slate-500 mt-0.5 flex items-start gap-1.5">
                                <FaMapMarkerAlt className="mt-0.5 shrink-0" />
                                {s.venue_address}
                              </p>
                            )}
                            <p className="text-sm text-slate-700 mt-2 flex items-center gap-1.5">
                              <FaCalendarAlt className="text-slate-400" />
                              {formatDateTime12h(s.starts_at)}
                              {s.ends_at ? ` → ${formatDateTime12h(s.ends_at)}` : ""}
                            </p>
                            {venueTickets.length > 0 && (
                              <ul className="mt-2 flex flex-wrap gap-1.5">
                                {venueTickets.map((t) => (
                                  <li
                                    key={`${s.id}-${t.ticket_type}-${t.price}`}
                                    className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700"
                                  >
                                    {t.ticket_type} · {formatMoney(t.price, { compact: true })}
                                  </li>
                                ))}
                              </ul>
                            )}
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
                                className="text-sm font-semibold text-[#6900AA]"
                              >
                                Get Directions
                              </a>
                            )}
                            {!isPast && canBook && (
                              <button
                                type="button"
                                onClick={() => openCheckout(s.id)}
                                className="px-3 py-1.5 rounded-lg bg-[#6900AA] text-white text-xs font-bold cursor-pointer"
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
          )}

          {tab === "reviews" && (
            <EventReviewsSection
              eventId={id}
              eventRating={event.rating}
              reviewsCount={event.reviews_count}
            />
          )}

          {offers.length > 0 && (
            <section className="bg-white rounded-2xl border border-slate-100 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Offers</h2>
              <ul className="space-y-3">
                {offers.map((o) => (
                  <li key={o.id} className="rounded-xl border border-[#E3BCFF] bg-[#F7E9FF] p-4">
                    <p className="font-semibold text-slate-900">{o.title}</p>
                    {o.description && <p className="text-sm text-slate-600 mt-1">{o.description}</p>}
                    <p className="text-sm font-bold text-[#6900AA] mt-2">
                      {o.discount_type === "PERCENT"
                        ? `${o.discount_value}% off`
                        : formatOfferDiscount(o.discount_type, o.discount_value)}
                      {o.promo_code ? ` · Use code ${o.promo_code}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 self-start h-fit">
          {minPrice !== null && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Starting from</p>
              <p className="text-2xl font-black text-slate-900">{formatMoney(minPrice, { compact: true })}</p>
              {conveniencePct > 0 && (
                <p className="text-xs text-slate-500 mt-1">+ {conveniencePct}% convenience fee at checkout</p>
              )}
            </div>
          )}
          {event.organizer_name && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-3">Organized by</h3>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col items-center min-w-0 flex-1">
                  {organizerBiz?.cover_image_url ? (
                    <img
                      src={organizerBiz.cover_image_url}
                      alt={event.organizer_name}
                      className="h-10 w-auto max-w-[88px] object-contain"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[#6900AA] text-white flex items-center justify-center font-bold text-sm">
                      {event.organizer_name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <p className="mt-2 font-bold text-slate-900 uppercase text-[11px] leading-tight text-center line-clamp-2">
                    {event.organizer_name}
                  </p>
                  {(organizerBiz?.admin_email || event.organizer_email) && (
                    <p className="mt-0.5 text-[10px] text-slate-500 break-all text-center line-clamp-2">
                      {organizerBiz?.admin_email || event.organizer_email}
                    </p>
                  )}
                </div>
                <div className="shrink-0 pl-2">
                  <p className="text-sm">
                    <span className="font-bold text-slate-900">{organizerEventsCount}</span>{" "}
                    <span className="text-slate-500">
                      {organizerEventsCount === 1 ? "event" : "events"}
                    </span>
                  </p>
                  <div className="border-t border-slate-200 my-2" />
                  {formatHostingSince(event.created_at) && (
                    <p className="text-sm">
                      <span className="font-bold text-slate-900">{formatHostingSince(event.created_at)}</span>{" "}
                      <span className="text-slate-500">hosting</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-3">Share Event</h3>
            <div className="flex items-center gap-3">
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-full bg-[#1877F2] text-white flex items-center justify-center"
                aria-label="Facebook"
              >
                <FaFacebookF size={14} />
              </a>
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(event.name)}`}
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center"
                aria-label="X"
              >
                <FaXTwitter size={13} />
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${event.name} ${shareUrl}`)}`}
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-full bg-[#25D366] text-white flex items-center justify-center"
                aria-label="WhatsApp"
              >
                <FaWhatsapp size={16} />
              </a>
              <button
                type="button"
                onClick={copyLink}
                className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
                aria-label="Copy link"
              >
                <FaLink size={13} />
              </button>
            </div>
          </div>

          {nextShowtime && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-3">Add to Calendar</h3>
              <button
                type="button"
                onClick={addGoogleCalendar}
                className="text-sm font-semibold text-[#6900AA] cursor-pointer"
              >
                Google Calendar
              </button>
            </div>
          )}
        </aside>
      </div>

      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {event.organizer_name && (
            <section className="pb-10">
              <h2 className="text-xl font-extrabold text-slate-900 mb-6">Artists Performing</h2>
              <div className="flex flex-wrap gap-8">
                <div className="flex flex-col items-center w-24">
                  {event.poster_vertical_url || event.poster_horizontal_url ? (
                    <img
                      src={event.poster_vertical_url || event.poster_horizontal_url}
                      alt={event.organizer_name}
                      className="w-20 h-20 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-[#6900AA] text-white flex items-center justify-center text-xl font-bold">
                      {event.organizer_name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <p className="mt-2 text-sm text-center text-slate-900">{event.organizer_name}</p>
                </div>
              </div>
            </section>
          )}

          <section className={event.organizer_name ? "border-t border-slate-200 pt-6 pb-6" : "pb-6"}>
            <button
              type="button"
              onClick={() => setTermsOpen(true)}
              className="flex w-full items-center justify-between gap-4 py-2 text-left cursor-pointer"
            >
              <span className="text-base font-semibold text-[#6900AA]">Terms & Conditions</span>
              <FaChevronRight size={14} className="text-[#6900AA] shrink-0" />
            </button>
          </section>

          {related.length > 0 && (
            <section className="border-t border-slate-200 pt-10 pb-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-extrabold text-slate-900">You May Also Like</h2>
                <Link href="/events" className="text-sm font-medium text-[#6900AA]">
                  View All
                </Link>
              </div>
              <div className="relative">
                <div
                  ref={relatedRef}
                  className="flex gap-4 overflow-x-auto scroll-smooth pb-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {related.map((e) => (
                    <RelatedCard key={e.id} event={e} />
                  ))}
                </div>
                {related.length > 4 && (
                  <button
                    type="button"
                    aria-label="Next recommendations"
                    onClick={() => relatedRef.current?.scrollBy({ left: 240, behavior: "smooth" })}
                    className="hidden sm:flex absolute -right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white border border-slate-200 shadow items-center justify-center text-slate-600 cursor-pointer"
                  >
                    <FaChevronRight size={14} />
                  </button>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {termsOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50"
          onClick={() => setTermsOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-terms-title"
            className="relative w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-3">
              <h2 id="event-terms-title" className="text-2xl font-bold text-slate-900">
                Terms & Conditions
              </h2>
              <button
                type="button"
                aria-label="Close terms"
                onClick={() => setTermsOpen(false)}
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 cursor-pointer"
              >
                <FaTimes size={12} />
              </button>
            </div>
            <div className="overflow-y-auto px-6 pb-4 max-h-[50vh] space-y-4">
              {displayTerms.map((line, i) => (
                <p key={`${i}-${line.slice(0, 24)}`} className="text-[15px] leading-relaxed text-slate-600">
                  {line}
                </p>
              ))}
            </div>
            <div className="px-6 py-4">
              <button
                type="button"
                onClick={() => setTermsOpen(false)}
                className="w-full rounded-xl bg-[#6900AA] py-3 text-sm font-bold text-white hover:bg-[#57008E] cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />

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
