"use client";

import ContentRail from "./ContentRail";
import { DiningPosterCard, ShowcaseDiningPosterCard } from "./PosterCard";
import { SHOWCASE_BAR_CARDS } from "@/data/showcaseDiningCards";
import { useBarSceneCatalog } from "./useBarSceneCatalog";

export default function BarSceneRail({ city }: { city: string }) {
  const { items, isLoading, isEmpty, useStatic, seeAllHref } = useBarSceneCatalog(city);

  return (
    <ContentRail
      title="Raise a Glass"
      seeAllHref={seeAllHref}
      label="bars"
      cardStyle="dining"
      minVisible={4}
      isLoading={isLoading}
      empty={isEmpty && !useStatic ? "No bars available yet." : undefined}
    >
      {useStatic
        ? SHOWCASE_BAR_CARDS.map((place) => (
            <ShowcaseDiningPosterCard
              key={place.id}
              name={place.name}
              image={place.image}
              rating={place.rating}
              locality={place.locality}
              cuisine={place.cuisine}
            />
          ))
        : items.map((place) => (
            <DiningPosterCard key={place.id} place={place} />
          ))}
    </ContentRail>
  );
}
