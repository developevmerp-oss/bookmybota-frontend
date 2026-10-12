"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Check,
  Clock,
  Download,
  Film,
  Home,
  Loader2,
  MapPin,
  Share2,
  Sparkles,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { useGetMovieBookingQuery } from "@/services/api";
import { formatMoney } from "@/lib/currencyFormat";
import { formatDateCustomer, formatTime12h } from "@/lib/dateFormat";
import { buildMovieTicketPdf, downloadPdfBlob } from "@/lib/movieTicketPdf";
import { ConfirmationPageUI2Shimmer } from "@/components/Shared/Shimmer";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import BookingTicketPerforation, {
  BOOKING_CONFIRM_PAGE_BG,
} from "@/components/Shared/BookingTicketPerforation";

const CONFIRM_PAGE_MAX =
  "mx-auto w-full max-w-[64rem] px-4 md:px-5 lg:px-10 xl:px-12";

const actionBtnSecondary =
  "inline-flex min-h-[2.875rem] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-[0.75rem] min-[480px]:text-[0.8125rem] lg:text-[0.8125rem] xl:text-[0.875rem] font-semibold text-slate-800 transition hover:bg-slate-50";

const actionBtnPrimary =
  "inline-flex min-h-[2.875rem] w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-2.5 py-2.5 text-[0.75rem] min-[480px]:text-[0.8125rem] lg:text-[0.8125rem] xl:text-[0.875rem] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";

function seatListLabel(
  seats: Array<{ seat_identifier: string; tier_name?: string }> | undefined
): string {
  if (!seats?.length) return "—";
  return seats
    .map((s) => {
      const id = s.seat_identifier;
      if (s.tier_name && !id.toLowerCase().includes(s.tier_name.toLowerCase())) {
        return `${s.tier_name} ${id}`;
      }
      return id;
    })
    .join(", ");
}

function DetailCell({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon size={15} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-[0.6875rem] font-medium text-slate-500 leading-tight">{label}</p>
        <p className="mt-0.5 text-[0.875rem] sm:text-[0.9375rem] font-semibold text-slate-900 break-words leading-snug">
          {value}
        </p>
      </div>
    </div>
  );
}

/**
 * Confirmation UI v2 — classic dining/event-style layout (for movie bookings).
 * Swap via CONFIRMATION_UI_VERSION or comment/uncomment in MovieBookingConfirmationPage.
 */
export default function ConfirmationPageUI2({ bookingId }: { bookingId: string }) {
  const { data: booking, isLoading, isError } = useGetMovieBookingQuery(bookingId);
  const [downloading, setDownloading] = useState(false);
  const [headerReady, setHeaderReady] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setHeaderReady(true), 40);
    return () => window.clearTimeout(t);
  }, [bookingId]);

  const poster = useMemo(
    () =>
      resolveMediaUrl(booking?.movie_poster) ||
      resolveMediaUrl(booking?.cinema_image) ||
      "",
    [booking?.movie_poster, booking?.cinema_image]
  );
  const bookingCode =
    booking?.booking_code || booking?.id?.slice(0, 8).toUpperCase() || "";
  const qrValue = booking?.qr_code_token || booking?.booking_code || bookingId;
  const cinemaLine = [booking?.cinema_name, booking?.cinema_address]
    .filter(Boolean)
    .join(", ");
  const seatsLabel = seatListLabel(booking?.seats);

  const downloadPdf = async () => {
    if (!booking || downloading) return;
    setDownloading(true);
    try {
      const blob = await buildMovieTicketPdf(booking);
      downloadPdfBlob(blob, `BookMyBota-Movie-${bookingCode}.pdf`);
      toast.success("Ticket PDF downloaded");
    } catch {
      toast.error("Could not prepare the ticket PDF.");
    } finally {
      setDownloading(false);
    }
  };

  const shareTicket = async () => {
    const text = `My tickets for ${booking?.movie_title || "this movie"} are confirmed. Booking ${bookingCode}`;
    try {
      await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
      toast.success("Ticket link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  if (isLoading) return <ConfirmationPageUI2Shimmer />;

  if (isError || !booking) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-slate-500">Could not load booking details.</p>
        <Link href="/movies" className="text-[#6900AA] font-semibold">
          Explore Movies
        </Link>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-10 sm:pb-12"
      style={{ backgroundColor: BOOKING_CONFIRM_PAGE_BG }}
    >
      <style>{`
        @keyframes confirmCheckPop {
          0% { transform: scale(0.4); opacity: 0; }
          55% { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes confirmCheckDraw {
          from { stroke-dashoffset: 28; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes confirmCheckRipple {
          0% { transform: scale(0.85); opacity: 0.45; }
          100% { transform: scale(1.65); opacity: 0; }
        }
        @keyframes confirmHeaderIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .confirm-check-pop { animation: confirmCheckPop 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .confirm-check-draw {
          stroke-dasharray: 28; stroke-dashoffset: 28;
          animation: confirmCheckDraw 0.4s cubic-bezier(0.65, 0, 0.35, 1) 0.28s forwards;
        }
        .confirm-check-ripple { animation: confirmCheckRipple 0.85s ease-out 0.2s both; }
        .confirm-header-in { animation: confirmHeaderIn 0.45s ease-out 0.15s both; }
      `}</style>

      <div className={`${CONFIRM_PAGE_MAX} pt-6 sm:pt-8`}>
        <div className={`mb-5 sm:mb-6 ${headerReady ? "confirm-header-in" : "opacity-0"}`}>
          <div className="flex items-start gap-3.5 sm:gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="relative mt-0.5 shrink-0">
              <span
                className="pointer-events-none absolute inset-0 rounded-full bg-[#34A853]/25 confirm-check-ripple"
                aria-hidden
              />
              <span
                className={`relative flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-[#E8F5E9] text-[#2E7D32] shadow-sm ring-4 ring-[#E8F5E9]/60 ${
                  headerReady ? "confirm-check-pop" : "opacity-0"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" aria-hidden>
                  <path
                    d="M5.5 12.5 L10 17 L18.5 7.5"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={headerReady ? "confirm-check-draw" : ""}
                  />
                </svg>
              </span>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h1 className="text-[1.375rem] sm:text-[1.625rem] lg:text-[1.875rem] font-extrabold text-slate-900 leading-tight tracking-tight">
                Your ticket is confirmed
              </h1>
              <p className="mt-1.5 text-[0.875rem] sm:text-[0.9375rem] text-slate-600 leading-relaxed">
                Your booking for{" "}
                <span className="font-semibold text-slate-800">{booking.movie_title}</span> is
                successful.
              </p>
              <p className="mt-1 text-[0.8125rem] sm:text-[0.875rem] text-slate-500 leading-relaxed">
                Show the QR code at the cinema for entry.
              </p>
            </div>
          </div>
        </div>

        <div className="relative overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative flex flex-col gap-0 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1 p-4 sm:p-5 flex justify-center sm:justify-start bg-white">
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={poster}
                  alt={booking.movie_title || "Movie"}
                  className="block h-auto w-auto max-h-[12.5rem] sm:max-h-[15rem] md:max-h-[17rem] max-w-full sm:max-w-[min(100%,20rem)] rounded-xl"
                />
              ) : (
                <div className="flex h-[12.5rem] w-[9rem] items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                  <Film size={36} />
                </div>
              )}
            </div>
            <div className="relative w-full sm:w-[min(100%,17rem)] sm:shrink-0 md:w-[18rem] lg:w-[19rem]">
              <div
                className="hidden sm:block absolute left-0 top-5 bottom-5 w-px border-l border-dashed border-slate-300"
                aria-hidden
              />
              <div className="border-t border-dashed border-slate-300 px-5 py-5 sm:border-t-0 sm:px-6 sm:py-5 sm:pl-8">
                <div className="mx-auto flex w-full max-w-[15rem] flex-col items-center text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=6&data=${encodeURIComponent(
                      qrValue
                    )}`}
                    alt={`QR ${bookingCode}`}
                    className="h-[9.5rem] w-[9.5rem] sm:h-[10.5rem] sm:w-[10.5rem] rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm"
                  />
                  <p className="mt-3 text-[0.9375rem] font-bold text-slate-900">M-Ticket QR</p>
                  <p className="mt-1 font-mono text-[0.8125rem] font-bold text-slate-700">
                    {bookingCode}
                  </p>
                  <p className="mt-2 text-[0.75rem] sm:text-[0.8125rem] text-slate-500 leading-relaxed">
                    Show this QR at the cinema entrance.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <BookingTicketPerforation />

          <div className="px-5 pt-5 pb-5 sm:px-6 sm:pt-6 sm:pb-6 lg:px-8">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F5E9] px-2.5 py-1 text-[0.6875rem] font-semibold text-[#2E7D32]">
              <Check size={12} strokeWidth={3} />
              Booking Confirmed
            </span>
            <h2 className="mt-3 text-[1.25rem] sm:text-[1.375rem] lg:text-[1.5rem] font-extrabold leading-snug text-slate-900">
              {booking.movie_title}
            </h2>
            {cinemaLine ? (
              <p className="mt-2 flex items-start gap-1.5 text-[0.875rem] text-slate-500">
                <MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" />
                <span>{cinemaLine}</span>
              </p>
            ) : null}
            <div className="mt-5 grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-5">
              <DetailCell
                icon={Ticket}
                label="Screen"
                value={booking.screen_name || "—"}
              />
              <DetailCell icon={Ticket} label="Seats" value={seatsLabel} />
              <DetailCell
                icon={Ticket}
                label="Tickets"
                value={String(booking.ticket_qty ?? "—")}
              />
              <DetailCell
                icon={Calendar}
                label="Date"
                value={formatDateCustomer(booking.showtime_starts_at)}
              />
              <DetailCell
                icon={Clock}
                label="Time"
                value={formatTime12h(booking.showtime_starts_at)}
              />
              <DetailCell
                icon={Film}
                label="Format"
                value={
                  [booking.showtime_language, booking.showtime_format]
                    .filter(Boolean)
                    .join(", ") || "—"
                }
              />
            </div>
          </div>

          <BookingTicketPerforation />

          <div className="px-5 pt-5 pb-5 sm:px-6 sm:pt-6 sm:pb-6 lg:px-8">
            <p className="text-[0.9375rem] sm:text-[1rem] font-bold text-slate-900">
              Order Summary
            </p>
            <div className="mt-4 space-y-2.5">
              <div className="flex justify-between gap-4 text-[0.875rem] text-slate-600">
                <span>Tickets</span>
                <span className="font-semibold tabular-nums text-slate-800">
                  {formatMoney(Number(booking.ticket_amount) || 0)}
                </span>
              </div>
              {Number(booking.beverage_total) > 0 ? (
                <div className="flex justify-between gap-4 text-[0.875rem] text-slate-600">
                  <span>Snacks &amp; beverages</span>
                  <span className="font-semibold tabular-nums text-slate-800">
                    {formatMoney(Number(booking.beverage_total) || 0)}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 text-[0.875rem] text-slate-600">
                <span>Convenience fee</span>
                <span className="font-semibold tabular-nums text-slate-800">
                  {formatMoney(Number(booking.convenience_fee_total) || 0)}
                </span>
              </div>
              {Number(booking.discount_amount) > 0 ? (
                <div className="flex justify-between gap-4 text-[0.875rem] text-[#57008E]">
                  <span>Discount</span>
                  <span className="font-semibold tabular-nums">
                    −{formatMoney(Number(booking.discount_amount) || 0)}
                  </span>
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-slate-100 px-4 py-3.5 sm:px-5">
              <span className="text-[0.9375rem] font-bold text-slate-900">Amount Paid</span>
              <span className="shrink-0 text-[1.125rem] sm:text-[1.25rem] font-extrabold tabular-nums text-slate-900">
                {formatMoney(Number(booking.grand_total) || 0)}
              </span>
            </div>
          </div>

          <div className="border-t border-slate-200 px-5 py-5 sm:px-6 sm:py-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => void downloadPdf()}
                disabled={downloading}
                className={actionBtnPrimary}
              >
                {downloading ? (
                  <Loader2 size={16} className="animate-spin shrink-0" />
                ) : (
                  <Download size={16} className="shrink-0" />
                )}
                <span className="truncate">
                  {downloading ? "Preparing PDF…" : "Download Ticket (PDF)"}
                </span>
              </button>
              <Link href="/customer/dashboard" className={actionBtnSecondary}>
                <Ticket size={16} className="text-slate-600 shrink-0" />
                <span className="truncate">View My Bookings</span>
              </Link>
              <button type="button" onClick={() => void shareTicket()} className={actionBtnSecondary}>
                <Share2 size={16} className="text-slate-600 shrink-0" />
                <span className="truncate">Share Tickets</span>
              </button>
              <Link href="/movies" className={actionBtnSecondary}>
                <Calendar size={16} className="text-slate-600 shrink-0" />
                <span className="truncate">Browse Movies</span>
              </Link>
            </div>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-[0.6875rem] text-slate-400 sm:px-6 lg:px-8">
            <p className="min-w-0 break-all sm:truncate" title={booking.id}>
              Booking ID: {booking.id}
            </p>
          </div>
        </div>

        <div className="mt-6 sm:mt-8 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex items-start gap-3 sm:items-center sm:gap-4 min-w-0">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F7E9FF] text-[#6900AA]">
              <Sparkles size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-[0.9375rem] sm:text-[1rem] font-bold text-slate-900">
                Looking for more movies?
              </p>
              <p className="mt-0.5 text-[0.8125rem] sm:text-[0.875rem] text-slate-500 leading-relaxed">
                Discover the latest releases and showtimes near you.
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2.5 min-[480px]:flex-row min-[480px]:items-center sm:w-auto sm:shrink-0">
            <Link
              href="/movies"
              className="inline-flex min-h-[2.875rem] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-[0.875rem] font-semibold text-white transition hover:bg-slate-800 min-[480px]:w-auto"
            >
              Explore Movies
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/"
              className={`${actionBtnSecondary} min-[480px]:w-auto min-[480px]:min-w-[9.5rem]`}
            >
              <Home size={16} className="text-slate-600 shrink-0" />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Optional helper if a page wants to pass a custom classic body later. */
export function ConfirmationPageUI2Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen pb-10 sm:pb-12" style={{ backgroundColor: BOOKING_CONFIRM_PAGE_BG }}>
      {children}
    </div>
  );
}
