"use client";

import { use, useEffect, useMemo, useRef, useState, cloneElement, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  api,
  useGetPublicEventLayoutQuery,
  useGetPublicEventOffersQuery,
  useGetPublicEventQuery,
  useGetPublicEventsQuery,
  useGetEventInterestQuery,
  useGetEventInterestCountQuery,
  useToggleEventInterestMutation,
  type PublicEvent,
} from "@/services/api";
import { formatTime12h } from "@/lib/dateFormat";
import { parseEventLanguages } from "@/lib/eventValidation";
import { formatMoney, formatOfferDiscount } from "@/lib/currencyFormat";
import { readSessionForRole } from "@/lib/authStorage";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { extractApiError } from "@/lib/apiErrors";
import { toast } from "sonner";
import { EventDetailShimmer } from "@/components/Shared/Shimmer";
import EventMediaSlider from "@/components/EventLandingPage/EventMediaSlider";
import EventGallerySection from "@/components/EventLandingPage/EventGallerySection";
import EventVenuesModal from "@/components/EventLandingPage/EventVenuesModal";
import EventReviewsSection from "@/components/EventLandingPage/EventReviewsSection";
import CustomerAuthModal from "@/components/Shared/CustomerAuthModal";
import Footer from "@/components/LandingPage/Footer";

const BRAND = "#6900AA";
type StaticArtist = {
  name: string;
  role?: string;
  description?: string;
  image_url?: string;
  unauthorized?: boolean;
};

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

function formatInterestCount(count: number) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    const rounded = k >= 10 ? Math.round(k).toString() : k.toFixed(1).replace(/\.0$/, "");
    return `${rounded}k`;
  }
  const m = n / 1_000_000;
  return `${m.toFixed(1).replace(/\.0$/, "")}m`;
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
    <div className="flex items-start gap-2.5 sm:gap-3 py-2 sm:py-2.5">
      <span className="mt-0.5 w-5 shrink-0 text-[#9AA0A6] flex justify-center">{icon}</span>
      <div className="min-w-0 text-[1rem] sm:text-[1.0625rem] lg:text-[1.125rem] font-medium text-[#1A1A1A] leading-snug break-words">
        {children}
      </div>
    </div>
  );
}

function RelatedCard({ event }: { event: PublicEvent }) {
  const image = event.poster_vertical_url || event.poster_horizontal_url;
  const subtitle = event.category_name || formatLongDate(event.next_showtime);
  return (
    <Link
      href={`/events/${event.id}`}
      className="snap-start shrink-0 w-[148px] sm:w-[176px] lg:w-[196px] 2xl:w-[210px] group"
    >
      <div className="relative h-[208px] sm:h-[248px] lg:h-[264px] 2xl:h-[280px] rounded-xl overflow-hidden bg-slate-200">
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
      <p className="mt-2 sm:mt-2.5 font-bold text-[#1A1A1A] text-[1rem] sm:text-[1.0625rem] leading-snug line-clamp-2">
        {event.name}
      </p>
      {subtitle && (
        <p className="mt-1 text-[0.875rem] sm:text-[1rem] text-[#6B6B6B] line-clamp-1">{subtitle}</p>
      )}
    </Link>
  );
}

export default function PublicEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((s) => s.auth.user);
  const authToken = useAppSelector((s) => s.auth.token);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const customerSession =
    authUser?.role === "customer" && authToken
      ? { user: authUser, token: authToken }
      : readSessionForRole("customer");
  const isCustomerLoggedIn = Boolean(customerSession?.token);
  const customerId = String(
    customerSession?.user?.customer_id || customerSession?.user?.id || ""
  );

  const { data: event, isLoading, isError } = useGetPublicEventQuery(id);
  const { data: offers = [] } = useGetPublicEventOffersQuery(id);
  const { data: layout } = useGetPublicEventLayoutQuery(id);
  const { data: allEvents = [] } = useGetPublicEventsQuery();
  const { data: interestData, refetch: refetchInterest } = useGetEventInterestQuery(
    { eventId: id, customerId },
    { skip: !isCustomerLoggedIn || !customerId }
  );
  const { data: interestCountData, refetch: refetchInterestCount } =
    useGetEventInterestCountQuery(id);
  const [toggleEventInterest, { isLoading: isTogglingInterest }] = useToggleEventInterestMutation();
  const [optimisticInterest, setOptimisticInterest] = useState<{
    eventId: string;
    customerId: string;
    interested: boolean;
    interest_count?: number;
  } | null>(null);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [artistModal, setArtistModal] = useState<StaticArtist | null>(null);
  const [venuesOpen, setVenuesOpen] = useState(false);
  const pendingInterestAfterAuthRef = useRef(false);
  const relatedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncAuth = () => {
      dispatch(loadFromStorage());
      setOptimisticInterest(null);
      dispatch(api.util.invalidateTags(["EventInterests"]));
    };
    window.addEventListener("auth_changed", syncAuth);
    return () => window.removeEventListener("auth_changed", syncAuth);
  }, [dispatch]);

  const saved =
    !isCustomerLoggedIn || !customerId
      ? false
      : optimisticInterest?.eventId === id && optimisticInterest.customerId === customerId
        ? optimisticInterest.interested
        : Boolean(interestData?.interested);

  const interestCount = useMemo(() => {
    if (
      optimisticInterest?.eventId === id &&
      typeof optimisticInterest.interest_count === "number"
    ) {
      return optimisticInterest.interest_count;
    }
    if (typeof interestData?.interest_count === "number") {
      return interestData.interest_count;
    }
    return Number(interestCountData?.interest_count) || 0;
  }, [optimisticInterest, id, interestData?.interest_count, interestCountData?.interest_count]);

  const interestCountLabel = formatInterestCount(interestCount);

  const genres = useMemo(() => parseGenres(event?.genres), [event?.genres]);
  const languages = useMemo(() => parseEventLanguages(event?.language), [event?.language]);
  const showtimes = useMemo(() => event?.showtimes || [], [event?.showtimes]);
  const ticketTypes = useMemo(() => event?.ticket_types || [], [event?.ticket_types]);
  const displayArtists = useMemo((): StaticArtist[] => {
    const rows = event?.artists || [];
    return rows.map((a) => {
      const unauthorized =
        a.artist_source === "auto_registered" ||
        a.artist_source === "external" ||
        a.artist_is_authorized === false;
      return {
        name: a.name || a.artist_business_name || "Artist",
        role: a.role_title || undefined,
        description: a.description || undefined,
        image_url: a.image_url || a.artist_business_image || undefined,
        unauthorized,
      };
    });
  }, [event?.artists]);
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

  const applyInterestToggle = async (forceInterested?: boolean) => {
    if (!customerId) {
      pendingInterestAfterAuthRef.current = true;
      setAuthModalOpen(true);
      return;
    }
    try {
      const result = await toggleEventInterest({
        eventId: id,
        customerId,
        ...(typeof forceInterested === "boolean" ? { interested: forceInterested } : {}),
      }).unwrap();
      setOptimisticInterest({
        eventId: id,
        customerId,
        interested: result.interested,
        interest_count: result.interest_count,
      });
      void refetchInterest();
      void refetchInterestCount();
      toast.success(result.interested ? "Marked as interested" : "Interest removed");
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Could not update interest. Please try again."));
    }
  };

  const toggleSave = () => {
    if (isTogglingInterest) return;
    if (!isCustomerLoggedIn || !customerId) {
      pendingInterestAfterAuthRef.current = true;
      setAuthModalOpen(true);
      return;
    }
    void applyInterestToggle();
  };

  const undoInterest = () => {
    if (isTogglingInterest) return;
    void applyInterestToggle(false);
  };

  const onAuthSuccess = () => {
    dispatch(loadFromStorage());
    setOptimisticInterest(null);
    dispatch(api.util.invalidateTags(["EventInterests"]));
    const shouldMark = pendingInterestAfterAuthRef.current;
    pendingInterestAfterAuthRef.current = false;
    if (!shouldMark) return;
    void (async () => {
      // Re-read session after login — customer id may have just been set.
      const session = readSessionForRole("customer");
      const nextCustomerId = String(session?.user?.customer_id || session?.user?.id || "");
      if (!nextCustomerId) {
        toast.error("Logged in, but could not resolve your customer account.");
        return;
      }
      try {
        const result = await toggleEventInterest({
          eventId: id,
          customerId: nextCustomerId,
          interested: true,
        }).unwrap();
        setOptimisticInterest({
          eventId: id,
          customerId: nextCustomerId,
          interested: result.interested,
          interest_count: result.interest_count,
        });
        dispatch(api.util.invalidateTags(["EventInterests"]));
        toast.success(result.interested ? "Marked as interested" : "Interest updated");
      } catch (err: unknown) {
        toast.error(extractApiError(err, "Logged in, but could not save interest."));
      }
    })();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      /* ignore */
    }
  };

  const openCheckout = (showtimeId?: string) => {
    const qs = showtimeId ? `?showtime=${encodeURIComponent(showtimeId)}` : "";
    router.push(`/events/${id}/book${qs}`);
  };

  if (isLoading) {
    return <EventDetailShimmer />;
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
  const ABOUT_PREVIEW_LEN = 160;
  const aboutLong = aboutText.length > ABOUT_PREVIEW_LEN;
  const displayAbout =
    aboutExpanded || !aboutLong
      ? aboutText
      : `${aboutText.slice(0, ABOUT_PREVIEW_LEN).replace(/\s+\S*$/, "").trim()}…`;
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
  const venueUnauthorized =
    nextShowtime?.venue_source === "auto_registered" ||
    nextShowtime?.venue_is_authorized === false ||
    nextShowtime?.venue_claim_status === "UNCLAIMED";
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
      <div className="px-3.5 sm:px-5 pt-3.5 sm:pt-4 pb-2">
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
          <MetaRow icon={<MapPin size={18} strokeWidth={1.7} />}>
            <span className="inline-flex items-start gap-1.5">
              <span className="min-w-0">{venueLabel}</span>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2B8CEE] mt-0.5 shrink-0"
                >
                  <Navigation size={14} />
                </a>
              )}
            </span>
            {venueUnauthorized && (
              <span className="block mt-1 text-[0.6875rem] sm:text-xs text-[#9AA0A6] font-normal leading-snug">
                This venue is listed by the organizer and is not platform-authorized.
              </span>
            )}
            {otherVenues.length > 0 && (
              <button
                type="button"
                onClick={() => setVenuesOpen(true)}
                className="block mt-1.5 text-[1rem] sm:text-[1.0625rem] font-semibold cursor-pointer"
                style={{ color: BRAND }}
              >
                View {otherVenues.length} Other Venue{otherVenues.length === 1 ? "" : "s"}
              </button>
            )}
          </MetaRow>
        )}
        {hasLayout && canBook && (
          <button
            type="button"
            onClick={() => openCheckout()}
            className="text-[1rem] sm:text-[1.0625rem] font-semibold cursor-pointer mb-2"
            style={{ color: BRAND }}
          >
            View seating plan
          </button>
        )}
      </div>

      {fillingFast && (
        <div className="mx-3 sm:mx-4 mb-3 flex items-start sm:items-center gap-2 rounded-md bg-[#FFF6E5] px-3 py-2 text-[0.875rem] sm:text-[0.9375rem] text-[#6B4E16]">
          <Info size={14} className="shrink-0 mt-0.5 sm:mt-0" />
          <span>
            Bookings are filling fast
            {nextShowtime?.venue_name ? ` for ${nextShowtime.venue_name}` : ""}
          </span>
        </div>
      )}

      <div className="border-t border-[#EEE] px-3.5 sm:px-5 py-3.5 sm:py-4 flex items-center gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          {minPrice != null && Number.isFinite(minPrice) && (
            <p className="text-[1rem] sm:text-[1.0625rem] lg:text-[1.125rem] font-extrabold text-[#1A1A1A] leading-tight">
              {formatMoney(minPrice, { compact: true })} onwards
            </p>
          )}
          {fillingFast && (
            <p className="mt-1 text-[0.8125rem] sm:text-[0.875rem] font-semibold text-[#C47A2C]">
              Filling Fast
            </p>
          )}
          {soldOut && !fillingFast && (
            <p className="mt-1 text-[0.8125rem] sm:text-[0.875rem] font-semibold text-red-600">Sold out</p>
          )}
        </div>
        <button
          type="button"
          disabled={!canBook}
          onClick={() => openCheckout()}
          className={`shrink-0 min-w-[7.5rem] sm:min-w-[8.75rem] px-4 sm:px-5 py-2.5 sm:py-3 rounded-[0.5rem] font-bold text-[0.9375rem] sm:text-[1rem] ${
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
      <div className="max-w-[1180px] 2xl:max-w-[1320px] mx-auto px-3 sm:px-6 lg:px-8 2xl:px-10 pt-4 sm:pt-6 lg:pt-7 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-10">
        <div className="flex items-start justify-between gap-3 sm:gap-4 mb-3 sm:mb-4 lg:mb-5">
          <h1 className="min-w-0 text-[1.75rem] sm:text-[2rem] lg:text-[2.25rem] 2xl:text-[2.5rem] font-extrabold text-[#1A1A1A] leading-tight tracking-tight break-words">
            {event.name}
          </h1>
          <button
            type="button"
            aria-label="Share"
            onClick={() => setShareOpen(true)}
            className="mt-0.5 sm:mt-1.5 shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-full border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-50 cursor-pointer"
          >
            <Share2 size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px] gap-5 sm:gap-6 lg:gap-8 2xl:gap-10">
          <div className="min-w-0">
            <EventMediaSlider
              eventName={event.name}
              posterHorizontal={event.poster_horizontal_url}
              posterVertical={event.poster_vertical_url}
              youtubeUrl={event.youtube_url}
            />

            <div className="mt-3 sm:mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
                {categoryBadges.map((badge) => (
                  <span
                    key={badge}
                    className="inline-flex items-center rounded-full bg-[#1B365D] text-white text-[0.875rem] sm:text-[1rem] font-semibold px-3 sm:px-3.5 py-1.5"
                  >
                    {badge}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-3 sm:gap-4 sm:ml-auto shrink-0 min-w-0">
                {saved ? (
                  <div className="flex items-center gap-3 sm:gap-5 min-w-0">
                    <span className="inline-flex items-center gap-2 text-[1rem] sm:text-[1.0625rem] font-medium text-[#333333] min-w-0">
                      <ThumbsUp size={18} className="text-[#2E7D32] shrink-0" fill="#2E7D32" />
                      <span className="truncate">
                        {interestCount <= 1
                          ? "You are interested"
                          : `You & ${interestCountLabel} are interested`}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={undoInterest}
                      disabled={isTogglingInterest}
                      className="shrink-0 rounded-lg border px-3.5 sm:px-4 py-1.5 sm:py-2 text-[0.9375rem] sm:text-[1rem] font-semibold cursor-pointer disabled:opacity-60 hover:bg-[#F6EBFF] transition-colors"
                      style={{
                        color: BRAND,
                        borderColor: BRAND,
                        backgroundColor: "transparent",
                      }}
                    >
                      Undo
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                    {interestCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-[0.9375rem] sm:text-[1rem] font-medium text-[#5A5A5A]">
                        <ThumbsUp size={15} className="text-[#2E7D32] shrink-0" fill="#2E7D32" />
                        {interestCountLabel} interested
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={toggleSave}
                      disabled={isTogglingInterest}
                      className="rounded-lg border px-3.5 sm:px-4 py-2 text-[1rem] sm:text-[1.0625rem] font-semibold cursor-pointer disabled:opacity-60"
                      style={{
                        color: BRAND,
                        borderColor: BRAND,
                        backgroundColor: "transparent",
                      }}
                    >
                      I&apos;m Interested
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:hidden mt-4 sm:mt-5">{bookingCard}</div>

            {aboutText && (
              <section className="mt-6 sm:mt-8 lg:mt-9">
                <h2 className="text-[1.25rem] sm:text-[1.375rem] lg:text-[1.5rem] font-bold text-[#1A1A1A] mb-2.5 sm:mb-3">
                  About The Event
                </h2>
                <p className="text-[1rem] sm:text-[1.0625rem] lg:text-[1.125rem] leading-7 sm:leading-[1.7] lg:leading-8 text-[#5A5A5A] whitespace-pre-wrap">
                  {displayAbout}
                  {aboutLong && (
                    <>
                      {" "}
                      <button
                        type="button"
                        onClick={() => setAboutExpanded((v) => !v)}
                        className="font-semibold cursor-pointer hover:underline"
                        style={{ color: BRAND }}
                      >
                        {aboutExpanded ? "Read Less" : "Read More"}
                      </button>
                    </>
                  )}
                </p>
              </section>
            )}

            {displayArtists.length > 0 && (
            <section className="mt-6 sm:mt-8 lg:mt-9">
              <h2 className="text-[1.25rem] sm:text-[1.375rem] lg:text-[1.5rem] font-bold text-[#1A1A1A] mb-2.5 sm:mb-3">
                Artists
              </h2>
              <div className="flex gap-3 sm:gap-4 lg:gap-5 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {displayArtists.map((artist, i) => (
                  <button
                    key={`${artist.name}-${i}`}
                    type="button"
                    onClick={() => setArtistModal(artist)}
                    className="w-[128px] sm:w-[148px] lg:w-[156px] 2xl:w-[164px] shrink-0 text-left cursor-pointer"
                  >
                    <div className="relative h-[160px] sm:h-[188px] lg:h-[196px] 2xl:h-[208px] rounded-xl overflow-hidden bg-slate-200">
                      {artist.image_url ? (
                        <img src={artist.image_url} alt={artist.name} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-[1.375rem] sm:text-[1.625rem] font-extrabold text-white bg-[#1B365D]">
                          {artist.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <p className="mt-1.5 sm:mt-2 font-bold text-[#1A1A1A] text-[1rem] sm:text-[1.0625rem] leading-snug">
                      {artist.name}
                    </p>
                    {artist.role && (
                      <p className="mt-0.5 text-[0.875rem] sm:text-[1rem] text-[#8A8A8A]">{artist.role}</p>
                    )}
                    {artist.unauthorized && (
                      <p className="mt-0.5 text-[0.6875rem] sm:text-xs text-[#9AA0A6] leading-snug">
                        Not platform-authorized
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </section>
            )}

            {offers.length > 0 && (
              <section className="mt-6 sm:mt-8 lg:mt-9">
                <h2 className="text-[1.25rem] sm:text-[1.375rem] lg:text-[1.5rem] font-bold text-[#1A1A1A] mb-2.5 sm:mb-3">
                  Offers
                </h2>
                <ul className="space-y-2.5 sm:space-y-3">
                  {offers.map((o) => (
                    <li
                      key={o.id}
                      className="rounded-xl border border-dashed border-[#E3BCFF] bg-[#FBF6FF] p-3.5 sm:p-4"
                    >
                      <p className="font-bold text-[#1A1A1A] text-[1rem] sm:text-[1.0625rem] lg:text-[1.125rem]">{o.title}</p>
                      {o.description && (
                        <p className="text-[1rem] sm:text-[1.0625rem] text-slate-600 mt-1">{o.description}</p>
                      )}
                      <p className="text-[1rem] sm:text-[1.0625rem] font-bold mt-2" style={{ color: BRAND }}>
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

            <EventGallerySection eventName={event.name} images={event.gallery_images || []} />

            {termLines.length > 0 && (
              <button
                type="button"
                onClick={() => setTermsOpen(true)}
                className="mt-3 sm:mt-4 flex w-full items-center justify-between py-3.5 sm:py-4 border-t border-slate-200 cursor-pointer"
              >
                <span className="text-[1.125rem] sm:text-[1.25rem] font-bold text-[#1A1A1A]">Terms &amp; Conditions</span>
                <ChevronRight size={18} className="text-slate-400 shrink-0" />
              </button>
            )}

            <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-slate-200">
              <EventReviewsSection
                eventId={id}
                eventRating={event.rating}
                reviewsCount={event.reviews_count}
              />
            </div>

            {related.length > 0 && (
              <section className="mt-8 sm:mt-10 pt-5 sm:pt-6 border-t border-slate-200">
                <h2 className="text-[1.25rem] sm:text-[1.375rem] lg:text-[1.5rem] font-bold text-[#1A1A1A]">
                  You May Also Like
                </h2>
                <p className="text-[1rem] sm:text-[1.0625rem] text-[#6B6B6B] mt-1 mb-3 sm:mb-4">
                  Events around you, book now.
                </p>
                <div className="relative">
                  <div
                    ref={relatedRef}
                    className="flex gap-3 sm:gap-4 overflow-x-auto scroll-smooth pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {related.map((e) => (
                      <RelatedCard key={e.id} event={e} />
                    ))}
                  </div>
                  {related.length > 3 && (
                    <button
                      type="button"
                      aria-label="Next recommendations"
                      onClick={() => relatedRef.current?.scrollBy({ left: 220, behavior: "smooth" })}
                      className="hidden lg:flex absolute -right-2 2xl:-right-3 top-[98px] sm:top-[118px] lg:top-[126px] 2xl:top-[134px] -translate-y-1/2 w-9 h-9 2xl:w-10 2xl:h-10 rounded-full bg-[#3A3A3A] text-white items-center justify-center cursor-pointer"
                    >
                      <ChevronRight size={16} />
                    </button>
                  )}
                </div>
              </section>
            )}

            <nav className="mt-8 sm:mt-10 text-[0.875rem] sm:text-[1rem] text-[#8A8A8A] break-words leading-relaxed">
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

          <aside className="hidden lg:block lg:sticky lg:top-20 2xl:top-24 lg:self-start lg:z-20">
            {cloneElement(bookingCard)}
          </aside>
        </div>
      </div>

      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-3 sm:px-4 pt-2.5 sm:pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {minPrice != null && Number.isFinite(minPrice) && (
            <p className="text-[1rem] sm:text-[1.0625rem] font-extrabold text-[#1A1A1A] leading-tight truncate">
              {formatMoney(minPrice, { compact: true })} onwards
            </p>
          )}
          {fillingFast && (
            <p className="mt-0.5 text-[0.8125rem] sm:text-[0.875rem] font-semibold text-[#C47A2C]">Filling Fast</p>
          )}
        </div>
        <button
          type="button"
          disabled={!canBook}
          onClick={() => openCheckout()}
          className={`shrink-0 min-w-[7.5rem] px-5 sm:px-6 py-2.5 rounded-[0.5rem] font-bold text-[0.9375rem] sm:text-[1rem] ${
            canBook ? "text-white cursor-pointer" : "bg-slate-200 text-slate-500 cursor-not-allowed"
          }`}
          style={canBook ? { backgroundColor: BRAND } : undefined}
        >
          {bookLabel}
        </button>
      </div>

      {shareOpen && (
        <div className="fixed inset-0 z-[70] bg-black/40 p-3 sm:p-4" onClick={() => setShareOpen(false)} role="presentation">
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(100%,24rem)] rounded-2xl bg-white p-4 sm:p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#1A1A1A] text-[1.125rem] sm:text-[1.25rem]">Share this event</h3>
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
          className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/55"
          onClick={() => setArtistModal(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="artist-modal-name"
            className="relative w-full sm:max-w-[380px] max-h-[92vh] sm:max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl"
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
            <div className="overflow-y-auto max-h-[92vh] sm:max-h-[90vh] px-5 sm:px-6 pt-5 sm:pt-6 pb-6 sm:pb-7">
              <div className="w-[180px] sm:w-[220px] mx-auto aspect-square rounded-xl overflow-hidden bg-slate-200">
                {artistModal.image_url ? (
                  <img src={artistModal.image_url} alt={artistModal.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[1.875rem] sm:text-[2.25rem] font-extrabold text-white bg-[#1B365D]">
                    {artistModal.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <h2 id="artist-modal-name" className="mt-4 text-[1.375rem] sm:text-[1.625rem] font-extrabold text-[#1A1A1A] leading-tight">
                {artistModal.name}
              </h2>
              {artistModal.role && (
                <p className="mt-1 text-[1rem] sm:text-[1.0625rem] text-[#8A8A8A]">{artistModal.role}</p>
              )}
              {artistModal.unauthorized && (
                <p className="mt-1 text-[0.6875rem] sm:text-xs text-[#9AA0A6] leading-snug">
                  This artist is listed by the organizer and is not platform-authorized.
                </p>
              )}
              {artistModal.description && (
                <p className="mt-3 sm:mt-4 text-[1rem] sm:text-[1.0625rem] lg:text-[1.125rem] leading-7 sm:leading-[1.7] text-[#333] whitespace-pre-wrap">
                  {artistModal.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {termsOpen && termLines.length > 0 && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/55"
          onClick={() => setTermsOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-terms-title"
            className="relative w-full sm:max-w-[560px] max-h-[90vh] sm:max-h-[85vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-5 sm:px-8 pt-5 sm:pt-7 pb-2">
              <h2 id="event-terms-title" className="text-[1.375rem] sm:text-[1.625rem] lg:text-[1.875rem] font-extrabold text-[#333] leading-tight pr-8">
                Terms &amp; Conditions
              </h2>
              <button
                type="button"
                aria-label="Close terms"
                onClick={() => setTermsOpen(false)}
                className="absolute top-4 right-4 sm:top-6 sm:right-6 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8E8E8] text-[#555] hover:bg-[#ddd] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto px-5 sm:px-8 pb-6 sm:pb-8 pt-3 max-h-[calc(90vh-5rem)] sm:max-h-[calc(85vh-5.5rem)] space-y-1.5">
              {termLines.map((line, i) => (
                <p key={`${i}-${line.slice(0, 24)}`} className="text-[1rem] sm:text-[1.0625rem] lg:text-[1.125rem] leading-7 sm:leading-[1.7] text-[#4A4A4A]">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      <CustomerAuthModal
        open={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          pendingInterestAfterAuthRef.current = false;
        }}
        onSuccess={onAuthSuccess}
      />

      <EventVenuesModal
        open={venuesOpen && otherVenues.length > 0}
        onClose={() => setVenuesOpen(false)}
        showtimes={showtimes}
      />

      <Footer />
    </div>
  );
}
