"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Clapperboard, Mic2, Search, Tent, UtensilsCrossed, X } from "lucide-react";
import {
  useGetPublicRegisteredArtistsQuery,
  useGetPublicRegisteredVenuesQuery,
  type PublicEvent,
} from "@/services/api";
import { isComedyEvent, isMusicEvent, isOutdoorEvent } from "./homeUtils";
import { useHomeCatalog } from "./useHomeCatalog";
import { lockBodyScroll } from "@/lib/lockBodyScroll";

type SearchOverlayProps = {
  open: boolean;
  city: string;
  onClose: () => void;
};

type TrendKind = "event" | "live" | "dining" | "category" | "artist" | "venue";

type TrendItem = {
  id: string;
  label: string;
  href: string;
  kind: TrendKind;
};

function eventKind(event: PublicEvent): TrendKind {
  if (isMusicEvent(event) || isComedyEvent(event) || isOutdoorEvent(event)) return "live";
  const blob = `${event.category_slug || ""} ${event.category_name || ""}`.toLowerCase();
  if (blob.includes("sport") || blob.includes("play") || blob.includes("theatre") || blob.includes("theater")) {
    return "live";
  }
  return "event";
}

export default function SearchOverlay({ open, city, onClose }: SearchOverlayProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const { events, fallbackEvents, dining, categories, isLoadingEvents } = useHomeCatalog(city);
  const { data: artists = [] } = useGetPublicRegisteredArtistsQuery();
  const { data: venues = [] } = useGetPublicRegisteredVenuesQuery();
  const pool = events.length > 0 ? events : fallbackEvents;

  useEffect(() => {
    if (!open) return;
    setQuery("");
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
      items.push({ id: e.id, label, href: `/events/${e.id}`, kind: eventKind(e) });
      if (items.length >= 10) break;
    }
    return items;
  }, [pool]);

  const filtered = useMemo<TrendItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trending;

    const items: TrendItem[] = [];
    const seen = new Set<string>();
    const push = (item: TrendItem) => {
      const key = `${item.kind}:${item.label.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push(item);
    };

    for (const e of pool) {
      if ((e.name || "").toLowerCase().includes(q) || (e.category_name || "").toLowerCase().includes(q)) {
        push({ id: e.id, label: e.name, href: `/events/${e.id}`, kind: eventKind(e) });
      }
    }
    for (const c of categories) {
      if (c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)) {
        push({
          id: `cat-${c.slug}`,
          label: c.name,
          href: `/events?category=${encodeURIComponent(c.slug)}`,
          kind: "category",
        });
      }
    }
    for (const d of dining) {
      if ((d.name || "").toLowerCase().includes(q) || (d.cuisine || "").toLowerCase().includes(q)) {
        push({ id: d.id, label: d.name, href: `/restaurant/${d.id}`, kind: "dining" });
      }
    }
    for (const a of artists) {
      const hay = `${a.name} ${a.type_name || ""} ${a.city_name || ""}`.toLowerCase();
      if (hay.includes(q)) {
        push({
          id: `artist-${a.id}`,
          label: a.type_name ? `${a.name} · ${a.type_name}` : a.name,
          href: `/artists/${a.id}`,
          kind: "artist",
        });
      }
    }
    for (const v of venues) {
      const hay = `${v.name} ${v.type_name || ""} ${v.city_name || ""}`.toLowerCase();
      if (hay.includes(q)) {
        push({
          id: `venue-${v.id}`,
          label: v.type_name ? `${v.name} · ${v.type_name}` : v.name,
          href: `/venues/${v.id}`,
          kind: "venue",
        });
      }
    }
    return items.slice(0, 12);
  }, [query, trending, pool, categories, dining, artists, venues]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (city && city !== "All Cities") params.set("city", city);
    go(`/events?${params.toString()}`);
  };

  if (!open) return null;

  const iconFor = (kind: TrendKind) => {
    if (kind === "dining") return UtensilsCrossed;
    if (kind === "live") return Tent;
    if (kind === "artist") return Mic2;
    if (kind === "venue") return Building2;
    return Clapperboard;
  };

  return (
    <div className="fixed inset-0 z-[90] bg-[#F7F7F7] overflow-y-auto" data-scroll-lock-container>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close search"
        className="absolute top-5 right-5 sm:top-6 sm:right-8 w-10 h-10 rounded-full hover:bg-white flex items-center justify-center cursor-pointer"
      >
        <X size={22} className="text-[#111111]" strokeWidth={1.75} />
      </button>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 sm:pt-14 pb-12">
        <form onSubmit={submit} className="mb-8">
          <div className="relative">
            <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for events, dining, artists, venues..."
              className="w-full h-12 sm:h-[52px] pl-12 pr-5 rounded-full bg-[#EEEEEE] type-card-title text-[#111111] placeholder:text-[#9A9A9A] outline-none focus:ring-2 focus:ring-[#6900AA]"
            />
          </div>
        </form>

        <h2 className="type-brand font-bold text-[#111111] mb-3">
          {query.trim() ? "Search results" : "Trending Now"}
        </h2>

        <div className="bg-white rounded-xl border border-[#EDEDED] shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
          {isLoadingEvents ? (
            <p className="px-5 py-6 type-body text-[#6B6B6B]">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="px-5 py-6 type-body text-[#6B6B6B]">
              {query.trim() ? "No matches found." : "No trending events yet."}
            </p>
          ) : (
            <ul>
              {filtered.map((item, i) => {
                const Icon = iconFor(item.kind);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => go(item.href)}
                      className={`w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left cursor-pointer hover:bg-[#F7F7F7] ${
                        i > 0 ? "border-t border-[#F0F0F0]" : ""
                      }`}
                    >
                      <span className="type-card-title text-[#111111] truncate">{item.label}</span>
                      <Icon size={16} className="text-[#9A9A9A] shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
