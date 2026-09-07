"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useGetPublicMovieQuery } from "@/services/api";
import {
  mapApiMovieToDetail,
  withMovieExtras,
  type MovieDetailData,
} from "@/components/MovieLandingPage/movieCatalog";
import MovieShowtimeSelector from "@/components/MovieLandingPage/MovieShowtimeSelector";

function releaseYearFromApi(releaseDate?: string | null, comingSoon?: boolean) {
  if (comingSoon || !releaseDate) return undefined;
  const d = new Date(releaseDate);
  if (Number.isNaN(d.getTime())) return undefined;
  return String(d.getFullYear());
}

export default function MovieShowtimesPage() {
  const params = useParams();
  const idOrSlug = String(params?.id || "");

  const {
    data: apiMovie,
    isLoading,
    isError,
  } = useGetPublicMovieQuery(idOrSlug, {
    skip: !idOrSlug,
  });

  const movie = useMemo<MovieDetailData | null>(() => {
    if (!apiMovie) return null;
    const mapped = mapApiMovieToDetail(apiMovie);
    // No showcase/random fill — only real API movie fields
    return withMovieExtras(mapped, {
      fillCastCrew: false,
      fillOffers: false,
      fillReviews: false,
      fillRating: false,
    });
  }, [apiMovie]);

  const releaseYear = releaseYearFromApi(apiMovie?.release_date, apiMovie?.status === "coming_soon");

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-slate-400 bg-[#F5F5F5]">
        <Loader2 className="size-8 animate-spin text-[#F84464]" />
        <p className="text-sm sm:text-base font-medium">Loading showtimes…</p>
      </div>
    );
  }

  if (!movie || isError || movie.comingSoon) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 px-5 text-center bg-[#F5F5F5]">
        <p className="text-base sm:text-lg text-slate-700 font-semibold">
          {movie?.comingSoon ? "Tickets are not open yet" : "Movie not found"}
        </p>
        <Link
          href={movie ? `/movies/${movie.slug || movie.id}` : "/movies"}
          className="text-sm sm:text-base font-semibold text-[#F84464]"
        >
          {movie ? "Back to movie" : "Back to Movies"}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <div className="container mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <MovieShowtimeSelector
          movieIdOrSlug={idOrSlug}
          movie={{
            id: movie.id,
            slug: movie.slug,
            title: movie.title,
            poster: movie.poster,
            languages: movie.languages,
            genres: movie.genres,
            duration: movie.duration,
            certification: movie.certification,
            releaseYear,
          }}
        />
      </div>
    </div>
  );
}
