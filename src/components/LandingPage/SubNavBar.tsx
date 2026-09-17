"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Building2,
  CalendarDays,
  Clapperboard,
  Laugh,
  Mic2,
  Music,
  Ticket,
  Trophy,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { HiArrowRight } from "react-icons/hi";
import { useGetPublicEventFiltersQuery } from "@/services/api";
import {
  categorySlugsMatch,
  eventCategoryHref,
  resolveCategorySlug,
  type EventCategoryKey,
} from "@/lib/eventCategories";
import "./SubNavBar.css";

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
  { label: "Events", href: "/events", match: "events", Icon: CalendarDays },
  { label: "Concert", key: "concert", Icon: Mic2 },
  { label: "Comedy", key: "comedy", Icon: Laugh },
  { label: "Music", key: "music", Icon: Music },
  { label: "Movie", href: "/movies", match: "movie", Icon: Clapperboard },
  { label: "Sports", key: "sports", Icon: Trophy },
  { label: "Venues", href: "/venues", match: "venues", Icon: Building2 },
  { label: "Artists", href: "/artists", match: "artists", Icon: Mic2 },
  { label: "List Your Show", href: "/list-your-show", match: "list-your-show", Icon: Ticket, variant: "cta" },
];

function tabHref(item: SubNavTab, diningHref: string, categories: Array<{ slug: string; name: string }>) {
  if (item.href && item.match === "dining") return diningHref;
  if (item.href) return item.href;
  if (item.key) return eventCategoryHref(item.key as EventCategoryKey, categories);
  return "/";
}

function ListYourShowCta({
  href,
  label,
  active,
  tabIndex,
}: {
  href: string;
  label: string;
  active: boolean;
  tabIndex?: number;
}) {
  const btnRef = useRef<HTMLAnchorElement>(null);
  const circleRef = useRef<HTMLSpanElement>(null);
  const [filled, setFilled] = useState(false);

  const placeCircle = (clientX: number, clientY: number) => {
    const btn = btnRef.current;
    const circle = circleRef.current;
    if (!btn || !circle) return;
    const rect = btn.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    circle.style.left = `${x}px`;
    circle.style.top = `${y}px`;
    // Grow enough to cover the pill from any entry point
    const cover = Math.ceil((Math.hypot(rect.width, rect.height) * 2.2) / 12);
    circle.style.setProperty("--cta-scale", String(cover));
  };

  return (
    <Link
      ref={btnRef}
      href={href}
      tabIndex={tabIndex}
      aria-current={active ? "page" : undefined}
      className={`list-your-show-cta hidden lg:inline-flex shrink-0 items-center gap-1.5 h-8 px-3.5 sm:px-4 rounded-full text-[12px] sm:text-[13px] font-semibold whitespace-nowrap border border-[#6900AA] ${
        filled ? "is-filled" : ""
      }`}
      onMouseEnter={(e) => {
        placeCircle(e.clientX, e.clientY);
        setFilled(true);
      }}
      onMouseLeave={(e) => {
        placeCircle(e.clientX, e.clientY);
        setFilled(false);
      }}
    >
      <span ref={circleRef} className="list-your-show-cta__circle" aria-hidden />
      <span className="list-your-show-cta__label relative z-[1] inline-flex items-center gap-1.5">
        {label}
        <HiArrowRight size={14} aria-hidden className="shrink-0" />
      </span>
    </Link>
  );
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
  const onVenues = pathname === "/venues" || pathname.startsWith("/venues/");
  const onArtists = pathname === "/artists" || pathname.startsWith("/artists/");
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
    if (item.match === "venues") return onVenues;
    if (item.match === "artists") return onArtists;
    if (item.match === "events") {
      if (!onEvents) return false;
      if (!activeSlug && !q) return true;
      // Highlight Events when category isn't one of the dedicated Concert/Comedy/Music/Sports tabs
      const known = ["concert", "comedy", "music", "sports"] as const;
      const matchesKnown = known.some((key) =>
        categorySlugsMatch(activeSlug, resolveCategorySlug(key, categories), categories)
      );
      return !matchesKnown;
    }
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
          <ListYourShowCta
            href={ctaTab.href!}
            label={ctaTab.label}
            active={isTabActive(ctaTab)}
            tabIndex={collapsed ? -1 : undefined}
          />
        ) : null}
      </div>
    </nav>
  );
}
