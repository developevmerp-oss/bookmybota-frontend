"use client";

import { useEffect, use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Users,
  UtensilsCrossed,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useGetBookingByIdQuery, useCancelBookingMutation } from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import { formatDateTime12h, formatTime12h } from "@/lib/dateFormat";

function statusStyles(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    case "CANCELLED":
      return "bg-rose-500/10 text-rose-500 border-rose-500/20";
    case "COMPLETED":
      return "bg-sky-500/10 text-sky-600 border-sky-500/20";
    case "NO_SHOW":
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    default:
      return "bg-slate-500/10 text-slate-500 border-slate-500/20";
  }
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

  const { data: booking, isLoading, error } = useGetBookingByIdQuery(id, { skip: !id });
  const [cancelBooking, { isLoading: isCancelling }] = useCancelBookingMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const handleCancel = () => {
    if (!booking) return;
    setConfirmOpen(true);
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
    new Date(booking.booking_time) > new Date() && booking.status === "CONFIRMED";
  const guestName = booking.guest_name || booking.customer_name || user.name || "Guest";
  const guestPhone = booking.guest_phone || booking.customer_phone || user.phone || "—";
  const mapsUrl = booking.business_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.business_address)}`
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
            <h1 className="text-3xl font-bold text-foreground mb-2">Booking Details</h1>
            <p className="text-muted-foreground text-sm">Booking ID: {booking.id.slice(0, 8)}…</p>
          </div>
          <span
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${statusStyles(booking.status)}`}
          >
            {booking.status}
          </span>
        </div>

        <div className="glass-panel rounded-2xl border border-border overflow-hidden mb-6">
          {booking.business_cover_image && (
            <div
              className="h-40 bg-cover bg-center"
              style={{ backgroundImage: `url(${booking.business_cover_image})` }}
            />
          )}
          <div className="p-6 space-y-5">
            <div>
              <div className="flex items-center gap-2 text-rose-600 mb-1">
                <UtensilsCrossed size={18} />
                <span className="text-xs font-semibold uppercase tracking-wider">Restaurant</span>
              </div>
              <h2 className="text-xl font-bold text-foreground">{booking.business_name}</h2>
              {booking.business_address && (
                <p className="text-sm text-muted-foreground mt-1 flex items-start gap-1.5">
                  <MapPin size={14} className="mt-0.5 shrink-0" />
                  {booking.business_address}
                </p>
              )}
              {booking.business_phone && (
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                  <Phone size={14} /> {booking.business_phone}
                </p>
              )}
              <div className="flex flex-wrap gap-3 mt-3">
                {booking.business_id && (
                  <Link
                    href={`/restaurant/${booking.business_id}`}
                    className="text-sm font-medium text-rose-600 hover:text-rose-700 inline-flex items-center gap-1"
                  >
                    View restaurant <ExternalLink size={14} />
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
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-medium text-foreground">
                    {formatDateTime12h(booking.booking_time)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Clock size={16} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Time</p>
                  <p className="font-medium text-foreground">
                    {formatTime12h(booking.booking_time)}
                    {booking.end_time && (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        –{" "}
                        {formatTime12h(booking.end_time)}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Users size={16} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Guests</p>
                  <p className="font-medium text-foreground">{booking.guests ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <UtensilsCrossed size={16} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Table</p>
                  <p className="font-medium text-foreground">
                    {booking.table_number ? `Table ${booking.table_number}` : "Assigned at venue"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-2xl border border-border p-6 mb-6">
          <h3 className="font-semibold text-foreground mb-4">Guest details</h3>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Name</p>
              <p className="font-medium text-foreground">{guestName}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Phone</p>
              <p className="font-medium text-foreground">{guestPhone}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Booking source</p>
              <p className="font-medium text-foreground">{booking.booking_source}</p>
            </div>
            {booking.created_at && (
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Booked on</p>
                <p className="font-medium text-foreground">
                  {formatDateTime12h(booking.created_at)}
                </p>
              </div>
            )}
            {booking.applied_offer?.title && (
              <div className="sm:col-span-2">
                <p className="text-muted-foreground text-xs mb-0.5">Dining offer</p>
                <p className="font-medium text-foreground">{booking.applied_offer.title}</p>
                {(booking.applied_offer.type || booking.applied_offer.validity) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[booking.applied_offer.type, booking.applied_offer.validity].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel rounded-2xl border border-border p-6 mb-6 text-center">
          {booking.qr_token ? (
            <>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(booking.qr_token)}`}
                alt="Booking QR code"
                className="w-40 h-40 mx-auto mb-3 rounded-xl border border-slate-200 bg-white p-2"
              />
              <p className="text-sm text-muted-foreground mb-1">
                Show this QR at the restaurant. Staff will see your dining offer and apply it on the food bill.
              </p>
              <p className="text-[11px] text-slate-400 font-mono break-all">{booking.qr_token}</p>
            </>
          ) : (
            <>
              <div className="w-28 h-28 mx-auto mb-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-medium">
                QR Code
              </div>
              <p className="text-sm text-muted-foreground">
                QR will appear once check-in scanning is enabled for this booking.
              </p>
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
            {isCancelling ? "Cancelling..." : "Cancel Reservation"}
          </button>
        )}
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
