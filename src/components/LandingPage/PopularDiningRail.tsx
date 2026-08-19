"use client";

import ContentRail from "./ContentRail";
import { DiningPosterCard } from "./PosterCard";
import { useHomeCatalog } from "./useHomeCatalog";

export default function PopularDiningRail({ city }: { city: string }) {
  const { dining, isLoadingDining } = useHomeCatalog(city);
  const items = dining.slice(0, 12);
  const empty =
    !isLoadingDining && items.length === 0
      ? `No restaurants in ${city && city !== "All Cities" ? city : "your city"} yet`
      : undefined;

  return (
    <ContentRail
      title="Popular Dining"
      seeAllHref="/dining"
      label="dining"
      cardStyle="dining"
      isLoading={isLoadingDining}
      empty={empty}
    >
      {items.map((place) => (
        <DiningPosterCard key={place.id} place={place} />
      ))}
    </ContentRail>
  );
}
