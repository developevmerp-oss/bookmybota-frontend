"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Crown,
  Headphones,
  Languages,
  Loader2,
  Mail,
  Mic2,
  Minus,
  Phone,
  Plus,
  Shield,
  Star,
  Ticket,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCreateEventBookingMutation,
  useGetCustomerProfileQuery,
  useValidateEventPromoCodeMutation,
  type AppliedPromoOffer,
  useGetEventLayoutQuery,
  useGetPublicEventLayoutQuery,
  type OrganizerEvent,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { formatDateTime12h, formatTime12h } from "@/lib/dateFormat";
import { extractApiError } from "@/lib/apiErrors";
import { formatMoney } from "@/lib/currencyFormat";
import { parseEventLanguages } from "@/lib/eventValidation";
import { getPhoneValidationError, sanitizePhoneInput } from "@/lib/validation";
import dynamic from "next/dynamic";

const VenueLayoutViewer = dynamic(
  () => import("@/components/EventLandingPage/VenueLayoutViewer"),
  { ssr: false }
);

export type EventCheckoutMode = "customer" | "organizer";

export type EventCheckoutResult = {
  booking_id?: string;
  qr_code?: string;
  grand_total?: number;
  ticket_qty?: number;
};

type Props = {
  event: OrganizerEvent;
  open: boolean;
  initialShowtimeId?: string;
  onClose: () => void;
  mode?: EventCheckoutMode;
  /** drawer = overlay panel (organizer); page = full booking route */
  variant?: "drawer" | "page";
  onOrganizerSuccess?: (result: EventCheckoutResult) => void;
};

function dateKey(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateChip(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("en-US", { weekday: "short" }),
    date: d.toLocaleDateString("en-US", { day: "2-digit", month: "short" }),
  };
}

function formatDuration(minutes?: number | null) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function ticketAvail(available: number, total: number) {
  if (available <= 0) return { label: "Sold Out", className: "text-slate-400" };
  if ((total > 0 && available / total <= 0.15) || available <= 10) {
    return { label: "Few Left", className: "text-orange-500" };
  }
  return { label: "Available", className: "text-[#6900AA]" };
}

function ticketTypeIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("vvip") || n.includes("platinum") || n.includes("premium")) return Crown;
  if (n.includes("vip") || n.includes("gold")) return Star;
  if (n.includes("basic") || n.includes("economy") || n.includes("standard")) return Users;
  return Ticket;
}

const CHECKOUT_STEPS = [
  { n: 1, label: "Showtime", icon: Clock },
  { n: 2, label: "Tickets", icon: Ticket },
  { n: 3, label: "Details", icon: User },
] as const;

function moneySum(values: number[]) {
  return Math.round(values.reduce((sum, n) => sum + (Number(n) || 0), 0) * 100) / 100;
}

export default function EventCheckout({
  event,
  open,
  initialShowtimeId,
  onClose,
  mode = "customer",
  variant = "drawer",
  onOrganizerSuccess,
}: Props) {
  const isOrganizer = mode === "organizer";
  const isPage = variant === "page";
  const router = useRouter();
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((state) => state.auth.user);
  const [step, setStep] = useState(1);
  const [showtimeId, setShowtimeId] = useState("");
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [qtyByType, setQtyByType] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromoOffer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<any[]>([]);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [sendUpdates, setSendUpdates] = useState(true);
  const dateScrollRef = useRef<HTMLDivElement>(null);

  const customerId = authUser?.role === "customer" ? authUser.customer_id || "" : "";
  const { data: profile } = useGetCustomerProfileQuery(customerId, { skip: !customerId || isOrganizer });
  const { data: layoutData } = useGetEventLayoutQuery(event.id, { skip: !isOrganizer });
  const { data: publicLayoutData } = useGetPublicEventLayoutQuery(event.id, { skip: isOrganizer });

  const activeLayoutData = isOrganizer ? layoutData : publicLayoutData;

  const [createEventBooking] = useCreateEventBookingMutation();
  const [validatePromo, { isLoading: validatingPromo }] = useValidateEventPromoCodeMutation();

  const showtimes = event.showtimes || [];
  const ticketTypes = event.ticket_types || [];

  const dateOptions = useMemo(() => {
    const seen = new Map<string, string>();
    showtimes.forEach((s) => {
      const key = dateKey(s.starts_at);
      if (key && !seen.has(key)) seen.set(key, s.starts_at);
    });
    return [...seen.entries()].map(([key, iso]) => ({ key, iso }));
  }, [showtimes]);

  useEffect(() => {
    if (!isOrganizer) dispatch(loadFromStorage());
  }, [dispatch, isOrganizer]);

  useEffect(() => {
    if (!open) return;
    const initial = initialShowtimeId
      ? showtimes.find((s) => s.id === initialShowtimeId)
      : undefined;
    const firstDate = initial ? dateKey(initial.starts_at) : dateOptions[0]?.key || "";
    setShowtimeId("");
    setSelectedDateKey(firstDate);
    setStep(1);
    setQtyByType({});
    setSelectedSeats([]);
    setIsMapFullscreen(false);
    setName("");
    setPhone("");
    setEmail("");
    setPromoInput("");
    setAppliedPromo(null);
    setSubmitting(false);
    setSendUpdates(true);
  }, [open, event.id, initialShowtimeId]);

  useEffect(() => {
    if (isOrganizer || authUser?.role !== "customer") return;
    setName(profile?.name || authUser.name || "");
    setPhone(sanitizePhoneInput(profile?.phone || authUser.phone || ""));
    setEmail(profile?.email || authUser.email || "");
  }, [authUser, profile, isOrganizer]);

  const timesForDate = useMemo(
    () => showtimes.filter((s) => dateKey(s.starts_at) === selectedDateKey),
    [showtimes, selectedDateKey]
  );

  const recommendedId = timesForDate[0]?.id;
  const selectedShowtime = showtimes.find((s) => s.id === showtimeId);
  const conveniencePct = Number(event.convenience_fee_percent) || 0;

  const selectedLines = useMemo(() => {
    const lines = [];

    if (selectedSeats.length > 0) {
      const seatGrouped: Record<string, number> = {};
      selectedSeats.forEach((s) => {
        seatGrouped[s.ticket_type_id] = (seatGrouped[s.ticket_type_id] || 0) + 1;
      });

      for (const [ttId, qty] of Object.entries(seatGrouped)) {
        const t = ticketTypes.find((type) => type.id === ttId);
        if (t) {
          lines.push({
            id: t.id,
            ticket_type: t.ticket_type,
            qty,
            unit: Number(t.price) || 0,
            available: Number(t.available_count) || 0,
            event_seat_ids: selectedSeats.filter((s) => s.ticket_type_id === ttId).map((s) => s.id),
          });
        }
      }
    } else {
      ticketTypes.forEach((t) => {
        if (qtyByType[t.id] > 0) {
          lines.push({
            ...t,
            id: t.id,
            ticket_type: t.ticket_type,
            qty: qtyByType[t.id],
            unit: Number(t.price) || 0,
            available: Number(t.available_count) || 0,
          });
        }
      });
    }
    return lines;
  }, [ticketTypes, qtyByType, selectedSeats]);

  const ticketAmount = moneySum(selectedLines.map((l) => l.unit * l.qty));
  const discountAmount = !isOrganizer && appliedPromo ? appliedPromo.discount_amount : 0;
  const netTicketAmount = moneySum([Math.max(0, ticketAmount - discountAmount)]);
  const convenienceFee = moneySum([(netTicketAmount * conveniencePct) / 100]);
  const grandTotal = moneySum([netTicketAmount, convenienceFee]);
  const ticketQty = selectedLines.reduce((sum, l) => sum + l.qty, 0);

  const setQty = (id: string, next: number, max: number) => {
    setAppliedPromo(null);
    setPromoInput("");
    setQtyByType((prev) => ({
      ...prev,
      [id]: Math.max(0, Math.min(max, next)),
    }));
  };

  const handleApplyPromo = async () => {
    const code = promoInput.trim();
    if (!code) {
      toast.error("Enter a promo code.");
      return;
    }
    try {
      const result = await validatePromo({
        eventId: event.id,
        promo_code: code,
        ticket_amount: ticketAmount,
      }).unwrap();
      setAppliedPromo(result);
      toast.success(`Promo code "${result.promo_code}" applied!`);
    } catch (err) {
      setAppliedPromo(null);
      toast.error(extractApiError(err, "Invalid or expired promo code."));
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoInput("");
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showtimeId || selectedLines.length === 0) return;

    const phoneErr = getPhoneValidationError(phone);
    if (!name.trim()) {
      toast.error(isOrganizer ? "Please enter the customer's name." : "Please enter your name.");
      return;
    }
    if (phoneErr) {
      toast.error(phoneErr);
      return;
    }
    if (!email.trim()) {
      toast.error("Enter an email so we can send the tickets.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const items: any[] = [];
      if (selectedSeats.length > 0) {
        selectedSeats.forEach((s) => {
          items.push({ ticket_type_id: s.ticket_type_id, qty: 1, event_seat_id: s.id });
        });
      } else {
        selectedLines.forEach((l) => {
          items.push({ ticket_type_id: l.id, qty: l.qty });
        });
      }

      const guest_name = name.trim();
      const guest_phone = sanitizePhoneInput(phone);
      const guest_email = email.trim() || undefined;

      let result;
      if (isOrganizer) {
        result = await createEventBooking({
          event_id: event.id,
          showtime_id: showtimeId,
          items,
          guest_name,
          guest_phone,
          guest_email,
          booking_source: "ORGANIZER",
          for_organizer: true,
        }).unwrap();
      } else {
        result = await createEventBooking({
          event_id: event.id,
          showtime_id: showtimeId,
          items,
          guest_name,
          guest_phone,
          guest_email,
          customer_id: customerId || undefined,
          booking_source: "ONLINE",
          promo_code: appliedPromo?.promo_code,
        }).unwrap();
      }

      if (isOrganizer) {
        toast.success(`Tickets booked and sent to ${email.trim()}.`);
        onOrganizerSuccess?.(result);
        onClose();
      } else {
        toast.success(`Tickets booked! Confirmation sent to ${email.trim()}.`);
        onClose();
        if (result.booking_id) {
          router.push(`/customer/event-bookings/confirmation?id=${result.booking_id}`);
        }
      }
    } catch (err) {
      toast.error(extractApiError(err, "Booking failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const accentBtn = "bg-[#6900AA] hover:bg-[#57008E]";
  const accentIcon = "text-[#6900AA]";
  const accentFocus = "focus:border-[#6900AA]";
  const durationLabel = formatDuration(event.duration_minutes);
  const poster = event.poster_horizontal_url || event.poster_vertical_url;
  const languageLabel = parseEventLanguages(event.language).join(", ") || event.language || "";
  const stepTitle =
    step === 1 ? "Choose Showtime" : step === 2 ? "Select Tickets" : "Your Details";
  const stepSubtitle =
    step === 1
      ? "Pick the perfect date and time for your event."
      : step === 2
        ? "Choose the number of tickets you want to book."
        : "Please provide your information to complete booking.";
  const detailsReady =
    Boolean(name.trim()) &&
    !getPhoneValidationError(phone) &&
    Boolean(email.trim()) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canPay = detailsReady && !submitting;

  const infoItems = [
    durationLabel ? { icon: Clock, value: durationLabel, label: "Duration" } : null,
    languageLabel ? { icon: Languages, value: languageLabel, label: "Language" } : null,
    event.age_group ? { icon: User, value: event.age_group, label: "Age Limit" } : null,
    event.category_name ? { icon: Mic2, value: event.category_name, label: "Category" } : null,
  ].filter(Boolean) as { icon: typeof Clock; value: string; label: string }[];

  const panel = (
      <div
        className={
          isPage
            ? "relative w-full max-w-[26.25rem] mx-auto bg-white rounded-[1rem] sm:rounded-[1.25rem] shadow-xl border border-slate-100 flex flex-col min-h-[min(40rem,calc(100vh-6rem))] max-h-[calc(100vh-5rem)]"
            : "relative h-full w-full max-w-[26.25rem] bg-white shadow-2xl flex flex-col"
        }
      >
        <div className="px-5 pt-4 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[1.0625rem] font-extrabold tracking-tight leading-none">
              <span className="text-[#111111]">Book My </span>
              <span className="text-[#6900AA]">Bota</span>
            </p>
            <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-slate-500">
              <Shield size={12} className="text-[#6900AA]" />
              Secure Booking
            </span>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 cursor-pointer"
              aria-label={isPage ? "Back to event" : "Close"}
            >
              {isPage ? <ArrowLeft size={14} /> : <X size={14} />}
            </button>
          </div>

          <p className="mt-4 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-slate-400">
            Step {step} of 3{isOrganizer ? " · Organizer sale" : ""}
          </p>

          <div className="mt-4 flex items-start">
            {CHECKOUT_STEPS.map((s, i) => {
              const done = step > s.n;
              const active = step === s.n;
              const Icon = s.icon;
              return (
                <div key={s.n} className={`flex items-start ${i < 2 ? "flex-1" : ""}`}>
                  <div className="flex flex-col items-center w-[4.5rem]">
                    <span
                      className={`w-9 h-9 rounded-full flex items-center justify-center ${
                        done || active
                          ? "bg-[#6900AA] text-white"
                          : "border-2 border-slate-200 text-slate-400 bg-white"
                      }`}
                    >
                      {done ? <Check size={16} strokeWidth={3} /> : <Icon size={16} />}
                    </span>
                    <span
                      className={`mt-1.5 text-[0.6875rem] font-semibold ${
                        active || done ? "text-slate-900" : "text-slate-400"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < 2 && (
                    <div
                      className={`flex-1 h-0.5 mt-[1.125rem] ${
                        step > s.n ? "bg-[#6900AA]" : "bg-slate-200"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="mb-5">
            <h3 className="text-[1.25rem] font-extrabold text-slate-900">{stepTitle}</h3>
            <p className="text-[0.875rem] text-slate-500 mt-1">{stepSubtitle}</p>
          </div>
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h4 className="font-bold text-slate-900 mb-3">Select Date</h4>
                {dateOptions.length === 0 ? (
                  <p className="text-sm text-slate-500">Showtimes coming soon.</p>
                ) : (
                  <div className="relative">
                    <div
                      ref={dateScrollRef}
                      className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pr-8"
                    >
                      {dateOptions.map((d) => {
                        const chip = dateChip(d.iso);
                        const active = selectedDateKey === d.key;
                        return (
                          <button
                            key={d.key}
                            type="button"
                            onClick={() => {
                              setSelectedDateKey(d.key);
                              setShowtimeId("");
                            }}
                            className={`shrink-0 min-w-[92px] rounded-xl border px-3 py-3 text-center cursor-pointer ${
                              active
                                ? "bg-[#6900AA] border-transparent text-white"
                                : "bg-white border-slate-200 text-slate-800"
                            }`}
                          >
                            <span className="block text-xs font-medium">{chip.day}</span>
                            <span className="block text-sm font-bold mt-0.5">{chip.date}</span>
                          </button>
                        );
                      })}
                    </div>
                    {dateOptions.length > 3 && (
                      <button
                        type="button"
                        onClick={() => dateScrollRef.current?.scrollBy({ left: 160, behavior: "smooth" })}
                        className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center cursor-pointer"
                        aria-label="More dates"
                      >
                        <ChevronRight size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-3">Select Time</h4>
                <div className="space-y-2.5">
                  {timesForDate.map((s) => {
                    const active = showtimeId === s.id;
                    const recommended = s.id === recommendedId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setShowtimeId(s.id)}
                        className={`w-full text-left rounded-xl border px-4 py-3.5 flex items-center gap-3 cursor-pointer ${
                          active ? "border-[#6900AA] bg-[#F7E9FF]" : "border-slate-200 bg-white"
                        }`}
                      >
                        <span
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                            active ? "bg-[#6900AA] text-white" : "bg-[#F7E9FF] text-[#6900AA]"
                          }`}
                        >
                          <Clock size={16} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-bold text-slate-900">
                            {formatTime12h(s.starts_at)} Onwards
                          </span>
                          <span className="block text-xs text-slate-500 mt-0.5">
                            {s.venue_name || "Venue TBA"}
                          </span>
                        </span>
                        {recommended && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#F7E9FF] text-[#6900AA] text-[11px] font-semibold px-2 py-1">
                            <Star size={11} fill="currentColor" />
                            Recommended
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {infoItems.length > 0 && (
                <div className="rounded-xl border border-slate-100 bg-white px-3 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {infoItems.map((item) => (
                    <div key={item.label} className="flex flex-col items-center text-center gap-1.5">
                      <span className="w-10 h-10 rounded-full bg-[#F7E9FF] text-[#6900AA] flex items-center justify-center">
                        <item.icon size={16} />
                      </span>
                      <p className="text-xs font-bold text-slate-900 leading-tight">{item.value}</p>
                      <p className="text-[10px] text-slate-400">{item.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {activeLayoutData?.data?.seats?.length > 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-6 text-center space-y-4">
                  <p className="text-sm font-semibold text-slate-700">This event uses reserved seating.</p>
                  <button
                    type="button"
                    onClick={() => setIsMapFullscreen(true)}
                    className={`w-full py-3 ${accentBtn} text-white text-sm font-bold rounded-xl cursor-pointer`}
                  >
                    Open Seating Map
                  </button>
                  {selectedSeats.length > 0 && (
                    <p className={`text-sm font-bold ${accentIcon}`}>{selectedSeats.length} seats selected</p>
                  )}
                  {isMapFullscreen && (
                    <div className="fixed inset-0 z-[100] bg-white flex flex-col overflow-hidden">
                      <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
                        <div className="text-left">
                          <h3 className="font-bold text-lg text-slate-900">Select your seats</h3>
                          <p className="text-sm text-slate-500">Pick up to 10 seats</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsMapFullscreen(false)}
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg cursor-pointer"
                        >
                          <X size={20} />
                        </button>
                      </div>
                      <div className="flex-1 overflow-hidden bg-slate-50 relative flex flex-col p-2 sm:p-4">
                        <VenueLayoutViewer
                          layoutData={activeLayoutData}
                          ticketTypes={ticketTypes}
                          onSeatsSelected={setSelectedSeats}
                          maxSelectable={10}
                          initialSelectedSeats={selectedSeats}
                        />
                      </div>
                      <div className="p-5 border-t border-slate-200 bg-white flex justify-between items-center">
                        <p className="font-bold text-slate-800">{selectedSeats.length} seats selected</p>
                        <button
                          type="button"
                          onClick={() => setIsMapFullscreen(false)}
                          className={`px-6 py-2.5 ${accentBtn} text-white font-bold text-sm rounded-xl cursor-pointer`}
                        >
                          Confirm Selection
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : ticketTypes.length === 0 ? (
                <p className="text-sm text-slate-500">No ticket types yet.</p>
              ) : (
                ticketTypes.map((t) => {
                  const available = Number(t.available_count) || 0;
                  const total = Number(t.total_count) || 0;
                  const qty = qtyByType[t.id] || 0;
                  const status = ticketAvail(available, total);
                  const TypeIcon = ticketTypeIcon(t.ticket_type);
                  return (
                    <div
                      key={t.id}
                      className={`rounded-xl p-4 flex items-center justify-between gap-3 border ${
                        qty > 0 ? "border-[#6900AA] bg-[#F7E9FF]" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                            qty > 0 ? "bg-[#6900AA] text-white" : "bg-[#F7E9FF] text-[#6900AA]"
                          }`}
                        >
                          <TypeIcon size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900">{t.ticket_type}</p>
                          <p className="text-sm font-semibold text-slate-800 mt-0.5">
                            {formatMoney(Number(t.price) || 0, { compact: true })}
                          </p>
                          <p className={`text-xs font-medium mt-0.5 ${status.className}`}>{status.label}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={qty <= 0}
                          onClick={() => setQty(t.id, qty - 1, available)}
                          className="w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-6 text-center font-bold text-slate-800">{qty}</span>
                        <button
                          type="button"
                          disabled={qty >= available}
                          onClick={() => setQty(t.id, qty + 1, available)}
                          className="w-8 h-8 rounded-full bg-[#6900AA] text-white flex items-center justify-center disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {step === 3 && (
            <form id="event-checkout-form" onSubmit={handleConfirm} className="space-y-5">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-semibold text-slate-800 mb-1.5 block">Full Name</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={`w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none ${accentFocus} text-slate-800`}
                      placeholder="Enter your full name"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-800 mb-1.5 block">Phone Number</label>
                  <div className={`flex items-center gap-2 border border-slate-200 rounded-xl px-3 bg-white ${accentFocus}`}>
                    <Phone size={16} className="text-slate-400 shrink-0" />
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 shrink-0">
                      +251
                      <ChevronDown size={12} className="text-slate-400" />
                    </span>
                    <span className="w-px h-5 bg-slate-200 shrink-0" />
                    <input
                      required
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
                      inputMode="numeric"
                      maxLength={12}
                      className="flex-1 bg-transparent py-3 text-sm focus:outline-none text-slate-800 min-w-0"
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-800 mb-1.5 block">Email Address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none ${accentFocus} text-slate-800`}
                      placeholder="Enter your email address"
                    />
                  </div>
                </div>
                {isOrganizer ? (
                  <p className="text-xs text-slate-500">Enter the attendee&apos;s information.</p>
                ) : (
                  authUser?.role !== "customer" && (
                    <p className="text-xs text-slate-500">
                      Booking as guest.{" "}
                      <Link href="/login" className="text-[#6900AA] font-semibold hover:underline">
                        Log in
                      </Link>{" "}
                      to save this booking to My Bookings.
                    </p>
                  )
                )}
                {!isOrganizer && (
                  <div className="space-y-2 pt-1">
                    <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sendUpdates}
                        onChange={(e) => setSendUpdates(e.target.checked)}
                        className="mt-0.5 accent-[#6900AA]"
                      />
                      Send me updates about this event.
                    </label>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                <p className="text-sm font-bold text-slate-900">Your Booking Summary</p>
                <div className="flex gap-3">
                  {poster ? (
                    <img src={poster} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-slate-200 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-extrabold text-slate-900 uppercase text-sm leading-tight">{event.name}</p>
                    {selectedShowtime && (
                      <>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatDateTime12h(selectedShowtime.starts_at).replace(", ", " • ")}
                        </p>
                        <p className="text-xs text-slate-500">
                          {[selectedShowtime.venue_name, selectedShowtime.venue_address].filter(Boolean).join(", ")}
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {selectedLines.map((l) => (
                    <li key={l.id} className="flex justify-between text-sm text-slate-600">
                      <span>
                        {l.ticket_type} Ticket × {l.qty}
                      </span>
                      <span>{formatMoney(l.unit * l.qty)}</span>
                    </li>
                  ))}
                  <li className="flex justify-between text-sm text-slate-600">
                    <span>Convenience Fee{conveniencePct ? ` (${conveniencePct}%)` : ""}</span>
                    <span>{formatMoney(convenienceFee)}</span>
                  </li>
                </ul>
                {!isOrganizer && (
                  <div className="space-y-2">
                    {appliedPromo ? (
                      <div className="flex items-center justify-between gap-2 bg-[#F7E9FF] border border-[#E3BCFF] rounded-xl px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#6900AA] truncate">
                            {appliedPromo.promo_code} · {appliedPromo.title}
                          </p>
                          <p className="text-[11px] text-[#57008E]">
                            You save {formatMoney(appliedPromo.discount_amount)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemovePromo}
                          className="text-xs font-semibold text-[#6900AA] hover:underline shrink-0 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={promoInput}
                          onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                          placeholder="Promo code"
                          className={`flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none ${accentFocus} text-slate-800 font-semibold uppercase`}
                        />
                        <button
                          type="button"
                          onClick={handleApplyPromo}
                          disabled={validatingPromo || !promoInput.trim()}
                          className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 shrink-0 cursor-pointer"
                        >
                          {validatingPromo ? <Loader2 size={14} className="animate-spin" /> : "Apply"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-[#57008E]">
                    <span>Promo discount</span>
                    <span>−{formatMoney(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t border-dashed border-slate-200 pt-3">
                  <span className="font-semibold text-slate-800">Total Amount</span>
                  <span className="text-lg font-extrabold text-[#6900AA]">{formatMoney(grandTotal)}</span>
                </div>
              </div>
            </form>
          )}
        </div>

        <div className="p-5 border-t border-slate-100 bg-white shrink-0">
          {step === 1 && (
            <>
              <button
                type="button"
                disabled={!showtimeId}
                onClick={() => setStep(2)}
                className={`w-full py-3.5 rounded-xl ${accentBtn} disabled:bg-[#E3BCFF] disabled:text-white disabled:hover:bg-[#E3BCFF] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed`}
              >
                Continue
                <ChevronRight size={16} />
              </button>
              <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Shield size={11} className="text-[#6900AA]" /> 100% Secure
                </span>
                <span className="inline-flex items-center gap-1">
                  <Zap size={11} className="text-[#6900AA]" /> Instant Confirmation
                </span>
                <span className="inline-flex items-center gap-1">
                  <Headphones size={11} className="text-[#6900AA]" /> 24/7 Support
                </span>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              {ticketQty > 0 && (
                <div className="rounded-xl bg-slate-50 px-4 py-3 mb-3 text-sm space-y-1.5">
                  {selectedLines.map((l) => (
                    <div key={l.id} className="flex justify-between text-slate-600">
                      <span>
                        {l.ticket_type} Ticket × {l.qty}
                      </span>
                      <span>{formatMoney(l.unit * l.qty)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-slate-600">
                    <span>Convenience Fee{conveniencePct ? ` (${conveniencePct}%)` : ""}</span>
                    <span>{formatMoney(convenienceFee)}</span>
                  </div>
                  <div className="flex justify-between font-bold pt-1">
                    <span>Total Amount</span>
                    <span className="text-[#6900AA]">{formatMoney(grandTotal)}</span>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm inline-flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  type="button"
                  disabled={ticketQty < 1}
                  onClick={() => setStep(3)}
                  className={`flex-1 py-3 rounded-xl ${accentBtn} disabled:bg-[#E3BCFF] disabled:text-white disabled:hover:bg-[#E3BCFF] text-white font-semibold text-sm inline-flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed`}
                >
                  Continue
                  <ChevronRight size={16} />
                </button>
              </div>
            </>
          )}
          {step === 3 && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm inline-flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <button
                type="submit"
                form="event-checkout-form"
                disabled={!canPay}
                className={`flex-1 py-3 rounded-xl ${accentBtn} disabled:bg-[#E3BCFF] disabled:text-white disabled:hover:bg-[#E3BCFF] disabled:opacity-100 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed`}
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                Pay {formatMoney(grandTotal)}
              </button>
            </div>
          )}
        </div>
      </div>
  );

  if (isPage) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#F7F7F8] py-4 sm:py-6 px-3 sm:px-4 pb-8">
        {panel}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close checkout"
        onClick={onClose}
      />
      {panel}
    </div>
  );
}
