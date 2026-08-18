"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Copy,
  CheckCheck,
  Filter,
  LayoutGrid,
  MapPin,
  MoreVertical,
  Ticket,
  User,
  Users,
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
import ConfirmDialog from "@/components/Shared/ConfirmDialog";

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
  guests?: number;
  ticketQty?: number;
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

function formatWeekday(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { weekday: "long" });
}

function statusStyles(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "bg-emerald-50 text-emerald-700";
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
  const [pendingCancel, setPendingCancel] = useState<UnifiedBooking | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
      guests: b.guests,
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
      ticketQty: b.ticket_qty,
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

  const handleCancel = (b: UnifiedBooking) => {
    setPendingCancel(b);
  };

  const copyBookingCode = async (id: string) => {
    try {
      await navigator.clipboard.writeText(shortBookingCode(id));
      setCopiedId(id);
      toast.success("Booking ID copied");
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      toast.error("Could not copy Booking ID");
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
    <div className="min-h-screen bg-[#F7F6FB] pt-10 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-black mb-2">
              Welcome back, {welcomeName}! 👋
            </h1>
            <p className="text-slate-500 text-sm sm:text-base">Manage your table reservations and event tickets.</p>
          </div>
          <Link
            href="/customer/profile"
            className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 self-start sm:self-auto"
          >
            <User size={16} /> Edit Profile
          </Link>
        </div>

        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
          {kindTabs.map((tab) => {
            const active = kind === tab.key;
            const Icon = tab.key === "dining" ? UtensilsCrossed : tab.key === "event" ? Ticket : LayoutGrid;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setKind(tab.key);
                  if (tab.key === "all") setFilter("all");
                }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap cursor-pointer border transition-colors ${
                  active
                    ? "bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-300/40"
                    : "bg-white text-violet-700 border-violet-200 hover:bg-violet-50"
                }`}
              >
                <Icon size={15} />
                {tab.label} ({tab.count})
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          <span className="shrink-0 w-9 h-9 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-400">
            <Filter size={15} />
          </span>
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap cursor-pointer border transition-colors ${
                filter === tab.key
                  ? "bg-violet-100 text-violet-700 border-violet-200"
                  : "bg-white text-slate-500 border-slate-200 hover:border-violet-200 hover:text-violet-700"
              }`}
            >
              {tab.label} ({counts[tab.key]})
            </button>
          ))}
        </div>

        {filteredBookings.length === 0 ? (
          <div className="p-8 rounded-2xl text-center border border-slate-100 bg-white">
            <Calendar className="mx-auto text-slate-400 mb-3" size={32} />
            <p className="text-slate-500 mb-4">
              {kind === "all" ? `No ${filter} bookings.` : `No ${filter} ${kind} bookings.`}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold"
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
            {filteredBookings.map((b) => {
              const isEvent = b.kind === "event";
              const KindIcon = isEvent ? Ticket : UtensilsCrossed;
              return (
                <div
                  key={`${b.kind}-${b.id}`}
                  className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(88,28,180,0.06)] flex flex-col lg:flex-row gap-4"
                >
                  <div className="relative w-full h-40 sm:h-44 lg:w-40 lg:h-40 xl:w-44 xl:h-44 shrink-0">
                    {b.image ? (
                      <img
                        src={b.image}
                        alt=""
                        className="w-full h-full rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="w-full h-full rounded-2xl bg-violet-50 flex items-center justify-center text-violet-500">
                        <KindIcon size={28} />
                      </div>
                    )}
                    <span className="absolute bottom-2.5 left-2.5 w-8 h-8 rounded-lg bg-white/75 backdrop-blur-[2px] text-violet-600 flex items-center justify-center shadow-sm">
                      <KindIcon size={15} />
                    </span>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col">
                    <span className="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 text-[10px] font-bold uppercase tracking-wider">
                      <KindIcon size={11} />
                      {isEvent ? "Event" : "Dining"}
                    </span>
                    <h3 className="text-lg sm:text-xl font-extrabold text-black mt-1.5 truncate">{b.title}</h3>
                    {b.address && (
                      <p className="mt-1 text-sm text-slate-500 flex items-start gap-1.5">
                        <MapPin size={14} className="shrink-0 mt-0.5 text-violet-500" />
                        <span className="line-clamp-1">{b.address}</span>
                      </p>
                    )}

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                      {b.when && (
                        <div className="flex items-start gap-2 min-w-0">
                          <Calendar size={16} className="text-violet-600 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900">{formatDateLine(b.when)}</p>
                            <p className="text-xs text-slate-400">{formatWeekday(b.when)}</p>
                          </div>
                        </div>
                      )}
                      {b.when && (
                        <div className="flex items-start gap-2 min-w-0">
                          <Clock size={16} className="text-violet-600 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900">{formatTimeLine(b.when)}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-2 min-w-0">
                        {isEvent ? (
                          <Ticket size={16} className="text-violet-600 mt-0.5 shrink-0" />
                        ) : (
                          <Users size={16} className="text-violet-600 mt-0.5 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 capitalize">{b.extra || "—"}</p>
                          <p className="text-xs text-slate-400">
                            {isEvent
                              ? "Tickets"
                              : b.guests != null
                                ? `Table for ${b.guests}`
                                : "Table"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-full lg:w-[260px] xl:w-[280px] shrink-0 lg:border-l lg:border-slate-100 lg:pl-5 flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${statusStyles(b.status)}`}>
                        {b.status === "CONFIRMED" && <Check size={12} strokeWidth={3} />}
                        {b.status}
                      </span>
                      <span className="text-slate-300 p-1" aria-hidden>
                        <MoreVertical size={16} />
                      </span>
                    </div>

                    <div>
                      <p className="text-[11px] text-slate-400 font-medium">Booking ID</p>
                      <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{shortBookingCode(b.id)}</p>
                        <button
                          type="button"
                          onClick={() => copyBookingCode(b.id)}
                          className="text-slate-400 hover:text-violet-600 cursor-pointer shrink-0"
                          aria-label="Copy booking ID"
                        >
                          {copiedId === b.id ? <CheckCheck size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-auto">
                      {b.canCancel && (
                        <button
                          type="button"
                          onClick={() => handleCancel(b)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg border border-red-200 bg-white text-sm font-semibold text-red-500 hover:bg-red-50 cursor-pointer"
                        >
                          <XCircle size={14} /> Cancel
                        </button>
                      )}
                      <Link
                        href={b.href}
                        className="flex-1 inline-flex items-center justify-center gap-1 h-10 px-4 rounded-lg border border-violet-200 bg-white text-sm font-semibold text-violet-700 hover:bg-violet-50 whitespace-nowrap"
                      >
                        View Details <ChevronRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
            <p className="text-center text-slate-400 text-sm pt-4">That&apos;s all your bookings! 🎉</p>
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
    </div>
  );
}
