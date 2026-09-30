"use client";

import { useMemo } from "react";
import { useGetPublicMoviesQuery } from "@/services/api";
import CategoryNavTileCard from "./CategoryNavTileCard";
import { buildCategoryNavTiles } from "./categoryNavTiles";
import { useHomeCatalog } from "./useHomeCatalog";
import { CategoryTilesShimmer } from "@/components/Shared/Shimmer";

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
    <section className="bg-white py-5 sm:py-6 lg:pt-5 ">
      <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0">
        <h2 className="text-xl sm:text-2xl lg:text-xl font-bold text-slate-800 mb-3 sm:mb-4 lg:mb-3">
          The Best of Live Events
        </h2>

        {isLoadingFilters ? (
          <CategoryTilesShimmer count={6} />
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
