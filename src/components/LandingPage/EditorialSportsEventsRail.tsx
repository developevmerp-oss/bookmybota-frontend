"use client";

import { useMemo } from "react";
import ContentRail from "./ContentRail";
import { EventEditorialCard, ShowcaseEventEditorialCard } from "./EventEditorialCard";
import { SHOWCASE_SPORTS_EVENT_CARDS } from "@/data/showcaseEventCards";
import { isSportsEvent, shouldShowShowcaseCards } from "./homeUtils";
import { useHomeCatalog } from "./useHomeCatalog";

/**
 * Alternate Popular Sports Events rail — same editorial card design as EditorialPopularEventsRail.
 * Same data as PopularSportsEventsRail; does not modify that component.
 */
export default function EditorialSportsEventsRail({ city }: { city: string }) {
  const { cityEvents, fallbackEvents, isLoadingEvents, hasCity } = useHomeCatalog(city);

  const citySports = useMemo(
    () => cityEvents.filter(isSportsEvent),
    [cityEvents]
  );

  const sportsEvents = useMemo(() => {
    if (citySports.length > 0 || !hasCity) return citySports.slice(0, 12);
    return fallbackEvents.filter(isSportsEvent).slice(0, 12);
  }, [citySports, fallbackEvents, hasCity]);

  const isEmpty = !isLoadingEvents && sportsEvents.length === 0;
  const useStatic = shouldShowShowcaseCards(isEmpty);
  const cityHasNoSports = hasCity && !isLoadingEvents && citySports.length === 0;

  return (
    <ContentRail
      title="Popular Sports Events"
      cityNotice={
        cityHasNoSports ? "No sports available in your city yet." : undefined
      }
      seeAllHref="/events?category=sports"
      label="editorial-sports-events"
      minVisible={4}
      isLoading={isLoadingEvents}
      empty={isEmpty && !useStatic ? "No sports events available yet." : undefined}
    >
      {useStatic
        ? SHOWCASE_SPORTS_EVENT_CARDS.map((event) => (
            <ShowcaseEventEditorialCard
              key={`editorial-sports-${event.id}`}
              id={event.id}
              title={event.title}
              image={event.image}
              showDate={event.showDate}
              place={event.place}
              eventType={event.eventType}
              href={event.href}
            />
          ))
        : sportsEvents.map((event) => (
            <EventEditorialCard
              key={`editorial-sports-${event.id}`}
              event={event}
              city={city}
            />
          ))}
    </ContentRail>
  );
}
