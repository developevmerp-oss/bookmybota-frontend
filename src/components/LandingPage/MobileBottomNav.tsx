"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Clapperboard,
  Home,
  UserRound,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { readSessionForRole } from "@/lib/authStorage";
import { isTokenExpired } from "@/lib/authSession";

const BRAND = "#6900AA";
const PROFILE_HREF = "/customer/profile";
const LOGIN_NEXT_KEY = "customer_login_next";

type NavItem = {
  label: string;
  href: string;
  Icon: LucideIcon;
  match: (pathname: string) => boolean;
  /** When set, guest taps open login instead of navigating to a gated route. */
  requiresCustomer?: boolean;
};

const ITEMS: NavItem[] = [
  {
    label: "Home",
    href: "/",
    Icon: Home,
    match: (p) => p === "/",
  },
  {
    label: "Dining",
    href: "/dining",
    Icon: UtensilsCrossed,
    match: (p) =>
      p === "/dining" ||
      p.startsWith("/dining/") ||
      p.startsWith("/restaurant/"),
  },
  {
    label: "Movie",
    href: "/movies",
    Icon: Clapperboard,
    match: (p) => p === "/movies" || p.startsWith("/movies/"),
  },
  {
    label: "Event",
    href: "/events",
    Icon: CalendarDays,
    match: (p) =>
      p === "/events" ||
      p.startsWith("/events/") ||
      p.startsWith("/venues/") ||
      p.startsWith("/artists/"),
  },
  {
    label: "Profile",
    href: PROFILE_HREF,
    Icon: UserRound,
    match: (p) => p.startsWith("/customer") || p === "/login" || p === "/register",
    requiresCustomer: true,
  },
];

function isCustomerLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  const session = readSessionForRole("customer");
  if (!session) return false;
  return !isTokenExpired(session.token);
}

function openCustomerLoginForProfile() {
  try {
    sessionStorage.setItem(LOGIN_NEXT_KEY, PROFILE_HREF);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("open_customer_login"));
}

/** BookMyShow-style sticky bottom tabs — mobile + tablet only. */
export default function MobileBottomNav() {
  const pathname = usePathname() || "/";
  const [customerLoggedIn, setCustomerLoggedIn] = useState(false);

  useEffect(() => {
    const sync = () => setCustomerLoggedIn(isCustomerLoggedIn());
    sync();
    window.addEventListener("auth_changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("auth_changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <nav
      data-mobile-bottom-nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-[60] border-t border-[#E8E8E8] bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/90 shadow-[0_-4px_20px_rgba(15,23,42,0.06)]"
      style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom, 0px))" }}
      aria-label="Primary"
    >
      <ul className="mx-auto flex h-[3.35rem] sm:h-[3.6rem] max-w-lg items-stretch justify-between px-1.5 sm:px-3">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          const Icon = item.Icon;
          const needsAuth = Boolean(item.requiresCustomer);
          const guestProfile = needsAuth && !customerLoggedIn;

          return (
            <li key={item.href} className="flex min-w-0 flex-1">
              {guestProfile ? (
                <button
                  type="button"
                  onClick={openCustomerLoginForProfile}
                  className="flex w-full min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition-colors cursor-pointer"
                  aria-label="Profile — sign in"
                >
                  <Icon
                    size={22}
                    strokeWidth={active ? 2.35 : 1.85}
                    className="shrink-0"
                    style={{ color: active ? BRAND : "#6B7280" }}
                    aria-hidden
                  />
                  <span
                    className={`truncate text-[10px] sm:text-[11px] leading-none ${
                      active ? "font-bold" : "font-medium"
                    }`}
                    style={{ color: active ? BRAND : "#6B7280" }}
                  >
                    {item.label}
                  </span>
                </button>
              ) : (
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="flex w-full min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition-colors"
                >
                  <Icon
                    size={22}
                    strokeWidth={active ? 2.35 : 1.85}
                    className="shrink-0"
                    style={{ color: active ? BRAND : "#6B7280" }}
                    aria-hidden
                  />
                  <span
                    className={`truncate text-[10px] sm:text-[11px] leading-none ${
                      active ? "font-bold" : "font-medium"
                    }`}
                    style={{ color: active ? BRAND : "#6B7280" }}
                  >
                    {item.label}
                  </span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Spacer so page content isn't hidden behind the fixed bottom nav (lg+ unused). */
export function MobileBottomNavSpacer() {
  return (
    <div
      className="lg:hidden shrink-0 pointer-events-none h-[calc(3.35rem+max(0.35rem,env(safe-area-inset-bottom,0px)))] sm:h-[calc(3.6rem+max(0.35rem,env(safe-area-inset-bottom,0px)))]"
      aria-hidden
    />
  );
}
