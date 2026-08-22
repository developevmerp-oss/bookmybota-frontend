"use client";

import ContentRail from "./ContentRail";
import { EventPosterCard } from "./PosterCard";
import { useHomeCatalog } from "./useHomeCatalog";

export default function RecommendedEventsRail({ city }: { city: string }) {
  const { events, isLoadingEvents } = useHomeCatalog(city);
  const items = events.slice(0, 12);
  const empty =
    !isLoadingEvents && items.length === 0
      ? `No events in ${city && city !== "All Cities" ? city : "your city"} yet`
      : undefined;

  return (
    <ContentRail
      title="Recommended Events"
      seeAllHref="/events"
      label="recommended events"
      isLoading={isLoadingEvents}
      empty={empty}
    >
      {items.map((event) => (
        <EventPosterCard key={event.id} event={event} city={city} />
      ))}
    </ContentRail>
  );
}
