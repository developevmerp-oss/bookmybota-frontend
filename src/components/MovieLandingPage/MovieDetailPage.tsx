"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Play, Share2, Star, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import MovieTrailerModal from "@/components/MovieLandingPage/MovieTrailerModal";
import SafeCoverImage, { MovieImageFallback } from "@/components/Shared/SafeCoverImage";
import {
  useGetPublicCinemaOffersForMovieQuery,
  useGetPublicMovieQuery,
  useGetPublicMovieShowtimesQuery,
} from "@/services/api";
import {
  mapApiMovieToDetail,
  withMovieExtras,
  type MovieDetailData,
  type MovieOfferItem,
} from "@/components/MovieLandingPage/movieCatalog";
import MovieDetailSections from "@/components/MovieLandingPage/MovieDetailSections";
import MovieWishlistButton from "@/components/MovieLandingPage/MovieWishlistButton";
import MovieLanguageFormatModal, {
  allFormatsFromGroups,
  buildLanguageFormatGroups,
  groupsFromShowtimes,
  shouldShowLanguageFormatPicker,
} from "@/components/MovieLandingPage/MovieLanguageFormatModal";
import { MovieDetailShimmer } from "@/components/Shared/Shimmer";
import { useStickyHeaderOffset } from "@/lib/useStickyHeaderOffset";
import { formatDateCustomer } from "@/lib/dateFormat";

/** Matches MovieDetailBanner desktop Book Tickets CTA */
const HERO_BOOK_BTN_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#A78BFA_0%,#8B5CF6_38%,#6D28D9_72%,#4C1D95_100%)] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#6D28D9]/30 hover:opacity-90 transition-opacity";

const HERO_FORMAT_BADGE_CLASS =
  "inline-flex items-center rounded-md border border-white/25 bg-white/15 px-2.5 py-1 text-[11px] sm:text-xs font-bold text-white backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]";

/** District-style: "Released 22 April 2014" / "Releasing …" / "Coming Soon" */
function formatReleasedLine(
  releaseDate?: string,
  comingSoon?: boolean
): string | null {
  if (!releaseDate?.trim()) return null;
  const raw = releaseDate.trim();
  const lower = raw.toLowerCase();
  if (comingSoon || lower.includes("coming")) {
    if (/^(coming|releasing)\b/i.test(raw)) return raw;
    return `Releasing ${raw}`;
  }
  // ISO / wall dates → shared customer format; already-formatted labels pass through.
  const fromHelper = formatDateCustomer(raw);
  const display =
    fromHelper && fromHelper !== "—" && !/^released\b/i.test(raw) ? fromHelper : raw;
  if (/^released\b/i.test(display)) return display;
  return `Released ${display}`;
}

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

function MovieDetailBanner({
  movie,
  formatBadges,
  onBookTickets,
}: {
  movie: MovieDetailData;
  /** When set, BMS-style one pill per format (from showtimes or catalog). */
  formatBadges?: string[];
  onBookTickets: () => void;
}) {
  const router = useRouter();
  const [trailerModalOpen, setTrailerModalOpen] = useState(false);

  /** One Trailer CTA → modal; language pick happens inside when multiple trailers exist. */
  const handleOpenTrailer = () => {
    setTrailerModalOpen(true);
  };
  const handleCloseTrailer = () => {
    setTrailerModalOpen(false);
  };

  const bg = movie.landscape || movie.poster;
  const hasTrailer = Boolean(
    movie.trailerUrl || (movie.trailers && movie.trailers.length > 0)
  );

  // Meta row without release date — District shows release on its own line
  const metaParts = [
    movie.duration,
    movie.genres.length ? movie.genres.join(", ") : "",
    movie.certification,
  ].filter(Boolean);

  const mobileMetaLine = [movie.certification, movie.languages[0], movie.duration]
    .filter(Boolean)
    .join(" | ");

  const releasedLine = formatReleasedLine(movie.releaseDate, movie.comingSoon);

  const heroFormats =
    formatBadges && formatBadges.length > 0
      ? formatBadges
      : (movie.formats || []).map((f) => f.trim()).filter(Boolean);

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

  return (
    <>
      {/* ── Mobile / tablet — BMS-style white top bar + hero ── */}
      <div className="lg:hidden bg-white">
        {/* Fixed sticky header: back | title | share — stays on scroll */}
        <div className="fixed top-0 left-0 right-0 z-40 flex items-center gap-2 border-b border-slate-200 bg-white px-2 sm:px-3 py-2.5 safe-area-pt">
          <button
            type="button"
            onClick={() => router.push("/movies")}
            aria-label="Back to movies"
            className="flex size-10 shrink-0 items-center justify-center text-[#333333] cursor-pointer"
          >
            <ArrowLeft size={22} strokeWidth={2.25} />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-[15px] sm:text-base font-semibold text-[#333333] leading-tight">
            {movie.title}
          </h1>
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share"
            className="flex size-10 shrink-0 items-center justify-center text-[#333333] cursor-pointer"
          >
            <Share2 size={20} strokeWidth={2} />
          </button>
        </div>
        {/* Spacer so hero starts below the fixed header */}
        <div className="h-[3.25rem]" aria-hidden />

        {/* Landscape / poster hero */}
        <section className="relative w-full h-[min(42vh,360px)] min-h-[240px] overflow-hidden bg-[#111]">
          <SafeCoverImage
            src={bg}
            alt={movie.title}
            className="absolute inset-0 h-full w-full object-cover object-center"
            fallbackClassName="absolute inset-0 flex h-full w-full items-center justify-center bg-[#1f1f23] text-white/25"
            fallback={<MovieImageFallback size={64} />}
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />

          {(movie.duration || heroFormats.length > 0 || movie.certification) && (
            <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-16 pt-8 bg-gradient-to-t from-black/75 to-transparent">
              {movie.duration ? (
                <p className="text-[13px] font-medium text-white/90">{movie.duration} •</p>
              ) : null}
              {(heroFormats.length > 0 || movie.certification) && (
                <div className={`${movie.duration ? "mt-2" : ""} flex flex-wrap items-center gap-2`}>
                  {heroFormats.map((fmt) => (
                    <span key={fmt} className={HERO_FORMAT_BADGE_CLASS}>
                      {fmt}
                    </span>
                  ))}
                  {movie.certification ? (
                    <span className={HERO_FORMAT_BADGE_CLASS}>{movie.certification}</span>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {hasTrailer ? (
            <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
              <button
                type="button"
                onClick={handleOpenTrailer}
                className="inline-flex items-center gap-2 rounded-full bg-black/85 px-5 py-2.5 text-[13px] font-semibold text-white cursor-pointer hover:bg-black"
              >
                <Play className="size-3.5" fill="currentColor" />
                Trailer
              </button>
            </div>
          ) : null}
        </section>

        <div className="px-5 sm:px-8 pt-5 pb-2">
          {mobileMetaLine ? (
            <p className="text-[14px] sm:text-[15px] text-[#8B95A5] font-medium leading-snug">
              {mobileMetaLine}
            </p>
          ) : null}

          {movie.genres.length > 0 ? (
            <div className={`${mobileMetaLine ? "mt-3.5" : ""} flex flex-wrap gap-2`}>
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

          {releasedLine ? (
            <p
              className={`${
                mobileMetaLine || movie.genres.length > 0 ? "mt-3.5" : ""
              } text-[14px] sm:text-[15px] text-[#8B95A5] font-normal`}
            >
              {releasedLine}
            </p>
          ) : null}
        </div>
      </div>

      {/* ── Desktop — shorter hero; frame matches admin banner crop 2.5:1 ── */}
      <section className="relative hidden w-full overflow-hidden lg:block h-[460px] xl:h-[480px]">
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <SafeCoverImage
            src={bg}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
            fallbackClassName="absolute inset-0 flex h-full w-full items-center justify-center bg-[#1f1f23] text-white/25"
            fallback={<MovieImageFallback size={64} />}
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>

        <div className="relative container mx-auto flex h-full items-center px-4 sm:px-5 md:px-6 lg:px-8 xl:px-10 2xl:px-0 py-8">
          <button
            type="button"
            onClick={handleShare}
            className="absolute top-5 right-5 sm:top-6 sm:right-10 2xl:right-0 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/35 backdrop-blur-sm border border-white/20 px-3 py-1.5 text-xs sm:text-sm font-medium text-white hover:bg-black/50 cursor-pointer"
          >
            <Share2 className="size-3.5 sm:size-4" />
            Share
          </button>

          <div className="grid w-full grid-cols-1 lg:grid-cols-[200px_1fr] gap-6 lg:gap-12 xl:gap-16 items-center">
            <div className="relative hidden lg:block rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 aspect-[2/3] max-w-[200px] h-[340px] bg-[#F3F4F6]">
              <SafeCoverImage
                src={movie.poster}
                alt={movie.title}
                className="h-full w-full object-cover"
                fallbackClassName="flex h-full w-full items-center justify-center bg-[#F3F4F6] text-slate-300"
                fallback={<MovieImageFallback size={40} />}
                loading="eager"
              />
              {hasTrailer ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                  <button
                    type="button"
                    onClick={handleOpenTrailer}
                    className="inline-flex items-center gap-2 rounded-full bg-black/55 backdrop-blur-md border border-white/20 px-5 py-2.5 text-sm font-semibold text-white hover:bg-black/70 transition-colors cursor-pointer shadow-lg"
                  >
                    <Play className="size-3.5 fill-white text-white" />
                    Trailer
                  </button>
                </div>
              ) : null}
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

              {(heroFormats.length > 0 || movie.languages.length > 0) && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {heroFormats.map((fmt) => (
                    <span key={fmt} className={HERO_FORMAT_BADGE_CLASS + " px-3 py-1.5 text-xs sm:text-sm"}>
                      {fmt}
                    </span>
                  ))}
                  {movie.languages.length > 0 ? (
                    <span className="inline-flex items-center rounded-md border border-white/25 bg-white/15 px-3 py-1.5 text-xs sm:text-sm font-semibold text-white backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                      {movie.languages.join(", ")}
                    </span>
                  ) : null}
                </div>
              )}

              {(movie.rating || movie.votes || movie.likes) && (
                <div className="mt-4 flex flex-wrap items-center gap-2.5 text-sm">
                  {movie.rating && (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-white/15 px-3 py-1.5 text-white backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                      <Star className="size-4 text-[#EF4444]" fill="currentColor" />
                      <span className="font-bold">{movie.rating}</span>
                      {movie.votes ? (
                        <span className="font-medium text-white/85">{movie.votes}</span>
                      ) : null}
                    </span>
                  )}
                  {movie.likes && (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-white/15 px-3 py-1.5 text-white backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                      <ThumbsUp className="size-4 text-[#22C55E]" fill="currentColor" />
                      <span className="font-medium">{movie.likes}</span>
                    </span>
                  )}
                </div>
              )}

              {releasedLine ? (
                <p className="mt-5 text-sm sm:text-[15px] font-normal text-white/85">
                  {releasedLine}
                </p>
              ) : null}

              <div className="mt-5 sm:mt-6 flex flex-wrap items-center gap-3">
                {movie.comingSoon ? (
                  <span className={bookClass.replace("hover:opacity-90", "opacity-80 cursor-default")}>
                    Coming Soon
                  </span>
                ) : (
                  <button type="button" onClick={onBookTickets} className={`${bookClass} cursor-pointer`}>
                    {bookLabel}
                  </button>
                )}
                <MovieWishlistButton movieId={movie.id} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <MovieTrailerModal
        isOpen={trailerModalOpen}
        onClose={handleCloseTrailer}
        movieTitle={movie.title}
        initialTrailerUrl={
          movie.trailers && movie.trailers.length > 1
            ? undefined
            : movie.trailerUrl || movie.trailers?.[0]?.trailerUrl
        }
        initialLanguage={
          movie.trailers && movie.trailers.length > 1
            ? undefined
            : movie.trailers?.[0]?.language
        }
        trailers={movie.trailers}
      />
    </>
  );
}

export default function MovieDetailPage() {
  const params = useParams();
  const router = useRouter();
  const idOrSlug = String(params?.id || "");
  const headerOffset = useStickyHeaderOffset();
  const heroEndRef = useRef<HTMLDivElement>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [langFormatOpen, setLangFormatOpen] = useState(false);

  const { data: apiMovie, isLoading, isError } = useGetPublicMovieQuery(idOrSlug, {
    skip: !idOrSlug,
  });

  const { data: cinemaOffers = [] } = useGetPublicCinemaOffersForMovieQuery(idOrSlug, {
    skip: !idOrSlug,
  });

  const { data: showtimesData } = useGetPublicMovieShowtimesQuery(
    { idOrSlug },
    { skip: !idOrSlug }
  );

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

  const langFormatGroups = useMemo(() => {
    if (!movie) return [];
    return buildLanguageFormatGroups(
      groupsFromShowtimes(showtimesData?.cinemas),
      movie.languages,
      movie.formats || []
    );
  }, [movie, showtimesData?.cinemas]);

  const formatBadges = useMemo(
    () => allFormatsFromGroups(langFormatGroups),
    [langFormatGroups]
  );

  const needsLangFormatPicker = shouldShowLanguageFormatPicker(langFormatGroups);

  useEffect(() => {
    const el = heroEndRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyBar(!entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0,
        rootMargin: `-${Math.max(headerOffset, 0)}px 0px 0px 0px`,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [headerOffset, movie?.id]);

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

  const handleBookTickets = () => {
    if (needsLangFormatPicker) {
      setLangFormatOpen(true);
      return;
    }
    // Single option — go straight to showtimes (pre-filter when we know language/format)
    const only = langFormatGroups[0];
    if (only?.language && only.language !== "All" && only.formats.length === 1) {
      const params = new URLSearchParams();
      params.set("language", only.language);
      params.set("format", only.formats[0]);
      router.push(`${bookHref}?${params.toString()}`);
      return;
    }
    router.push(bookHref);
  };

  return (
    <div className="min-h-screen bg-white pb-24 lg:pb-0">
      <MovieDetailBanner
        movie={movie}
        formatBadges={formatBadges}
        onBookTickets={handleBookTickets}
      />
      {/* Sentinel: sticky bar appears only after hero fully scrolls past */}
      <div ref={heroEndRef} className="h-px w-full" aria-hidden />

      {/* Sticky title + Book tickets — desktop only (mobile/tablet use bottom CTA) */}
      <div
        className={`hidden lg:block fixed left-0 right-0 z-30 w-full border-b border-slate-200 bg-white transition-transform duration-200 ${
          showStickyBar ? "translate-y-0" : "-translate-y-full pointer-events-none"
        }`}
        style={{ top: headerOffset }}
        aria-hidden={!showStickyBar}
      >
        <div className="container mx-auto px-4 sm:px-5 md:px-6 lg:px-8 xl:px-10 2xl:px-0 flex items-center justify-between gap-4 py-3.5">
          <h2 className="min-w-0 truncate text-base sm:text-lg xl:text-xl font-bold text-[#111111]">
            {movie.title}
          </h2>
          {movie.comingSoon ? (
            <span
              className={`${HERO_BOOK_BTN_CLASS} shrink-0 opacity-80 cursor-default rounded-md text-xs sm:text-sm px-4 sm:px-5`}
            >
              Coming Soon
            </span>
          ) : (
            <button
              type="button"
              onClick={handleBookTickets}
              className={`${HERO_BOOK_BTN_CLASS} shrink-0 rounded-md text-xs sm:text-sm px-4 sm:px-5 cursor-pointer`}
            >
              Book tickets
            </button>
          )}
        </div>
      </div>

      <MovieDetailSections movie={movie} idOrSlug={idOrSlug} />

      {/* Sticky Book Tickets — mobile / tablet bottom (hero button color) */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-4 py-3 safe-area-pb">
        {movie.comingSoon ? (
          <span className="flex w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#A78BFA_0%,#8B5CF6_38%,#6D28D9_72%,#4C1D95_100%)] px-5 py-3.5 text-base font-bold text-white opacity-80">
            Coming Soon
          </span>
        ) : (
          <button
            type="button"
            onClick={handleBookTickets}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#A78BFA_0%,#8B5CF6_38%,#6D28D9_72%,#4C1D95_100%)] px-5 py-3.5 text-base font-bold text-white shadow-lg shadow-[#6D28D9]/30 hover:opacity-90 transition-opacity cursor-pointer"
          >
            Book Tickets
            <ArrowRight className="size-5" strokeWidth={2.25} />
          </button>
        )}
      </div>

      <MovieLanguageFormatModal
        open={langFormatOpen}
        onClose={() => setLangFormatOpen(false)}
        movieTitle={movie.title}
        showtimesPath={bookHref}
        groups={langFormatGroups}
      />
    </div>
  );
}
