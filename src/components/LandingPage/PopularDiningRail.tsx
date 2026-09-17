"use client";

import ContentRail from "./ContentRail";
import { DiningPosterCard, ShowcaseDiningPosterCard } from "./PosterCard";
import CityLocationEmptyState from "./CityLocationEmptyState";
import { SHOWCASE_DINING_CARDS } from "@/data/showcaseDiningCards";
import { hasCityFilter } from "./homeUtils";
import { useHomeCatalog } from "./useHomeCatalog";

export default function PopularDiningRail({ city }: { city: string }) {
  const { dining, isLoadingDining } = useHomeCatalog(city);
  const items = dining.slice(0, 12);
  const hasCity = hasCityFilter(city);
  const isEmpty = !isLoadingDining && items.length === 0;
  const useStatic = isEmpty && !hasCity;
  const seeAllHref =
    city && city !== "All Cities"
      ? `/dining?city=${encodeURIComponent(city)}`
      : "/dining";

  return (
    <ContentRail
      title="Popular Dining"
      subtitle="Great places people are loving right now."
      seeAllHref={seeAllHref}
      label="dining"
      cardStyle="dining"
      minVisible={4}
      isLoading={isLoadingDining}
      empty={
        isEmpty && hasCity ? (
          <CityLocationEmptyState categoryLabel="restaurants" city={city} />
        ) : undefined
      }
    >
      {useStatic
        ? SHOWCASE_DINING_CARDS.map((place) => (
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
