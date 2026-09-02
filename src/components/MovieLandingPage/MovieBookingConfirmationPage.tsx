"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Film,
  MapPin,
  Printer,
  QrCode,
  Share2,
  Ticket,
  User,
  ArrowRight,
  Loader2,
  AlertCircle,
  Armchair,
  Sparkles,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { useGetMovieBookingQuery } from "@/services/api";

interface MovieBookingConfirmationPageProps {
  bookingId: string;
}

export default function MovieBookingConfirmationPage({ bookingId }: MovieBookingConfirmationPageProps) {
  const { data: booking, isLoading, isError } = useGetMovieBookingQuery(bookingId);

  const showDateFormatted = useMemo(() => {
    if (!booking?.showtime_starts_at) return "";
    try {
      const dt = new Date(booking.showtime_starts_at.replace(" ", "T"));
      return dt.toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return booking.showtime_starts_at;
    }
  }, [booking?.showtime_starts_at]);

  const showTimeFormatted = useMemo(() => {
    if (!booking?.showtime_starts_at) return "";
    try {
      const parts = booking.showtime_starts_at.split(" ");
      const timePart = parts[1] || parts[0];
      const [hStr, mStr] = timePart.split(":");
      let h = parseInt(hStr, 10);
      const m = mStr || "00";
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h.toString().padStart(2, "0")}:${m} ${ampm}`;
    } catch {
      return booking.showtime_starts_at;
    }
  }, [booking?.showtime_starts_at]);

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: `Movie Ticket: ${booking?.movie_title}`,
          text: `I booked ${booking?.ticket_qty} tickets for ${booking?.movie_title} at ${booking?.cinema_name}! Booking Ref: ${booking?.booking_code}`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Ticket link copied to clipboard!");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d0f18] text-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="size-10 animate-spin text-[#F84464]" />
        <p className="text-sm font-medium text-slate-300">Loading your M-Ticket…</p>
      </div>
    );
  }

  if (isError || !booking) {
    return (
      <div className="min-h-screen bg-[#0d0f18] text-white flex flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertCircle className="size-12 text-rose-400" />
        <h2 className="text-xl font-bold">Booking Not Found</h2>
        <p className="text-sm text-slate-400 max-w-md">
          We couldn't retrieve the details for this booking ID.
        </p>
        <Link
          href="/movies"
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F84464] to-[#6900AA] text-white text-sm font-bold shadow"
        >
          Explore Movies
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0f18] text-white py-12 px-4 sm:px-6 md:px-8 flex flex-col items-center justify-center">
      {/* Success Notification Banner */}
      <div className="max-w-2xl w-full text-center space-y-3 mb-8">
        <div className="size-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 animate-in zoom-in-75 duration-200">
          <CheckCircle2 className="size-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
          Booking Confirmed!
        </h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Your digital ticket is ready. Show this M-Ticket or booking code at the cinema gate.
        </p>
      </div>

      {/* Realistic M-Ticket Pass Container */}
      <div className="max-w-xl w-full bg-slate-950 border border-white/15 rounded-3xl overflow-hidden shadow-2xl relative">
        {/* Top Gradient Header */}
        <div className="bg-gradient-to-r from-[#F84464] to-[#6900AA] p-6 text-white relative">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/80">
                Official M-Ticket
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold truncate mt-0.5">
                {booking.movie_title}
              </h2>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-white/90">
                <span className="font-semibold">{booking.showtime_format}</span>
                <span>•</span>
                <span>{booking.showtime_language}</span>
                {booking.movie_certificate && (
                  <>
                    <span>•</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/25 font-bold">
                      {booking.movie_certificate}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] text-white/70 uppercase tracking-wider block">Booking Code</span>
              <span className="font-mono text-sm sm:text-base font-extrabold text-white bg-black/20 px-2.5 py-1 rounded-lg border border-white/20">
                {booking.booking_code}
              </span>
            </div>
          </div>
        </div>

        {/* Ticket Details Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Cinema & Screen */}
          <div className="flex items-start gap-3">
            <MapPin className="size-5 text-[#F84464] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-white">{booking.cinema_name}</p>
              {booking.cinema_address && (
                <p className="text-xs text-slate-400 mt-0.5">{booking.cinema_address}</p>
              )}
              <p className="text-xs text-rose-400 font-semibold mt-1">
                {booking.screen_name} {booking.screen_type ? `(${booking.screen_type})` : ""}
              </p>
            </div>
          </div>

          {/* Show Timing & Date Grid */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 text-xs">
            <div className="space-y-1">
              <span className="text-slate-400 flex items-center gap-1.5 font-semibold">
                <Calendar className="size-3.5 text-fuchsia-400" /> Show Date
              </span>
              <p className="text-sm font-bold text-white">{showDateFormatted}</p>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 flex items-center gap-1.5 font-semibold">
                <Clock className="size-3.5 text-fuchsia-400" /> Show Time
              </span>
              <p className="text-sm font-bold text-white">{showTimeFormatted}</p>
            </div>
          </div>

          {/* Reserved Seats List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider">
                Seats ({booking.ticket_qty} Tickets)
              </span>
              <span className="text-white font-bold">{booking.grand_total} ETB</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {booking.seats?.map((seat) => (
                <span
                  key={seat.seat_identifier}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 border border-white/20 text-xs font-extrabold text-white shadow-sm"
                >
                  <Armchair className="size-3.5 text-[#F84464]" />
                  {seat.seat_identifier}
                  {seat.tier_name ? (
                    <span className="text-slate-400 font-normal">({seat.tier_name})</span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>

          {/* Customer Attendee */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-500 block">Ticket Holder</span>
              <span className="text-sm font-bold text-white">{booking.guest_name}</span>
            </div>
            <div className="text-right">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 block">Phone</span>
              <span className="font-medium text-slate-300">{booking.guest_phone}</span>
            </div>
          </div>

          {/* QR Code & Barcode Gate Pass Block */}
          <div className="pt-6 border-t border-dashed border-white/20 flex flex-col items-center justify-center gap-3 text-center">
            <div className="p-3 bg-white rounded-2xl shadow-inner inline-flex items-center justify-center">
              <QrCode className="size-24 text-slate-950" />
            </div>
            <p className="font-mono text-xs font-bold text-slate-400 tracking-widest">
              SCAN AT CINEMA GATE • {booking.booking_code}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="max-w-xl w-full flex flex-wrap items-center justify-center gap-3 mt-8 print:hidden">
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold border border-white/15 transition-colors cursor-pointer"
        >
          <Printer className="size-4" /> Print / Save Ticket
        </button>

        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold border border-white/15 transition-colors cursor-pointer"
        >
          <Share2 className="size-4 text-purple-400" /> Share Ticket
        </button>

        <Link
          href="/movies"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#F84464] to-[#6900AA] text-white text-xs sm:text-sm font-bold shadow-lg shadow-[#F84464]/25 hover:opacity-90 transition-opacity"
        >
          Explore More Movies <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
