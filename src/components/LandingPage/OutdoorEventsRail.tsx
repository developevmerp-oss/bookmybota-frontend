"use client";

import { useMemo } from "react";
import ContentRail from "./ContentRail";
import { MusicEventCard } from "./PosterCard";
import { useHomeCatalog } from "./useHomeCatalog";
import { isOutdoorEvent } from "./homeUtils";

export default function OutdoorEventsRail({ city }: { city: string }) {
  const { cityEvents, fallbackEvents, categories, isLoadingEvents, hasCity } =
    useHomeCatalog(city);

  const items = useMemo(() => {
    const fromCity = cityEvents.filter(isOutdoorEvent);
    if (fromCity.length > 0 || !hasCity) return fromCity.slice(0, 16);
    return fallbackEvents.filter(isOutdoorEvent).slice(0, 16);
  }, [cityEvents, fallbackEvents, hasCity]);

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
