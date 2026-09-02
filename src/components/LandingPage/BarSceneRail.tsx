"use client";

import { useMemo } from "react";
import { useGetBusinessTypesQuery, useGetBusinessesPagedQuery } from "@/services/api";
import ContentRail from "./ContentRail";
import { DiningPosterCard } from "./PosterCard";
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
  const empty =
    !isLoading && items.length === 0
      ? `No bars in ${hasCity ? city : "your city"} yet`
      : undefined;

  const seeAllParams = new URLSearchParams();
  if (hasCity) seeAllParams.set("city", city);
  seeAllParams.set("filter", barCategory);
  const seeAllHref = `/dining?${seeAllParams.toString()}`;

  return (
    <ContentRail
      title="The Bar Scene"
      seeAllHref={seeAllHref}
      label="bars"
      cardStyle="dining"
      isLoading={isLoading}
      empty={empty}
    >
      {items.map((place) => (
        <DiningPosterCard key={place.id} place={place} />
      ))}
    </ContentRail>
  );
}
