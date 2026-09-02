"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetMovieShowtimeLayoutQuery,
  useCreateMovieBookingMutation,
  type MovieBookingSeatPayload,
} from "@/services/api";
import { useAppSelector } from "@/lib/hooks";

interface MovieSeatLayoutPageProps {
  showtimeId: string;
}

interface GridSeat {
  id: string;
  row: string;
  number: number;
  tierName: string;
  price: number;
  isBooked: boolean;
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
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Pre-fill user profile if logged in
  useEffect(() => {
    if (authUser) {
      if (authUser.name && !guestName) setGuestName(authUser.name);
      if (authUser.phone && !guestPhone) setGuestPhone(authUser.phone);
      if (authUser.email && !guestEmail) setGuestEmail(authUser.email);
    }
  }, [authUser]);

  const showtime = layoutData?.showtime;
  const movie = layoutData?.movie;
  const cinema = layoutData?.cinema;
  const screen = layoutData?.screen;
  const bookedSet = useMemo(() => new Set(layoutData?.booked_seat_identifiers ?? []), [layoutData]);

  // Generate structured cinema seat layout
  const gridRows = useMemo<GridRow[]>(() => {
    if (!layoutData) return [];

    const customTemplate =
      layoutData.layout_template?.seating_config ||
      layoutData.layout_template?.seats_json ||
      (layoutData.layout_template as any)?.data;

    // 1. If approved layout template has structured sections/rows
    if (
      customTemplate?.sections &&
      Array.isArray(customTemplate.sections) &&
      customTemplate.sections.length > 0
    ) {
      const rows: GridRow[] = [];
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
            const seatId = `${rowLabel}${i}`;
            seats.push({
              id: seatId,
              row: rowLabel,
              number: i,
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
    }

    // 2. Standard cinema layout from tier pricing
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
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedSeats.length === 0) {
      toast.error("Please select at least one seat to proceed.");
      return;
    }

    if (!guestName.trim()) {
      toast.error("Please enter your full name.");
      return;
    }

    if (!guestPhone.trim() || guestPhone.trim().length < 6) {
      toast.error("Please enter a valid contact phone number.");
      return;
    }

    try {
      const res = await createBooking({
        showtime_id: showtimeId,
        seats: selectedSeats,
        guest_name: guestName.trim(),
        guest_phone: guestPhone.trim(),
        guest_email: guestEmail.trim() || undefined,
        promo_code: promoApplied ? promoCode.trim() : undefined,
        payment_method: "CASH",
      }).unwrap();

      toast.success(res.message || "Booking confirmed!");
      router.push(`/movies/booking-confirmation/${res.data.booking_id}`);
    } catch (err: any) {
      console.error("Booking error:", err);
      const errMsg = err?.data?.error || err?.message || "Failed to confirm booking. Please try again.";
      toast.error(errMsg);
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
        {/* Left Column: Interactive Seat Grid & Screen */}
        <section className="lg:col-span-8 space-y-6">
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
            {gridRows.map((rowGroup, idx) => {
              const prevRow = gridRows[idx - 1];
              const isNewTier = !prevRow || prevRow.tierName !== rowGroup.tierName;

              return (
                <div key={`${rowGroup.tierName}-${rowGroup.rowLabel}`} className="space-y-2.5 min-w-[560px]">
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
                        const isAisleGap = seatIdx === 3 || seatIdx === 9;

                        return (
                          <div key={seat.id} className="flex items-center">
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

            {/* Cinema Screen Curved Indicator at the Bottom */}
            <div className="pt-10 pb-2 text-center space-y-3">
              <div className="relative mx-auto w-4/5 max-w-lg h-3">
                <div className="absolute inset-0 rounded-[50%] border-t-4 border-[#F84464] shadow-[0_-8px_20px_rgba(248,68,100,0.4)]" />
              </div>
              <p className="text-xs uppercase tracking-widest font-extrabold text-slate-400 flex items-center justify-center gap-2">
                <Tv className="size-3.5 text-[#F84464]" /> All eyes this way please • Screen
              </p>
            </div>
          </div>
        </section>

        {/* Right Column: Checkout Summary & Guest Details Drawer */}
        <aside className="lg:col-span-4 space-y-6">
          <form
            onSubmit={handleConfirmBooking}
            className="rounded-3xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-6 space-y-6 shadow-2xl sticky top-24"
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
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Full Name *"
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#F84464]"
                  />
                </div>

                <div>
                  <input
                    type="tel"
                    required
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="Phone Number (e.g. +251 91 234 5678) *"
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#F84464]"
                  />
                </div>

                <div>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="Email Address (for ticket receipt)"
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#F84464]"
                  />
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
    </div>
  );
}
