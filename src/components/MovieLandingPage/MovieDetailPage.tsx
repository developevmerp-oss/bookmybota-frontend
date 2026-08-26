"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2, Play, Share2, Star, ThumbsUp } from "lucide-react";
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

function languagePills(languages: string[]) {
  if (languages.length <= 2) return { shown: languages, extra: 0 };
  return { shown: languages.slice(0, 2), extra: languages.length - 2 };
}

function formatPills(formats: string[]) {
  if (formats.length <= 5) return { shown: formats, extra: 0 };
  return { shown: formats.slice(0, 5), extra: formats.length - 5 };
}

function MovieDetailBanner({ movie }: { movie: MovieDetailData }) {
  const langs = languagePills(movie.languages);
  const fmts = formatPills(movie.formats);
  const bg = movie.landscape || movie.poster;
  const metaParts = [
    movie.duration,
    movie.genres.length ? movie.genres.join(", ") : "",
    movie.certification,
    movie.releaseDate,
  ].filter(Boolean);

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

  return (
    <section className="relative w-full overflow-hidden">
      {/* Full-width movie background with opacity */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <img
          src={bg}
          alt=""
          className="h-full w-full object-cover object-center scale-105 opacity-70"
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/40 to-black/25" />
      </div>

      <div className="relative container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0">
        <div className="relative h-[200px] sm:h-[260px] lg:h-[320px]">
          <button
            type="button"
            onClick={handleShare}
            className="absolute top-3 right-0 sm:top-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/45 backdrop-blur-sm px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-sm font-medium text-white hover:bg-black/55 cursor-pointer"
          >
            <Share2 size={13} />
            Share
          </button>

          <div className="h-full flex items-center gap-4 sm:gap-6 lg:gap-8">
            {/* Poster — left */}
            <div className="h-[168px] sm:h-[220px] lg:h-[280px] aspect-[2/3] shrink-0">
              <div className="relative h-full w-full rounded-lg sm:rounded-xl overflow-hidden bg-slate-800 shadow-[0_10px_28px_rgba(0,0,0,0.35)]">
                <img
                  src={movie.poster}
                  alt={movie.title}
                  className="h-full w-full object-cover"
                />
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
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[2] inline-flex items-center gap-1 rounded-full bg-black/55 backdrop-blur-sm px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs font-semibold text-white cursor-pointer hover:bg-black/70"
                  >
                    <Play size={10} fill="currentColor" />
                    Trailers ({movie.trailersCount})
                  </button>
                )}
                <div className="absolute inset-x-0 bottom-0 z-[2] bg-black px-2 py-1 sm:py-1.5 text-center text-[10px] sm:text-xs font-semibold text-white">
                  {movie.comingSoon ? "Coming Soon" : "In cinemas"}
                </div>
              </div>
            </div>

            {/* Content — right (white text on dark banner) */}
            <div className="min-w-0 flex-1 flex flex-col justify-center pr-12 sm:pr-16">
              <h1 className="text-base sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-snug line-clamp-2 mb-1.5 sm:mb-2.5">
                {movie.title}
              </h1>

              {(movie.rating || movie.likes) && (
                <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-white mb-1.5 sm:mb-2">
                  {movie.likes ? (
                    <>
                      <ThumbsUp size={14} className="text-[#22C55E]" fill="currentColor" />
                      <span className="font-semibold truncate">{movie.likes}</span>
                    </>
                  ) : (
                    <>
                      <Star size={14} className="text-[#F84464]" fill="currentColor" />
                      <span className="font-bold shrink-0">{movie.rating}</span>
                      {movie.votes && (
                        <span className="text-white/80 truncate">({movie.votes}) ›</span>
                      )}
                    </>
                  )}
                </div>
              )}

              {metaParts.length > 0 && (
                <p className="text-[11px] sm:text-sm text-white/90 leading-snug line-clamp-2 mb-2 sm:mb-3">
                  {metaParts.join(" • ")}
                </p>
              )}

              <div className="hidden sm:flex flex-wrap gap-1.5 mb-3 lg:mb-4">
                {fmts.shown.length > 0 && (
                  <span className="inline-flex items-center rounded-md bg-white/15 border border-white/20 px-2 py-1 text-[11px] sm:text-xs font-medium text-white">
                    {fmts.shown.join(", ")}
                    {fmts.extra > 0 ? `, +${fmts.extra}` : ""}
                  </span>
                )}
                {langs.shown.length > 0 && (
                  <span className="inline-flex items-center rounded-md bg-white/15 border border-white/20 px-2 py-1 text-[11px] sm:text-xs font-medium text-white">
                    {langs.shown.join(", ")}
                    {langs.extra > 0 ? `, +${langs.extra}` : ""}
                  </span>
                )}
              </div>

              {movie.bookHref ? (
                <Link
                  href={movie.bookHref}
                  className="inline-flex items-center justify-center rounded-lg bg-[#F84464] px-5 sm:px-8 py-1.5 sm:py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-[#E11D48] transition-colors self-start"
                >
                  Book tickets
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
                  className="inline-flex items-center justify-center rounded-lg bg-[#F84464] px-5 sm:px-8 py-1.5 sm:py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-[#E11D48] transition-colors cursor-pointer self-start"
                >
                  Book tickets
                </button>
              )}
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
      releaseDate: formatReleaseShort(event.next_showtime),
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
        <Loader2 size={32} className="animate-spin text-[#6900AA]" />
        <p className="text-sm font-medium">Loading movie...</p>
      </div>
    );
  }

  if (!movie || (!isCatalogId && isError)) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 px-5 text-center">
        <p className="text-slate-700 font-semibold">Movie not found</p>
        <Link href="/movies" className="text-sm font-semibold text-[#6900AA]">
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
