"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronRight, Play, Share2, Star, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import MovieTrailerModal from "@/components/MovieLandingPage/MovieTrailerModal";
import SafeCoverImage, { MovieImageFallback } from "@/components/Shared/SafeCoverImage";
import {
  useGetPublicCinemaOffersForMovieQuery,
  useGetPublicMovieQuery,
} from "@/services/api";
import {
  mapApiMovieToDetail,
  withMovieExtras,
  type MovieDetailData,
  type MovieOfferItem,
} from "@/components/MovieLandingPage/movieCatalog";
import MovieDetailSections from "@/components/MovieLandingPage/MovieDetailSections";
import MovieWishlistButton from "@/components/MovieLandingPage/MovieWishlistButton";
import { MovieDetailShimmer } from "@/components/Shared/Shimmer";

function mapPlatformOffersToMovieOffers(
  offers: Array<{
    id: string;
    name: string;
    code?: string;
    description?: string | null;
    discount_label: string;
  }>
): MovieOfferItem[] {
  return offers.map((offer) => ({
    id: offer.id,
    title: offer.discount_label || offer.name,
    subtitle: offer.description?.trim() || offer.name,
    promo_code: offer.code?.trim() || undefined,
    discount_label: offer.discount_label,
    description: offer.description?.trim() || undefined,
  }));
}

function openPrimaryTrailer(
  movie: MovieDetailData,
  setUrl: (u?: string) => void,
  setLang: (l?: string) => void,
  setOpen: (o: boolean) => void,
  url?: string,
  lang?: string
) {
  setUrl(url || movie.trailerUrl || movie.trailers?.[0]?.trailerUrl);
  setLang(lang || movie.trailers?.[0]?.language);
  setOpen(true);
}

function MovieDetailBanner({ movie }: { movie: MovieDetailData }) {
  const router = useRouter();
  const [trailerModalOpen, setTrailerModalOpen] = useState(false);
  const [selectedTrailerUrl, setSelectedTrailerUrl] = useState<string | undefined>(undefined);
  const [selectedTrailerLang, setSelectedTrailerLang] = useState<string | undefined>(undefined);

  const handleOpenTrailer = (url?: string, lang?: string) => {
    openPrimaryTrailer(movie, setSelectedTrailerUrl, setSelectedTrailerLang, setTrailerModalOpen, url, lang);
  };

  const bg = movie.landscape || movie.poster;
  const hasTrailer = Boolean(
    movie.trailerUrl || (movie.trailers && movie.trailers.length > 0)
  );

  const metaParts = [
    movie.duration,
    movie.genres.length ? movie.genres.join(", ") : "",
    movie.certification,
    movie.releaseDate,
  ].filter(Boolean);

  const mobileMetaLine = [movie.certification, movie.languages[0], movie.duration]
    .filter(Boolean)
    .join(" | ");

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

  const bookClass =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#A78BFA_0%,#8B5CF6_38%,#6D28D9_72%,#4C1D95_100%)] px-5 sm:px-8 py-2.5 sm:py-3 text-sm sm:text-base font-bold text-white shadow-lg shadow-[#6D28D9]/30 hover:opacity-90 transition-opacity";

  const bookLabel = (
    <>
      Book Tickets
      <ArrowRight className="size-4 sm:size-5" strokeWidth={2.25} />
    </>
  );

  const bookHref = movie.bookHref || `/movies/${movie.slug || movie.id}/showtimes`;

  return (
    <>
      {/* ── Mobile / tablet — District-style hero + info below ── */}
      <div className="lg:hidden bg-white">
        {/* Landscape hero ~40% viewport — matches District reference height */}
        <section className="relative w-full h-[min(42vh,360px)] min-h-[240px] overflow-hidden bg-[#111]">
          <SafeCoverImage
            src={bg}
            alt={movie.title}
            className="absolute inset-0 h-full w-full object-cover object-center"
            fallbackClassName="absolute inset-0 flex h-full w-full items-center justify-center bg-[#1f1f23] text-white/25"
            fallback={<MovieImageFallback size={64} />}
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />

          <button
            type="button"
            onClick={() => router.push("/movies")}
            aria-label="Back to movies"
            className="absolute top-3.5 left-3.5 z-10 flex h-9 w-9 items-center justify-center text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)] cursor-pointer"
          >
            <ArrowLeft size={24} strokeWidth={2.5} />
          </button>

          {hasTrailer ? (
            <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
              {movie.trailers && movie.trailers.length > 1 ? (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {movie.trailers.map((t, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleOpenTrailer(t.trailerUrl, t.language)}
                      className="inline-flex items-center gap-2 rounded-full bg-black/80 px-4 py-2 text-sm font-semibold text-white cursor-pointer hover:bg-black"
                    >
                      <Play className="size-3.5" fill="currentColor" />
                      {t.language}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    handleOpenTrailer(
                      movie.trailerUrl || movie.trailers?.[0]?.trailerUrl,
                      movie.trailers?.[0]?.language
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-full bg-black/85 px-5 py-2.5 text-[13px] font-semibold text-white cursor-pointer hover:bg-black"
                >
                  <Play className="size-3.5" fill="currentColor" />
                  Watch Trailer
                </button>
              )}
            </div>
          ) : null}
        </section>

        <div className="px-5 sm:px-8 pt-5 pb-2">
          <h1 className="text-[26px] sm:text-[30px] font-bold text-[#111111] leading-tight tracking-tight">
            {movie.title}
          </h1>

          {mobileMetaLine ? (
            <p className="mt-2 text-[14px] sm:text-[15px] text-[#8B95A5] font-medium leading-snug">
              {mobileMetaLine}
            </p>
          ) : null}

          {movie.genres.length > 0 ? (
            <div className="mt-3.5 flex flex-wrap gap-2">
              {movie.genres.map((g) => (
                <span
                  key={g}
                  className="inline-flex items-center rounded-full bg-[#F1F3F5] px-3.5 py-1.5 text-[13px] font-medium text-[#4B5563]"
                >
                  {g}
                </span>
              ))}
            </div>
          ) : null}

          {movie.releaseDate ? (
            <p className="mt-3.5 text-[14px] sm:text-[15px] text-[#8B95A5]">
              {movie.comingSoon || movie.releaseDate.toLowerCase().includes("coming")
                ? movie.releaseDate.startsWith("Coming") || movie.releaseDate.startsWith("Releasing")
                  ? movie.releaseDate
                  : `Releasing ${movie.releaseDate}`
                : `Released ${movie.releaseDate}`}
            </p>
          ) : null}
        </div>
      </div>

      {/* ── Desktop — existing immersive banner ── */}
      <section className="relative hidden w-full overflow-hidden lg:block">
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <SafeCoverImage
            src={bg}
            alt=""
            className="h-full w-full object-cover object-center"
            fallbackClassName="flex h-full w-full items-center justify-center bg-[#1f1f23] text-white/25"
            fallback={<MovieImageFallback size={64} />}
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/25" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/30" />
        </div>

        <div className="relative container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 py-8 sm:py-10 lg:py-8">
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

          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 lg:gap-16 xl:gap-20 items-center">
            <div className="hidden lg:block rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 aspect-[2/3] max-w-[250px] h-[380px] bg-[#F3F4F6]">
              <SafeCoverImage
                src={movie.poster}
                alt={movie.title}
                className="h-full w-full object-cover"
                fallbackClassName="flex h-full w-full items-center justify-center bg-[#F3F4F6] text-slate-300"
                fallback={<MovieImageFallback size={40} />}
                loading="eager"
              />
            </div>

            <div className="min-w-0 text-white flex flex-col justify-center">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight">
                {movie.title}
                {/* {movie.promoted ? (
                  <span className="ml-2 align-middle inline-flex items-center rounded-full bg-white/95 text-[#6900AA] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                    Promoted
                  </span>
                ) : null} */}
              </h1>

              {metaParts.length > 0 && (
                <p className="mt-2 text-sm sm:text-base text-white/80">{metaParts.join(" · ")}</p>
              )}

              {(movie.formats.length > 0 || movie.languages.length > 0) && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {movie.formats.length > 0 ? (
                    <span className="inline-flex items-center rounded-md bg-white/95 px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#333333]">
                      {movie.formats.join(", ")}
                    </span>
                  ) : null}
                  {movie.languages.length > 0 ? (
                    <span className="inline-flex items-center rounded-md bg-white/95 px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#333333]">
                      {movie.languages.join(", ")}
                    </span>
                  ) : null}
                </div>
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

              {movie.trailers && movie.trailers.length > 1 ? (
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/60 mr-1 flex items-center gap-1.5">
                    <Play className="size-3.5" fill="currentColor" /> Watch Trailer:
                  </span>
                  {movie.trailers.map((t, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleOpenTrailer(t.trailerUrl, t.language)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/10 px-3.5 py-1.5 text-xs sm:text-sm font-semibold hover:bg-white/20 hover:border-white/50 transition-colors cursor-pointer"
                    >
                      <Play className="size-3 text-rose-400" fill="currentColor" />
                      {t.language}
                    </button>
                  ))}
                </div>
              ) : hasTrailer ? (
                <button
                  type="button"
                  onClick={() =>
                    handleOpenTrailer(
                      movie.trailerUrl || movie.trailers?.[0]?.trailerUrl,
                      movie.trailers?.[0]?.language
                    )
                  }
                  className="mt-5 inline-flex w-fit self-start items-center gap-2 rounded-xl border border-white/60 bg-transparent px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <Play className="size-3.5 text-[#C084FC]" fill="currentColor" />
                  Watch trailer
                </button>
              ) : null}

              <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3">
                {movie.comingSoon ? (
                  <span className={bookClass.replace("hover:opacity-90", "opacity-80 cursor-default")}>
                    Coming Soon
                  </span>
                ) : (
                  <Link href={bookHref} className={bookClass}>
                    {bookLabel}
                  </Link>
                )}
                <MovieWishlistButton movieId={movie.id} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <MovieTrailerModal
        isOpen={trailerModalOpen}
        onClose={() => setTrailerModalOpen(false)}
        movieTitle={movie.title}
        initialTrailerUrl={selectedTrailerUrl}
        initialLanguage={selectedTrailerLang}
        trailers={movie.trailers}
      />
    </>
  );
}

export default function MovieDetailPage() {
  const params = useParams();
  const idOrSlug = String(params?.id || "");

  const { data: apiMovie, isLoading, isError } = useGetPublicMovieQuery(idOrSlug, {
    skip: !idOrSlug,
  });

  const { data: cinemaOffers = [] } = useGetPublicCinemaOffersForMovieQuery(idOrSlug, {
    skip: !idOrSlug,
  });

  const movie = useMemo<MovieDetailData | null>(() => {
    if (!apiMovie) return null;
    const mapped = mapApiMovieToDetail(apiMovie);
    const offers = mapPlatformOffersToMovieOffers(
      cinemaOffers.map((o) => ({
        id: o.id,
        name: o.cinema_name ? `${o.name} · ${o.cinema_name}` : o.name,
        code: o.code,
        description: o.description,
        discount_label: o.discount_label,
      }))
    );
    return withMovieExtras(
      { ...mapped, offers },
      { fillCastCrew: false, fillOffers: false, fillReviews: false, fillRating: false }
    );
  }, [apiMovie, cinemaOffers]);

  if (isLoading) {
    return <MovieDetailShimmer />;
  }

  if (!movie || isError) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 px-5 text-center">
        <p className="text-base sm:text-lg text-slate-700 font-semibold">Movie not found</p>
        <Link href="/movies" className="text-sm sm:text-base font-semibold text-[#6900AA]">
          Back to Movies
        </Link>
      </div>
    );
  }

  const bookHref = movie.bookHref || `/movies/${movie.slug || movie.id}/showtimes`;

  return (
    <div className="min-h-screen bg-white pb-24 lg:pb-0">
      <MovieDetailBanner movie={movie} />

      
      <MovieDetailSections movie={movie} idOrSlug={idOrSlug} />

      {/* Sticky Book Tickets — mobile / tablet */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-4 py-3 safe-area-pb">
        {movie.comingSoon ? (
          <span className="flex w-full items-center justify-center rounded-xl bg-[#111111] px-5 py-3.5 text-base font-bold text-white opacity-80">
            Coming Soon
          </span>
        ) : (
          <Link
            href={bookHref}
            className="flex w-full items-center justify-center rounded-xl bg-[#111111] px-5 py-3.5 text-base font-bold text-white hover:bg-zinc-900 transition-colors"
          >
            Book Tickets
          </Link>
        )}
      </div>
    </div>
  );
}
