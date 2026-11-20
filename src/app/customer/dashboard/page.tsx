"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Loader2,
  MapPin,
  Ticket,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetCustomerBookingsQuery,
  useGetCustomerEventBookingsQuery,
  useGetCustomerMovieBookingsQuery,
  useCancelBookingMutation,
  useCancelEventBookingMutation,
  Booking,
  EventBooking,
} from "@/services/api";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { extractApiError } from "@/lib/apiErrors";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import CustomerAccountLayout from "@/components/Shared/CustomerAccountLayout";
import {
  CustomerOrdersCardsShimmer,
  CustomerOrdersListShimmer,
} from "@/components/Shared/Shimmer";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { formatDateCustomer, formatTime12h, formatWeekdayCustomer } from "@/lib/dateFormat";
import { useStickyHeaderOffset } from "@/lib/useStickyHeaderOffset";
import { PAGE_SIZE } from "@/lib/pagination";

const DEFAULT_DINING_IMAGE =
  "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80";
const DEFAULT_EVENT_IMAGE =
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80";
const DEFAULT_MOVIE_IMAGE =
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80";

const ORDERS_PAGE_SIZE = PAGE_SIZE;

type KindTab = "all" | "dining" | "event" | "movie" | "sports";
type StatusTab = "all" | "upcoming" | "past" | "cancelled";

type UnifiedBooking = {
  kind: "dining" | "event" | "movie";
  id: string;
  title: string;
  when: string;
  endTime?: string | null;
  status: string;
  href: string;
  address?: string;
  extra?: string;
  image?: string;
  canCancel: boolean;
  guests?: number;
  ticketQty?: number;
  createdAt?: string;
};

function diningUpcoming(b: Booking) {
  return new Date(b.booking_time) > new Date() && b.status === "CONFIRMED";
}

function eventUpcoming(b: EventBooking) {
  if (!b.starts_at || b.status !== "CONFIRMED") return false;
  const starts = new Date(String(b.starts_at).replace(" ", "T"));
  return !Number.isNaN(starts.getTime()) && starts > new Date();
}

function formatDateTimeRow(iso: string) {
  if (!iso) return "";
  const weekday = formatWeekdayCustomer(iso);
  const shortWeekday = weekday ? weekday.slice(0, 3) : "";
  const date = formatDateCustomer(iso);
  const time = formatTime12h(iso);
  if ((!shortWeekday && date === "—") || (date === "—" && time === "—")) return "";
  const datePart = [shortWeekday, date !== "—" ? date : ""].filter(Boolean).join(", ");
  if (!datePart) return time !== "—" ? time : "";
  if (time === "—") return datePart;
  return `${datePart} • ${time}`;
}

function formatPartyLine(b: UnifiedBooking) {
  if (b.kind === "event" || b.kind === "movie") {
    if (b.ticketQty != null) {
      return `${b.ticketQty} Ticket${b.ticketQty === 1 ? "" : "s"}`;
    }
    return b.extra || "—";
  }
  if (b.guests != null) {
    return `${b.guests} Guest${b.guests === 1 ? "" : "s"}`;
  }
  return b.extra || "—";
}

function kindBadgeStyles(kind: UnifiedBooking["kind"]) {
  switch (kind) {
    case "event":
      return "bg-[#F3E8FF] text-[#7C3AED]";
    case "dining":
      return "bg-[#FFEDD5] text-[#EA580C]";
    case "movie":
      return "bg-[#E0F2FE] text-[#0284C7]";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function statusBadgeStyles(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "bg-[#ECFDF5] text-[#047857]";
    case "CANCELLED":
      return "bg-red-50 text-red-600";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function statusDotStyles(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "bg-[#10B981]";
    case "CANCELLED":
      return "bg-red-500";
    default:
      return "bg-slate-400";
  }
}

function mapDining(b: Booking): UnifiedBooking {
  return {
    kind: "dining",
    id: b.id,
    title: b.business_name || "Restaurant",
    when: b.booking_time,
    endTime: b.end_time || null,
    status: b.status,
    href: `/customer/bookings/confirmation?id=${b.id}`,
    address: b.business_address,
    extra: b.guests != null ? `${b.guests} guests` : undefined,
    image: b.business_cover_image,
    canCancel: diningUpcoming(b),
    guests: b.guests,
    createdAt: String((b as { created_at?: string }).created_at || b.booking_time || ""),
  };
}

function mapEvent(b: EventBooking): UnifiedBooking {
  const qty = Number(b.ticket_qty);
  const title =
    (b.event_name || "").trim() ||
    (b.category_name || "").trim() ||
    "Event";
  return {
    kind: "event",
    id: b.id,
    title,
    when: String(b.starts_at || b.created_at || "").replace(" ", "T"),
    status: b.status,
    href: `/customer/event-bookings/confirmation?id=${b.id}`,
    address: [b.venue_name, b.venue_address].filter(Boolean).join(", ") || undefined,
    extra: Number.isFinite(qty) && qty > 0 ? `${qty} ticket${qty === 1 ? "" : "s"}` : undefined,
    image: b.poster_vertical_url || b.poster_horizontal_url || DEFAULT_EVENT_IMAGE,
    canCancel: eventUpcoming(b),
    ticketQty: Number.isFinite(qty) ? qty : undefined,
    createdAt: String((b as { created_at?: string }).created_at || b.starts_at || ""),
  };
}

function mapMovie(b: {
  id: string;
  status: string;
  ticket_qty?: number;
  created_at?: string;
  movie_title?: string;
  showtime_starts_at?: string;
  cinema_name?: string;
  screen_name?: string;
  movie_poster?: string;
  cover_image?: string;
  cinema_image?: string;
}): UnifiedBooking {
  return {
    kind: "movie",
    id: b.id,
    title: b.movie_title || "Movie",
    when: String(b.showtime_starts_at || b.created_at || "").replace(" ", "T"),
    status: b.status,
    href: `/movies/booking-confirmation/${b.id}`,
    address: [b.cinema_name, b.screen_name].filter(Boolean).join(" · ") || undefined,
    extra: b.ticket_qty ? `${b.ticket_qty} seat${b.ticket_qty === 1 ? "" : "s"}` : undefined,
    image: b.movie_poster || b.cover_image || b.cinema_image || DEFAULT_MOVIE_IMAGE,
    canCancel: false,
    ticketQty: b.ticket_qty,
    createdAt: String(b.created_at || b.showtime_starts_at || ""),
  };
}

export default function CustomerDashboard() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [kind, setKind] = useState<KindTab>("all");
  const [filter, setFilter] = useState<StatusTab>("all");
  const [page, setPage] = useState(1);
  const [listPending, setListPending] = useState(true);
  const [diningItems, setDiningItems] = useState<Booking[]>([]);
  const [eventItems, setEventItems] = useState<EventBooking[]>([]);
  const [movieItems, setMovieItems] = useState<
    Array<{
      id: string;
      status: string;
      ticket_qty?: number;
      created_at?: string;
      movie_title?: string;
      showtime_starts_at?: string;
      cinema_name?: string;
      screen_name?: string;
      movie_poster?: string;
      cover_image?: string;
      cinema_image?: string;
    }>
  >([]);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const headerOffset = useStickyHeaderOffset(72);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  useEffect(() => {
    if (user === null) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem("user_customer") : null;
    if (!stored) {
      router.push("/");
      return;
    }
    const parsed = JSON.parse(stored);
    if (parsed.role !== "customer") router.push("/");
  }, [user, router]);

  const customerId = user?.customer_id ?? "";
  const needDining = Boolean(customerId) && kind !== "sports" && (kind === "all" || kind === "dining");
  const needEvents = Boolean(customerId) && kind !== "sports" && (kind === "all" || kind === "event");
  const needMovies = Boolean(customerId) && kind !== "sports" && (kind === "all" || kind === "movie");

  const diningQuery = useGetCustomerBookingsQuery(
    { customerId, page, limit: ORDERS_PAGE_SIZE, status: filter },
    { skip: !needDining }
  );
  const eventsQuery = useGetCustomerEventBookingsQuery(
    { customerId, page, limit: ORDERS_PAGE_SIZE, status: filter },
    { skip: !needEvents }
  );
  const moviesQuery = useGetCustomerMovieBookingsQuery(
    { page, limit: ORDERS_PAGE_SIZE, status: filter },
    { skip: !needMovies }
  );

  const [cancelDining] = useCancelBookingMutation();
  const [cancelEvent] = useCancelEventBookingMutation();
  const [pendingCancel, setPendingCancel] = useState<UnifiedBooking | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const selectKind = useCallback((next: KindTab) => {
    setListPending(true);
    setKind(next);
    setPage(1);
    setDiningItems([]);
    setEventItems([]);
    setMovieItems([]);
    if (next === "all") setFilter("all");
  }, []);

  const selectFilter = useCallback((next: StatusTab) => {
    setListPending(true);
    setFilter(next);
    setPage(1);
    setDiningItems([]);
    setEventItems([]);
    setMovieItems([]);
  }, []);

  // Re-sync whenever kind/filter changes — clearing local lists must not stick empty
  // when RTK still holds the same cached page-1 payload (deps would otherwise skip).
  useEffect(() => {
    if (!needDining) {
      setDiningItems([]);
      return;
    }
    if (!diningQuery.data) return;
    const pageItems = diningQuery.data.items ?? [];
    const pageNo = diningQuery.data.meta?.page ?? page;
    if (pageNo <= 1 || page <= 1) {
      setDiningItems(pageItems);
      return;
    }
    setDiningItems((prev) => {
      const seen = new Set(prev.map((b) => b.id));
      return [...prev, ...pageItems.filter((b) => !seen.has(b.id))];
    });
  }, [needDining, diningQuery.data, page, kind, filter]);

  useEffect(() => {
    if (!needEvents) {
      setEventItems([]);
      return;
    }
    if (!eventsQuery.data) return;
    const pageItems = eventsQuery.data.items ?? [];
    const pageNo = eventsQuery.data.meta?.page ?? page;
    if (pageNo <= 1 || page <= 1) {
      setEventItems(pageItems);
      return;
    }
    setEventItems((prev) => {
      const seen = new Set(prev.map((b) => b.id));
      return [...prev, ...pageItems.filter((b) => !seen.has(b.id))];
    });
  }, [needEvents, eventsQuery.data, page, kind, filter]);

  useEffect(() => {
    if (!needMovies) {
      setMovieItems([]);
      return;
    }
    if (!moviesQuery.data) return;
    const pageItems = moviesQuery.data.items ?? [];
    const pageNo = moviesQuery.data.meta?.page ?? page;
    if (pageNo <= 1 || page <= 1) {
      setMovieItems(pageItems);
      return;
    }
    setMovieItems((prev) => {
      const seen = new Set(prev.map((b) => b.id));
      return [...prev, ...pageItems.filter((b) => !seen.has(b.id))];
    });
  }, [needMovies, moviesQuery.data, page, kind, filter]);

  useEffect(() => {
    if (kind === "sports") {
      setListPending(false);
      return;
    }
    const diningReady = !needDining || (!diningQuery.isFetching && diningQuery.data !== undefined);
    const eventsReady = !needEvents || (!eventsQuery.isFetching && eventsQuery.data !== undefined);
    const moviesReady = !needMovies || (!moviesQuery.isFetching && moviesQuery.data !== undefined);
    if (diningReady && eventsReady && moviesReady) {
      setListPending(false);
    }
  }, [
    kind,
    filter,
    needDining,
    needEvents,
    needMovies,
    diningQuery.isFetching,
    diningQuery.data,
    eventsQuery.isFetching,
    eventsQuery.data,
    moviesQuery.isFetching,
    moviesQuery.data,
  ]);

  const filteredBookings = useMemo(() => {
    if (kind === "sports") return [];
    const dining = needDining ? diningItems.map(mapDining) : [];
    const events = needEvents ? eventItems.map(mapEvent) : [];
    const movies = needMovies ? movieItems.map(mapMovie) : [];
    return [...dining, ...events, ...movies].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.when).getTime() || 0;
      const timeB = new Date(b.createdAt || b.when).getTime() || 0;
      return timeB - timeA;
    });
  }, [kind, needDining, needEvents, needMovies, diningItems, eventItems, movieItems]);

  const counts = useMemo(() => {
    const empty = { all: 0, upcoming: 0, past: 0, cancelled: 0 };
    if (kind === "sports") return empty;
    if (kind === "dining") return diningQuery.data?.counts ?? empty;
    if (kind === "event") return eventsQuery.data?.counts ?? empty;
    if (kind === "movie") return moviesQuery.data?.counts ?? empty;
    const sources = [diningQuery.data?.counts, eventsQuery.data?.counts, moviesQuery.data?.counts];
    return sources.reduce<{ all: number; upcoming: number; past: number; cancelled: number }>(
      (acc, c) => ({
        all: acc.all + (c?.all ?? 0),
        upcoming: acc.upcoming + (c?.upcoming ?? 0),
        past: acc.past + (c?.past ?? 0),
        cancelled: acc.cancelled + (c?.cancelled ?? 0),
      }),
      empty
    );
  }, [
    kind,
    diningQuery.data?.counts,
    eventsQuery.data?.counts,
    moviesQuery.data?.counts,
  ]);

  const hasMore = useMemo(() => {
    if (kind === "sports") return false;
    const checks: boolean[] = [];
    if (needDining) checks.push(Boolean(diningQuery.data?.meta.has_next));
    if (needEvents) checks.push(Boolean(eventsQuery.data?.meta.has_next));
    if (needMovies) checks.push(Boolean(moviesQuery.data?.meta.has_next));
    return checks.some(Boolean);
  }, [
    kind,
    needDining,
    needEvents,
    needMovies,
    diningQuery.data?.meta.has_next,
    eventsQuery.data?.meta.has_next,
    moviesQuery.data?.meta.has_next,
  ]);

  const bootLoading = !user;

  /** Shimmer while bootstrapping or switching tabs/filters until page-1 data is ready. */
  const listLoading =
    listPending ||
    (kind !== "sports" &&
      page === 1 &&
      filteredBookings.length === 0 &&
      ((needDining && diningQuery.isFetching) ||
        (needEvents && eventsQuery.isFetching) ||
        (needMovies && moviesQuery.isFetching)));

  const loadingMore =
    page > 1 &&
    ((needDining && diningQuery.isFetching) ||
      (needEvents && eventsQuery.isFetching) ||
      (needMovies && moviesQuery.isFetching));

  const loadNextPage = useCallback(() => {
    if (!hasMore || loadingMore || listLoading || bootLoading) return;
    setPage((p) => p + 1);
  }, [hasMore, loadingMore, listLoading, bootLoading]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadNextPage();
      },
      { root: null, rootMargin: "240px 0px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadNextPage, filteredBookings.length]);

  const handleCancel = (b: UnifiedBooking) => {
    setPendingCancel(b);
  };

  if (bootLoading) {
    return (
      <CustomerAccountLayout>
        <CustomerOrdersListShimmer />
      </CustomerAccountLayout>
    );
  }

  const kindTabs: { key: KindTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "dining", label: "Dining" },
    { key: "event", label: "Events" },
    { key: "movie", label: "Movies" },
    { key: "sports", label: "Sports" },
  ];
  const statusTabs: { key: StatusTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "upcoming", label: "Upcoming" },
    { key: "past", label: "Past" },
    { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <CustomerAccountLayout>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(15,23,42,0.04)] px-3 py-4 sm:p-6 lg:p-8">
        <div className="mb-4 sm:mb-5">
          <h1 className="hidden lg:block text-2xl sm:text-3xl font-bold text-[#0F172A] leading-tight">
            My Orders / Reservations
          </h1>
          <p className="text-slate-500 text-sm sm:text-base mt-1.5">
            View and manage your bookings for events, movies, dining and more.
          </p>
        </div>

        <div
          className="sticky z-30 bg-white pt-3 sm:pt-4 mb-5 sm:mb-6"
          style={{ top: headerOffset }}
        >
          <nav
            aria-label="Booking type"
            className="flex items-center gap-6 sm:gap-8 md:gap-10 overflow-x-auto scrollbar-hide border-b border-slate-200"
          >
            {kindTabs.map((tab) => {
              const active = kind === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => selectKind(tab.key)}
                  className={`relative shrink-0 pb-3 text-[15px] sm:text-base font-semibold cursor-pointer transition-colors ${
                    active ? "text-[#0F172A]" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tab.label}
                  {active ? (
                    <span className="absolute left-0 right-0 -bottom-px h-[2.5px] rounded-full bg-[#6900AA]" />
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div
            aria-label="Booking status"
            className="flex flex-nowrap items-center gap-2 sm:gap-2.5 pt-3.5 pb-3 overflow-x-auto scrollbar-hide"
          >
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => selectFilter(tab.key)}
                className={`inline-flex shrink-0 items-center px-3.5 sm:px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  filter === tab.key
                    ? "bg-[#0F172A] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 tabular-nums ${filter === tab.key ? "text-white/80" : "text-slate-400"}`}>
                  {counts[tab.key]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {listLoading ? (
          <CustomerOrdersCardsShimmer rows={4} />
        ) : filteredBookings.length === 0 ? (
          <div className="py-14 text-center">
            <Calendar className="mx-auto text-slate-300 mb-3" size={32} />
            <p className="text-slate-500 mb-4">
              {kind === "sports"
                ? filter === "all"
                  ? "No sports bookings yet."
                  : `No ${filter} sports bookings.`
                : kind === "all"
                  ? filter === "all"
                    ? "No bookings yet."
                    : `No ${filter} bookings.`
                  : filter === "all"
                    ? `No ${kind} bookings yet.`
                    : `No ${filter} ${kind} bookings.`}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {kind === "dining" && (
                <button
                  type="button"
                  onClick={() => router.push("/dining")}
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#6900AA] text-white text-sm font-semibold hover:bg-[#550088] transition-colors cursor-pointer"
                >
                  Find a Table
                </button>
              )}
              {kind === "movie" && (
                <button
                  type="button"
                  onClick={() => router.push("/movies")}
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#6900AA] text-white text-sm font-semibold hover:bg-[#550088] transition-colors cursor-pointer"
                >
                  Browse Movies
                </button>
              )}
              {kind === "event" && (
                <button
                  type="button"
                  onClick={() => router.push("/events")}
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#6900AA] text-white text-sm font-semibold hover:bg-[#550088] transition-colors cursor-pointer"
                >
                  Browse Events
                </button>
              )}
              {kind === "sports" && (
                <button
                  type="button"
                  onClick={() => router.push("/events?category=sports")}
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#6900AA] text-white text-sm font-semibold hover:bg-[#550088] transition-colors cursor-pointer"
                >
                  Browse Sports
                </button>
              )}
              {kind === "all" && (
                <>
                  <button
                    type="button"
                    onClick={() => router.push("/movies")}
                    className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-[#6900AA] text-white text-sm font-semibold hover:bg-[#550088] transition-colors cursor-pointer"
                  >
                    Browse Movies
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/dining")}
                    className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-[#111111] hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Find a Table
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/events")}
                    className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-[#111111] hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Browse Events
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:gap-0 sm:divide-y sm:divide-slate-100">
            {filteredBookings.map((b) => {
              const isEvent = b.kind === "event";
              const isMovie = b.kind === "movie";
              const kindLabel = isMovie ? "MOVIE" : isEvent ? "EVENT" : "DINING";
              const fallbackImage = isMovie
                ? DEFAULT_MOVIE_IMAGE
                : isEvent
                  ? DEFAULT_EVENT_IMAGE
                  : DEFAULT_DINING_IMAGE;
              const dateTimeLine = formatDateTimeRow(b.when);
              const QtyIcon = isEvent || isMovie ? Ticket : Users;

              return (
                <Link
                  key={`${b.kind}-${b.id}`}
                  href={b.href}
                  className="group block rounded-2xl border border-slate-200 bg-white p-2.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] sm:rounded-xl sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:py-5 sm:first:pt-2 sm:last:pb-1 sm:hover:bg-slate-50/70 sm:-mx-3 sm:px-3 transition-colors"
                >
                  <div className="flex flex-row items-stretch gap-3 sm:gap-4 sm:items-start">
                    <span className="shrink-0 relative w-[88px] sm:w-[115px] lg:w-[130px] min-h-[7.25rem] sm:min-h-0 sm:aspect-[3/4] rounded-xl overflow-hidden bg-slate-100 shadow-sm leading-none self-stretch sm:self-auto">
                      <img
                        src={resolveMediaUrl(b.image) || fallbackImage}
                        alt={b.title}
                        className="absolute inset-0 block h-full w-full object-cover object-center"
                        onError={(e) => {
                          const el = e.currentTarget;
                          if (el.dataset.fallbackApplied === "1") return;
                          el.dataset.fallbackApplied = "1";
                          el.src = fallbackImage;
                        }}
                      />
                    </span>

                    <div className="flex-1 min-w-0 flex flex-col">
                      <span
                        className={`inline-flex items-center self-start px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${kindBadgeStyles(b.kind)}`}
                      >
                        {kindLabel}
                      </span>
                      <h3 className="text-[15px] sm:text-lg font-bold text-[#0F172A] mt-1 break-words leading-snug line-clamp-2 group-hover:text-[#6900AA] transition-colors">
                        {b.title}
                      </h3>
                      {b.address ? (
                        <p className="mt-1.5 text-xs sm:text-sm text-slate-500 flex items-start gap-1.5">
                          <MapPin size={13} className="shrink-0 mt-0.5 text-slate-400" />
                          <span className="min-w-0 break-words [overflow-wrap:anywhere] line-clamp-2 sm:line-clamp-1">
                            {b.address}
                          </span>
                        </p>
                      ) : null}
                      {dateTimeLine ? (
                        <p className="mt-1 text-xs sm:text-sm text-slate-500 flex items-start gap-1.5">
                          <Calendar size={13} className="shrink-0 mt-0.5 text-slate-400" />
                          <span className="min-w-0 break-words">{dateTimeLine}</span>
                        </p>
                      ) : null}

                      {/* Desktop footer sits under details */}
                      <div className="hidden sm:flex mt-2.5 pt-2.5 border-t border-slate-100 items-center gap-2.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${statusBadgeStyles(b.status)}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDotStyles(b.status)}`} />
                          {b.status}
                        </span>
                        <p className="text-sm text-slate-500 flex items-center gap-1">
                          <QtyIcon size={13} className="shrink-0 text-slate-400" />
                          <span>{formatPartyLine(b)}</span>
                        </p>
                        {b.canCancel ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleCancel(b);
                            }}
                            className="ml-auto inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-red-300 bg-white text-xs font-semibold text-red-500 hover:bg-red-50 cursor-pointer"
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Mobile footer — full width under image+details so Cancel never wraps oddly */}
                  <div className="sm:hidden mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusBadgeStyles(b.status)}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDotStyles(b.status)}`} />
                        {b.status}
                      </span>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <QtyIcon size={13} className="shrink-0 text-slate-400" />
                        <span>{formatPartyLine(b)}</span>
                      </p>
                    </div>
                    {b.canCancel ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCancel(b);
                        }}
                        className="shrink-0 inline-flex items-center justify-center min-h-9 px-3.5 rounded-lg border border-red-300 bg-white text-xs font-semibold text-red-500 hover:bg-red-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </Link>
              );
            })}
            <div ref={loadMoreRef} className="h-8 w-full" aria-hidden />
            {loadingMore ? (
              <div className="flex items-center justify-center py-4" aria-label="Loading more">
                <Loader2 size={22} className="animate-spin text-[#6900AA]" />
              </div>
            ) : null}
            {!hasMore && filteredBookings.length > 0 ? (
              <p className="pt-1 pb-2 text-center text-xs text-slate-400">You&apos;re all caught up</p>
            ) : null}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingCancel}
        theme="light"
        title={pendingCancel?.kind === "event" ? "Cancel ticket booking?" : "Cancel reservation?"}
        body={
          pendingCancel
            ? `Are you sure you want to cancel this ${pendingCancel.kind === "event" ? "ticket booking" : "reservation"}?`
            : ""
        }
        confirmLabel="Cancel booking"
        cancelLabel="Keep booking"
        danger
        busy={confirmBusy}
        onCancel={() => {
          if (!confirmBusy) setPendingCancel(null);
        }}
        onConfirm={async () => {
          if (!pendingCancel || confirmBusy) return;
          const b = pendingCancel;
          if (b.kind === "movie") {
            toast.error("Movie bookings cannot be cancelled from the dashboard yet.");
            setPendingCancel(null);
            return;
          }
          const label = b.kind === "event" ? "ticket booking" : "reservation";
          setConfirmBusy(true);
          try {
            if (b.kind === "event") {
              await cancelEvent({ id: b.id, customerId }).unwrap();
            } else {
              await cancelDining({ id: b.id }).unwrap();
            }
            toast.success(b.kind === "event" ? "Tickets cancelled" : "Reservation cancelled");
            setPendingCancel(null);
            setListPending(true);
            setPage(1);
            setDiningItems([]);
            setEventItems([]);
            setMovieItems([]);
          } catch (err) {
            toast.error(extractApiError(err, `Failed to cancel ${label}`));
          } finally {
            setConfirmBusy(false);
          }
        }}
      />
    </CustomerAccountLayout>
  );
}
