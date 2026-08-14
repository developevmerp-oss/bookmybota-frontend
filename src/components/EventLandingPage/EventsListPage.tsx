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
  useGetBusinessTypesQuery,
  useGetPublicEventsQuery,
  type PublicEvent,
} from "@/services/api";
import { formatMoney } from "@/lib/currencyFormat";
import images from "@/Images";
import EventsNavbar from "@/components/EventLandingPage/EventsNavbar";
import Footer from "@/components/LandingPage/Footer";

const PAGE_SIZE = 8;
const LANG_OPTIONS = ["English", "Amharic"] as const;
const PRICE_BANDS = [
  { id: "free", label: "Free" },
  { id: "0-500", label: "0 - 500" },
  { id: "501-2000", label: "501 - 2000" },
  { id: "2000+", label: "Above 2000" },
] as const;
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
  if (n.includes("comedy")) return { Icon: FaSmile, color: "text-[#1B5E3B]" };
  if (n.includes("music") || n.includes("concert")) return { Icon: FaMusic, color: "text-[#1B5E3B]" };
  if (n.includes("conference")) return { Icon: FaBuilding, color: "text-[#c47a3a]" };
  if (n.includes("festival")) return { Icon: FaLeaf, color: "text-[#1B5E3B]" };
  if (n.includes("sport")) return { Icon: FaFutbol, color: "text-[#1B5E3B]" };
  if (n.includes("exhibit")) return { Icon: FaImage, color: "text-slate-800" };
  if (n.includes("talk") || n.includes("theatre") || n.includes("theater")) {
    return { Icon: FaBullhorn, color: "text-[#c47a3a]" };
  }
  return { Icon: FaCalendarAlt, color: "text-[#1B5E3B]" };
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
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

function matchesDateFilter(iso: string | undefined, filter: string, from: string, to: string) {
  if (!iso) return filter === "" && !from && !to;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = today + 86400000;
  const dow = now.getDay();
  const saturday = today + ((6 - dow + 7) % 7) * 86400000;
  const sunday = saturday + 86400000;

  if (filter === "today") return t >= today && t < tomorrow;
  if (filter === "tomorrow") return t >= tomorrow && t < tomorrow + 86400000;
  if (filter === "weekend") return t >= saturday && t < sunday + 86400000;
  if (from) {
    const f = new Date(from).getTime();
    if (t < f) return false;
  }
  if (to) {
    const end = new Date(to).getTime() + 86400000;
    if (t >= end) return false;
  }
  return true;
}

function eventMatchesLanguage(event: PublicEvent, lang: string) {
  const raw = (event.language || "").toLowerCase();
  if (lang === "English") return /english|\ben\b/.test(raw);
  if (lang === "Amharic") return /amharic|amhara|\bam\b|አማርኛ/.test(raw);
  return raw.includes(lang.toLowerCase());
}

function eventMatchesPriceBand(event: PublicEvent, band: string) {
  const n = Number(event.min_price);
  const price = Number.isFinite(n) ? n : 0;
  if (band === "free") return price === 0;
  if (band === "0-500") return price > 0 && price <= 500;
  if (band === "501-2000") return price >= 501 && price <= 2000;
  if (band === "2000+") return price > 2000;
  return false;
}

function eventMatchesMoreFilter(event: PublicEvent, id: string) {
  const text = `${event.name} ${event.about_event || ""}`.toLowerCase();
  const age = (event.age_group || "").toLowerCase();
  const rating = Number(event.rating) || 0;
  if (id === "outdoor") return text.includes("outdoor");
  if (id === "fast") return event.status === "LIVE";
  if (id === "must") return rating >= 4;
  if (id === "unmissable") return (event.reviews_count || 0) > 0 || rating >= 4;
  if (id === "online") return /online|stream|virtual/.test(text);
  if (id === "kids-allowed") return /kid|child|family|all age/.test(age) || /kid|child|family/.test(text);
  if (id === "kids-activities") return /kid|child/.test(age) || /kid|child/.test(text);
  if (id === "new-year") return /new year|newyear/.test(text);
  return false;
}

function toIsoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
          ? "border-[#1B5E3B] bg-[#1B5E3B] text-white"
          : "border-slate-200 bg-white text-[#1B5E3B]"
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
            className={`shrink-0 transition-transform ${open ? "rotate-180 text-[#1B5E3B]" : "text-slate-400"}`}
          />
          <span className={`text-sm font-medium ${open ? "text-[#1B5E3B]" : "text-slate-800"}`}>{title}</span>
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
        {badge && (
          <div className="absolute bottom-2 left-2 bg-[#1B5E3B] text-white rounded-md px-2 py-1 leading-none">
            <span className="block text-[9px] font-bold tracking-wider">{badge.month}</span>
            <span className="block text-sm font-extrabold mt-0.5">{badge.day}</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-bold text-slate-900 text-sm line-clamp-2 min-h-[40px]">{event.name}</h3>
        {event.organizer_name && (
          <p className="mt-1.5 text-xs text-slate-500 line-clamp-1">{event.organizer_name}</p>
        )}
        {event.category_name && (
          <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">{event.category_name}</p>
        )}
        {event.min_price != null && (
          <p className="mt-2 text-sm font-semibold text-[#1B5E3B]">
            {formatMoney(event.min_price, { compact: true })} onwards
          </p>
        )}
      </div>
    </Link>
  );
}

export default function PublicEventsPage() {
  const [searchInput, setSearchInput] = useState("");
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
  const [priceBands, setPriceBands] = useState<string[]>([]);
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
  const [heroCityOpen, setHeroCityOpen] = useState(false);
  const heroCityRef = useRef<HTMLDivElement>(null);

  const { data: businessTypes = [] } = useGetBusinessTypesQuery();
  const queryArg = useMemo(
    () => ({
      ...(search.trim() ? { q: search.trim() } : {}),
      ...(city ? { city } : {}),
    }),
    [search, city]
  );
  const { data: events = [], isLoading } = useGetPublicEventsQuery(queryArg);

  useEffect(() => {
    const stored = localStorage.getItem("selected_city");
    if (stored && stored !== "All Cities") setCity(stored);
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const cat = params.get("category");
    const cityParam = params.get("city");
    if (q) {
      setSearchInput(q);
      setSearch(q);
    }
    if (cat) setSelectedSlugs([cat]);
    if (cityParam && cityParam !== "All Cities") setCity(cityParam);
  }, []);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (heroCityRef.current && !heroCityRef.current.contains(e.target as Node)) {
        setHeroCityOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const categories = useMemo(
    () => businessTypes.filter((t) => t.module_key === "event" && t.parent_type_id),
    [businessTypes]
  );

  const venues = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => {
      if (e.organizer_name) set.add(e.organizer_name);
    });
    return Array.from(set).sort();
  }, [events]);

  const cityOptions = useMemo(() => {
    const opts = ["All Cities"];
    if (city && !opts.includes(city)) opts.push(city);
    return opts;
  }, [city]);

  const filtered = useMemo(() => {
    let list = [...events];
    if (selectedSlugs.length) {
      list = list.filter((e) => e.category_slug && selectedSlugs.includes(e.category_slug));
    }
    if (selectedLanguages.length) {
      list = list.filter((e) => selectedLanguages.some((lang) => eventMatchesLanguage(e, lang)));
    }
    if (datePreset || dateFrom || dateTo) {
      list = list.filter((e) => matchesDateFilter(e.next_showtime, datePreset, dateFrom, dateTo));
    }
    if (priceBands.length) {
      list = list.filter((e) => priceBands.some((band) => eventMatchesPriceBand(e, band)));
    }
    if (moreFilters.length) {
      list = list.filter((e) => moreFilters.some((id) => eventMatchesMoreFilter(e, id)));
    }
    if (venueFilter) {
      list = list.filter((e) => e.organizer_name === venueFilter);
    }
    if (sort === "date") {
      list.sort((a, b) => new Date(a.next_showtime || 0).getTime() - new Date(b.next_showtime || 0).getTime());
    } else if (sort === "price-asc") {
      list.sort((a, b) => Number(a.min_price || 0) - Number(b.min_price || 0));
    } else if (sort === "price-desc") {
      list.sort((a, b) => Number(b.min_price || 0) - Number(a.min_price || 0));
    }
    return list;
  }, [
    events,
    selectedSlugs,
    selectedLanguages,
    datePreset,
    dateFrom,
    dateTo,
    priceBands,
    moreFilters,
    venueFilter,
    sort,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, city, selectedSlugs, selectedLanguages, datePreset, dateFrom, dateTo, priceBands, moreFilters, venueFilter, sort]);

  const handleCityChange = (next: string) => {
    const value = next === "All Cities" ? "" : next;
    setCity(value);
    if (value) localStorage.setItem("selected_city", value);
    else localStorage.removeItem("selected_city");
    window.dispatchEvent(new Event("selected_city_changed"));
  };

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

  const submitSearch = () => setSearch(searchInput.trim());
  const heroSrc = typeof images.heroEvent === "string" ? images.heroEvent : images.heroEvent.src;

  return (
    <div className="min-h-screen bg-[#f6f7f8]">
      <EventsNavbar city={city || "All Cities"} cityOptions={cityOptions} onCityChange={handleCityChange} />

      <section className="relative min-h-[380px] sm:min-h-[440px] overflow-hidden">
        <img
          src={heroSrc}
          alt="Discover amazing events in Ethiopia"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
          <div className="max-w-xl text-left">
            <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-white tracking-tight leading-[1.15]">
              Discover Amazing Events
              <br />
              in Ethiopia
            </h1>
            <p className="mt-3 text-white/90 text-base sm:text-lg">
              Find concerts, festivals, conferences, exhibitions and more.
            </p>
            <form
              className="mt-8 flex items-center bg-white rounded-lg overflow-hidden shadow-lg"
              onSubmit={(e) => {
                e.preventDefault();
                submitSearch();
              }}
            >
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search events, artists, venues..."
                className="flex-1 min-w-0 px-4 py-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                className="w-12 h-12 sm:w-[52px] sm:h-[52px] bg-[#1B5E3B] text-white flex items-center justify-center cursor-pointer hover:bg-[#164e31] shrink-0"
                aria-label="Search"
              >
                <FaSearch size={16} />
              </button>
            </form>
            <div className="relative mt-3 inline-block" ref={heroCityRef}>
              <button
                type="button"
                onClick={() => setHeroCityOpen((v) => !v)}
                className="inline-flex items-center gap-2 bg-white text-slate-800 text-sm font-semibold px-3.5 py-2.5 rounded-lg shadow cursor-pointer"
              >
                <FaMapMarkerAlt size={13} className="text-[#E67E22]" />
                {city || "All Cities"}
                <FaChevronDown size={10} className="text-slate-500" />
              </button>
              {heroCityOpen && (
                <div className="absolute left-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-20 max-h-56 overflow-y-auto">
                  {cityOptions.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        handleCityChange(c);
                        setHeroCityOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm cursor-pointer hover:bg-emerald-50 ${
                        c === (city || "All Cities") ? "text-[#1B5E3B] font-semibold" : "text-slate-700"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="categories" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">Popular Categories</h2>
          <button
            type="button"
            onClick={() => {
              setShowAllCategories(true);
              document.getElementById("city-filter")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="text-sm text-[#1B5E3B] hover:underline cursor-pointer"
          >
            View All Categories
          </button>
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
                      active ? "bg-[#1B5E3B] text-white" : `bg-[#eef0f2] ${color}`
                    }`}
                  >
                    <Icon size={22} />
                  </span>
                  <span
                    className={`text-[13px] text-center leading-tight ${
                      active ? "font-semibold text-[#1B5E3B]" : "text-slate-800"
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
                  {[
                    { id: "today", label: "Today" },
                    { id: "tomorrow", label: "Tomorrow" },
                    { id: "weekend", label: "This Weekend" },
                  ].map((d) => (
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
                          ? "border-[#1B5E3B] bg-[#1B5E3B] text-white"
                          : "border-slate-200 bg-white text-[#1B5E3B]"
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
                    className="accent-[#1B5E3B]"
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
                            ? "text-[#1B5E3B] border-b-2 border-[#1B5E3B] font-semibold"
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
                            ? "text-[#1B5E3B] border-b-2 border-[#1B5E3B] font-semibold"
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
                              selected ? "text-[#1B5E3B] font-bold" : "text-slate-700 hover:bg-slate-100"
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
                        className="flex-1 text-xs py-1.5 border border-slate-200 rounded text-[#1B5E3B] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDateFrom("");
                          setDateTo("");
                        }}
                        className="flex-1 text-xs py-1.5 border border-slate-200 rounded text-[#1B5E3B] cursor-pointer"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => setUseDateRange(true)}
                        className="flex-1 text-xs py-1.5 rounded bg-[#1B5E3B] text-white cursor-pointer"
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
                  {LANG_OPTIONS.map((lang) => (
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
                  {MORE_FILTERS.map((f) => (
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
                onClear={() => setPriceBands([])}
              >
                <div className="flex flex-wrap gap-2">
                  {PRICE_BANDS.map((band) => (
                    <FilterTag
                      key={band.id}
                      label={band.label}
                      active={priceBands.includes(band.id)}
                      onClick={() => toggleIn(priceBands, band.id, setPriceBands)}
                    />
                  ))}
                </div>
              </FilterCard>
            </div>

            <button
              type="button"
              onClick={() => setBrowseVenues((v) => !v)}
              className="mt-3 w-full border border-[#1B5E3B] rounded-lg py-2.5 text-sm font-semibold text-[#1B5E3B] bg-white cursor-pointer"
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
                        venueFilter === v ? "text-[#1B5E3B] font-semibold" : "text-slate-600"
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
              <label className="flex items-center gap-2 text-sm text-slate-600">
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
              </label>
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
                      n === pageSafe ? "bg-[#1B5E3B] text-white" : "bg-white border border-slate-200 text-slate-700"
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
