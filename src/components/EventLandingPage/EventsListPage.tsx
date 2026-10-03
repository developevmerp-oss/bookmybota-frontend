"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type TransitionEvent,
} from "react";
import { motion } from "motion/react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import { Check, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import SafeCoverImage, { EventImageFallback, ArtistImageFallback, ARTIST_IMAGE_FALLBACK_CLASS } from "@/components/Shared/SafeCoverImage";
import {
  api,
  useGetBusinessTypesQuery,
  useGetEventMastersQuery,
  useGetPublicEventFiltersQuery,
  useGetPublicEventsQuery,
  useGetPublicRegisteredArtistsQuery,
  type PublicEvent,
  type PublicEventsQuery,
  type PublicRegisteredPartner,
} from "@/services/api";
import { useAppDispatch } from "@/lib/hooks";
import { formatMoney } from "@/lib/currencyFormat";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { artistHref } from "@/lib/businessPublicPath";
import { ShowcaseEventPosterCard } from "@/components/LandingPage/PosterCard";
import Footer from "@/components/LandingPage/Footer";
import {
  ArtistRailShimmer,
  CustomerRailShimmer,
  EventExploreShimmer,
  EventHeroShimmer,
  EventListShimmer,
} from "@/components/Shared/Shimmer";
import {
  eventLandscape,
  eventPlaceLine,
  eventPortrait,
  formatEventDateLine,
  hasCityFilter,
  preferCityOrAll,
} from "@/components/LandingPage/homeUtils";
import CitySectionEmptyNotice from "@/components/LandingPage/CitySectionEmptyNotice";
import { RailPagerNav } from "@/components/LandingPage/RailChrome";
import { scrollRailBy, useHorizontalScrollEdges } from "@/lib/useHorizontalScrollEdges";
import { useStickyHeaderOffset } from "@/lib/useStickyHeaderOffset";
import "@/components/DinningLandingPage/DiningHomePage.css";
import {
  EVENT_CATEGORY_OPTIONS,
  categorySlugsMatch,
  resolveCategorySlug,
  resolveCategoryKeyFromSlug,
  type EventCategoryKey,
} from "@/lib/eventCategories";
import { SHOWCASE_EVENT_CARDS, showcaseCardsForCategories } from "@/data/showcaseEventCards";
import {
  setOrDeleteCsvParam,
  setOrDeleteParam,
  stableSearchParamsString,
} from "@/lib/filterUrlSync";
import "@/components/DinningLandingPage/DiningSearchPopup.css";

const PAGE_SIZE = 8;
const EMPTY_EVENTS: PublicEvent[] = [];
const EMPTY_CATEGORIES: Array<{ slug: string; name: string }> = [];
const EMPTY_ARTISTS: PublicRegisteredPartner[] = [];
const LANG_OPTIONS = ["English", "Amharic"] as const;
const PRICE_BANDS: Array<{ id: string; label: string }> = [
  { id: "free", label: "Free" },
  { id: "0-500", label: "0 - 500" },
  { id: "501-2000", label: "501 - 2000" },
  { id: "2000+", label: "Above 2000" },
];
const SORT_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "recommended", label: "Recommended" },
  { id: "date", label: "Date" },
  { id: "price-asc", label: "Price: Low to High" },
  { id: "price-desc", label: "Price: High to Low" },
  { id: "rating", label: "Rating" },
];
const EVENT_RECENT_SEARCHES_KEY = "events_recent_searches";
const MAX_RECENT_SEARCHES = 6;

function readEventRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EVENT_RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function writeEventRecentSearches(items: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      EVENT_RECENT_SEARCHES_KEY,
      JSON.stringify(items.slice(0, MAX_RECENT_SEARCHES))
    );
  } catch {
    /* ignore quota / private mode */
  }
}

const CONTAINER = "container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0";

const EXPLORE_EVENT_CATEGORIES = [
  {
    key: "music" as const,
    label: "Music",
    image: "/images/events/explore/music_1.png?v=3",
    gradient:
      "radial-gradient(ellipse 85% 70% at 50% 58%, rgba(255,255,255,0.88) 0%, transparent 72%), linear-gradient(165deg, #F8F7FF 0%, #E4DFFF 48%, #CDC6F5 100%)",
    border: "#C8C0E8",
    shadow: "0 8px 22px rgba(140, 120, 210, 0.16)",
  },
  {
    key: "concert" as const,
    label: "Concert",
    image: "/images/events/explore/concert_1.png?v=3",
    gradient:
      "radial-gradient(ellipse 85% 70% at 50% 58%, rgba(255,255,255,0.85) 0%, transparent 72%), linear-gradient(165deg, #FFFCF5 0%, #FFF0C8 48%, #FFE29A 100%)",
    border: "#E5D0A0",
    shadow: "0 8px 22px rgba(212, 168, 64, 0.16)",
  },
  {
    key: "comedy" as const,
    label: "Comedy",
    image: "/images/events/explore/comedy_1.png?v=3",
    gradient:
      "radial-gradient(ellipse 85% 70% at 50% 58%, rgba(255,255,255,0.88) 0%, transparent 72%), linear-gradient(165deg, #F5FFF8 0%, #D8F5E2 48%, #B8EBC8 100%)",
    border: "#A8D8B8",
    shadow: "0 8px 22px rgba(90, 180, 120, 0.15)",
  },
  {
    key: "sports" as const,
    label: "Sports",
    image: "/images/events/explore/sports_1.png?v=3",
    gradient:
      "radial-gradient(ellipse 85% 70% at 50% 58%, rgba(255,255,255,0.85) 0%, transparent 72%), linear-gradient(165deg, #FFF8F4 0%, #FFE0CE 48%, #FFC4A6 100%)",
    border: "#E8BFA8",
    shadow: "0 8px 22px rgba(232, 130, 90, 0.16)",
  },
];

const CATEGORY_BROWSE_HEADING: Record<EventCategoryKey, string> = {
  comedy: "Browse all comedy shows",
  concert: "Browse all concerts",
  music: "Browse all music events",
  sports: "Browse all sports events",
};

type PublicEventWithGenres = PublicEvent & { genres?: string[] | string | null; about_event?: string };

function parseEventGenres(genres?: string[] | string | null): string[] {
  if (!genres) return [];
  if (Array.isArray(genres)) return genres.map(String).map((g) => g.trim()).filter(Boolean);
  try {
    const parsed = JSON.parse(genres);
    return Array.isArray(parsed) ? parsed.map(String).map((g) => g.trim()).filter(Boolean) : [];
  } catch {
    return String(genres)
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);
  }
}

function eventMatchesSelectedGenres(event: PublicEventWithGenres, selected: string[]): boolean {
  if (!selected.length) return true;
  const normalized = selected.map((g) => g.trim().toLowerCase()).filter(Boolean);
  const eventGenres = parseEventGenres(event.genres).map((g) => g.toLowerCase());
  if (eventGenres.length) {
    return normalized.some((g) => eventGenres.includes(g));
  }
  const blob = `${event.name || ""} ${event.about_event || ""}`.toLowerCase();
  return normalized.some((g) => blob.includes(g));
}

function eventMatchesCategoryKey(
  event: PublicEvent,
  key: EventCategoryKey,
  categories: Array<{ slug: string; name: string }>
) {
  const slugKey = resolveCategoryKeyFromSlug(event.category_slug || "", categories);
  if (slugKey === key) return true;
  const nameKey = resolveCategoryKeyFromSlug(event.category_name || "", categories);
  if (nameKey === key) return true;
  const blob = `${event.category_slug || ""} ${event.category_name || ""} ${event.name || ""}`.toLowerCase();
  if (key === "comedy") return blob.includes("comedy") || blob.includes("stand") || blob.includes("laughter");
  if (key === "sports") return blob.includes("sport");
  if (key === "music") return blob.includes("music");
  if (key === "concert") return blob.includes("concert");
  return false;
}

function toIsoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseCsvParam(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function sameStringList(a: string[], b: string[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function formatPromoDateTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const weekday = d.toLocaleString("en-GB", { weekday: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-GB", { month: "short" });
  const time = d.toLocaleString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${weekday}, ${day} ${month}, ${time}`;
}

function priceOnwards(event: PublicEvent) {
  if (event.min_price == null || event.min_price === "") return null;
  const n = Number(event.min_price);
  if (Number.isNaN(n)) return null;
  if (n <= 0) return "Free";
  return `${formatMoney(n, { compact: true })} onwards`;
}

/** Compact promo card for mobile / tablet — poster like Top recommended + title/price. */
function PromoFeatureCard({
  event,
  active = false,
}: {
  event: PublicEvent;
  active?: boolean;
}) {
  const landscape = eventLandscape(event);
  const portrait = eventPortrait(event);
  const image = portrait || landscape;
  const price = priceOnwards(event);

  return (
    <Link
      href={`/events/${event.id}`}
      className={`group block overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white shadow-[0_1px_3px_rgba(17,17,17,0.06)] origin-center transition-[transform,box-shadow] duration-300 ease-out hover:shadow-[0_8px_24px_rgba(17,17,17,0.1)] ${
        active ? "scale-100" : "scale-[0.92]"
      }`}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-100">
        <SafeCoverImage
          src={image}
          alt={event.name}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          fallbackClassName="absolute inset-0 flex h-full w-full items-center justify-center bg-[#F3F4F6] text-slate-300"
          fallback={<EventImageFallback size={32} />}
        />
      </div>
      <div className="space-y-0.5 px-3.5 py-3 sm:px-4 sm:py-3.5">
        <h3 className="line-clamp-2 text-[15px] font-bold leading-snug tracking-tight text-[#1A1A1A] sm:text-base">
          {event.name}
        </h3>
        {price ? (
          <p className="line-clamp-1 text-[13px] font-normal text-[#8A8A8A] sm:text-sm">
            {price}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

function FilterTag({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold border cursor-pointer transition-colors ${
        active
          ? "bg-[#6900AA] border-[#6900AA] text-white"
          : "bg-white border-[#D4B3F0] text-[#6900AA] hover:bg-[#F7E9FF]"
      }`}
    >
      {label}
    </button>
  );
}

function FilterSection({
  title,
  open,
  onToggle,
  onClear,
  children,
  last = false,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  onClear: () => void;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div className={last ? undefined : "border-b border-slate-100"}>
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer text-left"
        >
          <FaChevronDown
            size={12}
            className={`shrink-0 transition-transform ${
              open ? "rotate-180 text-[#6900AA]" : "text-slate-400"
            }`}
          />
          <span className={`text-sm font-semibold ${open ? "text-[#6900AA]" : "text-slate-800"}`}>
            {title}
          </span>
        </button>
        <button
          type="button"
          onClick={onClear}
          className="text-xs sm:text-sm text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          Clear
        </button>
      </div>
      {open ? <div className="px-4 pb-3">{children}</div> : null}
    </div>
  );
}

function FiltersPanel({
  onClearAll,
  children,
}: {
  onClearAll: () => void;
  children: ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
        <h3 className="font-bold text-slate-900 text-base">Filters</h3>
        <button
          type="button"
          onClick={onClearAll}
          className="text-sm font-medium text-[#6900AA] hover:text-[#57008E] cursor-pointer"
        >
          Clear All
        </button>
      </div>
      {children}
    </div>
  );
}

function ChipButton({
  label,
  active,
  onClick,
  icon,
  trailing,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  icon?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] sm:text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
        active
          ? "bg-slate-100 border-slate-400 text-slate-800"
          : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
      }`}
    >
      {icon}
      {label}
      {trailing}
    </button>
  );
}

/** Fri–Sun range for "This weekend" (frontend-only; avoids backend Sat–Sun-only preset). */
function weekendFriSunRange(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const dow = now.getDay(); // 0=Sun … 6=Sat
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  let friOffset: number;
  if (dow === 5) friOffset = 0;
  else if (dow === 6) friOffset = -1;
  else if (dow === 0) friOffset = -2;
  else friOffset = 5 - dow;
  const fri = new Date(y, m, d + friOffset);
  const sun = new Date(y, m, d + friOffset + 2);
  return { from: iso(fri), to: iso(sun) };
}

function SelectionMark({ selected, multi }: { selected: boolean; multi?: boolean }) {
  if (multi) {
    return (
      <span
        className={`w-5 h-5 rounded-[4px] border flex items-center justify-center shrink-0 ${
          selected ? "border-[#6900AA] bg-[#6900AA]" : "border-slate-300 bg-white"
        }`}
      >
        {selected ? <Check size={13} strokeWidth={3} className="text-white" /> : null}
      </span>
    );
  }
  return (
    <span
      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
        selected ? "border-[#6900AA]" : "border-slate-300"
      }`}
    >
      {selected ? <span className="w-2.5 h-2.5 rounded-full bg-[#6900AA]" /> : null}
    </span>
  );
}

function FilterOptionRow({
  label,
  selected,
  multi,
  onSelect,
}: {
  label: string;
  selected: boolean;
  multi?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-center justify-between gap-3 py-3.5 text-left cursor-pointer"
    >
      <span className={`text-base ${selected ? "font-semibold text-slate-800" : "text-slate-600"}`}>
        {label}
      </span>
      <SelectionMark selected={selected} multi={multi} />
    </button>
  );
}

type FilterModalTab = "sort" | "date" | "genre" | "language" | "pricing";

const FILTER_MODAL_TABS: Array<{ id: FilterModalTab; label: string }> = [
  { id: "sort", label: "Sort" },
  { id: "date", label: "Date" },
  { id: "genre", label: "Genre" },
  { id: "language", label: "Language" },
  { id: "pricing", label: "Pricing" },
];

function DistrictEventCard({
  event,
  cityLabel,
}: {
  event: PublicEvent;
  cityLabel?: string;
}) {
  const portrait = eventPortrait(event);
  const place = eventPlaceLine(event, cityLabel);
  const dateLine = formatPromoDateTime(event.next_showtime);
  const price = priceOnwards(event);

  return (
    <Link
      href={`/events/${event.id}`}
      className="group block min-w-0 w-full overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white shadow-[0_1px_3px_rgba(17,17,17,0.06)] hover:shadow-[0_8px_24px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-100">
        <SafeCoverImage
          src={portrait}
          alt={event.name}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          fallbackClassName="absolute inset-0 flex h-full w-full items-center justify-center bg-[#F3F4F6] text-slate-300"
          fallback={<EventImageFallback size={32} />}
        />
      </div>
      <div className="space-y-1 px-3.5 py-3 sm:px-4 sm:py-3.5">
        {dateLine ? (
          <p className="text-sm font-semibold text-[#B59B2A]">{dateLine}</p>
        ) : null}
        <h3 className="text-base font-semibold leading-snug text-black line-clamp-2 sm:text-xl">
          {event.name}
        </h3>
        {place ? (
          <p className="text-sm font-medium text-[#6B6B6B] line-clamp-1">{place}</p>
        ) : null}
        {price ? (
          <p className="text-sm font-medium text-[#6B6B6B]">{price}</p>
        ) : null}
      </div>
    </Link>
  );
}

function RecommendCard({ event, cityLabel }: { event: PublicEvent; cityLabel?: string }) {
  const portrait = eventPortrait(event);
  const place = eventPlaceLine(event, cityLabel);
  const dateLine = formatEventDateLine(event.next_showtime);

  return (
    <Link
      href={`/events/${event.id}`}
      className="group shrink-0 w-[48vw] sm:w-[200px] md:w-[220px] lg:w-[240px] 2xl:w-[240px] snap-start rounded-2xl transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-slate-100 shadow-[0_1px_3px_rgba(17,17,17,0.06)] group-hover:shadow-[0_8px_24px_rgba(17,17,17,0.1)] transition-shadow duration-300">
        <SafeCoverImage
          src={portrait}
          alt={event.name}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          fallbackClassName="absolute inset-0 flex h-full w-full items-center justify-center bg-[#F3F4F6] text-slate-300"
          fallback={<EventImageFallback size={32} />}
        />
      </div>
      <div className="mt-2 space-y-0.5">
        {place ? (
          <p className="flex items-center gap-1 text-sm font-semibold text-slate-600 line-clamp-1">
            <MapPin className="shrink-0 text-[#6900AA]" size={13} strokeWidth={2} />
            <span className="truncate">{place}</span>
          </p>
        ) : null}
        <h3 className="text-sm sm:text-lg font-bold text-slate-900 line-clamp-1">{event.name}</h3>
        {dateLine ? <p className="text-sm font-semibold text-slate-500 line-clamp-1">{dateLine}</p> : null}
      </div>
    </Link>
  );
}

/** Static fallback for Top recommended only — same layout as RecommendCard. */
function RecommendShowcaseCard({
  title,
  image,
  showDate,
  place,
  href,
}: {
  title: string;
  image: string;
  showDate?: string;
  place?: string;
  href: string;
}) {
  const dateLine = formatEventDateLine(showDate);

  return (
    <Link
      href={href}
      className="group shrink-0 w-[48vw] sm:w-[200px] md:w-[220px] lg:w-[240px] 2xl:w-[240px] snap-start rounded-2xl transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-slate-100 shadow-[0_1px_3px_rgba(17,17,17,0.06)] group-hover:shadow-[0_8px_24px_rgba(17,17,17,0.1)] transition-shadow duration-300">
        <SafeCoverImage
          src={image}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          fallbackClassName="absolute inset-0 flex h-full w-full items-center justify-center bg-[#F3F4F6] text-slate-300"
          fallback={<EventImageFallback size={32} />}
        />
      </div>
      <div className="mt-2 space-y-0.5">
        {place ? (
          <p className="flex items-center gap-1 text-sm font-semibold text-slate-600 line-clamp-1">
            <MapPin className="shrink-0 text-[#6900AA]" size={13} strokeWidth={2} />
            <span className="truncate">{place}</span>
          </p>
        ) : null}
        <h3 className="text-sm sm:text-lg font-bold text-slate-900 line-clamp-1">{title}</h3>
        {dateLine ? <p className="text-sm font-semibold text-slate-500 line-clamp-1">{dateLine}</p> : null}
      </div>
    </Link>
  );
}

function ArtistChip({ artist }: { artist: PublicRegisteredPartner }) {
  const img = artist.cover_image_url?.trim()
    ? resolveMediaUrl(artist.cover_image_url.trim())
    : "";
  return (
    <Link
      href={artistHref(artist)}
      className="shrink-0 w-[120px] sm:w-[190px] snap-start flex flex-col items-center gap-2.5 text-center group"
    >
      <div className="relative h-[120px] w-[120px] sm:h-[190px] sm:w-[190px] rounded-full overflow-hidden bg-[#F7E9FF] ring-2 ring-white shadow-sm">
        <SafeCoverImage
          src={img}
          alt={artist.name}
          className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
          fallbackClassName={ARTIST_IMAGE_FALLBACK_CLASS}
          fallback={<ArtistImageFallback size={40} />}
        />
      </div>
      <span className="text-sm sm:text-base font-semibold text-slate-800 line-clamp-2 leading-tight px-0.5 w-full">
        {artist.name}
      </span>
    </Link>
  );
}

export default function PublicEventsPage() {
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(() => searchParams.get("q") || "");
  const router = useRouter();
  const pathname = usePathname() || "/events";
  const [search, setSearch] = useState(() => (searchParams.get("q") || "").trim());
  const [city, setCity] = useState(() => {
    const cityParam = searchParams.get("city");
    if (cityParam) return cityParam === "All Cities" ? "" : cityParam;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("selected_city");
      return stored && stored !== "All Cities" ? stored : "";
    }
    return "";
  });
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(() =>
    parseCsvParam(searchParams.get("category"))
  );
  /** Admin genre masters — category page filter modal only (not sent to public events API). */
  const [selectedEventGenres, setSelectedEventGenres] = useState<string[]>(() =>
    parseCsvParam(searchParams.get("genres"))
  );
  const [datePreset, setDatePreset] = useState(() => searchParams.get("date_preset") || "");
  const [dateFrom, setDateFrom] = useState(() => searchParams.get("date_from") || "");
  const [dateTo, setDateTo] = useState(() => searchParams.get("date_to") || "");
  const [useDateRange, setUseDateRange] = useState(() =>
    Boolean(searchParams.get("date_from") || searchParams.get("date_to"))
  );
  const [calTab, setCalTab] = useState<"start" | "end">("start");
  const [calMonth, setCalMonth] = useState(() => new Date());
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(() =>
    parseCsvParam(searchParams.get("language"))
  );
  const [selectedPriceBands, setSelectedPriceBands] = useState<string[]>(() =>
    parseCsvParam(searchParams.get("price"))
  );
  const [selectedMore, setSelectedMore] = useState<string[]>(() =>
    parseCsvParam(searchParams.get("more"))
  );
  /** Draft selections inside the filter popup — committed only on Apply / Clear. */
  const [draftSlugs, setDraftSlugs] = useState<string[]>([]);
  const [draftEventGenres, setDraftEventGenres] = useState<string[]>([]);
  const [draftDatePreset, setDraftDatePreset] = useState("");
  const [draftDateFrom, setDraftDateFrom] = useState("");
  const [draftDateTo, setDraftDateTo] = useState("");
  const [draftUseDateRange, setDraftUseDateRange] = useState(false);
  const [draftLanguages, setDraftLanguages] = useState<string[]>([]);
  const [draftPriceBands, setDraftPriceBands] = useState<string[]>([]);
  const [draftSort, setDraftSort] = useState("recommended");
  const [openFilters, setOpenFilters] = useState({
    categories: true,
    date: false,
    city: false,
    languages: false,
    price: false,
    more: false,
  });
  const [filterModalTab, setFilterModalTab] = useState<FilterModalTab>("sort");
  const [sort, setSort] = useState(() => {
    const sortParam = searchParams.get("sort");
    return sortParam && SORT_OPTIONS.some((o) => o.id === sortParam) ? sortParam : "recommended";
  });
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchPopupOpen, setSearchPopupOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [heroSlideTransition, setHeroSlideTransition] = useState(true);
  const [mobilePromoIndex, setMobilePromoIndex] = useState(0);
  const [promoDesktopAutoplay, setPromoDesktopAutoplay] = useState(false);
  const mobilePromoTrackRef = useRef<HTMLDivElement>(null);
  const [offerHeroEvents, setOfferHeroEvents] = useState<PublicEvent[]>([]);

  const recommendRef = useRef<HTMLDivElement>(null);
  const artistsRef = useRef<HTMLDivElement>(null);
  const allEventsRef = useRef<HTMLElement>(null);
  const filtersStickySentinelRef = useRef<HTMLDivElement>(null);
  const categoryFromFilterRef = useRef(false);
  // One category in URL → dedicated browse from first paint (avoids home showcase flash)
  const [dedicatedCategoryPage, setDedicatedCategoryPage] = useState(
    () => parseCsvParam(searchParams.get("category")).length === 1
  );
  const headerOffset = useStickyHeaderOffset();
  const [isFiltersStuck, setIsFiltersStuck] = useState(false);

  useEffect(() => {
    const sentinel = filtersStickySentinelRef.current;
    if (!sentinel) {
      setIsFiltersStuck(false);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        const next = !entry.isIntersecting;
        setIsFiltersStuck((prev) => (prev === next ? prev : next));
      },
      {
        root: null,
        threshold: 0,
        rootMargin: `-${Math.max(headerOffset, 1)}px 0px 0px 0px`,
      }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [headerOffset]);

  const scrollToEventsViewport = useCallback(() => {
    window.setTimeout(() => {
      allEventsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, []);

  const syncDraftFromApplied = useCallback(() => {
    setDraftSlugs(selectedSlugs);
    setDraftEventGenres(selectedEventGenres);
    setDraftDatePreset(datePreset);
    setDraftDateFrom(dateFrom);
    setDraftDateTo(dateTo);
    setDraftUseDateRange(useDateRange);
    setDraftLanguages(selectedLanguages);
    setDraftPriceBands(selectedPriceBands);
    setDraftSort(sort);
  }, [
    selectedSlugs,
    selectedEventGenres,
    datePreset,
    dateFrom,
    dateTo,
    useDateRange,
    selectedLanguages,
    selectedPriceBands,
    sort,
  ]);

  const openFiltersModal = useCallback(
    (tab: FilterModalTab = "sort") => {
      setSearchPopupOpen(false);
      syncDraftFromApplied();
      setFilterModalTab(tab);
      setFiltersOpen(true);
    },
    [syncDraftFromApplied]
  );

  const closeFiltersModal = useCallback(() => {
    setFiltersOpen(false);
  }, []);

  const closeSearchPopup = useCallback(() => {
    setSearchPopupOpen(false);
  }, []);

  const openSearchPopup = useCallback(() => {
    setFiltersOpen(false);
    setSearchDraft(searchInput);
    setRecentSearches(readEventRecentSearches());
    setSearchPopupOpen(true);
  }, [searchInput]);

  const commitEventSearch = useCallback(
    (raw: string) => {
      const next = raw.trim();
      setSearchInput(next);
      setSearch(next);
      if (next) {
        const updated = [next, ...readEventRecentSearches().filter((t) => t.toLowerCase() !== next.toLowerCase())];
        writeEventRecentSearches(updated);
        setRecentSearches(updated.slice(0, MAX_RECENT_SEARCHES));
      }
      setSearchPopupOpen(false);
      scrollToEventsViewport();
    },
    [scrollToEventsViewport]
  );

  useEffect(() => {
    if (!searchPopupOpen) return;
    const scrollY = window.scrollY;
    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    }, 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchPopupOpen(false);
    };
    window.addEventListener("keydown", onKey);

    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const prevPosition = body.style.position;
    const prevTop = body.style.top;
    const prevWidth = body.style.width;
    const scrollbarGap = Math.max(0, window.innerWidth - document.documentElement.clientWidth);

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    if (scrollbarGap > 0) body.style.paddingRight = `${scrollbarGap}px`;

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
      body.style.position = prevPosition;
      body.style.top = prevTop;
      body.style.width = prevWidth;
      window.scrollTo(0, scrollY);
    };
  }, [searchPopupOpen]);

  useEffect(() => {
    if (!filtersOpen) return;
    const scrollY = window.scrollY;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const prevPosition = body.style.position;
    const prevTop = body.style.top;
    const prevWidth = body.style.width;
    const scrollbarGap = Math.max(0, window.innerWidth - document.documentElement.clientWidth);

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    if (scrollbarGap > 0) body.style.paddingRight = `${scrollbarGap}px`;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
      body.style.position = prevPosition;
      body.style.top = prevTop;
      body.style.width = prevWidth;
      window.scrollTo(0, scrollY);
    };
  }, [filtersOpen]);

  /** Persist all listing filters in the URL so refresh keeps the same selection. */
  const buildEventsFilterParams = useCallback(() => {
    const params = new URLSearchParams();
    setOrDeleteParam(params, "q", search);
    setOrDeleteCsvParam(params, "category", selectedSlugs);
    setOrDeleteParam(params, "city", city);
    setOrDeleteCsvParam(params, "language", selectedLanguages);
    setOrDeleteCsvParam(params, "price", selectedPriceBands);
    setOrDeleteCsvParam(params, "more", selectedMore);
    setOrDeleteCsvParam(params, "genres", selectedEventGenres);
    if (datePreset) {
      setOrDeleteParam(params, "date_preset", datePreset);
    } else {
      setOrDeleteParam(params, "date_from", dateFrom);
      setOrDeleteParam(params, "date_to", dateTo);
    }
    if (sort && sort !== "recommended") setOrDeleteParam(params, "sort", sort);
    return params;
  }, [
    search,
    selectedSlugs,
    city,
    selectedLanguages,
    selectedPriceBands,
    selectedMore,
    selectedEventGenres,
    datePreset,
    dateFrom,
    dateTo,
    sort,
  ]);

  useEffect(() => {
    const params = buildEventsFilterParams();
    // Compare against live searchParams, but do NOT depend on them — otherwise a
    // nav click (URL→new category) re-runs this with stale state and overwrites the URL.
    if (stableSearchParamsString(params) === stableSearchParamsString(searchParams)) return;
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally omit searchParams to avoid clobbering inbound navigation
  }, [buildEventsFilterParams, pathname, router]);

  const syncCategoryToUrl = useCallback(
    (slugs: string[] | string | null) => {
      const list = Array.isArray(slugs) ? slugs : slugs ? [slugs] : [];
      const params = buildEventsFilterParams();
      setOrDeleteCsvParam(params, "category", list);
      if (stableSearchParamsString(params) === stableSearchParamsString(searchParams)) return;
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [buildEventsFilterParams, searchParams, pathname, router]
  );

  const applyFiltersAndClose = useCallback(() => {
    if (dedicatedCategoryPage) {
      setSelectedEventGenres(draftEventGenres);
    } else {
      categoryFromFilterRef.current = true;
      setDedicatedCategoryPage(false);
      setSelectedSlugs(draftSlugs);
    }
    setDatePreset(draftDatePreset);
    setDateFrom(draftDateFrom);
    setDateTo(draftDateTo);
    setUseDateRange(draftUseDateRange);
    setSelectedLanguages(draftLanguages);
    setSelectedPriceBands(draftPriceBands);
    setSort(draftSort);
    setFiltersOpen(false);
    scrollToEventsViewport();
  }, [
    dedicatedCategoryPage,
    draftEventGenres,
    draftSlugs,
    draftDatePreset,
    draftDateFrom,
    draftDateTo,
    draftUseDateRange,
    draftLanguages,
    draftPriceBands,
    draftSort,
    scrollToEventsViewport,
  ]);

  const clearModalFiltersAndApply = useCallback(() => {
    setDraftDatePreset("");
    setDraftDateFrom("");
    setDraftDateTo("");
    setDraftUseDateRange(false);
    setDraftLanguages([]);
    setDraftPriceBands([]);
    setDraftEventGenres([]);
    setDraftSort("recommended");
    setDatePreset("");
    setDateFrom("");
    setDateTo("");
    setUseDateRange(false);
    setSelectedLanguages([]);
    setSelectedPriceBands([]);
    setSelectedMore([]);
    setSelectedEventGenres([]);
    setSort("recommended");
    if (!dedicatedCategoryPage) {
      categoryFromFilterRef.current = true;
      setDedicatedCategoryPage(false);
      setDraftSlugs([]);
      setSelectedSlugs([]);
    }
    setFiltersOpen(false);
    scrollToEventsViewport();
  }, [dedicatedCategoryPage, scrollToEventsViewport]);

  const { data: filterOptions } = useGetPublicEventFiltersQuery();
  const apiCategories = filterOptions?.categories ?? EMPTY_CATEGORIES;
  const { data: businessTypes = [] } = useGetBusinessTypesQuery("event");

  const categoryPool = useMemo(() => {
    if (apiCategories.length) return apiCategories;
    return businessTypes
      .filter((type) => type.parent_type_id && type.slug)
      .map((type) => ({ slug: type.slug as string, name: type.name }));
  }, [apiCategories, businessTypes]);

  const categoryPoolKey = useMemo(
    () => categoryPool.map((c) => `${c.slug}:${c.name}`).join("|"),
    [categoryPool]
  );

  const searchParamsKey = searchParams.toString();

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useLayoutEffect(() => {
    const q = searchParams.get("q") || "";
    const cat = searchParams.get("category");
    const cityParam = searchParams.get("city");
    const language = searchParams.get("language");
    const price = searchParams.get("price");
    const more = searchParams.get("more");
    const datePresetParam = searchParams.get("date_preset");
    const dateFromParam = searchParams.get("date_from");
    const dateToParam = searchParams.get("date_to");
    const sortParam = searchParams.get("sort");

    const slugsFromUrl = parseCsvParam(cat);
    const languagesFromUrl = parseCsvParam(language);
    const priceFromUrl = parseCsvParam(price);
    const moreFromUrl = parseCsvParam(more);
    const genresFromUrl = parseCsvParam(searchParams.get("genres"));
    const nextSearch = q.trim();

    setSearchInput((prev) => (prev === q ? prev : q));
    setSearch((prev) => (prev === nextSearch ? prev : nextSearch));
    setSelectedSlugs((prev) => (sameStringList(prev, slugsFromUrl) ? prev : slugsFromUrl));
    setSelectedLanguages((prev) =>
      sameStringList(prev, languagesFromUrl) ? prev : languagesFromUrl
    );
    setSelectedPriceBands((prev) => (sameStringList(prev, priceFromUrl) ? prev : priceFromUrl));
    setSelectedMore((prev) => (sameStringList(prev, moreFromUrl) ? prev : moreFromUrl));
    setSelectedEventGenres((prev) =>
      sameStringList(prev, genresFromUrl) ? prev : genresFromUrl
    );

    if (categoryFromFilterRef.current) {
      categoryFromFilterRef.current = false;
      setDedicatedCategoryPage(false);
    } else if (
      slugsFromUrl.length === 1 &&
      resolveCategoryKeyFromSlug(slugsFromUrl[0], categoryPool)
    ) {
      setDedicatedCategoryPage(true);
    } else {
      setDedicatedCategoryPage(false);
    }

    if (datePresetParam) {
      setDatePreset((prev) => (prev === datePresetParam ? prev : datePresetParam));
      setDateFrom((prev) => (prev === "" ? prev : ""));
      setDateTo((prev) => (prev === "" ? prev : ""));
      setUseDateRange(false);
    } else {
      const nextFrom = dateFromParam || "";
      const nextTo = dateToParam || "";
      setDatePreset((prev) => (prev === "" ? prev : ""));
      setDateFrom((prev) => (prev === nextFrom ? prev : nextFrom));
      setDateTo((prev) => (prev === nextTo ? prev : nextTo));
      setUseDateRange(Boolean(nextFrom || nextTo));
    }

    if (sortParam && SORT_OPTIONS.some((o) => o.id === sortParam)) {
      setSort((prev) => (prev === sortParam ? prev : sortParam));
    } else if (!sortParam) {
      setSort((prev) => (prev === "recommended" ? prev : "recommended"));
    }

    let nextCity = "";
    if (cityParam) {
      nextCity = cityParam === "All Cities" ? "" : cityParam;
    } else {
      const stored = localStorage.getItem("selected_city");
      nextCity = stored && stored !== "All Cities" ? stored : "";
    }
    setCity((prev) => (prev === nextCity ? prev : nextCity));
    // categoryPool is read for slug resolution; key keeps identity stable across renders
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParamsKey / categoryPoolKey intentionally stabilize deps
  }, [searchParamsKey, categoryPoolKey]);

  useEffect(() => {
    const applyCity = () => {
      const stored = localStorage.getItem("selected_city");
      if (stored && stored !== "All Cities") setCity(stored);
      else setCity("");
    };
    window.addEventListener("selected_city_changed", applyCity);
    return () => window.removeEventListener("selected_city_changed", applyCity);
  }, []);

  const queryArg = useMemo(() => {
    const weekend =
      datePreset === "weekend" ? weekendFriSunRange() : null;
    return {
      ...(search.trim() ? { q: search.trim() } : {}),
      ...(city ? { city } : {}),
      ...(selectedSlugs.length ? { category: selectedSlugs.join(",") } : {}),
      ...(selectedLanguages.length ? { language: selectedLanguages.join(",") } : {}),
      ...(selectedPriceBands.length ? { price: selectedPriceBands.join(",") } : {}),
      ...(selectedMore.length ? { more: selectedMore.join(",") } : {}),
      // Weekend: send Fri–Sun as date range so Fri events (e.g. 18 Sep) are included
      ...(weekend
        ? { date_from: weekend.from, date_to: weekend.to }
        : datePreset
          ? { date_preset: datePreset }
          : {
              ...(dateFrom ? { date_from: dateFrom } : {}),
              ...(dateTo ? { date_to: dateTo } : {}),
            }),
      ...(sort && sort !== "recommended" ? { sort } : {}),
    };
  }, [
    search,
    city,
    selectedSlugs,
    selectedLanguages,
    selectedPriceBands,
    selectedMore,
    datePreset,
    dateFrom,
    dateTo,
    sort,
  ]);
  const { data: eventsData, isLoading, isFetching, isUninitialized } =
    useGetPublicEventsQuery(queryArg);
  const events = eventsData ?? EMPTY_EVENTS;

  const unscopedQueryArg = useMemo(() => {
    const { city: _city, ...rest } = queryArg;
    return rest;
  }, [queryArg]);

  const {
    data: allPublicEventsData,
    isLoading: loadingAllPublic,
    isFetching: fetchingAllPublic,
  } = useGetPublicEventsQuery(unscopedQueryArg, {
    skip: !hasCityFilter(city),
  });
  const allPublicEvents = allPublicEventsData ?? EMPTY_EVENTS;
  const hasCity = hasCityFilter(city);

  /** Listing cards: city-first with same-filter all-city fallback (landing PreferCityOrAll). */
  const listingEvents = preferCityOrAll(events, allPublicEvents, hasCity);

  const {
    data: allEventsForExploreData,
    isLoading: loadingExplore,
    isFetching: fetchingExplore,
  } = useGetPublicEventsQuery(undefined);
  const allEventsForExplore = allEventsForExploreData ?? EMPTY_EVENTS;

  const { data: artistsData, isLoading: artistsLoading } = useGetPublicRegisteredArtistsQuery();
  const artists = artistsData ?? EMPTY_ARTISTS;

  const exploreEventPool = hasCity ? events : allEventsForExplore;

  /** True until city/global catalog settles — never flash showcase during this window. */
  const catalogPending =
    isUninitialized ||
    isLoading ||
    (isFetching && events.length === 0) ||
    (hasCity &&
      events.length === 0 &&
      (loadingAllPublic || (fetchingAllPublic && allPublicEvents.length === 0))) ||
    (!hasCity &&
      (loadingExplore || (fetchingExplore && allEventsForExplore.length === 0)));

  const showEventShowcase = !catalogPending && listingEvents.length === 0;
  const posterFallbackEvents = useMemo(
    () =>
      exploreEventPool
        .filter((event) => event.poster_horizontal_url || event.poster_vertical_url || event.name)
        .slice(0, 12),
    [exploreEventPool]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const candidates = (
          exploreEventPool.length
            ? exploreEventPool
            : await dispatch(
                api.endpoints.getPublicEvents.initiate(undefined, { forceRefetch: false })
              ).unwrap()
        ).filter(
          (event) => event.poster_horizontal_url || event.poster_vertical_url || event.name
        );

        const withOffers: PublicEvent[] = [];
        await Promise.all(
          candidates.slice(0, 24).map(async (event) => {
            if (cancelled) return;
            try {
              const offers = await dispatch(
                api.endpoints.getPublicEventOffers.initiate(event.id, { forceRefetch: false })
              ).unwrap();
              if (offers?.length) withOffers.push(event);
            } catch {
              // skip events without offers
            }
          })
        );
        if (!cancelled) setOfferHeroEvents(withOffers);
      } catch {
        if (!cancelled) setOfferHeroEvents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch, exploreEventPool]);

  const categoryFilters = useMemo(
    () =>
      EVENT_CATEGORY_OPTIONS.map((opt) => ({
        slug: resolveCategorySlug(opt.key, categoryPool),
        name: opt.label,
      })),
    [categoryPool]
  );

  const exploreCategoriesWithEvents = useMemo(() => {
    // While catalog loads, return empty so UI can shimmer (don't flash all static tiles)
    if (catalogPending) return [];
    const pool =
      exploreEventPool.length > 0
        ? exploreEventPool
        : events.length > 0
          ? events
          : posterFallbackEvents;
    if (pool.length === 0) return EXPLORE_EVENT_CATEGORIES;
    return EXPLORE_EVENT_CATEGORIES.filter((cat) =>
      pool.some((event) => eventMatchesCategoryKey(event, cat.key, categoryPool))
    );
  }, [catalogPending, exploreEventPool, events, posterFallbackEvents, categoryPool]);

  const emptyShowcaseCards = useMemo(() => {
    if (selectedSlugs.length === 0) return SHOWCASE_EVENT_CARDS;
    const keys = selectedSlugs
      .map((slug) => resolveCategoryKeyFromSlug(slug, categoryPool))
      .filter((key): key is EventCategoryKey => key != null);
    if (keys.length === 0) return SHOWCASE_EVENT_CARDS;
    return showcaseCardsForCategories(keys);
  }, [selectedSlugs, categoryPool]);

  const languageOptions = useMemo(() => {
    if (filterOptions?.languages?.length) return filterOptions.languages;
    return [...LANG_OPTIONS];
  }, [filterOptions?.languages]);

  const priceBands = useMemo(() => {
    if (filterOptions?.price_bands?.length) return filterOptions.price_bands;
    return PRICE_BANDS;
  }, [filterOptions?.price_bands]);

  const cityOptions = useMemo(() => filterOptions?.cities ?? [], [filterOptions?.cities]);

  const datePresets = filterOptions?.date_presets?.length
    ? filterOptions.date_presets
    : [
        { id: "today", label: "Today" },
        { id: "tomorrow", label: "Tomorrow" },
        { id: "weekend", label: "This Weekend" },
      ];
  const moreOptions = filterOptions?.more?.length ? filterOptions.more : [];

  const activeCategoryKey = useMemo(() => {
    if (selectedSlugs.length !== 1) return null;
    const fromPool = resolveCategoryKeyFromSlug(selectedSlugs[0], categoryPool);
    if (fromPool) return fromPool;
    // URL slug may match a known category key before API category pool loads
    const raw = selectedSlugs[0].trim().toLowerCase();
    const known = EVENT_CATEGORY_OPTIONS.find(
      (opt) => opt.key === raw || opt.label.toLowerCase() === raw
    );
    return known?.key ?? null;
  }, [selectedSlugs, categoryPool]);

  const isCategoryBrowse = Boolean(dedicatedCategoryPage && selectedSlugs.length === 1);

  const categoryTypeId = useMemo(() => {
    if (!isCategoryBrowse || selectedSlugs.length !== 1) return undefined;
    const slug = selectedSlugs[0];
    const match = businessTypes.find(
      (type) => type.parent_type_id && type.slug && categorySlugsMatch(type.slug, slug, categoryPool)
    );
    return match?.id;
  }, [isCategoryBrowse, selectedSlugs, businessTypes, categoryPool]);

  const { data: categoryMasters, isLoading: categoryMastersLoading } = useGetEventMastersQuery(
    categoryTypeId!,
    { skip: !categoryTypeId }
  );

  const categoryGenreOptions = useMemo(
    () => categoryMasters?.genres?.filter((g) => g.is_active !== false) ?? [],
    [categoryMasters?.genres]
  );

  const filtered = useMemo(() => {
    if (!isCategoryBrowse || selectedEventGenres.length === 0) return listingEvents;
    return listingEvents.filter((event) => eventMatchesSelectedGenres(event, selectedEventGenres));
  }, [listingEvents, isCategoryBrowse, selectedEventGenres]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  useEffect(() => {
    if (!isCategoryBrowse) setSelectedEventGenres([]);
  }, [isCategoryBrowse]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    city,
    selectedSlugs,
    selectedEventGenres,
    selectedLanguages,
    selectedPriceBands,
    selectedMore,
    datePreset,
    dateFrom,
    dateTo,
    sort,
  ]);

  const selectSlug = (slug?: string) => {
    if (!slug) return;
    categoryFromFilterRef.current = true;
    setDedicatedCategoryPage(false);
    const isActive = selectedSlugs.some((s) => categorySlugsMatch(s, slug, categoryPool));
    const next = isActive
      ? selectedSlugs.filter((s) => !categorySlugsMatch(s, slug, categoryPool))
      : [...selectedSlugs, slug];
    setSelectedSlugs(next);
    syncCategoryToUrl(next);
  };

  /** Dedicated category layout (sub-nav / Explore Events only). */
  const enterDedicatedCategoryPage = (slug: string) => {
    categoryFromFilterRef.current = false;
    setDedicatedCategoryPage(true);
    setSelectedSlugs([slug]);
    syncCategoryToUrl([slug]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const clearCity = () => {
    setCity("");
    localStorage.setItem("selected_city", "All Cities");
    window.dispatchEvent(new Event("selected_city_changed"));
  };

  const clearAllFilters = () => {
    categoryFromFilterRef.current = true;
    setDedicatedCategoryPage(false);
    setSelectedSlugs([]);
    setDatePreset("");
    setDateFrom("");
    setDateTo("");
    setUseDateRange(false);
    clearCity();
    setSelectedLanguages([]);
    setSelectedPriceBands([]);
    setSelectedMore([]);
    setSelectedEventGenres([]);
    setSearchInput("");
    setSearch("");
    setSort("recommended");
  };

  const toggleEventGenre = (name: string) => {
    setSelectedEventGenres((prev) =>
      prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name]
    );
  };

  const toggleIn = (list: string[], value: string, setter: (next: string[]) => void) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const toggleOpen = (key: keyof typeof openFilters) => {
    setOpenFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectCity = (cityName: string) => {
    setCity(cityName);
    localStorage.setItem("selected_city", cityName);
    window.dispatchEvent(new Event("selected_city_changed"));
  };

  const clearDateFilters = () => {
    setDatePreset("");
    setDateFrom("");
    setDateTo("");
    setUseDateRange(false);
    setCalTab("start");
  };

  const pickCalendarDay = (day: number) => {
    const iso = toIsoDate(calMonth.getFullYear(), calMonth.getMonth(), day);
    setDatePreset("");
    if (calTab === "start") {
      setDateFrom(iso);
      if (dateTo && iso > dateTo) setDateTo("");
      setCalTab("end");
    } else if (dateFrom && iso < dateFrom) {
      setDateFrom(iso);
    } else {
      setDateTo(iso);
    }
  };

  const calendarCells = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const cells: Array<number | null> = [];
    for (let i = 0; i < firstDow; i += 1) cells.push(null);
    for (let d = 1; d <= days; d += 1) cells.push(d);
    return cells;
  }, [calMonth]);

  const headingCity = city || "Ethiopia";
  const hasNonCityFilters =
    (!isCategoryBrowse && selectedSlugs.length > 0) ||
    (isCategoryBrowse && selectedEventGenres.length > 0) ||
    Boolean(datePreset) ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    selectedLanguages.length > 0 ||
    selectedPriceBands.length > 0 ||
    selectedMore.length > 0;
  const hasActiveFilters = hasNonCityFilters || Boolean(city);

  const listingWithPosters = useMemo(
    () =>
      listingEvents.filter(
        (event) => event.poster_horizontal_url || event.poster_vertical_url || event.name
      ),
    [listingEvents]
  );

  const browseHeading = activeCategoryKey
    ? CATEGORY_BROWSE_HEADING[activeCategoryKey]
    : "All Events";

  /** Selected city has zero events — show under event section titles (listing + category browse). */
  const cityHasNoEvents = hasCity && !catalogPending && events.length === 0;

  /** District-style hero: city-scoped is_promoted first (landing parity — no cross-city filler). */
  const promoEvents = useMemo(() => {
    const filterByCategory = (pool: PublicEvent[]) => {
      if (!activeCategoryKey) return pool;
      return pool.filter((event) =>
        eventMatchesCategoryKey(event, activeCategoryKey, categoryPool)
      );
    };

    const dedupe = (pool: PublicEvent[]) => {
      const seen = new Set<string>();
      return pool.filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
    };

    // When a city is selected, only use that city's listing — never all-cities explore pool.
    const basePool = hasCity
      ? listingWithPosters
      : [...exploreEventPool, ...listingWithPosters, ...offerHeroEvents, ...posterFallbackEvents];

    const scopedBase = dedupe(
      filterByCategory(basePool).filter(
        (event) =>
          event.poster_horizontal_url || event.poster_vertical_url || event.name
      )
    );

    if (!scopedBase.length) return [];

    const promotedOnly = scopedBase.filter((e) => Boolean(e.is_promoted));
    if (promotedOnly.length) return promotedOnly.slice(0, 8);

    if (!hasCity) {
      const offersInScope = filterByCategory(offerHeroEvents);
      if (offersInScope.length) {
        const promotedOffers = offersInScope.filter((e) => Boolean(e.is_promoted));
        return (promotedOffers.length ? promotedOffers : offersInScope).slice(0, 8);
      }
      return scopedBase.slice(0, 8);
    }

    // City selected: promoted only — hide hero if none (landing-style, no random filler).
    return [];
  }, [
    activeCategoryKey,
    exploreEventPool,
    offerHeroEvents,
    posterFallbackEvents,
    listingWithPosters,
    categoryPool,
    hasCity,
  ]);

  const promoEventsKey = useMemo(
    () => promoEvents.map((e) => e.id).join("|"),
    [promoEvents]
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setPromoDesktopAutoplay(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setHeroSlideTransition(false);
    setHeroSlideIndex(0);
    setMobilePromoIndex(0);
    const t = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setHeroSlideTransition(true));
    });
    return () => window.cancelAnimationFrame(t);
  }, [promoEventsKey]);

  // Autoplay only on desktop — mobile/tablet are manual (swipe)
  useEffect(() => {
    if (!promoDesktopAutoplay || promoEvents.length <= 1) return;
    const t = window.setInterval(() => {
      setHeroSlideIndex((i) => i + 1);
    }, 4500);
    return () => window.clearInterval(t);
  }, [promoDesktopAutoplay, promoEventsKey, promoEvents.length]);

  const activeHeroDot = promoEvents.length
    ? heroSlideIndex % promoEvents.length
    : 0;
  const activeHeroEvent = promoEvents[activeHeroDot] ?? null;
  const promoLoopSlides = useMemo(
    () => [...promoEvents, ...(promoEvents.length > 1 ? [promoEvents[0]] : [])],
    [promoEvents]
  );

  const syncMobilePromoIndex = useCallback(() => {
    const el = mobilePromoTrackRef.current;
    if (!el) return;
    const cards = el.querySelectorAll<HTMLElement>("[data-promo-card]");
    if (!cards.length) return;
    const centerX = el.getBoundingClientRect().left + el.clientWidth / 2;
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    cards.forEach((card, i) => {
      const r = card.getBoundingClientRect();
      const mid = r.left + r.width / 2;
      const dist = Math.abs(mid - centerX);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setMobilePromoIndex(best);
  }, []);

  const centerMobilePromoCard = useCallback(
    (index = 0, behavior: ScrollBehavior = "auto") => {
      const el = mobilePromoTrackRef.current;
      if (!el) return;
      const cards = el.querySelectorAll<HTMLElement>("[data-promo-card]");
      const card = cards[index];
      if (!card) return;
      const left =
        card.offsetLeft - Math.max(0, (el.clientWidth - card.offsetWidth) / 2);
      el.scrollTo({ left, behavior });
      setMobilePromoIndex(index);
    },
    []
  );

  useEffect(() => {
    if (promoEvents.length < 2) return;
    const frame = window.requestAnimationFrame(() => {
      centerMobilePromoCard(0, "auto");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [promoEventsKey, promoEvents.length, centerMobilePromoCard]);

  const goNextPromo = () => setHeroSlideIndex((i) => i + 1);
  const goPrevPromo = () => {
    if (promoEvents.length <= 1) return;
    if (heroSlideIndex === 0) {
      setHeroSlideTransition(false);
      setHeroSlideIndex(promoEvents.length);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setHeroSlideTransition(true);
          setHeroSlideIndex(promoEvents.length - 1);
        });
      });
      return;
    }
    setHeroSlideIndex((i) => i - 1);
  };
  const onPromoTrackTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName !== "transform") return;
    if (promoEvents.length <= 1) return;
    if (heroSlideIndex < promoEvents.length) return;
    setHeroSlideTransition(false);
    setHeroSlideIndex(0);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setHeroSlideTransition(true));
    });
  };

  const recommendedEvents = useMemo(() => {
    if (catalogPending) return [];
    // City → global (listingEvents via preferCityOrAll) → poster fallback when both empty
    const poolSource = listingEvents.length ? listingEvents : posterFallbackEvents;
    const promoted = poolSource.filter((e) => e.is_promoted);
    const pool = promoted.length ? promoted : poolSource;
    return pool.slice(0, 15);
  }, [catalogPending, listingEvents, posterFallbackEvents]);

  const recommendSlideCount =
    catalogPending
      ? 4
      : recommendedEvents.length > 0
        ? recommendedEvents.length
        : emptyShowcaseCards.slice(0, 8).length;
  const recommendScrollEdges = useHorizontalScrollEdges(recommendRef, [
    recommendSlideCount,
    catalogPending,
  ]);
  const artistsScrollEdges = useHorizontalScrollEdges(artistsRef, [
    artists.length,
    artistsLoading,
  ]);

  const onExploreCategory = (key: string) => {
    const slug = resolveCategorySlug(key, categoryPool);
    enterDedicatedCategoryPage(slug);
  };

  useEffect(() => {
    if (!dedicatedCategoryPage || !activeCategoryKey) return;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [dedicatedCategoryPage, activeCategoryKey]);

  const categoriesPanel = () => (
    <div className="flex flex-wrap gap-2">
      {categoryFilters.map((cat) => (
        <FilterTag
          key={cat.slug}
          label={cat.name}
          active={selectedSlugs.some((s) => categorySlugsMatch(s, cat.slug, categoryPool))}
          onClick={() => selectSlug(cat.slug)}
        />
      ))}
    </div>
  );

  const cityPanel = () => (
    <>
      {!city && <p className="text-xs text-slate-500 mb-2">All Cities</p>}
      {city ? (
        <div className="flex flex-wrap gap-2 mb-2">
          <FilterTag label={city} active onClick={clearCity} />
        </div>
      ) : null}
      {cityOptions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {cityOptions.map((cityName) => (
            <FilterTag
              key={cityName}
              label={cityName}
              active={city === cityName}
              onClick={() => {
                if (city === cityName) clearCity();
                else selectCity(cityName);
              }}
            />
          ))}
        </div>
      ) : null}
    </>
  );

  const datePanel = () => (
    <>
      <div className="flex flex-wrap gap-2">
        {datePresets.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => {
              setDatePreset((p) => (p === d.id ? "" : d.id));
              setDateFrom("");
              setDateTo("");
              setUseDateRange(false);
            }}
            className={`px-3 py-1.5 text-[11px] rounded-md border cursor-pointer ${
              datePreset === d.id
                ? "border-[#6900AA] bg-[#6900AA] text-white"
                : "border-slate-200 bg-white text-[#6900AA]"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          checked={useDateRange}
          onChange={(e) => {
            const on = e.target.checked;
            setUseDateRange(on);
            if (on) {
              setDatePreset("");
            } else {
              setDateFrom("");
              setDateTo("");
            }
          }}
          className="accent-[#6900AA]"
        />
        Date Range
      </label>
      {useDateRange && (
        <div className="mt-3 border border-slate-200 rounded-lg p-3">
          <div className="flex gap-4 mb-3 text-sm">
            <button
              type="button"
              onClick={() => setCalTab("start")}
              className={`pb-1 cursor-pointer ${
                calTab === "start"
                  ? "text-[#6900AA] border-b-2 border-[#6900AA] font-semibold"
                  : "text-slate-400"
              }`}
            >
              Start Date{dateFrom ? `: ${dateFrom}` : ""}
            </button>
            <button
              type="button"
              onClick={() => setCalTab("end")}
              className={`pb-1 cursor-pointer ${
                calTab === "end"
                  ? "text-[#6900AA] border-b-2 border-[#6900AA] font-semibold"
                  : "text-slate-400"
              }`}
            >
              End Date{dateTo ? `: ${dateTo}` : ""}
            </button>
          </div>
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              className="p-1 cursor-pointer text-slate-500"
              onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
            >
              <FaChevronLeft size={12} />
            </button>
            <p className="text-sm font-semibold text-slate-800">
              {calMonth.toLocaleString("en-US", { month: "long", year: "numeric" })}
            </p>
            <button
              type="button"
              className="p-1 cursor-pointer text-slate-500"
              onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
            >
              <FaChevronRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-400 mb-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <span key={`${d}-${i}`}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarCells.map((day, i) => {
              if (!day) return <span key={`e-${i}`} />;
              const iso = toIsoDate(calMonth.getFullYear(), calMonth.getMonth(), day);
              const selected = iso === dateFrom || iso === dateTo;
              const inRange = Boolean(dateFrom && dateTo && iso >= dateFrom && iso <= dateTo);
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => pickCalendarDay(day)}
                  className={`h-7 text-xs rounded cursor-pointer ${
                    selected
                      ? "bg-[#6900AA] text-white font-bold"
                      : inRange
                        ? "bg-[#F3E8FF] text-[#6900AA] font-semibold"
                        : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={clearDateFilters}
              className="flex-1 text-xs py-1.5 border border-slate-200 rounded text-[#6900AA] cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setUseDateRange(false)}
              className="flex-1 text-xs py-1.5 rounded bg-[#6900AA] text-white cursor-pointer disabled:opacity-50"
              disabled={!dateFrom && !dateTo}
            >
              Done
            </button>
          </div>
        </div>
      )}
      {(dateFrom || dateTo) && !useDateRange && (
        <p className="mt-2 text-xs text-slate-600">
          Range: {dateFrom || "…"} → {dateTo || "…"}{" "}
          <button type="button" className="text-[#6900AA] underline cursor-pointer" onClick={clearDateFilters}>
            Clear
          </button>
        </p>
      )}
    </>
  );

  const languagesPanel = () => (
    <div className="flex flex-wrap gap-2">
      {languageOptions.map((lang) => (
        <FilterTag
          key={lang}
          label={lang}
          active={selectedLanguages.includes(lang)}
          onClick={() => toggleIn(selectedLanguages, lang, setSelectedLanguages)}
        />
      ))}
    </div>
  );

  const pricePanel = () => (
    <div className="flex flex-wrap gap-2">
      {priceBands.map((band) => (
        <FilterTag
          key={band.id}
          label={band.label}
          active={selectedPriceBands.includes(band.id)}
          onClick={() => toggleIn(selectedPriceBands, band.id, setSelectedPriceBands)}
        />
      ))}
    </div>
  );

  const morePanel = () => (
    <div className="flex flex-wrap gap-2">
      {moreOptions.length === 0 ? (
        <p className="text-xs text-slate-500">No extra filters available.</p>
      ) : (
        moreOptions.map((opt) => (
          <FilterTag
            key={opt.id}
            label={opt.label}
            active={selectedMore.includes(opt.id)}
            onClick={() => toggleIn(selectedMore, opt.id, setSelectedMore)}
          />
        ))
      )}
    </div>
  );

  const toggleDraftSlug = (slug: string) => {
    setDraftSlugs((prev) => {
      const isActive = prev.some((s) => categorySlugsMatch(s, slug, categoryPool));
      return isActive
        ? prev.filter((s) => !categorySlugsMatch(s, slug, categoryPool))
        : [...prev, slug];
    });
  };

  const toggleDraftEventGenre = (name: string) => {
    setDraftEventGenres((prev) =>
      prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name]
    );
  };

  const districtFilterModalBody = (
    <div className="flex flex-col sm:flex-row min-h-0 flex-1 overflow-hidden">
      <div className="sm:w-[34%] bg-slate-100 border-b sm:border-b-0 sm:border-r border-slate-200 overflow-x-auto sm:overflow-y-auto shrink-0 sm:h-full">
        <div className="flex sm:flex-col">
          {FILTER_MODAL_TABS.map((tab) => {
            const active = filterModalTab === tab.id;
            const sortHint =
              tab.id === "sort" && draftSort !== "recommended"
                ? SORT_OPTIONS.find((o) => o.id === draftSort)?.label.split(":")[0]
                : null;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterModalTab(tab.id)}
                className={`relative shrink-0 text-left px-4 py-3.5 text-base whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? "font-semibold text-slate-900 bg-white"
                    : "font-medium text-slate-600 bg-transparent hover:bg-slate-50/80"
                }`}
              >
                {active ? (
                  <span className="absolute left-0 top-0 bottom-0 w-[3px] hidden sm:block bg-[#6900AA]" />
                ) : null}
                <span className="block">{tab.label}</span>
                {sortHint ? (
                  <span className="block text-sm font-medium mt-0.5 text-[#6900AA]">{sortHint}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4 min-h-0 h-full bg-white">
        {filterModalTab === "sort" ? (
          <div>
            <p className="text-lg font-bold text-slate-900 mb-2">Sort by</p>
            {SORT_OPTIONS.map((opt) => (
              <FilterOptionRow
                key={opt.id}
                label={opt.label}
                selected={draftSort === opt.id}
                onSelect={() => setDraftSort(opt.id)}
              />
            ))}
          </div>
        ) : null}

        {filterModalTab === "date" ? (
          <div>
            <p className="text-lg font-bold text-slate-900 mb-2">Date</p>
            {datePresets.map((d) => (
              <FilterOptionRow
                key={d.id}
                label={d.label}
                selected={draftDatePreset === d.id}
                onSelect={() => {
                  setDraftDatePreset((p) => (p === d.id ? "" : d.id));
                  setDraftDateFrom("");
                  setDraftDateTo("");
                  setDraftUseDateRange(false);
                }}
              />
            ))}
          </div>
        ) : null}

        {filterModalTab === "genre" ? (
          <div>
            <p className="text-lg font-bold text-slate-900 mb-2">
              {isCategoryBrowse ? "Genre" : "Category"}
            </p>
            {isCategoryBrowse ? (
              categoryMastersLoading ? (
                <p className="py-2 text-sm text-slate-500">Loading genres…</p>
              ) : categoryGenreOptions.length ? (
                <div className="grid grid-cols-2 gap-x-4">
                  {categoryGenreOptions.map((g) => (
                    <FilterOptionRow
                      key={g.id}
                      label={g.name}
                      selected={draftEventGenres.includes(g.name)}
                      multi
                      onSelect={() => toggleDraftEventGenre(g.name)}
                    />
                  ))}
                </div>
              ) : (
                <p className="py-2 text-sm text-slate-500">No genres configured for this category.</p>
              )
            ) : (
              <div className="grid grid-cols-2 gap-x-4">
                {categoryFilters.map((cat) => (
                  <FilterOptionRow
                    key={cat.slug}
                    label={cat.name}
                    selected={draftSlugs.some((s) =>
                      categorySlugsMatch(s, cat.slug, categoryPool)
                    )}
                    multi
                    onSelect={() => toggleDraftSlug(cat.slug)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}

        {filterModalTab === "language" ? (
          <div>
            <p className="text-lg font-bold text-slate-900 mb-2">Language</p>
            <div className="grid grid-cols-2 gap-x-4">
              {languageOptions.map((lang) => (
                <FilterOptionRow
                  key={lang}
                  label={lang}
                  selected={draftLanguages.includes(lang)}
                  multi
                  onSelect={() => toggleIn(draftLanguages, lang, setDraftLanguages)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {filterModalTab === "pricing" ? (
          <div>
            <p className="text-lg font-bold text-slate-900 mb-2">Pricing</p>
            {priceBands.map((band) => (
              <FilterOptionRow
                key={band.id}
                label={band.label}
                selected={draftPriceBands.includes(band.id)}
                multi
                onSelect={() => toggleIn(draftPriceBands, band.id, setDraftPriceBands)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );

  const quickDateChips = datePresets.filter(
    (d) => d.id === "today" || d.id === "tomorrow" || d.id === "weekend"
  );

  /** Selected filters as removable chips (dining-style), shown first after Filters. */
  const selectedFilterChips: { key: string; label: string; onClear: () => void }[] = [];

  if (sort !== "recommended") {
    const lbl = SORT_OPTIONS.find((o) => o.id === sort)?.label || sort;
    selectedFilterChips.push({
      key: `sort-${sort}`,
      label: lbl,
      onClear: () => {
        setSort("recommended");
        scrollToEventsViewport();
      },
    });
  }

  if (datePreset) {
    const preset = datePresets.find((d) => d.id === datePreset);
    selectedFilterChips.push({
      key: `date-${datePreset}`,
      label: preset?.label || datePreset,
      onClear: () => {
        setDatePreset("");
        setDateFrom("");
        setDateTo("");
        setUseDateRange(false);
        scrollToEventsViewport();
      },
    });
  } else if (dateFrom || dateTo) {
    const label =
      dateFrom && dateTo
        ? `${dateFrom} – ${dateTo}`
        : dateFrom
          ? `From ${dateFrom}`
          : `Until ${dateTo}`;
    selectedFilterChips.push({
      key: "date-range",
      label,
      onClear: () => {
        setDateFrom("");
        setDateTo("");
        setUseDateRange(false);
        scrollToEventsViewport();
      },
    });
  }

  if (!isCategoryBrowse) {
    for (const cat of categoryFilters) {
      if (!selectedSlugs.some((s) => categorySlugsMatch(s, cat.slug, categoryPool))) continue;
      selectedFilterChips.push({
        key: `cat-${cat.slug}`,
        label: cat.name,
        onClear: () => {
          selectSlug(cat.slug);
          scrollToEventsViewport();
        },
      });
    }
  } else {
    for (const genre of selectedEventGenres) {
      selectedFilterChips.push({
        key: `genre-${genre}`,
        label: genre,
        onClear: () => {
          toggleEventGenre(genre);
          scrollToEventsViewport();
        },
      });
    }
  }

  for (const lang of selectedLanguages) {
    selectedFilterChips.push({
      key: `lang-${lang}`,
      label: lang,
      onClear: () => {
        toggleIn(selectedLanguages, lang, setSelectedLanguages);
        scrollToEventsViewport();
      },
    });
  }

  for (const bandId of selectedPriceBands) {
    const band = priceBands.find((b) => b.id === bandId);
    if (!band) continue;
    selectedFilterChips.push({
      key: `price-${band.id}`,
      label: band.label,
      onClear: () => {
        toggleIn(selectedPriceBands, band.id, setSelectedPriceBands);
        scrollToEventsViewport();
      },
    });
  }

  if (search.trim()) {
    selectedFilterChips.push({
      key: "search",
      label: `Search: "${search.trim()}"`,
      onClear: () => {
        setSearchInput("");
        setSearch("");
      },
    });
  }

  const eventsGridSection = (
    <section
      ref={allEventsRef}
      id="all-events"
      className={`${isCategoryBrowse ? "pt-6 sm:pt-8" : "pt-8 sm:pt-10"} pb-10 sm:pb-14 lg:pb-16`}
      style={{ scrollMarginTop: headerOffset + 8 }}
    >
      <div className={CONTAINER}>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4 sm:mb-5">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800">
              {browseHeading}
            </h2>
            {cityHasNoEvents ? (
              <CitySectionEmptyNotice message="No events available in your city yet." />
            ) : null}
          </div>
        </div>
      </div>

      {/* Sticky filter chips — dining homepage UI */}
      <div ref={filtersStickySentinelRef} className="h-px w-full" aria-hidden />
      <section className="sticky z-30 w-full bg-transparent" style={{ top: headerOffset }}>
        <div className={`dining-filters-sticky w-full ${isFiltersStuck ? "is-stuck" : ""}`}>
          <div className="container mx-auto px-5 sm:px-0 lg:px-10 2xl:px-0 pt-4 pb-1">
            <div className="mb-2">
              <div className="flex items-center gap-2 pb-1 -mx-1 px-1">
                <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-hide">
                  <button
                    type="button"
                    onClick={() => openFiltersModal("sort")}
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] sm:text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      selectedFilterChips.length > 0 || filtersOpen
                        ? "bg-slate-100 border-slate-400 text-slate-800"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {selectedFilterChips.length > 0 ? (
                      <span className="w-4 h-4 rounded-full text-[0.7rem] font-bold text-white flex items-center justify-center bg-[#6900AA]">
                        {selectedFilterChips.length}
                      </span>
                    ) : null}
                    Filter
                    <SlidersHorizontal size={14} className="text-slate-500" />
                  </button>

                  {selectedFilterChips.map((chip) => (
                    <span
                      key={chip.key}
                      className="shrink-0 inline-flex items-center gap-1.5 bg-[#f7e9ff] border border-[#e3bcff] text-[#6900AA] rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
                    >
                      {chip.label}
                      <button
                        type="button"
                        onClick={chip.onClear}
                        className="hover:bg-[#efd7ff] rounded-full p-0.5 transition-colors cursor-pointer"
                        aria-label={`Remove ${chip.label}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}

                  {quickDateChips
                    .filter((d) => datePreset !== d.id)
                    .map((d) => (
                      <ChipButton
                        key={d.id}
                        label={d.label}
                        active={false}
                        onClick={() => {
                          setDatePreset((p) => (p === d.id ? "" : d.id));
                          setDateFrom("");
                          setDateTo("");
                          setUseDateRange(false);
                          scrollToEventsViewport();
                        }}
                      />
                    ))}
                  {!isCategoryBrowse
                    ? categoryFilters
                        .filter(
                          (cat) =>
                            !selectedSlugs.some((s) =>
                              categorySlugsMatch(s, cat.slug, categoryPool)
                            )
                        )
                        .map((cat) => (
                          <ChipButton
                            key={cat.slug}
                            label={cat.name}
                            active={false}
                            onClick={() => {
                              selectSlug(cat.slug);
                              scrollToEventsViewport();
                            }}
                          />
                        ))
                    : null}
                  {search.trim() || hasActiveFilters || sort !== "recommended" ? (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="shrink-0 text-xs font-bold px-2 py-1.5 text-[#6900AA] transition-colors cursor-pointer hover:underline whitespace-nowrap"
                    >
                      Clear All
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={openSearchPopup}
                  className="dining-search-trigger shrink-0 inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white text-slate-700 cursor-pointer"
                  aria-label="Search events"
                >
                  <Search size={18} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className={`${CONTAINER} pt-5`}>
        {catalogPending ? (
          <EventListShimmer />
        ) : paged.length === 0 ? (
          hasNonCityFilters || Boolean(search.trim()) ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-10 text-center">
              <p className="text-sm font-semibold text-slate-800">No events match your filters</p>
              <p className="mt-1 text-sm text-slate-500">Try another date, genre, language, or price.</p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-4 text-sm font-semibold text-[#6900AA] underline cursor-pointer"
              >
                Clear filters
              </button>
            </div>
          ) : showEventShowcase ? (
            <div className="space-y-4">
              {hasCity ? (
                <p className="text-sm text-slate-500 text-center sm:text-left">
                  Showing highlights while we wait for events in your city.
                </p>
              ) : null}
              <div className="mx-auto grid w-full grid-cols-1 gap-5 md:max-w-none md:grid-cols-2 md:gap-4 lg:grid-cols-4 lg:gap-5">
                {emptyShowcaseCards.map((event) => (
                  <ShowcaseEventPosterCard
                    key={event.id}
                    title={event.title}
                    image={event.image}
                    showDate={event.showDate}
                    place={event.place}
                    eventType={event.eventType}
                    href={event.href}
                    fullWidth
                  />
                ))}
              </div>
            </div>
          ) : (
            <EventListShimmer />
          )
        ) : (
          <div className="  grid w-full  grid-cols-1 gap-5  md:grid-cols-2 md:gap-4 lg:grid-cols-4 lg:gap-5">
            {paged.map((event) => (
              <DistrictEventCard
                key={event.id}
                event={event}
                cityLabel={city || undefined}
              />
            ))}
          </div>
        )}

        {filtered.length > PAGE_SIZE && (
          <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={`w-9 h-9 rounded-full text-sm font-semibold cursor-pointer ${
                  n === pageSafe
                    ? "bg-[#6900AA] text-white"
                    : "bg-white border border-slate-200 text-slate-700"
                }`}
              >
                {n}
              </button>
            ))}
            {pageSafe < totalPages && (
              <button
                type="button"
                onClick={() => setPage(pageSafe + 1)}
                className="inline-flex items-center gap-1 px-3 h-9 rounded-full bg-white border border-slate-200 text-sm font-semibold text-slate-700 cursor-pointer"
              >
                Next <FaChevronRight size={10} />
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Movie-style native hero (mobile feature cards + desktop blur banner) */}
      {catalogPending && !activeHeroEvent ? (
        <EventHeroShimmer />
      ) : activeHeroEvent ? (
        <>
          {/* Mobile + tablet — featured cards (centered active + side peeks) */}
          <section className="lg:hidden bg-white pt-3 pb-5 sm:pt-4 sm:pb-6 md:pt-5 md:pb-8">
            <div
              ref={mobilePromoTrackRef}
              className={`flex snap-x snap-mandatory items-center overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                promoEvents.length > 1
                  ? "gap-3 md:gap-4 px-[max(0.75rem,calc((100%-min(72vw,18.5rem))/2))] md:px-[max(1.25rem,calc((100%-min(46vw,21rem))/2))]"
                  : "justify-center px-5 sm:px-8"
              }`}
              onScroll={promoEvents.length > 1 ? syncMobilePromoIndex : undefined}
            >
              {promoEvents.map((event, slideIdx) => (
                <div
                  key={event.id}
                  data-promo-card
                  className={`shrink-0 snap-center ${
                    promoEvents.length > 1
                      ? "w-[min(72vw,18.5rem)] md:w-[min(46vw,21rem)]"
                      : "w-[min(78vw,20rem)] md:w-[min(52vw,21.25rem)]"
                  }`}
                >
                  <PromoFeatureCard
                    event={event}
                    active={promoEvents.length <= 1 || slideIdx === mobilePromoIndex}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Desktop — District blur banner */}
          <section className="relative hidden w-full overflow-hidden bg-white lg:block">
            {promoEvents.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="Previous promo"
                  onClick={goPrevPromo}
                  className="absolute left-3 top-1/2 z-20 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center text-slate-800 hover:opacity-70 xl:left-5 2xl:left-8"
                >
                  <FaChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Next promo"
                  onClick={goNextPromo}
                  className="absolute right-3 top-1/2 z-20 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center text-slate-800 hover:opacity-70 xl:right-5 2xl:right-8"
                >
                  <FaChevronRight size={16} />
                </button>
              </>
            ) : null}

            <div
              className={`flex will-change-transform ${
                heroSlideTransition ? "transition-transform duration-700 ease-out" : ""
              }`}
              style={{ transform: `translateX(-${heroSlideIndex * 100}%)` }}
              onTransitionEnd={onPromoTrackTransitionEnd}
            >
              {promoLoopSlides.map((event, slideIdx) => {
                const landscape = eventLandscape(event);
                const portrait = eventPortrait(event);
                const image = portrait || landscape;
                const detailHref = `/events/${event.id}`;
                return (
                  <div
                    key={
                      slideIdx === promoEvents.length
                        ? `${event.id}-loop`
                        : event.id
                    }
                    className="relative block w-full shrink-0 grow-0 basis-full"
                  >
                    {/* Full-banner hit target → event detail */}
                    <Link
                      href={detailHref}
                      className="absolute inset-0 z-[5] cursor-pointer"
                      aria-label={`View ${event.name}`}
                    />

                    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
                      <SafeCoverImage
                        src={image}
                        alt=""
                        className="absolute inset-0 h-full w-full scale-150 object-cover blur-[15px] opacity-80"
                        fallbackClassName="absolute inset-0 flex items-center justify-center bg-[#F3F4F6] text-slate-300"
                        fallback={<EventImageFallback size={48} />}
                        loading="eager"
                      />
                      <div className="absolute inset-0 bg-white/55" />
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            "linear-gradient(to top, #ffffff 0%, rgba(255,255,255,0.85) 28%, rgba(255,255,255,0.35) 55%, rgba(255,255,255,0.15) 75%, transparent 100%)",
                        }}
                      />
                    </div>

                    <div
                      className={`pointer-events-none relative mx-auto w-full container px-5 sm:px-10  lg:px-10  2xl:px-0 py-10 xl:py-12 ${
                        promoEvents.length > 1
                          ? "px-14 2xl:px-0 pb-14"
                          : "2xl:px-0"
                      }`}
                    >
                      <div className="flex items-center gap-8 lg:gap-8 2xl:gap-5">
                        <div className="min-w-0 flex-1 text-slate-900">
                        {event.is_promoted ? (
                            <p className="mb-2 inline-flex items-center rounded-md bg-[#6900AA]/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-[#6900AA]">
                              Promoted
                            </p>
                          ) : null}
                          {formatPromoDateTime(event.next_showtime) ? (
                            <p className="text-sm md:text-base font-medium text-slate-600">
                              {formatPromoDateTime(event.next_showtime)}
                            </p>
                          ) : null}
                          <h1 className="mt-2 text-2xl md:text-3xl xl:text-4xl font-extrabold leading-tight line-clamp-3">
                            {event.name}
                          </h1>
                          
                          {eventPlaceLine(event, city || undefined) ? (
                            <p className="mt-2 text-base md:text-lg font-medium text-slate-700 line-clamp-2">
                              {eventPlaceLine(event, city || undefined)}
                            </p>
                          ) : null}
                          {priceOnwards(event) ? (
                            <p className="mt-3 text-base md:text-lg font-bold text-slate-900">
                              {priceOnwards(event)}
                            </p>
                          ) : null}
                          <div className="mt-4 sm:mt-5">
                            <span className="inline-flex items-center justify-center rounded-2xl bg-[#131316] px-8 py-3.5 xl:px-10 xl:py-4 text-sm xl:text-base font-bold text-[#fff8da]">
                              Book tickets
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 h-[280px] sm:h-[340px] md:h-[380px] lg:h-[490px]">
                          <div className="aspect-[3/4] h-full overflow-hidden rounded-2xl bg-[#F3F4F6] shadow-[0_18px_40px_rgba(15,23,42,0.35)]">
                            <SafeCoverImage
                              src={portrait || landscape}
                              alt={event.name}
                              className="h-full w-full object-cover"
                              fallbackClassName="flex h-full w-full items-center justify-center bg-[#F3F4F6] text-slate-300"
                              fallback={<EventImageFallback size={40} />}
                              loading="eager"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {promoEvents.length > 1 ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center gap-1.5">
                {promoEvents.map((event, index) => (
                  <button
                    key={event.id}
                    type="button"
                    aria-label={`Show ${event.name}`}
                    onClick={() => setHeroSlideIndex(index)}
                    className={`pointer-events-auto h-1.5 rounded-full transition-all cursor-pointer ${
                      index === activeHeroDot
                        ? "w-6 bg-slate-900"
                        : "w-1.5 bg-slate-400/50"
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {!isCategoryBrowse ? (
        <>
          {/* 2) Explore Events — polished pastel category cards */}
          {catalogPending ? (
            <section className="pt-8 sm:pt-10 pb-3 bg-white">
              <div className={CONTAINER}>
                <div className="min-w-0 pb-4">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-800">
                    Explore Events
                  </h2>
                </div>
                <EventExploreShimmer count={6} />
              </div>
            </section>
          ) : exploreCategoriesWithEvents.length > 0 ? (
            <section className="pt-8 sm:pt-10 pb-3 bg-white">
              <div className={CONTAINER}>
                <div className="min-w-0 pb-4">
                  <motion.h2
                    className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-800"
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    Explore Events
                  </motion.h2>
                  {cityHasNoEvents ? (
                    <CitySectionEmptyNotice message="No events available in your city yet." />
                  ) : null}
                </div>
                <motion.div
                  className="flex gap-4 sm:gap-5 overflow-x-auto px-1 pt-5 pb-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.35 }}
                  variants={{
                    hidden: {},
                    show: {
                      transition: { staggerChildren: 0.09, delayChildren: 0.05 },
                    },
                  }}
                >
                  {exploreCategoriesWithEvents.map((cat) => (
                    <motion.button
                      key={cat.key}
                      type="button"
                      aria-label={cat.label}
                      onClick={() => onExploreCategory(cat.key)}
                      className="flex h-[188px] w-[148px] shrink-0 cursor-pointer flex-col items-center rounded-[22px] border p-0 sm:h-[180px] sm:w-[140px]"
                      style={{
                        background: cat.gradient,
                        borderColor: cat.border,
                        boxShadow: cat.shadow,
                      }}
                      variants={{
                        hidden: { opacity: 0, y: 28, scale: 0.9 },
                        show: {
                          opacity: 1,
                          y: 0,
                          scale: 1,
                          transition: {
                            type: "spring",
                            stiffness: 320,
                            damping: 22,
                            mass: 0.8,
                          },
                        },
                        hover: {
                          y: -8,
                          scale: 1.03,
                          transition: { type: "spring", stiffness: 420, damping: 16 },
                        },
                      }}
                      whileHover="hover"
                      whileTap={{
                        scale: 0.97,
                        y: -2,
                        transition: { type: "spring", stiffness: 520, damping: 28 },
                      }}
                    >
                      <span className="flex h-full w-full flex-col items-center overflow-hidden rounded-[21px]">
                        <span className="shrink-0 px-2 pt-3.5 sm:pt-4 text-center text-[15px] sm:text-[16px] font-extrabold leading-none tracking-tight text-slate-900">
                          {cat.label}
                        </span>
                        <span className="flex min-h-0 w-full flex-1 items-center justify-center px-2.5 pb-3.5 pt-1.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <motion.img
                            src={cat.image}
                            alt=""
                            aria-hidden
                            className="h-full w-full max-h-[118px] object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.14)]"
                            draggable={false}
                            variants={{
                              hidden: { opacity: 0, y: 12, scale: 0.86 },
                              show: {
                                opacity: 1,
                                y: 0,
                                scale: 1,
                                transition: {
                                  type: "spring",
                                  stiffness: 280,
                                  damping: 18,
                                  delay: 0.05,
                                },
                              },
                              hover: {
                                y: -6,
                                rotate: -2,
                                scale: 1.06,
                                transition: {
                                  type: "spring",
                                  stiffness: 340,
                                  damping: 14,
                                },
                              },
                            }}
                          />
                        </span>
                      </span>
                    </motion.button>
                  ))}
                </motion.div>
              </div>
            </section>
          ) : null}

          {/* 3) Top recommendations — temporarily hidden
          <section className="pt-8 sm:pt-10 pb-2 bg-white">
            <div className={CONTAINER}>
              <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-800">
                    {city
                      ? `Top recommended events in ${headingCity}`
                      : "Top recommended events"}
                  </h2>
                  {cityHasNoEvents ? (
                    <CitySectionEmptyNotice message="No events available in your city yet." />
                  ) : null}
                </div>
              </div>
              {catalogPending ? (
                <CustomerRailShimmer count={4} variant="poster" />
              ) : recommendedEvents.length > 0 ? (
                <>
                  <div
                    ref={recommendRef}
                    className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {recommendedEvents.map((event) => (
                      <RecommendCard key={event.id} event={event} cityLabel={city || undefined} />
                    ))}
                  </div>
                  <RailPagerNav
                    canPrev={recommendScrollEdges.left}
                    canNext={recommendScrollEdges.right}
                    pageCount={recommendScrollEdges.pageCount}
                    activePage={recommendScrollEdges.activePage}
                    onPrev={() => {
                      const el = recommendRef.current;
                      if (el) scrollRailBy(el, -1);
                    }}
                    onNext={() => {
                      const el = recommendRef.current;
                      if (el) scrollRailBy(el, 1);
                    }}
                    label="recommended events"
                  />
                </>
              ) : showEventShowcase ? (
                <>
                  <div
                    ref={recommendRef}
                    className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {emptyShowcaseCards.slice(0, 8).map((event) => (
                      <RecommendShowcaseCard
                        key={`rec-showcase-${event.id}`}
                        title={event.title}
                        image={event.image}
                        showDate={event.showDate}
                        place={event.place}
                        href={event.href}
                      />
                    ))}
                  </div>
                  <RailPagerNav
                    canPrev={recommendScrollEdges.left}
                    canNext={recommendScrollEdges.right}
                    pageCount={recommendScrollEdges.pageCount}
                    activePage={recommendScrollEdges.activePage}
                    onPrev={() => {
                      const el = recommendRef.current;
                      if (el) scrollRailBy(el, -1);
                    }}
                    onNext={() => {
                      const el = recommendRef.current;
                      if (el) scrollRailBy(el, 1);
                    }}
                    label="recommended events"
                  />
                </>
              ) : (
                <CustomerRailShimmer count={4} variant="poster" />
              )}
            </div>
          </section>
          */}

          {/* 4) Artists */}
          <section className="pt-8 sm:pt-10 pb-2 bg-white">
            <div className={CONTAINER}>
              <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
                <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-800">
                  {city ? `Artists in ${headingCity}` : "Artists in your District"}
                </h2>
              </div>
              {artistsLoading ? (
                <ArtistRailShimmer count={6} />
              ) : artists.length > 0 ? (
                <>
                  <div
                    ref={artistsRef}
                    className="flex gap-4 sm:gap-5 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {artists.map((artist) => (
                      <ArtistChip key={artist.id} artist={artist} />
                    ))}
                  </div>
                  <RailPagerNav
                    canPrev={artistsScrollEdges.left}
                    canNext={artistsScrollEdges.right}
                    pageCount={artistsScrollEdges.pageCount}
                    activePage={artistsScrollEdges.activePage}
                    onPrev={() => {
                      const el = artistsRef.current;
                      if (el) scrollRailBy(el, -1);
                    }}
                    onNext={() => {
                      const el = artistsRef.current;
                      if (el) scrollRailBy(el, 1);
                    }}
                    label="artists"
                  />
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  No artists listed yet.{" "}
                  <Link href="/artists" className="text-[#6900AA] font-semibold hover:underline">
                    Browse artists
                  </Link>
                </p>
              )}
            </div>
          </section>
        </>
      ) : null}

      {eventsGridSection}

      {filtersOpen ? (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-black/40 cursor-pointer"
            onClick={closeFiltersModal}
          />
          <div className="relative w-full sm:w-[min(92vw,720px)] h-[min(88vh,540px)] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">Filter</h3>
              <button
                type="button"
                onClick={closeFiltersModal}
                className="p-1 rounded-full hover:bg-slate-100 cursor-pointer"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            {districtFilterModalBody}
            <div className="flex items-center justify-end gap-6 px-5 py-3.5 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={clearModalFiltersAndApply}
                className="text-base font-bold text-[#6900AA] cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={applyFiltersAndClose}
                className="text-base font-bold text-[#6900AA] cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {searchPopupOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="dining-search-popup fixed inset-0 z-[220] flex items-start justify-center px-4 pt-[min(18vh,140px)]">
            <button
              type="button"
              aria-label="Close search"
              className="dining-search-popup__backdrop absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
              onClick={closeSearchPopup}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Search events"
              className="dining-search-popup__panel relative w-full max-w-[560px] bg-white rounded-2xl shadow-[0_18px_50px_rgba(15,23,42,0.18)] overflow-hidden"
            >
              <div className="flex items-center gap-3 px-5 sm:px-6 py-4 sm:py-[1.15rem]">
                <Search size={20} strokeWidth={1.75} className="text-slate-500 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitEventSearch(searchDraft);
                    }
                  }}
                  placeholder="What are you looking for?"
                  className="flex-1 min-w-0 bg-transparent text-[15px] sm:text-base text-slate-800 placeholder:text-slate-400 outline-none"
                  aria-label="Search events"
                />
                {searchDraft ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchDraft("");
                      searchInputRef.current?.focus();
                    }}
                    className="shrink-0 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                    aria-label="Clear search"
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>

              <div className="dining-search-popup__results border-t border-slate-100">
                <div className="px-5 sm:px-6 pt-4 pb-5">
                  <p className="text-[15px] font-bold text-slate-900 mb-1">Recent Searches</p>
                  {recentSearches.length === 0 ? (
                    <p className="py-3 text-sm text-slate-400">No recent searches yet</p>
                  ) : (
                    <ul className="divide-y divide-slate-50">
                      {recentSearches.map((term) => (
                        <li key={term} className="flex items-center gap-3 py-3">
                          <button
                            type="button"
                            onClick={() => commitEventSearch(term)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer group"
                          >
                            <Search
                              size={16}
                              strokeWidth={1.75}
                              className="text-slate-400 shrink-0 group-hover:text-slate-500"
                            />
                            <span className="truncate text-[15px] text-slate-500 group-hover:text-slate-700">
                              {term}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = recentSearches.filter((t) => t !== term);
                              writeEventRecentSearches(updated);
                              setRecentSearches(updated);
                            }}
                            className="shrink-0 p-1 rounded-full text-slate-300 hover:text-slate-500 hover:bg-slate-100 cursor-pointer"
                            aria-label={`Remove ${term}`}
                          >
                            <X size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      <Footer />
    </div>
  );
}
