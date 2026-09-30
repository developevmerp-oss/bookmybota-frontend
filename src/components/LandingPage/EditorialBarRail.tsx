"use client";

import ContentRail from "./ContentRail";
import { DiningEditorialCard, ShowcaseDiningEditorialCard } from "./DiningEditorialCard";
import { SHOWCASE_BAR_CARDS } from "@/data/showcaseDiningCards";
import { useBarSceneCatalog } from "./useBarSceneCatalog";

/**
 * Editorial Raise a Glass rail — same data as BarSceneRail, new card UI.
 */
export default function EditorialBarRail({ city }: { city: string }) {
  const { items, isLoading, isEmpty, useStatic, seeAllHref } = useBarSceneCatalog(city);

  return (
    <ContentRail
      title="Raise a Glass"
      seeAllHref={seeAllHref}
      label="editorial-bars"
      cardStyle="dining"
      minVisible={4}
      isLoading={isLoading}
      empty={isEmpty && !useStatic ? "No bars available yet." : undefined}
    >
      {useStatic
        ? SHOWCASE_BAR_CARDS.map((place) => (
            <ShowcaseDiningEditorialCard
              key={`editorial-bar-${place.id}`}
              name={place.name}
              image={place.image}
              rating={place.rating}
              locality={place.locality}
              cuisine={place.cuisine}
              href={place.href}
            />
          ))
        : items.map((place) => (
            <DiningEditorialCard key={`editorial-bar-${place.id}`} place={place} />
          ))}
    </ContentRail>
  );
}
