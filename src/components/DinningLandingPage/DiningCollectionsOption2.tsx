"use client";

import { useRef } from "react";
import Link from "next/link";
import type { Collection } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { RailPagerNav } from "@/components/LandingPage/RailChrome";
import { scrollRailBy, useHorizontalScrollEdges } from "@/lib/useHorizontalScrollEdges";
import "./DiningCollectionsOption2.css";

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
    <Link href={href} className="dining-mood-card group cursor-pointer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={
          resolveMediaUrl(collection.image_url) ||
          "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80"
        }
        alt={collection.title}
        onError={(e) => {
          (e.target as HTMLImageElement).src =
            "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80";
        }}
      />
      <div className="dining-mood-card__scrim" aria-hidden />
      <div className="dining-mood-card__title">
        <h3 className="line-clamp-2">{collection.title}</h3>
      </div>
    </Link>
  );
}

/**
 * Dining homepage “What's your mood” — image + title.
 * Mobile 1+peek · tablet ~2.35 · desktop exactly 4 + pager.
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
    <div className="mt-3 sm:mt-4">
      <div
        ref={scrollerRef}
        className="dining-mood-rail"
        role="list"
        aria-label="Mood collections"
      >
        {collections.map((col) => (
          <div key={col.id} className="dining-mood-slot" role="listitem">
            <CollectionCardOption2 collection={col} city={city} />
          </div>
        ))}
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
          label="What's your mood"
        />
      </div>
    </div>
  );
}
