"use client";

import { useMemo } from "react";
import { useGetBusinessTypesQuery, useGetBusinessesPagedQuery } from "@/services/api";
import ContentRail from "./ContentRail";
import { DiningPosterCard, ShowcaseDiningPosterCard } from "./PosterCard";
import CityLocationEmptyState from "./CityLocationEmptyState";
import { SHOWCASE_BAR_CARDS } from "@/data/showcaseDiningCards";
import { hasCityFilter } from "./homeUtils";

function resolveBarCategoryName(types: { name: string }[]): string {
  const exact = types.find((t) => t.name.trim().toLowerCase() === "bar");
  return exact?.name || "Bar";
}

export default function BarSceneRail({ city }: { city: string }) {
  const hasCity = hasCityFilter(city);
  const { data: businessTypes = [], isLoading: typesLoading } = useGetBusinessTypesQuery("dining");

  const barCategory = useMemo(
    () => resolveBarCategoryName(businessTypes),
    [businessTypes]
  );

  const { data: barsData, isLoading: barsLoading } = useGetBusinessesPagedQuery({
    module: "dining",
    ...(hasCity ? { city } : {}),
    categories: [barCategory],
    sort: "rating",
    page: 1,
    limit: 12,
  });

  const items = barsData?.items ?? [];
  const isLoading = typesLoading || barsLoading;
  const isEmpty = !isLoading && items.length === 0;
  const useStatic = isEmpty && !hasCity;

  const seeAllParams = new URLSearchParams();
  if (hasCity) seeAllParams.set("city", city);
  seeAllParams.set("filter", barCategory);
  const seeAllHref = `/dining?${seeAllParams.toString()}`;

  return (
    <ContentRail
      title="Raise a Glass"
      subtitle="Bars and lounges people are loving right now."
      seeAllHref={seeAllHref}
      label="bars"
      cardStyle="dining"
      minVisible={4}
      isLoading={isLoading}
      empty={
        isEmpty && hasCity ? (
          <CityLocationEmptyState categoryLabel="bars" city={city} />
        ) : undefined
      }
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
