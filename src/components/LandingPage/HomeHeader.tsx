"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import { useGetPublicEventFiltersQuery } from "@/services/api";
import CitySelectModal from "./CitySelectModal";
import SearchOverlay from "./SearchOverlay";

type HomeHeaderProps = {
  city: string;
  onCityChange: (city: string) => void;
};

export default function HomeHeader({ city, onCityChange }: HomeHeaderProps) {
  const pathname = usePathname();
  const { data: filters } = useGetPublicEventFiltersQuery();
  const [cityOpen, setCityOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const cities = filters?.cities || [];

  useEffect(() => {
    setIsLoggedIn(Boolean(localStorage.getItem("user_customer")));
  }, [pathname]);

  const cityLabel = city && city !== "All Cities" ? city : "Select city";

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#EDEDED]">
      <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center gap-3 sm:gap-4">
        <Link href="/" className="shrink-0 text-[20px] sm:text-[22px] font-extrabold tracking-tight">
          <span className="text-[#111111]">Book My </span>
          <span className="text-[#7C5CFF]">Bota</span>
        </Link>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="hidden md:flex flex-1 max-w-2xl mx-auto relative cursor-pointer"
        >
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
          <span className="w-full h-10 pl-10 pr-4 rounded-lg bg-[#F7F7F7] text-sm text-[#9A9A9A] flex items-center text-left">
            Search for Events, Dining and Experiences
          </span>
        </button>

        <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            className="md:hidden w-9 h-9 rounded-full hover:bg-[#F3EEFF] flex items-center justify-center cursor-pointer"
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
          >
            <Search size={18} />
          </button>

          <button
            type="button"
            onClick={() => setCityOpen(true)}
            className="flex items-center gap-1 text-sm font-medium text-[#111111] cursor-pointer hover:text-[#7C5CFF] max-w-[120px] sm:max-w-[160px]"
          >
            <span className="truncate">{cityLabel}</span>
            <ChevronDown size={14} className="shrink-0 text-[#6B6B6B]" />
          </button>

          <Link
            href={isLoggedIn ? "/customer/dashboard" : "/login"}
            className="inline-flex h-9 items-center px-3.5 rounded-lg border border-[#7C5CFF] bg-white text-sm font-medium text-[#111111] hover:bg-[#F3EEFF]"
          >
            {isLoggedIn ? "My Account" : "Customer Login"}
          </Link>
        </div>
      </div>

      <CitySelectModal
        open={cityOpen}
        cities={cities}
        selected={city}
        onClose={() => setCityOpen(false)}
        onSelect={onCityChange}
      />

      <SearchOverlay open={searchOpen} city={city} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
