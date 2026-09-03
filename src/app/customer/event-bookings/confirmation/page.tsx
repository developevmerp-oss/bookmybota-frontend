"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Check,
  ChevronRight,
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
  ticketModeConfirmationTitle,
  ticketModeDownloadHint,
  ticketModeLabel,
} from "@/lib/eventTicketMode";
import { EventConfirmationShimmer } from "@/components/Shared/Shimmer";
import { EventTicketCard } from "@/components/EventBooking/EventTicketCard";
import { resolveMediaUrl } from "@/lib/mediaUrl";

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const bookingId = searchParams.get("id") || "";
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

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
      <div className=" bg-[#f4f5f7] pt-24 text-center px-4">
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
      <div className="min-h-screen bg-[#f4f5f7] pt-24 text-center px-4">
        <p className="text-slate-500 mb-4">Could not load booking details.</p>
        <Link href="/customer/dashboard" className="text-[#6900AA] font-semibold">
          My Bookings
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-white via-[#FBF6FF]/40 to-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(105,0,170,0.08)_0%,_transparent_55%)]" />
        <div className="relative max-w-[72rem] mx-auto px-3 sm:px-6 py-5 sm:py-7">
          <div className="flex items-start gap-3 sm:gap-4">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8F5E9] text-[#2E7D32] shadow-sm ring-4 ring-[#E8F5E9]/50 sm:h-11 sm:w-11">
              <Check size={22} strokeWidth={3} />
            </span>
            <div className="min-w-0">
              <h1 className="text-[1.375rem] sm:text-[1.625rem] lg:text-[1.875rem] font-extrabold text-slate-900 leading-tight">
                {ticketModeConfirmationTitle(ticketMode)}
              </h1>
              <p className="mt-1 text-[0.875rem] sm:text-[0.9375rem] text-slate-600 leading-relaxed">
                Your booking for <span className="font-semibold text-slate-800">{booking.event_name}</span>{" "}
                is confirmed
                {booking.guest_email ? (
                  <>
                    {" "}
                    — we&apos;ve emailed your {ticketModeLabel(ticketMode).toLowerCase()} details to{" "}
                    {booking.guest_email}
                  </>
                ) : (
                  "."
                )}
              </p>
              <p className="mt-1.5 text-[0.8125rem] sm:text-[0.875rem] text-slate-500 leading-relaxed">
                {ticketModeConfirmationMessage(ticketMode)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-[72rem] mx-auto px-3 sm:px-6 py-5 sm:py-7">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-4 sm:gap-5">
          <EventTicketCard booking={booking} posterUrl={poster} onCopyCode={copyCode} />

          <aside className="space-y-3 sm:space-y-4">
            <div className="overflow-hidden rounded-2xl border border-[#E8D4FF]/80 bg-white shadow-md shadow-purple-500/5">
              <div className="bg-gradient-to-r from-[#6900AA] to-[#57008E] px-4 py-3">
                <p className="flex items-center gap-1.5 text-[0.9375rem] font-bold text-white">
                  <Ticket size={15} />
                  {ticketModeLabel(ticketMode)}
                </p>
              </div>
              <div className="p-4">
                <p className="text-[0.75rem] sm:text-[0.8125rem] text-slate-500 leading-relaxed">
                  {ticketModeDownloadHint(ticketMode)}
                </p>
                <button
                  type="button"
                  onClick={downloadTickets}
                  disabled={downloading}
                  className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6900AA] to-[#57008E] px-3 py-3 text-[0.8125rem] font-semibold text-white shadow-md shadow-purple-500/25 transition hover:shadow-lg hover:shadow-purple-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {downloading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Download size={15} />
                  )}
                  {downloading ? "Preparing PDF…" : "Download Ticket (PDF)"}
                </button>
                <p className="mt-2 text-center text-[0.6875rem] text-slate-400">
                  Premium ticket PDF · QR & booking details included
                </p>
              </div>
            </div>

            <div className="rounded-[0.75rem] bg-white border border-slate-200 shadow-sm overflow-hidden">
              {[
                { href: "/customer/dashboard" as string | null, label: "View My Bookings", icon: Ticket, action: null as (() => void) | null },
                { href: null, label: "Add to Calendar", icon: Calendar, action: addToCalendar },
                { href: null, label: "Share Tickets", icon: Share2, action: shareTickets },
              ].map((item) =>
                item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center justify-between px-4 py-3 text-[0.875rem] font-medium text-slate-800 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                  >
                    <span className="inline-flex items-center gap-2">
                      <item.icon size={15} className="text-[#6900AA]" />
                      {item.label}
                    </span>
                    <ChevronRight size={14} className="text-slate-400" />
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action || undefined}
                    className="w-full flex items-center justify-between px-4 py-3 text-[0.875rem] font-medium text-slate-800 hover:bg-slate-50 border-b border-slate-100 last:border-0 cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2">
                      <item.icon size={15} className="text-[#6900AA]" />
                      {item.label}
                    </span>
                    <ChevronRight size={14} className="text-slate-400" />
                  </button>
                )
              )}
            </div>

            <Link
              href="/events"
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-[0.5rem] bg-[#6900AA] hover:bg-[#57008E] text-white font-semibold text-[0.875rem]"
            >
              <Sparkles size={16} />
              Explore More Events
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-[0.5rem] border border-slate-300 bg-white text-slate-800 font-semibold text-[0.875rem]"
            >
              <Home size={16} />
              Back to Home
            </Link>
          </aside>
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
