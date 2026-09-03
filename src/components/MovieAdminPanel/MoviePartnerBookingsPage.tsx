"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Film,
  Filter,
  Loader2,
  MapPin,
  Phone,
  QrCode,
  Search,
  Tag,
  Ticket,
  Tv,
  User,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useAppSelector } from "@/lib/hooks";
import {
  useGetPartnerMovieBookingsQuery,
  useUpdatePartnerMovieBookingStatusMutation,
  useGetCinemaScreensQuery,
  useGetPartnerMovieCatalogQuery,
  type MovieBookingDetail,
} from "@/services/api";
import SearchInput from "@/components/Shared/SearchInput";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import { resolveMediaUrl } from "@/lib/mediaUrl";

export default function MoviePartnerBookingsPage() {
  const user = useAppSelector((state) => state.auth.user);
  const bizId = user?.business_id || (user as any)?.business?.id || "";

  const [q, setQ] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [screenFilter, setScreenFilter] = useState("");
  const [movieFilter, setMovieFilter] = useState("");

  const { data: screens = [] } = useGetCinemaScreensQuery(bizId, { skip: !bizId });
  const { data: catalogData } = useGetPartnerMovieCatalogQuery({ page: 1, limit: 100 });
  const catalogMovies = catalogData?.items ?? [];

  const {
    data: bookingsResponse,
    isLoading,
    isFetching,
  } = useGetPartnerMovieBookingsQuery(
    {
      bizId,
      ...(q.trim() ? { q: q.trim() } : {}),
      ...(dateFilter ? { date: dateFilter } : {}),
      ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
      ...(screenFilter ? { screen_id: screenFilter } : {}),
      ...(movieFilter ? { movie_id: movieFilter } : {}),
    },
    { skip: !bizId }
  );

  const [updateStatus, { isLoading: updatingStatus }] = useUpdatePartnerMovieBookingStatusMutation();

  const [actionTarget, setActionTarget] = useState<{
    booking: MovieBookingDetail;
    newStatus: string;
  } | null>(null);

  const bookings = bookingsResponse?.data ?? [];
  const stats = bookingsResponse?.stats ?? {
    total_bookings: 0,
    total_tickets_sold: 0,
    total_revenue: 0,
  };

  const handleStatusChange = async (booking: MovieBookingDetail, newStatus: string) => {
    try {
      await updateStatus({
        bizId,
        id: booking.id,
        status: newStatus,
      }).unwrap();

      toast.success(
        newStatus === "USED"
          ? `Booking ${booking.booking_code} checked-in successfully!`
          : `Booking status updated to ${newStatus}`
      );
      setActionTarget(null);
    } catch (err: any) {
      toast.error(err?.data?.error || "Failed to update booking status.");
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const parts = isoString.split(" ");
      const timePart = parts[1] || parts[0];
      const [hStr, mStr] = timePart.split(":");
      let h = parseInt(hStr, 10);
      const m = mStr || "00";
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h.toString().padStart(2, "0")}:${m} ${ampm}`;
    } catch {
      return isoString;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Ticket size={24} className="text-fuchsia-400" />
          Movie Ticket Bookings
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Monitor customer ticket sales, reserved seats, and gate check-ins across your cinema screens.
        </p>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel rounded-2xl border border-white/10 p-5 space-y-1">
          <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Total Bookings</p>
          <p className="text-3xl font-extrabold text-white">{stats.total_bookings}</p>
          <p className="text-xs text-zinc-500">Orders placed for your cinema</p>
        </div>

        <div className="glass-panel rounded-2xl border border-fuchsia-500/20 p-5 space-y-1">
          <p className="text-xs text-fuchsia-400 font-semibold uppercase tracking-wider">Tickets Sold</p>
          <p className="text-3xl font-extrabold text-fuchsia-300">{stats.total_tickets_sold}</p>
          <p className="text-xs text-zinc-500">Seats reserved across all shows</p>
        </div>

        <div className="glass-panel rounded-2xl border border-rose-500/20 p-5 space-y-1">
          <p className="text-xs text-rose-400 font-semibold uppercase tracking-wider">Ticket Revenue</p>
          <p className="text-3xl font-extrabold text-rose-300">{stats.total_revenue} ETB</p>
          <p className="text-xs text-zinc-500">Gross customer ticket earnings</p>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="glass-panel rounded-2xl border border-white/10 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[240px]">
            <SearchInput
              value={q}
              onChange={setQ}
              placeholder="Search by customer name, phone, email, or booking ref…"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white focus:outline-none focus:border-fuchsia-500"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-zinc-900 border border-white/15 text-xs text-white focus:outline-none focus:border-fuchsia-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="USED">Used / Checked-In</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <select
              value={screenFilter}
              onChange={(e) => setScreenFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-zinc-900 border border-white/15 text-xs text-white focus:outline-none focus:border-fuchsia-500"
            >
              <option value="">All Screens</option>
              {screens.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              value={movieFilter}
              onChange={(e) => setMovieFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-zinc-900 border border-white/15 text-xs text-white focus:outline-none focus:border-fuchsia-500"
            >
              <option value="">All Movies</option>
              {catalogMovies.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>

            {(q || dateFilter || statusFilter !== "ALL" || screenFilter || movieFilter) && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setDateFilter("");
                  setStatusFilter("ALL");
                  setScreenFilter("");
                  setMovieFilter("");
                }}
                className="text-xs text-rose-400 hover:underline px-2"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bookings List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-zinc-400 gap-2">
          <Loader2 className="animate-spin" size={24} />
          Loading bookings…
        </div>
      ) : bookings.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-white/10 p-12 text-center text-zinc-500 space-y-2">
          <Ticket size={40} className="mx-auto text-zinc-600" />
          <p className="text-base font-bold text-white">No movie bookings found</p>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Bookings made by customers on your showtimes will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="glass-panel rounded-2xl border border-white/10 p-5 hover:border-white/20 transition-colors space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-white/5">
                <div className="flex items-center gap-3">
                  {booking.movie_poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveMediaUrl(booking.movie_poster)}
                      alt={booking.movie_title}
                      className="size-14 rounded-xl object-cover bg-zinc-800 shrink-0"
                    />
                  ) : (
                    <div className="size-14 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                      <Film size={22} />
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-fuchsia-400 bg-fuchsia-500/10 px-2 py-0.5 rounded-md border border-fuchsia-500/20">
                        {booking.booking_code}
                      </span>
                      <h3 className="text-base font-bold text-white">{booking.movie_title}</h3>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400 flex-wrap">
                      <span className="text-zinc-300 font-semibold">{booking.screen_name}</span>
                      <span>•</span>
                      <span className="text-rose-400 font-semibold">{booking.showtime_format}</span>
                      <span>•</span>
                      <span>{booking.showtime_language}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-zinc-300">
                        <Calendar size={12} className="text-fuchsia-400" />
                        {booking.showtime_starts_at ? String(booking.showtime_starts_at).slice(0, 10) : ""}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-zinc-300">
                        <Clock size={12} className="text-fuchsia-400" />
                        {formatTime(booking.showtime_starts_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      booking.status === "CONFIRMED"
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : booking.status === "USED"
                        ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                        : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {booking.status === "USED" ? "Checked-In" : booking.status}
                  </span>
                </div>
              </div>

              {/* Booking Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-zinc-400">
                {/* Customer */}
                <div className="space-y-1">
                  <span className="text-zinc-500 font-semibold uppercase tracking-wider">Customer</span>
                  <p className="text-sm font-bold text-white flex items-center gap-1.5">
                    <User size={14} className="text-fuchsia-400" />
                    {booking.guest_name}
                  </p>
                  <p className="flex items-center gap-1.5 text-zinc-300">
                    <Phone size={13} className="text-zinc-500" />
                    {booking.guest_phone}
                  </p>
                </div>

                {/* Reserved Seats */}
                <div className="space-y-1">
                  <span className="text-zinc-500 font-semibold uppercase tracking-wider">
                    Reserved Seats ({booking.ticket_qty} Tickets)
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {booking.seats?.map((s) => (
                      <span
                        key={s.seat_identifier}
                        className="px-2 py-0.5 rounded-md bg-white/10 text-white font-mono text-[11px] font-bold"
                      >
                        {s.seat_identifier} {s.tier_name ? `(${s.tier_name})` : ""}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Payment Breakdown & Actions */}
                <div className="space-y-1 sm:text-right">
                  <span className="text-zinc-500 font-semibold uppercase tracking-wider">Total Amount</span>
                  <p className="text-base font-extrabold text-white">{booking.grand_total} ETB</p>
                  <p className="text-[11px] text-zinc-500">
                    Paid via {booking.payment_method || "CASH"}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              {booking.status === "CONFIRMED" && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() =>
                      setActionTarget({
                        booking,
                        newStatus: "USED",
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 text-white text-xs font-bold transition-opacity cursor-pointer"
                  >
                    <CheckCircle2 size={13} />
                    Check-in at Gate
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setActionTarget({
                        booking,
                        newStatus: "CANCELLED",
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
                  >
                    <XCircle size={13} />
                    Cancel Booking
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Dialog for Status Updates */}
      <ConfirmDialog
        open={Boolean(actionTarget)}
        title={
          actionTarget?.newStatus === "USED"
            ? "Confirm Gate Check-In"
            : "Confirm Booking Cancellation"
        }
        body={
          actionTarget?.newStatus === "USED"
            ? `Mark booking ${actionTarget?.booking.booking_code} for ${actionTarget?.booking.guest_name} as Checked-in / Used?`
            : `Are you sure you want to cancel booking ${actionTarget?.booking.booking_code}? The reserved seats will be released.`
        }
        confirmLabel={
          actionTarget?.newStatus === "USED" ? "Confirm Check-In" : "Cancel Booking"
        }
        variant={actionTarget?.newStatus === "USED" ? "success" : "danger"}
        onConfirm={() => {
          if (actionTarget) {
            handleStatusChange(actionTarget.booking, actionTarget.newStatus);
          }
        }}
        onCancel={() => setActionTarget(null)}
      />
    </div>
  );
}
