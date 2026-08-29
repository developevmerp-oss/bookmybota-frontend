"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, ChevronRight, Heart, Loader2, Play, Share2, Star, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { useGetPublicMovieQuery } from "@/services/api";
import {
  getCatalogMovie,
  mapApiMovieToDetail,
  withMovieExtras,
  type MovieDetailData,
} from "@/components/MovieLandingPage/movieCatalog";
import MovieDetailSections from "@/components/MovieLandingPage/MovieDetailSections";

const FAVORITES_KEY = "movie_detail_favorites";

function languageLine(languages: string[]) {
  if (languages.length <= 4) return languages.join(", ");
  return `${languages.slice(0, 3).join(", ")}, +${languages.length - 3}`;
}

function readFavoriteIds(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function MovieDetailBanner({ movie }: { movie: MovieDetailData }) {
  const bg = movie.landscape || movie.poster;
  const metaParts = [
    movie.duration,
    movie.genres.length ? movie.genres.join(", ") : "",
    movie.certification,
    movie.releaseDate,
  ].filter(Boolean);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(readFavoriteIds().includes(movie.id));
  }, [movie.id]);

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: movie.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Unable to share");
    }
  };

  const toggleFavorite = () => {
    try {
      const ids = readFavoriteIds();
      const next = saved ? ids.filter((id) => id !== movie.id) : [...ids, movie.id];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      setSaved(!saved);
      toast.success(saved ? "Removed from favorites" : "Added to favorites");
    } catch {
      toast.error("Unable to update favorites");
    }
  };

  const bookClass =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#F84464] to-[#6900AA] px-5 sm:px-8 py-2.5 sm:py-3 text-sm sm:text-base font-bold text-white shadow-lg shadow-[#6900AA]/20 hover:opacity-90 transition-opacity";

  const bookLabel = (
    <>
      Book Tickets
      <ArrowRight className="size-4 sm:size-5" strokeWidth={2.25} />
    </>
  );

  return (
    <section className="relative w-full overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <img src={bg} alt="" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/30" />
      </div>

      <div className="relative container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 py-8 sm:py-10 lg:py-14">
        <button
          type="button"
          onClick={handleShare}
          className="absolute top-6 right-5 sm:top-8 sm:right-10 2xl:right-0 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/35 backdrop-blur-sm border border-white/20 px-3 py-1.5 text-xs sm:text-sm font-medium text-white hover:bg-black/50 cursor-pointer"
        >
          <Share2 className="size-3.5 sm:size-4" />
          Share
        </button>

        <nav className="mb-6 sm:mb-8 text-xs sm:text-sm text-white/70 flex items-center gap-1.5 flex-wrap">
          <Link href="/movies" className="hover:text-white transition-colors">
            Movies
          </Link>
          <ChevronRight className="size-3.5 opacity-70" />
          <span className="text-white/90 truncate">{movie.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 lg:gap-10 items-start">
          <div className="hidden lg:block rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 aspect-[2/3] max-w-[220px]">
            <img src={movie.poster} alt={movie.title} className="h-full w-full object-cover" />
          </div>

          <div className="min-w-0 text-white">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight">{movie.title}</h1>

            {metaParts.length > 0 && (
              <p className="mt-2 text-sm sm:text-base text-white/80">{metaParts.join(" · ")}</p>
            )}

            {movie.languages.length > 0 && (
              <p className="mt-2 text-xs sm:text-sm text-white/70">{languageLine(movie.languages)}</p>
            )}

            {(movie.rating || movie.votes || movie.likes) && (
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                {movie.rating && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5">
                    <Star className="size-4 text-[#EF4444]" fill="currentColor" />
                    <span className="font-bold">{movie.rating}</span>
                    {movie.votes && <span className="text-white/80">{movie.votes}</span>}
                  </span>
                )}
                {movie.likes && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5">
                    <ThumbsUp className="size-4 text-[#22C55E]" fill="currentColor" />
                    <span>{movie.likes}</span>
                  </span>
                )}
              </div>
            )}

            {movie.trailerUrl && (
              <a
                href={movie.trailerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20 transition-colors"
              >
                <Play className="size-4" fill="currentColor" />
                Watch trailer
                {movie.trailersCount && movie.trailersCount > 1 ? ` (${movie.trailersCount})` : ""}
              </a>
            )}

            <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3">
              {movie.comingSoon ? (
                <span className={bookClass.replace("hover:opacity-90", "opacity-80 cursor-default")}>
                  Coming Soon
                </span>
              ) : movie.bookHref ? (
                <Link href={movie.bookHref} className={bookClass}>
                  {bookLabel}
                </Link>
              ) : (
                <button type="button" className={bookClass} disabled>
                  {bookLabel}
                </button>
              )}

              <button
                type="button"
                onClick={toggleFavorite}
                aria-label={saved ? "Remove from favorites" : "Add to favorites"}
                className="inline-flex size-11 sm:size-12 items-center justify-center rounded-xl border border-white/25 bg-white/10 hover:bg-white/20 cursor-pointer"
              >
                <Heart
                  className={`size-4 sm:size-5 ${saved ? "fill-[#F84464] text-[#F84464]" : ""}`}
                  strokeWidth={2}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function MovieDetailPage() {
  const params = useParams();
  const idOrSlug = String(params?.id || "");
  const catalogHit = getCatalogMovie(idOrSlug);

  const {
    data: apiMovie,
    isLoading,
    isError,
  } = useGetPublicMovieQuery(idOrSlug, {
    skip: !idOrSlug || Boolean(catalogHit),
  });

  const movie = useMemo<MovieDetailData | null>(() => {
    if (catalogHit) return withMovieExtras(catalogHit);

    if (!apiMovie) return null;

    const staticBySlug = getCatalogMovie(apiMovie.slug);
    if (staticBySlug) return withMovieExtras(staticBySlug);

    const mapped = mapApiMovieToDetail(apiMovie);
    return withMovieExtras(mapped);
  }, [catalogHit, apiMovie]);

  if (!catalogHit && isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="size-8 animate-spin text-[#6900AA]" />
        <p className="text-sm sm:text-base font-medium">Loading movie...</p>
      </div>
    );
  }

  if (!movie || (!catalogHit && isError)) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 px-5 text-center">
        <p className="text-base sm:text-lg text-slate-700 font-semibold">Movie not found</p>
        <Link href="/movies" className="text-sm sm:text-base font-semibold text-[#6900AA]">
          Back to Movies
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <MovieDetailBanner movie={movie} />
      <MovieDetailSections movie={movie} />
    </div>
  );
}
