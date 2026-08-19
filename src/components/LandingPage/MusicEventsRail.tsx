"use client";

import { useMemo } from "react";
import ContentRail from "./ContentRail";
import { MusicEventCard } from "./PosterCard";
import { useHomeCatalog } from "./useHomeCatalog";
import { isMusicEvent } from "./homeUtils";

export default function MusicEventsRail({ city }: { city: string }) {
  const { events, fallbackEvents, categories, isLoadingEvents } = useHomeCatalog(city);
  const pool = events.length > 0 ? events : fallbackEvents;
  const items = useMemo(() => pool.filter(isMusicEvent).slice(0, 16), [pool]);
  const musicCat = categories.find((c) => {
    const s = `${c.slug} ${c.name}`.toLowerCase();
    return s.includes("music") || s.includes("concert");
  });
  const seeAllHref = musicCat
    ? `/events?category=${encodeURIComponent(musicCat.slug)}`
    : "/events?q=music";
  const empty =
    !isLoadingEvents && items.length === 0 ? "No music events yet" : undefined;

  return (
    <ContentRail
      title="Your Music Studio"
      seeAllHref={seeAllHref}
      label="music events"
      isLoading={isLoadingEvents}
      empty={empty}
    >
      {items.map((event) => (
        <MusicEventCard key={event.id} event={event} city={city} />
      ))}
    </ContentRail>
  );
}
