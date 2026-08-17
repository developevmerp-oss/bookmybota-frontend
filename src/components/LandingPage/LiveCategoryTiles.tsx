"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PublicEvent } from "@/services/api";
import { useHomeCatalog } from "./useHomeCatalog";
import { eventPortrait } from "./homeUtils";

const GRADIENTS = [
  "from-[#7A2A95] to-[#E85AA8]",
  "from-[#3B82F6] to-[#1E3A8A]",
  "from-[#6D28D9] to-[#C4B5FD]",
  "from-[#DC2626] to-[#F97316]",
  "from-[#0F766E] to-[#2DD4BF]",
  "from-[#7C5CFF] to-[#C084FC]",
  "from-[#9A3412] to-[#F59E0B]",
  "from-[#1D4ED8] to-[#60A5FA]",
];

function titleLines(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [name.toUpperCase()];
  if (words.length === 2) return words.map((w) => w.toUpperCase());
  return [words.slice(0, -1).join(" ").toUpperCase(), words[words.length - 1].toUpperCase()];
}

function matchEvents(events: PublicEvent[], slug: string, name: string) {
  const s = slug.toLowerCase();
  const n = name.toLowerCase();
  return events.filter((e) => {
    const es = (e.category_slug || "").toLowerCase();
    const en = (e.category_name || "").toLowerCase();
    return es === s || en === n || es.includes(s) || en.includes(n);
  });
}

function coverFor(events: PublicEvent[]) {
  const withImg = events.find((e) => eventPortrait(e));
  return withImg ? eventPortrait(withImg) : "";
}

export default function LiveCategoryTiles({ city }: { city: string }) {
  const { categories, events, fallbackEvents, dining, isLoadingFilters } = useHomeCatalog(city);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pool = events.length > 0 ? events : fallbackEvents;

  const cards = useMemo(() => {
    const live = categories.map((cat, i) => {
      const matched = matchEvents(pool, cat.slug, cat.name);
      return {
        key: cat.slug,
        href: `/events?category=${encodeURIComponent(cat.slug)}`,
        title: cat.name,
        count: matched.length,
        image: coverFor(matched) || coverFor(pool),
        gradient: GRADIENTS[i % GRADIENTS.length],
      };
    });
    live.push({
      key: "dining",
      href: "/dining",
      title: "Dining",
      count: dining.length,
      image: dining.find((d) => d.cover_image_url)?.cover_image_url || "",
      gradient: "from-[#0F766E] to-[#5EEAD4]",
    });
    return live;
  }, [categories, pool, dining]);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  return (
    <section className="bg-white py-8 sm:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-[22px] sm:text-2xl font-semibold text-[#111111] mb-5">
          The Best of Live Events
        </h2>

        {isLoadingFilters ? (
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-[168px] sm:w-[184px] aspect-square rounded-2xl bg-[#F7F7F7] shrink-0" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <p className="text-sm text-[#6B6B6B] py-6">No event categories yet.</p>
        ) : (
          <div className="relative">
            <button
              type="button"
              aria-label="Previous categories"
              onClick={() => scrollBy(-1)}
              className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-[#EDEDED] items-center justify-center cursor-pointer hover:bg-[#F3EEFF]"
            >
              <ChevronLeft size={18} />
            </button>
            <div
              ref={scrollerRef}
              className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {cards.map((card) => {
                const lines = titleLines(card.title);
                return (
                  <Link
                    key={card.key}
                    href={card.href}
                    className="snap-start shrink-0 w-[168px] sm:w-[184px] aspect-square rounded-2xl overflow-hidden relative group"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient}`} />
                    <div className="relative z-10 p-4 pr-16">
                      {lines.map((line) => (
                        <p
                          key={line}
                          className="text-white font-extrabold uppercase text-lg sm:text-xl leading-[1.05] tracking-tight"
                        >
                          {line}
                        </p>
                      ))}
                      <p className="text-white font-semibold text-sm mt-2">
                        {card.count > 0 ? `${card.count}+ Events` : "Events"}
                      </p>
                    </div>
                    {card.image && (
                      <img
                        src={card.image}
                        alt=""
                        className="absolute bottom-0 right-0 w-[58%] h-[72%] object-cover object-top drop-shadow-lg group-hover:scale-105 transition-transform duration-300"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
            <button
              type="button"
              aria-label="Next categories"
              onClick={() => scrollBy(1)}
              className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-[#EDEDED] items-center justify-center cursor-pointer hover:bg-[#F3EEFF]"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
