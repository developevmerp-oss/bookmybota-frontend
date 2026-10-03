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
  WandSparkles,
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

/** Mobile/tablet only — first tab, links to landing page (desktop unchanged). */
const FOR_YOU_TAB: SubNavTab = {
  label: "For you",
  href: "/",
  match: "home",
  Icon: WandSparkles,
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

/** Desktop landing scroll: hide after this Y; show only after returning near top (hysteresis). */
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
      // Mobile/tablet keep categories sticky with search (reference). Desktop landing can collapse.
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
        applyHidden(false);
        return;
      }
      const y = window.scrollY;
      if (y <= LANDING_SHOW_BELOW_Y) {
        applyHidden(false);
      } else if (y >= LANDING_HIDE_AFTER_Y) {
        applyHidden(true);
      }
    };

    const frame = requestAnimationFrame(syncFromScroll);
    window.addEventListener("scroll", syncFromScroll, { passive: true });
    window.addEventListener("resize", syncFromScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", syncFromScroll);
      window.removeEventListener("resize", syncFromScroll);
    };
  }, [isLandingPage]);

  const diningHref =
    city && city !== "All Cities" ? `/dining?city=${encodeURIComponent(city)}` : "/dining";

  const linkTabs = TABS.filter((t) => t.variant !== "cta");
  const ctaTab = TABS.find((t) => t.variant === "cta");

  const isTabActive = (item: SubNavTab) => {
    if (item.match === "home") return isLandingPage;
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
  /** Mobile/tablet compact: titles only (icons hide) while sticky search+subnav stay. */
  const [compactMobile, setCompactMobile] = useState(false);

  useEffect(() => {
    const COMPACT_AFTER_Y = 72;
    const EXPAND_BELOW_Y = 24;
    let compact = false;
    const sync = () => {
      const isMobileTablet =
        typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
      if (!isMobileTablet) {
        if (compact) {
          compact = false;
          setCompactMobile(false);
        }
        return;
      }
      const y = window.scrollY;
      let next = compact;
      if (y >= COMPACT_AFTER_Y) next = true;
      else if (y <= EXPAND_BELOW_Y) next = false;
      if (next === compact) return;
      compact = next;
      setCompactMobile(next);
    };
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync, { passive: true });
    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [pathname]);

  const renderTabLink = (item: SubNavTab, classNameExtra = "") => {
    const { label, Icon } = item;
    const active = isTabActive(item);
    const href = tabHref(item, diningHref, categories);
    return (
      <Link
        key={label}
        href={href}
        tabIndex={collapsed ? -1 : undefined}
        className={`shrink-0 transition-colors whitespace-nowrap flex flex-col items-center justify-center gap-0.5 min-w-[4.5rem] sm:min-w-[5.25rem] md:min-w-[5.75rem] h-full px-3 sm:px-3.5 rounded-xl text-[12px] sm:text-[13px] md:text-[14px] font-semibold tracking-wide lg:inline-flex lg:flex-row lg:items-center lg:gap-1.5 lg:h-8 lg:min-w-0 lg:rounded-full lg:px-2.5 lg:text-[12px] xl:text-[13px] lg:uppercase ${
          active
            ? "bg-[#6900AA] text-white shadow-sm"
            : "text-[#57008E] hover:bg-[#EFD7FF] hover:text-[#6900AA]"
        } ${classNameExtra}`}
      >
        <Icon
          size={18}
          strokeWidth={2.25}
          className={`shrink-0 lg:!block lg:w-4 lg:h-4 transition-opacity duration-200 ${
            compactMobile ? "hidden" : "block"
          }`}
          aria-hidden
        />
        <span className="leading-tight">{label}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Browse categories"
      aria-hidden={collapsed}
      data-subnav-compact={compactMobile ? "1" : "0"}
      className={`border-t bg-[#F7E9FF] overflow-hidden sticky top-0 z-[1] transition-[max-height,opacity,border-color,height] duration-300 ease-in-out ${
        collapsed
          ? "max-h-0 opacity-0 border-transparent pointer-events-none lg:max-h-0"
          : compactMobile
            ? "max-h-11 h-11 opacity-100 border-[#E3BCFF] lg:max-h-12 lg:h-12"
            : "max-h-[4.75rem] h-[4.75rem] opacity-100 border-[#E3BCFF] lg:max-h-12 lg:h-12"
      }`}
    >
      <div className="container mx-auto px-3 sm:px-4 md:px-5 lg:px-8 h-full flex items-center justify-between gap-2 sm:gap-3 lg:gap-4">
        <div className="flex items-stretch gap-1.5 sm:gap-2 lg:gap-2 min-w-0 flex-1 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden h-full py-1.5 lg:py-0 lg:items-center">
          {/* Mobile/tablet only — wrapper wins over lg:inline-flex on the link */}
          <span className="contents lg:hidden">{renderTabLink(FOR_YOU_TAB)}</span>
          {linkTabs.map((item) => renderTabLink(item))}
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
