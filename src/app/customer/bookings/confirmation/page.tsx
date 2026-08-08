"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  Calendar,
  Clock,
  MapPin,
  Users,
  UtensilsCrossed,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useGetBookingByIdQuery } from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { formatDate, formatTime12h } from "@/lib/dateFormat";

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const bookingId = searchParams.get("id") || "";
  const arrivalNote = searchParams.get("arrival") || "";

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const { data: booking, isLoading, error } = useGetBookingByIdQuery(bookingId, {
    skip: !bookingId,
  });

  if (!bookingId) {
    return (
      <div className="min-h-screen bg-background pt-24 text-center px-4">
        <p className="text-muted-foreground mb-4">No booking ID provided.</p>
        <Link href="/" className="btn-primary inline-block">
          Browse restaurants
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
          My Reservations
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
            Booking Confirmed!
          </h1>
          <p className="text-muted-foreground text-sm">
            Your table at <strong className="text-foreground">{booking.business_name}</strong> is
            reserved.
          </p>
        </div>

        <div className="glass-panel rounded-2xl border border-border p-6 space-y-4 mb-6">
          <div className="flex items-start gap-3">
            <UtensilsCrossed size={18} className="text-rose-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Restaurant</p>
              <p className="font-semibold text-foreground">{booking.business_name}</p>
              {booking.business_address && (
                <p className="text-sm text-muted-foreground mt-0.5 flex items-start gap-1">
                  <MapPin size={12} className="mt-1 shrink-0" />
                  {booking.business_address}
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
                  {formatDate(booking.booking_time)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock size={16} className="text-rose-600 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Time</p>
                <p className="text-sm font-medium text-foreground">
                  {formatTime12h(booking.booking_time)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Users size={16} className="text-rose-600 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Guests</p>
                <p className="text-sm font-medium text-foreground">{booking.guests ?? "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <UtensilsCrossed size={16} className="text-rose-600 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Table</p>
                <p className="text-sm font-medium text-foreground">
                  {booking.table_number ? `Table ${booking.table_number}` : "Assigned at venue"}
                </p>
              </div>
            </div>
          </div>

          {arrivalNote && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">Approx. arrival</p>
              <p className="text-sm font-medium text-foreground">{arrivalNote}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground pt-2 border-t border-border">
            Booking ID: {booking.id}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={`/customer/bookings/${booking.id}`}
            className="btn-primary flex-1 inline-flex items-center justify-center gap-2 py-3"
          >
            View booking details <ArrowRight size={16} />
          </Link>
          {(user?.role === "customer") && (
            <Link
              href="/customer/dashboard"
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-border bg-white text-sm font-semibold text-foreground hover:bg-accent transition-colors"
            >
              My Reservations
            </Link>
          )}
        </div>

        <button
          onClick={() => router.push("/")}
          className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          Continue browsing
        </button>
      </div>
    </div>
  );
}

export default function BookingConfirmationPage() {
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
