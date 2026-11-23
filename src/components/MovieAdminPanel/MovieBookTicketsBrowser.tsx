"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Clapperboard, Clock, Film, Search, X } from "lucide-react";
import { useAppSelector } from "@/lib/hooks";
import { useGetCinemaScreensQuery, useGetPartnerMovieShowtimesQuery, type MovieShowtime } from "@/services/api";
import { isVenueWallTimeReached, venueDateStr } from "@/lib/dateFormat";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import { displayScreenName, formatDateHeader, formatTime, shiftYmd, toYmdLocal } from "./showtimeHelpers";

const card = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const selectCls =
  "h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-400 cursor-pointer";

type DatePreset = "today" | "tomorrow" | "week" | "date";
type DayPart = "" | "morning" | "afternoon" | "evening" | "night";

const DATE_PRESETS: Array<{ id: DatePreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "week", label: "This week" },
];
const DAY_PARTS: Array<{ id: DayPart; label: string }> = [
  { id: "", label: "Any time" },
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
  { id: "evening", label: "Evening" },
  { id: "night", label: "Night" },
];

function chip(active: boolean) {
  return `rounded-full border px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors ${
    active ? "border-[#e11d48] bg-[#e11d48] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-rose-300 hover:text-rose-600"
  }`;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

interface MovieGroup {
  movieId: string;
  title: string;
  poster: string;
  duration?: number | null;
  certificate?: string | null;
  shows: MovieShowtime[];
}

/** Shows grouped by movie, as time pills. Tap a time to open that show's seat layout and book seats. */
export default function MovieBookTicketsBrowser() {
  const user = useAppSelector((state) => state.auth.user);
  const bizId = user?.business_id ?? "";
  const today = useMemo(() => venueDateStr() || toYmdLocal(new Date()), []);

  const [preset, setPreset] = useState<DatePreset>("today");
  const [customDate, setCustomDate] = useState(today);
  const [dayPart, setDayPart] = useState<DayPart>("");
  const [screenId, setScreenId] = useState("");
  const [language, setLanguage] = useState("");
  const [format, setFormat] = useState("");
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 300);

  const dateParams =
    preset === "today"
      ? { date: today }
      : preset === "tomorrow"
        ? { date: shiftYmd(today, 1) }
        : preset === "week"
          ? { date_from: today, date_to: shiftYmd(today, 6) }
          : { date: customDate };

  const { data: screens = [] } = useGetCinemaScreensQuery(bizId, { skip: !bizId });
  // Same days without the other filters, to offer only languages and formats that exist
  const { data: dayShows = [] } = useGetPartnerMovieShowtimesQuery({ bizId, ...dateParams }, { skip: !bizId });
  const languages = useMemo(() => Array.from(new Set(dayShows.map((s) => s.language).filter(Boolean))).sort(), [dayShows]);
  const formats = useMemo(() => Array.from(new Set(dayShows.map((s) => s.format).filter(Boolean))).sort(), [dayShows]);

  const { data: shows = [], isLoading, isFetching } = useGetPartnerMovieShowtimesQuery(
    {
      bizId,
      ...dateParams,
      ...(q ? { q } : {}),
      ...(dayPart ? { time_of_day: dayPart } : {}),
      ...(screenId ? { cinema_screen_id: screenId } : {}),
      ...(language ? { language } : {}),
      ...(format ? { format } : {}),
    },
    { skip: !bizId }
  );

  const groups = useMemo(() => {
    const map = new Map<string, MovieGroup>();
    for (const st of shows) {
      let g = map.get(st.movie_id);
      if (!g) {
        g = {
          movieId: st.movie_id,
          title: st.movie_title || "Movie",
          poster: resolveMediaUrl(st.movie_poster_url || ""),
          duration: st.movie_duration_minutes,
          certificate: st.movie_certificate,
          shows: [],
        };
        map.set(st.movie_id, g);
      }
      g.shows.push(st);
    }
    return Array.from(map.values())
      .map((g) => ({ ...g, shows: [...g.shows].sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at))) }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [shows]);

  const filtersOn = !!(q || dayPart || screenId || language || format);
  const clearFilters = () => {
    setSearch("");
    setDayPart("");
    setScreenId("");
    setLanguage("");
    setFormat("");
  };

  const pill = (st: MovieShowtime) => {
    const capacity = Number(st.screen_capacity) || 0;
    const sold = Number(st.seats_sold) || 0;
    const left = Math.max(0, capacity - sold);
    const started = isVenueWallTimeReached(st.starts_at);
    const off = !st.is_active || st.status === "CANCELLED";
    const soldOut = capacity > 0 && left === 0;
    const closed = started || off || soldOut;
    const label = off ? (st.status === "CANCELLED" ? "Cancelled" : "Disabled") : started ? "Started" : soldOut ? "Sold out" : `${left} left`;
    const body = (
      <>
        <span className="block text-sm font-extrabold leading-tight">{formatTime(st.starts_at)}</span>
        <span className="block text-[10px] opacity-70">
          {st.format || "2D"} · {st.language || "—"}
        </span>
      </>
    );
    return closed ? (
      <span
        key={st.id}
        title={`${displayScreenName(st.screen_name)} · ${label}`}
        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-400 cursor-not-allowed select-none"
      >
        {body}
      </span>
    ) : (
      <Link
        key={st.id}
        href={`/movie/bookings/new?show=${st.id}`}
        title={`${displayScreenName(st.screen_name)} · Open the seat layout and book seats`}
        className="rounded-xl border border-emerald-300 bg-emerald-50/60 px-3 py-2 text-emerald-800 hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
      >
        {body}
      </Link>
    );
  };

  return (
    <div className="space-y-4">
      <div className={`${card} p-4 space-y-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[16rem] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search movie, screen, language, format, time or date…"
              className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-900 focus:outline-none focus:border-rose-400"
              aria-label="Search shows"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                <X size={14} />
              </button>
            )}
          </div>
          <select value={screenId} onChange={(e) => setScreenId(e.target.value)} className={selectCls} aria-label="Screen">
            <option value="">All screens</option>
            {screens.map((s) => (
              <option key={s.id} value={s.id}>
                {displayScreenName(s.name)}
              </option>
            ))}
          </select>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className={selectCls} aria-label="Language">
            <option value="">All languages</option>
            {languages.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <select value={format} onChange={(e) => setFormat(e.target.value)} className={selectCls} aria-label="Format">
            <option value="">All formats</option>
            {formats.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {DATE_PRESETS.map((p) => (
            <button key={p.id} type="button" className={chip(preset === p.id)} onClick={() => setPreset(p.id)}>
              {p.label}
            </button>
          ))}
          <label
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold cursor-pointer ${
              preset === "date" ? "border-[#e11d48] bg-rose-50 text-[#e11d48]" : "border-slate-200 text-slate-600"
            }`}
          >
            <Calendar size={13} />
            <input
              type="date"
              value={customDate}
              onChange={(e) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) {
                  setCustomDate(e.target.value);
                  setPreset("date");
                }
              }}
              className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer [color-scheme:light]"
              aria-label="Pick a date"
            />
          </label>
          <span className="mx-1 h-5 w-px bg-slate-200" />
          {DAY_PARTS.map((p) => (
            <button key={p.id || "any"} type="button" className={chip(dayPart === p.id)} onClick={() => setDayPart(p.id)}>
              {p.label}
            </button>
          ))}
          {filtersOn && (
            <button type="button" onClick={clearFilters} className="ml-auto text-xs font-bold text-[#e11d48] hover:underline">
              Clear filters
            </button>
          )}
        </div>
      </div>

      <p className="px-1 text-xs text-slate-500">
        {isFetching ? "Searching…" : `${shows.length} show${shows.length === 1 ? "" : "s"} · ${groups.length} movie${groups.length === 1 ? "" : "s"}`}
        {preset === "week" ? " in the next 7 days" : ""}
      </p>

      {isLoading ? (
        <AdminListShimmer rows={4} columns={3} showToolbar={false} />
      ) : groups.length === 0 ? (
        <div className={`${card} p-10 text-center text-slate-500`}>
          <Clapperboard size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="font-semibold text-slate-700">No shows match</p>
          <p className="text-sm mt-1">{filtersOn ? "Try clearing a filter." : "Schedule shows under Shows & Seats and they appear here."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const byDate = new Map<string, MovieShowtime[]>();
            g.shows.forEach((st) => {
              const d = String(st.starts_at).slice(0, 10);
              byDate.set(d, [...(byDate.get(d) || []), st]);
            });
            return (
              <div key={g.movieId} className={`${card} p-4 flex flex-col sm:flex-row gap-4`}>
                <div className="shrink-0 w-24 h-36 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                  {g.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.poster} alt={g.title} className="h-full w-full object-cover" />
                  ) : (
                    <Film size={26} className="text-slate-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 truncate">{g.title}</h3>
                    <p className="text-xs text-slate-500 inline-flex items-center gap-2">
                      {g.certificate ? <span className="rounded border border-slate-300 px-1.5 font-bold text-slate-600">{g.certificate}</span> : null}
                      {g.duration ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock size={11} /> {Math.floor(g.duration / 60)}h {g.duration % 60}m
                        </span>
                      ) : null}
                      <span>
                        {g.shows.length} show{g.shows.length === 1 ? "" : "s"}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-3">
                  {Array.from(byDate.entries()).map(([d, list]) => (
                    <div key={d}>
                      {(preset === "week" || byDate.size > 1) && (
                        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">{formatDateHeader(d)}</div>
                      )}
                      <div className="flex flex-wrap gap-2">{list.map(pill)}</div>
                    </div>
                  ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
