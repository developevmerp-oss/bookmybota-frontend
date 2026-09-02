"use client";

import ContentRail from "./ContentRail";
import { EventPosterCard, ShowcaseEventPosterCard } from "./PosterCard";
import { SHOWCASE_EVENT_CARDS } from "@/data/showcaseEventCards";
import { useHomeCatalog } from "./useHomeCatalog";

export default function PopularEventsRail({ city }: { city: string }) {
  const { events, isLoadingEvents } = useHomeCatalog(city);
  const rated = [...events].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
  const items = (rated.some((e) => Number(e.rating) > 0) ? rated : events).slice(0, 12);
  const useStatic = !isLoadingEvents && items.length === 0;

  return (
    <ContentRail
      title="Popular Events"
      seeAllHref="/events"
      label="popular events"
      isLoading={isLoadingEvents}
    >
      {useStatic
        ? SHOWCASE_EVENT_CARDS.map((event) => (
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
        : items.map((event) => (
            <EventPosterCard key={event.id} event={event} city={city} />
          ))}
    </ContentRail>
  );
}
