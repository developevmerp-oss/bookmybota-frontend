"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  ChevronRight,
  Clock,
  Filter,
  MapPin,
  MoreVertical,
  Ticket,
  User,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetCustomerBookingsQuery,
  useGetCustomerEventBookingsQuery,
  useCancelBookingMutation,
  useCancelEventBookingMutation,
  Booking,
  EventBooking,
} from "@/services/api";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { extractApiError } from "@/lib/apiErrors";

type KindTab = "all" | "dining" | "event";
type StatusTab = "all" | "upcoming" | "past" | "cancelled";

type UnifiedBooking = {
  kind: "dining" | "event";
  id: string;
  title: string;
  when: string;
  status: string;
  href: string;
  address?: string;
  extra?: string;
  image?: string;
  canCancel: boolean;
};

function diningUpcoming(b: Booking) {
  return new Date(b.booking_time) > new Date() && b.status === "CONFIRMED";
}

function eventUpcoming(b: EventBooking) {
  return !!b.starts_at && new Date(b.starts_at) > new Date() && b.status === "CONFIRMED";
}

function shortBookingCode(id: string) {
  const compact = id.replace(/-/g, "").toUpperCase();
  return `BMB-${compact.slice(0, 8)}-${compact.slice(8, 12)}`;
}

function formatDateLine(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatTimeLine(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function statusStyles(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "bg-emerald-50 text-[#1B5E3B]";
    case "CANCELLED":
      return "bg-red-50 text-red-600";
    default:
      return "bg-slate-100 text-slate-600";
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
      router.push("/login");
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
  const [cancelDining] = useCancelBookingMutation();
  const [cancelEvent] = useCancelEventBookingMutation();

  const unified = useMemo<UnifiedBooking[]>(() => {
    const dining: UnifiedBooking[] = diningBookings.map((b) => ({
      kind: "dining",
      id: b.id,
      title: b.business_name || "Restaurant",
      when: b.booking_time,
      status: b.status,
      href: `/customer/bookings/${b.id}`,
      address: b.business_address,
      extra: b.guests != null ? `${b.guests} guests` : undefined,
      image: b.business_cover_image,
      canCancel: diningUpcoming(b),
    }));
    const events: UnifiedBooking[] = eventBookings.map((b) => ({
      kind: "event",
      id: b.id,
      title: b.event_name || "Event",
      when: b.starts_at || b.created_at || "",
      status: b.status,
      href: `/customer/event-bookings/${b.id}`,
      address: [b.venue_name, b.venue_address].filter(Boolean).join(", ") || undefined,
      extra: b.ticket_qty ? `${b.ticket_qty} ticket${b.ticket_qty === 1 ? "" : "s"}` : undefined,
      image: b.poster_horizontal_url || b.poster_vertical_url,
      canCancel: eventUpcoming(b),
    }));
    return [...dining, ...events].sort(
      (a, b) => new Date(b.when).getTime() - new Date(a.when).getTime()
    );
  }, [diningBookings, eventBookings]);

  const kindCounts = useMemo(
    () => ({
      all: unified.length,
      dining: unified.filter((b) => b.kind === "dining").length,
      event: unified.filter((b) => b.kind === "event").length,
    }),
    [unified]
  );

  const byKind = useMemo(() => {
    if (kind === "dining") return unified.filter((b) => b.kind === "dining");
    if (kind === "event") return unified.filter((b) => b.kind === "event");
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

  const handleCancel = async (b: UnifiedBooking) => {
    const label = b.kind === "event" ? "ticket booking" : "reservation";
    if (!confirm(`Are you sure you want to cancel this ${label}?`)) return;
    try {
      if (b.kind === "event") {
        await cancelEvent({ id: b.id, customerId }).unwrap();
      } else {
        await cancelDining({ id: b.id }).unwrap();
      }
      toast.success(b.kind === "event" ? "Tickets cancelled" : "Reservation cancelled");
    } catch (err) {
      toast.error(extractApiError(err, `Failed to cancel ${label}`));
    }
  };

  if (diningLoading || eventsLoading || !user) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] pt-24 text-center text-slate-500">Loading Dashboard...</div>
    );
  }

  const welcomeName = user.name || user.email?.split("@")[0] || "there";
  const kindTabs: { key: KindTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: kindCounts.all },
    { key: "dining", label: "Dining", count: kindCounts.dining },
    { key: "event", label: "Events", count: kindCounts.event },
  ];
  const statusTabs: { key: StatusTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "upcoming", label: "Upcoming" },
    { key: "past", label: "Past" },
    { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="min-h-screen bg-white pt-10 pb-16">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 mb-2">
              Welcome back, {welcomeName}! 👋
            </h1>
            <p className="text-slate-500">Manage your table reservations and event tickets.</p>
          </div>
          <Link
            href="/customer/profile"
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800"
          >
            <User size={16} /> Edit Profile
          </Link>
        </div>

        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          {kindTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setKind(tab.key);
                if (tab.key === "all") setFilter("all");
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap cursor-pointer border ${
                kind === tab.key
                  ? "bg-[#1B5E3B] text-white border-[#1B5E3B]"
                  : "bg-white text-slate-500 border-slate-200 hover:border-[#1B5E3B]/40"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          <Filter size={16} className="text-slate-400 shrink-0" />
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap cursor-pointer border ${
                filter === tab.key
                  ? "bg-emerald-50 text-[#1B5E3B] border-[#1B5E3B]/30"
                  : "bg-slate-100 text-slate-500 border-transparent hover:bg-slate-200"
              }`}
            >
              {tab.label} ({counts[tab.key]})
            </button>
          ))}
        </div>

        {filteredBookings.length === 0 ? (
          <div className="p-8 rounded-2xl text-center border border-slate-100 bg-slate-50">
            <Calendar className="mx-auto text-slate-400 mb-3" size={32} />
            <p className="text-slate-500 mb-4">
              {kind === "all" ? `No ${filter} bookings.` : `No ${filter} ${kind} bookings.`}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-[#1B5E3B] text-white text-sm font-semibold"
              >
                Find a Table
              </button>
              <button
                type="button"
                onClick={() => router.push("/events")}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold"
              >
                Browse events
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredBookings.map((b) => (
              <div
                key={`${b.kind}-${b.id}`}
                className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center gap-4"
              >
                {b.image ? (
                  <img
                    src={b.image}
                    alt=""
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-[#1B5E3B]">
                    {b.kind === "event" ? <Ticket size={22} /> : <UtensilsCrossed size={22} />}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#1B5E3B]">
                    {b.kind === "event" ? <Ticket size={12} /> : <UtensilsCrossed size={12} />}
                    {b.kind === "event" ? "Event" : "Dining"}
                  </p>
                  <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">{b.title}</h3>
                  <div className="mt-2 space-y-1 text-sm text-slate-500">
                    {b.address && (
                      <p className="flex items-center gap-1.5">
                        <MapPin size={13} className="shrink-0" /> {b.address}
                      </p>
                    )}
                    {b.when && (
                      <p className="flex items-center gap-1.5">
                        <Calendar size={13} className="shrink-0" /> {formatDateLine(b.when)}
                      </p>
                    )}
                    {b.when && (
                      <p className="flex items-center gap-1.5">
                        <Clock size={13} className="shrink-0" /> {formatTimeLine(b.when)}
                      </p>
                    )}
                    {b.extra && (
                      <p className="flex items-center gap-1.5">
                        <Ticket size={13} className="shrink-0" /> {b.extra}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-start md:items-center gap-1 shrink-0 md:min-w-[140px]">
                  <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${statusStyles(b.status)}`}>
                    {b.status}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">Booking ID</p>
                  <p className="text-xs font-semibold text-slate-600">{shortBookingCode(b.id)}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                  {b.canCancel && (
                    <button
                      type="button"
                      onClick={() => handleCancel(b)}
                      className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <XCircle size={14} /> Cancel
                    </button>
                  )}
                  <Link
                    href={b.href}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    View Details <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
            <p className="text-center text-slate-400 text-sm pt-4">That&apos;s all your bookings! 🎉</p>
          </div>
        )}
      </div>
    </div>
  );
}
