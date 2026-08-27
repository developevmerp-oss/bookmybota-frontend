"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, ChevronRight, Heart, Loader2, Play, Share2, Star, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import {
  useGetPublicEventOffersQuery,
  useGetPublicEventQuery,
  useGetPublicEventReviewsQuery,
} from "@/services/api";
import { parseEventLanguages } from "@/lib/eventValidation";
import {
  formatDurationShort,
  formatReleaseShort,
  formatVotesLabel,
  getCatalogMovie,
  withMovieExtras,
  type MovieDetailData,
} from "@/components/MovieLandingPage/movieCatalog";
import MovieDetailSections from "@/components/MovieLandingPage/MovieDetailSections";

const FAVORITES_KEY = "movie_detail_favorites";

function parseGenres(genres?: string[] | string | null): string[] {
  if (!genres) return [];
  if (Array.isArray(genres)) return genres.map(String).map((g) => g.trim()).filter(Boolean);
  try {
    const parsed = JSON.parse(genres);
    return Array.isArray(parsed) ? parsed.map(String).map((g) => g.trim()).filter(Boolean) : [];
  } catch {
    return String(genres)
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);
  }
}

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

        <div className="flex items-center gap-4 sm:gap-6 lg:gap-10">
          <div className="w-2/5 sm:w-1/4 lg:w-1/5 shrink-0">
            <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-slate-800 ring-1 ring-white/20 shadow-[0_0_2.5rem_rgba(105,0,170,0.28)]">
              <img src={movie.poster} alt={movie.title} className="h-full w-full object-cover" />
              {typeof movie.trailersCount === "number" && movie.trailersCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (movie.trailerUrl) {
                      window.open(movie.trailerUrl, "_blank", "noopener,noreferrer");
                      return;
                    }
                    toast.message("Trailers coming soon");
                  }}
                  className="absolute left-1/2 bottom-12 sm:bottom-14 -translate-x-1/2 z-[2] inline-flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-sm px-3 py-1.5 text-xs sm:text-sm font-semibold text-white cursor-pointer hover:bg-black/70"
                >
                  <Play className="size-3 sm:size-3.5" fill="currentColor" />
                  Trailers ({movie.trailersCount})
                </button>
              )}
              <div className="absolute inset-x-0 bottom-0 z-[2] bg-black px-2 py-1.5 sm:py-2 text-center text-xs sm:text-sm font-semibold text-white flex items-center justify-center gap-1.5">
                <ThumbsUp
                  className={`size-3.5 ${movie.comingSoon ? "text-amber-400" : "text-[#22C55E]"}`}
                  fill="currentColor"
                />
                {movie.comingSoon ? "Coming Soon" : "In Cinemas"}
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1 flex flex-col justify-center gap-3 sm:gap-3.5 lg:gap-4 pr-14 sm:pr-20">
            <h1 className="text-xl sm:text-3xl lg:text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-tight">
              {movie.title}
            </h1>

            {(movie.rating || movie.likes) && (
              <div className="inline-flex items-center gap-2 self-start rounded-full bg-black/45 backdrop-blur-sm border border-white/10 px-3 py-1.5 text-xs sm:text-sm text-white">
                {movie.likes ? (
                  <>
                    <ThumbsUp className="size-3.5 sm:size-4 text-[#22C55E]" fill="currentColor" />
                    <span className="font-semibold truncate">{movie.likes}</span>
                  </>
                ) : (
                  <>
                    <Star className="size-3.5 sm:size-4 text-[#F84464]" fill="currentColor" />
                    <span className="font-bold shrink-0">{movie.rating}</span>
                    {movie.votes && (
                      <span className="inline-flex items-center text-white/80 truncate">
                        ({movie.votes})
                        <ChevronRight className="size-3.5 shrink-0" />
                      </span>
                    )}
                  </>
                )}
              </div>
            )}

            {metaParts.length > 0 && (
              <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
                {metaParts.join(" • ")}
              </p>
            )}

            {(movie.formats.length > 0 || movie.languages.length > 0) && (
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {movie.formats.map((format) => (
                  <span
                    key={format}
                    className="inline-flex items-center rounded-full bg-black/40 backdrop-blur-sm border border-white/20 px-2.5 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm font-medium text-white"
                  >
                    {format}
                  </span>
                ))}
                {movie.languages.length > 0 && (
                  <span className="inline-flex items-center rounded-full bg-black/40 backdrop-blur-sm border border-white/20 px-2.5 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm font-medium text-white">
                    {languageLine(movie.languages)}
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
              {movie.bookHref ? (
                <Link href={movie.bookHref} className={bookClass}>
                  {bookLabel}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    toast.message(
                      movie.comingSoon
                        ? "Tickets will open soon"
                        : "Booking opens soon for this showcase title"
                    )
                  }
                  className={`${bookClass} cursor-pointer`}
                >
                  {bookLabel}
                </button>
              )}
              <button
                type="button"
                aria-label={saved ? "Remove from favorites" : "Add to favorites"}
                aria-pressed={saved}
                onClick={toggleFavorite}
                className="inline-flex size-10 sm:size-12 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border border-white/30 text-white hover:bg-black/55 transition-colors cursor-pointer"
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
  const id = String(params?.id || "");
  const catalogHit = getCatalogMovie(id);
  const isCatalogId = Boolean(catalogHit);

  const { data: event, isLoading, isError } = useGetPublicEventQuery(id, {
    skip: isCatalogId || !id,
  });
  const { data: apiOffers = [] } = useGetPublicEventOffersQuery(id, {
    skip: isCatalogId || !id,
  });
  const { data: apiReviews = [] } = useGetPublicEventReviewsQuery(id, {
    skip: isCatalogId || !id,
  });

  const movie = useMemo<MovieDetailData | null>(() => {
    if (catalogHit) return withMovieExtras(catalogHit);
    if (!event) return null;
    const ratingNum = Number(event.rating);
    const votesNum = Number(event.reviews_count);
    const hasRating = Number.isFinite(ratingNum) && ratingNum > 0;
    const hasVotes = Number.isFinite(votesNum) && votesNum > 0;
    const genres = parseGenres(event.genres);
    const category = event.category_name?.trim();
    if (category && !genres.some((g) => g.toLowerCase() === category.toLowerCase())) {
      genres.unshift(category);
    }
    const mappedOffers = apiOffers.map((o) => ({
      id: o.id,
      title: o.title,
      subtitle: o.description || "Tap to view details",
    }));
    const mappedReviews = apiReviews.slice(0, 8).map((r) => ({
      id: String(r.id),
      userName: r.user_name || "User",
      rating: `${Number(r.rating) || 0}/10`,
      text: r.text || "Booked on BookMyBota",
      likes: 0,
      timeAgo: r.created_at
        ? new Date(r.created_at).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
          })
        : undefined,
    }));
    return withMovieExtras({
      id: event.id,
      title: event.name,
      poster:
        event.poster_vertical_url ||
        event.poster_horizontal_url ||
        "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&h=750&fit=crop&q=80",
      landscape: event.poster_horizontal_url || event.poster_vertical_url || undefined,
      certification: event.age_group?.trim() || undefined,
      languages: parseEventLanguages(event.language),
      genres,
      formats: ["2D"],
      rating: hasRating ? `${ratingNum.toFixed(1)}/10` : undefined,
      votes: hasRating && hasVotes ? formatVotesLabel(votesNum) : undefined,
      likes: !hasRating && hasVotes ? formatVotesLabel(votesNum).replace("Votes", "Likes") : undefined,
      duration: formatDurationShort(event.duration_minutes),
      releaseDate: formatReleaseShort(
        (event as { next_showtime?: string }).next_showtime
      ),
      synopsis: event.about_event?.trim() || undefined,
      trailersCount: event.gallery_images?.length || 0,
      inCinemas: true,
      bookHref: `/events/${event.id}/book`,
      offers: mappedOffers.length ? mappedOffers : undefined,
      reviews: mappedReviews.length ? mappedReviews : undefined,
      reviewsCountLabel: hasVotes ? `${formatVotesLabel(votesNum).replace(" Votes", "")} reviews` : undefined,
    });
  }, [catalogHit, event, apiOffers, apiReviews]);

  if (!isCatalogId && isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="size-8 animate-spin text-[#6900AA]" />
        <p className="text-sm sm:text-base font-medium">Loading movie...</p>
      </div>
    );
  }

  if (!movie || (!isCatalogId && isError)) {
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
