"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Gift, MapPin, Search, User } from "lucide-react";
import { toast } from "sonner";
import images from "@/Images";
import CitySelectModal from "./CitySelectModal";
import SearchOverlay from "./SearchOverlay";
import CustomerAuthModal from "@/components/Shared/CustomerAuthModal";
import SubNavBar from "./SubNavBar";
import { useAppDispatch } from "@/lib/hooks";
import { logoutCustomer } from "@/lib/authSession";


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

const SEARCH_PLACEHOLDER = "Search for Movies, Events, Plays, Sports and Activities";

function NavSearchBar({
  className,
  onClick,
}: {
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Search"
      className={`flex min-w-0 relative cursor-pointer text-left ${className ?? ""}`}
    >
      <Search
        size={20}
        strokeWidth={2}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#666666] pointer-events-none shrink-0"
      />
      <span className="w-full h-9 sm:h-10 pl-10 pr-4 rounded-full border border-[#DDDDDD] bg-white text-[0.75rem] sm:text-[0.8125rem] lg:text-[1rem] text-[#888888] font-normal flex items-center truncate whitespace-nowrap overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {SEARCH_PLACEHOLDER}
      </span>
    </button>
  );
}

function HeaderDivider() {
  return <span className="hidden md:block w-px h-5 bg-[#E5E5E5] shrink-0" aria-hidden />;
}

function CustomerDropdown({
  children,
  onLogout,
  showGiftCards = false,
}: {
  children: React.ReactNode;
  onLogout: (e: React.MouseEvent) => void;
  showGiftCards?: boolean;
}) {
  return (
    <div className="relative group">
      {children}
      <div className="absolute right-0 top-full pt-1 w-64 z-[60] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
        <div className="rounded-xl border border-[#E3BCFF] bg-white shadow-lg py-1.5 overflow-hidden">
          <Link href="/customer/profile" className="block px-4 py-2.5 type-nav-md font-medium text-[#111111] hover:bg-[#F7E9FF] transition-colors">My Profile</Link>
          <Link href="/customer/change-password" className="block px-4 py-2.5 type-nav-md font-medium text-[#111111] hover:bg-[#F7E9FF] transition-colors">Change Password</Link>
          <Link href="/customer/dashboard" className="block px-4 py-2.5 type-nav-md font-medium text-[#111111] hover:bg-[#F7E9FF] transition-colors">My Orders / Reservations</Link>
          <Link href="/customer/wishlist" className="block px-4 py-2.5 type-nav-md font-medium text-[#111111] hover:bg-[#F7E9FF] transition-colors">My Wishlist</Link>
          {showGiftCards && (
            <Link
              href="/customer/gift-cards"
              className="block px-4 py-2.5 type-nav-md font-medium text-[#111111] hover:bg-[#F7E9FF] transition-colors"
            >
              My Gift Cards
            </Link>
          )}
          <Link href="/customer/help" className="block px-4 py-2.5 type-nav-md font-medium text-[#111111] hover:bg-[#F7E9FF] transition-colors">Help Centre</Link>
          <button
            type="button"
            onClick={() => toast.message("Coming soon")}
            className="flex w-full items-center justify-between gap-2 px-4 py-2.5 type-nav-md font-medium text-[#111111] hover:bg-[#F7E9FF] transition-colors cursor-pointer"
          >
            <span>Offers</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#F7E9FF] text-[#6900AA]">
              Soon
            </span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="block w-full text-left px-4 py-2.5 type-nav-md font-medium text-red-600 hover:bg-[#F7E9FF] transition-colors cursor-pointer"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

function AuthSection({
  authReady,
  customer,
  displayName,
  initial,
  isAuthPage,
  onLogin,
  onLogout,
}: {
  authReady: boolean;
  customer: StoredCustomer | null;
  displayName: string;
  initial: string;
  isAuthPage: boolean;
  onLogin: () => void;
  onLogout: (e: React.MouseEvent) => void;
}) {
  if (!authReady) return <span className="w-16 h-9 shrink-0" />;

  if (customer) {
    return (
      <CustomerDropdown onLogout={onLogout} showGiftCards>
        <Link
          href="/customer/profile"
          className="inline-flex items-center gap-2 rounded-full relative z-10 shrink-0"
        >
          <span className="w-8 h-8 rounded-full bg-[#7A00C6] text-white type-nav-md font-bold flex items-center justify-center">
            {initial}
          </span>
          <span className="hidden sm:inline type-nav-md font-semibold text-[#111111] max-w-[8rem] truncate whitespace-nowrap">
            {displayName}
          </span>
        </Link>
      </CustomerDropdown>
    );
  }

  if (isAuthPage) return null;

  return (
    <button
      type="button"
      onClick={onLogin}
      className="inline-flex items-center gap-1.5 text-[#111111] type-nav-md font-semibold hover:text-[#6900AA] transition-colors cursor-pointer shrink-0"
    >
      <User size={18} strokeWidth={2} />
      <span>Login</span>
    </button>
  );
}

export default function HomeHeader() {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const [city, setCity] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [customer, setCustomer] = useState<StoredCustomer | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const isAuthPage = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    const syncCity = () => setCity(readCity());
    const syncAuth = () => setCustomer(readCustomer());
    syncCity();
    syncAuth();
    setAuthReady(true);
    const openLogin = () => setLoginOpen(true);
    window.addEventListener("selected_city_changed", syncCity);
    window.addEventListener("auth_changed", syncAuth);
    window.addEventListener("storage", syncAuth);
    window.addEventListener("open_customer_login", openLogin);
    return () => {
      window.removeEventListener("selected_city_changed", syncCity);
      window.removeEventListener("auth_changed", syncAuth);
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("open_customer_login", openLogin);
    };
  }, [pathname]);

  const handleCityChange = (next: string) => {
    const value = next && next !== "All Cities" ? next : "";
    setCity(value);
    if (value) localStorage.setItem("selected_city", value);
    else localStorage.removeItem("selected_city");
    window.dispatchEvent(new Event("selected_city_changed"));
  };

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    logoutCustomer(dispatch, { pathname: pathname || "/" });
    toast.success("Logged out successfully");
  };

  const cityLabel = city || "Select city";
  const displayName = customer?.name || customer?.email?.split("@")[0] || "Account";
  const initial = displayName.charAt(0).toUpperCase();
  const logoSrc = typeof images.logo === "string" ? images.logo : images.logo.src;

  return (
    <header className="sticky top-0 z-50 bg-white text-[#111111]">
      <div className="mx-auto w-full px-3 sm:px-4 md:px-5 lg:px-8 py-2 border-b-2 border-[#a044d9]">
        {/* Mobile: logo + actions, then full-width search */}
        <div className="flex flex-col gap-2 md:hidden">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <Link href="/" className="shrink-0 flex items-center min-w-0">
              <img
                src={logoSrc}
                alt="Book My Bota"
                className="h-8 w-auto object-contain object-left"
              />
            </Link>

            <div className="flex items-center gap-2 shrink-0 min-w-0">
              <button
                type="button"
                onClick={() => setCityOpen(true)}
                className="inline-flex h-8 items-center gap-0.5 min-w-0 text-[#111111] type-nav font-medium hover:text-[#6900AA] transition-colors cursor-pointer"
              >
                <MapPin size={13} className="shrink-0" />
                <span className="truncate">{cityLabel}</span>
                <ChevronDown size={11} className="shrink-0 opacity-80" />
              </button>

              <Link
                href="/gift-cards"
                aria-label="Gift Cards"
                className="w-8 h-8 rounded-full hover:bg-[#F7E9FF] text-[#111111] flex items-center justify-center shrink-0"
              >
                <Gift size={16} />
              </Link>

              <AuthSection
                authReady={authReady}
                customer={customer}
                displayName={displayName}
                initial={initial}
                isAuthPage={isAuthPage}
                onLogin={() => setLoginOpen(true)}
                onLogout={handleLogout}
              />
            </div>
          </div>

          <NavSearchBar onClick={() => setSearchOpen(true)} className="w-full" />
        </div>

        {/* Tablet + Desktop: logo | flexible search | actions */}
        <div className="hidden md:flex items-center gap-3 lg:gap-4 min-w-0">
          <Link href="/" className="shrink-0 flex items-center">
            <img
              src={logoSrc}
              alt="Book My Bota"
              className="h-12 lg:h-14 w-auto object-contain"
            />
          </Link>

          <NavSearchBar
            onClick={() => setSearchOpen(true)}
            className="flex-1 min-w-0 max-w-md lg:max-w-xl "
          />

          <div className="flex items-center gap-3 lg:gap-4 shrink-0 ml-auto">
            <button
              type="button"
              onClick={() => setCityOpen(true)}
              className="flex items-center gap-1.5 type-nav-md font-medium text-[#111111] cursor-pointer hover:text-[#6900AA] min-w-0"
            >
              <MapPin size={16} className="shrink-0" />
              <span className="truncate">{cityLabel}</span>
              <ChevronDown size={14} className="shrink-0 opacity-80" />
            </button>

            <HeaderDivider />

            <Link
              href="/gift-cards"
              className="inline-flex items-center gap-1.5 text-[#111111] type-nav-md font-semibold hover:text-[#6900AA] transition-colors whitespace-nowrap"
            >
              <Gift size={17} strokeWidth={2} />
              <span>Gift Cards</span>
            </Link>

            <HeaderDivider />

            <AuthSection
              authReady={authReady}
              customer={customer}
              displayName={displayName}
              initial={initial}
              isAuthPage={isAuthPage}
              onLogin={() => setLoginOpen(true)}
              onLogout={handleLogout}
            />
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        <SubNavBar />
      </Suspense>

      <CitySelectModal
        open={cityOpen}
        selected={city}
        onClose={() => setCityOpen(false)}
        onSelect={handleCityChange}
      />

      <SearchOverlay open={searchOpen} city={city} onClose={() => setSearchOpen(false)} />

      <CustomerAuthModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => setCustomer(readCustomer())}
      />
    </header>
  );
}
