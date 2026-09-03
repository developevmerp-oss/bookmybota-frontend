"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Clapperboard,
  Laugh,
  Mic2,
  Music,
  Ticket,
  Trophy,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { useGetPublicEventFiltersQuery } from "@/services/api";
import {
  categorySlugsMatch,
  eventCategoryHref,
  resolveCategorySlug,
  type EventCategoryKey,
} from "@/lib/eventCategories";

type SubNavTab = {
  label: string;
  Icon: LucideIcon;
  href?: string;
  match?: string;
  key?: string;
  variant?: "link" | "cta";
};

const TABS: SubNavTab[] = [
  { label: "Dining", href: "/dining", match: "dining", Icon: UtensilsCrossed },
  { label: "Concert", key: "concert", Icon: Mic2 },
  { label: "Comedy", key: "comedy", Icon: Laugh },
  { label: "Music", key: "music", Icon: Music },
  { label: "Movie", href: "/movies", match: "movie", Icon: Clapperboard },
  { label: "Sports", key: "sports", Icon: Trophy },
  { label: "ListYourShow", href: "/list-your-show", match: "list-your-show", Icon: Ticket, variant: "cta" },
];

function tabHref(item: SubNavTab, diningHref: string, categories: Array<{ slug: string; name: string }>) {
  if (item.href && item.match === "dining") return diningHref;
  if (item.href) return item.href;
  if (item.key) return eventCategoryHref(item.key as EventCategoryKey, categories);
  return "/";
}

export default function SubNavBar() {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const { data: filters } = useGetPublicEventFiltersQuery();
  const categories = filters?.categories || [];
  const q = (searchParams.get("q") || "").toLowerCase();
  const activeSlug = (searchParams.get("category") || "").toLowerCase();
  const onEvents = pathname === "/events" || pathname.startsWith("/events/");
  const onMovies = pathname === "/movies" || pathname.startsWith("/movies/");
  const onDining = pathname === "/dining" || pathname.startsWith("/restaurant/");
  const [city, setCity] = useState("");

  useEffect(() => {
    const sync = () => {
      const stored = localStorage.getItem("selected_city") || "";
      setCity(stored && stored !== "All Cities" ? stored : "");
    };
    sync();
    window.addEventListener("selected_city_changed", sync);
    return () => window.removeEventListener("selected_city_changed", sync);
  }, []);

  const diningHref =
    city && city !== "All Cities" ? `/dining?city=${encodeURIComponent(city)}` : "/dining";

  const linkTabs = TABS.filter((t) => t.variant !== "cta");
  const ctaTab = TABS.find((t) => t.variant === "cta");

  const isTabActive = (item: SubNavTab) => {
    if (item.match === "dining") return onDining;
    if (item.match === "movie") return onMovies;
    if (item.match === "list-your-show") {
      return pathname === "/list-your-show" || pathname.startsWith("/list-your-show/");
    }
    if (item.href === "/#offers") {
      return pathname === "/" && typeof window !== "undefined" && window.location.hash === "#offers";
    }
    if (item.key) {
      if (!onEvents) return false;
      const itemSlug = resolveCategorySlug(item.key, categories);
      if (activeSlug) {
        return categorySlugsMatch(activeSlug, itemSlug, categories);
      }
      return q === item.key;
    }
    return false;
  };

  return (
    <nav
      aria-label="Browse categories"
      className="bg-[#a044d9] border-b border-[#b7b6b6] "
    >
      <div className="mx-auto w-full px-3 sm:px-4 md:px-5 lg:px-8 py-2 flex items-center justify-center gap-2 sm:gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {linkTabs.map((item) => {
          const { label, Icon } = item;
          const active = isTabActive(item);
          const href = tabHref(item, diningHref, categories);
          return (
            <Link
              key={label}
              href={href}
              className={`inline-flex items-center gap-1.5 shrink-0 px-2 sm:px-2.5 py-1.5 rounded-md text-[11px] sm:text-sm font-semibold uppercase tracking-wide whitespace-nowrap transition-colors ${
                active
                  ? "bg-[#FFD600] text-[#111111]"
                  : "text-white hover:text-white hover:bg-white/10"
              }`}
            >
              <Icon size={18} strokeWidth={2} className="shrink-0 sm:w-5 sm:h-5" aria-hidden />
              {label}
            </Link>
          );
        })}

        {ctaTab ? (
          <Link
            href={ctaTab.href!}
            className="shrink-0 inline-flex items-center justify-center h-8 sm:h-9 px-3 sm:px-4 rounded-md bg-[#f9df53] text-[#111111] text-[11px] sm:text-base font-normal hover:bg-[#F5CE00] transition-colors whitespace-nowrap ml-3 sm:ml-60"
          >
            {ctaTab.label}
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
