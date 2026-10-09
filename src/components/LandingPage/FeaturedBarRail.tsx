"use client";

import ContentRail from "./ContentRail";
import { DiningDetailCard, ShowcaseDiningDetailCard } from "./DiningDetailCard";
import { SHOWCASE_BAR_CARDS } from "@/data/showcaseDiningCards";
import { useBarSceneCatalog } from "./useBarSceneCatalog";

/**
 * Detail-card Raise a Glass rail — same data as BarSceneRail, different card UI.
 */
export default function FeaturedBarRail({ city }: { city: string }) {
  const { items, isLoading, isEmpty, useStatic, seeAllHref, cityHasNoBars } =
    useBarSceneCatalog(city);

  return (
    <ContentRail
      title="Raise a Glass"
      cityNotice={
        cityHasNoBars ? "No bars available in your city yet." : undefined
      }
      seeAllHref={seeAllHref}
      label="featured-bars"
      cardStyle="dining"
      minVisible={4}
      isLoading={isLoading}
      empty={isEmpty && !useStatic ? "No bars available yet." : undefined}
    >
      {useStatic
        ? SHOWCASE_BAR_CARDS.map((place) => (
            <ShowcaseDiningDetailCard
              key={`featured-bar-${place.id}`}
              name={place.name}
              image={place.image}
              rating={place.rating}
              locality={place.locality}
              cuisine={place.cuisine}
              href={place.href}
            />
          ))
        : items.map((place) => (
            <DiningDetailCard key={`featured-bar-${place.id}`} place={place} />
          ))}
    </ContentRail>
  );
}
