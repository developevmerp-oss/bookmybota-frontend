"use client";

import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, MapPin, Search, User } from "lucide-react";
// Gift — re-add when restoring Gift Cards in main header
import { toast } from "sonner";
import images from "@/Images";
import CitySelectModal from "./CitySelectModal";
import SearchOverlay from "./SearchOverlay";
import CustomerAuthModal from "@/components/Shared/CustomerAuthModal";
import SubNavBar, { ListYourShowCta } from "./SubNavBar";
import { useAppDispatch } from "@/lib/hooks";
import { logoutCustomer } from "@/lib/authSession";
import { coordsForCityName, writeStoredUserGeo, USER_GEO_STORAGE_KEY } from "@/lib/geoDistance";


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
const SEARCH_PLACEHOLDER_MOBILE = "Search for events, movies and restaurants";

function NavSearchBar({
  className,
  onClick,
  variant = "default",
}: {
  className?: string;
  onClick: () => void;
  /** Desktop header pill — taller bar; mobile — full-width pill under city row */
  variant?: "default" | "desktop" | "mobile";
}) {
  const isDesktop = variant === "desktop";
  const isMobile = variant === "mobile";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Search"
      className={`flex min-w-0 relative cursor-pointer text-left ${className ?? ""}`}
    >
      <Search
        size={isDesktop ? 18 : isMobile ? 18 : 20}
        strokeWidth={2}
        className={`absolute top-1/2 -translate-y-1/2 pointer-events-none shrink-0 ${
          isDesktop
            ? "left-4 text-[#9A9A9A]"
            : isMobile
              ? "left-3.5 text-[#6900AA]"
              : "left-3.5 text-[#666666]"
        }`}
      />
      <span
        className={
          isDesktop
            ? "w-full h-10 xl:h-11 pl-11 pr-5 rounded-full border border-[#E0E0E0] bg-[#F8F8F8] text-[0.875rem] xl:text-[0.9375rem] text-[#9A9A9A] font-normal flex items-center truncate whitespace-nowrap overflow-hidden"
            : isMobile
              ? "w-full h-11 sm:h-12 pl-10 pr-4 rounded-full border border-[#E0E0E0] bg-white text-[0.8125rem] sm:text-[0.875rem] text-[#9A9A9A] font-normal flex items-center truncate whitespace-nowrap overflow-hidden"
              : "w-full h-9 sm:h-10 pl-10 pr-4 rounded-full border border-[#DDDDDD] bg-white text-[0.75rem] sm:text-[0.8125rem] lg:text-[1rem] text-[#888888] font-normal flex items-center truncate whitespace-nowrap overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        }
      >
        {isMobile ? SEARCH_PLACEHOLDER_MOBILE : SEARCH_PLACEHOLDER}
      </span>
    </button>
  );
}

function CustomerDropdown({
  onLogout,
  showGiftCards = false,
  initial,
  displayName,
  avatarOnly = false,
}: {
  onLogout: (e: React.MouseEvent) => void;
  showGiftCards?: boolean;
  initial: string;
  displayName: string;
  avatarOnly?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const [isPinnedByClick, setIsPinnedByClick] = useState(false);

  // Auto-close when pathname changes (route navigated)
  useEffect(() => {
    setIsOpen(false);
    setIsPinnedByClick(false);
  }, [pathname]);

  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    // If pinned by click, do not dismiss on mouse leave
    if (isPinnedByClick) return;
    cancelClose();
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 600);
  };

  const handleMouseEnter = () => {
    cancelClose();
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    scheduleClose();
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    cancelClose();
    if (isPinnedByClick) {
      // If already pinned by click, clicking again closes it
      setIsOpen(false);
      setIsPinnedByClick(false);
    } else {
      // Pin it open so it will never close on mouse move
      setIsOpen(true);
      setIsPinnedByClick(true);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsPinnedByClick(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setIsPinnedByClick(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleItemClick = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      setIsOpen(false);
      setIsPinnedByClick(false);
      return;
    }
    router.push(href);
    setTimeout(() => {
      setIsOpen(false);
      setIsPinnedByClick(false);
    }, 150);
  };

  const handleLogoutClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(false);
    setIsPinnedByClick(false);
    onLogout(e);
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative inline-block text-left"
    >
      <button
        type="button"
        onClick={handleToggleClick}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="User account menu"
        className="inline-flex items-center gap-2 rounded-full relative z-10 shrink-0 cursor-pointer select-none focus:outline-none"
      >
        <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#7A00C6] text-white type-nav-md font-bold flex items-center justify-center transition-transform hover:scale-105 shadow-sm">
          {initial}
        </span>
        {!avatarOnly && (
          <span className="hidden lg:inline type-nav-md font-semibold text-[#111111] whitespace-nowrap">
            {displayName}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="absolute right-0 top-full pt-1.5 w-64 z-[100] before:absolute before:-top-10 before:-left-36 before:right-0 before:h-12 before:content-['']"
        >
          <div className="rounded-xl border border-[#E3BCFF] bg-white shadow-xl py-1.5 overflow-hidden ring-1 ring-black/5">
            <Link
              href="/customer/profile"
              onClick={handleItemClick("/customer/profile")}
              className="block px-4 py-2.5 type-nav-md font-medium text-[#111111] hover:bg-[#F7E9FF] transition-colors"
            >
              My Profile
            </Link>
            <Link
              href="/customer/change-password"
              onClick={handleItemClick("/customer/change-password")}
              className="block px-4 py-2.5 type-nav-md font-medium text-[#111111] hover:bg-[#F7E9FF] transition-colors"
            >
              Change Password
            </Link>
            <Link
              href="/customer/dashboard"
              onClick={handleItemClick("/customer/dashboard")}
              className="block px-4 py-2.5 type-nav-md font-medium text-[#111111] hover:bg-[#F7E9FF] transition-colors"
            >
              My Orders / Reservations
            </Link>
            <Link
              href="/customer/favourite"
              onClick={handleItemClick("/customer/favourite")}
              className="block px-4 py-2.5 type-nav-md font-medium text-[#111111] hover:bg-[#F7E9FF] transition-colors"
            >
              My Favourite
            </Link>
            {showGiftCards && (
              <Link
                href="/customer/gift-cards"
                onClick={handleItemClick("/customer/gift-cards")}
                className="block px-4 py-2.5 type-nav-md font-medium text-[#111111] hover:bg-[#F7E9FF] transition-colors"
              >
                My Gift Cards
              </Link>
            )}
            <Link
              href="/customer/help"
              onClick={handleItemClick("/customer/help")}
              className="block px-4 py-2.5 type-nav-md font-medium text-[#111111] hover:bg-[#F7E9FF] transition-colors"
            >
              Help Centre
            </Link>
            <Link
              href="/customer/offers"
              onClick={handleItemClick("/customer/offers")}
              className="block px-4 py-2.5 type-nav-md font-medium text-[#111111] hover:bg-[#F7E9FF] transition-colors"
            >
              Offers
            </Link>
            <button
              type="button"
              onClick={handleLogoutClick}
              className="block w-full text-left px-4 py-2.5 type-nav-md font-medium text-red-600 hover:bg-[#F7E9FF] transition-colors cursor-pointer"
            >
              Log out
            </button>
          </div>
        </div>
      )}
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
  /** Avatar/circle only — no name, guest = gray circle with profile icon */
  avatarOnly = false,
}: {
  authReady: boolean;
  customer: StoredCustomer | null;
  displayName: string;
  initial: string;
  isAuthPage: boolean;
  onLogin: () => void;
  onLogout: (e: React.MouseEvent) => void;
  avatarOnly?: boolean;
}) {
  if (!authReady) {
    return <span className={`shrink-0 ${avatarOnly ? "w-8 h-8 sm:w-9 sm:h-9" : "w-16 h-9"}`} />;
  }

  if (customer) {
    return (
      <CustomerDropdown
        onLogout={onLogout}
        showGiftCards
        initial={initial}
        displayName={displayName}
        avatarOnly={avatarOnly}
      />
    );
  }

  if (isAuthPage) return null;

  if (avatarOnly) {
    return (
      <button
        type="button"
        onClick={onLogin}
        aria-label="Login"
        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#E8E8E8] text-[#666666] flex items-center justify-center shrink-0 cursor-pointer hover:bg-[#E0E0E0] transition-colors"
      >
        <User size={18} strokeWidth={2} />
      </button>
    );
  }

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

/** Mobile/tablet paddings unchanged; desktop uses lg:px-8 like reference. */
const NAV_CONTAINER = "mx-auto w-full px-5 sm:px-10 lg:px-8";

export default function HomeHeader() {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const [city, setCity] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [customer, setCustomer] = useState<StoredCustomer | null>(null);
  const [authReady, setAuthReady] = useState(false);
  /** After scroll: sticky subheader shows logo + categories + profile. */
  const [compactHeader, setCompactHeader] = useState(false);
  const isAuthPage = pathname === "/login" || pathname === "/register";
  /** Detail pages — hide site header + subnav on mobile/tablet only */
  const hideChromeOnMobileTablet = Boolean(
    (pathname?.match(/^\/movies\/[^/]+\/?$/) && pathname !== "/movies/cinemas") ||
      pathname?.match(/^\/movies\/[^/]+\/showtimes\/?$/) ||
      pathname?.match(/^\/movies\/cinemas\/[^/]+\/?$/) ||
      pathname?.match(/^\/events\/[^/]+(\/gallery)?\/?$/) ||
      pathname?.match(/^\/artists\/[^/]+\/?$/) ||
      pathname?.match(/^\/venues\/[^/]+\/?$/)
  );

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
    const openCity = () => setCityOpen(true);
    window.addEventListener("open_city_select", openCity);
    return () => {
      window.removeEventListener("selected_city_changed", syncCity);
      window.removeEventListener("auth_changed", syncAuth);
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("open_customer_login", openLogin);
      window.removeEventListener("open_city_select", openCity);
    };
  }, [pathname]);

  useLayoutEffect(() => {
    const mainHeader = document.querySelector<HTMLElement>("[data-site-main-header]");
    /** Compact chrome only after main header has fully scrolled away — avoids logo/profile doubling. */
    const compactAfterY = () => Math.max(mainHeader?.offsetHeight ?? 88, 88);
    const expandBelowY = () => 12;
    // Sync from real scrollY — do not start local `compact` at false while React
    // state may still be true from the previous route (skips setState and leaves
    // sticky logo/login duplicated under the main header until the user scrolls).
    let compact = window.scrollY >= compactAfterY();
    setCompactHeader(compact);
    const onScroll = () => {
      const y = window.scrollY;
      let next = compact;
      if (y >= compactAfterY()) next = true;
      else if (y <= expandBelowY()) next = false;
      if (next === compact) return;
      compact = next;
      setCompactHeader(next);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    // Parent layout also scrollTo(0) on route change — re-sync after that.
    const raf = window.requestAnimationFrame(() => {
      if (window.scrollY <= expandBelowY()) {
        compact = false;
        setCompactHeader(false);
      } else {
        onScroll();
      }
    });
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname]);

  const handleCityChange = (next: string) => {
    const value = next && next !== "All Cities" ? next : "";
    setCity(value);
    if (value) {
      localStorage.setItem("selected_city", value);
      const coords = coordsForCityName(value);
      if (coords) {
        writeStoredUserGeo({
          ...coords,
          source: "city",
          city: value,
          updatedAt: Date.now(),
        });
      }
    } else {
      localStorage.removeItem("selected_city");
      // Drop city pin so distance falls back to current GPS/IP
      try {
        sessionStorage.removeItem(USER_GEO_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new Event("bmb_user_geo_changed"));
    }
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
  const [diningDetailNavHidden, setDiningDetailNavHidden] = useState(false);
  const [diningBookImmersive, setDiningBookImmersive] = useState(false);

  useEffect(() => {
    const sync = () => {
      setDiningDetailNavHidden(document.body.dataset.diningDetailNav === "1");
      setDiningBookImmersive(document.body.dataset.diningBookImmersive === "1");
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-dining-detail-nav", "data-dining-book-immersive"],
    });
    return () => observer.disconnect();
  }, []);

  const listYourShowActive =
    pathname === "/list-your-show" || Boolean(pathname?.startsWith("/list-your-show/"));

  const subNav = (
    <Suspense fallback={null}>
      <SubNavBar isStickyChrome={compactHeader} />
    </Suspense>
  );

  return (
    <>
      {/* Main header — scrolls away (not sticky). Logo/profile live here only until compact. */}
      <header
        data-site-main-header
        className={`relative z-[60] w-full overflow-visible bg-white text-[#111111] border-b border-[#E8E8E8] transition-transform duration-300 ease-out ${
          diningBookImmersive
            ? "hidden"
            : diningDetailNavHidden
              ? "-translate-y-full pointer-events-none max-md:hidden"
              : hideChromeOnMobileTablet
                ? "max-lg:hidden"
                : "translate-y-0"
        }`}
        aria-hidden={diningDetailNavHidden || undefined}
        data-header-compact={compactHeader ? "1" : "0"}
      >
        <div className={`${NAV_CONTAINER} py-2 min-w-0`}>
          {/* Mobile + tablet: city | search icon + profile */}
          <div className="flex flex-nowrap items-center justify-between gap-2 min-w-0 lg:hidden">
            <button
              type="button"
              onClick={() => setCityOpen(true)}
              className="inline-flex h-9 items-center gap-1 min-w-0 max-w-[calc(100%-5.5rem)] text-[#111111] type-nav font-semibold hover:text-[#6900AA] transition-colors cursor-pointer"
            >
              <MapPin size={16} className="shrink-0 text-[#6900AA]" />
              <span className="truncate">{cityLabel}</span>
              <ChevronDown size={14} className="shrink-0 opacity-80" />
            </button>

            <div
              className={`flex items-center gap-1.5 sm:gap-2 shrink-0 transition-opacity duration-200 ${
                compactHeader ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}
              aria-hidden={compactHeader || undefined}
            >
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
                tabIndex={compactHeader ? -1 : undefined}
                className="w-9 h-9 rounded-full hover:bg-[#F7E9FF] text-[#111111] flex items-center justify-center shrink-0 cursor-pointer"
              >
                <Search size={18} strokeWidth={2} />
              </button>

              <AuthSection
                authReady={authReady}
                customer={customer}
                displayName={displayName}
                initial={initial}
                isAuthPage={isAuthPage}
                onLogin={() => setLoginOpen(true)}
                onLogout={handleLogout}
                avatarOnly
              />
            </div>
          </div>

          {/* Desktop: logo left | search dead-center | city | Login right */}
          <div className="relative hidden lg:flex items-center justify-between min-w-0 py-2.5 min-h-[3.75rem]">
            <Link
              href="/"
              className={`relative z-10 shrink-0 flex items-center transition-opacity duration-200 ${
                compactHeader ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}
              aria-hidden={compactHeader || undefined}
              tabIndex={compactHeader ? -1 : undefined}
            >
              <img
                src={logoSrc}
                alt="Book My Bota"
                className="hh-12 lg:h-14 w-auto object-contain"
              />
            </Link>

            {/* True horizontal center of the header */}
            <div className="pointer-events-none absolute inset-y-0 left-1/2 z-[1] flex w-[min(52%,42rem)] xl:w-[min(50%,46rem)] 2xl:w-[min(48%,48rem)] -translate-x-1/2 items-center">
              <NavSearchBar
                variant="desktop"
                onClick={() => setSearchOpen(true)}
                className="pointer-events-auto w-full min-w-0"
              />
            </div>

            <div className="relative z-10 flex items-center gap-3 xl:gap-3.5 shrink-0 min-w-0 pl-4">
              <button
                type="button"
                onClick={() => setCityOpen(true)}
                className="flex items-center gap-1.5 type-nav-md font-medium text-[#111111] cursor-pointer hover:text-[#6900AA] min-w-0 max-w-[9rem] xl:max-w-[12rem]"
              >
                <MapPin size={16} strokeWidth={2} className="shrink-0" />
                <span className="truncate">{cityLabel}</span>
                <ChevronDown size={14} strokeWidth={2} className="shrink-0 opacity-80" />
              </button>

              <span className="w-px h-5 bg-[#D0D0D0] shrink-0" aria-hidden />

              <div
                className={`transition-opacity duration-200 ${
                  compactHeader ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}
                aria-hidden={compactHeader || undefined}
              >
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
        </div>
      </header>

      {/* Subheader — sticky */}
      <div
        data-site-sticky-subheader="1"
        className={`sticky top-0 z-50 w-full overflow-x-clip border-b border-[#E8E8E8] bg-white transition-shadow duration-300 ${
          diningBookImmersive
            ? "hidden"
            : diningDetailNavHidden
              ? "-translate-y-full pointer-events-none max-md:hidden"
              : hideChromeOnMobileTablet
                ? "max-lg:hidden"
                : ""
        } ${
          compactHeader
            ? "shadow-[0_2px_10px_rgba(0,0,0,0.08)] max-lg:border-t max-lg:border-[#E8E8E8]"
            : "shadow-none lg:shadow-none max-lg:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
        }`}
        aria-hidden={diningDetailNavHidden || undefined}
      >
        {/* Mobile/tablet sticky only: search pill above categories */}
        {compactHeader ? (
          <div className="lg:hidden mx-auto w-full px-3 sm:px-4 md:px-5 pt-2.5 pb-0 min-w-0">
            <NavSearchBar
              variant="mobile"
              onClick={() => setSearchOpen(true)}
              className="w-full"
            />
          </div>
        ) : null}

        <div
          className={`min-w-0 w-full items-center ${
            compactHeader
              ? // Desktop sticky: mx-auto w-full … lg:px-8 flex items-center lg:gap-5
                "mx-auto w-full px-3 sm:px-4 md:px-5 max-lg:pt-1 max-lg:flex max-lg:flex-nowrap max-lg:gap-2 lg:px-8 lg:flex lg:items-center lg:gap-5"
              : // Desktop non-sticky: padding comes from SubNavBar bmb-section-container
                "mx-auto flex flex-nowrap gap-2 sm:gap-3 px-3 sm:px-4 md:px-5 lg:block lg:px-0"
          }`}
        >
          {/* Desktop sticky only — logo left (same size as main header logo) */}
          <Link
            href="/"
            className={`shrink-0 items-center ${
              compactHeader
                ? "hidden lg:flex animate-bmb-sticky-chrome"
                : "hidden"
            }`}
            aria-hidden={!compactHeader}
            tabIndex={compactHeader ? undefined : -1}
          >
            <img
              src={logoSrc}
              alt="Book My Bota"
              className="hh-12 lg:h-14 w-auto object-contain"
            />
          </Link>

          {/* Categories — full width when not sticky; flex-1 middle when sticky */}
          <div
            className={`min-w-0 max-w-full overflow-hidden ${
              compactHeader
                ? "flex-1 lg:min-w-0"
                : "flex-1 lg:w-full"
            }`}
          >
            {subNav}
          </div>

          {/* Desktop sticky only — search + location + List Your Show + profile */}
          <div
            className={`relative z-10 shrink-0 items-center ${
              compactHeader
                ? "hidden lg:flex gap-2.5 xl:gap-3.5 animate-bmb-sticky-chrome-delay"
                : "hidden"
            }`}
            aria-hidden={!compactHeader}
          >
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              tabIndex={compactHeader ? undefined : -1}
              className="w-9 h-9 text-[#111111] flex items-center justify-center shrink-0 cursor-pointer hover:opacity-70 transition-opacity"
            >
              <Search size={20} strokeWidth={2} />
            </button>

            <button
              type="button"
              onClick={() => setCityOpen(true)}
              aria-label={city ? `Change city, ${city}` : "Select city"}
              title={cityLabel}
              tabIndex={compactHeader ? undefined : -1}
              className="w-9 h-9 text-[#111111] flex items-center justify-center shrink-0 cursor-pointer hover:opacity-70 transition-opacity"
            >
              <MapPin size={18} strokeWidth={2} />
            </button>

            <div className="flex shrink-0 items-center">
              <ListYourShowCta
                href="/list-your-show"
                label="List Your Show"
                active={listYourShowActive}
              />
            </div>

            <div className="shrink-0">
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
      </div>

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
    </>
  );
}
