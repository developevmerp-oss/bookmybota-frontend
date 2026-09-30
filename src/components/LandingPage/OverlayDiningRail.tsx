"use client";

import { useMemo } from "react";
import ContentRail from "./ContentRail";
import { DiningOverlayCard, ShowcaseDiningOverlayCard } from "./DiningOverlayCard";
import { SHOWCASE_DINING_CARDS } from "@/data/showcaseDiningCards";
import { shouldShowShowcaseCards } from "./homeUtils";
import { useHomeCatalog } from "./useHomeCatalog";

/**
 * Overlay-style Popular Dining rail (rating badge on image, serif title).
 * Same data source as PopularDiningRail — does not modify existing dining components.
 */
export default function OverlayDiningRail({ city }: { city: string }) {
  const { dining, cityDining, isLoadingDining, hasCity } = useHomeCatalog(city);
  const items = useMemo(() => {
    const pool = [...dining];
    pool.sort((a, b) => {
      const ratingDiff = Number(b.rating || 0) - Number(a.rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return Number(b.reviews_count || 0) - Number(a.reviews_count || 0);
    });
    return pool.slice(0, 12);
  }, [dining]);
  const isEmpty = !isLoadingDining && items.length === 0;
  const useStatic = shouldShowShowcaseCards(isEmpty);
  const cityHasNoDining = hasCity && !isLoadingDining && cityDining.length === 0;
  const seeAllHref =
    city && city !== "All Cities"
      ? `/dining?city=${encodeURIComponent(city)}`
      : "/dining";

  return (
    <ContentRail
      title="Popular Dining"
      cityNotice={
        cityHasNoDining ? "No dining options available in your city yet." : undefined
      }
      seeAllHref={seeAllHref}
      label="overlay-dining"
      cardStyle="dining"
      minVisible={4}
      isLoading={isLoadingDining}
      empty={isEmpty && !useStatic ? "No restaurants available yet." : undefined}
    >
      {useStatic
        ? SHOWCASE_DINING_CARDS.map((place) => (
            <ShowcaseDiningOverlayCard
              key={`overlay-${place.id}`}
              name={place.name}
              image={place.image}
              rating={place.rating}
              locality={place.locality}
              cuisine={place.cuisine}
              href={place.href}
            />
          ))
        : items.map((place) => (
            <DiningOverlayCard key={`overlay-${place.id}`} place={place} />
          ))}
    </ContentRail>
  );
}
