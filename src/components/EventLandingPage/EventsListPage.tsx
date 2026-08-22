"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaMapMarkerAlt,
  FaSearch,
} from "react-icons/fa";
import {
  api,
  useGetBusinessTypesQuery,
  useGetPublicEventFiltersQuery,
  useGetPublicEventsQuery,
  type PublicEvent,
} from "@/services/api";
import { useAppDispatch } from "@/lib/hooks";
import { formatMoney } from "@/lib/currencyFormat";
import images from "@/Images";
import { EventPosterCard } from "@/components/LandingPage/PosterCard";
import Footer from "@/components/LandingPage/Footer";
import EventHeroSlider from "@/components/EventLandingPage/EventHeroSlider";
import { EventListShimmer } from "@/components/Shared/Shimmer";

function imageSrc(img: string | { src: string }) {
  return typeof img === "string" ? img : img.src;
}

const EVENT_HERO_SLIDES = [
  {
    src: imageSrc(images.eventNetworking),
    alt: "Professional networking event with people in suits talking in a modern lounge with a city view",
  },
  {
    src: imageSrc(images.eventCulturalCelebration),
    alt: "Traditional Ethiopian celebration with women in Habesha Kemis dancing and clapping",
  },
  {
    src: imageSrc(images.eventStadium),
    alt: "Packed soccer stadium in Ethiopia with fans waving green, yellow, and red flags",
  },
  {
    src: imageSrc(images.eventConcert),
    alt: "Live outdoor concert at night with a large crowd facing a brightly lit stage",
  },
];

const PAGE_SIZE = 8;
const EMPTY_EVENTS: PublicEvent[] = [];
const LANG_OPTIONS = ["English", "Amharic"] as const;
const PRICE_BANDS = [
  { id: "free", label: "Free" },
  { id: "0-500", label: "0 - 500" },
  { id: "501-2000", label: "501 - 2000" },
  { id: "2000+", label: "Above 2000" },
] as const;
const PRICE_SLIDER_MAX = 2500;

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

function EventCard({ event, cityLabel }: { event: PublicEvent; cityLabel?: string }) {
  return <EventPosterCard event={event} city={cityLabel} fullWidth />;
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
  const [openFilters, setOpenFilters] = useState({
    categories: true,
    date: false,
    languages: false,
    price: false,
  });
  const [sort, setSort] = useState("recommended");
  const [page, setPage] = useState(1);
  const [venueFilter, setVenueFilter] = useState("");
  const [browseVenues, setBrowseVenues] = useState(false);
  const [mobileFilterTab, setMobileFilterTab] = useState<"categories" | "date" | "languages" | "price" | null>(null);
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
      venueFilter,
      sort,
    ]
  );
  const { data: eventsData, isLoading } = useGetPublicEventsQuery(queryArg);
  const events = eventsData ?? EMPTY_EVENTS;

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
  const moreOptions: { id: string; label: string }[] = [];

  const filtered = useMemo(() => {
    if (priceSliderValue >= PRICE_SLIDER_MAX) return events;
    return events.filter((event) => eventPriceValue(event) <= priceSliderValue);
  }, [events, priceSliderValue]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, city, selectedSlugs, selectedLanguages, datePreset, dateFrom, dateTo, priceSliderValue, venueFilter, sort]);

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

  const headingCity = city || "Ethiopia";
  const hasOfferHero = offerHeroEvents.length > 0;
  const activeHeroEvent = hasOfferHero ? offerHeroEvents[heroSlideIndex] : null;
  const activeHeroSrc =
    activeHeroEvent?.poster_horizontal_url ||
    activeHeroEvent?.poster_vertical_url ||
    "";

  const categoriesPanel = () => (
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
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
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
  );

  const venueBlock = () => (
    <>
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
    </>
  );

  const mobileTabs = [
    { id: "categories" as const, label: "Categories" },
    { id: "date" as const, label: "Date" },
    { id: "languages" as const, label: "Languages" },
    { id: "price" as const, label: "Price" },
  ];

  return (
    <div className="min-h-screen bg-[#f6f7f8]">
      <EventHeroSlider slides={EVENT_HERO_SLIDES} />

      {hasOfferHero && activeHeroEvent && activeHeroSrc && (
        <section className="relative min-h-[220px] sm:min-h-[300px] md:min-h-[360px] overflow-hidden">
          <Link href={`/events/${activeHeroEvent.id}`} className="block relative h-full min-h-[inherit]">
            <img
              src={activeHeroSrc}
              alt={activeHeroEvent.name}
              className="absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 lg:p-8">
              <span className="inline-block rounded-md bg-[#6900AA] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                Exclusive Offer
              </span>
              <h2 className="mt-2 text-lg sm:text-2xl lg:text-3xl font-extrabold text-white line-clamp-2">
                {activeHeroEvent.name}
              </h2>
              {activeHeroEvent.min_price != null && (
                <p className="mt-1 text-sm sm:text-base font-semibold text-white/90">
                  From {formatMoney(activeHeroEvent.min_price, { compact: true })}
                </p>
              )}
            </div>
          </Link>
          {offerHeroEvents.length > 1 && (
            <div className="absolute bottom-3 sm:bottom-4 right-4 sm:right-6 flex gap-1.5">
              {offerHeroEvents.map((event, index) => (
                <button
                  key={event.id}
                  type="button"
                  aria-label={`Show offer for ${event.name}`}
                  onClick={() => setHeroSlideIndex(index)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    index === heroSlideIndex ? "w-5 bg-white" : "w-2 bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="container mx-auto px-4 sm:px-6 lg:px-8 pb-10 sm:pb-14 lg:pb-16 pt-8 sm:pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] xl:grid-cols-[260px_1fr] gap-5 lg:gap-8">
          <aside
            id="city-filter"
            className="lg:sticky lg:top-24 self-start h-fit max-h-none lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto [scrollbar-width:thin]"
          >
            <h3 className="font-bold text-slate-900 text-base sm:text-lg mb-3 lg:mb-4">Filters</h3>

            <div className="lg:hidden">
              <div className="grid grid-cols-4 gap-1.5">
                {mobileTabs.map((tab) => {
                  const active = mobileFilterTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMobileFilterTab((prev) => (prev === tab.id ? null : tab.id))}
                      className={`px-1 py-2 rounded-lg text-[11px] sm:text-xs font-semibold cursor-pointer border ${
                        active
                          ? "bg-[#6900AA] border-[#6900AA] text-white"
                          : "bg-white border-slate-200 text-slate-700"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              {mobileFilterTab && (
                <div className="mt-2 bg-white rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.06)] p-3">
                  {mobileFilterTab === "categories" && categoriesPanel()}
                  {mobileFilterTab === "date" && datePanel()}
                  {mobileFilterTab === "languages" && languagesPanel()}
                  {mobileFilterTab === "price" && pricePanel()}
                </div>
              )}
              {venueBlock()}
            </div>

            <div className="hidden lg:block space-y-2.5">
              <FilterCard
                title="Categories"
                open={openFilters.categories}
                onToggle={() => toggleOpen("categories")}
                onClear={() => setSelectedSlugs([])}
              >
                {categoriesPanel()}
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
                {datePanel()}
              </FilterCard>

              <FilterCard
                title="Languages"
                open={openFilters.languages}
                onToggle={() => toggleOpen("languages")}
                onClear={() => setSelectedLanguages([])}
              >
                {languagesPanel()}
              </FilterCard>

              <FilterCard
                title="Price"
                open={openFilters.price}
                onToggle={() => toggleOpen("price")}
                onClear={() => {
                  setPriceSliderValue(PRICE_SLIDER_MAX);
                }}
              >
                {pricePanel()}
              </FilterCard>
              {venueBlock()}
            </div>
          </aside>

          <div>
            <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-slate-900 break-words">
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
              <EventListShimmer />
            ) : paged.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                <FaMapMarkerAlt className="mx-auto text-slate-300 mb-3" size={28} />
                <p className="text-slate-600 font-medium">No events match these filters</p>
                <p className="text-slate-400 text-sm mt-1">Try clearing filters or searching another city.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
                {paged.map((event) => (
                  <EventCard key={event.id} event={event} cityLabel={headingCity} />
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
