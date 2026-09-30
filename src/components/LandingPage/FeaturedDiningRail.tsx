"use client";

import { useMemo } from "react";
import ContentRail from "./ContentRail";
import { DiningDetailCard, ShowcaseDiningDetailCard } from "./DiningDetailCard";
import { SHOWCASE_DINING_CARDS } from "@/data/showcaseDiningCards";
import { shouldShowShowcaseCards } from "./homeUtils";
import { useHomeCatalog } from "./useHomeCatalog";

/**
 * Alternate dining rail UI (detail cards with wishlist / rating / book CTA).
 * Same data source as PopularDiningRail — does not modify that component.
 */
export default function FeaturedDiningRail({ city }: { city: string }) {
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
      label="featured-dining"
      cardStyle="dining"
      minVisible={4}
      isLoading={isLoadingDining}
      empty={isEmpty && !useStatic ? "No restaurants available yet." : undefined}
    >
      {useStatic
        ? SHOWCASE_DINING_CARDS.map((place) => (
            <ShowcaseDiningDetailCard
              key={`featured-${place.id}`}
              name={place.name}
              image={place.image}
              rating={place.rating}
              locality={place.locality}
              cuisine={place.cuisine}
              href={place.href}
            />
          ))
        : items.map((place) => (
            <DiningDetailCard key={`featured-${place.id}`} place={place} />
          ))}
    </ContentRail>
  );
}
