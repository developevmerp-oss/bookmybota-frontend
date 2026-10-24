"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import {
  useGetPublicArtistDirectoryQuery,
  useGetPublicVenuesPagedQuery,
  type PublicRegisteredPartner,
} from "@/services/api";
import { PartnerCard } from "@/components/Shared/PartnerDirectorySection";
import ListingNoResultsState from "@/components/Shared/ListingNoResultsState";

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
  const [q, setQ] = useState("");
  /** Header city when set; empty means show all partners. */
  const [city, setCity] = useState("");

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

  return (
    <div className="min-h-screen bg-[#faf7fc]">
      <h1 className="sr-only">{kind === "artist" ? "Artists" : "Venues"}</h1>
      <div className="bg-white border-b border-[#F3E8FF]">
        <div className="bmb-section-container py-5 sm:py-6">
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

      <section id="partners" className="scroll-mt-24 py-8 md:py-10">
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
    </div>
  );
}
