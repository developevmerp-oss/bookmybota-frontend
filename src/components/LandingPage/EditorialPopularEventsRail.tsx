"use client";

import ContentRail from "./ContentRail";
import { EventEditorialCard, ShowcaseEventEditorialCard } from "./EventEditorialCard";
import { SHOWCASE_EVENT_CARDS } from "@/data/showcaseEventCards";
import { prioritizeEvents, shouldShowShowcaseCards } from "./homeUtils";
import { useHomeCatalog } from "./useHomeCatalog";

/**
 * Alternate Popular Events rail — clean editorial cards (category pill, gold date, From ETB).
 * Same data as PopularEventsRail; does not modify that component.
 */
export default function EditorialPopularEventsRail({ city }: { city: string }) {
  const { events, cityEvents, isLoadingEvents, hasCity } = useHomeCatalog(city);
  const items = prioritizeEvents(events).slice(0, 12);
  const isEmpty = !isLoadingEvents && items.length === 0;
  const useStatic = shouldShowShowcaseCards(isEmpty);
  const cityHasNoEvents = hasCity && !isLoadingEvents && cityEvents.length === 0;

  return (
    <ContentRail
      title="Popular Events"
      cityNotice={
        cityHasNoEvents ? "No events available in your city yet." : undefined
      }
      seeAllHref="/events"
      label="editorial-popular-events"
      minVisible={4}
      isLoading={isLoadingEvents}
      empty={isEmpty && !useStatic ? "No events available yet." : undefined}
    >
      {useStatic
        ? SHOWCASE_EVENT_CARDS.map((event) => (
            <ShowcaseEventEditorialCard
              key={`editorial-event-${event.id}`}
              id={event.id}
              title={event.title}
              image={event.image}
              showDate={event.showDate}
              place={event.place}
              eventType={event.eventType}
              href={event.href}
            />
          ))
        : items.map((event) => (
            <EventEditorialCard
              key={`editorial-event-${event.id}`}
              event={event}
              city={city}
            />
          ))}
    </ContentRail>
  );
}
