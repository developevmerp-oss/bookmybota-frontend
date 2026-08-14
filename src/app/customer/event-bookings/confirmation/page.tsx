"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Home,
  Loader2,
  Mail,
  MapPin,
  Send,
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
        confirmButtonColor: "#1B5E3B",
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
        <Link href="/events" className="text-[#1B5E3B] font-semibold">
          Browse events
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] pt-24 flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="animate-spin text-[#1B5E3B]" size={32} />
        Loading confirmation...
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] pt-24 text-center px-4">
        <p className="text-slate-500 mb-4">Could not load booking details.</p>
        <Link href="/customer/dashboard" className="text-[#1B5E3B] font-semibold">
          My Bookings
        </Link>
      </div>
    );
  }

  const qrData = booking.qr_code || booking.qr_payload || booking.id;

  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      <section className="relative overflow-hidden bg-[#1B5E3B] text-white">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,#C9A227_0,transparent_40%),radial-gradient(circle_at_80%_0%,#ffffff_0,transparent_35%)]" />
        <div className="absolute top-6 left-[12%] w-2 h-2 rounded-full bg-[#C9A227]" />
        <div className="absolute top-16 right-[18%] w-1.5 h-1.5 rounded-full bg-[#C9A227]/80" />
        <div className="absolute bottom-8 left-[40%] w-2 h-2 rounded-full bg-white/40" />
        <div className="relative max-w-6xl mx-auto px-4 py-5 text-center">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-[#1B5E3B]" strokeWidth={3} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold">You&apos;re all set!</h1>
          <p className="mt-3 text-white/90 max-w-xl mx-auto">
            Your tickets for <span className="font-semibold">{booking.event_name}</span> have been
            confirmed. We can&apos;t wait to see you there!
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 my-5  relative z-10">
        <div className="grid lg:grid-cols-[1fr_340px] gap-5">
          <div
            ref={ticketRef}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 sm:p-6"
          >
            <div className="flex gap-4">
              {poster ? (
                <img
                  src={poster}
                  alt={booking.event_name || "Event"}
                  className="w-24 sm:w-28 aspect-[3/4] object-cover rounded-xl shrink-0"
                />
              ) : (
                <div className="w-24 sm:w-28 aspect-[3/4] rounded-xl bg-slate-200 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#1B5E3B]">
                  <Ticket size={12} /> Event
                </p>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                  {booking.event_name}
                </h2>
                {venue && (
                  <p className="text-sm text-slate-500 mt-1 flex items-start gap-1.5">
                    <MapPin size={13} className="mt-0.5 shrink-0" />
                    {venue}
                  </p>
                )}
                <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#1B5E3B] text-white text-xs font-semibold px-2.5 py-1">
                  <Check size={12} strokeWidth={3} /> Confirmed
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-start gap-2.5">
                <Calendar size={16} className="text-[#1B5E3B] mt-0.5" />
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Date</p>
                  <p className="text-sm font-semibold text-slate-900">{formatLongDate(booking.starts_at)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock size={16} className="text-[#1B5E3B] mt-0.5" />
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Time</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatTime12h(booking.starts_at)} Onwards
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Ticket size={16} className="text-[#1B5E3B] mt-0.5" />
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Tickets</p>
                  <p className="text-sm font-semibold text-slate-900">{ticketLabel}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
              {booking.items?.map((item) => (
                <div key={item.id} className="flex justify-between text-sm text-slate-600">
                  <span>
                    {item.ticket_type} x {item.qty}
                  </span>
                  <span className="font-medium text-slate-800">
                    {formatMoney(Number(item.unit_price) * item.qty)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-sm text-slate-600">
                <span>Convenience Fee</span>
                <span className="font-medium text-slate-800">
                  {formatMoney(booking.convenience_fee_total)}
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-2">
                <span className="font-semibold text-slate-800">Total Paid</span>
                <span className="text-xl font-extrabold text-[#1B5E3B]">
                  {formatMoney(booking.grand_total)}
                </span>
              </div>
            </div>

            {qrData && (
              <div className="mt-6 rounded-xl border border-slate-200 p-4 flex items-center gap-4">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(qrData)}`}
                  alt="Ticket QR code"
                  className="w-24 h-24 rounded-lg bg-white"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-600">
                    Show this QR at the entry. This QR code is unique to your booking.
                  </p>
                 
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap justify-between gap-2 text-[11px] text-slate-400">
              <span>Booking ID: {booking.id}</span>
              <span>{formatBookedOn(booking.created_at)}</span>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl bg-[#1B5E3B] text-white p-5">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                  <Mail size={18} />
                </span>
                <div>
                  <p className="font-bold text-base">Confirmation sent!</p>
                  <p className="text-xs text-white/85 mt-1 leading-relaxed">
                    {booking.guest_email
                      ? `A confirmation email with your tickets has been sent to ${booking.guest_email}`
                      : "A confirmation email with your tickets has been sent."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => toast.success("Confirmation email was already sent to your inbox.")}
                className="mt-4 w-full py-2.5 rounded-xl border border-white/80 text-white text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send size={14} />
                Resend Email
              </button>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 flex gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[#1B5E3B] flex items-center gap-1.5">
                  <Ticket size={15} />
                  Your Ticket
                </p>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Save your ticket to your phone so it&apos;s always with you.
                </p>
                <button
                  type="button"
                  onClick={downloadTickets}
                  disabled={downloading}
                  className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[#1B5E3B] text-[#1B5E3B] text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  <Download size={14} />
                  {downloading ? "Downloading..." : "Download Ticket (PDF)"}
                </button>
              </div>
              <div className="relative shrink-0 w-[72px]">
                <div className="w-[64px] h-[110px] rounded-[14px] border-2 border-slate-800 bg-white mx-auto overflow-hidden shadow-sm">
                  <div className="h-2 bg-slate-800" />
                  <div className="p-1.5 flex flex-col items-center gap-1">
                    <div className="w-8 h-1 rounded bg-slate-200" />
                    {qrData ? (
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(qrData)}`}
                        alt=""
                        className="w-10 h-10"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-slate-200" />
                    )}
                    <div className="w-10 h-1 rounded bg-slate-200" />
                    <div className="w-7 h-1 rounded bg-slate-200" />
                  </div>
                </div>
                <span className="absolute -bottom-1 -right-0 w-7 h-7 rounded-full bg-[#1B5E3B] text-white flex items-center justify-center shadow">
                  <Download size={12} />
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
              {[
                { href: "/customer/dashboard" as string | null, label: "View My Bookings", icon: Ticket, action: null as (() => void) | null },
                { href: null, label: "Add to Calendar", icon: Calendar, action: addToCalendar },
                { href: null, label: "Share Tickets", icon: Share2, action: shareTickets },
              ].map((item) =>
                item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                  >
                    <span className="inline-flex items-center gap-2">
                      <item.icon size={15} className="text-[#1B5E3B]" />
                      {item.label}
                    </span>
                    <ChevronRight size={14} className="text-slate-400" />
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action || undefined}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 border-b border-slate-100 last:border-0 cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2">
                      <item.icon size={15} className="text-[#1B5E3B]" />
                      {item.label}
                    </span>
                    <ChevronRight size={14} className="text-slate-400" />
                  </button>
                )
              )}
            </div>

            <Link
              href="/events"
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-[#1B5E3B] hover:bg-[#164e31] text-white font-semibold text-sm"
            >
              <Sparkles size={16} />
              Explore More Events
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 font-semibold text-sm"
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
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f4f5f7] pt-24 flex justify-center text-slate-500">
          <Loader2 className="animate-spin text-[#1B5E3B]" size={32} />
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  );
}
