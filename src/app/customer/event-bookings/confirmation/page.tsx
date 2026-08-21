"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Check,
  ChevronRight,
  Copy,
  Download,
  Home,
  MapPin,
  Share2,
  Sparkles,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import Swal from "sweetalert2";
import { useGetEventBookingByIdQuery } from "@/services/api";
import { useAppDispatch } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { formatTime12h } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/currencyFormat";
import { EventConfirmationShimmer } from "@/components/Shared/Shimmer";

function formatLongDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  return `${date}, ${weekday}`;
}

function formatBookedOn(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `Booked on ${date}, ${time}`;
}

function shortBookingCode(id: string) {
  const compact = id.replace(/-/g, "").toUpperCase();
  return `BMB-${compact.slice(0, 8)}-${compact.slice(8, 12)}`;
}

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const bookingId = searchParams.get("id") || "";
  const ticketRef = useRef<HTMLDivElement>(null);
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

  const ticketLabel = useMemo(() => {
    if (!booking?.items?.length) return booking ? `${booking.ticket_qty}` : "";
    return booking.items.map((i) => `${i.ticket_type || "Ticket"} x ${i.qty}`).join(", ");
  }, [booking]);

  const poster = booking?.poster_horizontal_url || booking?.poster_vertical_url;
  const venue = [booking?.venue_name, booking?.venue_address].filter(Boolean).join(", ");

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
      const { jsPDF } = await import("jspdf");
      const qrRaw = booking.qr_code || booking.qr_payload || booking.id;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrRaw)}`;
      const [posterData, qrDataUrl] = await Promise.all([
        poster ? urlToDataUrl(poster) : Promise.resolve(null),
        urlToDataUrl(qrUrl),
      ]);

      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const x = 18;
      const w = 174;
      let y = 18;

      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, w, 260, 3, 3, "S");
      doc.setDrawColor(229, 231, 235);
      doc.roundedRect(x, y, w, 260, 3, 3);

      const inner = x + 10;
      y += 12;

      if (posterData) {
        try {
          const fmt = posterData.startsWith("data:image/png") ? "PNG" : "JPEG";
          doc.addImage(posterData, fmt, inner, y, 28, 36);
        } catch {
          /* skip poster if format unsupported */
        }
      }

      const textX = posterData ? inner + 34 : inner;
      doc.setTextColor(27, 94, 59);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("EVENT", textX, y + 6);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(18);
      doc.text(booking.event_name || "Event", textX, y + 15, { maxWidth: 110 });
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      if (venue) doc.text(venue, textX, y + 22, { maxWidth: 110 });

      doc.setFillColor(27, 94, 59);
      doc.roundedRect(textX, y + 27, 28, 7, 3, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Confirmed", textX + 4, y + 32);

      y += 48;
      doc.setDrawColor(241, 245, 249);
      doc.line(inner, y, x + w - 10, y);
      y += 10;

      const colW = 50;
      const meta = [
        { k: "Date", v: formatLongDate(booking.starts_at) },
        { k: "Time", v: `${formatTime12h(booking.starts_at)} Onwards` },
        { k: "Tickets", v: ticketLabel },
      ];
      meta.forEach((m, i) => {
        const cx = inner + i * colW;
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(m.k, cx, y);
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(m.v || "—", cx, y + 6, { maxWidth: colW - 4 });
      });

      y += 18;
      doc.setDrawColor(241, 245, 249);
      doc.line(inner, y, x + w - 10, y);
      y += 10;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      booking.items?.forEach((item) => {
        doc.setTextColor(71, 85, 105);
        doc.text(`${item.ticket_type} x ${item.qty}`, inner, y);
        doc.text(formatMoney(Number(item.unit_price) * item.qty), x + w - 10, y, { align: "right" });
        y += 7;
      });
      doc.text("Convenience Fee", inner, y);
      doc.text(formatMoney(booking.convenience_fee_total), x + w - 10, y, { align: "right" });
      y += 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("Total Paid", inner, y);
      doc.setTextColor(27, 94, 59);
      doc.setFontSize(16);
      doc.text(formatMoney(booking.grand_total), x + w - 10, y, { align: "right" });

      y += 12;
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(inner, y, w - 20, 42, 3, 3);
      if (qrDataUrl) {
        try {
          doc.addImage(qrDataUrl, "PNG", inner + 4, y + 4, 34, 34);
        } catch {
          /* skip qr */
        }
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text("Show this QR at the entry. This QR code is unique to your booking.", inner + 42, y + 16, {
        maxWidth: w - 70,
      });

      y += 50;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Booking ID: ${booking.id}`, inner, y);
      doc.text(formatBookedOn(booking.created_at), x + w - 10, y, { align: "right" });

      const filename = `${(booking.event_name || "ticket").replace(/[^\w\-]+/g, "_")}-ticket.pdf`;
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);

      await Swal.fire({
        icon: "success",
        title: "Download successfully",
        text: "Your ticket has been downloaded.",
        confirmButtonColor: "#6900AA",
      });
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

  const qrData = booking.qr_code || booking.qr_payload || booking.id;

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-[72rem] mx-auto px-3 sm:px-6 py-5 sm:py-6">
          <div className="flex items-start gap-3 sm:gap-4">
            <span className="mt-0.5 h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center shrink-0">
              <Check size={22} strokeWidth={3} />
            </span>
            <div className="min-w-0">
              <h1 className="text-[1.375rem] sm:text-[1.625rem] lg:text-[1.875rem] font-extrabold text-slate-900 leading-tight">
                Booking confirmed
              </h1>
              <p className="mt-1 text-[0.875rem] sm:text-[0.9375rem] text-slate-600 leading-relaxed">
                Your tickets for <span className="font-semibold text-slate-800">{booking.event_name}</span> are
                ready. We&apos;ve also emailed the confirmation
                {booking.guest_email ? ` to ${booking.guest_email}` : ""}.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-[72rem] mx-auto px-3 sm:px-6 py-5 sm:py-7">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-4 sm:gap-5">
          <div
            ref={ticketRef}
            className="bg-white rounded-[0.75rem] border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="p-4 sm:p-5 border-b border-slate-100 flex gap-3.5 sm:gap-4">
              {poster ? (
                <img
                  src={poster}
                  alt={booking.event_name || "Event"}
                  className="w-[4.5rem] sm:w-[5.5rem] aspect-[3/4] object-cover rounded-[0.5rem] shrink-0 bg-slate-100"
                />
              ) : (
                <div className="w-[4.5rem] sm:w-[5.5rem] aspect-[3/4] rounded-[0.5rem] bg-slate-200 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-[#6900AA]">M-Ticket</p>
                <h2 className="mt-1 text-[1.0625rem] sm:text-[1.25rem] font-extrabold text-slate-900 leading-snug">
                  {booking.event_name}
                </h2>
                {venue && (
                  <p className="mt-1.5 text-[0.8125rem] sm:text-[0.875rem] text-slate-500 flex items-start gap-1.5">
                    <MapPin size={13} className="mt-0.5 shrink-0" />
                    <span>{venue}</span>
                  </p>
                )}
                <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-[0.75rem] font-semibold px-2.5 py-1">
                  <Check size={12} strokeWidth={3} /> Confirmed
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-0 p-4 sm:p-5 border-b border-slate-100">
              <div className="sm:pr-4 sm:border-r border-slate-100">
                <p className="text-[0.6875rem] text-slate-400 font-medium uppercase tracking-wide">Date</p>
                <p className="mt-1 text-[0.875rem] font-semibold text-slate-900">{formatLongDate(booking.starts_at)}</p>
              </div>
              <div className="sm:px-4 sm:border-r border-slate-100">
                <p className="text-[0.6875rem] text-slate-400 font-medium uppercase tracking-wide">Time</p>
                <p className="mt-1 text-[0.875rem] font-semibold text-slate-900">
                  {formatTime12h(booking.starts_at)} Onwards
                </p>
              </div>
              <div className="sm:pl-4">
                <p className="text-[0.6875rem] text-slate-400 font-medium uppercase tracking-wide">Tickets</p>
                <p className="mt-1 text-[0.875rem] font-semibold text-slate-900">{ticketLabel}</p>
              </div>
            </div>

            <div className="p-4 sm:p-5 border-b border-slate-100 space-y-2">
              <p className="text-[0.8125rem] font-bold text-slate-900 mb-2">Order summary</p>
              {booking.items?.map((item) => (
                <div key={item.id} className="flex justify-between text-[0.8125rem] sm:text-[0.875rem] text-slate-600">
                  <span>
                    {item.ticket_type} x {item.qty}
                  </span>
                  <span className="font-semibold text-slate-800">
                    {formatMoney(Number(item.unit_price) * item.qty)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-[0.8125rem] sm:text-[0.875rem] text-slate-600">
                <span>Convenience Fee</span>
                <span className="font-semibold text-slate-800">
                  {formatMoney(booking.convenience_fee_total)}
                </span>
              </div>
              {Number(booking.discount_amount) > 0 && (
                <div className="flex justify-between text-[0.8125rem] sm:text-[0.875rem] text-[#57008E]">
                  <span>Promo discount</span>
                  <span className="font-semibold">−{formatMoney(booking.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2.5 border-t border-dashed border-slate-200">
                <span className="text-[0.875rem] font-bold text-slate-900">Amount paid</span>
                <span className="text-[1.125rem] font-extrabold text-[#6900AA]">
                  {formatMoney(booking.grand_total)}
                </span>
              </div>
            </div>

            {qrData && (
              <div className="p-4 sm:p-5 flex items-center gap-4">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(qrData)}`}
                  alt="Ticket QR code"
                  className="w-[5.5rem] h-[5.5rem] rounded-[0.375rem] bg-white border border-slate-100"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.875rem] font-bold text-slate-900">Entry QR</p>
                  <p className="mt-1 text-[0.8125rem] text-slate-500 leading-relaxed">
                    Show this QR at the venue entrance. It is unique to your booking.
                  </p>
                  <button
                    type="button"
                    onClick={copyCode}
                    className="mt-2 inline-flex items-center gap-1.5 text-[0.75rem] font-semibold text-[#6900AA] cursor-pointer hover:underline"
                  >
                    <Copy size={12} />
                    {displayCode}
                  </button>
                </div>
              </div>
            )}

            <div className="px-4 sm:px-5 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap justify-between gap-2 text-[0.6875rem] sm:text-[0.75rem] text-slate-400">
              <span>Booking ID: {booking.id}</span>
              <span>{formatBookedOn(booking.created_at)}</span>
            </div>
          </div>

          <aside className="space-y-3 sm:space-y-4">
            <div className="rounded-[0.75rem] bg-white border border-slate-200 shadow-sm p-4">
              <p className="text-[0.9375rem] font-bold text-slate-900 flex items-center gap-1.5">
                <Ticket size={15} className="text-[#6900AA]" />
                Your ticket
              </p>
              <p className="mt-1.5 text-[0.75rem] sm:text-[0.8125rem] text-slate-500 leading-relaxed">
                Save the PDF to your phone so it&apos;s ready at the gate.
              </p>
              <button
                type="button"
                onClick={downloadTickets}
                disabled={downloading}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-[0.5rem] bg-[#6900AA] hover:bg-[#57008E] text-white text-[0.8125rem] font-semibold cursor-pointer disabled:opacity-60"
              >
                <Download size={14} />
                {downloading ? "Downloading..." : "Download Ticket (PDF)"}
              </button>
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
