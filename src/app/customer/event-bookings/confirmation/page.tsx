"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CheckCircle,
  Clock,
  Loader2,
  MapPin,
  Ticket,
} from "lucide-react";
import { useGetEventBookingByIdQuery } from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { formatDate, formatTime12h } from "@/lib/dateFormat";

function formatInr(n: number | string | undefined) {
  const value = Number(n) || 0;
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const bookingId = searchParams.get("id") || "";

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const { data: booking, isLoading, error } = useGetEventBookingByIdQuery(bookingId, {
    skip: !bookingId,
  });

  if (!bookingId) {
    return (
      <div className="min-h-screen bg-background pt-24 text-center px-4">
        <p className="text-muted-foreground mb-4">No booking ID provided.</p>
        <Link href="/events" className="btn-primary inline-block">
          Browse events
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-24 flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="animate-spin text-rose-600" size={32} />
        Loading confirmation...
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-background pt-24 text-center px-4">
        <p className="text-muted-foreground mb-4">Could not load booking details.</p>
        <Link href="/customer/dashboard" className="btn-primary inline-block">
          My Bookings
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-10 pb-16">
      <div className="max-w-lg mx-auto px-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500/15 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
            <CheckCircle size={32} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Tickets confirmed!
          </h1>
          <p className="text-muted-foreground text-sm">
            Your tickets for{" "}
            <strong className="text-foreground">{booking.event_name}</strong> are booked.
          </p>
        </div>

        <div className="glass-panel rounded-2xl border border-border p-6 space-y-4 mb-6">
          <div className="flex items-start gap-3">
            <Ticket size={18} className="text-rose-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Event</p>
              <p className="font-semibold text-foreground">{booking.event_name}</p>
              {booking.venue_name && (
                <p className="text-sm text-muted-foreground mt-0.5 flex items-start gap-1">
                  <MapPin size={12} className="mt-1 shrink-0" />
                  {booking.venue_name}
                  {booking.venue_address ? `, ${booking.venue_address}` : ""}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
            <div className="flex items-start gap-2">
              <Calendar size={16} className="text-rose-600 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-sm font-medium text-foreground">
                  {formatDate(booking.starts_at)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock size={16} className="text-rose-600 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Time</p>
                <p className="text-sm font-medium text-foreground">
                  {formatTime12h(booking.starts_at)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Ticket size={16} className="text-rose-600 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Tickets</p>
                <p className="text-sm font-medium text-foreground">{booking.ticket_qty}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Ticket size={16} className="text-rose-600 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Total paid</p>
                <p className="text-sm font-medium text-foreground">
                  {formatInr(booking.grand_total)}
                </p>
              </div>
            </div>
          </div>

          {booking.items && booking.items.length > 0 && (
            <ul className="text-sm space-y-1 pt-2 border-t border-border">
              {booking.items.map((item) => (
                <li key={item.id} className="flex justify-between text-muted-foreground">
                  <span>
                    {item.ticket_type} × {item.qty}
                  </span>
                  <span className="text-foreground font-medium">
                    {formatInr(Number(item.unit_price) * item.qty)}
                  </span>
                </li>
              ))}
              <li className="flex justify-between pt-1">
                <span className="text-muted-foreground">Convenience fee</span>
                <span className="font-medium text-foreground">
                  {formatInr(booking.convenience_fee_total)}
                </span>
              </li>
            </ul>
          )}

          {booking.qr_code && (
            <div className="pt-3 border-t border-border text-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(booking.qr_code)}`}
                alt="Ticket QR code"
                className="w-36 h-36 mx-auto mb-2 rounded-xl border border-slate-200 bg-white p-2"
              />
              <p className="text-xs text-muted-foreground">Show this QR at entry</p>
              <p className="text-[11px] text-slate-400 font-mono mt-1">{booking.qr_code}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground pt-2 border-t border-border">
            Booking ID: {booking.id}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={`/customer/event-bookings/${booking.id}`}
            className="btn-primary flex-1 inline-flex items-center justify-center gap-2 py-3"
          >
            View booking details <ArrowRight size={16} />
          </Link>
          {user?.role === "customer" && (
            <Link
              href="/customer/dashboard"
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-border bg-white text-sm font-semibold text-foreground hover:bg-accent transition-colors"
            >
              My Bookings
            </Link>
          )}
        </div>

        <button
          onClick={() => router.push("/events")}
          className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          Continue browsing events
        </button>
      </div>
    </div>
  );
}

export default function EventBookingConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background pt-24 flex justify-center text-muted-foreground">
          <Loader2 className="animate-spin text-rose-600" size={32} />
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  );
}
