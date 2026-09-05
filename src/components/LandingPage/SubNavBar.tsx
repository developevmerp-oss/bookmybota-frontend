"use client";

import { useEffect, useRef, useState } from "react";
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
  { label: "List Your Show", href: "/list-your-show", match: "list-your-show", Icon: Ticket, variant: "cta" },
];

function tabHref(item: SubNavTab, diningHref: string, categories: Array<{ slug: string; name: string }>) {
  if (item.href && item.match === "dining") return diningHref;
  if (item.href) return item.href;
  if (item.key) return eventCategoryHref(item.key as EventCategoryKey, categories);
  return "/";
}

/** Landing scroll: hide after this Y; show only after returning near top (hysteresis). */
const LANDING_HIDE_AFTER_Y = 140;
const LANDING_SHOW_BELOW_Y = 56;

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
  const isLandingPage = pathname === "/";
  const [city, setCity] = useState("");
  const [hideOnScroll, setHideOnScroll] = useState(false);
  const hideOnScrollRef = useRef(false);

  useEffect(() => {
    const sync = () => {
      const stored = localStorage.getItem("selected_city") || "";
      setCity(stored && stored !== "All Cities" ? stored : "");
    };
    sync();
    window.addEventListener("selected_city_changed", sync);
    return () => window.removeEventListener("selected_city_changed", sync);
  }, []);

  useEffect(() => {
    if (!isLandingPage) return;

    const applyHidden = (next: boolean) => {
      if (hideOnScrollRef.current === next) return;
      hideOnScrollRef.current = next;
      setHideOnScroll(next);
    };

    const syncFromScroll = () => {
      const y = window.scrollY;
      if (y <= LANDING_SHOW_BELOW_Y) {
        applyHidden(false);
      } else if (y >= LANDING_HIDE_AFTER_Y) {
        applyHidden(true);
      }
      // Between thresholds: keep current state (hysteresis / no blink).
    };

    const frame = requestAnimationFrame(syncFromScroll);
    window.addEventListener("scroll", syncFromScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", syncFromScroll);
    };
  }, [isLandingPage]);

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

  const collapsed = isLandingPage && hideOnScroll;

  return (
    <nav
      aria-label="Browse categories"
      aria-hidden={collapsed}
      className={`border-t bg-[#F7E9FF] overflow-hidden transition-[max-height,opacity,border-color] duration-300 ease-in-out ${
        collapsed
          ? "max-h-0 opacity-0 border-transparent pointer-events-none"
          : "max-h-12 h-12 opacity-100 border-[#E3BCFF]"
      }`}
    >
      <div className="container mx-auto px-4 md:px-5 lg:px-8 h-full flex items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2 min-w-0 flex-1 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
          {linkTabs.map((item) => {
            const { label, Icon } = item;
            const active = isTabActive(item);
            const href = tabHref(item, diningHref, categories);
            return (
              <Link
                key={label}
                href={href}
                tabIndex={collapsed ? -1 : undefined}
                className={`inline-flex items-center gap-1.5 shrink-0 h-8 px-2.5 sm:px-3 rounded-full text-[12px] sm:text-[13px] font-semibold uppercase tracking-wide whitespace-nowrap transition-colors ${
                  active
                    ? "bg-[#6900AA] text-white shadow-sm"
                    : "text-[#57008E] hover:bg-[#EFD7FF] hover:text-[#6900AA]"
                }`}
              >
                <Icon size={16} strokeWidth={2.25} className="shrink-0" aria-hidden />
                {label}
              </Link>
            );
          })}
        </div>

        {ctaTab ? (
          <Link
            href={ctaTab.href!}
            tabIndex={collapsed ? -1 : undefined}
            className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-3.5 sm:px-4 rounded-full text-[12px] sm:text-[13px] font-semibold whitespace-nowrap transition-colors shadow-sm ${
              isTabActive(ctaTab)
                ? "bg-[#F5CE00] text-[#111111] ring-2 ring-[#6900AA]/25"
                : "bg-[#FFD600] text-[#111111] hover:bg-[#F5CE00]"
            }`}
          >
            {ctaTab.label}
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
