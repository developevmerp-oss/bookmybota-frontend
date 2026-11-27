"use client";

import { useMemo, useState, useEffect, useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  AlertCircle,
  Loader2,
  Armchair,
  Tv,
  Maximize2,
  Map as MapIcon,
  LayoutGrid,
  Rows3,
  X,
  Ticket,
  User,
  Tag,
  Gift,
  CheckCircle2,
  Banknote,
  Timer,
  UtensilsCrossed,
  Search,
  Plus,
  Minus,
  ShoppingBag,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ArrowLeft,
  Percent,
  Info,
  Pencil,
  Accessibility,
} from "lucide-react";
import { FaMoon, FaUniversalAccess } from "react-icons/fa";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { useSelectedCity } from "@/lib/useSelectedCity";
import PaymentSuccessView from "@/components/Shared/PaymentSuccessView";
import ShinyBlackButton from "@/components/Shared/ShinyBlackButton";
import {
  applyBestsellerFlagsToRawSeats,
  finalizeBestsellerMarks,
  seatHasExplicitBestsellerFlag,
} from "@/lib/bmsBestsellerSeats";
import { seatHasAccessibleFlag } from "@/lib/bmsAccessibleSeats";
import MovieAccessibilitySeatModal from "@/components/MovieLandingPage/MovieAccessibilitySeatModal";
import {
  useGetMovieShowtimeLayoutQuery,
  useCreateMovieBookingMutation,
  useCreateMovieSeatHoldMutation,
  useReleaseMovieSeatHoldMutation,
  useGetMyGiftCardsQuery,
  usePreviewGiftCardRedeemMutation,
  useGetShowtimeBeveragesQuery,
  useValidatePlatformPromoCodeMutation,
  useGetPublicMovieShowtimesQuery,
  useGetMovieEligiblePlatformOffersQuery,
  useGetPublicCinemaOffersForMovieQuery,
  type MovieBookingSeatPayload,
  type GiftCardRedeemPreview,
  type CinemaBeverage,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { extractApiError, isSeatConflictError } from "@/lib/apiErrors";
import SeatsUnavailablePage from "@/components/Shared/SeatsUnavailablePage";
import { sanitizePhoneInput } from "@/lib/validation";
import {
  emptyMovieCheckoutFormValues,
  movieCheckoutFormSchema,
  type MovieCheckoutFormValues,
} from "@/lib/movieCheckoutFormSchema";
import PhoneInput from "@/components/Shared/PhoneInput";
import CustomerAuthModal from "@/components/Shared/CustomerAuthModal";
import { formatMoney } from "@/lib/currencyFormat";
import {
  formatDateCustomer,
  formatTime12h,
  getVenueDateTimeParts,
  isMovieShowEnded,
  isVenueWallTimeReached,
  venueDateStr,
} from "@/lib/dateFormat";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { isGiftCardSpendable } from "@/lib/giftCardOwnership";
import { resolveHoldExpiresAt } from "@/lib/holdCountdown";
import { pickContiguousBlock } from "@/lib/bmsSeatAutoSelect";
import { CustomerFullscreenShimmer, SeatMapShimmer } from "@/components/Shared/Shimmer";
import MovieSeatQtyModal from "@/components/MovieLandingPage/MovieSeatQtyModal";
import images from "@/Images";

/** Seat map palette — Best Seats (blue glow), Available, Occupied (×), Selected (purple glow) */
const SEAT_AVAILABLE =
  "bg-white text-slate-800 border border-[#4B5563] hover:border-[#6900AA] cursor-pointer";
const SEAT_BESTSELLER =
  "text-slate-800 border border-[#5BA3D9] cursor-pointer bg-[radial-gradient(circle_at_center,#FFFFFF_18%,#C5E4F7_58%,#7EB8E8_100%)] shadow-[0_0_8px_2px_rgba(91,163,217,0.4)] hover:border-[#3B82F6]";
const SEAT_SELECTED =
  "text-white border border-[#7B61FF] bg-[#7B61FF] cursor-pointer shadow-[0_0_0_3px_rgba(123,97,255,0.22),0_0_12px_3px_rgba(123,97,255,0.4)]";
const SEAT_BOOKED =
  "bg-white text-slate-300 border border-[#E0E0E0] cursor-not-allowed";
const SEAT_SELECTED_MINI =
  "border border-[#7B61FF] bg-[#7B61FF]";
const SEAT_SELECTED_SWATCH =
  "border border-[#7B61FF] bg-[#7B61FF] shadow-[0_0_0_2px_rgba(123,97,255,0.22),0_0_8px_2px_rgba(123,97,255,0.35)]";
const SEAT_BESTSELLER_SWATCH =
  "bg-[radial-gradient(circle_at_center,#FFFFFF_18%,#C5E4F7_58%,#7EB8E8_100%)] border border-[#5BA3D9] shadow-[0_0_6px_1px_rgba(91,163,217,0.4)]";

function availableSeatClass(isBestseller?: boolean, withHoverScale = false) {
  const base = isBestseller ? SEAT_BESTSELLER : SEAT_AVAILABLE;
  return withHoverScale ? `${base} hover:scale-105` : base;
}

function formatSeatPageTime(startsAt: string): string {
  const label = formatTime12h(startsAt);
  return label === "—" ? String(startsAt || "") : label;
}

function showtimeDateKey(startsAt: string): string {
  return getVenueDateTimeParts(startsAt)?.dateKey || "";
}

function formatSeatPageDateParts(startsAt: string): { weekday: string; dayMonth: string } {
  const parts = getVenueDateTimeParts(startsAt);
  if (!parts) return { weekday: "", dayMonth: "" };
  const full = formatDateCustomer(startsAt);
  const dayMonth = full && full !== "—" ? full : "";
  return { weekday: parts.weekdayLong.slice(0, 3), dayMonth };
}

/** True once wall-clock is past starts_at (late entry still allowed until show ends). */
function isShowtimeStarted(startsAt: string): boolean {
  if (!startsAt) return false;
  return isVenueWallTimeReached(startsAt);
}

function isLateNightShow(startsAt: string): boolean {
  const hour = getVenueDateTimeParts(startsAt)?.hour;
  if (hour == null) return false;
  return hour >= 23 || hour < 5;
}

/**
 * Cinema screen — curved 3D lavender trapezoid (wide top, narrow bottom, upward arch).
 * Matches the reference slab: pale face + darker top rim. Pass `flip` when the
 * screen is below the seats so the wide curved edge still faces them.
 */
function CinemaScreenArc({
  className = "",
  flip = false,
}: {
  className?: string;
  /** Flip vertically when screen sits under the seats. */
  flip?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 480 48"
      className={className}
      preserveAspectRatio="none"
      aria-hidden
      style={flip ? { transform: "scaleY(-1)" } : undefined}
    >
      {/* Main face — pale lavender trapezoid, both edges arch upward */}
      <path
        d="M18 24
           C130 4 350 4 462 24
           L418 40
           C350 26 130 26 62 40
           Z"
        fill="#E8DEF8"
        stroke="#B59AD9"
        strokeWidth="1.35"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Top rim / 3D thickness (darker purple) */}
      <path
        d="M22 18
           C130 0 350 0 458 18
           L462 24
           C350 4 130 4 18 24
           Z"
        fill="#C9B6E8"
        stroke="#A992D4"
        strokeWidth="1"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Soft highlight on top rim */}
      <path
        d="M26 19 C130 2 350 2 454 19"
        fill="none"
        stroke="#F5F0FC"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.9"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

type SeatPageChipStatus = "available" | "filling" | "started" | "soldout";

const SEAT_PAGE_STATUS_BORDER: Record<SeatPageChipStatus, string> = {
  available: "#22C55E",
  filling: "#EAB308",
  soldout: "#DC2626",
  started: "#F97316",
};

function seatPageChipStatus(
  fillStatus?: string | null,
  past?: boolean
): SeatPageChipStatus {
  if (past) return "started";
  const s = String(fillStatus || "").toUpperCase();
  if (s === "SOLD_OUT") return "soldout";
  if (s === "FILLING_FAST") return "filling";
  if (s === "STARTED") return "started";
  return "available";
}

const HOLD_SESSION_KEY = "bmb_movie_hold_session";

const VenueLayoutViewer = dynamic(
  () => import("@/components/EventLandingPage/VenueLayoutViewer"),
  {
    ssr: false,
    loading: () => <SeatMapShimmer />,
  }
);

function getCinemaSectionColor(secName: string): string {
  const name = (secName || "").toLowerCase();
  if (name.includes("recliner")) return "#0284c7";
  if (name.includes("prime")) return "#3b82f6";
  if (name.includes("classic")) return "#6366f1";
  if (name.includes("vip") || name.includes("premium")) return "#f59e0b";
  if (name.includes("platinum")) return "#06b6d4";
  if (name.includes("gold")) return "#a855f7";
  if (name.includes("dress")) return "#ec4899";
  if (name.includes("balcony")) return "#8b5cf6";
  return "#3b82f6";
}

function money(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function formatCountdown(totalSeconds: number): string {
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

function normalizeSeatId(id: string): string {
  const clean = String(id || "").trim().toUpperCase();
  const m = clean.match(/^([A-Z]+)0*(\d+)$/);
  return m ? `${m[1]}${m[2]}` : clean;
}

function isSameSeat(
  idA: string,
  idB: string,
  rowA?: string,
  rowB?: string,
  numA?: string | number,
  numB?: string | number
): boolean {
  if (!idA && !idB) return false;
  if (idA === idB) return true;
  const normA = normalizeSeatId(idA);
  const normB = normalizeSeatId(idB);
  if (normA && normA === normB) return true;

  if (rowA && rowB && numA != null && numB != null) {
    const rA = String(rowA).trim().toUpperCase();
    const rB = String(rowB).trim().toUpperCase();
    const nA = Number(String(numA).replace(/^0+/, ""));
    const nB = Number(String(numB).replace(/^0+/, ""));
    if (rA && rB && rA === rB && nA === nB) return true;
  }
  return false;
}

const fieldErrorClass = "mt-1.5 text-[11px] font-semibold text-rose-600";

type BookingStep = "seats" | "beverages" | "review";

interface SelectedBeverage {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string | null;
  category?: string;
}

interface MovieSeatLayoutPageProps {
  showtimeId: string;
}

interface GridSeat {
  id: string;
  row: string;
  number: string | number;
  tierName: string;
  price: number;
  isBooked: boolean;
  isAisleGap?: boolean;
  /** Real position of the seat on the saved layout, in classic-grid pixels from the left edge of the grid */
  leftPx?: number;
  /** BMS: popular mid-block seats (same price, orange outline when available) */
  isBestseller?: boolean;
  /** Wheelchair / accessibility seat */
  isAccessible?: boolean;
}

/** One seat step on the saved layout equals this many pixels in the classic grid (seat 40px + gap 12px) */
const GEO_PITCH_PX = 52;
const GEO_SEAT_PX = 40;

interface GridRow {
  /** Vertical position of the row on the saved layout, and the extra space above it where the layout leaves a gap */
  y?: number;
  gapBeforePx?: number;
  rowLabel: string;
  tierName: string;
  price: number;
  seats: GridSeat[];
}

export default function MovieSeatLayoutPage({ showtimeId }: MovieSeatLayoutPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((state) => (state as any).auth?.user);
  const selectedCity = useSelectedCity();

  /** BMS: pick seat count on the map first; URL `qty` means the picker was confirmed. */
  const hasQtyParam = searchParams.has("qty");
  const [overrideQty, setOverrideQty] = useState<number | null>(null);
  const qty = useMemo(() => {
    if (overrideQty !== null) return overrideQty;
    const raw = Number(searchParams.get("qty") || 2);
    if (!Number.isFinite(raw) || raw < 1) return 2;
    return Math.min(10, Math.floor(raw));
  }, [searchParams, overrideQty]);
  const [qtyModalOpen, setQtyModalOpen] = useState(!hasQtyParam);
  const [qtyModalDismissible, setQtyModalDismissible] = useState(false);
  const [accessModalOpen, setAccessModalOpen] = useState(false);

  useEffect(() => {
    if (!searchParams.has("qty")) {
      setQtyModalOpen(true);
      setQtyModalDismissible(false);
    }
  }, [searchParams, showtimeId]);

  useEffect(() => {
    setSelectedSeats([]);
    isTouchClassicRef.current = false;
    lastClassicFitKeyRef.current = "";
  }, [showtimeId]);

  const [step, setStep] = useState<BookingStep>("seats");
  const [sessionToken, setSessionToken] = useState<string | undefined>(() =>
    readHoldSessionToken()
  );
  const [holdId, setHoldId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [timeOutOpen, setTimeOutOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [billingEditOpen, setBillingEditOpen] = useState(false);
  const [pendingAfterAuth, setPendingAfterAuth] = useState(false);
  const [holding, setHolding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelTxnOpen, setCancelTxnOpen] = useState(false);
  const [cancelTxnAction, setCancelTxnAction] = useState<"back" | "exit">("back");
  const [bookedSuccessId, setBookedSuccessId] = useState<string | null>(null);
  const [offersModalOpen, setOffersModalOpen] = useState(false);
  const [offersModalTab, setOffersModalTab] = useState<"ALL" | "MOVIES" | "PLATFORM">("ALL");
  const [giftCardModalOpen, setGiftCardModalOpen] = useState(false);

  const [selectedSeats, setSelectedSeats] = useState<MovieBookingSeatPayload[]>([]);
  // true when someone else took the chosen seats at the same moment: shows the full-page "seats unavailable" screen
  const [seatConflict, setSeatConflict] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [appliedPromoOfferId, setAppliedPromoOfferId] = useState<string | null>(null);
  const [giftCardInput, setGiftCardInput] = useState("");
  const [selectedGiftCardId, setSelectedGiftCardId] = useState("");
  const [appliedGiftCard, setAppliedGiftCard] = useState<GiftCardRedeemPreview | null>(null);

  const [selectedBeverages, setSelectedBeverages] = useState<Record<string, SelectedBeverage>>({});
  const [bevSearch, setBevSearch] = useState("");
  const [bevCategoryFilter, setBevCategoryFilter] = useState<string>("ALL");
  const [billOpen, setBillOpen] = useState(false);

  /** Classic is the original static seat grid. Canvas is the screen layout saved for this show. */
  const [viewMode, setViewMode] = useState<"canvas" | "grid" | "classic">("classic");
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [classicZoom, setClassicZoom] = useState(1.0);
  const [showClassicMinimap, setShowClassicMinimap] = useState(false);
  const [classicContentSize, setClassicContentSize] = useState({ w: 0, h: 0 });
  const [classicViewport, setClassicViewport] = useState({
    top: 0,
    left: 0,
    height: 1,
    width: 1,
    canScroll: false,
  });
  const [stickyRowLabels, setStickyRowLabels] = useState<
    Array<{ key: string; label: string; top: number }>
  >([]);

  const proceedRef = useRef<() => Promise<void>>(async () => { });
  const showtimeStripRef = useRef<HTMLDivElement | null>(null);
  const activeShowtimeChipRef = useRef<HTMLSpanElement | null>(null);
  const classicViewportRef = useRef<HTMLDivElement | null>(null);
  const classicContentRef = useRef<HTMLDivElement | null>(null);
  const classicMinimapHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const classicDragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    pointerId: number;
  } | null>(null);
  const classicMinimapDragRef = useRef(false);
  const classicZoomRef = useRef(1.0);
  const isTouchClassicRef = useRef(false);
  const classicPinchRef = useRef<{ startDist: number; startScale: number } | null>(null);
  const lastClassicFitKeyRef = useRef("");

  useEffect(() => {
    dispatch(loadFromStorage());
    setSessionToken(readHoldSessionToken());
  }, [dispatch]);

  const {
    data: layoutData,
    isLoading,
    isError,
    error: layoutError,
    refetch,
  } = useGetMovieShowtimeLayoutQuery(
    {
      showtimeId,
      session_token: sessionToken,
    },
    { refetchOnMountOrArgChange: true }
  );
  const layoutErrorMessage = extractApiError(
    layoutError,
    "We couldn’t load the seat layout for this showtime. It might have finished or been updated."
  );
  const showHasStarted = Boolean(
    layoutData?.showtime?.has_started || layoutData?.showtime?.booking_state === "STARTED"
  );

  const [createHold] = useCreateMovieSeatHoldMutation();
  const [releaseHold, { isLoading: releasingHold }] = useReleaseMovieSeatHoldMutation();
  const [createBooking] = useCreateMovieBookingMutation();
  const [previewGiftCard, { isLoading: validatingGiftCard }] = usePreviewGiftCardRedeemMutation();
  const [validatePromo, { isLoading: validatingPromo }] = useValidatePlatformPromoCodeMutation();

  const isCustomerLoggedIn = Boolean(
    authUser && (authUser.role === "customer" || authUser.customer_id)
  );
  const customerId =
    authUser?.role === "customer" ? authUser.customer_id || authUser.id || "" : "";

  const { data: myGiftCards = [] } = useGetMyGiftCardsQuery(undefined, {
    skip: !customerId,
  });

  const movieIdForOffers = String(layoutData?.movie?.id || "");
  const { data: activePlatformOffers = [] } = useGetMovieEligiblePlatformOffersQuery(
    {
      movie_id: movieIdForOffers,
      customer_id: customerId || null,
      ...(selectedCity && selectedCity !== "All Cities" ? { city: selectedCity } : {}),
    },
    { skip: !movieIdForOffers }
  );

  const { data: publicCinemaOffers = [] } = useGetPublicCinemaOffersForMovieQuery(
    String(layoutData?.movie?.id || layoutData?.movie?.slug || ""),
    {
      skip: !layoutData?.movie?.id && !layoutData?.movie?.slug,
    }
  );

  const { data: showtimeBeverages = [] } = useGetShowtimeBeveragesQuery(showtimeId);

  const movieKeyForShowtimes = layoutData?.movie?.slug || layoutData?.movie?.id || "";
  const showtimeDateForSlots = layoutData?.showtime?.starts_at
    ? showtimeDateKey(layoutData.showtime.starts_at)
    : "";

  /** Seat-page back → restore the exact showtimes URL (with user's chosen filters), or fallback to same date. */
  const showtimesBackHref = useMemo(() => {
    const movieKey = layoutData?.movie?.slug || layoutData?.movie?.id;
    if (!movieKey) return "/movies";
    try {
      const saved = sessionStorage.getItem("bmb_movie_showtimes_return_url");
      if (
        saved &&
        (saved.startsWith(`/movies/${movieKey}/showtimes`) ||
          (layoutData?.movie?.id && saved.startsWith(`/movies/${layoutData.movie.id}/showtimes`)) ||
          (layoutData?.movie?.slug && saved.startsWith(`/movies/${layoutData.movie.slug}/showtimes`)))
      ) {
        return saved;
      }
    } catch {
      /* ignore */
    }
    const params = new URLSearchParams();
    const dateKey = layoutData?.showtime?.starts_at
      ? showtimeDateKey(layoutData.showtime.starts_at)
      : "";
    if (dateKey) params.set("date", dateKey);
    const qs = params.toString();
    return qs ? `/movies/${movieKey}/showtimes?${qs}` : `/movies/${movieKey}/showtimes`;
  }, [
    layoutData?.movie?.slug,
    layoutData?.movie?.id,
    layoutData?.showtime?.starts_at,
  ]);

  const { data: publicShowtimesData } = useGetPublicMovieShowtimesQuery(
    {
      idOrSlug: movieKeyForShowtimes,
      date: showtimeDateForSlots || undefined,
      city_slug: selectedCity || undefined,
    },
    { skip: !movieKeyForShowtimes || !showtimeDateForSlots }
  );

  const theaterShowtimes = useMemo(() => {
    const cinemaId = layoutData?.cinema?.id;
    if (!cinemaId || !publicShowtimesData?.cinemas?.length) return [];
    const group = publicShowtimesData.cinemas.find((c) => c.id === cinemaId);
    if (!group?.showtimes?.length) return [];
    return [...group.showtimes].sort((a, b) =>
      String(a.starts_at).localeCompare(String(b.starts_at))
    );
  }, [publicShowtimesData, layoutData?.cinema?.id]);

  /** Keep the selected showtime chip centered in the horizontal strip. */
  useEffect(() => {
    if (!theaterShowtimes.length || !showtimeId) return;
    let cancelled = false;
    const centerActive = () => {
      if (cancelled) return;
      const strip = showtimeStripRef.current;
      const chip = activeShowtimeChipRef.current;
      if (!strip || !chip) return;
      const stripRect = strip.getBoundingClientRect();
      const chipRect = chip.getBoundingClientRect();
      const delta =
        chipRect.left +
        chipRect.width / 2 -
        (stripRect.left + stripRect.width / 2);
      const nextLeft = Math.max(
        0,
        Math.min(strip.scrollWidth - strip.clientWidth, strip.scrollLeft + delta)
      );
      if (Math.abs(strip.scrollLeft - nextLeft) < 1) return;
      strip.scrollTo({ left: nextLeft, behavior: "smooth" });
    };
    const id = window.requestAnimationFrame(() => {
      centerActive();
      window.setTimeout(centerActive, 80);
      window.setTimeout(centerActive, 240);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(id);
    };
  }, [theaterShowtimes, showtimeId]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    watch,
    trigger,
    formState: { errors },
  } = useForm<MovieCheckoutFormValues>({
    resolver: yupResolver(movieCheckoutFormSchema) as any,
    defaultValues: emptyMovieCheckoutFormValues(),
    mode: "onSubmit",
  });

  useEffect(() => {
    if (!authUser || !isCustomerLoggedIn) return;
    const current = getValues();
    reset({
      guest_name: current.guest_name || authUser.name || "",
      guest_phone: current.guest_phone || sanitizePhoneInput(authUser.phone || ""),
      guest_email: current.guest_email || authUser.email || "",
    });
  }, [authUser, isCustomerLoggedIn, getValues, reset]);

  const showtime = layoutData?.showtime;
  const movie = layoutData?.movie;
  const cinema = layoutData?.cinema;
  const screen = layoutData?.screen;

  const seatQtyTiers = useMemo(() => {
    const fromPublic = theaterShowtimes.find((s) => s.id === showtimeId);
    if (fromPublic?.tiers && fromPublic.tiers.length > 0) {
      return fromPublic.tiers.map((t) => ({
        tier_name: t.tier_name,
        price: Number(t.price) || 0,
        status: t.status,
      }));
    }
    const pricing = showtime?.tier_pricing || fromPublic?.tier_pricing || [];
    return pricing.map((t) => ({
      tier_name: t.tier_name,
      price: Number(t.price) || 0,
      status: "AVAILABLE" as const,
    }));
  }, [theaterShowtimes, showtimeId, showtime?.tier_pricing]);

  const bookedSet = useMemo(() => {
    const booked = layoutData?.booked_seat_identifiers ?? [];
    const held = layoutData?.held_seat_identifiers ?? [];
    const showBlocked = layoutData?.show_blocked_seat_identifiers ?? [];
    const screenBlocked = layoutData?.blocked_seat_identifiers ?? [];
    const set = new Set<string>();
    const add = (value: string) => {
      const s = value.trim();
      if (!s) return;
      set.add(s);
      set.add(s.toUpperCase());
      set.add(s.toLowerCase());
    };
    for (const raw of [...booked, ...held, ...showBlocked, ...screenBlocked]) {
      if (!raw) continue;
      const s = String(raw).trim();
      add(s);
      const match = s.match(/^([A-Za-z]+)[-_ ]?0*(\d+)$/);
      if (match) {
        const prefix = match[1];
        const num = Number(match[2]);
        add(`${prefix}${num}`);
        add(`${prefix}${String(num).padStart(2, "0")}`);
      }
      const sectionMatch = s.match(/^(.+)-([A-Za-z]+)-0*(\d+)$/);
      if (sectionMatch) {
        const row = sectionMatch[2];
        const num = Number(sectionMatch[3]);
        add(`${row}${num}`);
        add(`${row}${String(num).padStart(2, "0")}`);
        add(`${sectionMatch[1].trim()} ${row}${num}`);
      }
    }
    return set;
  }, [layoutData]);

  const hasCanvasLayout = useMemo(() => {
    return Boolean(
      layoutData?.layout_template?.seats_json &&
      Array.isArray(layoutData.layout_template.seats_json) &&
      layoutData.layout_template.seats_json.length > 0
    );
  }, [layoutData]);

  useEffect(() => {
    if (viewMode === "canvas" && !hasCanvasLayout) setViewMode("classic");
  }, [viewMode, hasCanvasLayout]);

  const getTierPrice = useCallback(
    (sectionName: string, sectionIdx: number = 0): number => {
      const tiers = showtime?.tier_pricing;
      if (!tiers || tiers.length === 0) return 200;

      const cleanSec = (sectionName || "").trim().toLowerCase();

      const matched = tiers.find((t: any) => {
        const tName = String(t.tier_name || t.name || t.section_name || "")
          .trim()
          .toLowerCase();
        return tName && (tName === cleanSec || cleanSec.includes(tName) || tName.includes(cleanSec));
      });
      if (matched && !isNaN(Number(matched.price))) {
        return Number(matched.price);
      }

      if (tiers[sectionIdx] && !isNaN(Number(tiers[sectionIdx].price))) {
        return Number(tiers[sectionIdx].price);
      }

      const lastTier = tiers[tiers.length - 1];
      return Number(lastTier?.price || 200);
    },
    [showtime?.tier_pricing]
  );

  const cinemaLegend = useMemo(() => {
    if (!layoutData?.layout_template?.seats_json || !Array.isArray(layoutData.layout_template.seats_json)) {
      return [];
    }
    const secMap = new Map<string, number>();
    for (const s of layoutData.layout_template.seats_json) {
      const sec = s.section_name || "Standard";
      secMap.set(sec, (secMap.get(sec) || 0) + 1);
    }
    return Array.from(secMap.entries()).map(([secName, count], idx) => {
      const price = getTierPrice(secName, idx);
      const color = getCinemaSectionColor(secName);
      return { name: secName, color, price, count };
    });
  }, [layoutData, getTierPrice]);

  const canvasLayoutData = useMemo(() => {
    if (!hasCanvasLayout || !layoutData?.layout_template) return null;
    const rawSeats = layoutData.layout_template.seats_json || [];
    const withBestseller = applyBestsellerFlagsToRawSeats(rawSeats);
    return {
      data: {
        seats: withBestseller.map((s: any, idx: number) => {
          const rowLabel = String(s.row_label || "").trim();
          const seatLabel = String(s.seat_label || "").trim();
          const secName = String(s.section_name || "Standard").trim();
          const labelId = `${rowLabel}${seatLabel}`;

          const isDupe =
            withBestseller.filter(
              (o: any) =>
                String(o.row_label || "").trim() === rowLabel &&
                String(o.seat_label || "").trim() === seatLabel
            ).length > 1;

          const friendlyId = isDupe && secName ? `${secName} ${labelId}` : labelId;
          const seatId = friendlyId || s.internalId || s.id || `seat-${idx}`;

          const isBooked =
            bookedSet.has(seatId) ||
            bookedSet.has(labelId) ||
            bookedSet.has(friendlyId) ||
            (s.internalId && bookedSet.has(s.internalId)) ||
            bookedSet.has(`${rowLabel}${Number(seatLabel)}`) ||
            (s.status && !["AVAILABLE", "ACTIVE"].includes(String(s.status).toUpperCase()));

          return {
            ...s,
            id: seatId,
            internalId: s.internalId,
            friendlyId,
            status: isBooked ? "BOOKED" : "AVAILABLE",
            is_bestseller: Boolean(s.is_bestseller),
          };
        }),
        seating_config: layoutData.layout_template.seating_config,
      },
    };
  }, [layoutData, hasCanvasLayout, bookedSet]);

  /** Cinema screen follows layout shape when present; otherwise BMS default = top. */
  const screenPosition = useMemo<"top" | "bottom">(() => {
    const shapes = layoutData?.layout_template?.seating_config?.shapes;
    if (Array.isArray(shapes) && shapes.length > 0) {
      const screenShape = shapes.find((s: any) =>
        String(s.text || s.type || "").toLowerCase().includes("screen")
      );
      if (screenShape) {
        const rawSeats = Array.isArray(layoutData?.layout_template?.seats_json)
          ? layoutData.layout_template.seats_json
          : [];
        if (rawSeats.length > 0) {
          const ys = rawSeats.map((s: any) => Number(s.coordinate_y ?? 0));
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          const midY = (minY + maxY) / 2;
          return Number(screenShape.y ?? 0) <= midY ? "top" : "bottom";
        }
      }
    }
    return "top";
  }, [layoutData]);

  const gridRows = useMemo<GridRow[]>(() => {
    if (!layoutData) return [];

    let rawSeats: any[] | null = null;
    if (Array.isArray(layoutData.layout_template?.seats_json)) {
      rawSeats = layoutData.layout_template.seats_json;
    } else if (typeof layoutData.layout_template?.seats_json === "string") {
      try {
        rawSeats = JSON.parse(layoutData.layout_template.seats_json);
      } catch {
        rawSeats = null;
      }
    }

    if (Array.isArray(rawSeats) && rawSeats.length > 0) {
      const sectionMap = new Map<string, any[]>();
      for (const s of rawSeats) {
        const secName = (s.section_name || "Standard").trim();
        if (!sectionMap.has(secName)) sectionMap.set(secName, []);
        sectionMap.get(secName)!.push(s);
      }

      const sortedSections = Array.from(sectionMap.entries())
        .map(([secName, seats]) => {
          const minY = Math.min(...seats.map((s: any) => Number(s.coordinate_y ?? 0)));
          return { secName, seats, minY };
        })
        .sort((a, b) => a.minY - b.minY);

      const rows: GridRow[] = [];
      const geo: Array<{ seat: GridSeat; x: number }> = [];
      let geoPitch = Infinity;

      sortedSections.forEach((sec, secIdx) => {
        const price = getTierPrice(sec.secName, secIdx);
        const rowMap = new Map<string, any[]>();
        for (const s of sec.seats) {
          const r = String(s.row_label || "A").trim();
          if (!rowMap.has(r)) rowMap.set(r, []);
          rowMap.get(r)!.push(s);
        }

        const sortedRows = Array.from(rowMap.entries())
          .map(([rowLabel, seats]) => {
            const avgY =
              seats.reduce((sum: number, s: any) => sum + Number(s.coordinate_y ?? 0), 0) /
              (seats.length || 1);
            seats.sort((a: any, b: any) => Number(a.coordinate_x ?? 0) - Number(b.coordinate_x ?? 0));
            return { rowLabel, seats, avgY };
          })
          .sort((a, b) => a.avgY - b.avgY);

        for (const rowObj of sortedRows) {
          const rowSeats = rowObj.seats;
          const steps: number[] = [];
          for (let i = 0; i < rowSeats.length - 1; i++) {
            const diff =
              Number(rowSeats[i + 1].coordinate_x ?? 0) - Number(rowSeats[i].coordinate_x ?? 0);
            if (diff > 5) steps.push(diff);
          }
          const normalStep = steps.length > 0 ? Math.min(...steps) : 40;
          if (steps.length > 0) geoPitch = Math.min(geoPitch, normalStep);

          const rowSeatLabels = rowSeats.map((s: any) =>
            String(s.seat_label ?? "").trim()
          );
          // Same row can reuse 01–10 on both aisle sides — IDs must stay unique
          const rowHasDuplicateLabels =
            rowSeatLabels.some((l) => l) &&
            new Set(rowSeatLabels.filter(Boolean)).size <
            rowSeatLabels.filter(Boolean).length;

          const gridSeats: GridSeat[] = rowSeats.map((seat: any, seatIdx: number) => {
            const displayNum = seatIdx + 1;
            const seatNum =
              seat.seat_label != null && String(seat.seat_label).trim() !== ""
                ? String(seat.seat_label).trim()
                : String(displayNum);
            const labelId = `${rowObj.rowLabel}${seatNum}`;
            const continuousId = `${rowObj.rowLabel}${String(displayNum).padStart(2, "0")}`;
            const isDupe =
              rawSeats!.filter(
                (o: any) =>
                  String(o.row_label || "").trim() === rowObj.rowLabel &&
                  String(o.seat_label || "").trim() === seatNum
              ).length > 1;
            const friendlyId = isDupe && sec.secName ? `${sec.secName} ${labelId}` : labelId;
            // Unique readable id (D01, D02… D11) — never use opaque internalId for UI labels
            const seatId = rowHasDuplicateLabels ? continuousId : friendlyId;
            const nextSeat = rowSeats[seatIdx + 1];
            const isAisleGap = nextSeat
              ? Number(nextSeat.coordinate_x ?? 0) - Number(seat.coordinate_x ?? 0) > normalStep * 1.6
              : false;

            const isStatusUnavailable =
              seat.status && !["AVAILABLE", "ACTIVE"].includes(String(seat.status).toUpperCase());

            const isBooked =
              bookedSet.has(seatId) ||
              bookedSet.has(labelId) ||
              bookedSet.has(continuousId) ||
              bookedSet.has(friendlyId) ||
              bookedSet.has(`${rowObj.rowLabel}${Number(seatNum)}`) ||
              bookedSet.has(`${rowObj.rowLabel}${displayNum}`) ||
              (seat.internalId && bookedSet.has(String(seat.internalId))) ||
              Boolean(isStatusUnavailable);

            return {
              id: seatId,
              row: rowObj.rowLabel,
              /** Left-to-right 01–N across the row, including after an aisle. */
              number: String(displayNum).padStart(2, "0"),
              tierName: sec.secName,
              // Per-seat price set by the cinema for this show wins over the tier price
              price: layoutData.seat_price_overrides?.[seatId] ?? price,
              isBooked,
              isAisleGap,
              isBestseller: seatHasExplicitBestsellerFlag(seat),
              isAccessible: seatHasAccessibleFlag(seat),
            };
          });

          gridSeats.forEach((gs, i) => geo.push({ seat: gs, x: Number(rowSeats[i].coordinate_x ?? 0) }));
          rows.push({
            y: rowObj.avgY,
            rowLabel: rowObj.rowLabel,
            tierName: sec.secName,
            price,
            seats: gridSeats,
          });
        }
      });

      // Place every seat where it really is on the saved layout, so aisles and blocks keep their true spacing
      if (geo.length > 0 && Number.isFinite(geoPitch) && geoPitch > 0) {
        const minX = Math.min(...geo.map((g) => g.x));
        const scale = GEO_PITCH_PX / geoPitch;
        geo.forEach((g) => {
          g.seat.leftPx = Math.round((g.x - minX) * scale);
        });
      }

      // Keep the empty bands between row groups (for example between rows F and G)
      let rowStep = Infinity;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i].tierName !== rows[i - 1].tierName) continue;
        const d = (rows[i].y ?? 0) - (rows[i - 1].y ?? 0);
        if (d > 4) rowStep = Math.min(rowStep, d);
      }
      if (Number.isFinite(rowStep)) {
        for (let i = 1; i < rows.length; i++) {
          if (rows[i].tierName !== rows[i - 1].tierName) continue;
          const d = (rows[i].y ?? 0) - (rows[i - 1].y ?? 0);
          if (d > rowStep * 1.5) rows[i].gapBeforePx = Math.round(((d - rowStep) / rowStep) * 50);
        }
      }

      if (rows.length > 0) return finalizeBestsellerMarks(rows);
    }

    const customTemplate =
      layoutData.layout_template?.seating_config || (layoutData.layout_template as any)?.data;

    if (
      customTemplate?.sections &&
      Array.isArray(customTemplate.sections) &&
      customTemplate.sections.length > 0
    ) {
      const rows: GridRow[] = [];
      const isMultiSec = customTemplate.sections.length > 1;
      for (const sec of customTemplate.sections) {
        const tierName = sec.tier_name || sec.name || "Standard";
        const tierObj = showtime?.tier_pricing?.find(
          (t) =>
            ((t as any).tier_name || (t as any).name || "").toLowerCase() === tierName.toLowerCase()
        );
        const price = Number(tierObj?.price || sec.price || 200);
        const secRows = sec.rows || [];
        for (const r of secRows) {
          const rowLabel = r.row_label || r.label || "A";
          const seatCount = Number(r.seat_count || r.seats?.length || 14);
          const seats: GridSeat[] = [];
          for (let i = 1; i <= seatCount; i++) {
            const labelId = `${rowLabel}${i}`;
            const seatId = isMultiSec ? `${tierName} ${labelId}` : labelId;
            const seatIdx0 = i - 1;
            seats.push({
              id: seatId,
              row: rowLabel,
              number: i,
              tierName,
              price,
              isBooked: bookedSet.has(seatId) || bookedSet.has(labelId),
              isAisleGap: seatIdx0 === 3 || seatIdx0 === 9,
              isBestseller: seatHasExplicitBestsellerFlag(r.seats?.[seatIdx0] || r.seats?.[i]),
              isAccessible: seatHasAccessibleFlag(r.seats?.[seatIdx0] || r.seats?.[i]),
            });
          }
          rows.push({ rowLabel, tierName, price, seats });
        }
      }
      return finalizeBestsellerMarks(rows);
    }

    const tiers =
      showtime?.tier_pricing && showtime.tier_pricing.length > 0
        ? showtime.tier_pricing
        : [
          { tier_name: "VIP", price: 350 },
          { tier_name: "Standard", price: 200 },
        ];

    const rows: GridRow[] = [];
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let rowIndex = 0;

    for (const tier of tiers) {
      const tierName = (tier as any).tier_name || (tier as any).name || "Standard";
      const price = Number(tier.price) || 200;
      const rowCount = tierName.toLowerCase().includes("vip") ? 2 : 4;
      const seatsPerRow = 14;

      for (let r = 0; r < rowCount; r++) {
        const rowLabel = alphabet[rowIndex % alphabet.length];
        rowIndex++;
        const seats: GridSeat[] = [];
        for (let s = 1; s <= seatsPerRow; s++) {
          const seatId = `${rowLabel}${s}`;
          const seatIdx0 = s - 1;
          seats.push({
            id: seatId,
            row: rowLabel,
            number: s,
            tierName,
            price,
            isBooked: bookedSet.has(seatId),
            isAisleGap: seatIdx0 === 3 || seatIdx0 === 9,
          });
        }
        rows.push({ rowLabel, tierName, price, seats });
      }
    }

    return finalizeBestsellerMarks(rows);
  }, [layoutData, showtime, bookedSet, getTierPrice]);

  /** Only show Bestseller legend / orange seats when layout marks them (optional feature). */
  const hasBestsellerSeats = useMemo(
    () =>
      gridRows.some((r) => r.seats.some((s) => s.isBestseller && !s.isBooked)) ||
      Boolean(
        (canvasLayoutData as { data?: { seats?: Array<{ is_bestseller?: boolean; status?: string }> } } | null)
          ?.data?.seats?.some(
            (s) => s.is_bestseller && String(s.status || "").toUpperCase() === "AVAILABLE"
          )
      ),
    [gridRows, canvasLayoutData]
  );

  const accessibilityCategories = useMemo(() => {
    type RowAcc = {
      label: string;
      seatIds: string[];
      seats: Array<{ id: string; number: string; isBooked: boolean }>;
    };
    type TierAcc = {
      name: string;
      price: number;
      rows: Map<string, RowAcc>;
    };

    const useAccessibleOnly = gridRows.some((r) =>
      r.seats.some((s) => s.isAccessible && !s.isBooked && !s.isAisleGap)
    );

    const seatSelectable = (seat: GridSeat) => {
      if (seat.isAisleGap || seat.isBooked) return false;
      if (useAccessibleOnly) return Boolean(seat.isAccessible);
      return true;
    };

    const byTier = new Map<string, TierAcc>();

    for (const row of gridRows) {
      for (const seat of row.seats) {
        if (seat.isAisleGap) continue;
        if (!byTier.has(seat.tierName)) {
          byTier.set(seat.tierName, {
            name: seat.tierName,
            price: seat.price,
            rows: new Map(),
          });
        }
        const tier = byTier.get(seat.tierName)!;
        if (!tier.rows.has(row.rowLabel)) {
          tier.rows.set(row.rowLabel, { label: row.rowLabel, seatIds: [], seats: [] });
        }
        const rowAcc = tier.rows.get(row.rowLabel)!;
        if (!rowAcc.seats.some((s) => s.id === seat.id)) {
          rowAcc.seats.push({
            id: seat.id,
            number: String(seat.number),
            isBooked: seat.isBooked,
          });
        }
        if (seatSelectable(seat) && !rowAcc.seatIds.includes(seat.id)) {
          rowAcc.seatIds.push(seat.id);
        }
      }
    }

    const sortSeats = (seats: RowAcc["seats"]) =>
      [...seats].sort((a, b) => {
        const na = Number.parseInt(a.number, 10);
        const nb = Number.parseInt(b.number, 10);
        if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
        return a.number.localeCompare(b.number);
      });

    return Array.from(byTier.values())
      .map((t) => ({
        name: t.name,
        price: t.price,
        rows: Array.from(t.rows.values())
          .filter((r) => r.seatIds.length > 0)
          .map((r) => ({
            label: r.label,
            availableCount: r.seatIds.length,
            seatIds: r.seatIds,
            seats: sortSeats(r.seats),
          })),
      }))
      .filter((t) => t.rows.length > 0);
  }, [gridRows]);

  const resetSeatPromos = () => {
    setPromoApplied(false);
    setDiscountAmount(0);
    setAppliedPromoOfferId(null);
    setAppliedGiftCard(null);
  };

  const findGridSeatContext = useCallback(
    (seatId: string) => {
      for (const row of gridRows) {
        const idx = row.seats.findIndex((s) =>
          isSameSeat(s.id, seatId, s.row, undefined, s.number, undefined)
        );
        if (idx >= 0) {
          return { row, index: idx, seat: row.seats[idx] };
        }
      }
      return null;
    },
    [gridRows]
  );

  const isSeatSelected = useCallback(
    (seatId: string, rowLabel?: string, seatNumber?: string | number) => {
      return selectedSeats.some((s) =>
        isSameSeat(s.seat_identifier, seatId, s.row_label, rowLabel, s.seat_number, seatNumber)
      );
    },
    [selectedSeats]
  );

  const userCancelledHoldRef = useRef(false);

  useEffect(() => {
    if (!layoutData?.own_hold || userCancelledHoldRef.current) return;
    const hold = layoutData.own_hold;
    if (hold.status !== "ACTIVE") return;

    const expiresMs = new Date(hold.expires_at).getTime();
    if (Number.isNaN(expiresMs) || expiresMs <= Date.now()) return;

    setHoldId(hold.id);
    setExpiresAt(hold.expires_at);

    const heldCount = Array.isArray(hold.seat_identifiers) ? hold.seat_identifiers.length : 0;
    if (heldCount > 0) {
      setOverrideQty(heldCount);
      setQtyModalOpen(false);
    }

    setSelectedSeats((prev) => {
      if (prev.length > 0) return prev;
      if (Array.isArray(hold.seats_json) && hold.seats_json.length > 0) {
        return hold.seats_json;
      }
      if (Array.isArray(hold.seat_identifiers) && hold.seat_identifiers.length > 0) {
        const reconstructed: MovieBookingSeatPayload[] = [];
        for (const rawId of hold.seat_identifiers) {
          const ctx = findGridSeatContext(rawId);
          if (ctx) {
            reconstructed.push({
              seat_identifier: ctx.seat.id,
              tier_name: ctx.seat.tierName,
              row_label: ctx.seat.row,
              seat_number: String(ctx.seat.number).padStart(2, "0"),
              unit_price: ctx.seat.price,
            });
          } else {
            const m = String(rawId).match(/^([A-Za-z]+)0*(\d+)$/);
            const r = m ? m[1].toUpperCase() : rawId.charAt(0);
            const n = m ? String(m[2]).padStart(2, "0") : rawId.slice(1);
            reconstructed.push({
              seat_identifier: rawId,
              tier_name: "",
              row_label: r,
              seat_number: n,
              unit_price: 200,
            });
          }
        }
        return reconstructed;
      }
      return prev;
    });
  }, [layoutData?.own_hold, findGridSeatContext]);

  /** BMS-style: contiguous available seats on the same row (aisle-aware). */
  const autoSelectNeighborSeats = useCallback(
    (anchorSeatId: string, need: number) => {
      const ctx = findGridSeatContext(anchorSeatId);
      if (!ctx || need < 1) return null;
      const block = pickContiguousBlock(ctx.row.seats, ctx.index, need);
      if (!block.length) return null;
      return block.map((s) => ({
        seat_identifier: s.id,
        tier_name: s.tierName,
        row_label: s.row,
        seat_number: String(s.number).padStart(2, "0"),
        unit_price: s.price,
      }));
    },
    [findGridSeatContext]
  );

  const formatSelectedSeatCode = useCallback(
    (s: MovieBookingSeatPayload) => {
      const ctx = findGridSeatContext(s.seat_identifier);
      const row = s.row_label || ctx?.seat?.row || "";
      const numRaw = s.seat_number ?? (ctx?.seat != null ? String(ctx.seat.number) : "");
      const num = String(numRaw).replace(/^0+/, "") || numRaw;
      if (row && num) {
        return `${row}${num}`;
      }
      let raw = String(s.seat_identifier || "").trim();
      const tier = (s.tier_name || ctx?.seat?.tierName || "").trim();
      if (tier && raw.toLowerCase().startsWith(tier.toLowerCase())) {
        raw = raw.slice(tier.length).replace(/^[\s\-_]+/, "").trim();
      }
      return raw || String(s.seat_identifier || "").trim();
    },
    [findGridSeatContext]
  );

  const formatSelectedSeatLabel = useCallback(
    (s: MovieBookingSeatPayload) => {
      const code = formatSelectedSeatCode(s);
      const ctx = findGridSeatContext(s.seat_identifier);
      const tier = (s.tier_name || ctx?.seat?.tierName || "").trim();
      if (tier) {
        const tierWord = tier
          .replace(/\s*TIER\s*$/i, "")
          .replace(/\s*ROWS?\s*$/i, "")
          .trim();
        // Title-case first word style: Regular
        const tierLabel =
          tierWord.charAt(0).toUpperCase() + tierWord.slice(1).toLowerCase();
        if (code.toLowerCase().includes(tierLabel.toLowerCase())) {
          return code;
        }
        return `${tierLabel} ${code}`.trim();
      }
      return code;
    },
    [formatSelectedSeatCode, findGridSeatContext]
  );

  const selectedSeatTiers = useMemo(() => {
    return Array.from(new Set(selectedSeats.map((s) => s.tier_name).filter(Boolean)));
  }, [selectedSeats]);

  const seatSummaryLine = useMemo(() => {
    if (!selectedSeats.length) return "";
    const tierMap = new Map<string, string[]>();
    for (const s of selectedSeats) {
      const ctx = findGridSeatContext(s.seat_identifier);
      const tier = (s.tier_name || ctx?.seat?.tierName || "").trim();
      const code = formatSelectedSeatCode(s);
      if (!tierMap.has(tier)) {
        tierMap.set(tier, []);
      }
      tierMap.get(tier)!.push(code);
    }
    return Array.from(tierMap.entries())
      .map(([tier, seats]) => {
        const seatList = seats.join(", ");
        return tier ? `${tier} • ${seatList}` : seatList;
      })
      .join("  •  ");
  }, [selectedSeats, formatSelectedSeatCode, findGridSeatContext]);

  const applyMovieSeats = (next: MovieBookingSeatPayload[]) => {
    const sliced = next.slice(0, qty);
    queueMicrotask(() => {
      setSelectedSeats(sliced);
      resetSeatPromos();
    });
  };

  const handleSeatClick = (seat: GridSeat) => {
    if (seat.isBooked) return;

    // Tap a selected seat → deselect only that seat (adjust like BMS)
    const exists = selectedSeats.some((s) =>
      isSameSeat(s.seat_identifier, seat.id, s.row_label, seat.row, s.seat_number, seat.number)
    );
    if (exists) {
      applyMovieSeats(
        selectedSeats.filter(
          (s) => !isSameSeat(s.seat_identifier, seat.id, s.row_label, seat.row, s.seat_number, seat.number)
        )
      );
      return;
    }

    // Full qty already picked → start a fresh auto-select of the full count
    const startFresh = selectedSeats.length === 0 || selectedSeats.length >= qty;
    const need = startFresh ? qty : qty - selectedSeats.length;

    const autoBlock = autoSelectNeighborSeats(seat.id, need);
    if (!autoBlock || autoBlock.length === 0) {
      toast.message("No available seats in this row for your selection.");
      return;
    }

    if (!startFresh) {
      const currentTier = String(selectedSeats[0]?.tier_name || "");
      const incomingTier = String(autoBlock[0]?.tier_name || "");
      if (currentTier && incomingTier && currentTier !== incomingTier) {
        toast.message("Please select seats from the same price category.");
        return;
      }
      const existingIds = new Set(selectedSeats.map((s) => s.seat_identifier));
      const toAdd = autoBlock.filter((s) => !existingIds.has(s.seat_identifier));
      if (!toAdd.length) return;
      const merged = [...selectedSeats, ...toAdd].slice(0, qty);
      applyMovieSeats(merged);
      if (merged.length < qty) {
        toast.message(`${merged.length}/${qty} selected — tap another row for the rest.`);
      }
      return;
    }

    applyMovieSeats(autoBlock);
    if (autoBlock.length < qty) {
      toast.message(`${autoBlock.length}/${qty} selected — tap another row for the rest.`);
    }
  };

  const handleCanvasSeatsSelected = useCallback(
    (chosenSeats: any[]) => {
      const mapped = chosenSeats.map((cs) => {
        const secName = cs.section_name || "Standard";
        const seatId = String(cs.friendlyId || cs.id);
        const fromGrid = findGridSeatContext(seatId)?.seat;
        const price = fromGrid?.price ?? getTierPrice(secName, 0);
        return {
          seat_identifier: seatId,
          tier_name: fromGrid?.tierName || secName,
          row_label: fromGrid?.row,
          seat_number: fromGrid ? String(fromGrid.number).padStart(2, "0") : undefined,
          unit_price: price,
        };
      });

      const prevIds = new Set(selectedSeats.map((s) => s.seat_identifier));
      const nextIds = new Set(mapped.map((s) => s.seat_identifier));

      // Deselect path from map viewer — or BMS "start fresh" when qty was full
      if (mapped.length < selectedSeats.length) {
        if (
          mapped.length === 1 &&
          !prevIds.has(mapped[0].seat_identifier)
        ) {
          const autoBlock = autoSelectNeighborSeats(mapped[0].seat_identifier, qty);
          if (autoBlock && autoBlock.length > 0) {
            applyMovieSeats(autoBlock);
            if (autoBlock.length < qty) {
              toast.message(`${autoBlock.length}/${qty} selected — tap another row for the rest.`);
            }
            return;
          }
        }
        applyMovieSeats(mapped);
        return;
      }

      const newlyAdded = mapped.filter((s) => !prevIds.has(s.seat_identifier));
      if (newlyAdded.length === 1 && mapped.length === selectedSeats.length + 1) {
        const startFresh = selectedSeats.length === 0 || selectedSeats.length >= qty;
        const need = startFresh ? qty : qty - selectedSeats.length;
        const autoBlock = autoSelectNeighborSeats(newlyAdded[0].seat_identifier, need);
        if (autoBlock && autoBlock.length > 0) {
          if (startFresh) {
            applyMovieSeats(autoBlock);
            if (autoBlock.length < qty) {
              toast.message(`${autoBlock.length}/${qty} selected — tap another row for the rest.`);
            }
          } else {
            const currentTier = String(selectedSeats[0]?.tier_name || "");
            const incomingTier = String(autoBlock[0]?.tier_name || "");
            if (currentTier && incomingTier && currentTier !== incomingTier) {
              toast.message("Please select seats from the same price category.");
              return;
            }
            const existing = new Set(selectedSeats.map((s) => s.seat_identifier));
            const toAdd = autoBlock.filter((s) => !existing.has(s.seat_identifier));
            const merged = [...selectedSeats, ...toAdd].slice(0, qty);
            applyMovieSeats(merged);
            if (merged.length < qty) {
              toast.message(`${merged.length}/${qty} selected — tap another row for the rest.`);
            }
          }
          return;
        }
      }

      if (mapped.length > qty) {
        applyMovieSeats(mapped.slice(0, qty));
        return;
      }

      if (
        mapped.length === selectedSeats.length &&
        mapped.every((s) => prevIds.has(s.seat_identifier)) &&
        selectedSeats.every((s) => nextIds.has(s.seat_identifier))
      ) {
        return;
      }

      applyMovieSeats(mapped);
    },
    // applyMovieSeats / reset are stable enough via closure; deps below cover selection logic
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [autoSelectNeighborSeats, findGridSeatContext, getTierPrice, qty, selectedSeats]
  );

  const ticketSubtotal = useMemo(
    () => money(selectedSeats.reduce((sum, s) => sum + (Number(s.unit_price) || 0), 0)),
    [selectedSeats]
  );

  const convFeePct = Number(layoutData?.pricing_policy?.convenience_fee_percent ?? 0);
  const convVatPct = Number(layoutData?.pricing_policy?.convenience_fee_vat_percent ?? 15);

  const convenienceFeeBase = useMemo(() => {
    if (selectedSeats.length === 0 || convFeePct <= 0) return 0;
    return money((ticketSubtotal * convFeePct) / 100);
  }, [selectedSeats.length, ticketSubtotal, convFeePct]);

  const convenienceFeeTax = useMemo(() => {
    if (convenienceFeeBase <= 0 || convVatPct <= 0) return 0;
    return money((convenienceFeeBase * convVatPct) / 100);
  }, [convenienceFeeBase, convVatPct]);

  const convenienceFee = useMemo(() => {
    return money(convenienceFeeBase + convenienceFeeTax);
  }, [convenienceFeeBase, convenienceFeeTax]);

  const beverageSubtotal = useMemo(
    () => money(Object.values(selectedBeverages).reduce((sum, b) => sum + b.price * b.quantity, 0)),
    [selectedBeverages]
  );

  const orderTotal = useMemo(
    () => money(Math.max(0, ticketSubtotal + beverageSubtotal + convenienceFee - discountAmount)),
    [ticketSubtotal, beverageSubtotal, convenienceFee, discountAmount]
  );

  const giftCardAmount = appliedGiftCard ? Number(appliedGiftCard.amount_applicable) || 0 : 0;

  const grandTotal = useMemo(
    () => money(Math.max(0, orderTotal - giftCardAmount)),
    [orderTotal, giftCardAmount]
  );

  const totalBeverageQty = useMemo(
    () => Object.values(selectedBeverages).reduce((s, b) => s + b.quantity, 0),
    [selectedBeverages]
  );

  const redeemableGiftCards = useMemo(
    () =>
      myGiftCards.filter((c) => {
        const status = String(c.status || "").toUpperCase();
        const cat = String(c.applicable_category || "ALL").toUpperCase();
        const bal = Number(c.current_balance) || 0;
        return (
          bal > 0 &&
          (status === "ACTIVE" || status === "PARTIALLY_USED") &&
          (cat === "ALL" || cat === "MOVIES") &&
          isGiftCardSpendable(c)
        );
      }),
    [myGiftCards]
  );

  const handleApplyPromo = async (codeOverride?: string) => {
    const code = (typeof codeOverride === "string" ? codeOverride : promoCode).trim().toUpperCase();
    if (!code) {
      toast.error("Please enter a promo code.");
      return;
    }
    if (!movie?.id) {
      toast.error("Movie details are still loading. Please try again.");
      return;
    }
    if (ticketSubtotal <= 0) {
      toast.error("Select seats before applying a promo code.");
      return;
    }

    try {
      const result = await validatePromo({
        movie_id: String(movie.id),
        promo_code: code,
        ticket_amount: ticketSubtotal,
        guest_phone: sanitizePhoneInput(getValues("guest_phone") || authUser?.phone || "") || undefined,
        ...(selectedCity ? { city: selectedCity } : {}),
        ...(cinema?.id
          ? { business_id: String(cinema.id) }
          : {}),
      }).unwrap();

      const discount = money(Number(result.discount_amount) || 0);
      if (discount <= 0) {
        toast.error("This promo code does not apply a discount to the current tickets.");
        return;
      }

      setPromoCode(result.promo_code || code);
      setDiscountAmount(discount);
      setPromoApplied(true);
      setAppliedPromoOfferId(result.offer_id || null);
      setOffersModalOpen(false);
      toast.success(`Promo code ${result.promo_code || code} applied! Saved ${formatMoney(discount)}.`);

      // If gift card was already applied, recalculate its preview against new remaining balance
      if (appliedGiftCard) {
        const newOrderTotal = money(Math.max(0, ticketSubtotal + beverageSubtotal + convenienceFee - discount));
        if (newOrderTotal <= 0) {
          setAppliedGiftCard(null);
          toast.info("Gift card removed because promo covers the full order.");
        } else {
          try {
            const gcPayload = appliedGiftCard.gift_card_id
              ? { gift_card_id: appliedGiftCard.gift_card_id, amount: newOrderTotal, category: "MOVIES" as const }
              : giftCardInput.trim()
                ? { code: giftCardInput.trim(), amount: newOrderTotal, category: "MOVIES" as const }
                : null;
            if (gcPayload) {
              const updatedGc = await previewGiftCard(gcPayload).unwrap();
              setAppliedGiftCard(updatedGc);
            }
          } catch {
            // Keep existing
          }
        }
      }
    } catch (err) {
      setPromoApplied(false);
      setDiscountAmount(0);
      setAppliedPromoOfferId(null);
      toast.error(extractApiError(err, "Invalid or expired promo code."));
    }
  };

  const handleRemovePromo = async () => {
    setPromoCode("");
    setPromoApplied(false);
    setDiscountAmount(0);
    setAppliedPromoOfferId(null);
    toast.info("Promo code removed.");

    // Recalculate gift card if applied against full amount
    if (appliedGiftCard) {
      const fullOrderTotal = money(Math.max(0, ticketSubtotal + beverageSubtotal + convenienceFee));
      try {
        const gcPayload = appliedGiftCard.gift_card_id
          ? { gift_card_id: appliedGiftCard.gift_card_id, amount: fullOrderTotal, category: "MOVIES" as const }
          : giftCardInput.trim()
            ? { code: giftCardInput.trim(), amount: fullOrderTotal, category: "MOVIES" as const }
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
      ? { gift_card_id: selectedGiftCardId, amount: orderTotal, category: "MOVIES" as const }
      : giftCardInput.trim()
        ? { code: giftCardInput.trim(), amount: orderTotal, category: "MOVIES" as const }
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

  const confirmCancelTransaction = async () => {
    userCancelledHoldRef.current = true;
    const effectiveHoldId = holdId || layoutData?.own_hold?.id || null;
    try {
      if (effectiveHoldId) {
        await releaseHold({
          holdId: effectiveHoldId,
          session_token: sessionToken || readHoldSessionToken(),
          showtimeId,
        }).unwrap();
      }
    } catch {
      // best-effort release
    }
    clearHoldSessionToken();
    setSessionToken(undefined);
    setHoldId(null);
    setExpiresAt(null);
    setSecondsLeft(null);
    setSelectedSeats([]);
    setSelectedBeverages({});
    setPromoApplied(false);
    setDiscountAmount(0);
    setPromoCode("");
    setAppliedPromoOfferId(null);
    setAppliedGiftCard(null);
    setGiftCardInput("");
    setSelectedGiftCardId("");
    setCancelTxnOpen(false);
    try {
      refetch();
    } catch {
      // ignore
    }
    if (cancelTxnAction === "exit") {
      router.push(showtimesBackHref);
      return;
    }
    setStep("seats");
    void refetch();
  };

  const requestLeaveConfirmStep = (action: "back" | "exit") => {
    setCancelTxnAction(action);
    setCancelTxnOpen(true);
  };

  const resetToSeatsAfterTimeout = async () => {
    userCancelledHoldRef.current = true;
    const effectiveHoldId = holdId || layoutData?.own_hold?.id || null;
    try {
      if (effectiveHoldId) {
        await releaseHold({
          holdId: effectiveHoldId,
          session_token: sessionToken || readHoldSessionToken(),
          showtimeId,
        }).unwrap();
      }
    } catch {
      // best-effort release
    }
    clearHoldSessionToken();
    setSessionToken(undefined);
    setHoldId(null);
    setExpiresAt(null);
    setSecondsLeft(null);
    setTimeOutOpen(false);
    setSelectedSeats([]);
    setSelectedBeverages({});
    setPromoApplied(false);
    setDiscountAmount(0);
    setPromoCode("");
    setAppliedPromoOfferId(null);
    setAppliedGiftCard(null);
    setGiftCardInput("");
    setSelectedGiftCardId("");
    setStep("seats");
    refetch();
  };

  const proceedCreateHold = useCallback(async () => {
    if (selectedSeats.length !== qty) {
      toast.warning(`Please select exactly ${qty} seat${qty === 1 ? "" : "s"}.`);
      return;
    }
    setHolding(true);
    userCancelledHoldRef.current = false;
    try {
      const existing = sessionToken || readHoldSessionToken();
      const res = await createHold({
        showtimeId,
        seats: selectedSeats,
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
      // Route to beverages step if any are available, otherwise skip to review
      setStep(showtimeBeverages.length > 0 ? "beverages" : "review");
      toast.success(res.message || "Seats held. Complete your booking.");
    } catch (err) {
      if (isSeatConflictError(err)) {
        setSelectedSeats([]);
        setSeatConflict(true);
        refetch();
        return;
      }
      const msg = extractApiError(err, "Could not hold seats. Please try again.");
      toast.error(msg);
      if (/show has ended/i.test(msg)) {
        router.push(showtimesBackHref);
        return;
      }
      refetch();
    } finally {
      setHolding(false);
    }
  }, [
    selectedSeats,
    qty,
    sessionToken,
    createHold,
    showtimeId,
    refetch,
    showtimeBeverages.length,
    showtimesBackHref,
    router,
  ]);

  proceedRef.current = proceedCreateHold;

  const handleContinue = async () => {
    if (selectedSeats.length !== qty) {
      toast.warning(`Please select exactly ${qty} seat${qty === 1 ? "" : "s"}.`);
      return;
    }
    if (!isCustomerLoggedIn) {
      setPendingAfterAuth(true);
      setAuthModalOpen(true);
      return;
    }
    // If hold is active and seats are already held, we can directly advance if seats haven't changed
    if (holdId && expiresAt && new Date(expiresAt).getTime() > Date.now()) {
      const heldIds = new Set(
        Array.isArray(layoutData?.own_hold?.seat_identifiers)
          ? layoutData.own_hold.seat_identifiers.map((id: string) => normalizeSeatId(id))
          : []
      );
      const currentSelectedIds = selectedSeats.map((s) => normalizeSeatId(s.seat_identifier));
      const isSameHold =
        heldIds.size > 0 &&
        heldIds.size === currentSelectedIds.length &&
        currentSelectedIds.every((id) => heldIds.has(id));

      if (isSameHold) {
        setStep(showtimeBeverages.length > 0 ? "beverages" : "review");
        return;
      }
    }
    await proceedCreateHold();
  };

  useEffect(() => {
    if (!pendingAfterAuth || !isCustomerLoggedIn || authModalOpen) return;
    setPendingAfterAuth(false);
    void proceedRef.current();
  }, [pendingAfterAuth, isCustomerLoggedIn, authModalOpen]);

  useEffect(() => {
    if (!expiresAt) {
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
  }, [expiresAt]);

  useEffect(() => {
    if (step !== "seats") {
      window.history.pushState({ bmbMovieStep: step }, "");
    }
  }, [step]);

  useEffect(() => {
    if (step === "seats") {
      void refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch fresh seat statuses when returning to seat map
  }, [step, sessionToken]);

  useEffect(() => {
    const handlePopState = () => {
      if (step === "review") {
        requestLeaveConfirmStep("back");
      } else if (step === "beverages") {
        setStep("seats");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [step]);

  const onConfirmBooking = async (values: MovieCheckoutFormValues) => {
    if (!holdId) {
      toast.error("Seat hold expired. Please select seats again.");
      setStep("seats");
      return;
    }
    if (selectedSeats.length !== qty) {
      toast.error(`Please select exactly ${qty} seat${qty === 1 ? "" : "s"}.`);
      return;
    }
    if (timeOutOpen || (secondsLeft !== null && secondsLeft <= 0)) {
      setTimeOutOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      const res = await createBooking({
        showtime_id: showtimeId,
        seats: selectedSeats,
        beverages: Object.values(selectedBeverages).map((b) => ({
          beverage_id: b.id,
          quantity: b.quantity,
          name: b.name,
          unit_price: b.price,
        })),
        guest_name: values.guest_name.trim(),
        guest_phone: sanitizePhoneInput(values.guest_phone),
        guest_email: values.guest_email.trim(),
        promo_code: promoApplied ? promoCode.trim() : undefined,
        platform_offer_id: promoApplied ? appliedPromoOfferId || undefined : undefined,
        payment_method: "CASH",
        hold_id: holdId,
        session_token: sessionToken || readHoldSessionToken(),
        ...(selectedCity ? { city: selectedCity } : {}),
        gift_card_id: appliedGiftCard?.gift_card_id || undefined,
        gift_card_code:
          appliedGiftCard && giftCardInput.trim() && !selectedGiftCardId
            ? giftCardInput.trim()
            : undefined,
      }).unwrap();

      toast.success(res.message || "Booking confirmed!");
      setBookedSuccessId(res.data.booking_id);
    } catch (err) {
      if (isSeatConflictError(err)) {
        setSeatConflict(true);
        return;
      }
      const msg = extractApiError(err, "Failed to confirm booking. Please try again.");
      toast.error(msg);
      if (/show has ended/i.test(msg)) {
        router.push(showtimesBackHref);
        return;
      }
      refetch();
    } finally {
      setSubmitting(false);
    }
  };

  const showDateFormatted = useMemo(() => {
    if (!showtime?.starts_at) return "";
    const label = formatDateCustomer(showtime.starts_at.replace(" ", "T"));
    return label === "—" ? showtime.starts_at : label;
  }, [showtime?.starts_at]);

  const showTimeFormatted = useMemo(() => {
    if (!showtime?.starts_at) return "";
    try {
      const parts = showtime.starts_at.split(" ");
      const timePart = parts[1] || parts[0];
      const [hStr, mStr] = timePart.split(":");
      let h = parseInt(hStr, 10);
      const m = mStr || "00";
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h.toString().padStart(2, "0")}:${m} ${ampm}`;
    } catch {
      return showtime.starts_at;
    }
  }, [showtime?.starts_at]);

  const headerTitle = useMemo(() => {
    const title = (movie?.title || "Movie").trim();
    const format = String(showtime?.format || "").trim();
    const language = String(showtime?.language || "").trim();
    let base = title;
    if (format) base = `${base} (${format})`;
    if (language) base = `${base} - ${language}`;
    return base;
  }, [movie?.title, showtime?.format, showtime?.language]);

  const headerMeta = useMemo(() => {
    const { weekday } = formatSeatPageDateParts(showtime?.starts_at || "");
    const datePart = showDateFormatted
      ? weekday
        ? `${weekday}, ${showDateFormatted}`
        : showDateFormatted
      : "";
    return [cinema?.name, datePart, showTimeFormatted].filter(Boolean).join(" | ");
  }, [cinema?.name, showDateFormatted, showTimeFormatted, showtime?.starts_at]);

  const reviewDateLine = useMemo(() => {
    const dateKey = getVenueDateTimeParts(showtime?.starts_at)?.dateKey || "";
    const weekday = formatSeatPageDateParts(showtime?.starts_at || "").weekday;
    if (dateKey && dateKey === venueDateStr()) return showDateFormatted ? `Today, ${showDateFormatted}` : "Today";
    return [weekday, showDateFormatted].filter(Boolean).join(", ");
  }, [showtime?.starts_at, showDateFormatted]);

  const reviewTimeLine = useMemo(() => {
    if (!showtime?.starts_at) return "";
    const startLabel = formatTime12h(showtime.starts_at);
    if (!startLabel || startLabel === "—") return showTimeFormatted;
    // ends_at includes the 20-minute screen gap. Customers should see the film length only.
    const duration = Number(movie?.duration_minutes);
    const startParts = getVenueDateTimeParts(showtime.starts_at);
    if (!startParts || !Number.isFinite(duration) || duration <= 0) return startLabel;
    const total = startParts.hour * 60 + startParts.minute + duration;
    const hour = Math.floor(total / 60) % 24;
    const minute = total % 60;
    const endLabel = formatTime12h(
      `2000-01-01 ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`
    );
    if (!endLabel || endLabel === "—") return startLabel;
    return `${startLabel} – ${endLabel}`;
  }, [showtime?.starts_at, movie?.duration_minutes, showTimeFormatted]);

  const reviewPoster = resolveMediaUrl(movie?.poster_url || movie?.banner_url || "");
  const guestName = watch("guest_name");
  const guestPhone = watch("guest_phone");
  const guestEmail = watch("guest_email");
  const phoneLocked = isCustomerLoggedIn && Boolean(sanitizePhoneInput(authUser?.phone || ""));
  const ticketPriceLines = useMemo(() => {
    const groups = new Map<string, { label: string; price: number; count: number }>();
    for (const seat of selectedSeats) {
      const tier = (seat.tier_name || "Standard").trim();
      const price = Number(seat.unit_price) || 0;
      const key = `${tier}|${price}`;
      const row = groups.get(key) || { label: tier, price, count: 0 };
      row.count += 1;
      groups.set(key, row);
    }
    return Array.from(groups.values());
  }, [selectedSeats]);

  const openQtyEditor = () => {
    setQtyModalDismissible(true);
    setQtyModalOpen(true);
  };

  const applyAccessibleSeatIds = useCallback(
    (seatIds: string[]) => {
      const picked: MovieBookingSeatPayload[] = [];
      for (const id of seatIds) {
        const ctx = findGridSeatContext(id);
        if (!ctx || ctx.seat.isBooked) continue;
        picked.push({
          seat_identifier: ctx.seat.id,
          tier_name: ctx.seat.tierName,
          row_label: ctx.seat.row,
          seat_number: String(ctx.seat.number).padStart(2, "0"),
          unit_price: ctx.seat.price,
        });
        if (picked.length >= qty) break;
      }
      if (picked.length === 0) {
        toast.error("No accessible seats available in that row.");
        return;
      }
      setSelectedSeats(picked);
      if (picked.length < qty) {
        toast.message(
          `${picked.length}/${qty} accessible seats selected — pick more seats on the map if needed.`
        );
      } else {
        toast.success(
          `${picked.length} accessible seat${picked.length === 1 ? "" : "s"} selected`
        );
      }
    },
    [findGridSeatContext, qty]
  );

  /**
   * Pixel footprint must match classic seat buttons (sm:size-10 + sm:gap-3 + aisle sm:w-8)
   * so every cinema layout gets the same default fit framing.
   */
  const CLASSIC_SEAT_PX = 40;
  const CLASSIC_GAP_PX = 12;
  const CLASSIC_AISLE_PX = 32;

  const classicSeatTrackPx = useMemo(() => {
    let max = CLASSIC_SEAT_PX;
    for (const row of gridRows) {
      if (row.seats.length > 0 && row.seats.every((s) => s.leftPx !== undefined)) {
        max = Math.max(max, ...row.seats.map((s) => (s.leftPx as number) + GEO_SEAT_PX));
        continue;
      }
      let width = 0;
      row.seats.forEach((seat, i) => {
        width += CLASSIC_SEAT_PX;
        if (i < row.seats.length - 1) width += CLASSIC_GAP_PX;
        if (seat.isAisleGap ?? (i === 3 || i === 9)) width += CLASSIC_AISLE_PX;
      });
      max = Math.max(max, width);
    }
    return Math.ceil(max);
  }, [gridRows]);

  /** Fixed left alphabet column + gap before seat track (labels from admin row_label). */
  const classicRowLabelColPx = 30;
  const classicRowLabelGapPx = 36;
  const classicRowOuterPx = classicSeatTrackPx + classicRowLabelColPx + classicRowLabelGapPx;

  const canContinue = selectedSeats.length === qty && !holding;

  const revealClassicMinimap = useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth < 640) return;
    setShowClassicMinimap(true);
    if (classicMinimapHideTimer.current) clearTimeout(classicMinimapHideTimer.current);
    // Show on scroll / zoom-in / zoom-out, then hide (not sticky)
    classicMinimapHideTimer.current = setTimeout(() => {
      setShowClassicMinimap(false);
    }, 1600);
  }, []);

  /** Tightest zoom-out allowed (width + height) — floor for the − control only. */
  const getClassicFitZoom = useCallback(() => {
    const viewport = classicViewportRef.current;
    const content = classicContentRef.current;
    if (!viewport || !content) return 1;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    if (vw < 40 || vh < 40) return 1;
    const pad = 8;
    const baseW = Math.max(content.scrollWidth || content.offsetWidth, classicContentSize.w, 1);
    const baseH = Math.max(content.scrollHeight || content.offsetHeight, classicContentSize.h, 1);
    const zw = (vw - pad * 2) / baseW;
    const zh = (vh - pad * 2) / baseH;
    return Math.min(1, Math.max(0.35, Math.min(zw, zh)));
  }, [classicContentSize.h, classicContentSize.w]);

  /**
   * Default open zoom — match the reference framing (~20% side margin each side,
   * readable seat size). Width-based only: do NOT shrink to fit full hall height
   * (that caused the tiny centered map). Tall layouts scroll vertically.
   */
  const getClassicPreferredZoom = useCallback(() => {
    const viewport = classicViewportRef.current;
    const content = classicContentRef.current;
    if (!viewport || !content) return null;
    const vw = viewport.clientWidth;
    if (vw < 40 || viewport.clientHeight < 40) return null;

    // Reference screenshot: ~20% white space on each side of the seat grid
    const padX = Math.max(72, Math.round(vw * 0.2));
    const baseW = Math.max(
      classicSeatTrackPx + classicRowLabelColPx + classicRowLabelGapPx,
      content.scrollWidth || content.offsetWidth,
      classicContentSize.w,
      1
    );
    const widthZoom = (vw - padX * 2) / baseW;

    // Keep seats near reference density (not postage-stamp, not edge-to-edge)
    return Math.min(1.0, Math.max(0.6, Math.round(widthZoom * 100) / 100));
  }, [
    classicContentSize.w,
    classicSeatTrackPx,
    classicRowLabelColPx,
    classicRowLabelGapPx,
  ]);

  /** Zoom-out floor for the − button (can go smaller than default open zoom). */
  const getClassicMinZoom = useCallback(() => {
    const fit = getClassicFitZoom();
    return Math.min(fit, 0.35);
  }, [getClassicFitZoom]);

  const updateClassicViewport = useCallback(() => {
    const el = classicViewportRef.current;
    if (!el) return;
    const { scrollLeft, scrollTop, scrollWidth, scrollHeight, clientWidth, clientHeight } = el;
    const canScroll = scrollWidth > clientWidth + 2 || scrollHeight > clientHeight + 2;
    setClassicViewport({
      left: scrollWidth > 0 ? scrollLeft / scrollWidth : 0,
      top: scrollHeight > 0 ? scrollTop / scrollHeight : 0,
      width: scrollWidth > 0 ? Math.min(Math.max(clientWidth / scrollWidth, 0.06), 1) : 1,
      height: scrollHeight > 0 ? Math.min(Math.max(clientHeight / scrollHeight, 0.06), 1) : 1,
      canScroll,
    });
  }, []);

  const syncStickyRowLabels = useCallback(() => {
    const viewport = classicViewportRef.current;
    if (!viewport || viewMode !== "classic") {
      setStickyRowLabels([]);
      return;
    }
    const shell = viewport.parentElement;
    if (!shell) {
      setStickyRowLabels([]);
      return;
    }
    const shellRect = shell.getBoundingClientRect();
    const nodes = viewport.querySelectorAll<HTMLElement>("[data-classic-row-label]");
    const next: Array<{ key: string; label: string; top: number }> = [];
    nodes.forEach((node, i) => {
      const label = node.dataset.classicRowLabel || "";
      if (!label) return;
      const r = node.getBoundingClientRect();
      if (r.bottom < shellRect.top - 8 || r.top > shellRect.bottom + 8) return;
      next.push({
        key: node.dataset.classicRowKey || `${label}-${i}`,
        label,
        top: r.top - shellRect.top + r.height / 2,
      });
    });
    setStickyRowLabels(next);
  }, [viewMode]);

  /** Horizontally center; always open at the top (screen / first rows). */
  const centerClassicScroll = useCallback(() => {
    const el = classicViewportRef.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
    el.scrollTop = 0;
    updateClassicViewport();
    requestAnimationFrame(() => syncStickyRowLabels());
  }, [updateClassicViewport, syncStickyRowLabels]);

  useEffect(() => {
    if (viewMode !== "classic") return;
    const content = classicContentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      setClassicContentSize({
        w: content.offsetWidth,
        h: content.offsetHeight,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(content);
    return () => ro.disconnect();
  }, [viewMode, gridRows, classicSeatTrackPx]);

  const fitClassicToView = useCallback(
    (showNav = true) => {
      const minZ = getClassicMinZoom();
      const next = Math.max(minZ, Math.round((classicZoomRef.current - 0.2) * 100) / 100);
      classicZoomRef.current = next;
      setClassicZoom(next);
      requestAnimationFrame(() => {
        updateClassicViewport();
        if (showNav) revealClassicMinimap();
      });
    },
    [getClassicMinZoom, revealClassicMinimap, updateClassicViewport]
  );

  useEffect(() => {
    classicZoomRef.current = classicZoom;
  }, [classicZoom]);

  useEffect(() => {
    if (viewMode !== "classic") return;
    if (!classicContentSize.w || !classicContentSize.h) return;
    const id = requestAnimationFrame(() => {
      updateClassicViewport();
      syncStickyRowLabels();
    });
    return () => cancelAnimationFrame(id);
  }, [classicContentSize, classicZoom, viewMode, updateClassicViewport, syncStickyRowLabels]);

  useEffect(() => {
    if (viewMode !== "classic") {
      setShowClassicMinimap(false);
      setStickyRowLabels([]);
      lastClassicFitKeyRef.current = "";
      return;
    }
    if (!classicContentSize.w || !classicContentSize.h) return;

    // Fit once per showtime & layout change — only commit after viewport is ready
    // so we never lock zoom=1 before the seat map has real dimensions.
    const fitKey = `${showtimeId}:${gridRows.length}:${classicSeatTrackPx}:${classicContentSize.w}x${classicContentSize.h}`;
    if (lastClassicFitKeyRef.current === fitKey) return;

    let attempts = 0;
    let raf = 0;
    let cancelled = false;

    const tryFit = () => {
      if (cancelled) return;
      attempts += 1;
      if (isTouchClassicRef.current) {
        lastClassicFitKeyRef.current = fitKey;
        centerClassicScroll();
        updateClassicViewport();
        syncStickyRowLabels();
        return;
      }
      const initialZoom = getClassicPreferredZoom();
      if (initialZoom == null) {
        if (attempts < 24) {
          raf = requestAnimationFrame(tryFit);
        }
        return;
      }
      lastClassicFitKeyRef.current = fitKey;
      classicZoomRef.current = initialZoom;
      setClassicZoom(initialZoom);
      requestAnimationFrame(() => {
        if (cancelled) return;
        centerClassicScroll();
        updateClassicViewport();
        syncStickyRowLabels();
      });
    };

    raf = requestAnimationFrame(tryFit);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [
    viewMode,
    showtimeId,
    gridRows,
    classicSeatTrackPx,
    classicContentSize.w,
    classicContentSize.h,
    getClassicPreferredZoom,
    centerClassicScroll,
    updateClassicViewport,
    syncStickyRowLabels,
  ]);

  useEffect(() => {
    if (viewMode !== "classic") return;
    const handleResize = () => {
      if (!isTouchClassicRef.current) {
        const nextZoom = getClassicPreferredZoom();
        if (nextZoom == null) return;
        classicZoomRef.current = nextZoom;
        setClassicZoom(nextZoom);
        requestAnimationFrame(() => {
          centerClassicScroll();
          updateClassicViewport();
        });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [viewMode, getClassicPreferredZoom, centerClassicScroll, updateClassicViewport]);

  useEffect(() => {
    return () => {
      if (classicMinimapHideTimer.current) clearTimeout(classicMinimapHideTimer.current);
    };
  }, []);

  const handleClassicScroll = useCallback(() => {
    updateClassicViewport();
    syncStickyRowLabels();
    revealClassicMinimap();
  }, [revealClassicMinimap, updateClassicViewport, syncStickyRowLabels]);

  // Desktop mouse drag-to-scroll; touch uses native free scroll
  const handleClassicPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "touch") return;
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-classic-seat]")) return;
      if (target?.closest("[data-classic-minimap]")) return;
      if (target?.closest("button, a, input, textarea, select, label")) return;
      const el = classicViewportRef.current;
      if (!el) return;
      classicDragRef.current = {
        active: true,
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        originX: el.scrollLeft,
        originY: el.scrollTop,
        pointerId: e.pointerId,
      };
      revealClassicMinimap();
    },
    [revealClassicMinimap]
  );

  const handleClassicPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = classicDragRef.current;
      const el = classicViewportRef.current;
      if (!drag?.active || !el) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved) {
        if (Math.hypot(dx, dy) < 6) return;
        drag.moved = true;
        (e.currentTarget as HTMLElement).setPointerCapture?.(drag.pointerId);
      }
      e.preventDefault();
      el.scrollLeft = drag.originX - dx;
      el.scrollTop = drag.originY - dy;
      updateClassicViewport();
      syncStickyRowLabels();
      revealClassicMinimap();
    },
    [revealClassicMinimap, updateClassicViewport, syncStickyRowLabels]
  );

  const handleClassicPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = classicDragRef.current;
    if (!drag?.active) return;
    if (drag.moved) {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    }
    classicDragRef.current = null;
  }, []);

  const jumpClassicFromMinimap = useCallback(
    (clientX: number, clientY: number, minimapEl: HTMLElement) => {
      const el = classicViewportRef.current;
      if (!el) return;
      const rect = minimapEl.getBoundingClientRect();
      const xRatio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      const yRatio = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1);
      el.scrollLeft = Math.max(
        0,
        Math.min(el.scrollWidth - el.clientWidth, xRatio * el.scrollWidth - el.clientWidth / 2)
      );
      el.scrollTop = Math.max(
        0,
        Math.min(el.scrollHeight - el.clientHeight, yRatio * el.scrollHeight - el.clientHeight / 2)
      );
      updateClassicViewport();
      syncStickyRowLabels();
      revealClassicMinimap();
    },
    [revealClassicMinimap, updateClassicViewport, syncStickyRowLabels]
  );

  const handleMinimapPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      classicMinimapDragRef.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      jumpClassicFromMinimap(e.clientX, e.clientY, e.currentTarget);
    },
    [jumpClassicFromMinimap]
  );

  const handleMinimapPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!classicMinimapDragRef.current) return;
      jumpClassicFromMinimap(e.clientX, e.clientY, e.currentTarget);
    },
    [jumpClassicFromMinimap]
  );

  const handleMinimapPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    classicMinimapDragRef.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }, []);

  const setClassicZoomLevel = useCallback(
    (
      nextZoom: number,
      focus?: { clientX: number; clientY: number } | null
    ) => {
      const el = classicViewportRef.current;
      const minZoom = getClassicMinZoom();
      const clamped = Math.min(2.4, Math.max(minZoom, Math.round(nextZoom * 100) / 100));
      revealClassicMinimap();
      const prevZoom = classicZoomRef.current;
      if (Math.abs(clamped - prevZoom) < 0.001) {
        return;
      }

      let anchorX = 0.5;
      let anchorY = 0.5;
      if (el) {
        const rect = el.getBoundingClientRect();
        const fx = focus ? focus.clientX - rect.left : el.clientWidth / 2;
        const fy = focus ? focus.clientY - rect.top : el.clientHeight / 2;
        anchorX = el.scrollWidth > 0 ? (el.scrollLeft + fx) / el.scrollWidth : 0.5;
        anchorY = el.scrollHeight > 0 ? (el.scrollTop + fy) / el.scrollHeight : 0.5;
      }

      classicZoomRef.current = clamped;
      setClassicZoom(clamped);
      requestAnimationFrame(() => {
        const scroller = classicViewportRef.current;
        if (scroller) {
          scroller.scrollLeft = Math.max(
            0,
            anchorX * scroller.scrollWidth -
            (focus
              ? focus.clientX - scroller.getBoundingClientRect().left
              : scroller.clientWidth / 2)
          );
          scroller.scrollTop = Math.max(
            0,
            anchorY * scroller.scrollHeight -
            (focus
              ? focus.clientY - scroller.getBoundingClientRect().top
              : scroller.clientHeight / 2)
          );
          updateClassicViewport();
        }
        revealClassicMinimap();
      });
    },
    [getClassicMinZoom, revealClassicMinimap, updateClassicViewport]
  );

  useEffect(() => {
    if (viewMode !== "classic") return;
    const el = classicViewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        isTouchClassicRef.current = true;
        const step = Math.min(0.35, Math.max(0.08, Math.abs(e.deltaY) * 0.0015));
        const next = classicZoomRef.current + (e.deltaY < 0 ? step : -step);
        setClassicZoomLevel(next, { clientX: e.clientX, clientY: e.clientY });
        return;
      }
      revealClassicMinimap();
    };

    const touchDist = (a: Touch, b: Touch) =>
      Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        classicPinchRef.current = {
          startDist: Math.max(1, touchDist(e.touches[0], e.touches[1])),
          startScale: classicZoomRef.current,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !classicPinchRef.current) return;
      e.preventDefault();
      isTouchClassicRef.current = true;
      const dist = Math.max(1, touchDist(e.touches[0], e.touches[1]));
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const next =
        classicPinchRef.current.startScale * (dist / classicPinchRef.current.startDist);
      setClassicZoomLevel(next, { clientX: midX, clientY: midY });
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) classicPinchRef.current = null;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [viewMode, setClassicZoomLevel, revealClassicMinimap]);

  const seatMapSection = (
    <section className="flex flex-col min-h-0 flex-1 space-y-2">
      {(theaterShowtimes.length > 0 || showtime?.starts_at) && (
        <div className="flex items-center gap-3 sm:gap-4 shrink-0 border-b border-slate-200 pb-3 mb-0.5 overflow-visible">
          {(() => {
            const dateSrc = showtime?.starts_at || theaterShowtimes[0]?.starts_at || "";
            const { weekday, dayMonth } = formatSeatPageDateParts(dateSrc);
            // Compact "14 Oct" style like District time bar
            const compactDayMonth = (() => {
              const parts = getVenueDateTimeParts(dateSrc);
              if (!parts) return dayMonth;
              const month = new Date(Date.UTC(parts.y, parts.m - 1, parts.d, 12)).toLocaleDateString(
                "en-US",
                { month: "short", timeZone: "UTC" }
              );
              return `${parts.d} ${month}`;
            })();
            return (
              <div className="shrink-0 leading-tight w-[4.25rem] sm:w-[4.75rem] overflow-hidden pr-1">
                <p className="text-[12px] font-medium text-slate-500">{weekday}</p>
                <p
                  className="text-[13px] sm:text-sm font-bold text-slate-900 tracking-tight truncate"
                  title={dayMonth}
                >
                  {compactDayMonth}
                </p>
              </div>
            );
          })()}
          <div
            ref={showtimeStripRef}
            className="flex items-center gap-2.5 sm:gap-3 overflow-x-auto overflow-y-visible scrollbar-none min-w-0 flex-1 py-1.5 pr-2 scroll-smooth"
          >
            {theaterShowtimes.map((st) => {
              const active = st.id === showtimeId;
              const ended = isMovieShowEnded({
                starts_at: st.starts_at,
                ends_at: st.ends_at,
                booking_state: st.booking_state,
                is_ended: st.is_ended,
              });
              const started =
                !ended &&
                (st.booking_state === "STARTED" ||
                  st.has_started ||
                  st.fill_status === "STARTED" ||
                  isShowtimeStarted(st.starts_at));
              const status = seatPageChipStatus(
                st.fill_status,
                started && !active
              );
              const lateNight = isLateNightShow(st.starts_at);
              const soldOut = status === "soldout" || ended;
              const disabled = soldOut;
              return (
                <span
                  key={st.id}
                  ref={active ? activeShowtimeChipRef : undefined}
                  className="relative inline-flex flex-col items-center shrink-0 overflow-visible pt-1.5"
                >
                  <span className="relative inline-block overflow-visible">
                    {lateNight ? (
                      <span
                        className="pointer-events-none absolute top-0 right-0 z-20 flex size-[16px] -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-[#5A5A5A] text-white shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
                        title="Late night"
                        aria-hidden
                      >
                        <FaMoon className="text-[8px] text-white" aria-hidden />
                      </span>
                    ) : null}
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (st.id === showtimeId || disabled) return;
                        router.push(`/movies/book/${st.id}?qty=${qty}`);
                      }}
                      aria-pressed={active}
                      aria-current={active ? "true" : undefined}
                      aria-label={`${formatSeatPageTime(st.starts_at)}${lateNight ? " — Late night" : ""
                        }${started ? " — Started" : ""}${active ? " — Selected" : ""}`}
                      title={[st.format, st.language, st.screen_name].filter(Boolean).join(" • ")}
                      className={`relative min-w-[5.5rem] rounded-md border px-3.5 py-2.5 text-center transition-colors ${disabled
                          ? "border-slate-200 bg-white cursor-not-allowed opacity-50"
                          : active
                            ? "border-slate-900 bg-[#F0F0F0] cursor-default"
                            : "border-slate-200 bg-white cursor-pointer hover:border-slate-400"
                        }`}
                    >
                      <span
                        className={`block text-[13px] font-semibold tabular-nums ${disabled
                            ? "text-slate-400"
                            : active
                              ? "text-slate-900"
                              : "text-slate-800"
                          }`}
                      >
                        {formatSeatPageTime(st.starts_at)}
                      </span>
                    </button>
                  </span>
                  {started && !disabled ? (
                    <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#F97122] leading-none">
                      STARTED
                    </span>
                  ) : (
                    <span className="mt-1 block h-[10px]" aria-hidden />
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Classic / seat-grid caption hidden: customers only see the one grid */}
      <div className="hidden" aria-hidden>
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("classic")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${viewMode === "classic" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
          >
            Classic
          </button>
          {/* customers only see the classic grid; the admin's own layout view is switched off */}
          {false && hasCanvasLayout && (
            <button
              type="button"
              onClick={() => setViewMode("canvas")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${viewMode === "canvas" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
            >
              Your layout
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500">
          {viewMode === "classic"
            ? "Original seat grid. Occupied seats stay disabled."
            : "The layout saved for this screen. Occupied seats stay disabled."}
        </p>
      </div>

      {viewMode === "canvas" && hasCanvasLayout && canvasLayoutData ? (
        <div className="relative rounded-xl border border-slate-100 bg-white overflow-hidden flex-1 min-h-0">
          <VenueLayoutViewer
            layoutData={canvasLayoutData}
            ticketTypes={[]}
            onSeatsSelected={handleCanvasSeatsSelected}
            initialSelectedSeats={selectedSeats.map((s) => ({
              id: s.seat_identifier,
              seat_identifier: s.seat_identifier,
              tier_name: s.tier_name,
              unit_price: s.unit_price,
            }))}
            maxSelectable={qty}
            cinemaMode={true}
            customLegend={cinemaLegend}
          />
        </div>
      ) : viewMode === "classic" ? (
        <>
          <div className="relative bg-white overflow-hidden flex-1 min-h-0 flex flex-col">
            <div className="relative flex-1 min-h-0">
              <div
                ref={classicViewportRef}
                onScroll={handleClassicScroll}
                onPointerDown={handleClassicPointerDown}
                onPointerMove={handleClassicPointerMove}
                onPointerUp={handleClassicPointerUp}
                onPointerCancel={handleClassicPointerUp}
                className="absolute inset-0 overflow-auto overscroll-contain bg-white select-none [-webkit-overflow-scrolling:touch] touch-pan-x touch-pan-y scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {/* Shell: top-aligned so the screen starts in view; horizontally centered */}
                <div className="min-h-full min-w-full w-max flex items-start justify-center">
                  <div
                    style={{
                      width: Math.max((classicContentSize.w || classicSeatTrackPx + 40) * classicZoom, 1),
                      height: Math.max((classicContentSize.h || 400) * classicZoom, 1),
                      position: "relative",
                    }}
                  >
                    <div
                      ref={classicContentRef}
                      className="absolute top-0 left-0 px-2 sm:px-4 pt-4 sm:pt-5 w-max space-y-5 sm:space-y-5 lg:space-y-6 pb-16 sm:pb-12 lg:pb-8"
                      style={{
                        transform: `scale(${classicZoom})`,
                        transformOrigin: "0 0",
                      }}
                    >
                      {screenPosition === "top" && (
                        <div className="pb-4 pt-0.5 space-y-1.5" style={{ width: classicRowOuterPx }}>
                          <p
                            className="text-center text-[11px] tracking-wide text-slate-500"
                            style={{
                              paddingLeft: classicRowLabelColPx + classicRowLabelGapPx,
                            }}
                          >
                            All eyes this way please
                          </p>
                          <div className="flex items-center">
                            <span
                              className="shrink-0"
                              style={{
                                width: classicRowLabelColPx,
                                marginRight: classicRowLabelGapPx,
                              }}
                              aria-hidden
                            />
                            <div
                              className="flex justify-center"
                              style={{ width: classicSeatTrackPx }}
                            >
                              {/* Above seats — reference shape as-is (wide rim toward top) */}
                              <CinemaScreenArc className="h-10 sm:h-12 w-[85%] sm:w-[88%]" />
                            </div>
                          </div>
                        </div>
                      )}

                      {gridRows.map((rowGroup, idx) => {
                        const prevRow = gridRows[idx - 1];
                        const isNewTier = !prevRow || prevRow.tierName !== rowGroup.tierName;

                        return (
                          <div
                            key={`classic-row-${idx}-${rowGroup.tierName}-${rowGroup.rowLabel}`}
                            className="space-y-3 sm:space-y-2.5"
                            style={!isNewTier && rowGroup.gapBeforePx ? { marginTop: rowGroup.gapBeforePx + 24 } : undefined}
                          >
                            {isNewTier && (
                              <div
                                className="flex items-center pt-5 sm:pt-4 pb-2 sm:pb-1.5"
                                style={{ width: classicRowOuterPx }}
                              >
                                <span
                                  className="shrink-0"
                                  style={{ width: classicRowLabelColPx, marginRight: classicRowLabelGapPx }}
                                  aria-hidden
                                />
                                <div
                                  className="flex items-center gap-3.5"
                                  style={{ width: classicSeatTrackPx }}
                                >
                                  <div className="h-px flex-1 bg-slate-200" />
                                  <span className="shrink-0 text-xs sm:text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500 select-none">
                                    {formatMoney(rowGroup.price, { compact: true })}{" "}
                                    {rowGroup.tierName.toUpperCase().replace(/\s*ROWS?\s*$/i, "")}{" "}
                                    ROWS
                                  </span>
                                  <div className="h-px flex-1 bg-slate-200" />
                                </div>
                              </div>
                            )}

                            {/* Row letter from admin layout (sticky overlay mirrors these labels) */}
                            <div className="flex items-center" style={{ width: classicRowOuterPx }}>
                              <span
                                data-classic-row-label={rowGroup.rowLabel}
                                data-classic-row-key={`classic-${idx}-${rowGroup.tierName}-${rowGroup.rowLabel}`}
                                className="shrink-0 text-center text-sm font-semibold text-transparent leading-none select-none"
                                style={{ width: classicRowLabelColPx, marginRight: classicRowLabelGapPx }}
                                aria-hidden
                              >
                                {rowGroup.rowLabel}
                              </span>
                              <div
                                className="flex items-center justify-center"
                                style={{ width: classicSeatTrackPx }}
                              >
                                <div
                                  className={rowGroup.seats.every((s) => s.leftPx !== undefined) ? "relative" : "flex items-center gap-2.5 sm:gap-3"}
                                  style={
                                    rowGroup.seats.every((s) => s.leftPx !== undefined)
                                      ? { width: classicSeatTrackPx, height: GEO_SEAT_PX }
                                      : undefined
                                  }
                                >
                                  {rowGroup.seats.map((seat, seatIdx) => {
                                    const geometric = seat.leftPx !== undefined && rowGroup.seats.every((s) => s.leftPx !== undefined);
                                    const isSelected = isSeatSelected(
                                      seat.id,
                                      rowGroup.rowLabel,
                                      seat.number
                                    );
                                    const isAisleGap =
                                      seat.isAisleGap ?? (seatIdx === 3 || seatIdx === 9);
                                    // Prefer admin seat_label / number; fall back to index
                                    const rawSeatNo = String(seat.number ?? seatIdx + 1).trim();
                                    const seatLabel = /^\d+$/.test(rawSeatNo)
                                      ? rawSeatNo.padStart(2, "0")
                                      : rawSeatNo || String(seatIdx + 1).padStart(2, "0");

                                    return (
                                      <div
                                        key={`classic-${idx}-${rowGroup.tierName}-${seat.id}-${seatIdx}`}
                                        className="flex items-center"
                                        style={geometric ? { position: "absolute", left: seat.leftPx, top: 0 } : undefined}
                                      >
                                        <button
                                          type="button"
                                          data-classic-seat
                                          disabled={seat.isBooked}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSeatClick(seat);
                                          }}
                                          onPointerDown={(e) => e.stopPropagation()}
                                          className={`size-9 sm:size-10 rounded-lg text-xs sm:text-[13px] font-semibold transition-[border-color,transform,background-color] duration-150 flex items-center justify-center select-none relative z-10 ${seat.isBooked
                                            ? SEAT_BOOKED
                                            : isSelected
                                              ? SEAT_SELECTED
                                              : availableSeatClass(seat.isBestseller)
                                            }`}
                                          title={`${rowGroup.tierName} • ${seat.id} (${seat.price} ETB)${seat.isBestseller && !seat.isBooked ? " • Bestseller" : ""
                                            }`}
                                        >
                                          {seat.isBooked ? (
                                            <span className="text-sm leading-none font-medium text-[#C4C4C4]" aria-hidden>
                                              ×
                                            </span>
                                          ) : seat.isAccessible ? (
                                            <Accessibility className="size-4" aria-hidden />
                                          ) : (
                                            seatLabel
                                          )}
                                        </button>
                                        {isAisleGap && !geometric && (
                                          <div className="w-6 sm:w-8" aria-hidden="true" />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {screenPosition === "bottom" && (
                        <div className="pt-6 pb-4 space-y-1.5" style={{ width: classicRowOuterPx }}>
                          <div className="flex items-center">
                            <span
                              className="shrink-0"
                              style={{
                                width: classicRowLabelColPx,
                                marginRight: classicRowLabelGapPx,
                              }}
                              aria-hidden
                            />
                            <div
                              className="flex justify-center"
                              style={{ width: classicSeatTrackPx }}
                            >
                              {/* Below seats — flip so wide curved edge faces seats above */}
                              <CinemaScreenArc flip className="h-10 sm:h-12 w-[85%] sm:w-[88%]" />
                            </div>
                          </div>
                          <p
                            className="text-center text-[11px] tracking-wide text-slate-500"
                            style={{
                              paddingLeft: classicRowLabelColPx + classicRowLabelGapPx,
                            }}
                          >
                            All eyes this way please
                          </p>
                        </div>
                      )}
                      {/* Extra scroll room so last row clears zoom controls on mobile */}
                      <div className="h-8 sm:h-4 lg:h-1" aria-hidden="true" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sticky alphabet bar — outside scroller so it stays put; translucent fade */}
              <div
                data-classic-sticky-labels
                className="pointer-events-none absolute inset-y-0 left-0 z-20 w-11 sm:w-12 bg-gradient-to-r from-white via-white/90 to-transparent"
                aria-hidden
              >
                {stickyRowLabels.map((item) => (
                  <span
                    key={item.key}
                    className="absolute left-1.5 sm:left-2 -translate-y-1/2 text-sm sm:text-base font-bold text-slate-600 leading-none"
                    style={{ top: item.top }}
                  >
                    {item.label}
                  </span>
                ))}
              </div>
            </div>

            <div
              className="pointer-events-none absolute inset-y-0 right-0 z-20 w-11 sm:w-12 bg-gradient-to-l from-white via-white/90 to-transparent"
              aria-hidden
            >
              {stickyRowLabels.map((item) => (
                <span
                  key={`r-${item.key}`}
                  className="absolute right-1.5 sm:right-2 -translate-y-1/2 text-sm sm:text-base font-bold text-slate-600 leading-none"
                  style={{ top: item.top }}
                >
                  {item.label}
                </span>
              ))}
            </div>

            {/* Top-right navigator: shows on scroll & zoom on tablet/desktop, hidden on mobile so it never disturbs seat selection */}
            <div
              className={`hidden sm:block absolute top-2 right-0 sm:right-1 z-30 transition-opacity duration-200 ${showClassicMinimap ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              aria-hidden={!showClassicMinimap}
            >
              <div
                data-classic-minimap
                onPointerDown={handleMinimapPointerDown}
                onPointerMove={handleMinimapPointerMove}
                onPointerUp={handleMinimapPointerUp}
                onPointerCancel={handleMinimapPointerUp}
                className="pointer-events-auto relative w-[140px] h-[280px] sm:w-[160px] sm:h-[320px] lg:w-[180px] lg:h-[360px] rounded-lg bg-white border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.10)] overflow-hidden cursor-crosshair touch-none"
                title="Current visible section"
              >
                <div className="absolute inset-[8px] flex flex-col">
                  {screenPosition === "top" && (
                    <div className="mb-1.5 flex flex-col items-center shrink-0 w-full px-2">
                      <CinemaScreenArc className="h-3.5 w-[85%] sm:w-[88%]" />
                    </div>
                  )}
                  <div className="flex-1 min-h-0 flex flex-col justify-between relative">
                    {gridRows.map((rowGroup, idx) => {
                      const prevRow = gridRows[idx - 1];
                      const isNewTier = !prevRow || prevRow.tierName !== rowGroup.tierName;
                      return (
                        <div
                          key={`mini-${idx}-${rowGroup.rowLabel}`}
                          className="w-full flex flex-col items-center"
                        >
                          {isNewTier && idx > 0 && (
                            <div className="w-[80%] h-px bg-slate-200 mb-[1px]" />
                          )}
                          <div className="flex items-center justify-center gap-px">
                            {rowGroup.seats.map((seat, seatIdx) => {
                              const isSelected = isSeatSelected(
                                seat.id,
                                rowGroup.rowLabel,
                                seat.number
                              );
                              const isAisleGap =
                                seat.isAisleGap ?? (seatIdx === 3 || seatIdx === 9);
                              return (
                                <div
                                  key={`mini-seat-${idx}-${seatIdx}`}
                                  className="flex items-center"
                                >
                                  <span
                                    className={`relative flex items-center justify-center size-[4px] sm:size-[4.5px] lg:size-[5px] rounded-[1px] box-border ${seat.isBooked
                                      ? "bg-white border border-[#E0E0E0]"
                                      : isSelected
                                        ? SEAT_SELECTED_MINI
                                        : seat.isBestseller
                                          ? "border border-[#5BA3D9] bg-[#C5E4F7]"
                                          : "bg-white border border-[#4B5563]"
                                      }`}
                                  >
                                    {seat.isBooked && (
                                      <span
                                        className="absolute inset-0 flex items-center justify-center text-[5px] sm:text-[6px] leading-none font-medium text-[#C4C4C4]"
                                        aria-hidden
                                      >
                                        ×
                                      </span>
                                    )}
                                  </span>
                                  {isAisleGap && <span className="w-[2px] sm:w-[3px]" />}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {screenPosition === "bottom" && (
                    <div className="mt-1.5 flex flex-col items-center shrink-0 w-full">
                      <CinemaScreenArc flip className="h-3.5 w-[85%] sm:w-[88%]" />
                    </div>
                  )}

                  <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                    <div
                      className="absolute border-[1.5px] border-[#ff3b30] bg-[#ff3b30]/12"
                      style={{
                        top: `${classicViewport.top * 100}%`,
                        left: `${classicViewport.left * 100}%`,
                        width: `${classicViewport.width * 100}%`,
                        height: `${classicViewport.height * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Legend hides when Proceed bar is visible (seat selected) */}
            {selectedSeats.length === 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 lg:gap-7 border-t border-slate-100 bg-white py-1 px-3 sm:py-1.5 lg:py-2.5 lg:px-4 text-[11px] lg:text-xs text-slate-800 shrink-0">
                {hasBestsellerSeats ? (
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <div className={`size-3 lg:size-3.5 rounded-md ${SEAT_BESTSELLER_SWATCH}`} />
                    <span className="inline-flex items-center gap-0.5 lg:gap-1">
                      Best Seats
                      <span
                        className="inline-flex text-slate-400"
                        title="Popular seats in this cinema — same price, no extra cost"
                      >
                        <Info className="size-2.5 lg:size-3" aria-hidden />
                      </span>
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2">
                  <div className="size-3 lg:size-3.5 rounded-md bg-white border border-[#4B5563]" />
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2">
                  <div className="relative size-3 lg:size-3.5 rounded-md bg-white border border-[#E0E0E0] flex items-center justify-center">
                    <span className="text-[9px] lg:text-[10px] leading-none text-[#C4C4C4]" aria-hidden>
                      ×
                    </span>
                  </div>
                  <span>Occupied</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2">
                  <div className={`size-3 lg:size-3.5 rounded-md ${SEAT_SELECTED_SWATCH}`} />
                  <span>Selected</span>
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          {selectedSeats.length === 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 lg:gap-5 py-1 px-3 sm:py-1.5 lg:py-2 lg:px-4 text-[11px] lg:text-xs text-slate-800 shrink-0">
              {hasBestsellerSeats ? (
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <div className={`size-3 lg:size-4 rounded-md ${SEAT_BESTSELLER_SWATCH}`} />
                  <span className="inline-flex items-center gap-0.5 lg:gap-1">
                    Best Seats
                    <span
                      className="inline-flex text-slate-400"
                      title="Popular seats in this cinema — same price, no extra cost"
                    >
                      <Info className="size-2.5 lg:size-3.5" aria-hidden />
                    </span>
                  </span>
                </div>
              ) : null}
              <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2">
                <div className="size-3 lg:size-4 rounded-md bg-white border border-[#4B5563]" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2">
                <div className="relative size-3 lg:size-4 rounded-md bg-white border border-[#E0E0E0] flex items-center justify-center">
                  <span className="text-[9px] lg:text-[11px] leading-none text-[#C4C4C4]" aria-hidden>
                    ×
                  </span>
                </div>
                <span>Occupied</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2">
                <div className={`size-3 lg:size-4 rounded-md ${SEAT_SELECTED_SWATCH}`} />
                <span className="font-medium">Selected</span>
              </div>
            </div>
          ) : null}

          <div className="bg-white p-4 sm:p-6 overflow-x-auto space-y-6 flex-1 min-h-0 overflow-auto scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {screenPosition === "top" && (
              <div className="pb-8 pt-2 text-center space-y-3">
                <p className="text-xs uppercase tracking-widest font-extrabold text-slate-500 flex items-center justify-center gap-2">
                  <Tv className="size-3.5 text-[#F84464]" /> All eyes this way please • Screen
                </p>
                <div className="relative mx-auto w-4/5 max-w-lg h-3">
                  <div className="absolute inset-0 rounded-[50%] border-b-4 border-[#F84464] shadow-[0_8px_20px_rgba(248,68,100,0.25)]" />
                </div>
              </div>
            )}

            {gridRows.map((rowGroup, idx) => {
              const prevRow = gridRows[idx - 1];
              const isNewTier = !prevRow || prevRow.tierName !== rowGroup.tierName;

              return (
                <div
                  key={`row-${idx}-${rowGroup.tierName}-${rowGroup.rowLabel}`}
                  className="space-y-2.5 min-w-[560px]"
                >
                  {isNewTier && (
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2 pt-3 text-xs">
                      <span className="font-extrabold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#F84464] via-[#A855F7] to-[#6900AA]">
                        {rowGroup.tierName} TIER
                      </span>
                      <span className="text-slate-900 font-extrabold bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                        {formatMoney(rowGroup.price, { compact: true })}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center w-full relative">
                    <span className="sticky left-0 z-10 w-8 shrink-0 text-center text-xs font-bold text-slate-500 leading-none py-1 mr-10 bg-gradient-to-r from-white via-white/95 to-transparent">
                      {rowGroup.rowLabel}
                    </span>
                    <div className="flex-1 flex items-center justify-center min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        {rowGroup.seats.map((seat, seatIdx) => {
                          const isSelected = isSeatSelected(
                            seat.id,
                            rowGroup.rowLabel,
                            seat.number
                          );
                          const isAisleGap = seat.isAisleGap ?? (seatIdx === 3 || seatIdx === 9);
                          const seatLabel = String(seatIdx + 1).padStart(2, "0");

                          return (
                            <div
                              key={`${idx}-${rowGroup.tierName}-${seat.id}-${seatIdx}`}
                              className="flex items-center"
                            >
                              <button
                                type="button"
                                disabled={seat.isBooked}
                                onClick={() => handleSeatClick(seat)}
                                className={`size-7 sm:size-8 rounded-md text-[11px] font-bold transition-all duration-150 flex items-center justify-center select-none ${seat.isBooked
                                  ? SEAT_BOOKED
                                  : isSelected
                                    ? `${SEAT_SELECTED} z-10`
                                    : availableSeatClass(seat.isBestseller, true)
                                  }`}
                                title={`${rowGroup.tierName} • ${seat.id} (${seat.price} ETB)${seat.isBestseller && !seat.isBooked ? " • Bestseller" : ""
                                  }`}
                              >
                                {seat.isBooked ? (
                                  <span className="text-[13px] leading-none font-medium text-[#C4C4C4]" aria-hidden>
                                    ×
                                  </span>
                                ) : (
                                  seatLabel
                                )}
                              </button>
                              {isAisleGap && <div className="w-3 sm:w-5" aria-hidden="true" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {screenPosition === "bottom" && (
              <div className="pt-10 pb-2 text-center space-y-3">
                <div className="relative mx-auto w-4/5 max-w-lg h-3">
                  <div className="absolute inset-0 rounded-[50%] border-t-4 border-[#F84464] shadow-[0_-8px_20px_rgba(248,68,100,0.25)]" />
                </div>
                <p className="text-xs uppercase tracking-widest font-extrabold text-slate-500 flex items-center justify-center gap-2">
                  <Tv className="size-3.5 text-[#F84464]" /> All eyes this way please • Screen
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );

  if (isLoading) {
    return <CustomerFullscreenShimmer label="Loading seat layout" />;
  }

  if (isError || !layoutData) {
    const ended = /show has ended/i.test(layoutErrorMessage);
    return (
      <div className="min-h-screen bg-[#F5F5F7] text-slate-900 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertCircle className="size-12 text-rose-500" />
        <h2 className="text-xl font-bold text-slate-900">
          {ended ? "This show has ended" : "Showtime Layout Unavailable"}
        </h2>
        <p className="text-sm text-slate-500 max-w-md">{layoutErrorMessage}</p>
        <Link
          href="/movies"
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F84464] to-[#6900AA] text-white text-sm font-bold shadow"
        >
          Back to Movies
        </Link>
      </div>
    );
  }

  const logoSrc = typeof images.logo === "string" ? images.logo : images.logo.src;

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-hidden text-slate-900 ${step === "seats" ? "bg-white" : "bg-[#F5F5F7]"
        }`}
    >
      {seatConflict ? (
        <SeatsUnavailablePage
          title={movie?.title || "Movie"}
          subtitle={headerMeta}
          onBack={() => {
            setSeatConflict(false);
            // frees any hold, clears the seats and shows the same seat layout again
            void resetToSeatsAfterTimeout();
          }}
        />
      ) : null}
      <header className="shrink-0 z-30 border-b border-slate-200 bg-white">
        <div className="bmb-section-container relative flex items-center justify-between gap-2 sm:gap-3 min-h-[3.25rem] lg:min-h-[3.75rem] py-2.5">
          {/* Left — back (all breakpoints) + logo (desktop) */}
          <div className="relative z-10 flex shrink-0 items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (step === "review") {
                  requestLeaveConfirmStep("back");
                  return;
                }
                if (step === "beverages") {
                  setStep("seats");
                  return;
                }
                router.push(showtimesBackHref);
              }}
              className="shrink-0 flex size-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer -ml-1"
              title={
                step === "review"
                  ? "Back to seats"
                  : step === "beverages"
                    ? "Back to seats"
                    : "Back to showtimes"
              }
              aria-label="Back"
            >
              <ChevronLeft className="size-5" />
            </button>
            <Link
              href="/"
              className="hidden lg:flex shrink-0 items-center"
              title="Book My Bota"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc}
                alt="Book My Bota"
                className="h-12 lg:h-14 w-auto object-contain"
              />
            </Link>
          </div>

          {/* Desktop center — movie title + theater / date / time / screen */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-[1] hidden w-[min(52%,42rem)] xl:w-[min(50%,46rem)] -translate-x-1/2 -translate-y-1/2 text-center lg:block">
            {step === "review" ? (
              <h1 className="truncate text-sm font-bold leading-tight text-slate-900 sm:text-[15px] md:text-base">
                Review your booking
              </h1>
            ) : step === "beverages" ? (
              <h1 className="truncate text-sm font-bold leading-tight text-slate-900 sm:text-[15px] md:text-base">
                Add snacks &amp; drinks
              </h1>
            ) : (
              <>
                <h1 className="truncate text-sm font-bold leading-tight text-slate-900 sm:text-[15px] md:text-base">{headerTitle}</h1>
                <p className="mt-0.5 truncate text-[11px] text-slate-500 sm:text-xs">
                  {headerMeta}
                  {screen?.name ? ` | ${screen.name}` : ""}
                </p>
              </>
            )}
          </div>

          {/* Mobile / tablet title */}
          <div className="min-w-0 flex-1 text-center lg:hidden">
            <p className="truncate text-xs font-bold leading-tight text-slate-900 sm:text-sm">
              {step === "review" ? "Review your booking" : step === "beverages" ? "Add snacks & drinks" : headerTitle}
            </p>
            {step === "seats" ? <p className="truncate text-[10px] text-slate-500 sm:text-[11px]">{headerMeta}</p> : null}
          </div>

          {/* Right: accessibility, tickets and account */}
          <div className="relative z-10 flex shrink-0 items-center gap-1.5 sm:gap-2">
            {step === "seats" ? (
              <>
                {accessibilityCategories.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setAccessModalOpen(true)}
                    className="flex size-9 cursor-pointer items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
                    title="Accessible seating"
                    aria-label="Accessible seating"
                  >
                    <FaUniversalAccess className="size-5" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={openQtyEditor}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#6900AA]/40 bg-white px-3 py-1.5 text-xs font-bold text-[#6900AA] hover:bg-purple-50"
                  title="Change number of tickets"
                >
                  <Pencil className="size-3.5" /> {qty} Ticket{qty === 1 ? "" : "s"}
                </button>
              </>
            ) : null}
            {isCustomerLoggedIn ? (
              <Link
                href="/customer/profile"
                className="flex size-9 items-center justify-center rounded-full bg-[#6900AA] text-sm font-bold text-white"
                title="My account"
                aria-label="My account"
              >
                {String(authUser?.name || authUser?.email || "U").trim().charAt(0).toUpperCase()}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
                title="Sign in"
                aria-label="Sign in"
              >
                <User className="size-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {showHasStarted ? (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-900 sm:text-sm">
          This show has already started, so seats can no longer be booked online.
        </div>
      ) : null}

      {secondsLeft !== null && secondsLeft > 0 && (
        <div className="shrink-0 flex items-center justify-center gap-3 border-b border-purple-100 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-900 sm:text-sm">
          <Timer className="size-4 shrink-0" />
          <span>
            {step === "seats"
              ? `Your seats are held! Complete your booking in ${formatCountdown(secondsLeft)}`
              : `Complete your booking in ${formatCountdown(secondsLeft)}`}
          </span>
          {step === "seats" && selectedSeats.length > 0 && (
            <button
              type="button"
              onClick={handleContinue}
              className="px-3 py-1 text-xs font-bold rounded-md bg-[#6B21A8] text-white hover:bg-[#581c87] cursor-pointer transition-colors shadow-sm"
            >
              Continue to checkout →
            </button>
          )}
        </div>
      )}

      <main
        className={`flex-1 min-h-0 ${step === "seats" ? "overflow-hidden flex flex-col" : "overflow-y-auto"
          }`}
      >
        {step === "seats" ? (
          <div className="mx-auto w-full max-w-[1600px] px-2 sm:px-3 lg:px-4 xl:px-5 flex-1 min-h-0 py-3 sm:py-4 lg:py-2 pb-3 flex flex-col overflow-hidden">
            {seatMapSection}
          </div>
        ) : step === "beverages" ? (
          <div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/55 backdrop-blur-sm sm:items-center sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Add snacks and beverages"
          >
            <div className="flex h-[94dvh] w-full max-w-[88rem] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:h-[92vh] sm:w-[96vw] sm:rounded-3xl">
              {/* Header */}
              <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-300 sm:hidden" aria-hidden />
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 pb-3 pt-3 sm:px-6 sm:pt-4">
                <h2 className="min-w-0 truncate text-lg font-bold leading-tight text-slate-900 sm:text-xl">Order food and drink</h2>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBeverages({});
                    setStep("review");
                  }}
                  className="shrink-0 cursor-pointer rounded-full bg-slate-100 px-4 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 sm:px-5 sm:py-2"
                >
                  Skip
                </button>
              </div>

              {/* Search */}
              <div className="px-4 pb-2.5 pt-3 sm:px-6">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-[#6900AA]">
                  <Search className="size-4 shrink-0 text-[#6900AA]" />
                  <input
                    value={bevSearch}
                    onChange={(e) => setBevSearch(e.target.value)}
                    placeholder="Search popcorn, drinks, combos"
                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                  />
                </label>
              </div>

              {/* Categories */}
              {(() => {
                const cats: string[] = ["ALL", ...Array.from(new Set<string>(showtimeBeverages.map((b) => b.category?.toUpperCase() || "OTHER")))];
                // Category tabs: a small picture above each name, then an underline for the active one
                const catPic: Record<string, string> = { ALL: "cat-all", POPCORN: "cat-popcorn", SNACKS: "cat-snacks", BEVERAGE: "cat-beverage", COMBO: "cat-combo" };
                const pic = (cat: string) =>
                  catPic[cat] ? `/images/beverages/${catPic[cat]}.webp` : showtimeBeverages.find((b) => (b.category?.toUpperCase() || "OTHER") === cat && b.image_url)?.image_url;
                return (
                  <div className="flex items-start gap-4 overflow-x-auto border-b border-slate-200 bg-white px-4 pt-2 sm:gap-7 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {cats.map((cat) => {
                      const on = bevCategoryFilter === cat;
                      const img = pic(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setBevCategoryFilter(cat)}
                          className="flex min-w-[3.25rem] shrink-0 cursor-pointer flex-col items-center gap-1 sm:min-w-[4rem]"
                        >
                          <span className="flex size-10 items-center justify-center overflow-hidden rounded-xl bg-slate-50 sm:size-12">
                            {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <UtensilsCrossed className="size-4 text-slate-300" />}
                          </span>
                          <span className={`whitespace-nowrap text-xs sm:text-sm ${on ? "font-bold text-[#6900AA]" : "font-medium text-slate-500"}`}>
                            {cat === "ALL" ? "All" : cat.charAt(0) + cat.slice(1).toLowerCase()}
                          </span>
                          <span className={`mt-0.5 h-0.5 w-full rounded-full ${on ? "bg-[#6900AA]" : "bg-transparent"}`} />
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Items and live bill */}
              <div className="flex min-h-0 flex-1">
                <div className="min-h-0 flex-1 overflow-y-auto bg-white px-4 pb-6 pt-1 sm:px-6">
                  {showtimeBeverages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
                      <UtensilsCrossed className="mb-2 size-10 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-700">No snacks available for this cinema</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
                      {showtimeBeverages
                        .filter((b) => (bevCategoryFilter === "ALL" || (b.category?.toUpperCase() || "OTHER") === bevCategoryFilter) && (!bevSearch.trim() || `${b.name} ${b.category || ""}`.toLowerCase().includes(bevSearch.trim().toLowerCase())))
                        .map((bev) => {
                          const sel = selectedBeverages[bev.id];
                          const qty = sel?.quantity || 0;
                          const add = () =>
                            setSelectedBeverages((prev) => ({
                              ...prev,
                              [bev.id]: { id: bev.id, name: bev.name, price: Number(bev.price), quantity: 1, image_url: bev.image_url, category: bev.category },
                            }));
                          return (
                            // Row layout: picture on the left, name + price in the middle, Add button on the right
                            <div key={bev.id} className={`flex items-center gap-3 border-b border-slate-200/80 py-3 sm:gap-4 sm:py-4 ${!bev.is_available ? "pointer-events-none opacity-55" : ""}`}>
                              <div className="flex size-[4.75rem] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 sm:size-24">
                                {bev.image_url ? <img src={bev.image_url} alt={bev.name} loading="lazy" className="h-full w-full object-cover" /> : <UtensilsCrossed className="size-7 text-slate-300" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-2 text-[0.9375rem] font-semibold leading-snug text-slate-900 sm:text-base">{bev.name}</p>
                                <p className="mt-1 text-sm font-bold text-slate-900 sm:text-[0.9375rem]">{formatMoney(Number(bev.price))}</p>
                                {!bev.is_available ? <p className="mt-0.5 text-xs font-bold text-rose-600">Sold out</p> : null}
                              </div>
                              <div className="w-[5.25rem] shrink-0 sm:w-24">
                                {qty === 0 ? (
                                  <button type="button" onClick={add} className="w-full cursor-pointer rounded-lg border border-[#6900AA] bg-white py-1.5 text-sm font-bold text-[#6900AA] transition-colors hover:bg-purple-50 active:scale-95 sm:py-2">
                                    Add
                                  </button>
                                ) : (
                                  <div className="flex items-center justify-between rounded-lg border border-[#6900AA] bg-white text-[#6900AA]">
                                    <button
                                      type="button"
                                      aria-label={`Remove one ${bev.name}`}
                                      onClick={() =>
                                        setSelectedBeverages((prev) => {
                                          const next = { ...prev };
                                          if (next[bev.id].quantity <= 1) delete next[bev.id];
                                          else next[bev.id] = { ...next[bev.id], quantity: next[bev.id].quantity - 1 };
                                          return next;
                                        })
                                      }
                                      className="flex size-8 cursor-pointer items-center justify-center rounded-md active:scale-95 sm:size-9"
                                    >
                                      <Minus className="size-4" />
                                    </button>
                                    <span className="text-sm font-extrabold text-slate-900">{qty}</span>
                                    <button
                                      type="button"
                                      aria-label={`Add one more ${bev.name}`}
                                      onClick={() => setSelectedBeverages((prev) => ({ ...prev, [bev.id]: { ...prev[bev.id], quantity: prev[bev.id].quantity + 1 } }))}
                                      className="flex size-8 cursor-pointer items-center justify-center rounded-md active:scale-95 sm:size-9"
                                    >
                                      <Plus className="size-4" />
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

                <aside className="hidden w-96 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white p-5 lg:flex" aria-label="Your bill">
                  <h3 className="mb-4 flex items-center gap-2 text-xl font-extrabold text-slate-900">
                    <ShoppingBag className="size-4 text-[#6900AA]" /> Your bill
                  </h3>
                  <div className="space-y-4 text-base">
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Snacks &amp; drinks</p>
                      {Object.values(selectedBeverages).length === 0 ? (
                        <p className="mt-1.5 text-xs text-slate-500">Nothing added yet. Tap Add on any item.</p>
                      ) : (
                        <ul className="mt-2 space-y-2">
                          {Object.values(selectedBeverages).map((b) => (
                            <li key={b.id} className="flex items-start gap-2">
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-base font-semibold text-slate-800">{b.name}</span>
                                <span className="text-sm text-slate-500">{b.quantity} × {formatMoney(b.price)}</span>
                              </span>
                              <span className="shrink-0 text-base font-bold text-slate-900">{formatMoney(b.price * b.quantity)}</span>
                              <button
                                type="button"
                                aria-label={`Remove ${b.name}`}
                                onClick={() =>
                                  setSelectedBeverages((prev) => {
                                    const next = { ...prev };
                                    delete next[b.id];
                                    return next;
                                  })
                                }
                                className="shrink-0 cursor-pointer rounded-full p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              >
                                <X className="size-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {false && beverageSubtotal > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Snacks subtotal</span>
                        <span className="font-semibold text-slate-900">{formatMoney(beverageSubtotal)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xl font-extrabold text-slate-900 sm:text-2xl">
                      <span>Total</span>
                      <span>{formatMoney(beverageSubtotal)}</span>
                    </div>
                  </div>
                </aside>
              </div>

              {/* Order bar */}
              {billOpen ? (
                <div className="max-h-[40vh] overflow-y-auto border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
                  <div className="space-y-4 text-base">
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Snacks &amp; drinks</p>
                      {Object.values(selectedBeverages).length === 0 ? (
                        <p className="mt-1.5 text-xs text-slate-500">Nothing added yet. Tap Add on any item.</p>
                      ) : (
                        <ul className="mt-2 space-y-2">
                          {Object.values(selectedBeverages).map((b) => (
                            <li key={b.id} className="flex items-start gap-2">
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-base font-semibold text-slate-800">{b.name}</span>
                                <span className="text-sm text-slate-500">{b.quantity} × {formatMoney(b.price)}</span>
                              </span>
                              <span className="shrink-0 text-base font-bold text-slate-900">{formatMoney(b.price * b.quantity)}</span>
                              <button
                                type="button"
                                aria-label={`Remove ${b.name}`}
                                onClick={() =>
                                  setSelectedBeverages((prev) => {
                                    const next = { ...prev };
                                    delete next[b.id];
                                    return next;
                                  })
                                }
                                className="shrink-0 cursor-pointer rounded-full p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              >
                                <X className="size-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {false && beverageSubtotal > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Snacks subtotal</span>
                        <span className="font-semibold text-slate-900">{formatMoney(beverageSubtotal)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xl font-extrabold text-slate-900 sm:text-2xl">
                      <span>Total</span>
                      <span>{formatMoney(beverageSubtotal)}</span>
                    </div>
                  </div>
                </div>
              ) : null}
              {/* Bottom bar: items added + total on the left, continue on the right (the Skip button is in the header) */}
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] sm:px-6">
                <div className="min-w-0">
                  {totalBeverageQty > 0 ? (
                    <>
                      <p className="text-xs text-slate-500 sm:text-sm">{totalBeverageQty} item{totalBeverageQty === 1 ? "" : "s"} added</p>
                      <p className="text-base font-extrabold leading-tight text-slate-900 sm:text-xl">{formatMoney(beverageSubtotal)}</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">No items added</p>
                  )}
                </div>
                <ShinyBlackButton
                  type="button"
                  onClick={() => setStep("review")}
                  className="shrink-0 rounded-xl bg-[#111111] px-5 py-2.5 text-sm font-bold text-white sm:px-8 sm:py-3 sm:text-base"
                >
                  {totalBeverageQty > 0 ? "Continue" : "Continue to review"} <ChevronRight className="size-4" />
                </ShinyBlackButton>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-6 lg:pb-16">
            <form
              id="movie-booking-form"
              onSubmit={handleSubmit(onConfirmBooking, () => setBillingEditOpen(true))}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start"
              noValidate
            >
              <div className="lg:col-span-7 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">{movie?.title || "Movie"}</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {[
                          showtime?.language,
                          showtime?.format,
                          movie?.duration_minutes
                            ? `${Math.floor(Number(movie.duration_minutes) / 60)}h ${Number(movie.duration_minutes) % 60}m`.replace(" 0m", "")
                            : "",
                        ].filter(Boolean).join("  •  ")}
                      </p>
                      <p className="mt-3 text-sm font-semibold text-slate-800">{cinema?.name}</p>
                      {cinema?.address ? (
                        <p className="mt-0.5 text-sm text-slate-500">{[cinema.address, (cinema as any).city, (cinema as any).country].flatMap((v: any) => String(v || "").split(",")).map((v: string) => v.trim()).filter(Boolean).filter((v: string, i: number, a: string[]) => a.findIndex((x) => x.trim().toLowerCase() === v.trim().toLowerCase()) === i).join(", ")}</p>
                      ) : null}
                                          </div>
                    {reviewPoster ? (
                      <img
                        src={reviewPoster}
                        alt={movie?.title || "Movie poster"}
                        className="w-20 h-28 sm:w-24 sm:h-36 shrink-0 rounded-xl object-cover bg-slate-100 shadow-sm border border-slate-200/80"
                      />
                    ) : null}
                  </div>

                  <div className="mt-2.5 border-t border-slate-100 pt-2.5">
                    <p className="text-sm font-semibold text-slate-900">{reviewDateLine}</p>
                    {reviewTimeLine ? (
                      <p className="mt-0.5 text-xs text-slate-500">{reviewTimeLine}</p>
                    ) : null}
                  </div>

                  <div className="mt-2.5 flex items-start justify-between gap-4 border-t border-slate-100 pt-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {selectedSeats.length} ticket{selectedSeats.length === 1 ? "" : "s"}
                      </p>
                      {seatSummaryLine ? (
                        <p className="mt-0.5 text-xs text-slate-600">
                          {seatSummaryLine}
                        </p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-sm font-bold text-slate-900">{formatMoney(ticketSubtotal)}</p>
                  </div>

                  {Object.values(selectedBeverages).length > 0 ? (
                    <div className="mt-2.5 space-y-1 border-t border-slate-100 pt-2.5">
                      {Object.values(selectedBeverages).map((b) => (
                        <div key={b.id} className="flex items-center justify-between text-xs text-slate-600">
                          <span>{b.name} × {b.quantity}</span>
                          <span className="font-semibold text-slate-900">{formatMoney(b.price * b.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-2.5 flex items-center gap-2 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                    <Info className="size-3.5 shrink-0 text-slate-400" />
                    <span>Cancellation is unavailable.</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Applied Promo Code Banner */}
                  {promoApplied && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                            <Tag size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 font-mono text-sm tracking-wide">
                                {promoCode}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                                <CheckCircle2 size={11} /> Applied
                              </span>
                            </div>
                            <p className="text-xs text-emerald-700 mt-0.5">
                              You saved {formatMoney(discountAmount)}!
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
                  {!promoApplied && (
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
                            Promo codes, movie discounts &amp; bank offers
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
                        <span className="font-semibold text-slate-900">{formatMoney(ticketSubtotal + beverageSubtotal)}</span>
                      </summary>
                      <div className="mt-2 space-y-1.5 text-xs leading-snug text-slate-500">
                        {ticketPriceLines.map((line) => (
                          <p key={`${line.label}-${line.price}`}>
                            {line.count} × {line.label} ticket{line.count === 1 ? "" : "s"} @ {formatMoney(line.price)}
                            <span className="block">each</span>
                          </p>
                        ))}
                        {beverageSubtotal > 0 ? (
                          <div className="flex justify-between">
                            <span>Snacks and drinks ({totalBeverageQty})</span>
                            <span>{formatMoney(beverageSubtotal)}</span>
                          </div>
                        ) : null}
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
                            <span>VAT @ {convVatPct}%</span>
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
                      onClick={() => setBillingEditOpen(true)}
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
                      <p className="font-semibold text-slate-900">{guestName?.trim() || "Add your name"}</p>
                      <p className="text-slate-500">{guestPhone?.trim() || "Add your phone number"}</p>
                      <p className="truncate text-slate-500">{guestEmail?.trim() || "Add your email"}</p>
                    </div>
                  </div>
                  {(errors.guest_name || errors.guest_phone || errors.guest_email) ? (
                    <p className="mt-2 text-[11px] font-semibold text-rose-600">Check your billing details before paying.</p>
                  ) : null}
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                  <Banknote className="size-4 shrink-0 text-slate-500" />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">Cash</p>
                    <p className="text-xs text-slate-500">Pay at the cinema counter</p>
                  </div>
                  <CheckCircle2 className="ml-auto size-4 shrink-0 text-emerald-600" />
                </div>

                <div className="hidden lg:flex gap-3 pt-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => requestLeaveConfirmStep("back")}
                    className="px-4 py-3.5 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <ArrowLeft size={16} /> Back
                  </button>
                  <ShinyBlackButton
                    type="submit"
                    form="movie-booking-form"
                    disabled={submitting || timeOutOpen}
                    className="flex-1 items-center justify-between rounded-xl bg-[#111111] px-5 py-3.5 text-white disabled:opacity-50"
                  >
                    <span className="flex w-full items-center justify-between gap-3">
                      <span className="text-left">
                        <span className="block text-sm font-bold">{formatMoney(grandTotal)}</span>
                        <span className="block text-[10px] font-semibold tracking-wide text-white/70">TOTAL</span>
                      </span>
                      <span className="text-sm font-bold">
                        {submitting ? "Confirming…" : "Pay now"}
                      </span>
                    </span>
                  </ShinyBlackButton>
                </div>
              </aside>
            </form>
          </div>
        )}
      </main>

      {/* In-flow bottom bars (not position:fixed) — avoids iOS clipping inside overflow:hidden immersive shell */}
      {step === "review" ? (
        <footer className="lg:hidden shrink-0 z-40 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="max-w-lg mx-auto flex gap-3 items-stretch">
            <button
              type="button"
              disabled={submitting}
              onClick={() => requestLeaveConfirmStep("back")}
              className="px-4 py-3.5 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1.5 shrink-0"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <ShinyBlackButton
              type="submit"
              form="movie-booking-form"
              disabled={submitting || timeOutOpen}
              className="flex-1 items-center justify-between rounded-xl bg-[#111111] px-5 py-3.5 text-white disabled:opacity-50"
            >
              <span className="flex w-full items-center justify-between gap-3">
                <span className="text-left">
                  <span className="block text-sm font-bold">{formatMoney(grandTotal)}</span>
                  <span className="block text-[10px] font-semibold tracking-wide text-white/70">TOTAL</span>
                </span>
                <span className="text-sm font-bold">
                  {submitting ? "Confirming…" : "Pay now"}
                </span>
              </span>
            </ShinyBlackButton>
          </div>
        </footer>
      ) : null}

      {step === "beverages" ? (
        <footer className="lg:hidden shrink-0 z-40 border-t border-slate-200 bg-white px-4 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
            <div className="min-w-0 flex-1">
              {totalBeverageQty > 0 ? (
                <>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                    {totalBeverageQty} snack item{totalBeverageQty === 1 ? "" : "s"} added
                  </p>
                  <p className="text-sm font-extrabold text-slate-900 tabular-nums">
                    {formatMoney(beverageSubtotal)}
                  </p>
                </>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-slate-700 leading-tight">No snacks selected</p>
                  <p className="text-[11px] text-slate-400 leading-tight mt-0.5">You can skip or continue</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => { setSelectedBeverages({}); setStep("review"); }}
                className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 active:scale-95 transition-all cursor-pointer shadow-xs"
              >
                Skip
              </button>
              <ShinyBlackButton
                type="button"
                onClick={() => setStep("review")}
                className="px-5 py-2.5 rounded-xl bg-[#111111] text-white text-xs sm:text-sm font-bold shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <span>Continue</span>
                <ChevronRight className="size-4" strokeWidth={2.5} />
              </ShinyBlackButton>
            </div>
          </div>
        </footer>
      ) : null}

      {step === "seats" && selectedSeats.length > 0 ? (
        <footer className="shrink-0 z-40 border-t border-slate-200 bg-white py-3.5 pb-[max(0.85rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="bmb-section-container flex items-center justify-between gap-4">
            <div className="min-w-0 leading-tight">
              <p className="text-[11px] font-medium text-slate-500">Selected</p>
              <p className="text-sm sm:text-[15px] font-bold text-[#6e52fa]">
                {selectedSeats.length} Seat{selectedSeats.length === 1 ? "" : "s"}
              </p>
            </div>
            <ShinyBlackButton
              type="button"
              disabled={!canContinue}
              onClick={handleContinue}
              className="px-8 sm:px-10 py-3 rounded-lg bg-[#111111] text-white text-sm font-bold disabled:!opacity-40 min-w-[9rem]"
            >
              {holding ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Holding…
                </>
              ) : (
                "Proceed"
              )}
            </ShinyBlackButton>
          </div>
        </footer>
      ) : null}

      {isMapFullscreen && hasCanvasLayout && canvasLayoutData && (
        <div className="fixed inset-0 z-[60] bg-[#F5F5F7] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
            <p className="text-sm font-bold text-slate-900">Interactive seating map</p>
            <button
              type="button"
              onClick={() => setIsMapFullscreen(false)}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <VenueLayoutViewer
              layoutData={canvasLayoutData}
              ticketTypes={[]}
              onSeatsSelected={handleCanvasSeatsSelected}
              initialSelectedSeats={selectedSeats.map((s) => ({
                id: s.seat_identifier,
                seat_identifier: s.seat_identifier,
                tier_name: s.tier_name,
                unit_price: s.unit_price,
              }))}
              maxSelectable={qty}
              cinemaMode={true}
              customLegend={cinemaLegend}
            />
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
            aria-labelledby="movie-cancel-txn-title"
            className="w-full max-w-[22rem] rounded-[0.75rem] bg-white shadow-2xl px-5 pt-6 pb-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="movie-cancel-txn-title"
              className="text-center text-[1.25rem] font-extrabold text-slate-900"
            >
              Cancel booking?
            </h3>
            <p className="mt-3 text-center text-[1rem] text-slate-500 leading-relaxed">
              Your selected seats will be unblocked and may not be available later if you cancel.
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 text-center">
            <AlertCircle className="size-12 text-[#F84464] mx-auto" />
            <h3 className="text-xl font-extrabold text-slate-900">Your time is out</h3>
            <p className="text-sm text-slate-500">
              Your seat hold has expired. Please select your seats again to continue booking.
            </p>
            <button
              type="button"
              disabled={releasingHold}
              onClick={() => void resetToSeatsAfterTimeout()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#F84464] to-[#6900AA] text-white text-sm font-extrabold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {releasingHold ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Resetting…
                </>
              ) : (
                "Try Again"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Seat count picker — required on first entry; editable from header tickets button */}
      {step === "seats" ? (
        <MovieSeatQtyModal
          open={qtyModalOpen}
          dismissible={qtyModalDismissible}
          onClose={() => setQtyModalOpen(false)}
          initialQty={qty}
          tiers={seatQtyTiers}
          onConfirm={(nextQty) => {
            setSelectedSeats([]);
            setQtyModalOpen(false);
            setQtyModalDismissible(false);
            router.replace(`/movies/book/${showtimeId}?qty=${nextQty}`);
          }}
        />
      ) : null}

      {step === "seats" ? (
        <MovieAccessibilitySeatModal
          open={accessModalOpen}
          onClose={() => setAccessModalOpen(false)}
          qty={qty}
          categories={accessibilityCategories}
          onQtyChange={(nextQty) => {
            setSelectedSeats([]);
            router.replace(`/movies/book/${showtimeId}?qty=${nextQty}`);
          }}
          onSelectSeats={applyAccessibleSeatIds}
        />
      ) : null}

      {bookedSuccessId ? (
        <PaymentSuccessView
          presentation="modal"
          module="movies"
          bookingId={bookedSuccessId}
          nextHref={`/movies/booking-confirmation/${bookedSuccessId}`}
          onClose={() => setBookedSuccessId(null)}
        />
      ) : null}

      {billingEditOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4"
          onClick={() => setBillingEditOpen(false)}
        >
          <div
            role="dialog"
            aria-labelledby="edit-billing-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 id="edit-billing-title" className="text-base font-bold text-slate-900">
                Edit billing details
              </h3>
              <button
                type="button"
                onClick={() => setBillingEditOpen(false)}
                className="flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 cursor-pointer"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                {...register("guest_name")}
                placeholder="Full name"
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
              />
              {errors.guest_name ? <p className={fieldErrorClass}>{errors.guest_name.message}</p> : null}
              <div>
                <Controller
                  name="guest_phone"
                  control={control}
                  render={({ field }) => (
                    <PhoneInput
                      value={field.value || ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      required
                      disabled={phoneLocked}
                      variant="light"
                      inputClassName="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                      placeholder="Phone number"
                      error={errors.guest_phone?.message}
                    />
                  )}
                />
                {phoneLocked ? (
                  <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-slate-500">
                    <Info className="mt-0.5 size-3.5 shrink-0" />
                    The phone number associated with your account cannot be modified.
                  </p>
                ) : null}
              </div>
              <input
                type="email"
                {...register("guest_email")}
                placeholder="Email"
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
              />
              {errors.guest_email ? <p className={fieldErrorClass}>{errors.guest_email.message}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => {
                void trigger(["guest_name", "guest_phone", "guest_email"]).then((ok) => {
                  if (ok) setBillingEditOpen(false);
                });
              }}
              className="mt-5 w-full rounded-xl bg-black py-3 text-sm font-bold text-white cursor-pointer"
            >
              Confirm
            </button>
          </div>
        </div>
      ) : null}


      {/* Apply Offers Modal (Responsive: Fullscreen Sheet on mobile, Centered Modal on desktop) */}
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
            {/* Header: matches Event checkout (< Apply offers) */}
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
                    {movie?.title || "Movie"}
                    {showtime?.starts_at ? ` | ${formatDateCustomer(showtime.starts_at.replace(" ", "T"))}` : ""}
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
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      placeholder="TYPE YOUR COUPON CODE HERE"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 uppercase font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#6900AA] focus:bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyPromo()}
                    disabled={validatingPromo || !promoCode.trim()}
                    className="px-5 py-2.5 rounded-lg bg-[#6900AA] hover:bg-[#57008E] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0 inline-flex items-center gap-1.5"
                  >
                    {validatingPromo ? <Loader2 size={14} className="animate-spin" /> : null}
                    Apply
                  </button>
                </div>
              </div>

              {/* Offers Tabs (All Offers / Movie Offers / Platform Offers) */}
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
                  onClick={() => setOffersModalTab("MOVIES")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${offersModalTab === "MOVIES"
                      ? "bg-[#6900AA] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                >
                  Movie Offers ({publicCinemaOffers.length})
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
                      return statusOk && (cat === "ALL" || cat === "MOVIES");
                    }).length
                  }
                  )
                </button>
              </div>

              {/* Offers List (Movie & Platform Offers) */}
              <div className="space-y-3">
                {(() => {
                  const cinemaOffersFormatted = (publicCinemaOffers || []).map((o: any) => {
                    const discountType = String(o.discount_type || "").toUpperCase();
                    const val = Number(o.discount_value) || 0;
                    return {
                      id: o.id,
                      type: "MOVIES" as const,
                      title: o.name || o.title || `Movie Special Offer`,
                      code: o.code || o.promo_code || "MOVIEOFFER",
                      description:
                        o.description ||
                        `Get ${discountType === "PERCENT" ? `${val}% off` : formatMoney(val)} on this movie.`,
                      discountText: discountType === "PERCENT" ? `${val}% OFF` : `FLAT ${formatMoney(val)} OFF`,
                      savingsText: discountType === "PERCENT" ? `Save ${val}%` : `Save ${formatMoney(val)}`,
                      badge: o.cinema_name || "Movie Special",
                    };
                  });

                  const platformOffersFormatted = (activePlatformOffers || [])
                    .filter((p: any) => {
                      const cat = String(p.category || "").toUpperCase();
                      const statusOk = !p.effective_status || p.effective_status === "ACTIVE";
                      return statusOk && (cat === "ALL" || cat === "MOVIES");
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

                  let displayedOffers = [...cinemaOffersFormatted, ...platformOffersFormatted];
                  if (offersModalTab === "MOVIES") {
                    displayedOffers = cinemaOffersFormatted;
                  } else if (offersModalTab === "PLATFORM") {
                    displayedOffers = platformOffersFormatted;
                  }

                  if (displayedOffers.length === 0) {
                    return (
                      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                        <p className="text-sm font-semibold">
                          {offersModalTab === "MOVIES"
                            ? "No movie-specific offers available."
                            : offersModalTab === "PLATFORM"
                              ? "No platform offers currently available."
                              : "No offers currently available for this movie."}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">If you have a promo code, type it above to apply.</p>
                      </div>
                    );
                  }

                  return displayedOffers.map((offer) => {
                    const isCurrentlyApplied = promoApplied && promoCode.toUpperCase() === offer.code.toUpperCase();
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
                                void handleRemovePromo();
                              } else {
                                void handleApplyPromo(offer.code);
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

      {/* Apply Gift Cards Modal */}
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
                                    category: "MOVIES",
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

      <CustomerAuthModal
        open={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setPendingAfterAuth(false);
        }}
        onSuccess={() => {
          dispatch(loadFromStorage());
          setAuthModalOpen(false);
          if (pendingAfterAuth) {
            setPendingAfterAuth(false);
            void proceedCreateHold();
          }
        }}
      />
    </div>
  );
}
