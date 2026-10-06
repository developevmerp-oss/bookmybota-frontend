"use client";

import { useRef } from "react";
import Link from "next/link";
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
  const href = city
    ? `/search?collection=${encodeURIComponent(collection.slug)}&city=${encodeURIComponent(city)}`
    : `/search?collection=${encodeURIComponent(collection.slug)}`;

  return (
    <Link
      href={href}
      className="relative shrink-0 snap-start block overflow-hidden rounded-2xl shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer group h-[248px] w-[calc((100vw-2.5rem)/1.38)] sm:h-[280px] sm:w-[calc((100vw-5rem)/2.2)] md:h-[300px] md:w-[calc((100vw-5rem)/3.35)] lg:h-[320px] lg:w-auto lg:flex-[0_0_calc((100%-3rem)/4)] xl:h-[330px]"
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
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className="text-white font-bold text-[15px] sm:text-base leading-tight tracking-tight">
          {collection.title}
        </h3>
      </div>
    </Link>
  );
}

/**
 * Dining homepage Collections — image + title only.
 * Mobile: one roomy card + peek. Desktop: exactly 4 full cards + pager nav.
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
    <div className="mt-5">
      {/* Full-bleed peek on mobile/tablet; desktop clips to exactly 4 cards */}
      <div className="lg:mx-0 -mx-4 sm:-mx-5 md:-mx-6 px-4 sm:px-5 md:px-6 lg:px-0">
        <div
          ref={scrollerRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto pt-1 pb-1 scrollbar-hide scroll-smooth snap-x snap-mandatory pr-4 sm:pr-5 md:pr-6 lg:pr-0 lg:gap-4"
        >
          {collections.map((col) => (
            <CollectionCardOption2 key={col.id} collection={col} city={city} />
          ))}
        </div>
      </div>
      <div className="hidden lg:block">
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
          label="Collections"
        />
      </div>
    </div>
  );
}
