"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useGetPublicRegisteredVenuesQuery } from "@/services/api";
import AdaptiveCardRow from "./AdaptiveCardRow";
import { VenuePosterCard } from "./PosterCard";

const MIN_VISIBLE = 5;

export default function TopVenuesRail() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { data: venues = [], isLoading } = useGetPublicRegisteredVenuesQuery();
  const showArrows = venues.length > MIN_VISIBLE;

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="bg-white py-6 sm:py-8 lg:py-10">
      <div className="container mx-auto px-4 md:px-5 lg:px-8">
        <div className="flex items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          <h2 className="type-section font-semibold tracking-tight text-[#111111]">Top Venues</h2>
          <Link
            href="/venues"
            className="shrink-0 type-link font-medium text-[#6900AA] hover:text-[#57008E]"
          >
            See All ›
          </Link>
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
          <div className="relative">
            {showArrows ? (
              <button
                type="button"
                aria-label="Previous venues"
                onClick={() => scrollBy(-1)}
                className="hidden md:flex absolute -left-2 lg:-left-3 top-[38%] -translate-y-1/2 z-10 w-9 h-9 rounded-full items-center justify-center cursor-pointer bg-white border border-[#EDEDED] text-[#111111] shadow-sm hover:bg-[#F7E9FF]"
              >
                <ChevronLeft size={18} />
              </button>
            ) : null}

            <AdaptiveCardRow minVisible={MIN_VISIBLE} scrollerRef={scrollerRef}>
              {venues.map((venue) => (
                <VenuePosterCard key={venue.id} venue={venue} />
              ))}
            </AdaptiveCardRow>

            {showArrows ? (
              <button
                type="button"
                aria-label="Next venues"
                onClick={() => scrollBy(1)}
                className="hidden md:flex absolute -right-2 lg:-right-3 top-[38%] -translate-y-1/2 z-10 w-9 h-9 rounded-full items-center justify-center cursor-pointer bg-white border border-[#EDEDED] text-[#111111] shadow-sm hover:bg-[#F7E9FF]"
              >
                <ChevronRight size={18} />
              </button>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
