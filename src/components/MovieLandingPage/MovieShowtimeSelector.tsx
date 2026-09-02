"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  Film,
  MapPin,
  Sparkles,
  Info,
  ChevronRight,
  Ticket,
} from "lucide-react";
import {
  useGetPublicMovieShowtimesQuery,
  type PublicMovieCinemaGroup,
  type PublicMovieShowtimeItem,
} from "@/services/api";
import { toast } from "sonner";

interface Props {
  movieIdOrSlug: string;
  movieTitle: string;
  movieCertificate?: string;
  onSelectShowtime?: (showtime: PublicMovieShowtimeItem, cinema: PublicMovieCinemaGroup) => void;
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

function generateDateOptions(count = 7) {
  const options: Array<{ dateStr: string; dayName: string; dayNumber: string; monthName: string; isToday: boolean }> = [];
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  for (let i = 0; i < count; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const dayName = i === 0 ? "TODAY" : i === 1 ? "TOMORROW" : d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
    const dayNumber = String(d.getDate()).padStart(2, "0");
    const monthName = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();

    options.push({
      dateStr,
      dayName,
      dayNumber,
      monthName,
      isToday: i === 0,
    });
  }
  return options;
}

export default function MovieShowtimeSelector({
  movieIdOrSlug,
  movieTitle,
  movieCertificate,
  onSelectShowtime,
}: Props) {
  const router = useRouter();
  const dateOptions = useMemo(() => generateDateOptions(7), []);
  const [selectedDate, setSelectedDate] = useState<string>(dateOptions[0].dateStr);
  const [selectedCity, setSelectedCity] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const stored = localStorage.getItem("selected_city") || "";
    return stored && stored !== "All Cities" ? stored : "";
  });

  useEffect(() => {
    const handleCitySync = () => {
      const stored = localStorage.getItem("selected_city") || "";
      setSelectedCity(stored && stored !== "All Cities" ? stored : "");
    };
    handleCitySync();
    window.addEventListener("selected_city_changed", handleCitySync);
    return () => window.removeEventListener("selected_city_changed", handleCitySync);
  }, []);

  const { data, isLoading, isFetching } = useGetPublicMovieShowtimesQuery({
    idOrSlug: movieIdOrSlug,
    date: selectedDate,
    city_slug: selectedCity || undefined,
  });

  const cinemas = data?.cinemas ?? [];
  const availableDates = data?.available_dates ?? [];

  const handleShowtimeClick = (showtime: PublicMovieShowtimeItem, cinema: PublicMovieCinemaGroup) => {
    if (onSelectShowtime) {
      onSelectShowtime(showtime, cinema);
      return;
    }
    router.push(`/movies/book/${showtime.id}`);
  };

  return (
    <div className="w-full space-y-6">
      {/* Date Selector Navigation Bar */}
      <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-3 sm:p-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {dateOptions.map((opt) => {
            const active = opt.dateStr === selectedDate;
            const hasShows = availableDates.includes(opt.dateStr);

            return (
              <button
                key={opt.dateStr}
                type="button"
                onClick={() => setSelectedDate(opt.dateStr)}
                className={`relative flex flex-col items-center justify-center min-w-[76px] sm:min-w-[88px] py-2.5 px-3 rounded-xl border transition-all duration-200 shrink-0 cursor-pointer ${
                  active
                    ? "bg-gradient-to-r from-[#F84464] to-[#6900AA] text-white border-transparent shadow-lg shadow-[#F84464]/20 scale-105"
                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {hasShows && !active && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow shadow-emerald-400/50" />
                )}
                <span className="text-[10px] font-bold tracking-wider opacity-80">{opt.dayName}</span>
                <span className="text-lg sm:text-xl font-extrabold my-0.5">{opt.dayNumber}</span>
                <span className="text-[10px] font-semibold opacity-70">{opt.monthName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* City Context Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <div className="flex items-center gap-1.5 text-white/70">
          <MapPin size={14} className="text-[#F84464]" />
          <span>
            {selectedCity ? (
              <>
                City: <strong className="text-white">{selectedCity}</strong>
              </>
            ) : (
              <>City: <strong className="text-white">All Cities</strong></>
            )}
          </span>
        </div>
        {selectedCity ? (
          <button
            type="button"
            onClick={() => setSelectedCity("")}
            className="text-xs text-rose-400 hover:text-rose-300 underline font-medium cursor-pointer"
          >
            Show All Cities
          </button>
        ) : null}
      </div>

      {/* Showtimes Content */}
      {isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center text-white/60">
          Loading screening cinemas and showtimes…
        </div>
      ) : cinemas.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-10 text-center space-y-3">
          <Film size={36} className="mx-auto text-white/40" />
          <h3 className="text-lg font-bold text-white">No shows available for {selectedCity || selectedDate}</h3>
          <p className="text-xs text-white/60 max-w-md mx-auto">
            {selectedCity
              ? `No cinemas in ${selectedCity} have scheduled showtimes for ${selectedDate}.`
              : `Cinemas haven't published showtimes for ${selectedDate} yet.`}
          </p>
          {availableDates.length > 0 && (
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-white/70">Shows available on:</span>
              {availableDates.map((dStr) => {
                return (
                  <button
                    key={dStr}
                    type="button"
                    onClick={() => setSelectedDate(dStr)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 cursor-pointer transition-colors"
                  >
                    {dStr}
                  </button>
                );
              })}
            </div>
          )}
          {selectedCity && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSelectedCity("")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#F84464] to-[#6900AA] text-white text-xs font-bold shadow hover:opacity-95 transition-opacity cursor-pointer"
              >
                View Showtimes in All Cities
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-white/60 px-1">
            <span>
              Available at <strong>{cinemas.length}</strong> cinema{cinemas.length !== 1 ? "s" : ""}
            </span>
            {isFetching && <span className="text-rose-400 animate-pulse">Updating shows…</span>}
          </div>

          <div className="space-y-4">
            {cinemas.map((cinema) => (
              <div
                key={cinema.id}
                className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur-md p-5 sm:p-6 transition-all hover:border-white/20 space-y-4"
              >
                {/* Cinema Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3.5">
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <Sparkles size={16} className="text-[#F84464]" />
                      {cinema.name}
                    </h3>
                    {cinema.address && (
                      <p className="text-xs text-white/60 flex items-center gap-1.5">
                        <MapPin size={12} className="text-white/40 shrink-0" />
                        {cinema.address}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-white/70">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                      M-Ticket Available
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/80 font-semibold">
                      Food & Beverage
                    </span>
                  </div>
                </div>

                {/* Showtimes Chips */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {cinema.showtimes.map((st) => {
                    const timeStr = formatTime(st.starts_at);
                    const minPrice = st.min_price || (st.tier_pricing?.[0]?.price ?? null);

                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleShowtimeClick(st, cinema)}
                        className="group relative flex flex-col items-center justify-center rounded-xl border border-white/15 bg-white/5 hover:bg-white/15 px-4 py-2.5 transition-all duration-200 hover:border-rose-500/60 hover:scale-105"
                      >
                        <span className="text-sm font-bold text-white group-hover:text-rose-300 transition-colors">
                          {timeStr}
                        </span>

                        <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-white/70">
                          <span className="uppercase">{st.format}</span>
                          <span>•</span>
                          <span>{st.language}</span>
                        </div>

                        {minPrice !== null && (
                          <span className="mt-1 text-[10px] text-emerald-400 font-bold">
                            from {minPrice} ETB
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
