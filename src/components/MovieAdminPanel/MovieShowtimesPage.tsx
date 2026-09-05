"use client";

import { useMemo, useState, useEffect } from "react";
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
  CheckCircle2,
  XCircle,
  Tag,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { useAppSelector } from "@/lib/hooks";
import {
  useGetCinemaScreensQuery,
  useGetPartnerMovieCatalogQuery,
  useGetPartnerMovieShowtimesQuery,
  useCreatePartnerMovieShowtimeMutation,
  useUpdatePartnerMovieShowtimeMutation,
  useDeletePartnerMovieShowtimeMutation,
  type MovieShowtime,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import {
  emptyMovieShowtimeFormValues,
  movieShowtimeFormSchema,
  type MovieShowtimeFormValues,
} from "@/lib/moviePartnerFormSchemas";

const FORMAT_OPTIONS = ["2D", "3D", "IMAX 2D", "IMAX 3D", "4DX", "Dolby Cinema", "ScreenX"];

const fieldErrorClass = "mt-1.5 text-xs text-rose-400 font-medium";

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

function formatTime(iso: string) {
  if (!iso) return "";
  return parseIsoDateAndHours(iso).displayTime;
}

function formatDateHeader(isoDateStr: string) {
  const d = new Date(isoDateStr + "T00:00:00");
  if (isNaN(d.getTime())) return isoDateStr;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const base = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (diffDays === 0) return `Today (${base})`;
  if (diffDays === 1) return `Tomorrow (${base})`;
  if (diffDays === -1) return `Yesterday (${base})`;
  return base;
}

export default function MovieShowtimesPage() {
  const searchParams = useSearchParams();
  const user = useAppSelector((state) => state.auth.user);
  const bizId = user?.business_id || (user as { business?: { id?: string } })?.business?.id || "";

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [screenFilter, setScreenFilter] = useState<string>("");
  const [movieFilter, setMovieFilter] = useState<string>("");

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
  const [urlMovieHandled, setUrlMovieHandled] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<MovieShowtimeFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(movieShowtimeFormSchema) as any,
    defaultValues: emptyMovieShowtimeFormValues({ show_date: todayStr }),
    mode: "onSubmit",
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "tier_pricing",
  });

  const formMovieId = watch("movie_id");
  const formScreenId = watch("cinema_screen_id");

  useEffect(() => {
    const pMovieId = searchParams.get("movie_id");
    if (pMovieId && !editingShowtime && !urlMovieHandled) {
      reset(
        emptyMovieShowtimeFormValues({
          movie_id: pMovieId,
          cinema_screen_id: screens[0]?.id || "",
          show_date: selectedDate || todayStr,
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
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const openCreateModal = () => {
    setEditingShowtime(null);
    reset(
      emptyMovieShowtimeFormValues({
        movie_id: catalogMovies[0]?.id || "",
        cinema_screen_id: screens[0]?.id || "",
        show_date: selectedDate || todayStr,
        start_time: "14:00",
        language: "English",
        format: "2D",
        tier_pricing: [
          { tier_name: "VIP", price: 350 },
          { tier_name: "Standard", price: 200 },
        ],
      })
    );
    setModalOpen(true);
  };

  const openEditModal = (st: MovieShowtime) => {
    setEditingShowtime(st);
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

    const payload = {
      movie_id: values.movie_id,
      cinema_screen_id: values.cinema_screen_id,
      starts_at: `${values.show_date}T${values.start_time}:00`,
      language: values.language?.trim() || "English",
      format: values.format?.trim() || "2D",
      tier_pricing: (values.tier_pricing || [])
        .filter((t) => t.tier_name && Number(t.price) >= 0)
        .map((t) => ({ tier_name: t.tier_name, price: Number(t.price) })),
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

  const handleToggleActive = async (st: MovieShowtime) => {
    try {
      const res = await updateShowtime({
        bizId,
        showtimeId: st.id,
        body: { is_active: !st.is_active },
      }).unwrap();
      toast.success(
        (res as { message?: string })?.message || (st.is_active ? "Showtime disabled" : "Showtime enabled")
      );
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

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar size={22} className="text-rose-400" /> Showtime Schedule
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Schedule catalog movies onto your screens, configure show languages, formats, and ticket tier pricing.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          disabled={screens.length === 0 || catalogMovies.length === 0}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto py-2.5 px-4 text-sm font-semibold rounded-xl"
        >
          <Plus size={18} /> Schedule Show
        </button>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            className="p-2 rounded-xl border border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Previous Day"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
            <Calendar size={16} className="text-rose-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white text-sm font-semibold focus:outline-none cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={() => shiftDate(1)}
            className="p-2 rounded-xl border border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Next Day"
          >
            <ChevronRight size={18} />
          </button>

          <button
            type="button"
            onClick={() => setSelectedDate(todayStr)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold transition-colors ${
              selectedDate === todayStr
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                : "border-white/10 text-zinc-400 hover:text-white"
            }`}
          >
            Today
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={screenFilter}
            onChange={(e) => setScreenFilter(e.target.value)}
            className="bg-zinc-900 border border-white/10 text-zinc-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-rose-500"
          >
            <option value="">All Screens</option>
            {screens.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.screen_type?.toUpperCase() || "STANDARD"})
              </option>
            ))}
          </select>

          <select
            value={movieFilter}
            onChange={(e) => setMovieFilter(e.target.value)}
            className="bg-zinc-900 border border-white/10 text-zinc-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-rose-500 max-w-[200px]"
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
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-200 text-sm">
          <p className="font-semibold mb-1">No cinema screens configured yet.</p>
          <p className="text-xs text-amber-300/80">
            Please create your cinema screens in the <strong>Screens</strong> tab first before scheduling shows.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="glass-panel rounded-2xl border border-white/10 p-12 text-center text-zinc-400">
          Loading schedule…
        </div>
      ) : showtimes.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-white/10 p-12 text-center space-y-3">
          <Film size={36} className="mx-auto text-zinc-500" />
          <h3 className="text-base font-semibold text-zinc-200">
            No showtimes scheduled for {formatDateHeader(selectedDate)}
          </h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Click &quot;Schedule Show&quot; to add movie showtimes for this date.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            disabled={screens.length === 0 || catalogMovies.length === 0}
            className="btn-primary inline-flex items-center gap-1.5 py-2 px-4 text-xs font-semibold rounded-xl mt-2"
          >
            <Plus size={15} /> Schedule First Show
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span>
              Showing <strong>{showtimes.length}</strong> show{showtimes.length !== 1 ? "s" : ""} on{" "}
              {formatDateHeader(selectedDate)}
            </span>
            {isFetching && <span className="text-rose-400 animate-pulse">Refreshing…</span>}
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {showtimes.map((st) => {
              const startStr = formatTime(st.starts_at);
              const endStr = st.ends_at ? formatTime(st.ends_at) : "";

              return (
                <div
                  key={st.id}
                  className={`glass-panel rounded-2xl border transition-all p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                    st.is_active
                      ? "border-white/10 bg-zinc-900/60 hover:border-white/20"
                      : "border-white/5 bg-zinc-950/40 opacity-60"
                  }`}
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-14 h-20 rounded-lg overflow-hidden bg-zinc-800 shrink-0 border border-white/10">
                      {st.movie_poster_url ? (
                        <img
                          src={resolveMediaUrl(st.movie_poster_url)}
                          alt={st.movie_title || "Movie"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600">
                          <Film size={20} />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-bold text-white truncate">{st.movie_title}</h4>
                        {st.movie_certificate && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border border-rose-500/40 bg-rose-500/10 text-rose-300">
                            {st.movie_certificate}
                          </span>
                        )}
                        {!st.is_active && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400">
                            Disabled
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-zinc-400 flex-wrap">
                        <span className="flex items-center gap-1 font-semibold text-rose-300">
                          <Monitor size={13} /> {st.screen_name || "Screen"}
                        </span>
                        <span>•</span>
                        <span className="px-2 py-0.5 rounded bg-white/10 text-zinc-200 font-semibold text-[11px]">
                          {st.format}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white/10 text-zinc-200 font-semibold text-[11px]">
                          {st.language}
                        </span>
                        {st.movie_duration_minutes ? (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-zinc-400">
                              <Clock size={12} /> {st.movie_duration_minutes}m
                            </span>
                          </>
                        ) : null}
                      </div>

                      {st.tier_pricing && st.tier_pricing.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <Tag size={12} className="text-zinc-500" />
                          {st.tier_pricing.map((tp, idx) => (
                            <span
                              key={idx}
                              className="text-[11px] font-medium bg-zinc-800/80 text-zinc-300 border border-white/5 px-2 py-0.5 rounded-md"
                            >
                              {tp.tier_name}: <strong className="text-white">{tp.price} ETB</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto shrink-0 gap-1 bg-white/5 md:bg-transparent p-2.5 md:p-0 rounded-xl">
                    <div className="flex items-center gap-1.5 text-base font-extrabold text-white">
                      <Clock size={16} className="text-rose-400" />
                      <span>{startStr}</span>
                      {endStr && <span className="text-zinc-400 font-normal text-xs">➔ {endStr}</span>}
                    </div>
                    <span className="text-[11px] text-zinc-400">{formatDateHeader(selectedDate)}</span>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(st)}
                      className={`p-2 rounded-xl border transition-colors ${
                        st.is_active
                          ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          : "border-zinc-700 text-zinc-500 hover:bg-zinc-800"
                      }`}
                      title={st.is_active ? "Disable showtime" : "Enable showtime"}
                    >
                      {st.is_active ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(st)}
                      className="p-2 rounded-xl border border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                      title="Edit Showtime"
                    >
                      <Edit2 size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(st)}
                      className="p-2 rounded-xl border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete Showtime"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="glass-panel w-full max-w-xl rounded-2xl border border-white/20 p-6 sm:p-7 space-y-5 bg-zinc-900 text-white shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles size={18} className="text-rose-400" />
                  {editingShowtime ? "Edit Showtime" : "Schedule New Showtime"}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Select film, auditorium screen, start time, and ticket prices per tier.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit(onValid)} className="space-y-4" noValidate>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Select Movie <RequiredMark />
                </label>
                <select
                  {...register("movie_id")}
                  className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
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
                  <p className="mt-1 text-[11px] text-zinc-400 flex items-center gap-2">
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
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Cinema Screen / Auditorium <RequiredMark />
                </label>
                <select
                  {...register("cinema_screen_id")}
                  className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
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
                  <p className="mt-1 text-[11px] text-emerald-400">
                    ✓ Layout Attached: <strong>{activeScreenForForm.layout_name}</strong>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Show Date <RequiredMark />
                  </label>
                  <input
                    type="date"
                    {...register("show_date")}
                    className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
                  />
                  {errors.show_date && <p className={fieldErrorClass}>{errors.show_date.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Start Time <RequiredMark />
                  </label>
                  <input
                    type="time"
                    {...register("start_time")}
                    className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
                  />
                  {errors.start_time && <p className={fieldErrorClass}>{errors.start_time.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Audio Language</label>
                  <input
                    {...register("language")}
                    placeholder="e.g. English, Amharic"
                    className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Screen Format</label>
                  <select
                    {...register("format")}
                    className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
                  >
                    {FORMAT_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-zinc-200">
                      Seat Tier Ticket Pricing (ETB) <RequiredMark />
                    </label>
                    <p className="text-[11px] text-zinc-400">
                      Set prices for seat categories configured in the layout.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => append({ tier_name: "Premium", price: 250 })}
                    className="text-xs text-rose-400 hover:text-rose-300 font-semibold inline-flex items-center gap-1"
                  >
                    <Plus size={14} /> Add Tier
                  </button>
                </div>

                <div className="space-y-2.5">
                  {fields.map((field, idx) => (
                    <div key={field.id} className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <input
                          {...register(`tier_pricing.${idx}.tier_name`)}
                          placeholder="Tier name (e.g. VIP, Standard)"
                          className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                        />
                        <div className="w-32 flex items-center gap-1 bg-zinc-800 border border-white/10 rounded-lg px-2.5 py-1.5">
                          <span className="text-[11px] text-zinc-400">ETB</span>
                          <input
                            type="number"
                            min={0}
                            {...register(`tier_pricing.${idx}.price`, { valueAsNumber: true })}
                            placeholder="Price"
                            className="w-full bg-transparent text-xs text-white font-semibold focus:outline-none text-right"
                          />
                        </div>
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(idx)}
                            className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg"
                            title="Remove tier"
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

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || updating}
                  className="btn-primary px-5 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5"
                >
                  {creating || updating ? "Saving…" : editingShowtime ? "Update Showtime" : "Publish Showtime"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Cancel Showtime"
        body={`Are you sure you want to remove this showtime for "${deleteTarget?.movie_title}"?`}
        confirmLabel="Remove Showtime"
        danger
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
