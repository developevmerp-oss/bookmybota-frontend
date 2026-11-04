"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { toast } from "sonner";
import { Plus, Trash2, Sparkles, AlertCircle, RefreshCw, Search, Film, Check } from "lucide-react";
import {
  useCreatePartnerMovieShowtimeMutation,
  useUpdatePartnerMovieShowtimeMutation,
  type CinemaScreen,
  type Movie,
  type MovieShowtime,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { isVenueWallTimeReached, venueDateStr, venueTimeStr } from "@/lib/dateFormat";
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
import {
  DEFAULT_DURATION_MINUTES,
  SHOW_BUFFER_MINUTES,
  addMinutesWall,
  defaultStartTimeForDate,
  findScreenScheduleConflict,
  formatDateHeader,
  formatTime,
  parseIsoDateAndHours,
  shiftYmd,
  uniqueTrimmedStrings,
} from "./showtimeHelpers";

const FORMAT_OPTIONS = ["2D", "3D", "IMAX 2D", "IMAX 3D", "4DX", "Dolby Cinema", "ScreenX"];
/** Used only when the selected movie has no languages configured. */
const FALLBACK_LANGUAGE_OPTIONS = ["English", "Amharic"];

const fieldErrorClass = "mt-1.5 text-xs text-rose-600 font-medium";
const modalLabelClass = "block text-xs font-semibold text-slate-600 mb-1.5";
const modalInputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-500/20";
const modalHelperClass = "mt-1 text-[11px] text-slate-500";

/** How many consecutive days a new show is created for, starting on the chosen date */
const REPEAT_OPTIONS = [
  { value: "showtime", label: "This day only", days: 1 },
  { value: "1_week", label: "1 week (7 days)", days: 7 },
  { value: "2_weeks", label: "2 weeks (14 days)", days: 14 },
  { value: "1_month", label: "1 month (30 days)", days: 30 },
] as const;

function repeatDaysFor(value?: string | null): number {
  return REPEAT_OPTIONS.find((o) => o.value === value)?.days ?? 1;
}

function RequiredMark() {
  return <span className="text-rose-500">*</span>;
}

/** Open the modal by passing a request; `key` must change on every open so the form resets. */
export interface ShowtimeFormRequest {
  key: number;
  showtime: MovieShowtime | null;
  movieId?: string;
  screenId?: string;
}

interface ShowtimeFormModalProps {
  request: ShowtimeFormRequest | null;
  bizId: string;
  /** Date currently shown on the page; used as the default for new shows */
  selectedDate: string;
  screens: CinemaScreen[];
  catalogMovies: Movie[];
  /** Shows already loaded for the day, used for the same-screen overlap check */
  showtimes: MovieShowtime[];
  onClose: () => void;
  onSaved?: (showtime: MovieShowtime | null) => void;
}

export default function ShowtimeFormModal({
  request,
  bizId,
  selectedDate,
  screens,
  catalogMovies,
  showtimes,
  onClose,
  onSaved,
}: ShowtimeFormModalProps) {
  const editingShowtime = request?.showtime ?? null;
  const [movieQuery, setMovieQuery] = useState("");
  const [creatingMany, setCreatingMany] = useState(false);
  const todayStr = useMemo(() => venueDateStr(), []);

  const [createShowtime, { isLoading: creating }] = useCreatePartnerMovieShowtimeMutation();
  const [updateShowtime, { isLoading: updating }] = useUpdatePartnerMovieShowtimeMutation();

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
    defaultValues: emptyMovieShowtimeFormValues({ show_date: selectedDate || todayStr }),
    mode: "onSubmit",
    context: { originalStartsAt: editingShowtime?.starts_at ?? null },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "tier_pricing" });

  const formMovieId = watch("movie_id");
  const formScreenId = watch("cinema_screen_id");
  const formShowDate = watch("show_date");
  const formStartTime = watch("start_time");
  const formLanguageValue = watch("language");
  const lastSyncedScreenIdRef = useRef<string>("");

  // Fill the form each time the modal is opened
  useEffect(() => {
    if (!request) return;
    setMovieQuery("");
    const st = request.showtime;
    if (st) {
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
      return;
    }
    const initialScreen = screens.find((s) => s.id === request.screenId) ?? screens[0];
    // No movie is pre-selected unless the Movies page sent one
    const movie = catalogMovies.find((m) => m.id === request.movieId);
    lastSyncedScreenIdRef.current = initialScreen?.id || "";
    const createDate = selectedDate || todayStr;
    reset(
      emptyMovieShowtimeFormValues({
        movie_id: movie?.id || "",
        cinema_screen_id: initialScreen?.id || "",
        show_date: createDate,
        start_time: defaultStartTimeForDate(createDate),
        language: movie?.languages?.[0] || "English",
        format: movie?.formats?.[0] || "2D",
        tier_pricing: buildScreenTierPricing(initialScreen),
        price_duration: "showtime",
      })
    );
    // Only re-run when the modal is opened again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.key]);

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
  }, [formScreenId, formShowDate, formStartTime, formMovieId, catalogMovies, showtimes, editingShowtime?.id]);

  const handleSyncScreenTiers = (screenId?: string) => {
    const targetScreenId = screenId || formScreenId;
    const targetScreen = screens.find((s) => s.id === targetScreenId);
    if (!targetScreen) return;
    const tiers = buildScreenTierPricing(targetScreen, getValues("tier_pricing"));
    setValue("tier_pricing", tiers, { shouldValidate: true });
    lastSyncedScreenIdRef.current = targetScreenId;
  };

  // When the screen changes in create mode, load that screen's seat tiers
  useEffect(() => {
    if (!request || !formScreenId || editingShowtime) return;
    if (lastSyncedScreenIdRef.current === formScreenId) return;
    const targetScreen = screens.find((s) => s.id === formScreenId);
    if (targetScreen) {
      const tiers = buildScreenTierPricing(targetScreen, getValues("tier_pricing"));
      setValue("tier_pricing", tiers, { shouldValidate: true });
      lastSyncedScreenIdRef.current = formScreenId;
    }
  }, [request, formScreenId, screens, editingShowtime, setValue, getValues]);

  // When the movie changes in create mode, use its first language and format
  useEffect(() => {
    if (!request || !formMovieId || editingShowtime) return;
    const selectedMovie = catalogMovies.find((m) => m.id === formMovieId);
    if (!selectedMovie) return;
    if (selectedMovie.languages?.length) setValue("language", selectedMovie.languages[0]);
    if (selectedMovie.formats?.length) setValue("format", selectedMovie.formats[0]);
  }, [request, formMovieId, catalogMovies, editingShowtime, setValue]);

  const activeMovieForForm = catalogMovies.find((m) => m.id === formMovieId);
  const activeScreenForForm = screens.find((s) => s.id === formScreenId);

  const movieLanguageOptions = useMemo(() => {
    const fromMovie = uniqueTrimmedStrings(activeMovieForForm?.languages);
    const opts = fromMovie.length > 0 ? [...fromMovie] : [...FALLBACK_LANGUAGE_OPTIONS];
    const current = String(formLanguageValue || "").trim();
    if (current && !opts.includes(current)) opts.push(current);
    return opts;
  }, [activeMovieForForm?.languages, formLanguageValue]);

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
      const unchanged = !!orig && orig[1] === values.show_date && orig[2] === values.start_time;
      if (!unchanged) {
        toast.error("Cannot schedule a showtime in the past. Choose a future start time.");
        return;
      }
    }
    const duration =
      catalogMovies.find((m) => m.id === values.movie_id)?.duration_minutes || DEFAULT_DURATION_MINUTES;
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

    const repeatDays = editingShowtime ? 1 : repeatDaysFor(values.price_duration);
    const payload = {
      movie_id: values.movie_id,
      cinema_screen_id: values.cinema_screen_id,
      starts_at: startsAt,
      language: values.language?.trim() || "English",
      format: values.format?.trim() || "2D",
      tier_pricing: (values.tier_pricing || [])
        .filter((t) => t.tier_name && Number(t.price) >= 0)
        .map((t) => ({ tier_name: t.tier_name, price: Number(t.price) })),
      // Prices live on each show; repeating creates one show per day instead of a price window
      price_duration: "showtime",
    };

    try {
      if (editingShowtime) {
        const res = await updateShowtime({ bizId, showtimeId: editingShowtime.id, body: payload }).unwrap();
        toast.success((res as { message?: string })?.message || "Showtime updated successfully!");
        onSaved?.(editingShowtime);
      } else if (repeatDays === 1) {
        const res = await createShowtime({ bizId, body: payload }).unwrap();
        toast.success((res as { message?: string })?.message || "Showtime scheduled successfully!");
        onSaved?.(((res as { data?: MovieShowtime })?.data) ?? null);
      } else {
        setCreatingMany(true);
        let created = 0;
        let first: MovieShowtime | null = null;
        const problems: string[] = [];
        for (let i = 0; i < repeatDays; i += 1) {
          const day = shiftYmd(values.show_date, i);
          const dayStart = `${day}T${values.start_time}:00`;
          if (isVenueWallTimeReached(dayStart)) {
            problems.push(`${formatDateHeader(day)}: time has already passed`);
            continue;
          }
          try {
            const res = await createShowtime({ bizId, body: { ...payload, starts_at: dayStart } }).unwrap();
            created += 1;
            if (!first) first = ((res as { data?: MovieShowtime })?.data) ?? null;
          } catch (err) {
            problems.push(`${formatDateHeader(day)}: ${extractApiError(err, "could not be scheduled")}`);
          }
        }
        setCreatingMany(false);
        if (created > 0) toast.success(`${created} show${created === 1 ? "" : "s"} scheduled`);
        if (problems.length > 0) {
          toast.error(problems.slice(0, 3).join(" · ") + (problems.length > 3 ? ` (+${problems.length - 3} more)` : ""));
        }
        if (created === 0) return;
        onSaved?.(first);
      }
      onClose();
    } catch (err) {
      setCreatingMany(false);
      toast.error(extractApiError(err, "Failed to save showtime"));
    }
  };

  if (!request) return null;

  const query = movieQuery.trim().toLowerCase();
  const visibleMovies = query
    ? catalogMovies.filter((m) => m.title.toLowerCase().includes(query))
    : catalogMovies;
  const repeatCount = editingShowtime ? 1 : repeatDaysFor(watch("price_duration"));
  const busy = creating || updating || creatingMany;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4"
      style={{ background: "rgba(15, 23, 42, 0.55)" }}
    >
      <div className="flex w-full max-w-4xl max-h-[min(92dvh,900px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200 px-5 sm:px-6 pt-5 pb-4">
          <div className="min-w-0 pr-3">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles size={18} className="text-[#e11d48] shrink-0" />
              {editingShowtime ? "Edit Showtime" : "Schedule New Showtime"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeScreenForForm ? (
                <>
                  Screen: <strong className="text-slate-700">{activeScreenForForm.name}</strong>
                  {activeScreenForForm.screen_type ? ` (${activeScreenForForm.screen_type.toUpperCase()})` : ""}
                  {activeScreenForForm.capacity ? ` · ${activeScreenForForm.capacity} seats` : ""}
                </>
              ) : (
                "Pick a movie, start time and ticket prices."
              )}
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer" aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit(onValid)} className="flex min-h-0 flex-1 flex-col" noValidate>
          <input type="hidden" {...register("movie_id")} />
          <input type="hidden" {...register("cinema_screen_id")} />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:overflow-hidden grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_21rem]">
            {/* Left: show details */}
            <div className="min-h-0 space-y-4 px-5 sm:px-6 py-4 lg:overflow-y-auto">
              {activeMovieForForm ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50/60 px-3.5 py-2.5 text-sm">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-rose-600">Movie</span>
                  <div className="font-bold text-slate-900">{activeMovieForForm.title}</div>
                  <div className="text-[11px] text-slate-500">
                    Certificate: <strong>{activeMovieForForm.certificate || "Not specified"}</strong> · Duration:{" "}
                    <strong>{activeMovieForForm.duration_minutes || 120} mins</strong>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 px-3.5 py-3 text-sm text-slate-500">
                  Search and pick a movie from the list on the right <RequiredMark />
                </div>
              )}
              {errors.movie_id && <p className={fieldErrorClass}>{errors.movie_id.message}</p>}

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
                        if (nextDate && currentTime && isVenueWallTimeReached(`${nextDate}T${currentTime}:00`)) {
                          setValue("start_time", defaultStartTimeForDate(nextDate), { shouldValidate: true });
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
                <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-900">
                  <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-600" />
                  <p>
                    Conflicts with <strong>{formScheduleConflict.movie_title}</strong> on{" "}
                    <strong>{formScheduleConflict.screen_name}</strong> at{" "}
                    <strong>{formatTime(formScheduleConflict.starts_at)}</strong>
                    {formScheduleConflict.format ? ` (${formScheduleConflict.format})` : ""}. Change the time before saving.
                  </p>
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={modalLabelClass}>Audio Language</label>
                  <select {...register("language")} className={modalInputClass}>
                    {movieLanguageOptions.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={modalLabelClass}>Screen Format</label>
                  <select {...register("format")} className={modalInputClass}>
                    {FORMAT_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!editingShowtime && (
                <div>
                  <label className={modalLabelClass}>Create this show for</label>
                  <select {...register("price_duration")} className={modalInputClass}>
                    {REPEAT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className={modalHelperClass}>
                    {repeatCount > 1
                      ? `A show at the same time with the same prices is created on each of the next ${repeatCount} days. Days that clash with another show are skipped.`
                      : "Choose a longer period to create the same show on consecutive days."}
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <label className="block text-sm font-bold text-slate-900">
                      Ticket price per seat type (ETB) <RequiredMark />
                    </label>
                    <p className="mt-1 text-[12px] leading-snug text-slate-600">
                      Seat types come from the screen layout. These prices apply to every show created here.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {activeScreenForForm && (
                      <button
                        type="button"
                        onClick={() => handleSyncScreenTiers()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                        title="Reload tiers from the screen layout"
                      >
                        <RefreshCw size={12} /> Reload
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => append({ tier_name: "VIP", price: 300 })}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer"
                    >
                      <Plus size={13} /> Add Tier
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {fields.map((field, idx) => (
                    <div key={field.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <input
                          {...register(`tier_pricing.${idx}.tier_name`)}
                          placeholder="Seat type (e.g. Regular, Premium)"
                          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-500"
                        />
                        <div className="w-[7.5rem] shrink-0 flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 focus-within:border-rose-500">
                          <span className="text-[11px] font-semibold text-slate-500">ETB</span>
                          <input
                            type="number"
                            min={0}
                            {...register(`tier_pricing.${idx}.price`, { valueAsNumber: true })}
                            placeholder="0"
                            className="w-full bg-transparent text-xs font-semibold text-slate-900 focus:outline-none text-right"
                          />
                        </div>
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(idx)}
                            className="shrink-0 p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 cursor-pointer"
                            title="Remove tier"
                            aria-label="Remove tier"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {(errors.tier_pricing?.[idx]?.tier_name || errors.tier_pricing?.[idx]?.price) && (
                        <p className={fieldErrorClass}>
                          {errors.tier_pricing?.[idx]?.tier_name?.message || errors.tier_pricing?.[idx]?.price?.message}
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

            {/* Right: movie search */}
            <div className="min-h-0 flex flex-col border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50/60 px-4 py-4">
              <label className={modalLabelClass}>
                Movie <RequiredMark />
              </label>
              <div className="relative mb-3">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={movieQuery}
                  onChange={(e) => setMovieQuery(e.target.value)}
                  placeholder="Search movie name"
                  className={`${modalInputClass} !pl-9`}
                  aria-label="Search movies"
                />
              </div>
              <div className="min-h-[12rem] max-h-72 lg:max-h-none flex-1 overflow-y-auto space-y-2 pr-1">
                {visibleMovies.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">No movie matches &ldquo;{movieQuery}&rdquo;.</p>
                ) : (
                  visibleMovies.map((m) => {
                    const active = m.id === formMovieId;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setValue("movie_id", m.id, { shouldValidate: true, shouldDirty: true })}
                        className={`w-full flex items-center gap-3 rounded-xl border p-2 text-left transition-colors cursor-pointer ${
                          active ? "border-rose-500 bg-rose-50" : "border-slate-200 bg-white hover:border-rose-300"
                        }`}
                      >
                        <span className="h-16 w-11 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400">
                          {m.poster_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={resolveMediaUrl(m.poster_url)} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Film size={18} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">{m.title}</span>
                          <span className="block text-[11px] text-slate-500">
                            {m.duration_minutes ? `${m.duration_minutes} min` : "Duration n/a"}
                            {m.certificate ? ` · ${m.certificate}` : ""}
                          </span>
                        </span>
                        {active && <Check size={16} className="shrink-0 text-[#e11d48]" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 sm:px-6 py-3.5">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || Boolean(formScheduleConflict)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-xl text-white bg-[#e11d48] hover:bg-[#be123c] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {busy
                ? "Saving…"
                : editingShowtime
                  ? "Update Showtime"
                  : repeatCount > 1
                    ? `Publish ${repeatCount} Shows`
                    : "Publish Showtime"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
