"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, X } from "lucide-react";
import {
  useGetPublicArtistDirectoryQuery,
  useGetPublicVenuesPagedQuery,
  type PublicRegisteredPartner,
} from "@/services/api";
import { PartnerCard } from "@/components/Shared/PartnerDirectorySection";
import ListingNoResultsState from "@/components/Shared/ListingNoResultsState";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { artistHref, venueHref } from "@/lib/businessPublicPath";

type PartnerListingKind = "artist" | "venue";

const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 350;
const GRID_CLASS =
  "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5";

function useDebouncedValue(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function CardShimmer({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-[1.75rem] overflow-hidden bg-[#E5E7EB] animate-pulse min-h-[340px] sm:min-h-[380px]"
        />
      ))}
    </>
  );
}

export default function PartnerListingPage({ kind }: { kind: PartnerListingKind }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  /** Header city when set; empty means show all partners. */
  const [city, setCity] = useState("");
  const bmsHeaderRef = useRef<HTMLDivElement | null>(null);
  const searchPopupInputRef = useRef<HTMLInputElement | null>(null);
  const [bmsHeaderHeight, setBmsHeaderHeight] = useState(56);
  const [searchPopupOpen, setSearchPopupOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const recentStorageKey = kind === "artist" ? "bmb_recent_artist_searches" : "bmb_recent_venue_searches";
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const openSearchPopup = useCallback(() => {
    setSearchDraft(q);
    try {
      const raw = localStorage.getItem(recentStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setRecentSearches(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(0, 6) : []);
    } catch {
      setRecentSearches([]);
    }
    setSearchPopupOpen(true);
  }, [q, recentStorageKey]);

  const commitPopupSearch = useCallback(
    (raw: string) => {
      const next = raw.trim();
      setQ(next);
      if (next) {
        try {
          const updated = [next, ...recentSearches.filter((t) => t.toLowerCase() !== next.toLowerCase())].slice(0, 6);
          localStorage.setItem(recentStorageKey, JSON.stringify(updated));
          setRecentSearches(updated);
        } catch {
          // ignore storage errors
        }
      }
      setSearchPopupOpen(false);
    },
    [recentSearches, recentStorageKey]
  );

  useEffect(() => {
    if (!searchPopupOpen) return;
    const t = window.setTimeout(() => searchPopupInputRef.current?.focus(), 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchPopupOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [searchPopupOpen]);

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

  useEffect(() => {
    const applyCity = () => {
      const stored = localStorage.getItem("selected_city") || "";
      setCity(stored && stored !== "All Cities" ? stored : "");
    };
    applyCity();
    window.addEventListener("selected_city_changed", applyCity);
    window.addEventListener("storage", applyCity);
    return () => {
      window.removeEventListener("selected_city_changed", applyCity);
      window.removeEventListener("storage", applyCity);
    };
  }, []);

  const searchTerm = useDebouncedValue(q.trim(), SEARCH_DEBOUNCE_MS);
  const cityTerm = useDebouncedValue(city.trim(), SEARCH_DEBOUNCE_MS);
  const filterKey = `${searchTerm}|${cityTerm}`;

  /** Page is tied to the filters it was loaded for, so a new search starts at page 1. */
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  const page = paging.key === filterKey ? paging.page : 1;

  const queryArgs = {
    q: searchTerm || undefined,
    city: cityTerm || undefined,
    page,
    limit: PAGE_LIMIT,
  };
  const venuesQuery = useGetPublicVenuesPagedQuery(queryArgs, { skip: kind !== "venue" });
  const artistsQuery = useGetPublicArtistDirectoryQuery(queryArgs, { skip: kind !== "artist" });
  const { currentData, isFetching, isError, refetch } =
    kind === "artist" ? artistsQuery : venuesQuery;

  /** Loaded pages for the current filters; reset whenever the filters change. */
  const [pages, setPages] = useState<{ key: string; byPage: Record<number, PublicRegisteredPartner[]> }>(
    { key: filterKey, byPage: {} }
  );

  // Stash each page as it arrives (render-time update, guarded so it runs once per response).
  if (currentData && (pages.key !== filterKey || pages.byPage[page] !== currentData.items)) {
    setPages({
      key: filterKey,
      byPage: {
        ...(pages.key === filterKey ? pages.byPage : {}),
        [page]: currentData.items,
      },
    });
  }

  const partners = useMemo(() => {
    if (pages.key !== filterKey) return [];
    const seen = new Set<string>();
    const out: PublicRegisteredPartner[] = [];
    for (let p = 1; p <= page; p += 1) {
      for (const item of pages.byPage[p] ?? []) {
        const id = String(item.id);
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(item);
      }
    }
    return out;
  }, [pages, filterKey, page]);

  const hasNext = Boolean(currentData?.meta.has_next);
  const initialLoading = partners.length === 0 && (isFetching || !currentData) && !isError;
  const loadingMore = partners.length > 0 && isFetching;

  const loadMore = useCallback(() => {
    setPaging({ key: filterKey, page: page + 1 });
  }, [filterKey, page]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNext || isFetching || isError) return;
    if (typeof IntersectionObserver === "undefined") return;
    // Recreated after every page so a sentinel that is still on screen triggers the next load.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNext, isFetching, isError, loadMore, partners.length]);

  const plural = kind === "artist" ? "artists" : "venues";
  const searchPlaceholder =
    kind === "artist"
      ? "Search artists by name, type, or city…"
      : "Search venues by name, type, or city…";
  const hasSearchOrFilter = Boolean(q.trim() || city.trim());
  const clearFilters = () => {
    setQ("");
    setCity("");
  };

  const totalCount = currentData?.meta?.total ?? partners.length;
  const singular = kind === "artist" ? "Artist" : "Venue";

  return (
    <div className="min-h-screen bg-white">
      {/* ── Mobile / tablet: BMS frosted chrome (matches Movies / Events / Dining) ── */}
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
              onClick={() => router.push("/")}
              aria-label="Back to home"
              className="flex size-10 shrink-0 items-center justify-center text-[#111111] cursor-pointer"
            >
              <ArrowLeft size={22} strokeWidth={2.25} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-[16px] sm:text-[17px] font-bold text-[#111111] leading-tight truncate drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]">
                {kind === "artist" ? "Artists" : "Venues"}
              </h1>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("open_city_select"))}
                className="mt-0.5 inline-flex max-w-full items-center gap-1 text-[12px] sm:text-[13px] font-medium text-[#6B7280] hover:text-[#6900AA] cursor-pointer"
              >
                <span className="truncate">
                  {city && city !== "All Cities" ? city : "Select City"} |{" "}
                  {initialLoading
                    ? "…"
                    : `${totalCount} ${singular}${totalCount === 1 ? "" : "s"}`}
                </span>
              </button>
            </div>
            <button
              type="button"
              onClick={openSearchPopup}
              aria-label={`Search ${plural}`}
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

      {q.trim() ? (
        <div className="lg:hidden bmb-section-container pt-2.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#E3BCFF] px-3 py-1 text-xs font-semibold text-[#6900AA]">
            <span>Search: {q.trim()}</span>
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="p-0.5 rounded-full hover:bg-[#F7E9FF] cursor-pointer"
            >
              <X size={12} />
            </button>
          </span>
        </div>
      ) : null}

      <h1 className="sr-only">{kind === "artist" ? "Artists" : "Venues"}</h1>
      <div className="hidden lg:block bg-white border-b border-[#F3E8FF]">
        <div className="bmb-section-container pt-3 pb-3 sm:pt-3.5 sm:pb-3.5">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="w-full h-11 pl-10 pr-9 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-[#6900AA]/40"
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <section id="partners" className="scroll-mt-24 pt-3 sm:pt-3.5 pb-8 md:pb-10">
        <div className="bmb-section-container">
          {initialLoading ? (
            <div className={GRID_CLASS}>
              <CardShimmer count={10} />
            </div>
          ) : isError && partners.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-[#5c5c5c]">We couldn’t load {plural} right now.</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-3 inline-flex rounded-full border border-[#6900AA] px-4 py-2 text-sm font-semibold text-[#6900AA] hover:bg-[#F7E9FF]"
              >
                Try again
              </button>
            </div>
          ) : partners.length === 0 ? (
            <ListingNoResultsState
              kind={plural}
              title={kind === "artist" ? "No artists found" : "No venues found"}
              description={
                hasSearchOrFilter
                  ? q.trim()
                    ? `We couldn’t find any ${plural} matching “${q.trim()}”.`
                    : `We couldn’t find any ${plural} in ${city.trim()}. Try clearing filters or searching for another name.`
                  : `No ${plural} to show yet. Check back soon.`
              }
              actionLabel={hasSearchOrFilter ? "Clear filters" : undefined}
              onAction={hasSearchOrFilter ? clearFilters : undefined}
            />
          ) : (
            <>
              <div className={GRID_CLASS}>
                {partners.map((p) => (
                  <PartnerCard key={p.id} partner={p} kind={kind} />
                ))}
                {loadingMore ? <CardShimmer count={5} /> : null}
              </div>

              <div ref={sentinelRef} aria-hidden className="h-px w-full" />

              {isError ? (
                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="inline-flex rounded-full border border-[#6900AA] px-4 py-2 text-sm font-semibold text-[#6900AA] hover:bg-[#F7E9FF]"
                  >
                    Couldn’t load more — try again
                  </button>
                </div>
              ) : (
                <p className="sr-only" aria-live="polite">
                  {loadingMore ? `Loading more ${plural}` : ""}
                </p>
              )}
            </>
          )}
        </div>
      </section>

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
              aria-label={`Search ${plural}`}
              className="dining-search-popup__panel relative w-full max-w-[560px] bg-white rounded-2xl shadow-[0_18px_50px_rgba(15,23,42,0.18)] overflow-hidden"
            >
              <div className="flex items-center gap-3 px-5 sm:px-6 py-4 sm:py-[1.15rem]">
                <Search size={20} strokeWidth={1.75} className="text-slate-500 shrink-0" />
                <input
                  ref={searchPopupInputRef}
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  value={searchDraft}
                  onChange={(e) => {
                    setSearchDraft(e.target.value);
                    setQ(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitPopupSearch(searchDraft);
                    }
                  }}
                  placeholder="What are you looking for?"
                  className="flex-1 min-w-0 bg-transparent text-[15px] sm:text-base text-slate-800 placeholder:text-slate-400 outline-none"
                  aria-label={`Search ${plural}`}
                />
                {searchDraft ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchDraft("");
                      setQ("");
                      searchPopupInputRef.current?.focus();
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
                    <>
                      <p className="text-[15px] font-bold text-slate-900 mb-2">
                        {kind === "artist" ? "Artists" : "Venues"}
                      </p>
                      {isFetching && partners.length === 0 ? (
                        <div className="space-y-2.5 py-2">
                          {Array.from({ length: 3 }).map((_, idx) => (
                            <div key={idx} className="flex items-center gap-3 animate-pulse">
                              <span className="h-11 w-11 shrink-0 rounded-lg bg-slate-100" />
                              <span className="flex-1 space-y-1.5">
                                <span className="block h-3.5 w-2/3 rounded bg-slate-100" />
                                <span className="block h-3 w-1/2 rounded bg-slate-100" />
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : partners.length > 0 ? (
                        <ul className="divide-y divide-slate-100">
                          {partners.slice(0, 8).map((p) => (
                            <li key={p.id}>
                              <Link
                                href={kind === "artist" ? artistHref(p) : venueHref(p)}
                                onClick={() => setSearchPopupOpen(false)}
                                className="flex items-center gap-3 py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded-xl transition-colors"
                              >
                                <span className="h-11 w-11 shrink-0 rounded-lg overflow-hidden bg-slate-100">
                                  {p.cover_image_url ? (
                                    <img
                                      src={resolveMediaUrl(p.cover_image_url)}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  ) : null}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-semibold text-slate-900 truncate">
                                    {p.name}
                                  </span>
                                  <span className="block text-xs text-slate-500 truncate">
                                    {[p.type_name, p.city_name].filter(Boolean).join(" · ") ||
                                      (kind === "artist" ? "Artist" : "Venue")}
                                  </span>
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-500 py-2">
                          No matching {plural} found.
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[15px] font-bold text-slate-900">Recent Searches</p>
                        {recentSearches.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setRecentSearches([]);
                              try {
                                localStorage.removeItem(recentStorageKey);
                              } catch {
                                // ignore
                              }
                            }}
                            className="text-xs font-semibold text-[#6900AA] hover:underline cursor-pointer"
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                      {recentSearches.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {recentSearches.map((term) => (
                            <button
                              key={term}
                              type="button"
                              onClick={() => commitPopupSearch(term)}
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
