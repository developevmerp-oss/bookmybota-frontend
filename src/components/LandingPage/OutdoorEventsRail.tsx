"use client";

import { useMemo } from "react";
import ContentRail from "./ContentRail";
import { MusicEventCard } from "./PosterCard";
import { useHomeCatalog } from "./useHomeCatalog";
import { isOutdoorEvent } from "./homeUtils";

export default function OutdoorEventsRail({ city }: { city: string }) {
  const { events, fallbackEvents, categories, isLoadingEvents } = useHomeCatalog(city);
  const pool = events.length > 0 ? events : fallbackEvents;
  const items = useMemo(() => pool.filter(isOutdoorEvent).slice(0, 16), [pool]);
  const outdoorCat = categories.find((c) => {
    const s = `${c.slug} ${c.name}`.toLowerCase();
    return s.includes("outdoor") || s.includes("open-air") || s.includes("open air");
  });
  const seeAllHref = outdoorCat
    ? `/events?category=${encodeURIComponent(outdoorCat.slug)}`
    : "/events?q=outdoor";
  const empty =
    !isLoadingEvents && items.length === 0 ? "No outdoor events yet" : undefined;

  return (
    <ContentRail
      title="Outdoor Events"
      seeAllHref={seeAllHref}
      label="outdoor events"
      isLoading={isLoadingEvents}
      empty={empty}
    >
      {items.map((event) => (
        <MusicEventCard key={event.id} event={event} city={city} />
      ))}
    </ContentRail>
  );
}
