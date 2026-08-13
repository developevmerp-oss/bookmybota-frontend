"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, MapPin, Star, ArrowRight, ChevronLeft, ChevronRight, Navigation, Loader2, X, Percent } from "lucide-react";
import Link from "next/link";
import { useGetBusinessTypesQuery, useGetBusinessesQuery, useGetCollectionsQuery, useGetMoodsQuery, Business, Collection, Mood } from "@/services/api";
import { useRouter } from "next/navigation";
import DiningFiltersBar from "@/components/DinningLandingPage/DiningFiltersBar";
import { formatMoney } from "@/lib/currencyFormat";
import {
  applyDiningFilters,
  DEFAULT_DINING_FILTERS,
  DiningFilterState,
  extractCuisines,
} from "@/lib/diningFilters";



// ─── Types ────────────────────────────────────────────────────────────────────

interface NominatimResult {
  place_id: number;
  display_name: string;
  address: {
    city?: string;
    town?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

// Nominatim requires a User-Agent — without it requests silently fail (returns error JSON with no address)
const NOMINATIM_HEADERS = {
  "Accept-Language": "en",
  "User-Agent": "BookMyBotaApp/1.0 (table-booking-app)",
};

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
    { headers: NOMINATIM_HEADERS }
  );
  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
  const data = await res.json();
  if (data?.error) throw new Error(data.error);
  const addr = data?.address;
  const city = addr?.city || addr?.town || addr?.county || addr?.suburb || addr?.state;
  if (!city) throw new Error("No city in response");
  return city;
}

// IP-based geolocation fallback — works without GPS permission, always returns city name
async function getLocationByIP(): Promise<string> {
  const res = await fetch("https://ipapi.co/json/", {
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) throw new Error("IP geolocation failed");
  const data = await res.json();
  return data?.city || data?.region || "Your Location";
}

async function searchLocations(query: string): Promise<NominatimResult[]> {
  if (!query.trim()) return [];
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
    { headers: NOMINATIM_HEADERS }
  );
  if (!res.ok) return [];
  return res.json();
}


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
    return `${formatMoney(bases[id % bases.length], { compact: true })} for two`;
  };

  const getDistance = (id: number) => {
    const dists = [4.9, 3.5, 5.0, 2.8, 6.2];
    return `${dists[id % dists.length]} km`;
  };

  const isPromoted = !!restaurant.is_promoted;
  const hasDiscount = idHash % 3 === 0 || idHash % 5 === 0;

  return (
    <Link
      href={`/restaurant/${restaurant.id}`}
      className="group block bg-white hover:shadow-xl rounded-2xl p-3 transition-all duration-300 hover:-translate-y-1.5 border border-slate-100/80"
    >
      <div className="relative h-56 rounded-xl overflow-hidden bg-slate-100 mb-3.5">
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

      <div className="px-1 pb-1">
        <div className="flex justify-between items-start gap-2 mb-1.5">
          <h3 className="font-bold text-slate-800 text-[16px] leading-tight truncate flex-1 group-hover:text-rose-600 transition-colors">
            {restaurant.name}
          </h3>
          <div className="shrink-0 flex items-center gap-0.5 bg-emerald-700 text-white text-[11px] font-black px-1.5 py-0.5 rounded-md shadow-sm">
            <span>{rating}</span>
            <span className="text-[9px]">★</span>
          </div>
        </div>

        <div className="flex justify-between items-center gap-4 mb-1 text-[13px] text-slate-500">
          <span className="truncate flex-1 font-medium">{cuisine}</span>
          <span className="shrink-0 whitespace-nowrap font-medium text-slate-650">
            {getPriceForTwo(idHash)}
          </span>
        </div>

        <div className="flex justify-between items-center gap-4 text-xs text-slate-400">
          <span className="truncate flex-1 font-medium">{getLocality(restaurant.address)}</span>
          <span className="shrink-0 whitespace-nowrap font-medium">{getDistance(idHash)}</span>
        </div>
      </div>
    </Link>
  );
}

function CollectionCard({ collection }: { collection: Collection }) {
  const subtitle = collection.places_count !== undefined 
    ? `${collection.places_count} place${collection.places_count !== 1 ? 's' : ''}`
    : collection.subtitle || "0 places";

  return (
    <Link
      href={`/search?collection=${collection.slug}`}
      className="relative shrink-0 w-48 h-56 rounded-2xl overflow-hidden cursor-pointer group shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 block"
    >
      <img
        src={collection.image_url || "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80"}
        alt={collection.title}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        onError={(e) => {
          (e.target as HTMLImageElement).src =
            "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80";
        }}
      />
      <div className={`absolute inset-0 bg-gradient-to-t ${collection.color_gradient || 'from-rose-900/80'} to-transparent`} />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className="text-white font-bold text-base leading-tight">{collection.title}</h3>
        <p className="text-white/70 text-xs mt-1">{subtitle}</p>
      </div>
    </Link>
  );
}

// ─── Location Dropdown ────────────────────────────────────────────────────────

interface LocationDropdownProps {
  onSelect: (city: string) => void;
  onDetect: () => void;
  detecting: boolean;
  onClose: () => void;
}

function LocationDropdown({ onSelect, onDetect, detecting, onClose }: LocationDropdownProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchLocations(val);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const extractCity = (result: NominatimResult) => {
    const addr = result.address;
    return addr.city || addr.town || addr.county || addr.state || result.display_name.split(",")[0];
  };

  return (
    <div className="absolute top-full left-0 mt-2 w-full md:w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
      {/* Use Current Location */}
      <button
        onClick={onDetect}
        disabled={detecting}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-rose-50 transition-colors text-left border-b border-slate-100 group disabled:opacity-60"
      >
        <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0 group-hover:bg-rose-200 transition-colors">
          {detecting ? (
            <Loader2 size={16} className="text-rose-600 animate-spin" />
          ) : (
            <Navigation size={16} className="text-rose-600" />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {detecting ? "Detecting your location..." : "Use My Current Location"}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Auto-detect via GPS</p>
        </div>
      </button>

      {/* Search Input */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search city or area..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
          {searching && <Loader2 size={14} className="text-slate-400 animate-spin shrink-0" />}
          {query && !searching && (
            <button onClick={() => { setQuery(""); setSuggestions([]); }} className="text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Suggestions */}
      <div className="max-h-60 overflow-y-auto">
        {suggestions.length > 0 ? (
          suggestions.map((s) => (
            <button
              key={s.place_id}
              onClick={() => { onSelect(extractCity(s)); onClose(); }}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors text-left"
            >
              <MapPin size={14} className="text-rose-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-800">{extractCity(s)}</p>
                <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{s.display_name}</p>
              </div>
            </button>
          ))
        ) : query && !searching ? (
          <div className="px-5 py-6 text-center text-sm text-slate-400">No locations found</div>
        ) : !query ? (
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Popular Cities</p>
            {["Mumbai", "Delhi", "Bengaluru", "Ahmedabad", "Pune", "Hyderabad"].map((city) => (
              <button
                key={city}
                onClick={() => { onSelect(city); onClose(); }}
                className="w-full flex items-center gap-3 py-2.5 hover:text-rose-600 transition-colors text-left"
              >
                <MapPin size={13} className="text-slate-300 shrink-0" />
                <span className="text-sm text-slate-600">{city}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [diningFilters, setDiningFilters] = useState<DiningFilterState>(DEFAULT_DINING_FILTERS);

  const collectionsRef = useRef<HTMLDivElement>(null);

  const scrollCollections = (direction: 'left' | 'right') => {
    if (collectionsRef.current) {
      const cardWidth = 192; // w-48 = 192px
      const gap = 16; // gap-4 = 16px
      const scrollAmount = cardWidth + gap;
      collectionsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleSearchSubmit = () => {
    setSearchQuery(searchInput);
  };

  const handleMoodSelect = (query: string) => {
    const params = new URLSearchParams();
    params.set("mood", query);
    if (locationCity) {
      params.set("city", locationCity);
    }
    router.push(`/search?${params.toString()}`);
  };

  // Read initial search/filter/city from URL query params.
  // Default to All Cities so Dining always shows the full discovery UI
  // (landing page city like Bahir Dar must not hide all restaurants).
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const filterParam = params.get('filter');
      const cityParam = params.get('city');
      const searchParam = params.get('search');

      if (filterParam) {
        setActiveFilter(filterParam);
      }
      if (cityParam && cityParam !== "All Cities") {
        setLocationCity(cityParam);
        setLocationLabel(cityParam);
        localStorage.setItem('selected_city', cityParam);
        window.dispatchEvent(new Event('selected_city_changed'));
      } else {
        setLocationCity("");
        setLocationLabel("All Cities");
        localStorage.removeItem('selected_city');
        window.dispatchEvent(new Event('selected_city_changed'));
      }
      if (searchParam) {
        setSearchQuery(searchParam);
        setSearchInput(searchParam);
      }
    }
  }, []);

  const { data: businessTypes = [] } = useGetBusinessTypesQuery();
  const { data: businesses = [], isLoading: businessesLoading } = useGetBusinessesQuery();
  const { data: collections = [] } = useGetCollectionsQuery();
  const { data: moods = [] } = useGetMoodsQuery();

  const getEmojiForBusinessType = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("restaurant")) return "🍽️";
    if (lower.includes("cafe")) return "☕";
    if (lower.includes("bar") || lower.includes("pub") || lower.includes("lounge") || lower.includes("club")) return "🍺";
    return "🍽️";
  };

  const filters = [
    { label: "All", emoji: "🍽️" },
    ...(businessTypes.length > 0
      ? businessTypes.map((t) => ({
        label: t.name,
        emoji: getEmojiForBusinessType(t.name),
      }))
      : [
        { label: "Restaurant", emoji: "🍽️" },
        { label: "Cafe", emoji: "☕" },
        { label: "Bar", emoji: "🍺" },
      ]),
  ];

  // ── Location state ──
  const [locationLabel, setLocationLabel] = useState("All Cities");
  const [locationCity, setLocationCity] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationRef = useRef<HTMLDivElement>(null);

  // ── Auto-detect on mount ──
  const detectCurrentLocation = useCallback(async () => {
    setLocationLoading(true);
    setLocationError(false);
    setLocationLabel("Detecting...");

    // Helper to apply result to state
    const applyCity = (city: string) => {
      setLocationLabel(city);
      setLocationCity(city);
      setLocationError(false);
      localStorage.setItem('selected_city', city);
      window.dispatchEvent(new Event('selected_city_changed'));
    };

    // If browser doesn't support geolocation → fall back to IP immediately
    if (!navigator.geolocation) {
      try {
        const city = await getLocationByIP();
        applyCity(city);
      } catch {
        setLocationLabel("Select Location");
        setLocationError(true);
      } finally {
        setLocationLoading(false);
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // GPS success → reverse geocode with Nominatim
        try {
          const city = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          applyCity(city);
        } catch {
          // Nominatim failed → fall back to IP geolocation
          try {
            const city = await getLocationByIP();
            applyCity(city);
          } catch {
            setLocationLabel("Select Location");
            setLocationError(true);
          }
        } finally {
          setLocationLoading(false);
        }
      },
      async () => {
        // GPS denied → fall back to IP geolocation silently
        try {
          const city = await getLocationByIP();
          applyCity(city);
        } catch {
          setLocationLabel("Select Location");
          setLocationError(true);
        } finally {
          setLocationLoading(false);
        }
      },
      { timeout: 8000 }
    );
  }, []);

  // No auto-detect on mount. Geolocation only runs when user triggers it explicitly.

  // ── Close dropdown on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Filtering ──
  const cuisineOptions = useMemo(() => extractCuisines(businesses), [businesses]);

  const filteredRestaurants = useMemo(() => {
    const base = businesses.filter((r) => {
      const name = r.name || "";
      const cuisine = r.cuisine || "";
      const address = r.address || "";

      const matchesSearch =
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cuisine.toLowerCase().includes(searchQuery.toLowerCase()) ||
        address.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = activeFilter === "All" || (r.type_name && r.type_name.toLowerCase() === activeFilter.toLowerCase());
      const matchesLocation =
        !locationCity ||
        locationCity === "All Cities" ||
        address.toLowerCase().includes(locationCity.toLowerCase());
      return matchesSearch && matchesFilter && matchesLocation;
    });
    return applyDiningFilters(base, diningFilters);
  }, [businesses, searchQuery, activeFilter, locationCity, diningFilters]);

  const cityDisplay =
    locationCity && locationCity !== "All Cities" ? locationCity : "All Cities";
  const restaurantCountLabel = `${filteredRestaurants.length} restaurant${filteredRestaurants.length !== 1 ? "s" : ""}`;

  const getFilteredSectionTitle = () => {
    const city = locationCity;
    if (activeFilter === "All") {
      return (city && city !== "All Cities") ? `Restaurants in ${city}` : "Restaurants Near You";
    }
    const lower = activeFilter.toLowerCase();
    let name = activeFilter;
    if (lower === "bar") name = "Bars";
    else if (lower === "cafe") name = "Cafes";
    else if (lower === "restaurant") name = "Restaurants";
    else if (!name.endsWith("s")) name = name + "s";

    return (city && city !== "All Cities") ? `${name} in ${city}` : `${name} Near You`;
  };

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── 1. Hero Search Banner ──────────────────────────────────────────── */}
      <div
        className={`relative ${showLocationDropdown ? "z-40" : ""}`}
        style={{ background: "linear-gradient(135deg, #091e2b 0%, #14496b 50%, #091e2b 100%)" }}
      >
        {/* Background food image */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25"
          style={{ backgroundImage: "url(https://images.unsplash.com/photo-1544025162-d76694265947?w=1600&q=80)" }}
        />
        {/* Radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,rgba(27,107,147,0.3),transparent_70%)]" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 pt-20 pb-16">
          {/* Headline */}
          <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-3 leading-tight tracking-tight">
            What are you in the <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-amber-400">
              mood for?
            </span>
          </h1>
          <p className="text-white/60 text-lg mb-8">
            Discover top restaurants, cafes & bars — book your table in seconds.
          </p>

          {/* ── Combined Location + Search Bar ── */}
          <div ref={locationRef} className="relative max-w-4xl">
            <div className="flex flex-col sm:flex-row items-stretch bg-white rounded-2xl shadow-2xl overflow-hidden">

              {/* LEFT: Location Picker */}
              <button
                id="location-picker-btn"
                onClick={() => setShowLocationDropdown((v) => !v)}
                className={`flex items-center gap-2 px-4 py-4 shrink-0 border-b sm:border-b-0 sm:border-r border-slate-100 hover:bg-slate-50 transition-colors w-full sm:w-auto sm:min-w-[220px] sm:max-w-[260px] ${showLocationDropdown ? "bg-rose-50 border-rose-100" : ""
                  }`}
              >
                {locationLoading ? (
                  <Loader2 size={17} className="text-rose-500 shrink-0 animate-spin" />
                ) : (
                  <MapPin
                    size={17}
                    className={`shrink-0 ${locationError ? "text-slate-400" : "text-rose-500"}`}
                  />
                )}
                <span
                  className={`text-sm font-semibold truncate ${locationLoading
                    ? "text-slate-400"
                    : locationError
                      ? "text-slate-500"
                      : "text-slate-800"
                    }`}
                >
                  {locationLabel}
                </span>
                <svg
                  className={`ml-auto shrink-0 w-4 h-4 text-slate-400 transition-transform duration-200 ${showLocationDropdown ? "rotate-180" : ""
                    }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* RIGHT: Restaurant Search */}
              <div className="flex-1 flex items-center gap-2 px-4 border-b sm:border-b-0 border-slate-100">
                <Search size={18} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search restaurants, cuisines or dishes..."
                  className="flex-1 text-slate-800 placeholder:text-slate-400 text-sm focus:outline-none bg-transparent py-4"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearchSubmit();
                    }
                  }}
                />
                {searchInput && (
                  <button
                    onClick={() => {
                      setSearchInput("");
                      setSearchQuery("");
                    }}
                    className="text-slate-300 hover:text-slate-500 transition-colors"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Search CTA */}
              <button
                onClick={handleSearchSubmit}
                className="bg-rose-600 hover:bg-rose-700 text-white px-7 py-4 sm:py-0 font-semibold text-sm transition-colors shadow-lg shadow-rose-600/30 whitespace-nowrap w-full sm:w-auto"
              >
                Search
              </button>
            </div>

            {/* Location Dropdown */}
            {showLocationDropdown && (
              <LocationDropdown
                onSelect={(city) => {
                  setLocationLabel(city);
                  setLocationCity(city);
                  localStorage.setItem('selected_city', city);
                  window.dispatchEvent(new Event('selected_city_changed'));
                }}
                onDetect={() => {
                  setShowLocationDropdown(false);
                  detectCurrentLocation();
                }}
                detecting={locationLoading}
                onClose={() => setShowLocationDropdown(false)}
              />
            )}
          </div>

          {/* Location status hint */}
          {locationError && (
            <p className="mt-3 text-white/40 text-xs flex items-center gap-1.5">
              <Navigation size={12} />
              Location access denied —{" "}
              <button
                onClick={() => setShowLocationDropdown(true)}
                className="underline underline-offset-2 hover:text-white/60 transition-colors"
              >
                select city manually
              </button>
            </p>
          )}
          {!locationError && locationCity && (
            <p className="mt-3 text-white/40 text-xs flex items-center gap-1.5">
              <Navigation size={12} />
              Showing restaurants in{" "}
              <span className="text-white/60 font-medium">{locationCity}</span>
              <button
                onClick={() => setShowLocationDropdown(true)}
                className="ml-1 underline underline-offset-2 hover:text-white/60 transition-colors"
              >
                change
              </button>
            </p>
          )}

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-4 sm:flex sm:items-center sm:gap-8 mt-8 border-t border-white/10 pt-6">
            {[["5,000+", "Restaurants"], ["1M+", "Happy Diners"], ["50+", "Cities"]].map(
              ([val, label]) => (
                <div key={label} className="text-white/80 flex flex-col sm:flex-row sm:items-center">
                  <span className="font-bold text-white text-base sm:text-lg leading-none">{val}</span>
                  <span className="text-xs sm:text-sm text-white/60 sm:ml-2 mt-1 sm:mt-0 font-medium leading-none">{label}</span>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* ── Page Body Part 1 (Collections, Promotions, Moods) ───────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── 3. Collections ──────────────────────────────────────────────── */}
        {!searchQuery && activeFilter === "All" && (
          <section className="py-10">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Collections</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Explore curated lists of top restaurants, cafes and bars
                </p>
              </div>
              <Link
                href={locationCity ? `/collections?city=${encodeURIComponent(locationCity)}` : '/collections'}
                className="flex items-center gap-1 text-sm font-semibold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
              >
                All collections <ChevronRight size={16} />
              </Link>
            </div>
            <div className="relative mt-5">
              {/* Left Arrow */}
              <button 
                onClick={() => scrollCollections('left')}
                className="absolute left-2 sm:-left-5 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white text-slate-700 w-10 h-10 rounded-full hidden md:flex items-center justify-center border border-slate-200 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur-sm"
                aria-label="Scroll left"
              >
                <ChevronLeft size={20} />
              </button>

              {/* Scrollable Container */}
              <div 
                ref={collectionsRef}
                className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide scroll-smooth"
              >
                {collections.map((col) => (
                  <CollectionCard key={col.id} collection={col} />
                ))}
              </div>

              {/* Right Arrow */}
              <button 
                onClick={() => scrollCollections('right')}
                className="absolute right-2 sm:-right-5 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white text-slate-750 w-10 h-10 rounded-full hidden md:flex items-center justify-center border border-slate-200 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur-sm"
                aria-label="Scroll right"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </section>
        )}

        {/* ── 4. Promotional Banner ────────────────────────────────────────── */}
        {!searchQuery && activeFilter === "All" && (
          <section className="py-6">
            <div
              className="relative rounded-3xl overflow-hidden shadow-lg"
              style={{ background: "linear-gradient(135deg, #0a1e2d 0%, #17547d 50%, #0a1e2d 100%)" }}
            >
              <div
                className="absolute inset-0 opacity-20 bg-cover bg-center"
                style={{
                  backgroundImage:
                    "url(https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80)",
                }}
              />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_50%,rgba(56,189,248,0.15),transparent_60%)]" />
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 p-8 md:p-10">
                <div>
                  <div className="inline-flex items-center gap-2 bg-amber-400/20 border border-amber-400/30 rounded-full px-3 py-1 mb-4">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-amber-300 text-xs font-bold uppercase tracking-widest">
                      Weekend Special
                    </span>
                  </div>
                  <h3 className="text-white text-3xl md:text-4xl font-extrabold leading-tight mb-3">
                    Up to <span className="text-amber-400">30% OFF</span> on{" "}
                    <br className="hidden md:block" />
                    table bookings
                  </h3>
                  <p className="text-white/60 text-sm max-w-md">
                    Exclusive deals at premium venues
                    {locationCity ? ` across ${locationCity}` : " near you"}. This weekend only —
                    grab your table before it's gone.
                  </p>
                </div>
                <div className="shrink-0">
                  <button className="bg-white hover:bg-slate-50 text-rose-700 font-bold px-8 py-4 rounded-2xl text-sm flex items-center gap-2 shadow-2xl transition-all hover:scale-105 whitespace-nowrap">
                    Explore Offers <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── 4.5. In The Mood For Section ────────────────────────────────── */}
        {!searchQuery && activeFilter === "All" && (
          <section className="py-8">
            <div className="flex items-center gap-4 text-center mb-8">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-slate-400 font-bold text-xs uppercase tracking-[0.25em] whitespace-nowrap">
                In The Mood For
              </span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Mobile Layout: 2-row horizontal scroll of tall cards (title at top, image at bottom) */}
            <div className="flex md:hidden overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 scroll-smooth">
              <div className="grid grid-rows-2 grid-flow-col gap-4">
                {moods.map((mood) => (
                  <button
                    key={mood.id}
                    onClick={() => handleMoodSelect(mood.query_tag)}
                    className="group bg-white rounded-2xl border border-slate-100/90 p-3.5 h-38 w-28 flex flex-col justify-between hover:shadow-sm hover:border-slate-200 transition-all cursor-pointer text-left shrink-0 shadow-sm relative overflow-hidden focus:outline-none"
                  >
                    <span className="font-bold text-slate-800 text-[12.5px] leading-tight block max-w-full group-hover:text-rose-600 transition-colors">
                      {mood.title}
                    </span>
                    <div className="absolute bottom-0 left-0 right-0 h-22 overflow-hidden rounded-b-2xl flex items-end">
                      <img
                        src={mood.image_url}
                        alt={mood.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80";
                        }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop Layout: Premium Circular Category Bubbles in exactly 1 line across full width (no left/right extra margins) */}
            <div className="hidden md:flex justify-between items-center w-full py-2">
              {moods.map((mood) => (
                <button
                  key={mood.id}
                  onClick={() => handleMoodSelect(mood.query_tag)}
                  className="group flex flex-col items-center text-center cursor-pointer w-28 lg:w-32 focus:outline-none shrink-0"
                >
                  {/* Circular Wrapper */}
                  <div className="relative w-24 h-24 lg:w-28 lg:h-28 rounded-full overflow-hidden border-2 border-slate-100 group-hover:border-rose-600 group-hover:scale-105 transition-all duration-300 shadow-sm bg-slate-50 flex items-center justify-center">
                    <img
                      src={mood.image_url}
                      alt={mood.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80";
                      }}
                    />
                    {/* Ring highlight on hover */}
                    <div className="absolute inset-0 ring-4 ring-rose-500/15 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  {/* Category Title */}
                  <span className="text-[12px] lg:text-[13px] font-bold text-slate-700 mt-3 group-hover:text-rose-600 transition-colors tracking-wide leading-tight">
                    {mood.title}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

      </div>

      {/* ── 4.8. Business Type Filter (Cuisine Filter Pills) ─────────────────── */}
      <div className="sticky top-[146px] md:top-[80px] z-30 bg-white transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 py-3.5 overflow-x-auto scrollbar-hide">
            {filters.map((f) => {
              const isActive = activeFilter.toLowerCase() === f.label.toLowerCase();
              return (
                <button
                  key={f.label}
                  onClick={() => {
                    setActiveFilter(f.label);
                    const element = document.getElementById("restaurant-listings");
                    if (element) {
                      element.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all border cursor-pointer ${
                    isActive
                      ? "bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-600/10 hover:bg-rose-700"
                      : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <span className="text-base">{f.emoji}</span>
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* ── 5. Restaurant Listing Grid ───────────────────────────────────── */}
          <section id="restaurant-listings" className={`pb-16 ${(!searchQuery && activeFilter === "All") ? "" : "pt-8"}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {getFilteredSectionTitle()}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {locationLoading ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" /> Locating restaurants…
                  </span>
                ) : (
                  <>
                    <span className="font-semibold text-slate-700">{cityDisplay}</span>
                    {" · "}
                    {restaurantCountLabel} to explore
                  </>
                )}
              </p>
            </div>

            {/* Active Filters & Search Chips */}
            <div className="flex flex-wrap items-center gap-2">
              {searchQuery && (
                <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 text-rose-600 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
                  <span>Search: "{searchQuery}"</span>
                  <button
                    onClick={() => { setSearchInput(""); setSearchQuery(""); }}
                    className="hover:bg-rose-100 p-0.5 rounded-full transition-colors flex items-center justify-center"
                    aria-label="Clear search"
                  >
                    <X size={12} className="text-rose-600" />
                  </button>
                </div>
              )}

              {activeFilter !== "All" && (
                <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-650 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
                  <span>Category: {activeFilter}</span>
                  <button
                    onClick={() => setActiveFilter("All")}
                    className="hover:bg-slate-200 p-0.5 rounded-full transition-colors flex items-center justify-center"
                    aria-label="Clear category filter"
                  >
                    <X size={12} className="text-slate-650" />
                  </button>
                </div>
              )}

              {(activeFilter !== "All" || searchQuery || diningFilters.cuisine || diningFilters.minRating > 0 || diningFilters.offersOnly) && (
                <button
                  onClick={() => {
                    setSearchInput("");
                    setSearchQuery("");
                    setActiveFilter("All");
                    setDiningFilters(DEFAULT_DINING_FILTERS);
                  }}
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

          {businessesLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
              <Loader2 size={36} className="animate-spin text-rose-600" />
              <p className="text-sm font-medium">Loading top restaurants...</p>
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <div className="text-center py-24">
              <div className="text-5xl mb-4">🍽️</div>
              <h3 className="text-lg font-semibold text-slate-600 mb-2">No restaurants found</h3>
              <p className="text-slate-400 text-sm">
                {locationCity
                  ? `No results in ${locationCity}. Try changing your city or filter.`
                  : "Try adjusting your search or removing the filter."}
              </p>
              <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setActiveFilter("All");
                    setLocationCity("");
                    setLocationLabel("All Cities");
                  }}
                  className="bg-rose-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-rose-700 transition-colors"
                >
                  Show all restaurants
                </button>
                <button
                  onClick={() => setShowLocationDropdown(true)}
                  className="bg-white border border-slate-200 text-slate-700 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Change city
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
        </section>
        </div>
      </div>
    </div>
  );
}
