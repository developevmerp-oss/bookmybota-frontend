"use client";

import { useMemo } from "react";
import { useGetBusinessTypesQuery, useGetBusinessesPagedQuery } from "@/services/api";
import { hasCityFilter, shouldShowShowcaseCards } from "./homeUtils";

function resolveBarCategoryName(types: { name: string }[]): string {
  const exact = types.find((t) => t.name.trim().toLowerCase() === "bar");
  return exact?.name || "Bar";
}

/** Shared bar catalog for Raise a Glass rails (city → global → showcase). */
export function useBarSceneCatalog(city: string) {
  const hasCity = hasCityFilter(city);
  const { data: businessTypes = [], isLoading: typesLoading } = useGetBusinessTypesQuery("dining");

  const barCategory = useMemo(
    () => resolveBarCategoryName(businessTypes),
    [businessTypes]
  );

  const {
    data: cityBarsData,
    isLoading: cityBarsLoading,
    isFetching: cityBarsFetching,
  } = useGetBusinessesPagedQuery({
    module: "dining",
    ...(hasCity ? { city } : {}),
    categories: [barCategory],
    sort: "rating",
    page: 1,
    limit: 12,
  });

  const {
    data: allBarsData,
    isLoading: allBarsLoading,
    isFetching: allBarsFetching,
  } = useGetBusinessesPagedQuery(
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
  const items = !hasCity || cityItems.length > 0 ? cityItems : allItems;

  const waitingFallback =
    hasCity &&
    !cityBarsLoading &&
    !cityBarsFetching &&
    cityItems.length === 0 &&
    (allBarsLoading || allBarsFetching);

  const isLoading =
    typesLoading ||
    cityBarsLoading ||
    cityBarsFetching ||
    waitingFallback;

  const isEmpty = !isLoading && items.length === 0;
  const useStatic = shouldShowShowcaseCards(isEmpty);
  const cityHasNoBars = hasCity && !isLoading && cityItems.length === 0;

  const seeAllParams = new URLSearchParams();
  if (hasCity && cityItems.length > 0) seeAllParams.set("city", city);
  seeAllParams.set("filter", barCategory);
  const seeAllHref = `/dining?${seeAllParams.toString()}`;

  return {
    items,
    isLoading,
    isEmpty,
    useStatic,
    seeAllHref,
    barCategory,
    cityHasNoBars,
  };
}
