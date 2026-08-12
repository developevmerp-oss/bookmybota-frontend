"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  MapPin,
  Ticket,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useCancelEventBookingMutation, useGetEventBookingByIdQuery } from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { formatDateTime12h, formatTime12h } from "@/lib/dateFormat";
import { extractApiError } from "@/lib/apiErrors";
import { formatMoney } from "@/lib/currencyFormat";

function statusStyles(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    case "CANCELLED":
      return "bg-rose-500/10 text-rose-500 border-rose-500/20";
    case "USED":
      return "bg-sky-500/10 text-sky-600 border-sky-500/20";
    case "REFUNDED":
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    default:
      return "bg-slate-500/10 text-slate-500 border-slate-500/20";
  }
}

export default function EventBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

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

  const { data: booking, isLoading, error } = useGetEventBookingByIdQuery(id, { skip: !id });
  const [cancelBooking, { isLoading: isCancelling }] = useCancelEventBookingMutation();

  const handleCancel = async () => {
    if (!booking) return;
    if (!confirm("Cancel this ticket booking? Seats will be released.")) return;
    try {
      await cancelBooking({
        id: booking.id,
        customerId: user?.customer_id,
      }).unwrap();
      toast.success("Booking cancelled");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to cancel booking"));
    }
  };

  if (!user || isLoading) {
    return (
      <div className="min-h-screen bg-background pt-24 text-center text-muted-foreground">
        Loading booking...
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-background pt-24 text-center px-4">
        <p className="text-muted-foreground mb-4">Booking not found.</p>
        <Link href="/customer/dashboard" className="btn-primary inline-block">
          Back to My Bookings
        </Link>
      </div>
    );
  }

  const isUpcoming =
    !!booking.starts_at &&
    new Date(booking.starts_at) > new Date() &&
    booking.status === "CONFIRMED";
  const mapsUrl = booking.venue_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${booking.venue_name || ""} ${booking.venue_address}`
      )}`
    : null;

  return (
    <div className="min-h-screen bg-background pt-10 pb-16">
      <div className="max-w-3xl mx-auto px-4">
        <Link
          href="/customer/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Back to My Bookings
        </Link>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Ticket details</h1>
            <p className="text-muted-foreground text-sm">Booking ID: {booking.id.slice(0, 8)}…</p>
          </div>
          <span
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${statusStyles(booking.status)}`}
          >
            {booking.status}
          </span>
        </div>

        <div className="glass-panel rounded-2xl border border-border overflow-hidden mb-6">
          {(booking.poster_horizontal_url || booking.poster_vertical_url) && (
            <div
              className="h-40 bg-cover bg-center"
              style={{
                backgroundImage: `url(${booking.poster_horizontal_url || booking.poster_vertical_url})`,
              }}
            />
          )}
          <div className="p-6 space-y-5">
            <div>
              <div className="flex items-center gap-2 text-rose-600 mb-1">
                <Ticket size={18} />
                <span className="text-xs font-semibold uppercase tracking-wider">Event</span>
              </div>
              <h2 className="text-xl font-bold text-foreground">{booking.event_name}</h2>
              {booking.organizer_name && (
                <p className="text-sm text-muted-foreground mt-1">By {booking.organizer_name}</p>
              )}
              {(booking.venue_name || booking.venue_address) && (
                <p className="text-sm text-muted-foreground mt-1 flex items-start gap-1.5">
                  <MapPin size={14} className="mt-0.5 shrink-0" />
                  {[booking.venue_name, booking.venue_address].filter(Boolean).join(", ")}
                </p>
              )}
              <div className="flex flex-wrap gap-3 mt-3">
                {booking.event_id && (
                  <Link
                    href={`/events/${booking.event_id}`}
                    className="text-sm font-medium text-rose-600 hover:text-rose-700 inline-flex items-center gap-1"
                  >
                    View event <ExternalLink size={14} />
                  </Link>
                )}
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-rose-600 hover:text-rose-700 inline-flex items-center gap-1"
                  >
                    Get directions <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-border">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Calendar size={16} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Showtime</p>
                  <p className="font-medium text-foreground">
                    {formatDateTime12h(booking.starts_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Clock size={16} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ends</p>
                  <p className="font-medium text-foreground">
                    {booking.ends_at ? formatTime12h(booking.ends_at) : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-2xl border border-border p-6 mb-6">
          <h3 className="font-semibold text-foreground mb-4">Tickets & fees</h3>
          <ul className="space-y-2 text-sm mb-4">
            {(booking.items || []).map((item) => (
              <li key={item.id} className="flex justify-between text-muted-foreground">
                <span>
                  {item.ticket_type} × {item.qty}
                </span>
                <span className="font-medium text-foreground">
                  {formatMoney(Number(item.unit_price) * item.qty)}
                </span>
              </li>
            ))}
            <li className="flex justify-between text-muted-foreground pt-2 border-t border-border">
              <span>Tickets</span>
              <span className="font-medium text-foreground">{formatMoney(booking.ticket_amount)}</span>
            </li>
            {Number(booking.discount_amount || 0) > 0 && (
              <li className="flex justify-between text-emerald-700">
                <span>
                  Promo discount
                  {booking.promo_code ? ` (${booking.promo_code})` : ""}
                </span>
                <span className="font-medium">−{formatMoney(booking.discount_amount)}</span>
              </li>
            )}
            <li className="flex justify-between text-muted-foreground">
              <span>
                Convenience fee
                {booking.convenience_fee_percent
                  ? ` (${Number(booking.convenience_fee_percent)}%)`
                  : ""}
              </span>
              <span className="font-medium text-foreground">
                {formatMoney(booking.convenience_fee_total)}
              </span>
            </li>
            <li className="flex justify-between font-semibold text-foreground pt-2 border-t border-border">
              <span>Total payable</span>
              <span>{formatMoney(booking.grand_total)}</span>
            </li>
          </ul>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Guest name</p>
              <p className="font-medium text-foreground">{booking.guest_name || user.name || "Guest"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Phone</p>
              <p className="font-medium text-foreground">{booking.guest_phone || user.phone || "—"}</p>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-2xl border border-border p-6 mb-6 text-center">
          {booking.qr_code ? (
            <>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(booking.qr_code)}`}
                alt="Ticket QR code"
                className="w-40 h-40 mx-auto mb-3 rounded-xl border border-slate-200 bg-white p-2"
              />
              <p className="text-sm text-muted-foreground mb-1">Show this QR at the venue for entry.</p>
              <p className="text-[11px] text-slate-400 font-mono break-all">{booking.qr_code}</p>
            </>
          ) : (
            <>
              <div className="w-28 h-28 mx-auto mb-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-medium">
                QR Code
              </div>
              <p className="text-sm text-muted-foreground">QR will appear once this booking is confirmed.</p>
            </>
          )}
        </div>

        {isUpcoming && (
          <button
            onClick={handleCancel}
            disabled={isCancelling}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm text-rose-500 hover:text-rose-400 px-5 py-2.5 border border-rose-500/20 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
          >
            <XCircle size={16} />
            {isCancelling ? "Cancelling..." : "Cancel tickets"}
          </button>
        )}
      </div>
    </div>
  );
}
