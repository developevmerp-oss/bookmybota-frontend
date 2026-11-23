"use client";

import { useMemo, useState } from "react";
import { Film, ListFilter, X } from "lucide-react";
import { useGetPartnerMovieShowtimesQuery, type MovieShowtime } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { formatDate, formatDateTime12h } from "@/lib/dateFormat";
import SearchInput from "@/components/Shared/SearchInput";

const STATUS_TONE: Record<string, string> = {
  SCHEDULED: "bg-sky-50 text-sky-700 border-sky-200",
  RUNNING: "bg-emerald-50 text-emerald-700 border-emerald-200",
  COMPLETED: "bg-slate-100 text-slate-600 border-slate-200",
  CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
};

const selectCls =
  "h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-400";

/** Movies this cinema has put shows on. Shows open in a popup with filters. */
export default function PartnerMovieCatalogTab({ businessId }: { businessId: string }) {
  const [q, setQ] = useState("");
  const [openMovieId, setOpenMovieId] = useState<string | null>(null);
  const [screenFilter, setScreenFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [formatFilter, setFormatFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const { data, isLoading } = useGetPartnerMovieShowtimesQuery({
    bizId: businessId,
    ...(q.trim() ? { q: q.trim() } : {}),
  });

  const groups = useMemo(() => {
    const map = new Map<string, { movie: MovieShowtime; shows: MovieShowtime[] }>();
    for (const s of data || []) {
      const g = map.get(s.movie_id);
      if (g) g.shows.push(s);
      else map.set(s.movie_id, { movie: s, shows: [s] });
    }
    return Array.from(map.values()).map((g) => ({
      ...g,
      shows: [...g.shows].sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at))),
    }));
  }, [data]);

  const openGroup = groups.find((g) => g.movie.movie_id === openMovieId) || null;

  const screens = useMemo(
    () =>
      Array.from(new Set((openGroup?.shows || []).map((s) => s.screen_name).filter(Boolean))).sort() as string[],
    [openGroup]
  );
  const languages = useMemo(
    () => Array.from(new Set((openGroup?.shows || []).map((s) => s.language).filter(Boolean))).sort() as string[],
    [openGroup]
  );
  const formats = useMemo(
    () => Array.from(new Set((openGroup?.shows || []).map((s) => s.format).filter(Boolean))).sort() as string[],
    [openGroup]
  );

  const filteredShows = useMemo(() => {
    if (!openGroup) return [];
    return openGroup.shows.filter((s) => {
      if (screenFilter && s.screen_name !== screenFilter) return false;
      if (languageFilter && s.language !== languageFilter) return false;
      if (formatFilter && s.format !== formatFilter) return false;
      if (statusFilter === "DISABLED" && s.is_active) return false;
      if (statusFilter && statusFilter !== "DISABLED" && (!s.is_active || s.status !== statusFilter)) return false;
      if (dateFilter && String(s.starts_at).slice(0, 10) !== dateFilter) return false;
      return true;
    });
  }, [openGroup, screenFilter, languageFilter, formatFilter, statusFilter, dateFilter]);

  const openShows = (movieId: string) => {
    setOpenMovieId(movieId);
    setScreenFilter("");
    setLanguageFilter("");
    setFormatFilter("");
    setStatusFilter("");
    setDateFilter("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Film size={16} className="text-rose-600" /> Movies
          </p>
          <p className="text-xs text-slate-500">Only movies this cinema has scheduled shows for. Open a movie to see its shows.</p>
        </div>
        <div className="w-full sm:w-72">
          <SearchInput value={q} onChange={setQ} placeholder="Search movie, screen, language…" />
        </div>
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center text-sm text-slate-500">
          {q.trim() ? "No movies or shows match your search." : "This cinema has not created any shows yet."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map(({ movie, shows }) => (
            <div key={movie.movie_id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                {movie.movie_poster_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveMediaUrl(movie.movie_poster_url)} alt="" className="h-24 w-16 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-24 w-16 items-center justify-center rounded-lg bg-slate-100">
                    <Film size={20} className="text-slate-300" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-extrabold text-slate-900">{movie.movie_title}</p>
                  <p className="text-xs text-slate-500">
                    {[movie.movie_certificate, movie.movie_duration_minutes ? `${movie.movie_duration_minutes} min` : null, (movie.movie_languages || []).join(", ")]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-600">
                    {shows.length} show{shows.length === 1 ? "" : "s"}
                  </p>
                  <button
                    type="button"
                    onClick={() => openShows(movie.movie_id)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#e11d48] px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
                  >
                    <ListFilter size={13} /> View shows
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {openGroup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpenMovieId(null)}>
          <div
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex min-w-0 items-start gap-3">
                {openGroup.movie.movie_poster_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveMediaUrl(openGroup.movie.movie_poster_url)} alt="" className="h-16 w-11 rounded-lg object-cover" />
                ) : (
                  <div className="h-16 w-11 rounded-lg bg-slate-100" />
                )}
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-extrabold text-slate-900">{openGroup.movie.movie_title}</h3>
                  <p className="text-xs text-slate-500">
                    {openGroup.shows.length} show{openGroup.shows.length === 1 ? "" : "s"} · {filteredShows.length} shown
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setOpenMovieId(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
              <select value={screenFilter} onChange={(e) => setScreenFilter(e.target.value)} className={selectCls} aria-label="Screen">
                <option value="">All screens</option>
                {screens.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)} className={selectCls} aria-label="Language">
                <option value="">All languages</option>
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)} className={selectCls} aria-label="Format">
                <option value="">All formats</option>
                {formats.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls} aria-label="Status">
                <option value="">All statuses</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="DISABLED">Disabled</option>
              </select>
              <label className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700">
                Date
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-transparent text-xs font-semibold focus:outline-none"
                  aria-label="Filter by date"
                />
              </label>
              {(screenFilter || languageFilter || formatFilter || statusFilter || dateFilter) && (
                <button
                  type="button"
                  className="text-xs font-bold text-rose-600 hover:underline"
                  onClick={() => {
                    setScreenFilter("");
                    setLanguageFilter("");
                    setFormatFilter("");
                    setStatusFilter("");
                    setDateFilter("");
                  }}
                >
                  Clear filters
                </button>
              )}
              {dateFilter ? <span className="text-[11px] text-slate-500">{formatDate(dateFilter)}</span> : null}
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
              {filteredShows.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">No shows match these filters.</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-white text-slate-500">
                    <tr>
                      <th className="py-1.5 pr-3 font-semibold">Date & time</th>
                      <th className="py-1.5 pr-3 font-semibold">Screen</th>
                      <th className="py-1.5 pr-3 font-semibold">Language / format</th>
                      <th className="py-1.5 pr-3 font-semibold">Seats sold</th>
                      <th className="py-1.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShows.map((s) => (
                      <tr key={s.id} className="border-t border-slate-100 text-slate-800">
                        <td className="py-1.5 pr-3 whitespace-nowrap">{formatDateTime12h(s.starts_at)}</td>
                        <td className="py-1.5 pr-3">{s.screen_name || "—"}</td>
                        <td className="py-1.5 pr-3">{[s.language, s.format].filter(Boolean).join(" · ") || "—"}</td>
                        <td className="py-1.5 pr-3">
                          {s.seats_sold ?? 0}
                          {s.screen_capacity ? ` / ${s.screen_capacity}` : ""}
                        </td>
                        <td className="py-1.5">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                              s.is_active ? STATUS_TONE[s.status] || "" : "border-slate-200 bg-slate-100 text-slate-500"
                            }`}
                          >
                            {s.is_active ? s.status : "DISABLED"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
