"use client";

import ContentRail from "./ContentRail";
import { EventPosterCard } from "./PosterCard";
import { useHomeCatalog } from "./useHomeCatalog";

export default function PopularEventsRail({ city }: { city: string }) {
  const { events, isLoadingEvents } = useHomeCatalog(city);
  const rated = [...events].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
  const items = (rated.some((e) => Number(e.rating) > 0) ? rated : events).slice(0, 12);
  const empty =
    !isLoadingEvents && items.length === 0
      ? `No events in ${city && city !== "All Cities" ? city : "your city"} yet`
      : undefined;

  return (
    <ContentRail
      title="Popular Events"
      seeAllHref="/events"
      label="popular events"
      isLoading={isLoadingEvents}
      empty={empty}
    >
      {items.map((event) => (
        <EventPosterCard key={event.id} event={event} city={city} />
      ))}
    </ContentRail>
  );
}
