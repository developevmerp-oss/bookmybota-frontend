"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Crown,
  Gift,
  LayoutGrid,
  Loader2,
  Map as MapIcon,
  Maximize2,
  Minus,
  Plus,
  Shield,
  Smartphone,
  Star,
  Ticket,
  Timer,
  Truck,
  User,
  Banknote,
  CheckCircle2,
  Users,
  X,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import images from "@/Images";
import { useSelectedCity } from "@/lib/useSelectedCity";
import PaymentSuccessView from "@/components/Shared/PaymentSuccessView";
import {
  useCreateEventBookingMutation,
  useCreateEventSeatHoldMutation,
  useReleaseEventSeatHoldMutation,
  useGetCustomerProfileQuery,
  useGetMyGiftCardsQuery,
  usePreviewGiftCardRedeemMutation,
  useValidateEventPromoCodeMutation,
  type AppliedPromoOffer,
  type GiftCardRedeemPreview,
  useGetEventLayoutQuery,
  useGetPublicEventLayoutQuery,
  useGetPublicStadiumBlocksQuery,
  type OrganizerEvent,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { formatDateCustomer, formatTime12h, getVenueDateTimeParts, venueDateStr } from "@/lib/dateFormat";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { extractApiError } from "@/lib/apiErrors";
import { formatMoney } from "@/lib/currencyFormat";
import { parseEventLanguages } from "@/lib/eventValidation";
import { sanitizePhoneInput } from "@/lib/validation";
import { isGiftCardSpendable } from "@/lib/giftCardOwnership";
import { resolveHoldExpiresAt } from "@/lib/holdCountdown";
import { pickContiguousBlock } from "@/lib/bmsSeatAutoSelect";
import {
  emptyEventCheckoutContactValues,
  emptyEventCheckoutDeliveryValues,
  eventCheckoutContactSchema,
  eventCheckoutDeliverySchema,
  type EventCheckoutContactValues,
  type EventCheckoutDeliveryValues,
} from "@/lib/eventCheckoutFormSchema";
import {
  ticketModeConfirmNote,
  ticketModeDetailBullets,
  ticketModeLabel,
  ticketModeOptionsForEvent,
  defaultTicketModeForEvent,
  type TicketDeliveryMode,
} from "@/lib/eventTicketMode";
import dynamic from "next/dynamic";
import CustomerAuthModal from "@/components/Shared/CustomerAuthModal";
const fieldErrorClass = "mt-1.5 text-[0.8125rem] font-medium text-rose-500";
const reqStar = <span className="text-rose-500">*</span>;
const HOLD_SESSION_KEY = "bmb_event_hold_session";

function formatHoldCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function readHoldSessionToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const t = sessionStorage.getItem(HOLD_SESSION_KEY);
  return t && t.trim() ? t.trim() : undefined;
}

function writeHoldSessionToken(token: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(HOLD_SESSION_KEY, token);
}

const VenueLayoutViewer = dynamic(
  () => import("@/components/EventLandingPage/VenueLayoutViewer"),
  { ssr: false }
);

const StadiumLayoutViewer = dynamic(
  () => import("@/components/EventLandingPage/StadiumLayoutViewer"),
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
  return getVenueDateTimeParts(iso)?.dateKey || "";
}

function dateChip(iso: string) {
  const parts = getVenueDateTimeParts(iso);
  return {
    day: parts?.weekdayLong.slice(0, 3) || "",
    date: formatDateCustomer(iso),
  };
}

function venueMapsUrl(opts: {
  latitude?: number | string | null;
  longitude?: number | string | null;
  address?: string | null;
  name?: string | null;
}) {
  const lat = Number(opts.latitude);
  const lng = Number(opts.longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
  const query = hasCoords
    ? `${lat},${lng}`
    : [opts.name, opts.address].filter(Boolean).join(", ");
  if (!query.trim()) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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
  { n: 2, label: "Tickets", short: "Tickets" },
  { n: 3, label: "Ticket Mode", short: "Mode" },
  { n: 4, label: "Review & Confirm", short: "Confirm" },
] as const;

function ticketModeIcon(mode: TicketDeliveryMode) {
  if (mode === "BOX_OFFICE") return Building2;
  if (mode === "PHYSICAL_DELIVERY") return Truck;
  return Smartphone;
}

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
  const eventPosterUrl = resolveMediaUrl(
    event.poster_vertical_url || event.poster_horizontal_url
  );
  const dispatch = useAppDispatch();
  const selectedCity = useSelectedCity();
  const authUser = useAppSelector((state) => state.auth.user);
  const [step, setStep] = useState(1);
  const [showtimeId, setShowtimeId] = useState("");
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [qtyByType, setQtyByType] = useState<Record<string, number>>({});
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromoOffer | null>(null);
  const [giftCardInput, setGiftCardInput] = useState("");
  const [selectedGiftCardId, setSelectedGiftCardId] = useState("");
  const [appliedGiftCard, setAppliedGiftCard] = useState<GiftCardRedeemPreview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookedSuccessId, setBookedSuccessId] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<any[]>([]);
  const [desiredSeatQty, setDesiredSeatQty] = useState<number | null>(null);
  const [seatCountPick, setSeatCountPick] = useState<number | null>(null);
  const [seatQtyModalOpen, setSeatQtyModalOpen] = useState(false);
  const autoOpenedMapRef = useRef(false);
  const [seatViewMode, setSeatViewMode] = useState<"canvas" | "grid">("canvas");
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [expandedCity, setExpandedCity] = useState<string>("");
  const [venueDetailsId, setVenueDetailsId] = useState("");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [ticketModeDetailsOpen, setTicketModeDetailsOpen] = useState<TicketDeliveryMode | null>(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [cancelTxnOpen, setCancelTxnOpen] = useState(false);
  const [cancelTxnAction, setCancelTxnAction] = useState<"back" | "exit">("back");
  const [ticketMode, setTicketMode] = useState<TicketDeliveryMode>("M_TICKET");
  const [sessionToken, setSessionToken] = useState<string | undefined>(readHoldSessionToken);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [timeOutOpen, setTimeOutOpen] = useState(false);
  const dateScrollRef = useRef<HTMLDivElement>(null);

  const contactForm = useForm<EventCheckoutContactValues>({
    resolver: yupResolver(eventCheckoutContactSchema) as any,
    defaultValues: emptyEventCheckoutContactValues(),
    mode: "onSubmit",
  });
  const {
    watch: watchContact,
    reset: resetContact,
    getValues: getContactValues,
    trigger: triggerContact,
  } = contactForm;
  const name = watchContact("name") || "";
  const phone = watchContact("phone") || "";
  const email = watchContact("email") || "";

  const contactModalForm = useForm<EventCheckoutContactValues>({
    resolver: yupResolver(eventCheckoutContactSchema) as any,
    defaultValues: emptyEventCheckoutContactValues(),
    mode: "onSubmit",
  });
  const {
    register: registerContactModal,
    control: contactModalControl,
    handleSubmit: handleContactModalSubmit,
    reset: resetContactModal,
    formState: { errors: contactModalErrors },
  } = contactModalForm;

  const deliveryForm = useForm<EventCheckoutDeliveryValues>({
    resolver: yupResolver(eventCheckoutDeliverySchema) as any,
    defaultValues: emptyEventCheckoutDeliveryValues(false),
    mode: "onSubmit",
  });
  const {
    register: registerDelivery,
    watch: watchDelivery,
    reset: resetDelivery,
    setValue: setDeliveryValue,
    getValues: getDeliveryValues,
    trigger: triggerDelivery,
    formState: { errors: deliveryErrors },
  } = deliveryForm;
  const deliveryAddressLine = watchDelivery("delivery_address_line") || "";
  const deliveryCity = watchDelivery("delivery_city") || "";
  const deliveryNotes = watchDelivery("delivery_notes") || "";

  const openContactModal = () => {
    resetContactModal(getContactValues());
    setContactModalOpen(true);
  };
  const checkoutScrollFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [checkoutScrollActive, setCheckoutScrollActive] = useState(false);

  const handleCheckoutScroll = () => {
    setCheckoutScrollActive(true);
    if (checkoutScrollFadeRef.current) clearTimeout(checkoutScrollFadeRef.current);
    checkoutScrollFadeRef.current = setTimeout(() => setCheckoutScrollActive(false), 900);
  };

  useEffect(() => {
    return () => {
      if (checkoutScrollFadeRef.current) clearTimeout(checkoutScrollFadeRef.current);
    };
  }, []);

  const customerId = authUser?.role === "customer" ? authUser.customer_id || "" : "";
  const { data: profile } = useGetCustomerProfileQuery(customerId, { skip: !customerId || isOrganizer });
  const { data: myGiftCards = [] } = useGetMyGiftCardsQuery(undefined, {
    skip: !customerId || isOrganizer,
  });
  const layoutArg = useMemo(() => {
    return sessionToken ? { eventId: event.id, session_token: sessionToken } : event.id;
  }, [event.id, sessionToken]);

  const {
    data: layoutData,
    isLoading: layoutLoading,
    isFetching: layoutFetching,
  } = useGetEventLayoutQuery(layoutArg, { skip: !isOrganizer });
  const {
    data: publicLayoutData,
    isLoading: publicLayoutLoading,
    isFetching: publicLayoutFetching,
  } = useGetPublicEventLayoutQuery(layoutArg, { skip: isOrganizer });

  const activeLayoutData = isOrganizer ? layoutData : publicLayoutData;
  const isLayoutLoading = isOrganizer
    ? layoutLoading || (!layoutData && layoutFetching)
    : publicLayoutLoading || (!publicLayoutData && publicLayoutFetching);

  // Detect stadium mode: sports events with layout_mode = "stadium" in seating_config
  const seatingConfig = (activeLayoutData as any)?.data?.seating_config
    ?? (activeLayoutData as any)?.seating_config
    ?? (event as any)?.seating_config
    ?? null;
  const isStadiumLayout =
    seatingConfig?.layout_mode === "stadium" ||
    (Array.isArray(seatingConfig?.blocks) && seatingConfig.blocks.length > 0);

  const [createEventBooking] = useCreateEventBookingMutation();
  const [createEventSeatHold] = useCreateEventSeatHoldMutation();
  const [releaseEventSeatHold, { isLoading: releasingHold }] =
    useReleaseEventSeatHoldMutation();
  const [validatePromo, { isLoading: validatingPromo }] = useValidateEventPromoCodeMutation();
  const [previewGiftCard, { isLoading: validatingGiftCard }] = usePreviewGiftCardRedeemMutation();

  useEffect(() => {
    setSessionToken(readHoldSessionToken());
  }, []);

  useEffect(() => {
    if (!isMapFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMapFullscreen]);

  useEffect(() => {
    const ownHold = (activeLayoutData as any)?.data?.own_hold || (activeLayoutData as any)?.own_hold;
    if (!ownHold || ownHold.status !== "ACTIVE") return;

    if (ownHold.id) {
      setHoldId((curr) => curr || ownHold.id);
    }
    if (ownHold.expires_at) {
      setExpiresAt((curr) => curr || resolveHoldExpiresAt({ expires_at: ownHold.expires_at }));
    }
    if (ownHold.showtime_id) {
      setShowtimeId((curr) => curr || ownHold.showtime_id);
    }

    const heldSeatIds: string[] = Array.isArray(ownHold.event_seat_ids)
      ? ownHold.event_seat_ids.map(String)
      : [];
    if (heldSeatIds.length > 0) {
      const allSeats: any[] =
        (activeLayoutData as any)?.data?.seats || (activeLayoutData as any)?.seats || [];
      const heldSet = new Set(heldSeatIds);
      const matched = allSeats.filter((s: any) => heldSet.has(String(s.id)));

      setSelectedSeats((curr) => {
        if (curr && curr.length > 0) return curr;
        if (matched.length > 0) return matched;
        return heldSeatIds.map((id) => ({ id, status: "AVAILABLE" }));
      });

      setDesiredSeatQty((curr) =>
        curr == null || curr < heldSeatIds.length ? heldSeatIds.length : curr
      );
      setSeatCountPick((curr) =>
        curr == null || curr < heldSeatIds.length ? heldSeatIds.length : curr
      );

      setQtyByType((curr) => {
        if (Object.keys(curr).length > 0) return curr;
        const next: Record<string, number> = {};
        matched.forEach((s) => {
          const tid = String(s.ticket_type_id || "");
          if (tid) next[tid] = (next[tid] || 0) + 1;
        });
        return Object.keys(next).length > 0 ? next : curr;
      });
    }
  }, [activeLayoutData]);

  useEffect(() => {
    if (typeof window === "undefined" || !isPage) return;
    const handlePopState = () => {
      setStep((curr) => {
        if (curr === 4) return 3;
        if (curr === 3) return 2;
        if (curr === 2) return 1;
        return curr;
      });
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isPage]);

  useEffect(() => {
    if (typeof window === "undefined" || !isPage) return;
    if (step > 1) {
      window.history.pushState({ eventCheckoutStep: step }, "", window.location.href);
    }
  }, [step, isPage]);

  const showtimes = event.showtimes || [];
  const allTicketTypes = event.ticket_types || [];
  const ticketTypes = useMemo(() => {
    if (!showtimeId) return allTicketTypes;
    const scoped = allTicketTypes.filter((t) => t.showtime_id === showtimeId);
    if (scoped.length) return scoped;
    const nested = showtimes.find((s) => s.id === showtimeId)?.ticket_types || [];
    if (nested.length) {
      return nested.map((t) => ({
        id: t.id || "",
        ticket_type: t.ticket_type,
        total_count: Number(t.total_count),
        available_count: Number(t.available_count ?? t.total_count),
        price: t.price,
        max_per_order: Number((t as { max_per_order?: number }).max_per_order) || 10,
        showtime_id: showtimeId,
      }));
    }
    return allTicketTypes.filter((t) => !t.showtime_id);
  }, [allTicketTypes, showtimes, showtimeId]);

  const pricingTicketPool = useMemo(() => {
    const layoutTypes = Array.isArray(activeLayoutData?.data?.ticket_types)
      ? activeLayoutData.data.ticket_types
      : [];
    const byId = new Map<string, { id: string; ticket_type: string; price: number; max_per_order?: number }>();
    for (const t of [...ticketTypes, ...allTicketTypes, ...layoutTypes]) {
      const id = String(t?.id || "").trim();
      if (!id || byId.has(id)) continue;
      byId.set(id, {
        id,
        ticket_type: String(t.ticket_type || "Ticket"),
        price: Number(t.price) || 0,
        max_per_order: Number((t as { max_per_order?: number }).max_per_order) || 10,
      });
    }
    return Array.from(byId.values());
  }, [ticketTypes, allTicketTypes, activeLayoutData]);

  const resolveSeatTicket = useCallback(
    (seat: {
      ticket_type_id?: string | null;
      section_name?: string | null;
      price?: number | string | null;
      unit_price?: number | string | null;
    }) => {
      const typeId = String(seat.ticket_type_id || "").trim();
      if (typeId) {
        const exact = pricingTicketPool.find((t) => t.id === typeId);
        if (exact) return exact;
      }

      const section = String(seat.section_name || "").trim().toLowerCase();
      if (section) {
        const byName = pricingTicketPool.find((t) => {
          const name = String(t.ticket_type || "").trim().toLowerCase();
          return (
            name === section ||
            name.includes(section) ||
            section.includes(name) ||
            name.replace(/\s+/g, "") === section.replace(/\s+/g, "")
          );
        });
        if (byName) return byName;
      }

      const seatPrice = Number(seat.price ?? seat.unit_price);
      if (Number.isFinite(seatPrice) && seatPrice > 0) {
        return {
          id: typeId || `price-${seatPrice}`,
          ticket_type: String(seat.section_name || "Seat"),
          price: seatPrice,
          max_per_order: 10,
        };
      }

      return pricingTicketPool[0] || null;
    },
    [pricingTicketPool]
  );

  const availableTicketModes = useMemo(
    () => ticketModeOptionsForEvent(event.allowed_ticket_modes),
    [event.allowed_ticket_modes]
  );

  const dateOptions = useMemo(() => {
    const seen = new Map<string, string>();
    showtimes.forEach((s) => {
      const key = dateKey(s.starts_at);
      if (key && !seen.has(key)) seen.set(key, s.starts_at);
    });
    return [...seen.entries()].map(([key, iso]) => ({ key, iso }));
  }, [showtimes]);

  const cityVenueGroups = useMemo(() => {
    type Show = (typeof showtimes)[number];
    type VenueBucket = {
      venueKey: string;
      venueName: string;
      address?: string;
      latitude?: number | string | null;
      longitude?: number | string | null;
      showtimes: Show[];
    };
    const cityMap = new Map<string, Map<string, VenueBucket>>();

    for (const s of showtimes) {
      const city = (s.city_name || "").trim() || "Other";
      const venueName = (s.venue_name || "").trim() || "Venue TBA";
      const address = (s.venue_address || "").trim();
      const venueKey = `${venueName}|${address}`;
      if (!cityMap.has(city)) cityMap.set(city, new Map());
      const venues = cityMap.get(city)!;
      if (!venues.has(venueKey)) {
        venues.set(venueKey, {
          venueKey,
          venueName,
          address: address || undefined,
          latitude: s.latitude,
          longitude: s.longitude,
          showtimes: [],
        });
      } else {
        const bucket = venues.get(venueKey)!;
        if (bucket.latitude == null && s.latitude != null) bucket.latitude = s.latitude;
        if (bucket.longitude == null && s.longitude != null) bucket.longitude = s.longitude;
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

  const totalVenuesCount = useMemo(() => {
    return cityVenueGroups.reduce((acc, g) => acc + g.venues.length, 0);
  }, [cityVenueGroups]);
  const isSingleVenue = totalVenuesCount === 1 || (totalVenuesCount === 0 && showtimes.length <= 1);

  const effectiveSteps = useMemo(() => {
    if (isSingleVenue) {
      return [
        { n: 2, displayN: 1, label: "Tickets", short: "Tickets" },
        { n: 3, displayN: 2, label: "Ticket Mode", short: "Mode" },
        { n: 4, displayN: 3, label: "Review & Confirm", short: "Confirm" },
      ];
    }
    return [
      { n: 1, displayN: 1, label: "Venue", short: "Venue" },
      { n: 2, displayN: 2, label: "Tickets", short: "Tickets" },
      { n: 3, displayN: 3, label: "Ticket Mode", short: "Mode" },
      { n: 4, displayN: 4, label: "Review & Confirm", short: "Confirm" },
    ];
  }, [isSingleVenue]);

  useEffect(() => {
    if (!isOrganizer) dispatch(loadFromStorage());
  }, [dispatch, isOrganizer]);

  useEffect(() => {
    if (!open) return;
    const initial = initialShowtimeId
      ? showtimes.find((s) => s.id === initialShowtimeId)
      : undefined;
    const firstDate = initial ? dateKey(initial.starts_at) : dateOptions[0]?.key || "";
    const pickedShowtime = initial || (showtimes.length === 1 ? showtimes[0] : (isSingleVenue ? showtimes[0] : undefined));
    setShowtimeId(pickedShowtime ? pickedShowtime.id : "");
    setSelectedDateKey(firstDate);
    setStep(isSingleVenue && pickedShowtime ? 2 : 1);
    setQtyByType({});
    setSelectedSeats([]);
    setDesiredSeatQty(null);
    setSeatCountPick(null);
    setSeatQtyModalOpen(false);
    setIsMapFullscreen(false);
    autoOpenedMapRef.current = false;
    resetContact(emptyEventCheckoutContactValues());
    resetContactModal(emptyEventCheckoutContactValues());
    setPromoInput("");
    setAppliedPromo(null);
    setGiftCardInput("");
    setSelectedGiftCardId("");
    setAppliedGiftCard(null);
    setSubmitting(false);
    setAuthModalOpen(false);
    setExpandedCity("");
    setTicketModeDetailsOpen(null);
    setContactModalOpen(false);
    setCancelTxnOpen(false);
    setTicketMode(defaultTicketModeForEvent(event.allowed_ticket_modes));
    resetDelivery(emptyEventCheckoutDeliveryValues(false));
  }, [open, event.id, event.allowed_ticket_modes, initialShowtimeId, isSingleVenue, showtimes, dateOptions, resetContact, resetContactModal, resetDelivery]);

  useEffect(() => {
    if (!availableTicketModes.some((o) => o.id === ticketMode)) {
      setTicketMode(defaultTicketModeForEvent(event.allowed_ticket_modes));
    }
  }, [availableTicketModes, ticketMode, event.allowed_ticket_modes]);

  useEffect(() => {
    setDeliveryValue("needs_delivery", ticketMode === "PHYSICAL_DELIVERY");
  }, [ticketMode, setDeliveryValue]);

  useEffect(() => {
    if (isOrganizer || authUser?.role !== "customer") return;
    resetContact({
      name: profile?.name || authUser.name || "",
      phone: sanitizePhoneInput(profile?.phone || authUser.phone || ""),
      email: profile?.email || authUser.email || "",
    });
  }, [authUser, profile, isOrganizer, resetContact]);

  const timesForDate = useMemo(
    () => showtimes.filter((s) => dateKey(s.starts_at) === selectedDateKey),
    [showtimes, selectedDateKey]
  );

  useEffect(() => {
    if (!open) return;
    const first = cityVenueGroups[0]?.city || "";
    if (first) setExpandedCity(first);
  }, [open, event.id, cityVenueGroups]);

  const recommendedId = timesForDate[0]?.id;
  const selectedShowtime = showtimes.find((s) => s.id === showtimeId);
  const conveniencePct = Number(event.convenience_fee_percent) || 0;
  const convenienceVatPct = Number((event as any).convenience_fee_vat_percent ?? 15);

  const selectedLines = useMemo(() => {
    const lines = [];

    if (selectedSeats.length > 0) {
      const seatGrouped: Record<
        string,
        { qty: number; unit: number; ticket_type: string; ids: string[] }
      > = {};

      selectedSeats.forEach((s) => {
        const resolved = resolveSeatTicket(s);
        const ttId = String(resolved?.id || s.ticket_type_id || "seat");
        const unit =
          Number(resolved?.price) ||
          Number(s.price) ||
          Number(s.unit_price) ||
          0;
        if (!seatGrouped[ttId]) {
          seatGrouped[ttId] = {
            qty: 0,
            unit,
            ticket_type: String(resolved?.ticket_type || s.section_name || "Seat"),
            ids: [],
          };
        }
        seatGrouped[ttId].qty += 1;
        seatGrouped[ttId].ids.push(String(s.id));
        if (!seatGrouped[ttId].unit && unit) seatGrouped[ttId].unit = unit;
      });

      for (const [ttId, group] of Object.entries(seatGrouped)) {
        lines.push({
          id: ttId,
          ticket_type: group.ticket_type,
          qty: group.qty,
          unit: group.unit,
          available: group.qty,
          event_seat_ids: group.ids,
        });
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
  }, [ticketTypes, qtyByType, selectedSeats, resolveSeatTicket]);

  const ticketAmount = moneySum(selectedLines.map((l) => l.unit * l.qty));
  const discountAmount = !isOrganizer && appliedPromo ? appliedPromo.discount_amount : 0;
  const netTicketAmount = moneySum([Math.max(0, ticketAmount - discountAmount)]);
  const convenienceFeeBase = moneySum([(ticketAmount * conveniencePct) / 100]);
  const convenienceFeeTax =
    convenienceFeeBase > 0 && convenienceVatPct > 0
      ? moneySum([(convenienceFeeBase * convenienceVatPct) / 100])
      : 0;
  const convenienceFee = moneySum([convenienceFeeBase, convenienceFeeTax]);
  const orderTotal = moneySum([netTicketAmount, convenienceFee]);
  const giftCardAmount =
    !isOrganizer && appliedGiftCard ? Number(appliedGiftCard.amount_applicable) || 0 : 0;
  const grandTotal = moneySum([Math.max(0, orderTotal - giftCardAmount)]);
  const ticketQty = selectedLines.reduce((sum, l) => sum + l.qty, 0);

  const redeemableGiftCards = useMemo(
    () =>
      myGiftCards.filter((c) => {
        const status = String(c.status || "").toUpperCase();
        const cat = String(c.applicable_category || "ALL").toUpperCase();
        const bal = Number(c.current_balance) || 0;
        return (
          bal > 0 &&
          (status === "ACTIVE" || status === "PARTIALLY_USED") &&
          (cat === "ALL" || cat === "EVENTS" || cat === "SPORTS") &&
          isGiftCardSpendable(c)
        );
      }),
    [myGiftCards]
  );

  const setQty = (id: string, next: number, max: number) => {
    setAppliedPromo(null);
    setPromoInput("");
    setAppliedGiftCard(null);
    setGiftCardInput("");
    setSelectedGiftCardId("");
    const clamped = Math.max(0, Math.min(max, next));
    setQtyByType((prev) => {
      if (clamped <= 0) {
        return { ...prev, [id]: 0 };
      }
      // One ticket type per order: selecting a new type clears the others (no toast).
      return { [id]: clamped };
    });
  };

  const requestLeaveConfirmStep = (action: "back" | "exit") => {
    setCancelTxnAction(action);
    setCancelTxnOpen(true);
  };

  const clearSeatHoldState = () => {
    setHoldId(null);
    setExpiresAt(null);
    setSecondsLeft(null);
    setTimeOutOpen(false);
  };

  const releaseActiveHold = async () => {
    if (!holdId) return;
    try {
      await releaseEventSeatHold({
        holdId,
        session_token: sessionToken || readHoldSessionToken(),
      }).unwrap();
    } catch {
      // best-effort release
    }
  };

  const resetToSeatsAfterTimeout = async () => {
    await releaseActiveHold();
    clearSeatHoldState();
    setSelectedSeats([]);
    setQtyByType({});
    setAppliedPromo(null);
    setPromoInput("");
    setAppliedGiftCard(null);
    setGiftCardInput("");
    setSelectedGiftCardId("");
    setIsMapFullscreen(false);
    setStep(2);
  };

  const confirmCancelTransaction = async () => {
    await releaseActiveHold();
    clearSeatHoldState();
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
        ...(selectedCity ? { city: selectedCity } : {}),
      }).unwrap();
      setAppliedPromo(result);
      setAppliedGiftCard(null);
      toast.success(`Promo code "${result.promo_code}" applied!`);
    } catch (err) {
      setAppliedPromo(null);
      toast.error(extractApiError(err, "Invalid or expired promo code."));
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoInput("");
    setAppliedGiftCard(null);
  };

  const handleApplyGiftCard = async () => {
    if (orderTotal <= 0) {
      toast.error("Nothing left to pay.");
      return;
    }
    const payload = selectedGiftCardId
      ? { gift_card_id: selectedGiftCardId, amount: orderTotal, category: "EVENTS" as const }
      : giftCardInput.trim()
        ? { code: giftCardInput.trim(), amount: orderTotal, category: "EVENTS" as const }
        : null;
    if (!payload) {
      toast.error("Select a gift card or enter a code.");
      return;
    }
    try {
      const result = await previewGiftCard(payload).unwrap();
      setAppliedGiftCard(result);
      toast.success(`Gift card applied · ${formatMoney(result.amount_applicable)}`);
    } catch (err) {
      setAppliedGiftCard(null);
      toast.error(extractApiError(err, "Could not apply gift card."));
    }
  };

  const handleRemoveGiftCard = () => {
    setAppliedGiftCard(null);
    setGiftCardInput("");
    setSelectedGiftCardId("");
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showtimeId || selectedLines.length === 0) return;

    if (!isOrganizer && (!isCustomerLoggedIn || !customerId)) {
      toast.error("Please sign in to complete your booking.");
      setAuthModalOpen(true);
      return;
    }

    const contactValid = await triggerContact();
    if (!contactValid) {
      openContactModal();
      toast.error(isOrganizer ? "Please enter customer contact details." : "Please complete your contact details.");
      return;
    }

    setDeliveryValue("needs_delivery", ticketMode === "PHYSICAL_DELIVERY");
    if (ticketMode === "PHYSICAL_DELIVERY") {
      const deliveryValid = await triggerDelivery();
      if (!deliveryValid) {
        toast.error("Enter the full delivery address.");
        setStep(3);
        return;
      }
    }

    setSubmitting(true);
    try {
      if (selectedSeats.length > 0) {
        if (!holdId || timeOutOpen || (secondsLeft !== null && secondsLeft <= 0)) {
          setTimeOutOpen(true);
          setSubmitting(false);
          return;
        }
      }

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

      const contact = getContactValues();
      const guest_name = contact.name.trim();
      const guest_phone = sanitizePhoneInput(contact.phone);
      const guest_email = contact.email.trim() || undefined;
      const delivery = getDeliveryValues();
      const deliveryPayload =
        ticketMode === "PHYSICAL_DELIVERY"
          ? {
            delivery_address_line: (delivery.delivery_address_line || "").trim(),
            delivery_city: (delivery.delivery_city || "").trim(),
            delivery_notes: (delivery.delivery_notes || "").trim() || undefined,
          }
          : {};

      const holdPayload =
        selectedSeats.length > 0 && holdId
          ? {
            hold_id: holdId,
            session_token: sessionToken || readHoldSessionToken(),
          }
          : {};

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
          ticket_mode: ticketMode,
          ...deliveryPayload,
          ...holdPayload,
        }).unwrap();
      } else {
        result = await createEventBooking({
          event_id: event.id,
          showtime_id: showtimeId,
          items,
          guest_name,
          guest_phone,
          guest_email,
          customer_id: customerId,
          booking_source: "ONLINE",
          promo_code: appliedPromo?.promo_code,
          gift_card_id: appliedGiftCard?.gift_card_id,
          ticket_mode: ticketMode,
          ...deliveryPayload,
          ...holdPayload,
        }).unwrap();
      }

      clearSeatHoldState();

      if (isOrganizer) {
        toast.success(result.message || `Tickets booked and sent to ${contact.email.trim()}.`);
        onOrganizerSuccess?.(result);
        onClose();
      } else {
        toast.success(result.message || `Tickets booked! Confirmation sent to ${contact.email.trim()}.`);
        if (result.booking_id) {
          setBookedSuccessId(result.booking_id);
        } else {
          onClose();
        }
      }
    } catch (err) {
      toast.error(extractApiError(err, "Booking failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!expiresAt || !holdId) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const remainingMs = new Date(expiresAt).getTime() - Date.now();
      const secs = Math.max(0, Math.ceil(remainingMs / 1000));
      setSecondsLeft(secs);
      if (secs <= 0) {
        setTimeOutOpen(true);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt, holdId]);

  const hasReservedSeats = Boolean(activeLayoutData?.data?.seats?.length) || isStadiumLayout;
  const showtimeHasSeatingLayout = useMemo(() => {
    if (activeLayoutData) {
      return Boolean(activeLayoutData?.data?.seats?.length) || isStadiumLayout;
    }
    const mode = (selectedShowtime as any)?.layout_mode;
    if (mode === "standard" || mode === "custom") return true;
    if ((selectedShowtime as any)?.venue_layout_template_id) return true;
    if (isStadiumLayout) return true;
    if (mode === "none") return false;
    return showtimes.some(
      (s: any) =>
        s.layout_mode === "standard" ||
        s.layout_mode === "custom" ||
        Boolean(s.venue_layout_template_id)
    );
  }, [activeLayoutData, isStadiumLayout, selectedShowtime, showtimes]);
  const maxSeatQtyPick = useMemo(() => {
    if (!hasReservedSeats) return 10;
    const fromTickets = ticketTypes.map((t) =>
      Math.max(1, Number((t as { max_per_order?: number }).max_per_order) || 10)
    );
    const available = isStadiumLayout
      ? 10
      : (activeLayoutData?.data?.seats || []).filter(
        (s: { status?: string }) => String(s.status || "").toUpperCase() === "AVAILABLE"
      ).length;
    const cap = fromTickets.length ? Math.max(...fromTickets) : 10;
    if (available > 0) return Math.min(10, cap, available);
    return Math.min(10, cap);
  }, [hasReservedSeats, isStadiumLayout, ticketTypes, activeLayoutData]);

  // Auto-open map with "How many seats?" popup when in step 2 with seating layout
  useEffect(() => {
    if (!open) {
      autoOpenedMapRef.current = false;
      return;
    }
    if (step === 2 && (hasReservedSeats || showtimeHasSeatingLayout) && !autoOpenedMapRef.current) {
      autoOpenedMapRef.current = true;
      setIsMapFullscreen(true);
      setDesiredSeatQty((curr) => curr || 2);
      setSeatCountPick((curr) => curr || 2);
      setSeatQtyModalOpen(true);
    }
  }, [open, step, hasReservedSeats, showtimeHasSeatingLayout]);

  const eventGridLayout = useMemo(() => {
    type GridSeat = {
      id: string;
      row: string;
      number: string;
      sectionName: string;
      ticket_type_id: string;
      price: number;
      isBooked: boolean;
      gapAfter: number;
      x: number;
      y: number;
      raw: any;
    };
    type GridSection = {
      sectionName: string;
      price: number;
      avgX: number;
      avgY: number;
      rows: Array<{ rowLabel: string; seats: GridSeat[] }>;
    };
    type GridBand = { avgY: number; sections: GridSection[] };

    const rawSeats = Array.isArray(activeLayoutData?.data?.seats)
      ? activeLayoutData.data.seats
      : [];
    const config =
      activeLayoutData?.data?.seating_config ||
      activeLayoutData?.seating_config ||
      {};
    const shapes: any[] = Array.isArray(config?.shapes) ? config.shapes : [];
    const stageShape = shapes.find((s) =>
      String(s.text || s.label || "")
        .toLowerCase()
        .match(/stage|screen|performance/)
    );
    const seatYs = rawSeats.map((s: any) => Number(s.coordinate_y ?? 0));
    const seatMinY = seatYs.length ? Math.min(...seatYs) : 0;
    const stageY = stageShape ? Number(stageShape.y ?? 0) : null;
    const stageAtTop = stageY == null ? true : stageY <= seatMinY + 80;

    if (!rawSeats.length) {
      return { bands: [] as GridBand[], stageAtTop, hasStage: Boolean(stageShape) };
    }

    const sectionMap = new Map<string, any[]>();
    for (const s of rawSeats) {
      const sec = String(s.section_name || "General").trim() || "General";
      if (!sectionMap.has(sec)) sectionMap.set(sec, []);
      sectionMap.get(sec)!.push(s);
    }

    const sections: GridSection[] = Array.from(sectionMap.entries()).map(
      ([sectionName, seats]) => {
        const xs = seats.map((s: any) => Number(s.coordinate_x ?? 0));
        const ys = seats.map((s: any) => Number(s.coordinate_y ?? 0));
        const avgX = xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
        const avgY = ys.reduce((a, b) => a + b, 0) / (ys.length || 1);

        const rowMap = new Map<string, any[]>();
        for (const s of seats) {
          const r = String(s.row_label || "A").trim() || "A";
          if (!rowMap.has(r)) rowMap.set(r, []);
          rowMap.get(r)!.push(s);
        }

        const rows = Array.from(rowMap.entries())
          .map(([rowLabel, rowSeats]) => {
            const sorted = [...rowSeats].sort(
              (a: any, b: any) => Number(a.coordinate_x ?? 0) - Number(b.coordinate_x ?? 0)
            );
            const steps: number[] = [];
            for (let i = 0; i < sorted.length - 1; i++) {
              const diff =
                Number(sorted[i + 1].coordinate_x ?? 0) - Number(sorted[i].coordinate_x ?? 0);
              if (diff > 5) steps.push(diff);
            }
            const normalStep = steps.length > 0 ? Math.min(...steps) : 40;
            const sampleTypeId = String(sorted[0]?.ticket_type_id || "");
            const ticket = ticketTypes.find((t) => t.id === sampleTypeId);
            const price = Number(ticket?.price) || 0;
            const avgRowY =
              sorted.reduce((sum: number, s: any) => sum + Number(s.coordinate_y ?? 0), 0) /
              (sorted.length || 1);

            return {
              rowLabel,
              avgY: avgRowY,
              seats: sorted.map((seat: any, seatIdx: number) => {
                const seatNum =
                  seat.seat_label != null && String(seat.seat_label).trim() !== ""
                    ? String(seat.seat_label).trim()
                    : String(seatIdx + 1);
                const nextSeat = sorted[seatIdx + 1];
                const gapRatio = nextSeat
                  ? (Number(nextSeat.coordinate_x ?? 0) - Number(seat.coordinate_x ?? 0)) /
                  normalStep
                  : 1;
                const gapAfter =
                  gapRatio > 2.4 ? 3 : gapRatio > 1.7 ? 2 : gapRatio > 1.35 ? 1 : 0;
                const status = String(seat.status || "").toUpperCase();
                return {
                  id: String(seat.id),
                  row: rowLabel,
                  number: seatNum,
                  sectionName,
                  ticket_type_id: String(seat.ticket_type_id || ""),
                  price:
                    Number(
                      ticketTypes.find((t) => t.id === String(seat.ticket_type_id || ""))?.price
                    ) || price,
                  isBooked: status !== "AVAILABLE",
                  gapAfter,
                  x: Number(seat.coordinate_x ?? 0),
                  y: Number(seat.coordinate_y ?? 0),
                  raw: seat,
                } as GridSeat;
              }),
            };
          })
          .sort((a, b) => a.avgY - b.avgY);

        const price =
          rows[0]?.seats[0]?.price ||
          Number(
            ticketTypes.find((t) => t.id === String(seats[0]?.ticket_type_id || ""))?.price
          ) ||
          0;

        return {
          sectionName,
          price,
          avgX,
          avgY,
          rows: rows.map(({ rowLabel, seats: rowSeats }) => ({
            rowLabel,
            seats: rowSeats,
          })),
        };
      }
    );

    sections.sort((a, b) => a.avgY - b.avgY || a.avgX - b.avgX);

    const ySpan =
      Math.max(...sections.map((s) => s.avgY)) - Math.min(...sections.map((s) => s.avgY)) || 1;
    const bandThreshold = Math.max(120, ySpan * 0.28);

    const bands: GridBand[] = [];
    for (const sec of sections) {
      const last = bands[bands.length - 1];
      if (last && Math.abs(sec.avgY - last.avgY) <= bandThreshold) {
        last.sections.push(sec);
        last.avgY =
          last.sections.reduce((sum, s) => sum + s.avgY, 0) / last.sections.length;
      } else {
        bands.push({ avgY: sec.avgY, sections: [sec] });
      }
    }

    for (const band of bands) {
      band.sections.sort((a, b) => a.avgX - b.avgX);
    }

    return { bands, stageAtTop, hasStage: Boolean(stageShape) || sections.length > 0 };
  }, [activeLayoutData, ticketTypes]);

  const findGridSeatContext = useCallback(
    (seatId: string) => {
      for (const band of eventGridLayout.bands) {
        for (const section of band.sections) {
          for (const row of section.rows) {
            const idx = row.seats.findIndex((s) => String(s.id) === String(seatId));
            if (idx >= 0) {
              return { section, row, index: idx, seat: row.seats[idx] };
            }
          }
        }
      }
      return null;
    },
    [eventGridLayout]
  );

  /**
   * BookMyShow-style: pick contiguous available seats on the same row.
   * `need` may be the full ticket count or only the remaining seats to fill.
   */
  const autoSelectNeighborSeats = useCallback(
    (anchorSeatId: string, need: number) => {
      const ctx = findGridSeatContext(anchorSeatId);
      if (!ctx || need < 1) return null;
      const block = pickContiguousBlock(ctx.row.seats, ctx.index, need);
      if (!block.length) return null;
      return block.map((s) => ({
        ...s.raw,
        id: s.id,
        ticket_type_id: s.ticket_type_id,
        section_name: s.sectionName,
        row_label: s.row,
        seat_label: s.number,
        price: s.price,
        unit_price: s.price,
        status: "AVAILABLE",
      }));
    },
    [findGridSeatContext]
  );

  if (!open) return null;

  const isSingleCitySingleVenue =
    cityVenueGroups.length === 1 && (cityVenueGroups[0]?.venues.length ?? 0) === 1;
  const showStepHeader =
    step !== 4 && (step !== 1 || !isSingleVenue);

  const accentBtn = "bg-[#111111] hover:bg-black";
  const accentIcon = "text-[#6900AA]";
  const accentFocus = "focus:border-[#6900AA]";
  const seatCountActiveGradient =
    "linear-gradient(180deg, #A78BFA 0%, #8B5CF6 38%, #6D28D9 72%, #4C1D95 100%)";
  const isCustomerLoggedIn = authUser?.role === "customer";
  const stepTitle =
    step === 1
      ? "Select Venue"
      : step === 2
        ? "Select Tickets"
        : step === 3
          ? "Ticket Mode"
          : "Review your booking";
  const stepSubtitle =
    step === 1
      ? "Choose a city and venue for your event."
      : step === 2
        ? hasReservedSeats || showtimeHasSeatingLayout
          ? "Choose how many seats, then pick them on the map or grid."
          : "You can add tickets based on availability."
        : step === 3
          ? availableTicketModes.length === 1
            ? isCustomerLoggedIn || isOrganizer
              ? "Confirm your ticket delivery method to continue."
              : "Confirm ticket delivery and sign in to continue."
            : isCustomerLoggedIn || isOrganizer
              ? "Choose how you want your tickets to continue."
              : "Choose how you want your tickets and sign in to continue."
          : "Review your order and confirm your booking.";
  const contactDetailsReady = eventCheckoutContactSchema.isValidSync({
    name,
    phone,
    email,
  });
  const detailsReady =
    contactDetailsReady && (isOrganizer || isCustomerLoggedIn);
  const canConfirm =
    detailsReady &&
    !submitting &&
    Boolean(ticketMode) &&
    (selectedSeats.length === 0 ||
      (Boolean(holdId) && !timeOutOpen && (secondsLeft === null || secondsLeft > 0)));
  const deliveryDetailsReady =
    ticketMode !== "PHYSICAL_DELIVERY" ||
    (Boolean(deliveryAddressLine.trim()) && Boolean(deliveryCity.trim()));
  const canProceedFromTicketMode =
    Boolean(ticketMode) &&
    deliveryDetailsReady &&
    (isOrganizer ? contactDetailsReady : isCustomerLoggedIn && contactDetailsReady);

  const toggleGridSeat = (
    seat: (typeof eventGridLayout.bands)[number]["sections"][number]["rows"][number]["seats"][number]
  ) => {
    if (seat.isBooked || !desiredSeatQty) return;

    // Tap a selected seat → deselect only that seat (adjust like BMS)
    const exists = selectedSeats.some((s) => String(s.id) === seat.id);
    if (exists) {
      applySelectedSeats(selectedSeats.filter((s) => String(s.id) !== seat.id));
      return;
    }

    // Full qty already picked → start a fresh auto-select of the full count
    const startFresh = selectedSeats.length === 0 || selectedSeats.length >= desiredSeatQty;
    const need = startFresh ? desiredSeatQty : desiredSeatQty - selectedSeats.length;

    const autoBlock = autoSelectNeighborSeats(seat.id, need);
    if (!autoBlock || autoBlock.length === 0) {
      toast.message("No available seats in this row for your selection.");
      return;
    }

    if (!startFresh) {
      const currentType = String(selectedSeats[0]?.ticket_type_id || "");
      const incoming = resolveSeatTicket(autoBlock[0]);
      if (currentType && incoming?.id && String(incoming.id) !== currentType) {
        toast.message("Please select seats from the same ticket type / block.");
        return;
      }
      const existingIds = new Set(selectedSeats.map((s) => String(s.id)));
      const toAdd = autoBlock.filter((s) => !existingIds.has(String(s.id)));
      if (!toAdd.length) return;
      const merged = [...selectedSeats, ...toAdd].slice(0, desiredSeatQty);
      applySelectedSeats(merged);
      if (merged.length < desiredSeatQty) {
        toast.message(
          `${merged.length}/${desiredSeatQty} selected — tap another row for the rest.`
        );
      }
      return;
    }

    applySelectedSeats(autoBlock);
    if (autoBlock.length < desiredSeatQty) {
      toast.message(
        `${autoBlock.length}/${desiredSeatQty} selected — tap another row for the rest.`
      );
    }
  };

  const handleMapSeatsSelected = (seats: any[]) => {
    if (!desiredSeatQty) {
      applySelectedSeats(seats);
      return;
    }

    const prevIds = new Set(selectedSeats.map((s) => String(s.id)));
    const nextIds = new Set(seats.map((s) => String(s.id)));

    // Deselect path from map viewer — or BMS "start fresh" when qty was full
    if (seats.length < selectedSeats.length) {
      if (seats.length === 1 && !prevIds.has(String(seats[0].id))) {
        const autoBlock = autoSelectNeighborSeats(String(seats[0].id), desiredSeatQty);
        if (autoBlock && autoBlock.length > 0) {
          applySelectedSeats(autoBlock);
          if (autoBlock.length < desiredSeatQty) {
            toast.message(
              `${autoBlock.length}/${desiredSeatQty} selected — tap another row for the rest.`
            );
          }
          return;
        }
      }
      applySelectedSeats(seats);
      return;
    }

    const newlyAdded = seats.filter((s) => !prevIds.has(String(s.id)));
    if (newlyAdded.length === 1 && seats.length === selectedSeats.length + 1) {
      const startFresh = selectedSeats.length === 0 || selectedSeats.length >= desiredSeatQty;
      const need = startFresh ? desiredSeatQty : desiredSeatQty - selectedSeats.length;
      const autoBlock = autoSelectNeighborSeats(String(newlyAdded[0].id), need);
      if (autoBlock && autoBlock.length > 0) {
        if (startFresh) {
          applySelectedSeats(autoBlock);
        } else {
          const existing = new Set(selectedSeats.map((s) => String(s.id)));
          const toAdd = autoBlock.filter((s) => !existing.has(String(s.id)));
          applySelectedSeats([...selectedSeats, ...toAdd].slice(0, desiredSeatQty));
        }
        return;
      }
    }

    // Ignore map over-select beyond qty
    if (seats.length > desiredSeatQty) {
      applySelectedSeats(seats.slice(0, desiredSeatQty));
      return;
    }

    // Keep selection if map re-emits same set
    if (
      seats.length === selectedSeats.length &&
      seats.every((s) => prevIds.has(String(s.id))) &&
      selectedSeats.every((s) => nextIds.has(String(s.id)))
    ) {
      return;
    }

    applySelectedSeats(seats);
  };

  const seatsReady = hasReservedSeats
    ? desiredSeatQty != null && selectedSeats.length === desiredSeatQty
    : ticketQty >= 1;

  const proceedFromTickets = () => {
    if (hasReservedSeats) {
      if (!desiredSeatQty) {
        toast.error("Choose how many seats you need first.");
        return;
      }
      if (selectedSeats.length !== desiredSeatQty) {
        toast.error(`Please select exactly ${desiredSeatQty} seat${desiredSeatQty === 1 ? "" : "s"} on the map.`);
        return;
      }
    } else if (ticketQty < 1) {
      return;
    }
    setIsMapFullscreen(false);
    setStep(3);
  };

  const proceedToReview = async () => {
    if (!canProceedFromTicketMode) {
      if (!isOrganizer && !isCustomerLoggedIn) {
        setAuthModalOpen(true);
        return;
      }
      if (!contactDetailsReady) {
        openContactModal();
        toast.error(isOrganizer ? "Please enter customer contact details." : "Please complete your contact details.");
        return;
      }
      if (ticketMode === "PHYSICAL_DELIVERY" && !deliveryDetailsReady) {
        toast.error("Enter the full delivery address.");
        return;
      }
      return;
    }

    if (selectedSeats.length > 0) {
      const currentSeatIds = selectedSeats.map((s) => String(s.id)).sort().join(",");
      const isHoldActive = Boolean(
        holdId && expiresAt && (secondsLeft === null || secondsLeft > 0) && !timeOutOpen
      );
      const heldSeatIds = (
        ((activeLayoutData as any)?.data?.own_hold?.event_seat_ids ||
          (activeLayoutData as any)?.own_hold?.event_seat_ids ||
          []) as string[]
      )
        .map(String)
        .sort()
        .join(",");

      if (isHoldActive && heldSeatIds && currentSeatIds === heldSeatIds) {
        setStep(4);
        return;
      }

      setHolding(true);
      try {
        const existing = sessionToken || readHoldSessionToken();
        const res = await createEventSeatHold({
          eventId: event.id,
          event_seat_ids: selectedSeats.map((s) => String(s.id)),
          showtime_id: showtimeId || undefined,
          session_token: existing,
        }).unwrap();

        const nextToken = res.data.session_token;
        writeHoldSessionToken(nextToken);
        setSessionToken(nextToken);
        setHoldId(res.data.hold_id);
        setExpiresAt(
          resolveHoldExpiresAt({
            expires_at: res.data.expires_at,
            ttl_seconds: res.data.ttl_seconds,
          })
        );
        setTimeOutOpen(false);
        setStep(4);
        toast.success(res.message || "Seats held for 10 minutes.");
      } catch (err) {
        toast.error(extractApiError(err, "Could not hold seats. Please try again."));
      } finally {
        setHolding(false);
      }
      return;
    }

    clearSeatHoldState();
    setStep(4);
  };

  const canNavigateToStep = (targetStep: number) => {
    if (isSingleVenue && targetStep === 1) return false;
    if (targetStep === step) return false;
    if (targetStep < step) return true;
    if (targetStep >= 2 && !showtimeId) return false;
    if (targetStep >= 3 && !(hasReservedSeats ? seatsReady : ticketQty >= 1)) return false;
    if (targetStep >= 4 && !canProceedFromTicketMode) return false;
    return targetStep <= 4;
  };

  const navigateToStep = (targetStep: number) => {
    if (!canNavigateToStep(targetStep)) return;
    if (targetStep !== 2) setIsMapFullscreen(false);
    if (targetStep === 2 && (hasReservedSeats || showtimeHasSeatingLayout)) {
      setIsMapFullscreen(true);
    }
    if (targetStep === 4) {
      void proceedToReview();
      return;
    }
    setStep(targetStep);
  };

  const showtimeSummaryBar =
    selectedShowtime && step >= 2 ? (
      <div className="shrink-0 bg-[#E8ECF0] border-y border-slate-200/80">
        <div
          className={`${isPage ? "max-w-[36rem] mx-auto" : ""
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
    <div className="border-t border-slate-100 bg-white w-full">
      <div className="max-w-[36rem] mx-auto px-4 sm:px-5 py-2 sm:py-2.5">
        <ol className="flex items-center justify-center gap-0.5 sm:gap-1.5 flex-nowrap">
          {effectiveSteps.map((s, i) => {
            const done = step > s.n;
            const active = step === s.n;
            const clickable = canNavigateToStep(s.n);
            return (
              <li key={s.n} className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => navigateToStep(s.n)}
                  disabled={!clickable}
                  aria-current={active ? "step" : undefined}
                  aria-label={`Go to ${s.label}`}
                  className={`flex items-center gap-1 sm:gap-1.5 rounded-md text-left transition-opacity ${clickable
                      ? "cursor-pointer hover:opacity-75"
                      : active
                        ? "cursor-default"
                        : "cursor-not-allowed"
                    }`}
                >
                  <span
                    className={`h-6 w-6 sm:h-7 sm:w-7 rounded-full flex items-center justify-center text-[0.75rem] sm:text-[0.875rem] font-bold shrink-0 ${done
                        ? "bg-[#6900AA] text-white"
                        : active
                          ? "bg-slate-900 text-white"
                          : "bg-white border border-slate-300 text-slate-400"
                      }`}
                  >
                    {done ? <Check size={12} strokeWidth={3} /> : s.displayN}
                  </span>
                  <span
                    className={`whitespace-nowrap text-[0.625rem] md:text-[0.8125rem] font-normal leading-tight ${active || done ? "text-slate-900" : "text-slate-400"
                      }`}
                  >
                    {s.n === 4 ? (
                      <>
                        <span className="md:hidden">{s.short}</span>
                        <span className="hidden md:inline xl:hidden">Confirm</span>
                        <span className="hidden xl:inline">{s.label}</span>
                      </>
                    ) : s.n === 3 ? (
                      <>
                        <span className="sm:hidden">{s.short}</span>
                        <span className="hidden sm:inline">{s.label}</span>
                      </>
                    ) : (
                      <>
                        <span className="sm:hidden">{s.short}</span>
                        <span className="hidden sm:inline">{s.label}</span>
                      </>
                    )}
                  </span>
                </button>
                {i < effectiveSteps.length - 1 && (
                  <ChevronRight
                    size={12}
                    className="text-slate-300 shrink-0 mx-0.5 sm:mx-1"
                    aria-hidden
                  />
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
    setQtyByType({});
    setSelectedSeats([]);
    setDesiredSeatQty(null);
    setSeatViewMode("canvas");
    setIsMapFullscreen(false);
    setAppliedPromo(null);
  };

  const applySelectedSeats = (seats: any[]) => {
    if (!seats.length) {
      setSelectedSeats([]);
      return;
    }

    const normalized = seats.map((s) => {
      const resolved = resolveSeatTicket({
        ...s,
        section_name: s.section_name || s.sectionName,
      });
      return {
        ...s,
        id: String(s.id),
        ticket_type_id: String(resolved?.id || s.ticket_type_id || ""),
        section_name: s.section_name || s.sectionName || resolved?.ticket_type || "",
        price: Number(resolved?.price) || Number(s.price) || Number(s.unit_price) || 0,
        unit_price: Number(resolved?.price) || Number(s.unit_price) || Number(s.price) || 0,
      };
    });

    const typeIds = [
      ...new Set(normalized.map((s) => String(s.ticket_type_id || "")).filter(Boolean)),
    ];
    let next = normalized;
    if (typeIds.length > 1) {
      // Keep the first seat's ticket type so existing picks are not wiped when
      // the user clicks a seat from another block/type.
      const keepType = String(normalized[0]?.ticket_type_id || typeIds[0]);
      next = normalized.filter((s) => String(s.ticket_type_id) === keepType);
      if (next.length < normalized.length) {
        toast.message("Please select seats from the same ticket type / block.");
      }
    }

    // In the reserved-seat flow the user already chose a seat count — allow that
    // many selections. Do not silently clamp to ticket max_per_order mid-map.
    const hardCap =
      desiredSeatQty != null
        ? Math.max(1, desiredSeatQty)
        : Math.max(
          1,
          Number(
            (
              pricingTicketPool.find((t) => t.id === String(next[0]?.ticket_type_id || "")) ||
              ticketTypes.find((t) => t.id === String(next[0]?.ticket_type_id || ""))
            )?.max_per_order
          ) || 10
        );

    if (next.length > hardCap) {
      next = next.slice(0, hardCap);
      toast.message(
        `You can select up to ${hardCap} seat${hardCap === 1 ? "" : "s"}.`
      );
    }
    setSelectedSeats(next);
    setQtyByType({});
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

  const handleHeaderBack = () => {
    if (step === 4) {
      requestLeaveConfirmStep("back");
    } else if (step === 3) {
      setStep(2);
      if (hasReservedSeats || showtimeHasSeatingLayout) {
        setIsMapFullscreen(true);
      }
    } else if (step === 2) {
      if (isSingleVenue) {
        onClose();
      } else {
        setStep(1);
      }
    } else {
      onClose();
    }
  };

  const panel = (
    <div
      className={
        isPage
          ? "relative w-full h-full min-h-0 flex flex-col overflow-hidden bg-[#F5F5F5]"
          : "relative h-full w-full max-w-[26.25rem] bg-white shadow-2xl flex flex-col"
      }
    >
      {isPage && (
        <div className="z-30 bg-white border-b border-slate-200 shrink-0">
          <div className="relative flex items-center min-h-[3.5rem] sm:min-h-[4rem] lg:min-h-[4.75rem]">
            <Link
              href="/"
              className="absolute left-3 sm:left-5 hidden lg:flex shrink-0 items-center z-[1]"
              title="Book My Bota"
            >
              <img
                src={typeof images.logo === "string" ? images.logo : images.logo.src}
                alt="Book My Bota"
                className="h-9 lg:h-11 w-auto object-contain object-left"
              />
            </Link>
            <div className={`mx-auto flex w-full items-center px-4 sm:px-5 ${step === 4 ? "max-w-6xl" : "max-w-[40rem]"}`}>
              <div className="relative flex w-full items-center justify-center py-2 sm:py-2.5">
                <button
                  type="button"
                  onClick={handleHeaderBack}
                  aria-label="Back"
                  className="absolute left-0 z-[1] h-9 w-9 rounded-full text-[#111] flex items-center justify-center hover:bg-slate-100 cursor-pointer shrink-0 transition-colors"
                >
                  <ArrowLeft size={22} strokeWidth={2} />
                </button>

                <div className="flex items-center justify-center gap-2.5 sm:gap-3 px-10 min-w-0 max-w-full">
                  {eventPosterUrl ? (
                    <img
                      src={eventPosterUrl}
                      alt={event.name}
                      className="h-10 w-7.5 sm:h-12 sm:w-9 shrink-0 rounded-md object-cover shadow-sm border border-slate-200/90"
                    />
                  ) : null}
                  <div className="min-w-0 text-left">
                    <h1 className="text-[1.05rem] sm:text-[1.2rem] font-bold leading-snug text-[#111] truncate">
                      {step === 4 ? "Review your booking" : event.name}
                    </h1>
                    {step === 4 ? (
                      <p className="text-xs text-slate-500 font-medium truncate">
                        {event.name}
                      </p>
                    ) : event.category_name ? (
                      <p className="text-xs text-slate-500 font-medium truncate">
                        {event.category_name}
                        {event.age_group ? ` · ${event.age_group}` : ""}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {pageStepper}
        </div>
      )}

      {isPage && step >= 2 && step < 4 && showtimeSummaryBar}

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

          <div className="mt-3 flex items-center gap-2.5 pt-3 border-t border-slate-100">
            {eventPosterUrl ? (
              <img
                src={eventPosterUrl}
                alt={event.name}
                className="h-10 w-7.5 shrink-0 rounded-md object-cover shadow-sm border border-slate-200/90"
              />
            ) : null}
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 truncate">
                {event.name}
              </h2>
              {event.category_name ? (
                <p className="text-xs text-slate-500 truncate">{event.category_name}</p>
              ) : null}
            </div>
          </div>

          <p className="mt-4 text-[0.8125rem] font-bold uppercase tracking-[0.14em] text-slate-400">
            Step {effectiveSteps.find((s) => s.n === step)?.displayN ?? 1} of {effectiveSteps.length}
            {isOrganizer ? " · Organizer sale" : ""}
          </p>

          <div className={`mt-4 grid gap-0.5 ${isSingleVenue ? "grid-cols-3" : "grid-cols-4"}`}>
            {effectiveSteps.map((s) => {
              const done = step > s.n;
              const active = step === s.n;
              const clickable = canNavigateToStep(s.n);
              return (
                <button
                  key={s.n}
                  type="button"
                  onClick={() => navigateToStep(s.n)}
                  disabled={!clickable}
                  aria-current={active ? "step" : undefined}
                  aria-label={`Go to ${s.short}`}
                  className={`flex flex-col items-center min-w-0 rounded-lg py-1 transition-opacity ${clickable
                      ? "cursor-pointer hover:opacity-75"
                      : active
                        ? "cursor-default"
                        : "cursor-not-allowed"
                    }`}
                >
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[0.9375rem] font-bold ${done || active
                        ? "bg-[#6900AA] text-white"
                        : "border-2 border-slate-200 text-slate-400 bg-white"
                      }`}
                  >
                    {done ? <Check size={14} strokeWidth={3} /> : s.displayN}
                  </span>
                  <span
                    className={`mt-1.5 text-[0.625rem] md:text-[0.6875rem] font-normal text-center leading-tight ${active || done ? "text-slate-900" : "text-slate-400"
                      }`}
                  >
                    {s.short}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        onScroll={handleCheckoutScroll}
        className={
          isPage
            ? `flex-1 min-h-0 overflow-y-auto overscroll-y-contain checkout-scrollbar${checkoutScrollActive ? " checkout-scrollbar-active" : ""} w-full ${step === 4 ? "max-w-6xl" : "max-w-[36rem]"} mx-auto px-4 sm:px-5 py-4 sm:py-5 pb-8`
            : `flex-1 min-h-0 overflow-y-auto checkout-scrollbar${checkoutScrollActive ? " checkout-scrollbar-active" : ""} px-5 py-5 bg-white`
        }
      >
        {showStepHeader && (
          <div className="mb-5">
            <h3 className="text-[0.9375rem] md:text-[1.0625rem] font-semibold text-gray-800 tracking-tight">
              {stepTitle}
            </h3>
            <p className="text-[0.9375rem] md:text-[1.0625rem] text-slate-500 mt-1.5 leading-relaxed">
              {stepSubtitle}
            </p>
          </div>
        )}

        {holdId && secondsLeft !== null && secondsLeft > 0 && !timeOutOpen && step < 4 && (
          <div
            className={`rounded-xl px-4 py-2.5 text-center text-sm font-bold border mb-4 ${secondsLeft <= 60
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : "bg-[#F3E8FF] border-[#E9D5FF] text-[#6B21A8]"
              }`}
          >
            <span className="inline-flex items-center gap-2">
              <Timer className="size-4" />
              Complete your booking in {formatHoldCountdown(secondsLeft)}
            </span>
          </div>
        )}

        {step === 1 && !isSingleVenue && (
          <div className="space-y-3">
            {cityVenueGroups.length === 0 ? (
              <p className="text-[1rem] text-slate-500">Showtimes coming soon.</p>
            ) : (
              cityVenueGroups.map(({ city, venues }) => {
                const openCity = expandedCity === city;
                return (
                  <div
                    key={city}
                    className={`relative rounded-[0.75rem] border overflow-hidden ${openCity ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50/70"
                      }`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedCity(openCity ? "" : city)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left cursor-pointer hover:bg-slate-50"
                    >
                      <span className="text-[0.9375rem] md:text-[1.0625rem] font-semibold text-gray-800">{city}</span>
                      {openCity ? (
                        <ChevronUp size={18} className="text-slate-500 shrink-0" />
                      ) : (
                        <ChevronDown size={18} className="text-slate-500 shrink-0" />
                      )}
                    </button>
                    {openCity && (
                      <div className="px-3 pb-5 space-y-2.5 border-t border-slate-100 pt-3">
                        {venues.map((venue) =>
                          venue.showtimes.map((s) => {
                            const status = showtimeFillingLabel(s);
                            const chip = dateChip(s.starts_at);
                            const mapsUrl = venue.address
                              ? venueMapsUrl({
                                latitude: venue.latitude,
                                longitude: venue.longitude,
                                address: venue.address,
                                name: venue.venueName,
                              })
                              : "";
                            const detailsOpen = venueDetailsId === s.id;
                            const canKnowMore = Boolean(venue.address);
                            return (
                              <div key={s.id} className={canKnowMore ? "pb-6" : ""}>
                                <div className="rounded-[0.625rem] border border-slate-200 bg-white">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (status.label === "Sold Out") {
                                        toast.message("This showtime is sold out.");
                                        return;
                                      }
                                      selectShowtime(s);
                                      setStep(2);
                                      if (
                                        (s as any).layout_mode === "standard" ||
                                        (s as any).layout_mode === "custom" ||
                                        Boolean((s as any).venue_layout_template_id) ||
                                        showtimeHasSeatingLayout
                                      ) {
                                        setIsMapFullscreen(true);
                                        setDesiredSeatQty((curr) => curr || 2);
                                        setSeatCountPick((curr) => curr || 2);
                                        setSeatQtyModalOpen(true);
                                      } else {
                                        setIsMapFullscreen(false);
                                      }
                                    }}
                                    className="w-full text-left px-3.5 py-3 cursor-pointer"
                                  >
                                    <p className="text-[0.9375rem] md:text-[1.0625rem] font-semibold text-gray-800">
                                      {venue.venueName}
                                    </p>
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
                                  </button>
                                  {detailsOpen && venue.address ? (
                                    <div className="px-3.5 pb-2">
                                      <div className="border-t border-slate-200 pt-3">
                                        <p className="text-[0.875rem] text-slate-600 leading-snug">
                                          {venue.address}
                                        </p>
                                        {mapsUrl ? (
                                          <button
                                            type="button"
                                            className="text-[0.725rem] font-medium text-[#e11d48] hover:underline cursor-pointer"
                                            onClick={() =>
                                              window.open(mapsUrl, "_blank", "noopener,noreferrer")
                                            }
                                          >
                                            View on maps
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : null}
                                  {canKnowMore ? (
                                    <button
                                      type="button"
                                      onClick={() => setVenueDetailsId(detailsOpen ? "" : s.id)}
                                      className="absolute left-3.5 bottom-8 z-[1] rounded-[0.3rem] translate-y-[62%] bg-[#E8E8E8] px-3 py-1.5 text-[0.8125rem] medium text-[#333] cursor-pointer"
                                    >
                                      {detailsOpen ? "Know less" : "Know more"}
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })
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

            {isLayoutLoading && !activeLayoutData ? (
              showtimeHasSeatingLayout ? (
                <div className="space-y-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5 animate-pulse">
                    <div className="text-center space-y-2">
                      <div className="h-5 w-44 bg-slate-200 rounded-lg mx-auto" />
                      <div className="h-4 w-72 max-w-full bg-slate-100 rounded-lg mx-auto" />
                    </div>
                    <div className="grid grid-cols-5 gap-2.5 max-w-sm mx-auto">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="h-12 rounded-xl bg-slate-100" />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 w-72 max-w-full bg-slate-100 rounded mb-2" />
                  {Array.from({ length: ticketTypes.length > 0 ? Math.min(ticketTypes.length, 4) : 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-[0.75rem] px-4 py-3.5 flex items-center justify-between gap-3 bg-white shadow-[0_0.125rem_0.75rem_rgba(15,23,42,0.06)] border border-slate-100"
                    >
                      <div className="min-w-0 space-y-2">
                        <div className="h-5 w-32 bg-slate-200 rounded" />
                        <div className="h-4 w-20 bg-slate-100 rounded" />
                        <div className="h-3 w-16 bg-slate-100 rounded" />
                      </div>
                      <div className="h-9 w-24 bg-slate-100 rounded-lg" />
                    </div>
                  ))}
                </div>
              )
            ) : hasReservedSeats ? (
              <div className="bg-white border border-slate-200 rounded-xl p-5 text-center space-y-4">
                <div>
                  <h4 className="text-[1.125rem] font-extrabold text-slate-900">
                    {selectedSeats.length}/{desiredSeatQty || 2} seat
                    {(desiredSeatQty || 2) === 1 ? "" : "s"} selected
                  </h4>
                  <p className="mt-1 text-[0.875rem] text-slate-500">
                    {seatsReady
                      ? "Seats locked in — continue when you are ready"
                      : "Open the map to choose your seats"}
                  </p>
                  {ticketAmount > 0 && (
                    <p className={`mt-2 text-[1.0625rem] font-bold ${accentIcon}`}>
                      {formatMoney(ticketAmount, { compact: true })}
                    </p>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMapFullscreen(true);
                      if (!desiredSeatQty) {
                        setDesiredSeatQty(2);
                        setSeatCountPick(2);
                        setSeatQtyModalOpen(true);
                      }
                    }}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-white ${accentBtn} cursor-pointer flex items-center justify-center gap-1.5`}
                  >
                    <MapIcon className="size-4" />
                    <span>{seatsReady ? "Review seating map" : "Select seats on map"}</span>
                  </button>
                  {desiredSeatQty != null && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMapFullscreen(true);
                        setSeatQtyModalOpen(true);
                      }}
                      className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 cursor-pointer"
                    >
                      Change seats ({desiredSeatQty})
                    </button>
                  )}
                </div>
              </div>
            ) : ticketTypes.length === 0 ? (
              <p className="text-[1rem] text-slate-500">No ticket types yet.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-[0.8125rem] text-slate-500">
                  Choose one ticket type. Selecting another type clears your current selection.
                </p>
                {ticketTypes.map((t) => {
                  const available = Number(t.available_count) || 0;
                  const total = Number(t.total_count) || 0;
                  const maxPerOrder = Math.max(1, Number((t as { max_per_order?: number }).max_per_order) || 10);
                  const maxQty = Math.min(available, maxPerOrder);
                  const qty = qtyByType[t.id] || 0;
                  const status = ticketAvail(available, total);
                  const soldOut = available <= 0;
                  return (
                    <div
                      key={t.id}
                      className={`rounded-[0.75rem] px-4 py-3.5 flex items-center justify-between gap-3 bg-white shadow-[0_0.125rem_0.75rem_rgba(15,23,42,0.06)] border ${qty > 0
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
                        {!soldOut && (
                          <p className="mt-1 text-[0.75rem] font-medium text-slate-500 normal-case">
                            Max {maxPerOrder} per order
                          </p>
                        )}
                      </div>
                      <div className="shrink-0">
                        {soldOut ? null : qty === 0 ? (
                          <button
                            type="button"
                            onClick={() => setQty(t.id, 1, maxQty)}
                            className="min-w-[4.75rem] px-3.5 py-2 rounded-[0.375rem] border-2 border-[#6900AA] text-[#6900AA] text-[1rem] font-bold cursor-pointer hover:bg-[#F7E9FF] transition-colors"
                          >
                            Add
                          </button>
                        ) : (
                          <div className="flex items-center gap-0 rounded-[0.375rem] border-2 border-[#6900AA] overflow-hidden bg-white">
                            <button
                              type="button"
                              onClick={() => setQty(t.id, qty - 1, maxQty)}
                              className="w-9 h-9 flex items-center justify-center text-[#6900AA] cursor-pointer hover:bg-[#F7E9FF]"
                            >
                              <Minus size={15} />
                            </button>
                            <span className="w-8 text-center font-bold text-[1.0625rem] text-slate-900">
                              {qty}
                            </span>
                            <button
                              type="button"
                              disabled={qty >= maxQty}
                              onClick={() => setQty(t.id, qty + 1, maxQty)}
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
          <div className="space-y-4 pb-2">
            <div>
              <p className="text-[0.9375rem] font-semibold text-gray-800 mb-1">
                How do you want your tickets?
              </p>
              {availableTicketModes.length === 1 && (
                <p className="text-[0.8125rem] text-slate-500">
                  This event only offers {availableTicketModes[0].label.toLowerCase()}.
                </p>
              )}
              <div className="space-y-2.5 mt-3">
                {availableTicketModes.map((option) => {
                  const Icon = ticketModeIcon(option.id);
                  const selected = ticketMode === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setTicketMode(option.id)}
                      className={`w-full text-left rounded-xl border p-4 transition-colors cursor-pointer ${selected
                          ? "border-[#6900AA] bg-[#FBF6FF]"
                          : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected
                              ? "border-[#6900AA] bg-[#6900AA]"
                              : "border-slate-300 bg-white"
                            }`}
                        >
                          {selected && <span className="h-2 w-2 rounded-full bg-white" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Icon size={16} className="text-[#6900AA] shrink-0" />
                            <p className="text-[1.0625rem] font-bold text-slate-900">
                              {option.label}
                            </p>
                            {option.recommended && (
                              <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-[#6900AA] bg-[#F7E9FF] px-2 py-0.5 rounded-full">
                                Recommended
                              </span>
                            )}
                          </div>
                          <p className="mt-1.5 text-[0.9375rem] text-slate-500 leading-relaxed">
                            {option.description}
                          </p>
                          <span
                            role="presentation"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTicketModeDetailsOpen(option.id);
                            }}
                            className="mt-2 inline-block text-[0.875rem] font-semibold text-[#6900AA] hover:underline cursor-pointer"
                          >
                            View details
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {ticketMode === "BOX_OFFICE" && selectedShowtime && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                <p className="text-[0.875rem] font-bold text-amber-900">Pickup location</p>
                <p className="mt-1 text-[0.9375rem] text-amber-950 font-semibold">
                  {selectedShowtime.venue_name || "Venue box office"}
                </p>
                {selectedShowtime.venue_address && (
                  <p className="mt-1 text-[0.875rem] text-amber-900/80">
                    {selectedShowtime.venue_address}
                  </p>
                )}
                <p className="mt-2 text-[0.8125rem] text-amber-900/70 leading-relaxed">
                  Arrive with your booking ID and photo ID. Counter opens about 60–90 minutes
                  before showtime.
                </p>
              </div>
            )}

            {ticketMode === "PHYSICAL_DELIVERY" && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <p className="text-[0.9375rem] font-bold text-slate-900">Delivery address</p>
                <div>
                  <label className="block text-[0.875rem] font-semibold text-slate-800 mb-1">
                    {reqStar} Street / house / area
                  </label>
                  <input
                    {...registerDelivery("delivery_address_line")}
                    className={`w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[0.9375rem] text-slate-900 focus:outline-none ${accentFocus} focus:ring-1 focus:ring-[#6900AA]/30`}
                    placeholder="e.g. Bole Road, Building 12, Apt 4"
                  />
                  {deliveryErrors.delivery_address_line && (
                    <p className={fieldErrorClass}>{deliveryErrors.delivery_address_line.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-[0.875rem] font-semibold text-slate-800 mb-1">
                    {reqStar} City
                  </label>
                  <input
                    {...registerDelivery("delivery_city")}
                    className={`w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[0.9375rem] text-slate-900 focus:outline-none ${accentFocus} focus:ring-1 focus:ring-[#6900AA]/30`}
                    placeholder="e.g. Addis Ababa"
                  />
                  {deliveryErrors.delivery_city && (
                    <p className={fieldErrorClass}>{deliveryErrors.delivery_city.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-[0.875rem] font-semibold text-slate-800 mb-1">
                    Delivery notes <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    {...registerDelivery("delivery_notes")}
                    rows={2}
                    className={`w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[0.9375rem] text-slate-900 focus:outline-none resize-none ${accentFocus} focus:ring-1 focus:ring-[#6900AA]/30`}
                    placeholder="Landmark, gate code, preferred time..."
                  />
                </div>
                <p className="text-[0.8125rem] text-slate-500 leading-relaxed">
                  Printed tickets are usually delivered in 3–5 business days within city limits.
                </p>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-4 pb-4">
              <p className="text-[0.9375rem] font-bold text-slate-900 mb-3">
                {isOrganizer ? "Customer contact" : "Sign in & contact details"}
              </p>

              {isOrganizer ? (
                <>
                  {contactDetailsReady ? (
                    <div className="space-y-1">
                      <p className="text-[0.875rem] font-semibold text-slate-800">{name}</p>
                      <p className="text-[0.875rem] text-slate-600">
                        {phone ? `+251 ${phone}` : "—"}
                      </p>
                      <p className="text-[0.875rem] text-slate-600 truncate">{email}</p>
                    </div>
                  ) : (
                    <p className="text-[0.875rem] text-slate-500">
                      Add customer name, phone, and email to send tickets.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={openContactModal}
                    className="mt-3 text-[0.875rem] font-semibold text-[#6900AA] hover:underline cursor-pointer"
                  >
                    {contactDetailsReady ? "Edit contact details" : "Add contact details"}
                  </button>
                </>
              ) : isCustomerLoggedIn ? (
                <>
                  <div className="space-y-1">
                    <p className="text-[0.875rem] font-semibold text-slate-800">
                      {name || authUser?.name}
                    </p>
                    <p className="text-[0.875rem] text-slate-600">
                      {phone ? `+251 ${phone}` : authUser?.phone ? `+251 ${authUser.phone}` : "—"}
                    </p>
                    <p className="text-[0.875rem] text-slate-600 truncate">
                      {email || authUser?.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openContactModal}
                    className="mt-3 text-[0.875rem] font-semibold text-[#6900AA] hover:underline cursor-pointer"
                  >
                    Edit contact details
                  </button>
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-[0.875rem] text-slate-500 leading-relaxed">
                    Sign in with your phone number to book tickets and receive your {ticketModeLabel(ticketMode)}.
                  </p>
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className="text-[0.875rem] font-semibold text-[#6900AA] hover:underline cursor-pointer"
                  >
                    Sign in with phone
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 4 && selectedShowtime && (
          <form id="event-checkout-form" onSubmit={handleConfirm} className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {holdId && secondsLeft !== null && (
              <div
                className={`lg:col-span-12 rounded-xl px-4 py-2.5 text-center text-sm font-bold border ${secondsLeft <= 60
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : "bg-[#F3E8FF] border-[#E9D5FF] text-[#6B21A8]"
                  }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Timer className="size-4" />
                  Complete your booking in {formatHoldCountdown(secondsLeft)}
                </span>
              </div>
            )}

            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4 sm:gap-6">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">{event.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {[
                        parseEventLanguages(event.language).join(", ") || event.language,
                        event.category_name,
                        event.duration_minutes
                          ? `${Math.floor(Number(event.duration_minutes) / 60)}h ${Number(event.duration_minutes) % 60}m`.replace(" 0m", "")
                          : "",
                      ].filter(Boolean).join("  •  ")}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-800">{selectedShowtime.venue_name || "Venue"}</p>
                    {selectedShowtime.venue_address ? (
                      <p className="mt-0.5 text-sm text-slate-500">{selectedShowtime.venue_address}</p>
                    ) : null}
                    {event.age_group ? (
                      <span className="mt-2 inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                        {event.age_group}
                      </span>
                    ) : null}
                  </div>
                  {eventPosterUrl ? (
                    <img
                      src={eventPosterUrl}
                      alt={event.name}
                      className="h-28 w-20 sm:h-32 sm:w-24 shrink-0 rounded-xl object-cover bg-slate-100 shadow-xs border border-slate-200/80"
                    />
                  ) : null}
                </div>

                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {getVenueDateTimeParts(selectedShowtime.starts_at)?.dateKey === venueDateStr()
                      ? `Today, ${formatDateCustomer(selectedShowtime.starts_at)}`
                      : formatDateCustomer(selectedShowtime.starts_at)}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {formatTime12h(selectedShowtime.starts_at)}
                    {selectedShowtime.ends_at ? ` – ${formatTime12h(selectedShowtime.ends_at)}` : ""}
                  </p>
                </div>

                <div className="mt-3 flex items-start justify-between gap-4 border-t border-slate-100 pt-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {ticketQty} ticket{ticketQty === 1 ? "" : "s"}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {[
                        selectedLines.map((l) => l.ticket_type).filter(Boolean).join(", "),
                        selectedSeats
                          .map((s) => `${s.row_label || s.row || ""}${s.seat_label || s.number || ""}`.trim())
                          .filter(Boolean)
                          .join(", "),
                      ].filter(Boolean).join("  •  ")}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-slate-900">{formatMoney(ticketAmount)}</p>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{ticketModeLabel(ticketMode)}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{ticketModeConfirmNote(ticketMode)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToStep(3)}
                    className="shrink-0 text-sm font-semibold text-slate-900 hover:underline cursor-pointer"
                  >
                    Change
                  </button>
                </div>

                {ticketMode === "PHYSICAL_DELIVERY" && (
                  <p className="mt-3 text-sm text-slate-600">
                    {deliveryAddressLine}
                    {deliveryCity ? `, ${deliveryCity}` : ""}
                    {deliveryNotes ? ` · ${deliveryNotes}` : ""}
                  </p>
                )}

                {ticketMode === "BOX_OFFICE" && (
                  <p className="mt-3 text-sm text-slate-600">
                    {[selectedShowtime.venue_name, selectedShowtime.venue_address].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>

              {!isOrganizer && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
                  <h2 className="text-base font-bold text-slate-900">Offers for you</h2>
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Promo code</p>
                    {appliedPromo ? (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-xs">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 font-mono truncate">
                            {appliedPromo.promo_code}
                            {appliedPromo.source === "platform" ? " · BookMyBota" : ""}
                          </p>
                          <p className="text-emerald-600">You save {formatMoney(appliedPromo.discount_amount)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemovePromo}
                          className="text-xs text-rose-600 hover:underline font-semibold cursor-pointer shrink-0"
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
                          placeholder="Enter promo code"
                          className={`flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 uppercase placeholder:text-slate-400 focus:outline-none ${accentFocus}`}
                        />
                        <button
                          type="button"
                          onClick={handleApplyPromo}
                          disabled={validatingPromo || !promoInput.trim()}
                          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 border border-slate-200 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                        >
                          {validatingPromo ? <Loader2 className="size-3.5 animate-spin" /> : null}
                          Apply
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Gift card</p>
                    {appliedGiftCard ? (
                      <div className="flex items-center justify-between gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {appliedGiftCard.product_name} · {appliedGiftCard.code_masked}
                          </p>
                          <p className="text-[11px] text-rose-700">
                            Applying {formatMoney(appliedGiftCard.amount_applicable)}
                            {appliedGiftCard.balance_after > 0
                              ? ` · ${formatMoney(appliedGiftCard.balance_after)} left after`
                              : " · balance will be zero"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveGiftCard}
                          className="text-xs font-semibold text-rose-600 hover:underline shrink-0 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {redeemableGiftCards.length > 0 && (
                          <select
                            value={selectedGiftCardId}
                            onChange={(e) => {
                              setSelectedGiftCardId(e.target.value);
                              if (e.target.value) setGiftCardInput("");
                            }}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                          >
                            <option value="">Select from My Gift Cards</option>
                            {redeemableGiftCards.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.product_name || "Gift Card"} · {c.code_masked} · {formatMoney(Number(c.current_balance))}
                              </option>
                            ))}
                          </select>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={giftCardInput}
                            onChange={(e) => {
                              setGiftCardInput(e.target.value.toUpperCase());
                              if (e.target.value) setSelectedGiftCardId("");
                            }}
                            placeholder="Or enter gift card code"
                            className={`flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 font-mono uppercase placeholder:text-slate-400 focus:outline-none ${accentFocus}`}
                          />
                          <button
                            type="button"
                            onClick={handleApplyGiftCard}
                            disabled={
                              validatingGiftCard ||
                              (!selectedGiftCardId && !giftCardInput.trim()) ||
                              orderTotal <= 0
                            }
                            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 border border-slate-200 disabled:opacity-50 cursor-pointer"
                          >
                            {validatingGiftCard ? <Loader2 className="size-3.5 animate-spin" /> : "Apply"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <aside className="lg:col-span-5 space-y-4 lg:sticky lg:top-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-bold text-slate-900">Payment summary</h2>
                <div className="mt-4 space-y-3 text-sm">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-slate-700 [&::-webkit-details-marker]:hidden">
                      <span className="inline-flex items-center gap-1">
                        Order amount
                        <ChevronDown className="size-3.5 text-slate-400 transition-transform group-open:rotate-180" />
                      </span>
                      <span className="font-semibold text-slate-900">{formatMoney(ticketAmount)}</span>
                    </summary>
                    <div className="mt-2 space-y-1.5 text-xs leading-snug text-slate-500">
                      {selectedLines.map((line) => (
                        <p key={`${line.ticket_type}-${line.unit}`}>
                          {line.qty} × {line.ticket_type} ticket{line.qty === 1 ? "" : "s"} @ {formatMoney(line.unit)}
                          <span className="block">each</span>
                        </p>
                      ))}
                    </div>
                  </details>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-slate-700 [&::-webkit-details-marker]:hidden">
                      <span className="inline-flex items-center gap-1">
                        Convenience fees
                        <ChevronDown className="size-3.5 text-slate-400 transition-transform group-open:rotate-180" />
                      </span>
                      <span className="font-semibold text-slate-900">{formatMoney(convenienceFee)}</span>
                    </summary>
                    <div className="mt-2 space-y-1.5 text-xs text-slate-500">
                      <div className="flex justify-between gap-4">
                        <span>Base Amount</span>
                        <span>{formatMoney(convenienceFeeBase)}</span>
                      </div>
                      {convenienceFeeTax > 0 ? (
                        <div className="flex justify-between gap-4">
                          <span>VAT @ {convenienceVatPct}%</span>
                          <span>{formatMoney(convenienceFeeTax)}</span>
                        </div>
                      ) : null}
                    </div>
                  </details>
                  {discountAmount > 0 ? (
                    <div className="flex justify-between text-emerald-700">
                      <span>Promo discount</span>
                      <span className="font-semibold">−{formatMoney(discountAmount)}</span>
                    </div>
                  ) : null}
                  {giftCardAmount > 0 ? (
                    <div className="flex justify-between text-emerald-700">
                      <span>Gift card</span>
                      <span className="font-semibold">−{formatMoney(giftCardAmount)}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-base font-bold text-slate-900">
                    <span>{giftCardAmount > 0 ? "Amount due" : "To be paid"}</span>
                    <span>{formatMoney(grandTotal)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-slate-900">Your details</h2>
                  <button
                    type="button"
                    onClick={openContactModal}
                    className="text-sm font-semibold text-slate-900 hover:underline cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
                <div className="mt-3 flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <User className="size-4" />
                  </span>
                  <div className="min-w-0 text-sm leading-5">
                    <p className="font-semibold text-slate-900">{name.trim() || "Add your name"}</p>
                    <p className="text-slate-500">{phone ? `+251 ${phone}` : "Add your phone number"}</p>
                    <p className="truncate text-slate-500">{email.trim() || "Add your email"}</p>
                  </div>
                </div>
              </div>

              {!isOrganizer && (
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                  <Banknote className="size-4 shrink-0 text-slate-500" />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">Cash</p>
                    <p className="text-xs text-slate-500">Pay at the venue</p>
                  </div>
                  <CheckCircle2 className="ml-auto size-4 shrink-0 text-emerald-600" />
                </div>
              )}

              <button
                type="submit"
                disabled={!canConfirm || submitting}
                aria-busy={submitting || undefined}
                className="flex w-full items-center justify-between rounded-xl bg-black px-5 py-3.5 text-white disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                <span className="text-left">
                  <span className="block text-sm font-bold">{formatMoney(grandTotal)}</span>
                  <span className="block text-[10px] font-semibold tracking-wide text-white/70">TOTAL</span>
                </span>
                <span className="text-sm font-bold inline-flex items-center gap-2">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  {submitting ? "Confirming…" : isOrganizer ? "Confirm & Send" : "Pay now"}
                </span>
              </button>
            </aside>
          </form>
        )}
      </div>

      {step !== 1 && (
        <div
          className={
            isPage
              ? "relative z-20 shrink-0 w-full bg-[#F0F0F0] border-t border-slate-200 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] px-4 pt-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]"
              : "p-5 border-t border-slate-100 bg-white shrink-0"
          }
        >
          <div className={isPage ? (step === 4 ? "max-w-6xl mx-auto" : "max-w-[36rem] mx-auto") : ""}>
            {step === 2 && (
              <>
                {isPage && (hasReservedSeats ? seatsReady : ticketQty > 0) ? (
                  <div className="flex items-end gap-3">
                    <button
                      type="button"
                      onClick={() => (isSingleVenue ? onClose() : setStep(1))}
                      className="shrink-0 px-4 py-3 rounded-[0.5rem] border border-slate-300 bg-white text-slate-700 font-semibold text-[1rem] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft size={14} /> Back
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 text-right">
                        <p className="text-[0.9375rem] text-slate-500">
                          {ticketQty} Ticket{ticketQty === 1 ? "" : "s"}
                          {hasReservedSeats && desiredSeatQty != null
                            ? ` · ${selectedSeats.length}/${desiredSeatQty} seats`
                            : ""}
                        </p>
                        <p className="text-[1.25rem] font-extrabold text-slate-900 leading-tight">
                          {formatMoney(ticketAmount, { compact: true })}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!seatsReady}
                        onClick={proceedFromTickets}
                        className={`w-full py-3 rounded-[0.5rem] ${accentBtn} disabled:bg-slate-300 disabled:text-white disabled:hover:bg-slate-300 text-white font-semibold text-[1.0625rem] cursor-pointer disabled:cursor-not-allowed`}
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                ) : isPage ? (
                  null
                  /* Back + Choose seat count footer (commented out — UI only)
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-4 py-3 rounded-[0.5rem] border border-slate-300 bg-white text-slate-700 font-semibold text-[1rem] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft size={14} /> Back
                    </button>
                    <button
                      type="button"
                      disabled={!seatsReady}
                      onClick={proceedFromTickets}
                      className={`flex-1 py-3 rounded-[0.5rem] ${accentBtn} disabled:bg-slate-300 disabled:text-white disabled:hover:bg-slate-300 text-white font-semibold text-[1.0625rem] cursor-pointer disabled:cursor-not-allowed`}
                    >
                      {hasReservedSeats && desiredSeatQty == null
                        ? "Choose seat count"
                        : hasReservedSeats
                          ? `Select ${desiredSeatQty} seat${desiredSeatQty === 1 ? "" : "s"}`
                          : "Continue"}
                    </button>
                  </div>
                  */
                ) : (
                  <>
                    {ticketQty > 0 && (
                      <div className="mb-2.5 flex items-end justify-end gap-3">
                        <div className="min-w-0 text-right">
                          <p className="text-[0.9375rem] text-slate-500">
                            {ticketQty} Ticket{ticketQty === 1 ? "" : "s"}
                          </p>
                          <p className="text-[1.25rem] font-extrabold text-slate-900">
                            {formatMoney(ticketAmount, { compact: true })}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-[1rem] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowLeft size={14} /> Back
                      </button>
                      <button
                        type="button"
                        disabled={!seatsReady}
                        onClick={proceedFromTickets}
                        className={`flex-1 py-3 rounded-xl ${accentBtn} disabled:bg-slate-300 disabled:text-white disabled:hover:bg-slate-300 text-white font-semibold text-[1.0625rem] inline-flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed`}
                      >
                        Continue
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
            {step === 3 && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className={`px-4 py-3 border text-slate-700 font-semibold text-[1rem] inline-flex items-center gap-1 cursor-pointer ${isPage
                      ? "rounded-[0.5rem] border-slate-300 bg-white"
                      : "rounded-xl border-slate-200"
                    }`}
                >
                  <ArrowLeft size={14} /> Back
                </button>
                {!isOrganizer && !isCustomerLoggedIn ? (
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    disabled={!ticketMode || !deliveryDetailsReady}
                    className={`flex-1 py-3 ${accentBtn} disabled:bg-slate-300 disabled:text-white text-white font-semibold text-[1.0625rem] cursor-pointer disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 ${
                      isPage ? "rounded-[0.5rem]" : "rounded-xl"
                    }`}
                  >
                    Sign in with phone
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void proceedToReview()}
                    disabled={!canProceedFromTicketMode || holding}
                    className={`flex-1 py-3 ${accentBtn} disabled:bg-slate-300 disabled:text-white disabled:hover:bg-slate-300 text-white font-semibold text-[1.0625rem] cursor-pointer disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 ${
                      isPage ? "rounded-[0.5rem]" : "rounded-xl disabled:bg-[#E3BCFF] disabled:hover:bg-[#E3BCFF]"
                    }`}
                  >
                    {holding ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Holding seats…
                      </>
                    ) : (
                      "Continue to review"
                    )}
                  </button>
                )}
              </div>
            )}
            {step === 4 && (
              <div className="flex">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setStep(3)}
                  className={`px-4 py-3 border text-slate-700 font-semibold text-[1rem] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${isPage
                      ? "rounded-[0.5rem] border-slate-300 bg-white"
                      : "rounded-xl border-slate-200"
                    }`}
                >
                  <ArrowLeft size={14} /> Back
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const ticketModeSubtitle =
    selectedLines.length > 0
      ? selectedLines
        .map((l) => `${String(l.ticket_type || "Ticket").toUpperCase()} (${l.qty} ticket(s))`)
        .join(", ")
      : `ENTRY FOR ${ticketQty} (${ticketQty} ticket(s))`;

  const saveContactDetails = handleContactModalSubmit((values) => {
    resetContact({
      name: values.name.trim(),
      phone: sanitizePhoneInput(values.phone),
      email: values.email.trim(),
    });
    setContactModalOpen(false);
  });

  const checkoutModals = (
    <>
      {bookedSuccessId ? (
        <PaymentSuccessView
          presentation="modal"
          module="events"
          bookingId={bookedSuccessId}
          nextHref={`/customer/event-bookings/confirmation?id=${bookedSuccessId}`}
        />
      ) : null}
      {isMapFullscreen && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col overflow-hidden">
          <header className="shrink-0 bg-white border-b border-slate-200">
            <div className="px-3 sm:px-4 py-1.5 md:max-lg:py-2.5 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsMapFullscreen(false);
                  if (isSingleVenue) {
                    onClose();
                  } else {
                    setStep(1);
                  }
                }}
                className="h-8 w-8 md:max-lg:h-9 md:max-lg:w-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-700 cursor-pointer hover:bg-slate-50 shrink-0"
                aria-label="Back from seating map"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-[0.9375rem] md:max-lg:text-[1.125rem] lg:text-[0.9375rem] text-slate-900 truncate leading-tight">
                  {event.name}
                </h3>
                <p className="text-[0.6875rem] md:max-lg:text-[0.8125rem] lg:text-[0.6875rem] text-slate-500 truncate leading-tight">
                  {[
                    selectedShowtime?.venue_name,
                    selectedShowtime?.starts_at
                      ? formatTime12h(selectedShowtime.starts_at)
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!isStadiumLayout && (
                  <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-md border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setSeatViewMode("canvas")}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] md:max-lg:text-[12px] lg:text-[10px] font-bold transition-all cursor-pointer ${seatViewMode === "canvas"
                          ? "bg-[#6900AA] text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-900"
                        }`}
                    >
                      <MapIcon className="size-3" />
                      <span className="hidden sm:inline">Map</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeatViewMode("grid")}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] md:max-lg:text-[12px] lg:text-[10px] font-bold transition-all cursor-pointer ${seatViewMode === "grid"
                          ? "bg-[#6900AA] text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-900"
                        }`}
                    >
                      <LayoutGrid className="size-3" />
                      <span className="hidden sm:inline">Grid</span>
                    </button>
                  </div>
                )}
                {holdId && secondsLeft !== null && secondsLeft > 0 && !timeOutOpen && (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${secondsLeft <= 60
                        ? "bg-rose-50 border-rose-200 text-rose-700"
                        : "bg-[#F3E8FF] border-[#E9D5FF] text-[#6B21A8]"
                      }`}
                  >
                    <Timer className="size-3.5" />
                    {formatHoldCountdown(secondsLeft)}
                  </span>
                )}
                <p className="text-[0.8125rem] md:max-lg:text-[1rem] lg:text-[0.8125rem] font-extrabold text-[#6900AA] tabular-nums">
                  {selectedSeats.length}/{desiredSeatQty || 2}
                </p>
                {selectedSeats.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSeats([]);
                      toast.info("Cleared all selected seats");
                    }}
                    className="text-[0.6875rem] md:max-lg:text-[0.8125rem] lg:text-[0.6875rem] font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                  >
                    Clear all
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSeatQtyModalOpen(true);
                  }}
                  className="text-[0.6875rem] md:max-lg:text-[0.8125rem] lg:text-[0.6875rem] font-semibold text-[#6900AA] hover:underline cursor-pointer"
                >
                  Change
                </button>
              </div>
            </div>
          </header>

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white">
            {seatViewMode === "canvas" || isStadiumLayout ? (
              <div className="flex-1 min-h-0 h-full w-full">
                {isStadiumLayout ? (
                  <StadiumLayoutViewer
                    eventId={event.id}
                    ticketTypes={Array.from(
                      new Map(
                        [...ticketTypes, ...allTicketTypes, ...pricingTicketPool]
                          .map((t: any) => {
                            const id = String(t?.ticket_type_id ?? t?.id ?? "").trim();
                            if (!id) return null;
                            return [
                              id,
                              {
                                id,
                                name: String(t?.ticket_type ?? t?.name ?? "Ticket"),
                                price: Number(t?.price) || 0,
                                currency: (t as any)?.currency,
                              },
                            ] as const;
                          })
                          .filter(Boolean) as Array<
                            readonly [string, { id: string; name: string; price: number; currency?: string }]
                          >
                      ).values()
                    )}
                    onSeatsSelected={handleMapSeatsSelected}
                    initialSelectedSeats={selectedSeats}
                    maxSelectable={desiredSeatQty ?? undefined}
                    hideBookingBar
                  />
                ) : (
                  <VenueLayoutViewer
                    layoutData={activeLayoutData}
                    ticketTypes={ticketTypes}
                    onSeatsSelected={handleMapSeatsSelected}
                    initialSelectedSeats={selectedSeats}
                    maxSelectable={desiredSeatQty ?? undefined}
                    cinemaMode
                    hideSidePanel
                    mapTitle="Event seating map"
                    mapDescription={`Live seating layout for this event. Pick up to ${desiredSeatQty} seats directly on the map.`}
                    customLegend={ticketTypes.map((t) => ({
                      name: t.ticket_type,
                      color: "#6900AA",
                      price: Number(t.price) || 0,
                    }))}
                  />
                )}
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-auto px-3 sm:px-5 py-4">
                <div className="flex flex-wrap items-center justify-center gap-5 py-2.5 px-4 mb-4 rounded-2xl bg-white border border-slate-200 text-xs shadow-sm sticky top-0 z-[1]">
                  <div className="flex items-center gap-2">
                    <div className="size-4 rounded-md bg-white border border-slate-300" />
                    <span className="text-slate-600">Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="size-4 rounded-md bg-[#6900AA]" />
                    <span className="text-slate-900 font-bold">Selected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="size-4 rounded-md bg-slate-200 border border-slate-300 relative">
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500">
                        ✕
                      </span>
                    </div>
                    <span className="text-slate-500">Sold / Held</span>
                  </div>
                </div>

                {eventGridLayout.bands.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                    No seats available in grid view.
                  </div>
                ) : (
                  <div className="w-full max-w-[1400px] mx-auto space-y-5">
                    {eventGridLayout.hasStage && eventGridLayout.stageAtTop && (
                      <div className="text-center space-y-2 px-4">
                        <p className="text-[0.6875rem] uppercase tracking-[0.2em] font-extrabold text-slate-500">
                          Stage
                        </p>
                        <div className="relative mx-auto w-[min(92%,42rem)] h-2.5">
                          <div className="absolute inset-0 rounded-[50%] border-b-4 border-[#6900AA] shadow-[0_8px_18px_rgba(105,0,170,0.2)]" />
                        </div>
                      </div>
                    )}

                    {eventGridLayout.bands.map((band, bandIdx) => (
                      <div
                        key={`band-${bandIdx}`}
                        className={`grid gap-4 ${band.sections.length === 1
                            ? "grid-cols-1"
                            : band.sections.length === 2
                              ? "grid-cols-1 md:grid-cols-2"
                              : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                          }`}
                      >
                        {band.sections.map((section) => (
                          <section
                            key={section.sectionName}
                            className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm overflow-x-auto"
                          >
                            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5 mb-3">
                              <h4 className="text-[0.75rem] sm:text-[0.8125rem] font-extrabold uppercase tracking-wider text-[#6900AA]">
                                {section.sectionName}
                              </h4>
                              {section.price > 0 && (
                                <span className="shrink-0 text-[0.75rem] font-extrabold text-slate-900 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                                  {formatMoney(section.price, { compact: true })}
                                </span>
                              )}
                            </div>

                            <div className="space-y-1.5 min-w-max mx-auto">
                              {section.rows.map((row) => (
                                <div
                                  key={`${section.sectionName}-${row.rowLabel}`}
                                  className="flex items-center gap-2"
                                >
                                  <span className="w-5 text-center text-[0.6875rem] font-bold text-slate-500 shrink-0">
                                    {row.rowLabel}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {row.seats.map((seat) => {
                                      const isSelected = selectedSeats.some(
                                        (s) => String(s.id) === seat.id
                                      );
                                      return (
                                        <div
                                          key={seat.id}
                                          className="flex items-center"
                                          style={
                                            seat.gapAfter
                                              ? { marginRight: `${seat.gapAfter * 0.55}rem` }
                                              : undefined
                                          }
                                        >
                                          <button
                                            type="button"
                                            disabled={seat.isBooked}
                                            onClick={() => toggleGridSeat(seat)}
                                            className={`size-7 sm:size-8 rounded-md text-[10px] sm:text-[11px] font-bold transition-all duration-150 flex items-center justify-center select-none ${seat.isBooked
                                                ? "bg-slate-200 border border-slate-300 text-slate-400 cursor-not-allowed"
                                                : isSelected
                                                  ? "bg-[#6900AA] text-white border border-[#6900AA]/40 shadow-md scale-105 z-10"
                                                  : "bg-white border border-slate-300 text-slate-700 hover:bg-[#F7E9FF] hover:border-[#6900AA]/40 cursor-pointer"
                                              }`}
                                            title={`${section.sectionName} · ${seat.row}${seat.number}`}
                                          >
                                            {seat.number}
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <span className="w-5 text-center text-[0.6875rem] font-bold text-slate-500 shrink-0">
                                    {row.rowLabel}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    ))}

                    {eventGridLayout.hasStage && !eventGridLayout.stageAtTop && (
                      <div className="text-center space-y-2 px-4 pt-2">
                        <div className="relative mx-auto w-[min(92%,42rem)] h-2.5">
                          <div className="absolute inset-0 rounded-[50%] border-t-4 border-[#6900AA] shadow-[0_-8px_18px_rgba(105,0,170,0.2)]" />
                        </div>
                        <p className="text-[0.6875rem] uppercase tracking-[0.2em] font-extrabold text-slate-500">
                          Stage
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <footer className="shrink-0 bg-white border-t border-slate-200 px-3 sm:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.1)]">
            <div className="max-w-5xl mx-auto flex items-center gap-2.5 sm:gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[0.75rem] sm:text-[0.8125rem] md:max-lg:text-[0.9375rem] lg:text-[0.8125rem] text-slate-500 font-medium">
                    {selectedSeats.length === 0
                      ? `Select ${desiredSeatQty || 2} seat${(desiredSeatQty || 2) === 1 ? "" : "s"}`
                      : `${selectedSeats.length}/${desiredSeatQty || 2} selected`}
                  </p>
                  {selectedSeats.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSeats([]);
                        toast.info("Cleared all selected seats");
                      }}
                      className="text-[11px] md:max-lg:text-[13px] lg:text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                {selectedSeats.length > 0 && (
                  <p className="text-[11px] md:max-lg:text-[13px] lg:text-[11px] text-slate-400 truncate mt-0.5 hidden sm:block">
                    {selectedSeats
                      .map((s: any) => `${s.row_label || s.row || ""}${s.seat_label || s.number || ""}`)
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                <p className="text-[1.125rem] sm:text-[1.375rem] md:max-lg:text-[1.5rem] lg:text-[1.375rem] font-extrabold text-slate-900 leading-tight mt-0.5">
                  {formatMoney(ticketAmount, { compact: true })}
                </p>
              </div>
              <button
                type="button"
                disabled={selectedSeats.length !== (desiredSeatQty || 2)}
                onClick={() => {
                  const targetQty = desiredSeatQty || 2;
                  if (selectedSeats.length !== targetQty) {
                    toast.error(
                      `Please select exactly ${targetQty} seat${targetQty === 1 ? "" : "s"}.`
                    );
                    return;
                  }
                  setIsMapFullscreen(false);
                  proceedFromTickets();
                }}
                className={`shrink-0 min-w-[7.5rem] sm:min-w-[12rem] px-4 sm:px-5 py-3 sm:py-3.5 ${accentBtn} text-white font-bold text-[0.9375rem] sm:text-[1.0625rem] md:max-lg:text-[1.125rem] lg:text-[1.0625rem] rounded-xl cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed`}
              >
                {selectedSeats.length === (desiredSeatQty || 2) ? "Continue" : "Select seats"}
              </button>
            </div>
          </footer>

          {seatQtyModalOpen && (
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[1px]"
              role="dialog"
              aria-modal="true"
              onClick={() => {
                if (desiredSeatQty) setSeatQtyModalOpen(false);
              }}
            >
              <div
                className="w-full max-w-[28rem] rounded-2xl bg-white p-6 sm:p-7 shadow-2xl space-y-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center">
                  <h3 className="text-[1.1875rem] sm:text-[1.3125rem] font-bold text-gray-900">
                    How many seats?
                  </h3>
                  <p className="mt-1 text-[0.875rem] text-slate-500">
                    Pick a count, then choose your seats on the full seating map
                  </p>
                </div>

                <div className="grid grid-cols-5 gap-2.5 max-w-sm mx-auto">
                  {Array.from({ length: maxSeatQtyPick }, (_, i) => i + 1).map((n) => {
                    const isSelected = (seatCountPick ?? desiredSeatQty ?? 2) === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setDesiredSeatQty(n);
                          setSeatCountPick(n);
                          if (selectedSeats.length > n) {
                            setSelectedSeats((prev) => prev.slice(0, n));
                          }
                          setSeatQtyModalOpen(false);
                        }}
                        className={`h-12 rounded-xl text-base font-semibold cursor-pointer transition-all flex items-center justify-center ${
                          isSelected
                            ? "bg-[#EDE4F7] text-[#6900AA] ring-2 ring-[#6900AA]/20 shadow-sm font-bold"
                            : "bg-[#F5F5F5] text-[#333] hover:bg-[#EDE4F7] hover:text-[#6900AA]"
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {ticketModeDetailsOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50"
          onClick={() => setTicketModeDetailsOpen(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ticket-mode-title"
            className="relative w-full sm:max-w-[26rem] rounded-t-[1rem] sm:rounded-[0.75rem] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-slate-100">
              <div className="min-w-0">
                <h3 id="ticket-mode-title" className="text-[1.4375rem] font-extrabold text-slate-800">
                  {ticketModeLabel(ticketModeDetailsOpen)}
                </h3>
                <p className="mt-1 text-[0.875rem] font-semibold uppercase tracking-wide text-slate-400">
                  {ticketModeSubtitle}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setTicketModeDetailsOpen(null)}
                className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer hover:bg-slate-200 shrink-0"
              >
                <X size={16} />
              </button>
            </div>
            <ul className="px-5 py-4 space-y-3 text-[1rem] text-slate-700 leading-relaxed list-disc pl-8 pb-6">
              {ticketModeDetailBullets(ticketModeDetailsOpen).map((line) => (
                <li key={line}>{line}</li>
              ))}
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

            <form onSubmit={saveContactDetails} className="px-5 py-5 space-y-5" noValidate>
              <div>
                <label className="block text-[1rem] font-bold text-slate-900 mb-1.5">
                  {reqStar} Your name
                </label>
                <input
                  {...registerContactModal("name")}
                  className="w-full rounded-[0.375rem] border border-slate-300 px-3 py-2.5 text-[1.0625rem] text-slate-900 focus:outline-none focus:border-[#6900AA] focus:ring-1 focus:ring-[#6900AA]/30"
                  placeholder="Full name"
                />
                {contactModalErrors.name && (
                  <p className={fieldErrorClass}>{contactModalErrors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-[1rem] font-bold text-slate-900 mb-1.5">
                  {reqStar} Your email
                </label>
                <input
                  type="email"
                  {...registerContactModal("email")}
                  className="w-full rounded-[0.375rem] border border-slate-300 px-3 py-2.5 text-[1.0625rem] text-slate-900 focus:outline-none focus:border-[#6900AA] focus:ring-1 focus:ring-[#6900AA]/30"
                  placeholder="you@email.com"
                />
                {contactModalErrors.email && (
                  <p className={fieldErrorClass}>{contactModalErrors.email.message}</p>
                )}
                <p className="mt-1.5 text-[0.875rem] text-slate-500">
                  To access the ticket(s) on other devices, login with this email
                </p>
              </div>

              <div>
                <label className="block text-[1rem] font-bold text-slate-900 mb-1.5">
                  {reqStar} Mobile Number
                </label>
                <div className="flex items-center gap-2 rounded-[0.375rem] border border-slate-300 px-3 bg-white focus-within:border-[#6900AA] focus-within:ring-1 focus-within:ring-[#6900AA]/30">
                  <span className="inline-flex items-center gap-1 text-[1rem] font-semibold text-slate-700 shrink-0">
                    +251
                    <ChevronDown size={12} className="text-slate-400" />
                  </span>
                  <span className="w-px h-5 bg-slate-200 shrink-0" />
                  <Controller
                    name="phone"
                    control={contactModalControl}
                    render={({ field }) => (
                      <input
                        type="tel"
                        value={field.value || ""}
                        onChange={(e) => field.onChange(sanitizePhoneInput(e.target.value))}
                        onBlur={field.onBlur}
                        inputMode="numeric"
                        maxLength={12}
                        className="flex-1 bg-transparent py-2.5 text-[1.0625rem] focus:outline-none text-slate-900 min-w-0"
                        placeholder="Mobile number"
                      />
                    )}
                  />
                </div>
                {contactModalErrors.phone && (
                  <p className={fieldErrorClass}>{contactModalErrors.phone.message}</p>
                )}
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
                type="submit"
                className={`w-full py-3 rounded-[0.5rem] ${accentBtn} text-white text-[1.125rem] font-bold cursor-pointer`}
              >
                Submit
              </button>
            </form>
          </div>
        </div>
      )}

      {cancelTxnOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-5 bg-black/45"
          onClick={() => !releasingHold && setCancelTxnOpen(false)}
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
              Cancel booking?
            </h3>
            <p className="mt-3 text-center text-[1rem] text-slate-500 leading-relaxed">
              {hasReservedSeats
                ? "Your selected seats will be unblocked and may not be available later if you cancel."
                : "Your ticket selection may not be available later if you cancel."}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={releasingHold}
                onClick={() => void confirmCancelTransaction()}
                className="py-2.5 rounded-[0.5rem] border border-[#6900AA] text-[#6900AA] text-[1.0625rem] font-bold cursor-pointer hover:bg-[#F7E9FF] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {releasingHold ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Cancelling…
                  </>
                ) : (
                  "Yes, Cancel"
                )}
              </button>
              <button
                type="button"
                disabled={releasingHold}
                onClick={() => setCancelTxnOpen(false)}
                className="py-2.5 rounded-[0.5rem] bg-[#6900AA] text-white text-[1.0625rem] font-bold cursor-pointer hover:bg-[#57008E] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {timeOutOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 text-center">
            <AlertCircle className="size-12 text-[#6900AA] mx-auto" />
            <h3 className="text-xl font-extrabold text-slate-900">Your time is out</h3>
            <p className="text-sm text-slate-500">
              Your seat hold has expired. Please select your seats again to continue booking.
            </p>
            <button
              type="button"
              disabled={releasingHold}
              onClick={() => void resetToSeatsAfterTimeout()}
              className="w-full py-3 rounded-xl bg-[#6900AA] hover:bg-[#57008E] text-white text-sm font-extrabold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {releasingHold ? (
                <Loader2 size={16} className="animate-spin" aria-label="Try Again" />
              ) : (
                "Try Again"
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );

  if (isPage) {
    return (
      <>
        {panel}
        {checkoutModals}
        {!isOrganizer && (
          <CustomerAuthModal
            open={authModalOpen}
            onClose={() => setAuthModalOpen(false)}
            onSuccess={() => {
              dispatch(loadFromStorage());
              setAuthModalOpen(false);
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
          onClick={() => (step === 4 ? requestLeaveConfirmStep("exit") : onClose())}
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
          }}
        />
      )}
    </>
  );
}
