import { useMemo } from "react";
import {
  useGetBusinessesQuery,
  useGetPublicEventFiltersQuery,
  useGetPublicEventsQuery,
} from "@/services/api";
import { eventsWithImage, hasCityFilter, preferCityOrAll } from "./homeUtils";

/**
 * Landing catalog cascade for cards:
 * 1. Prefer city-scoped listings
 * 2. When city returns nothing → fall back to full (unscoped) list
 * 3. Callers show showcase/static demos when both city + global are empty
 */
export function useHomeCatalog(city: string) {
  const hasCity = hasCityFilter(city);
  const { data: filters, isLoading: filtersLoading } = useGetPublicEventFiltersQuery();

  const {
    data: cityEvents = [],
    isLoading: cityEventsLoading,
    isFetching: cityEventsFetching,
  } = useGetPublicEventsQuery(hasCity ? { city } : undefined);
  const {
    data: allEvents = [],
    isLoading: allEventsLoading,
    isFetching: allEventsFetching,
  } = useGetPublicEventsQuery(undefined, {
    skip: !hasCity,
  });

  const {
    data: cityDining = [],
    isLoading: cityDiningLoading,
    isFetching: cityDiningFetching,
  } = useGetBusinessesQuery({
    module: "dining",
    ...(hasCity ? { city } : {}),
  });
  const {
    data: allDiningRaw = [],
    isLoading: allDiningLoading,
    isFetching: allDiningFetching,
  } = useGetBusinessesQuery(
    { module: "dining" },
    { skip: !hasCity }
  );

  const fallbackEvents = hasCity ? allEvents : cityEvents;
  const allDining = hasCity ? allDiningRaw : cityDining;

  // Prefer city data; only use global lists when the city has none.
  const events = preferCityOrAll(cityEvents, fallbackEvents, hasCity);
  const dining = preferCityOrAll(cityDining, allDining, hasCity);

  const bannerEvents = useMemo(() => {
    const fromCity = eventsWithImage(cityEvents);
    if (fromCity.length > 0) return fromCity;
    return eventsWithImage(fallbackEvents);
  }, [cityEvents, fallbackEvents]);

  const waitingEventsFallback =
    hasCity &&
    !cityEventsLoading &&
    !cityEventsFetching &&
    cityEvents.length === 0 &&
    (allEventsLoading || allEventsFetching);
  const waitingDiningFallback =
    hasCity &&
    !cityDiningLoading &&
    !cityDiningFetching &&
    cityDining.length === 0 &&
    (allDiningLoading || allDiningFetching);

  // isFetching covers city changes (RTK isLoading is only true on first ever load)
  const isLoadingEvents =
    cityEventsLoading || cityEventsFetching || waitingEventsFallback;
  const isLoadingDining =
    cityDiningLoading || cityDiningFetching || waitingDiningFallback;

  return {
    cities: filters?.cities || [],
    categories: filters?.categories || [],
    /** City-first with all-data fallback (for general rails). */
    events,
    /** Raw city-scoped events (may be empty). */
    cityEvents,
    /** Unscoped events when a city is selected; otherwise same as cityEvents. */
    fallbackEvents,
    bannerEvents,
    /** City-first with all-data fallback (for dining rails). */
    dining,
    cityDining,
    allDining,
    isLoadingEvents,
    isLoadingFallback: allEventsLoading || allEventsFetching,
    isLoadingDining,
    isLoadingFilters: filtersLoading,
    hasCity,
  };
}
