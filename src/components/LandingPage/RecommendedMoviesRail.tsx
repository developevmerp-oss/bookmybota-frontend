"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { useGetPublicMoviesQuery, type Movie } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { useHorizontalScrollEdges } from "@/lib/useHorizontalScrollEdges";
import { SHOWCASE_MOVIE_CARDS, type ShowcaseMovieCard } from "@/data/showcaseMovieCards";
import {
  formatMovieCardMeta,
  formatMovieCardTitle,
  isMoviePromoted,
  parseLanguageList,
} from "@/lib/movieDisplay";
import AdaptiveCardRow from "./AdaptiveCardRow";
import CitySectionEmptyNotice from "./CitySectionEmptyNotice";
import { hasCityFilter } from "./homeUtils";
import { RailOverlayNavButton, RailSeeAllLink } from "./RailChrome";
import "./RecommendedMoviesRail.css";

const MIN_VISIBLE = 5;
const MOVIES_HOME_HREF = "/movies";

const cardShell =
  "bg-white border border-[#EAEAEA] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(17,17,17,0.06)] hover:shadow-[0_8px_24px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300";

type RailMovieCard = {
  id: string;
  title: string;
  poster: string;
  certification?: string;
  languages: string[];
  comingSoon?: boolean;
  promoted?: boolean;
  href: string;
};

function mapApiMovie(movie: Movie): RailMovieCard {
  return {
    id: movie.id,
    title: formatMovieCardTitle(movie.title, movie.release_date),
    poster: resolveMediaUrl(movie.poster_url),
    certification: movie.certificate?.trim() || undefined,
    languages: parseLanguageList(movie.languages),
    comingSoon: movie.status === "coming_soon",
    promoted: isMoviePromoted(movie.is_promoted),
    href: `/movies/${movie.slug || movie.id}`,
  };
}

function mapShowcaseMovie(movie: ShowcaseMovieCard): RailMovieCard {
  return {
    id: movie.id,
    title: formatMovieCardTitle(movie.title, movie.year),
    poster: movie.poster,
    certification: movie.certification,
    languages: parseLanguageList(movie.language),
    comingSoon: movie.comingSoon,
    promoted: Boolean(movie.promoted),
    href: movie.href,
  };
}

function MovieCard({ movie }: { movie: RailMovieCard }) {
  const [imgFailed, setImgFailed] = useState(false);
  const meta = formatMovieCardMeta(movie.certification, movie.languages);
  const showPoster = Boolean(movie.poster) && !imgFailed;

  return (
    <Link href={movie.href} className={`group block h-full w-full ${cardShell}`}>
      <article className="flex h-full flex-col">
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#F3F4F6]">
          {showPoster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={movie.poster}
              alt=""
              className="w-full h-full object-cover object-top group-hover:scale-[1.04] transition-transform duration-500 ease-out"
              loading="lazy"
              draggable={false}
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-300">
              <Clapperboard size={32} strokeWidth={1.4} />
            </div>
          )}
          {movie.promoted ? (
            <span className="movies-rail-badge movies-rail-badge--promoted">Promoted</span>
          ) : null}
          {movie.comingSoon && !movie.promoted ? (
            <span className="movies-rail-badge movies-rail-badge--soon">Coming Soon</span>
          ) : null}
        </div>
        <div className="px-3 pt-3 pb-3.5 flex flex-col gap-0.5">
          <h3 className="font-bold text-[#111827] type-card-title leading-snug line-clamp-2 group-hover:text-[#6900AA] transition-colors">
            {movie.title}
          </h3>
          {meta ? (
            <p className="type-card-body text-[#6b7280] leading-snug line-clamp-2">{meta}</p>
          ) : null}
        </div>
      </article>
    </Link>
  );
}

export default function RecommendedMoviesRail() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [city, setCity] = useState("");

  useEffect(() => {
    const applyCity = () => {
      const stored = localStorage.getItem("selected_city") || "";
      setCity(stored && stored !== "All Cities" ? stored : "");
    };
    applyCity();
    window.addEventListener("selected_city_changed", applyCity);
    window.addEventListener("storage", applyCity);
    return () => {
      window.removeEventListener("selected_city_changed", applyCity);
      window.removeEventListener("storage", applyCity);
    };
  }, []);

  const moviesQueryArg = useMemo(
    () => ({
      limit: 12,
      ...(city ? { city } : {}),
    }),
    [city]
  );

  const { data: cityData, isLoading: cityLoading } = useGetPublicMoviesQuery(moviesQueryArg);
  const { data: allData, isLoading: allLoading } = useGetPublicMoviesQuery(
    { limit: 12 },
    { skip: !hasCityFilter(city) }
  );

  const hasCity = hasCityFilter(city);
  const cityMovies = (cityData?.items ?? []).map(mapApiMovie);
  const allMovies = (allData?.items ?? []).map(mapApiMovie);
  const apiMovies = !hasCity || cityMovies.length > 0 ? cityMovies : allMovies;
  const isLoading =
    cityLoading || (hasCity && cityMovies.length === 0 && allLoading);
  const isEmpty = !isLoading && apiMovies.length === 0;
  const useStatic = isEmpty && !hasCity;
  const cityHasNoMovies = hasCity && !isLoading && cityMovies.length === 0;
  const items = useStatic ? SHOWCASE_MOVIE_CARDS.map(mapShowcaseMovie) : apiMovies;
  const scrollEdges = useHorizontalScrollEdges(scrollerRef, [
    items.length,
    useStatic,
    isLoading,
    city,
    isEmpty,
  ]);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  // Prefer city movies link when city has results; otherwise browse all movies
  const seeAllHref =
    city && cityMovies.length > 0
      ? `${MOVIES_HOME_HREF}?city=${encodeURIComponent(city)}`
      : MOVIES_HOME_HREF;

  return (
    <section className="bg-white py-6 sm:py-8 lg:py-10">
      <div className="container mx-auto px-4 md:px-5 lg:px-8">
        <div className="flex items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          <div className="min-w-0">
            <h2 className="type-section font-semibold tracking-tight text-[#111111]">
              Must-Watch Movies
            </h2>
            {cityHasNoMovies ? (
              <CitySectionEmptyNotice message="No movies available in your city yet." />
            ) : null}
          </div>
          <RailSeeAllLink href={seeAllHref} />
        </div>

        <div className="relative overflow-visible">
          {scrollEdges.left ? (
            <RailOverlayNavButton
              direction="prev"
              side="left"
              label="Previous movies"
              onClick={() => scrollBy(-1)}
            />
          ) : null}

          {isLoading ? (
            <AdaptiveCardRow minVisible={MIN_VISIBLE} scrollerRef={scrollerRef}>
              {Array.from({ length: MIN_VISIBLE }).map((_, i) => (
                <div
                  key={i}
                  className="w-full overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white"
                >
                  <div className="aspect-[3/4] w-full bg-[#F7F7F7]" />
                  <div className="px-3 pt-3 pb-3.5 space-y-2">
                    <div className="h-4 w-4/5 rounded bg-[#F7F7F7]" />
                    <div className="h-3.5 w-3/5 rounded bg-[#F7F7F7]" />
                  </div>
                </div>
              ))}
            </AdaptiveCardRow>
          ) : items.length === 0 ? (
            <p className="text-sm text-[#6B7280] py-6">No movies available yet.</p>
          ) : (
            <AdaptiveCardRow minVisible={MIN_VISIBLE} scrollerRef={scrollerRef}>
              {items.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </AdaptiveCardRow>
          )}

          {scrollEdges.right ? (
            <RailOverlayNavButton
              direction="next"
              side="right"
              label="Next movies"
              onClick={() => scrollBy(1)}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
