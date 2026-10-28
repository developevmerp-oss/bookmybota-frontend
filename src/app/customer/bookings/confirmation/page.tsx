"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Check,
  Clock,
  Copy,
  Home,
  MapPin,
  Phone,
  Share2,
  Sparkles,
  Ticket,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useGetBookingByIdQuery, useGetReviewsQuery } from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { readSessionForRole } from "@/lib/authStorage";
import {
  formatDateCustomer,
  formatInstantLocalDateTime,
  formatTime12h,
  formatWeekdayCustomer,
  getVenueDateTimeParts,
} from "@/lib/dateFormat";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import BookingTicketPerforation, {
  BOOKING_CONFIRM_PAGE_BG,
} from "@/components/Shared/BookingTicketPerforation";
import ConfirmationPageUI1Shell from "@/components/Shared/Confirmation/ConfirmationPageUI1Shell";
import DiningConfirmationReviewAside from "@/components/Shared/Confirmation/DiningConfirmationReviewAside";
import { CONFIRMATION_UI_VERSION } from "@/components/Shared/Confirmation/confirmationUiVersion";
import { BookingConfirmationShimmer } from "@/components/Shared/Shimmer";
import { formatMoney } from "@/lib/currencyFormat";
import { buildTicketCardPdf, downloadPdfBlob } from "@/lib/confirmationTicketPdf";

const CONFIRM_PAGE_MAX = "mx-auto w-full max-w-[64rem] px-4 md:px-5 lg:px-10 xl:px-12";
const DEFAULT_DINING_IMAGE =
  "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=800&q=80";

const actionBtnSecondary =
  "inline-flex min-h-[2.875rem] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-[0.75rem] min-[480px]:text-[0.8125rem] lg:text-[0.8125rem] xl:text-[0.875rem] font-semibold text-slate-800 transition hover:bg-slate-50";

const actionBtnPrimary =
  "inline-flex min-h-[2.875rem] w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-2.5 py-2.5 text-[0.75rem] min-[480px]:text-[0.8125rem] lg:text-[0.8125rem] xl:text-[0.875rem] font-semibold text-white transition hover:bg-slate-800";

function diningArrivalNote(bookingTime: string) {
  const booked = new Date(bookingTime);
  if (Number.isNaN(booked.getTime())) return "Please arrive on time for your booking.";
  const start = new Date(booked);
  const end = new Date(booked);
  start.setMinutes(start.getMinutes() - 30);
  end.setMinutes(end.getMinutes() + 15);
  const table = formatTime12h(booked);
  const from = formatTime12h(start);
  const until = formatTime12h(end);
  if (table === "—" || from === "—" || until === "—") {
    return "Please arrive on time for your booking.";
  }
  return `Your table is at ${table}. Please arrive between ${from} and ${until}.`;
}

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

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const bookingId = searchParams.get("id") || "";
  const arrivalNote = searchParams.get("arrival") || "";
  const [copied, setCopied] = useState(false);
  const [headerReady, setHeaderReady] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  useEffect(() => {
    const t = window.setTimeout(() => setHeaderReady(true), 40);
    return () => window.clearTimeout(t);
  }, [bookingId]);

  const { data: booking, isLoading, error } = useGetBookingByIdQuery(bookingId, {
    skip: !bookingId,
  });

  const businessId = String(booking?.business_id || "").trim();
  const { data: diningReviewsData } = useGetReviewsQuery(businessId, {
    skip: !businessId,
  });

  const customerSession = readSessionForRole("customer");
  const loggedInCustomerId = (user?.id ?? customerSession?.user?.id)
    ? String(user?.id ?? customerSession?.user?.id)
    : null;
  const loggedInName = String(
    user?.name || customerSession?.user?.name || ""
  ).trim().toLowerCase();

  const alreadyReviewed = useMemo(() => {
    if (diningReviewsData?.eligibility?.already_reviewed) return true;
    const items = diningReviewsData?.items ?? [];
    if (!items.length) return false;
    if (loggedInCustomerId) {
      const matchById = items.some(
        (r) => r.customer_id != null && String(r.customer_id) === loggedInCustomerId
      );
      if (matchById) return true;
    }
    if (loggedInName) {
      const matchByName = items.some(
        (r) => String(r.user_name || "").trim().toLowerCase() === loggedInName
      );
      if (matchByName) return true;
    }
    return false;
  }, [
    diningReviewsData?.eligibility?.already_reviewed,
    diningReviewsData?.items,
    loggedInCustomerId,
    loggedInName,
  ]);

  const isVisitEnded = useMemo(() => {
    if (diningReviewsData?.eligibility?.visit_ended) {
      return true;
    }
    if (booking?.status === "COMPLETED" || booking?.checked_out_at) {
      return true;
    }
    if (booking?.booking_time) {
      try {
        const raw = String(booking.booking_time).replace(" ", "T");
        const t = new Date(raw.includes("T") ? raw : `${raw}T00:00:00`).getTime();
        if (!Number.isNaN(t)) {
          // 90 minutes after reservation start time
          return Date.now() >= t + 90 * 60 * 1000;
        }
      } catch {
        // ignore
      }
    }
    return false;
  }, [
    diningReviewsData?.eligibility?.visit_ended,
    booking?.status,
    booking?.checked_out_at,
    booking?.booking_time,
  ]);

  const canShowReview = Boolean(businessId) && isVisitEnded && !alreadyReviewed;

  if (!bookingId) {
    return (
      <div className="min-h-screen bg-white pt-24 text-center px-4">
        <p className="text-slate-500 mb-4">No booking ID provided.</p>
        <Link href="/" className="text-[#6900AA] font-semibold">
          Browse restaurants
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return <BookingConfirmationShimmer showAside />;
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

  const qrData = booking.qr_token || booking.id;
  const tableArrivalNote = booking.booking_time
    ? diningArrivalNote(booking.booking_time)
    : "Please arrive on time for your booking.";
  const appliedOffer = booking.applied_offer;
  const guestName =
    booking.guest_name?.trim() || booking.customer_name?.trim() || user?.name || "—";
  const contact =
    booking.guest_phone?.trim() || booking.customer_phone?.trim() || user?.phone || "—";
  const cover =
    resolveMediaUrl(booking.business_cover_image) || DEFAULT_DINING_IMAGE;
  const bookedOn = booking.created_at
    ? formatInstantLocalDateTime(booking.created_at)
    : "";

  const copyBookingId = async () => {
    try {
      await navigator.clipboard.writeText(booking.id);
      setCopied(true);
      toast.success("Booking ID copied");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy Booking ID");
    }
  };

  const addToCalendar = () => {
    if (!booking.booking_time) return;
    const startParts = getVenueDateTimeParts(booking.booking_time);
    if (!startParts) return;

    const pad = (n: number) => String(n).padStart(2, "0");
    const formatCalDate = (p: { y: number; m: number; d: number; hour: number; minute: number }) =>
      `${p.y}${pad(p.m)}${pad(p.d)}T${pad(p.hour)}${pad(p.minute)}00`;

    const startStr = formatCalDate(startParts);

    let endStr: string;
    const endParts = booking.end_time ? getVenueDateTimeParts(booking.end_time) : null;
    if (endParts) {
      endStr = formatCalDate(endParts);
    } else {
      const startDate = new Date(Date.UTC(startParts.y, startParts.m - 1, startParts.d, startParts.hour, startParts.minute));
      startDate.setUTCMinutes(startDate.getUTCMinutes() + 90);
      endStr = `${startDate.getUTCFullYear()}${pad(startDate.getUTCMonth() + 1)}${pad(startDate.getUTCDate())}T${pad(startDate.getUTCHours())}${pad(startDate.getUTCMinutes())}00`;
    }

    const description = [
      `Table Reservation at ${booking.business_name || "Restaurant"}`,
      booking.id ? `Booking ID: ${booking.id.slice(0, 8).toUpperCase()}` : "",
      guestName && guestName !== "—" ? `Guest: ${guestName}` : "",
      booking.guests ? `Guests: ${booking.guests} Guest(s)` : "",
      tableArrivalNote ? `Note: ${tableArrivalNote}` : "",
      booking.business_address ? `Address: ${booking.business_address}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      `Table at ${booking.business_name || "Restaurant"}`
    )}&dates=${startStr}/${endStr}&details=${encodeURIComponent(
      description
    )}&location=${encodeURIComponent(booking.business_address || "")}`;
    window.open(url, "_blank");
  };

  const shareBooking = async () => {
    const text = `My table at ${booking.business_name || "this restaurant"} is confirmed. Booking ${booking.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Dining reservation", text, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
        toast.success("Link copied");
      }
    } catch {
      /* cancelled */
    }
  };

  const whenLine = [
    formatWeekdayCustomer(booking.booking_time),
    formatDateCustomer(booking.booking_time),
    formatTime12h(booking.booking_time),
  ]
    .filter(Boolean)
    .join(" · ");

  const downloadDiningPdf = async () => {
    if (!booking || downloading) return;
    setDownloading(true);
    try {
      const blob = await buildTicketCardPdf({
        filenameTitle: "Dining",
        title: booking.business_name || "Restaurant",
        posterUrl: cover,
        tag: "Dine-in",
        whenLine,
        venueLine: booking.business_address || undefined,
        offerLabel: appliedOffer?.title ? `Offer: ${appliedOffer.title}` : undefined,
        ticketCountLabel: `${booking.guests ?? "—"} Guest${
          Number(booking.guests) === 1 ? "" : "(s)"
        }`,
        primaryLabel: "Confirmed booking",
        secondaryLabel: guestName !== "—" ? guestName : undefined,
        bookingCode: booking.id.slice(0, 8).toUpperCase(),
        showQr: false,
        cancellationNote: tableArrivalNote,
        totalFormatted: undefined,
        amountRows: [],
      });
      downloadPdfBlob(
        blob,
        `BookMyBota-Dining-${booking.id.slice(0, 8).toUpperCase()}.pdf`
      );
      toast.success("Reservation PDF downloaded");
    } catch {
      toast.error("Could not prepare the reservation PDF.");
    } finally {
      setDownloading(false);
    }
  };

  // UI1 = BMS ticket + dining rating aside (same pattern as movie). UI2 = classic below.
  if (CONFIRMATION_UI_VERSION === 1) {
    return (
      <ConfirmationPageUI1Shell
        showAside={canShowReview}
        aside={
          canShowReview ? (
            <DiningConfirmationReviewAside
              businessId={businessId}
              restaurantName={booking.business_name}
            />
          ) : undefined
        }
        backHref="/customer/dashboard"
        pageTitle="Confirmed booking"
        title={booking.business_name || "Restaurant"}
        posterUrl={cover}
        whenLine={whenLine}
        venueLine={booking.business_address || undefined}
        offerLabel={appliedOffer?.title ? `Offer: ${appliedOffer.title}` : undefined}
        ticketCountLabel={`${booking.guests ?? "—"} Guest${
          Number(booking.guests) === 1 ? "" : "(s)"
        }`}
        primaryLabel="Confirmed booking"
        secondaryLabel={guestName !== "—" ? guestName : undefined}
        bookingCode={booking.id.slice(0, 8).toUpperCase()}
        qrValue={qrData}
        showQr={false}
        directDetails={true}
        mTicketLabel="Dine-in"
        cancellationNote={tableArrivalNote}
        supportHref="/customer/help"
        onDownloadPdf={downloadDiningPdf}
        downloading={downloading}
        exploreHref="/dining"
        detailsExtra={
          <div className="mt-2.5">
            <button
              type="button"
              onClick={addToCalendar}
              className="inline-flex w-full items-center justify-center h-11 rounded-xl border border-[#E5E5E5] bg-white hover:bg-slate-50 text-[0.875rem] font-semibold text-[#333] transition-colors cursor-pointer"
            >
              Add to Calendar
            </button>
          </div>
        }
      />
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
                Your reservation is confirmed
              </h1>
              <p className="mt-1.5 text-[0.875rem] sm:text-[0.9375rem] text-slate-600 leading-relaxed">
                Your table at{" "}
                <span className="font-semibold text-slate-800">{booking.business_name}</span> is
                reserved.
              </p>
              <p className="mt-1 text-[0.8125rem] sm:text-[0.875rem] text-slate-500 leading-relaxed">
                Show this booking at the restaurant
                {appliedOffer?.title ? " to claim your dining offer" : ""}.
              </p>
            </div>
          </div>
        </div>

        <div className="relative overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Row 1: cover + QR */}
          <div className="relative flex flex-col gap-0 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1 p-4 sm:p-5 flex justify-center sm:justify-start bg-white">
              <img
                src={cover}
                alt={booking.business_name || "Restaurant"}
                className="block h-auto w-auto max-h-[12.5rem] sm:max-h-[15rem] md:max-h-[17rem] max-w-full sm:max-w-[min(100%,20rem)] rounded-xl"
                onError={(e) => {
                  const el = e.currentTarget;
                  if (el.dataset.fallbackApplied === "1") return;
                  el.dataset.fallbackApplied = "1";
                  el.src = DEFAULT_DINING_IMAGE;
                }}
              />
            </div>

            <div className="relative w-full sm:w-[min(100%,17rem)] sm:shrink-0 md:w-[18rem] lg:w-[19rem]">
              <div
                className="hidden sm:block absolute left-0 top-5 bottom-5 w-px border-l border-dashed border-slate-300"
                aria-hidden
              />
              <div className="border-t border-dashed border-slate-300 px-5 py-5 sm:border-t-0 sm:px-6 sm:py-5 sm:pl-8">
                <div className="mx-auto flex w-full max-w-[15rem] flex-col items-center text-center">
                  <p className="text-[0.9375rem] font-bold text-slate-900">Confirmed booking</p>
                  <button
                    type="button"
                    onClick={copyBookingId}
                    className="mt-1 inline-flex items-center gap-1.5 font-mono text-[0.8125rem] font-bold text-slate-700 hover:text-[#6900AA] cursor-pointer"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {booking.id.slice(0, 8).toUpperCase()}
                  </button>
                  <p className="mt-2 text-[0.75rem] sm:text-[0.8125rem] text-slate-500 leading-relaxed">
                    {tableArrivalNote}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <BookingTicketPerforation />

          {/* Row 2: dining details */}
          <div className="px-5 pt-5 pb-5 sm:px-6 sm:pt-6 sm:pb-6 lg:px-8">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F5E9] px-2.5 py-1 text-[0.6875rem] font-semibold text-[#2E7D32]">
              <Check size={12} strokeWidth={3} />
              Booking Confirmed
            </span>
            <h2 className="mt-3 text-[1.25rem] sm:text-[1.375rem] lg:text-[1.5rem] font-extrabold leading-snug text-slate-900">
              {booking.business_name}
            </h2>
            {booking.business_address ? (
              <p className="mt-2 flex items-start gap-1.5 text-[0.875rem] text-slate-500">
                <MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" />
                <span>{booking.business_address}</span>
              </p>
            ) : null}

            <div className="mt-5 grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-5">
              <DetailCell icon={User} label="Guest Name" value={guestName} />
              <DetailCell icon={Phone} label="Contact" value={contact} />
              <DetailCell
                icon={Users}
                label="Guests"
                value={booking.guests != null ? String(booking.guests) : "—"}
              />
              <DetailCell
                icon={Calendar}
                label="Date"
                value={formatDateCustomer(booking.booking_time)}
                hint={formatWeekdayCustomer(booking.booking_time) || undefined}
              />
              <DetailCell
                icon={Clock}
                label="Time"
                value={formatTime12h(booking.booking_time)}
                hint={tableArrivalNote}
              />
              {appliedOffer?.title ? (
                <DetailCell
                  icon={Ticket}
                  label="Dining Offer"
                  value={appliedOffer.title}
                  hint={
                    [appliedOffer.type, appliedOffer.validity].filter(Boolean).join(" · ") ||
                    undefined
                  }
                />
              ) : null}
            </div>
          </div>

          <BookingTicketPerforation />

          {/* Actions */}
          <div className="px-5 pt-5 pb-5 sm:px-6 sm:pt-6 sm:pb-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              <Link
                href={`/customer/bookings/${booking.id}`}
                className={actionBtnPrimary}
              >
                <Ticket size={16} className="shrink-0" />
                <span className="truncate">View booking details</span>
              </Link>
              {user?.role === "customer" ? (
                <Link href="/customer/dashboard" className={actionBtnSecondary}>
                  <Ticket size={16} className="text-slate-600 shrink-0" />
                  <span className="truncate">My Bookings</span>
                </Link>
              ) : null}
              <button type="button" onClick={addToCalendar} className={actionBtnSecondary}>
                <Calendar size={16} className="text-slate-600 shrink-0" />
                <span className="truncate">Add to Calendar</span>
              </button>
              <button type="button" onClick={shareBooking} className={actionBtnSecondary}>
                <Share2 size={16} className="text-slate-600 shrink-0" />
                <span className="truncate">Share Booking</span>
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-[0.6875rem] text-slate-400 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <p className="min-w-0 break-all sm:truncate" title={booking.id}>
                Booking ID: {booking.id}
              </p>
              {bookedOn && bookedOn !== "—" ? (
                <p className="shrink-0 sm:text-right">Booked on {bookedOn}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 sm:mt-8 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex items-start gap-3 sm:items-center sm:gap-4 min-w-0">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F7E9FF] text-[#6900AA]">
              <Sparkles size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-[0.9375rem] sm:text-[1rem] font-bold text-slate-900">
                Looking for more places to dine?
              </p>
              <p className="mt-0.5 text-[0.8125rem] sm:text-[0.875rem] text-slate-500 leading-relaxed">
                Discover restaurants and offers across Ethiopia.
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2.5 min-[480px]:flex-row min-[480px]:items-center sm:w-auto sm:shrink-0">
            <Link
              href="/"
              className="inline-flex min-h-[2.875rem] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-[0.875rem] font-semibold text-white transition hover:bg-slate-800 min-[480px]:w-auto"
            >
              Explore Dining
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

export default function BookingConfirmationPage() {
  return (
    <Suspense fallback={<BookingConfirmationShimmer showAside />}>
      <ConfirmationContent />
    </Suspense>
  );
}
