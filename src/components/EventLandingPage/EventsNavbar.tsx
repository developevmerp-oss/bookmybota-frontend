"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaBell, FaChevronDown, FaHeart, FaMapMarkerAlt } from "react-icons/fa";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Events" },
  { href: "/dining", label: "Dining" },
  { href: "#categories", label: "Categories" },
  { href: "#about", label: "About Us" },
  { href: "#contact", label: "Contact" },
];

type EventsNavbarProps = {
  city: string;
  cityOptions: string[];
  onCityChange: (city: string) => void;
};

export default function EventsNavbar({ city, cityOptions, onCityChange }: EventsNavbarProps) {
  const pathname = usePathname();
  const [cityOpen, setCityOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const cityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsLoggedIn(Boolean(localStorage.getItem("user_customer")));
  }, [pathname]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) setCityOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href.startsWith("#")) return false;
    return pathname?.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-3 sm:gap-6">
          <Link href="/" className="shrink-0 leading-none">
            <span className="block text-[20px] sm:text-[22px] font-extrabold tracking-tight">
              <span className="text-[#1B5E3B]">Book My </span>
              <span className="text-slate-800">Bota</span>
              <span className="text-slate-700 font-bold"> Events</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center justify-center gap-5 min-w-0">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative shrink-0 text-sm font-medium pb-1 transition-colors ${
                  isActive(link.href) ? "text-[#1B5E3B]" : "text-slate-500 hover:text-[#1B5E3B]"
                }`}
              >
                {link.label}
                {isActive(link.href) && (
                  <span className="absolute left-0 right-0 -bottom-0.5 h-[2px] rounded-full bg-[#1B5E3B]" />
                )}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <div className="relative" ref={cityRef}>
              <button
                type="button"
                onClick={() => setCityOpen((v) => !v)}
                className="flex items-center gap-1.5 cursor-pointer"
              >
                <FaMapMarkerAlt size={14} className="text-[#1B5E3B] shrink-0" />
                <span className="max-w-[110px] truncate text-sm font-semibold text-slate-800">
                  {city || "All Cities"}
                </span>
                <FaChevronDown size={10} className="text-slate-400" />
              </button>
              {cityOpen && (
                <div className="absolute right-0 top-full mt-3 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50 max-h-64 overflow-y-auto">
                  {cityOptions.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        onCityChange(c);
                        setCityOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm cursor-pointer hover:bg-emerald-50 ${
                        c === (city || "All Cities") ? "text-[#1B5E3B] font-semibold" : "text-slate-700"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Link
              href={isLoggedIn ? "/customer/dashboard" : "/login"}
              className="text-slate-500 hover:text-[#1B5E3B]"
              aria-label="Favorites"
            >
              <FaHeart size={16} />
            </Link>
            <Link
              href={isLoggedIn ? "/customer/dashboard" : "/login"}
              className="text-slate-500 hover:text-[#1B5E3B]"
              aria-label="Notifications"
            >
              <FaBell size={16} />
            </Link>

            <Link
              href={isLoggedIn ? "/customer/dashboard" : "/login"}
              className="inline-flex items-center bg-[#1B5E3B] hover:bg-[#164e31] text-white text-sm font-semibold px-4 py-2 rounded-lg whitespace-nowrap transition-colors"
            >
              {isLoggedIn ? "My Account" : "Login / Sign Up"}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
