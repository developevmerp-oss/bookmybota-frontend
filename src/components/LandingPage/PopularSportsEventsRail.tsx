"use client";

import { useRef } from "react";
import { useHorizontalScrollEdges } from "@/lib/useHorizontalScrollEdges";
import { SHOWCASE_SPORTS_EVENT_CARDS } from "@/data/showcaseEventCards";
import AdaptiveCardRow from "./AdaptiveCardRow";
import CityLocationEmptyState from "./CityLocationEmptyState";
import { RailOverlayNavButton, RailSeeAllLink } from "./RailChrome";
import { EventPosterCard, ShowcaseEventPosterCard } from "./PosterCard";
import { hasCityFilter, isSportsEvent } from "./homeUtils";
import { useHomeCatalog } from "./useHomeCatalog";

const MIN_VISIBLE = 5;

export default function PopularSportsEventsRail({ city }: { city: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { events, isLoadingEvents } = useHomeCatalog(city);
  const sportsEvents = events.filter(isSportsEvent).slice(0, 12);
  const hasCity = hasCityFilter(city);
  const isLoading = isLoadingEvents;
  const isEmpty = !isLoading && sportsEvents.length === 0;
  const useStatic = isEmpty && !hasCity;
  const cardCount = useStatic ? SHOWCASE_SPORTS_EVENT_CARDS.length : sportsEvents.length;
  const scrollEdges = useHorizontalScrollEdges(scrollerRef, [
    cardCount,
    useStatic,
    isLoading,
    isEmpty,
  ]);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="bg-white py-6 sm:py-8 lg:py-10">
      <div className="container mx-auto px-4 md:px-5 lg:px-8">
        <div className="flex items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          <h2 className="type-section font-semibold tracking-tight text-[#111111]">
            Popular Sports Events
          </h2>
          <RailSeeAllLink href="/events?category=sports" />
        </div>

        <div className="relative overflow-visible">
          {!isEmpty && scrollEdges.left ? (
            <RailOverlayNavButton
              direction="prev"
              side="left"
              label="Previous sports events"
              onClick={() => scrollBy(-1)}
            />
          ) : null}

          {isLoading ? (
            <AdaptiveCardRow minVisible={MIN_VISIBLE} scrollerRef={scrollerRef}>
              {Array.from({ length: MIN_VISIBLE }).map((_, i) => (
                <div key={i} className="adaptive-card-slot">
                  <div className="aspect-[2/3] w-full rounded-xl bg-[#F7F7F7]" />
                  <div className="mt-3 h-4 w-4/5 rounded bg-[#F7F7F7]" />
                  <div className="mt-2 h-3 w-3/5 rounded bg-[#F7F7F7]" />
                </div>
              ))}
            </AdaptiveCardRow>
          ) : isEmpty && hasCity ? (
            <CityLocationEmptyState categoryLabel="sports events" city={city} />
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

          {!isEmpty && scrollEdges.right ? (
            <RailOverlayNavButton
              direction="next"
              side="right"
              label="Next sports events"
              onClick={() => scrollBy(1)}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
