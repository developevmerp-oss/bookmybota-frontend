"use client";

import ContentRail from "./ContentRail";
import { DiningOverlayCard, ShowcaseDiningOverlayCard } from "./DiningOverlayCard";
import { SHOWCASE_BAR_CARDS } from "@/data/showcaseDiningCards";
import { useBarSceneCatalog } from "./useBarSceneCatalog";

/**
 * Overlay-card Raise a Glass rail — same data as BarSceneRail, different card UI.
 */
export default function OverlayBarRail({ city }: { city: string }) {
  const { items, isLoading, isEmpty, useStatic, seeAllHref } = useBarSceneCatalog(city);

  return (
    <ContentRail
      title="Raise a Glass"
      seeAllHref={seeAllHref}
      label="overlay-bars"
      cardStyle="dining"
      minVisible={4}
      isLoading={isLoading}
      empty={isEmpty && !useStatic ? "No bars available yet." : undefined}
    >
      {useStatic
        ? SHOWCASE_BAR_CARDS.map((place) => (
            <ShowcaseDiningOverlayCard
              key={`overlay-bar-${place.id}`}
              name={place.name}
              image={place.image}
              rating={place.rating}
              locality={place.locality}
              cuisine={place.cuisine}
              href={place.href}
            />
          ))
        : items.map((place) => (
            <DiningOverlayCard key={`overlay-bar-${place.id}`} place={place} />
          ))}
    </ContentRail>
  );
}
