"use client";
import { Inter } from "next/font/google";
import { useState, useEffect, useRef, useCallback } from "react";
import "./globals.css";
import Link from "next/link";
import { UtensilsCrossed, Calendar, LogOut, Search, MapPin, ChevronLeft, X, Navigation, Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { StoreProvider } from "@/providers/StoreProvider";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

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
    <div className="absolute top-full left-0 mt-2 w-full md:w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden text-slate-800">
      {/* Use Current Location */}
      <button
        onClick={onDetect}
        disabled={detecting}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-rose-50 transition-colors text-left border-b border-slate-100 group disabled:opacity-60 cursor-pointer text-slate-800"
      >
        <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0 group-hover:bg-rose-200 transition-colors">
          {detecting ? (
            <Loader2 size={16} className="text-rose-600 animate-spin" />
          ) : (
            <Navigation size={16} className="text-rose-600" />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-850">
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
            <button onClick={() => { setQuery(""); setSuggestions([]); }} className="text-slate-400 hover:text-slate-650">
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
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors text-left cursor-pointer"
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
            {["All Cities", "Mumbai", "Delhi", "Bengaluru", "Ahmedabad", "Pune", "Hyderabad"].map((city) => (
              <button
                key={city}
                onClick={() => { onSelect(city); onClose(); }}
                className="w-full flex items-center gap-3 py-2.5 hover:text-rose-600 transition-colors text-left cursor-pointer text-slate-700"
              >
                <MapPin size={13} className="text-slate-350 shrink-0" />
                <span className="text-sm text-slate-650 font-semibold">{city}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-sm">B</span>
              </div>
              <span className="text-xl font-black tracking-tight">Book My Bota</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              The smartest way to discover and book tables at the best restaurants, cafes, and bars near you.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-4 text-slate-300 uppercase tracking-wider">
              Company
            </h4>
            <ul className="space-y-2 text-sm text-slate-400">
              {["About Us", "Blog", "Careers", "Press"].map((item) => (
                <li key={item}>
                  <a href="#" className="hover:text-white transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-4 text-slate-300 uppercase tracking-wider">
              For Business
            </h4>
            <ul className="space-y-2 text-sm text-slate-400">
              {["List Your Restaurant", "Business Dashboard", "Partner With Us", "Contact"].map(
                (item) => (
                  <li key={item}>
                    <a href="#" className="hover:text-white transition-colors">
                      {item}
                    </a>
                  </li>
                )
              )}
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-xs">© 2025 Book My Bota. All rights reserved.</p>
          <div className="flex items-center gap-6">
            {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((item) => (
              <a
                key={item}
                href="#"
                className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isAdminOrBusiness = pathname?.startsWith('/admin') || pathname?.startsWith('/business');
  const isHomePage = pathname === '/';

  const [user, setUser] = useState<any>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileSearchActive, setMobileSearchActive] = useState(false);
  const [navSearchInput, setNavSearchInput] = useState("");
  const [navCity, setNavCity] = useState("All Cities");
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const locationRef = useRef<HTMLDivElement>(null);

  const detectCurrentLocation = useCallback(async () => {
    setLocationLoading(true);
    setLocationError(false);

    const applyCity = (city: string) => {
      setNavCity(city);
      localStorage.setItem('selected_city', city);
      window.dispatchEvent(new Event('selected_city_changed'));
      
      const params = new URLSearchParams(window.location.search);
      params.set('city', city);
      window.location.href = `/search?${params.toString()}`;
    };

    if (!navigator.geolocation) {
      try {
        const city = await getLocationByIP();
        applyCity(city);
      } catch {
        setLocationError(true);
      } finally {
        setLocationLoading(false);
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const city = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          applyCity(city);
        } catch {
          try {
            const city = await getLocationByIP();
            applyCity(city);
          } catch {
            setLocationError(true);
          }
        } finally {
          setLocationLoading(false);
        }
      },
      async () => {
        try {
          const city = await getLocationByIP();
          applyCity(city);
        } catch {
          setLocationError(true);
        } finally {
          setLocationLoading(false);
        }
      },
      { timeout: 8000 }
    );
  }, []);

  const handleCitySelect = (selected: string) => {
    setNavCity(selected);
    const params = new URLSearchParams(window.location.search);
    if (selected === "All Cities" || !selected) {
      localStorage.removeItem('selected_city');
      params.delete('city');
    } else {
      localStorage.setItem('selected_city', selected);
      params.set('city', selected);
    }
    window.dispatchEvent(new Event('selected_city_changed'));
    window.location.href = `/search?${params.toString()}`;
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!isHomePage) {
      setScrolled(false);
      return;
    }
    const handleScroll = () => {
      const currentScroll = window.scrollY;
      setScrolled((prev) => {
        if (currentScroll > 320) return true;
        if (currentScroll < 240) return false;
        return prev;
      });
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHomePage]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setNavSearchInput(params.get("search") || "");
      
      const city = params.get("city") || localStorage.getItem("selected_city") || "All Cities";
      setNavCity(city);
    }
  }, [pathname]);

  useEffect(() => {
    const handleCityUpdate = () => {
      const city = localStorage.getItem("selected_city") || "All Cities";
      setNavCity(city);
    };
    window.addEventListener("selected_city_changed", handleCityUpdate);
    return () => window.removeEventListener("selected_city_changed", handleCityUpdate);
  }, []);

  // Read auth state from localStorage — re-runs on pathname change AND on auth_changed event
  const readAuthFromStorage = () => {
    const isBusiness = pathname?.startsWith('/business');
    const isAdmin = pathname?.startsWith('/admin');
    let userKey = 'user_customer';
    if (isAdmin) userKey = 'user_super_admin';
    else if (isBusiness) userKey = 'user_business_admin';
    const userStr = localStorage.getItem(userKey);
    setUser(userStr ? JSON.parse(userStr) : null);
  };

  useEffect(() => {
    readAuthFromStorage();
  }, [pathname]);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Listen for auth_changed event so header updates immediately after
  // login/register inside the booking drawer (no page refresh needed)
  useEffect(() => {
    window.addEventListener('auth_changed', readAuthFromStorage);
    return () => window.removeEventListener('auth_changed', readAuthFromStorage);
  }, [pathname]);

  const handleLogout = () => {
    const isBusiness = pathname?.startsWith('/business');
    const isAdmin = pathname?.startsWith('/admin');
    let tokenKey = 'token_customer';
    let userKey = 'user_customer';
    if (isAdmin) {
      tokenKey = 'token_super_admin';
      userKey = 'user_super_admin';
    } else if (isBusiness) {
      tokenKey = 'token_business_admin';
      userKey = 'user_business_admin';
    }

    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    window.location.href = '/login';
  };

  return (
    <html lang="en" className={isAdminOrBusiness ? "admin-theme" : "customer-theme"}>
      <body className={inter.className}>
        <StoreProvider>
            {!isAdminOrBusiness && (
              <nav className={`fixed top-0 w-full z-50 border-b transition-all duration-300 ${
                isHomePage && !scrolled
                  ? 'bg-black/40 backdrop-blur-md border-white/10'
                  : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
                  <div className="flex justify-between items-center h-20 relative">
                    
                    {/* Brand Logo */}
                    <Link href="/" className="flex items-center gap-2 group shrink-0">
                      <div className="bg-rose-600 p-2 rounded-lg group-hover:scale-105 transition-transform logo-box">
                        <UtensilsCrossed size={24} className="text-white" />
                      </div>
                      <span className={`text-xl font-bold tracking-tight transition-all ${
                        (isHomePage && !scrolled) ? 'text-white' : 'text-foreground'
                      }`}>
                        Book My Bota
                      </span>
                    </Link>

                    {/* Desktop Search & Location capsule */}
                    {(!isHomePage || scrolled) && (
                      <div className="hidden md:flex items-center bg-white border border-slate-200/80 rounded-xl shadow-sm max-w-xl flex-1 mx-8 overflow-hidden h-11 text-slate-800">
                        {/* Location Select (Custom Dropdown behavior) */}
                        <div ref={locationRef} className="flex items-center gap-1.5 px-3 shrink-0 h-full border-r border-slate-100 hover:bg-slate-50 relative">
                          <button
                            onClick={() => setShowLocationDropdown((v) => !v)}
                            className="flex items-center gap-1.5 focus:outline-none h-full cursor-pointer text-slate-750 font-semibold text-sm"
                          >
                            {locationLoading ? (
                              <Loader2 size={16} className="text-rose-500 animate-spin shrink-0" />
                            ) : (
                              <MapPin size={16} className="text-rose-600 shrink-0" />
                            )}
                            <span className="max-w-[130px] truncate">
                              {navCity}
                            </span>
                            <svg className={`ml-1 w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showLocationDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {showLocationDropdown && (
                            <LocationDropdown
                              onSelect={handleCitySelect}
                              onDetect={detectCurrentLocation}
                              detecting={locationLoading}
                              onClose={() => setShowLocationDropdown(false)}
                            />
                          )}
                        </div>

                        {/* Search Input */}
                        <div className="flex-1 flex items-center gap-2 px-3 h-full">
                          <Search size={16} className="text-slate-400 shrink-0" />
                          <input
                            type="text"
                            placeholder="Search for restaurant, cuisine or a dish..."
                            value={navSearchInput}
                            onChange={(e) => setNavSearchInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const params = new URLSearchParams();
                                if (navSearchInput.trim()) params.set('search', navSearchInput.trim());
                                if (navCity && navCity !== 'All Cities') params.set('city', navCity);
                                window.location.href = `/search?${params.toString()}`;
                              }
                            }}
                            className="flex-1 bg-transparent text-sm placeholder:text-slate-400 text-slate-800 focus:outline-none h-full"
                          />
                          {navSearchInput && (
                            <button 
                              onClick={() => {
                                setNavSearchInput("");
                                if (window.location.pathname === '/search') {
                                  const params = new URLSearchParams(window.location.search);
                                  params.delete('search');
                                  window.location.href = `/search?${params.toString()}`;
                                }
                              }} 
                              className="text-slate-350 hover:text-slate-500 transition-colors mr-2"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>

                        {/* Search Button (matches hero CTA) */}
                        <button
                          onClick={() => {
                            const params = new URLSearchParams();
                            if (navSearchInput.trim()) params.set('search', navSearchInput.trim());
                            if (navCity && navCity !== 'All Cities') params.set('city', navCity);
                            window.location.href = `/search?${params.toString()}`;
                          }}
                          className="bg-rose-600 hover:bg-rose-700 text-white px-5 h-full font-bold text-xs tracking-wide transition-colors whitespace-nowrap cursor-pointer shrink-0 border-l border-rose-700"
                        >
                          Search
                        </button>
                      </div>
                    )}

                    {/* User Action Links */}
                    <div className="flex gap-4 sm:gap-6 items-center shrink-0">
                      {user ? (
                        <div className="flex items-center gap-4 sm:gap-6">
                          {user.role === 'customer' && (
                            <Link href="/customer/dashboard" className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                              isHomePage && !scrolled ? 'text-white/80 hover:text-white' : 'text-muted-foreground hover:text-foreground'
                            }`} title="My Reservations">
                              <Calendar size={18} className="sm:hidden" />
                              <span className="hidden sm:inline">My Reservations</span>
                            </Link>
                          )}
                          {user.role === 'business_admin' && (
                            <Link href="/business" className={`text-sm font-medium transition-colors ${
                              isHomePage && !scrolled ? 'text-white/80 hover:text-white' : 'text-muted-foreground hover:text-foreground'
                            }`}>
                              Dashboard
                            </Link>
                          )}
                          {user.role === 'super_admin' && (
                            <Link href="/admin" className={`text-sm font-medium transition-colors ${
                              isHomePage && !scrolled ? 'text-white/80 hover:text-white' : 'text-muted-foreground hover:text-foreground'
                            }`}>
                              Admin Panel
                            </Link>
                          )}
                          <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm font-medium text-rose-500 hover:text-rose-400 transition-colors cursor-pointer" title="Log out">
                            <LogOut size={18} className="sm:hidden" />
                            <span className="hidden sm:inline">Log out</span>
                          </button>
                        </div>
                      ) : (
                        <>
                           <Link
                             href="/business"
                             className={`px-2.5 py-1.5 text-[11px] sm:px-3.5 sm:py-2 sm:text-xs font-bold rounded-xl transition-all border whitespace-nowrap shadow-sm hover:scale-[1.02] active:scale-[0.98] ${
                               isHomePage && !scrolled
                                 ? "bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/40"
                                 : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                             }`}
                           >
                             Partner with Us
                           </Link>
                          <Link href="/login" className="btn-primary text-sm px-5 py-2.5">
                            Sign In
                          </Link>
                        </>
                      )}
                    </div>

                  </div>

                  {/* Row 2: Mobile Sticky Search Capsule */}
                  {(!isHomePage || scrolled) && (
                    <div className="md:hidden border-t border-slate-100 pt-2 pb-3">
                      <button
                        onClick={() => setMobileSearchActive(true)}
                        className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm hover:shadow-md transition-all cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <MapPin size={16} className="text-rose-600 shrink-0" />
                          <span className="text-xs font-semibold text-slate-700 truncate">
                            {navCity}
                          </span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                          <Search size={14} className="text-slate-500" />
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Full width mobile search overlay inside layout header */}
                  {(!isHomePage || scrolled) && mobileSearchActive && (
                    <div className="absolute inset-0 bg-white z-50 flex items-center px-4 gap-3 animate-fadeIn">
                      {/* Close button */}
                      <button 
                        onClick={() => setMobileSearchActive(false)}
                        className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        <ChevronLeft size={22} />
                      </button>
                      
                      {/* Combined Select + Input */}
                      <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 gap-2 min-w-0">
                        {/* City select */}
                        <div className="relative shrink-0">
                          <select 
                            value={navCity}
                            onChange={(e) => {
                              setNavCity(e.target.value);
                              localStorage.setItem('selected_city', e.target.value);
                              window.dispatchEvent(new Event('selected_city_changed'));
                            }}
                            className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none appearance-none pr-4 max-w-[80px] truncate"
                          >
                            <option value="All Cities">All Cities</option>
                            {["Mumbai", "Delhi", "Bengaluru", "Ahmedabad", "Pune", "Hyderabad"].map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                          <svg className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                        
                        <span className="h-4 w-px bg-slate-200 shrink-0"></span>
                        
                        {/* Search Input */}
                        <input 
                          type="text"
                          placeholder="Search restaurants, cuisines..."
                          value={navSearchInput}
                          onChange={(e) => setNavSearchInput(e.target.value)}
                          className="flex-1 bg-transparent text-xs text-slate-850 focus:outline-none py-1.5 min-w-0"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const params = new URLSearchParams(window.location.search);
                              if (navSearchInput.trim()) params.set('search', navSearchInput.trim());
                              else params.delete('search');
                              if (navCity && navCity !== 'All Cities') params.set('city', navCity);
                              else params.delete('city');
                              window.location.href = `/search?${params.toString()}`;
                            }
                          }}
                        />
                        {navSearchInput && (
                          <button onClick={() => setNavSearchInput("")} className="text-slate-350 hover:text-slate-500 shrink-0">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      
                      {/* Go search */}
                      <button 
                        onClick={() => {
                          const params = new URLSearchParams(window.location.search);
                          if (navSearchInput.trim()) params.set('search', navSearchInput.trim());
                          else params.delete('search');
                          if (navCity && navCity !== 'All Cities') params.set('city', navCity);
                          else params.delete('city');
                          window.location.href = `/search?${params.toString()}`;
                        }}
                        className="text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer shrink-0"
                      >
                        Search
                      </button>
                    </div>
                  )}

                </div>
              </nav>
            )}
          <main className={!isAdminOrBusiness ? "pt-20" : ""}>
            {children}
            {!isAdminOrBusiness && <Footer />}
          </main>
          <Toaster position="top-center" richColors />
        </StoreProvider>
      </body>
    </html>
  );
}
