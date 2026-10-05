"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, type WheelEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Building2,
  Clapperboard,
  Mic2,
  Search,
  Tent,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  useGetPublicMoviesQuery,
  useGetPublicRegisteredArtistsQuery,
  useGetPublicRegisteredVenuesQuery,
  type PublicEvent,
} from "@/services/api";
import { eventPortrait, isComedyEvent, isMusicEvent, isOutdoorEvent } from "./homeUtils";
import { useHomeCatalog } from "./useHomeCatalog";
import { lockBodyScroll } from "@/lib/lockBodyScroll";
import { artistHref, restaurantHref, venueHref } from "@/lib/businessPublicPath";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { CustomerPageShimmer } from "@/components/Shared/Shimmer";
import "@/components/DinningLandingPage/DiningSearchPopup.css";

type SearchOverlayProps = {
  open: boolean;
  city: string;
  onClose: () => void;
};

type TrendKind = "event" | "live" | "dining" | "category" | "artist" | "venue" | "movie";

type TrendItem = {
  id: string;
  label: string;
  href: string;
  kind: TrendKind;
  image?: string;
  /** Extra text used only for category chip filtering */
  categoryBlob?: string;
};

type SearchCategoryId =
  | "all"
  | "dining"
  | "events"
  | "comedy"
  | "movies"
  | "concert"
  | "music"
  | "sports";

const SEARCH_PLACEHOLDER = "Search for Movies, Events, Plays, Sports and Activities";

const SEARCH_CATEGORIES: Array<{ id: SearchCategoryId; label: string }> = [
  { id: "all", label: "All" },
  { id: "dining", label: "Dining" },
  { id: "events", label: "Events" },
  { id: "comedy", label: "Comedy" },
  { id: "movies", label: "Movies" },
  { id: "concert", label: "Concert" },
  { id: "music", label: "Music" },
  { id: "sports", label: "Sports" },
];

function eventKind(event: PublicEvent): TrendKind {
  if (isMusicEvent(event) || isComedyEvent(event) || isOutdoorEvent(event)) return "live";
  const blob = `${event.category_slug || ""} ${event.category_name || ""}`.toLowerCase();
  if (blob.includes("sport") || blob.includes("play") || blob.includes("theatre") || blob.includes("theater")) {
    return "live";
  }
  return "event";
}

function matchesCategory(
  kind: TrendKind,
  category: SearchCategoryId,
  label = "",
  categoryBlob = ""
): boolean {
  if (category === "all") return true;
  const blob = `${kind} ${label} ${categoryBlob}`.toLowerCase();
  if (category === "dining") return kind === "dining";
  if (category === "movies") return kind === "movie" || blob.includes("movie");
  if (category === "events") {
    return kind === "event" || kind === "live" || kind === "category";
  }
  if (category === "comedy") return blob.includes("comedy");
  if (category === "concert") return blob.includes("concert");
  if (category === "music") return blob.includes("music") || kind === "artist";
  if (category === "sports") return blob.includes("sport");
  return true;
}

function movieHref(movie: { id: string; slug?: string }) {
  const key = (movie.slug || movie.id || "").trim();
  return key ? `/movies/${encodeURIComponent(key)}` : "/movies";
}

function toEventItem(e: PublicEvent): TrendItem {
  return {
    id: e.id,
    label: e.name,
    href: `/events/${e.id}`,
    kind: eventKind(e),
    image: eventPortrait(e),
    categoryBlob: `${e.category_slug || ""} ${e.category_name || ""}`,
  };
}

export default function SearchOverlay({ open, city, onClose }: SearchOverlayProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SearchCategoryId>("all");
  const { events, fallbackEvents, dining, categories, isLoadingEvents } = useHomeCatalog(city);
  const { data: artists = [] } = useGetPublicRegisteredArtistsQuery();
  const { data: venues = [] } = useGetPublicRegisteredVenuesQuery();
  const { data: moviesPage } = useGetPublicMoviesQuery(
    city && city !== "All Cities" ? { city, limit: 24 } : { limit: 24 }
  );
  const movies = moviesPage?.items ?? [];
  const pool = events.length > 0 ? events : fallbackEvents;

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCategory("all");
    const unlock = lockBodyScroll();
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      unlock();
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const trending = useMemo<TrendItem[]>(() => {
    const rated = [...pool].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    const source = rated.some((e) => Number(e.rating) > 0) ? rated : pool;
    const seen = new Set<string>();
    const items: TrendItem[] = [];
    for (const e of source) {
      const label = (e.name || "").trim();
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(toEventItem(e));
      if (items.length >= 10) break;
    }
    return items;
  }, [pool]);

  const filtered = useMemo<TrendItem[]>(() => {
    const q = query.trim().toLowerCase();
    const items: TrendItem[] = [];
    const seen = new Set<string>();
    const push = (item: TrendItem) => {
      if (!matchesCategory(item.kind, category, item.label, item.categoryBlob)) return;
      const key = `${item.kind}:${item.label.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push(item);
    };

    if (!q) {
      if (category === "dining") {
        for (const d of dining) {
          push({
            id: d.id,
            label: d.name,
            href: restaurantHref(d),
            kind: "dining",
            image: resolveMediaUrl(d.cover_image_url || ""),
            categoryBlob: "dining restaurant",
          });
          if (items.length >= 10) break;
        }
        return items;
      }
      if (category === "movies") {
        for (const m of movies) {
          const title = (m.title || "").trim();
          if (!title) continue;
          push({
            id: `movie-${m.id}`,
            label: title,
            href: movieHref(m),
            kind: "movie",
            image: resolveMediaUrl(m.poster_url || m.banner_url || ""),
            categoryBlob: `movie ${(m.genres || []).join(" ")}`,
          });
          if (items.length >= 10) break;
        }
        return items;
      }
      return trending.filter((item) =>
        matchesCategory(item.kind, category, item.label, item.categoryBlob)
      );
    }

    for (const e of pool) {
      if ((e.name || "").toLowerCase().includes(q) || (e.category_name || "").toLowerCase().includes(q)) {
        push(toEventItem(e));
      }
    }
    for (const c of categories) {
      if (c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)) {
        push({
          id: `cat-${c.slug}`,
          label: c.name,
          href: `/events?category=${encodeURIComponent(c.slug)}`,
          kind: "category",
          categoryBlob: `${c.slug} ${c.name}`,
        });
      }
    }
    for (const d of dining) {
      if ((d.name || "").toLowerCase().includes(q) || (d.cuisine || "").toLowerCase().includes(q)) {
        push({
          id: d.id,
          label: d.name,
          href: restaurantHref(d),
          kind: "dining",
          image: resolveMediaUrl(d.cover_image_url || ""),
          categoryBlob: "dining restaurant",
        });
      }
    }
    for (const m of movies) {
      const hay = `${m.title || ""} ${(m.genres || []).join(" ")}`.toLowerCase();
      if (hay.includes(q)) {
        push({
          id: `movie-${m.id}`,
          label: m.title,
          href: movieHref(m),
          kind: "movie",
          image: resolveMediaUrl(m.poster_url || m.banner_url || ""),
          categoryBlob: `movie ${(m.genres || []).join(" ")}`,
        });
      }
    }
    for (const a of artists) {
      const hay = `${a.name} ${a.type_name || ""} ${a.city_name || ""}`.toLowerCase();
      if (hay.includes(q)) {
        push({
          id: `artist-${a.id}`,
          label: a.type_name ? `${a.name} · ${a.type_name}` : a.name,
          href: artistHref(a),
          kind: "artist",
          image: resolveMediaUrl(a.cover_image_url || ""),
        });
      }
    }
    for (const v of venues) {
      const hay = `${v.name} ${v.type_name || ""} ${v.city_name || ""}`.toLowerCase();
      if (hay.includes(q)) {
        push({
          id: `venue-${v.id}`,
          label: v.type_name ? `${v.name} · ${v.type_name}` : v.name,
          href: venueHref(v),
          kind: "venue",
          image: resolveMediaUrl(v.cover_image_url || ""),
        });
      }
    }
    return items.slice(0, 12);
  }, [query, trending, pool, categories, dining, movies, artists, venues, category]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const commitSearch = (raw: string) => {
    const q = raw.trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    go(params.toString() ? `/events?${params.toString()}` : "/events");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    commitSearch(query);
  };

  if (!open || typeof document === "undefined") return null;

  const iconFor = (kind: TrendKind) => {
    if (kind === "dining") return UtensilsCrossed;
    if (kind === "live") return Tent;
    if (kind === "artist") return Mic2;
    if (kind === "venue") return Building2;
    if (kind === "movie") return Clapperboard;
    return Clapperboard;
  };

  const onChipsWheel = (e: WheelEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollWidth <= el.clientWidth) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  };

  const list = filtered;
  const listTitle = query.trim() ? "Search results" : "Trending Now";

  return createPortal(
    <div className="dining-search-popup fixed inset-0 z-[220] flex items-start justify-center px-4 pt-[min(12vh,96px)] sm:pt-[min(14vh,110px)]">
      <button
        type="button"
        aria-label="Close search"
        className="dining-search-popup__backdrop absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="dining-search-popup__panel relative z-[1] w-full max-w-[640px] min-w-0 bg-white rounded-2xl shadow-[0_18px_50px_rgba(15,23,42,0.18)] overflow-hidden"
      >
        <form onSubmit={submit} className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
          <div className="relative">
            <Search
              size={18}
              strokeWidth={1.75}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9A9A9A] pointer-events-none"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={SEARCH_PLACEHOLDER}
              className="w-full h-11 sm:h-12 pl-11 pr-10 rounded-full border border-[#DDDDDD] bg-[#F7F7F7] text-[14px] sm:text-[15px] text-slate-800 placeholder:text-[#9A9A9A] outline-none focus:ring-2 focus:ring-[#DDDDDD]"
              aria-label="Search"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 shrink-0 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-white/80 cursor-pointer"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
        </form>

        <div className="min-w-0 px-4 sm:px-5 pb-3">
          <div
            className="flex min-w-0 w-full flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain touch-pan-x scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ WebkitOverflowScrolling: "touch" }}
            onWheel={onChipsWheel}
          >
            {SEARCH_CATEGORIES.map((chip) => {
              const active = category === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setCategory(chip.id)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? "bg-[#6900AA] text-white"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          data-scroll-lock-container
          className="dining-search-popup__results border-t border-slate-100 max-h-[min(55vh,420px)] overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="px-4 sm:px-5 pt-4 pb-5">
            <p className="text-[15px] sm:text-base font-bold text-[#111111] mb-3">{listTitle}</p>
            {isLoadingEvents && query.trim() ? (
              <div className="py-2">
                <CustomerPageShimmer rows={2} />
              </div>
            ) : list.length === 0 ? (
              <p className="py-3 text-sm text-slate-400">
                {query.trim() ? "No matches found." : "Nothing trending yet."}
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {list.map((item) => {
                  const Icon = iconFor(item.kind);
                  const thumb = (item.image || "").trim();
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => go(item.href)}
                        className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-[#EDEDED] bg-white px-3 py-2.5 sm:px-3.5 sm:py-3 text-left shadow-[0_1px_4px_rgba(0,0,0,0.04)] cursor-pointer hover:bg-[#FAFAFA] transition-colors"
                      >
                        <span
                          className={`relative shrink-0 overflow-hidden bg-[#F3F3F3] ${
                            item.kind === "artist"
                              ? "h-11 w-11 rounded-full"
                              : item.kind === "movie"
                                ? "h-12 w-9 rounded-md"
                                : "h-11 w-11 rounded-lg"
                          }`}
                        >
                          {thumb ? (
                            <img
                              src={thumb}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center">
                              <Icon size={16} strokeWidth={1.75} className="text-[#9A9A9A]" />
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[15px] text-[#111111]">
                          {item.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
