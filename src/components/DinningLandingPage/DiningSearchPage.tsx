"use client";
import { useState, useEffect, Suspense, useMemo, type MouseEvent as ReactMouseEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  MapPin,
  Loader2,
  X,
  UtensilsCrossed,
  Bookmark,
  Users,
  Tag,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useGetBusinessesPagedQuery, useGetCollectionsQuery, useGetMoodsQuery, Business } from "@/services/api";
import DiningFiltersBar from "@/components/DinningLandingPage/DiningFiltersBar";
import { formatMoney } from "@/lib/currencyFormat";
import { listingOfferLabel } from "@/lib/diningOffers";
import {
  DEFAULT_DINING_FILTERS,
  DiningFilterState,
  extractCuisines,
} from "@/lib/diningFilters";

const DINING_LIST_LIMIT = 12;

// ─── Sub-components ───────────────────────────────────────────────────────────

function RestaurantCard({ restaurant }: { restaurant: Business }) {
  const getFallbackImageForType = (type?: string) => {
    const lower = type?.toLowerCase() || "";
    if (lower.includes("cafe")) return "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=500&q=80";
    if (lower.includes("bar") || lower.includes("pub")) return "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=500&q=80";
    return "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80";
  };

  const imageSrc = restaurant.cover_image_url || getFallbackImageForType(restaurant.type_name);
  const rating = Number(restaurant.rating || 4.2).toFixed(1);
  const cuisine =
    restaurant.cuisine ||
    restaurant.type_name ||
    "Italian, Chinese, Continental";
  const cuisineLine = cuisine
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" • ");

  const getLocality = (addr: string) => {
    const parts = addr.split(",");
    if (parts.length >= 2) {
      return `${parts[0].trim()}, ${parts[1].trim()}`;
    }
    return addr;
  };

  const idHash =
    typeof restaurant.id === "number"
      ? restaurant.id
      : restaurant.id
        ? restaurant.id.toString().split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
        : 0;

  const priceForTwo = restaurant.average_cost
    ? `${formatMoney(restaurant.average_cost, { compact: true })} for two`
    : (() => {
        const bases = [1200, 1500, 2000, 2400, 1800];
        return `${formatMoney(bases[idHash % bases.length], { compact: true })} for two`;
      })();

  const distance = (() => {
    const dists = [4.9, 3.5, 5.0, 2.8, 6.2];
    return `${dists[idHash % dists.length]} km away`;
  })();

  const isPromoted = !!restaurant.is_promoted;
  const offerLabel = listingOfferLabel(restaurant.dining_offers);

  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("dining_saved_restaurants");
      const ids: string[] = raw ? JSON.parse(raw) : [];
      setSaved(ids.includes(String(restaurant.id)));
    } catch {
      setSaved(false);
    }
  }, [restaurant.id]);

  const toggleSave = (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const raw = localStorage.getItem("dining_saved_restaurants");
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const id = String(restaurant.id);
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
      localStorage.setItem("dining_saved_restaurants", JSON.stringify(next));
      setSaved(next.includes(id));
    } catch {
      setSaved((v) => !v);
    }
  };

  return (
    <div className="group flex h-full flex-col bg-[#F5F5F5] rounded-2xl border border-[#E5E5E5] shadow-sm hover:shadow-xl transition-shadow duration-300 p-3">
      <div className="relative h-52 sm:h-56 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
        <Link href={`/restaurant/${restaurant.id}`} className="absolute inset-0 block">
          <img
            src={imageSrc}
            alt={restaurant.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent pointer-events-none" />
        </Link>

        {isPromoted && (
          <span className="absolute top-3 left-3 z-[1] bg-white/80 text-[#6900AA] text-xs font-semibold px-2.5 py-1 rounded-md shadow-sm">
            Promoted
          </span>
        )}

        <button
          type="button"
          onClick={toggleSave}
          aria-label={saved ? "Remove from saved" : "Save restaurant"}
          aria-pressed={saved}
          className="absolute top-3 right-3 z-[2] w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <Bookmark
            size={18}
            className={saved ? "fill-[#6900AA] text-[#6900AA]" : "fill-none text-[#6900AA]"}
            strokeWidth={2.25}
          />
        </button>

        {offerLabel && (
          <span
            className="absolute bottom-3 left-3 z-[1] inline-flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full text-[#9F1239] text-xs font-bold px-3 py-1.5 shadow-md pointer-events-none"
            style={{
              background: "linear-gradient(90deg, #FFF1F2 0%, #FFE4E6 45%, #FECDD3 100%)",
            }}
          >
            <Tag
              size={13}
              className="shrink-0 fill-[#9F1239] text-[#9F1239]"
              strokeWidth={0}
            />
            <span className="truncate">{offerLabel}</span>
          </span>
        )}
      </div>

      <Link
        href={`/restaurant/${restaurant.id}`}
        className="flex flex-col flex-1 px-0.5 pt-3.5 pb-1 min-w-0 min-h-0 bg-[#F5F5F5]"
      >
        <div className="flex justify-between items-start gap-2 mb-2">
          <h3 className="font-bold text-[#292929] text-lg sm:text-xl leading-tight truncate flex-1 group-hover:text-[#6900AA] transition-colors">
            {restaurant.name}
          </h3>
          <div className="shrink-0 inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-1.5 py-0.5 rounded-md">
            <span className="text-[10px]">★</span>
            <span>{rating}+</span>
          </div>
        </div>

        <div className="space-y-1.5 text-sm text-[#292929]">
          <p className="flex items-center gap-1.5 min-w-0">
            <UtensilsCrossed size={14} className="shrink-0 text-[#6900AA]" />
            <span className="truncate font-medium">{cuisineLine}</span>
          </p>
          <div className="flex items-start justify-between gap-2 min-w-0">
            <p className="flex items-center gap-1.5 min-w-0 flex-1">
              <MapPin size={14} className="shrink-0 text-[#6900AA]" />
              <span className="truncate font-medium">{getLocality(restaurant.address)}</span>
            </p>
            <span className="shrink-0 font-medium whitespace-nowrap text-[#292929]">{distance}</span>
          </div>
          <p className="flex items-center gap-1.5 min-w-0">
            <Users size={14} className="shrink-0 text-[#6900AA]" />
            <span className="truncate font-medium">{priceForTwo}</span>
          </p>
        </div>

        <div className="mt-auto pt-7 w-full">
          <span
            className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-[#6900AA] bg-[#F5F5F5] px-3.5 py-2.5 text-sm font-semibold text-[#6900AA] group-hover:bg-[#EFEFEF] transition-colors [transform:translateZ(0)] [backface-visibility:hidden]"
          >
            <span>View Booking</span>
            <ArrowRight size={16} className="shrink-0" />
          </span>
        </div>
      </Link>
    </div>
  );
}

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

  const [diningFilters, setDiningFilters] = useState<DiningFilterState>(DEFAULT_DINING_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadedRestaurants, setLoadedRestaurants] = useState<Business[]>([]);

  const { data: businessesData, isLoading: loadingBusinesses, isFetching: loadingMore } = useGetBusinessesPagedQuery({
    collection: collectionParam || undefined,
    mood: moodParam || undefined,
    q: queryParam || undefined,
    city: cityParam && cityParam !== "All Cities" ? cityParam : undefined,
    cuisines: diningFilters.cuisines.length > 0 ? diningFilters.cuisines : undefined,
    min_rating: diningFilters.minRating > 0 ? diningFilters.minRating : undefined,
    offers_only: diningFilters.offersOnly || undefined,
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

  const filteredRestaurants = loadedRestaurants;

  useEffect(() => {
    setCurrentPage(1);
    setLoadedRestaurants([]);
  }, [collectionParam, moodParam, queryParam, cityParam, diningFilters]);

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
  }, [businessesData, currentPage]);

  const hasMoreRestaurants = Boolean(businessesData?.meta?.has_next);
  const isLoadingMore = loadingMore && currentPage > 1;

  // Calculate dynamic banner styling
  const getBannerDetails = () => {
    if (activeCollection) {
      return {
        title: activeCollection.title,
        subtitle: activeCollection.subtitle || "Curated list of premium spots",
        image: activeCollection.image_url || "https://images.unsplash.com/photo-1544025162-d76694265947?w=1600&q=80",
        gradient: activeCollection.color_gradient || "from-rose-900/80",
      };
    }
    if (activeMood) {
      return {
        title: activeMood.title,
        subtitle: "Satisfy your cravings today",
        image: activeMood.image_url || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1600&q=80",
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
    router.push(`/search?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-6 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ── Breadcrumbs ─────────────────────────────────────────────────── */}
        <div className="text-xs text-slate-400 mb-3 flex items-center gap-1.5 font-medium tracking-wide">
          <Link href="/" className="hover:text-rose-600 transition-colors">Home</Link>
          <span>/</span>
          {cityParam ? (
            <Link href={`/search?city=${cityParam}`} className="capitalize hover:text-rose-600 transition-colors">
              {cityParam}
            </Link>
          ) : (
            <span className="capitalize">All Cities</span>
          )}
          
          {collectionParam && (
            <>
              <span>/</span>
              <Link href="/" className="hover:text-rose-600 transition-colors">Collections</Link>
              <span>/</span>
              <span className="text-slate-500 font-semibold">{banner.title}</span>
            </>
          )}
          {moodParam && (
            <>
              <span>/</span>
              <Link href="/" className="hover:text-rose-600 transition-colors">Cuisines</Link>
              <span>/</span>
              <span className="text-slate-500 font-semibold">{banner.title}</span>
            </>
          )}
          {!collectionParam && !moodParam && queryParam && (
            <>
              <span>/</span>
              <span className="hover:text-slate-650">Search</span>
              <span>/</span>
              <span className="text-slate-500 font-semibold">"{queryParam}"</span>
            </>
          )}
        </div>

        {/* ── 1. Hero Dynamic Banner (Zomato-Style) ───────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-slate-900 text-white h-72 md:h-80 shadow-md flex items-center border border-slate-100/50 mb-8">
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
              {filteredRestaurants.length} Place{filteredRestaurants.length !== 1 ? "s" : ""}
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header stats & quick clear chips */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {cityParam ? `Restaurants in ${cityParam}` : "Discover Restaurants"}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {loadingBusinesses ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 size={14} className="animate-spin text-rose-600" /> Finding restaurants...
                </span>
              ) : (
                `${businessesData?.meta?.total ?? filteredRestaurants.length} venue${(businessesData?.meta?.total ?? filteredRestaurants.length) !== 1 ? "s" : ""} available`
              )}
            </p>
          </div>

          {/* Active filters chips list */}
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

            {(collectionParam || moodParam || queryParam || cityParam) && (
              <button
                onClick={() => router.push("/search")}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold px-2 py-1.5 transition-colors cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        <DiningFiltersBar
          cuisines={cuisineOptions}
          filters={diningFilters}
          onChange={setDiningFilters}
          onReset={() => setDiningFilters(DEFAULT_DINING_FILTERS)}
        />

        {/* ── 3. Listings Grid ─────────────────────────────────────────────── */}
        {loadingBusinesses && loadedRestaurants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3 text-slate-400">
            <Loader2 size={36} className="animate-spin text-rose-600" />
            <p className="text-sm font-semibold">Loading top establishments...</p>
          </div>
        ) : filteredRestaurants.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border border-slate-100 shadow-sm p-8 max-w-xl mx-auto">
            <div className="text-6xl mb-5">🍽️</div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No restaurants found</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              We couldn't find any listings matching your active filters. Try adjusting your query or resetting filters to browse all venues.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => router.push("/search")}
                className="bg-rose-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/20"
              >
                Browse All Venues
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRestaurants.map((restaurant) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} />
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
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Loading...
                    </>
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
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
          <Loader2 size={36} className="animate-spin text-rose-600" />
          <p className="text-sm font-semibold">Loading search space...</p>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
