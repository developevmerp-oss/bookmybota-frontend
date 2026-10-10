"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Download,
  Home,
  Loader2,
  Share2,
  Sparkles,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { useGetEventBookingByIdQuery } from "@/services/api";
import { useAppDispatch } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { buildEventTicketPdf, downloadPdfBlob, shortBookingCode } from "@/lib/eventTicketPdf";
import {
  normalizeTicketMode,
  ticketModeConfirmationMessage,
  ticketModeLabel,
} from "@/lib/eventTicketMode";
import { EventConfirmationShimmer } from "@/components/Shared/Shimmer";
import { EventTicketCard } from "@/components/EventBooking/EventTicketCard";
import { resolveMediaUrl } from "@/lib/mediaUrl";

const CONFIRM_PAGE_MAX = "mx-auto w-full max-w-[64rem] px-4 md:px-5 lg:px-10 xl:px-12";

const actionBtnSecondary =
  "inline-flex min-h-[2.875rem] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-[0.75rem] min-[480px]:text-[0.8125rem] lg:text-[0.8125rem] xl:text-[0.875rem] font-semibold text-slate-800 transition hover:bg-slate-50";

const actionBtnPrimary =
  "inline-flex min-h-[2.875rem] w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-2.5 py-2.5 text-[0.75rem] min-[480px]:text-[0.8125rem] lg:text-[0.8125rem] xl:text-[0.875rem] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const bookingId = searchParams.get("id") || "";
  const [downloading, setDownloading] = useState(false);
  const [headerReady, setHeaderReady] = useState(false);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  useEffect(() => {
    const t = window.setTimeout(() => setHeaderReady(true), 40);
    return () => window.clearTimeout(t);
  }, [bookingId]);

  const { data: booking, isLoading, error } = useGetEventBookingByIdQuery(bookingId, {
    skip: !bookingId,
  });

  const displayCode = useMemo(
    () => (booking ? shortBookingCode(booking.id) : ""),
    [booking]
  );

  const poster = resolveMediaUrl(
    booking?.poster_horizontal_url || booking?.poster_vertical_url
  );
  const venue = [booking?.venue_name, booking?.venue_address].filter(Boolean).join(", ");
  const ticketMode = normalizeTicketMode(booking?.ticket_mode);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(displayCode || booking?.id || "");
      toast.success("Booking ID copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const addToCalendar = () => {
    if (!booking?.starts_at) return;
    const start = new Date(booking.starts_at);
    const end = booking.ends_at
      ? new Date(booking.ends_at)
      : new Date(start.getTime() + 60 * 60000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      booking.event_name || "Event"
    )}&dates=${fmt(start)}/${fmt(end)}&location=${encodeURIComponent(venue)}`;
    window.open(url, "_blank");
  };

  const shareTickets = async () => {
    const text = `My tickets for ${booking?.event_name || "this event"} are confirmed. Booking ${displayCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Event tickets", text, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
        toast.success("Link copied");
      }
    } catch {
      /* cancelled */
    }
  };

  const downloadTickets = async () => {
    if (!booking || downloading) return;
    setDownloading(true);
    try {
      const blob = await buildEventTicketPdf(booking, { posterUrl: poster });
      const filename = `${(booking.event_name || "ticket").replace(/[^\w\-]+/g, "_")}-ticket.pdf`;
      downloadPdfBlob(blob, filename);
      toast.success("Ticket PDF downloaded — save it for venue entry.");
    } catch {
      toast.error("Could not download the ticket PDF.");
    } finally {
      setDownloading(false);
    }
  };

  if (!bookingId) {
    return (
      <div className="bg-white pt-24 text-center px-4">
        <p className="text-slate-500 mb-4">No booking ID provided.</p>
        <Link href="/events" className="text-[#6900AA] font-semibold">
          Browse events
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return <EventConfirmationShimmer />;
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-white pt-24 text-center px-4">
        <p className="text-slate-500 mb-4">Could not load booking details.</p>
        <Link href="/customer/dashboard" className="text-[#6900AA] font-semibold">
          My Bookings
        </Link>
      </div>
    );
  }

  const ticketModeName = ticketModeLabel(ticketMode);

  return (
    <div className="min-h-screen bg-white pb-10 sm:pb-12">
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
      `}</style>

      <div className={`${CONFIRM_PAGE_MAX} pt-6 sm:pt-8`}>
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
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 sm:h-6 sm:w-6"
                  fill="none"
                  aria-hidden
                >
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
                Your ticket is confirmed
              </h1>
              <p className="mt-1.5 text-[0.875rem] sm:text-[0.9375rem] text-slate-600 leading-relaxed">
                Your booking for{" "}
                <span className="font-semibold text-slate-800">{booking.event_name}</span> is successful.
              </p>
              {booking.guest_email ? (
                <p className="mt-1 text-[0.8125rem] sm:text-[0.875rem] text-slate-500 leading-relaxed">
                  Your {ticketModeName} has been emailed to{" "}
                  <span className="font-semibold text-slate-700">{booking.guest_email}</span> and is ready
                  for entry.
                </p>
              ) : (
                <p className="mt-1 text-[0.8125rem] sm:text-[0.875rem] text-slate-500 leading-relaxed">
                  {ticketModeConfirmationMessage(ticketMode)}
                </p>
              )}
            </div>
          </div>
        </div>

        <EventTicketCard
          variant="confirmation"
          booking={booking}
          posterUrl={poster}
          onCopyCode={copyCode}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={downloadTickets}
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
            <button type="button" onClick={addToCalendar} className={actionBtnSecondary}>
              <Calendar size={16} className="text-slate-600 shrink-0" />
              <span className="truncate">Add to Calendar</span>
            </button>
            <button type="button" onClick={shareTickets} className={actionBtnSecondary}>
              <Share2 size={16} className="text-slate-600 shrink-0" />
              <span className="truncate">Share Tickets</span>
            </button>
          </div>
        </EventTicketCard>

        <div className="mt-6 sm:mt-8 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex items-start gap-3 sm:items-center sm:gap-4 min-w-0">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F7E9FF] text-[#6900AA]">
              <Sparkles size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-[0.9375rem] sm:text-[1rem] font-bold text-slate-900">
                Looking for more amazing events?
              </p>
              <p className="mt-0.5 text-[0.8125rem] sm:text-[0.875rem] text-slate-500 leading-relaxed">
                Discover concerts, festivals, and experiences across Ethiopia.
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2.5 min-[480px]:flex-row min-[480px]:items-center sm:w-auto sm:shrink-0">
            <Link
              href="/events"
              className="inline-flex min-h-[2.875rem] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-[0.875rem] font-semibold text-white transition hover:bg-slate-800 min-[480px]:w-auto"
            >
              Explore More Events
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

export default function EventBookingConfirmationPage() {
  return (
    <Suspense fallback={<EventConfirmationShimmer />}>
      <ConfirmationContent />
    </Suspense>
  );
}
