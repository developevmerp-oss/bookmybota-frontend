"use client";

import { useEffect, useMemo, useState } from "react";
import ClassicSeatMap from "@/components/venue/ClassicSeatMap";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Ban,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Globe,
  Info,
  Lock,
  Plug,
  RefreshCw,
  Store,
  Tag,
  Ticket,
  Wrench,
  X,
} from "lucide-react";
import { useAppSelector } from "@/lib/hooks";
import {
  useCreateCounterBookingMutation,
  useGetPartnerMovieShowtimesQuery,
  useGetShowChannelSummaryQuery,
  useGetShowSeatMapQuery,
  useUpdateShowSeatOverridesMutation,
  type CounterBookingResult,
  type ShowSeatMapSeat,
  type ShowSeatState,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { formatTime12h, venueDateStr } from "@/lib/dateFormat";
import { getApiBaseUrl } from "@/lib/apiBaseUrl";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import LayoutSeatPreview from "@/components/venue/LayoutSeatPreview";

const STATE_META: Record<ShowSeatState, { label: string; cls: string }> = {
  AVAILABLE: {
    label: "Available",
    cls: "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/40",
  },
  BOOKED: {
    label: "Sold",
    cls: "bg-slate-300 text-slate-600 border-slate-400 dark:bg-zinc-700 dark:text-zinc-300 dark:border-zinc-600",
  },
  HELD: {
    label: "Held by customer",
    cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/40",
  },
  BLOCKED: {
    label: "Blocked (this show)",
    cls: "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-500/40",
  },
  OUT_OF_ORDER: {
    label: "Out of order",
    cls: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-500/20 dark:text-orange-200 dark:border-orange-500/40",
  },
  SCREEN_BLOCKED: {
    label: "Blocked on screen layout",
    cls: "bg-slate-200 text-slate-500 border-slate-300 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700",
  },
};

const CHANNEL_LABEL: Record<string, string> = {
  ONLINE: "Website & app",
  COUNTER: "Box office (counter)",
};

const BUSY_FILL: Partial<Record<ShowSeatState, string>> = {
  BOOKED: "#94a3b8",
  HELD: "#f59e0b",
  BLOCKED: "#fb7185",
  OUT_OF_ORDER: "#fb923c",
  SCREEN_BLOCKED: "#475569",
};

function hasPlacedLayout(seats: ShowSeatMapSeat[]): boolean {
  if (seats.length < 2) return false;
  const xs = new Set(seats.map((s) => Math.round(s.x)));
  const ys = new Set(seats.map((s) => Math.round(s.y)));
  return xs.size > 1 || ys.size > 1;
}

function money(n: number) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Short label on the seat: the number the customer sees (A11 -> 11), even when a row repeats 1-10 on both sides of an aisle */
function seatLabel(s: ShowSeatMapSeat) {
  const prefix = s.row.toLowerCase();
  const id = s.identifier.toLowerCase();
  if (id.startsWith(prefix)) {
    const rest = id.slice(prefix.length);
    if (/^\d+$/.test(rest)) return String(Number(rest));
  }
  return s.number;
}

function shiftDate(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

interface SeatRow {
  label: string;
  seats: Array<ShowSeatMapSeat & { gapBefore: boolean }>;
}
interface SeatSection {
  name: string;
  rows: SeatRow[];
}

function buildSections(seats: ShowSeatMapSeat[]): SeatSection[] {
  const bySection = new Map<string, ShowSeatMapSeat[]>();
  for (const s of seats) {
    if (!bySection.has(s.section)) bySection.set(s.section, []);
    bySection.get(s.section)!.push(s);
  }
  return Array.from(bySection.entries())
    .map(([name, list]) => {
      const byRow = new Map<string, ShowSeatMapSeat[]>();
      for (const s of list) {
        if (!byRow.has(s.row)) byRow.set(s.row, []);
        byRow.get(s.row)!.push(s);
      }
      const rows = Array.from(byRow.entries())
        .map(([label, rs]) => {
          rs.sort((a, b) => a.x - b.x);
          const steps: number[] = [];
          for (let i = 0; i < rs.length - 1; i++) {
            const diff = rs[i + 1].x - rs[i].x;
            if (diff > 5) steps.push(diff);
          }
          const normal = steps.length ? Math.min(...steps) : 40;
          return {
            label,
            avgY: rs.reduce((sum, s) => sum + s.y, 0) / (rs.length || 1),
            seats: rs.map((s, i) => ({
              ...s,
              gapBefore: i > 0 && s.x - rs[i - 1].x > normal * 1.6,
            })),
          };
        })
        .sort((a, b) => a.avgY - b.avgY);
      return { name, minY: Math.min(...rows.map((r) => r.avgY)), rows };
    })
    .sort((a, b) => a.minY - b.minY);
}

export default function MovieSeatManagerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAppSelector((state) => state.auth.user);
  const bizId = user?.business_id ?? "";

  const todayStr = venueDateStr();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [showId, setShowId] = useState<string>(searchParams.get("show") || "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inspectKey, setInspectKey] = useState<string | null>(null);
  const [priceOpen, setPriceOpen] = useState(false);
  const [counterOpen, setCounterOpen] = useState(false);
  const [receipt, setReceipt] = useState<CounterBookingResult | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    data: showtimes = [],
    isLoading: showsLoading,
    refetch: refetchShows,
  } = useGetPartnerMovieShowtimesQuery(
    { bizId, date: selectedDate },
    { skip: !bizId }
  );

  const activeShows = useMemo(
    () =>
      [...showtimes]
        .filter((s) => s.is_active && s.status !== "CANCELLED")
        .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at))),
    [showtimes]
  );

  // Pick the first show of the day when nothing (or a show from another day) is selected
  useEffect(() => {
    if (activeShows.length === 0) return;
    if (!activeShows.some((s) => s.id === showId)) setShowId(activeShows[0].id);
  }, [activeShows, showId]);

  useEffect(() => {
    setSelected(new Set());
    setInspectKey(null);
  }, [showId]);

  const {
    data: map,
    isFetching: mapLoading,
    isError: mapFailed,
    error: mapError,
    refetch: refetchMap,
  } = useGetShowSeatMapQuery({ bizId, showtimeId: showId }, { skip: !bizId || !showId, pollingInterval: 15000 });
  const { data: channels = [] } = useGetShowChannelSummaryQuery(
    { bizId, showtimeId: showId },
    { skip: !bizId || !showId }
  );

  const [saveOverrides, { isLoading: saving }] = useUpdateShowSeatOverridesMutation();
  const [counterBook, { isLoading: booking }] = useCreateCounterBookingMutation();

  const sections = useMemo(() => buildSections(map?.seats ?? []), [map?.seats]);
  const placedLayout = hasPlacedLayout(map?.seats ?? []);
  const previewSeats = useMemo(
    () =>
      (map?.seats ?? []).map((s) => ({
        key: s.key,
        coordinate_x: s.x,
        coordinate_y: s.y,
        color: s.color,
        section_name: s.section,
        row_label: s.row,
        seat_label: s.number,
        status: "AVAILABLE",
      })),
    [map?.seats]
  );
  const seatByKey = useMemo(() => new Map((map?.seats ?? []).map((s) => [s.key, s])), [map?.seats]);
  const selectedSeats = useMemo(
    () => Array.from(selected).map((k) => seatByKey.get(k)).filter(Boolean) as ShowSeatMapSeat[],
    [selected, seatByKey]
  );
  const showEnded = map?.showtime.status === "COMPLETED";

  // Drop selections that changed state (e.g. sold online while selected)
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      prev.forEach((k) => {
        const s = seatByKey.get(k);
        if (s && s.state !== "BOOKED" && s.state !== "SCREEN_BLOCKED") next.add(k);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [seatByKey]);

  const selectable = (s: ShowSeatMapSeat) => s.state !== "BOOKED" && s.state !== "SCREEN_BLOCKED";

  const toggleSeat = (s: ShowSeatMapSeat) => {
    if (s.state === "BOOKED") {
      setInspectKey(s.key);
      return;
    }
    if (!selectable(s)) return;
    setInspectKey(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(s.key)) next.delete(s.key);
      else next.add(s.key);
      return next;
    });
  };

  const selectGroup = (seats: ShowSeatMapSeat[]) => {
    const keys = seats.filter(selectable).map((s) => s.key);
    if (keys.length === 0) return;
    setSelected((prev) => {
      const next = new Set(prev);
      const all = keys.every((k) => next.has(k));
      keys.forEach((k) => (all ? next.delete(k) : next.add(k)));
      return next;
    });
  };

  const applyStatus = async (status: "AVAILABLE" | "BLOCKED" | "OUT_OF_ORDER") => {
    if (selected.size === 0) return;
    try {
      const res = await saveOverrides({
        bizId,
        showtimeId: showId,
        seats: Array.from(selected).map((seat_key) => ({ seat_key, status })),
      }).unwrap();
      const { applied, skipped } = res.data;
      if (applied > 0) toast.success(res.message || "Seats updated");
      if (skipped.length > 0) toast.error(skipped[0].reason + (skipped.length > 1 ? ` (+${skipped.length - 1} more)` : ""));
      setSelected(new Set());
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update seats"));
    }
  };

  const copyFeed = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy. Select the URL and copy it manually.");
    }
  };

  const feedUrl = showId ? `${getApiBaseUrl()}/movies/showtimes/${showId}/layout` : "";
  const selectedTotal = selectedSeats.reduce((sum, s) => sum + s.price, 0);
  const hasUnsellable = selectedSeats.some((s) => s.state === "BLOCKED" || s.state === "OUT_OF_ORDER");
  const hasHeld = selectedSeats.some((s) => s.state === "HELD");
  const inspected = inspectKey ? seatByKey.get(inspectKey) : null;

  if (!bizId) return <AdminListShimmer rows={4} columns={3} />;

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Seat Manager</h1>
          <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1 max-w-2xl">
            Run a show from one screen: sell tickets at the counter, block seats, mark broken seats out of order and
            change seat prices — even while booking is open. Changes apply to this show only and reach the website,
            the app and partner apps straight away.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary text-sm inline-flex items-center gap-2"
          onClick={() => {
            refetchShows();
            if (showId) refetchMap();
          }}
        >
          <RefreshCw size={14} className={mapLoading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Date + show picker */}
      <div className="glass-panel rounded-2xl border border-white/10 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays size={16} className="text-rose-500" />
          <button type="button" className="btn-secondary px-2 py-1" onClick={() => setSelectedDate(shiftDate(selectedDate, -1))} aria-label="Previous day">
            <ChevronLeft size={16} />
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm text-slate-900 dark:text-white"
          />
          <button type="button" className="btn-secondary px-2 py-1" onClick={() => setSelectedDate(shiftDate(selectedDate, 1))} aria-label="Next day">
            <ChevronRight size={16} />
          </button>
          {selectedDate !== todayStr && (
            <button type="button" className="text-xs font-semibold text-rose-600 hover:underline" onClick={() => setSelectedDate(todayStr)}>
              Today
            </button>
          )}
        </div>
        {showsLoading ? (
          <p className="text-sm text-slate-500">Loading shows…</p>
        ) : activeShows.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            No shows on this date. Pick another day or{" "}
            <button type="button" className="text-rose-600 font-semibold hover:underline" onClick={() => router.push("/movie/showtimes")}>
              schedule a show
            </button>
            .
          </p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {activeShows.map((s) => {
              const active = s.id === showId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setShowId(s.id)}
                  className={`shrink-0 text-left rounded-xl border px-3 py-2 transition-colors ${
                    active
                      ? "border-rose-500 bg-rose-50 dark:bg-rose-500/10"
                      : "border-slate-200 dark:border-white/10 hover:border-rose-300"
                  }`}
                >
                  <div className="text-sm font-bold text-slate-900 dark:text-white">{formatTime12h(s.starts_at)}</div>
                  <div className="text-xs text-slate-600 dark:text-zinc-300 max-w-[11rem] truncate">{s.movie_title}</div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                    {s.screen_name} · {s.format}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showId && !map && mapLoading && (
        <p className="text-sm text-slate-500 dark:text-zinc-400">Loading the seat layout…</p>
      )}
      {showId && !map && mapFailed && (
        <p className="text-sm text-rose-600">
          {extractApiError(mapError, "The seat layout could not be loaded. Refresh and try again.")}
        </p>
      )}

      {map && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Available", value: map.counts.available, tone: "text-emerald-600" },
              { label: "Sold", value: map.counts.booked, tone: "text-slate-900 dark:text-white" },
              { label: "Held online", value: map.counts.held, tone: "text-amber-600" },
              { label: "Blocked", value: map.counts.blocked + map.counts.screen_blocked, tone: "text-rose-600" },
              { label: "Out of order", value: map.counts.out_of_order, tone: "text-orange-600" },
              { label: "Ticket revenue", value: money(map.revenue), tone: "text-slate-900 dark:text-white" },
            ].map((c) => (
              <div key={c.label} className="glass-panel rounded-xl border border-white/10 p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-zinc-400 font-semibold">{c.label}</div>
                <div className={`text-2xl font-black ${c.tone}`}>{c.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_20rem] gap-5 items-start">
            {/* Seat map */}
            <div className="glass-panel rounded-2xl border border-white/10 p-4 sm:p-5 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{map.showtime.movie_title}</div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400">
                    {map.showtime.screen_name} · {map.showtime.format} · {map.showtime.language} · {formatTime12h(map.showtime.starts_at)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary text-xs" onClick={() => selectGroup(map.seats)}>
                    Select all free
                  </button>
                  <button type="button" className="btn-secondary text-xs" disabled={selected.size === 0} onClick={() => setSelected(new Set())}>
                    Clear
                  </button>
                </div>
              </div>

              {!placedLayout && (
                <div className="mb-5">
                  <div className="mx-auto h-2 w-3/5 rounded-b-full bg-gradient-to-b from-slate-400 to-slate-200 dark:from-zinc-500 dark:to-zinc-800" />
                  <div className="text-center text-[11px] tracking-[0.3em] text-slate-400 mt-1">SCREEN THIS WAY</div>
                </div>
              )}

              {map.seats.length === 0 ? (
                <p className="text-sm text-slate-500 py-10 text-center">
                  This screen has no approved seat layout yet. Open <b>Screens &amp; Layouts</b> to submit and approve one.
                </p>
              ) : placedLayout ? (
                <div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {sections.map((sec) => {
                      const secSeats = sec.rows.flatMap((r) => r.seats);
                      const price = secSeats[0]?.base_price ?? 0;
                      return (
                        <button
                          key={sec.name}
                          type="button"
                          onClick={() => selectGroup(secSeats)}
                          className="rounded-full border border-slate-200 dark:border-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-zinc-300 hover:border-rose-400 hover:text-rose-600"
                          title="Select / unselect this section"
                        >
                          {sec.name} · {money(price)} ETB
                        </button>
                      );
                    })}
                  </div>
                  <ClassicSeatMap
                    seats={previewSeats}
                    heightClass="h-[min(68vh,560px)]"
                    seatMarker={(raw) => {
                      const key = String((raw as { key?: string }).key || "");
                      const live = seatByKey.get(key);
                      if (!live) return null;
                      const isSel = selected.has(live.key);
                      const busy = BUSY_FILL[live.state];
                      return {
                        fill: isSel ? "#e11d48" : busy || "",
                        stroke: isSel ? "#9f1239" : "#ffffff",
                        strokeWidth: isSel ? 3 : undefined,
                        cursor: live.state === "SCREEN_BLOCKED" ? "not-allowed" : "pointer",
                        title: `${live.row}${live.number || ""} · ${STATE_META[live.state].label} · ${money(live.price)} ETB`,
                        onClick: live.state === "SCREEN_BLOCKED" ? undefined : () => toggleSeat(live),
                      };
                    }}
                  />
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400">
                    Tap a seat to select it, or tap a section to select every free seat in it.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-max mx-auto space-y-6">
                    {sections.map((sec) => {
                      const secSeats = sec.rows.flatMap((r) => r.seats);
                      const price = secSeats[0]?.base_price ?? 0;
                      return (
                        <div key={sec.name}>
                          <button
                            type="button"
                            onClick={() => selectGroup(secSeats)}
                            className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400 hover:text-rose-600"
                            title="Select / unselect the whole section"
                          >
                            {sec.name} · {money(price)} ETB
                          </button>
                          <div className="space-y-1.5">
                            {sec.rows.map((row) => (
                              <div key={row.label} className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => selectGroup(row.seats)}
                                  className="w-6 text-xs font-bold text-slate-500 dark:text-zinc-400 hover:text-rose-600 text-center"
                                  title={`Select row ${row.label}`}
                                >
                                  {row.label}
                                </button>
                                {row.seats.map((s) => {
                                  const isSel = selected.has(s.key);
                                  const meta = STATE_META[s.state];
                                  return (
                                    <span key={s.key} className={`flex ${s.gapBefore ? "ml-5" : ""}`}>
                                      <button
                                        type="button"
                                        onClick={() => toggleSeat(s)}
                                        disabled={s.state === "SCREEN_BLOCKED"}
                                        title={`${s.identifier} · ${meta.label} · ${money(s.price)} ETB${s.price_overridden ? " (custom price)" : ""}${s.note ? ` · ${s.note}` : ""}`}
                                        className={`relative h-8 min-w-[2rem] px-1 rounded-md border text-[11px] font-semibold transition-all ${meta.cls} ${
                                          isSel ? "ring-2 ring-rose-500 ring-offset-1 scale-105 !bg-rose-500 !text-white !border-rose-600" : ""
                                        } ${s.state === "SCREEN_BLOCKED" ? "cursor-not-allowed" : ""}`}
                                      >
                                        {seatLabel(s)}
                                        {s.price_overridden && s.state === "AVAILABLE" && !isSel && (
                                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-violet-500" />
                                        )}
                                        {s.state === "OUT_OF_ORDER" && <Wrench size={9} className="absolute -top-1 -right-1" />}
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-600 dark:text-zinc-400">
                {(Object.keys(STATE_META) as ShowSeatState[]).map((k) => (
                  <span key={k} className="inline-flex items-center gap-1.5">
                    <span className={`inline-block h-3.5 w-3.5 rounded border ${STATE_META[k].cls.split(" hover:")[0]}`} />
                    {STATE_META[k].label}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-violet-500" /> Custom price
                </span>
              </div>
            </div>

            {/* Side panel */}
            <div className="space-y-4">
              {inspected && inspected.booking && (
                <div className="glass-panel rounded-2xl border border-white/10 p-4 text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold text-slate-900 dark:text-white">Seat {inspected.identifier} · sold</div>
                    <button type="button" onClick={() => setInspectKey(null)} aria-label="Close">
                      <X size={14} />
                    </button>
                  </div>
                  <dl className="space-y-1 text-slate-600 dark:text-zinc-300">
                    <div className="flex justify-between"><dt>Booking</dt><dd className="font-mono text-xs">{inspected.booking.booking_code}</dd></div>
                    <div className="flex justify-between"><dt>Guest</dt><dd>{inspected.booking.guest_name || "—"}</dd></div>
                    <div className="flex justify-between"><dt>Sold via</dt><dd>{CHANNEL_LABEL[inspected.booking.channel] || inspected.booking.channel}</dd></div>
                    <div className="flex justify-between"><dt>Paid</dt><dd>{money(inspected.booking.paid)} ETB</dd></div>
                  </dl>
                  <p className="text-[11px] text-slate-500 mt-2 flex gap-1"><Lock size={11} className="mt-0.5 shrink-0" /> Sold seats are locked. Cancel or refund the booking from Bookings to free the seat.</p>
                </div>
              )}

              <div className="glass-panel rounded-2xl border border-white/10 p-4">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                  <Ticket size={16} className="text-rose-500" /> Sold by channel
                </div>
                {channels.length === 0 ? (
                  <p className="text-xs text-slate-500">No tickets sold for this show yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {channels.map((c) => (
                      <li key={c.channel} className="flex items-center justify-between text-sm">
                        <span className="inline-flex items-center gap-2 text-slate-700 dark:text-zinc-200">
                          {c.channel === "COUNTER" ? <Store size={14} /> : <Globe size={14} />}
                          {CHANNEL_LABEL[c.channel] || c.channel}
                        </span>
                        <span className="text-right">
                          <b>{c.seats}</b> <span className="text-xs text-slate-500">seats · {money(c.amount)} ETB</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="glass-panel rounded-2xl border border-white/10 p-4">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
                  <Plug size={16} className="text-rose-500" /> Partner &amp; app connection
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mb-3">
                  BookMyBota, your own app or any ticketing partner read this one live seat feed, so a seat sold or
                  blocked here disappears everywhere at once. Sold seats, holds, blocks, out-of-order seats and custom
                  prices are all included.
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={feedUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-zinc-900 px-2 py-1.5 text-[11px] font-mono text-slate-700 dark:text-zinc-200"
                  />
                  <button type="button" className="btn-secondary px-2" onClick={copyFeed} aria-label="Copy feed URL">
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 flex gap-1">
                  <Info size={11} className="mt-0.5 shrink-0" />
                  Public read-only feed. Booking and holds from partner apps use the same seat rules.
                </p>
              </div>
            </div>
          </div>

          {/* Action bar */}
          <div className="sticky bottom-3 z-30 pointer-events-none">
            <div className="pointer-events-auto mx-auto rounded-2xl border border-slate-200 dark:border-white/15 bg-white/95 dark:bg-zinc-900/95 backdrop-blur shadow-2xl px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="mr-auto text-sm">
                {selected.size === 0 ? (
                  <span className="text-slate-500 dark:text-zinc-400">Tap seats to select them, or tap a row letter or section title.</span>
                ) : (
                  <span className="text-slate-900 dark:text-white">
                    <b>{selected.size}</b> seat{selected.size === 1 ? "" : "s"} selected ·{" "}
                    <b>{money(selectedTotal)} ETB</b>
                    <span className="text-xs text-slate-500 ml-2">
                      {selectedSeats.slice(0, 6).map((s) => s.identifier).join(", ")}
                      {selectedSeats.length > 6 ? ` +${selectedSeats.length - 6}` : ""}
                    </span>
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={selected.size === 0 || hasUnsellable || showEnded}
                onClick={() => setCounterOpen(true)}
                className="btn-primary text-sm inline-flex items-center gap-1.5 disabled:opacity-40"
                title={hasUnsellable ? "Unblock the blocked seats first" : "Sell the selected seats at the counter"}
              >
                <Store size={14} /> Sell at counter
              </button>
              <button type="button" disabled={selected.size === 0 || saving} onClick={() => setPriceOpen(true)} className="btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-40">
                <Tag size={14} /> Set price
              </button>
              <button type="button" disabled={selected.size === 0 || saving} onClick={() => applyStatus("BLOCKED")} className="btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-40">
                <Ban size={14} /> Block
              </button>
              <button type="button" disabled={selected.size === 0 || saving} onClick={() => applyStatus("OUT_OF_ORDER")} className="btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-40">
                <Wrench size={14} /> Out of order
              </button>
              <button type="button" disabled={selected.size === 0 || saving} onClick={() => applyStatus("AVAILABLE")} className="btn-secondary text-sm disabled:opacity-40">
                Make available
              </button>
              {hasHeld && selected.size > 0 && (
                <span className="basis-full text-[11px] text-amber-600">
                  Some selected seats are held by an online customer right now. Blocking them lets the customer finish only if they already paid.
                </span>
              )}
            </div>
          </div>
        </>
      )}

      {priceOpen && (
        <PriceModal
          seats={selectedSeats}
          saving={saving}
          onClose={() => setPriceOpen(false)}
          onApply={async (price) => {
            try {
              const res = await saveOverrides({
                bizId,
                showtimeId: showId,
                seats: selectedSeats.map((s) => ({ seat_key: s.key, price })),
              }).unwrap();
              const { applied, skipped } = res.data;
              if (applied > 0) toast.success(price === null ? "Reset to tier price" : "Seat price updated");
              if (skipped.length > 0) toast.error(skipped[0].reason + (skipped.length > 1 ? ` (+${skipped.length - 1} more)` : ""));
              setPriceOpen(false);
              setSelected(new Set());
            } catch (err) {
              toast.error(extractApiError(err, "Failed to update price"));
            }
          }}
        />
      )}

      {counterOpen && (
        <CounterModal
          seats={selectedSeats}
          total={selectedTotal}
          saving={booking}
          onClose={() => setCounterOpen(false)}
          onConfirm={async (form) => {
            try {
              const res = await counterBook({
                bizId,
                showtimeId: showId,
                seat_keys: selectedSeats.map((s) => s.key),
                ...form,
              }).unwrap();
              setCounterOpen(false);
              setSelected(new Set());
              setReceipt(res.data);
              toast.success(res.message || "Tickets booked");
            } catch (err) {
              toast.error(extractApiError(err, "Counter booking failed"));
              refetchMap();
            }
          }}
        />
      )}

      {receipt && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 p-6 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Check size={24} />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Tickets booked</h3>
            <p className="text-sm text-slate-600 dark:text-zinc-300 mt-1">
              {receipt.seats.map((s) => s.identifier).join(", ")} · <b>{money(receipt.total)} ETB</b>
            </p>
            <p className="mt-3 font-mono text-sm text-slate-900 dark:text-white">{receipt.booking_code}</p>
            <p className="text-xs text-slate-500 mt-1">Guest can show this code at the gate. Find it under Bookings.</p>
            <div className="mt-5 flex gap-2 justify-center">
              <button type="button" className="btn-secondary text-sm" onClick={() => router.push("/movie/bookings")}>
                View bookings
              </button>
              <button type="button" className="btn-primary text-sm" onClick={() => setReceipt(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-slate-900">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-slate-900 dark:text-white";

function PriceModal({
  seats,
  saving,
  onClose,
  onApply,
}: {
  seats: ShowSeatMapSeat[];
  saving: boolean;
  onClose: () => void;
  onApply: (price: number | null) => Promise<void>;
}) {
  const [value, setValue] = useState(seats.length === 1 ? String(seats[0].price) : "");
  const num = Number(value);
  const valid = Number.isFinite(num) && num > 0;
  const sold = seats.filter((s) => s.state === "BOOKED").length;
  return (
    <ModalShell title={`Set price · ${seats.length} seat${seats.length === 1 ? "" : "s"}`} onClose={onClose}>
      <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300">New price per seat (ETB)</label>
      <input autoFocus type="number" min={1} step="0.01" value={value} onChange={(e) => setValue(e.target.value)} className={`${inputCls} mt-1`} placeholder="e.g. 450" />
      <p className="text-[11px] text-slate-500 mt-2">
        Sets the price for this seat type on this show. Every seat of that type uses the new price, on the website, the app and at the counter. Tickets already sold keep the price they were sold at.
        {sold > 0 ? ` ${sold} sold seat(s) will be skipped.` : ""}
      </p>
      <div className="mt-5 flex justify-between gap-2">
        <button type="button" className="btn-secondary text-sm" disabled={saving} onClick={() => onApply(null)}>
          Reset to tier price
        </button>
        <button type="button" className="btn-primary text-sm disabled:opacity-40" disabled={!valid || saving} onClick={() => onApply(num)}>
          {saving ? "Saving…" : "Apply price"}
        </button>
      </div>
    </ModalShell>
  );
}

function CounterModal({
  seats,
  total,
  saving,
  onClose,
  onConfirm,
}: {
  seats: ShowSeatMapSeat[];
  total: number;
  saving: boolean;
  onClose: () => void;
  onConfirm: (form: { guest_name?: string; guest_phone?: string; payment_method: "CASH" | "CARD" | "MOBILE_MONEY" }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"CASH" | "CARD" | "MOBILE_MONEY">("CASH");
  return (
    <ModalShell title="Sell at counter" onClose={onClose}>
      <ul className="max-h-40 overflow-auto rounded-lg border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5 mb-3">
        {seats.map((s) => (
          <li key={s.key} className="flex justify-between px-3 py-1.5 text-sm text-slate-700 dark:text-zinc-200">
            <span>
              {s.identifier} <span className="text-xs text-slate-500">· {s.section}</span>
            </span>
            <span>{money(s.price)} ETB</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-between text-base font-black text-slate-900 dark:text-white mb-4">
        <span>Total to collect</span>
        <span>{money(total)} ETB</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Guest name (optional)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} mt-1`} placeholder="Walk-in" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Phone (optional)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={`${inputCls} mt-1`} inputMode="tel" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {(["CASH", "CARD", "MOBILE_MONEY"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold ${
              method === m ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200" : "border-slate-300 dark:border-white/15 text-slate-600 dark:text-zinc-300"
            }`}
          >
            {m === "MOBILE_MONEY" ? "Mobile money" : m === "CASH" ? "Cash" : "Card"}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-500 mt-3">
        Counter sales are collected by your cinema, so no platform commission or convenience fee is charged and nothing is added to settlements.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-secondary text-sm" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary text-sm disabled:opacity-40"
          disabled={saving}
          onClick={() => onConfirm({ guest_name: name.trim() || undefined, guest_phone: phone.trim() || undefined, payment_method: method })}
        >
          {saving ? "Booking…" : `Confirm · ${money(total)} ETB`}
        </button>
      </div>
    </ModalShell>
  );
}
