"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  Film,
  Monitor,
  Plus,
  Trash2,
  Edit2,
  Tag,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertCircle,
  FileSignature,
  RefreshCw,
} from "lucide-react";
import { useAppSelector } from "@/lib/hooks";
import {
  useGetCinemaScreensQuery,
  useGetPartnerMovieCatalogQuery,
  useGetPartnerMovieShowtimesQuery,
  useCreatePartnerMovieShowtimeMutation,
  useUpdatePartnerMovieShowtimeMutation,
  useDeletePartnerMovieShowtimeMutation,
  useGetCinemaContractQuery,
  type MovieShowtime,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import {
  formatDate,
  formatTime12h,
  isVenueWallTimeReached,
  venueDateStr,
  venueTimeStr,
} from "@/lib/dateFormat";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import {
  emptyMovieShowtimeFormValues,
  movieShowtimeFormSchema,
  type MovieShowtimeFormValues,
} from "@/lib/moviePartnerFormSchemas";
import {
  PRICE_DURATION_OPTIONS,
  buildScreenTierPricing,
  extractScreenTierNames,
} from "@/lib/cinemaSeatTypes";

const FORMAT_OPTIONS = ["2D", "3D", "IMAX 2D", "IMAX 3D", "4DX", "Dolby Cinema", "ScreenX"];
/** Used only when the selected movie has no languages configured. */
const FALLBACK_LANGUAGE_OPTIONS = ["English", "Amharic"];

const fieldErrorClass = "mt-1.5 text-xs text-rose-600 font-medium";
const modalLabelClass = "block text-xs font-semibold text-slate-600 mb-1.5";
const modalInputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-500/20";
const modalHelperClass = "mt-1 text-[11px] text-slate-500";

function uniqueTrimmedStrings(values?: string[] | null): string[] {
  if (!values?.length) return [];
  return Array.from(
    new Set(values.map((v) => String(v || "").trim()).filter(Boolean))
  );
}

function RequiredMark() {
  return <span className="text-rose-500">*</span>;
}

function parseIsoDateAndHours(iso: string) {
  if (!iso) return { dateStr: "", timeStr: "", displayTime: "" };
  const str = String(iso).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (match) {
    const [, yr, mon, dy, hhStr, mmStr] = match;
    const h = parseInt(hhStr, 10);
    const minuteStr = mmStr || "00";
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return {
      dateStr: `${yr}-${mon}-${dy}`,
      timeStr: `${String(h).padStart(2, "0")}:${minuteStr}`,
      displayTime: `${String(h12).padStart(2, "0")}:${minuteStr} ${ampm}`,
    };
  }
  const dateObj = new Date(iso);
  if (isNaN(dateObj.getTime())) return { dateStr: "", timeStr: "", displayTime: "" };
  const h = dateObj.getHours();
  const minuteStr = String(dateObj.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    dateStr: `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`,
    timeStr: `${String(h).padStart(2, "0")}:${minuteStr}`,
    displayTime: `${String(h12).padStart(2, "0")}:${minuteStr} ${ampm}`,
  };
}

const SHOW_BUFFER_MINUTES = 20;
const DEFAULT_DURATION_MINUTES = 120;

/** Default start HH:mm — 14:00 when future day; next 15‑min slot when scheduling today. */
function defaultStartTimeForDate(showDate: string): string {
  const today = venueDateStr();
  if (!showDate || !today || showDate > today) return "14:00";
  const nowHm = venueTimeStr();
  if (!nowHm) return "14:00";
  const [hh, mm] = nowHm.split(":").map((n) => Number(n));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return "14:00";
  // At least one minute ahead, then round up to the next 15-minute mark.
  let totalMins = hh * 60 + mm + 1;
  totalMins = Math.ceil(totalMins / 15) * 15;
  if (totalMins >= 24 * 60) totalMins = 23 * 60 + 45;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(totalMins / 60))}:${pad(totalMins % 60)}`;
}

/** Wall-clock rank from naive showtime string (venue local digits). */
function wallMs(iso?: string | null): number | null {
  if (!iso) return null;
  const match = String(iso)
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] || "0")
  );
}

function addMinutesWall(iso: string, minutes: number): string | null {
  const ms = wallMs(iso);
  if (ms == null) return null;
  const end = new Date(ms + minutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}T${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}:${pad(end.getUTCSeconds())}`;
}

function effectiveShowEndIso(st: MovieShowtime): string | null {
  if (st.ends_at) return st.ends_at;
  const mins =
    st.movie_duration_minutes && st.movie_duration_minutes > 0
      ? st.movie_duration_minutes
      : DEFAULT_DURATION_MINUTES;
  return addMinutesWall(st.starts_at, mins + SHOW_BUFFER_MINUTES);
}

function intervalsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  const as = wallMs(aStart);
  const ae = wallMs(aEnd);
  const bs = wallMs(bStart);
  const be = wallMs(bEnd);
  if (as == null || ae == null || bs == null || be == null) return false;
  return as < be && bs < ae;
}

/** Active scheduled shows on the same screen that overlap [start, end). */
function findScreenScheduleConflict(
  showtimes: MovieShowtime[],
  opts: {
    cinemaScreenId: string;
    startsAt: string;
    endsAt: string;
    excludeId?: string | null;
  }
): MovieShowtime | null {
  for (const st of showtimes) {
    if (opts.excludeId && st.id === opts.excludeId) continue;
    if (!st.is_active) continue;
    if (String(st.status || "SCHEDULED").toUpperCase() !== "SCHEDULED") continue;
    if (st.cinema_screen_id !== opts.cinemaScreenId) continue;
    const end = effectiveShowEndIso(st);
    if (!end) continue;
    if (intervalsOverlap(opts.startsAt, opts.endsAt, st.starts_at, end)) return st;
  }
  return null;
}

function conflictingShowtimeIds(showtimes: MovieShowtime[]): Set<string> {
  const ids = new Set<string>();
  const active = showtimes.filter(
    (st) => st.is_active && String(st.status || "SCHEDULED").toUpperCase() === "SCHEDULED"
  );
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (a.cinema_screen_id !== b.cinema_screen_id) continue;
      const aEnd = effectiveShowEndIso(a);
      const bEnd = effectiveShowEndIso(b);
      if (!aEnd || !bEnd) continue;
      if (intervalsOverlap(a.starts_at, aEnd, b.starts_at, bEnd)) {
        ids.add(a.id);
        ids.add(b.id);
      }
    }
  }
  return ids;
}

const TIER_SORT_RANK: Record<string, number> = {
  regular: 0,
  recliner: 1,
  couple: 2,
  vip: 3,
  premium: 4,
};

function sortedTierPricing(tiers: MovieShowtime["tier_pricing"] | undefined) {
  if (!tiers?.length) return [];
  return [...tiers].sort((a, b) => {
    const ra = TIER_SORT_RANK[String(a.tier_name || "").trim().toLowerCase()] ?? 50;
    const rb = TIER_SORT_RANK[String(b.tier_name || "").trim().toLowerCase()] ?? 50;
    if (ra !== rb) return ra - rb;
    return String(a.tier_name || "").localeCompare(String(b.tier_name || ""));
  });
}

function displayScreenName(name?: string | null) {
  const raw = String(name || "Screen").trim();
  if (!raw) return "Screen";
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Local calendar YYYY-MM-DD — never use toISOString() (UTC shifts the day in ET). */
function toYmdLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shiftYmd(ymd: string, days: number): string {
  // Noon avoids DST / midnight edge cases when adding days
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  d.setDate(d.getDate() + days);
  return toYmdLocal(d);
}

function formatTime(iso: string) {
  if (!iso) return "";
  const t = formatTime12h(iso);
  return t === "—" ? "" : t;
}

function formatDateHeader(isoDateStr: string) {
  const d = new Date(isoDateStr + "T00:00:00");
  if (isNaN(d.getTime())) return formatDate(isoDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const base = formatDate(isoDateStr);
  if (diffDays === 0) return `Today (${base})`;
  if (diffDays === 1) return `Tomorrow (${base})`;
  if (diffDays === -1) return `Yesterday (${base})`;
  return base;
}

export default function MovieShowtimesPage() {
  const searchParams = useSearchParams();
  const user = useAppSelector((state) => state.auth.user);
  const bizId = user?.business_id || (user as { business?: { id?: string } })?.business?.id || "";

  const todayStr = useMemo(() => venueDateStr() || toYmdLocal(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [screenFilter, setScreenFilter] = useState<string>("");
  const [movieFilter, setMovieFilter] = useState<string>("");

  const { data: contract, isLoading: loadingContract } = useGetCinemaContractQuery();
  const isContractActive = contract?.status === "ACTIVE";

  const { data: screens = [] } = useGetCinemaScreensQuery(bizId, { skip: !bizId });
  const { data: catalogData } = useGetPartnerMovieCatalogQuery({ page: 1, limit: 100 });
  const catalogMovies = catalogData?.items ?? [];

  const {
    data: showtimes = [],
    isLoading,
    isFetching,
  } = useGetPartnerMovieShowtimesQuery(
    {
      bizId,
      date: selectedDate,
      ...(screenFilter ? { cinema_screen_id: screenFilter } : {}),
      ...(movieFilter ? { movie_id: movieFilter } : {}),
    },
    { skip: !bizId }
  );

  const [createShowtime, { isLoading: creating }] = useCreatePartnerMovieShowtimeMutation();
  const [updateShowtime, { isLoading: updating }] = useUpdatePartnerMovieShowtimeMutation();
  const [deleteShowtime, { isLoading: deleting }] = useDeletePartnerMovieShowtimeMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingShowtime, setEditingShowtime] = useState<MovieShowtime | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MovieShowtime | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<{
    action: "enable" | "disable";
    showtime: MovieShowtime;
  } | null>(null);
  const [urlMovieHandled, setUrlMovieHandled] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useForm<MovieShowtimeFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(movieShowtimeFormSchema) as any,
    defaultValues: emptyMovieShowtimeFormValues({ show_date: todayStr }),
    mode: "onSubmit",
    context: { originalStartsAt: editingShowtime?.starts_at ?? null },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "tier_pricing",
  });

  const formMovieId = watch("movie_id");
  const formScreenId = watch("cinema_screen_id");
  const formShowDate = watch("show_date");
  const formStartTime = watch("start_time");
  const lastSyncedScreenIdRef = useRef<string>("");

  const scheduleConflictIds = useMemo(() => conflictingShowtimeIds(showtimes), [showtimes]);

  const formScheduleConflict = useMemo(() => {
    if (!formScreenId || !formShowDate || !formStartTime) return null;
    const startsAt = `${formShowDate}T${formStartTime}:00`;
    const duration =
      catalogMovies.find((m) => m.id === formMovieId)?.duration_minutes || DEFAULT_DURATION_MINUTES;
    const endsAt = addMinutesWall(startsAt, duration + SHOW_BUFFER_MINUTES);
    if (!endsAt) return null;
    return findScreenScheduleConflict(showtimes, {
      cinemaScreenId: formScreenId,
      startsAt,
      endsAt,
      excludeId: editingShowtime?.id,
    });
  }, [
    formScreenId,
    formShowDate,
    formStartTime,
    formMovieId,
    catalogMovies,
    showtimes,
    editingShowtime?.id,
  ]);

  const handleSyncScreenTiers = (screenId?: string) => {
    const targetScreenId = screenId || formScreenId;
    const targetScreen = screens.find((s) => s.id === targetScreenId);
    if (!targetScreen) return;
    const tiers = buildScreenTierPricing(targetScreen, getValues("tier_pricing"));
    setValue("tier_pricing", tiers, { shouldValidate: true });
    lastSyncedScreenIdRef.current = targetScreenId;
  };

  // When cinema admin changes screen in create mode, auto-populate exact seat tiers from that screen
  useEffect(() => {
    if (!formScreenId || editingShowtime) return;
    if (lastSyncedScreenIdRef.current === formScreenId) return;
    const targetScreen = screens.find((s) => s.id === formScreenId);
    if (targetScreen) {
      const tiers = buildScreenTierPricing(targetScreen, getValues("tier_pricing"));
      setValue("tier_pricing", tiers, { shouldValidate: true });
      lastSyncedScreenIdRef.current = formScreenId;
    }
  }, [formScreenId, screens, editingShowtime, setValue, getValues]);

  useEffect(() => {
    const pMovieId = searchParams.get("movie_id");
    if (pMovieId && !editingShowtime && !urlMovieHandled) {
      const initialScreen = screens[0];
      const initialTiers = buildScreenTierPricing(initialScreen);
      lastSyncedScreenIdRef.current = initialScreen?.id || "";
      const createDate = selectedDate || todayStr;
      reset(
        emptyMovieShowtimeFormValues({
          movie_id: pMovieId,
          cinema_screen_id: initialScreen?.id || "",
          show_date: createDate,
          start_time: defaultStartTimeForDate(createDate),
          tier_pricing: initialTiers,
        })
      );
      setModalOpen(true);
      setUrlMovieHandled(true);
    }
  }, [
    searchParams,
    editingShowtime,
    urlMovieHandled,
    reset,
    screens,
    selectedDate,
    todayStr,
  ]);

  const shiftDate = (days: number) => {
    setSelectedDate((prev) => shiftYmd(prev || todayStr, days));
  };

  const openCreateModal = () => {
    if (!isContractActive) {
      toast.error("Active contract required. Please review and sign your cinema agreement under Contract first.");
      return;
    }
    setEditingShowtime(null);
    const initialScreen = screens[0];
    const initialTiers = buildScreenTierPricing(initialScreen);
    lastSyncedScreenIdRef.current = initialScreen?.id || "";
    const createDate = selectedDate || todayStr;
    reset(
      emptyMovieShowtimeFormValues({
        movie_id: catalogMovies[0]?.id || "",
        cinema_screen_id: initialScreen?.id || "",
        show_date: createDate,
        start_time: defaultStartTimeForDate(createDate),
        language: catalogMovies[0]?.languages?.[0] || "English",
        format: catalogMovies[0]?.formats?.[0] || "2D",
        tier_pricing: initialTiers,
        price_duration: "showtime",
      })
    );
    setModalOpen(true);
  };

  const openEditModal = (st: MovieShowtime) => {
    setEditingShowtime(st);
    lastSyncedScreenIdRef.current = st.cinema_screen_id || "";
    const parsed = parseIsoDateAndHours(st.starts_at);
    reset({
      movie_id: st.movie_id,
      cinema_screen_id: st.cinema_screen_id,
      show_date: parsed.dateStr || selectedDate,
      start_time: parsed.timeStr || "18:00",
      language: st.language || "English",
      format: st.format || "2D",
      tier_pricing: st.tier_pricing?.length
        ? st.tier_pricing.map((t) => ({ tier_name: t.tier_name, price: Number(t.price) }))
        : [{ tier_name: "Standard", price: 150 }],
    });
    setModalOpen(true);
  };

  useEffect(() => {
    if (!formMovieId || editingShowtime) return;
    const selectedMovie = catalogMovies.find((m) => m.id === formMovieId);
    if (!selectedMovie) return;
    if (selectedMovie.languages?.length) {
      setValue("language", selectedMovie.languages[0]);
    }
    if (selectedMovie.formats?.length) {
      setValue("format", selectedMovie.formats[0]);
    }
  }, [formMovieId, catalogMovies, editingShowtime, setValue]);

  const onValid = async (values: MovieShowtimeFormValues) => {
    if (!bizId) {
      toast.error("Business ID not found");
      return;
    }

    const startsAt = `${values.show_date}T${values.start_time}:00`;
    if (isVenueWallTimeReached(startsAt)) {
      const orig = editingShowtime?.starts_at
        ? String(editingShowtime.starts_at).match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/)
        : null;
      const unchanged =
        !!orig && orig[1] === values.show_date && orig[2] === values.start_time;
      if (!unchanged) {
        toast.error("Cannot schedule a showtime in the past. Choose a future start time.");
        return;
      }
    }
    const duration =
      catalogMovies.find((m) => m.id === values.movie_id)?.duration_minutes ||
      DEFAULT_DURATION_MINUTES;
    const endsAt = addMinutesWall(startsAt, duration + SHOW_BUFFER_MINUTES);
    if (endsAt) {
      const localConflict = findScreenScheduleConflict(showtimes, {
        cinemaScreenId: values.cinema_screen_id,
        startsAt,
        endsAt,
        excludeId: editingShowtime?.id,
      });
      if (localConflict) {
        toast.error(
          `Screen "${localConflict.screen_name || "this screen"}" already has a show at ${formatTime(
            localConflict.starts_at
          )} (${localConflict.movie_title || "another movie"} · ${localConflict.format || "—"}). One screen can only run one show at a time.`
        );
        return;
      }
    }

    const payload = {
      movie_id: values.movie_id,
      cinema_screen_id: values.cinema_screen_id,
      starts_at: startsAt,
      language: values.language?.trim() || "English",
      format: values.format?.trim() || "2D",
      tier_pricing: (values.tier_pricing || [])
        .filter((t) => t.tier_name && Number(t.price) >= 0)
        .map((t) => ({ tier_name: t.tier_name, price: Number(t.price) })),
      price_duration: values.price_duration || "showtime",
    };

    try {
      if (editingShowtime) {
        const res = await updateShowtime({
          bizId,
          showtimeId: editingShowtime.id,
          body: payload,
        }).unwrap();
        toast.success((res as { message?: string })?.message || "Showtime updated successfully!");
      } else {
        const res = await createShowtime({
          bizId,
          body: payload,
        }).unwrap();
        toast.success((res as { message?: string })?.message || "Showtime scheduled successfully!");
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to save showtime"));
    }
  };

  const handleStatusConfirm = async () => {
    if (!statusConfirm) return;
    const { action, showtime } = statusConfirm;
    const nextActive = action === "enable";
    try {
      const res = await updateShowtime({
        bizId,
        showtimeId: showtime.id,
        body: { is_active: nextActive },
      }).unwrap();
      toast.success(
        (res as { message?: string })?.message ||
          (nextActive ? "Showtime enabled" : "Showtime disabled")
      );
      setStatusConfirm(null);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update showtime status"));
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      const res = await deleteShowtime({
        bizId,
        showtimeId: deleteTarget.id,
      }).unwrap();
      toast.success((res as { message?: string })?.message || "Showtime removed successfully");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to delete showtime"));
    }
  };

  const activeMovieForForm = catalogMovies.find((m) => m.id === formMovieId);
  const activeScreenForForm = screens.find((s) => s.id === formScreenId);

  const formLanguageValue = watch("language");
  const movieLanguageOptions = useMemo(() => {
    const fromMovie = uniqueTrimmedStrings(activeMovieForForm?.languages);
    const opts = fromMovie.length > 0 ? [...fromMovie] : [...FALLBACK_LANGUAGE_OPTIONS];
    const current = String(formLanguageValue || "").trim();
    if (current && !opts.includes(current)) opts.push(current);
    return opts;
  }, [activeMovieForForm?.languages, formLanguageValue]);

  return (
    <div className="-m-4 sm:-m-8 min-h-[calc(100vh-5rem)] bg-white p-4 sm:p-8 animate-fadeIn">
      <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar size={26} className="text-[#e11d48]" /> Showtime Schedule
          </h2>
          <p className="text-sm text-slate-500 mt-1.5">
            Schedule catalog movies onto your screens, configure show languages, formats, and ticket tier pricing.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          disabled={!isContractActive || screens.length === 0 || catalogMovies.length === 0}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold text-white bg-[#e11d48] hover:bg-[#be123c] shadow-sm shadow-rose-600/20 self-start sm:self-auto disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title={!isContractActive ? "Sign contract first" : undefined}
        >
          <Plus size={18} /> Schedule Show
        </button>
      </div>

      {!loadingContract && !isContractActive && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-amber-900">
          <div className="flex items-start gap-3">
            <AlertCircle size={22} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-900 text-base">Cinema Platform Agreement Required</p>
              <p className="text-xs text-amber-800/90 mt-1">
                Your cinema contract is currently{" "}
                <span className="font-semibold">
                  {contract?.status === "PENDING_SIGNATURES"
                    ? "awaiting digital signatures"
                    : contract?.status === "REJECTED"
                    ? "rejected"
                    : "not yet created"}
                </span>
                . Both Super Admin and Cinema Admin must sign with OTP before showtimes can be scheduled.
              </p>
            </div>
          </div>
          <Link
            href="/movie/contract"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#e11d48] text-white font-semibold text-xs hover:bg-[#be123c] shrink-0 transition-colors"
          >
            <FileSignature size={16} /> View &amp; Sign Agreement
          </Link>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
            title="Previous day"
            aria-label="Previous day"
          >
            <ChevronLeft size={18} />
          </button>

          <label className="relative inline-flex h-10 min-w-[10.5rem] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 hover:border-slate-300 focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-500/20 cursor-pointer">
            <Calendar size={16} className="shrink-0 text-[#e11d48] pointer-events-none" aria-hidden />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                const next = e.target.value;
                if (/^\d{4}-\d{2}-\d{2}$/.test(next)) setSelectedDate(next);
              }}
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 focus:outline-none cursor-pointer [color-scheme:light] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
              aria-label="Show date"
            />
          </label>

          <button
            type="button"
            onClick={() => shiftDate(1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
            title="Next day"
            aria-label="Next day"
          >
            <ChevronRight size={18} />
          </button>

          <button
            type="button"
            onClick={() => setSelectedDate(todayStr)}
            className={`h-10 px-3.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
              selectedDate === todayStr
                ? "bg-rose-50 text-[#e11d48] border-rose-200"
                : "border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            Today
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <select
            value={screenFilter}
            onChange={(e) => setScreenFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 cursor-pointer"
            aria-label="Filter by screen"
          >
            <option value="">All Screens</option>
            {screens.map((s) => (
              <option key={s.id} value={s.id}>
                {displayScreenName(s.name)} ({s.screen_type?.toUpperCase() || "STANDARD"})
              </option>
            ))}
          </select>

          <select
            value={movieFilter}
            onChange={(e) => setMovieFilter(e.target.value)}
            className="h-10 max-w-[220px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 cursor-pointer"
            aria-label="Filter by movie"
          >
            <option value="">All Movies</option>
            {catalogMovies.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {screens.length === 0 && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-5 text-amber-900 text-sm">
          <p className="font-semibold mb-1 text-slate-900">No cinema screens configured yet.</p>
          <p className="text-xs text-amber-800/90">
            Please create your cinema screens in the <strong>Screens</strong> tab first before scheduling shows.
          </p>
        </div>
      )}

      {isLoading ? (
        <AdminListShimmer rows={5} columns={4} showToolbar={false} showPagination={false} />
      ) : showtimes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center space-y-3">
          <Film size={36} className="mx-auto text-slate-400" />
          <h3 className="text-base font-semibold text-slate-800">
            No showtimes scheduled for {formatDateHeader(selectedDate)}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Click &quot;Schedule Show&quot; to add movie showtimes for this date.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            disabled={screens.length === 0 || catalogMovies.length === 0}
            className="inline-flex items-center gap-1.5 h-10 px-4 text-xs font-semibold rounded-xl mt-2 text-white bg-[#e11d48] hover:bg-[#be123c] disabled:opacity-40 cursor-pointer"
          >
            <Plus size={15} /> Schedule First Show
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between px-0.5">
            <p className="text-sm font-semibold text-slate-600">
              Showing{" "}
              <span className="text-slate-900">{showtimes.length}</span> show
              {showtimes.length !== 1 ? "s" : ""} on{" "}
              <span className="text-slate-900">{formatDateHeader(selectedDate)}</span>
            </p>
            {isFetching && <span className="text-xs text-[#e11d48] animate-pulse">Refreshing…</span>}
          </div>

          <div className="grid grid-cols-1 gap-3">
            {showtimes.map((st) => {
              const startStr = formatTime(st.starts_at);
              const endStr = st.ends_at ? formatTime(st.ends_at) : "";
              const hasScheduleConflict = scheduleConflictIds.has(st.id);
              const tiers = sortedTierPricing(st.tier_pricing);

              return (
                <div
                  key={st.id}
                  className={`rounded-2xl border bg-white p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm transition-all ${
                    hasScheduleConflict
                      ? "border-amber-400 ring-1 ring-amber-200"
                      : st.is_active
                        ? "border-slate-200 hover:border-slate-300 hover:shadow-md"
                        : "border-slate-200 opacity-70"
                  }`}
                >
                  <div className="flex items-start gap-3.5 sm:gap-4 min-w-0 flex-1">
                    <div className="w-[3.25rem] sm:w-14 aspect-[2/3] rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                      {st.movie_poster_url ? (
                        <img
                          src={resolveMediaUrl(st.movie_poster_url)}
                          alt={st.movie_title || "Movie"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-400">
                          <Film size={20} />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-[15px] sm:text-base font-bold text-zinc-900 truncate">
                          {st.movie_title}
                        </h4>
                        {st.movie_certificate && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border border-rose-300 bg-rose-50 text-rose-700">
                            {st.movie_certificate}
                          </span>
                        )}
                        {hasScheduleConflict && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-400 bg-amber-50 text-amber-800"
                            title="This screen already has another show in the same time range. Edit or delete one of them."
                          >
                            <AlertCircle size={11} /> Schedule conflict
                          </span>
                        )}
                        {!st.is_active && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200">
                            Disabled
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-x-2 gap-y-1.5 text-[12px] text-zinc-600 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-800">
                          <Monitor size={13} className="text-rose-500 shrink-0" />
                          {displayScreenName(st.screen_name)}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-800">
                          {st.format || "2D"}
                        </span>
                        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-800">
                          {st.language || "—"}
                        </span>
                        {st.movie_duration_minutes ? (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="inline-flex items-center gap-1 text-zinc-500">
                              <Clock size={12} className="shrink-0" />
                              {st.movie_duration_minutes}m
                            </span>
                          </>
                        ) : null}
                      </div>

                      {tiers.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <Tag size={12} className="text-zinc-400 shrink-0" />
                          {tiers.map((tp, idx) => (
                            <span
                              key={`${tp.tier_name}-${idx}`}
                              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-700"
                            >
                              <span className="font-medium">{tp.tier_name}:</span>
                              <span className="font-bold text-zinc-900">{tp.price} ETB</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between lg:justify-end gap-4 sm:gap-5 shrink-0 w-full lg:w-auto border-t border-zinc-100 lg:border-0 pt-3 lg:pt-0">
                    <div className="flex flex-col items-start lg:items-end gap-0.5 min-w-[7.5rem]">
                      <div className="flex items-center gap-1.5 text-[15px] font-extrabold text-zinc-900">
                        <Clock size={15} className="text-rose-500 shrink-0" />
                        <span>{startStr}</span>
                        {endStr ? (
                          <span className="text-zinc-400 font-medium text-xs">→ {endStr}</span>
                        ) : null}
                      </div>
                      <span className="text-[11px] font-medium text-zinc-500">
                        {formatDateHeader(selectedDate)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={st.is_active}
                        aria-label={st.is_active ? "Disable showtime" : "Enable showtime"}
                        onClick={() =>
                          setStatusConfirm({
                            action: st.is_active ? "disable" : "enable",
                            showtime: st,
                          })
                        }
                        disabled={updating || Boolean(statusConfirm)}
                        title={st.is_active ? "Disable showtime" : "Enable showtime"}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-rose-500/40 disabled:opacity-50 disabled:cursor-not-allowed ${
                          st.is_active ? "bg-emerald-500" : "bg-zinc-400"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            st.is_active ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(st)}
                        className="p-2 rounded-xl border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-colors cursor-pointer"
                        title="Edit Showtime"
                      >
                        <Edit2 size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(st)}
                        className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete Showtime"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm">
          <div className="flex w-full max-w-xl max-h-[min(92dvh,920px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
            <div className="shrink-0 flex items-center justify-between border-b border-slate-200 px-5 sm:px-6 pt-5 pb-4">
              <div className="min-w-0 pr-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles size={18} className="text-[#e11d48] shrink-0" />
                  {editingShowtime ? "Edit Showtime" : "Schedule New Showtime"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select film, auditorium screen, start time, and ticket prices per tier.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="shrink-0 text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSubmit(onValid)}
              className="flex min-h-0 flex-1 flex-col"
              noValidate
            >
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 sm:px-6 py-4">
              <div>
                <label className={modalLabelClass}>
                  Select Movie <RequiredMark />
                </label>
                <select
                  {...register("movie_id")}
                  className={modalInputClass}
                >
                  <option value="">-- Choose movie from catalog --</option>
                  {catalogMovies.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} {m.duration_minutes ? `(${m.duration_minutes} min)` : ""}
                    </option>
                  ))}
                </select>
                {errors.movie_id && <p className={fieldErrorClass}>{errors.movie_id.message}</p>}
                {activeMovieForForm && (
                  <p className="mt-1 text-[11px] text-slate-500 flex items-center gap-2">
                    <span>
                      Certificate: <strong>{activeMovieForForm.certificate || "Not specified"}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Duration: <strong>{activeMovieForForm.duration_minutes || 120} mins</strong>
                    </span>
                  </p>
                )}
              </div>

              <div>
                <label className={modalLabelClass}>
                  Cinema Screen / Auditorium <RequiredMark />
                </label>
                <select
                  {...register("cinema_screen_id")}
                  className={modalInputClass}
                >
                  <option value="">-- Choose screen --</option>
                  {screens.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.screen_type?.toUpperCase() || "STANDARD"}) · Capacity: {s.capacity || "N/A"}
                    </option>
                  ))}
                </select>
                {errors.cinema_screen_id && (
                  <p className={fieldErrorClass}>{errors.cinema_screen_id.message}</p>
                )}
                {activeScreenForForm?.layout_name && (
                  <p className="mt-1 text-[11px] text-emerald-600">
                    ✓ Layout Attached: <strong>{activeScreenForForm.layout_name}</strong>
                  </p>
                )}
                <p className={modalHelperClass}>
                  This screen cannot have another show in the same time range.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={modalLabelClass}>
                    Show Date <RequiredMark />
                  </label>
                  <input
                    type="date"
                    min={venueDateStr() || todayStr}
                    {...register("show_date", {
                      onChange: (e) => {
                        const nextDate = String(e.target.value || "");
                        const currentTime = getValues("start_time");
                        if (
                          nextDate &&
                          currentTime &&
                          isVenueWallTimeReached(`${nextDate}T${currentTime}:00`)
                        ) {
                          setValue("start_time", defaultStartTimeForDate(nextDate), {
                            shouldValidate: true,
                          });
                        }
                      },
                    })}
                    className={modalInputClass}
                  />
                  {errors.show_date && <p className={fieldErrorClass}>{errors.show_date.message}</p>}
                </div>

                <div>
                  <label className={modalLabelClass}>
                    Start Time <RequiredMark />
                  </label>
                  <input
                    type="time"
                    min={
                      formShowDate && formShowDate === (venueDateStr() || todayStr)
                        ? venueTimeStr() || undefined
                        : undefined
                    }
                    {...register("start_time")}
                    className={modalInputClass}
                  />
                  {errors.start_time && <p className={fieldErrorClass}>{errors.start_time.message}</p>}
                </div>
              </div>

              {formScheduleConflict ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-[12px] text-amber-100">
                  <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-300" />
                  <p>
                    Conflicts with <strong>{formScheduleConflict.movie_title}</strong> on{" "}
                    <strong>{formScheduleConflict.screen_name}</strong> at{" "}
                    <strong>{formatTime(formScheduleConflict.starts_at)}</strong>
                    {formScheduleConflict.format ? ` (${formScheduleConflict.format})` : ""}. Change
                    the screen or time before saving.
                  </p>
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={modalLabelClass}>
                    Audio Language
                  </label>
                  <select
                    {...register("language")}
                    className={modalInputClass}
                  >
                    {movieLanguageOptions.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                  {activeMovieForForm?.languages && activeMovieForForm.languages.length > 1 ? (
                    <p className={modalHelperClass}>
                      Languages from this movie — pick one for this showtime.
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className={modalLabelClass}>Screen Format</label>
                  <select
                    {...register("format")}
                    className={modalInputClass}
                  >
                    {FORMAT_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3.5 text-zinc-900 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <label className="block text-sm font-bold text-zinc-900">
                      Seat Tier Ticket Pricing (ETB) <RequiredMark />
                    </label>
                    <p className="mt-1 text-[12px] leading-snug text-zinc-600">
                      Exact seat tiers auto-loaded from screen layout. Customize ETB prices showtime-wise.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {activeScreenForForm && (
                      <button
                        type="button"
                        onClick={() => handleSyncScreenTiers()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300 transition-colors cursor-pointer"
                        title="Reload tiers from selected screen layout"
                      >
                        <RefreshCw size={12} /> Reload Screen Tiers
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => append({ tier_name: "VIP", price: 300 })}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                    >
                      <Plus size={13} /> Add Tier
                    </button>
                  </div>
                </div>

                {activeScreenForForm && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[11px]">
                    <span className="font-semibold text-rose-600 inline-flex items-center gap-1">
                      <Sparkles size={12} /> Auditorium Tiers:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {extractScreenTierNames(activeScreenForForm).map((tn) => (
                        <span
                          key={tn}
                          className="px-2 py-0.5 rounded-md bg-white border border-zinc-200 text-zinc-800 font-medium"
                        >
                          {tn}
                        </span>
                      ))}
                    </div>
                    <span className="text-zinc-500 sm:ml-auto text-[11px]">
                      Set prices for this specific show
                    </span>
                  </div>
                )}

                {!editingShowtime && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                      Price valid for
                    </label>
                    <select
                      {...register("price_duration")}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30"
                    >
                      {PRICE_DURATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-[12px] leading-snug text-zinc-600">
                      Choosing 1 day / 1 week / etc. applies these tier prices across that window for this movie &amp; screen.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  {fields.map((field, idx) => (
                    <div key={field.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <input
                          {...register(`tier_pricing.${idx}.tier_name`)}
                          placeholder="Tier name (e.g. Regular, Recliner, Couple)"
                          className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30"
                        />
                        <div className="w-[7.5rem] shrink-0 flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 focus-within:border-rose-500 focus-within:ring-1 focus-within:ring-rose-500/30">
                          <span className="text-[11px] font-semibold text-zinc-500">ETB</span>
                          <input
                            type="number"
                            min={0}
                            {...register(`tier_pricing.${idx}.price`, { valueAsNumber: true })}
                            placeholder="0"
                            className="w-full bg-transparent text-xs font-semibold text-zinc-900 focus:outline-none text-right"
                          />
                        </div>
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(idx)}
                            className="shrink-0 p-2 rounded-lg border border-zinc-200 text-zinc-500 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Remove tier"
                            aria-label="Remove tier"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {(errors.tier_pricing?.[idx]?.tier_name || errors.tier_pricing?.[idx]?.price) && (
                        <p className={fieldErrorClass}>
                          {errors.tier_pricing?.[idx]?.tier_name?.message ||
                            errors.tier_pricing?.[idx]?.price?.message}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                {typeof errors.tier_pricing?.message === "string" && (
                  <p className={fieldErrorClass}>{errors.tier_pricing.message}</p>
                )}
              </div>
              </div>

              <div className="shrink-0 flex items-center justify-end gap-3 border-t border-zinc-200 bg-white px-5 sm:px-6 py-3.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || updating || Boolean(formScheduleConflict)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-xl text-white bg-[#e11d48] hover:bg-[#be123c] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {creating || updating ? "Saving…" : editingShowtime ? "Update Showtime" : "Publish Showtime"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(statusConfirm)}
        title={
          statusConfirm?.action === "disable" ? "Disable showtime?" : "Enable showtime?"
        }
        body={
          statusConfirm?.action === "disable"
            ? `Disable "${statusConfirm.showtime.movie_title}" at ${formatTime(
                statusConfirm.showtime.starts_at
              )} on ${displayScreenName(statusConfirm.showtime.screen_name)}? Customers will no longer see this show.`
            : `Enable "${statusConfirm?.showtime.movie_title}" at ${formatTime(
                statusConfirm?.showtime.starts_at || ""
              )} on ${displayScreenName(statusConfirm?.showtime.screen_name)}? It will appear for customers again.`
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
    </div>
  );
}
