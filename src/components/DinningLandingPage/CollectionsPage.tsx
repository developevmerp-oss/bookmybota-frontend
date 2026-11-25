"use client";
import { Suspense, useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Search, X } from "lucide-react";
import { useGetCollectionsQuery } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { CollectionsShimmer } from "@/components/Shared/Shimmer";

function CollectionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [city, setCity] = useState("");
  const bmsHeaderRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [bmsHeaderHeight, setBmsHeaderHeight] = useState(56);
  const [searchPopupOpen, setSearchPopupOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    if (!searchPopupOpen) return;
    const t = window.setTimeout(() => searchInputRef.current?.focus(), 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchPopupOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [searchPopupOpen]);

  const openSearchPopup = () => {
    try {
      const raw = localStorage.getItem("bmb_dining_recent_searches");
      const parsed = raw ? JSON.parse(raw) : [];
      setRecentSearches(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(0, 6) : []);
    } catch {
      setRecentSearches([]);
    }
    setSearchDraft("");
    setSearchPopupOpen(true);
  };

  const commitDiningSearch = (raw: string) => {
    const next = raw.trim();
    if (!next) return;
    try {
      const updated = [next, ...recentSearches.filter((t) => t.toLowerCase() !== next.toLowerCase())].slice(0, 6);
      localStorage.setItem("bmb_dining_recent_searches", JSON.stringify(updated));
      setRecentSearches(updated);
    } catch {
      // ignore
    }
    setSearchPopupOpen(false);
    const params = new URLSearchParams({ search: next });
    if (city && city !== "All Cities") params.set("city", city);
    router.push(`/search?${params.toString()}`);
  };

  useLayoutEffect(() => {
    const el = bmsHeaderRef.current;
    if (!el) return;
    const measure = () => {
      const h = Math.round(el.getBoundingClientRect().height);
      if (h > 0) setBmsHeaderHeight((prev) => (prev === h ? prev : h));
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Load the active city from params or localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncCity = () => {
      const cityParam = searchParams.get("city") || localStorage.getItem("selected_city") || "";
      setCity(cityParam);
    };
    syncCity();
    window.addEventListener("selected_city_changed", syncCity);
    return () => window.removeEventListener("selected_city_changed", syncCity);
  }, [searchParams]);

  const { data: collections = [], isLoading } = useGetCollectionsQuery();

  return (
    <div className="min-h-screen bg-white lg:pt-4 pb-16">
      {/* ── Mobile / tablet: BMS frosted chrome ── */}
      <div
        ref={bmsHeaderRef}
        className="bmb-movies-frost-chrome lg:hidden fixed top-0 inset-x-0 z-40"
        style={{ paddingTop: "max(0px, env(safe-area-inset-top, 0px))" }}
      >
        <div
          className="bmb-movies-frost-chrome__glass"
          aria-hidden
          style={{
            background: "rgba(255,255,255,0.55)",
            WebkitBackdropFilter: "blur(18px) saturate(180%)",
            backdropFilter: "blur(18px) saturate(180%)",
          }}
        />
        <div className="bmb-movies-frost-chrome__fade" aria-hidden />
        <div className="bmb-movies-frost-chrome__content">
          <div className="flex items-center gap-1 px-2 sm:px-3 pt-2 pb-2 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) router.back();
                else router.push("/dining");
              }}
              aria-label="Back"
              className="flex size-10 shrink-0 items-center justify-center text-[#111111] cursor-pointer"
            >
              <ArrowLeft size={22} strokeWidth={2.25} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-[16px] sm:text-[17px] font-bold text-[#111111] leading-tight truncate drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]">
                Collections
              </h1>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("open_city_select"))}
                className="mt-0.5 inline-flex max-w-full items-center gap-1 text-[12px] sm:text-[13px] font-medium text-[#6B7280] hover:text-[#6900AA] cursor-pointer"
              >
                <span className="truncate">
                  {city && city !== "All Cities" ? city : "Select City"} |{" "}
                  {isLoading
                    ? "…"
                    : `${collections.length} Collection${collections.length === 1 ? "" : "s"}`}
                </span>
              </button>
            </div>
            <button
              type="button"
              onClick={openSearchPopup}
              aria-label="Search"
              className="flex size-10 shrink-0 items-center justify-center text-[#111111] cursor-pointer"
            >
              <Search size={20} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
      <div
        className="lg:hidden shrink-0 pointer-events-none"
        style={{ height: Math.max(bmsHeaderHeight, 48) }}
        aria-hidden
      />

      <div className="bmb-section-container pt-2 lg:pt-0">
        {/* ── Hero Header Section ─────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-8 md:p-12 text-white shadow-xl relative overflow-hidden mb-6 sm:mb-7 border border-slate-750">
          {/* Subtle design element */}
          <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80)" }} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_120%,rgba(244,63,94,0.15),transparent_60%)]" />

          <div className="relative z-10 max-w-3xl">
            <span className="text-rose-400 text-xs font-black uppercase tracking-[0.25em] block mb-2">
              Curated Guides
            </span>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-none tracking-tight mb-4">
              Handpicked Collections{city && city !== "All Cities" ? ` in ${city}` : ""}
            </h1>
            <p className="text-white/70 text-sm md:text-base font-medium leading-relaxed max-w-xl">
              Explore custom lists of premium establishments, trendy cafes, hidden gems, and romantic setups. Verified by experts to make your next dining plan flawless.
            </p>
          </div>
        </div>

        {/* ── Collections Grid ────────────────────────────────────────────── */}
        {isLoading ? (
          <CollectionsShimmer count={8} />
        ) : collections.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm p-8 max-w-md mx-auto">
            <div className="text-5xl mb-4">📚</div>
            <h3 className="text-lg font-bold text-slate-700">No collections found</h3>
            <p className="text-slate-400 text-xs mt-1">Please seed collections in database or try again later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {collections.map((collection) => {
              const placesCount = collection.places_count !== undefined 
                ? `${collection.places_count} Place${collection.places_count !== 1 ? 's' : ''}`
                : collection.subtitle || "0 Places";

              return (
                <Link
                  key={collection.id}
                  href={`/search?collection=${collection.slug}${city && city !== "All Cities" ? `&city=${encodeURIComponent(city)}` : ""}`}
                  className="relative group h-80 rounded-2xl overflow-hidden cursor-pointer shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1.5 block border border-slate-100/50 bg-slate-100"
                >
                  <img
                    src={resolveMediaUrl(collection.image_url) || "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80"}
                    alt={collection.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80";
                    }}
                  />
                  {/* Neutral dark scrim — keeps title readable without colored tints */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                  
                  {/* Content container */}
                  <div className="absolute inset-0 flex flex-col justify-end p-5 select-none">
                    <span className="inline-block self-start text-[9px] font-black uppercase bg-white/20 backdrop-blur-sm text-white px-2 py-0.5 rounded-md mb-2 tracking-wider">
                      {placesCount}
                    </span>
                    <h3 className="text-white font-extrabold text-lg leading-tight tracking-tight">
                      {collection.title}
                    </h3>
                    <p className="text-white/80 text-xs font-semibold mt-1 truncate">
                      {collection.subtitle || "Curated local favorites"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

      </div>

      {searchPopupOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="dining-search-popup fixed inset-0 z-[220] flex items-start justify-center px-4 pt-[min(18vh,140px)]">
            <button
              type="button"
              aria-label="Close search"
              className="dining-search-popup__backdrop absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
              onClick={() => setSearchPopupOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Search dining"
              className="dining-search-popup__panel relative w-full max-w-[560px] bg-white rounded-2xl shadow-[0_18px_50px_rgba(15,23,42,0.18)] overflow-hidden"
            >
              <div className="flex items-center gap-3 px-5 sm:px-6 py-4 sm:py-[1.15rem]">
                <Search size={20} strokeWidth={1.75} className="text-slate-500 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitDiningSearch(searchDraft);
                    }
                  }}
                  placeholder="What are you looking for?"
                  className="flex-1 min-w-0 bg-transparent text-[15px] sm:text-base text-slate-800 placeholder:text-slate-400 outline-none"
                  aria-label="Search dining"
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

              <div className="dining-search-popup__results border-t border-slate-100 max-h-[min(52vh,420px)] overflow-y-auto">
                <div className="px-5 sm:px-6 pt-4 pb-5">
                  {searchDraft.trim() ? (
                    (() => {
                      const term = searchDraft.trim().toLowerCase();
                      const matched = collections.filter((c) =>
                        `${c.title} ${c.subtitle || ""}`.toLowerCase().includes(term)
                      );
                      return (
                        <>
                          <p className="text-[15px] font-bold text-slate-900 mb-2">Collections</p>
                          {matched.length > 0 ? (
                            <ul className="divide-y divide-slate-100 mb-3">
                              {matched.slice(0, 6).map((c) => (
                                <li key={c.id}>
                                  <Link
                                    href={`/search?collection=${c.slug}${city && city !== "All Cities" ? `&city=${encodeURIComponent(city)}` : ""}`}
                                    onClick={() => setSearchPopupOpen(false)}
                                    className="flex items-center gap-3 py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded-xl transition-colors"
                                  >
                                    <span className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-slate-100">
                                      <img
                                        src={resolveMediaUrl(c.image_url) || "https://images.unsplash.com/photo-1544025162-d76694265947?w=200&q=80"}
                                        alt=""
                                        className="h-full w-full object-cover"
                                      />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-sm font-semibold text-slate-900 truncate">
                                        {c.title}
                                      </span>
                                      <span className="block text-xs text-slate-500 truncate">
                                        {c.subtitle || "Curated collection"}
                                      </span>
                                    </span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => commitDiningSearch(searchDraft)}
                            className="w-full text-left rounded-xl bg-slate-50 hover:bg-slate-100 px-3.5 py-2.5 text-sm font-semibold text-[#6900AA] cursor-pointer"
                          >
                            Search restaurants for &ldquo;{searchDraft.trim()}&rdquo;
                          </button>
                        </>
                      );
                    })()
                  ) : (
                    <>
                      <p className="text-[15px] font-bold text-slate-900 mb-2">Recent Searches</p>
                      {recentSearches.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {recentSearches.map((term) => (
                            <button
                              key={term}
                              type="button"
                              onClick={() => commitDiningSearch(term)}
                              className="rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 cursor-pointer"
                            >
                              {term}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400 py-1">No recent searches yet</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default function CollectionsPage() {
  return (
    <Suspense fallback={<CollectionsShimmer count={8} />}>
      <CollectionsContent />
    </Suspense>
  );
}
