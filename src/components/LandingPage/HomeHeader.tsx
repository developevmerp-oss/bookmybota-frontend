"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChevronDown, Gift, Mic2, Search, Ticket, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import images from "@/Images";
import CitySelectModal from "./CitySelectModal";
import SearchOverlay from "./SearchOverlay";
import CustomerAuthModal from "@/components/Shared/CustomerAuthModal";
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

const BUSINESS_LINKS = [
  {
    href: "/organizer",
    label: "Events",
    description: "List & manage shows",
    Icon: Ticket,
  },
  {
    href: "/business",
    label: "Dining",
    description: "Partner your restaurant",
    Icon: UtensilsCrossed,
  },
  {
    href: "/venue",
    label: "Venue",
    description: "List & claim your venue",
    Icon: Building2,
  },
  {
    href: "/artist",
    label: "Artist",
    description: "Grow your artist profile",
    Icon: Mic2,
  },
] as const;

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

function ForBusinessMenu({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const triggerClass =
    size === "lg"
      ? "inline-flex h-11 items-center gap-1.5 px-4 rounded-full bg-[#F3F3F3] text-[#111111] type-nav-md font-medium hover:bg-[#F7E9FF] hover:text-[#6900AA] transition-colors whitespace-nowrap cursor-pointer"
      : size === "md"
        ? "inline-flex h-9 items-center gap-1 px-3 rounded-full bg-[#F3F3F3] text-[#111111] type-nav-md font-medium hover:bg-[#F7E9FF] hover:text-[#6900AA] transition-colors whitespace-nowrap cursor-pointer"
        : "inline-flex h-7 items-center gap-0.5 px-2 rounded-full bg-[#F3F3F3] text-[#111111] type-nav font-medium hover:bg-[#F7E9FF] hover:text-[#6900AA] transition-colors whitespace-nowrap cursor-pointer";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
      >
        {size === "sm" ? "Business" : "For Business"}
        <ChevronDown
          size={size === "sm" ? 11 : 14}
          className={`shrink-0 text-[#6B6B6B] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-[#E3BCFF] bg-white shadow-lg py-1.5 z-[60]"
        >
          {BUSINESS_LINKS.map(({ href, label, description, Icon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 px-3.5 py-2.5 hover:bg-[#F7E9FF] transition-colors"
            >
              <span className="mt-0.5 w-8 h-8 rounded-lg bg-[#F7E9FF] text-[#6900AA] flex items-center justify-center shrink-0">
                <Icon size={16} />
              </span>
              <span className="min-w-0">
                <span className="block type-nav-md font-semibold text-[#111111]">{label}</span>
                <span className="block type-label text-[#6B6B6B] mt-0.5">{description}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
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
    window.addEventListener("open_customer_login", openLogin);
    return () => {
      window.removeEventListener("selected_city_changed", syncCity);
      window.removeEventListener("auth_changed", syncAuth);
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("open_customer_login", openLogin);
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
    <header className="sticky top-0 z-50 bg-white border-b border-black/10">
      {/* Phone (< md) */}
      <div className="md:hidden px-2.5 py-2 flex items-center justify-between gap-2 min-w-0">
        <Link href="/" className="shrink-0 flex items-center min-w-0">
          <img src={logoSrc} alt="Book My Bota" className="h-6 w-auto max-w-[4.5rem] object-contain object-left" />
        </Link>

        <button
          type="button"
          className="w-7 h-7 rounded-full hover:bg-[#F7E9FF] flex items-center justify-center cursor-pointer shrink-0"
          aria-label="Search"
          onClick={() => setSearchOpen(true)}
        >
          <Search size={14} />
        </button>

        <button
          type="button"
          onClick={() => setCityOpen(true)}
          className="inline-flex h-7 items-center gap-0.5 px-1.5 rounded-full bg-[#F3F3F3] text-[#111111] type-nav font-medium hover:bg-[#F7E9FF] hover:text-[#6900AA] transition-colors cursor-pointer max-w-[5.5rem] min-w-0"
        >
          <span className="truncate">{cityLabel}</span>
          <ChevronDown size={11} className="shrink-0 text-[#6B6B6B]" />
        </button>

        <ForBusinessMenu size="sm" />

        {!authReady ? (
          <span className="w-7 h-7 shrink-0" />
        ) : customer ? (
          <CustomerDropdown onLogout={handleLogout} showGiftCards>
            <Link
              href="/customer/profile"
              aria-label={displayName}
              className="w-7 h-7 rounded-full border border-[#E3BCFF] bg-[#F7E9FF] flex items-center justify-center relative z-10 shrink-0"
            >
              <span className="w-6 h-6 rounded-full bg-[#7A00C6] text-white type-nav font-semibold flex items-center justify-center">
                {initial}
              </span>
            </Link>
          </CustomerDropdown>
        ) : isAuthPage ? (
          <span className="w-7 h-7 shrink-0" />
        ) : (
          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            className="inline-flex h-7 items-center px-2 rounded-full bg-[#6900AA] text-white type-nav font-semibold hover:bg-[#57008E] cursor-pointer shrink-0"
          >
            Login
          </button>
        )}
      </div>

      {/* Tablet (md → lg) */}
      <div className="hidden md:flex lg:hidden px-4 py-2.5 items-center justify-between gap-4">
        <Link href="/" className="shrink-0 flex items-center">
          <img src={logoSrc} alt="Book My Bota" className="h-10 w-auto object-contain" />
        </Link>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex w-full max-w-[17.5rem] min-w-0 relative cursor-pointer"
        >
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A] pointer-events-none" />
          <span className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#F7F7F7] type-nav-md text-[#9A9A9A] flex items-center text-left truncate whitespace-nowrap overflow-hidden">
            Search for Events, Dining and Experiences
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCityOpen(true)}
          className="flex items-center gap-1 type-nav-md font-medium text-[#111111] cursor-pointer hover:text-[#6900AA] max-w-[110px] shrink-0"
        >
          <span className="truncate">{cityLabel}</span>
          <ChevronDown size={14} className="shrink-0 text-[#6B6B6B]" />
        </button>

          <ForBusinessMenu size="md" />

          <Link
            href="/gift-cards"
            className="inline-flex h-9 items-center gap-1.5 px-3 rounded-full bg-[#F3F3F3] text-[#111111] type-nav-md font-medium hover:bg-[#F7E9FF] hover:text-[#6900AA] transition-colors whitespace-nowrap shrink-0"
          >
            <Gift size={16} className="shrink-0" />
            Gift Cards
          </Link>

        {!authReady ? (
          <span className="w-9 h-9 shrink-0" />
        ) : customer ? (
          <CustomerDropdown onLogout={handleLogout} showGiftCards>
            <Link
              href="/customer/profile"
              className="inline-flex h-9 items-center gap-1.5 pl-1 pr-2.5 rounded-full border border-[#E3BCFF] bg-[#F7E9FF] hover:bg-[#EFD7FF] transition-colors relative z-10"
            >
              <span className="w-7 h-7 rounded-full bg-[#7A00C6] text-white type-nav font-semibold flex items-center justify-center">
                {initial}
              </span>
              <span className="type-nav-md font-medium text-[#111111] max-w-[90px] truncate whitespace-nowrap">
                {displayName}
              </span>
            </Link>
          </CustomerDropdown>
        ) : isAuthPage ? (
          <span className="w-9 h-9 shrink-0" />
        ) : (
          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            className="inline-flex h-9 items-center px-3 rounded-full bg-[#6900AA] text-white type-nav-md font-semibold hover:bg-[#57008E] whitespace-nowrap cursor-pointer shrink-0"
          >
            Login
          </button>
        )}
      </div>

      {/* Desktop (lg+) */}
      <div className="hidden lg:flex container mx-auto h-auto px-6 xl:px-8 items-center gap-4">
        <Link href="/" className="shrink-0 flex items-center">
          <img src={logoSrc} alt="Book My Bota" className="h-15 xl:h-20 pt-2 w-auto object-contain" />
        </Link>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex min-w-0 w-[min(32rem,36%)] relative cursor-pointer"
        >
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A9A9A] pointer-events-none" />
          <span className="w-full h-15 pl-13 pr-4 rounded-lg bg-[#F7F7F7] type-nav-lg text-[#9A9A9A] flex items-center text-left truncate whitespace-nowrap overflow-hidden text-ellipsis">
            Search for Events, Dining and Experiences
          </span>
        </button>

        <div className="ml-auto flex items-center gap-6 xl:gap-8 shrink-0">
          <button
            type="button"
            onClick={() => setCityOpen(true)}
            className="flex items-center gap-1 type-nav-md font-medium text-[#111111] cursor-pointer hover:text-[#6900AA] max-w-[160px]"
          >
            <span className="truncate">{cityLabel}</span>
            <ChevronDown size={14} className="shrink-0 text-[#6B6B6B]" />
          </button>

          <ForBusinessMenu size="lg" />

          {!isAuthPage && (
            <Link
              href="/gift-cards"
              className="inline-flex h-11 items-center gap-2 px-4 rounded-full bg-[#F3F3F3] text-[#111111] text-sm font-medium hover:bg-[#F7E9FF] hover:text-[#6900AA] transition-colors whitespace-nowrap"
            >
              <Gift size={18} className="shrink-0" />
              Gift Cards
            </Link>
          )}

          {!authReady ? (
            <span className="w-[88px] h-9" />
          ) : customer ? (
            <CustomerDropdown onLogout={handleLogout} showGiftCards>
              <Link
                href="/customer/profile"
                className="inline-flex h-13 items-center gap-2 pl-1 pr-3 rounded-full border border-[#E3BCFF] bg-[#F7E9FF] hover:bg-[#EFD7FF] transition-colors relative z-10"
              >
                <span className="w-9 h-9 rounded-full bg-[#7A00C6] ml-1 text-white type-nav-md font-semibold flex items-center justify-center">
                  {initial}
                </span>
                <span className="type-nav-lg font-medium text-[#111111] max-w-[110px] truncate whitespace-nowrap">
                  {displayName}
                </span>
              </Link>
            </CustomerDropdown>
          ) : isAuthPage ? null : (
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="inline-flex h-9 items-center px-4 rounded-full bg-[#6900AA] text-white type-nav-md font-semibold hover:bg-[#57008E] shadow-[0_1px_2px_rgba(105,0,170,0.35)] transition-colors whitespace-nowrap cursor-pointer"
            >
              Login
            </button>
          )}
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
    </header>
  );
}
