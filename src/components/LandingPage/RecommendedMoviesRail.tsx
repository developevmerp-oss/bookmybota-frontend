"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useGetPublicMoviesQuery, type Movie } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { useHorizontalScrollEdges } from "@/lib/useHorizontalScrollEdges";
import { SHOWCASE_MOVIE_CARDS, type ShowcaseMovieCard } from "@/data/showcaseMovieCards";
import "./RecommendedMoviesRail.css";

const VISIBLE = 5;
const MOVIES_HOME_HREF = "/movies";

type RailMovieCard = {
  id: string;
  title: string;
  poster: string;
  certification?: string;
  language?: string;
  comingSoon?: boolean;
  href: string;
};

function mapApiMovie(movie: Movie): RailMovieCard {
  return {
    id: movie.id,
    title: movie.title,
    poster: resolveMediaUrl(movie.poster_url),
    certification: movie.certificate?.trim() || undefined,
    language: (movie.languages || []).join(", ") || undefined,
    comingSoon: movie.status === "coming_soon",
    href: `/movies/${movie.slug || movie.id}`,
  };
}

function mapShowcaseMovie(movie: ShowcaseMovieCard): RailMovieCard {
  return {
    id: movie.id,
    title: movie.title,
    poster: movie.poster,
    certification: movie.certification,
    language: movie.language,
    comingSoon: movie.comingSoon,
    href: movie.href,
  };
}

function MovieCard({ movie }: { movie: RailMovieCard }) {
  return (
    <Link href={movie.href} className="movies-rail-slot group block">
      <div className="relative overflow-hidden rounded-xl bg-[#F3F4F6]">
        <div className="aspect-[2/3] w-full overflow-hidden rounded-xl">
          {movie.poster ? (
            <img
              src={movie.poster}
              alt={movie.title}
              className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
              loading="lazy"
              draggable={false}
            />
          ) : (
            <div className="h-full w-full bg-slate-200" />
          )}
        </div>
        {movie.comingSoon ? (
          <span className="absolute top-2 right-2 z-[2] rounded-full border border-green-500/40 bg-green-50 px-2 py-0.5 type-card-caption font-bold uppercase tracking-wide text-green-700">
            Coming Soon
          </span>
        ) : null}
      </div>
      <h3 className="mt-2.5 type-card-title font-semibold text-[#111111] line-clamp-2 leading-snug group-hover:text-[#6900AA] transition-colors">
        {movie.title}
      </h3>
      {movie.certification ? (
        <p className="mt-1 type-card-body text-[#6B6B6B] line-clamp-1">{movie.certification}</p>
      ) : null}
      {movie.language ? (
        <p className="mt-0.5 type-card-body text-[#6B6B6B] line-clamp-1">{movie.language}</p>
      ) : null}
    </Link>
  );
}

export default function RecommendedMoviesRail() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useGetPublicMoviesQuery({ limit: 12 });
  const apiMovies = (data?.items ?? []).map(mapApiMovie);
  const useStatic = !isLoading && apiMovies.length === 0;
  const items = useStatic ? SHOWCASE_MOVIE_CARDS.map(mapShowcaseMovie) : apiMovies;
  const scrollEdges = useHorizontalScrollEdges(scrollerRef, [items.length, useStatic, isLoading]);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="bg-white py-6 sm:py-8 lg:py-10">
      <div className="container mx-auto px-4 md:px-5 lg:px-8">
        <div className="flex items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          <h2 className="type-section font-semibold tracking-tight text-[#111111]">
            Recommended Movies
          </h2>
          <Link
            href={MOVIES_HOME_HREF}
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
            <div
              className="movies-rail"
              style={{ ["--movies-visible" as string]: VISIBLE }}
            >
              {Array.from({ length: VISIBLE }).map((_, i) => (
                <div key={i} className="movies-rail-slot">
                  <div className="aspect-[2/3] w-full rounded-xl bg-[#F7F7F7]" />
                  <div className="mt-3 h-4 w-4/5 rounded bg-[#F7F7F7]" />
                  <div className="mt-2 h-3 w-2/5 rounded bg-[#F7F7F7]" />
                </div>
              ))}
            </div>
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
