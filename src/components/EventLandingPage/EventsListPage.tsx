"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import {
  FaBuilding,
  FaBullhorn,
  FaCalendarAlt,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaEllipsisH,
  FaFutbol,
  FaImage,
  FaLeaf,
  FaMapMarkerAlt,
  FaMusic,
  FaSearch,
  FaSmile,
} from "react-icons/fa";
import {
  api,
  useGetBusinessTypesQuery,
  useGetPublicEventFiltersQuery,
  useGetPublicEventsQuery,
  type PublicEvent,
} from "@/services/api";
import { formatMoney } from "@/lib/currencyFormat";
import images from "@/Images";
import Footer from "@/components/LandingPage/Footer";
import { useAppDispatch } from "@/lib/hooks";

const PAGE_SIZE = 8;
const LANG_OPTIONS = ["English", "Amharic"] as const;
const PRICE_BANDS = [
  { id: "free", label: "Free" },
  { id: "0-500", label: "0 - 500" },
  { id: "501-2000", label: "501 - 2000" },
  { id: "2000+", label: "Above 2000" },
] as const;
const PRICE_SLIDER_MAX = 2500;
const MORE_FILTERS = [
  { id: "outdoor", label: "Outdoor Events" },
  { id: "fast", label: "Fast Filling" },
  { id: "must", label: "Must Attend" },
  { id: "unmissable", label: "Unmissable Events" },
  { id: "online", label: "Online Streaming" },
  { id: "kids-allowed", label: "Kids Allowed" },
  { id: "kids-activities", label: "Kids Activities" },
  { id: "new-year", label: "New Year Parties" },
] as const;

function categoryStyle(name: string): {
  Icon: ComponentType<{ size?: number; className?: string }>;
  color: string;
} {
  const n = name.toLowerCase();
  if (n.includes("comedy")) return { Icon: FaSmile, color: "text-[#6900AA]" };
  if (n.includes("music") || n.includes("concert")) return { Icon: FaMusic, color: "text-[#6900AA]" };
  if (n.includes("conference")) return { Icon: FaBuilding, color: "text-[#c47a3a]" };
  if (n.includes("festival")) return { Icon: FaLeaf, color: "text-[#6900AA]" };
  if (n.includes("sport")) return { Icon: FaFutbol, color: "text-[#6900AA]" };
  if (n.includes("exhibit")) return { Icon: FaImage, color: "text-slate-800" };
  if (n.includes("talk") || n.includes("theatre") || n.includes("theater")) {
    return { Icon: FaBullhorn, color: "text-[#c47a3a]" };
  }
  return { Icon: FaCalendarAlt, color: "text-[#6900AA]" };
}

function dateBadge(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return {
    month: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
    day: String(d.getDate()).padStart(2, "0"),
  };
}

function toIsoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function sliderValueFromBands(bands: string[]) {
  const band = bands[0];
  if (band === "free") return 0;
  if (band === "0-500") return 500;
  if (band === "501-2000") return 2000;
  if (band === "2000+") return PRICE_SLIDER_MAX;
  return PRICE_SLIDER_MAX;
}

function bandFromSliderValue(value: number) {
  if (value <= 0) return "free";
  if (value <= 500) return "0-500";
  if (value <= 2000) return "501-2000";
  return "2000+";
}

function priceLabelFromSlider(value: number) {
  if (value <= 0) return "Free";
  if (value >= PRICE_SLIDER_MAX) return `${formatMoney(2000, { compact: true })}+`;
  return formatMoney(value, { compact: true });
}

function eventPriceValue(event: PublicEvent) {
  const raw = Number(event.min_price ?? 0);
  return Number.isFinite(raw) ? raw : 0;
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
      className={`px-2.5 py-1.5 text-[11px] rounded-md border cursor-pointer transition-colors ${
        active
          ? "border-[#6900AA] bg-[#6900AA] text-white"
          : "border-slate-200 bg-white text-[#6900AA]"
      }`}
    >
      {label}
    </button>
  );
}

function FilterCard({
  title,
  open,
  onToggle,
  onClear,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  onClear: () => void;
  children: ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-2 px-3 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer text-left"
        >
          <FaChevronDown
            size={11}
            className={`shrink-0 transition-transform ${open ? "rotate-180 text-[#6900AA]" : "text-slate-400"}`}
          />
          <span className={`text-sm font-medium ${open ? "text-[#6900AA]" : "text-slate-800"}`}>{title}</span>
        </button>
        <button type="button" onClick={onClear} className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer">
          Clear
        </button>
      </div>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function EventCard({ event }: { event: PublicEvent }) {
  const image = event.poster_horizontal_url || event.poster_vertical_url;
  const badge = dateBadge(event.next_showtime);

  return (
    <Link
      href={`/events/${event.id}`}
      className="group bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
        {image ? (
          <img src={image} alt={event.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <FaCalendarAlt size={28} />
          </div>
        )}
      </div>
      <div className="p-3">
        {badge && (
          <div className="inline-flex flex-col rounded-md bg-[#6900AA] px-2 py-1 leading-none text-white mb-3">
            <span className="text-[9px] font-bold tracking-wider">{badge.month}</span>
            <span className="text-sm font-extrabold mt-0.5">{badge.day}</span>
          </div>
        )}
        <h3 className="font-bold text-slate-900 text-sm line-clamp-2">{event.name}</h3>
        {event.organizer_name && (
          <p className="mt-1.5 text-xs text-slate-500 line-clamp-1">{event.organizer_name}</p>
        )}
        {event.category_name && (
          <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">{event.category_name}</p>
        )}
        {event.min_price != null && (
          <p className="mt-2 text-sm font-semibold text-[#6900AA]">
            {formatMoney(event.min_price, { compact: true })} onwards
          </p>
        )}
      </div>
    </Link>
  );
}

export default function PublicEventsPage() {
  const dispatch = useAppDispatch();
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [useDateRange, setUseDateRange] = useState(false);
  const [calTab, setCalTab] = useState<"start" | "end">("start");
  const [calMonth, setCalMonth] = useState(() => new Date());
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [moreFilters, setMoreFilters] = useState<string[]>([]);
  const [openFilters, setOpenFilters] = useState({
    categories: true,
    date: false,
    languages: false,
    more: false,
    price: false,
  });
  const [sort, setSort] = useState("recommended");
  const [page, setPage] = useState(1);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [venueFilter, setVenueFilter] = useState("");
  const [browseVenues, setBrowseVenues] = useState(false);
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [offerHeroEvents, setOfferHeroEvents] = useState<PublicEvent[]>([]);
  const [priceSliderValue, setPriceSliderValue] = useState(PRICE_SLIDER_MAX);

  const { data: businessTypes = [] } = useGetBusinessTypesQuery();
  const { data: filterOptions } = useGetPublicEventFiltersQuery();
  const queryArg = useMemo(
    () => ({
      ...(search.trim() ? { q: search.trim() } : {}),
      ...(city ? { city } : {}),
      ...(selectedSlugs.length ? { category: selectedSlugs.join(",") } : {}),
      ...(selectedLanguages.length ? { language: selectedLanguages.join(",") } : {}),
      ...(datePreset ? { date_preset: datePreset } : {}),
      ...(!datePreset && dateFrom ? { date_from: dateFrom } : {}),
      ...(!datePreset && dateTo ? { date_to: dateTo } : {}),
      ...(moreFilters.length ? { more: moreFilters.join(",") } : {}),
      ...(venueFilter ? { organizer: venueFilter } : {}),
      ...(sort && sort !== "recommended" ? { sort } : {}),
    }),
    [
      search,
      city,
      selectedSlugs,
      selectedLanguages,
      datePreset,
      dateFrom,
      dateTo,
      moreFilters,
      venueFilter,
      sort,
    ]
  );
  const { data: events = [], isLoading } = useGetPublicEventsQuery(queryArg);

  useEffect(() => {
    const applyCity = () => {
      const stored = localStorage.getItem("selected_city");
      const params = new URLSearchParams(window.location.search);
      const cityParam = params.get("city");
      if (cityParam && cityParam !== "All Cities") setCity(cityParam);
      else if (stored && stored !== "All Cities") setCity(stored);
      else setCity("");
    };
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const cat = params.get("category");
    if (q) setSearch(q);
    if (cat) setSelectedSlugs([cat]);
    applyCity();
    window.addEventListener("selected_city_changed", applyCity);
    return () => window.removeEventListener("selected_city_changed", applyCity);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadOfferEvents = async () => {
      const candidates = events
        .filter((e) => e.poster_horizontal_url || e.poster_vertical_url)
        .slice(0, 8);

      if (candidates.length === 0) {
        setOfferHeroEvents([]);
        setHeroSlideIndex(0);
        return;
      }

      const checks = await Promise.all(
        candidates.map(async (event) => {
          const req = dispatch(api.endpoints.getPublicEventOffers.initiate(event.id));
          try {
            const offers = await req.unwrap();
            return Array.isArray(offers) && offers.length > 0 ? event : null;
          } catch {
            return null;
          } finally {
            req.unsubscribe();
          }
        })
      );

      if (cancelled) return;
      const matched = checks.filter((e): e is PublicEvent => Boolean(e));
      setOfferHeroEvents(matched);
      setHeroSlideIndex(0);
    };

    loadOfferEvents();
    return () => {
      cancelled = true;
    };
  }, [events, dispatch]);

  useEffect(() => {
    if (offerHeroEvents.length <= 1) return;
    const timer = window.setInterval(() => {
      setHeroSlideIndex((prev) => (prev + 1) % offerHeroEvents.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [offerHeroEvents]);

  const categories = useMemo(
    () => businessTypes.filter((t) => t.module_key === "event" && t.parent_type_id),
    [businessTypes]
  );

  const venues = useMemo(() => filterOptions?.organizers || [], [filterOptions?.organizers]);

  const languageOptions = useMemo(() => {
    return [...LANG_OPTIONS];
  }, []);

  const datePresets = filterOptions?.date_presets?.length
    ? filterOptions.date_presets
    : [
        { id: "today", label: "Today" },
        { id: "tomorrow", label: "Tomorrow" },
        { id: "weekend", label: "This Weekend" },
      ];
  const moreOptions = filterOptions?.more?.length ? filterOptions.more : [...MORE_FILTERS];

  const filtered = useMemo(() => {
    if (priceSliderValue >= PRICE_SLIDER_MAX) return events;
    return events.filter((event) => eventPriceValue(event) <= priceSliderValue);
  }, [events, priceSliderValue]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, city, selectedSlugs, selectedLanguages, datePreset, dateFrom, dateTo, priceSliderValue, moreFilters, venueFilter, sort]);

  const selectSlug = (slug?: string) => {
    if (!slug) return;
    setSelectedSlugs((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  };

  const toggleIn = (list: string[], value: string, setter: (next: string[]) => void) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const toggleOpen = (key: keyof typeof openFilters) => {
    setOpenFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const pickCalendarDay = (day: number) => {
    const iso = toIsoDate(calMonth.getFullYear(), calMonth.getMonth(), day);
    setDatePreset("");
    if (calTab === "start") {
      setDateFrom(iso);
      if (dateTo && iso > dateTo) setDateTo("");
      setCalTab("end");
    } else {
      if (dateFrom && iso < dateFrom) {
        setDateFrom(iso);
      } else {
        setDateTo(iso);
      }
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

  const popular = showAllCategories ? categories : categories.slice(0, 7);
  const headingCity = city || "Ethiopia";

  const heroSrc = typeof images.heroEvent === "string" ? images.heroEvent : images.heroEvent.src;
  const hasOfferHero = offerHeroEvents.length > 0;
  const activeHeroEvent = hasOfferHero ? offerHeroEvents[heroSlideIndex] : null;
  const activeHeroSrc =
    activeHeroEvent?.poster_horizontal_url ||
    activeHeroEvent?.poster_vertical_url ||
    heroSrc;

  return (
    <div className="min-h-screen bg-[#f6f7f8]">
      <section className="relative min-h-[380px] sm:min-h-[440px] overflow-hidden">
        <img
          src={activeHeroSrc}
          alt="Discover amazing events in Ethiopia"
          className="absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700"
        />
      </section>

      <section id="categories" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">Popular Categories</h2>
          {/* <button
            type="button"
            onClick={() => {
              setShowAllCategories(true);
              document.getElementById("city-filter")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="text-sm text-[#6900AA] hover:underline cursor-pointer"
          >
            View All Categories
          </button> */}
        </div>
        {categories.length === 0 ? (
          <p className="text-sm text-slate-400">Categories load from the event catalog.</p>
        ) : (
          <div className="flex flex-wrap gap-8 lg:gap-10">
            {popular.map((cat) => {
              const { Icon, color } = categoryStyle(cat.name);
              const active = !!cat.slug && selectedSlugs.includes(cat.slug);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => selectSlug(cat.slug)}
                  className="flex flex-col items-center gap-2.5 cursor-pointer w-[72px]"
                >
                  <span
                    className={`w-[68px] h-[68px] rounded-full flex items-center justify-center transition-colors ${
                      active ? "bg-[#6900AA] text-white" : `bg-[#eef0f2] ${color}`
                    }`}
                  >
                    <Icon size={22} />
                  </span>
                  <span
                    className={`text-[13px] text-center leading-tight ${
                      active ? "font-semibold text-[#6900AA]" : "text-slate-800"
                    }`}
                  >
                    {cat.name}
                  </span>
                </button>
              );
            })}
            {!showAllCategories && categories.length > 7 && (
              <button
                type="button"
                onClick={() => setShowAllCategories(true)}
                className="flex flex-col items-center gap-2.5 cursor-pointer w-[72px]"
              >
                <span className="w-[68px] h-[68px] rounded-full bg-[#eef0f2] text-slate-800 flex items-center justify-center">
                  <FaEllipsisH size={18} />
                </span>
                <span className="text-[13px] text-slate-800">More</span>
              </button>
            )}
          </div>
        )}
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
          <aside
            id="city-filter"
            className="lg:sticky lg:top-24 self-start h-fit max-h-none lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto [scrollbar-width:thin]"
          >
            <h3 className="font-bold text-slate-900 text-lg mb-4">Filters</h3>
            <div className="space-y-2.5">
              <FilterCard
                title="Categories"
                open={openFilters.categories}
                onToggle={() => toggleOpen("categories")}
                onClear={() => setSelectedSlugs([])}
              >
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <FilterTag
                      key={cat.id}
                      label={cat.name}
                      active={!!cat.slug && selectedSlugs.includes(cat.slug)}
                      onClick={() => selectSlug(cat.slug)}
                    />
                  ))}
                </div>
              </FilterCard>

              <FilterCard
                title="Date"
                open={openFilters.date}
                onToggle={() => toggleOpen("date")}
                onClear={() => {
                  setDatePreset("");
                  setDateFrom("");
                  setDateTo("");
                  setUseDateRange(false);
                }}
              >
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
                      setUseDateRange(e.target.checked);
                      if (e.target.checked) setDatePreset("");
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
                        Start Date
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
                        End Date
                      </button>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <button
                        type="button"
                        className="p-1 cursor-pointer text-slate-500"
                        onClick={() =>
                          setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))
                        }
                      >
                        <FaChevronLeft size={12} />
                      </button>
                      <p className="text-sm font-semibold text-slate-800">
                        {calMonth.toLocaleString("en-US", { month: "long", year: "numeric" })}
                      </p>
                      <button
                        type="button"
                        className="p-1 cursor-pointer text-slate-500"
                        onClick={() =>
                          setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))
                        }
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
                        return (
                          <button
                            key={iso}
                            type="button"
                            onClick={() => pickCalendarDay(day)}
                            className={`h-7 text-xs rounded cursor-pointer ${
                              selected ? "text-[#6900AA] font-bold" : "text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setUseDateRange(false)}
                        className="flex-1 text-xs py-1.5 border border-slate-200 rounded text-[#6900AA] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDateFrom("");
                          setDateTo("");
                        }}
                        className="flex-1 text-xs py-1.5 border border-slate-200 rounded text-[#6900AA] cursor-pointer"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => setUseDateRange(true)}
                        className="flex-1 text-xs py-1.5 rounded bg-[#6900AA] text-white cursor-pointer"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </FilterCard>

              <FilterCard
                title="Languages"
                open={openFilters.languages}
                onToggle={() => toggleOpen("languages")}
                onClear={() => setSelectedLanguages([])}
              >
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
              </FilterCard>

              <FilterCard
                title="More Filters"
                open={openFilters.more}
                onToggle={() => toggleOpen("more")}
                onClear={() => setMoreFilters([])}
              >
                <div className="flex flex-wrap gap-2">
                  {moreOptions.map((f) => (
                    <FilterTag
                      key={f.id}
                      label={f.label}
                      active={moreFilters.includes(f.id)}
                      onClick={() => toggleIn(moreFilters, f.id, setMoreFilters)}
                    />
                  ))}
                </div>
              </FilterCard>

              <FilterCard
                title="Price"
                open={openFilters.price}
                onToggle={() => toggleOpen("price")}
                onClear={() => {
                  setPriceSliderValue(PRICE_SLIDER_MAX);
                }}
              >
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-400">Price</span>
                    <span className="text-sm font-semibold text-slate-700">{priceLabelFromSlider(priceSliderValue)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={PRICE_SLIDER_MAX}
                    step={50}
                    value={priceSliderValue}
                    onChange={(e) => {
                      setPriceSliderValue(Number(e.target.value));
                    }}
                    className="mt-4 h-2 w-full cursor-pointer accent-[#7A00C6]"
                  />
                </div>
              </FilterCard>
            </div>

            <button
              type="button"
              onClick={() => setBrowseVenues((v) => !v)}
              className="mt-3 w-full border border-[#6900AA] rounded-lg py-2.5 text-sm font-semibold text-[#6900AA] bg-white cursor-pointer"
            >
              Browse by Venues
            </button>
            {browseVenues && venues.length > 0 && (
              <ul className="mt-2 bg-white rounded-lg shadow-sm p-3 space-y-2 max-h-40 overflow-y-auto">
                {venues.map((v) => (
                  <li key={v}>
                    <button
                      type="button"
                      onClick={() => setVenueFilter((cur) => (cur === v ? "" : v))}
                      className={`text-left text-sm w-full cursor-pointer ${
                        venueFilter === v ? "text-[#6900AA] font-semibold" : "text-slate-600"
                      }`}
                    >
                      {v}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <div>
            <div className="flex items-center justify-between gap-3 mb-5">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                Events in {headingCity}
              </h2>
              {/* <label className="flex items-center gap-2 text-sm text-slate-600">
                Sort by:
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-800 bg-white"
                >
                  <option value="recommended">Recommended</option>
                  <option value="date">Date</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                </select>
              </label> */}
            </div>

            {isLoading ? (
              <p className="text-sm text-slate-500 py-16 text-center">Loading events...</p>
            ) : paged.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                <FaMapMarkerAlt className="mx-auto text-slate-300 mb-3" size={28} />
                <p className="text-slate-600 font-medium">No events match these filters</p>
                <p className="text-slate-400 text-sm mt-1">Try clearing filters or searching another city.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {paged.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}

            {filtered.length > PAGE_SIZE && (
              <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`w-9 h-9 rounded-full text-sm font-semibold cursor-pointer ${
                      n === pageSafe ? "bg-[#6900AA] text-white" : "bg-white border border-slate-200 text-slate-700"
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
        </div>
      </section>

      <Footer />
    </div>
  );
}
