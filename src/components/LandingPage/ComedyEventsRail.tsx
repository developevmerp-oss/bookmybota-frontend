"use client";

import { useMemo } from "react";
import ContentRail from "./ContentRail";
import { MusicEventCard } from "./PosterCard";
import { useHomeCatalog } from "./useHomeCatalog";
import { isComedyEvent } from "./homeUtils";

export default function ComedyEventsRail({ city }: { city: string }) {
  const { events, fallbackEvents, categories, isLoadingEvents } = useHomeCatalog(city);
  const pool = events.length > 0 ? events : fallbackEvents;
  const items = useMemo(() => pool.filter(isComedyEvent).slice(0, 16), [pool]);
  const comedyCat = categories.find((c) => {
    const s = `${c.slug} ${c.name}`.toLowerCase();
    return s.includes("comedy") || s.includes("stand") || s.includes("laughter");
  });
  const seeAllHref = comedyCat
    ? `/events?category=${encodeURIComponent(comedyCat.slug)}`
    : "/events?q=comedy";
  const empty =
    !isLoadingEvents && items.length === 0 ? "No comedy events yet" : undefined;

  return (
    <ContentRail
      title="Laughter Therapy"
      seeAllHref={seeAllHref}
      label="comedy events"
      alt
      isLoading={isLoadingEvents}
      empty={empty}
    >
      {items.map((event) => (
        <MusicEventCard key={event.id} event={event} city={city} />
      ))}
    </ContentRail>
  );
}
