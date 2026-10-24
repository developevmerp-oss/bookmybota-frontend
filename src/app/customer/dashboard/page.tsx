"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
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
import { CustomerOrdersListShimmer } from "@/components/Shared/Shimmer";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { formatDateCustomer, formatTime12h, formatWeekdayCustomer } from "@/lib/dateFormat";

const DEFAULT_DINING_IMAGE =
  "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80";
const DEFAULT_EVENT_IMAGE =
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80";
const DEFAULT_MOVIE_IMAGE =
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80";

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

export default function CustomerDashboard() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [kind, setKind] = useState<KindTab>("all");
  const [filter, setFilter] = useState<StatusTab>("all");

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
  const { data: diningBookings = [], isLoading: diningLoading } = useGetCustomerBookingsQuery(
    customerId,
    { skip: !customerId }
  );
  const { data: eventBookings = [], isLoading: eventsLoading } = useGetCustomerEventBookingsQuery(
    customerId,
    { skip: !customerId }
  );
  const { data: movieBookings = [], isLoading: moviesLoading } = useGetCustomerMovieBookingsQuery(
    undefined,
    { skip: !customerId }
  );
  const [cancelDining] = useCancelBookingMutation();
  const [cancelEvent] = useCancelEventBookingMutation();
  const [pendingCancel, setPendingCancel] = useState<UnifiedBooking | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const unified = useMemo<UnifiedBooking[]>(() => {
    const dining: UnifiedBooking[] = diningBookings.map((b) => ({
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
      createdAt: String((b as any).created_at || b.booking_time || ""),
    }));
    const events: UnifiedBooking[] = eventBookings.map((b) => ({
      kind: "event",
      id: b.id,
      title: b.event_name || "Event",
      when: String(b.starts_at || b.created_at || "").replace(" ", "T"),
      status: b.status,
      href: `/customer/event-bookings/confirmation?id=${b.id}`,
      address: [b.venue_name, b.venue_address].filter(Boolean).join(", ") || undefined,
      extra: b.ticket_qty ? `${b.ticket_qty} ticket${b.ticket_qty === 1 ? "" : "s"}` : undefined,
      image: b.poster_horizontal_url || b.poster_vertical_url,
      canCancel: eventUpcoming(b),
      ticketQty: b.ticket_qty,
      createdAt: String((b as any).created_at || b.starts_at || ""),
    }));
    const movies: UnifiedBooking[] = movieBookings.map((b) => ({
      kind: "movie",
      id: b.id,
      title: (b as any).movie_title || "Movie",
      when: String((b as any).showtime_starts_at || b.created_at || "").replace(" ", "T"),
      status: b.status,
      href: `/movies/booking-confirmation/${b.id}`,
      address: [(b as any).cinema_name, (b as any).screen_name].filter(Boolean).join(" · ") || undefined,
      extra: b.ticket_qty
        ? `${b.ticket_qty} seat${b.ticket_qty === 1 ? "" : "s"}`
        : undefined,
      image: (b as any).movie_poster || DEFAULT_MOVIE_IMAGE,
      canCancel: false,
      ticketQty: b.ticket_qty,
      createdAt: String((b as any).created_at || (b as any).showtime_starts_at || ""),
    }));
    return [...dining, ...events, ...movies].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.when).getTime() || 0;
      const timeB = new Date(b.createdAt || b.when).getTime() || 0;
      return timeB - timeA;
    });
  }, [diningBookings, eventBookings, movieBookings]);

  const byKind = useMemo(() => {
    if (kind === "dining") return unified.filter((b) => b.kind === "dining");
    if (kind === "event") return unified.filter((b) => b.kind === "event");
    if (kind === "movie") return unified.filter((b) => b.kind === "movie");
    if (kind === "sports") return [];
    return unified;
  }, [unified, kind]);

  const counts = useMemo(() => {
    const upcoming = byKind.filter((b) => b.canCancel).length;
    const cancelled = byKind.filter((b) => b.status === "CANCELLED").length;
    const past = byKind.filter((b) => !b.canCancel && b.status !== "CANCELLED").length;
    return { all: byKind.length, upcoming, past, cancelled };
  }, [byKind]);

  const filteredBookings = useMemo(() => {
    switch (filter) {
      case "cancelled":
        return byKind.filter((b) => b.status === "CANCELLED");
      case "past":
        return byKind.filter((b) => !b.canCancel && b.status !== "CANCELLED");
      case "upcoming":
        return byKind.filter((b) => b.canCancel);
      default:
        return byKind;
    }
  }, [byKind, filter]);

  const handleCancel = (b: UnifiedBooking) => {
    setPendingCancel(b);
  };

  if (diningLoading || eventsLoading || moviesLoading || !user) {
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
      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(15,23,42,0.04)] p-5 sm:p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] leading-tight">
            My Orders / Reservations
          </h1>
          <p className="text-slate-500 text-sm sm:text-base mt-1.5">
            View and manage your bookings for events, movies, dining and more.
          </p>
        </div>

        <div className="border-b border-slate-200 mb-4">
          <div className="flex items-center gap-5 sm:gap-7 overflow-x-auto scrollbar-hide">
            {kindTabs.map((tab) => {
              const active = kind === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setKind(tab.key);
                    if (tab.key === "all") setFilter("all");
                  }}
                  className={`relative shrink-0 pb-3 text-sm sm:text-[15px] font-medium cursor-pointer transition-colors ${
                    active ? "text-[#0F172A]" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tab.label}
                  {active ? (
                    <span className="absolute left-0 right-0 bottom-0 h-[2.5px] rounded-full bg-[#7C3AED]" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`px-3.5 sm:px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                filter === tab.key
                  ? "bg-[#0F172A] text-white"
                  : "bg-[#F1F5F9] text-slate-700 hover:bg-slate-200/80"
              }`}
            >
              {tab.label} ({counts[tab.key]})
            </button>
          ))}
        </div>

        {filteredBookings.length === 0 ? (
          <div className="py-14 text-center">
            <Calendar className="mx-auto text-slate-300 mb-3" size={32} />
            <p className="text-slate-500 mb-4">
              {kind === "sports"
                ? "No sports bookings yet."
                : kind === "all"
                  ? `No ${filter} bookings.`
                  : `No ${filter} ${kind} bookings.`}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-[#6900AA] text-white text-sm font-semibold cursor-pointer"
              >
                Find a Table
              </button>
              <button
                type="button"
                onClick={() => router.push("/events")}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold cursor-pointer"
              >
                Browse events
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
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
                  className="group flex flex-col sm:flex-row sm:items-start gap-4 py-5 first:pt-2 last:pb-1 hover:bg-slate-50/70 -mx-2 px-2 sm:-mx-3 sm:px-3 rounded-xl transition-colors"
                >
                  <span className="shrink-0 inline-flex max-w-full h-[100px] sm:h-[108px] lg:h-[118px] sm:max-w-[168px] lg:max-w-[188px] rounded-xl overflow-hidden leading-none">
                    <img
                      src={resolveMediaUrl(b.image) || fallbackImage}
                      alt={b.title}
                      className="block h-full w-full object-cover"
                      onError={(e) => {
                        const el = e.currentTarget;
                        if (el.dataset.fallbackApplied === "1") return;
                        el.dataset.fallbackApplied = "1";
                        el.src = fallbackImage;
                      }}
                    />
                  </span>

                  <div className="flex-1 min-w-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${kindBadgeStyles(b.kind)}`}
                    >
                      {kindLabel}
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-[#0F172A] mt-1.5 truncate group-hover:text-[#6900AA] transition-colors">
                      {b.title}
                    </h3>
                    {b.address ? (
                      <p className="mt-1.5 text-sm text-slate-500 flex items-start gap-1.5">
                        <MapPin size={14} className="shrink-0 mt-0.5 text-slate-400" />
                        <span className="line-clamp-1">{b.address}</span>
                      </p>
                    ) : null}
                    {dateTimeLine ? (
                      <p className="mt-1 text-sm text-slate-500 flex items-start gap-1.5">
                        <Calendar size={14} className="shrink-0 mt-0.5 text-slate-400" />
                        <span className="line-clamp-1">{dateTimeLine}</span>
                      </p>
                    ) : null}
                  </div>

                  <div className="shrink-0 flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 sm:gap-3 sm:pt-0.5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${statusBadgeStyles(b.status)}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDotStyles(b.status)}`} />
                      {b.status}
                    </span>
                    <p className="text-sm text-slate-500 flex items-center gap-1.5 sm:justify-end">
                      <QtyIcon size={14} className="shrink-0 text-slate-400" />
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
                        className="inline-flex items-center justify-center min-w-[88px] px-4 py-1.5 rounded-lg border border-red-300 bg-white text-sm font-semibold text-red-500 hover:bg-red-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingCancel}
        title={pendingCancel?.kind === "event" ? "Cancel ticket booking?" : "Cancel reservation?"}
        body={
          pendingCancel
            ? `Are you sure you want to cancel this ${pendingCancel.kind === "event" ? "ticket booking" : "reservation"}?`
            : ""
        }
        confirmLabel="Cancel booking"
        danger
        busy={confirmBusy}
        onCancel={() => !confirmBusy && setPendingCancel(null)}
        onConfirm={async () => {
          if (!pendingCancel) return;
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
