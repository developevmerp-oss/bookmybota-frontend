"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import { useGetPublicEventFiltersQuery } from "@/services/api";
import images from "@/Images";
import CitySelectModal from "./CitySelectModal";
import SearchOverlay from "./SearchOverlay";

type StoredCustomer = {
  name?: string;
  email?: string;
};

function readCustomer(): StoredCustomer | null {
  try {
    const token = localStorage.getItem("token_customer");
    const raw = localStorage.getItem("user_customer");
    if (!token || !raw) return null;
    return JSON.parse(raw) as StoredCustomer;
  } catch {
    return null;
  }
}

function readCity() {
  const stored = localStorage.getItem("selected_city");
  return stored && stored !== "All Cities" ? stored : "";
}

export default function HomeHeader() {
  const pathname = usePathname();
  const { data: filters } = useGetPublicEventFiltersQuery();
  const [city, setCity] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [customer, setCustomer] = useState<StoredCustomer | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const cities = filters?.cities || [];
  const isAuthPage = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    const syncCity = () => setCity(readCity());
    const syncAuth = () => setCustomer(readCustomer());
    syncCity();
    syncAuth();
    setAuthReady(true);
    window.addEventListener("selected_city_changed", syncCity);
    window.addEventListener("auth_changed", syncAuth);
    window.addEventListener("storage", syncAuth);
    return () => {
      window.removeEventListener("selected_city_changed", syncCity);
      window.removeEventListener("auth_changed", syncAuth);
      window.removeEventListener("storage", syncAuth);
    };
  }, [pathname]);

  const handleCityChange = (next: string) => {
    const value = next && next !== "All Cities" ? next : "";
    setCity(value);
    if (value) localStorage.setItem("selected_city", value);
    else localStorage.removeItem("selected_city");
    window.dispatchEvent(new Event("selected_city_changed"));
  };

  const cityLabel = city || "Select city";
  const displayName = customer?.name || customer?.email?.split("@")[0] || "Account";
  const initial = displayName.charAt(0).toUpperCase();
  const openGiftSrc = typeof images.openGift === "string" ? images.openGift : images.openGift.src;
  const logoSrc = typeof images.logo === "string" ? images.logo : images.logo.src;

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-black/10">
      {/* Phone (< md) */}
      <div className="md:hidden px-4 py-2.5 flex items-center gap-2">
        <Link href="/" className="shrink-0 flex items-center min-w-0">
          <img src={logoSrc} alt="Book My Bota" className="h-8 w-auto max-w-[120px] object-contain object-left" />
        </Link>

        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button
            type="button"
            className="w-9 h-9 rounded-full hover:bg-[#F7E9FF] flex items-center justify-center cursor-pointer"
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
          >
            <Search size={18} />
          </button>

          <button
            type="button"
            onClick={() => setCityOpen(true)}
            className="flex items-center gap-0.5 max-w-[96px] h-9 px-1.5 rounded-full text-xs font-medium text-[#111111] cursor-pointer hover:bg-[#F7E9FF] hover:text-[#6900AA]"
          >
            <span className="truncate">{cityLabel}</span>
            <ChevronDown size={14} className="shrink-0 text-[#6B6B6B]" />
          </button>

          {!authReady ? (
            <span className="w-9 h-9" />
          ) : customer ? (
            <Link
              href="/customer/settings"
              aria-label="My Account"
              className="w-9 h-9 rounded-full border border-[#E3BCFF] bg-[#F7E9FF] flex items-center justify-center"
            >
              <span className="w-7 h-7 rounded-full bg-[#7A00C6] text-white text-xs font-semibold flex items-center justify-center">
                {initial}
              </span>
            </Link>
          ) : isAuthPage ? null : (
            <Link
              href="/login"
              className="inline-flex h-8 items-center px-3 rounded-full bg-[#6900AA] text-white text-xs font-semibold hover:bg-[#57008E]"
            >
              Login
            </Link>
          )}
        </div>
      </div>

      {/* Tablet (md → lg): compact row, no overflow */}
      <div className="hidden md:flex lg:hidden px-4 py-2.5 items-center gap-3">
        <Link href="/" className="shrink-0 flex items-center">
          <img src={logoSrc} alt="Book My Bota" className="h-10 w-auto object-contain" />
        </Link>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex flex-1 min-w-0 relative cursor-pointer"
        >
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A] pointer-events-none" />
          <span className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#F7F7F7] text-sm text-[#9A9A9A] flex items-center text-left truncate whitespace-nowrap overflow-hidden">
            Search for Events, Dining and Experiences
          </span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setCityOpen(true)}
            className="flex items-center gap-1 text-sm font-medium text-[#111111] cursor-pointer hover:text-[#6900AA] max-w-[110px]"
          >
            <span className="truncate">{cityLabel}</span>
            <ChevronDown size={14} className="shrink-0 text-[#6B6B6B]" />
          </button>

          <Link
            href="/business"
            className="inline-flex h-9 items-center px-3 rounded-full bg-[#F3F3F3] text-[#111111] text-sm font-medium hover:bg-[#F7E9FF] hover:text-[#6900AA] transition-colors whitespace-nowrap"
          >
            Partner
          </Link>

          {!authReady ? (
            <span className="w-9 h-9" />
          ) : customer ? (
            <Link
              href="/customer/settings"
              className="inline-flex h-9 items-center gap-1.5 pl-1 pr-2.5 rounded-full border border-[#E3BCFF] bg-[#F7E9FF] hover:bg-[#EFD7FF] transition-colors"
            >
              <span className="w-7 h-7 rounded-full bg-[#7A00C6] text-white text-xs font-semibold flex items-center justify-center">
                {initial}
              </span>
              <span className="text-sm font-medium text-[#111111] whitespace-nowrap">Account</span>
            </Link>
          ) : isAuthPage ? null : (
            <Link
              href="/login"
              className="inline-flex h-9 items-center px-3 rounded-full bg-[#6900AA] text-white text-sm font-semibold hover:bg-[#57008E] whitespace-nowrap"
            >
              Login
            </Link>
          )}
        </div>
      </div>

      {/* Desktop (lg+): your full design */}
      <div className="hidden lg:flex container mx-auto h-auto px-6 xl:px-8 items-center gap-4">
        <Link href="/" className="shrink-0 flex items-center">
          <img src={logoSrc} alt="Book My Bota" className="h-15 xl:h-20 pt-2 w-auto object-contain" />
        </Link>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex flex-1 mx-auto relative cursor-pointer min-w-0"
        >
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
          <span className="w-full h-15 pl-13 pr-4 rounded-lg bg-[#F7F7F7] text-lg text-[#9A9A9A] flex items-center text-left truncate whitespace-nowrap overflow-hidden">
            Search for Events, Dining and Experiences
          </span>
        </button>

        <div className="ml-auto flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setCityOpen(true)}
            className="flex items-center gap-1 text-sm font-medium text-[#111111] cursor-pointer hover:text-[#6900AA] max-w-[160px]"
          >
            <span className="truncate">{cityLabel}</span>
            <ChevronDown size={14} className="shrink-0 text-[#6B6B6B]" />
          </button>

          <Link
            href="/business"
            className="inline-flex h-11 items-center px-4 rounded-full bg-[#F3F3F3] text-[#111111] text-lg font-normal hover:bg-[#F7E9FF] hover:text-[#6900AA] transition-colors whitespace-nowrap"
          >
            Partner with Us
          </Link>

          {!authReady ? (
            <span className="w-[132px] h-9" />
          ) : customer ? (
            <>
              <img
                src={openGiftSrc}
                alt=""
                aria-hidden="true"
                className="h-23 w-23 object-contain shrink-0"
              />
              <Link
                href="/customer/settings"
                className="inline-flex h-13 items-center gap-2 pl-1 pr-3 rounded-full border border-[#E3BCFF] bg-[#F7E9FF] hover:bg-[#EFD7FF] transition-colors"
              >
                <span className="w-9 h-9 rounded-full bg-[#7A00C6] ml-1 text-white text-[16px] font-semibold flex items-center justify-center">
                  {initial}
                </span>
                <span className="text-lg font-medium text-[#111111] max-w-[110px] truncate whitespace-nowrap">
                  My Account
                </span>
              </Link>
            </>
          ) : isAuthPage ? null : (
            <Link
              href="/login"
              className="inline-flex h-9 items-center px-4 rounded-full bg-[#6900AA] text-white text-sm font-semibold hover:bg-[#57008E] shadow-[0_1px_2px_rgba(105,0,170,0.35)] transition-colors whitespace-nowrap"
            >
              Customer Login
            </Link>
          )}
        </div>
      </div>

      <CitySelectModal
        open={cityOpen}
        cities={cities}
        selected={city}
        onClose={() => setCityOpen(false)}
        onSelect={handleCityChange}
      />

      <SearchOverlay open={searchOpen} city={city} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
