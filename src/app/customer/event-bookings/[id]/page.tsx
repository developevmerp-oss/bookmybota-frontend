"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  ExternalLink,
  MapPin,
  Printer,
  Share2,
  Ticket,
  Tickets,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import Swal from "sweetalert2";
import { useCancelEventBookingMutation, useGetEventBookingByIdQuery } from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { formatTime12h } from "@/lib/dateFormat";
import { extractApiError } from "@/lib/apiErrors";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import { formatMoney } from "@/lib/currencyFormat";

function shortBookingCode(id: string) {
  const compact = id.replace(/-/g, "").toUpperCase();
  return `BMB-${compact.slice(0, 8)}-${compact.slice(8, 12)}`;
}

function ticketCode(id: string) {
  const compact = id.replace(/-/g, "").toUpperCase();
  return `TKT-${compact.slice(0, 8)}-${compact.slice(8, 12)}-01`;
}

function formatDateLine(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatWeekday(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { weekday: "long" });
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

function statusStyles(status: string) {
  if (status === "CONFIRMED") return "bg-[#F7E9FF] text-[#6900AA]";
  if (status === "CANCELLED") return "bg-red-50 text-red-600";
  return "bg-slate-100 text-slate-600";
}

export default function EventBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  useEffect(() => {
    if (user === null) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem("user_customer") : null;
    if (!stored) {
      router.push("/login");
      return;
    }
    const parsed = JSON.parse(stored);
    if (parsed.role !== "customer") router.push("/");
  }, [user, router]);

  const { data: booking, isLoading, error } = useGetEventBookingByIdQuery(id, { skip: !id });
  const [cancelBooking, { isLoading: isCancelling }] = useCancelEventBookingMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const displayCode = useMemo(
    () => (booking ? shortBookingCode(booking.id) : ""),
    [booking]
  );
  const poster = booking?.poster_horizontal_url || booking?.poster_vertical_url;
  const venue = [booking?.venue_name, booking?.venue_address].filter(Boolean).join(", ");
  const ticketTypeLabel = booking?.items?.[0]?.ticket_type || "Ticket";
  const ticketCount = booking?.ticket_qty || 0;

  const handleCancel = () => {
    if (!booking) return;
    setConfirmOpen(true);
  };

  const handleShare = async () => {
    const text = `My tickets for ${booking?.event_name || "this event"} — ${displayCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: booking?.event_name || "Tickets", text, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
        toast.success("Link copied");
      }
    } catch {
      /* cancelled */
    }
  };

  const handleDownload = async () => {
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
      let y = 20;
      doc.setDrawColor(229, 231, 235);
      doc.roundedRect(x, y, w, 250, 3, 3);
      const inner = x + 10;
      y += 12;
      if (posterData) {
        try {
          doc.addImage(posterData, posterData.includes("png") ? "PNG" : "JPEG", inner, y, 28, 36);
        } catch {
          /* skip */
        }
      }
      const textX = posterData ? inner + 34 : inner;
      doc.setTextColor(27, 94, 59);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("EVENT", textX, y + 6);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(16);
      doc.text(booking.event_name || "Event", textX, y + 14, { maxWidth: 110 });
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      if (venue) doc.text(venue, textX, y + 21, { maxWidth: 110 });
      y += 48;
      (booking.items || []).forEach((item) => {
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(10);
        doc.text(`${item.ticket_type} x ${item.qty}`, inner, y);
        doc.text(formatMoney(Number(item.unit_price) * item.qty), x + w - 10, y, { align: "right" });
        y += 7;
      });
      doc.text("Convenience Fee", inner, y);
      doc.text(formatMoney(booking.convenience_fee_total), x + w - 10, y, { align: "right" });
      y += 10;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(27, 94, 59);
      doc.setFontSize(14);
      doc.text("Total Paid", inner, y);
      doc.text(formatMoney(booking.grand_total), x + w - 10, y, { align: "right" });
      y += 12;
      if (qrDataUrl) {
        try {
          doc.addImage(qrDataUrl, "PNG", inner, y, 34, 34);
        } catch {
          /* skip */
        }
      }
      const filename = `${(booking.event_name || "ticket").replace(/[^\w\-]+/g, "_")}-ticket.pdf`;
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
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

  if (!user || isLoading) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] pt-24 text-center text-slate-500">Loading booking...</div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] pt-24 text-center px-4">
        <p className="text-slate-500 mb-4">Booking not found.</p>
        <Link href="/customer/dashboard" className="text-[#6900AA] font-semibold">
          Back to My Bookings
        </Link>
      </div>
    );
  }

  const isUpcoming =
    !!booking.starts_at &&
    new Date(booking.starts_at) > new Date() &&
    booking.status === "CONFIRMED";
  const mapsUrl = booking.venue_name || booking.venue_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`
    : null;
  const qrRaw = booking.qr_code || booking.qr_payload || booking.id;

  return (
    <div className="min-h-screen bg-[#f4f5f7] pt-10 pb-16">
      <div className="max-w-5xl mx-auto px-4">
        <Link
          href="/customer/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#6900AA] mb-6"
        >
          <ArrowLeft size={16} /> Back to My Bookings
        </Link>

        <div className="mb-6 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">Booking Details</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-sm text-slate-500">Booking ID: {displayCode}</p>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusStyles(booking.status)}`}>
                {booking.status}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {booking.status !== "CANCELLED" && (
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-60"
              >
                <Download size={16} />
                {downloading ? "Downloading..." : "Download Ticket"}
              </button>
            )}
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Share2 size={16} /> Share
            </button>
            {isUpcoming && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={isCancelling}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 bg-white text-sm font-semibold text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-60"
              >
                <XCircle size={16} />
                {isCancelling ? "Cancelling..." : "Cancel Booking"}
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 mb-5">
          <div className="flex gap-4">
            {poster ? (
              <img src={poster} alt="" className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-slate-100 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6900AA]">Event</p>
              <h2 className="text-xl font-extrabold text-slate-900 mt-0.5">{booking.event_name}</h2>
              {venue && (
                <p className="text-sm text-slate-500 mt-1 flex items-start gap-1.5">
                  <MapPin size={14} className="mt-0.5 shrink-0" /> {venue}
                </p>
              )}
              <div className="flex flex-wrap gap-4 mt-2">
                {booking.event_id && (
                  <Link
                    href={`/events/${booking.event_id}`}
                    className="text-sm font-semibold text-[#6900AA] inline-flex items-center gap-1"
                  >
                    View event details <ExternalLink size={13} />
                  </Link>
                )}
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-[#6900AA] inline-flex items-center gap-1"
                  >
                    Get directions <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
            <div className="sm:border-r border-slate-100">
              <Calendar size={16} className="text-[#6900AA] mb-1" />
              <p className="text-sm font-bold text-slate-900">{formatDateLine(booking.starts_at)}</p>
              <p className="text-xs text-slate-400">{formatWeekday(booking.starts_at)}</p>
            </div>
            <div className="sm:border-r border-slate-100">
              <Clock size={16} className="text-[#6900AA] mb-1" />
              <p className="text-sm font-bold text-slate-900">{formatTime12h(booking.starts_at)}</p>
              <p className="text-xs text-slate-400">Onwards</p>
            </div>
            <div className="sm:border-r border-slate-100">
              <Clock size={16} className="text-[#6900AA] mb-1" />
              <p className="text-sm font-bold text-slate-900">
                {booking.ends_at ? formatTime12h(booking.ends_at) : "—"}
              </p>
              <p className="text-xs text-slate-400">Onwards</p>
            </div>
            <div>
              <Ticket size={16} className="text-[#6900AA] mb-1" />
              <p className="text-sm font-bold text-slate-900">{ticketCount} Tickets</p>
              <p className="text-xs text-slate-400">{ticketTypeLabel}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 mb-5">
          <h3 className="font-extrabold text-slate-900 mb-4">Payment Summary</h3>
          <div className="space-y-2 text-sm">
            {(booking.items || []).map((item) => (
              <div key={item.id} className="flex justify-between text-slate-600">
                <span>
                  {item.ticket_type} x {item.qty}
                </span>
                <span>{formatMoney(Number(item.unit_price) * item.qty)}</span>
              </div>
            ))}
            <div className="flex justify-between text-slate-500">
              <span>
                Convenience Fee
                {booking.convenience_fee_percent
                  ? ` (${Number(booking.convenience_fee_percent)}%)`
                  : ""}
              </span>
              <span>{formatMoney(booking.convenience_fee_total)}</span>
            </div>
            {Number(booking.discount_amount || 0) > 0 && (
              <div className="flex justify-between text-[#6900AA]">
                <span>Promo discount</span>
                <span>−{formatMoney(booking.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-3 border-t border-slate-100">
              <span className="font-semibold text-slate-800">Total Payable</span>
              <span className="text-lg font-extrabold text-[#6900AA]">{formatMoney(booking.grand_total)}</span>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-[#F7E9FF] px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-sm text-slate-700">
            <Printer size={16} className="text-[#6900AA] shrink-0" />
            <p>
              <span className="text-slate-800">Guest Name: </span>
              <span className="font-semibold">{booking.guest_name || user.name || "Guest"}</span>
            </p>
            <p>
              <span className="text-slate-800">Phone: </span>
              <span className="font-semibold">{booking.guest_phone || user.phone || "—"}</span>
            </p>
            <p>
              <span className="text-slate-800">Email: </span>
              <span className="font-semibold">{booking.guest_email || user.email || "—"}</span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
          <h3 className="font-extrabold text-slate-900 mb-4">Your Ticket</h3>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-4 relative overflow-hidden">
            {booking.qr_code || booking.qr_payload ? (
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrRaw)}`}
                alt="Ticket QR"
                className="w-28 h-28 bg-white rounded-lg shrink-0"
              />
            ) : (
              <div className="w-28 h-28 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-xs text-slate-400 shrink-0">
                QR Code
              </div>
            )}
            <div className="min-w-0 relative z-10">
              <p className="font-bold text-slate-900">Show this QR at the venue for entry.</p>
              <p className="text-sm text-slate-500 mt-1">This QR code is unique to your booking</p>
              {/* <p className="text-xs text-slate-400 mt-2">Ticket ID: {ticketCode(booking.id)}</p> */}
            </div>
            <Tickets size={72} className="absolute right-4 text-slate-200 hidden sm:block" />
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Cancel ticket booking?"
        body="Cancel this ticket booking? Seats will be released."
        confirmLabel="Cancel booking"
        danger
        busy={confirmBusy || isCancelling}
        onCancel={() => !confirmBusy && setConfirmOpen(false)}
        onConfirm={async () => {
          if (!booking) return;
          setConfirmBusy(true);
          try {
            await cancelBooking({
              id: booking.id,
              customerId: user?.customer_id,
            }).unwrap();
            toast.success("Booking cancelled");
            setConfirmOpen(false);
          } catch (err) {
            toast.error(extractApiError(err, "Failed to cancel booking"));
          } finally {
            setConfirmBusy(false);
          }
        }}
      />
    </div>
  );
}
