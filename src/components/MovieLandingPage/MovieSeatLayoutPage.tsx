"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Film,
  Info,
  MapPin,
  ShieldCheck,
  Tag,
  Ticket,
  User,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ChevronRight,
  Armchair,
  Tv,
  Maximize2,
  Minimize2,
  Map as MapIcon,
  LayoutGrid,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
  useGetMovieShowtimeLayoutQuery,
  useCreateMovieBookingMutation,
  type MovieBookingSeatPayload,
} from "@/services/api";

const VenueLayoutViewer = dynamic(
  () => import("@/components/EventLandingPage/VenueLayoutViewer"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[550px] flex flex-col items-center justify-center gap-3 text-slate-400 bg-slate-950/80 rounded-2xl">
        <Loader2 className="size-8 animate-spin text-[#F84464]" />
        <p className="text-sm">Loading interactive seating map…</p>
      </div>
    ),
  }
);

function getCinemaSectionColor(secName: string): string {
  const name = (secName || "").toLowerCase();
  if (name.includes("recliner")) return "#0284c7"; // Sky Blue
  if (name.includes("prime")) return "#3b82f6";    // Royal Blue
  if (name.includes("classic")) return "#6366f1";  // Indigo
  if (name.includes("vip") || name.includes("premium")) return "#f59e0b"; // Amber
  if (name.includes("platinum")) return "#06b6d4"; // Cyan
  if (name.includes("gold")) return "#a855f7";     // Purple
  if (name.includes("dress")) return "#ec4899";    // Pink
  if (name.includes("balcony")) return "#8b5cf6";  // Violet
  return "#3b82f6";
}
import { useAppSelector } from "@/lib/hooks";
import { extractApiError } from "@/lib/apiErrors";
import { sanitizePhoneInput } from "@/lib/validation";
import {
  emptyMovieCheckoutFormValues,
  movieCheckoutFormSchema,
  type MovieCheckoutFormValues,
} from "@/lib/movieCheckoutFormSchema";
import PhoneInput from "@/components/Shared/PhoneInput";

const fieldErrorClass = "mt-1.5 text-[11px] font-semibold text-rose-400";
const reqStar = <span className="text-rose-500">*</span>;

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
  const authUser = useAppSelector((state) => (state as any).auth?.user);

  const { data: layoutData, isLoading, isError, refetch } = useGetMovieShowtimeLayoutQuery(showtimeId);
  const [createBooking, { isLoading: isBooking }] = useCreateMovieBookingMutation();

  const [selectedSeats, setSelectedSeats] = useState<MovieBookingSeatPayload[]>([]);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);

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

  // Pre-fill user profile if logged in
  useEffect(() => {
    if (!authUser) return;
    const current = getValues();
    reset({
      guest_name: current.guest_name || authUser.name || "",
      guest_phone: current.guest_phone || sanitizePhoneInput(authUser.phone || ""),
      guest_email: current.guest_email || authUser.email || "",
    });
  }, [authUser, getValues, reset]);

  const showtime = layoutData?.showtime;
  const movie = layoutData?.movie;
  const cinema = layoutData?.cinema;
  const screen = layoutData?.screen;
  const bookedSet = useMemo(() => new Set(layoutData?.booked_seat_identifiers ?? []), [layoutData]);

  const [viewMode, setViewMode] = useState<"canvas" | "grid">("canvas");
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  const hasCanvasLayout = useMemo(() => {
    return Boolean(
      layoutData?.layout_template?.seats_json &&
      Array.isArray(layoutData.layout_template.seats_json) &&
      layoutData.layout_template.seats_json.length > 0
    );
  }, [layoutData]);

  // Helper to resolve tier price
  const getTierPrice = useCallback((sectionName: string, sectionIdx: number = 0): number => {
    const tiers = showtime?.tier_pricing;
    if (!tiers || tiers.length === 0) return 200;

    const cleanSec = (sectionName || "").trim().toLowerCase();

    // 1. Direct or partial name match
    const matched = tiers.find((t: any) => {
      const tName = String(t.tier_name || t.name || t.section_name || "").trim().toLowerCase();
      return tName && (tName === cleanSec || cleanSec.includes(tName) || tName.includes(cleanSec));
    });
    if (matched && !isNaN(Number(matched.price))) {
      return Number(matched.price);
    }

    // 2. Positional index match (e.g. section 0 -> tier 0, section 1 -> tier 1)
    if (tiers[sectionIdx] && !isNaN(Number(tiers[sectionIdx].price))) {
      return Number(tiers[sectionIdx].price);
    }

    // 3. Last tier fallback
    const lastTier = tiers[tiers.length - 1];
    return Number(lastTier?.price || 200);
  }, [showtime?.tier_pricing]);

  const cinemaLegend = useMemo(() => {
    if (!layoutData?.layout_template?.seats_json || !Array.isArray(layoutData.layout_template.seats_json)) return [];
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

          // If multiple sections have this exact same row and seat label, disambiguate with section name
          const isDupe = rawSeats.filter((o: any) =>
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

  const handleCanvasSeatsSelected = useCallback((chosenSeats: any[]) => {
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
  }, [getTierPrice]);

  // Check if template explicitly defines screen position (e.g. top vs bottom)
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

  // Generate structured cinema seat layout
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

    // 1. Preferred: Approved dynamic layout from venue_layout_templates (seats_json array)
    if (Array.isArray(rawSeats) && rawSeats.length > 0) {
      // Group seats by section_name
      const sectionMap = new Map<string, any[]>();
      for (const s of rawSeats) {
        const secName = (s.section_name || "Standard").trim();
        if (!sectionMap.has(secName)) {
          sectionMap.set(secName, []);
        }
        sectionMap.get(secName)!.push(s);
      }

      // Sort sections vertically by minimum coordinate_y
      const sortedSections = Array.from(sectionMap.entries())
        .map(([secName, seats]) => {
          const minY = Math.min(...seats.map((s: any) => Number(s.coordinate_y ?? 0)));
          return { secName, seats, minY };
        })
        .sort((a, b) => a.minY - b.minY);

      const rows: GridRow[] = [];

      sortedSections.forEach((sec, secIdx) => {
        const price = getTierPrice(sec.secName, secIdx);

        // Group seats in section by row_label
        const rowMap = new Map<string, any[]>();
        for (const s of sec.seats) {
          const r = String(s.row_label || "A").trim();
          if (!rowMap.has(r)) rowMap.set(r, []);
          rowMap.get(r)!.push(s);
        }

        // Sort rows within section by average coordinate_y (or alphabetical row_label)
        const sortedRows = Array.from(rowMap.entries())
          .map(([rowLabel, seats]) => {
            const avgY =
              seats.reduce((sum: number, s: any) => sum + Number(s.coordinate_y ?? 0), 0) /
              (seats.length || 1);
            // Sort seats left-to-right by coordinate_x
            seats.sort((a: any, b: any) => Number(a.coordinate_x ?? 0) - Number(b.coordinate_x ?? 0));
            return { rowLabel, seats, avgY };
          })
          .sort((a, b) => a.avgY - b.avgY);

        for (const rowObj of sortedRows) {
          const rowSeats = rowObj.seats;

          // Detect typical step between consecutive seats in this row to identify physical aisle gaps
          const steps: number[] = [];
          for (let i = 0; i < rowSeats.length - 1; i++) {
            const diff = Number(rowSeats[i + 1].coordinate_x ?? 0) - Number(rowSeats[i].coordinate_x ?? 0);
            if (diff > 5) steps.push(diff);
          }
          const normalStep = steps.length > 0 ? Math.min(...steps) : 40;

          const gridSeats: GridSeat[] = rowSeats.map((seat: any, seatIdx: number) => {
            const seatNum =
              seat.seat_label != null && String(seat.seat_label).trim() !== ""
                ? String(seat.seat_label).trim()
                : String(seatIdx + 1);
            const labelId = `${rowObj.rowLabel}${seatNum}`;
            const isDupe = rawSeats.filter((o: any) =>
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
              seat.status &&
              !["AVAILABLE", "ACTIVE"].includes(String(seat.status).toUpperCase());

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

      if (rows.length > 0) {
        return rows;
      }
    }

    // 2. Legacy fallback if approved layout template has structured sections/rows
    const customTemplate =
      layoutData.layout_template?.seating_config ||
      (layoutData.layout_template as any)?.data;

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
          (t) => ((t as any).tier_name || (t as any).name || "").toLowerCase() === tierName.toLowerCase()
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

          rows.push({
            rowLabel,
            tierName,
            price,
            seats,
          });
        }
      }
      return rows;
    }

    // 3. Fallback: Standard cinema layout from tier pricing
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

        rows.push({
          rowLabel,
          tierName,
          price,
          seats,
        });
      }
    }

    return rows;
  }, [layoutData, showtime, bookedSet]);

  // Handle seat selection toggle (Max 10 seats per booking)
  const handleSeatClick = (seat: GridSeat) => {
    if (seat.isBooked) return;

    const exists = selectedSeats.some((s) => s.seat_identifier === seat.id);
    if (exists) {
      setSelectedSeats((prev) => prev.filter((s) => s.seat_identifier !== seat.id));
    } else {
      if (selectedSeats.length >= 10) {
        toast.warning("You can select a maximum of 10 seats per booking.");
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
    }
  };

  // Pricing calculations
  const ticketSubtotal = useMemo(() => {
    return selectedSeats.reduce((sum, s) => sum + (Number(s.unit_price) || 0), 0);
  }, [selectedSeats]);

  const convenienceFee = useMemo(() => {
    return selectedSeats.length > 0 ? selectedSeats.length * 15 : 0;
  }, [selectedSeats]);

  const grandTotal = useMemo(() => {
    const total = ticketSubtotal + convenienceFee - discountAmount;
    return Math.max(0, total);
  }, [ticketSubtotal, convenienceFee, discountAmount]);

  // Apply Promo Code
  const handleApplyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) {
      toast.error("Please enter a promo code.");
      return;
    }

    if (code === "WELCOME10" || code === "MOVIE10") {
      const discount = Math.round(ticketSubtotal * 0.1);
      setDiscountAmount(discount);
      setPromoApplied(true);
      toast.success(`Promo code ${code} applied! Saved ${discount} ETB.`);
    } else if (code === "FLAT50") {
      setDiscountAmount(50);
      setPromoApplied(true);
      toast.success(`Promo code ${code} applied! Saved 50 ETB.`);
    } else {
      toast.error("Invalid or expired promo code.");
    }
  };

  const handleRemovePromo = () => {
    setPromoCode("");
    setPromoApplied(false);
    setDiscountAmount(0);
    toast.info("Promo code removed.");
  };

  // Submit Booking Form
  const onConfirmBooking = async (values: MovieCheckoutFormValues) => {
    if (selectedSeats.length === 0) {
      toast.error("Please select at least one seat to proceed.");
      return;
    }

    try {
      const res = await createBooking({
        showtime_id: showtimeId,
        seats: selectedSeats,
        guest_name: values.guest_name.trim(),
        guest_phone: sanitizePhoneInput(values.guest_phone),
        guest_email: (values.guest_email || "").trim() || undefined,
        promo_code: promoApplied ? promoCode.trim() : undefined,
        payment_method: "CASH",
      }).unwrap();

      toast.success(res.message || "Booking confirmed!");
      router.push(`/movies/booking-confirmation/${res.data.booking_id}`);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to confirm booking. Please try again."));
      refetch();
    }
  };

  // Format Show Date / Time
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="size-10 animate-spin text-[#F84464]" />
        <p className="text-sm font-medium text-slate-300">Loading cinema seat layout…</p>
      </div>
    );
  }

  if (isError || !layoutData) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertCircle className="size-12 text-rose-400" />
        <h2 className="text-xl font-bold">Showtime Layout Unavailable</h2>
        <p className="text-sm text-slate-400 max-w-md">
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
    <div className="min-h-screen bg-[#0d0f18] text-white flex flex-col">
      {/* Top Showtime Info Header Bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/90 backdrop-blur-md px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors cursor-pointer"
              title="Go Back"
            >
              <ArrowLeft className="size-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-extrabold text-white leading-tight">
                  {movie?.title}
                </h1>
                {movie?.certificate && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white border border-white/20">
                    {movie.certificate}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/25">
                  {showtime?.format || "2D"} • {showtime?.language || "English"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="text-slate-300 font-semibold">{cinema?.name}</span>
                <span>•</span>
                <span className="text-slate-300 font-medium">{screen?.name}</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-slate-300">
                  <Calendar className="size-3 text-[#F84464]" /> {showDateFormatted}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-slate-300">
                  <Clock className="size-3 text-[#F84464]" /> {showTimeFormatted}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
              <Armchair className="size-4 text-[#F84464]" />
              <span className="text-slate-400">Selected:</span>
              <strong className="text-white text-sm font-bold">
                {selectedSeats.length} {selectedSeats.length === 1 ? "Seat" : "Seats"}
              </strong>
            </div>
          </div>
        </div>
      </header>

      {/* Main Seat Layout & Booking Content */}
      <main className="max-w-7xl mx-auto flex-1 w-full px-4 sm:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Interactive Seat Grid / Canvas & Screen */}
        <section className="lg:col-span-8 space-y-6">
          {/* Layout Mode & Control Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white/5 border border-white/10 p-2.5 rounded-2xl">
            {hasCanvasLayout ? (
              <div className="flex items-center gap-1.5 p-1 bg-slate-900/80 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setViewMode("canvas")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === "canvas"
                      ? "bg-gradient-to-r from-[#F84464] to-[#6900AA] text-white shadow-md shadow-[#F84464]/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <MapIcon className="size-3.5" />
                  <span>Interactive Map</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/20 text-white font-extrabold uppercase">
                    Live
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === "grid"
                      ? "bg-gradient-to-r from-[#F84464] to-[#6900AA] text-white shadow-md shadow-[#F84464]/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <LayoutGrid className="size-3.5" />
                  <span>Grid View</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-2 text-xs font-bold text-slate-300">
                <LayoutGrid className="size-4 text-[#F84464]" />
                <span>Cinema Seating Layout</span>
              </div>
            )}

            {/* Quick action buttons (Fullscreen toggle) */}
            {hasCanvasLayout && viewMode === "canvas" && (
              <button
                type="button"
                onClick={() => setIsMapFullscreen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-semibold transition-all cursor-pointer shadow-sm hover:scale-105"
                title="Open fullscreen interactive map"
              >
                <Maximize2 className="size-3.5 text-rose-400" />
                <span>Fullscreen</span>
              </button>
            )}
          </div>

          {/* Interactive Live Canvas View */}
          {viewMode === "canvas" && hasCanvasLayout && canvasLayoutData ? (
            <div className="relative rounded-3xl border border-white/10 bg-slate-950 overflow-hidden shadow-2xl h-[620px] sm:h-[680px]">
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
                maxSelectable={10}
                cinemaMode={true}
                customLegend={cinemaLegend}
              />
            </div>
          ) : (
            <>
              {/* Seat Status Legend */}
              <div className="flex flex-wrap items-center justify-center gap-6 py-2.5 px-4 rounded-2xl bg-white/5 border border-white/10 text-xs">
                <div className="flex items-center gap-2">
                  <div className="size-4 rounded-md bg-white/10 border border-white/25" />
                  <span className="text-slate-300">Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-4 rounded-md bg-gradient-to-r from-[#F84464] to-[#6900AA] border border-[#F84464] shadow shadow-[#F84464]/50" />
                  <span className="text-white font-bold">Selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-4 rounded-md bg-slate-800 border border-slate-700 opacity-60 relative">
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500">✕</span>
                  </div>
                  <span className="text-slate-500">Sold / Reserved</span>
                </div>
              </div>

              {/* Seat Grid Layout Container */}
              <div className="rounded-3xl border border-white/10 bg-slate-950/60 backdrop-blur-md p-6 sm:p-8 overflow-x-auto space-y-8 shadow-2xl">
                {/* Cinema Screen Indicator at Top (when screen is at top) */}
                {screenPosition === "top" && (
                  <div className="pb-8 pt-2 text-center space-y-3">
                    <p className="text-xs uppercase tracking-widest font-extrabold text-slate-400 flex items-center justify-center gap-2">
                      <Tv className="size-3.5 text-[#F84464]" /> All eyes this way please • Screen
                    </p>
                    <div className="relative mx-auto w-4/5 max-w-lg h-3">
                      <div className="absolute inset-0 rounded-[50%] border-b-4 border-[#F84464] shadow-[0_8px_20px_rgba(248,68,100,0.4)]" />
                    </div>
                  </div>
                )}

                {gridRows.map((rowGroup, idx) => {
                  const prevRow = gridRows[idx - 1];
                  const isNewTier = !prevRow || prevRow.tierName !== rowGroup.tierName;

                  return (
                    <div key={`row-${idx}-${rowGroup.tierName}-${rowGroup.rowLabel}`} className="space-y-2.5 min-w-[560px]">
                      {/* Tier Divider Banner */}
                      {isNewTier && (
                        <div className="flex items-center justify-between border-b border-white/10 pb-2 pt-3 text-xs">
                          <span className="font-extrabold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-fuchsia-400 to-purple-400">
                            {rowGroup.tierName} TIER
                          </span>
                          <span className="text-white font-extrabold bg-white/10 px-2.5 py-0.5 rounded-full">
                            {rowGroup.price} ETB
                          </span>
                        </div>
                      )}

                      {/* Row of Seats */}
                      <div className="flex items-center justify-center gap-3">
                        {/* Row Label (Left) */}
                        <span className="w-5 text-center text-xs font-bold text-slate-400 shrink-0">
                          {rowGroup.rowLabel}
                        </span>

                        {/* Seat Buttons with Aisle Separation */}
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          {rowGroup.seats.map((seat, seatIdx) => {
                            const isSelected = selectedSeats.some((s) => s.seat_identifier === seat.id);
                            const isAisleGap = seat.isAisleGap ?? (seatIdx === 3 || seatIdx === 9);

                            return (
                              <div key={`${idx}-${rowGroup.tierName}-${seat.id}-${seatIdx}`} className="flex items-center">
                                <button
                                  type="button"
                                  disabled={seat.isBooked}
                                  onClick={() => handleSeatClick(seat)}
                                  className={`size-7 sm:size-8 rounded-lg text-[11px] font-bold transition-all duration-150 flex items-center justify-center select-none ${
                                    seat.isBooked
                                      ? "bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed"
                                      : isSelected
                                      ? "bg-gradient-to-r from-[#F84464] to-[#6900AA] text-white border border-white/40 shadow-lg shadow-[#F84464]/40 scale-110 z-10"
                                      : "bg-white/5 border border-white/15 text-slate-300 hover:bg-white/15 hover:border-white/35 hover:scale-105 cursor-pointer"
                                  }`}
                                  title={`${rowGroup.tierName} • ${seat.id} (${seat.price} ETB)`}
                                >
                                  {seat.number}
                                </button>

                                {/* Cinema Aisle Gap */}
                                {isAisleGap && (
                                  <div className="w-3 sm:w-5" aria-hidden="true" />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Row Label (Right) */}
                        <span className="w-5 text-center text-xs font-bold text-slate-400 shrink-0">
                          {rowGroup.rowLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Cinema Screen Curved Indicator at the Bottom (when screen is at bottom) */}
                {screenPosition === "bottom" && (
                  <div className="pt-10 pb-2 text-center space-y-3">
                    <div className="relative mx-auto w-4/5 max-w-lg h-3">
                      <div className="absolute inset-0 rounded-[50%] border-t-4 border-[#F84464] shadow-[0_-8px_20px_rgba(248,68,100,0.4)]" />
                    </div>
                    <p className="text-xs uppercase tracking-widest font-extrabold text-slate-400 flex items-center justify-center gap-2">
                      <Tv className="size-3.5 text-[#F84464]" /> All eyes this way please • Screen
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* Right Column: Checkout Summary & Guest Details Drawer */}
        <aside className="lg:col-span-4 space-y-6">
          <form
            onSubmit={handleSubmit(onConfirmBooking)}
            className="rounded-3xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-6 space-y-6 shadow-2xl sticky top-24"
            noValidate
          >
            {/* Booking Header */}
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Ticket className="size-5 text-[#F84464]" /> Booking Summary
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedSeats.length > 0
                  ? `${selectedSeats.length} seats reserved for this order`
                  : "Pick your seats from the map to proceed"}
              </p>
            </div>

            {/* Selected Seats Pills */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Selected Seats
              </span>
              {selectedSeats.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">
                  No seats selected yet. Click on the available seats in the map.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedSeats.map((seat) => (
                    <span
                      key={seat.seat_identifier}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-rose-500/20 to-purple-500/20 border border-rose-500/40 text-xs font-bold text-white shadow-sm"
                    >
                      <Armchair className="size-3 text-rose-400" />
                      {seat.seat_identifier}
                      <span className="text-rose-300 font-normal">({seat.unit_price} ETB)</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Promo Code Input */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="size-3.5 text-purple-400" /> Promo / Discount Code
              </label>
              {promoApplied ? (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400" />
                    <span className="font-bold text-white font-mono">{promoCode}</span>
                    <span className="text-emerald-400">(-{discountAmount} ETB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemovePromo}
                    className="text-xs text-rose-400 hover:underline font-semibold"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="e.g. WELCOME10"
                    className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white uppercase placeholder:text-slate-500 focus:outline-none focus:border-[#F84464]"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white border border-white/15 transition-colors cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>

            {/* Guest Contact Details */}
            <div className="space-y-3 pt-2 border-t border-white/10">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <User className="size-3.5 text-[#F84464]" /> Contact Information
              </span>

              <div className="space-y-2.5">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                    Full Name {reqStar}
                  </label>
                  <input
                    type="text"
                    {...register("guest_name")}
                    placeholder="Full Name"
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#F84464]"
                  />
                  {errors.guest_name && (
                    <p className={fieldErrorClass}>{errors.guest_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-400">
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
                        variant="dark"
                        inputClassName="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#F84464]"
                        placeholder="Phone Number (e.g. 912345678)"
                        error={errors.guest_phone?.message}
                      />
                    )}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                    Email Address
                  </label>
                  <input
                    type="email"
                    {...register("guest_email")}
                    placeholder="Email Address (for ticket receipt)"
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#F84464]"
                  />
                  {errors.guest_email && (
                    <p className={fieldErrorClass}>{errors.guest_email.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="space-y-2 pt-2 border-t border-white/10 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Tickets Subtotal ({selectedSeats.length}):</span>
                <span className="text-white font-semibold">{ticketSubtotal} ETB</span>
              </div>
              {convenienceFee > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Convenience Fee:</span>
                  <span className="text-white font-semibold">+{convenienceFee} ETB</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Promo Discount:</span>
                  <span className="font-bold">-{discountAmount} ETB</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-white/10 text-sm font-extrabold">
                <span className="text-white">Total Amount Payable:</span>
                <span className="text-lg text-transparent bg-clip-text bg-gradient-to-r from-[#F84464] to-rose-300">
                  {grandTotal} ETB
                </span>
              </div>
            </div>

            {/* Checkout Submit Button */}
            <button
              type="submit"
              disabled={selectedSeats.length === 0 || isBooking}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#F84464] to-[#6900AA] hover:opacity-90 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-sm shadow-xl shadow-[#F84464]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isBooking ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Reserving Your Seats…
                </>
              ) : (
                <>
                  Confirm &amp; Book Tickets <ChevronRight className="size-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck className="size-3.5 text-emerald-400" />
              <span>Safe &amp; Instant Digital M-Ticket</span>
            </div>
          </form>
        </aside>
      </main>

      {/* Fullscreen Interactive Canvas Modal */}
      {isMapFullscreen && hasCanvasLayout && canvasLayoutData && (
        <div className="fixed inset-0 z-50 bg-slate-950/98 backdrop-blur-2xl flex flex-col p-3 sm:p-6 animate-in fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[#F84464]">
                <Film className="size-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  {movie?.title}
                  <span className="text-xs font-normal text-slate-400">
                    ({cinema?.name} • {screen?.name})
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Select your preferred seats on the interactive layout (Pinch / Scroll to zoom)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsMapFullscreen(false)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold transition-all cursor-pointer"
            >
              <Minimize2 className="size-4" />
              <span>Close Fullscreen</span>
            </button>
          </div>

          {/* Canvas in Fullscreen */}
          <div className="flex-1 w-full relative overflow-hidden rounded-2xl my-3 border border-white/10 bg-slate-950">
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
              maxSelectable={10}
              cinemaMode={true}
              customLegend={cinemaLegend}
            />
          </div>

          {/* Bottom Bar in Fullscreen */}
          <div className="flex items-center justify-between pt-3 border-t border-white/10 bg-slate-950/80 px-2 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Armchair className="size-4 text-[#F84464]" />
              <span className="text-xs text-slate-400">Selected:</span>
              <strong className="text-sm font-bold text-white">
                {selectedSeats.length} {selectedSeats.length === 1 ? "seat" : "seats"}
              </strong>
              {selectedSeats.length > 0 && (
                <span className="text-xs font-bold text-rose-400">
                  ({grandTotal} ETB)
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsMapFullscreen(false)}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-[#F84464] to-[#6900AA] text-white text-xs font-bold shadow-lg shadow-[#F84464]/30 hover:scale-105 transition-all cursor-pointer"
            >
              Done Picking Seats
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
