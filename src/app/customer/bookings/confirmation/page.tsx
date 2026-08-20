"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Calendar,
  Clock,
  MapPin,
  Users,
  UtensilsCrossed,
  ArrowRight,
  Loader2,
  Bookmark,
  Copy,
  CheckCheck,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { useGetBookingByIdQuery } from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { formatDate, formatTime12h } from "@/lib/dateFormat";

function IconBox({ children }: { children: ReactNode }) {
  return (
    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
      {children}
    </div>
  );
}

function checkInWindow(bookingTime: string) {
  const start = new Date(bookingTime);
  const end = new Date(bookingTime);
  if (Number.isNaN(start.getTime())) return null;
  start.setMinutes(start.getMinutes() - 30);
  end.setMinutes(end.getMinutes() + 15);
  return `${formatTime12h(start)} – ${formatTime12h(end)}`;
}

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const bookingId = searchParams.get("id") || "";
  const arrivalNote = searchParams.get("arrival") || "";
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const { data: booking, isLoading, error } = useGetBookingByIdQuery(bookingId, {
    skip: !bookingId,
  });

  if (!bookingId) {
    return (
      <div className="min-h-screen bg-background pt-24 text-center px-4">
        <p className="text-muted-foreground mb-4">No booking ID provided.</p>
        <Link href="/" className="btn-primary inline-block">
          Browse restaurants
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-24 flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="animate-spin text-violet-600" size={32} />
        Loading confirmation...
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-background pt-24 text-center px-4">
        <p className="text-muted-foreground mb-4">Could not load booking details.</p>
        <Link href="/customer/dashboard" className="btn-primary inline-block">
          My Bookings
        </Link>
      </div>
    );
  }

  const qrData = booking.qr_token || booking.id;
  const windowLabel = checkInWindow(booking.booking_time);
  const appliedOffer = booking.applied_offer;

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

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F7F6FA] pt-10 sm:pt-14 pb-16">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 0% 0%, rgba(139,92,246,0.10), transparent 70%), radial-gradient(ellipse 45% 38% at 100% 100%, rgba(124,58,237,0.08), transparent 70%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-7 sm:mb-8">
          <div className="relative w-[72px] h-[72px] mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border border-violet-200/80 scale-125" />
            <div className="relative w-full h-full rounded-full bg-violet-600 text-white flex items-center justify-center shadow-[0_8px_24px_rgba(124,58,237,0.28)]">
              <Check size={34} strokeWidth={2.8} />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-black mb-2 tracking-tight">
            Booking Confirmed!
          </h1>
          <p className="text-slate-500 text-sm sm:text-[15px]">
            Your table at <strong className="text-black">{booking.business_name}</strong> is
            reserved.
          </p>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-[0_16px_50px_rgba(88,28,180,0.08)] border border-slate-100 p-4 sm:p-6 lg:p-7 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-[1.15fr_auto_0.95fr] gap-5 md:gap-0">
            <div className="min-w-0 md:pr-6">
              <div className="flex items-start gap-3 pb-4">
                <IconBox>
                  <Store size={18} />
                </IconBox>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 font-medium">Restaurant</p>
                  <p className="font-bold text-slate-900 truncate">{booking.business_name}</p>
                  {booking.business_address && (
                    <p className="text-sm text-slate-500 mt-0.5 flex items-start gap-1">
                      <MapPin size={12} className="mt-1 shrink-0 text-violet-500" />
                      <span className="break-words">{booking.business_address}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 py-4 border-t border-slate-100">
                <div className="flex items-start gap-2.5 min-w-0">
                  <IconBox>
                    <Calendar size={16} />
                  </IconBox>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400 font-medium">Date</p>
                    <p className="text-sm font-bold text-slate-900 break-words">
                      {formatDate(booking.booking_time)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 min-w-0">
                  <IconBox>
                    <Clock size={16} />
                  </IconBox>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400 font-medium">Time</p>
                    <p className="text-sm font-bold text-slate-900">
                      {formatTime12h(booking.booking_time)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 py-4 border-t border-slate-100">
                <div className="flex items-start gap-2.5 min-w-0">
                  <IconBox>
                    <Users size={16} />
                  </IconBox>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400 font-medium">Guests</p>
                    <p className="text-sm font-bold text-slate-900">{booking.guests ?? "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 min-w-0">
                  <IconBox>
                    <UtensilsCrossed size={16} />
                  </IconBox>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400 font-medium">Table</p>
                    <p className="text-sm font-bold text-slate-900">
                      {booking.table_number ? `Table ${booking.table_number}` : "Assigned at venue"}
                    </p>
                  </div>
                </div>
              </div>

              {arrivalNote && (
                <div className="flex items-start gap-3 py-4 border-t border-slate-100">
                  <IconBox>
                    <Clock size={16} />
                  </IconBox>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400 font-medium">Approx. arrival</p>
                    <p className="text-sm font-bold text-slate-900">{arrivalNote}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3 pt-4 border-t border-slate-100">
                <IconBox>
                  <Bookmark size={16} />
                </IconBox>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-400 font-medium">Booking ID</p>
                  <div className="flex items-start gap-2">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 break-all leading-relaxed">
                      {booking.id}
                    </p>
                    <button
                      type="button"
                      onClick={copyBookingId}
                      className="mt-0.5 shrink-0 text-slate-400 hover:text-violet-600 cursor-pointer"
                      aria-label="Copy booking ID"
                    >
                      {copied ? <CheckCheck size={15} /> : <Copy size={15} />}
                    </button>
                  </div>
                </div>
              </div>
              {appliedOffer?.title && (
                <div className="flex items-start gap-3 pt-4 border-t border-slate-100">
                  <IconBox>
                    <UtensilsCrossed size={16} />
                  </IconBox>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400 font-medium">Dining offer (show QR at restaurant)</p>
                    <p className="text-sm font-bold text-slate-900">{appliedOffer.title}</p>
                    {(appliedOffer.type || appliedOffer.validity) && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {[appliedOffer.type, appliedOffer.validity].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden md:block w-px bg-slate-100 self-stretch" />

            <div className="min-w-0 md:pl-6 flex flex-col items-center text-center pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
              <p className="text-base font-bold text-slate-900">Check-in QR</p>
              <p className="text-xs text-slate-400 mt-0.5 mb-4">Show this QR at the restaurant to claim your offer</p>

              {booking.qr_token ? (
                <div className="w-[180px] h-[180px] sm:w-[200px] sm:h-[200px] rounded-2xl border border-violet-200 bg-white p-2.5">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`}
                    alt="Booking QR code"
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-[180px] h-[180px] sm:w-[200px] sm:h-[200px] rounded-2xl border border-violet-200 bg-slate-50 flex items-center justify-center text-slate-400 text-xs font-medium px-4">
                  QR will appear once check-in scanning is enabled for this booking.
                </div>
              )}

              {windowLabel && (
                <div className="mt-4 w-full max-w-[260px] rounded-xl bg-violet-50 px-3 py-2.5 flex items-center gap-2.5 text-left">
                  <Clock size={16} className="text-violet-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500 leading-tight">Check-in window</p>
                    <p className="text-xs sm:text-sm font-bold text-slate-900">{windowLabel}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={`/customer/bookings/${booking.id}`}
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 shadow-md shadow-violet-300/30 transition-all"
          >
            View booking details <ArrowRight size={16} />
          </Link>
          {user?.role === "customer" && (
            <Link
              href="/customer/dashboard"
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors"
            >
              My Bookings
            </Link>
          )}
        </div>

        <button
          onClick={() => router.push("/")}
          className="w-full mt-4 text-sm font-medium text-violet-600 hover:text-violet-800 transition-colors cursor-pointer"
        >
          Continue browsing
        </button>
      </div>
    </div>
  );
}

export default function BookingConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background pt-24 flex justify-center text-muted-foreground">
          <Loader2 className="animate-spin text-violet-600" size={32} />
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  );
}
