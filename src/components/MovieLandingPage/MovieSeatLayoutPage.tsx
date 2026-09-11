"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  ArrowLeft,
  Calendar,
  Clock,
  AlertCircle,
  Loader2,
  Armchair,
  Tv,
  Maximize2,
  Map as MapIcon,
  LayoutGrid,
  X,
  Ticket,
  User,
  Tag,
  Gift,
  CheckCircle2,
  Banknote,
  Timer,
} from "lucide-react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
  useGetMovieShowtimeLayoutQuery,
  useCreateMovieBookingMutation,
  useCreateMovieSeatHoldMutation,
  useReleaseMovieSeatHoldMutation,
  useGetMyGiftCardsQuery,
  usePreviewGiftCardRedeemMutation,
  type MovieBookingSeatPayload,
  type GiftCardRedeemPreview,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { extractApiError } from "@/lib/apiErrors";
import { sanitizePhoneInput } from "@/lib/validation";
import {
  emptyMovieCheckoutFormValues,
  movieCheckoutFormSchema,
  type MovieCheckoutFormValues,
} from "@/lib/movieCheckoutFormSchema";
import PhoneInput from "@/components/Shared/PhoneInput";
import CustomerAuthModal from "@/components/Shared/CustomerAuthModal";
import { formatMoney } from "@/lib/currencyFormat";
import { isGiftCardSpendable } from "@/lib/giftCardOwnership";
import { resolveHoldExpiresAt } from "@/lib/holdCountdown";

const HOLD_SESSION_KEY = "bmb_movie_hold_session";

const VenueLayoutViewer = dynamic(
  () => import("@/components/EventLandingPage/VenueLayoutViewer"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[550px] flex flex-col items-center justify-center gap-3 text-slate-500 bg-slate-100 rounded-2xl border border-slate-200">
        <Loader2 className="size-8 animate-spin text-[#F84464]" />
        <p className="text-sm">Loading interactive seating map…</p>
      </div>
    ),
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

const fieldErrorClass = "mt-1.5 text-[11px] font-semibold text-rose-600";
const reqStar = <span className="text-rose-500">*</span>;

type BookingStep = "seats" | "review";

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
}

interface GridRow {
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

  const qty = useMemo(() => {
    const raw = Number(searchParams.get("qty") || 1);
    if (!Number.isFinite(raw) || raw < 1) return 1;
    return Math.min(10, Math.floor(raw));
  }, [searchParams]);

  const [step, setStep] = useState<BookingStep>("seats");
  const [sessionToken, setSessionToken] = useState<string | undefined>(undefined);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [timeOutOpen, setTimeOutOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingAfterAuth, setPendingAfterAuth] = useState(false);
  const [holding, setHolding] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedSeats, setSelectedSeats] = useState<MovieBookingSeatPayload[]>([]);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [giftCardInput, setGiftCardInput] = useState("");
  const [selectedGiftCardId, setSelectedGiftCardId] = useState("");
  const [appliedGiftCard, setAppliedGiftCard] = useState<GiftCardRedeemPreview | null>(null);

  const [viewMode, setViewMode] = useState<"canvas" | "grid">("canvas");
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  const proceedRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    dispatch(loadFromStorage());
    setSessionToken(readHoldSessionToken());
  }, [dispatch]);

  const {
    data: layoutData,
    isLoading,
    isError,
    refetch,
  } = useGetMovieShowtimeLayoutQuery({
    showtimeId,
    session_token: sessionToken,
  });

  const [createHold] = useCreateMovieSeatHoldMutation();
  const [releaseHold] = useReleaseMovieSeatHoldMutation();
  const [createBooking] = useCreateMovieBookingMutation();
  const [previewGiftCard, { isLoading: validatingGiftCard }] = usePreviewGiftCardRedeemMutation();

  const isCustomerLoggedIn = Boolean(
    authUser && (authUser.role === "customer" || authUser.customer_id)
  );
  const customerId =
    authUser?.role === "customer" ? authUser.customer_id || authUser.id || "" : "";

  const { data: myGiftCards = [] } = useGetMyGiftCardsQuery(undefined, {
    skip: !customerId,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
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

  const bookedSet = useMemo(() => {
    const booked = layoutData?.booked_seat_identifiers ?? [];
    const held = layoutData?.held_seat_identifiers ?? [];
    return new Set([...booked, ...held]);
  }, [layoutData]);

  const hasCanvasLayout = useMemo(() => {
    return Boolean(
      layoutData?.layout_template?.seats_json &&
        Array.isArray(layoutData.layout_template.seats_json) &&
        layoutData.layout_template.seats_json.length > 0
    );
  }, [layoutData]);

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
    return {
      data: {
        seats: rawSeats.map((s: any, idx: number) => {
          const rowLabel = String(s.row_label || "").trim();
          const seatLabel = String(s.seat_label || "").trim();
          const secName = String(s.section_name || "Standard").trim();
          const labelId = `${rowLabel}${seatLabel}`;

          const isDupe =
            rawSeats.filter(
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
          };
        }),
        seating_config: layoutData.layout_template.seating_config,
      },
    };
  }, [layoutData, hasCanvasLayout, bookedSet]);

  const handleCanvasSeatsSelected = useCallback(
    (chosenSeats: any[]) => {
      if (chosenSeats.length > qty) {
        toast.warning(`Please select exactly ${qty} seat${qty === 1 ? "" : "s"}.`);
        return;
      }
      const newSelected = chosenSeats.map((cs) => {
        const secName = cs.section_name || "Standard";
        const price = getTierPrice(secName, 0);
        return {
          seat_identifier: cs.friendlyId || cs.id,
          tier_name: secName,
          unit_price: price,
        };
      });
      setSelectedSeats(newSelected);
      setPromoApplied(false);
      setDiscountAmount(0);
      setAppliedGiftCard(null);
    },
    [getTierPrice, qty]
  );

  const screenPosition = useMemo<"top" | "bottom">(() => {
    const shapes = layoutData?.layout_template?.seating_config?.shapes;
    if (Array.isArray(shapes) && shapes.length > 0) {
      const screenShape = shapes.find((s: any) =>
        String(s.text || "").toLowerCase().includes("screen")
      );
      if (screenShape) {
        const rawSeats = Array.isArray(layoutData?.layout_template?.seats_json)
          ? layoutData.layout_template.seats_json
          : [];
        if (rawSeats.length > 0) {
          const minY = Math.min(...rawSeats.map((s: any) => Number(s.coordinate_y ?? 0)));
          if (Number(screenShape.y ?? 0) < minY) {
            return "top";
          }
        }
      }
    }
    return "bottom";
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

          const gridSeats: GridSeat[] = rowSeats.map((seat: any, seatIdx: number) => {
            const seatNum =
              seat.seat_label != null && String(seat.seat_label).trim() !== ""
                ? String(seat.seat_label).trim()
                : String(seatIdx + 1);
            const labelId = `${rowObj.rowLabel}${seatNum}`;
            const isDupe =
              rawSeats!.filter(
                (o: any) =>
                  String(o.row_label || "").trim() === rowObj.rowLabel &&
                  String(o.seat_label || "").trim() === seatNum
              ).length > 1;
            const friendlyId = isDupe && sec.secName ? `${sec.secName} ${labelId}` : labelId;
            const seatId = friendlyId;
            const nextSeat = rowSeats[seatIdx + 1];
            const isAisleGap = nextSeat
              ? Number(nextSeat.coordinate_x ?? 0) - Number(seat.coordinate_x ?? 0) > normalStep * 1.6
              : false;

            const isStatusUnavailable =
              seat.status && !["AVAILABLE", "ACTIVE"].includes(String(seat.status).toUpperCase());

            const isBooked =
              bookedSet.has(seatId) ||
              bookedSet.has(labelId) ||
              bookedSet.has(friendlyId) ||
              bookedSet.has(`${rowObj.rowLabel}${Number(seatNum)}`) ||
              (seat.internalId && bookedSet.has(seat.internalId)) ||
              Boolean(isStatusUnavailable);

            return {
              id: seatId,
              row: rowObj.rowLabel,
              number: seatNum,
              tierName: sec.secName,
              price,
              isBooked,
              isAisleGap,
            };
          });

          rows.push({
            rowLabel: rowObj.rowLabel,
            tierName: sec.secName,
            price,
            seats: gridSeats,
          });
        }
      });

      if (rows.length > 0) return rows;
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
            seats.push({
              id: seatId,
              row: rowLabel,
              number: i,
              tierName,
              price,
              isBooked: bookedSet.has(seatId) || bookedSet.has(labelId),
            });
          }
          rows.push({ rowLabel, tierName, price, seats });
        }
      }
      return rows;
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
          seats.push({
            id: seatId,
            row: rowLabel,
            number: s,
            tierName,
            price,
            isBooked: bookedSet.has(seatId),
          });
        }
        rows.push({ rowLabel, tierName, price, seats });
      }
    }

    return rows;
  }, [layoutData, showtime, bookedSet, getTierPrice]);

  const handleSeatClick = (seat: GridSeat) => {
    if (seat.isBooked) return;

    const exists = selectedSeats.some((s) => s.seat_identifier === seat.id);
    if (exists) {
      setSelectedSeats((prev) => prev.filter((s) => s.seat_identifier !== seat.id));
      setPromoApplied(false);
      setDiscountAmount(0);
      setAppliedGiftCard(null);
      return;
    }

    if (selectedSeats.length >= qty) {
      toast.warning(`Please select exactly ${qty} seat${qty === 1 ? "" : "s"}.`);
      return;
    }

    setSelectedSeats((prev) => [
      ...prev,
      {
        seat_identifier: seat.id,
        tier_name: seat.tierName,
        unit_price: seat.price,
      },
    ]);
    setPromoApplied(false);
    setDiscountAmount(0);
    setAppliedGiftCard(null);
  };

  const ticketSubtotal = useMemo(
    () => money(selectedSeats.reduce((sum, s) => sum + (Number(s.unit_price) || 0), 0)),
    [selectedSeats]
  );

  const convenienceFee = useMemo(() => {
    if (selectedSeats.length === 0) return 0;
    return money(Math.max(10, ticketSubtotal * 0.03));
  }, [selectedSeats.length, ticketSubtotal]);

  const orderTotal = useMemo(
    () => money(Math.max(0, ticketSubtotal + convenienceFee - discountAmount)),
    [ticketSubtotal, convenienceFee, discountAmount]
  );

  const giftCardAmount = appliedGiftCard ? Number(appliedGiftCard.amount_applicable) || 0 : 0;

  const grandTotal = useMemo(
    () => money(Math.max(0, orderTotal - giftCardAmount)),
    [orderTotal, giftCardAmount]
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

  const handleApplyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) {
      toast.error("Please enter a promo code.");
      return;
    }
    if (code === "WELCOME10" || code === "MOVIE10") {
      const discount = money(ticketSubtotal * 0.1);
      setDiscountAmount(discount);
      setPromoApplied(true);
      setAppliedGiftCard(null);
      toast.success(`Promo code ${code} applied! Saved ${formatMoney(discount)}.`);
    } else if (code === "FLAT50") {
      setDiscountAmount(50);
      setPromoApplied(true);
      setAppliedGiftCard(null);
      toast.success(`Promo code ${code} applied! Saved ${formatMoney(50)}.`);
    } else {
      toast.error("Invalid or expired promo code.");
    }
  };

  const handleRemovePromo = () => {
    setPromoCode("");
    setPromoApplied(false);
    setDiscountAmount(0);
    setAppliedGiftCard(null);
    toast.info("Promo code removed.");
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

  const resetToSeatsAfterTimeout = async () => {
    try {
      if (holdId) {
        await releaseHold({
          holdId,
          session_token: sessionToken || readHoldSessionToken(),
        }).unwrap();
      }
    } catch {
      // best-effort release
    }
    setHoldId(null);
    setExpiresAt(null);
    setSecondsLeft(null);
    setTimeOutOpen(false);
    setSelectedSeats([]);
    setPromoApplied(false);
    setDiscountAmount(0);
    setPromoCode("");
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
      setStep("review");
      toast.success(res.message || "Seats held. Complete your booking.");
    } catch (err) {
      toast.error(extractApiError(err, "Could not hold seats. Please try again."));
      refetch();
    } finally {
      setHolding(false);
    }
  }, [selectedSeats, qty, sessionToken, createHold, showtimeId, refetch]);

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
    await proceedCreateHold();
  };

  useEffect(() => {
    if (!pendingAfterAuth || !isCustomerLoggedIn || authModalOpen) return;
    setPendingAfterAuth(false);
    void proceedRef.current();
  }, [pendingAfterAuth, isCustomerLoggedIn, authModalOpen]);

  useEffect(() => {
    if (step !== "review" || !expiresAt) {
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
  }, [step, expiresAt]);

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
        guest_name: values.guest_name.trim(),
        guest_phone: sanitizePhoneInput(values.guest_phone),
        guest_email: values.guest_email.trim(),
        promo_code: promoApplied ? promoCode.trim() : undefined,
        payment_method: "CASH",
        hold_id: holdId,
        session_token: sessionToken || readHoldSessionToken(),
        gift_card_id: appliedGiftCard?.gift_card_id || undefined,
        gift_card_code:
          appliedGiftCard && giftCardInput.trim() && !selectedGiftCardId
            ? giftCardInput.trim()
            : undefined,
      }).unwrap();

      toast.success(res.message || "Booking confirmed!");
      router.push(`/movies/booking-confirmation/${res.data.booking_id}`);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to confirm booking. Please try again."));
      refetch();
    } finally {
      setSubmitting(false);
    }
  };

  const showDateFormatted = useMemo(() => {
    if (!showtime?.starts_at) return "";
    try {
      const dt = new Date(showtime.starts_at.replace(" ", "T"));
      return dt.toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return showtime.starts_at;
    }
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

  const canContinue = selectedSeats.length === qty && !holding;

  const seatMapSection = (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 p-2.5 rounded-2xl shadow-sm">
        {hasCanvasLayout ? (
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode("canvas")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "canvas"
                  ? "bg-gradient-to-r from-[#F84464] to-[#6900AA] text-white shadow-md shadow-[#F84464]/20"
                  : "text-slate-500 hover:text-slate-900 hover:bg-white"
              }`}
            >
              <MapIcon className="size-3.5" />
              <span>Interactive Map</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-gradient-to-r from-[#F84464] to-[#6900AA] text-white shadow-md shadow-[#F84464]/20"
                  : "text-slate-500 hover:text-slate-900 hover:bg-white"
              }`}
            >
              <LayoutGrid className="size-3.5" />
              <span>Grid View</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2 text-xs font-bold text-slate-700">
            <LayoutGrid className="size-4 text-[#F84464]" />
            <span>Cinema Seating Layout</span>
          </div>
        )}

        <p className="text-xs text-slate-500">
          Select exactly <span className="text-slate-900 font-bold">{qty}</span> seat
          {qty === 1 ? "" : "s"}
        </p>

        {hasCanvasLayout && viewMode === "canvas" && (
          <button
            type="button"
            onClick={() => setIsMapFullscreen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
            title="Open fullscreen interactive map"
          >
            <Maximize2 className="size-3.5 text-rose-500" />
            <span>Fullscreen</span>
          </button>
        )}
      </div>

      {viewMode === "canvas" && hasCanvasLayout && canvasLayoutData ? (
        <div className="relative rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm h-[min(62vh,620px)] sm:h-[min(68vh,680px)]">
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
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-center gap-6 py-2.5 px-4 rounded-2xl bg-white border border-slate-200 text-xs shadow-sm">
            <div className="flex items-center gap-2">
              <div className="size-4 rounded-md bg-white border border-slate-300" />
              <span className="text-slate-600">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-4 rounded-md bg-gradient-to-r from-[#F84464] to-[#6900AA] border border-[#F84464] shadow shadow-[#F84464]/30" />
              <span className="text-slate-900 font-bold">Selected</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-4 rounded-md bg-slate-200 border border-slate-300 opacity-80 relative">
                <span className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500">
                  ✕
                </span>
              </div>
              <span className="text-slate-500">Sold / Held</span>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 overflow-x-auto space-y-8 shadow-sm">
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

                  <div className="flex items-center justify-center gap-3">
                    <span className="w-5 text-center text-xs font-bold text-slate-500 shrink-0">
                      {rowGroup.rowLabel}
                    </span>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      {rowGroup.seats.map((seat, seatIdx) => {
                        const isSelected = selectedSeats.some(
                          (s) => s.seat_identifier === seat.id
                        );
                        const isAisleGap = seat.isAisleGap ?? (seatIdx === 3 || seatIdx === 9);

                        return (
                          <div
                            key={`${idx}-${rowGroup.tierName}-${seat.id}-${seatIdx}`}
                            className="flex items-center"
                          >
                            <button
                              type="button"
                              disabled={seat.isBooked}
                              onClick={() => handleSeatClick(seat)}
                              className={`size-7 sm:size-8 rounded-lg text-[11px] font-bold transition-all duration-150 flex items-center justify-center select-none ${
                                seat.isBooked
                                  ? "bg-slate-200 border border-slate-300 text-slate-400 cursor-not-allowed"
                                  : isSelected
                                    ? "bg-gradient-to-r from-[#F84464] to-[#6900AA] text-white border border-[#F84464]/40 shadow-lg shadow-[#F84464]/25 scale-110 z-10"
                                    : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 hover:scale-105 cursor-pointer"
                              }`}
                              title={`${rowGroup.tierName} • ${seat.id} (${seat.price} ETB)`}
                            >
                              {seat.number}
                            </button>
                            {isAisleGap && <div className="w-3 sm:w-5" aria-hidden="true" />}
                          </div>
                        );
                      })}
                    </div>
                    <span className="w-5 text-center text-xs font-bold text-slate-500 shrink-0">
                      {rowGroup.rowLabel}
                    </span>
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
        </>
      )}
    </section>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] text-slate-900 flex flex-col items-center justify-center gap-3">
        <Loader2 className="size-10 animate-spin text-[#F84464]" />
        <p className="text-sm font-medium text-slate-500">Loading cinema seat layout…</p>
      </div>
    );
  }

  if (isError || !layoutData) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] text-slate-900 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertCircle className="size-12 text-rose-500" />
        <h2 className="text-xl font-bold text-slate-900">Showtime Layout Unavailable</h2>
        <p className="text-sm text-slate-500 max-w-md">
          We couldn’t load the seat layout for this showtime. It might have finished or been updated.
        </p>
        <Link
          href="/movies"
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F84464] to-[#6900AA] text-white text-sm font-bold shadow"
        >
          Back to Movies
        </Link>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] min-h-screen bg-[#F5F5F7] text-slate-900 flex flex-col overflow-hidden">
      <header className="shrink-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (step === "review") {
                  setStep("seats");
                  return;
                }
                router.back();
              }}
              className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 transition-colors cursor-pointer shrink-0"
              title={step === "review" ? "Back to seats" : "Go Back"}
            >
              <ArrowLeft className="size-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight truncate">
                  {movie?.title}
                </h1>
                {movie?.certificate && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {movie.certificate}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-600 border border-rose-200">
                  {showtime?.format || "2D"} • {showtime?.language || "English"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="text-slate-700 font-semibold">{cinema?.name}</span>
                <span>•</span>
                <span className="text-slate-700 font-medium">{screen?.name}</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-slate-700">
                  <Calendar className="size-3 text-[#F84464]" /> {showDateFormatted}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-slate-700">
                  <Clock className="size-3 text-[#F84464]" /> {showTimeFormatted}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span
              className={`px-2.5 py-1 rounded-lg border font-bold ${
                step === "seats"
                  ? "bg-rose-50 border-rose-200 text-[#F84464]"
                  : "bg-slate-100 border-slate-200 text-slate-500"
              }`}
            >
              1. Seats
            </span>
            <span className="text-slate-300">→</span>
            <span
              className={`px-2.5 py-1 rounded-lg border font-bold ${
                step === "review"
                  ? "bg-purple-50 border-purple-200 text-[#6900AA]"
                  : "bg-slate-100 border-slate-200 text-slate-500"
              }`}
            >
              2. Review
            </span>
          </div>
        </div>
      </header>

      {step === "review" && secondsLeft !== null && (
        <div
          className={`shrink-0 px-4 py-2.5 text-center text-sm font-bold border-b ${
            secondsLeft <= 60
              ? "bg-rose-50 border-rose-200 text-rose-700"
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <Timer className="size-4" />
            Complete booking in{" "}
            <span className="font-mono text-base tracking-wider">
              {formatCountdown(secondsLeft)}
            </span>
          </span>
        </div>
      )}

      <main className="flex-1 min-h-0 overflow-y-auto">
        {step === "seats" ? (
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 pb-36">{seatMapSection}</div>
        ) : (
          <div className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-6 pb-10">
            <form
              onSubmit={handleSubmit(onConfirmBooking)}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
              noValidate
            >
              <div className="lg:col-span-7 space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <User className="size-4 text-[#F84464]" /> Guest details
                  </h2>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                        Full Name {reqStar}
                      </label>
                      <input
                        type="text"
                        {...register("guest_name")}
                        placeholder="Full Name"
                        className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#F84464] focus:ring-1 focus:ring-[#F84464]/20"
                      />
                      {errors.guest_name && (
                        <p className={fieldErrorClass}>{errors.guest_name.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                        Phone Number {reqStar}
                      </label>
                      <Controller
                        name="guest_phone"
                        control={control}
                        render={({ field }) => (
                          <PhoneInput
                            value={field.value || ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            required
                            variant="light"
                            inputClassName="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#F84464] focus:ring-1 focus:ring-[#F84464]/20"
                            placeholder="Phone Number (e.g. 912345678)"
                            error={errors.guest_phone?.message}
                          />
                        )}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                        Email Address {reqStar}
                      </label>
                      <input
                        type="email"
                        {...register("guest_email")}
                        placeholder="Email for M-Ticket confirmation"
                        className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#F84464] focus:ring-1 focus:ring-[#F84464]/20"
                      />
                      {errors.guest_email && (
                        <p className={fieldErrorClass}>{errors.guest_email.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-sm">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="size-3.5 text-purple-500" /> Promo / Discount Code
                  </label>
                  {promoApplied ? (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-emerald-500" />
                        <span className="font-bold text-slate-900 font-mono">{promoCode}</span>
                        <span className="text-emerald-600">
                          (−{formatMoney(discountAmount)})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemovePromo}
                        className="text-xs text-rose-600 hover:underline font-semibold cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        placeholder="e.g. WELCOME10"
                        className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 uppercase placeholder:text-slate-400 focus:outline-none focus:border-[#F84464] focus:ring-1 focus:ring-[#F84464]/20"
                      />
                      <button
                        type="button"
                        onClick={handleApplyPromo}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 border border-slate-200 transition-colors cursor-pointer"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Gift className="size-3.5 text-[#F84464]" /> Gift card
                  </p>
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
                          <option value="">
                            Select from My Gift Cards
                          </option>
                          {redeemableGiftCards.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.product_name || "Gift Card"} · {c.code_masked} ·{" "}
                              {formatMoney(Number(c.current_balance))}
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
                          className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 font-mono uppercase placeholder:text-slate-400 focus:outline-none focus:border-[#F84464] focus:ring-1 focus:ring-[#F84464]/20"
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
                          {validatingGiftCard ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            "Apply"
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Payment method
                  </p>
                  <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-rose-50 border border-rose-200">
                    <Banknote className="size-5 text-[#F84464]" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">Cash</p>
                      <p className="text-[11px] text-slate-500">
                        Pay at the cinema counter (mock payment)
                      </p>
                    </div>
                    <CheckCircle2 className="size-5 text-emerald-500 ml-auto" />
                  </div>
                </div>
              </div>

              <aside className="lg:col-span-5 space-y-4 lg:sticky lg:top-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Ticket className="size-4 text-[#F84464]" /> Booking summary
                  </h2>

                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Selected seats
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {selectedSeats.map((seat) => (
                        <span
                          key={seat.seat_identifier}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-rose-50 to-purple-50 border border-rose-200 text-xs font-bold text-slate-900"
                        >
                          <Armchair className="size-3 text-rose-500" />
                          {seat.seat_identifier}
                          <span className="text-rose-600 font-normal">
                            ({formatMoney(seat.unit_price, { compact: true })})
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-200 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Tickets ({selectedSeats.length})</span>
                      <span className="text-slate-900 font-semibold">
                        {formatMoney(ticketSubtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Convenience fee</span>
                      <span className="text-slate-900 font-semibold">
                        +{formatMoney(convenienceFee)}
                      </span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Promo discount</span>
                        <span className="font-bold">−{formatMoney(discountAmount)}</span>
                      </div>
                    )}
                    {giftCardAmount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Gift card</span>
                        <span className="font-bold">−{formatMoney(giftCardAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-sm font-extrabold">
                      <span className="text-slate-900">
                        {giftCardAmount > 0 ? "Amount due" : "Total payable"}
                      </span>
                      <span className="text-lg text-transparent bg-clip-text bg-gradient-to-r from-[#F84464] to-[#6900AA]">
                        {formatMoney(grandTotal)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || timeOutOpen}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#F84464] to-[#6900AA] text-white text-sm font-extrabold shadow-lg shadow-[#F84464]/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Confirming…
                      </>
                    ) : (
                      <>Confirm booking · {formatMoney(grandTotal)}</>
                    )}
                  </button>
                </div>
              </aside>
            </form>
          </div>
        )}
      </main>

      {step === "seats" && (
        <footer className="shrink-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 sm:px-8 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {selectedSeats.length}/{qty} seats selected
              </p>
              {selectedSeats.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Pick your seats on the map</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selectedSeats.map((s) => (
                    <span
                      key={s.seat_identifier}
                      className="px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-[11px] font-bold text-slate-900"
                    >
                      {s.seat_identifier}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[11px] text-slate-500">Subtotal</p>
                <p className="text-base font-extrabold text-slate-900">
                  {formatMoney(ticketSubtotal)}
                </p>
              </div>
              <button
                type="button"
                disabled={!canContinue}
                onClick={handleContinue}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#F84464] to-[#6900AA] text-white text-sm font-extrabold shadow-lg shadow-[#F84464]/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer min-w-[8.5rem] flex items-center justify-center gap-2"
              >
                {holding ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Holding…
                  </>
                ) : (
                  "Continue"
                )}
              </button>
            </div>
          </div>
        </footer>
      )}

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
              onClick={resetToSeatsAfterTimeout}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#F84464] to-[#6900AA] text-white text-sm font-extrabold cursor-pointer"
            >
              Try Again
            </button>
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
