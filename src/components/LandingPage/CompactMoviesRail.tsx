"use client";

import { useRef } from "react";
import AdaptiveCardRow from "./AdaptiveCardRow";
import CitySectionEmptyNotice from "./CitySectionEmptyNotice";
import { MovieCompactCard } from "./MovieCompactCard";
import { RailPagerNav, RailSeeAllLink } from "./RailChrome";
import { useMustWatchMoviesCatalog } from "./useMustWatchMoviesCatalog";
import { scrollRailBy, useHorizontalScrollEdges } from "@/lib/useHorizontalScrollEdges";
import { CustomerRailShimmer } from "@/components/Shared/Shimmer";

const MIN_VISIBLE = 4;

/**
 * Compact Must-Watch Movies rail — same data as RecommendedMoviesRail,
 * alternate card UI (format badge, rating · duration, genres, language).
 */
export default function CompactMoviesRail() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { items, isLoading, cityHasNoMovies, seeAllHref } = useMustWatchMoviesCatalog();
  const scrollEdges = useHorizontalScrollEdges(scrollerRef, [
    items.length,
    isLoading,
  ]);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    scrollRailBy(el, dir);
  };

  return (
    <section className="bg-white py-6 sm:py-8 lg:pb-5">
      <div className="bmb-section-container">
        <div className="flex items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
              Must-Watch Movies
            </h2>
            {cityHasNoMovies ? (
              <CitySectionEmptyNotice message="No movies available in your city yet." />
            ) : null}
          </div>
          <RailSeeAllLink href={seeAllHref} />
        </div>

        <div>
          {isLoading ? (
            <CustomerRailShimmer count={MIN_VISIBLE} variant="movie" />
          ) : items.length === 0 ? (
            <p className="text-sm text-[#6B7280] py-6">No movies available yet.</p>
          ) : (
            <AdaptiveCardRow
              minVisible={MIN_VISIBLE}
              scrollerRef={scrollerRef}
              className="adaptive-card-row--four"
            >
              {items.map((movie) => (
                <MovieCompactCard key={`compact-movie-${movie.id}`} movie={movie} />
              ))}
            </AdaptiveCardRow>
          )}

          {items.length > 0 || isLoading ? (
            <RailPagerNav
              canPrev={scrollEdges.left}
              canNext={scrollEdges.right}
              pageCount={scrollEdges.pageCount}
              activePage={scrollEdges.activePage}
              onPrev={() => scrollBy(-1)}
              onNext={() => scrollBy(1)}
              label="compact-movies"
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
