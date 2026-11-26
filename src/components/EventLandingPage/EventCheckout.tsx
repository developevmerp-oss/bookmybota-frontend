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
  Tag,
  Percent,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import images from "@/Images";
import { useSelectedCity } from "@/lib/useSelectedCity";
import PaymentSuccessView from "@/components/Shared/PaymentSuccessView";
import ShinyBlackButton from "@/components/Shared/ShinyBlackButton";
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
  useGetPublicEventOffersQuery,
  useGetActivePlatformOffersQuery,
  type OrganizerEvent,
  type EventOffer,
  type PlatformOffer,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { formatDateCustomer, formatTime12h, getVenueDateTimeParts, venueDateStr } from "@/lib/dateFormat";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { extractApiError, isSeatConflictError } from "@/lib/apiErrors";
import SeatsUnavailablePage from "@/components/Shared/SeatsUnavailablePage";
import { formatMoney } from "@/lib/currencyFormat";
import { parseEventLanguages } from "@/lib/eventValidation";
import { sanitizePhoneInput } from "@/lib/validation";
import { isGiftCardSpendable } from "@/lib/giftCardOwnership";
import { resolveHoldExpiresAt } from "@/lib/holdCountdown";
import { pickContiguousBlock } from "@/lib/bmsSeatAutoSelect";
import {
  dedupeSeatsByPhysicalKey,
  isSameSeat,
  seatPhysicalKeyFromAny,
} from "@/lib/seatIdentity";
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
import { isStraightRowLayout } from "@/components/venue/ClassicSeatMap";
import CustomerAuthModal from "@/components/Shared/CustomerAuthModal";
const fieldErrorClass = "mt-1.5 text-[0.8125rem] font-medium text-rose-500";
/** Required-field marker — placed after the label (e.g. "Your name *"). */
const reqStar = <span className="ml-0.5 text-rose-500" aria-hidden>*</span>;
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

function clearHoldSessionToken() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(HOLD_SESSION_KEY);
}

const VenueLayoutViewer = dynamic(
  () => import("@/components/EventLandingPage/VenueLayoutViewer"),
  { ssr: false }
);

const BlockSeatPicker = dynamic(() => import("@/components/EventLandingPage/BlockSeatPicker"), { ssr: false });
const EventClassicSeatPicker = dynamic(() => import("@/components/EventLandingPage/EventClassicSeatPicker"), { ssr: false });
const EventPlanSeatPicker = dynamic(() => import("@/components/EventLandingPage/EventPlanSeatPicker"), { ssr: false });
const EventGeoSeatPicker = dynamic(() => import("@/components/EventLandingPage/EventGeoSeatPicker"), { ssr: false });
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
  /** Restore checkout step from URL (`venue` | `tickets` | `mode` | `confirm` or 1–4). */
  initialStep?: number;
  onClose: () => void;
  mode?: EventCheckoutMode;
  /** drawer = overlay panel (organizer); page = full booking route */
  variant?: "drawer" | "page";
  onOrganizerSuccess?: (result: EventCheckoutResult) => void;
};

const CHECKOUT_STEP_SLUG: Record<number, string> = {
  1: "venue",
  2: "tickets",
  3: "mode",
  4: "confirm",
};

function parseCheckoutStepParam(
  raw: string | null | undefined,
  isSingleVenue: boolean
): number | null {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase();
  const fromSlug: Record<string, number> = {
    venue: 1,
    showtimes: 1,
    tickets: 2,
    mode: 3,
    confirm: 4,
    review: 4,
  };
  let step = fromSlug[key];
  if (!step) {
    const n = Number(key);
    if (Number.isFinite(n) && n >= 1 && n <= 4) step = n;
  }
  if (!step) return null;
  if (isSingleVenue && step === 1) return 2;
  return step;
}

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isRealPhysicalSeat = (s: any): boolean =>
  Boolean(s?.id) &&
  !String(s.id).startsWith("standing-") &&
  s.row_label !== "Standing" &&
  UUID_REGEX.test(String(s.id));

export default function EventCheckout({
  event,
  open,
  initialShowtimeId,
  initialStep,
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
  /** Prefer landscape art in the compact checkout header; fall back to vertical. */
  const headerHorizontalUrl = resolveMediaUrl(event.poster_horizontal_url);
  const headerPosterUrl =
    headerHorizontalUrl || resolveMediaUrl(event.poster_vertical_url);
  const headerUsesHorizontal = Boolean(headerHorizontalUrl);
  const dispatch = useAppDispatch();
  const selectedCity = useSelectedCity();
  const authUser = useAppSelector((state) => state.auth.user);
  const [step, setStep] = useState(() =>
    initialStep && initialStep >= 1 && initialStep <= 4 ? initialStep : 1
  );
  const stepRef = useRef(step);
  stepRef.current = step;
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
  // true when someone else took the chosen seats at the same moment: shows the full-page "seats unavailable" screen
  const [seatConflict, setSeatConflict] = useState(false);
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
  const [offersModalOpen, setOffersModalOpen] = useState(false);
  const [offersModalTab, setOffersModalTab] = useState<"ALL" | "EVENT" | "PLATFORM">("ALL");
  const [giftCardModalOpen, setGiftCardModalOpen] = useState(false);
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
  const checkoutScrollRef = useRef<HTMLDivElement | null>(null);
  const checkoutScrollFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [checkoutScrollActive, setCheckoutScrollActive] = useState(false);

  const handleCheckoutScroll = () => {
    setCheckoutScrollActive(true);
    if (checkoutScrollFadeRef.current) clearTimeout(checkoutScrollFadeRef.current);
    checkoutScrollFadeRef.current = setTimeout(() => setCheckoutScrollActive(false), 900);
  };

  useEffect(() => {
    const el = checkoutScrollRef.current;
    if (el) el.scrollTop = 0;
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, [step]);

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
  const { data: publicEventOffers = [] } = useGetPublicEventOffersQuery(event.id, {
    skip: isOrganizer || !event.id,
  });
  const { data: activePlatformOffers = [] } = useGetActivePlatformOffersQuery(
    { customer_id: customerId || null },
    { skip: isOrganizer }
  );
  const layoutArg = useMemo(() => {
    return sessionToken ? { eventId: event.id, session_token: sessionToken } : event.id;
  }, [event.id, sessionToken]);

  const {
    data: layoutData,
    isLoading: layoutLoading,
    isFetching: layoutFetching,
    refetch: refetchEventLayout,
  } = useGetEventLayoutQuery(layoutArg, { skip: !isOrganizer, refetchOnMountOrArgChange: true });
  const {
    data: publicLayoutData,
    isLoading: publicLayoutLoading,
    isFetching: publicLayoutFetching,
    refetch: refetchPublicLayout,
  } = useGetPublicEventLayoutQuery(layoutArg, { skip: isOrganizer, refetchOnMountOrArgChange: true });

  const refetchLayout = () => {
    if (isOrganizer) {
      refetchEventLayout();
    } else {
      refetchPublicLayout();
    }
  };

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

  // Stadiums and halls drawn as blocks get the section picker (map, then seats, then a view from the seat)
  const isBlockLayout = seatingConfig?.layout_mode === "universal_blocks";

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

  const userCancelledHoldRef = useRef(false);

  useEffect(() => {
    const ownHold = (activeLayoutData as any)?.data?.own_hold || (activeLayoutData as any)?.own_hold;
    if (!ownHold || ownHold.status !== "ACTIVE" || userCancelledHoldRef.current) return;

    // Restore seat selection anytime, but only attach the booking countdown
    // once the user reaches Review (after Continue to review).
    if (step >= 4) {
      if (ownHold.id) {
        setHoldId((curr) => curr || ownHold.id);
      }
      if (ownHold.expires_at) {
        setExpiresAt((curr) => curr || resolveHoldExpiresAt({ expires_at: ownHold.expires_at }));
      }
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
  }, [activeLayoutData, step]);

  const showtimes = useMemo(() => event.showtimes || [], [event.showtimes]);
  const allTicketTypes = useMemo(() => event.ticket_types || [], [event.ticket_types]);
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

      const seatPrice = Number(seat.price ?? seat.unit_price);
      if (Number.isFinite(seatPrice) && seatPrice > 0) {
        const byPrice = pricingTicketPool.find((t) => Math.abs(Number(t.price) - seatPrice) < 0.01);
        if (byPrice) return byPrice;
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

        if (/silver|general|std/i.test(section)) {
          const silverTier = pricingTicketPool.find((t) => /silver|general|standard/i.test(t.ticket_type));
          if (silverTier) return silverTier;
          const sorted = [...pricingTicketPool].sort((a, b) => Number(a.price) - Number(b.price));
          if (sorted[0]) return sorted[0];
        } else if (/gold/i.test(section)) {
          const goldTier = pricingTicketPool.find((t) => /gold|premium/i.test(t.ticket_type));
          if (goldTier) return goldTier;
          const sorted = [...pricingTicketPool].sort((a, b) => Number(b.price) - Number(a.price));
          const midIdx = Math.floor(sorted.length / 2);
          if (sorted[midIdx]) return sorted[midIdx];
        } else if (/plat/i.test(section)) {
          const platTier = pricingTicketPool.find((t) => /plat/i.test(t.ticket_type));
          if (platTier) return platTier;
          const sorted = [...pricingTicketPool].sort((a, b) => Number(b.price) - Number(a.price));
          return sorted[Math.min(1, sorted.length - 1)] || sorted[0];
        } else if (/vip|fan\s*pit|pit|floor/i.test(section)) {
          const vipTier = pricingTicketPool.find((t) => /vip|fan|pit/i.test(t.ticket_type));
          if (vipTier) return vipTier;
          const sorted = [...pricingTicketPool].sort((a, b) => Number(b.price) - Number(a.price));
          return sorted[0];
        }
      }

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

  const syncCheckoutUrl = useCallback(
    (nextStep: number, nextShowtimeId?: string, mode: "push" | "replace" = "replace") => {
      if (!isPage || typeof window === "undefined") return;
      const url = new URL(window.location.href);
      url.searchParams.set("step", CHECKOUT_STEP_SLUG[nextStep] || String(nextStep));
      const sid = nextShowtimeId ?? showtimeId;
      if (sid) url.searchParams.set("showtime", sid);
      else url.searchParams.delete("showtime");
      const next = `${url.pathname}${url.search}${url.hash}`;
      const curr = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (next === curr) return;
      if (mode === "push") {
        window.history.pushState({ eventCheckoutStep: nextStep }, "", next);
      } else {
        window.history.replaceState({ eventCheckoutStep: nextStep }, "", next);
      }
    },
    [isPage, showtimeId]
  );

  const prevUrlStepRef = useRef(step);
  useEffect(() => {
    if (!isPage) return;
    const stepChanged = prevUrlStepRef.current !== step;
    prevUrlStepRef.current = step;
    // Push when the step changes so browser back moves between steps; replace for showtime-only updates.
    syncCheckoutUrl(step, showtimeId, stepChanged ? "push" : "replace");
  }, [isPage, step, showtimeId, syncCheckoutUrl]);

  useEffect(() => {
    if (!isPage || typeof window === "undefined") return;

    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const parsed = parseCheckoutStepParam(params.get("step"), isSingleVenue);
      const curr = stepRef.current;

      // Leaving Review via browser back — confirm before releasing the hold.
      if (curr === 4 && (parsed == null || parsed < 4)) {
        setCancelTxnAction("back");
        setCancelTxnOpen(true);
        syncCheckoutUrl(4, showtimeId, "push");
        return;
      }

      if (parsed != null && parsed !== curr) {
        setStep(parsed);
        if (parsed !== 2) setIsMapFullscreen(false);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isPage, isSingleVenue, syncCheckoutUrl, showtimeId]);

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

  const checkoutSeededEventRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      checkoutSeededEventRef.current = null;
      return;
    }
    // Seed once per event open. URL step/showtime sync must NOT re-run this or
    // selected seats + price get wiped on Review (0 tickets / 0 ETB).
    if (checkoutSeededEventRef.current === event.id) return;
    // Wait until showtimes are ready when the event has them.
    if ((event.showtimes?.length ?? 0) > 0 && showtimes.length === 0) return;

    checkoutSeededEventRef.current = event.id;

    const initial = initialShowtimeId
      ? showtimes.find((s) => s.id === initialShowtimeId)
      : undefined;
    const firstDate = initial ? dateKey(initial.starts_at) : dateOptions[0]?.key || "";
    const pickedShowtime = initial || (showtimes.length === 1 ? showtimes[0] : (isSingleVenue ? showtimes[0] : undefined));
    setShowtimeId(pickedShowtime ? pickedShowtime.id : "");
    setSelectedDateKey(firstDate);
    const restoredStep =
      initialStep && initialStep >= 1 && initialStep <= 4
        ? isSingleVenue && initialStep === 1
          ? 2
          : initialStep
        : isSingleVenue && pickedShowtime
          ? 2
          : 1;
    setStep(restoredStep);
    setQtyByType({});
    setSelectedSeats([]);
    setDesiredSeatQty(null);
    setSeatCountPick(null);
    setSeatQtyModalOpen(false);
    // Never force map on seed — open only after layout confirms real seats
    setIsMapFullscreen(false);
    autoOpenedMapRef.current = false;
    const seededContact =
      !isOrganizer && authUser?.role === "customer"
        ? {
          name: profile?.name || authUser.name || "",
          phone: sanitizePhoneInput(profile?.phone || authUser.phone || ""),
          email: profile?.email || authUser.email || "",
        }
        : emptyEventCheckoutContactValues();
    resetContact(seededContact);
    resetContactModal(seededContact);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time seed per event open
  }, [open, event.id, event.showtimes, showtimes, dateOptions, isSingleVenue]);

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
    const next = {
      name: profile?.name || authUser.name || "",
      phone: sanitizePhoneInput(profile?.phone || authUser.phone || ""),
      email: profile?.email || authUser.email || "",
    };
    // Fill from auth/profile when form contact is still empty (e.g. profile loaded late).
    const current = getContactValues();
    if (!current.name?.trim() || !current.phone?.trim() || !current.email?.trim()) {
      resetContact({
        name: current.name?.trim() || next.name,
        phone: current.phone?.trim() || next.phone,
        email: current.email?.trim() || next.email,
      });
    }
  }, [authUser, profile, isOrganizer, resetContact, getContactValues]);

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
    const effectiveHoldId =
      holdId ||
      (activeLayoutData as any)?.data?.own_hold?.id ||
      (activeLayoutData as any)?.own_hold?.id ||
      null;
    if (!effectiveHoldId) return;
    try {
      await releaseEventSeatHold({
        holdId: effectiveHoldId,
        session_token: sessionToken || readHoldSessionToken(),
        eventId: event.id,
      }).unwrap();
    } catch {
      // best-effort release
    }
  };

  useEffect(() => {
    if (!open) return;
    if (step === 2 || isMapFullscreen) {
      void (isOrganizer ? refetchEventLayout() : refetchPublicLayout());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch fresh seat statuses when returning to layout/map
  }, [open, step, isMapFullscreen, sessionToken]);

  /** From the "seats unavailable" page: free any hold, clear the seats and show the same seat layout again */
  const handleSeatConflictBack = async () => {
    setSeatConflict(false);
    userCancelledHoldRef.current = true;
    await releaseActiveHold();
    clearHoldSessionToken();
    setSessionToken(undefined);
    clearSeatHoldState();
    setSelectedSeats([]);
    autoOpenedMapRef.current = true; // the map is reopened right here, not by the auto-open effect
    try {
      refetchLayout();
    } catch {
      // ignore
    }
    setStep(2);
    setIsMapFullscreen(true);
  };

  const resetToSeatsAfterTimeout = async () => {
    userCancelledHoldRef.current = true;
    await releaseActiveHold();
    clearHoldSessionToken();
    setSessionToken(undefined);
    clearSeatHoldState();
    setSelectedSeats([]);
    setQtyByType({});
    setAppliedPromo(null);
    setPromoInput("");
    setAppliedGiftCard(null);
    setGiftCardInput("");
    setSelectedGiftCardId("");
    setIsMapFullscreen(false);
    autoOpenedMapRef.current = false;
    setTimeOutOpen(false);
    try {
      refetchLayout();
    } catch {
      // ignore
    }
    setStep(2);
    syncCheckoutUrl(2, showtimeId, "replace");
  };

  const confirmCancelTransaction = async () => {
    userCancelledHoldRef.current = true;
    await releaseActiveHold();
    clearHoldSessionToken();
    setSessionToken(undefined);
    clearSeatHoldState();
    setSelectedSeats([]);
    setQtyByType({});
    setAppliedPromo(null);
    setPromoInput("");
    setAppliedGiftCard(null);
    setGiftCardInput("");
    setSelectedGiftCardId("");
    setIsMapFullscreen(false);
    autoOpenedMapRef.current = false;
    setCancelTxnOpen(false);
    try {
      refetchLayout();
    } catch {
      // ignore
    }
    if (cancelTxnAction === "exit") {
      onClose();
      return;
    }
    // Redirect to Tickets step (Step 2: layout if reserved seats, or ticket selection if non-layout)
    setStep(2);
    syncCheckoutUrl(2, showtimeId, "replace");
  };

  const handleApplyPromo = async (codeOverride?: string) => {
    const code = (typeof codeOverride === "string" ? codeOverride : promoInput).trim();
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
      setPromoInput(code);
      setOffersModalOpen(false);
      toast.success(`Promo code "${result.promo_code}" applied!`);

      // If a gift card is already applied, recalculate its preview against the new remaining balance
      if (appliedGiftCard) {
        const promoDiscountVal = Number(result.discount_amount) || 0;
        const newNetTicket = Math.max(0, ticketAmount - promoDiscountVal);
        const newOrderTotal = moneySum([newNetTicket, convenienceFee]);
        if (newOrderTotal <= 0) {
          setAppliedGiftCard(null);
          toast.info("Gift card removed because promo covers the full order.");
        } else {
          try {
            const gcPayload = appliedGiftCard.gift_card_id
              ? { gift_card_id: appliedGiftCard.gift_card_id, amount: newOrderTotal, category: "EVENTS" as const }
              : giftCardInput.trim()
                ? { code: giftCardInput.trim(), amount: newOrderTotal, category: "EVENTS" as const }
                : null;
            if (gcPayload) {
              const updatedGc = await previewGiftCard(gcPayload).unwrap();
              setAppliedGiftCard(updatedGc);
            }
          } catch {
            // Keep existing gift card if re-preview fails or clear if balance issue
          }
        }
      }
    } catch (err) {
      setAppliedPromo(null);
      toast.error(extractApiError(err, "Invalid or expired promo code."));
    }
  };

  const handleRemovePromo = async () => {
    setAppliedPromo(null);
    setPromoInput("");
    // If a gift card was applied, re-preview it with the un-discounted order total so customer can use full eligible balance
    if (appliedGiftCard) {
      const fullOrderTotal = moneySum([ticketAmount, convenienceFee]);
      try {
        const gcPayload = appliedGiftCard.gift_card_id
          ? { gift_card_id: appliedGiftCard.gift_card_id, amount: fullOrderTotal, category: "EVENTS" as const }
          : giftCardInput.trim()
            ? { code: giftCardInput.trim(), amount: fullOrderTotal, category: "EVENTS" as const }
            : null;
        if (gcPayload) {
          const updatedGc = await previewGiftCard(gcPayload).unwrap();
          setAppliedGiftCard(updatedGc);
        }
      } catch {
        // Keep existing
      }
    }
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
      const physicalSeats = selectedSeats.filter(isRealPhysicalSeat);

      if (physicalSeats.length > 0) {
        if (!holdId || timeOutOpen || (secondsLeft !== null && secondsLeft <= 0)) {
          setTimeOutOpen(true);
          setSubmitting(false);
          return;
        }
      }

      const items: any[] = [];
      if (selectedSeats.length > 0) {
        selectedSeats.forEach((s) => {
          if (isRealPhysicalSeat(s)) {
            const resolved = resolveSeatTicket(s);
            const effectiveTypeId = s.ticket_type_id || resolved?.id;
            items.push({ ticket_type_id: effectiveTypeId, qty: 1, event_seat_id: String(s.id) });
          } else {
            items.push({ ticket_type_id: s.ticket_type_id, qty: 1 });
          }
        });
      } else {
        selectedLines.forEach((l) => {
          items.push({ ticket_type_id: l.id, qty: l.qty });
        });
      }

      const contact = {
        name: effectiveContact.name || getContactValues().name.trim(),
        phone: effectiveContact.phone || sanitizePhoneInput(getContactValues().phone),
        email: effectiveContact.email || getContactValues().email.trim(),
      };
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
        physicalSeats.length > 0 && holdId
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
      if (isSeatConflictError(err)) {
        setSeatConflict(true);
      } else {
        toast.error(extractApiError(err, "Booking failed. Please try again."));
      }
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

  // Auto-open map only when seats/stadium map actually exist (not just layout_mode flags).
  // Events without a real map should stay on the ticket-type list.
  useEffect(() => {
    if (!open) {
      autoOpenedMapRef.current = false;
      return;
    }
    if (isLayoutLoading) return;
    if (step === 2 && hasReservedSeats && !autoOpenedMapRef.current) {
      autoOpenedMapRef.current = true;
      setIsMapFullscreen(true);
      setDesiredSeatQty((curr) => curr || 2);
      setSeatCountPick((curr) => curr || 2);
      setSeatQtyModalOpen(true);
    }
  }, [open, step, hasReservedSeats, isLayoutLoading]);

  // Close blank map if fullscreen opened before layout loaded and there are no seats
  useEffect(() => {
    if (!isMapFullscreen) return;
    if (isLayoutLoading) return;
    if (hasReservedSeats) return;
    setIsMapFullscreen(false);
    setSeatQtyModalOpen(false);
    autoOpenedMapRef.current = true;
  }, [isMapFullscreen, isLayoutLoading, hasReservedSeats]);

  // Keep desired qty in sync when seats exist but qty was never persisted
  // (avoids "2/2 selected" UI while Continue still thinks qty is missing).
  useEffect(() => {
    if (!hasReservedSeats) return;
    if (desiredSeatQty != null) return;
    if (selectedSeats.length < 1) return;
    setDesiredSeatQty(selectedSeats.length);
    setSeatCountPick((curr) => curr ?? selectedSeats.length);
  }, [hasReservedSeats, desiredSeatQty, selectedSeats.length]);

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

    const rawSeatsIn = Array.isArray(activeLayoutData?.data?.seats)
      ? activeLayoutData.data.seats
      : [];
    // Collapse duplicate physical seats (same section/row/number, different UUIDs)
    // which otherwise inflate qty and show labels like "I9 · I9".
    const rawSeats = dedupeSeatsByPhysicalKey(rawSeatsIn);
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
        ? hasReservedSeats
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
  const effectiveContact = {
    name: (
      name ||
      (!isOrganizer ? profile?.name || authUser?.name || "" : "")
    ).trim(),
    phone: sanitizePhoneInput(
      phone || (!isOrganizer ? profile?.phone || authUser?.phone || "" : "")
    ),
    email: (
      email ||
      (!isOrganizer ? profile?.email || authUser?.email || "" : "")
    ).trim(),
  };
  const contactDetailsReady = eventCheckoutContactSchema.isValidSync(effectiveContact);
  const detailsReady =
    contactDetailsReady && (isOrganizer || isCustomerLoggedIn);
  const hasPhysicalSeats = selectedSeats.some(isRealPhysicalSeat);
  const canConfirm =
    detailsReady &&
    !submitting &&
    Boolean(ticketMode) &&
    (!hasPhysicalSeats ||
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
    const exists = selectedSeats.some((s) =>
      isSameSeat(
        String(s.id),
        seat.id,
        s.row_label || s.row,
        seat.row,
        s.seat_label || s.number,
        seat.number,
        s.section_name || s.sectionName,
        seat.sectionName
      )
    );
    if (exists) {
      applySelectedSeats(
        selectedSeats.filter(
          (s) =>
            !isSameSeat(
              String(s.id),
              seat.id,
              s.row_label || s.row,
              seat.row,
              s.seat_label || s.number,
              seat.number,
              s.section_name || s.sectionName,
              seat.sectionName
            )
        )
      );
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
      const existingKeys = new Set(
        selectedSeats.map((s) => seatPhysicalKeyFromAny(s) || String(s.id))
      );
      const toAdd = autoBlock.filter(
        (s) => !existingKeys.has(seatPhysicalKeyFromAny(s) || String(s.id))
      );
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

  const classicSeats: any[] = ((activeLayoutData as any)?.data?.seats || (activeLayoutData as any)?.seats || []) as any[];

  const handleMapSeatsSelected = (seats: any[]) => {
    if (!desiredSeatQty) {
      applySelectedSeats(seats);
      return;
    }

    const seatKey = (s: any) => seatPhysicalKeyFromAny(s) || String(s.id);
    const prevIds = new Set(selectedSeats.map((s) => String(s.id)));
    const prevKeys = new Set(selectedSeats.map(seatKey));
    const nextIds = new Set(seats.map((s) => String(s.id)));

    // Deselect path from map viewer — or BMS "start fresh" when qty was full
    if (seats.length < selectedSeats.length) {
      if (seats.length === 1 && !prevKeys.has(seatKey(seats[0])) && !prevIds.has(String(seats[0].id))) {
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

    const newlyAdded = seats.filter(
      (s) => !prevKeys.has(seatKey(s)) && !prevIds.has(String(s.id))
    );
    if (newlyAdded.length === 1 && seats.length === selectedSeats.length + 1) {
      const startFresh = selectedSeats.length === 0 || selectedSeats.length >= desiredSeatQty;
      const need = startFresh ? desiredSeatQty : desiredSeatQty - selectedSeats.length;
      const autoBlock = autoSelectNeighborSeats(String(newlyAdded[0].id), need);
      if (autoBlock && autoBlock.length > 0) {
        if (startFresh) {
          applySelectedSeats(autoBlock);
          if (autoBlock.length < desiredSeatQty) {
            toast.message(
              `${autoBlock.length}/${desiredSeatQty} selected — tap another row for the rest.`
            );
          }
        } else {
          const existing = new Set(selectedSeats.map(seatKey));
          const toAdd = autoBlock.filter((s) => !existing.has(seatKey(s)));
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

  // If seats are already picked but qty was never saved (map used a display fallback),
  // treat selected count as the intended qty so Continue isn't blocked incorrectly.
  const effectiveDesiredSeatQty =
    desiredSeatQty ??
    (selectedSeats.length > 0 ? selectedSeats.length : null);

  const seatsReady = hasReservedSeats
    ? effectiveDesiredSeatQty != null &&
    selectedSeats.length === effectiveDesiredSeatQty
    : ticketQty >= 1;

  const proceedFromTickets = () => {
    if (hasReservedSeats) {
      const qty =
        desiredSeatQty ??
        seatCountPick ??
        (selectedSeats.length > 0 ? selectedSeats.length : null);

      if (!qty) {
        toast.error("Choose how many seats you need first.");
        setSeatQtyModalOpen(true);
        return;
      }

      // Persist qty if it was only implied by the current selection / map fallback.
      if (desiredSeatQty == null) {
        setDesiredSeatQty(qty);
        setSeatCountPick((curr) => curr ?? qty);
      }

      if (selectedSeats.length !== qty) {
        toast.error(
          `Please select exactly ${qty} seat${qty === 1 ? "" : "s"} on the map.`
        );
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

    // Persist resolved contact into the form so review/pay use the same values.
    resetContact(effectiveContact);

    const physicalSeats = selectedSeats.filter(isRealPhysicalSeat);

    if (physicalSeats.length > 0) {
      const currentSeatIds = physicalSeats.map((s) => String(s.id)).sort().join(",");
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
      userCancelledHoldRef.current = false;
      try {
        const existing = sessionToken || readHoldSessionToken();
        const res = await createEventSeatHold({
          eventId: event.id,
          event_seat_ids: physicalSeats.map((s) => String(s.id)),
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
        if (isSeatConflictError(err)) {
          setSelectedSeats([]);
          setSeatConflict(true);
          try {
            refetchLayout();
          } catch {
            // ignore
          }
        } else {
          toast.error(extractApiError(err, "Could not hold seats. Please try again."));
        }
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
    // Only enter map fullscreen when a real seat/stadium map is available
    if (targetStep === 2 && hasReservedSeats) {
      setIsMapFullscreen(true);
    } else if (targetStep === 2) {
      setIsMapFullscreen(false);
    }
    if (targetStep === 4) {
      void proceedToReview();
      return;
    }
    setStep(targetStep);
  };

  const showtimeSummaryBar =
    selectedShowtime && step >= 2 ? (
      <div className="shrink-0 z-20 bg-[#F5F5F5] border-b border-slate-200/70">
        <div
          className={`${isPage ? "max-w-[36rem] mx-auto" : ""
            } px-3 sm:px-4 py-2.5`}
        >
          <div className="rounded-xl bg-[#E8ECF0] px-3.5 py-2.5 sm:px-4 sm:py-3 text-center">
            <p className="text-[0.8125rem] sm:text-[0.875rem] font-semibold text-slate-800 leading-snug break-words [overflow-wrap:anywhere]">
              {selectedShowtime.venue_name || "Venue"}
            </p>
            <p className="mt-1 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-[0.75rem] sm:text-[0.8125rem] font-semibold text-slate-600 leading-snug">
              <span className="whitespace-nowrap">
                {dateChip(selectedShowtime.starts_at).day}{" "}
                {dateChip(selectedShowtime.starts_at).date}
              </span>
              <span className="text-slate-300" aria-hidden>
                ·
              </span>
              <span className="whitespace-nowrap">
                {formatTime12h(selectedShowtime.starts_at)}
              </span>
              {ticketQty > 0 ? (
                <>
                  <span className="text-slate-300" aria-hidden>
                    ·
                  </span>
                  <span className="uppercase tracking-wide text-slate-600 whitespace-nowrap">
                    Entry for {ticketQty}
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </div>
      </div>
    ) : null;

  /** Only show the booking timer on Review (after Continue to review) — fixed under header. */
  const holdCountdownStickyBar =
    step === 4 && holdId && secondsLeft !== null && secondsLeft > 0 && !timeOutOpen ? (
      <div className="shrink-0 sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <div
          className={`${isPage ? "max-w-6xl mx-auto" : ""
            } px-3 sm:px-4 py-2 sm:py-2.5`}
        >
          <div
            className={`rounded-xl px-3.5 py-2.5 text-center border ${secondsLeft <= 60
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : "bg-[#F3E8FF] border-[#E9D5FF] text-[#6B21A8]"
              }`}
          >
            <span className="inline-flex items-center justify-center gap-2 text-[0.8125rem] sm:text-sm font-bold leading-none tabular-nums">
              <Timer className="size-3.5 sm:size-4 shrink-0" />
              Complete your booking in {formatHoldCountdown(secondsLeft)}
            </span>
          </div>
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

    const normalized = dedupeSeatsByPhysicalKey(
      seats.map((s) => {
        const resolved = resolveSeatTicket({
          ...s,
          section_name: s.section_name || s.sectionName,
        });
        return {
          ...s,
          id: String(s.id),
          ticket_type_id: String(resolved?.id || s.ticket_type_id || ""),
          section_name: s.section_name || s.sectionName || resolved?.ticket_type || "",
          row_label: s.row_label || s.row || "",
          seat_label: s.seat_label || s.number || "",
          price: Number(resolved?.price) || Number(s.price) || Number(s.unit_price) || 0,
          unit_price: Number(resolved?.price) || Number(s.unit_price) || Number(s.price) || 0,
        };
      })
    );

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

  const panel = (
    <div
      className={
        isPage
          ? "relative w-full h-full min-h-0 flex flex-col overflow-hidden bg-[#F5F5F5]"
          : "relative h-full w-full max-w-[26.25rem] bg-white shadow-2xl flex flex-col"
      }
    >
      {isPage && (
        <div className="z-30 bg-white border-b border-slate-200 shrink-0 pt-[max(0.875rem,env(safe-area-inset-top,0px))]">
          <div className="relative flex items-center">
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
            <div className={`mx-auto flex w-full items-center justify-center px-4 sm:px-5 ${step === 4 ? "max-w-6xl" : "max-w-[40rem]"}`}>
              <div className="flex w-full items-center justify-center gap-3 sm:gap-3.5 py-2.5 sm:py-3 min-w-0">
                {step !== 4 && headerPosterUrl ? (
                  <span
                    className={`relative shrink-0 overflow-hidden rounded-lg border border-slate-200/90 bg-slate-100 shadow-sm ${headerUsesHorizontal
                        ? "aspect-[16/9] h-11 sm:h-12 w-auto"
                        : "aspect-[2/3] h-14 sm:h-16 w-auto"
                      }`}
                  >
                    <img
                      src={headerPosterUrl}
                      alt=""
                      aria-hidden
                      className={`absolute inset-0 h-full w-full object-cover ${headerUsesHorizontal ? "object-center" : "object-top"
                        }`}
                    />
                  </span>
                ) : null}
                <div className={`min-w-0 ${step === 4 ? "text-center max-w-full" : "text-left max-w-[min(100%,18rem)] sm:max-w-[min(100%,22rem)]"}`}>
                  <h1 className="text-[1rem] sm:text-[1.125rem] font-bold leading-snug text-[#111] truncate">
                    {step === 4 ? "Review your booking" : event.name}
                  </h1>
                  {step === 4 ? (
                    <p className="text-xs sm:text-[0.8125rem] text-slate-500 font-medium truncate mt-0.5">
                      {event.name}
                    </p>
                  ) : event.category_name ? (
                    <p className="text-xs sm:text-[0.8125rem] text-slate-500 font-medium truncate mt-0.5">
                      {event.category_name}
                      {event.age_group ? ` · ${event.age_group}` : ""}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          {pageStepper}
        </div>
      )}

      {isPage && step >= 2 && step < 4 && showtimeSummaryBar}
      {holdCountdownStickyBar}

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
            {step !== 4 && headerPosterUrl ? (
              <span
                className={`relative shrink-0 overflow-hidden rounded-md border border-slate-200/90 bg-slate-100 shadow-sm ${headerUsesHorizontal
                    ? "aspect-[16/9] h-10 w-auto"
                    : "aspect-[2/3] h-10 w-auto"
                  }`}
              >
                <img
                  src={headerPosterUrl}
                  alt=""
                  aria-hidden
                  className={`absolute inset-0 h-full w-full object-cover ${headerUsesHorizontal ? "object-center" : "object-top"
                    }`}
                />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 truncate">
                {step === 4 ? "Review your booking" : event.name}
              </h2>
              {step === 4 ? (
                <p className="text-xs text-slate-500 truncate">{event.name}</p>
              ) : event.category_name ? (
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
        ref={checkoutScrollRef}
        onScroll={handleCheckoutScroll}
        className={
          isPage
            ? `flex-1 min-h-0 overflow-y-auto overscroll-y-contain checkout-scrollbar${checkoutScrollActive ? " checkout-scrollbar-active" : ""} w-full ${step === 4 ? "max-w-6xl" : "max-w-[36rem]"} mx-auto px-4 sm:px-5 py-4 sm:py-5 pb-8`
            : `flex-1 min-h-0 overflow-y-auto checkout-scrollbar${checkoutScrollActive ? " checkout-scrollbar-active" : ""} px-5 py-5 bg-white`
        }
      >
        {showStepHeader && (
          <div className={step === 3 ? "mb-3" : "mb-3.5 sm:mb-4"}>
            <h3 className="text-[1.0625rem] sm:text-[1.125rem] font-bold text-gray-900 tracking-tight">
              {stepTitle}
            </h3>
            <p className="text-[0.875rem] sm:text-[0.9375rem] text-slate-500 mt-1 leading-snug">
              {stepSubtitle}
            </p>
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
                                      // Map opens only after layout confirms seats (see hasReservedSeats effect)
                                      setIsMapFullscreen(false);
                                      autoOpenedMapRef.current = false;
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
                    {selectedSeats.length}/{effectiveDesiredSeatQty ?? "—"} seat
                    {(effectiveDesiredSeatQty ?? 0) === 1 ? "" : "s"} selected
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
                  <ShinyBlackButton
                    type="button"
                    onClick={() => {
                      setIsMapFullscreen(true);
                      if (!desiredSeatQty) {
                        setDesiredSeatQty(2);
                        setSeatCountPick(2);
                        setSeatQtyModalOpen(true);
                      }
                    }}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-white ${accentBtn}`}
                  >
                    <MapIcon className="size-4" />
                    <span>{seatsReady ? "Review seating map" : "Select seats on map"}</span>
                  </ShinyBlackButton>
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
          <div className="space-y-3.5 sm:space-y-4 pb-2">
            <div>
              <p className="text-[0.9375rem] sm:text-[1rem] font-bold text-gray-900">
                How do you want your tickets?
              </p>
              {availableTicketModes.length === 1 && (
                <p className="mt-1 text-[0.8125rem] sm:text-[0.875rem] text-slate-500 leading-snug">
                  This event only offers {availableTicketModes[0].label.toLowerCase()}.
                </p>
              )}
              <div className="mt-3 space-y-2.5">
                {availableTicketModes.map((option) => {
                  const Icon = ticketModeIcon(option.id);
                  const selected = ticketMode === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setTicketMode(option.id)}
                      className={`w-full text-left rounded-xl border p-3.5 sm:p-4 transition-colors cursor-pointer ${selected
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
                    Street / house / area{reqStar}
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
                    City{reqStar}
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

            {isOrganizer ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 pb-4">
                <p className="text-[0.9375rem] font-bold text-slate-900 mb-3">
                  Customer contact
                </p>
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
              </div>
            ) : isCustomerLoggedIn ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 pb-4">
                <p className="text-[0.9375rem] font-bold text-slate-900 mb-3">
                  Contact details
                </p>
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
              </div>
            ) : null}
          </div>
        )}

        {step === 4 && selectedShowtime && (
          <form id="event-checkout-form" onSubmit={handleConfirm} className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
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
                      {(() => {
                        const types = selectedLines.map((l) => l.ticket_type).filter(Boolean).join(", ");
                        const isAllStanding = selectedSeats.length > 0 && selectedSeats.every(
                          (s) =>
                            /^standing$/i.test(String(s.row_label || s.row || "").trim()) ||
                            /^standing-/i.test(String(s.id || ""))
                        );
                        if (isAllStanding) {
                          return types || "Standing Pass";
                        }
                        const seatCodes = selectedSeats
                          .map((s) => `${s.row_label || s.row || ""}${s.seat_label || s.number || ""}`.trim())
                          .filter(Boolean)
                          .join(", ");
                        return [types, seatCodes].filter(Boolean).join("  •  ");
                      })()}
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
                <div className="space-y-3">
                  {/* Applied Promo Code Banner */}
                  {appliedPromo && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                            <Tag size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 font-mono text-sm tracking-wide">
                                {appliedPromo.promo_code}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                                <Check size={11} /> Applied
                              </span>
                            </div>
                            <p className="text-xs text-emerald-700 mt-0.5">
                              You saved {formatMoney(appliedPromo.discount_amount)}!
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setOffersModalOpen(true)}
                            className="text-xs font-semibold text-[#6900AA] hover:underline cursor-pointer"
                          >
                            Change
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={handleRemovePromo}
                            className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Apply Offers Card (when no promo applied) */}
                  {!appliedPromo && (
                    <button
                      type="button"
                      onClick={() => setOffersModalOpen(true)}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between text-left hover:border-[#6900AA]/40 hover:bg-purple-50/20 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                          <Percent size={18} className="stroke-[2.5]" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[15px] font-bold text-slate-900 block group-hover:text-[#6900AA] transition-colors">
                            Apply Offers
                          </span>
                          <p className="text-xs text-slate-500 truncate">
                            Promo codes & event discounts
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-slate-400 group-hover:text-[#6900AA] group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  )}

                  {/* Applied Gift Card Banner */}
                  {appliedGiftCard && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                            <Gift size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-sm truncate">
                              {appliedGiftCard.product_name || "Gift Card"} · {appliedGiftCard.code_masked}
                            </p>
                            <p className="text-xs text-rose-700 mt-0.5">
                              Applying {formatMoney(appliedGiftCard.amount_applicable)}
                              {appliedGiftCard.balance_after > 0
                                ? ` · ${formatMoney(appliedGiftCard.balance_after)} left`
                                : " · balance 0"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setGiftCardModalOpen(true)}
                            className="text-xs font-semibold text-[#6900AA] hover:underline cursor-pointer"
                          >
                            Change
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={handleRemoveGiftCard}
                            className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Apply Gift Cards Card (when no gift card applied) */}
                  {!appliedGiftCard && (
                    <button
                      type="button"
                      onClick={() => setGiftCardModalOpen(true)}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between text-left hover:border-[#6900AA]/40 hover:bg-purple-50/20 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                          <Gift size={18} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[15px] font-bold text-slate-900 block group-hover:text-[#6900AA] transition-colors">
                            Apply Gift Cards
                          </span>
                          <p className="text-xs text-slate-500 truncate">
                            Redeem saved gift cards or voucher codes
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-slate-400 group-hover:text-[#6900AA] group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  )}
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

              <ShinyBlackButton
                type="submit"
                disabled={!canConfirm || submitting}
                ariaBusy={submitting || undefined}
                className={`${isPage ? "hidden lg:flex" : "flex"} w-full items-center justify-between rounded-xl bg-[#111111] px-5 py-3.5 text-white disabled:opacity-50`}
              >
                <span className="flex w-full items-center justify-between gap-3">
                  <span className="text-left">
                    <span className="block text-sm font-bold">{formatMoney(grandTotal)}</span>
                    <span className="block text-[10px] font-semibold tracking-wide text-white/70">TOTAL</span>
                  </span>
                  <span className="text-sm font-bold inline-flex items-center gap-2">
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                    {submitting ? "Confirming…" : isOrganizer ? "Confirm & Send" : "Pay now"}
                  </span>
                </span>
              </ShinyBlackButton>
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
                      <ShinyBlackButton
                        type="button"
                        disabled={!seatsReady}
                        onClick={proceedFromTickets}
                        className={`w-full py-3 rounded-[0.5rem] ${accentBtn} disabled:bg-slate-300 disabled:!opacity-100 text-white font-semibold text-[1.0625rem]`}
                      >
                        Continue
                      </ShinyBlackButton>
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
                      <ShinyBlackButton
                        type="button"
                        disabled={!seatsReady}
                        onClick={proceedFromTickets}
                        className={`flex-1 py-3 rounded-xl ${accentBtn} disabled:bg-slate-300 disabled:!opacity-100 text-white font-semibold text-[1.0625rem]`}
                      >
                        Continue
                        <ChevronRight size={16} />
                      </ShinyBlackButton>
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
                  <ShinyBlackButton
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    disabled={!ticketMode || !deliveryDetailsReady}
                    className={`flex-1 py-3 ${accentBtn} disabled:bg-slate-300 disabled:!opacity-100 text-white font-semibold text-[1.0625rem] ${isPage ? "rounded-[0.5rem]" : "rounded-xl"
                      }`}
                  >
                    Sign in
                  </ShinyBlackButton>
                ) : (
                  <ShinyBlackButton
                    type="button"
                    onClick={() => void proceedToReview()}
                    disabled={!canProceedFromTicketMode || holding}
                    className={`flex-1 py-3 ${accentBtn} disabled:bg-slate-300 disabled:!opacity-100 text-white font-semibold text-[1.0625rem] ${isPage ? "rounded-[0.5rem]" : "rounded-xl"
                      }`}
                  >
                    {holding ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Holding seats…
                      </>
                    ) : (
                      "Continue to review"
                    )}
                  </ShinyBlackButton>
                )}
              </div>
            )}
            {step === 4 && (
              <div className="flex gap-3 items-stretch">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => requestLeaveConfirmStep("back")}
                  className={`shrink-0 px-4 py-3.5 border text-slate-700 font-semibold text-[1rem] inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${isPage
                    ? "rounded-xl border-slate-300 bg-white"
                    : "rounded-xl border-slate-200"
                    }`}
                >
                  <ArrowLeft size={16} /> Back
                </button>
                {isPage ? (
                  <ShinyBlackButton
                    type="submit"
                    form="event-checkout-form"
                    disabled={!canConfirm || submitting}
                    ariaBusy={submitting || undefined}
                    className={`lg:hidden flex-1 min-w-0 py-3 px-4 rounded-xl ${accentBtn} disabled:bg-slate-300 disabled:!opacity-100 text-white`}
                  >
                    <span className="flex w-full items-center justify-between gap-3">
                      <span className="text-left min-w-0">
                        <span className="block text-[0.9375rem] font-bold leading-tight truncate">
                          {formatMoney(grandTotal)}
                        </span>
                        <span className="block text-[10px] font-semibold tracking-wide text-white/70 uppercase">
                          Total
                        </span>
                      </span>
                      <span className="shrink-0 text-[0.9375rem] font-bold inline-flex items-center gap-1.5">
                        {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                        {submitting ? "Confirming…" : isOrganizer ? "Confirm" : "Pay now"}
                      </span>
                    </span>
                  </ShinyBlackButton>
                ) : null}
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
          onClose={() => setBookedSuccessId(null)}
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
                {/* Map / Grid view switch hidden on purpose: customers always see the designed layout (map).
                    The grid fallback code is kept below but is no longer reachable from the UI.
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
                */}
                <p className="text-[0.8125rem] md:max-lg:text-[1rem] lg:text-[0.8125rem] font-extrabold text-[#6900AA] tabular-nums">
                  {selectedSeats.length}/{effectiveDesiredSeatQty ?? "—"}
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
                {isBlockLayout ? (
                  <BlockSeatPicker
                    onContinue={() => {
                      if (effectiveDesiredSeatQty && selectedSeats.length === effectiveDesiredSeatQty) {
                        setIsMapFullscreen(false);
                        proceedFromTickets();
                      } else {
                        toast.error(`Please select exactly ${effectiveDesiredSeatQty ?? desiredSeatQty ?? 1} seats.`);
                      }
                    }}
                    layoutData={activeLayoutData}
                    ticketTypes={ticketTypes}
                    onSeatsSelected={handleMapSeatsSelected}
                    initialSelectedSeats={selectedSeats}
                    maxSelectable={desiredSeatQty ?? undefined}
                  />
                ) : isStadiumLayout ? (
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
                ) : classicSeats.length > 0 && (((activeLayoutData as any)?.data?.seating_config ?? (activeLayoutData as any)?.seating_config)?.layout_style === "plan") ? (
                  <EventPlanSeatPicker
                    plan={((activeLayoutData as any)?.data?.seating_config ?? (activeLayoutData as any)?.seating_config).plan}
                    seats={classicSeats}
                    selected={selectedSeats}
                    maxSelectable={desiredSeatQty ?? undefined}
                    onSeatsSelected={handleMapSeatsSelected}
                    ticketTypes={[...ticketTypes, ...allTicketTypes]}
                  />
                ) : classicSeats.length > 0 && isStraightRowLayout(classicSeats) && !(((activeLayoutData as any)?.data?.seating_config ?? (activeLayoutData as any)?.seating_config)?.decks?.length) ? (
                  <EventClassicSeatPicker
                    seats={classicSeats}
                    selected={selectedSeats}
                    maxSelectable={desiredSeatQty ?? undefined}
                    onSeatsSelected={handleMapSeatsSelected}
                  />
                ) : classicSeats.length > 0 ? (
                  <EventGeoSeatPicker
                    seats={classicSeats}
                    selected={selectedSeats}
                    maxSelectable={desiredSeatQty ?? undefined}
                    onSeatsSelected={handleMapSeatsSelected}
                    ticketTypes={[...ticketTypes, ...allTicketTypes]}
                    decksConfig={((activeLayoutData as any)?.data?.seating_config ?? (activeLayoutData as any)?.seating_config)?.decks}
                    stage={(() => {
                      const shapes: any[] = ((activeLayoutData as any)?.data?.seating_config ?? (activeLayoutData as any)?.seating_config)?.shapes || [];
                      const st = shapes.find((h) => /stage/i.test(String(h?.text || "")));
                      return st ? { x: Number(st.x), y: Number(st.y), width: Number(st.width) || 0, height: Number(st.height) || 0 } : null;
                    })()}
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
                      ? `Select ${effectiveDesiredSeatQty ?? 2} seat${(effectiveDesiredSeatQty ?? 2) === 1 ? "" : "s"}`
                      : `${selectedSeats.length}/${effectiveDesiredSeatQty ?? "—"} selected`}
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
                    {(() => {
                      const isAllStanding = selectedSeats.every(
                        (s: any) =>
                          /^standing$/i.test(String(s.row_label || s.row || "").trim()) ||
                          /^standing-/i.test(String(s.id || ""))
                      );
                      if (isAllStanding) {
                        const count = selectedSeats.length;
                        const section = selectedSeats[0]?.section_name || selectedSeats[0]?.sectionName || "Standing";
                        return `${count} Standing Pass${count === 1 ? "" : "es"} (${section})`;
                      }
                      return selectedSeats
                        .map((s: any) => {
                          const row = String(s.row_label || s.row || "").trim();
                          const num = String(s.seat_label || s.number || "").trim();
                          return row && num ? `${row} ${num}` : `${row}${num}`;
                        })
                        .filter(Boolean)
                        .join(" · ");
                    })()}
                  </p>
                )}
                <p className="text-[1.125rem] sm:text-[1.375rem] md:max-lg:text-[1.5rem] lg:text-[1.375rem] font-extrabold text-slate-900 leading-tight mt-0.5">
                  {formatMoney(ticketAmount, { compact: true })}
                </p>
              </div>
              <ShinyBlackButton
                type="button"
                disabled={
                  !effectiveDesiredSeatQty ||
                  selectedSeats.length !== effectiveDesiredSeatQty
                }
                onClick={() => {
                  const targetQty =
                    desiredSeatQty ??
                    seatCountPick ??
                    (selectedSeats.length > 0 ? selectedSeats.length : null);
                  if (!targetQty) {
                    toast.error("Choose how many seats you need first.");
                    setSeatQtyModalOpen(true);
                    return;
                  }
                  if (desiredSeatQty == null) {
                    setDesiredSeatQty(targetQty);
                    setSeatCountPick((curr) => curr ?? targetQty);
                  }
                  if (selectedSeats.length !== targetQty) {
                    toast.error(
                      `Please select exactly ${targetQty} seat${targetQty === 1 ? "" : "s"}.`
                    );
                    return;
                  }
                  setIsMapFullscreen(false);
                  proceedFromTickets();
                }}
                className={`shrink-0 min-w-[7.5rem] sm:min-w-[12rem] px-4 sm:px-5 py-3 sm:py-3.5 ${accentBtn} text-white font-bold text-[0.9375rem] sm:text-[1.0625rem] md:max-lg:text-[1.125rem] lg:text-[1.0625rem] rounded-xl disabled:bg-slate-300 disabled:!opacity-100`}
              >
                {effectiveDesiredSeatQty &&
                  selectedSeats.length === effectiveDesiredSeatQty
                  ? "Continue"
                  : "Select seats"}
              </ShinyBlackButton>
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
                        className={`h-12 rounded-xl text-base font-semibold cursor-pointer transition-all flex items-center justify-center ${isSelected
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

      {/* BookMyShow-style Apply Offers Modal (Responsive: Fullscreen Sheet on mobile, Centered Modal on desktop) */}
      {offersModalOpen && (
        <div
          className="fixed inset-0 z-[115] flex items-end lg:items-center justify-center bg-black/50 backdrop-blur-[2px] transition-opacity"
          onClick={() => setOffersModalOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="offers-modal-title"
            className="w-full lg:max-w-2xl h-[92vh] lg:h-auto lg:max-h-[85vh] bg-slate-50 rounded-t-2xl lg:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: matches Image 4 (< Apply offers) */}
            <div className="bg-white border-b border-slate-200 px-4 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setOffersModalOpen(false)}
                  className="p-1 -ml-1 text-slate-700 hover:text-slate-900 rounded-full hover:bg-slate-100 cursor-pointer"
                  aria-label="Back"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="min-w-0">
                  <h3 id="offers-modal-title" className="text-base font-bold text-slate-900 leading-tight truncate">
                    Apply offers
                  </h3>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {event.name}
                    {selectedShowtime?.starts_at ? ` | ${formatDateCustomer(selectedShowtime.starts_at)}` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOffersModalOpen(false)}
                className="hidden lg:flex h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 items-center justify-center cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Promo Code Input Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 mb-2">Got a promo code?</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      placeholder="Type your coupon code here"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 uppercase font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#6900AA] focus:bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyPromo()}
                    disabled={validatingPromo || !promoInput.trim()}
                    className="px-5 py-2.5 rounded-lg bg-[#6900AA] hover:bg-[#57008E] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0 inline-flex items-center gap-1.5"
                  >
                    {validatingPromo ? <Loader2 size={14} className="animate-spin" /> : null}
                    Apply
                  </button>
                </div>
              </div>

              {/* Offers Tabs (All Offers / Event Offers / Platform Offers) */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setOffersModalTab("ALL")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${offersModalTab === "ALL"
                      ? "bg-[#6900AA] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                >
                  All Offers
                </button>
                <button
                  type="button"
                  onClick={() => setOffersModalTab("EVENT")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${offersModalTab === "EVENT"
                      ? "bg-[#6900AA] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                >
                  Event Offers ({publicEventOffers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setOffersModalTab("PLATFORM")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${offersModalTab === "PLATFORM"
                      ? "bg-[#6900AA] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                >
                  Platform Offers (
                  {
                    (activePlatformOffers || []).filter((p: any) => {
                      const cat = String(p.category || "").toUpperCase();
                      const statusOk = !p.effective_status || p.effective_status === "ACTIVE";
                      return statusOk && (cat === "ALL" || cat === "EVENTS");
                    }).length
                  }
                  )
                </button>
              </div>

              {/* Offers List (Event & Platform Offers) */}
              <div className="space-y-3">
                {(() => {
                  const eventOffersFormatted = (publicEventOffers || []).map((o: any) => {
                    const discountType = String(o.discount_type || "").toUpperCase();
                    const val = Number(o.discount_value) || 0;
                    return {
                      id: o.id,
                      type: "EVENT" as const,
                      title: o.title || `Special Event Offer`,
                      code: o.promo_code || "EVENTOFFER",
                      description: o.description || `Get ${discountType === "PERCENT" ? `${val}% off` : formatMoney(val)} on this event.`,
                      discountText: discountType === "PERCENT" ? `${val}% OFF` : `FLAT ${formatMoney(val)} OFF`,
                      savingsText: discountType === "PERCENT" ? `Save ${val}%` : `Save ${formatMoney(val)}`,
                      badge: "Event Special",
                    };
                  });

                  const platformOffersFormatted = (activePlatformOffers || [])
                    .filter((p: any) => {
                      const cat = String(p.category || "").toUpperCase();
                      const statusOk = !p.effective_status || p.effective_status === "ACTIVE";
                      return statusOk && (cat === "ALL" || cat === "EVENTS");
                    })
                    .map((p: any) => {
                      const discountType = String(p.discount_type || "").toUpperCase();
                      const val = Number(p.discount_value) || 0;
                      const maxDisc = p.max_discount != null ? Number(p.max_discount) : null;
                      return {
                        id: p.id,
                        type: "PLATFORM" as const,
                        title: p.name || `Platform Discount`,
                        code: p.code || "BOTAPLATFORM",
                        description: p.description || `Book tickets and save with this official platform offer.`,
                        discountText: discountType === "PERCENT" ? `${val}% OFF` : `FLAT ${formatMoney(val)} OFF`,
                        savingsText:
                          discountType === "PERCENT"
                            ? maxDisc
                              ? `Save up to ${formatMoney(maxDisc)}`
                              : `Save ${val}%`
                            : `Save ${formatMoney(val)}`,
                        badge: "BookMyBota",
                      };
                    });

                  let displayedOffers = [...eventOffersFormatted, ...platformOffersFormatted];
                  if (offersModalTab === "EVENT") {
                    displayedOffers = eventOffersFormatted;
                  } else if (offersModalTab === "PLATFORM") {
                    displayedOffers = platformOffersFormatted;
                  }

                  if (displayedOffers.length === 0) {
                    return (
                      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                        <p className="text-sm font-semibold">
                          {offersModalTab === "EVENT"
                            ? "No event-specific offers available."
                            : offersModalTab === "PLATFORM"
                              ? "No platform offers currently available."
                              : "No offers currently available for this event."}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">If you have a promo code, type it above to apply.</p>
                      </div>
                    );
                  }

                  return displayedOffers.map((offer) => {
                    const isCurrentlyApplied = appliedPromo?.promo_code?.toUpperCase() === offer.code.toUpperCase();
                    return (
                      /* BookMyShow Offer Card */
                      <div
                        key={offer.id}
                        className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-[#6900AA] font-bold shrink-0">
                              <Percent size={18} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-bold text-slate-900 leading-snug">
                                  {offer.title}
                                </h4>
                                {offer.badge && (
                                  <span className="text-[10px] font-semibold bg-purple-100 text-[#6900AA] px-1.5 py-0.5 rounded">
                                    {offer.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                                {offer.description}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (isCurrentlyApplied) {
                                handleRemovePromo();
                              } else {
                                handleApplyPromo(offer.code);
                              }
                            }}
                            disabled={validatingPromo}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${isCurrentlyApplied
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                : "text-rose-600 hover:bg-rose-50 border border-rose-200 hover:border-rose-300 font-semibold"
                              }`}
                          >
                            {isCurrentlyApplied ? "Applied ✓" : "Apply"}
                          </button>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-dashed border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {offer.code}
                          </span>
                          <span className="font-semibold text-emerald-600">
                            {offer.savingsText}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Standalone Redeem Gift Cards Modal */}
      {giftCardModalOpen && (
        <div
          className="fixed inset-0 z-[115] flex items-end lg:items-center justify-center bg-black/50 backdrop-blur-[2px] transition-opacity"
          onClick={() => setGiftCardModalOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="gift-cards-modal-title"
            className="w-full lg:max-w-xl h-[80vh] lg:h-auto lg:max-h-[85vh] bg-slate-50 rounded-t-2xl lg:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-4 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setGiftCardModalOpen(false)}
                  className="p-1 -ml-1 text-slate-700 hover:text-slate-900 rounded-full hover:bg-slate-100 cursor-pointer"
                  aria-label="Back"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="min-w-0">
                  <h3 id="gift-cards-modal-title" className="text-base font-bold text-slate-900 leading-tight truncate">
                    Apply Gift Card
                  </h3>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    Order total: {formatMoney(orderTotal)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGiftCardModalOpen(false)}
                className="hidden lg:flex h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 items-center justify-center cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Gift size={16} className="text-[#6900AA]" />
                  <span>Redeem Gift Card</span>
                </div>

                {redeemableGiftCards.length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-slate-500">
                      My Available Gift Cards
                    </label>
                    <div className="space-y-2">
                      {redeemableGiftCards.map((c) => {
                        const isSelected = selectedGiftCardId === c.id;
                        const bal = Number(c.current_balance) || 0;
                        return (
                          <div
                            key={c.id}
                            className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${isSelected
                                ? "border-[#6900AA] bg-purple-50/50"
                                : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                              }`}
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {c.product_name || "Gift Card"} · <span className="font-mono text-slate-600">{c.code_masked}</span>
                              </p>
                              <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                                Balance: {formatMoney(bal)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                setSelectedGiftCardId(c.id);
                                setGiftCardInput("");
                                try {
                                  const res = await previewGiftCard({
                                    gift_card_id: c.id,
                                    amount: orderTotal,
                                    category: "EVENTS",
                                  }).unwrap();
                                  setAppliedGiftCard(res);
                                  setGiftCardModalOpen(false);
                                  toast.success("Gift card applied!");
                                } catch (err) {
                                  toast.error(extractApiError(err, "Failed to apply gift card."));
                                }
                              }}
                              disabled={validatingGiftCard || orderTotal <= 0}
                              className="px-3.5 py-1.5 rounded-lg bg-[#6900AA] hover:bg-[#57008E] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                            >
                              {validatingGiftCard && isSelected ? <Loader2 size={13} className="animate-spin" /> : "Apply"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                    Or enter gift card code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={giftCardInput}
                      onChange={(e) => {
                        setGiftCardInput(e.target.value.toUpperCase());
                        if (e.target.value) setSelectedGiftCardId("");
                      }}
                      placeholder="ENTER 16-DIGIT CODE"
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono uppercase text-slate-900 focus:outline-none focus:border-[#6900AA] focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        await handleApplyGiftCard();
                        setGiftCardModalOpen(false);
                      }}
                      disabled={
                        validatingGiftCard ||
                        (!selectedGiftCardId && !giftCardInput.trim()) ||
                        orderTotal <= 0
                      }
                      className="px-4 py-2 rounded-lg bg-[#6900AA] hover:bg-[#57008E] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0"
                    >
                      {validatingGiftCard ? <Loader2 size={13} className="animate-spin" /> : "Apply"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
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
                  Your name{reqStar}
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
                  Your email{reqStar}
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
                  Mobile Number{reqStar}
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

              <ShinyBlackButton
                type="submit"
                className={`w-full py-3 rounded-[0.5rem] ${accentBtn} text-white text-[1.125rem] font-bold`}
              >
                Submit
              </ShinyBlackButton>
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

  // Full-page "seats unavailable" screen: shown by both the full-page booking route and the side-panel checkout
  const seatConflictPage = seatConflict ? (
    <SeatsUnavailablePage
      title={event.name}
      subtitle={selectedShowtime?.venue_name || undefined}
      onBack={() => void handleSeatConflictBack()}
    />
  ) : null;

  if (isPage) {
    return (
      <>
        {panel}
        {checkoutModals}
        {seatConflictPage}
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
      {seatConflictPage}
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
