"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  ExternalLink,
  Film,
  Heart,
  Loader2,
  MapPin,
  Moon,
  Smartphone,
  Search,
  Sun,
  Sunset,
  CloudMoon,
  TicketX,
  Utensils,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  useGetPublicMoviesQuery,
  useGetPublicRegisteredCinemasQuery,
  useLazyGetPublicMovieShowtimesQuery,
  type Movie,
  type PublicMovieShowtimeItem,
  type PublicRegisteredPartner,
} from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";

const PAGE_BG = "#F4F2F8";
const BRAND = "#6900AA";
const TIME_COLOR = "#C58B00";
const DATE_ACTIVE_GRADIENT =
  "linear-gradient(180deg, #A78BFA 0%, #8B5CF6 38%, #6D28D9 72%, #4C1D95 100%)";

const CINEMA_FACILITIES = [
  { label: "Ticket Cancellation", icon: TicketX },
  { label: "F&B", icon: Utensils },
  { label: "MTicket", icon: Smartphone },
  { label: "Parking Facility", icon: Car },
  { label: "Food Court", icon: UtensilsCrossed },
] as const;

type CinemaMovieRow = {
  movie: Movie;
  languageFormat: string;
  showtimes: PublicMovieShowtimeItem[];
};

const SHOWCASE_BY_ID: Record<
  string,
  { name: string; address: string; description?: string; image?: string }
> = {
  c1: {
    name: "PVR: Palladium Mall, Addis Ababa",
    address: "4th floor, Palladium Mall, Bole Road, Addis Ababa, Ethiopia",
  },
  c2: {
    name: "Cinepolis: City Centre, Addis Ababa",
    address: "City Centre Mall, Mexico Square, Addis Ababa, Ethiopia",
  },
  c3: {
    name: "Edna Mall Cinema, Addis Ababa",
    address: "Edna Mall, Bole Medhanialem, Addis Ababa, Ethiopia",
  },
  c4: {
    name: "Alliance Ethio-Française Cinema",
    address: "Wollo Sefer, Near Mexico, Addis Ababa, Ethiopia",
  },
  c5: {
    name: "Century Cinema: Merkato",
    address: "Merkato Complex, Addis Ababa, Ethiopia",
  },
  c6: {
    name: "Gas Cinema: CMC",
    address: "CMC Michael, Addis Ababa, Ethiopia",
  },
};

function parseIsoDateAndHours(iso: string) {
  if (!iso) return { displayTime: "" };
  const str = String(iso).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (match) {
    const [, , , , hhStr, mmStr] = match;
    const h = parseInt(hhStr, 10);
    const minuteStr = mmStr || "00";
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return {
      displayTime: `${String(h12).padStart(2, "0")}:${minuteStr} ${ampm}`,
    };
  }
  const dateObj = new Date(iso);
  if (isNaN(dateObj.getTime())) return { displayTime: "" };
  const h = dateObj.getHours();
  const minuteStr = String(dateObj.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return {
    displayTime: `${String(h12).padStart(2, "0")}:${minuteStr} ${ampm}`,
  };
}

function formatTime(iso: string) {
  return parseIsoDateAndHours(iso).displayTime;
}

function formatDuration(minutes?: number | null) {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}m`;
  if (m <= 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function generateDateOptions(count = 7) {
  const options: Array<{
    dateStr: string;
    weekdayShort: string;
    dayNumber: string;
    monthName: string;
    isWeekend: boolean;
  }> = [];
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  for (let i = 0; i < count; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const weekdayShort = d.toLocaleDateString("en-US", { weekday: "short" });
    options.push({
      dateStr: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      weekdayShort,
      dayNumber: pad(d.getDate()),
      monthName: d.toLocaleDateString("en-US", { month: "short" }),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    });
  }
  return options;
}

function mapPartnerAddress(v: PublicRegisteredPartner) {
  const cityPart = [v.city_name, v.city_state].filter(Boolean).join(", ");
  return (
    v.address?.trim() ||
    [v.type_name, cityPart].filter(Boolean).join(" · ") ||
    "Address coming soon"
  );
}

function movieLanguageFormat(movie: Movie, showtimes: PublicMovieShowtimeItem[]) {
  const fromShows = new Set<string>();
  showtimes.forEach((st) => {
    const label = [st.language, st.format].filter(Boolean).join(", ");
    if (label) fromShows.add(label);
  });
  if (fromShows.size > 0) return Array.from(fromShows).join(" · ");
  const langs = (movie.languages || []).join(", ");
  const formats = (movie.formats || []).join(", ");
  return [langs, formats].filter(Boolean).join(", ") || "—";
}

function showtimePrice(st: PublicMovieShowtimeItem) {
  return st.min_price ?? st.tier_pricing?.[0]?.price ?? null;
}

/** Visual-only fill hint from showtime hour (no backend change). */
function fillStatus(iso: string): "available" | "filling" | "almost" {
  const match = String(iso).match(/[T ](\d{2}):/);
  const h = match ? parseInt(match[1], 10) : new Date(iso).getHours();
  if (h >= 18 && h < 21) return "filling";
  if (h >= 21) return "almost";
  return "available";
}

const STATUS_DOT: Record<"available" | "filling" | "almost", string> = {
  available: "bg-[#22C55E]",
  filling: "bg-[#EAB308]",
  almost: "bg-[#EF4444]",
};

type FilterOption = { value: string; label: string; hint?: string; icon?: ReactNode };

const PRICE_BAND_OPTIONS: FilterOption[] = [
  { value: "0-200", label: "ETB 0-200" },
  { value: "201-300", label: "ETB 201-300" },
  { value: "301-400", label: "ETB 301-400" },
  { value: "401-500", label: "ETB 401-500" },
  { value: "501-600", label: "ETB 501-600" },
  { value: "601-700", label: "ETB 601-700" },
  { value: "701-800", label: "ETB 701-800" },
  { value: "801+", label: "ETB 801+" },
];

const TIMING_OPTIONS: FilterOption[] = [
  {
    value: "morning",
    label: "Morning",
    hint: "12:00 AM - 11:59 AM",
    icon: <Sun size={18} className="text-[#F59E0B]" />,
  },
  {
    value: "afternoon",
    label: "Afternoon",
    hint: "12:00 PM - 3:59 PM",
    icon: <Sunset size={18} className="text-[#F97316]" />,
  },
  {
    value: "evening",
    label: "Evening",
    hint: "4:00 PM - 6:59 PM",
    icon: <CloudMoon size={18} className="text-[#8B5CF6]" />,
  },
  {
    value: "night",
    label: "Night",
    hint: "7:00 PM - 11:59 PM",
    icon: <Moon size={18} className="text-[#6366F1]" />,
  },
];

function priceInBands(price: number, bands: string[]) {
  if (bands.length === 0) return true;
  return bands.some((band) => {
    if (band === "801+") return price >= 801;
    const [minStr, maxStr] = band.split("-");
    const min = Number(minStr);
    const max = Number(maxStr);
    return price >= min && price <= max;
  });
}

function showHour(iso: string) {
  const match = String(iso).match(/[T ](\d{2}):/);
  if (match) return parseInt(match[1], 10);
  const d = new Date(iso);
  return isNaN(d.getTime()) ? 0 : d.getHours();
}

function matchesPreferredTime(iso: string, bands: string[]) {
  if (bands.length === 0) return true;
  const h = showHour(iso);
  return bands.some((band) => {
    if (band === "morning") return h >= 0 && h < 12;
    if (band === "afternoon") return h >= 12 && h < 16;
    if (band === "evening") return h >= 16 && h < 19;
    if (band === "night") return h >= 19 && h <= 23;
    return true;
  });
}

/** Chip-style filter dropdown — portal menu so sticky/overflow parents never clip it */
function BmsFilterDropdown({
  label,
  values,
  options,
  onChange,
  open,
  onOpenChange,
  icon,
  emptyText = "No options available",
}: {
  label: string;
  values: string[];
  options: FilterOption[];
  onChange: (values: string[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon?: ReactNode;
  emptyText?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; minWidth: number } | null>(
    null
  );

  useEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    const update = () => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const wantsWide = options.some((o) => Boolean(o.icon || o.hint));
      const minWidth = Math.max(rect.width, wantsWide ? 280 : 240);
      let left = rect.left;
      if (left + minWidth > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - minWidth - 8);
      }
      setMenuPos({ top: rect.bottom + 6, left, minWidth });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, options]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onOpenChange]);

  const toggle = (value: string) => {
    if (values.includes(value)) onChange(values.filter((v) => v !== value));
    else onChange([...values, value]);
  };

  const active = open || values.length > 0;

  const menu =
    open && menuPos
      ? createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            aria-multiselectable
            className="fixed z-[200] max-h-[min(20rem,60vh)] overflow-y-auto rounded-xl border border-[#E8E2F2] bg-white py-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              minWidth: menuPos.minWidth,
            }}
          >
            {options.length === 0 ? (
              <li className="px-3.5 py-3 text-[12px] text-[#9CA3AF]">{emptyText}</li>
            ) : (
              options.map((opt) => {
                const checked = values.includes(opt.value);
                return (
                  <li key={opt.value} role="option" aria-selected={checked}>
                    <button
                      type="button"
                      onClick={() => toggle(opt.value)}
                      className="w-full px-3.5 py-2.5 flex items-center gap-3 text-left text-[13px] text-[#333333] hover:bg-[#F7E9FF]/70 cursor-pointer transition-colors"
                    >
                      {opt.icon ? <span className="shrink-0">{opt.icon}</span> : null}
                      <span className="flex-1 min-w-0">
                        <span className="font-semibold block text-[#222222] leading-tight">
                          {opt.label}
                        </span>
                        {opt.hint ? (
                          <span className="block mt-0.5 text-[11px] text-[#9CA3AF] font-normal leading-tight">
                            {opt.hint}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={`h-4 w-4 shrink-0 rounded-[3px] border flex items-center justify-center ${
                          checked
                            ? "border-[#6900AA] bg-[#6900AA] text-white"
                            : "border-[#9CA3AF] bg-white"
                        }`}
                        aria-hidden
                      >
                        {checked ? (
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <path
                              d="M2.5 6.2L4.8 8.5L9.5 3.5"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={`h-9 sm:h-10 px-2.5 sm:px-3.5 inline-flex items-center gap-1.5 sm:gap-2 rounded-full border text-[12px] sm:text-[13px] font-medium cursor-pointer focus:outline-none transition-colors whitespace-nowrap ${
          active
            ? "border-[#6900AA] text-[#6900AA] bg-[#F7E9FF]"
            : "border-[#E8E0F2] text-[#4B5563] bg-white hover:border-[#6900AA]/40"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <span className="truncate max-w-[6.5rem] sm:max-w-[9rem]">
          {values.length > 0 ? `${label} (${values.length})` : label}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""} ${
            active ? "text-[#6900AA]" : "text-[#9CA3AF]"
          }`}
        />
      </button>
      {menu}
    </div>
  );
}

function TicketShowtimeButton({
  st,
  selected,
  onClick,
}: {
  st: PublicMovieShowtimeItem;
  selected: boolean;
  onClick: () => void;
}) {
  const price = showtimePrice(st);
  const status = fillStatus(st.starts_at);
  const screenLabel = st.screen_type || st.format || "";

  return (
    <span
      className={`inline-block transition-[filter] ${
        selected
          ? "[filter:drop-shadow(0_0_0.7px_#6900AA)]"
          : "[filter:drop-shadow(0_0_0.65px_#C4C4C4)] hover:[filter:drop-shadow(0_0_0.7px_#6900AA)]"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`relative min-w-[104px] px-3.5 py-2.5 text-center cursor-pointer ${
          selected ? "bg-[#6900AA]" : "bg-[#F7F5FB]"
        }`}
        style={{
          WebkitMaskImage:
            "radial-gradient(circle 6px at 0 50%, transparent 98%, #000), radial-gradient(circle 6px at 100% 50%, transparent 98%, #000)",
          WebkitMaskSize: "51% 100%, 51% 100%",
          WebkitMaskPosition: "0 0, 100% 0",
          WebkitMaskRepeat: "no-repeat",
          maskImage:
            "radial-gradient(circle 6px at 0 50%, transparent 98%, #000), radial-gradient(circle 6px at 100% 50%, transparent 98%, #000)",
          maskSize: "51% 100%, 51% 100%",
          maskPosition: "0 0, 100% 0",
          maskRepeat: "no-repeat",
        }}
      >
        <span
          className={`absolute top-1.5 right-2 h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]} ${
            selected ? "ring-1 ring-white/70" : ""
          }`}
        />
        <span
          className={`block text-[13px] font-bold ${selected ? "text-white" : ""}`}
          style={selected ? undefined : { color: TIME_COLOR }}
        >
          {formatTime(st.starts_at)}
        </span>
        {price != null ? (
          <span
            className={`mt-0.5 block text-[10px] font-semibold ${
              selected ? "text-white/90" : "text-[#6B7280]"
            }`}
          >
            ETB {price}
          </span>
        ) : screenLabel ? (
          <span
            className={`mt-0.5 block text-[10px] font-semibold uppercase tracking-wide ${
              selected ? "text-white/90" : ""
            }`}
            style={selected ? undefined : { color: TIME_COLOR }}
          >
            {screenLabel}
          </span>
        ) : null}
      </button>
    </span>
  );
}

export default function CinemaDetailPage({ cinemaId }: { cinemaId: string }) {
  const router = useRouter();
  const dateOptions = useMemo(() => generateDateOptions(7), []);
  const [selectedDate, setSelectedDate] = useState(dateOptions[0]?.dateStr || "");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [languageFilters, setLanguageFilters] = useState<string[]>([]);
  const [timeFilters, setTimeFilters] = useState<string[]>([]);
  const [priceFilters, setPriceFilters] = useState<string[]>([]);
  const [openFilter, setOpenFilter] = useState<"language" | "timing" | "price" | null>(null);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState<string | null>(null);
  const [movieSearch, setMovieSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dateStripRef = useRef<HTMLDivElement>(null);
  const [city, setCity] = useState("");
  const [rows, setRows] = useState<CinemaMovieRow[]>([]);
  const [loadingShows, setLoadingShows] = useState(false);

  const { data: venues = [], isLoading: loadingCinema } = useGetPublicRegisteredCinemasQuery({});
  const { data: moviesPage, isLoading: loadingMovies } = useGetPublicMoviesQuery({
    status: "now_showing",
    limit: 40,
    ...(city ? { city } : {}),
  });
  const [fetchShowtimes] = useLazyGetPublicMovieShowtimesQuery();

  const apiCinema = venues.find((v) => v.id === cinemaId);
  const showcase = SHOWCASE_BY_ID[cinemaId];

  const cinemaName = apiCinema?.name || showcase?.name || "Cinema";
  const cinemaAddress =
    (apiCinema ? mapPartnerAddress(apiCinema) : null) ||
    showcase?.address ||
    "Address coming soon";
  const cinemaImage = apiCinema?.cover_image_url || showcase?.image || null;

  useEffect(() => {
    if (!showSearch) return;
    setOpenFilter(null);
    const t = window.setTimeout(() => searchInputRef.current?.focus(), 280);
    return () => window.clearTimeout(t);
  }, [showSearch]);

  const closeSearch = () => {
    setShowSearch(false);
    setMovieSearch("");
  };

  const updateDateScrollState = () => {
    const el = dateStripRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(maxScroll > 2 && el.scrollLeft < maxScroll - 2);
  };

  useEffect(() => {
    const el = dateStripRef.current;
    if (!el) return;
    updateDateScrollState();
    const onScroll = () => updateDateScrollState();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => updateDateScrollState());
    ro.observe(el);
    window.addEventListener("resize", updateDateScrollState);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      window.removeEventListener("resize", updateDateScrollState);
    };
  }, [dateOptions]);

  const scrollDates = (dir: -1 | 1) => {
    const el = dateStripRef.current;
    if (!el) return;
    const step = Math.max(120, Math.round(el.clientWidth * 0.55));
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  useEffect(() => {
    const el = dateStripRef.current;
    if (!el || !selectedDate) return;
    const activeBtn = el.querySelector<HTMLElement>(`[data-date="${selectedDate}"]`);
    activeBtn?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [selectedDate]);

  useEffect(() => {
    const applyCity = () => {
      const stored = localStorage.getItem("selected_city") || "";
      setCity(stored && stored !== "All Cities" ? stored : "");
    };
    applyCity();
    window.addEventListener("selected_city_changed", applyCity);
    return () => window.removeEventListener("selected_city_changed", applyCity);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("movie_cinema_favorites");
      const list = raw ? (JSON.parse(raw) as string[]) : [];
      setFavorited(list.includes(cinemaId));
    } catch {
      setFavorited(false);
    }
  }, [cinemaId]);

  const toggleFavorite = () => {
    setFavorited((prev) => {
      const next = !prev;
      try {
        const raw = localStorage.getItem("movie_cinema_favorites");
        const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
        const updated = next
          ? Array.from(new Set([...list, cinemaId]))
          : list.filter((id) => id !== cinemaId);
        localStorage.setItem("movie_cinema_favorites", JSON.stringify(updated));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  useEffect(() => {
    if (!apiCinema || !selectedDate) {
      setRows([]);
      return;
    }

    const movies = moviesPage?.items ?? [];
    if (loadingMovies) return;

    let cancelled = false;

    (async () => {
      setLoadingShows(true);
      const results = await Promise.all(
        movies.map(async (movie) => {
          try {
            const res = await fetchShowtimes({
              idOrSlug: movie.slug || movie.id,
              date: selectedDate,
              city_slug: city || undefined,
            }).unwrap();
            const group = (res.cinemas || []).find((c) => c.id === cinemaId);
            if (!group?.showtimes?.length) return null;
            return {
              movie,
              languageFormat: movieLanguageFormat(movie, group.showtimes),
              showtimes: group.showtimes,
            } satisfies CinemaMovieRow;
          } catch {
            return null;
          }
        })
      );
      if (!cancelled) {
        setRows(results.filter((r): r is CinemaMovieRow => Boolean(r)));
        setLoadingShows(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiCinema, cinemaId, selectedDate, city, moviesPage?.items, loadingMovies, fetchShowtimes]);

  const languageOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      r.showtimes.forEach((st) => st.language && set.add(st.language));
      (r.movie.languages || []).forEach((l) => l && set.add(l));
    });
    return Array.from(set)
      .sort()
      .map((l) => ({ value: l, label: l }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = movieSearch.trim().toLowerCase();
    return rows
      .map((row) => {
        let showtimes = row.showtimes;
        if (languageFilters.length > 0) {
          showtimes = showtimes.filter((st) => languageFilters.includes(st.language));
        }
        if (timeFilters.length > 0) {
          showtimes = showtimes.filter((st) => matchesPreferredTime(st.starts_at, timeFilters));
        }
        if (priceFilters.length > 0) {
          showtimes = showtimes.filter((st) => {
            const price = showtimePrice(st);
            if (price == null) return false;
            return priceInBands(price, priceFilters);
          });
        }
        return { ...row, showtimes };
      })
      .filter((row) => {
        if (row.showtimes.length === 0) return false;
        if (!q) return true;
        return (
          row.movie.title.toLowerCase().includes(q) ||
          row.languageFormat.toLowerCase().includes(q)
        );
      });
  }, [rows, languageFilters, timeFilters, priceFilters, movieSearch]);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${cinemaName} ${cinemaAddress}`
  )}`;

  const handleShowtimeClick = (id: string) => {
    setSelectedShowtimeId(id);
    router.push(`/movies/book/${id}`);
  };

  if (loadingCinema && !apiCinema && !showcase) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PAGE_BG }}>
        <Loader2 className="animate-spin text-[#6900AA]" size={32} />
      </div>
    );
  }

  if (!apiCinema && !showcase) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3 px-4"
        style={{ backgroundColor: PAGE_BG }}
      >
        <p className="text-slate-700 font-semibold">Cinema not found</p>
        <Link href="/movies/cinemas" className="text-sm font-semibold text-[#6900AA] hover:underline">
          Back to cinemas
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE_BG }}>
      <div className="container mx-auto px-4 sm:px-8 lg:px-10 2xl:px-0 py-5 sm:py-7 space-y-5">
        {/* Header */}
        <div className="rounded-2xl border border-[#E8E2F2] bg-white/90 p-4 sm:p-5 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 sm:gap-4 min-w-0">
              <div className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 overflow-hidden rounded-xl bg-[#EDE4F7] border border-[#E5E0EF]">
                {cinemaImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cinemaImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-[#6900AA] text-lg font-bold">
                    {cinemaName.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 pt-0.5">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-[#1E1B4B] leading-snug truncate">
                    {cinemaName}
                  </h1>
                  <button
                    type="button"
                    aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
                    aria-pressed={favorited}
                    onClick={toggleFavorite}
                    className="shrink-0 cursor-pointer"
                  >
                    <Heart
                      size={18}
                      className={
                        favorited
                          ? "fill-[#6900AA] text-[#6900AA]"
                          : "text-slate-300 hover:text-[#6900AA]"
                      }
                    />
                  </button>
                </div>
                <p className="mt-1.5 flex items-start gap-1.5 text-sm text-[#6B7280]">
                  <MapPin size={14} className="mt-0.5 shrink-0 text-[#9CA3AF]" />
                  <span className="leading-relaxed">
                    {cinemaAddress}
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex align-middle ml-1.5 text-[#6900AA] hover:opacity-80"
                      aria-label="Open in maps"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              className="shrink-0 inline-flex items-center justify-center gap-1.5 self-start sm:self-center h-10 px-4 rounded-full border border-[#6900AA]/35 text-sm font-semibold text-[#6900AA] hover:bg-[#F3E8FF] transition-colors cursor-pointer"
            >
              View Details
              <ArrowRight size={15} />
            </button>
          </div>

          {detailsOpen ? (
            <div className="mt-4 rounded-xl border border-[#EDE4F7] bg-[#FAF8FC] px-4 py-4 sm:px-5 sm:py-5">
              <h2 className="text-[15px] sm:text-base font-bold text-[#374151]">
                Available Facilities
              </h2>
              <div className="mt-3 flex flex-wrap items-start gap-x-6 gap-y-3 sm:gap-x-8">
                {CINEMA_FACILITIES.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="flex w-[4.75rem] flex-col items-center text-center gap-1.5"
                    >
                      <Icon size={26} strokeWidth={1.5} className="text-[#4B5563]" />
                      <span className="text-[11px] font-medium text-[#4B5563] leading-snug">
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Date + filters */}
        <div className="rounded-2xl border border-[#E8E2F2] bg-white p-3 sm:p-4 shadow-sm sticky top-2 z-20 overflow-visible">
          <div className="flex flex-col xl:flex-row xl:items-center gap-3 xl:gap-5">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                type="button"
                disabled={!canScrollLeft}
                onClick={() => scrollDates(-1)}
                className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-full border border-[#E5E0EF] bg-white flex items-center justify-center text-[#6B7280] disabled:opacity-30 cursor-pointer hover:border-[#6900AA]/40"
                aria-label="Previous dates"
              >
                <ChevronLeft size={16} />
              </button>

              <div
                ref={dateStripRef}
                className="flex items-end gap-2 sm:gap-2.5 overflow-x-auto scroll-smooth pt-3 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-1 min-w-0"
              >
                {dateOptions.map((opt) => {
                  const active = opt.dateStr === selectedDate;
                  return (
                    <button
                      key={opt.dateStr}
                      type="button"
                      data-date={opt.dateStr}
                      onClick={() => setSelectedDate(opt.dateStr)}
                      className={`relative shrink-0 text-center cursor-pointer transition-transform ${
                        active
                          ? "w-[3.35rem] sm:w-[3.75rem] pt-2.5"
                          : "w-[3.15rem] sm:w-[3.5rem]"
                      }`}
                    >
                      {active ? (
                        <span className="relative block w-full">
                          <span
                            className="pointer-events-none absolute left-[22%] top-0 z-[2] h-[0.62rem] w-[0.36rem] -translate-y-[48%] rounded-full bg-[#E9D5FF]"
                            aria-hidden
                          />
                          <span
                            className="pointer-events-none absolute right-[22%] top-0 z-[2] h-[0.62rem] w-[0.36rem] -translate-y-[48%] rounded-full bg-[#E9D5FF]"
                            aria-hidden
                          />
                          <span
                            className="relative z-[1] flex aspect-square w-full flex-col items-center justify-between rounded-[1.15rem] px-1.5 py-[0.65rem] text-white"
                            style={{
                              background: DATE_ACTIVE_GRADIENT,
                              boxShadow: "0 6px 14px rgba(76,29,149,0.25)",
                            }}
                          >
                            <span className="block text-[9px] sm:text-[10px] font-bold tracking-[0.08em] text-white leading-none">
                              {opt.weekdayShort}
                            </span>
                            <span className="block text-[1.2rem] sm:text-[1.4rem] font-extrabold leading-none text-white">
                              {opt.dayNumber}
                            </span>
                            <span className="block text-[9px] sm:text-[10px] font-bold tracking-[0.08em] text-white leading-none">
                              {opt.monthName}
                            </span>
                          </span>
                        </span>
                      ) : (
                        <span className="flex aspect-square w-full flex-col items-center justify-between rounded-[1.15rem] bg-transparent px-1.5 py-[0.65rem]">
                          <span className="block text-[9px] sm:text-[10px] font-bold tracking-wide text-[#6B7280] leading-none">
                            {opt.weekdayShort}
                          </span>
                          <span
                            className={`block text-[1.15rem] sm:text-[1.3rem] font-extrabold leading-none ${
                              opt.isWeekend ? "text-[#E11D48]" : "text-[#222222]"
                            }`}
                          >
                            {opt.dayNumber}
                          </span>
                          <span className="block text-[9px] sm:text-[10px] font-semibold tracking-wide text-[#9CA3AF] leading-none">
                            {opt.monthName}
                          </span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={!canScrollRight}
                onClick={() => scrollDates(1)}
                className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-full border border-[#E5E0EF] bg-white flex items-center justify-center text-[#6B7280] disabled:opacity-30 cursor-pointer hover:border-[#6900AA]/40"
                aria-label="Next dates"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="flex items-center gap-2 w-full xl:w-[38rem] xl:max-w-[38rem] xl:shrink-0 min-w-0">
              <div className="flex-1 min-w-0 flex items-center gap-2">
                {showSearch ? (
                  <div className="flex h-10 w-full items-center gap-2 rounded-full border border-[#E8E0F2] bg-white pl-3 pr-3">
                    <Search size={16} className="shrink-0 text-[#9CA3AF]" />
                    <input
                      ref={searchInputRef}
                      type="search"
                      value={movieSearch}
                      onChange={(e) => setMovieSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") closeSearch();
                      }}
                      placeholder="Search for movies"
                      className="h-full w-full bg-transparent text-[13px] text-[#333333] placeholder:text-[#9CA3AF] focus:outline-none"
                      aria-label="Search movies"
                    />
                  </div>
                ) : (
                  <>
                    <BmsFilterDropdown
                      label="All Movie Languages"
                      values={languageFilters}
                      options={languageOptions}
                      open={openFilter === "language"}
                      onOpenChange={(next) => setOpenFilter(next ? "language" : null)}
                      onChange={setLanguageFilters}
                      icon={<Film size={15} className="text-[#6900AA]" />}
                      emptyText="No languages for this date"
                    />
                    <BmsFilterDropdown
                      label="Select Timing"
                      values={timeFilters}
                      options={TIMING_OPTIONS}
                      open={openFilter === "timing"}
                      onOpenChange={(next) => setOpenFilter(next ? "timing" : null)}
                      onChange={setTimeFilters}
                      icon={<Clock size={15} className="text-[#6900AA]" />}
                    />
                    <BmsFilterDropdown
                      label="Select Price Range"
                      values={priceFilters}
                      options={PRICE_BAND_OPTIONS}
                      open={openFilter === "price"}
                      onOpenChange={(next) => setOpenFilter(next ? "price" : null)}
                      onChange={setPriceFilters}
                      icon={<Coins size={15} className="text-[#F59E0B]" />}
                    />
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (showSearch) {
                    closeSearch();
                    return;
                  }
                  setOpenFilter(null);
                  setShowSearch(true);
                }}
                className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-white cursor-pointer shadow-sm"
                style={{ backgroundColor: BRAND }}
                aria-label={showSearch ? "Close search" : "Search movies"}
              >
                {showSearch ? <X size={18} /> : <Search size={18} />}
              </button>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#EEEAF4] flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B7280]">
            <div className="inline-flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
                Available
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#EAB308]" />
                Filling Fast
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#EF4444]" />
                Almost Full
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[#9CA3AF]">
              <Clock size={13} />
              Showtimes are in local time (EAT).
            </span>
          </div>
        </div>

        {/* Movie cards */}
        <div className="space-y-4 min-h-[280px]">
          {!apiCinema ? (
            <div className="rounded-2xl border border-[#E8E2F2] bg-white px-5 py-16 text-center text-sm text-[#6B7280]">
              Showtimes will appear here when this cinema is live with scheduled movies.
            </div>
          ) : loadingShows || loadingMovies ? (
            <div className="rounded-2xl border border-[#E8E2F2] bg-white flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 size={28} className="animate-spin text-[#6900AA]" />
              <p className="text-sm font-medium">Loading showtimes…</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-2xl border border-[#E8E2F2] bg-white px-5 py-16 text-center">
              <p className="text-[#111111] font-semibold">No shows for this date</p>
              <p className="mt-1 text-sm text-[#6B7280]">
                Try another date, clear filters, or check back later.
              </p>
            </div>
          ) : (
            filteredRows.map((row) => {
              const duration = formatDuration(row.movie.duration_minutes);
              const genres = (row.movie.genres || []).join(", ");
              const languages = Array.from(
                new Set(
                  row.showtimes
                    .map((s) => s.language)
                    .filter(Boolean)
                    .concat(row.movie.languages || [])
                )
              ).slice(0, 2);
              const formats = Array.from(
                new Set(
                  row.showtimes
                    .map((s) => s.format)
                    .filter(Boolean)
                    .concat(row.movie.formats || [])
                )
              ).slice(0, 2);
              const cert = row.movie.certificate;

              return (
                <article
                  key={row.movie.id}
                  className="rounded-2xl border border-[#E8E2F2] bg-white p-4 sm:p-5 shadow-[0_2px_12px_rgba(30,27,75,0.04)]"
                >
                  <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 lg:items-start">
                    <div className="flex items-start gap-3 sm:gap-4 min-w-0 shrink-0">
                      <Link
                        href={`/movies/${row.movie.slug || row.movie.id}`}
                        className="relative h-[88px] w-[64px] sm:h-[100px] sm:w-[72px] shrink-0 overflow-hidden rounded-xl bg-[#EDE4F7] border border-[#EDE4F7]"
                      >
                        {resolveMediaUrl(row.movie.poster_url) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={resolveMediaUrl(row.movie.poster_url)}
                            alt={row.movie.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[#6900AA] text-xs font-bold px-1 text-center">
                            {row.movie.title.slice(0, 1)}
                          </div>
                        )}
                      </Link>

                      <div className="min-w-0 pt-0.5">
                        <Link
                          href={`/movies/${row.movie.slug || row.movie.id}`}
                          className="text-[15px] sm:text-base font-bold text-[#1E1B4B] hover:text-[#6900AA] leading-snug"
                        >
                          {row.movie.title}
                        </Link>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {languages.map((l) => (
                            <span
                              key={`l-${l}`}
                              className="inline-flex rounded-full bg-[#F3E8FF] px-2 py-0.5 text-[10px] font-semibold text-[#6900AA]"
                            >
                              {l}
                            </span>
                          ))}
                          {formats.map((f) => (
                            <span
                              key={`f-${f}`}
                              className="inline-flex rounded-full bg-[#F3E8FF] px-2 py-0.5 text-[10px] font-semibold text-[#6900AA]"
                            >
                              {f}
                            </span>
                          ))}
                          {cert ? (
                            <span className="inline-flex rounded-full bg-[#F3E8FF] px-2 py-0.5 text-[10px] font-semibold text-[#6900AA]">
                              {cert}
                            </span>
                          ) : null}
                        </div>

                        {(duration || genres) && (
                          <p className="mt-2 text-xs text-[#6B7280]">
                            {[duration, genres].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2.5 min-w-0 flex-1 content-start pt-0.5">
                      {row.showtimes.map((st) => (
                        <TicketShowtimeButton
                          key={st.id}
                          st={st}
                          selected={selectedShowtimeId === st.id}
                          onClick={() => handleShowtimeClick(st.id)}
                        />
                      ))}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
