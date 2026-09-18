"use client";

import { useMemo } from "react";
import { useGetPublicMoviesQuery } from "@/services/api";
import CategoryNavTileCard from "./CategoryNavTileCard";
import { buildCategoryNavTiles } from "./categoryNavTiles";
import { useHomeCatalog } from "./useHomeCatalog";

export default function LiveCategoryTiles({ city }: { city: string }) {
  const {
    categories,
    cityEvents,
    fallbackEvents,
    dining,
    isLoadingFilters,
    hasCity,
  } = useHomeCatalog(city);

  const eventPool =
    !hasCity || cityEvents.length > 0 ? cityEvents : fallbackEvents;

  const { data: cityMoviesData } = useGetPublicMoviesQuery({
    limit: 100,
    ...(hasCity ? { city } : {}),
  });
  const { data: allMoviesData } = useGetPublicMoviesQuery(
    { limit: 100 },
    { skip: !hasCity }
  );

  const cityMovieCount =
    cityMoviesData?.meta?.total ?? cityMoviesData?.items?.length ?? 0;
  const allMovieCount =
    allMoviesData?.meta?.total ?? allMoviesData?.items?.length ?? 0;
  const movieCount =
    !hasCity || cityMovieCount > 0 ? cityMovieCount : allMovieCount;

  const cards = useMemo(
    () =>
      buildCategoryNavTiles({
        categories,
        events: eventPool,
        diningCount: dining.length,
        movieCount,
        city,
      }),
    [categories, eventPool, dining.length, movieCount, city]
  );

  return (
    <section className="bg-white py-5 sm:py-6 lg:py-4 lg:pb-5">
      <div className="container mx-auto px-4 md:px-5 lg:px-8">
        <h2 className="type-section font-semibold text-[#111111] mb-3 sm:mb-4 lg:mb-3">
          The Best of Live Events
        </h2>

        {isLoadingFilters ? (
          <div className="flex flex-wrap gap-2.5 sm:gap-3 md:gap-4 items-start">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="w-[calc((100%-0.625rem)/2)] sm:w-[calc((100%-1.5rem)/3)] md:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-5rem)/6)] aspect-[3/4] sm:aspect-[5/7] rounded-2xl bg-[#F7F7F7] shrink-0"
              />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <p className="type-body text-[#6B6B6B] py-6">No event categories yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2.5 sm:gap-3 md:gap-4 items-start">
            {cards.map((card) => (
              <CategoryNavTileCard key={card.key} card={card} size="hero" />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
