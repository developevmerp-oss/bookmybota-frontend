"use client";

import { use, useEffect, useMemo, useRef, useState, cloneElement, type ReactNode } from "react";
import Link from "next/link";
import {
  Calendar,
  ChevronRight,
  Clock,
  Globe,
  Hourglass,
  Info,
  MapPin,
  Navigation,
  Share2,
  Theater,
  ThumbsUp,
  Users,
  X,
} from "lucide-react";
import { FaFacebookF, FaLink, FaTimes, FaWhatsapp } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import {
  useGetPublicEventLayoutQuery,
  useGetPublicEventOffersQuery,
  useGetPublicEventQuery,
  useGetPublicEventsQuery,
  type PublicEvent,
} from "@/services/api";
import { formatTime12h } from "@/lib/dateFormat";
import { parseEventLanguages } from "@/lib/eventValidation";
import { formatMoney, formatOfferDiscount } from "@/lib/currencyFormat";
import EventCheckout from "@/components/EventLandingPage/EventCheckout";
import EventMediaSlider from "@/components/EventLandingPage/EventMediaSlider";
import EventReviewsSection from "@/components/EventLandingPage/EventReviewsSection";
import Footer from "@/components/LandingPage/Footer";

const BRAND = "#6900AA";
type StaticArtist = {
  name: string;
  role?: string;
  description?: string;
  image_url?: string;
};
const DEFAULT_ARTISTS: StaticArtist[] = [
  {
    name: "Aarav Mehta",
    role: "Stand-up Comedian & Live Entertainer",
    description:
      "Aarav Mehta is known for clean observational humor and energetic live stage presence.",
    image_url:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&q=80",
  },
];

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

function formatDurationLong(minutes?: number | null) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hourPart = h ? `${h} hour${h === 1 ? "" : "s"}` : "";
  const minPart = m ? `${m} minute${m === 1 ? "" : "s"}` : "";
  return [hourPart, minPart].filter(Boolean).join(" ");
}

function formatLongDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function MetaRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-3 py-[9px]">
      <span className="mt-0.5 w-5 shrink-0 text-[#9AA0A6] flex justify-center">{icon}</span>
      <div className="min-w-0 text-[14.5px] font-medium text-[#1A1A1A] leading-snug">{children}</div>
    </div>
  );
}

function RelatedCard({ event }: { event: PublicEvent }) {
  const image = event.poster_vertical_url || event.poster_horizontal_url;
  const subtitle = event.category_name || formatLongDate(event.next_showtime);
  return (
    <Link href={`/events/${event.id}`} className="snap-start shrink-0 w-[168px] sm:w-[188px] group">
      <div className="relative h-[236px] sm:h-[252px] rounded-xl overflow-hidden bg-slate-200">
        {image ? (
          <img
            src={image}
            alt={event.name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 bg-slate-700" />
        )}
      </div>
      <p className="mt-2.5 font-bold text-[#1A1A1A] text-[13.5px] leading-snug line-clamp-2">{event.name}</p>
      {subtitle && <p className="mt-1 text-xs text-[#6B6B6B] line-clamp-1">{subtitle}</p>}
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
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState("");
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const parsed = JSON.parse(localStorage.getItem("saved_events") || "[]");
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  });
  const saved = savedIds.includes(id);
  const [shareOpen, setShareOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [artistModal, setArtistModal] = useState<StaticArtist | null>(null);
  const [venuesOpen, setVenuesOpen] = useState(false);
  const relatedRef = useRef<HTMLDivElement>(null);

  const genres = useMemo(() => parseGenres(event?.genres), [event?.genres]);
  const languages = useMemo(() => parseEventLanguages(event?.language), [event?.language]);
  const showtimes = useMemo(() => event?.showtimes || [], [event?.showtimes]);
  const ticketTypes = useMemo(() => event?.ticket_types || [], [event?.ticket_types]);
  const minPrice = ticketTypes.length
    ? Math.min(...ticketTypes.map((t) => Number(t.price) || 0))
    : null;
  const termsPoints = event?.terms_points;
  const termLines = [
    ...(termsPoints?.selected || [])
      .map((t) => (typeof t === "string" ? t : String(t?.text || "")).trim())
      .filter(Boolean),
    ...(termsPoints?.custom || []).map((t) => String(t).trim()).filter(Boolean),
  ];

  useEffect(() => {
    if (!termsOpen && !shareOpen && !artistModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTermsOpen(false);
        setShareOpen(false);
        setArtistModal(null);
      }
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [termsOpen, shareOpen, artistModal]);

  const nextShowtime = showtimes[0];
  const categoryName = event?.category_name;

  const related = useMemo(() => {
    const sameCategory = allEvents.filter(
      (e) => e.id !== id && categoryName && e.category_name === categoryName
    );
    const rest = allEvents.filter((e) => e.id !== id && !sameCategory.some((s) => s.id === e.id));
    return [...sameCategory, ...rest].slice(0, 10);
  }, [allEvents, id, categoryName]);

  const uniqueVenues = useMemo(() => {
    const map = new Map<string, { name: string; address?: string }>();
    for (const s of showtimes) {
      const name = (s.venue_name || "").trim();
      if (!name) continue;
      const key = `${name}|${(s.venue_address || "").trim()}`;
      if (!map.has(key)) map.set(key, { name, address: s.venue_address || undefined });
    }
    return [...map.values()];
  }, [showtimes]);

  const otherVenues = uniqueVenues.filter((v) => {
    const currentName = (nextShowtime?.venue_name || "").trim();
    const currentAddr = (nextShowtime?.venue_address || "").trim();
    return !(v.name === currentName && (v.address || "").trim() === currentAddr);
  });

  const fillRatio = useMemo(() => {
    const total = ticketTypes.reduce((sum, t) => sum + (Number(t.total_count) || 0), 0);
    const available = ticketTypes.reduce((sum, t) => sum + (Number(t.available_count) || 0), 0);
    if (total <= 0) return 0;
    return (total - available) / total;
  }, [ticketTypes]);
  const fillingFast = fillRatio >= 0.7 && fillRatio < 1;

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const toggleSave = () => {
    const next = saved ? savedIds.filter((x) => x !== id) : [...savedIds, id];
    localStorage.setItem("saved_events", JSON.stringify(next));
    setSavedIds(next);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      /* ignore */
    }
  };

  const openCheckout = (showtimeId?: string) => {
    setSelectedShowtimeId(showtimeId || "");
    setCheckoutOpen(true);
  };

  if (isLoading) {
    return <div className="text-center py-20 text-slate-500">Loading event...</div>;
  }

  if (isError) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-600 mb-4">Could not load this event. Please refresh the page.</p>
        <Link href="/events" className="font-medium" style={{ color: BRAND }}>
          Browse all events
        </Link>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-600 mb-4">Event not found or not available.</p>
        <Link href="/events" className="font-medium" style={{ color: BRAND }}>
          Browse all events
        </Link>
      </div>
    );
  }

  const aboutText = (event.about_event || "").trim();
  const aboutLong = aboutText.length > 280;
  const displayAbout = aboutExpanded || !aboutLong ? aboutText : `${aboutText.slice(0, 280).trim()}...`;
  const durationLabel = formatDurationLong(event.duration_minutes);
  const isLive = event.status === "LIVE";
  const hasShowtimes = showtimes.length > 0;
  const canBook =
    (isLive || event.status === "APPROVED") &&
    hasShowtimes &&
    ticketTypes.some((t) => Number(t.available_count) > 0);
  const soldOut = hasShowtimes && ticketTypes.length > 0 && !ticketTypes.some((t) => Number(t.available_count) > 0);

  const firstShow = showtimes[0];
  const lastShow = showtimes[showtimes.length - 1];
  const dateLabel =
    firstShow && lastShow && formatLongDate(firstShow.starts_at) !== formatLongDate(lastShow.starts_at)
      ? `${formatLongDate(firstShow.starts_at)} - ${formatLongDate(lastShow.starts_at)}`
      : formatLongDate(nextShowtime?.starts_at);

  const venueLabel = [nextShowtime?.venue_name, nextShowtime?.venue_address]
    .filter(Boolean)
    .join(": ");
  const mapsQuery = [nextShowtime?.venue_name, nextShowtime?.venue_address].filter(Boolean).join(", ");
  const mapsUrl = mapsQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
    : null;

  const categoryBadges = [event.category_name, ...genres].filter(
    (v, i, arr) => Boolean(v) && arr.indexOf(v) === i
  ) as string[];

  const bookLabel = canBook ? "Book Now" : soldOut ? "Sold out" : "Booking unavailable";
  const hasLayout = Boolean(
    layout && (Array.isArray(layout) ? layout.length : layout?.seats || layout?.shapes || layout?.layout)
  );

  const bookingCard = (
    <div className="bg-white rounded-xl border border-[#E8E8E8] shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="px-5 pt-4 pb-2">
        {dateLabel && (
          <MetaRow icon={<Calendar size={18} strokeWidth={1.7} />}>{dateLabel}</MetaRow>
        )}
        {nextShowtime?.starts_at && (
          <MetaRow icon={<Clock size={18} strokeWidth={1.7} />}>{formatTime12h(nextShowtime.starts_at)}</MetaRow>
        )}
        {durationLabel && (
          <MetaRow icon={<Hourglass size={18} strokeWidth={1.7} />}>{durationLabel}</MetaRow>
        )}
        {event.age_group && (
          <MetaRow icon={<Users size={18} strokeWidth={1.7} />}>Age Limit - {event.age_group}</MetaRow>
        )}
        {languages.length > 0 && (
          <MetaRow icon={<Globe size={18} strokeWidth={1.7} />}>{languages.join(", ")}</MetaRow>
        )}
        {genres.length > 0 && (
          <MetaRow icon={<Theater size={18} strokeWidth={1.7} />}>{genres.join(", ")}</MetaRow>
        )}
        {venueLabel && (
          <MetaRow
            icon={<MapPin size={18} strokeWidth={1.7} />}
          >
            <span className="inline-flex items-start gap-1.5">
              <span>{venueLabel}</span>
              {mapsUrl && (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[#2B8CEE] mt-0.5 shrink-0">
                  <Navigation size={14} />
                </a>
              )}
            </span>
            {otherVenues.length > 0 && (
              <button
                type="button"
                onClick={() => setVenuesOpen((v) => !v)}
                className="block mt-1.5 text-[13px] font-semibold cursor-pointer"
                style={{ color: BRAND }}
              >
                {venuesOpen
                  ? "Hide other venues"
                  : `View ${otherVenues.length} Other Venue${otherVenues.length === 1 ? "" : "s"}`}
              </button>
            )}
            {venuesOpen && otherVenues.length > 0 && (
              <ul className="mt-2 space-y-1.5 text-[13px] font-normal text-[#555]">
                {otherVenues.map((v) => (
                  <li key={`${v.name}-${v.address || ""}`}>
                    {v.name}
                    {v.address ? `: ${v.address}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </MetaRow>
        )}
        {hasLayout && canBook && (
          <button
            type="button"
            onClick={() => openCheckout()}
            className="text-[13px] font-semibold cursor-pointer mb-2"
            style={{ color: BRAND }}
          >
            View seating plan
          </button>
        )}
      </div>

      {fillingFast && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-md bg-[#FFF6E5] px-3 py-2 text-[13px] text-[#6B4E16]">
          <Info size={14} className="shrink-0" />
          <span>Bookings are filling fast{nextShowtime?.venue_name ? ` for ${nextShowtime.venue_name}` : ""}</span>
        </div>
      )}

      <div className="border-t border-[#EEE] px-5 py-4 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {minPrice != null && Number.isFinite(minPrice) && (
            <p className="text-[18px] font-extrabold text-[#1A1A1A] leading-none">
              {formatMoney(minPrice, { compact: true })} onwards
            </p>
          )}
          {fillingFast && <p className="mt-1.5 text-[12px] font-semibold text-[#E85D04]">Filling Fast</p>}
          {soldOut && <p className="mt-1.5 text-[12px] font-semibold text-red-600">Sold out</p>}
        </div>
        <button
          type="button"
          disabled={!canBook}
          onClick={() => openCheckout()}
          className={`shrink-0 min-w-[128px] px-5 py-2.5 rounded-lg font-bold text-sm ${
            canBook ? "text-white cursor-pointer" : "bg-slate-200 text-slate-500 cursor-not-allowed"
          }`}
          style={canBook ? { backgroundColor: BRAND } : undefined}
        >
          {bookLabel}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-5 sm:pt-7 pb-24 lg:pb-10">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-[26px] sm:text-[32px] font-extrabold text-[#1A1A1A] leading-tight">
            {event.name}
          </h1>
          <button
            type="button"
            aria-label="Share"
            onClick={() => setShareOpen(true)}
            className="mt-1.5 shrink-0 h-10 w-10 rounded-full border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-50 cursor-pointer"
          >
            <Share2 size={18} />
          </button>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 lg:gap-8">
          <div className="min-w-0">
            <EventMediaSlider
              eventName={event.name}
              posterHorizontal={event.poster_horizontal_url}
              posterVertical={event.poster_vertical_url}
              gallery={event.gallery_images}
              youtubeUrl={event.youtube_url}
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {categoryBadges.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center rounded-full bg-[#1B365D] text-white text-[12px] font-semibold px-3 py-1.5"
                >
                  {badge}
                </span>
              ))}
              <div className="ml-auto flex items-center gap-3">
                {saved && (
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#1A1A1A]">
                    <ThumbsUp size={16} className="text-[#2E7D32]" fill="#2E7D32" />
                    You&apos;re Interested
                  </span>
                )}
                <button
                  type="button"
                  onClick={toggleSave}
                  className="rounded-lg border px-3.5 py-1.5 text-[13px] font-semibold cursor-pointer"
                  style={{
                    color: BRAND,
                    borderColor: BRAND,
                    backgroundColor: saved ? "#F6EBFF" : "transparent",
                  }}
                >
                  {saved ? "Interested" : "I'm Interested"}
                </button>
              </div>
            </div>

            <div className="lg:hidden mt-5">{bookingCard}</div>

            {aboutText && (
              <section className="mt-8">
                <h2 className="text-[20px] font-bold text-[#1A1A1A] mb-3">About The Event</h2>
                <p className="text-[15px] leading-7 text-[#5A5A5A] whitespace-pre-wrap">
                  {displayAbout}
                  {aboutLong && (
                    <>
                      {" "}
                      <button
                        type="button"
                        onClick={() => setAboutExpanded((v) => !v)}
                        className="font-semibold cursor-pointer"
                        style={{ color: BRAND }}
                      >
                        {aboutExpanded ? "Read Less" : "Read More"}
                      </button>
                    </>
                  )}
                </p>
              </section>
            )}

            <section className="mt-8">
              <h2 className="text-[20px] font-bold text-[#1A1A1A] mb-3">Artists</h2>
              <div className="flex gap-5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {DEFAULT_ARTISTS.map((artist, i) => (
                  <button
                    key={`${artist.name}-${i}`}
                    type="button"
                    onClick={() => setArtistModal(artist)}
                    className="w-[140px] shrink-0 text-left cursor-pointer"
                  >
                    <div className="relative h-[180px] rounded-xl overflow-hidden bg-slate-200">
                      {artist.image_url ? (
                        <img src={artist.image_url} alt={artist.name} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-2xl font-extrabold text-white bg-[#1B365D]">
                          {artist.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <p className="mt-2 font-bold text-[#1A1A1A] text-sm leading-snug">{artist.name}</p>
                    {artist.role && <p className="mt-0.5 text-xs text-[#8A8A8A]">{artist.role}</p>}
                  </button>
                ))}
              </div>
            </section>

            {offers.length > 0 && (
              <section className="mt-8">
                <h2 className="text-[20px] font-bold text-[#1A1A1A] mb-3">Offers</h2>
                <ul className="space-y-3">
                  {offers.map((o) => (
                    <li key={o.id} className="rounded-xl border border-dashed border-[#E3BCFF] bg-[#FBF6FF] p-4">
                      <p className="font-bold text-[#1A1A1A]">{o.title}</p>
                      {o.description && <p className="text-sm text-slate-600 mt-1">{o.description}</p>}
                      <p className="text-sm font-bold mt-2" style={{ color: BRAND }}>
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

            {termLines.length > 0 && (
              <button
                type="button"
                onClick={() => setTermsOpen(true)}
                className="mt-4 flex w-full items-center justify-between py-4 border-t border-slate-200 cursor-pointer"
              >
                <span className="text-[16px] font-bold text-[#1A1A1A]">Terms &amp; Conditions</span>
                <ChevronRight size={18} className="text-slate-400" />
              </button>
            )}

            <div className="mt-6">
              <EventReviewsSection
                eventId={id}
                eventRating={event.rating}
                reviewsCount={event.reviews_count}
              />
            </div>

            {related.length > 0 && (
              <section className="mt-10 pt-6 border-t border-slate-200">
                <h2 className="text-[20px] font-bold text-[#1A1A1A]">You May Also Like</h2>
                <p className="text-sm text-[#6B6B6B] mt-1 mb-4">Events around you, book now.</p>
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
                      onClick={() => relatedRef.current?.scrollBy({ left: 220, behavior: "smooth" })}
                      className="hidden sm:flex absolute -right-3 top-[110px] -translate-y-1/2 w-10 h-10 rounded-full bg-[#3A3A3A] text-white items-center justify-center cursor-pointer"
                    >
                      <ChevronRight size={16} />
                    </button>
                  )}
                </div>
              </section>
            )}

            <nav className="mt-10 text-[12px] text-[#8A8A8A]">
              <Link href="/" className="hover:underline">
                Home
              </Link>
              <span> &gt; </span>
              <Link href="/events" className="hover:underline">
                Events
              </Link>
              {event.category_name && (
                <>
                  <span> &gt; </span>
                  <Link
                    href={`/events?category=${encodeURIComponent(event.category_name)}`}
                    className="hover:underline"
                  >
                    {event.category_name}
                  </Link>
                </>
              )}
              <span> &gt; </span>
              <span className="text-[#555]">{event.name}</span>
            </nav>
          </div>

          <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start lg:z-20">
            {cloneElement(bookingCard)}
          </aside>
        </div>
      </div>

      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 px-4 py-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {minPrice != null && Number.isFinite(minPrice) && (
            <p className="font-extrabold text-[#1A1A1A]">{formatMoney(minPrice, { compact: true })} onwards</p>
          )}
          {fillingFast && <p className="text-[11px] font-semibold text-[#E85D04]">Filling Fast</p>}
        </div>
        <button
          type="button"
          disabled={!canBook}
          onClick={() => openCheckout()}
          className={`shrink-0 px-6 py-2.5 rounded-lg font-bold text-sm ${
            canBook ? "text-white cursor-pointer" : "bg-slate-200 text-slate-500 cursor-not-allowed"
          }`}
          style={canBook ? { backgroundColor: BRAND } : undefined}
        >
          {bookLabel}
        </button>
      </div>

      {shareOpen && (
        <div className="fixed inset-0 z-[70] bg-black/40" onClick={() => setShareOpen(false)} role="presentation">
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#1A1A1A]">Share this event</h3>
              <button type="button" onClick={() => setShareOpen(false)} className="cursor-pointer text-slate-500">
                <FaTimes />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-full bg-[#1877F2] text-white flex items-center justify-center"
              >
                <FaFacebookF size={14} />
              </a>
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(event.name)}`}
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center"
              >
                <FaXTwitter size={13} />
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${event.name} ${shareUrl}`)}`}
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center"
              >
                <FaWhatsapp size={16} />
              </a>
              <button
                type="button"
                onClick={copyLink}
                className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <FaLink size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {artistModal && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/55"
          onClick={() => setArtistModal(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="artist-modal-name"
            className="relative w-full max-w-[380px] max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close artist"
              onClick={() => setArtistModal(null)}
              className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-[#E8E8E8] text-[#555] flex items-center justify-center cursor-pointer hover:bg-[#ddd]"
            >
              <X size={16} />
            </button>
            <div className="overflow-y-auto max-h-[90vh] px-6 pt-6 pb-7">
              <div className="w-[220px] mx-auto aspect-square rounded-xl overflow-hidden bg-slate-200">
                {artistModal.image_url ? (
                  <img src={artistModal.image_url} alt={artistModal.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl font-extrabold text-white bg-[#1B365D]">
                    {artistModal.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <h2 id="artist-modal-name" className="mt-4 text-[22px] font-extrabold text-[#1A1A1A] leading-tight">
                {artistModal.name}
              </h2>
              {artistModal.role && (
                <p className="mt-1 text-sm text-[#8A8A8A]">{artistModal.role}</p>
              )}
              {artistModal.description && (
                <p className="mt-4 text-[15px] leading-7 text-[#333] whitespace-pre-wrap">
                  {artistModal.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {termsOpen && termLines.length > 0 && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6 bg-black/55"
          onClick={() => setTermsOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-terms-title"
            className="relative w-full max-w-[560px] max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-7 sm:px-8 pt-7 pb-2">
              <h2 id="event-terms-title" className="text-[26px] sm:text-[28px] font-extrabold text-[#333] leading-tight pr-8">
                Terms &amp; Conditions
              </h2>
              <button
                type="button"
                aria-label="Close terms"
                onClick={() => setTermsOpen(false)}
                className="absolute top-6 right-6 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8E8E8] text-[#555] hover:bg-[#ddd] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto px-7 sm:px-8 pb-8 pt-3 max-h-[calc(85vh-5.5rem)] space-y-1.5">
              {termLines.map((line, i) => (
                <p key={`${i}-${line.slice(0, 24)}`} className="text-[15px] leading-6 text-[#4A4A4A]">
                  {line}
                </p>
              ))}
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
