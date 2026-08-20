import { useMemo } from "react";
import {
  useGetBusinessesQuery,
  useGetPublicEventFiltersQuery,
  useGetPublicEventsQuery,
} from "@/services/api";
import { eventsWithImage, hasCityFilter } from "./homeUtils";

export function useHomeCatalog(city: string) {
  const hasCity = hasCityFilter(city);
  const { data: filters, isLoading: filtersLoading } = useGetPublicEventFiltersQuery();
  const { data: cityEvents = [], isLoading: cityEventsLoading } = useGetPublicEventsQuery(
    hasCity ? { city } : undefined
  );
  const { data: allEvents = [], isLoading: allEventsLoading } = useGetPublicEventsQuery(undefined, {
    skip: !hasCity,
  });
  const { data: dining = [], isLoading: diningLoading } = useGetBusinessesQuery({
    module: "dining",
    ...(hasCity ? { city } : {}),
  });

  const cities = filters?.cities || [];
  const categories = filters?.categories || [];
  const events = cityEvents;
  const fallbackEvents = hasCity ? allEvents : cityEvents;
  const cityDining = dining;

  const bannerEvents = useMemo(() => {
    const fromCity = eventsWithImage(events);
    if (fromCity.length > 0) return fromCity;
    return eventsWithImage(fallbackEvents);
  }, [events, fallbackEvents]);

  return {
    cities,
    categories,
    events,
    fallbackEvents,
    bannerEvents,
    dining: cityDining,
    allDining: dining,
    isLoadingEvents: cityEventsLoading,
    isLoadingFallback: allEventsLoading,
    isLoadingDining: diningLoading,
    isLoadingFilters: filtersLoading,
  };
}
