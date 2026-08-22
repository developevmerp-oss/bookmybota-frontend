"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Crown,
  Languages,
  Loader2,
  Mic2,
  Minus,
  Plus,
  Shield,
  Star,
  Ticket,
  User,
  Users,
  X,
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
import CustomerAuthModal from "@/components/Shared/CustomerAuthModal";
import images from "@/Images";

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
  { n: 1, label: "Venue", short: "Venue" },
  { n: 2, label: "Ticket", short: "Ticket" },
  { n: 3, label: "Registration", short: "Registration" },
  { n: 4, label: "Review & Proceed to Pay", short: "Pay" },
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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [expandedCity, setExpandedCity] = useState<string>("");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mTicketModalOpen, setMTicketModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [cancelTxnOpen, setCancelTxnOpen] = useState(false);
  const [cancelTxnAction, setCancelTxnAction] = useState<"back" | "exit">("back");
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
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
    setTermsAccepted(false);
    setAuthModalOpen(false);
    setExpandedCity("");
    setMTicketModalOpen(false);
    setContactModalOpen(false);
    setCancelTxnOpen(false);
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

  const cityVenueGroups = useMemo(() => {
    type Show = (typeof showtimes)[number];
    type VenueBucket = { venueKey: string; venueName: string; address?: string; showtimes: Show[] };
    const cityMap = new Map<string, Map<string, VenueBucket>>();

    for (const s of showtimes) {
      const city = (s.city_name || "").trim() || "Other";
      const venueName = (s.venue_name || "").trim() || "Venue TBA";
      const address = (s.venue_address || "").trim();
      const venueKey = `${venueName}|${address}`;
      if (!cityMap.has(city)) cityMap.set(city, new Map());
      const venues = cityMap.get(city)!;
      if (!venues.has(venueKey)) {
        venues.set(venueKey, { venueKey, venueName, address: address || undefined, showtimes: [] });
      }
      venues.get(venueKey)!.showtimes.push(s);
    }

    return [...cityMap.entries()]
      .map(([city, venues]) => ({
        city,
        venues: [...venues.values()].map((v) => ({
          ...v,
          showtimes: [...v.showtimes].sort(
            (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
          ),
        })),
      }))
      .sort((a, b) => a.city.localeCompare(b.city));
  }, [showtimes]);

  useEffect(() => {
    if (!open) return;
    const first = cityVenueGroups[0]?.city || "";
    if (first) setExpandedCity(first);
  }, [open, event.id, cityVenueGroups]);

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
  const convenienceFee = moneySum([(ticketAmount * conveniencePct) / 100]);
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

  const requestLeavePayStep = (action: "back" | "exit") => {
    setCancelTxnAction(action);
    setCancelTxnOpen(true);
  };

  const confirmCancelTransaction = () => {
    setCancelTxnOpen(false);
    if (cancelTxnAction === "exit") {
      onClose();
      return;
    }
    setStep(3);
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
        ...(phone.trim() ? { guest_phone: sanitizePhoneInput(phone) } : {}),
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
    step === 1
      ? "Select Venue"
      : step === 2
        ? "Select Tickets"
        : step === 3
          ? "Registration"
          : "Review & Pay";
  const stepSubtitle =
    step === 1
      ? "Choose a city and venue for your event."
      : step === 2
        ? "You can add tickets based on availability."
        : step === 3
          ? "Please fill all mandatory details for registration."
          : "Confirm your booking summary and pay securely.";
  const detailsReady =
    Boolean(name.trim()) &&
    !getPhoneValidationError(phone) &&
    Boolean(email.trim()) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    (isOrganizer || termsAccepted);
  const canPay = detailsReady && !submitting;
  const hasReservedSeats = Boolean(activeLayoutData?.data?.seats?.length);
  const isCustomerLoggedIn = authUser?.role === "customer";

  const showtimeSummaryBar =
    selectedShowtime && step >= 2 ? (
      <div className="bg-[#E8ECF0] border-y border-slate-200/80">
        <div
          className={`${
            isPage ? "max-w-[36rem] mx-auto" : ""
          } px-3 sm:px-4 py-2.5 text-[0.9375rem] sm:text-[1rem] font-semibold text-slate-700 text-center leading-snug`}
        >
          <span>{selectedShowtime.venue_name || "Venue"}</span>
          <span className="mx-1.5 text-slate-400">|</span>
          <span>
            {dateChip(selectedShowtime.starts_at).day} {dateChip(selectedShowtime.starts_at).date} |{" "}
            {formatTime12h(selectedShowtime.starts_at)}
          </span>
          {ticketQty > 0 && (
            <>
              <span className="mx-1.5 text-slate-400">|</span>
              <span className="uppercase tracking-wide text-slate-600">Entry for {ticketQty}</span>
            </>
          )}
        </div>
      </div>
    ) : null;

  const pageStepper = (
    <div className="border-t border-slate-100 bg-white">
      <div className="max-w-[40rem] mx-auto px-3 sm:px-6 py-3 sm:py-3.5">
        <ol className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
          {CHECKOUT_STEPS.map((s, i) => {
            const done = step > s.n;
            const active = step === s.n;
            return (
              <li key={s.n} className="flex items-center gap-1 sm:gap-2 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <span
                    className={`h-6 w-6 sm:h-7 sm:w-7 rounded-full flex items-center justify-center text-[0.875rem] font-bold shrink-0 ${
                      done
                        ? "bg-[#6900AA] text-white"
                        : active
                          ? "bg-slate-900 text-white"
                          : "bg-white border border-slate-300 text-slate-400"
                    }`}
                  >
                    {done ? <Check size={12} strokeWidth={3} /> : s.n}
                  </span>
                  <span
                    className={`text-[0.8125rem] sm:text-[0.9375rem] font-semibold leading-tight truncate max-w-[4.5rem] sm:max-w-none ${
                      active || done ? "text-slate-900" : "text-slate-400"
                    }`}
                  >
                    <span className="sm:hidden">{s.short}</span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </span>
                </div>
                {i < CHECKOUT_STEPS.length - 1 && (
                  <ChevronRight size={14} className="text-slate-300 shrink-0 mx-0.5 sm:mx-1" aria-hidden />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );

  const selectShowtime = (s: (typeof showtimes)[number]) => {
    setShowtimeId(s.id);
    setSelectedDateKey(dateKey(s.starts_at));
  };

  const showtimeFillingLabel = (s: (typeof showtimes)[number]) => {
    const types =
      Array.isArray(s.ticket_types) && s.ticket_types.length > 0
        ? s.ticket_types
        : ticketTypes;
    const total = types.reduce((sum, t) => sum + (Number(t.total_count) || 0), 0);
    const available = types.reduce((sum, t) => sum + (Number(t.available_count) || 0), 0);
    return ticketAvail(available, total);
  };

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
            ? "relative w-full flex flex-col min-h-screen"
            : "relative h-full w-full max-w-[26.25rem] bg-white shadow-2xl flex flex-col"
        }
      >
        {isPage && (
          <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shrink-0">
            <div className="relative h-[4.75rem] sm:h-[5.25rem] flex items-center px-3 sm:px-5">
              <Link href="/" className="absolute left-3 sm:left-5 shrink-0 flex items-center z-[1]">
                <img
                  src={typeof images.logo === "string" ? images.logo : images.logo.src}
                  alt="Book My Bota"
                  className="h-[3.75rem] sm:h-[4.5rem] w-auto max-w-[16rem] sm:max-w-[20rem] object-contain object-left"
                />
              </Link>
              <div className="w-full max-w-[36rem] mx-auto px-12 sm:px-16 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => (step === 4 ? requestLeavePayStep("exit") : onClose())}
                  aria-label="Back to event"
                  className="h-9 w-9 rounded-full text-slate-700 flex items-center justify-center hover:bg-slate-100 cursor-pointer shrink-0"
                >
                  <ArrowLeft size={18} />
                </button>
                <p className="min-w-0 flex-1 text-[1.0625rem] sm:text-[1.1875rem] font-bold text-slate-900 truncate text-center sm:text-left">
                  {event.name}
                </p>
              </div>
            </div>
            {pageStepper}
          </div>
        )}

        {isPage && step >= 2 && showtimeSummaryBar}

        {!isPage && (
          <div className="px-5 pt-4 pb-4 border-b border-slate-100 shrink-0 bg-white">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[1.1875rem] font-extrabold tracking-tight leading-none">
                <span className="text-[#111111]">Book My </span>
                <span className="text-[#6900AA]">Bota</span>
              </p>
              <span className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-slate-500">
                <Shield size={12} className="text-[#6900AA]" />
                Secure Booking
              </span>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 cursor-pointer"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>

            <p className="mt-4 text-[0.8125rem] font-bold uppercase tracking-[0.14em] text-slate-400">
              Step {step} of {CHECKOUT_STEPS.length}
              {isOrganizer ? " Â· Organizer sale" : ""}
            </p>

            <div className="mt-4 grid grid-cols-4 gap-1">
              {CHECKOUT_STEPS.map((s) => {
                const done = step > s.n;
                const active = step === s.n;
                return (
                  <div key={s.n} className="flex flex-col items-center min-w-0">
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[0.9375rem] font-bold ${
                        done || active
                          ? "bg-[#6900AA] text-white"
                          : "border-2 border-slate-200 text-slate-400 bg-white"
                      }`}
                    >
                      {done ? <Check size={14} strokeWidth={3} /> : s.n}
                    </span>
                    <span
                      className={`mt-1.5 text-[0.75rem] font-semibold text-center leading-tight ${
                        active || done ? "text-slate-900" : "text-slate-400"
                      }`}
                    >
                      {s.short}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div
          className={
            isPage
              ? "flex-1 w-full max-w-[36rem] mx-auto px-4 sm:px-5 py-5 sm:py-6 pb-[5.5rem]"
              : "flex-1 overflow-y-auto px-5 py-5 bg-white"
          }
        >
          {(step !== 3 || !isPage) && (
            <div className="mb-5">
              <h3 className="text-[1.4375rem] sm:text-[1.6875rem] font-bold text-slate-900 tracking-tight">
                {stepTitle}
              </h3>
              <p className="text-[1rem] sm:text-[1.0625rem] text-slate-500 mt-1.5 leading-relaxed">
                {stepSubtitle}
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              {cityVenueGroups.length === 0 ? (
                <p className="text-[1rem] text-slate-500">Showtimes coming soon.</p>
              ) : (
                cityVenueGroups.map(({ city, venues }) => {
                  const openCity = expandedCity === city;
                  return (
                    <div
                      key={city}
                      className={`rounded-[0.75rem] border overflow-hidden ${
                        openCity ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50/70"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedCity(openCity ? "" : city)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left cursor-pointer hover:bg-slate-50"
                      >
                        <span className="text-[1.125rem] font-bold text-slate-900">{city}</span>
                        {openCity ? (
                          <ChevronUp size={18} className="text-slate-500 shrink-0" />
                        ) : (
                          <ChevronDown size={18} className="text-slate-500 shrink-0" />
                        )}
                      </button>
                      {openCity && (
                        <div className="px-3 pb-3 space-y-2.5 border-t border-slate-100 pt-3">
                          {venues.map((venue) =>
                            venue.showtimes.map((s) => {
                              const active = showtimeId === s.id;
                              const status = showtimeFillingLabel(s);
                              const chip = dateChip(s.starts_at);
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => selectShowtime(s)}
                                  className={`w-full text-left rounded-[0.625rem] border px-3.5 py-3 cursor-pointer transition-colors ${
                                    active
                                      ? "border-[#6900AA] bg-[#FBF6FF]"
                                      : "border-slate-200 bg-white hover:border-slate-300"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-[1.0625rem] font-bold text-slate-900">
                                      {venue.venueName}
                                    </p>
                                    {active && (
                                      <span className="shrink-0 h-5 w-5 rounded-full bg-[#6900AA] text-white flex items-center justify-center">
                                        <Check size={12} strokeWidth={3} />
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 text-[0.9375rem] text-slate-500">
                                    {chip.date}
                                    <span className="mx-1.5 text-slate-300">|</span>
                                    {formatTime12h(s.starts_at)}
                                    {status.label === "Few Left" && (
                                      <>
                                        <span className="mx-1.5 text-slate-300">|</span>
                                        <span className="text-[#E85D04] font-semibold">Fast Filling</span>
                                      </>
                                    )}
                                    {status.label === "Sold Out" && (
                                      <>
                                        <span className="mx-1.5 text-slate-300">|</span>
                                        <span className="text-red-500 font-semibold">Sold Out</span>
                                      </>
                                    )}
                                  </p>
                                  {venue.address && (
                                    <p className="mt-1 text-[0.875rem] text-slate-400 line-clamp-1">
                                      {venue.address}
                                    </p>
                                  )}
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {infoItems.length > 0 && (
                <div className="pt-3 mt-1 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-100">
                  {infoItems.map((item) => (
                    <div key={item.label} className="flex flex-col items-center text-center gap-1.5 py-1">
                      <span className="w-10 h-10 rounded-full bg-[#F7E9FF] text-[#6900AA] flex items-center justify-center">
                        <item.icon size={16} />
                      </span>
                      <p className="text-[0.875rem] sm:text-[0.9375rem] font-bold text-slate-900 leading-tight px-0.5">
                        {item.value}
                      </p>
                      <p className="text-[0.75rem] sm:text-[0.8125rem] text-slate-400">{item.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {selectedShowtime && !isPage && (
                <div className="rounded-[0.5rem] bg-slate-100 px-3.5 py-2.5 text-[0.9375rem] sm:text-[1rem] text-slate-700">
                  <span className="font-semibold">{selectedShowtime.venue_name || "Venue"}</span>
                  <span className="mx-1.5 text-slate-400">|</span>
                  <span>
                    {dateChip(selectedShowtime.starts_at).day}{" "}
                    {dateChip(selectedShowtime.starts_at).date} | {formatTime12h(selectedShowtime.starts_at)}
                  </span>
                </div>
              )}

              {hasReservedSeats ? (
                <div className="bg-white border border-slate-200 rounded-xl p-5 text-center space-y-4">
                  <div>
                    <h4 className="text-[1.1875rem] font-extrabold text-slate-900">Select seats</h4>
                    <p className="mt-1 text-[0.9375rem] text-slate-500">
                      Reserved seating â€” pick your seats on the map
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMapFullscreen(true)}
                    className={`w-full py-3 ${accentBtn} text-white text-[1.0625rem] font-bold rounded-xl cursor-pointer`}
                  >
                    {selectedSeats.length > 0 ? "Edit Seating Map" : "Open Seating Map"}
                  </button>
                  {selectedSeats.length > 0 && (
                    <p className={`text-[1rem] font-bold ${accentIcon}`}>
                      {selectedSeats.length} seat{selectedSeats.length === 1 ? "" : "s"} selected Â·{" "}
                      {formatMoney(ticketAmount, { compact: true })}
                    </p>
                  )}
                  {isMapFullscreen && (
                    <div className="fixed inset-0 z-[100] bg-[#F5F5F5] flex flex-col overflow-hidden">
                      <div className="shrink-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setIsMapFullscreen(false)}
                          className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 cursor-pointer hover:bg-slate-50"
                          aria-label="Close seating map"
                        >
                          <X size={18} />
                        </button>
                        <div className="min-w-0 flex-1 text-left">
                          <h3 className="font-bold text-[1.125rem] text-slate-900 truncate">{event.name}</h3>
                          <p className="text-[0.875rem] text-slate-500 truncate">
                            {[selectedShowtime?.venue_name, selectedShowtime?.starts_at ? formatTime12h(selectedShowtime.starts_at) : ""]
                              .filter(Boolean)
                              .join(" Â· ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex-1 overflow-hidden relative flex flex-col p-2 sm:p-4">
                        <VenueLayoutViewer
                          layoutData={activeLayoutData}
                          ticketTypes={ticketTypes}
                          onSeatsSelected={setSelectedSeats}
                          initialSelectedSeats={selectedSeats}
                        />
                      </div>
                      <div className="shrink-0 p-4 border-t border-slate-200 bg-white flex items-center gap-3">
                        <div className="min-w-0 flex-1 text-left">
                          <p className="text-[0.9375rem] text-slate-500">
                            {selectedSeats.length} seat{selectedSeats.length === 1 ? "" : "s"} selected
                          </p>
                          <p className="text-[1.1875rem] font-extrabold text-slate-900">
                            {formatMoney(ticketAmount, { compact: true })}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={selectedSeats.length < 1}
                          onClick={() => setIsMapFullscreen(false)}
                          className={`px-5 py-2.5 ${accentBtn} text-white font-bold text-[1.0625rem] rounded-xl cursor-pointer disabled:bg-[#E3BCFF] disabled:cursor-not-allowed`}
                        >
                          Continue
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : ticketTypes.length === 0 ? (
                <p className="text-[1rem] text-slate-500">No ticket types yet.</p>
              ) : (
                <div className="space-y-3">
                  {ticketTypes.map((t) => {
                    const available = Number(t.available_count) || 0;
                    const total = Number(t.total_count) || 0;
                    const qty = qtyByType[t.id] || 0;
                    const status = ticketAvail(available, total);
                    const soldOut = available <= 0;
                    return (
                      <div
                        key={t.id}
                        className={`rounded-[0.75rem] px-4 py-3.5 flex items-center justify-between gap-3 bg-white shadow-[0_0.125rem_0.75rem_rgba(15,23,42,0.06)] border ${
                          qty > 0
                            ? "border-[#6900AA]"
                            : soldOut
                              ? "border-slate-100 opacity-60"
                              : "border-transparent"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-[1.0625rem] sm:text-[1.125rem] text-slate-900 uppercase tracking-wide">
                            {t.ticket_type}
                          </p>
                          <p className="mt-1.5 text-[1.0625rem] sm:text-[1.125rem] font-extrabold text-slate-900">
                            {formatMoney(Number(t.price) || 0, { compact: true })}
                            {status.label === "Few Left" && (
                              <span className="ml-2.5 text-[0.9375rem] font-semibold text-[#E85D04] normal-case">
                                Fast Filling
                              </span>
                            )}
                            {soldOut && (
                              <span className="ml-2.5 text-[0.9375rem] font-semibold text-[#E11D48] normal-case">
                                Sold out
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {soldOut ? null : qty === 0 ? (
                            <button
                              type="button"
                              onClick={() => setQty(t.id, 1, available)}
                              className="min-w-[4.75rem] px-3.5 py-2 rounded-[0.375rem] border-2 border-[#6900AA] text-[#6900AA] text-[1rem] font-bold cursor-pointer hover:bg-[#F7E9FF] transition-colors"
                            >
                              Add
                            </button>
                          ) : (
                            <div className="flex items-center gap-0 rounded-[0.375rem] border-2 border-[#6900AA] overflow-hidden bg-white">
                              <button
                                type="button"
                                onClick={() => setQty(t.id, qty - 1, available)}
                                className="w-9 h-9 flex items-center justify-center text-[#6900AA] cursor-pointer hover:bg-[#F7E9FF]"
                              >
                                <Minus size={15} />
                              </button>
                              <span className="w-8 text-center font-bold text-[1.0625rem] text-slate-900">
                                {qty}
                              </span>
                              <button
                                type="button"
                                disabled={qty >= available}
                                onClick={() => setQty(t.id, qty + 1, available)}
                                className="w-9 h-9 flex items-center justify-center text-[#6900AA] cursor-pointer hover:bg-[#F7E9FF] disabled:opacity-40"
                              >
                                <Plus size={15} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <form
              id="event-checkout-details-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (detailsReady) setStep(4);
              }}
              className="space-y-5"
            >
              {isPage && (
                <p className="text-[1.0625rem] text-slate-600">
                  Please fill all mandatory details for registration.
                </p>
              )}
              <div className="space-y-4">
                <div>
                  <label className="text-[1rem] font-semibold text-slate-800 mb-1.5 block">
                    <span className="text-[#E11D48]">*</span> Name
                  </label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`w-full bg-white border border-slate-300 rounded-[0.375rem] px-3.5 py-2.5 text-[1.0625rem] focus:outline-none focus:border-[#6900AA] focus:ring-1 focus:ring-[#6900AA]/25 text-slate-800`}
                    placeholder="Enter name"
                  />
                </div>
                <div>
                  <label className="text-[1rem] font-semibold text-slate-800 mb-1.5 block">
                    <span className="text-[#E11D48]">*</span> Phone Number
                  </label>
                  <div className="flex items-center gap-2 border border-slate-300 rounded-[0.375rem] px-3 bg-white focus-within:border-[#6900AA] focus-within:ring-1 focus-within:ring-[#6900AA]/25">
                    <span className="inline-flex items-center gap-1 text-[1rem] font-semibold text-slate-700 shrink-0">
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
                      className="flex-1 bg-transparent py-2.5 text-[1.0625rem] focus:outline-none text-slate-800 min-w-0"
                      placeholder="Phone number"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[1rem] font-semibold text-slate-800 mb-1.5 block">
                    <span className="text-[#E11D48]">*</span> Email ID
                  </label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full bg-white border border-slate-300 rounded-[0.375rem] px-3.5 py-2.5 text-[1.0625rem] focus:outline-none focus:border-[#6900AA] focus:ring-1 focus:ring-[#6900AA]/25 text-slate-800`}
                    placeholder="Enter email"
                  />
                </div>
                {isOrganizer ? (
                  <p className="text-[0.875rem] text-slate-500">Enter the attendee&apos;s information.</p>
                ) : (
                  authUser?.role !== "customer" && (
                    <p className="text-[0.875rem] text-slate-500">
                      Booking as guest.{" "}
                      <Link href="/login" className="text-[#6900AA] font-semibold hover:underline">
                        Log in
                      </Link>{" "}
                      to save this booking to My Bookings.
                    </p>
                  )
                )}
                {!isOrganizer && (
                  <label className="flex items-start gap-2.5 text-[1rem] text-slate-700 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[#6900AA] cursor-pointer"
                    />
                    <span>
                      I agree to the{" "}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          toast.message("Tickets are non-transferable and subject to event terms.");
                        }}
                        className="text-[#6900AA] font-semibold hover:underline cursor-pointer"
                      >
                        Terms and Conditions
                      </button>
                      . <span className="text-[#E11D48]">*</span>
                    </span>
                  </label>
                )}
                {!isOrganizer && (
                  <label className="flex items-start gap-2.5 text-[0.9375rem] text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendUpdates}
                      onChange={(e) => setSendUpdates(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[#6900AA] cursor-pointer"
                    />
                    Send me updates about this event.
                  </label>
                )}
              </div>
            </form>
          )}

          {step === 4 && (
            <form id="event-checkout-form" onSubmit={handleConfirm} className="space-y-4">
              <aside
                className={`overflow-hidden ${
                  isPage ? "" : "rounded-[0.75rem] border border-slate-200 bg-white shadow-sm"
                }`}
              >
                <div className="p-4 border-b border-slate-100">
                  <p className="text-[1.0625rem] sm:text-[1.125rem] font-extrabold text-slate-900 leading-snug">
                    {event.name}
                  </p>
                  {selectedShowtime && (
                    <p className="mt-1.5 text-[0.875rem] sm:text-[0.9375rem] text-slate-500 leading-relaxed">
                      {formatDateTime12h(selectedShowtime.starts_at).replace(", ", " | ")}
                      {event.language
                        ? ` | ${parseEventLanguages(event.language).join(", ") || event.language}`
                        : ""}
                      <br />
                      {[selectedShowtime.venue_name, selectedShowtime.venue_address]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                </div>

                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-[0.9375rem] text-slate-700 min-w-0">
                    <Ticket size={14} className="text-[#6900AA] shrink-0" />
                    <span>
                      Ticket Mode: <strong>M-Ticket ({ticketQty})</strong>
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setMTicketModalOpen(true)}
                    className="shrink-0 text-[0.9375rem] font-semibold text-[#6900AA] cursor-pointer hover:underline"
                  >
                    Details
                  </button>
                </div>

                <div className="px-4 py-3 space-y-2 border-b border-slate-100">
                  <div className="flex justify-between text-[0.9375rem] text-slate-600">
                    <span>Ticket(s) price</span>
                    <span className="font-semibold text-slate-900">{formatMoney(ticketAmount)}</span>
                  </div>
                  <div className="flex justify-between text-[0.9375rem] text-slate-600">
                    <span>Convenience fees{conveniencePct ? ` (${conveniencePct}%)` : ""}</span>
                    <span className="font-semibold text-slate-900">{formatMoney(convenienceFee)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-[0.9375rem] text-[#57008E]">
                      <span>Promo discount</span>
                      <span className="font-semibold">âˆ’{formatMoney(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[1rem] font-bold text-slate-900 pt-2 border-t border-dashed border-slate-200">
                    <span>Order total</span>
                    <span>{formatMoney(grandTotal)}</span>
                  </div>
                </div>

                {!isOrganizer && (
                  <div className="px-4 py-3 border-b border-slate-100 space-y-2">
                    {appliedPromo ? (
                      <div className="flex items-center justify-between gap-2 bg-[#F7E9FF] border border-[#E3BCFF] rounded-xl px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-[0.875rem] font-bold text-[#6900AA] truncate">
                            {appliedPromo.promo_code} · {appliedPromo.title}
                            {appliedPromo.source === "platform" && (
                              <span className="ml-1.5 text-[0.65rem] font-bold uppercase tracking-wide bg-[#6900AA] text-white px-1.5 py-0.5 rounded">
                                BookMyBota
                              </span>
                            )}
                          </p>
                          <p className="text-[0.8125rem] text-[#57008E]">
                            You save {formatMoney(appliedPromo.discount_amount)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemovePromo}
                          className="text-[0.875rem] font-semibold text-[#6900AA] hover:underline shrink-0 cursor-pointer"
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
                          className={`flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[0.9375rem] focus:outline-none ${accentFocus} text-slate-800 font-semibold uppercase`}
                        />
                        <button
                          type="button"
                          onClick={handleApplyPromo}
                          disabled={validatingPromo || !promoInput.trim()}
                          className="px-3 py-2 rounded-xl border border-slate-200 text-[0.9375rem] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 shrink-0 cursor-pointer"
                        >
                          {validatingPromo ? <Loader2 size={14} className="animate-spin" /> : "Apply"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="px-4 py-3 border-b border-slate-100">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-[0.9375rem] font-bold text-slate-900">For sending booking details</p>
                    <button
                      type="button"
                      onClick={() => {
                        setEditName(name);
                        setEditPhone(phone);
                        setEditEmail(email);
                        setContactModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 text-[0.875rem] font-semibold text-[#6900AA] cursor-pointer hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                  <p className="text-[0.875rem] text-slate-600">{phone ? `+251 ${phone}` : "â€”"}</p>
                  <p className="text-[0.875rem] text-slate-600 truncate">{email || "â€”"}</p>
                </div>

                <div className="px-4 py-3.5 bg-slate-50 flex items-center justify-between gap-3">
                  <span className="text-[1rem] font-semibold text-slate-800">Amount Payable</span>
                  <span className="text-[1.25rem] font-extrabold text-slate-900">
                    {formatMoney(grandTotal)}
                  </span>
                </div>
              </aside>
            </form>
          )}
        </div>

        <div
          className={
            isPage
              ? "fixed bottom-0 inset-x-0 z-20 bg-[#F0F0F0] border-t border-slate-200 px-4 pt-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]"
              : "p-5 border-t border-slate-100 bg-white shrink-0"
          }
        >
          <div className={isPage ? "max-w-[36rem] mx-auto" : ""}>
          {step === 1 && (
            <>
              <button
                type="button"
                disabled={!showtimeId}
                onClick={() => {
                  setStep(2);
                  if (hasReservedSeats) setIsMapFullscreen(true);
                }}
                className={`w-full py-3.5 rounded-[0.5rem] ${accentBtn} disabled:bg-slate-300 disabled:text-white disabled:hover:bg-slate-300 text-white font-semibold text-[1.0625rem] inline-flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed`}
              >
                Continue
                <ChevronRight size={16} />
              </button>
            </>
          )}
          {step === 2 && (
            <>
              {ticketQty > 0 && (
                <div className="mb-2.5 flex items-end justify-end gap-3">
                  <div className="min-w-0 text-right">
                    <p className="text-[0.9375rem] text-slate-500">
                      {ticketQty} Ticket{ticketQty === 1 ? "" : "s"}
                    </p>
                    <p className="text-[1.25rem] font-extrabold text-slate-900">
                      {formatMoney(grandTotal, { compact: true })}
                    </p>
                  </div>
                </div>
              )}
              {isPage ? (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-3 rounded-[0.5rem] border border-slate-300 bg-white text-slate-700 font-semibold text-[1rem] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                  {!isOrganizer && !isCustomerLoggedIn ? (
                    <button
                      type="button"
                      disabled={ticketQty < 1}
                      onClick={() => setAuthModalOpen(true)}
                      className={`flex-1 py-3 rounded-[0.5rem] ${accentBtn} disabled:bg-slate-300 disabled:text-white disabled:hover:bg-slate-300 text-white font-semibold text-[1.0625rem] cursor-pointer disabled:cursor-not-allowed`}
                    >
                      Login To Book
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={ticketQty < 1}
                      onClick={() => setStep(3)}
                      className={`flex-1 py-3 rounded-[0.5rem] ${accentBtn} disabled:bg-slate-300 disabled:text-white disabled:hover:bg-slate-300 text-white font-semibold text-[1.0625rem] cursor-pointer disabled:cursor-not-allowed`}
                    >
                      Proceed
                    </button>
                  )}
                </div>
              ) : (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-[1rem] inline-flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                {!isOrganizer && !isCustomerLoggedIn ? (
                  <button
                    type="button"
                    disabled={ticketQty < 1}
                    onClick={() => setAuthModalOpen(true)}
                    className={`flex-1 py-3 rounded-xl ${accentBtn} disabled:bg-[#E3BCFF] disabled:text-white disabled:hover:bg-[#E3BCFF] text-white font-semibold text-[1.0625rem] inline-flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed`}
                  >
                    Login To Book
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={ticketQty < 1}
                    onClick={() => setStep(3)}
                    className={`flex-1 py-3 rounded-xl ${accentBtn} disabled:bg-[#E3BCFF] disabled:text-white disabled:hover:bg-[#E3BCFF] text-white font-semibold text-[1.0625rem] inline-flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed`}
                  >
                    Continue
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
              )}
              {!isOrganizer && !isCustomerLoggedIn && ticketQty >= 1 && (
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="mt-2 w-full text-center text-[0.9375rem] font-semibold text-[#6900AA] cursor-pointer hover:underline"
                >
                  Continue as guest
                </button>
              )}
            </>
          )}
          {step === 3 && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-[1rem] inline-flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <button
                type="submit"
                form="event-checkout-details-form"
                disabled={!detailsReady}
                className={`flex-1 py-3 rounded-xl ${
                  detailsReady
                    ? accentBtn
                    : "bg-slate-300 hover:bg-slate-300"
                } disabled:bg-slate-300 disabled:text-white disabled:hover:bg-slate-300 text-white font-semibold text-[1.0625rem] inline-flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed`}
              >
                {isPage ? "Submit" : "Continue"}
                {!isPage && <ChevronRight size={16} />}
              </button>
            </div>
          )}
          {step === 4 && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => requestLeavePayStep("back")}
                className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-[1rem] inline-flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <button
                type="submit"
                form="event-checkout-form"
                disabled={!canPay}
                className={`flex-1 py-3 rounded-xl ${accentBtn} disabled:bg-[#E3BCFF] disabled:text-white disabled:hover:bg-[#E3BCFF] disabled:opacity-100 text-white font-semibold text-[1.0625rem] inline-flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed`}
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                Pay {formatMoney(grandTotal)}
              </button>
            </div>
          )}
          </div>
        </div>
      </div>
  );

  const mTicketSubtitle =
    selectedLines.length > 0
      ? selectedLines
          .map((l) => `${String(l.ticket_type || "Ticket").toUpperCase()} (${l.qty} ticket(s))`)
          .join(", ")
      : `ENTRY FOR ${ticketQty} (${ticketQty} ticket(s))`;

  const saveContactDetails = () => {
    const phoneErr = getPhoneValidationError(editPhone);
    if (!editName.trim()) {
      toast.error(isOrganizer ? "Please enter the customer's name." : "Please enter your name.");
      return;
    }
    if (phoneErr) {
      toast.error(phoneErr);
      return;
    }
    if (!editEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())) {
      toast.error("Enter a valid email address.");
      return;
    }
    setName(editName.trim());
    setPhone(sanitizePhoneInput(editPhone));
    setEmail(editEmail.trim());
    setContactModalOpen(false);
  };

  const checkoutModals = (
    <>
      {mTicketModalOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50"
          onClick={() => setMTicketModalOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="m-ticket-title"
            className="relative w-full sm:max-w-[26rem] rounded-t-[1rem] sm:rounded-[0.75rem] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-slate-100">
              <div className="min-w-0">
                <h3 id="m-ticket-title" className="text-[1.4375rem] font-extrabold text-slate-800">
                  M-Ticket
                </h3>
                <p className="mt-1 text-[0.875rem] font-semibold uppercase tracking-wide text-slate-400">
                  {mTicketSubtitle}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setMTicketModalOpen(false)}
                className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer hover:bg-slate-200 shrink-0"
              >
                <X size={16} />
              </button>
            </div>
            <ul className="px-5 py-4 space-y-3 text-[1rem] text-slate-700 leading-relaxed list-disc pl-8 pb-6">
              <li>
                You can access your ticket(s) anytime from{" "}
                <span className="font-semibold text-slate-900">My Bookings</span> on Book My Bota
                (website or mobile).
              </li>
              <li>
                Please show the Entry QR from your booking confirmation / My Bookings at the venue
                gate â€” it is unique to this booking.
              </li>
              <li>
                No physical ticket(s) are required. A confirmation is also sent to your registered
                email.
              </li>
            </ul>
          </div>
        </div>
      )}

      {contactModalOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50"
          onClick={() => setContactModalOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-details-title"
            className="relative w-full sm:max-w-[26rem] max-h-[92vh] overflow-y-auto rounded-t-[1rem] sm:rounded-[0.75rem] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white flex items-center gap-2 px-3 sm:px-4 py-3.5 border-b border-slate-100 z-10">
              <button
                type="button"
                aria-label="Back"
                onClick={() => setContactModalOpen(false)}
                className="h-9 w-9 rounded-full flex items-center justify-center text-slate-700 cursor-pointer hover:bg-slate-50"
              >
                <ArrowLeft size={18} />
              </button>
              <h3
                id="contact-details-title"
                className="flex-1 text-center text-[1.1875rem] font-extrabold text-slate-900 pr-9"
              >
                Contact Details
              </h3>
            </div>

            <div className="px-5 py-5 space-y-5">
              <div>
                <label className="block text-[1rem] font-bold text-slate-900 mb-1.5">
                  <span className="text-[#6900AA]">*</span> Your name
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-[0.375rem] border border-slate-300 px-3 py-2.5 text-[1.0625rem] text-slate-900 focus:outline-none focus:border-[#6900AA] focus:ring-1 focus:ring-[#6900AA]/30"
                  placeholder="Full name"
                />
              </div>

              <div>
                <label className="block text-[1rem] font-bold text-slate-900 mb-1.5">
                  <span className="text-[#6900AA]">*</span> Your email
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-[0.375rem] border border-slate-300 px-3 py-2.5 text-[1.0625rem] text-slate-900 focus:outline-none focus:border-[#6900AA] focus:ring-1 focus:ring-[#6900AA]/30"
                  placeholder="you@email.com"
                />
                <p className="mt-1.5 text-[0.875rem] text-slate-500">
                  To access the ticket(s) on other devices, login with this email
                </p>
              </div>

              <div>
                <label className="block text-[1rem] font-bold text-slate-900 mb-1.5">
                  <span className="text-[#6900AA]">*</span> Mobile Number
                </label>
                <div className="flex items-center gap-2 rounded-[0.375rem] border border-slate-300 px-3 bg-white focus-within:border-[#6900AA] focus-within:ring-1 focus-within:ring-[#6900AA]/30">
                  <span className="inline-flex items-center gap-1 text-[1rem] font-semibold text-slate-700 shrink-0">
                    +251
                    <ChevronDown size={12} className="text-slate-400" />
                  </span>
                  <span className="w-px h-5 bg-slate-200 shrink-0" />
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(sanitizePhoneInput(e.target.value))}
                    inputMode="numeric"
                    maxLength={12}
                    className="flex-1 bg-transparent py-2.5 text-[1.0625rem] focus:outline-none text-slate-900 min-w-0"
                    placeholder="Mobile number"
                  />
                </div>
                <p className="mt-1.5 text-[0.875rem] text-slate-500">
                  This number will only be used for sending ticket(s)
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  toast.message("Tickets are non-transferable and subject to event terms.")
                }
                className="text-[1rem] font-semibold text-[#6900AA] hover:underline cursor-pointer"
              >
                *Terms &amp; Conditions
              </button>

              <button
                type="button"
                onClick={saveContactDetails}
                className={`w-full py-3 rounded-[0.5rem] ${accentBtn} text-white text-[1.125rem] font-bold cursor-pointer`}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelTxnOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-5 bg-black/45"
          onClick={() => setCancelTxnOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-txn-title"
            className="w-full max-w-[22rem] rounded-[0.75rem] bg-white shadow-2xl px-5 pt-6 pb-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="cancel-txn-title"
              className="text-center text-[1.25rem] font-extrabold text-slate-900"
            >
              Cancel Transaction?
            </h3>
            <p className="mt-3 text-center text-[1rem] text-slate-500 leading-relaxed">
              {hasReservedSeats
                ? "Your selected seats will be unblocked and may not be available later if you cancel."
                : "Your ticket selection may not be available later if you cancel."}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={confirmCancelTransaction}
                className="py-2.5 rounded-[0.5rem] border border-[#6900AA] text-[#6900AA] text-[1.0625rem] font-bold cursor-pointer hover:bg-[#F7E9FF]"
              >
                Yes, Cancel
              </button>
              <button
                type="button"
                onClick={() => setCancelTxnOpen(false)}
                className="py-2.5 rounded-[0.5rem] bg-[#6900AA] text-white text-[1.0625rem] font-bold cursor-pointer hover:bg-[#57008E]"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (isPage) {
    return (
      <>
        <div className="min-h-screen bg-[#F5F5F5]">{panel}</div>
        {checkoutModals}
        {!isOrganizer && (
          <CustomerAuthModal
            open={authModalOpen}
            onClose={() => setAuthModalOpen(false)}
            onSuccess={() => {
              dispatch(loadFromStorage());
              setAuthModalOpen(false);
              if (ticketQty >= 1) setStep(3);
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end">
        <button
          type="button"
          className="absolute inset-0 bg-slate-900/40"
          aria-label="Close checkout"
          onClick={() => (step === 4 ? requestLeavePayStep("exit") : onClose())}
        />
        {panel}
      </div>
      {checkoutModals}
      {!isOrganizer && (
        <CustomerAuthModal
          open={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={() => {
            dispatch(loadFromStorage());
            setAuthModalOpen(false);
            if (ticketQty >= 1) setStep(3);
          }}
        />
      )}
    </>
  );
}
