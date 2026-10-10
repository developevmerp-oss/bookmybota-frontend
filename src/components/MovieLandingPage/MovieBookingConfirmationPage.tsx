"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Armchair,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Film,
  Loader2,
  MapPin,
  Monitor,
  Phone,
  Printer,
  Share2,
  Smartphone,
  Sparkles,
  AlertCircle,
  Ticket,
  User,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { useGetMovieBookingQuery } from "@/services/api";
import { formatMoney } from "@/lib/currencyFormat";
import { formatDateCustomer, formatDateTimeCustomer, formatTime12h } from "@/lib/dateFormat";
import { buildMovieTicketPdf, downloadPdfBlob } from "@/lib/movieTicketPdf";
import { CustomerFullscreenShimmer } from "@/components/Shared/Shimmer";
import { resolveMediaUrl } from "@/lib/mediaUrl";

interface MovieBookingConfirmationPageProps {
  bookingId: string;
}

const CONFIRM_PAGE_MAX = "mx-auto w-full max-w-[64rem] px-4 md:px-5 lg:px-10 xl:px-12";

const actionBtnSecondary =
  "inline-flex min-h-[2.875rem] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-[0.75rem] min-[480px]:text-[0.8125rem] lg:text-[0.8125rem] xl:text-[0.875rem] font-semibold text-slate-800 transition hover:bg-slate-50 print:hidden";

const actionBtnPrimary =
  "inline-flex min-h-[2.875rem] w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-2.5 py-2.5 text-[0.75rem] min-[480px]:text-[0.8125rem] lg:text-[0.8125rem] xl:text-[0.875rem] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 print:hidden";

function DetailCell({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof User;
  label: string;
  value: string;
  hint?: string;
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
        {hint ? (
          <p className="mt-0.5 text-[0.75rem] text-slate-500 leading-snug">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

export default function MovieBookingConfirmationPage({
  bookingId,
}: MovieBookingConfirmationPageProps) {
  const { data: booking, isLoading, isError } = useGetMovieBookingQuery(bookingId);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [headerReady, setHeaderReady] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setHeaderReady(true), 40);
    return () => window.clearTimeout(t);
  }, [bookingId]);

  const showDateFormatted = useMemo(() => {
    if (!booking?.showtime_starts_at) return "";
    const label = formatDateCustomer(String(booking.showtime_starts_at).replace(" ", "T"));
    return label === "—" ? String(booking.showtime_starts_at) : label;
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
      return formatTime12h(booking.showtime_starts_at);
    }
  }, [booking?.showtime_starts_at]);

  const bookedOnFormatted = useMemo(() => {
    if (!booking?.created_at) return "";
    const label = formatDateTimeCustomer(String(booking.created_at).replace(" ", "T"));
    return label === "—" ? "" : label;
  }, [booking?.created_at]);

  const qrValue = booking?.qr_code_token || booking?.booking_code || bookingId;
  const poster =
    resolveMediaUrl(booking?.movie_poster) ||
    resolveMediaUrl(booking?.cinema_image) ||
    "";
  const formatMeta = [
    booking?.showtime_format,
    booking?.showtime_language,
    booking?.movie_certificate,
  ]
    .filter(Boolean)
    .join(" · ");
  const cinemaLine = [booking?.cinema_name, booking?.cinema_address].filter(Boolean).join(", ");
  const screenLabel = [
    booking?.screen_name,
    booking?.screen_type ? `(${booking.screen_type})` : "",
  ]
    .filter(Boolean)
    .join(" ");

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
    return <CustomerFullscreenShimmer label="Loading ticket" />;
  }

  if (isError || !booking) {
    return (
      <div className="min-h-screen bg-white text-slate-800 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertCircle className="size-12 text-rose-500" />
        <h2 className="text-xl font-bold text-slate-900">Booking Not Found</h2>
        <p className="text-sm text-slate-500 max-w-md">
          We couldn&apos;t retrieve the details for this booking ID.
        </p>
        <Link
          href="/movies"
          className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold"
        >
          Explore Movies
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-white pb-10 sm:pb-12 print:bg-white">
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
        .confirm-check-pop {
          animation: confirmCheckPop 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .confirm-check-draw {
          stroke-dasharray: 28;
          stroke-dashoffset: 28;
          animation: confirmCheckDraw 0.4s cubic-bezier(0.65, 0, 0.35, 1) 0.28s forwards;
        }
        .confirm-check-ripple {
          animation: confirmCheckRipple 0.85s ease-out 0.2s both;
        }
        .confirm-header-in {
          animation: confirmHeaderIn 0.45s ease-out 0.15s both;
        }
        @media print {
          .confirm-check-pop,
          .confirm-check-draw,
          .confirm-check-ripple,
          .confirm-header-in {
            animation: none !important;
            opacity: 1 !important;
            stroke-dashoffset: 0 !important;
          }
        }
      `}</style>

      <div className={`${CONFIRM_PAGE_MAX} pt-6 sm:pt-8 print:pt-4`}>
        <div
          className={`mb-5 sm:mb-6 ${headerReady ? "confirm-header-in" : "opacity-0"}`}
        >
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
                <span className="sr-only">Confirmed</span>
              </span>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h1 className="text-[1.375rem] sm:text-[1.625rem] lg:text-[1.875rem] font-extrabold text-slate-900 leading-tight tracking-tight">
                Booking Confirmed!
              </h1>
              <p className="mt-1.5 text-[0.875rem] sm:text-[0.9375rem] text-slate-600 leading-relaxed">
                Your digital M-Ticket is ready
                {booking.guest_email ? (
                  <>
                    {" "}
                    and a confirmation was sent to{" "}
                    <span className="font-semibold text-slate-800">{booking.guest_email}</span>
                  </>
                ) : null}
                .
              </p>
              <p className="mt-1 text-[0.8125rem] sm:text-[0.875rem] text-slate-500 leading-relaxed">
                Show this QR or booking code at the cinema gate.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:shadow-none">
          {/* Row 1: poster + QR */}
          <div className="relative flex flex-col items-stretch gap-0 sm:flex-row sm:items-stretch">
            <div className="relative min-h-[14rem] min-w-0 flex-1 self-stretch w-full sm:min-h-0 sm:max-w-none lg:max-w-[38rem]">
              <div className="absolute inset-5">
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={poster}
                    alt={booking.movie_title || "Movie"}
                    className="h-full w-full rounded-xl object-cover bg-slate-100"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 text-slate-400">
                    <Film size={40} />
                  </div>
                )}
              </div>
            </div>

            <div className="relative flex sm:w-[min(100%,17rem)] sm:shrink-0 md:w-[18rem] lg:w-[19rem]">
              <div
                className="hidden sm:block absolute left-0 top-5 bottom-5 w-px border-l border-dashed border-slate-300"
                aria-hidden
              />
              <span
                className="hidden sm:block absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full bg-white border border-slate-200"
                aria-hidden
              />
              <span
                className="hidden sm:block absolute -left-2.5 -bottom-2.5 h-5 w-5 rounded-full bg-white border border-slate-200"
                aria-hidden
              />
              <div className="flex w-full flex-1 items-center justify-center border-t border-dashed border-slate-300 px-5 py-6 sm:border-t-0 sm:px-6 sm:py-8 sm:pl-8">
                <div className="flex w-full flex-col items-center text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=6&data=${encodeURIComponent(
                      qrValue
                    )}`}
                    alt={`QR ${booking.booking_code || qrValue}`}
                    className="h-[9.5rem] w-[9.5rem] sm:h-[10.5rem] sm:w-[10.5rem] rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm"
                  />
                  <p className="mt-4 text-[0.9375rem] font-bold text-slate-900 inline-flex items-center gap-1.5">
                    <Smartphone size={15} className="text-slate-500" />
                    Entry QR
                  </p>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="mt-1 inline-flex items-center gap-1.5 font-mono text-[0.8125rem] font-bold text-slate-700 hover:text-[#6900AA] cursor-pointer"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {booking.booking_code || qrValue}
                  </button>
                  <p className="mt-3 max-w-[15rem] text-[0.75rem] sm:text-[0.8125rem] text-slate-500 leading-relaxed">
                    Show this QR at the cinema gate. One scan per booking — keep it ready on your
                    phone.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: movie details */}
          <div className="border-t border-dashed border-slate-300 px-5 py-5 sm:px-6 sm:py-6 lg:px-8">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F5E9] px-2.5 py-1 text-[0.6875rem] font-semibold text-[#2E7D32]">
              <Check size={12} strokeWidth={3} />
              Booking Confirmed
            </span>
            <h2 className="mt-3 text-[1.25rem] sm:text-[1.375rem] lg:text-[1.5rem] font-extrabold leading-snug text-slate-900">
              {booking.movie_title}
            </h2>
            {formatMeta ? (
              <p className="mt-1.5 text-[0.875rem] text-slate-500">{formatMeta}</p>
            ) : null}
            {cinemaLine ? (
              <p className="mt-2 flex items-start gap-1.5 text-[0.875rem] text-slate-500">
                <MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" />
                <span>
                  {cinemaLine}
                  {screenLabel ? (
                    <>
                      {" · "}
                      <span className="font-semibold text-slate-700">{screenLabel}</span>
                    </>
                  ) : null}
                </span>
              </p>
            ) : null}

            <div className="mt-5 grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-5">
              <DetailCell icon={User} label="Ticket Holder" value={booking.guest_name || "—"} />
              <DetailCell icon={Phone} label="Contact" value={booking.guest_phone || "—"} />
              <DetailCell
                icon={Ticket}
                label="Tickets"
                value={`${booking.ticket_qty} ticket${booking.ticket_qty === 1 ? "" : "s"}`}
              />
              <DetailCell icon={Calendar} label="Date" value={showDateFormatted || "—"} />
              <DetailCell icon={Clock} label="Time" value={showTimeFormatted || "—"} />
              <DetailCell
                icon={Monitor}
                label="Screen"
                value={screenLabel || booking.screen_name || "—"}
              />
              {bookedOnFormatted ? (
                <DetailCell icon={CheckCircle2} label="Booked On" value={bookedOnFormatted} />
              ) : null}
            </div>
          </div>

          {/* Seats + order summary */}
          <div className="border-t border-slate-200 px-5 py-5 sm:px-6 sm:py-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[0.9375rem] sm:text-[1rem] font-bold text-slate-900">
                Seats ({booking.ticket_qty} ticket{booking.ticket_qty === 1 ? "" : "s"})
              </p>
              <p className="text-[0.9375rem] font-extrabold tabular-nums text-slate-900">
                {formatMoney(Number(booking.grand_total) || 0)}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(booking.seats || []).map((seat) => (
                <span
                  key={seat.seat_identifier}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-800"
                >
                  <Armchair size={13} className="text-slate-500" />
                  {seat.seat_identifier}
                  {seat.tier_name ? (
                    <span className="font-medium text-slate-500">({seat.tier_name})</span>
                  ) : null}
                </span>
              ))}
            </div>

            <div className="mt-4 space-y-2.5 text-[0.875rem] text-slate-600">
              <div className="flex items-start justify-between gap-4">
                <span>Ticket amount</span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-800">
                  {formatMoney(Number(booking.ticket_amount) || 0)}
                </span>
              </div>
              {Number(booking.beverage_total) > 0 ? (
                <div className="flex items-start justify-between gap-4">
                  <span>Snacks &amp; beverages</span>
                  <span className="shrink-0 font-semibold tabular-nums text-slate-800">
                    {formatMoney(Number(booking.beverage_total) || 0)}
                  </span>
                </div>
              ) : null}
              <div className="flex items-start justify-between gap-4">
                <span>Convenience Fee</span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-800">
                  {formatMoney(Number(booking.convenience_fee_total) || 0)}
                </span>
              </div>
              {Number(booking.discount_amount) > 0 ? (
                <div className="flex items-start justify-between gap-4 text-[#57008E]">
                  <span>Promo discount</span>
                  <span className="shrink-0 font-semibold tabular-nums">
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

            {booking.beverages && booking.beverages.length > 0 ? (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <p className="text-[0.8125rem] font-bold text-slate-900 inline-flex items-center gap-1.5">
                  <UtensilsCrossed size={14} className="text-slate-500" />
                  Snacks &amp; Beverages
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {booking.beverages.map((bev, i) => (
                    <span
                      key={bev.id || i}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-800"
                    >
                      <UtensilsCrossed size={11} className="text-slate-500" />
                      {bev.name}
                      {bev.quantity > 1 ? (
                        <span className="font-normal text-slate-500">×{bev.quantity}</span>
                      ) : null}
                      <span className="font-normal text-slate-500">
                        ({formatMoney(bev.subtotal)})
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Actions — same handlers */}
          <div className="border-t border-slate-200 px-5 py-5 sm:px-6 sm:py-6 lg:px-8 print:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => void handleDownloadPdf()}
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
              <button type="button" onClick={handlePrint} className={actionBtnSecondary}>
                <Printer size={16} className="text-slate-600 shrink-0" />
                <span className="truncate">Print / Save</span>
              </button>
              <button type="button" onClick={handleShare} className={actionBtnSecondary}>
                <Share2 size={16} className="text-slate-600 shrink-0" />
                <span className="truncate">Share</span>
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-[0.6875rem] text-slate-400 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <p className="min-w-0 break-all sm:truncate" title={booking.id}>
                Booking ID: {booking.booking_code || booking.id}
              </p>
              {bookedOnFormatted ? (
                <p className="shrink-0 sm:text-right">Booked on {bookedOnFormatted}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 sm:mt-8 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 print:hidden">
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
              href="/customer/dashboard"
              className={`${actionBtnSecondary} min-[480px]:w-auto min-[480px]:min-w-[10.5rem]`}
            >
              <Ticket size={16} className="text-slate-600 shrink-0" />
              View in My Bookings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
