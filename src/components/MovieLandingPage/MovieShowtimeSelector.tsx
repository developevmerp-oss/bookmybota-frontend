"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Film, Heart, MapPin } from "lucide-react";
import {
  useGetPublicMovieShowtimesQuery,
  type PublicMovieCinemaGroup,
  type PublicMovieShowtimeItem,
} from "@/services/api";

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
  const options: Array<{
    dateStr: string;
    dayName: string;
    dayNumber: string;
    monthName: string;
    weekdayShort: string;
    isToday: boolean;
  }> = [];
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  for (let i = 0; i < count; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const dayName =
      i === 0 ? "TODAY" : i === 1 ? "TOMORROW" : d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
    const dayNumber = String(d.getDate());
    const monthName = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
    const weekdayShort = d.toLocaleDateString("en-US", { weekday: "short" });

    options.push({
      dateStr,
      dayName,
      dayNumber,
      monthName,
      weekdayShort,
      isToday: i === 0,
    });
  }
  return options;
}

function cinemaInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "C";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
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

  void movieTitle;
  void movieCertificate;

  return (
    <div className="w-full space-y-4">
      {/* Date strip — line selection, brand purple */}
      <div className="rounded-xl bg-white border border-[#EDE4F7] px-2 py-2 sm:px-3">
        <div className="flex items-stretch gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {dateOptions.map((opt, index) => {
            const active = opt.dateStr === selectedDate;
            const hasShows = availableDates.includes(opt.dateStr);
            return (
              <button
                key={opt.dateStr}
                type="button"
                onClick={() => setSelectedDate(opt.dateStr)}
                className={`relative shrink-0 min-w-[64px] sm:min-w-[72px] px-2.5 py-2.5 text-center transition-colors cursor-pointer border-b-[3px] ${
                  index > 0 ? "border-l border-l-[#F0EAF7]" : ""
                } ${
                  active
                    ? "text-[#6900AA]"
                    : "text-[#4B5563] hover:text-[#6900AA] border-b-transparent"
                }`}
                style={active ? { borderBottomColor: "#6900AA" } : undefined}
              >
                {hasShows && !active ? (
                  <span className="absolute top-1.5 right-2 h-1.5 w-1.5 rounded-full bg-[#6900AA]" />
                ) : null}
                <span className={`block text-[10px] font-bold tracking-wide ${active ? "text-[#6900AA]" : "text-[#9CA3AF]"}`}>
                  {opt.dayName}
                </span>
                <span className="mt-0.5 block text-lg sm:text-xl font-extrabold leading-none">
                  {opt.dayNumber.padStart(2, "0")}
                </span>
                <span className={`mt-1 block text-[10px] font-semibold tracking-wide ${active ? "text-[#6900AA]" : "text-[#9CA3AF]"}`}>
                  {opt.monthName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* City */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-white border border-[#EDE4F7] px-3 py-2.5 sm:px-4 text-[12px] text-[#4B5563]">
        <span className="inline-flex items-center gap-1.5 font-medium text-[#111111]">
          <MapPin size={14} className="text-[#6900AA]" />
          City: <strong>{selectedCity || "All Cities"}</strong>
        </span>
        {selectedCity ? (
          <button
            type="button"
            onClick={() => setSelectedCity("")}
            className="text-[12px] font-semibold text-[#6900AA] hover:underline cursor-pointer"
          >
            Show All Cities
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-[#E8E8E8] bg-white p-12 text-center text-[#6B7280]">
          Loading screening cinemas and showtimes…
        </div>
      ) : cinemas.length === 0 ? (
        <div className="rounded-xl border border-[#E8E8E8] bg-white p-10 text-center space-y-3">
          <Film size={36} className="mx-auto text-[#C4C4C4]" />
          <h3 className="text-lg font-bold text-[#111111]">
            No shows available for {selectedCity || selectedDate}
          </h3>
          <p className="text-xs text-[#6B7280] max-w-md mx-auto">
            {selectedCity
              ? `No cinemas in ${selectedCity} have scheduled showtimes for ${selectedDate}.`
              : `Cinemas haven't published showtimes for ${selectedDate} yet.`}
          </p>
          {availableDates.length > 0 && (
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-[#6B7280]">Shows available on:</span>
              {availableDates.map((dStr) => (
                <button
                  key={dStr}
                  type="button"
                  onClick={() => setSelectedDate(dStr)}
                  className="px-3 py-1.5 rounded-lg bg-[#F5F5F5] hover:bg-[#EFEFEF] text-[#111111] text-xs font-bold border border-[#E5E5E5] cursor-pointer transition-colors"
                >
                  {dStr}
                </button>
              ))}
            </div>
          )}
          {selectedCity && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSelectedCity("")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#111111] text-white text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
              >
                View Showtimes in All Cities
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[#6B7280] px-0.5">
            <span>
              Available at <strong className="text-[#111111]">{cinemas.length}</strong> cinema
              {cinemas.length !== 1 ? "s" : ""}
            </span>
            {isFetching && <span className="text-[#6900AA] animate-pulse">Updating shows…</span>}
          </div>

          <div className="space-y-3">
            {cinemas.map((cinema) => (
              <div
                key={cinema.id}
                className="rounded-xl border border-[#E8E8E8] bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-6">
                  <div className="flex items-start gap-3 min-w-0 lg:w-[280px] xl:w-[320px] shrink-0">
                    <div className="h-11 w-11 shrink-0 rounded-full bg-[#F3E8FF] text-[#6900AA] flex items-center justify-center text-xs font-bold">
                      {cinemaInitials(cinema.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <h3 className="text-[15px] font-bold text-[#111111] leading-snug">{cinema.name}</h3>
                        <span className="mt-0.5 text-[#C4C4C4]" aria-hidden>
                          <Heart size={15} strokeWidth={1.8} />
                        </span>
                      </div>
                      {cinema.address ? (
                        <p className="mt-1 text-[12px] text-[#6B7280] flex items-start gap-1">
                          <MapPin size={12} className="mt-0.5 shrink-0 text-[#9CA3AF]" />
                          <span className="line-clamp-2">{cinema.address}</span>
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-[#9CA3AF]">M-Ticket Available</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 flex-1">
                    {cinema.showtimes.map((st) => {
                      const timeStr = formatTime(st.starts_at);
                      const minPrice = st.min_price || (st.tier_pricing?.[0]?.price ?? null);
                      const formatLabel = [st.format, st.language].filter(Boolean).join(" · ");

                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => handleShowtimeClick(st, cinema)}
                          className="min-w-[96px] rounded-lg border border-[#D4D4D4] bg-white px-3 py-2.5 text-center hover:border-[#6900AA] hover:bg-[#FBF7FF] transition-colors cursor-pointer"
                        >
                          <span className="block text-[13px] font-bold text-[#111111]">{timeStr}</span>
                          {formatLabel ? (
                            <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                              {formatLabel}
                            </span>
                          ) : null}
                          {minPrice !== null ? (
                            <span className="mt-0.5 block text-[10px] font-semibold text-[#059669]">
                              from {minPrice} ETB
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
