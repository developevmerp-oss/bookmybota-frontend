"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Clock,
  MapPin,
  XCircle,
  User,
  ChevronRight,
  Filter,
  Ticket,
  UtensilsCrossed,
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
  canCancel: boolean;
};

function diningUpcoming(b: Booking) {
  return new Date(b.booking_time) > new Date() && b.status === "CONFIRMED";
}

function eventUpcoming(b: EventBooking) {
  return !!b.starts_at && new Date(b.starts_at) > new Date() && b.status === "CONFIRMED";
}

function statusStyles(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    case "CANCELLED":
      return "bg-rose-500/10 text-rose-500 border-rose-500/20";
    case "COMPLETED":
    case "USED":
      return "bg-sky-500/10 text-sky-600 border-sky-500/20";
    default:
      return "bg-zinc-500/10 text-zinc-500 border-zinc-500/20";
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
      canCancel: eventUpcoming(b),
    }));
    return [...dining, ...events].sort(
      (a, b) => new Date(b.when).getTime() - new Date(a.when).getTime()
    );
  }, [diningBookings, eventBookings]);

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
      case "upcoming":
        return byKind.filter((b) => b.canCancel);
      case "cancelled":
        return byKind.filter((b) => b.status === "CANCELLED");
      case "past":
        return byKind.filter((b) => !b.canCancel && b.status !== "CANCELLED");
      default:
        return byKind;
    }
  }, [byKind, filter]);

  const handleCancel = async (b: UnifiedBooking, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
      <div className="min-h-screen bg-background pt-24 text-center text-muted-foreground">
        Loading Dashboard...
      </div>
    );
  }

  const welcomeName = user.name || user.email?.split("@")[0] || "there";
  const kindTabs: { key: KindTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "dining", label: "Dining" },
    { key: "event", label: "Events" },
  ];
  const statusTabs: { key: StatusTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "upcoming", label: "Upcoming" },
    { key: "past", label: "Past" },
    { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="min-h-screen bg-background pt-10 pb-16">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Welcome back, {welcomeName}!
            </h1>
            <p className="text-muted-foreground">
              Manage your table reservations and event tickets.
            </p>
          </div>
          <Link
            href="/customer/profile"
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl border border-border bg-white hover:bg-accent transition-colors text-foreground"
          >
            <User size={16} /> Edit Profile
          </Link>
        </div>

        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          {kindTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setKind(tab.key)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                kind === tab.key
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-muted-foreground border-border hover:border-rose-300 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          <Filter size={16} className="text-muted-foreground shrink-0" />
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                filter === tab.key
                  ? "bg-rose-600 text-white border-rose-600"
                  : "bg-white text-muted-foreground border-border hover:border-rose-300 hover:text-foreground"
              }`}
            >
              {tab.label} ({counts[tab.key]})
            </button>
          ))}
        </div>

        {filteredBookings.length === 0 ? (
          <div className="glass-panel p-8 rounded-2xl text-center border border-border">
            <Calendar className="mx-auto text-muted-foreground mb-3" size={32} />
            <p className="text-muted-foreground mb-4">
              {filter === "all" && kind === "all"
                ? "You have no bookings yet."
                : `No ${filter === "all" ? kind : filter} bookings.`}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button onClick={() => router.push("/")} className="btn-primary inline-block">
                Find a Table
              </button>
              <button
                onClick={() => router.push("/events")}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-border bg-white text-sm font-semibold hover:bg-accent"
              >
                Browse events
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredBookings.map((b) => (
              <Link
                key={`${b.kind}-${b.id}`}
                href={b.href}
                className={`glass-panel p-5 sm:p-6 rounded-2xl border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-rose-300 hover:shadow-md transition-all group ${
                  !b.canCancel ? "opacity-90" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {b.kind === "event" ? <Ticket size={12} /> : <UtensilsCrossed size={12} />}
                      {b.kind === "event" ? "Event" : "Dining"}
                    </span>
                    <h3 className="text-lg font-bold text-foreground group-hover:text-rose-700 transition-colors">
                      {b.title}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyles(b.status)}`}
                    >
                      {b.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                    {b.address && (
                      <span className="flex items-center gap-1">
                        <MapPin size={14} /> {b.address}
                      </span>
                    )}
                    {b.when && (
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {new Date(b.when).toLocaleString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                    {b.extra && <span className="text-xs">{b.extra}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {b.canCancel && (
                    <button
                      onClick={(e) => handleCancel(b, e)}
                      className="flex items-center gap-1.5 text-sm text-rose-500 hover:text-rose-400 px-3 py-2 border border-rose-500/20 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                    >
                      <XCircle size={15} /> Cancel
                    </button>
                  )}
                  <ChevronRight
                    size={18}
                    className="text-slate-300 group-hover:text-rose-500 transition-colors"
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
