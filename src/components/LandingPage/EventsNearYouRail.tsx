"use client";

import ContentRail from "./ContentRail";
import { EventPosterCard } from "./PosterCard";
import { useHomeCatalog } from "./useHomeCatalog";

export default function EventsNearYouRail({ city }: { city: string }) {
  const { events, isLoadingEvents } = useHomeCatalog(city);
  const items = events.slice(0, 16);
  const labelCity = city && city !== "All Cities" ? city : "your city";
  const empty =
    !isLoadingEvents && items.length === 0 ? `No events in ${labelCity} yet` : undefined;

  return (
    <ContentRail
      title="Events Near You"
      seeAllHref="/events"
      label="events near you"
      isLoading={isLoadingEvents}
      empty={empty}
    >
      {items.map((event) => (
        <EventPosterCard key={event.id} event={event} />
      ))}
    </ContentRail>
  );
}
