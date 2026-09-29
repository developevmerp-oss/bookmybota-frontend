"use client";

import { useMemo, useRef } from "react";
import { scrollRailBy, useHorizontalScrollEdges } from "@/lib/useHorizontalScrollEdges";
import { SHOWCASE_SPORTS_EVENT_CARDS } from "@/data/showcaseEventCards";
import AdaptiveCardRow from "./AdaptiveCardRow";
import CitySectionEmptyNotice from "./CitySectionEmptyNotice";
import { RailPagerNav, RailSeeAllLink } from "./RailChrome";
import { EventPosterCard, ShowcaseEventPosterCard } from "./PosterCard";
import { isSportsEvent, shouldShowShowcaseCards } from "./homeUtils";
import { useHomeCatalog } from "./useHomeCatalog";

const MIN_VISIBLE = 4;

export default function PopularSportsEventsRail({ city }: { city: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { cityEvents, fallbackEvents, isLoadingEvents, hasCity } = useHomeCatalog(city);

  const citySports = useMemo(
    () => cityEvents.filter(isSportsEvent),
    [cityEvents]
  );

  const sportsEvents = useMemo(() => {
    if (citySports.length > 0 || !hasCity) return citySports.slice(0, 12);
    return fallbackEvents.filter(isSportsEvent).slice(0, 12);
  }, [citySports, fallbackEvents, hasCity]);

  const isLoading = isLoadingEvents;
  const isEmpty = !isLoading && sportsEvents.length === 0;
  // City → global → showcase when both empty (even with city selected)
  const useStatic = shouldShowShowcaseCards(isEmpty);
  const cityHasNoSports = hasCity && !isLoading && citySports.length === 0;
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
    scrollRailBy(el, dir);
  };

  return (
    <section className="bg-white py-6 sm:py-8 lg:pb-5">
      <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0">
        <div className="flex items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl lg:text-xl font-bold text-slate-800">
              Popular Sports Events
            </h2>
            {cityHasNoSports ? (
              <CitySectionEmptyNotice message="No sports available in your city yet." />
            ) : null}
          </div>
          <RailSeeAllLink href="/events?category=sports" />
        </div>  

        <div>
          {isLoading ? (
            <AdaptiveCardRow
              minVisible={MIN_VISIBLE}
              scrollerRef={scrollerRef}
              className="adaptive-card-row--four"
            >
              {Array.from({ length: MIN_VISIBLE }).map((_, i) => (
                <div key={i} className="adaptive-card-slot">
                  <div className="aspect-[2/3] w-full rounded-xl bg-[#F7F7F7]" />
                  <div className="mt-3 h-4 w-4/5 rounded bg-[#F7F7F7]" />
                  <div className="mt-2 h-3 w-3/5 rounded bg-[#F7F7F7]" />
                </div>
              ))}
            </AdaptiveCardRow>
          ) : isEmpty && !useStatic ? (
            <p className="text-sm text-[#6B7280] py-6">No sports events available yet.</p>
          ) : (
            <AdaptiveCardRow
              minVisible={MIN_VISIBLE}
              scrollerRef={scrollerRef}
              className="adaptive-card-row--four"
            >
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

          {!(isEmpty && !useStatic) ? (
            <RailPagerNav
              canPrev={scrollEdges.left}
              canNext={scrollEdges.right}
              pageCount={scrollEdges.pageCount}
              activePage={scrollEdges.activePage}
              onPrev={() => scrollBy(-1)}
              onNext={() => scrollBy(1)}
              label="sports events"
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
