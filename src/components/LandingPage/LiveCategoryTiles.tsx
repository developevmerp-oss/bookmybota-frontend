"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { PublicEvent } from "@/services/api";
import images from "@/Images";
import { useHomeCatalog } from "./useHomeCatalog";

function imageSrc(img: string | { src: string }) {
  return typeof img === "string" ? img : img.src;
}

const TARGET_TILES = [
  {
    key: "dining",
    title: "Dining",
    keywords: ["dining"],
    fallbackSlug: "dining",
    image: imageSrc(images.diningCard),
  },
  {
    key: "concert",
    title: "Concert",
    keywords: ["concert"],
    fallbackSlug: "concert",
    image: imageSrc(images.concertCard),
  },
  {
    key: "comedy",
    title: "Comedy",
    keywords: ["comedy"],
    fallbackSlug: "comedy",
    image: imageSrc(images.comedyCard),
  },
  {
    key: "music",
    title: "Music",
    keywords: ["music"],
    fallbackSlug: "music",
    image: imageSrc(images.musicCard),
  },
  {
    key: "movie",
    title: "Movie",
    keywords: ["movie", "movies", "film"],
    fallbackSlug: "movie",
    image: imageSrc(images.movieCard),
  },
  {
    key: "sports",
    title: "Sports",
    keywords: ["sports", "sport"],
    fallbackSlug: "sports",
    image: imageSrc(images.sportsCard),
  },
] as const;

function titleLines(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [name.toUpperCase()];
  if (words.length === 2) return words.map((w) => w.toUpperCase());
  return [words.slice(0, -1).join(" ").toUpperCase(), words[words.length - 1].toUpperCase()];
}

function matchEventsByKeywords(events: PublicEvent[], keywords: readonly string[]) {
  const keys = keywords.map((k) => k.toLowerCase());
  return events.filter((e) => {
    const es = (e.category_slug || "").toLowerCase();
    const en = (e.category_name || "").toLowerCase();
    return keys.some((k) => es === k || en === k || es.includes(k) || en.includes(k));
  });
}

export default function LiveCategoryTiles({ city }: { city: string }) {
  const { categories, events, fallbackEvents, dining, isLoadingFilters } = useHomeCatalog(city);
  const pool = events.length > 0 ? events : fallbackEvents;

  const cards = useMemo(() => {
    return TARGET_TILES.map((tile) => {
      if (tile.key === "dining") {
        return {
          key: tile.key,
          href: "/dining",
          title: tile.title,
          count: dining.length,
          image: tile.image,
        };
      }

      const matchedCategory = categories.find((cat) => {
        const slug = (cat.slug || "").toLowerCase();
        const name = (cat.name || "").toLowerCase();
        return tile.keywords.some((k) => slug.includes(k) || name.includes(k));
      });
      const matchedEvents = matchEventsByKeywords(pool, tile.keywords);

      return {
        key: tile.key,
        href: `/events?category=${encodeURIComponent(matchedCategory?.slug || tile.fallbackSlug)}`,
        title: tile.title,
        count: matchedEvents.length,
        image: tile.image,
      };
    });
  }, [categories, pool, dining]);

  return (
    <section className="bg-white py-5 sm:py-6 lg:py-3 lg:pb-4 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
      <div className="container mx-auto px-4 md:px-5 lg:px-8 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
        <h2 className="type-section font-semibold text-[#111111] mb-3 sm:mb-4 lg:mb-3 shrink-0">
          The Best of Live Events
        </h2>

        {isLoadingFilters ? (
          <div className="flex flex-wrap gap-2.5 sm:gap-3 md:gap-4 lg:flex-1 lg:min-h-0 lg:content-stretch">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="w-[calc((100%-0.625rem)/2)] sm:w-[calc((100%-1.5rem)/3)] md:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-5rem)/6)] aspect-[3/4] sm:aspect-[5/7] rounded-2xl bg-[#F7F7F7]"
              />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <p className="type-body text-[#6B6B6B] py-6">No event categories yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2.5 sm:gap-3 md:gap-4 lg:flex-1 lg:min-h-0 lg:content-stretch">
            {cards.map((card) => {
              const lines = titleLines(card.title);
              return (
                <Link
                  key={card.key}
                  href={card.href}
                  className="w-[calc((100%-0.625rem)/2)] sm:w-[calc((100%-1.5rem)/3)] md:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-5rem)/6)] aspect-[3/4] sm:aspect-[5/7] rounded-xl sm:rounded-2xl overflow-hidden relative group"
                >
                  <img
                    src={card.image}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/25 via-black/5 to-transparent" />
                  <div className="relative z-10 p-3 sm:p-5 lg:p-4 xl:p-5">
                    {lines.map((line) => (
                      <p
                        key={line}
                        className="text-white font-extrabold uppercase type-tile leading-[1.05] tracking-tight"
                      >
                        {line}
                      </p>
                    ))}
                    <p className="text-white font-semibold type-tile-meta mt-1.5 sm:mt-2">
                      {card.count > 0 ? `${card.count}+ Events` : "Events"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
