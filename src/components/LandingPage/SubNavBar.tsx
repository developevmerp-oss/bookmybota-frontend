"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

export function ListYourShowCta({
  href,
  label,
  active,
  tabIndex,
  className = "",
}: {
  href: string;
  label: string;
  active: boolean;
  tabIndex?: number;
  className?: string;
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
      data-subnav-active={active ? "1" : undefined}
      className={`list-your-show-cta inline-flex shrink-0 items-center gap-1 h-7 sm:h-8 lg:h-9 px-2.5 sm:px-3.5 md:px-4 lg:px-4 rounded-full text-[11px] sm:text-[12px] md:text-[13px] lg:text-[13px] font-semibold whitespace-nowrap border bg-white ${
        active
          ? "border-[#6900AA] text-[#6900AA] ring-1 ring-[#6900AA]/25"
          : "border-[rgba(17,17,17,0.45)] text-[#111111]"
      } ${filled ? "is-filled" : ""} ${className}`.trim()}
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

type SubNavBarProps = {
  /** When sticky chrome is active, desktop CTA is rendered by the parent sticky bar. */
  isStickyChrome?: boolean;
};

export default function SubNavBar({ isStickyChrome = false }: SubNavBarProps) {
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

  /** Mobile/tablet compact: titles only (icons hide) while sticky subnav stays. */
  const [compactMobile, setCompactMobile] = useState(false);

  useLayoutEffect(() => {
    const COMPACT_AFTER_Y = 72;
    const EXPAND_BELOW_Y = 24;
    const isMobileTablet = () =>
      typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
    let compact = isMobileTablet() && window.scrollY >= COMPACT_AFTER_Y;
    setCompactMobile(compact);
    const sync = () => {
      if (!isMobileTablet()) {
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
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync, { passive: true });
    const raf = window.requestAnimationFrame(() => {
      if (!isMobileTablet() || window.scrollY <= EXPAND_BELOW_Y) {
        compact = false;
        setCompactMobile(false);
      } else {
        sync();
      }
    });
    return () => {
      window.cancelAnimationFrame(raf);
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
        aria-current={active ? "page" : undefined}
        data-subnav-active={active ? "1" : undefined}
        className={`subnav-tab shrink-0 transition-colors whitespace-nowrap flex flex-col items-center justify-center gap-0.5 min-w-[4.5rem] sm:min-w-[5.25rem] md:min-w-[5.75rem] h-full px-3 sm:px-3.5 rounded-xl text-[12px] sm:text-[13px] md:text-[14px] font-semibold tracking-wide lg:inline-flex lg:flex-row lg:items-center lg:gap-1.5 lg:h-auto lg:min-w-0 lg:text-[11px] xl:text-[12px] lg:uppercase lg:tracking-[0.04em] lg:font-semibold ${
          active
            ? "is-active bg-gradient-to-r from-[#A78BFA] to-[#6D28D9] text-white shadow-sm lg:rounded-full lg:px-3.5 xl:px-4 lg:py-1.5 xl:py-2"
            : "text-[#111111] hover:text-[#111111] lg:hover:text-[#6900AA] lg:rounded-none lg:px-0.5 lg:py-0"
        } ${classNameExtra}`}
      >
        <Icon
          size={18}
          strokeWidth={active ? 2.35 : 2}
          className={`shrink-0 lg:!block lg:w-[15px] lg:h-[15px] xl:w-4 xl:h-4 transition-opacity duration-200 ${
            compactMobile ? "hidden" : "block"
          } ${active ? "text-white" : ""}`}
          aria-hidden
        />
        <span className="leading-tight">{label}</span>
      </Link>
    );
  };

  // Keep the active tab visible in the horizontal strip (mobile / tablet / desktop)
  useEffect(() => {
    const el = document.querySelector<HTMLElement>("[data-subnav-active='1']");
    if (!el) return;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [pathname, activeSlug, q]);

  const categoryTabs = (
    <>
      {/* Mobile/tablet only — wrapper wins over lg:inline-flex on the link */}
      <span className="contents lg:hidden">{renderTabLink(FOR_YOU_TAB)}</span>
      {linkTabs.map((item) => renderTabLink(item))}
    </>
  );

  return (
    <nav
      aria-label="Browse categories"
      data-subnav-compact={compactMobile ? "1" : "0"}
      className={`relative w-full min-w-0 bg-transparent transition-[max-height,height] duration-300 ease-in-out ${
        !isStickyChrome
          ? // Desktop non-sticky: align with page sections; mobile padding unchanged (parent + reset)
            "bmb-section-container max-lg:!px-0 max-lg:max-w-none"
          : "max-w-full"
      } ${
        compactMobile
          ? "max-h-12 h-12 lg:max-h-14 lg:h-14"
          : "max-h-[5.25rem] h-[5.25rem] lg:max-h-14 lg:h-14"
      }`}
    >
      {/* Mobile / tablet — unchanged scroll strip */}
      <div className="flex h-full w-full min-w-0 max-w-full items-center lg:hidden">
        <div className="min-w-0 flex-1 max-w-full overflow-x-auto overscroll-x-contain touch-pan-x scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden h-full py-1.5">
          <div className="flex h-full w-max max-w-none items-stretch gap-1.5 sm:gap-2">
            {categoryTabs}
            {ctaTab ? (
              <span className="inline-flex shrink-0 items-center self-center pl-1 pr-0.5">
                <ListYourShowCta
                  href={ctaTab.href!}
                  label={ctaTab.label}
                  active={isTabActive(ctaTab)}
                />
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Desktop — image 1: categories left + List Your Show right; sticky: categories fill middle */}
      <div
        className={`hidden h-full w-full min-w-0 items-center overflow-x-auto overscroll-x-contain scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-1 lg:flex ${
          isStickyChrome ? "justify-center" : "justify-between gap-4"
        }`}
      >
        <div
          className={`flex h-full items-center ${
            isStickyChrome
              ? "w-max max-w-full gap-3.5 xl:gap-5 2xl:gap-6"
              : "min-w-0 flex-1 gap-3.5 xl:gap-5 2xl:gap-6 overflow-x-auto scrollbar-none"
          }`}
        >
          {categoryTabs}
        </div>
        {!isStickyChrome && ctaTab ? (
          <span className="inline-flex shrink-0 items-center self-center">
            <ListYourShowCta
              href={ctaTab.href!}
              label={ctaTab.label}
              active={isTabActive(ctaTab)}
            />
          </span>
        ) : null}
      </div>
    </nav>
  );
}
