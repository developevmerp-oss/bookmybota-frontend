"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
import "./RecommendedMoviesRail.css";

const VISIBLE = 6;
const MOVIES_HOME_HREF = "/movies";

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
  const meta = formatMovieCardMeta(movie.certification, movie.languages);

  return (
    <Link href={movie.href} className="movies-rail-slot group block h-full">
      <article className="flex h-full flex-col overflow-hidden rounded-[10px] bg-white border border-[#E5E5E5]">
        <div className="relative shrink-0 overflow-hidden bg-[#111111]">
          <div className="movies-rail-poster">
            {movie.poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={movie.poster}
                alt={movie.title}
                className="movies-rail-poster-img"
                loading="lazy"
                draggable={false}
              />
            ) : (
              <div className="movies-rail-poster-img bg-slate-200" />
            )}
          </div>
          {movie.promoted ? (
            <span className="movies-rail-badge movies-rail-badge--promoted">Promoted</span>
          ) : null}
          {movie.comingSoon && !movie.promoted ? (
            <span className="movies-rail-badge movies-rail-badge--soon">Coming Soon</span>
          ) : null}
        </div>
        <div className="movies-rail-meta shrink-0 px-3 pt-2.5 pb-3">
          <h3 className="movies-rail-title text-[13px] sm:text-[14px] font-bold text-[#111111] line-clamp-2 leading-snug group-hover:text-[#6900AA] transition-colors">
            {movie.title}
          </h3>
          <p className="movies-rail-subtitle mt-0.5 text-[11px] sm:text-[12px] text-[#6B7280] line-clamp-1 leading-snug">
            {meta || "\u00A0"}
          </p>
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

  const { data, isLoading } = useGetPublicMoviesQuery(moviesQueryArg);
  const apiMovies = (data?.items ?? []).map(mapApiMovie);
  const useStatic = !isLoading && apiMovies.length === 0;
  const items = useStatic ? SHOWCASE_MOVIE_CARDS.map(mapShowcaseMovie) : apiMovies;
  const scrollEdges = useHorizontalScrollEdges(scrollerRef, [items.length, useStatic, isLoading, city]);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  const seeAllHref = city
    ? `${MOVIES_HOME_HREF}?city=${encodeURIComponent(city)}`
    : MOVIES_HOME_HREF;

  return (
    <section className="bg-white py-6 sm:py-8 lg:py-10">
      <div className="container mx-auto px-4 md:px-5 lg:px-8">
        <div className="flex items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          <h2 className="type-section font-semibold tracking-tight text-[#111111]">
            Recommended Movies
          </h2>
          <Link
            href={seeAllHref}
            className="shrink-0 type-link font-medium text-[#6900AA] hover:text-[#57008E]"
          >
            See All ›
          </Link>
        </div>

        <div className="relative">
          {scrollEdges.left && (
            <button
              type="button"
              aria-label="Previous movies"
              onClick={() => scrollBy(-1)}
              className="hidden md:flex absolute -left-2 lg:-left-3 top-[38%] -translate-y-1/2 z-10 w-9 h-9 rounded-full items-center justify-center cursor-pointer bg-white border border-[#EDEDED] text-[#111111] shadow-sm hover:bg-[#F7E9FF]"
            >
              <ChevronLeft size={18} />
            </button>
          )}

          {isLoading ? (
            <div className="movies-rail" style={{ ["--movies-visible" as string]: VISIBLE }}>
              {Array.from({ length: VISIBLE }).map((_, i) => (
                <div key={i} className="movies-rail-slot">
                  <div className="overflow-hidden rounded-[10px] border border-[#E5E5E5] bg-white">
                    <div className="movies-rail-poster bg-[#F7F7F7]" />
                    <div className="movies-rail-meta px-3 pt-2.5 pb-3 space-y-1.5">
                      <div className="h-3.5 w-4/5 rounded bg-[#F7F7F7]" />
                      <div className="h-2.5 w-2/5 rounded bg-[#F7F7F7]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-[#6B7280] py-6">No movies available yet.</p>
          ) : (
            <div
              ref={scrollerRef}
              className="movies-rail"
              style={{ ["--movies-visible" as string]: VISIBLE }}
            >
              {items.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          )}

          {scrollEdges.right && (
            <button
              type="button"
              aria-label="Next movies"
              onClick={() => scrollBy(1)}
              className="hidden md:flex absolute -right-2 lg:-right-3 top-[38%] -translate-y-1/2 z-10 w-9 h-9 rounded-full items-center justify-center cursor-pointer bg-white border border-[#EDEDED] text-[#111111] shadow-sm hover:bg-[#F7E9FF]"
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
