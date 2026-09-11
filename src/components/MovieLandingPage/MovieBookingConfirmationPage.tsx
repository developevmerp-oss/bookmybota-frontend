"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Loader2,
  MapPin,
  Printer,
  Share2,
  Smartphone,
  AlertCircle,
  Armchair,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useGetMovieBookingQuery } from "@/services/api";
import { formatMoney } from "@/lib/currencyFormat";
import { buildMovieTicketPdf, downloadPdfBlob } from "@/lib/movieTicketPdf";

interface MovieBookingConfirmationPageProps {
  bookingId: string;
}

export default function MovieBookingConfirmationPage({
  bookingId,
}: MovieBookingConfirmationPageProps) {
  const { data: booking, isLoading, isError } = useGetMovieBookingQuery(bookingId);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const showDateFormatted = useMemo(() => {
    if (!booking?.showtime_starts_at) return "";
    try {
      const dt = new Date(String(booking.showtime_starts_at).replace(" ", "T"));
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
      const parts = String(booking.showtime_starts_at).split(" ");
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

  const qrValue = booking?.qr_code_token || booking?.booking_code || bookingId;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(booking?.booking_code || qrValue);
      setCopied(true);
      toast.success("Booking code copied");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy code");
    }
  };

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    if (!booking) return;
    setDownloading(true);
    try {
      const blob = await buildMovieTicketPdf(booking);
      const code = booking.booking_code || booking.id.slice(0, 8);
      downloadPdfBlob(blob, `BookMyBota-Movie-${code}.pdf`);
      toast.success("Ticket PDF downloaded");
    } catch {
      toast.error("Could not prepare the ticket PDF. Try Print / Save instead.");
    } finally {
      setDownloading(false);
    }
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
      <div className="min-h-screen bg-[#F5F5F7] text-slate-800 flex flex-col items-center justify-center gap-3">
        <Loader2 className="size-10 animate-spin text-[#6900AA]" />
        <p className="text-sm font-medium text-slate-500">Loading your M-Ticket…</p>
      </div>
    );
  }

  if (isError || !booking) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] text-slate-800 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertCircle className="size-12 text-rose-500" />
        <h2 className="text-xl font-bold text-slate-900">Booking Not Found</h2>
        <p className="text-sm text-slate-500 max-w-md">
          We couldn&apos;t retrieve the details for this booking ID.
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
    <div className="min-h-screen w-full overflow-x-hidden overflow-y-auto bg-[#F5F5F7] text-slate-900 py-8 sm:py-12 px-4 sm:px-6 pb-24">
      <div className="max-w-xl mx-auto w-full flex flex-col items-center">
        <div className="w-full text-center space-y-3 mb-6 sm:mb-8">
          <div className="size-14 sm:size-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="size-7 sm:size-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Booking Confirmed!</h1>
          <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Your digital M-Ticket is ready
            {booking.guest_email ? (
              <>
                {" "}
                and a confirmation was sent to{" "}
                <span className="font-semibold text-slate-700">{booking.guest_email}</span>
              </>
            ) : null}
            . Show this QR or booking code at the cinema gate.
          </p>
        </div>

        {/* Full ticket card — height grows with content; page scrolls so QR is never cut off */}
        <div className="w-full rounded-2xl border border-slate-200/80 bg-white shadow-lg shadow-purple-500/[0.06] ring-1 ring-slate-100 overflow-hidden print:shadow-none">
          <div className="h-1.5 bg-gradient-to-r from-[#57008E] via-[#6900AA] to-[#F84464]" />

          <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-[#6900AA] to-[#57008E] px-4 py-2.5 sm:px-6">
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-white/95">
              Book My Bota · Official M-Ticket
            </p>
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-white/90">
              Confirmed
            </span>
          </div>

          <div className="p-4 sm:p-6 space-y-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-extrabold leading-snug text-slate-900">
                  {booking.movie_title}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {[booking.showtime_format, booking.showtime_language, booking.movie_certificate]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-[#E8D4FF] bg-[#FBF6FF] px-2.5 py-1.5 font-mono text-xs font-bold text-[#6900AA] cursor-pointer hover:bg-[#F7E9FF]"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {booking.booking_code}
              </button>
            </div>

            <div className="mt-4 flex items-start gap-2 text-sm text-slate-600">
              <MapPin size={15} className="mt-0.5 shrink-0 text-[#6900AA]" />
              <div>
                <p className="font-bold text-slate-900">{booking.cinema_name}</p>
                {booking.cinema_address ? (
                  <p className="text-slate-500 text-xs mt-0.5">{booking.cinema_address}</p>
                ) : null}
                <p className="text-xs font-semibold text-[#6900AA] mt-1">
                  {booking.screen_name}
                  {booking.screen_type ? ` (${booking.screen_type})` : ""}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 border-y border-slate-100">
            <div className="px-4 sm:px-5 py-4 border-r border-slate-100">
              <p className="text-[0.625rem] font-medium uppercase tracking-wide text-slate-400 flex items-center gap-1">
                <Calendar size={11} /> Date
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{showDateFormatted}</p>
            </div>
            <div className="px-4 sm:px-5 py-4">
              <p className="text-[0.625rem] font-medium uppercase tracking-wide text-slate-400 flex items-center gap-1">
                <Clock size={11} /> Time
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{showTimeFormatted}</p>
            </div>
          </div>

          <div className="px-4 sm:px-6 py-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.625rem] font-medium uppercase tracking-wide text-slate-400">
                Seats ({booking.ticket_qty} ticket{booking.ticket_qty === 1 ? "" : "s"})
              </p>
              <p className="text-sm font-extrabold text-emerald-600 tabular-nums">
                {formatMoney(Number(booking.grand_total) || 0)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(booking.seats || []).map((seat) => (
                <span
                  key={seat.seat_identifier}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8D4FF] bg-[#FBF6FF] px-2.5 py-1.5 text-xs font-bold text-slate-800"
                >
                  <Armchair size={13} className="text-[#F84464]" />
                  {seat.seat_identifier}
                  {seat.tier_name ? (
                    <span className="font-medium text-slate-500">({seat.tier_name})</span>
                  ) : null}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-[#FBF6FF]/80 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F7E9FF] text-[#6900AA]">
                <User size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-[0.625rem] font-medium uppercase tracking-wide text-slate-400">
                  Ticket holder
                </p>
                <p className="text-sm font-bold text-slate-900">{booking.guest_name}</p>
              </div>
              {booking.guest_phone ? (
                <p className="ml-auto shrink-0 text-xs font-medium text-slate-500">
                  {booking.guest_phone}
                </p>
              ) : null}
            </div>
          </div>

          {/* Perforation */}
          <div className="relative h-5 flex items-center" aria-hidden>
            <span className="absolute -left-2.5 h-5 w-5 rounded-full bg-[#F5F5F7] border border-slate-200" />
            <span className="absolute -right-2.5 h-5 w-5 rounded-full bg-[#F5F5F7] border border-slate-200" />
            <div className="mx-3 flex-1 border-t border-dashed border-slate-300" />
          </div>

          {/* Full QR — always fully visible; page scrolls if needed */}
          <div className="px-4 sm:px-6 pb-6 sm:pb-8 pt-1">
            <div className="rounded-2xl border border-[#E8D4FF] bg-gradient-to-br from-[#FBF6FF] via-white to-[#F7E9FF]/40 p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5">
                <div className="shrink-0 rounded-xl bg-white p-3 shadow-md ring-1 ring-[#E8D4FF]/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=12&data=${encodeURIComponent(
                      qrValue
                    )}`}
                    alt={`QR ${booking.booking_code || qrValue}`}
                    width={160}
                    height={160}
                    className="h-40 w-40 sm:h-44 sm:w-44 rounded-lg block"
                  />
                </div>
                <div className="min-w-0 flex-1 text-center sm:text-left pt-0.5">
                  <p className="text-sm font-bold text-slate-900 inline-flex items-center gap-1.5">
                    <Smartphone size={15} className="text-[#6900AA]" />
                    Entry QR
                  </p>
                  <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
                    Show this QR at the cinema gate. One scan per booking — keep it ready on your
                    phone.
                  </p>
                  <p className="mt-3 font-mono text-xs font-bold tracking-wider text-[#6900AA]">
                    {booking.booking_code || qrValue}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full flex flex-wrap items-center justify-center gap-3 mt-6 sm:mt-8 print:hidden">
          <button
            type="button"
            onClick={() => void handleDownloadPdf()}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F84464] to-[#6900AA] text-white text-sm font-bold shadow-md hover:opacity-95 disabled:opacity-60 cursor-pointer"
          >
            {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {downloading ? "Preparing PDF…" : "Download Ticket (PDF)"}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 text-sm font-bold border border-slate-200 shadow-sm cursor-pointer"
          >
            <Printer className="size-4" /> Print / Save
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 text-sm font-bold border border-slate-200 shadow-sm cursor-pointer"
          >
            <Share2 className="size-4 text-[#6900AA]" /> Share
          </button>
          <Link
            href="/movies"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 text-sm font-bold border border-slate-200 shadow-sm"
          >
            Explore Movies <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/customer/dashboard"
            className="w-full sm:w-auto text-center text-sm font-semibold text-[#6900AA] hover:underline mt-1"
          >
            View in My Bookings
          </Link>
        </div>
      </div>
    </div>
  );
}
