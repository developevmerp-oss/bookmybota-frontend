"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ClassicSeatMap from "@/components/venue/ClassicSeatMap";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Ban, Calendar, Check, ChevronLeft, ChevronRight, Clock, Edit2, Eye, FileSignature, Film, Globe, History, Info, Lock, Monitor, Plus, RefreshCw, Store, Tag, Ticket, Trash2, X, MoreVertical, BarChart3 } from "lucide-react";
import { useAppSelector } from "@/lib/hooks";
import {
  useDeletePartnerMovieShowtimeMutation,
  useGetCinemaContractQuery,
  useGetCinemaScreenAuditSummaryQuery,
  useGetCinemaScreenSeatAuditQuery,
  useGetCinemaScreensQuery,
  useGetPartnerMovieCatalogQuery,
  useGetPartnerMovieShowtimesQuery,
  useGetShowChannelSummaryQuery,
  useGetShowSeatMapQuery,
  useUpdatePartnerMovieShowtimeMutation,
  type CinemaScreen,
  type CinemaScreenAuditRow,
  type CinemaScreenSeatAuditEntry,
  type MovieShowtime,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { isVenueWallTimeReached, venueDateStr } from "@/lib/dateFormat";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import LayoutSeatPreview from "@/components/venue/LayoutSeatPreview";
import ContractRequiredDialog from "./ContractRequiredDialog";
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

export default function MovieShowsSeatsPage() {
  const searchParams = useSearchParams();
  const user = useAppSelector((state) => state.auth.user);
  const bizId = user?.business_id || (user as { business?: { id?: string } })?.business?.id || "";

  const todayStr = useMemo(() => venueDateStr() || toYmdLocal(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(searchParams.get("date") || todayStr);
  const [screenFilter, setScreenFilter] = useState<string>("");
  const [showId, setShowId] = useState<string>(searchParams.get("show") || "");
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [formRequest, setFormRequest] = useState<ShowtimeFormRequest | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MovieShowtime | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<{ action: "enable" | "disable"; showtime: MovieShowtime } | null>(null);
  const [urlMovieHandled, setUrlMovieHandled] = useState(false);
  const formRequestSeq = useRef(0);

  const { data: contract, isLoading: loadingContract } = useGetCinemaContractQuery();
  const isContractActive = contract?.status === "ACTIVE";
  const { data: allScreens = [] } = useGetCinemaScreensQuery(bizId, { skip: !bizId });
  // Only screens whose layout is live can run shows
  const screens = useMemo(
    () => allScreens.filter((sc) => sc.layout_is_default && (sc.venue_layout_template_id || sc.layout_template_id)),
    [allScreens]
  );
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
    refetch: refetchMap,
  } = useGetShowSeatMapQuery({ bizId, showtimeId: showId }, { skip: mapSkip, pollingInterval: 15000 });
  const { data: channels = [] } = useGetShowChannelSummaryQuery({ bizId, showtimeId: showId }, { skip: mapSkip });

  const { data: auditRows = [] } = useGetCinemaScreenAuditSummaryQuery(bizId, { skip: !bizId, pollingInterval: 30000 });
  const { data: auditLog = [] } = useGetCinemaScreenSeatAuditQuery(
    { bizId, screenId: activeScreenId, limit: 30 },
    { skip: !bizId || !activeScreenId }
  );
  const auditRow = auditRows.find((r) => r.screen_id === activeScreenId) ?? null;
  const { data: todayShows = [] } = useGetPartnerMovieShowtimesQuery(
    { bizId, date: todayStr, ...(activeScreenId ? { cinema_screen_id: activeScreenId } : {}) },
    { skip: !bizId || !activeScreenId }
  );
  const screenHasLayout = Array.isArray(activeScreen?.layout_seats_json) && (activeScreen?.layout_seats_json?.length ?? 0) > 0;

  const openCreate = () => {
    if (!isContractActive) {
      setContractDialogOpen(true);
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

      <div className={`${card} overflow-hidden`}>
        {/* Toolbar: everything for choosing what you are looking at */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
          <div className="mr-auto min-w-0">
            <h2 className="text-lg font-extrabold leading-tight text-slate-900">Shows &amp; Seats</h2>
            {activeScreen ? (
              <p className="truncate text-xs text-slate-500">
                {displayScreenName(activeScreen.name)} · {(activeScreen.screen_type || "standard").toUpperCase()} ·{" "}
                {activeScreen.layout_seat_count || activeScreen.capacity || 0} seats
                {activeScreen.layout_name ? ` · ${activeScreen.layout_name}` : ""}
              </p>
            ) : (
              <p className="text-xs text-slate-500">Approve a layout under Screens &amp; Layouts to start scheduling shows.</p>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button type="button" className={`${btnSecondary} !px-2`} onClick={() => setSelectedDate((d) => shiftYmd(d, -1))} aria-label="Previous day">
              <ChevronLeft size={16} />
            </button>
            <label className="relative inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 hover:border-slate-300 focus-within:border-rose-400 cursor-pointer">
              <Calendar size={15} className="shrink-0 text-[#e11d48] pointer-events-none" aria-hidden />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) && setSelectedDate(e.target.value)}
                className="bg-transparent text-sm font-semibold text-slate-900 focus:outline-none cursor-pointer [color-scheme:light]"
                aria-label="Show date"
              />
            </label>
            <button type="button" className={`${btnSecondary} !px-2`} onClick={() => setSelectedDate((d) => shiftYmd(d, 1))} aria-label="Next day">
              <ChevronRight size={16} />
            </button>
            {selectedDate !== todayStr && (
              <button type="button" className="px-1 text-xs font-bold text-[#e11d48] hover:underline" onClick={() => setSelectedDate(todayStr)}>
                Today
              </button>
            )}
          </div>

          <select
            value={activeScreenId}
            onChange={(e) => setScreenFilter(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-400 cursor-pointer"
            aria-label="Filter by screen"
          >
            {screens.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {displayScreenName(sc.name)} ({sc.screen_type?.toUpperCase() || "STANDARD"})
              </option>
            ))}
          </select>

          <button type="button" className={btnPrimary} onClick={openCreate} disabled={screens.length === 0 || catalogMovies.length === 0} title="Schedule a new show">
            <Plus size={15} /> Schedule show
          </button>
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
          <ScreenActions screen={activeScreen} hasLayout={screenHasLayout} onOpenLayout={() => setLayoutOpen(true)} onOpenInfo={() => setInfoOpen(true)} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[21rem_minmax(0,1fr)]">
          {/* Shows on the chosen day */}
          <div className="border-b border-slate-200 p-3 lg:border-b-0 lg:border-r">
            <div className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {formatDateHeader(selectedDate)} · {sortedShows.length} show{sortedShows.length === 1 ? "" : "s"}
            </div>
            {showsLoading ? (
              <p className="px-1 py-3 text-sm text-slate-500">Loading shows…</p>
            ) : sortedShows.length === 0 ? (
              <div className="space-y-2 px-2 py-8 text-center">
                <Film size={28} className="mx-auto text-slate-300" />
                <p className="text-sm text-slate-600">No shows on this date.</p>
                <button type="button" className={btnPrimary} onClick={openCreate} disabled={screens.length === 0 || catalogMovies.length === 0}>
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
                        className={`w-full cursor-pointer rounded-xl border px-3 py-2.5 text-left transition-colors ${
                          active ? "border-rose-500 bg-rose-50" : "border-slate-200 bg-white hover:border-rose-300"
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
                        <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
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

          {/* The show you picked */}
          <div className="min-w-0 space-y-4 p-4">
            {!selectedShow ? (
              <div className="flex h-full min-h-[10rem] flex-col items-center justify-center text-center text-slate-500">
                <Ticket size={30} className="mb-2 text-slate-300" />
                <p className="text-sm font-semibold text-slate-700">Pick a show to see its prices and sales</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-base font-extrabold text-slate-900">{selectedShow.movie_title}</div>
                    <div className="text-xs text-slate-500">
                      {displayScreenName(selectedShow.screen_name)} · {formatTime(selectedShow.starts_at)}
                      {selectedShow.ends_at ? ` → ${formatTime(selectedShow.ends_at)}` : ""} · {selectedShow.format || "2D"} · {selectedShow.language || "—"}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button type="button" className={`${btnSecondary} !px-2`} onClick={() => openEdit(selectedShow)} title="Edit show and prices" aria-label="Edit show">
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={updating}
                      onClick={() => setStatusConfirm({ action: selectedShow.is_active ? "disable" : "enable", showtime: selectedShow })}
                    >
                      {selectedShow.is_active ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      className="inline-flex cursor-pointer items-center rounded-xl border border-rose-200 px-2 text-rose-600 hover:bg-rose-50"
                      onClick={() => setDeleteTarget(selectedShow)}
                      title="Remove show"
                      aria-label="Remove show"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {!showLive && (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-500">
                    This show is {selectedShow.status === "CANCELLED" ? "cancelled" : "disabled"}, so seats cannot be managed. Enable it to open the seat layout.
                  </p>
                )}

                {showLive && map && (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {[
                      { label: "Available", value: map.counts.available, tone: "text-emerald-600" },
                      { label: "Sold", value: map.counts.booked, tone: "text-slate-900" },
                      { label: "Held", value: map.counts.held, tone: "text-amber-600" },
                      { label: "Damaged", value: map.counts.screen_blocked, tone: "text-orange-600" },
                      { label: "Blocked", value: map.counts.blocked, tone: "text-rose-600" },
                      { label: "Revenue", value: money(map.revenue), tone: "text-slate-900" },
                    ].map((c) => (
                      <div key={c.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</div>
                        <div className={`text-lg font-black leading-tight ${c.tone}`}>{c.value}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <PriceEditor
                    key={`${selectedShow.id}-${tiers.map((t) => `${t.tier_name}:${t.price}`).join("|")}`}
                    tiers={tiers}
                    locked={isVenueWallTimeReached(selectedShow.starts_at)}
                    saving={updating}
                    onSave={(next) => savePrices(selectedShow, next)}
                  />

                  {showLive && map && (
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-700">
                        <Ticket size={13} className="text-[#e11d48]" /> Sold by channel
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
                  )}
                </div>

                {/* Partner & app connection — hidden for now
                {showLive && map && (
                  <div className="rounded-xl border border-slate-200 p-3">
                    <div className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-700">
                      <Plug size={13} className="text-[#e11d48]" /> Partner &amp; app connection
                    </div>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={feedUrl}
                        onFocus={(e) => e.currentTarget.select()}
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono text-[11px] text-slate-700"
                        aria-label="Live seat feed URL"
                      />
                      <button type="button" className={`${btnSecondary} !px-2`} onClick={copyFeed} aria-label="Copy feed URL">
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                    <p className="mt-1.5 flex gap-1 text-[11px] text-slate-500">
                      <Info size={11} className="mt-0.5 shrink-0" /> One live read-only feed for the website, your app and partner apps.
                    </p>
                  </div>
                )}
                */}
              </>
            )}
          </div>
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

      {layoutOpen && activeScreen && (
        <ScreenLayoutModal screen={activeScreen} onClose={() => setLayoutOpen(false)} />
      )}
      {infoOpen && activeScreen && <ScreenInfoModal screen={activeScreen} row={auditRow} onClose={() => setInfoOpen(false)} />}
      <ContractRequiredDialog open={contractDialogOpen} onClose={() => setContractDialogOpen(false)} />

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

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

function Stat({ label, value, tone = "text-slate-900", hint }: { label: string; value: string | number; tone?: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-xl font-black leading-tight ${tone}`}>{value}</div>
      {hint ? <div className="text-[10px] text-slate-400 mt-0.5">{hint}</div> : null}
    </div>
  );
}

/** View layout and the 3-dot menu for the chosen screen. */
function ScreenActions({
  screen,
  hasLayout,
  onOpenLayout,
  onOpenInfo,
}: {
  screen: CinemaScreen | null;
  hasLayout: boolean;
  onOpenLayout: () => void;
  onOpenInfo: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  if (!screen) return null;
  return (
    <div className="relative flex gap-2">
      <button type="button" className={btnSecondary} onClick={onOpenLayout} disabled={!hasLayout} title={hasLayout ? "View the live layout" : "No live layout yet"}>
        <Eye size={14} /> View layout
      </button>
      <button type="button" className={`${btnSecondary} !px-2.5`} onClick={() => setMenuOpen((v) => !v)} aria-label="More actions" aria-haspopup="menu" aria-expanded={menuOpen}>
        <MoreVertical size={15} />
      </button>
      {menuOpen ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setMenuOpen(false);
                onOpenInfo();
              }}
            >
              <Info size={14} /> About this screen
            </button>
            <Link href="/movie/screens" role="menuitem" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => setMenuOpen(false)}>
              <Ban size={14} /> Damaged seats
            </Link>
            <Link href={`/movie/screen-audit?screen=${screen.id}`} role="menuitem" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => setMenuOpen(false)}>
              <BarChart3 size={14} /> Screen audit
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ScreenInfoModal({ screen, row, onClose }: { screen: CinemaScreen; row: CinemaScreenAuditRow | null; onClose: () => void }) {
  const types = (screen.seat_types_json || {}) as Record<string, unknown>;
  const lines: Array<[string, string]> = [
    ["Screen", displayScreenName(screen.name)],
    ["Type", (screen.screen_type || "standard").toUpperCase()],
    ["Capacity", String(screen.capacity ?? "—")],
    ["Live layout", screen.layout_name || "None yet"],
    ["Seats on the layout", String(screen.layout_seat_count || 0)],
    ["Regular / Recliner / Couple", `${Number(types.regular) || 0} / ${Number(types.recliner) || 0} / ${Number(types.couple) || 0}`],
    ["Blocked seats", String(row?.seats.blocked ?? 0)],
    ["Status", screen.is_active ? "Active" : "Disabled"],
  ];
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Info size={16} className="text-[#e11d48]" /> About this screen
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <dl className="divide-y divide-slate-100 text-sm">
          {lines.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2">
              <dt className="text-slate-500">{k}</dt>
              <dd className="font-semibold text-slate-900 text-right">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

type LayoutSeatRecord = Record<string, unknown>;

const seatNameOf = (seat: LayoutSeatRecord) => `${String(seat.row_label || seat.row || "")}${String(seat.seat_label || seat.label || "")}`;
const seatStatusOf = (seat: LayoutSeatRecord) => String(seat.status || "AVAILABLE").toUpperCase();

/** The eye button: the screen's live layout, read only. Damaged seats show in orange. */
function ScreenLayoutModal({ screen, onClose }: { screen: CinemaScreen; onClose: () => void }) {
  const seats = useMemo(
    () => (Array.isArray(screen.layout_seats_json) ? (screen.layout_seats_json as LayoutSeatRecord[]) : []),
    [screen.layout_seats_json]
  );
  const damaged = seats.filter((seat) => seatStatusOf(seat) === "BLOCKED").length;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 shadow-2xl p-4 sm:p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-slate-900 truncate">{displayScreenName(screen.name)} layout</h3>
            <p className="text-xs text-slate-500">
              {screen.layout_name ? `${screen.layout_name} · ` : ""}
              {seats.length} seats · {damaged} damaged
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <ClassicSeatMap
          seats={seats as never}
          heightClass="h-[min(60vh,520px)]"
          seatMarker={(raw) => {
            const seat = raw as unknown as LayoutSeatRecord;
            const status = seatStatusOf(seat);
            return {
              fill: status === "BLOCKED" ? "#f97316" : status === "BOOKED" || status === "RESERVED" ? "#94a3b8" : "",
              stroke: status === "BLOCKED" ? "#c2410c" : "#ffffff",
              strokeWidth: status === "BLOCKED" ? 2 : undefined,
              cursor: "default",
              title: `${seatNameOf(seat)} · ${status === "BLOCKED" ? "Damaged" : "Available"}`,
            };
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
          <div className="flex gap-x-4">
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-blue-500" /> Available</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-orange-500" /> Damaged</span>
          </div>
          <Link href="/movie/screens" className="font-semibold text-[#e11d48] hover:underline">
            Mark or repair damaged seats in Screens &amp; Layouts
          </Link>
        </div>
      </div>
    </div>
  );
}
