"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type TransitionEvent,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaSearch,
  FaSlidersH,
} from "react-icons/fa";
import { MapPin } from "lucide-react";
import {
  api,
  useGetBusinessTypesQuery,
  useGetEventMastersQuery,
  useGetPublicEventFiltersQuery,
  useGetPublicEventsQuery,
  useGetPublicRegisteredArtistsQuery,
  type PublicEvent,
  type PublicRegisteredPartner,
} from "@/services/api";
import { useAppDispatch } from "@/lib/hooks";
import { formatMoney } from "@/lib/currencyFormat";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { ShowcaseEventPosterCard } from "@/components/LandingPage/PosterCard";
import Footer from "@/components/LandingPage/Footer";
import { EventListShimmer } from "@/components/Shared/Shimmer";
import {
  EVENT_CATEGORY_OPTIONS,
  categorySlugsMatch,
  resolveCategorySlug,
  resolveCategoryKeyFromSlug,
  type EventCategoryKey,
} from "@/lib/eventCategories";
import { SHOWCASE_EVENT_CARDS, showcaseCardsForCategories } from "@/data/showcaseEventCards";
import {
  eventLandscape,
  eventPlaceLine,
  eventPortrait,
  formatEventDateLine,
} from "@/components/LandingPage/homeUtils";

const PAGE_SIZE = 8;
const EMPTY_EVENTS: PublicEvent[] = [];
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

const CONTAINER = "container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0";

const EXPLORE_EVENT_CATEGORIES = [
  { key: "music" as const, label: "Music", image: "/images/events/explore/music.png?v=3" },
  { key: "concert" as const, label: "Concert", image: "/images/events/explore/concert.png?v=3" },
  { key: "comedy" as const, label: "Comedy", image: "/images/events/explore/comedy.png?v=3" },
  { key: "sports" as const, label: "Sports", image: "/images/events/explore/sports.png?v=3" },
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
      className={`group block overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white shadow-none origin-center transition-transform duration-300 ease-out ${
        active ? "scale-100" : "scale-[0.92]"
      }`}
    >
      {image ? (
        <img
          src={image}
          alt={event.name}
          className="block h-auto w-full bg-slate-100 object-contain"
          loading="lazy"
          draggable={false}
        />
      ) : (
        <div className="flex aspect-[3/4] w-full items-center justify-center bg-slate-200 px-3 text-center text-sm font-medium text-slate-500">
          {event.name}
        </div>
      )}
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
      className={`inline-flex items-center gap-2 shrink-0 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium border cursor-pointer transition-colors whitespace-nowrap ${
        active
          ? "bg-[#EDE7F6] border-[#7C3AED] text-slate-900"
          : "bg-white border-slate-300 text-slate-800 hover:border-slate-400"
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
        className={`flex size-4 shrink-0 items-center justify-center rounded-[3px] border ${
          selected ? "border-[#7C3AED] bg-[#7C3AED] text-white" : "border-slate-700 bg-white"
        }`}
      >
        {selected ? (
          <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden>
            <path
              d="M2.5 6.2 4.8 8.5 9.5 3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
    );
  }
  return (
    <span
      className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
        selected ? "border-[#7C3AED] bg-[#7C3AED]" : "border-slate-700"
      }`}
    >
      {selected ? <span className="size-1.5 rounded-full bg-white" /> : null}
    </span>
  );
}

type FilterModalTab = "date" | "genre" | "language" | "pricing";

const FILTER_MODAL_TABS: Array<{ id: FilterModalTab; label: string }> = [
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
      className="group block min-w-0 w-full overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white"
    >
      <div className="relative w-full overflow-hidden bg-slate-100">
        {portrait ? (
          <img
            src={portrait}
            alt={event.name}
            className="block h-auto w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="flex aspect-[3/4] w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 text-sm font-medium text-slate-500">
            No poster
          </div>
        )}
      </div>
      <div className="space-y-1 px-3.5 py-3 sm:px-4 sm:py-3.5">
        {dateLine ? (
          <p className="text-sm font-semibold text-[#B59B2A]">{dateLine}</p>
        ) : null}
        <h3 className="text-base font-bold leading-snug text-black line-clamp-2 sm:text-lg">
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
      className="group shrink-0 w-[48vw] sm:w-[200px] md:w-[220px] lg:w-[240px] 2xl:w-[240px] snap-start"
    >
      {portrait ? (
        <img
          src={portrait}
          alt={event.name}
          className="block w-full h-auto rounded-2xl object-contain bg-slate-100 transition-transform duration-300 group-hover:scale-[1.02]"
          loading="lazy"
        />
      ) : (
        <div className="aspect-[3/4] w-full rounded-2xl bg-slate-200" />
      )}
      <div className="mt-2 space-y-0.5">
        {place ? (
          <p className="flex items-center gap-1 text-[11px] text-slate-600 line-clamp-1">
            <MapPin className="shrink-0 text-[#6900AA]" size={13} strokeWidth={2} />
            <span className="truncate">{place}</span>
          </p>
        ) : null}
        <h3 className="text-sm font-bold text-slate-900 line-clamp-1">{event.name}</h3>
        {dateLine ? <p className="text-xs text-slate-500 line-clamp-1">{dateLine}</p> : null}
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
      href={`/artists/${artist.id}`}
      className="shrink-0  snap-start flex flex-col items-center gap-2.5 text-center group"
    >
      <div className="relative h-[120px] w-[120px] sm:h-[190px] sm:w-[190px] rounded-full overflow-hidden bg-slate-200 ring-2 ring-white shadow-sm">
        {img ? (
          <img
            src={img}
            alt={artist.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-black font-bold">
            {artist.name?.charAt(0)?.toUpperCase() || "A"}
          </span>
        )}
      </div>
      <span className="text-sm sm:text-base font-semibold text-slate-800 line-clamp-2 leading-tight px-0.5">
        {artist.name}
      </span>
    </Link>
  );
}

function scrollRow(ref: RefObject<HTMLDivElement | null>, dir: 1 | -1) {
  const el = ref.current;
  if (!el) return;
  el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.75, 420), behavior: "smooth" });
}

export default function PublicEventsPage() {
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState("");
  const router = useRouter();
  const pathname = usePathname() || "/events";
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  /** Admin genre masters — category page filter modal only (not sent to public events API). */
  const [selectedEventGenres, setSelectedEventGenres] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [useDateRange, setUseDateRange] = useState(false);
  const [calTab, setCalTab] = useState<"start" | "end">("start");
  const [calMonth, setCalMonth] = useState(() => new Date());
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedPriceBands, setSelectedPriceBands] = useState<string[]>([]);
  const [selectedMore, setSelectedMore] = useState<string[]>([]);
  const [openFilters, setOpenFilters] = useState({
    categories: true,
    date: false,
    city: false,
    languages: false,
    price: false,
    more: false,
  });
  const [filterModalTab, setFilterModalTab] = useState<FilterModalTab>("date");
  const [sort, setSort] = useState("recommended");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [heroSlideTransition, setHeroSlideTransition] = useState(true);
  const [mobilePromoIndex, setMobilePromoIndex] = useState(0);
  const [promoDesktopAutoplay, setPromoDesktopAutoplay] = useState(false);
  const mobilePromoTrackRef = useRef<HTMLDivElement>(null);
  const [offerHeroEvents, setOfferHeroEvents] = useState<PublicEvent[]>([]);
  const [posterFallbackEvents, setPosterFallbackEvents] = useState<PublicEvent[]>([]);
  const [exploreEventPool, setExploreEventPool] = useState<PublicEvent[]>([]);
  const [recPage, setRecPage] = useState(0);

  const recommendRef = useRef<HTMLDivElement>(null);
  const artistsRef = useRef<HTMLDivElement>(null);
  const allEventsRef = useRef<HTMLElement>(null);
  const categoryFromFilterRef = useRef(false);
  const [dedicatedCategoryPage, setDedicatedCategoryPage] = useState(false);
  const [headerOffset, setHeaderOffset] = useState(112);

  useEffect(() => {
    const measure = () => {
      const header = document.querySelector("header.sticky");
      const h = header instanceof HTMLElement ? header.getBoundingClientRect().height : 112;
      setHeaderOffset(Math.max(64, Math.round(h)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const scrollToEventsViewport = useCallback(() => {
    window.setTimeout(() => {
      allEventsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, []);

  const applyFiltersAndClose = useCallback(() => {
    setFiltersOpen(false);
    scrollToEventsViewport();
  }, [scrollToEventsViewport]);

  const syncCategoryToUrl = (slugs: string[] | string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    const list = Array.isArray(slugs) ? slugs : slugs ? [slugs] : [];
    if (list.length) params.set("category", list.join(","));
    else params.delete("category");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const { data: filterOptions } = useGetPublicEventFiltersQuery();
  const apiCategories = filterOptions?.categories ?? [];
  const { data: businessTypes = [] } = useGetBusinessTypesQuery("event");

  const categoryPool = useMemo(() => {
    if (apiCategories.length) return apiCategories;
    return businessTypes
      .filter((type) => type.parent_type_id && type.slug)
      .map((type) => ({ slug: type.slug as string, name: type.name }));
  }, [apiCategories, businessTypes]);

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
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

    setSearchInput(q);
    setSearch(q.trim());
    const slugsFromUrl = parseCsvParam(cat);
    setSelectedSlugs(slugsFromUrl);
    setSelectedLanguages(parseCsvParam(language));
    setSelectedPriceBands(parseCsvParam(price));
    setSelectedMore(parseCsvParam(more));

    if (categoryFromFilterRef.current) {
      categoryFromFilterRef.current = false;
      setDedicatedCategoryPage(false);
    } else if (slugsFromUrl.length === 1 && resolveCategoryKeyFromSlug(slugsFromUrl[0], categoryPool)) {
      setDedicatedCategoryPage(true);
    } else if (slugsFromUrl.length === 0) {
      setDedicatedCategoryPage(false);
    } else {
      setDedicatedCategoryPage(false);
    }

    if (datePresetParam) {
      setDatePreset(datePresetParam);
      setDateFrom("");
      setDateTo("");
      setUseDateRange(false);
    } else {
      setDatePreset("");
      setDateFrom(dateFromParam || "");
      setDateTo(dateToParam || "");
      setUseDateRange(Boolean(dateFromParam || dateToParam));
    }

    if (sortParam && SORT_OPTIONS.some((o) => o.id === sortParam)) {
      setSort(sortParam);
    }

    if (cityParam) {
      if (cityParam === "All Cities") setCity("");
      else setCity(cityParam);
    } else {
      const stored = localStorage.getItem("selected_city");
      if (stored && stored !== "All Cities") setCity(stored);
      else setCity("");
    }
  }, [searchParams, categoryPool]);

  useEffect(() => {
    const applyCity = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("city")) return;
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
  const { data: eventsData, isLoading, isFetching } = useGetPublicEventsQuery(queryArg);
  const events = eventsData ?? EMPTY_EVENTS;

  const { data: artists = [] } = useGetPublicRegisteredArtistsQuery();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const allEvents = await dispatch(
          api.endpoints.getPublicEvents.initiate(undefined, { forceRefetch: false })
        ).unwrap();

        const candidates = allEvents.filter(
          (event) => event.poster_horizontal_url || event.poster_vertical_url || event.name
        );
        if (!cancelled) {
          setExploreEventPool(allEvents);
          setPosterFallbackEvents(candidates.slice(0, 12));
        }

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
        if (!cancelled) {
          setOfferHeroEvents([]);
          setPosterFallbackEvents([]);
          setExploreEventPool([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  const categoryFilters = useMemo(
    () =>
      EVENT_CATEGORY_OPTIONS.map((opt) => ({
        slug: resolveCategorySlug(opt.key, categoryPool),
        name: opt.label,
      })),
    [categoryPool]
  );

  const exploreCategoriesWithEvents = useMemo(() => {
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
  }, [exploreEventPool, events, posterFallbackEvents, categoryPool]);

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
    return resolveCategoryKeyFromSlug(selectedSlugs[0], categoryPool);
  }, [selectedSlugs, categoryPool]);

  const isCategoryBrowse = Boolean(dedicatedCategoryPage && activeCategoryKey);

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
    if (!isCategoryBrowse || selectedEventGenres.length === 0) return events;
    return events.filter((event) => eventMatchesSelectedGenres(event, selectedEventGenres));
  }, [events, isCategoryBrowse, selectedEventGenres]);

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
    syncCategoryToUrl([]);
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
  const hasActiveFilters =
    (!isCategoryBrowse && selectedSlugs.length > 0) ||
    (isCategoryBrowse && selectedEventGenres.length > 0) ||
    Boolean(datePreset) ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    Boolean(city) ||
    selectedLanguages.length > 0 ||
    selectedPriceBands.length > 0 ||
    selectedMore.length > 0;

  const listingWithPosters = useMemo(
    () =>
      events.filter(
        (event) => event.poster_horizontal_url || event.poster_vertical_url || event.name
      ),
    [events]
  );

  const browseHeading = activeCategoryKey
    ? CATEGORY_BROWSE_HEADING[activeCategoryKey]
    : "All Events";

  const promoEvents = useMemo(() => {
    const filterByCategory = (pool: PublicEvent[]) => {
      if (!activeCategoryKey) return pool;
      return pool.filter((event) => eventMatchesCategoryKey(event, activeCategoryKey, categoryPool));
    };

    if (isCategoryBrowse) {
      const fromListing = listingWithPosters;
      if (fromListing.length) {
        const promoted = fromListing.filter((e) => e.is_promoted);
        return (promoted.length ? promoted : fromListing).slice(0, 8);
      }
      const fromOffers = filterByCategory(offerHeroEvents);
      if (fromOffers.length) return fromOffers.slice(0, 8);
      const fromFallback = filterByCategory(posterFallbackEvents);
      const promoted = fromFallback.filter((e) => e.is_promoted);
      return (promoted.length ? promoted : fromFallback).slice(0, 8);
    }

    if (offerHeroEvents.length) return offerHeroEvents.slice(0, 8);
    const fromFallback = posterFallbackEvents.length ? posterFallbackEvents : listingWithPosters;
    const promoted = fromFallback.filter((e) => e.is_promoted);
    return (promoted.length ? promoted : fromFallback).slice(0, 8);
  }, [
    activeCategoryKey,
    isCategoryBrowse,
    offerHeroEvents,
    posterFallbackEvents,
    listingWithPosters,
    categoryPool,
  ]);

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
  }, [promoEvents]);

  // Autoplay only on desktop — mobile/tablet are manual (swipe)
  useEffect(() => {
    if (!promoDesktopAutoplay || promoEvents.length <= 1) return;
    const t = window.setInterval(() => {
      setHeroSlideIndex((i) => i + 1);
    }, 4500);
    return () => window.clearInterval(t);
  }, [promoDesktopAutoplay, promoEvents, heroSlideIndex]);

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
    const poolSource = events.length ? events : posterFallbackEvents;
    const promoted = poolSource.filter((e) => e.is_promoted);
    const pool = promoted.length ? promoted : poolSource;
    return pool.slice(0, 15);
  }, [events, posterFallbackEvents]);

  const recPages = Math.max(1, Math.ceil(recommendedEvents.length / 5));

  useEffect(() => {
    setRecPage(0);
  }, [recommendedEvents]);

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

  const tabHasSelection = (tab: FilterModalTab) => {
    if (tab === "date") return Boolean(datePreset || dateFrom || dateTo);
    if (tab === "genre") {
      return isCategoryBrowse ? selectedEventGenres.length > 0 : selectedSlugs.length > 0;
    }
    if (tab === "language") return selectedLanguages.length > 0;
    if (tab === "pricing") return selectedPriceBands.length > 0;
    return false;
  };

  const districtFilterModalBody = (
    <div className="flex min-h-[280px] overflow-hidden rounded-xl bg-[#F3F3F3]">
      <div className="w-[34%] sm:w-[38%] shrink-0 bg-white py-2">
        {FILTER_MODAL_TABS.map((tab) => {
          const active = filterModalTab === tab.id;
          const hasValue = tabHasSelection(tab.id);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterModalTab(tab.id)}
              className={`flex w-full items-center justify-between px-3 sm:px-4 py-3 text-left text-sm cursor-pointer transition-colors ${
                active
                  ? "bg-[#EDE9FE] font-semibold text-[#5B21B6]"
                  : hasValue
                    ? "font-semibold text-[#6900AA] hover:bg-slate-50"
                    : "font-medium text-slate-800 hover:bg-slate-50"
              }`}
            >
              <span>{tab.label}</span>
              {hasValue ? <span className="size-1.5 rounded-full bg-[#6900AA]" /> : null}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {filterModalTab === "date" ? (
          <div className="space-y-1">
            {datePresets.map((d) => {
              const selected = datePreset === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setDatePreset((p) => (p === d.id ? "" : d.id));
                    setDateFrom("");
                    setDateTo("");
                    setUseDateRange(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm text-slate-800 cursor-pointer hover:bg-white/70"
                >
                  <SelectionMark selected={selected} />
                  {d.label}
                </button>
              );
            })}
          </div>
        ) : null}

        {filterModalTab === "genre" ? (
          <div className="space-y-1">
            {isCategoryBrowse ? (
              categoryMastersLoading ? (
                <p className="px-2 py-2 text-sm text-slate-500">Loading genres…</p>
              ) : categoryGenreOptions.length ? (
                categoryGenreOptions.map((g) => {
                  const selected = selectedEventGenres.includes(g.name);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleEventGenre(g.name)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm sm:text-base text-slate-800 cursor-pointer hover:bg-white/70"
                    >
                      <SelectionMark selected={selected} multi />
                      {g.name}
                    </button>
                  );
                })
              ) : (
                <p className="px-2 py-2 text-sm text-slate-500">No genres configured for this category.</p>
              )
            ) : (
              categoryFilters.map((cat) => {
                const selected = selectedSlugs.some((s) =>
                  categorySlugsMatch(s, cat.slug, categoryPool)
                );
                return (
                  <button
                    key={cat.slug}
                    type="button"
                    onClick={() => selectSlug(cat.slug)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm sm:text-base text-slate-800 cursor-pointer hover:bg-white/70"
                  >
                    <SelectionMark selected={selected} multi />
                    {cat.name}
                  </button>
                );
              })
            )}
          </div>
        ) : null}

        {filterModalTab === "language" ? (
          <div className="space-y-1">
            {languageOptions.map((lang) => {
              const selected = selectedLanguages.includes(lang);
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => toggleIn(selectedLanguages, lang, setSelectedLanguages)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm text-slate-800 cursor-pointer hover:bg-white/70"
                >
                  <SelectionMark selected={selected} multi />
                  {lang}
                </button>
              );
            })}
          </div>
        ) : null}

        {filterModalTab === "pricing" ? (
          <div className="space-y-1">
            {priceBands.map((band) => {
              const selected = selectedPriceBands.includes(band.id);
              return (
                <button
                  key={band.id}
                  type="button"
                  onClick={() => toggleIn(selectedPriceBands, band.id, setSelectedPriceBands)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm text-slate-800 cursor-pointer hover:bg-white/70"
                >
                  <SelectionMark selected={selected} multi />
                  {band.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );

  const quickDateChips = datePresets.filter(
    (d) => d.id === "today" || d.id === "tomorrow" || d.id === "weekend"
  );

  const eventsGridSection = (
    <section
      ref={allEventsRef}
      id="all-events"
      className={`${isCategoryBrowse ? "pt-6 sm:pt-8" : "pt-8 sm:pt-10"} pb-10 sm:pb-14 lg:pb-16`}
      style={{ scrollMarginTop: headerOffset + 8 }}
    >
      <div className={CONTAINER}>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4 sm:mb-5">
          <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold text-slate-900">
            {browseHeading}
          </h2>
          {!isCategoryBrowse ? (
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full sm:w-auto">
              <label className="relative flex-1 sm:w-52">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search events"
                  className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-2 text-sm sm:text-base text-slate-800 outline-none focus:border-[#6900AA]"
                />
              </label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:text-base text-slate-800 outline-none focus:border-[#6900AA] cursor-pointer"
                aria-label="Sort events"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      </div>

      {/* Sticky filter chips — sits under site header like District */}
      <div
        className="sticky z-40 w-full border-b border-slate-100 bg-white/95 backdrop-blur-sm shadow-[0_2px_8px_rgba(15,23,42,0.04)]"
        style={{ top: headerOffset }}
      >
        <div
          className={`${CONTAINER} flex gap-2 overflow-x-auto py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
        >
          <ChipButton
            label={hasActiveFilters ? "Filters · On" : "Filters"}
            active={filtersOpen || hasActiveFilters}
            onClick={() => {
              setFilterModalTab("date");
              setFiltersOpen(true);
            }}
            icon={<FaSlidersH size={12} />}
            trailing={<FaChevronDown size={10} className="opacity-60" />}
          />
          {quickDateChips.map((d) => (
            <ChipButton
              key={d.id}
              label={d.label}
              active={datePreset === d.id}
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
            ? categoryFilters.map((cat) => (
                <ChipButton
                  key={cat.slug}
                  label={cat.name}
                  active={selectedSlugs.some((s) => categorySlugsMatch(s, cat.slug, categoryPool))}
                  onClick={() => {
                    selectSlug(cat.slug);
                    scrollToEventsViewport();
                  }}
                />
              ))
            : null}
          {isCategoryBrowse
            ? selectedEventGenres.map((genre) => (
                <ChipButton
                  key={`genre-${genre}`}
                  label={genre}
                  active
                  onClick={() => {
                    toggleEventGenre(genre);
                    scrollToEventsViewport();
                  }}
                />
              ))
            : null}
          {selectedLanguages.map((lang) => (
            <ChipButton
              key={`lang-${lang}`}
              label={lang}
              active
              onClick={() => {
                toggleIn(selectedLanguages, lang, setSelectedLanguages);
                scrollToEventsViewport();
              }}
            />
          ))}
          {selectedPriceBands.map((bandId) => {
            const band = priceBands.find((b) => b.id === bandId);
            if (!band) return null;
            return (
              <ChipButton
                key={`price-${band.id}`}
                label={band.label}
                active
                onClick={() => {
                  toggleIn(selectedPriceBands, band.id, setSelectedPriceBands);
                  scrollToEventsViewport();
                }}
              />
            );
          })}
        </div>
      </div>

      <div className={`${CONTAINER} pt-5`}>
        {isLoading || (isFetching && paged.length === 0) ? (
          <EventListShimmer />
        ) : paged.length === 0 ? (
          hasActiveFilters ? (
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
          ) : (
            <div className="mx-auto grid w-full max-w-[420px] grid-cols-1 gap-5 md:max-w-none md:grid-cols-2 md:gap-4 lg:grid-cols-4 lg:gap-5">
              {emptyShowcaseCards.map((event) => (
                <div
                  key={event.id}
                  className="min-w-0 overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white"
                >
                  <ShowcaseEventPosterCard
                    title={event.title}
                    image={event.image}
                    showDate={event.showDate}
                    place={event.place}
                    eventType={event.eventType}
                    href={event.href}
                    fullWidth
                  />
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 grid w-full  grid-cols-1 gap-5  md:grid-cols-2 md:gap-4 lg:grid-cols-4 lg:gap-5">
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
      {activeHeroEvent ? (
        <>
          {/* Mobile + tablet — featured cards (scroll-snap, no autoplay) */}
          <section className="lg:hidden bg-white pt-3 pb-5 sm:pt-4 sm:pb-6 md:pt-5 md:pb-8">
            <div className="mb-3 px-5 sm:px-8 md:mb-4">
              <h2 className="text-lg font-extrabold text-[#111111] sm:text-xl">
                Featured events
              </h2>
            </div>
            <div
              ref={mobilePromoTrackRef}
              className="flex snap-x snap-mandatory items-center gap-3 overflow-x-auto scroll-smooth pb-1 pl-[max(1rem,calc((100vw-min(78vw,20rem))/2))] pr-[max(1rem,calc((100vw-min(78vw,20rem))/2))] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-4 md:pl-[max(1.5rem,calc((100vw-min(52vw,21.25rem))/2))] md:pr-[max(1.5rem,calc((100vw-min(52vw,21.25rem))/2))]"
              onScroll={syncMobilePromoIndex}
            >
              {promoEvents.map((event, slideIdx) => (
                <div
                  key={event.id}
                  data-promo-card
                  className="w-[min(78vw,20rem)] shrink-0 snap-center md:w-[min(52vw,21.25rem)]"
                >
                  <PromoFeatureCard
                    event={event}
                    active={slideIdx === mobilePromoIndex}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Desktop — existing District blur banner (unchanged) */}
          <section className="relative hidden w-full overflow-hidden bg-white lg:block">
            {promoEvents.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="Previous promo"
                  onClick={goPrevPromo}
                  className="absolute left-2 top-1/2 z-20 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center text-slate-800 hover:opacity-70 xl:left-6 2xl:left-12 sm:size-10"
                >
                  <FaChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Next promo"
                  onClick={goNextPromo}
                  className="absolute right-2 top-1/2 z-20 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center text-slate-800 hover:opacity-70 xl:right-6 2xl:right-12 sm:size-10"
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
                return (
                  <div
                    key={
                      slideIdx === promoEvents.length
                        ? `${event.id}-loop`
                        : event.id
                    }
                    className="relative w-full shrink-0 grow-0 basis-full"
                  >
                    <div className="absolute inset-0 overflow-hidden" aria-hidden>
                      {image ? (
                        <img
                          src={image}
                          alt=""
                          className="absolute inset-0 h-full w-full scale-150 object-cover blur-[15px] opacity-80"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-slate-200" />
                      )}
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
                      className={`relative ${CONTAINER} py-8 sm:py-10 lg:py-12 lg:px-16 xl:px-14 2xl:px-12 ${
                        promoEvents.length > 1 ? "pb-14 sm:pb-16" : ""
                      }`}
                    >
                      <div className="flex flex-col-reverse md:flex-row md:items-center gap-6 md:gap-10 lg:gap-14">
                        <div className="flex-1 min-w-0 text-slate-900">
                          {formatPromoDateTime(event.next_showtime) ? (
                            <p className="text-xs sm:text-sm md:text-base font-medium text-slate-600">
                              {formatPromoDateTime(event.next_showtime)}
                            </p>
                          ) : null}
                          <h1 className="mt-2 text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold leading-tight line-clamp-3">
                            {event.name}
                          </h1>
                          {eventPlaceLine(event, city || undefined) ? (
                            <p className="mt-2 text-sm sm:text-base md:text-lg font-medium text-slate-700 line-clamp-2">
                              {eventPlaceLine(event, city || undefined)}
                            </p>
                          ) : null}
                          {priceOnwards(event) ? (
                            <p className="mt-3 text-sm sm:text-base md:text-lg font-bold text-slate-900">
                              {priceOnwards(event)}
                            </p>
                          ) : null}
                          <div className="mt-4 sm:mt-5">
                            <Link
                              href={`/events/${event.id}`}
                              className="inline-flex items-center justify-center rounded-2xl bg-[#131316] px-5 py-2 sm:px-8 sm:py-4 md:px-10 md:py-5 text-sm sm:text-base font-bold text-[#fff8da] hover:bg-zinc-900 transition-colors"
                            >
                              Book tickets
                            </Link>
                          </div>
                        </div>

                        <div className="mx-auto md:mx-0 shrink-0 flex h-[280px] sm:h-[340px] md:h-[380px] lg:h-[420px] items-center justify-center">
                          {image ? (
                            <img
                              src={portrait || landscape}
                              alt={event.name}
                              className="max-h-full w-auto max-w-[190px] sm:max-w-[235px] md:max-w-[270px] lg:max-w-[300px] rounded-2xl object-contain drop-shadow-[0_18px_40px_rgba(15,23,42,0.35)]"
                            />
                          ) : (
                            <div className="h-full aspect-[3/4] rounded-2xl bg-slate-200 flex items-center justify-center text-slate-500 text-sm font-medium px-4 text-center">
                              {event.name}
                            </div>
                          )}
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
          {/* 2) Explore Events — only categories that currently have events */}
          {exploreCategoriesWithEvents.length > 0 ? (
            <section className="pt-8 sm:pt-10 pb-2 bg-white">
              <div className={CONTAINER}>
                <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold text-slate-900 mb-4 sm:mb-5">
                  Explore Events
                </h2>
                <div className="flex gap-5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {exploreCategoriesWithEvents.map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      aria-label={cat.label}
                      onClick={() => onExploreCategory(cat.key)}
                      className="h-[180px] w-[140px] shrink-0 cursor-pointer overflow-hidden rounded-2xl border-0 bg-transparent p-0 hover:opacity-95 transition-opacity sm:h-[170px] sm:w-[130px]"
                    >
                      <img
                        src={cat.image}
                        alt={cat.label}
                        width={146}
                        height={190}
                        className="block h-full w-full object-fill"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {/* 3) Top recommendations */}
          <section className="pt-8 sm:pt-10 pb-2 bg-white">
            <div className={CONTAINER}>
              <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  {city
                    ? `Top recommended events in ${headingCity}`
                    : "Top recommended events"}
                </h2>
                {recommendedEvents.length > 0 ? (
                  <div className="hidden sm:flex gap-2">
                    <button
                      type="button"
                      aria-label="Scroll recommendations left"
                      onClick={() => scrollRow(recommendRef, -1)}
                      className="size-9 rounded-full border border-slate-200 bg-white text-slate-700 flex items-center justify-center cursor-pointer hover:bg-slate-50"
                    >
                      <FaChevronLeft size={12} />
                    </button>
                    <button
                      type="button"
                      aria-label="Scroll recommendations right"
                      onClick={() => scrollRow(recommendRef, 1)}
                      className="size-9 rounded-full border border-slate-200 bg-white text-slate-700 flex items-center justify-center cursor-pointer hover:bg-slate-50"
                    >
                      <FaChevronRight size={12} />
                    </button>
                  </div>
                ) : null}
              </div>
              {recommendedEvents.length > 0 ? (
                <>
                  <div
                    ref={recommendRef}
                    className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {recommendedEvents.map((event) => (
                      <RecommendCard key={event.id} event={event} cityLabel={city || undefined} />
                    ))}
                  </div>
                  {recommendedEvents.length > 5 ? (
                    <div className="mt-4 flex justify-center gap-1.5">
                      {Array.from({ length: recPages }, (_, i) => (
                        <button
                          key={i}
                          type="button"
                          aria-label={`Recommendations page ${i + 1}`}
                          onClick={() => {
                            setRecPage(i);
                            const el = recommendRef.current;
                            if (!el) return;
                            el.scrollTo({ left: i * el.clientWidth * 0.85, behavior: "smooth" });
                          }}
                          className={`h-1.5 rounded-full cursor-pointer transition-all ${
                            i === recPage ? "w-5 bg-[#6900AA]" : "w-1.5 bg-slate-300"
                          }`}
                        />
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-slate-500">No recommended events yet.</p>
              )}
            </div>
          </section>

          {/* 4) Artists */}
          <section className="pt-8 sm:pt-10 pb-2 bg-white">
            <div className={CONTAINER}>
              <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  {city ? `Artists in ${headingCity}` : "Artists in your District"}
                </h2>
                {artists.length > 0 ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      aria-label="Scroll artists left"
                      onClick={() => scrollRow(artistsRef, -1)}
                      className="size-9 rounded-full border border-slate-200 bg-white text-slate-700 flex items-center justify-center cursor-pointer hover:bg-slate-50"
                    >
                      <FaChevronLeft size={12} />
                    </button>
                    <button
                      type="button"
                      aria-label="Scroll artists right"
                      onClick={() => scrollRow(artistsRef, 1)}
                      className="size-9 rounded-full border border-slate-200 bg-white text-slate-700 flex items-center justify-center cursor-pointer hover:bg-slate-50"
                    >
                      <FaChevronRight size={12} />
                    </button>
                  </div>
                ) : null}
              </div>
              {artists.length > 0 ? (
                <div
                  ref={artistsRef}
                  className="flex gap-4 sm:gap-5 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {artists.map((artist) => (
                    <ArtistChip key={artist.id} artist={artist} />
                  ))}
                </div>
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-black/40 cursor-pointer"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="relative z-10 flex w-full sm:max-w-lg flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-xl max-h-[88vh]">
            <div className="px-4 pt-4 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Filter by</h3>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-3">{districtFilterModalBody}</div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-sm font-medium text-slate-800 underline underline-offset-2 cursor-pointer"
              >
                Clear filters
              </button>
              <button
                type="button"
                onClick={applyFiltersAndClose}
                className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white cursor-pointer hover:bg-zinc-900"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Footer />
    </div>
  );
}
