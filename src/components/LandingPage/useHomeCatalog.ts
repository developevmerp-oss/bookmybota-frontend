import { useMemo } from "react";
import {
  useGetBusinessesQuery,
  useGetPublicEventFiltersQuery,
  useGetPublicEventsQuery,
} from "@/services/api";
import { eventsWithImage, hasCityFilter, preferCityOrAll } from "./homeUtils";

/**
 * Landing catalog: prefer city-scoped listings; when a city filter returns
 * nothing, fall back to the full (unscoped) list so rails stay populated.
 */
export function useHomeCatalog(city: string) {
  const hasCity = hasCityFilter(city);
  const { data: filters, isLoading: filtersLoading } = useGetPublicEventFiltersQuery();

  const { data: cityEvents = [], isLoading: cityEventsLoading } = useGetPublicEventsQuery(
    hasCity ? { city } : undefined
  );
  const { data: allEvents = [], isLoading: allEventsLoading } = useGetPublicEventsQuery(undefined, {
    skip: !hasCity,
  });

  const { data: cityDining = [], isLoading: cityDiningLoading } = useGetBusinessesQuery({
    module: "dining",
    ...(hasCity ? { city } : {}),
  });
  const { data: allDiningRaw = [], isLoading: allDiningLoading } = useGetBusinessesQuery(
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
    hasCity && !cityEventsLoading && cityEvents.length === 0 && allEventsLoading;
  const waitingDiningFallback =
    hasCity && !cityDiningLoading && cityDining.length === 0 && allDiningLoading;

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
    isLoadingEvents: cityEventsLoading || waitingEventsFallback,
    isLoadingFallback: allEventsLoading,
    isLoadingDining: cityDiningLoading || waitingDiningFallback,
    isLoadingFilters: filtersLoading,
    hasCity,
  };
}
