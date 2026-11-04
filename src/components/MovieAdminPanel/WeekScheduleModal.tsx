"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarRange, Loader2, X } from "lucide-react";
import {
  useCreatePartnerMovieShowtimeMutation,
  type CinemaScreen,
  type Movie,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { isVenueWallTimeReached } from "@/lib/dateFormat";
import { buildScreenTierPricing } from "@/lib/cinemaSeatTypes";
import { defaultStartTimeForDate, formatDateHeader, shiftYmd } from "./showtimeHelpers";

const FORMAT_OPTIONS = ["2D", "3D", "IMAX 2D", "IMAX 3D", "4DX", "Dolby Cinema", "ScreenX"];

const labelCls = "block text-xs font-semibold text-slate-600 mb-1.5";
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-500/20";

interface WeekScheduleModalProps {
  open: boolean;
  bizId: string;
  /** First day of the week; the modal offers this date and the next 6 days */
  startDate: string;
  screens: CinemaScreen[];
  catalogMovies: Movie[];
  defaultScreenId?: string;
  onClose: () => void;
}

interface TierRow {
  tier_name: string;
  price: number;
}

export default function WeekScheduleModal(props: WeekScheduleModalProps) {
  // Remount on every open so the form starts fresh
  if (!props.open) return null;
  return <WeekScheduleForm key={`${props.startDate}-${props.defaultScreenId || ""}`} {...props} />;
}

function WeekScheduleForm({
  bizId,
  startDate,
  screens,
  catalogMovies,
  defaultScreenId,
  onClose,
}: WeekScheduleModalProps) {
  const initialScreen = screens.find((s) => s.id === defaultScreenId) ?? screens[0];
  const initialMovie = catalogMovies[0];

  const [movieId, setMovieId] = useState(initialMovie?.id || "");
  const [screenId, setScreenId] = useState(initialScreen?.id || "");
  const [startTime, setStartTime] = useState(defaultStartTimeForDate(startDate));
  const [language, setLanguage] = useState(initialMovie?.languages?.[0] || "English");
  const [format, setFormat] = useState(initialMovie?.formats?.[0] || "2D");
  const [tiers, setTiers] = useState<TierRow[]>(() =>
    buildScreenTierPricing(initialScreen).map((t) => ({ tier_name: t.tier_name, price: Number(t.price) }))
  );
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftYmd(startDate, i)), [startDate]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(days));
  const [running, setRunning] = useState(false);

  const [createShowtime] = useCreatePartnerMovieShowtimeMutation();

  const movie = catalogMovies.find((m) => m.id === movieId);
  const languageOptions = movie?.languages?.length ? movie.languages : ["English", "Amharic"];

  const changeMovie = (id: string) => {
    setMovieId(id);
    const next = catalogMovies.find((m) => m.id === id);
    if (next?.languages?.length) setLanguage(next.languages[0]);
    if (next?.formats?.length) setFormat(next.formats[0]);
  };

  const changeScreen = (id: string) => {
    setScreenId(id);
    const next = screens.find((s) => s.id === id);
    if (next) setTiers(buildScreenTierPricing(next, tiers).map((t) => ({ tier_name: t.tier_name, price: Number(t.price) })));
  };

  const toggleDay = (day: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });

  const submit = async () => {
    if (!movieId || !screenId) {
      toast.error("Choose a movie and a screen.");
      return;
    }
    if (picked.size === 0) {
      toast.error("Choose at least one day.");
      return;
    }
    if (tiers.some((t) => !t.tier_name.trim() || !(Number(t.price) >= 0))) {
      toast.error("Set a price for every seat type.");
      return;
    }
    setRunning(true);
    let created = 0;
    const problems: string[] = [];
    for (const day of days.filter((d) => picked.has(d))) {
      const startsAt = `${day}T${startTime}:00`;
      if (isVenueWallTimeReached(startsAt)) {
        problems.push(`${formatDateHeader(day)}: time has already passed`);
        continue;
      }
      try {
        await createShowtime({
          bizId,
          body: {
            movie_id: movieId,
            cinema_screen_id: screenId,
            starts_at: startsAt,
            language,
            format,
            tier_pricing: tiers.map((t) => ({ tier_name: t.tier_name.trim(), price: Number(t.price) })),
            price_duration: "showtime",
          },
        }).unwrap();
        created += 1;
      } catch (err) {
        problems.push(`${formatDateHeader(day)}: ${extractApiError(err, "could not be scheduled")}`);
      }
    }
    setRunning(false);
    if (created > 0) toast.success(`${created} show${created === 1 ? "" : "s"} scheduled`);
    if (problems.length > 0) {
      toast.error(problems.slice(0, 3).join(" · ") + (problems.length > 3 ? ` (+${problems.length - 3} more)` : ""));
    }
    if (created > 0 && problems.length === 0) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm">
      <div className="flex w-full max-w-xl max-h-[min(92dvh,920px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200 px-5 sm:px-6 pt-5 pb-4">
          <div className="min-w-0 pr-3">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <CalendarRange size={18} className="text-[#e11d48] shrink-0" /> Schedule for the week
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Create the same show on several days and set the ticket price for all of them at once.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 sm:px-6 py-4">
          <div>
            <label className={labelCls}>Movie</label>
            <select value={movieId} onChange={(e) => changeMovie(e.target.value)} className={inputCls}>
              {catalogMovies.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} {m.duration_minutes ? `(${m.duration_minutes} min)` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Screen</label>
            <select value={screenId} onChange={(e) => changeScreen(e.target.value)} className={inputCls}>
              {screens.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.screen_type?.toUpperCase() || "STANDARD"}) · Capacity: {s.capacity || "N/A"}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Start time</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Audio language</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls}>
                {languageOptions.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Format</label>
              <select value={format} onChange={(e) => setFormat(e.target.value)} className={inputCls}>
                {FORMAT_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-600">Days</label>
              <span className="flex gap-3 text-[11px] font-semibold">
                <button type="button" className="text-[#e11d48] hover:underline cursor-pointer" onClick={() => setPicked(new Set(days))}>
                  All 7 days
                </button>
                <button type="button" className="text-slate-500 hover:underline cursor-pointer" onClick={() => setPicked(new Set())}>
                  Clear
                </button>
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {days.map((day) => {
                const on = picked.has(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`rounded-xl border px-2.5 py-2 text-left text-xs font-semibold cursor-pointer ${
                      on ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {formatDateHeader(day)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Ticket price for all these shows (ETB)</p>
              <p className="text-[12px] text-slate-500 mt-0.5">
                One price per seat type. You can still change the price of a single show later.
              </p>
            </div>
            {tiers.length === 0 ? (
              <p className="text-xs text-amber-700">This screen has no seat types yet.</p>
            ) : (
              tiers.map((tier, idx) => (
                <div key={tier.tier_name + idx} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{tier.tier_name}</span>
                  <div className="w-36 flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 focus-within:border-rose-500">
                    <span className="text-[11px] font-semibold text-slate-500">ETB</span>
                    <input
                      type="number"
                      min={0}
                      value={Number.isFinite(tier.price) ? tier.price : ""}
                      onChange={(e) =>
                        setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, price: Number(e.target.value) } : t)))
                      }
                      className="w-full bg-transparent text-sm font-semibold text-slate-900 focus:outline-none text-right"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 sm:px-6 py-3.5">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer">
            Cancel
          </button>
          <button
            type="button"
            disabled={running || picked.size === 0}
            onClick={() => void submit()}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-xl text-white bg-[#e11d48] hover:bg-[#be123c] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {running && <Loader2 size={14} className="animate-spin" />}
            {running ? "Scheduling…" : `Schedule ${picked.size} show${picked.size === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
