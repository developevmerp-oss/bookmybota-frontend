"use client";

import { useMemo } from "react";
import ContentRail from "./ContentRail";
import { MusicEventCard } from "./PosterCard";
import { useHomeCatalog } from "./useHomeCatalog";
import { isMusicEvent } from "./homeUtils";

export default function MusicEventsRail({ city }: { city: string }) {
  const { cityEvents, fallbackEvents, categories, isLoadingEvents, hasCity } =
    useHomeCatalog(city);

  const items = useMemo(() => {
    const fromCity = cityEvents.filter(isMusicEvent);
    if (fromCity.length > 0 || !hasCity) return fromCity.slice(0, 16);
    return fallbackEvents.filter(isMusicEvent).slice(0, 16);
  }, [cityEvents, fallbackEvents, hasCity]);

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
