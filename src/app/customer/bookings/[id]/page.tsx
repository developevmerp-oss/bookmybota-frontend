"use client";

import { useEffect, use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  Headphones,
  MapPin,
  Phone,
  Tag,
  Trash2,
  User,
  Users,
  UtensilsCrossed,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useGetBookingByIdQuery, useCancelBookingMutation } from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import { formatDateTime12h, formatTime12h } from "@/lib/dateFormat";

const ACCENT = "#6900AA";

function statusBadge(status: string) {
  switch (status) {
    case "CONFIRMED":
      return {
        className: "bg-emerald-50 text-emerald-600 border-emerald-200",
        icon: true,
      };
    case "CANCELLED":
      return {
        className: "bg-rose-50 text-rose-500 border-rose-200",
        icon: false,
      };
    case "COMPLETED":
      return {
        className: "bg-sky-50 text-sky-600 border-sky-200",
        icon: false,
      };
    case "NO_SHOW":
      return {
        className: "bg-amber-50 text-amber-600 border-amber-200",
        icon: false,
      };
    default:
      return {
        className: "bg-slate-50 text-slate-500 border-slate-200",
        icon: false,
      };
  }
}

function formatTicketDate(value?: string | null) {
  if (!value) return { date: "—", weekday: "" };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { date: "—", weekday: "" };
  return {
    date: d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
  };
}

function displayBookingCode(id: string) {
  const short = id.replace(/-/g, "").slice(0, 7).toUpperCase();
  return `DBN-${short}`;
}

export default function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [copied, setCopied] = useState(false);

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

  const { data: booking, isLoading, error } = useGetBookingByIdQuery(id, { skip: !id });
  const [cancelBooking, { isLoading: isCancelling }] = useCancelBookingMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const handleCancel = () => {
    if (!booking) return;
    setConfirmOpen(true);
  };

  const copyBookingId = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Booking ID copied");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy Booking ID");
    }
  };

  if (!user || isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] pt-24 text-center text-slate-500">
        Loading booking...
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] pt-24 text-center px-4">
        <p className="text-slate-500 mb-4">Booking not found.</p>
        <Link
          href="/customer/dashboard"
          className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
          style={{ backgroundColor: ACCENT }}
        >
          Back to My Bookings
        </Link>
      </div>
    );
  }

  const isUpcoming =
    new Date(booking.booking_time) > new Date() && booking.status === "CONFIRMED";
  const guestName = booking.guest_name || booking.customer_name || user.name || "Guest";
  const guestPhone = booking.guest_phone || booking.customer_phone || user.phone || "—";
  const mapsUrl = booking.business_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.business_address)}`
    : null;
  const ticketDate = formatTicketDate(booking.booking_time);
  const bookingCode = displayBookingCode(booking.id);
  const badge = statusBadge(booking.status);
  const qrData = booking.qr_token || booking.id;
  const cover =
    booking.business_cover_image ||
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&q=80";

  return (
    <div className="min-h-screen bg-[#F5F5F7] pt-8 sm:pt-10 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <Link
          href="/customer/dashboard"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-5 sm:mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Back to My Bookings
        </Link>

        <div className="mb-5 sm:mb-6 flex flex-wrap items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Booking Details
            </h1>
            <p className="mt-1.5 text-sm text-slate-500 flex flex-wrap items-center gap-1.5">
              <span>Booking ID: {bookingCode}</span>
              <button
                type="button"
                onClick={() => copyBookingId(booking.id)}
                className="inline-flex items-center justify-center p-1 rounded-md hover:bg-[#f3e8ff] transition-colors cursor-pointer"
                style={{ color: ACCENT }}
                aria-label="Copy booking ID"
              >
                <Copy size={14} />
              </button>
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border ${badge.className}`}
          >
            {badge.icon && <Check size={14} strokeWidth={2.5} />}
            {booking.status}
          </span>
        </div>

        {/* Ticket card */}
        <div className="relative bg-white rounded-2xl sm:rounded-3xl shadow-[0_12px_40px_rgba(15,23,42,0.08)] border border-slate-100 overflow-hidden mb-5 sm:mb-6">
          <div className="flex flex-col lg:flex-row">
            {/* Left — details */}
            <div className="min-w-0 flex-1 p-4 sm:p-6 lg:p-7 lg:pr-8">
              {/* Venue header */}
              <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 pb-5">
                <img
                  src={cover}
                  alt={booking.business_name || "Restaurant"}
                  className="w-full sm:w-[88px] h-36 sm:h-[72px] rounded-xl object-cover shrink-0 bg-slate-100"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&q=80";
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className="mb-1 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5"
                        style={{ color: ACCENT }}
                      >
                        <UtensilsCrossed size={14} />
                        Restaurant
                      </p>
                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                        {booking.business_name || "Restaurant"}
                      </h2>
                      {booking.business_address && (
                        <p className="mt-1 text-sm text-slate-500 flex items-start gap-1.5">
                          <MapPin size={14} className="mt-0.5 shrink-0" style={{ color: ACCENT }} />
                          <span className="line-clamp-2">{booking.business_address}</span>
                        </p>
                      )}
                      {booking.business_phone && (
                        <p className="mt-1 text-sm text-slate-500 flex items-center gap-1.5">
                          <Phone size={14} className="shrink-0" style={{ color: ACCENT }} />
                          <a
                            href={`tel:${booking.business_phone}`}
                            className="hover:underline"
                          >
                            {booking.business_phone}
                          </a>
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
                        {booking.business_id && (
                          <Link
                            href={`/restaurant/${booking.business_id}`}
                            className="text-sm font-semibold inline-flex items-center gap-1 hover:opacity-80"
                            style={{ color: ACCENT }}
                          >
                            View restaurant <ExternalLink size={13} />
                          </Link>
                        )}
                        {mapsUrl && (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold inline-flex items-center gap-1 hover:opacity-80"
                            style={{ color: ACCENT }}
                          >
                            Get directions <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* DATE / TIME / GUESTS / TABLE */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-0 border border-slate-100 rounded-xl overflow-hidden">
                <div className="p-3.5 sm:p-4 border-b xl:border-b-0 xl:border-r border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar size={15} style={{ color: ACCENT }} />
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Date
                    </span>
                  </div>
                  <p className="text-sm sm:text-[15px] font-bold text-slate-900 leading-snug">
                    {formatDateTime12h(booking.booking_time)}
                  </p>
                  {ticketDate.weekday && (
                    <p className="text-xs text-slate-500 mt-0.5">{ticketDate.weekday}</p>
                  )}
                </div>
                <div className="p-3.5 sm:p-4 border-b xl:border-b-0 xl:border-r border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={15} style={{ color: ACCENT }} />
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Time
                    </span>
                  </div>
                  <p className="text-sm sm:text-[15px] font-bold text-slate-900 leading-snug">
                    {formatTime12h(booking.booking_time)}
                    {booking.end_time ? ` – ${formatTime12h(booking.end_time)}` : ""}
                  </p>
                </div>
                <div className="p-3.5 sm:p-4 border-r border-slate-100 xl:border-r">
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={15} style={{ color: ACCENT }} />
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Guests
                    </span>
                  </div>
                  <p className="text-sm sm:text-[15px] font-bold text-slate-900">
                    {booking.guests != null ? `${booking.guests}` : "—"}
                  </p>
                </div>
                <div className="p-3.5 sm:p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <UtensilsCrossed size={15} style={{ color: ACCENT }} />
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Table
                    </span>
                  </div>
                  <p className="text-sm sm:text-[15px] font-bold text-slate-900">
                    {booking.table_number ? `Table ${booking.table_number}` : "Assigned at venue"}
                  </p>
                </div>
              </div>

              <div className="my-5 border-t border-dashed border-slate-200" />

              {/* Guest + Offer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "#f3e8ff", color: ACCENT }}
                  >
                    <User size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{guestName}</p>
                    <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <Phone size={13} className="shrink-0" style={{ color: ACCENT }} />
                      <span className="truncate">{guestPhone}</span>
                    </p>
                  </div>
                </div>

                {booking.applied_offer?.title ? (
                  <div className="rounded-xl bg-emerald-50/80 border border-emerald-100 p-3 sm:p-3.5">
                    <div className="flex items-start gap-2.5">
                      <Tag size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-emerald-700 text-sm sm:text-[15px]">
                            {booking.applied_offer.title}
                          </p>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700">
                            Offer applied
                          </span>
                        </div>
                        {(booking.applied_offer.type || booking.applied_offer.validity) && (
                          <p className="text-xs text-emerald-700/70 mt-1">
                            {[booking.applied_offer.type, booking.applied_offer.validity]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 sm:p-3.5 flex items-center gap-2.5 text-slate-400">
                    <Tag size={16} className="shrink-0" />
                    <p className="text-sm">No dining offer applied</p>
                  </div>
                )}
              </div>

              {/* Footer meta */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-x-5 sm:gap-y-2 text-xs sm:text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Globe size={14} style={{ color: ACCENT }} />
                  Booking source:{" "}
                  <span className="font-semibold text-slate-700">
                    {booking.booking_source || "ONLINE"}
                  </span>
                </span>
                {booking.created_at && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar size={14} style={{ color: ACCENT }} />
                    Booked on {formatDateTime12h(booking.created_at)}
                  </span>
                )}
              </div>
            </div>

            {/* Ticket perforation (desktop) */}
            <div className="relative hidden lg:flex w-0 shrink-0 items-stretch justify-center">
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#F5F5F7] z-10"
                aria-hidden
              />
              <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-7 h-7 rounded-full bg-[#F5F5F7] z-10"
                aria-hidden
              />
              <div
                className="absolute inset-y-5 left-1/2 -translate-x-1/2 border-l border-dashed border-slate-300"
                aria-hidden
              />
            </div>

            {/* Mobile dashed divider */}
            <div className="lg:hidden mx-4 sm:mx-6 border-t border-dashed border-slate-300 relative">
              <span
                className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#F5F5F7]"
                aria-hidden
              />
              <span
                className="absolute right-0 top-0 translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#F5F5F7]"
                aria-hidden
              />
            </div>

            {/* Right — QR stub */}
            <div className="lg:w-[280px] xl:w-[300px] shrink-0 p-5 sm:p-6 lg:pl-8 flex flex-col items-center text-center">
              {booking.qr_token ? (
                <div
                  className="rounded-xl border-2 p-2.5 bg-white shadow-sm"
                  style={{ borderColor: ACCENT }}
                >
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrData)}`}
                    alt="Booking QR code"
                    className="w-[150px] h-[150px] sm:w-[160px] sm:h-[160px] rounded-md bg-white"
                  />
                </div>
              ) : (
                <div
                  className="w-[150px] h-[150px] sm:w-[160px] sm:h-[160px] rounded-xl border-2 border-dashed bg-slate-50 flex items-center justify-center text-slate-400 text-xs font-medium"
                  style={{ borderColor: `${ACCENT}55` }}
                >
                  QR Code
                </div>
              )}

              <p className="mt-4 text-sm font-bold" style={{ color: ACCENT }}>
                Reservation Pass
              </p>
              <p className="mt-1.5 text-base sm:text-lg font-bold text-slate-900 tracking-wide">
                {bookingCode}
              </p>

              <button
                type="button"
                onClick={() => copyBookingId(booking.id)}
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-sm font-semibold transition-colors cursor-pointer hover:bg-[#f7e9ff]"
                style={{ borderColor: `${ACCENT}55`, color: ACCENT }}
              >
                <Copy size={14} />
                {copied ? "Copied" : "Copy ID"}
              </button>

              <p className="mt-4 text-[11px] sm:text-xs text-slate-500 leading-relaxed max-w-[220px] flex items-start gap-1.5 text-left">
                <Phone size={12} className="mt-0.5 shrink-0" style={{ color: ACCENT }} />
                {booking.qr_token
                  ? booking.applied_offer?.title
                    ? "Show this QR at the restaurant. Staff will see your dining offer and apply it on the food bill."
                    : "Show this QR at the restaurant to confirm your reservation."
                  : "QR will appear once check-in scanning is enabled for this booking."}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <Link
            href="/customer/help"
            className="flex items-center gap-3 rounded-2xl bg-white border border-slate-100 shadow-sm px-4 py-3.5 hover:bg-slate-50 transition-colors min-w-0 sm:max-w-sm w-full sm:w-auto"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: "#f3e8ff", color: ACCENT }}
            >
              <Headphones size={18} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="font-bold text-slate-900 text-sm">Need help?</p>
              <p className="text-xs text-slate-500 truncate">Visit our support center</p>
            </div>
            <ChevronRight size={18} className="text-slate-400 shrink-0" />
          </Link>

          {isUpcoming && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={isCancelling}
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-rose-500 hover:text-rose-600 px-5 py-3 border border-rose-300 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer disabled:opacity-60 w-full sm:w-auto"
            >
              <Trash2 size={16} />
              {isCancelling ? "Cancelling..." : "Cancel Reservation"}
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Cancel reservation?"
        body="Are you sure you want to cancel this reservation?"
        confirmLabel="Cancel reservation"
        danger
        busy={confirmBusy || isCancelling}
        onCancel={() => !confirmBusy && setConfirmOpen(false)}
        onConfirm={async () => {
          if (!booking) return;
          setConfirmBusy(true);
          try {
            await cancelBooking({ id: booking.id }).unwrap();
            toast.success("Reservation cancelled");
            setConfirmOpen(false);
          } catch {
            toast.error("Failed to cancel reservation");
          } finally {
            setConfirmBusy(false);
          }
        }}
      />
    </div>
  );
}
