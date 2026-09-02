"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useHorizontalScrollEdges } from "@/lib/useHorizontalScrollEdges";
import { SHOWCASE_SPORTS_EVENT_CARDS } from "@/data/showcaseEventCards";
import AdaptiveCardRow from "./AdaptiveCardRow";
import { EventPosterCard, ShowcaseEventPosterCard } from "./PosterCard";
import { isSportsEvent } from "./homeUtils";
import { useHomeCatalog } from "./useHomeCatalog";

const MIN_VISIBLE = 5;

export default function PopularSportsEventsRail({ city }: { city: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { events, fallbackEvents, isLoadingEvents, isLoadingFallback } = useHomeCatalog(city);
  const pool = events.length > 0 ? events : fallbackEvents;
  const sportsEvents = pool.filter(isSportsEvent).slice(0, 12);
  const useStatic = !isLoadingEvents && !isLoadingFallback && sportsEvents.length === 0;
  const cardCount = useStatic ? SHOWCASE_SPORTS_EVENT_CARDS.length : sportsEvents.length;
  const scrollEdges = useHorizontalScrollEdges(scrollerRef, [cardCount, useStatic, isLoadingEvents]);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  const isLoading = isLoadingEvents || isLoadingFallback;

  return (
    <section className="bg-white py-6 sm:py-8 lg:py-10">
      <div className="container mx-auto px-4 md:px-5 lg:px-8">
        <div className="flex items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          <h2 className="type-section font-semibold tracking-tight text-[#111111]">
            Popular Sports Events
          </h2>
          <Link
            href="/events?category=sports"
            className="shrink-0 type-link font-medium text-[#6900AA] hover:text-[#57008E]"
          >
            See All ›
          </Link>
        </div>

        <div className="relative">
          {scrollEdges.left && (
            <button
              type="button"
              aria-label="Previous sports events"
              onClick={() => scrollBy(-1)}
              className="hidden md:flex absolute -left-2 lg:-left-3 top-[38%] -translate-y-1/2 z-10 w-9 h-9 rounded-full items-center justify-center cursor-pointer bg-white border border-[#EDEDED] text-[#111111] shadow-sm hover:bg-[#F7E9FF]"
            >
              <ChevronLeft size={18} />
            </button>
          )}

          {isLoading ? (
            <AdaptiveCardRow minVisible={MIN_VISIBLE} scrollerRef={scrollerRef}>
              {Array.from({ length: MIN_VISIBLE }).map((_, i) => (
                <div key={i} className="adaptive-card-slot">
                  <div className="aspect-[3/4] w-full rounded-xl bg-[#F7F7F7]" />
                  <div className="mt-3 h-4 w-4/5 rounded bg-[#F7F7F7]" />
                  <div className="mt-2 h-3 w-3/5 rounded bg-[#F7F7F7]" />
                </div>
              ))}
            </AdaptiveCardRow>
          ) : (
            <AdaptiveCardRow minVisible={MIN_VISIBLE} scrollerRef={scrollerRef}>
              {useStatic
                ? SHOWCASE_SPORTS_EVENT_CARDS.map((event) => (
                    <ShowcaseEventPosterCard
                      key={event.id}
                      title={event.title}
                      image={event.image}
                      showDate={event.showDate}
                      place={event.place}
                      eventType={event.eventType}
                      href={event.href}
                    />
                  ))
                : sportsEvents.map((event) => (
                    <EventPosterCard key={event.id} event={event} city={city} />
                  ))}
            </AdaptiveCardRow>
          )}

          {scrollEdges.right && (
            <button
              type="button"
              aria-label="Next sports events"
              onClick={() => scrollBy(1)}
              className="hidden md:flex absolute -right-2 lg:-right-3 top-[38%] -translate-y-1/2 z-10 w-9 h-9 rounded-full items-center justify-center cursor-pointer bg-white border border-[#EDEDED] text-[#111111] shadow-sm hover:bg-[#F7E9FF]"
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
