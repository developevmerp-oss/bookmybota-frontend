"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Car,
  ChevronDown,
  ChevronRight,
  CloudMoon,
  Clock,
  Film,
  Globe,
  Heart,
  Info,
  ListFilter,
  MapPin,
  Moon,
  Navigation,
  Search,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Sunset,
  Ticket,
  TicketX,
  Utensils,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { FaMoon } from "react-icons/fa";
import {
  useGetPublicMovieShowtimesQuery,
  type MovieShowtimeTierAvailability,
  type PublicMovieCinemaGroup,
  type PublicMovieShowtimeItem,
} from "@/services/api";
import {
  parseCsvParam,
  sameStringList,
  setOrDeleteCsvParam,
  setOrDeleteParam,
  stableSearchParamsString,
} from "@/lib/filterUrlSync";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { ShowtimeListShimmer } from "@/components/Shared/Shimmer";
import {
  formatDateCustomer,
  formatTime12h,
  getVenueDateTimeParts,
  isMovieShowEnded,
  isVenueWallTimeReached,
  venueCalendarAddDays,
  venueDateLabels,
  venueDateStr,
} from "@/lib/dateFormat";

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
  formats?: string[];
  duration?: string;
  certification?: string;
  releaseYear?: string;
};

interface Props {
  movieIdOrSlug: string;
  movie: ShowtimeMovieMeta;
  onSelectShowtime?: (showtime: PublicMovieShowtimeItem, cinema: PublicMovieCinemaGroup) => void;
}

type FilterOption = {
  value: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
  disabled?: boolean;
};

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

/** Exclusive end hour for each preferred-time band (venue / Ethiopia clock). */
const PREFERRED_TIME_END_HOUR: Record<string, number> = {
  morning: 12,
  afternoon: 16,
  evening: 19,
  night: 24,
};

/** True when this band is fully in the past for the selected calendar day. */
function isPreferredTimeBandPast(band: string, selectedDate: string, now = new Date()): boolean {
  const today = venueDateStr(now);
  if (!today) return false;
  if (selectedDate > today) return false;
  if (selectedDate < today) return true;
  const endHour = PREFERRED_TIME_END_HOUR[band];
  if (endHour == null) return false;
  // Night runs until the venue calendar day rolls; never "past" on today.
  if (endHour >= 24) return false;
  return isVenueWallTimeReached(
    `${selectedDate}T${String(endHour).padStart(2, "0")}:00:00`,
    now
  );
}

function preferredTimeOptionsForDate(selectedDate: string, now = new Date()): FilterOption[] {
  return PREFERRED_TIME_OPTIONS.map((opt) => ({
    ...opt,
    disabled: isPreferredTimeBandPast(opt.value, selectedDate, now),
  }));
}

function parseIsoDateAndHours(iso: string) {
  const parts = getVenueDateTimeParts(iso);
  if (!parts) return { dateStr: "", hour: 0, displayTime: "" };
  const displayTime = formatTime12h(iso);
  return {
    dateStr: parts.dateKey,
    hour: parts.hour,
    displayTime: displayTime === "—" ? "" : displayTime,
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
  let cursor = venueDateStr();
  for (let i = 0; i < count; i++) {
    const labels = venueDateLabels(cursor);
    options.push({
      dateStr: cursor,
      dayNumber: labels.dayNumber,
      monthName: labels.monthName.toUpperCase(),
      weekdayShort: labels.weekdayShort.toUpperCase(),
    });
    cursor = venueCalendarAddDays(cursor, 1);
  }
  return options;
}

function showtimePrice(st: PublicMovieShowtimeItem) {
  return st.min_price ?? st.tier_pricing?.[0]?.price ?? null;
}

function isShowEnded(st: PublicMovieShowtimeItem): boolean {
  return isMovieShowEnded({
    starts_at: st.starts_at,
    ends_at: st.ends_at,
    booking_state: st.booking_state,
    is_ended: st.is_ended,
  });
}

function isShowStarted(st: PublicMovieShowtimeItem): boolean {
  // Ended shows must never look like late-entry "STARTED".
  if (isShowEnded(st)) return false;
  if (st.booking_state === "STARTED" || st.has_started) return true;
  if (st.booking_state === "UPCOMING") return false;
  if (!st.starts_at) return false;
  return isVenueWallTimeReached(st.starts_at);
}

type ChipFillStatus = "available" | "filling" | "started" | "soldout";

function fillStatus(st: PublicMovieShowtimeItem): ChipFillStatus {
  if (isShowEnded(st)) return "soldout";
  if (st.fill_status === "STARTED" || isShowStarted(st)) return "started";
  if (st.fill_status === "SOLD_OUT") return "soldout";
  if (st.fill_status === "FILLING_FAST") return "filling";
  if (st.fill_status === "AVAILABLE") return "available";
  // Fallback from tiers if fill_status missing
  const tiers = st.tiers || [];
  if (tiers.length > 0) {
    if (tiers.every((t) => t.status === "SOLD_OUT")) return "soldout";
    if (tiers.some((t) => t.status === "FILLING_FAST" || t.status === "SOLD_OUT")) {
      return "filling";
    }
  }
  return "available";
}

function tooltipTiers(st: PublicMovieShowtimeItem): MovieShowtimeTierAvailability[] {
  if (Array.isArray(st.tiers) && st.tiers.length > 0) return st.tiers;
  if (Array.isArray(st.tier_pricing) && st.tier_pricing.length > 0) {
    return st.tier_pricing.map((t) => ({
      tier_name: t.tier_name,
      price: Number(t.price) || 0,
      status: "AVAILABLE" as const,
      total_count: null,
      available_count: null,
    }));
  }
  return [];
}

function tierStatusLabel(status: string): string {
  if (status === "FILLING_FAST") return "Filling Fast";
  if (status === "SOLD_OUT") return "Sold Out";
  return "Available";
}

function tierStatusClass(status: string): string {
  if (status === "FILLING_FAST") return "text-[#EA580C]";
  if (status === "SOLD_OUT") return "text-[#DC2626]";
  return "text-[#16A34A]";
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

  const toggle = (value: string, disabled?: boolean) => {
    if (disabled) return;
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
                const disabled = Boolean(opt.disabled);
                return (
                  <li key={opt.value} role="option" aria-selected={checked} aria-disabled={disabled}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggle(opt.value, disabled)}
                      className={`w-full px-3.5 py-2.5 flex items-center gap-2.5 text-left text-[13px] ${
                        disabled
                          ? "cursor-not-allowed bg-white"
                          : "text-[#333333] hover:bg-[#F7E9FF]/60 cursor-pointer"
                      }`}
                    >
                      {opt.icon ? (
                        <span
                          className={`shrink-0 ${disabled ? "opacity-[0.35] grayscale" : ""}`}
                        >
                          {opt.icon}
                        </span>
                      ) : null}
                      <span className="flex-1 min-w-0">
                        <span
                          className={`font-medium block ${
                            disabled ? "text-[#B8B8B8]" : "text-[#333333]"
                          }`}
                        >
                          {opt.label}
                        </span>
                        {opt.hint ? (
                          <span
                            className={`text-[11px] block mt-0.5 ${
                              disabled ? "text-[#D0D0D0]" : "text-[#9CA3AF]"
                            }`}
                          >
                            {opt.hint}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={`h-3.5 w-3.5 shrink-0 rounded-[2px] flex items-center justify-center ${
                          disabled
                            ? "border-0 bg-[#E0E0E0]"
                            : checked
                              ? "border border-[#6900AA] bg-[#6900AA] text-white"
                              : "border border-[#9CA3AF] bg-white"
                        }`}
                        aria-hidden
                      >
                        {!disabled && checked ? (
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

function MobileBottomSheet({
  open,
  onClose,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (open) {
      setRendered(true);
      setExiting(false);
      return;
    }
    if (!rendered) return;
    setExiting(true);
    const t = window.setTimeout(() => {
      setRendered(false);
      setExiting(false);
    }, 220);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to open/mounted; rendered gates exit start
  }, [open, mounted]);

  useEffect(() => {
    if (!rendered || exiting) return;
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
  }, [rendered, exiting, onClose]);

  if (!mounted || !rendered) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] lg:hidden">
      <button
        type="button"
        aria-label="Close"
        className={`absolute inset-0 bg-black/45 cursor-pointer ${
          exiting ? "mobile-filter-sheet-backdrop-out" : "mobile-filter-sheet-backdrop"
        }`}
        onClick={onClose}
      />
      <div
        className={`absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl ${
          exiting ? "mobile-filter-sheet-panel-out" : "mobile-filter-sheet-panel"
        } ${className}`}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

/** BMS-style: "Difret (2014) - Amharic" / "Difret (2014) - Hindi (IMAX 2D)" */
function buildShowtimesTitle(
  title: string,
  year?: string,
  language?: string | null,
  format?: string | null
) {
  let base = title.trim();
  // Avoid "Title (2026) (2026)" when API title already includes the year
  while (/\(\d{4}\)\s*$/.test(base)) {
    base = base.replace(/\s*\(\d{4}\)\s*$/, "").trim();
  }
  if (year) base = `${base} (${year})`;

  const lang = language?.trim() || "";
  const fmt = format?.trim() || "";
  if (lang && fmt) return `${base} - ${lang} (${fmt})`;
  if (lang) return `${base} - ${lang}`;
  if (fmt) return `${base} - ${fmt}`;
  return base;
}

/** BMS-style muted text for disabled date / time options */
const DISABLED_MUTED = "#C8C8C8";
const DISABLED_MUTED_SOFT = "#D4D4D4";

/** Chip border + left accent — matches fill status */
const STATUS_BORDER: Record<ChipFillStatus, string> = {
  available: "#22C55E",
  filling: "#EAB308",
  soldout: "#DC2626",
  started: "#F97316",
};

function cinemaMapsQuery(cinema: PublicMovieCinemaGroup) {
  return [cinema.name, cinema.address].filter(Boolean).join(", ") || cinema.name;
}

/** BMS-style phone + ticket glyph for M-Ticket chip. */
function MTicketGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="6" y="2.5" width="10" height="19" rx="2" />
      <path d="M9 5.5h4" />
      <path d="M9 18.5h4" />
      <path d="M15.5 9.2h3.2a1.2 1.2 0 0 1 0 2.4h-.5a1 1 0 0 0 0 2h.5a1.2 1.2 0 0 1 0 2.4H15.5" />
    </svg>
  );
}

/** BMS-style amenity chips: F&B (label always) + M-Ticket (icon only; label on hover). */
function CinemaAmenityBadges({
  hasFnb,
  mTicket = true,
}: {
  hasFnb?: boolean;
  mTicket?: boolean;
}) {
  if (!hasFnb && !mTicket) return null;
  return (
    <div className="-mt-1 flex flex-wrap items-center gap-2">
      {hasFnb ? (
        <span
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#FFF1E0] px-2.5 text-xs font-semibold text-[#E67E22]"
          title="Food & beverages available with booking"
        >
          <UtensilsCrossed size={16} strokeWidth={2.25} className="shrink-0" />
          F&B
        </span>
      ) : null}
      {mTicket ? (
        <span
          tabIndex={0}
          className="group/mticket inline-flex h-8 items-center justify-center gap-0 rounded-md bg-[#E8F5E9] px-2 text-xs font-semibold text-[#2E7D32] outline-none transition-[gap,padding] duration-200 ease-out hover:gap-1.5 hover:pr-2.5 focus-visible:gap-1.5 focus-visible:pr-2.5"
          title="M-Ticket"
          aria-label="M-Ticket available"
        >
          <MTicketGlyph className="shrink-0" />
          <span className="inline-block max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 ease-out group-hover/mticket:max-w-[4.5rem] group-hover/mticket:opacity-100 group-focus-visible/mticket:max-w-[4.5rem] group-focus-visible/mticket:opacity-100">
            M-Ticket
          </span>
        </span>
      ) : null}
    </div>
  );
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
  const logoSrc = resolveMediaUrl(cinema.logo || "");

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
          <div className="flex items-start gap-3 min-w-0 pr-2">
            {logoSrc ? (
              <div className="shrink-0 size-11 overflow-hidden rounded-md border border-[#E5E7EB] bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoSrc} alt="" className="h-full w-full object-contain p-0.5" />
              </div>
            ) : null}
            <h2
              id="cinema-info-title"
              className="text-[16px] sm:text-[17px] font-bold text-[#333333] leading-snug"
            >
              {cinema.name}
            </h2>
          </div>
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
              {CINEMA_FACILITIES.filter((item) => {
                if (item.label === "F&B" || item.label === "Food Court") {
                  return Boolean(cinema.has_fnb);
                }
                if (item.label === "MTicket") return cinema.m_ticket !== false;
                if (item.label === "Ticket Cancellation") {
                  return Boolean(cinema.cancellation_available);
                }
                return true;
              }).map((item) => {
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

/** BMS-style group key: "HINDI IMAX 2D" / "HINDI 2D" */
function showtimeLangFormatKey(st: PublicMovieShowtimeItem): string {
  const lang = (st.language || "").trim().toUpperCase();
  const fmt = (st.format || st.screen_type || "").trim().toUpperCase();
  if (lang && fmt) return `${lang} ${fmt}`;
  if (lang) return lang;
  if (fmt) return fmt;
  return "SHOWS";
}

function groupShowtimesByLangFormat(showtimes: PublicMovieShowtimeItem[]) {
  const order: string[] = [];
  const map = new Map<string, PublicMovieShowtimeItem[]>();
  for (const st of showtimes) {
    const key = showtimeLangFormatKey(st);
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(st);
  }
  return order.map((label) => ({ label, showtimes: map.get(label)! }));
}

function ShowtimeChip({
  st,
  onClick,
  grouped = false,
}: {
  st: PublicMovieShowtimeItem;
  onClick: () => void;
  /** When true, language/format are shown in the section heading — keep chip clean. */
  grouped?: boolean;
}) {
  const status = fillStatus(st);
  const started = status === "started";
  const soldOut = status === "soldout";
  const formatLabel = (st.format || st.screen_type || "").trim();
  const languageLabel = (st.language || "").trim();
  const metaLine = grouped
    ? ""
    : [formatLabel, languageLabel ? languageLabel.toUpperCase() : ""]
        .filter(Boolean)
        .join(" · ");
  const minPrice = showtimePrice(st);
  const tiers = tooltipTiers(st);
  const borderColor = STATUS_BORDER[status];
  const isLateNight = (() => {
    const d = new Date(st.starts_at);
    if (Number.isNaN(d.getTime())) return false;
    const h = d.getHours();
    return h >= 23 || h < 5;
  })();

  const showLateNightMoon = grouped && isLateNight;

  return (
    <span className="group/chip relative inline-block overflow-visible pt-2.5 pr-2.5">
      {/* Hover tooltip — neutral grey border (do not inherit chip status filter) */}
      {tiers.length > 0 ? (
        <div
          className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-40 hidden w-max max-w-[min(92vw,36rem)] -translate-x-1/2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.12)] group-hover/chip:block"
          role="tooltip"
        >
          <div className="flex flex-wrap items-start justify-center gap-x-4 gap-y-2">
            {tiers.map((tier) => (
              <div
                key={`${tier.tier_name}-${tier.price}`}
                className="min-w-[4.5rem] max-w-[7.5rem] text-center px-1"
              >
                <div className="text-[12px] font-bold text-[#111827] tabular-nums">
                  {tier.price > 0 ? `ETB ${tier.price}` : "—"}
                </div>
                <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#374151] leading-tight line-clamp-2">
                  {tier.tier_name}
                </div>
                <div
                  className={`mt-0.5 text-[10px] font-semibold ${tierStatusClass(tier.status)}`}
                >
                  {tierStatusLabel(tier.status)}
                </div>
              </div>
            ))}
          </div>
          <span
            className="absolute left-1/2 top-full -mt-px h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r border-[#E5E7EB] bg-white"
            aria-hidden
          />
        </div>
      ) : null}

      {/* Rectangular chip + left accent bar (status color); moon on late-night */}
      <span className="relative inline-block overflow-visible">
        {showLateNightMoon ? (
          <span
            className="pointer-events-none absolute top-0 right-0 z-20 flex size-[16px] -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-[#5A5A5A] text-white shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
            title="Late night"
            aria-hidden
          >
            <FaMoon className="text-[8px] text-white" aria-hidden />
          </span>
        ) : null}

        <button
          type="button"
          onClick={onClick}
          disabled={soldOut}
          aria-label={`${formatTime(st.starts_at)}${
            isLateNight ? " — Late night" : ""
          } — ${
            status === "available"
              ? "Available"
              : status === "filling"
                ? "Fast filling"
                : status === "soldout"
                  ? "Sold out"
                  : "Started"
          }`}
          className={`relative min-w-[104px] sm:min-w-[112px] overflow-hidden border bg-white pl-4 pr-3.5 py-2 text-center ${
            soldOut
              ? "cursor-not-allowed opacity-70"
              : "cursor-pointer hover:bg-[#FAFAFA]"
          }`}
          style={{ borderColor }}
        >
          <span
            className="pointer-events-none absolute inset-y-0 left-0 w-[4px]"
            style={{ backgroundColor: borderColor }}
            aria-hidden
          />
          <span className="block text-[13px] font-bold tabular-nums text-[#374151]">
            {formatTime(st.starts_at)}
          </span>
          {started ? (
            <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-[#EA580C]">
              Started
            </span>
          ) : soldOut ? (
            <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-[#DC2626]">
              Sold Out
            </span>
          ) : null}
          {grouped && formatLabel && !/^2d$/i.test(formatLabel) ? (
            <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-[#9CA3AF]">
              {formatLabel}
            </span>
          ) : null}
          {metaLine ? (
            <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-[#9CA3AF]">
              {metaLine}
            </span>
          ) : null}
          {minPrice !== null && !grouped ? (
            <span className="mt-0.5 block text-[10px] font-medium text-[#6B7280]">
              ETB {minPrice}
            </span>
          ) : null}
        </button>
      </span>
    </span>
  );
}

export default function MovieShowtimeSelector({ movieIdOrSlug, movie, onSelectShowtime }: Props) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const dateOptions = useMemo(() => generateDateOptions(7), []);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const fromUrl = searchParams.get("date") || "";
    if (fromUrl && dateOptions.some((d) => d.dateStr === fromUrl)) return fromUrl;
    return dateOptions[0].dateStr;
  });
  const [selectedCity, setSelectedCity] = useState<string>(() => {
    const cityParam = searchParams.get("city");
    if (cityParam) return cityParam === "All Cities" ? "" : cityParam;
    if (typeof window === "undefined") return "";
    const stored = localStorage.getItem("selected_city") || "";
    return stored && stored !== "All Cities" ? stored : "";
  });
  const [languageFilters, setLanguageFilters] = useState<string[]>(() =>
    parseCsvParam(searchParams.get("language"))
  );
  const [formatFilters, setFormatFilters] = useState<string[]>(() =>
    parseCsvParam(searchParams.get("format"))
  );
  const [priceFilters, setPriceFilters] = useState<string[]>(() =>
    parseCsvParam(searchParams.get("price"))
  );
  const [timeFilters, setTimeFilters] = useState<string[]>(() =>
    parseCsvParam(searchParams.get("time"))
  );
  const [sortBy, setSortBy] = useState<SortKey>(() => {
    const s = searchParams.get("sort");
    return s === "popularity" || s === "distance" || s === "relevance" ? s : "relevance";
  });
  const [openFilter, setOpenFilter] = useState<"language" | "price" | "time" | "sort" | null>(null);
  const [mobileSheet, setMobileSheet] = useState<"filters" | "langFormat" | "sort" | null>(null);
  const [draftPriceFilters, setDraftPriceFilters] = useState<string[]>([]);
  const [draftTimeFilters, setDraftTimeFilters] = useState<string[]>([]);
  const [draftFormatFilters, setDraftFormatFilters] = useState<string[]>([]);
  const [draftLanguageFilters, setDraftLanguageFilters] = useState<string[]>([]);
  const [favoritedIds, setFavoritedIds] = useState<Record<string, boolean>>({});
  const [infoOpenId, setInfoOpenId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [cinemaSearch, setCinemaSearch] = useState(() => searchParams.get("q") || "");
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
    const dateFromUrl = searchParams.get("date") || "";
    const languagesFromUrl = parseCsvParam(searchParams.get("language"));
    const formatsFromUrl = parseCsvParam(searchParams.get("format"));
    const priceFromUrl = parseCsvParam(searchParams.get("price"));
    const timeFromUrl = parseCsvParam(searchParams.get("time"));
    const sortFromUrl = searchParams.get("sort");
    const qFromUrl = searchParams.get("q") || "";
    const cityParam = searchParams.get("city");

    if (dateFromUrl && dateOptions.some((d) => d.dateStr === dateFromUrl)) {
      setSelectedDate((prev) => (prev === dateFromUrl ? prev : dateFromUrl));
    }
    setLanguageFilters((prev) =>
      sameStringList(prev, languagesFromUrl) ? prev : languagesFromUrl
    );
    setFormatFilters((prev) => (sameStringList(prev, formatsFromUrl) ? prev : formatsFromUrl));
    setPriceFilters((prev) => (sameStringList(prev, priceFromUrl) ? prev : priceFromUrl));
    setTimeFilters((prev) => (sameStringList(prev, timeFromUrl) ? prev : timeFromUrl));
    if (sortFromUrl === "popularity" || sortFromUrl === "distance" || sortFromUrl === "relevance") {
      setSortBy((prev) => (prev === sortFromUrl ? prev : sortFromUrl));
    }
    setCinemaSearch((prev) => (prev === qFromUrl ? prev : qFromUrl));
    if (cityParam) {
      const nextCity = cityParam === "All Cities" ? "" : cityParam;
      setSelectedCity((prev) => (prev === nextCity ? prev : nextCity));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParamsKey drives URL hydration
  }, [searchParamsKey]);

  useEffect(() => {
    const params = new URLSearchParams();
    setOrDeleteParam(params, "date", selectedDate);
    setOrDeleteCsvParam(params, "language", languageFilters);
    setOrDeleteCsvParam(params, "format", formatFilters);
    setOrDeleteCsvParam(params, "price", priceFilters);
    setOrDeleteCsvParam(params, "time", timeFilters);
    if (sortBy && sortBy !== "relevance") setOrDeleteParam(params, "sort", sortBy);
    setOrDeleteParam(params, "q", cinemaSearch);
    setOrDeleteParam(params, "city", selectedCity);
    if (stableSearchParamsString(params) === stableSearchParamsString(searchParams)) return;
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- omit searchParams so inbound URL nav is not overwritten by stale state
  }, [
    selectedDate,
    languageFilters,
    formatFilters,
    priceFilters,
    timeFilters,
    sortBy,
    cinemaSearch,
    selectedCity,
    pathname,
    router,
  ]);

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

  /** Refresh clock so bands disable when the hour rolls over while the page is open */
  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setClockTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const preferredTimeOptions = useMemo(
    () => preferredTimeOptionsForDate(selectedDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clockTick refreshes past-band checks
    [selectedDate, clockTick]
  );

  // Drop Preferred Time selections that are already past for the selected day
  useEffect(() => {
    const now = new Date();
    setTimeFilters((prev) => {
      const next = prev.filter((v) => !isPreferredTimeBandPast(v, selectedDate, now));
      return next.length === prev.length ? prev : next;
    });
    setDraftTimeFilters((prev) => {
      const next = prev.filter((v) => !isPreferredTimeBandPast(v, selectedDate, now));
      return next.length === prev.length ? prev : next;
    });
  }, [selectedDate, clockTick]);

  const closeSearch = () => {
    setShowSearch(false);
    setCinemaSearch("");
  };

  const { data, isLoading, isFetching, isSuccess } = useGetPublicMovieShowtimesQuery({
    idOrSlug: movieIdOrSlug,
    date: selectedDate,
    city_slug: selectedCity || undefined,
  });

  // Hide finished slots client-side (API may lag / stale process).
  const cinemas = useMemo(() => {
    const rows = data?.cinemas ?? [];
    return rows
      .map((cinema) => ({
        ...cinema,
        showtimes: cinema.showtimes.filter((st) => !isShowEnded(st)),
      }))
      .filter((cinema) => cinema.showtimes.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clockTick re-checks ends_at vs venue now
  }, [data?.cinemas, clockTick]);
  const availableDates = data?.available_dates ?? [];
  /** Once showtimes payload is known, dates missing from available_dates are not bookable */
  const datesAvailabilityReady = isSuccess && Boolean(data);
  const isDateDisabled = (dateStr: string) =>
    datesAvailabilityReady && !availableDates.includes(dateStr);

  // If current date has no shows, jump to the first bookable date
  useEffect(() => {
    if (!datesAvailabilityReady || availableDates.length === 0) return;
    if (availableDates.includes(selectedDate)) return;
    setSelectedDate(availableDates[0]);
  }, [datesAvailabilityReady, availableDates, selectedDate]);

  const languageOptions = useMemo(() => {
    const set = new Set<string>();
    movie.languages.forEach((l) => l && set.add(l));
    cinemas.forEach((c) => c.showtimes.forEach((st) => st.language && set.add(st.language)));
    return Array.from(set)
      .sort()
      .map((v) => ({ value: v, label: v }));
  }, [cinemas, movie.languages]);

  const formatOptions = useMemo(() => {
    const set = new Set<string>();
    (movie.formats || []).forEach((f) => f && set.add(f));
    cinemas.forEach((c) =>
      c.showtimes.forEach((st) => {
        const f = (st.format || st.screen_type || "").trim();
        if (f) set.add(f);
      })
    );
    return Array.from(set)
      .sort()
      .map((v) => ({ value: v, label: v }));
  }, [cinemas, movie.formats]);

  const filteredCinemas = useMemo(() => {
    const q = cinemaSearch.trim().toLowerCase();
    let rows = cinemas
      .map((cinema) => {
        let showtimes = cinema.showtimes;
        if (languageFilters.length) {
          showtimes = showtimes.filter((st) => languageFilters.includes(st.language));
        }
        if (formatFilters.length) {
          showtimes = showtimes.filter((st) => {
            const f = (st.format || st.screen_type || "").trim();
            return f && formatFilters.includes(f);
          });
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
  }, [cinemas, languageFilters, formatFilters, priceFilters, timeFilters, cinemaSearch, sortBy]);

  const [lateEntryModal, setLateEntryModal] = useState<{
    showtime: PublicMovieShowtimeItem;
    cinema: PublicMovieCinemaGroup;
  } | null>(null);

  /** BMS flow: open seat map first — “How many seats?” modal shows on that page. */
  const goToSeatMap = (showtime: PublicMovieShowtimeItem) => {
    router.push(`/movies/book/${showtime.id}`);
  };

  const handleShowtimeClick = (showtime: PublicMovieShowtimeItem, cinema: PublicMovieCinemaGroup) => {
    if (onSelectShowtime) {
      onSelectShowtime(showtime, cinema);
      return;
    }
    if (isShowStarted(showtime)) {
      setLateEntryModal({ showtime, cinema });
      return;
    }
    goToSeatMap(showtime);
  };

  const confirmLateEntryContinue = () => {
    if (!lateEntryModal) return;
    const { showtime } = lateEntryModal;
    setLateEntryModal(null);
    goToSeatMap(showtime);
  };

  const backHref = `/movies/${movie.slug || movie.id}`;
  const languageLabel = languageFilters.length === 1 ? languageFilters[0] : null;
  const displayLanguage =
    languageFilters.length > 0
      ? languageFilters.join(", ")
      : movie.languages[0] || "Language";
  const displayFormat =
    formatFilters.length > 0
      ? formatFilters.join(", ")
      : formatOptions[0]?.label || "2D";
  // Header title follows Select language and format (URL filters), not catalog[0]
  const titleLanguage =
    languageFilters.length > 0 ? languageFilters.join(", ") : null;
  const titleFormat = formatFilters.length > 0 ? formatFilters.join(", ") : null;
  const titleLine = buildShowtimesTitle(
    movie.title,
    movie.releaseYear,
    titleLanguage,
    titleFormat
  );

  const openAllFiltersSheet = () => {
    setDraftPriceFilters([...priceFilters]);
    setDraftTimeFilters([...timeFilters]);
    setDraftFormatFilters([...formatFilters]);
    setDraftLanguageFilters([...languageFilters]);
    setShowSearch(false);
    setOpenFilter(null);
    setMobileSheet("filters");
  };

  const openLangFormatSheet = () => {
    setDraftLanguageFilters([...languageFilters]);
    setDraftFormatFilters([...formatFilters]);
    setMobileSheet("langFormat");
  };

  const toggleDraftValue = (
    values: string[],
    setValues: (next: string[]) => void,
    value: string
  ) => {
    setValues(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  };

  const mobilePillClass = (active: boolean) =>
    `shrink-0 h-9 px-3 inline-flex items-center gap-1.5 rounded-full border text-[12px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
      active
        ? "border-[#6900AA] text-[#6900AA] bg-[#F7E9FF]"
        : "border-[#E5E5E5] text-[#333333] bg-white"
    }`;

  const filterChipClass = (active: boolean, disabled = false) =>
    `inline-flex items-center justify-center rounded-full border px-3.5 py-2 text-[12px] font-semibold transition-colors ${
      disabled
        ? "border-[#E8E8E8] text-[#C8C8C8] bg-white cursor-not-allowed"
        : active
          ? "border-[#6900AA] bg-[#6900AA] text-white cursor-pointer"
          : "border-[#6900AA]/55 bg-white text-[#6900AA] cursor-pointer"
    }`;

  return (
    <div className="w-full space-y-4">
      {/* ── Mobile / tablet chrome (BookMyShow-style) ── */}
      <div className="lg:hidden sticky top-0 z-30 -mx-3 sm:-mx-6 bg-white border-b border-[#E8E8E8] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5">
          <button
            type="button"
            aria-label="Back to movie"
            onClick={() => router.push(backHref)}
            className="shrink-0 p-1.5 -ml-1 text-[#111111] hover:text-[#6900AA] cursor-pointer"
          >
            <ArrowLeft size={22} strokeWidth={2.25} />
          </button>
          <div className="min-w-0 flex-1">
            <Link
              href={backHref}
              className="block min-w-0 cursor-pointer hover:text-[#6900AA] transition-colors"
              title="Go to movie page"
            >
              <h1 className="text-[15px] sm:text-base font-extrabold text-inherit leading-tight truncate">
                {titleLine}
              </h1>
            </Link>
            {movie.duration ? (
              <p className="mt-0.5 text-[11px] sm:text-xs text-[#6B7280] font-medium truncate">
                Movie runtime: {movie.duration}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Search cinemas"
            onClick={() => {
              setOpenFilter(null);
              setShowSearch((v) => !v);
            }}
            className="shrink-0 p-2 text-[#333333] hover:text-[#6900AA] cursor-pointer"
          >
            <Search size={20} />
          </button>
          <button
            type="button"
            aria-label="Open filters"
            onClick={openAllFiltersSheet}
            className="shrink-0 p-2 text-[#333333] hover:text-[#6900AA] cursor-pointer"
          >
            <SlidersHorizontal size={20} />
          </button>
        </div>

        {showSearch ? (
          <div className="px-3 sm:px-4 pb-2.5">
            <div className="flex h-10 items-center gap-2 rounded-xl border border-[#E5E5E5] bg-white pl-3 pr-1">
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
        ) : null}

        <div className="flex items-end gap-2.5 overflow-x-auto px-3 sm:px-4 pt-2 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {dateOptions.map((opt) => {
            const active = opt.dateStr === selectedDate;
            const hasShows = availableDates.includes(opt.dateStr);
            const disabled = isDateDisabled(opt.dateStr);
            return (
              <button
                key={opt.dateStr}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  setSelectedDate(opt.dateStr);
                }}
                title={disabled ? "No showtimes on this date" : undefined}
                aria-disabled={disabled}
                className={`relative shrink-0 text-center ${
                  disabled ? "cursor-not-allowed pointer-events-none" : "cursor-pointer"
                } ${active && !disabled ? "w-[3.35rem] pt-2.5" : "w-[3.15rem] py-1.5"}`}
              >
                {active && !disabled ? (
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
                      <span className="block text-[9px] font-bold tracking-[0.08em] leading-none">
                        {opt.weekdayShort}
                      </span>
                      <span className="block text-[1.2rem] font-extrabold leading-none">
                        {opt.dayNumber}
                      </span>
                      <span className="block text-[9px] font-bold tracking-[0.08em] leading-none">
                        {opt.monthName}
                      </span>
                    </span>
                  </span>
                ) : (
                  <>
                    {hasShows && !disabled ? (
                      <span
                        className="absolute top-0.5 right-1 h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: BRAND }}
                      />
                    ) : null}
                    <span
                      className="block text-[9px] font-bold tracking-wide"
                      style={{ color: disabled ? DISABLED_MUTED : "#333333" }}
                    >
                      {opt.weekdayShort}
                    </span>
                    <span
                      className="mt-0.5 block text-base font-extrabold leading-none"
                      style={{ color: disabled ? DISABLED_MUTED : "#222222" }}
                    >
                      {opt.dayNumber}
                    </span>
                    <span
                      className="mt-0.5 block text-[9px] font-semibold tracking-wide"
                      style={{ color: disabled ? DISABLED_MUTED : "#9CA3AF" }}
                    >
                      {opt.monthName}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 border-t border-[#F0F0F0]">
          <p className="min-w-0 text-[13px] font-bold text-[#111111] truncate">
            {displayLanguage}
            <span className="mx-1.5 text-[#9CA3AF] font-semibold">•</span>
            {displayFormat}
          </p>
          <button
            type="button"
            onClick={openLangFormatSheet}
            className="shrink-0 inline-flex items-center gap-0.5 text-[13px] font-bold text-[#6900AA] cursor-pointer"
          >
            Change
            <ChevronRight size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-t border-[#F0F0F0]">
          <button
            type="button"
            onClick={() => setMobileSheet("sort")}
            className={mobilePillClass(sortBy !== "relevance" || mobileSheet === "sort")}
          >
            <ListFilter size={14} />
            Sort by
            <ChevronDown size={14} className="opacity-70" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={openLangFormatSheet}
              className={mobilePillClass(formatFilters.length > 0)}
            >
              Special Formats
              <ChevronDown size={14} className="opacity-70" />
            </button>
            <button
              type="button"
              onClick={openAllFiltersSheet}
              className={mobilePillClass(priceFilters.length > 0)}
            >
              Price Range
              <ChevronDown size={14} className="opacity-70" />
            </button>
            <button
              type="button"
              onClick={openAllFiltersSheet}
              className={mobilePillClass(timeFilters.length > 0)}
            >
              Preferred Time
              <ChevronDown size={14} className="opacity-70" />
            </button>
            <button
              type="button"
              onClick={openAllFiltersSheet}
              className={mobilePillClass(languageFilters.length > 0)}
            >
              Language
              <ChevronDown size={14} className="opacity-70" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Desktop movie header (unchanged) ── */}
      <section className="hidden lg:block bg-white border border-[#E8E8E8] rounded-md overflow-visible shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {/* Dynamic movie header (same fields as movie detail, + poster) */}
        <div className="bg-white px-4 sm:px-5 py-4 sm:py-5 relative">
          <Link
            href={backHref}
            aria-label="Back to movie"
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1 text-[#6B7280] hover:text-[#111111] cursor-pointer"
          >
            <X size={18} />
          </Link>

          <div className="flex items-center gap-4 sm:gap-5 pr-8">
            <Link
              href={backHref}
              className="relative shrink-0 w-[88px] sm:w-[110px] cursor-pointer"
              title="Go to movie page"
              aria-label={`Go to ${movie.title} page`}
            >
              <div className="overflow-hidden rounded-md border border-white shadow-sm aspect-[2/3] bg-[#E5E5E5]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={movie.poster} alt={movie.title} className="h-full w-full object-cover" />
              </div>
              {movie.certification ? (
                <span className="absolute bottom-1.5 left-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-sm bg-black/70 px-1 text-[10px] font-bold text-white">
                  {movie.certification}
                </span>
              ) : null}
            </Link>

            <div className="min-w-0 flex-1">
              <Link
                href={backHref}
                className="inline-block max-w-full cursor-pointer hover:text-[#6900AA] transition-colors"
                title="Go to movie page"
              >
                <h1 className="text-xl sm:text-2xl lg:text-[1.75rem] font-extrabold text-inherit leading-tight">
                  {titleLine}
                </h1>
              </Link>

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

      {/* Sticky date + filters — desktop only */}
      <div
        className="hidden lg:block sticky z-30 bg-white border border-[#E8E8E8] rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] overflow-visible"
        style={{ top: headerOffset || undefined }}
      >
        <div className="px-3 sm:px-4 py-3 sm:py-3.5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
            {/* Dates — calendar-shaped active chip (squircle + binder tabs) */}
            <div className="flex items-end gap-2.5 sm:gap-3 overflow-x-auto pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-w-0 lg:flex-1">
              {dateOptions.map((opt) => {
                const active = opt.dateStr === selectedDate;
                const hasShows = availableDates.includes(opt.dateStr);
                const disabled = isDateDisabled(opt.dateStr);
                return (
                  <button
                    key={opt.dateStr}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      setSelectedDate(opt.dateStr);
                    }}
                    title={disabled ? "No showtimes on this date" : undefined}
                    aria-disabled={disabled}
                    className={`relative shrink-0 text-center transition-transform ${
                      disabled
                        ? "w-[3.15rem] sm:w-[3.5rem] py-1.5 cursor-not-allowed pointer-events-none"
                        : active
                          ? "w-[3.35rem] sm:w-[3.75rem] pt-2.5 cursor-pointer"
                          : "w-[3.15rem] sm:w-[3.5rem] py-1.5 cursor-pointer hover:opacity-80"
                    }`}
                  >
                    {active && !disabled ? (
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
                        {hasShows && !disabled ? (
                          <span
                            className="absolute top-0.5 right-1 h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: BRAND }}
                          />
                        ) : null}
                        <span
                          className="block text-[9px] sm:text-[10px] font-bold tracking-wide"
                          style={{ color: disabled ? DISABLED_MUTED : "#333333" }}
                        >
                          {opt.weekdayShort}
                        </span>
                        <span
                          className="mt-0.5 block text-base sm:text-lg font-extrabold leading-none"
                          style={{ color: disabled ? DISABLED_MUTED : "#222222" }}
                        >
                          {opt.dayNumber}
                        </span>
                        <span
                          className="mt-0.5 block text-[9px] sm:text-[10px] font-semibold tracking-wide"
                          style={{ color: disabled ? DISABLED_MUTED : "#9CA3AF" }}
                        >
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
                  options={preferredTimeOptions}
                  open={openFilter === "time"}
                  onOpenChange={(next) => {
                    if (next) setClockTick((n) => n + 1);
                    setOpenFilter(next ? "time" : null);
                  }}
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
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
              SOLD OUT
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#F97316]" />
              STARTED
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <ShowtimeListShimmer />
        ) : filteredCinemas.length === 0 ? (
          <div className="rounded-xl border border-[#E8E8E8] bg-white p-10 text-center space-y-3">
            <Film size={36} className="mx-auto text-[#C4C4C4]" />
            <h3 className="text-lg font-bold text-[#111111]">
              No shows available for{" "}
              {selectedCity || formatDateCustomer(selectedDate)}
            </h3>
            <p className="text-xs text-[#6B7280] max-w-md mx-auto">
              {languageFilters.length || priceFilters.length || timeFilters.length || formatFilters.length || cinemaSearch
                ? "No showtimes match your filters or search. Try clearing filters."
                : selectedCity
                  ? `No bookable showtimes left in ${selectedCity} for ${formatDateCustomer(selectedDate)}. Ended shows are hidden.`
                  : `No bookable showtimes left for ${formatDateCustomer(selectedDate)}. Ended shows are hidden — try another date.`}
            </p>
            {(languageFilters.length > 0 ||
            priceFilters.length > 0 ||
            timeFilters.length > 0 ||
            formatFilters.length > 0 ||
            Boolean(cinemaSearch)) ? (
              <button
                type="button"
                onClick={() => {
                  setLanguageFilters([]);
                  setFormatFilters([]);
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
                    {formatDateCustomer(dStr)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {isFetching ? (
              <div className="text-xs text-[#F84464] animate-pulse px-0.5">Updating shows…</div>
            ) : null}

            <div className="space-y-3">
              {filteredCinemas.map((cinema) => {
                const favorited = Boolean(favoritedIds[cinema.id]);
                const logoSrc = resolveMediaUrl(cinema.logo || "");

                return (
                  <div
                    key={cinema.id}
                    className="rounded-xl border border-[#E8E8E8] bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 flex items-start gap-3">
                          {logoSrc ? (
                            <div className="shrink-0 size-10 sm:size-11 overflow-hidden rounded-md border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={logoSrc}
                                alt=""
                                className="h-full w-full object-contain p-0.5"
                              />
                            </div>
                          ) : (
                            <div
                              className="shrink-0 size-10 sm:size-11 rounded-md border border-[#E5E7EB] bg-[#F3F4F6] flex items-center justify-center text-[#9CA3AF]"
                              aria-hidden
                            >
                              <Film size={18} strokeWidth={1.75} />
                            </div>
                          )}
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

                            <p className="mt-1 text-[12px] leading-snug text-[#9CA3AF]">
                              {cinema.cancellation_available
                                ? "Cancellation available"
                                : "Non-cancellable"}
                            </p>
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

                      {/* Left-aligned with logo / showtimes (BMS), not indented under name column */}
                      <CinemaAmenityBadges
                        hasFnb={Boolean(cinema.has_fnb)}
                        mTicket={cinema.m_ticket !== false}
                      />

                      <div className="space-y-4">
                        {groupShowtimesByLangFormat(cinema.showtimes).map((group, groupIdx) => (
                          <div key={group.label}>
                            {groupIdx > 0 ? (
                              <div
                                className="mb-3 border-t border-dashed border-[#E5E7EB]"
                                aria-hidden
                              />
                            ) : null}
                            <p className="mb-2.5 text-[11px] sm:text-xs font-bold uppercase tracking-wide text-[#6B7280]">
                              {group.label}
                            </p>
                            <div className="flex flex-wrap items-start gap-2.5 overflow-visible pt-0.5">
                              {group.showtimes.map((st) => (
                                <ShowtimeChip
                                  key={st.id}
                                  st={st}
                                  grouped
                                  onClick={() => handleShowtimeClick(st, cinema)}
                                />
                              ))}
                            </div>
                          </div>
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

            {lateEntryModal ? (
              <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
                <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E8E8]">
                    <h3 className="text-base font-bold text-[#222]">
                      Heads-up! This show has already started
                    </h3>
                    <button
                      type="button"
                      onClick={() => setLateEntryModal(null)}
                      className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F5F5F5] cursor-pointer"
                      aria-label="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="px-5 py-5 space-y-4">
                    <p className="text-sm text-[#6B7280] leading-relaxed">
                      You can still book tickets for{" "}
                      <span className="font-semibold text-[#374151]">
                        {lateEntryModal.cinema.name}
                      </span>{" "}
                      at{" "}
                      <span className="font-semibold text-[#374151]">
                        {formatTime(lateEntryModal.showtime.starts_at)}
                      </span>
                      . You may miss the beginning of the movie.
                    </p>
                    <div className="flex flex-col-reverse sm:flex-row gap-2.5">
                      <button
                        type="button"
                        onClick={() => setLateEntryModal(null)}
                        className="flex-1 h-11 rounded-xl border border-[#E5E7EB] bg-white text-sm font-bold text-[#374151] cursor-pointer hover:bg-[#F9FAFB] transition-colors"
                      >
                        Go back
                      </button>
                      <button
                        type="button"
                        onClick={confirmLateEntryContinue}
                        className="flex-1 h-11 rounded-xl bg-[#111111] text-white text-sm font-bold cursor-pointer hover:bg-black transition-colors"
                      >
                        Continue booking
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

          </>
        )}
      </div>

      {/* Mobile: all filters sheet */}
      <MobileBottomSheet open={mobileSheet === "filters"} onClose={() => setMobileSheet(null)}>
        <div className="px-4 pt-4 pb-3">
          <h2 className="text-lg font-extrabold text-[#111111]">Filters</h2>
        </div>
        <div className="pb-24">
          <div className="bg-[#F3F4F6] px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">
            Price Range
          </div>
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {PRICE_BAND_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  toggleDraftValue(draftPriceFilters, setDraftPriceFilters, opt.value)
                }
                className={filterChipClass(draftPriceFilters.includes(opt.value))}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="bg-[#F3F4F6] px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">
            Special Formats
          </div>
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {formatOptions.length === 0 ? (
              <p className="text-[12px] text-[#9CA3AF]">No formats available</p>
            ) : (
              formatOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    toggleDraftValue(draftFormatFilters, setDraftFormatFilters, opt.value)
                  }
                  className={filterChipClass(draftFormatFilters.includes(opt.value))}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>

          <div className="bg-[#F3F4F6] px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">
            Language
          </div>
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {languageOptions.length === 0 ? (
              <p className="text-[12px] text-[#9CA3AF]">No languages available</p>
            ) : (
              languageOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    toggleDraftValue(draftLanguageFilters, setDraftLanguageFilters, opt.value)
                  }
                  className={filterChipClass(draftLanguageFilters.includes(opt.value))}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>

          <div className="bg-[#F3F4F6] px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">
            Preferred Time
          </div>
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {preferredTimeOptions.map((opt) => {
              const disabled = Boolean(opt.disabled);
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    toggleDraftValue(draftTimeFilters, setDraftTimeFilters, opt.value);
                  }}
                  className={filterChipClass(draftTimeFilters.includes(opt.value), disabled)}
                  title={disabled ? "This time period has passed" : undefined}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="sticky bottom-0 inset-x-0 flex gap-3 border-t border-[#E8E8E8] bg-white px-4 py-3 safe-area-pb">
          <button
            type="button"
            onClick={() => {
              setDraftPriceFilters([]);
              setDraftTimeFilters([]);
              setDraftFormatFilters([]);
              setDraftLanguageFilters([]);
            }}
            className="flex-1 h-11 rounded-xl border border-[#6900AA] text-[#6900AA] text-sm font-bold cursor-pointer"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => {
              setPriceFilters(draftPriceFilters);
              setTimeFilters(draftTimeFilters);
              setFormatFilters(draftFormatFilters);
              setLanguageFilters(draftLanguageFilters);
              setMobileSheet(null);
            }}
            className="flex-[1.4] h-11 rounded-xl bg-[#6900AA] text-white text-sm font-bold cursor-pointer"
          >
            Apply Filters
          </button>
        </div>
      </MobileBottomSheet>

      {/* Mobile: language + format sheet */}
      <MobileBottomSheet open={mobileSheet === "langFormat"} onClose={() => setMobileSheet(null)}>
        <div className="px-4 pt-4 pb-2">
          <p className="text-[11px] font-semibold text-[#9CA3AF] truncate">{movie.title}</p>
          <h2 className="mt-1 text-lg font-extrabold text-[#111111]">Select language and format</h2>
        </div>
        <div className="pb-24">
          {languageOptions.map((lang) => (
            <div key={lang.value}>
              <div className="bg-[#F3F4F6] px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">
                {lang.label}
              </div>
              <div className="flex flex-wrap gap-2 px-4 py-3">
                <button
                  type="button"
                  onClick={() =>
                    toggleDraftValue(draftLanguageFilters, setDraftLanguageFilters, lang.value)
                  }
                  className={filterChipClass(draftLanguageFilters.includes(lang.value))}
                >
                  {lang.label}
                </button>
                {formatOptions.map((fmt) => (
                  <button
                    key={`${lang.value}-${fmt.value}`}
                    type="button"
                    onClick={() => {
                      if (!draftLanguageFilters.includes(lang.value)) {
                        setDraftLanguageFilters([...draftLanguageFilters, lang.value]);
                      }
                      toggleDraftValue(draftFormatFilters, setDraftFormatFilters, fmt.value);
                    }}
                    className={filterChipClass(draftFormatFilters.includes(fmt.value))}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {languageOptions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[#9CA3AF]">No languages available for this date.</p>
          ) : null}
        </div>
        <div className="sticky bottom-0 inset-x-0 flex gap-3 border-t border-[#E8E8E8] bg-white px-4 py-3 safe-area-pb">
          <button
            type="button"
            onClick={() => {
              setDraftLanguageFilters([]);
              setDraftFormatFilters([]);
            }}
            className="flex-1 h-11 rounded-xl border border-[#6900AA] text-[#6900AA] text-sm font-bold cursor-pointer"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => {
              setLanguageFilters(draftLanguageFilters);
              setFormatFilters(draftFormatFilters);
              setMobileSheet(null);
            }}
            className="flex-[1.4] h-11 rounded-xl bg-[#6900AA] text-white text-sm font-bold cursor-pointer"
          >
            Apply
          </button>
        </div>
      </MobileBottomSheet>

      {/* Mobile: sort sheet */}
      <MobileBottomSheet open={mobileSheet === "sort"} onClose={() => setMobileSheet(null)}>
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-lg font-extrabold text-[#111111]">Sort by</h2>
        </div>
        <ul className="pb-6">
          {SORT_OPTIONS.map((opt, idx) => {
            const selected = sortBy === opt.value;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => {
                    setSortBy(opt.value);
                    setMobileSheet(null);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer ${
                    idx > 0 ? "border-t border-[#F0F0F0]" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold text-[#111111]">{opt.label}</span>
                    <span className="mt-0.5 block text-[12px] text-[#9CA3AF]">{opt.hint}</span>
                  </span>
                  <span
                    className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      selected ? "border-[#6900AA]" : "border-[#D1D5DB]"
                    }`}
                    aria-hidden
                  >
                    {selected ? <span className="size-2.5 rounded-full bg-[#6900AA]" /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </MobileBottomSheet>
    </div>
  );
}
