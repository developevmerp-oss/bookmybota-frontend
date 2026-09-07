"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Car,
  ChevronDown,
  CloudMoon,
  Clock,
  Film,
  Globe,
  Heart,
  Info,
  ListFilter,
  MapPin,
  MessageCircle,
  Moon,
  Navigation,
  Search,
  Smartphone,
  Sun,
  Sunset,
  Ticket,
  TicketX,
  Utensils,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  useGetPublicMovieShowtimesQuery,
  type PublicMovieCinemaGroup,
  type PublicMovieShowtimeItem,
} from "@/services/api";

const BRAND = "#6900AA";
const DATE_ACTIVE_GRADIENT =
  "linear-gradient(180deg, #A78BFA 0%, #8B5CF6 38%, #6D28D9 72%, #4C1D95 100%)";

const CINEMA_FACILITIES = [
  { label: "Ticket Cancellation", icon: TicketX },
  { label: "F&B", icon: Utensils },
  { label: "MTicket", icon: Smartphone },
  { label: "Parking Facility", icon: Car },
  { label: "Food Court", icon: UtensilsCrossed },
] as const;

export type ShowtimeMovieMeta = {
  id: string;
  slug?: string;
  title: string;
  poster: string;
  languages: string[];
  genres: string[];
  duration?: string;
  certification?: string;
  releaseYear?: string;
};

interface Props {
  movieIdOrSlug: string;
  movie: ShowtimeMovieMeta;
  onSelectShowtime?: (showtime: PublicMovieShowtimeItem, cinema: PublicMovieCinemaGroup) => void;
}

type FilterOption = { value: string; label: string; hint?: string; icon?: ReactNode };

type SortKey = "relevance" | "popularity" | "distance";

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

const PREFERRED_TIME_OPTIONS: FilterOption[] = [
  {
    value: "morning",
    label: "Morning",
    hint: "12:00 AM - 11:59 AM",
    icon: <Sun size={16} className="text-[#F59E0B]" />,
  },
  {
    value: "afternoon",
    label: "Afternoon",
    hint: "12:00 PM - 3:59 PM",
    icon: <Sunset size={16} className="text-[#F97316]" />,
  },
  {
    value: "evening",
    label: "Evening",
    hint: "4:00 PM - 6:59 PM",
    icon: <CloudMoon size={16} className="text-[#8B5CF6]" />,
  },
  {
    value: "night",
    label: "Night",
    hint: "7:00 PM - 11:59 PM",
    icon: <Moon size={16} className="text-[#6366F1]" />,
  },
];

const SORT_OPTIONS: Array<{ value: SortKey; label: string; hint: string }> = [
  { value: "relevance", label: "Relevance", hint: "Best options for you first" },
  { value: "popularity", label: "Popularity", hint: "Show most popular first" },
  { value: "distance", label: "Distance", hint: "Show nearest first" },
];

function parseIsoDateAndHours(iso: string) {
  if (!iso) return { dateStr: "", hour: 0, displayTime: "" };
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
      hour: h,
      displayTime: `${String(h12).padStart(2, "0")}:${minuteStr} ${ampm}`,
    };
  }
  const dateObj = new Date(iso);
  if (isNaN(dateObj.getTime())) return { dateStr: "", hour: 0, displayTime: "" };
  const h = dateObj.getHours();
  const minuteStr = String(dateObj.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    dateStr: `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`,
    hour: h,
    displayTime: `${String(h12).padStart(2, "0")}:${minuteStr} ${ampm}`,
  };
}

function formatTime(iso: string) {
  return parseIsoDateAndHours(iso).displayTime;
}

function showHour(iso: string) {
  return parseIsoDateAndHours(iso).hour;
}

function generateDateOptions(count = 7) {
  const options: Array<{
    dateStr: string;
    dayNumber: string;
    monthName: string;
    weekdayShort: string;
  }> = [];
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  for (let i = 0; i < count; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    options.push({
      dateStr: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      dayNumber: pad(d.getDate()),
      monthName: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
      weekdayShort: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
    });
  }
  return options;
}

function showtimePrice(st: PublicMovieShowtimeItem) {
  return st.min_price ?? st.tier_pricing?.[0]?.price ?? null;
}

function fillStatus(iso: string): "available" | "filling" {
  const h = showHour(iso);
  if (h >= 18) return "filling";
  return "available";
}

function priceInBands(price: number, bands: string[]) {
  if (bands.length === 0) return true;
  return bands.some((band) => {
    if (band === "801+") return price >= 801;
    const [minStr, maxStr] = band.split("-");
    return price >= Number(minStr) && price <= Number(maxStr);
  });
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

function BmsFilterDropdown({
  label,
  values,
  options,
  onChange,
  open,
  onOpenChange,
  underline,
  emptyText = "No options available",
  icon,
}: {
  label: string;
  values: string[];
  options: FilterOption[];
  onChange: (values: string[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  underline?: boolean;
  emptyText?: string;
  icon?: ReactNode;
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
      const minWidth = Math.max(rect.width, 240);
      let left = rect.left;
      if (left + minWidth > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - minWidth - 8);
      }
      setMenuPos({
        top: rect.bottom + 6,
        left,
        minWidth,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

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

  const active = open || values.length > 0 || underline;
  const displayLabel =
    values.length === 1
      ? options.find((o) => o.value === values[0])?.label || values[0]
      : values.length > 1
        ? `${label} (${values.length})`
        : label;

  const menu =
    open && menuPos
      ? createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            aria-multiselectable
            className="fixed z-[200] max-h-[min(20rem,60vh)] overflow-y-auto rounded-xl border border-[#E8E8E8] bg-white py-1 shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
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
                      className="w-full px-3.5 py-2.5 flex items-center gap-2.5 text-left text-[13px] text-[#333333] hover:bg-[#F7E9FF]/60 cursor-pointer"
                    >
                      {opt.icon ? <span className="shrink-0">{opt.icon}</span> : null}
                      <span className="flex-1 min-w-0">
                        <span className="font-medium block">{opt.label}</span>
                        {opt.hint ? (
                          <span className="text-[11px] text-[#9CA3AF] block mt-0.5">{opt.hint}</span>
                        ) : null}
                      </span>
                      <span
                        className={`h-3.5 w-3.5 shrink-0 rounded-[2px] border flex items-center justify-center ${
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
        className={`h-9 sm:h-10 px-2.5 sm:px-3.5 inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border text-[12px] sm:text-[13px] font-medium cursor-pointer focus:outline-none transition-colors whitespace-nowrap ${
          active
            ? "border-[#6900AA] text-[#6900AA] bg-[#F7E9FF]"
            : "border-[#E5E5E5] text-[#4B5563] bg-white hover:border-[#6900AA]/45"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {icon ? <span className="shrink-0 text-current opacity-80">{icon}</span> : null}
        <span className="truncate max-w-[5.5rem] xs:max-w-[7rem] sm:max-w-[9rem]">{displayLabel}</span>
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

function SortByDropdown({
  value,
  onChange,
  open,
  onOpenChange,
}: {
  value: SortKey;
  onChange: (value: SortKey) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
      const minWidth = Math.max(rect.width, 256);
      let left = rect.left;
      if (left + minWidth > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - minWidth - 8);
      }
      setMenuPos({
        top: rect.bottom + 6,
        left,
        minWidth,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

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

  const active = open || value !== "relevance";

  const menu =
    open && menuPos
      ? createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            className="fixed z-[200] rounded-xl border border-[#E8E8E8] bg-white py-1 shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              minWidth: menuPos.minWidth,
            }}
          >
            {SORT_OPTIONS.map((opt) => {
              const selected = value === opt.value;
              return (
                <li key={opt.value} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      onOpenChange(false);
                    }}
                    className="w-full px-3.5 py-2.5 flex items-center gap-3 text-left cursor-pointer hover:bg-[#F7E9FF]/60"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-medium text-[#222222]">{opt.label}</span>
                      <span className="block text-[11px] text-[#9CA3AF] mt-0.5">{opt.hint}</span>
                    </span>
                    <span
                      className={`h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                        selected ? "border-[#6900AA]" : "border-[#C4C4C4]"
                      }`}
                      aria-hidden
                    >
                      {selected ? <span className="h-2 w-2 rounded-full bg-[#6900AA]" /> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={`h-9 sm:h-10 px-2.5 sm:px-3.5 inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border text-[12px] sm:text-[13px] font-medium cursor-pointer focus:outline-none transition-colors whitespace-nowrap ${
          active
            ? "border-[#6900AA] text-[#6900AA] bg-[#F7E9FF]"
            : "border-[#E5E5E5] text-[#4B5563] bg-white hover:border-[#6900AA]/45"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <ListFilter size={15} className="shrink-0 opacity-80" />
        <span>Sort By</span>
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

function buildShowtimesTitle(title: string, year?: string, language?: string) {
  let base = title.trim();
  // Avoid "Title (2026) (2026)" when API title already includes the year
  while (/\(\d{4}\)\s*$/.test(base)) {
    base = base.replace(/\s*\(\d{4}\)\s*$/, "").trim();
  }
  if (year) base = `${base} (${year})`;
  if (language) return `${base} - (${language})`;
  return base;
}

const TIME_COLOR = "#C58B00";
const STATUS_DOT: Record<"available" | "filling", string> = {
  available: "bg-[#22C55E]",
  filling: "bg-[#EAB308]",
};

const TICKET_MASK = {
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
} as const;

function cinemaMapsQuery(cinema: PublicMovieCinemaGroup) {
  return [cinema.name, cinema.address].filter(Boolean).join(", ") || cinema.name;
}

function CinemaInfoModal({
  cinema,
  favorited,
  onToggleFavorite,
  onClose,
}: {
  cinema: PublicMovieCinemaGroup;
  favorited: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
}) {
  const address =
    cinema.address?.trim() ||
    "Address details will appear here when available for this cinema.";
  const mapQuery = cinemaMapsQuery(cinema);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
  const embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cinema-info-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45 cursor-pointer border-0"
        aria-label="Close cinema details"
        onClick={onClose}
      />
      <div className="relative z-10 w-full sm:max-w-[28rem] max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-white px-4 pt-4 pb-3 sm:px-5">
          <h2
            id="cinema-info-title"
            className="text-[16px] sm:text-[17px] font-bold text-[#333333] leading-snug pr-2"
          >
            {cinema.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 shrink-0 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#4B5563] hover:bg-[#E5E7EB] cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 sm:px-5 pb-5 space-y-0">
          <div className="overflow-hidden rounded-xl border border-[#E8E8E8] bg-[#F8F8F8] h-[180px] sm:h-[200px]">
            <iframe
              title={`Map for ${cinema.name}`}
              src={embedUrl}
              className="h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          <div className="mt-3 flex items-start gap-2.5 border-b border-[#EFEFEF] py-3.5">
            <MapPin size={16} className="mt-0.5 shrink-0 text-[#6B7280]" />
            <p className="flex-1 min-w-0 text-[13px] text-[#4B5563] leading-relaxed">{address}</p>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 mt-0.5 text-[#3B82F6] hover:opacity-80"
              aria-label="Open directions"
            >
              <Navigation size={16} />
            </a>
          </div>

          <button
            type="button"
            onClick={onToggleFavorite}
            className="w-full flex items-center gap-2.5 border-b border-[#EFEFEF] py-3.5 text-left cursor-pointer hover:bg-[#FAFAFA] -mx-1 px-1 rounded-lg"
          >
            <Heart
              size={18}
              className={favorited ? "fill-[#6900AA] text-[#6900AA]" : "text-[#6B7280]"}
            />
            <span className="text-[13px] text-[#4B5563]">
              {favorited
                ? "Added to your favorite cinemas"
                : "Tap to add to your favorite cinemas"}
            </span>
          </button>

          <div className="pt-4">
            <h3 className="text-[14px] font-bold text-[#333333]">Available Facilities</h3>
            <div className="mt-3 flex flex-wrap items-start gap-x-5 gap-y-3">
              {CINEMA_FACILITIES.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex w-[4.5rem] flex-col items-center text-center gap-1.5"
                  >
                    <Icon size={24} strokeWidth={1.5} className="text-[#4B5563]" />
                    <span className="text-[10px] font-medium text-[#4B5563] leading-snug">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ShowtimeChip({
  st,
  onClick,
}: {
  st: PublicMovieShowtimeItem;
  onClick: () => void;
}) {
  const status = fillStatus(st.starts_at);
  const formatLabel = (st.format || st.screen_type || "").trim();
  const languageLabel = (st.language || "").trim();
  const metaLine = [formatLabel, languageLabel ? languageLabel.toUpperCase() : ""]
    .filter(Boolean)
    .join(" · ");
  const minPrice = showtimePrice(st);

  return (
    <span className="inline-block [filter:drop-shadow(0_0_0.65px_#D1D5DB)] hover:[filter:drop-shadow(0_0_0.75px_#6900AA)] transition-[filter]">
      <button
        type="button"
        onClick={onClick}
        className="relative min-w-[104px] sm:min-w-[112px] bg-[#F7F5FB] px-3.5 py-2.5 text-center cursor-pointer"
        style={TICKET_MASK}
      >
        <span
          className={`absolute top-1.5 right-2 h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`}
        />
        <span className="block text-[13px] font-bold" style={{ color: TIME_COLOR }}>
          {formatTime(st.starts_at)}
        </span>
        {metaLine ? (
          <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-[#9CA3AF]">
            {metaLine}
          </span>
        ) : null}
        {minPrice !== null ? (
          <span className="mt-0.5 block text-[10px] font-medium text-[#6B7280]">ETB {minPrice}</span>
        ) : null}
      </button>
    </span>
  );
}

export default function MovieShowtimeSelector({ movieIdOrSlug, movie, onSelectShowtime }: Props) {
  const router = useRouter();
  const dateOptions = useMemo(() => generateDateOptions(7), []);
  const [selectedDate, setSelectedDate] = useState<string>(dateOptions[0].dateStr);
  const [selectedCity, setSelectedCity] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const stored = localStorage.getItem("selected_city") || "";
    return stored && stored !== "All Cities" ? stored : "";
  });
  const [languageFilters, setLanguageFilters] = useState<string[]>([]);
  const [priceFilters, setPriceFilters] = useState<string[]>([]);
  const [timeFilters, setTimeFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>("relevance");
  const [openFilter, setOpenFilter] = useState<"language" | "price" | "time" | "sort" | null>(null);
  const [favoritedIds, setFavoritedIds] = useState<Record<string, boolean>>({});
  const [infoOpenId, setInfoOpenId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [cinemaSearch, setCinemaSearch] = useState("");
  const [headerOffset, setHeaderOffset] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleCitySync = () => {
      const stored = localStorage.getItem("selected_city") || "";
      setSelectedCity(stored && stored !== "All Cities" ? stored : "");
    };
    handleCitySync();
    window.addEventListener("selected_city_changed", handleCitySync);
    return () => window.removeEventListener("selected_city_changed", handleCitySync);
  }, []);

  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const update = () => setHeaderOffset(Math.ceil(header.getBoundingClientRect().height));
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(header);
    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    if (!showSearch) return;
    const t = window.setTimeout(() => searchInputRef.current?.focus(), 180);
    return () => window.clearTimeout(t);
  }, [showSearch]);

  const closeSearch = () => {
    setShowSearch(false);
    setCinemaSearch("");
  };

  const { data, isLoading, isFetching } = useGetPublicMovieShowtimesQuery({
    idOrSlug: movieIdOrSlug,
    date: selectedDate,
    city_slug: selectedCity || undefined,
  });

  const cinemas = data?.cinemas ?? [];
  const availableDates = data?.available_dates ?? [];

  const languageOptions = useMemo(() => {
    const set = new Set<string>();
    movie.languages.forEach((l) => l && set.add(l));
    cinemas.forEach((c) => c.showtimes.forEach((st) => st.language && set.add(st.language)));
    return Array.from(set)
      .sort()
      .map((v) => ({ value: v, label: v }));
  }, [cinemas, movie.languages]);

  const filteredCinemas = useMemo(() => {
    const q = cinemaSearch.trim().toLowerCase();
    let rows = cinemas
      .map((cinema) => {
        let showtimes = cinema.showtimes;
        if (languageFilters.length) {
          showtimes = showtimes.filter((st) => languageFilters.includes(st.language));
        }
        if (priceFilters.length) {
          showtimes = showtimes.filter((st) => {
            const price = showtimePrice(st);
            return price != null && priceInBands(price, priceFilters);
          });
        }
        if (timeFilters.length) {
          showtimes = showtimes.filter((st) => matchesPreferredTime(st.starts_at, timeFilters));
        }
        return { ...cinema, showtimes };
      })
      .filter((cinema) => cinema.showtimes.length > 0);

    if (q) {
      rows = rows.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.address || "").toLowerCase().includes(q)
      );
    }

    if (sortBy === "popularity") {
      rows = [...rows].sort((a, b) => b.showtimes.length - a.showtimes.length);
    } else if (sortBy === "distance") {
      rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    }

    return rows;
  }, [cinemas, languageFilters, priceFilters, timeFilters, cinemaSearch, sortBy]);

  const handleShowtimeClick = (showtime: PublicMovieShowtimeItem, cinema: PublicMovieCinemaGroup) => {
    if (onSelectShowtime) {
      onSelectShowtime(showtime, cinema);
      return;
    }
    router.push(`/movies/book/${showtime.id}`);
  };

  const primaryLanguage = movie.languages[0];
  const titleLine = buildShowtimesTitle(movie.title, movie.releaseYear, primaryLanguage);
  const languageLine = movie.languages.map((l) => l.toUpperCase()).join(", ");
  const backHref = `/movies/${movie.slug || movie.id}`;
  const languageLabel = languageFilters.length === 1 ? languageFilters[0] : null;

  return (
    <div className="w-full space-y-4">
      <section className="bg-white border border-[#E8E8E8] rounded-md overflow-visible shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {/* Dynamic movie header (same fields as movie detail, + poster) */}
        <div className="bg-[#F5F5F5] px-4 sm:px-5 py-4 sm:py-5 relative">
          <Link
            href={backHref}
            aria-label="Back to movie"
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1 text-[#6B7280] hover:text-[#111111] cursor-pointer"
          >
            <X size={18} />
          </Link>

          <div className="flex gap-4 sm:gap-5 pr-8">
            <div className="relative shrink-0 w-[88px] sm:w-[110px]">
              <div className="overflow-hidden rounded-md border border-white shadow-sm aspect-[2/3] bg-[#E5E5E5]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={movie.poster} alt={movie.title} className="h-full w-full object-cover" />
              </div>
              {movie.certification ? (
                <span className="absolute bottom-1.5 left-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-sm bg-black/70 px-1 text-[10px] font-bold text-white">
                  {movie.certification}
                </span>
              ) : null}
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              <h1 className="text-xl sm:text-2xl lg:text-[1.75rem] font-extrabold text-[#222222] leading-tight">
                {titleLine}
              </h1>

              {languageLine ? (
                <p className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold tracking-wide text-[#6B7280] uppercase">
                  <MessageCircle size={13} className="text-[#9CA3AF]" />
                  {languageLine}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {movie.duration ? (
                  <span className="inline-flex rounded-full border border-[#D4D4D4] bg-white px-3 py-1 text-[12px] text-[#555555]">
                    Movie runtime: {movie.duration}
                  </span>
                ) : null}
                {movie.certification ? (
                  <span className="inline-flex rounded-full border border-[#D4D4D4] bg-white px-3 py-1 text-[12px] text-[#555555]">
                    {movie.certification}
                  </span>
                ) : null}
                {movie.genres.map((g) => (
                  <span
                    key={g}
                    className="inline-flex rounded-full border border-[#D4D4D4] bg-white px-3 py-1 text-[12px] text-[#555555]"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky date + filters (image-2 UI) */}
      <div
        className="sticky z-30 bg-white border border-[#E8E8E8] rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] overflow-visible"
        style={{ top: headerOffset || undefined }}
      >
        <div className="px-3 sm:px-4 py-3 sm:py-3.5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
            {/* Dates — calendar-shaped active chip (squircle + binder tabs) */}
            <div className="flex items-end gap-2.5 sm:gap-3 overflow-x-auto pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-w-0 lg:flex-1">
              {dateOptions.map((opt) => {
                const active = opt.dateStr === selectedDate;
                const hasShows = availableDates.includes(opt.dateStr);
                return (
                  <button
                    key={opt.dateStr}
                    type="button"
                    onClick={() => setSelectedDate(opt.dateStr)}
                    className={`relative shrink-0 text-center cursor-pointer transition-transform ${
                      active
                        ? "w-[3.35rem] sm:w-[3.75rem] pt-2.5"
                        : "w-[3.15rem] sm:w-[3.5rem] py-1.5 hover:opacity-80"
                    }`}
                  >
                    {active ? (
                      <span className="relative block w-full">
                        {/* Binder rings */}
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
                      <>
                        {hasShows ? (
                          <span
                            className="absolute top-0.5 right-1 h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: BRAND }}
                          />
                        ) : null}
                        <span className="block text-[9px] sm:text-[10px] font-bold tracking-wide text-[#333333]">
                          {opt.weekdayShort}
                        </span>
                        <span className="mt-0.5 block text-base sm:text-lg font-extrabold leading-none text-[#222222]">
                          {opt.dayNumber}
                        </span>
                        <span className="mt-0.5 block text-[9px] sm:text-[10px] font-semibold tracking-wide text-[#9CA3AF]">
                          {opt.monthName}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Filters + search */}
            <div
              className={`relative flex items-center gap-2 min-w-0 lg:justify-end ${
                showSearch ? "overflow-hidden" : "overflow-visible"
              }`}
            >
              <div
                className={`flex flex-wrap items-center gap-2 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                  showSearch
                    ? "max-w-0 max-h-0 opacity-0 pointer-events-none overflow-hidden -translate-x-2"
                    : "max-w-[100%] opacity-100 translate-x-0"
                }`}
              >
                <BmsFilterDropdown
                  label={languageLabel || "Language"}
                  values={languageFilters}
                  options={languageOptions}
                  open={openFilter === "language"}
                  onOpenChange={(next) => setOpenFilter(next ? "language" : null)}
                  underline={Boolean(languageLabel || languageFilters.length)}
                  onChange={setLanguageFilters}
                  emptyText="No languages for this date"
                  icon={<Globe size={15} />}
                />
                <BmsFilterDropdown
                  label="Price Range"
                  values={priceFilters}
                  options={PRICE_BAND_OPTIONS}
                  open={openFilter === "price"}
                  onOpenChange={(next) => setOpenFilter(next ? "price" : null)}
                  onChange={setPriceFilters}
                  icon={<Ticket size={15} />}
                />
                <BmsFilterDropdown
                  label="Preferred Time"
                  values={timeFilters}
                  options={PREFERRED_TIME_OPTIONS}
                  open={openFilter === "time"}
                  onOpenChange={(next) => setOpenFilter(next ? "time" : null)}
                  onChange={setTimeFilters}
                  icon={<Clock size={15} />}
                />
                <SortByDropdown
                  value={sortBy}
                  open={openFilter === "sort"}
                  onOpenChange={(next) => setOpenFilter(next ? "sort" : null)}
                  onChange={setSortBy}
                />
              </div>

              <div
                className={`flex items-center overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                  showSearch ? "flex-1 min-w-[12rem] opacity-100" : "w-0 min-w-0 max-w-0 opacity-0"
                }`}
              >
                <div className="flex h-9 sm:h-10 w-full items-center gap-2 rounded-xl border border-[#E5E5E5] bg-white pl-3 pr-1">
                  <Search size={16} className="shrink-0 text-[#9CA3AF]" />
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={cinemaSearch}
                    onChange={(e) => setCinemaSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") closeSearch();
                    }}
                    placeholder="Search for cinemas"
                    className="h-full w-full bg-transparent text-[13px] text-[#333333] placeholder:text-[#9CA3AF] focus:outline-none"
                    aria-label="Search cinemas"
                  />
                  <button
                    type="button"
                    onClick={closeSearch}
                    className="h-8 w-8 shrink-0 flex items-center justify-center text-[#6B7280] hover:text-[#6900AA] cursor-pointer"
                    aria-label="Close search"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setOpenFilter(null);
                  setShowSearch(true);
                }}
                className={`h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-full border border-[#E5E5E5] bg-white flex items-center justify-center text-[#4B5563] hover:text-[#6900AA] hover:border-[#6900AA]/40 cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                  showSearch
                    ? "w-0 max-w-0 opacity-0 border-0 pointer-events-none overflow-hidden"
                    : "opacity-100"
                }`}
                aria-label="Search cinemas"
                tabIndex={showSearch ? -1 : 0}
              >
                <Search size={17} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-t border-[#F0F0F0] bg-[#FAFAFA] rounded-b-xl">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#4B5563]">
            <span className="inline-flex items-center gap-1.5 font-medium text-[#111111]">
              <MapPin size={13} className="text-[#6900AA]" />
              City: <strong>{selectedCity || "All Cities"}</strong>
            </span>
            {selectedCity ? (
              <button
                type="button"
                onClick={() => setSelectedCity("")}
                className="font-semibold text-[#6900AA] hover:underline cursor-pointer"
              >
                Show All Cities
              </button>
            ) : null}
          </div>
          <div className="inline-flex flex-wrap items-center gap-4 text-[11px] font-semibold tracking-wide text-[#6B7280]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
              AVAILABLE
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#EAB308]" />
              FAST FILLING
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="rounded-xl border border-[#E8E8E8] bg-white p-12 text-center text-[#6B7280]">
            Loading screening cinemas and showtimes…
          </div>
        ) : filteredCinemas.length === 0 ? (
          <div className="rounded-xl border border-[#E8E8E8] bg-white p-10 text-center space-y-3">
            <Film size={36} className="mx-auto text-[#C4C4C4]" />
            <h3 className="text-lg font-bold text-[#111111]">
              No shows available for {selectedCity || selectedDate}
            </h3>
            <p className="text-xs text-[#6B7280] max-w-md mx-auto">
              {languageFilters.length || priceFilters.length || timeFilters.length || cinemaSearch
                ? "No showtimes match your filters or search. Try clearing filters."
                : selectedCity
                  ? `No cinemas in ${selectedCity} have scheduled showtimes for ${selectedDate}.`
                  : `Cinemas haven't published showtimes for ${selectedDate} yet.`}
            </p>
            {(languageFilters.length || priceFilters.length || timeFilters.length || cinemaSearch) >
            0 ? (
              <button
                type="button"
                onClick={() => {
                  setLanguageFilters([]);
                  setPriceFilters([]);
                  setTimeFilters([]);
                  setCinemaSearch("");
                  setSortBy("relevance");
                  closeSearch();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#111111] text-white text-xs font-bold hover:opacity-90 cursor-pointer"
              >
                Clear Filters
              </button>
            ) : null}
            {availableDates.length > 0 && (
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                <span className="text-xs text-[#6B7280]">Shows available on:</span>
                {availableDates.map((dStr) => (
                  <button
                    key={dStr}
                    type="button"
                    onClick={() => setSelectedDate(dStr)}
                    className="px-3 py-1.5 rounded-lg bg-[#F5F5F5] hover:bg-[#EFEFEF] text-[#111111] text-xs font-bold border border-[#E5E5E5] cursor-pointer"
                  >
                    {dStr}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-[#6B7280] px-0.5">
              <span>
                Available at <strong className="text-[#111111]">{filteredCinemas.length}</strong> cinema
                {filteredCinemas.length !== 1 ? "s" : ""}
              </span>
              {isFetching && <span className="text-[#F84464] animate-pulse">Updating shows…</span>}
            </div>

            <div className="space-y-3">
              {filteredCinemas.map((cinema) => {
                const favorited = Boolean(favoritedIds[cinema.id]);

                return (
                  <div
                    key={cinema.id}
                    className="rounded-xl border border-[#E8E8E8] bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <button
                              type="button"
                              onClick={() => setInfoOpenId(cinema.id)}
                              className="text-[15px] sm:text-base font-bold text-[#111111] leading-snug hover:text-[#6900AA] transition-colors cursor-pointer text-left"
                            >
                              {cinema.name}
                            </button>
                            <button
                              type="button"
                              aria-label="Cinema info"
                              onClick={() => setInfoOpenId(cinema.id)}
                              className="text-[#9CA3AF] hover:text-[#6900AA] cursor-pointer"
                            >
                              <Info size={15} strokeWidth={2} />
                            </button>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#6B7280]">
                            <span className="inline-flex items-center gap-1">
                              <Ticket size={12} className="text-[#9CA3AF]" />
                              M-Ticket Available
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          aria-label={favorited ? "Remove favorite" : "Favorite cinema"}
                          aria-pressed={favorited}
                          onClick={() =>
                            setFavoritedIds((prev) => ({
                              ...prev,
                              [cinema.id]: !prev[cinema.id],
                            }))
                          }
                          className="shrink-0 cursor-pointer p-1"
                        >
                          <svg width="0" height="0" aria-hidden className="absolute">
                            <defs>
                              <linearGradient
                                id={`cinema-heart-${cinema.id}`}
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop offset="0%" stopColor="#F9A8D4" />
                                <stop offset="45%" stopColor="#EC4899" />
                                <stop offset="100%" stopColor="#DB2777" />
                              </linearGradient>
                            </defs>
                          </svg>
                          <Heart
                            size={18}
                            strokeWidth={2.1}
                            className={favorited ? "fill-[#EC4899]" : undefined}
                            style={{
                              stroke: `url(#cinema-heart-${cinema.id})`,
                              color: favorited ? "#EC4899" : undefined,
                            }}
                          />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-start gap-2.5">
                        {cinema.showtimes.map((st) => (
                          <ShowtimeChip
                            key={st.id}
                            st={st}
                            onClick={() => handleShowtimeClick(st, cinema)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {infoOpenId
              ? (() => {
                  const cinema = filteredCinemas.find((c) => c.id === infoOpenId);
                  if (!cinema) return null;
                  return (
                    <CinemaInfoModal
                      cinema={cinema}
                      favorited={Boolean(favoritedIds[cinema.id])}
                      onToggleFavorite={() =>
                        setFavoritedIds((prev) => ({
                          ...prev,
                          [cinema.id]: !prev[cinema.id],
                        }))
                      }
                      onClose={() => setInfoOpenId(null)}
                    />
                  );
                })()
              : null}
          </>
        )}
      </div>
    </div>
  );
}
