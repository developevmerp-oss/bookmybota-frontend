"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Star, MapPin, Loader2, X, Percent, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useGetBusinessesQuery, useGetCollectionsQuery, useGetMoodsQuery, Business } from "@/services/api";

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
  const cuisine = restaurant.cuisine || "Italian, Chinese, Continental";
  
  const getLocality = (addr: string) => {
    const parts = addr.split(",");
    if (parts.length >= 2) {
      return `${parts[0].trim()}, ${parts[1].trim()}`;
    }
    return addr;
  };

  const idHash = typeof restaurant.id === 'number' 
    ? restaurant.id 
    : (restaurant.id ? restaurant.id.toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0);

  const getPriceForTwo = (id: number) => {
    const bases = [1200, 1500, 2000, 2400, 1800];
    return `₹${bases[id % bases.length]} for two`;
  };

  const getDistance = (id: number) => {
    const dists = [4.9, 3.5, 5.0, 2.8, 6.2];
    return `${dists[id % dists.length]} km`;
  };

  const isPromoted = idHash % 2 === 0;
  const hasDiscount = idHash % 3 === 0 || idHash % 5 === 0;

  return (
    <Link
      href={`/restaurant/${restaurant.id}`}
      className="group block bg-white hover:shadow-xl rounded-2xl p-3 transition-all duration-300 hover:-translate-y-1.5 border border-slate-100/80"
    >
      <div className="relative h-56 rounded-xl overflow-hidden bg-slate-100 mb-3">
        <img
          src={imageSrc}
          alt={restaurant.name}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
        
        {isPromoted && (
          <span className="absolute top-3 left-3 bg-black/40 backdrop-blur-[2px] text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow-sm">
            Promoted
          </span>
        )}

        {hasDiscount && (
          <div className="absolute bottom-3 left-0 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-r-md flex items-center gap-1 shadow-md shadow-blue-900/10">
            <Percent size={11} className="text-white shrink-0" />
            <span>Flat 10% OFF</span>
          </div>
        )}
      </div>

      <div className="px-1.5 pb-1">
        <h3 className="font-bold text-slate-800 text-[18px] leading-tight truncate group-hover:text-rose-600 transition-colors">
          {restaurant.name}
        </h3>
        
        {/* Zomato-style green rating badge + DINING label */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="bg-emerald-700 text-white text-[11px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5">
            <span>{rating}</span>
            <span className="text-[9px]">★</span>
          </span>
          <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">DINING</span>
        </div>

        <div className="flex justify-between items-center gap-4 mt-2 text-[13px] text-slate-500">
          <span className="truncate flex-1 font-medium">{cuisine}</span>
          <span className="shrink-0 font-medium text-slate-700">
            {getPriceForTwo(idHash)}
          </span>
        </div>

        <div className="flex justify-between items-center gap-4 mt-1 text-xs text-slate-400">
          <span className="truncate flex-1 font-medium">{getLocality(restaurant.address)}</span>
          <span className="shrink-0 font-medium">{getDistance(idHash)}</span>
        </div>
      </div>
    </Link>
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

  // Dynamic API calls with active filters
  const { data: businesses = [], isLoading: loadingBusinesses } = useGetBusinessesQuery({
    collection: collectionParam,
    mood: moodParam
  });

  const { data: collections = [] } = useGetCollectionsQuery();
  const { data: moods = [] } = useGetMoodsQuery();

  // Find the selected Collection metadata for the banner
  const activeCollection = collections.find((c) => c.slug === collectionParam);
  // Find the selected Mood metadata for the banner
  const activeMood = moods.find((m) => m.query_tag.toLowerCase() === moodParam.toLowerCase());

  // Client-side filtering for city & search text
  const filteredRestaurants = businesses.filter((r) => {
    const address = r.address || "";
    const name = r.name || "";
    const cuisine = r.cuisine || "";

    const matchesCity = !cityParam || cityParam === "All Cities" || address.toLowerCase().includes(cityParam.toLowerCase());
    const matchesQuery =
      !queryParam ||
      name.toLowerCase().includes(queryParam.toLowerCase()) ||
      cuisine.toLowerCase().includes(queryParam.toLowerCase()) ||
      address.toLowerCase().includes(queryParam.toLowerCase());

    return matchesCity && matchesQuery;
  });

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
                `${filteredRestaurants.length} venue${filteredRestaurants.length !== 1 ? "s" : ""} available`
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

        {/* ── 3. Listings Grid ─────────────────────────────────────────────── */}
        {loadingBusinesses ? (
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRestaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
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
