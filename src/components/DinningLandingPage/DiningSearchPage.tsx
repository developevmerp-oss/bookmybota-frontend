"use client";
import { useState, useEffect, Suspense, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { useGetBusinessesPagedQuery, useGetCollectionsQuery, useGetMoodsQuery, Business } from "@/services/api";
import DiningFiltersBar from "@/components/DinningLandingPage/DiningFiltersBar";
import DiningRestaurantCardOption2 from "@/components/DinningLandingPage/DiningRestaurantCardOption2";
import {
  DEFAULT_DINING_FILTERS,
  DiningFilterState,
  diningFiltersEqual,
  diningFiltersFromSearchParams,
  extractCuisines,
  writeDiningFiltersToSearchParams,
} from "@/lib/diningFilters";
import { stableSearchParamsString } from "@/lib/filterUrlSync";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { DiningHomeRestaurantShimmer } from "@/components/Shared/Shimmer";
import ListingNoResultsState from "@/components/Shared/ListingNoResultsState";

const DINING_LIST_LIMIT = 12;

// ─── Main Content component inside Suspense ──────────────────────────────────

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleShareCollection = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const collectionParam = searchParams.get("collection") || "";
  const moodParam = searchParams.get("mood") || "";
  const queryParam = searchParams.get("search") || "";
  const cityParam = searchParams.get("city") || "";
  const searchParamsKey = searchParams.toString();
  const [searchInput, setSearchInput] = useState(queryParam);

  const [diningFilters, setDiningFilters] = useState<DiningFilterState>(() =>
    diningFiltersFromSearchParams(searchParams)
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [loadedRestaurants, setLoadedRestaurants] = useState<Business[]>([]);
  // Clear filters navigates to /search. Ignore a stale collection/mood/search/city
  // write that would put the empty collection back on the URL.
  const clearedListingRef = useRef(false);

  useEffect(() => {
    const next = diningFiltersFromSearchParams(searchParams);
    setDiningFilters((prev) => (diningFiltersEqual(prev, next) ? prev : next));
    setSearchInput((prev) => (prev === queryParam ? prev : queryParam));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParamsKey drives URL hydration
  }, [searchParamsKey]);

  useEffect(() => {
    const params = new URLSearchParams();
    const keepContext = !clearedListingRef.current;
    // Preserve listing context keys from the current URL.
    if (keepContext && collectionParam) params.set("collection", collectionParam);
    if (keepContext && moodParam) params.set("mood", moodParam);
    if (keepContext && queryParam) params.set("search", queryParam);
    if (keepContext && cityParam && cityParam !== "All Cities") params.set("city", cityParam);
    writeDiningFiltersToSearchParams(params, diningFilters);
    if (!collectionParam && !moodParam && !queryParam && !(cityParam && cityParam !== "All Cities")) {
      clearedListingRef.current = false;
    }
    if (stableSearchParamsString(params) === stableSearchParamsString(searchParams)) return;
    const qs = params.toString();
    router.replace(qs ? `/search?${qs}` : "/search", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- omit searchParams so inbound URL nav is not overwritten by stale state
  }, [diningFilters, collectionParam, moodParam, queryParam, cityParam, router]);

  const { data: businessesData, isLoading: loadingBusinesses, isFetching: loadingMore } = useGetBusinessesPagedQuery({
    module: "dining",
    collection: collectionParam || undefined,
    mood: moodParam || undefined,
    q: queryParam || undefined,
    city: cityParam && cityParam !== "All Cities" ? cityParam : undefined,
    cuisines: diningFilters.cuisines.length > 0 ? diningFilters.cuisines : undefined,
    min_rating: diningFilters.minRating > 0 ? diningFilters.minRating : undefined,
    offers_only: diningFilters.offersOnly || undefined,
    offer_bucket: diningFilters.offerBucket || undefined,
    pure_veg: diningFilters.pureVeg || undefined,
    serves_alcohol: diningFilters.servesAlcohol || undefined,
    max_cost: diningFilters.maxCost > 0 ? diningFilters.maxCost : undefined,
    sort: diningFilters.sort,
    page: currentPage,
    limit: DINING_LIST_LIMIT,
  });

  const { data: collections = [] } = useGetCollectionsQuery();
  const { data: moods = [] } = useGetMoodsQuery();

  // Find the selected Collection metadata for the banner
  const activeCollection = collections.find((c) => c.slug === collectionParam);
  // Find the selected Mood metadata for the banner
  const activeMood = moods.find((m) => m.query_tag.toLowerCase() === moodParam.toLowerCase());

  const cuisineOptions = useMemo(
    () => extractCuisines(loadedRestaurants),
    [loadedRestaurants]
  );

  const listQueryKey = useMemo(
    () =>
      JSON.stringify({
        collectionParam,
        moodParam,
        queryParam,
        cityParam,
        cuisines: diningFilters.cuisines,
        minRating: diningFilters.minRating,
        offersOnly: diningFilters.offersOnly,
        offerBucket: diningFilters.offerBucket,
        pureVeg: diningFilters.pureVeg,
        servesAlcohol: diningFilters.servesAlcohol,
        maxCost: diningFilters.maxCost,
        sort: diningFilters.sort,
      }),
    [collectionParam, moodParam, queryParam, cityParam, diningFilters]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [listQueryKey]);

  useEffect(() => {
    if (!businessesData) return;
    const pageItems = businessesData.items ?? [];
    if (currentPage <= 1) {
      setLoadedRestaurants(pageItems);
      return;
    }
    setLoadedRestaurants((prev) => {
      const seen = new Set(prev.map((r) => r.id));
      const next = pageItems.filter((r) => !seen.has(r.id));
      return next.length ? [...prev, ...next] : prev;
    });
  }, [businessesData, currentPage, listQueryKey]);

  const queryItems = businessesData?.items ?? [];
  // Page 1 always follows the live query so Clear filters cannot leave a wiped list.
  const displayRestaurants = currentPage <= 1 ? queryItems : loadedRestaurants;

  const hasMoreRestaurants = Boolean(businessesData?.meta?.has_next);
  const isLoadingMore = loadingMore && currentPage > 1;

  // Calculate dynamic banner styling
  const getBannerDetails = () => {
    if (activeCollection) {
      return {
        title: activeCollection.title,
        subtitle: activeCollection.subtitle || "Curated list of premium spots",
        image: resolveMediaUrl(activeCollection.image_url) || "https://images.unsplash.com/photo-1544025162-d76694265947?w=1600&q=80",
        gradient: activeCollection.color_gradient || "from-rose-900/80",
      };
    }
    if (activeMood) {
      return {
        title: activeMood.title,
        subtitle: "Satisfy your cravings today",
        image: resolveMediaUrl(activeMood.image_url) || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1600&q=80",
        gradient: "from-amber-900/80",
      };
    }
    if (queryParam) {
      return {
        title: `Search: "${queryParam}"`,
        subtitle: `Discovered restaurants for "${queryParam}"`,
        image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=1600&q=80",
        gradient: "from-sky-950/80",
      };
    }
    return {
      title: "All Restaurants",
      subtitle: "Find your next dining table",
      image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=1600&q=80",
      gradient: "from-slate-900/80",
    };
  };

  const banner = getBannerDetails();

  const handleClearFilter = (key: "collection" | "mood" | "search" | "city") => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : "/search");
  };

  const clearListingFilters = () => {
    clearedListingRef.current = true;
    setDiningFilters(DEFAULT_DINING_FILTERS);
    setSearchInput("");
    setCurrentPage(1);
    router.push("/search");
  };

  const applySearch = (value: string) => {
    const next = value.trim();
    setSearchInput(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("search", next);
    else params.delete("search");
    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : "/search");
  };

  const hasQuickFilters = Boolean(collectionParam || moodParam || queryParam || cityParam);

  return (
    <div className="min-h-screen bg-slate-50 pt-4 pb-16">
      <div className="bmb-section-container">
        {/* ── 1. Hero Dynamic Banner (Zomato-Style) ───────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-slate-900 text-white h-72 md:h-80 shadow-md flex items-center border border-slate-100/50 mb-4">
          {/* Background image */}
          <img
            src={banner.image}
            alt={banner.title}
            className="absolute inset-0 w-full h-full object-cover opacity-90"
          />
          {/* Subtle overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/10 to-transparent" />
          
          {/* Left Overlay Info Box (Zomato bottom-left aligned) */}
          <div className="absolute bottom-0 left-0 z-10 bg-black/20 backdrop-blur-md border-t border-r border-white/10 rounded-tr-3xl p-6 md:p-7 w-full md:w-[560px] shadow-2xl flex flex-col justify-center animate-fadeIn">
            <div>
              <span className="text-[10px] md:text-[11px] font-black tracking-[0.25em] text-rose-400 uppercase block mb-1.5">
                Bota Collections
              </span>
              <h1 className="text-xl md:text-3xl font-extrabold text-white mb-1.5 leading-tight tracking-tight">
                {banner.title}
              </h1>
              <p className="text-white/80 text-xs md:text-[13px] font-medium line-clamp-2 leading-relaxed">
                {banner.subtitle}
              </p>
            </div>
            <span className="text-xs md:text-sm font-bold text-white/95 mt-3 block">
              {businessesData?.meta?.total ?? displayRestaurants.length} Place
              {(businessesData?.meta?.total ?? displayRestaurants.length) !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Top Right Save/Share Actions */}
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            <button
              onClick={handleShareCollection}
              className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/65 backdrop-blur-[4px] border border-white/10 text-white flex items-center justify-center shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="Share link"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </button>
          </div>

          {/* Toast Notification */}
          {copiedUrl && (
            <div className="absolute top-16 right-4 z-20 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xl animate-fadeIn flex items-center gap-2 border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>Collection URL copied to Clipboard</span>
            </div>
          )}
        </div>
      </div>
      
      {/* ── 2. Results and Filters ─────────────────────────────────────────── */}
      <div className="bmb-section-container">
        
        {/* Header stats & quick clear chips */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {cityParam ? `Restaurants in ${cityParam}` : "Discover Restaurants"}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {loadingBusinesses ? (
                <span
                  className="mt-1 inline-block h-3.5 w-36 rounded bg-slate-200 animate-pulse"
                  aria-label="Finding restaurants"
                />
              ) : (
                `${businessesData?.meta?.total ?? displayRestaurants.length} venue${(businessesData?.meta?.total ?? displayRestaurants.length) !== 1 ? "s" : ""} available`
              )}
            </p>
          </div>

          {hasQuickFilters ? (
          <div className="flex flex-wrap items-center gap-2">
            {collectionParam && (
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 text-rose-600 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm">
                <span>Collection: {activeCollection?.title || collectionParam}</span>
                <button
                  onClick={() => handleClearFilter("collection")}
                  className="hover:bg-rose-100 p-0.5 rounded-full transition-colors flex items-center justify-center"
                >
                  <X size={12} className="text-rose-600" />
                </button>
              </div>
            )}

            {moodParam && (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 text-amber-700 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm">
                <span>Mood: {activeMood?.title || moodParam}</span>
                <button
                  onClick={() => handleClearFilter("mood")}
                  className="hover:bg-amber-100 p-0.5 rounded-full transition-colors flex items-center justify-center"
                >
                  <X size={12} className="text-amber-700" />
                </button>
              </div>
            )}

            {queryParam && (
              <div className="flex items-center gap-1.5 bg-sky-50 border border-sky-100 text-sky-600 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm">
                <span>Search: "{queryParam}"</span>
                <button
                  onClick={() => handleClearFilter("search")}
                  className="hover:bg-sky-100 p-0.5 rounded-full transition-colors flex items-center justify-center"
                >
                  <X size={12} className="text-sky-600" />
                </button>
              </div>
            )}

            {cityParam && (
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-650 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm">
                <span>City: {cityParam}</span>
                <button
                  onClick={() => handleClearFilter("city")}
                  className="hover:bg-slate-200 p-0.5 rounded-full transition-colors flex items-center justify-center"
                >
                  <X size={12} className="text-slate-600" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={clearListingFilters}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold px-2 py-1.5 transition-colors cursor-pointer"
            >
              Clear All
            </button>
          </div>
          ) : null}
        </div>

        <div className="mb-4 sm:mb-5 md:mb-6">
          <DiningFiltersBar
            cuisines={cuisineOptions}
            filters={diningFilters}
            onChange={setDiningFilters}
            onReset={() => setDiningFilters(DEFAULT_DINING_FILTERS)}
            showSearch
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            onSearchSubmit={applySearch}
          />
        </div>

        {/* ── 3. Listings Grid ─────────────────────────────────────────────── */}
        {(loadingBusinesses || loadingMore) && displayRestaurants.length === 0 ? (
          <DiningHomeRestaurantShimmer count={8} />
        ) : displayRestaurants.length === 0 ? (
          <ListingNoResultsState
            kind="dining"
            title="No restaurants found"
            description="We couldn’t find any listings matching your active filters. Try clearing filters or searching for another place."
            actionLabel="Clear filters"
            onAction={clearListingFilters}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 w-full">
              {displayRestaurants.map((restaurant) => (
                <DiningRestaurantCardOption2 key={restaurant.id} place={restaurant} />
              ))}
            </div>
            {hasMoreRestaurants && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={isLoadingMore}
                  className="inline-flex items-center justify-center gap-2 min-w-[160px] px-8 py-3 rounded-full bg-[#6900AA] text-white text-sm font-semibold hover:bg-[#57008E] disabled:opacity-60 transition-colors"
                >
                  {isLoadingMore ? (
                    <Loader2 size={16} className="animate-spin" aria-label="Loading more restaurants" />
                  ) : (
                    "Load More"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Entry Point with Suspense Boundary ──────────────────────────────────────

export default function SearchPage() {
  return (
    <Suspense fallback={<DiningHomeRestaurantShimmer count={8} />}>
      <SearchContent />
    </Suspense>
  );
}
