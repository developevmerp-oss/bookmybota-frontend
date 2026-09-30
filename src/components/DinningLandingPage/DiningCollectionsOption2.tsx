"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Collection } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { RailPagerNav } from "@/components/LandingPage/RailChrome";
import { scrollRailBy, useHorizontalScrollEdges } from "@/lib/useHorizontalScrollEdges";

function CollectionCardOption2({
  collection,
  city,
}: {
  collection: Collection;
  city?: string;
}) {
  const placesLabel =
    collection.places_count !== undefined
      ? `${collection.places_count} place${collection.places_count !== 1 ? "s" : ""}`
      : "0 places";
  const subtitle = collection.subtitle?.trim() || placesLabel;
  const href = city
    ? `/search?collection=${encodeURIComponent(collection.slug)}&city=${encodeURIComponent(city)}`
    : `/search?collection=${encodeURIComponent(collection.slug)}`;

  return (
    <Link
      href={href}
      className="relative shrink-0 snap-start block overflow-hidden rounded-2xl shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer group h-[248px] w-[calc((100vw-2.5rem-0.75rem)/2)] sm:h-[280px] sm:w-[calc((100vw-5rem-2rem)/3)] md:h-[300px] md:w-[calc((100vw-5rem-3rem)/4)] lg:h-[320px] lg:w-[calc((100%-4rem)/5)] xl:h-[330px] xl:w-[calc((100%-4rem)/5)]"
    >
      <img
        src={
          resolveMediaUrl(collection.image_url) ||
          "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80"
        }
        alt={collection.title}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        onError={(e) => {
          (e.target as HTMLImageElement).src =
            "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80";
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[55%] pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0) 100%)",
        }}
      />
      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-white font-bold text-base sm:text-lg leading-tight tracking-tight truncate">
            {collection.title}
          </h3>
          <p className="text-white/85 text-xs sm:text-sm mt-1 truncate">{subtitle}</p>
        </div>
        <span
          className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-white/80 flex items-center justify-center text-white group-hover:bg-white/15 transition-colors"
          aria-hidden
        >
          <ArrowRight size={16} strokeWidth={2} />
        </span>
      </div>
    </Link>
  );
}

/**
 * Dining homepage Collections — UI Option Two (gradient + title/subtitle + circular arrow).
 * Comment out the usage in DiningHomePage to hide this row.
 */
export default function DiningCollectionsOption2({
  collections,
  city,
}: {
  collections: Collection[];
  city?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollEdges = useHorizontalScrollEdges(scrollerRef, [collections.length]);

  if (collections.length === 0) return null;

  return (
    <div className="mt-4">
      <div
        ref={scrollerRef}
        className="overflow-x-auto pt-1 pb-1 scrollbar-hide scroll-smooth snap-x snap-mandatory"
      >
        <div className="flex w-full min-w-full gap-3 sm:gap-4">
          {collections.map((col) => (
            <CollectionCardOption2 key={`opt2-${col.id}`} collection={col} city={city} />
          ))}
        </div>
      </div>
      <RailPagerNav
        canPrev={scrollEdges.left}
        canNext={scrollEdges.right}
        pageCount={scrollEdges.pageCount}
        activePage={scrollEdges.activePage}
        onPrev={() => {
          if (scrollerRef.current) scrollRailBy(scrollerRef.current, -1);
        }}
        onNext={() => {
          if (scrollerRef.current) scrollRailBy(scrollerRef.current, 1);
        }}
        label="Collections option two"
      />
    </div>
  );
}
