"use client";

import { useMemo } from "react";
import { useGetBusinessTypesQuery, useGetBusinessesPagedQuery } from "@/services/api";
import ContentRail from "./ContentRail";
import { DiningPosterCard, ShowcaseDiningPosterCard } from "./PosterCard";
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

  const { data: cityBarsData, isLoading: cityBarsLoading } = useGetBusinessesPagedQuery({
    module: "dining",
    ...(hasCity ? { city } : {}),
    categories: [barCategory],
    sort: "rating",
    page: 1,
    limit: 12,
  });

  const { data: allBarsData, isLoading: allBarsLoading } = useGetBusinessesPagedQuery(
    {
      module: "dining",
      categories: [barCategory],
      sort: "rating",
      page: 1,
      limit: 12,
    },
    { skip: !hasCity }
  );

  const cityItems = cityBarsData?.items ?? [];
  const allItems = allBarsData?.items ?? [];
  const items =
    !hasCity || cityItems.length > 0 ? cityItems : allItems;

  const isLoading =
    typesLoading ||
    cityBarsLoading ||
    (hasCity && cityItems.length === 0 && allBarsLoading);
  const isEmpty = !isLoading && items.length === 0;
  const useStatic = isEmpty && !hasCity;

  const seeAllParams = new URLSearchParams();
  // Link to city dining when city has bars; otherwise browse all bars
  if (hasCity && cityItems.length > 0) seeAllParams.set("city", city);
  seeAllParams.set("filter", barCategory);
  const seeAllHref = `/dining?${seeAllParams.toString()}`;

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
