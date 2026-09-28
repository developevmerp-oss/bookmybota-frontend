"use client";

import { useRef } from "react";
import { useGetPublicRegisteredVenuesQuery } from "@/services/api";
import { scrollRailBy, useHorizontalScrollEdges } from "@/lib/useHorizontalScrollEdges";
import AdaptiveCardRow from "./AdaptiveCardRow";
import { RailPagerNav, RailSeeAllLink } from "./RailChrome";
import { VenuePosterCard } from "./PosterCard";

const MIN_VISIBLE = 5;

export default function TopVenuesRail() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { data: venues = [], isLoading } = useGetPublicRegisteredVenuesQuery();
  const scrollEdges = useHorizontalScrollEdges(scrollerRef, [venues.length, isLoading]);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    scrollRailBy(el, dir);
  };

  return (
    <section className="bg-white py-6 sm:py-8 lg:py-0">
      <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0">
        <div className="flex items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          <h2 className="text-xl sm:text-2xl lg:text-xl font-bold text-slate-800">Top Venues</h2>
          <RailSeeAllLink href="/venues" />
        </div>

        {isLoading ? (
          <div className="flex gap-3 sm:gap-4 overflow-hidden py-1">
            {Array.from({ length: MIN_VISIBLE }).map((_, i) => (
              <div
                key={i}
                className="snap-start shrink-0 w-[180px] sm:w-[200px] md:w-[220px] rounded-2xl border border-[#EAEAEA] overflow-hidden bg-white"
              >
                <div className="aspect-[3/4] bg-[#F3F4F6] animate-pulse" />
                <div className="px-3.5 pt-3.5 pb-4 space-y-2">
                  <div className="h-4 w-4/5 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-3/5 bg-slate-50 rounded animate-pulse" />
                  <div className="h-3 w-1/3 bg-[#F7E9FF] rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : venues.length === 0 ? (
          <p className="text-sm text-[#6b6b6b] py-6">
            No registered venues yet. After venues are approved, they will appear here with free
            dates you can inquire about.
          </p>
        ) : (
          <div>
            <AdaptiveCardRow minVisible={MIN_VISIBLE} scrollerRef={scrollerRef}>
              {venues.map((venue) => (
                <VenuePosterCard key={venue.id} venue={venue} />
              ))}
            </AdaptiveCardRow>

            <RailPagerNav
              canPrev={scrollEdges.left}
              canNext={scrollEdges.right}
              pageCount={scrollEdges.pageCount}
              activePage={scrollEdges.activePage}
              onPrev={() => scrollBy(-1)}
              onNext={() => scrollBy(1)}
              label="venues"
            />
          </div>
        )}
      </div>
    </section>
  );
}
