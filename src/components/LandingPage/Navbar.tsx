"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaChevronDown, FaMapMarkerAlt } from "react-icons/fa";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Events" },
  { href: "/dining", label: "Dining" },
  { href: "#about", label: "About Us" },
  { href: "#contact", label: "Contact" },
];

const CITIES = ["Addis Ababa", "Hawassa", "Bahir Dar", "Gondar", "Dire Dawa", "Adama"];
const LANGUAGES = ["EN", "AM"];

type NavbarProps = {
  city: string;
  onCityChange: (city: string) => void;
};

export default function Navbar({ city, onCityChange }: NavbarProps) {
  const pathname = usePathname();
  const [cityOpen, setCityOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [lang, setLang] = useState("EN");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const cityRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsLoggedIn(Boolean(localStorage.getItem("user_customer")));
  }, [pathname]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (cityRef.current && !cityRef.current.contains(target)) setCityOpen(false);
      if (langRef.current && !langRef.current.contains(target)) setLangOpen(false);
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex items-center justify-between gap-3 sm:gap-6">
          <Link href="/" className="shrink-0 leading-none">
            <span className="block text-[22px] sm:text-[24px] font-extrabold tracking-tight">
              <span className="text-[#1B5E3B]">Book My </span>
              <span className="text-[#C9A227]">Bota</span>
            </span>
            <span className="block mt-0.5 text-[11px] font-semibold tracking-wide text-[#C9A227]">
              Events &amp; Dining
            </span>
          </Link>

          <nav className="flex items-center justify-center gap-4 sm:gap-7 min-w-0 overflow-x-auto scrollbar-hide">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative shrink-0 text-[13px] sm:text-sm font-medium pb-1 transition-colors ${
                  isActive(link.href)
                    ? "text-[#1B5E3B]"
                    : "text-slate-500 hover:text-[#1B5E3B]"
                }`}
              >
                {link.label}
                {isActive(link.href) && (
                  <span className="absolute left-0 right-0 -bottom-0.5 h-[2px] rounded-full bg-[#1B5E3B]" />
                )}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            <div className="relative" ref={cityRef}>
              <button
                type="button"
                onClick={() => {
                  setCityOpen((v) => !v);
                  setLangOpen(false);
                }}
                className="flex items-center gap-1.5 cursor-pointer"
              >
                <FaMapMarkerAlt size={16} className="text-[#C9A227] shrink-0" />
                <span className="max-w-[90px] sm:max-w-[130px] truncate text-sm font-semibold text-slate-800">
                  {city}
                </span>
              </button>
              {cityOpen && (
                <div className="absolute right-0 top-full mt-3 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50">
                  {CITIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        onCityChange(c);
                        setCityOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm cursor-pointer hover:bg-emerald-50 ${
                        c === city ? "text-[#1B5E3B] font-semibold" : "text-slate-700"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={langRef}>
              <button
                type="button"
                onClick={() => {
                  setLangOpen((v) => !v);
                  setCityOpen(false);
                }}
                className="flex items-center gap-1 text-sm font-semibold text-slate-800 cursor-pointer"
              >
                {lang}
                <FaChevronDown size={11} className="text-slate-500" />
              </button>
              {langOpen && (
                <div className="absolute right-0 top-full mt-3 w-24 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => {
                        setLang(l);
                        setLangOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm cursor-pointer hover:bg-emerald-50 ${
                        l === lang ? "text-[#1B5E3B] font-semibold" : "text-slate-700"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Link
              href={isLoggedIn ? "/customer/dashboard" : "/login"}
              className="inline-flex items-center bg-green-500 hover:bg-[#164e31] text-white text-[13px] sm:text-sm font-semibold px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg whitespace-nowrap transition-colors"
            >
              {isLoggedIn ? "My Account" : "Login / Sign Up"}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
