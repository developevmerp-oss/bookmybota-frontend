"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  Ban,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Edit2,
  FileSignature,
  Film,
  Globe,
  Info,
  Lock,
  Monitor,
  Plug,
  Plus,
  RefreshCw,
  Store,
  Tag,
  Ticket,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { useAppSelector } from "@/lib/hooks";
import {
  useCreateCounterBookingMutation,
  useDeletePartnerMovieShowtimeMutation,
  useGetCinemaContractQuery,
  useGetCinemaScreensQuery,
  useGetPartnerMovieCatalogQuery,
  useGetPartnerMovieShowtimesQuery,
  useGetShowChannelSummaryQuery,
  useGetShowSeatMapQuery,
  useUpdatePartnerMovieShowtimeMutation,
  useUpdateShowSeatOverridesMutation,
  type CounterBookingResult,
  type MovieShowtime,
  type ShowSeatMapSeat,
  type ShowSeatState,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { isVenueWallTimeReached, venueDateStr } from "@/lib/dateFormat";
import { getApiBaseUrl } from "@/lib/apiBaseUrl";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import LayoutSeatPreview from "@/components/venue/LayoutSeatPreview";
import ShowtimeFormModal, { type ShowtimeFormRequest } from "./ShowtimeFormModal";
import {
  conflictingShowtimeIds,
  displayScreenName,
  formatDateHeader,
  formatTime,
  shiftYmd,
  sortedTierPricing,
  toYmdLocal,
} from "./showtimeHelpers";

const STATE_META: Record<ShowSeatState, { label: string; cls: string }> = {
  AVAILABLE: {
    label: "Available",
    cls: "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100",
  },
  BOOKED: { label: "Sold", cls: "bg-slate-300 text-slate-600 border-slate-400" },
  HELD: { label: "Held by customer", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  BLOCKED: { label: "Blocked (this show)", cls: "bg-rose-100 text-rose-700 border-rose-300" },
  OUT_OF_ORDER: { label: "Out of order", cls: "bg-orange-100 text-orange-800 border-orange-300" },
  SCREEN_BLOCKED: { label: "Blocked on screen layout", cls: "bg-slate-200 text-slate-500 border-slate-300" },
};

const BUSY_FILL: Partial<Record<ShowSeatState, string>> = {
  BOOKED: "#94a3b8",
  HELD: "#f59e0b",
  BLOCKED: "#fb7185",
  OUT_OF_ORDER: "#fb923c",
  SCREEN_BLOCKED: "#475569",
};

const CHANNEL_LABEL: Record<string, string> = {
  ONLINE: "Website & app",
  COUNTER: "Box office (counter)",
  PARTNER: "Partner apps",
};

const card = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-500/20";
const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#e11d48] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#be123c] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";
const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";

function money(n: number) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** The number the customer sees on the seat (A11 -> 11), even when a row repeats 1-10 on both sides of an aisle */
function seatLabel(s: ShowSeatMapSeat) {
  const prefix = s.row.toLowerCase();
  const id = s.identifier.toLowerCase();
  if (id.startsWith(prefix)) {
    const rest = id.slice(prefix.length);
    if (/^\d+$/.test(rest)) return String(Number(rest));
  }
  return s.number;
}

function hasPlacedLayout(seats: ShowSeatMapSeat[]): boolean {
  if (seats.length < 2) return false;
  const xs = new Set(seats.map((s) => Math.round(s.x)));
  const ys = new Set(seats.map((s) => Math.round(s.y)));
  return xs.size > 1 || ys.size > 1;
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
            seats: rs.map((s, i) => ({ ...s, gapBefore: i > 0 && s.x - rs[i - 1].x > normal * 1.6 })),
          };
        })
        .sort((a, b) => a.avgY - b.avgY);
      return { name, minY: Math.min(...rows.map((r) => r.avgY)), rows };
    })
    .sort((a, b) => a.minY - b.minY);
}

export default function MovieShowsSeatsPage() {
  const searchParams = useSearchParams();
  const user = useAppSelector((state) => state.auth.user);
  const bizId = user?.business_id || (user as { business?: { id?: string } })?.business?.id || "";

  const todayStr = useMemo(() => venueDateStr() || toYmdLocal(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(searchParams.get("date") || todayStr);
  const [screenFilter, setScreenFilter] = useState<string>("");
  const [showId, setShowId] = useState<string>(searchParams.get("show") || "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inspectKey, setInspectKey] = useState<string | null>(null);
  const [counterOpen, setCounterOpen] = useState(false);
  const [receipt, setReceipt] = useState<CounterBookingResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [formRequest, setFormRequest] = useState<ShowtimeFormRequest | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MovieShowtime | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<{ action: "enable" | "disable"; showtime: MovieShowtime } | null>(null);
  const [urlMovieHandled, setUrlMovieHandled] = useState(false);
  const formRequestSeq = useRef(0);

  const { data: contract, isLoading: loadingContract } = useGetCinemaContractQuery();
  const isContractActive = contract?.status === "ACTIVE";
  const { data: screens = [] } = useGetCinemaScreensQuery(bizId, { skip: !bizId });
  const { data: catalogData } = useGetPartnerMovieCatalogQuery({ page: 1, limit: 100 });
  const catalogMovies = useMemo(() => catalogData?.items ?? [], [catalogData]);
  const activeScreenId = screenFilter || screens[0]?.id || "";
  const activeScreen = screens.find((sc) => sc.id === activeScreenId) ?? null;

  const {
    data: showtimes = [],
    isLoading: showsLoading,
    isFetching: showsFetching,
    refetch: refetchShows,
  } = useGetPartnerMovieShowtimesQuery(
    { bizId, date: selectedDate, ...(activeScreenId ? { cinema_screen_id: activeScreenId } : {}) },
    { skip: !bizId }
  );

  const [updateShowtime, { isLoading: updating }] = useUpdatePartnerMovieShowtimeMutation();
  const [deleteShowtime, { isLoading: deleting }] = useDeletePartnerMovieShowtimeMutation();

  const sortedShows = useMemo(
    () => [...showtimes].sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at))),
    [showtimes]
  );
  const scheduleConflictIds = useMemo(() => conflictingShowtimeIds(showtimes), [showtimes]);
  const selectedShow = sortedShows.find((s) => s.id === showId) ?? null;
  // Seat tools only apply to shows customers can see
  const showLive = !!selectedShow && selectedShow.is_active && selectedShow.status !== "CANCELLED";

  // Pick the first show of the day when nothing (or a show from another day) is selected
  useEffect(() => {
    if (sortedShows.length === 0) {
      if (showId) setShowId("");
      return;
    }
    if (!sortedShows.some((s) => s.id === showId)) setShowId(sortedShows[0].id);
  }, [sortedShows, showId]);

  useEffect(() => {
    setSelected(new Set());
    setInspectKey(null);
  }, [showId]);

  // "Schedule show" links from the Movies page arrive with ?movie_id=
  useEffect(() => {
    const movieId = searchParams.get("movie_id");
    if (!movieId || urlMovieHandled || screens.length === 0 || catalogMovies.length === 0) return;
    setUrlMovieHandled(true);
    setFormRequest({ key: ++formRequestSeq.current, showtime: null, movieId });
  }, [searchParams, urlMovieHandled, screens.length, catalogMovies.length]);

  const mapSkip = !bizId || !showId || !showLive;
  const {
    data: map,
    isFetching: mapLoading,
    isError: mapFailed,
    error: mapError,
    refetch: refetchMap,
  } = useGetShowSeatMapQuery({ bizId, showtimeId: showId }, { skip: mapSkip, pollingInterval: 15000 });
  const { data: channels = [] } = useGetShowChannelSummaryQuery({ bizId, showtimeId: showId }, { skip: mapSkip });

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

  const feedUrl = showId ? `${getApiBaseUrl()}/movies/showtimes/${showId}/layout` : "";
  const copyFeed = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy. Select the URL and copy it manually.");
    }
  };

  const openCreate = () => {
    if (!isContractActive) {
      toast.error("Active contract required. Please review and sign your cinema agreement under Contract first.");
      return;
    }
    setFormRequest({ key: ++formRequestSeq.current, showtime: null, screenId: activeScreenId || undefined });
  };
  const savePrices = async (showtime: MovieShowtime, tiers: Array<{ tier_name: string; price: number }>) => {
    try {
      const res = await updateShowtime({ bizId, showtimeId: showtime.id, body: { tier_pricing: tiers } }).unwrap();
      toast.success((res as { message?: string })?.message || "Prices updated for this show");
      if (!mapSkip) refetchMap();
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update prices"));
    }
  };
  const openEdit = (st: MovieShowtime) => setFormRequest({ key: ++formRequestSeq.current, showtime: st });

  const handleStatusConfirm = async () => {
    if (!statusConfirm) return;
    const { action, showtime } = statusConfirm;
    const nextActive = action === "enable";
    try {
      const res = await updateShowtime({ bizId, showtimeId: showtime.id, body: { is_active: nextActive } }).unwrap();
      toast.success((res as { message?: string })?.message || (nextActive ? "Showtime enabled" : "Showtime disabled"));
      setStatusConfirm(null);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update showtime status"));
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      const res = await deleteShowtime({ bizId, showtimeId: deleteTarget.id }).unwrap();
      toast.success((res as { message?: string })?.message || "Showtime removed successfully");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to delete showtime"));
    }
  };

  const selectedTotal = selectedSeats.reduce((sum, s) => sum + s.price, 0);
  const hasUnsellable = selectedSeats.some((s) => s.state === "BLOCKED" || s.state === "OUT_OF_ORDER");
  const hasHeld = selectedSeats.some((s) => s.state === "HELD");
  const inspected = inspectKey ? seatByKey.get(inspectKey) : null;
  const tiers = sortedTierPricing(selectedShow?.tier_pricing);

  if (!bizId) return <AdminListShimmer rows={4} columns={3} />;

  return (
    <div className="space-y-4 pb-4">
      {!loadingContract && !isContractActive && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs">
              <span className="font-bold text-slate-900 text-sm block">Cinema Platform Agreement Required</span>
              Your contract is{" "}
              <span className="font-semibold">
                {contract?.status === "PENDING_SIGNATURES"
                  ? "awaiting digital signatures"
                  : contract?.status === "REJECTED"
                    ? "rejected"
                    : "not yet created"}
              </span>
              . Both parties must sign before shows can be scheduled.
            </p>
          </div>
          <Link href="/movie/contract" className={`${btnPrimary} shrink-0`}>
            <FileSignature size={14} /> View &amp; sign agreement
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[25rem_minmax(0,1fr)] gap-4 lg:h-[calc(100vh-9rem)] lg:min-h-[34rem]">
        {/* ───────── Left: shows and seat tools ───────── */}
        <div className="space-y-4 lg:overflow-y-auto lg:pr-1 min-w-0">
          <div className={`${card} p-4 space-y-3`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 leading-tight">Shows &amp; Seats</h2>
                <p className="text-xs text-slate-500 mt-0.5">Schedule movies, set prices and run each show&apos;s seats.</p>
              </div>
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  refetchShows();
                  if (!mapSkip) refetchMap();
                }}
                aria-label="Refresh"
                title="Refresh"
              >
                <RefreshCw size={14} className={showsFetching || mapLoading ? "animate-spin" : ""} />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button type="button" className={`${btnSecondary} !px-2`} onClick={() => setSelectedDate((d) => shiftYmd(d, -1))} aria-label="Previous day">
                <ChevronLeft size={16} />
              </button>
              <label className="relative flex-1 inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 hover:border-slate-300 focus-within:border-rose-400 cursor-pointer">
                <Calendar size={15} className="shrink-0 text-[#e11d48] pointer-events-none" aria-hidden />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) && setSelectedDate(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 focus:outline-none cursor-pointer [color-scheme:light]"
                  aria-label="Show date"
                />
              </label>
              <button type="button" className={`${btnSecondary} !px-2`} onClick={() => setSelectedDate((d) => shiftYmd(d, 1))} aria-label="Next day">
                <ChevronRight size={16} />
              </button>
              {selectedDate !== todayStr && (
                <button type="button" className="text-xs font-bold text-[#e11d48] hover:underline px-1" onClick={() => setSelectedDate(todayStr)}>
                  Today
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <select
                value={activeScreenId}
                onChange={(e) => setScreenFilter(e.target.value)}
                className="h-9 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-400 cursor-pointer"
                aria-label="Filter by screen"
              >
                {screens.map((s) => (
                  <option key={s.id} value={s.id}>
                    {displayScreenName(s.name)} ({s.screen_type?.toUpperCase() || "STANDARD"})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={btnPrimary}
                onClick={openCreate}
                disabled={!isContractActive || screens.length === 0 || catalogMovies.length === 0}
                title={!isContractActive ? "Sign contract first" : "Schedule a new show"}
              >
                <Plus size={15} /> Schedule show
              </button>
            </div>
          </div>

          {/* Show list */}
          <div className={`${card} p-3`}>
            <div className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {formatDateHeader(selectedDate)} · {sortedShows.length} show{sortedShows.length === 1 ? "" : "s"}
            </div>
            {showsLoading ? (
              <p className="px-1 py-3 text-sm text-slate-500">Loading shows…</p>
            ) : sortedShows.length === 0 ? (
              <div className="px-2 py-6 text-center space-y-2">
                <Film size={28} className="mx-auto text-slate-300" />
                <p className="text-sm text-slate-600">No shows on this date.</p>
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={openCreate}
                  disabled={!isContractActive || screens.length === 0 || catalogMovies.length === 0}
                >
                  <Plus size={14} /> Schedule a show
                </button>
              </div>
            ) : (
              <ul className="space-y-2">
                {sortedShows.map((st) => {
                  const active = st.id === showId;
                  const conflict = scheduleConflictIds.has(st.id);
                  return (
                    <li key={st.id}>
                      <button
                        type="button"
                        onClick={() => setShowId(st.id)}
                        className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors cursor-pointer ${
                          active ? "border-rose-500 bg-rose-50" : "border-slate-200 hover:border-rose-300 bg-white"
                        } ${st.is_active ? "" : "opacity-60"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
                            <Clock size={13} className="text-[#e11d48]" />
                            {formatTime(st.starts_at)}
                            {st.ends_at ? <span className="text-xs font-medium text-slate-400">→ {formatTime(st.ends_at)}</span> : null}
                          </span>
                          <span className="flex gap-1">
                            {conflict && (
                              <span className="rounded border border-amber-400 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800" title="Another show overlaps on this screen">
                                Conflict
                              </span>
                            )}
                            {!st.is_active && (
                              <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">Disabled</span>
                            )}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-sm font-semibold text-slate-800">{st.movie_title}</div>
                        <div className="text-[11px] text-slate-500 inline-flex items-center gap-1.5">
                          <Monitor size={11} className="text-rose-500" />
                          {displayScreenName(st.screen_name)} · {st.format || "2D"} · {st.language || "—"}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Selected show: details and actions */}
          {selectedShow && (
            <div className={`${card} p-4 space-y-3`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-bold text-slate-900">{selectedShow.movie_title}</div>
                  <div className="text-xs text-slate-500">
                    {displayScreenName(selectedShow.screen_name)} · {formatTime(selectedShow.starts_at)}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button type="button" className={`${btnSecondary} !px-2`} onClick={() => openEdit(selectedShow)} title="Edit show and prices" aria-label="Edit show">
                    <Edit2 size={14} />
                  </button>
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={updating}
                    onClick={() =>
                      setStatusConfirm({ action: selectedShow.is_active ? "disable" : "enable", showtime: selectedShow })
                    }
                  >
                    {selectedShow.is_active ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-xl border border-rose-200 px-2 text-rose-600 hover:bg-rose-50 cursor-pointer"
                    onClick={() => setDeleteTarget(selectedShow)}
                    title="Remove show"
                    aria-label="Remove show"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <PriceEditor
                key={`${selectedShow.id}-${tiers.map((t) => `${t.tier_name}:${t.price}`).join("|")}`}
                tiers={tiers}
                locked={isVenueWallTimeReached(selectedShow.starts_at)}
                saving={updating}
                onSave={(next) => savePrices(selectedShow, next)}
              />

              {!showLive && (
                <p className="text-xs text-slate-500 rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                  This show is {selectedShow.status === "CANCELLED" ? "cancelled" : "disabled"}, so seats cannot be managed. Enable it to open the seat layout.
                </p>
              )}
            </div>
          )}

          {showLive && map && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Available", value: map.counts.available, tone: "text-emerald-600" },
                  { label: "Sold", value: map.counts.booked, tone: "text-slate-900" },
                  { label: "Held", value: map.counts.held, tone: "text-amber-600" },
                  { label: "Blocked", value: map.counts.blocked + map.counts.screen_blocked, tone: "text-rose-600" },
                  { label: "Out of order", value: map.counts.out_of_order, tone: "text-orange-600" },
                  { label: "Revenue", value: money(map.revenue), tone: "text-slate-900" },
                ].map((c) => (
                  <div key={c.label} className={`${card} px-3 py-2`}>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{c.label}</div>
                    <div className={`text-lg font-black leading-tight ${c.tone}`}>{c.value}</div>
                  </div>
                ))}
              </div>

              <div className={`${card} p-4 space-y-3`}>
                <div className="font-bold text-slate-900 text-sm">Seat actions</div>
                {selected.size === 0 ? (
                  <p className="text-xs text-slate-500">
                    Pick seats on the layout, or tap a row letter or section name. Then sell, block or mark them out of order.
                  </p>
                ) : (
                  <p className="text-sm text-slate-900">
                    <b>{selected.size}</b> seat{selected.size === 1 ? "" : "s"} · <b>{money(selectedTotal)} ETB</b>
                    <span className="block text-xs text-slate-500">
                      {selectedSeats.slice(0, 8).map((s) => s.identifier).join(", ")}
                      {selectedSeats.length > 8 ? ` +${selectedSeats.length - 8}` : ""}
                    </span>
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`${btnPrimary} col-span-2`}
                    disabled={selected.size === 0 || hasUnsellable || showEnded}
                    onClick={() => setCounterOpen(true)}
                    title={hasUnsellable ? "Unblock the blocked seats first" : "Sell the selected seats at the counter"}
                  >
                    <Store size={14} /> Sell at counter
                  </button>
                  <button type="button" className={btnSecondary} disabled={selected.size === 0 || saving || showEnded} onClick={() => applyStatus("BLOCKED")}>
                    <Ban size={14} /> Block
                  </button>
                  <button type="button" className={btnSecondary} disabled={selected.size === 0 || saving || showEnded} onClick={() => applyStatus("OUT_OF_ORDER")}>
                    <Wrench size={14} /> Out of order
                  </button>
                  <button type="button" className={btnSecondary} disabled={selected.size === 0 || saving || showEnded} onClick={() => applyStatus("AVAILABLE")}>
                    Make available
                  </button>
                  <button type="button" className={btnSecondary} disabled={selected.size === 0} onClick={() => setSelected(new Set())}>
                    Clear
                  </button>
                </div>
                {hasHeld && selected.size > 0 && (
                  <p className="text-[11px] text-amber-600">
                    Some selected seats are held by an online customer right now.
                  </p>
                )}
                <p className="text-[11px] text-slate-500">
                  Changes apply to this show only and reach the website, app and partner apps straight away.
                </p>
              </div>

              <div className={`${card} p-4`}>
                <div className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-3">
                  <Ticket size={15} className="text-[#e11d48]" /> Sold by channel
                </div>
                {channels.length === 0 ? (
                  <p className="text-xs text-slate-500">No tickets sold for this show yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {channels.map((c) => (
                      <li key={c.channel} className="flex items-center justify-between text-sm">
                        <span className="inline-flex items-center gap-2 text-slate-700">
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

              <div className={`${card} p-4`}>
                <div className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-2">
                  <Plug size={15} className="text-[#e11d48]" /> Partner &amp; app connection
                </div>
                <p className="text-xs text-slate-600 mb-3">
                  The website, your app and partner apps read this one live seat feed, so a seat sold or blocked here disappears everywhere at once.
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={feedUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[11px] font-mono text-slate-700"
                  />
                  <button type="button" className={`${btnSecondary} !px-2`} onClick={copyFeed} aria-label="Copy feed URL">
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 flex gap-1">
                  <Info size={11} className="mt-0.5 shrink-0" /> Public read-only feed.
                </p>
              </div>
            </>
          )}
        </div>

        {/* ───────── Right: layout ───────── */}
        <div className={`${card} p-4 sm:p-5 min-w-0 flex flex-col lg:overflow-hidden`}>
          {!selectedShow ? (
            activeScreen ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{displayScreenName(activeScreen.name)} layout</div>
                    <div className="text-xs text-slate-500">
                      {activeScreen.layout_name ? `${activeScreen.layout_name} · ` : ""}
                      {activeScreen.layout_seat_count || activeScreen.capacity || 0} seats · Schedule or pick a show on the left to manage its seats
                    </div>
                  </div>
                </div>
                {Array.isArray(activeScreen.layout_seats_json) && activeScreen.layout_seats_json.length > 0 ? (
                  <div className="min-h-0 flex-1">
                    <LayoutSeatPreview
                      seats={activeScreen.layout_seats_json}
                      config={activeScreen.layout_seating_config}
                      heightClass="h-[min(70vh,600px)]"
                      className="bg-white"
                    />
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center text-center py-16 text-slate-500">
                    <Monitor size={40} className="text-slate-300 mb-3" />
                    <p className="font-semibold text-slate-700">No live layout for this screen yet</p>
                    <p className="text-sm mt-1 max-w-xs">
                      Approve a layout under <b>Screens &amp; Layouts</b> to see it here.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-center py-16 text-slate-500">
                <Monitor size={40} className="text-slate-300 mb-3" />
                <p className="font-semibold text-slate-700">No screen yet</p>
                <p className="text-sm mt-1 max-w-xs">Add a screen under Screens &amp; Layouts first.</p>
              </div>
            )
          ) : !showLive ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center py-16 text-slate-500">
              <Lock size={32} className="text-slate-300 mb-3" />
              <p className="font-semibold text-slate-700">Layout hidden for this show</p>
              <p className="text-sm mt-1 max-w-xs">Enable the show to manage its seats.</p>
            </div>
          ) : !map && mapFailed ? (
            <p className="text-sm text-rose-600 py-10 text-center">
              {extractApiError(mapError, "The seat layout could not be loaded. Refresh and try again.")}
            </p>
          ) : !map ? (
            <p className="text-sm text-slate-500 py-10 text-center">Loading the seat layout…</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 truncate">{map.showtime.movie_title}</div>
                  <div className="text-xs text-slate-500">
                    {displayScreenName(map.showtime.screen_name)} · {map.showtime.format} · {map.showtime.language} · {formatTime(map.showtime.starts_at)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className={btnSecondary} onClick={() => selectGroup(map.seats)}>
                    Select all free
                  </button>
                  <button type="button" className={btnSecondary} disabled={selected.size === 0} onClick={() => setSelected(new Set())}>
                    Clear
                  </button>
                </div>
              </div>

              {inspected && inspected.booking && (
                <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="font-bold text-slate-900">Seat {inspected.identifier} · sold</div>
                    <button type="button" onClick={() => setInspectKey(null)} aria-label="Close" className="text-slate-500 hover:text-slate-900">
                      <X size={14} />
                    </button>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-slate-600 text-xs">
                    <div className="flex justify-between"><dt>Booking</dt><dd className="font-mono">{inspected.booking.booking_code}</dd></div>
                    <div className="flex justify-between"><dt>Guest</dt><dd>{inspected.booking.guest_name || "—"}</dd></div>
                    <div className="flex justify-between"><dt>Sold via</dt><dd>{CHANNEL_LABEL[inspected.booking.channel] || inspected.booking.channel}</dd></div>
                    <div className="flex justify-between"><dt>Paid</dt><dd>{money(inspected.booking.paid)} ETB</dd></div>
                  </dl>
                  <p className="text-[11px] text-slate-500 mt-2 flex gap-1">
                    <Lock size={11} className="mt-0.5 shrink-0" /> Sold seats are locked. Cancel the booking from Bookings to free the seat.
                  </p>
                </div>
              )}

              <div className="min-h-0 flex-1 lg:overflow-y-auto">
                {!placedLayout && (
                  <div className="mb-5">
                    <div className="mx-auto h-2 w-3/5 rounded-b-full bg-gradient-to-b from-slate-400 to-slate-200" />
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
                            className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600 hover:border-rose-400 hover:text-rose-600 cursor-pointer"
                            title="Select / unselect this section"
                          >
                            {sec.name} · {money(price)} ETB
                          </button>
                        );
                      })}
                    </div>
                    <LayoutSeatPreview
                      seats={previewSeats}
                      config={map.layout?.seating_config}
                      heightClass="h-[min(62vh,540px)]"
                      className="bg-white"
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
                              className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-rose-600 cursor-pointer"
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
                                    className="w-6 text-xs font-bold text-slate-500 hover:text-rose-600 text-center cursor-pointer"
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
                                          title={`${s.identifier} · ${meta.label} · ${money(s.price)} ETB${s.note ? ` · ${s.note}` : ""}`}
                                          className={`relative h-8 min-w-[2rem] px-1 rounded-md border text-[11px] font-semibold transition-all cursor-pointer ${meta.cls} ${
                                            isSel ? "ring-2 ring-rose-500 ring-offset-1 scale-105 !bg-rose-500 !text-white !border-rose-600" : ""
                                          } ${s.state === "SCREEN_BLOCKED" ? "!cursor-not-allowed" : ""}`}
                                        >
                                          {seatLabel(s)}
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
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-600">
                {(Object.keys(STATE_META) as ShowSeatState[]).map((k) => (
                  <span key={k} className="inline-flex items-center gap-1.5">
                    <span className={`inline-block h-3.5 w-3.5 rounded border ${STATE_META[k].cls.split(" hover:")[0]}`} />
                    {STATE_META[k].label}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-3.5 w-3.5 rounded border bg-rose-500 border-rose-600" /> Selected
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <ShowtimeFormModal
        request={formRequest}
        bizId={bizId}
        selectedDate={selectedDate}
        screens={screens}
        catalogMovies={catalogMovies}
        showtimes={showtimes}
        onClose={() => setFormRequest(null)}
        onSaved={(st) => {
          if (st?.id) setShowId(st.id);
        }}
      />

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
          <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-6 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Check size={24} />
            </div>
            <h3 className="text-lg font-black text-slate-900">Tickets booked</h3>
            <p className="text-sm text-slate-600 mt-1">
              {receipt.seats.map((s) => s.identifier).join(", ")} · <b>{money(receipt.total)} ETB</b>
            </p>
            <p className="mt-3 font-mono text-sm text-slate-900">{receipt.booking_code}</p>
            <p className="text-xs text-slate-500 mt-1">Guest can show this code at the gate. Find it under Bookings.</p>
            <div className="mt-5 flex gap-2 justify-center">
              <Link href="/movie/bookings" className={btnSecondary}>
                View bookings
              </Link>
              <button type="button" className={btnPrimary} onClick={() => setReceipt(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(statusConfirm)}
        title={statusConfirm?.action === "disable" ? "Disable showtime?" : "Enable showtime?"}
        body={
          statusConfirm?.action === "disable"
            ? `Disable "${statusConfirm.showtime.movie_title}" at ${formatTime(statusConfirm.showtime.starts_at)} on ${displayScreenName(statusConfirm.showtime.screen_name)}? Customers will no longer see this show.`
            : `Enable "${statusConfirm?.showtime.movie_title}" at ${formatTime(statusConfirm?.showtime.starts_at || "")} on ${displayScreenName(statusConfirm?.showtime.screen_name)}? It will appear for customers again.`
        }
        confirmLabel={statusConfirm?.action === "disable" ? "Disable" : "Enable"}
        danger={statusConfirm?.action === "disable"}
        variant={statusConfirm?.action === "enable" ? "success" : undefined}
        theme="light"
        busy={updating}
        onCancel={() => setStatusConfirm(null)}
        onConfirm={handleStatusConfirm}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Cancel Showtime"
        body={`Are you sure you want to remove this showtime for "${deleteTarget?.movie_title}"?`}
        confirmLabel="Remove Showtime"
        danger
        theme="light"
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

function PriceEditor({
  tiers,
  locked,
  saving,
  onSave,
}: {
  tiers: Array<{ tier_name: string; price: number }>;
  locked: boolean;
  saving: boolean;
  onSave: (tiers: Array<{ tier_name: string; price: number }>) => void;
}) {
  const [draft, setDraft] = useState(() => tiers.map((t) => ({ tier_name: t.tier_name, price: String(t.price) })));
  if (tiers.length === 0) return null;
  const changed = draft.some((d, i) => Number(d.price) !== Number(tiers[i]?.price));
  const valid = draft.every((d) => d.price !== "" && Number(d.price) >= 0);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2.5">
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
        <Tag size={12} className="text-slate-400" /> Ticket price for this show
      </div>
      {draft.map((d, idx) => (
        <div key={d.tier_name} className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{d.tier_name}</span>
          <div className="w-32 flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 focus-within:border-rose-500">
            <span className="text-[11px] font-semibold text-slate-500">ETB</span>
            <input
              type="number"
              min={0}
              disabled={locked}
              value={d.price}
              onChange={(e) => setDraft((prev) => prev.map((row, i) => (i === idx ? { ...row, price: e.target.value } : row)))}
              className="w-full bg-transparent text-sm font-semibold text-slate-900 focus:outline-none text-right disabled:opacity-50"
            />
          </div>
        </div>
      ))}
      {locked ? (
        <p className="text-[11px] text-slate-500 flex gap-1">
          <Lock size={11} className="mt-0.5 shrink-0" /> Prices are locked once the show has started.
        </p>
      ) : (
        <button
          type="button"
          disabled={!changed || !valid || saving}
          onClick={() => onSave(draft.map((d) => ({ tier_name: d.tier_name, price: Number(d.price) })))}
          className={`${btnPrimary} w-full`}
        >
          {saving ? "Saving…" : "Save prices"}
        </button>
      )}
    </div>
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
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">Sell at counter</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-slate-900">
            <X size={18} />
          </button>
        </div>
        <ul className="max-h-40 overflow-auto rounded-lg border border-slate-200 divide-y divide-slate-100 mb-3">
          {seats.map((s) => (
            <li key={s.key} className="flex justify-between px-3 py-1.5 text-sm text-slate-700">
              <span>
                {s.identifier} <span className="text-xs text-slate-500">· {s.section}</span>
              </span>
              <span>{money(s.price)} ETB</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between text-base font-black text-slate-900 mb-4">
          <span>Total to collect</span>
          <span>{money(total)} ETB</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600">Guest name (optional)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} mt-1`} placeholder="Walk-in" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Phone (optional)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={`${inputCls} mt-1`} inputMode="tel" />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          {(["CASH", "CARD", "MOBILE_MONEY"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold cursor-pointer ${
                method === m ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-300 text-slate-600"
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
          <button type="button" className={btnSecondary} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={saving}
            onClick={() => onConfirm({ guest_name: name.trim() || undefined, guest_phone: phone.trim() || undefined, payment_method: method })}
          >
            {saving ? "Booking…" : `Confirm · ${money(total)} ETB`}
          </button>
        </div>
      </div>
    </div>
  );
}
