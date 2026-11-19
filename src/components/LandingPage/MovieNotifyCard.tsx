"use client";

import { useState } from "react";
import Link from "next/link";
import { Clapperboard, Star } from "lucide-react";
// import { ArrowRight } from "lucide-react"; // used by commented Book Now / View Details CTA
import MovieWishlistButton from "@/components/MovieLandingPage/MovieWishlistButton";
import { formatMovieCardMeta } from "@/lib/movieDisplay";
import { useAdaptiveCard } from "@/components/LandingPage/AdaptiveCardRow";
import {
  // formatMovieReleaseLabel, // used by commented release date row
  movieDetailMeta,
  type MustWatchMovieCard,
} from "./useMustWatchMoviesCatalog";

// const ACCENT = "#B08D57"; // used by commented release date row

const cardShell =
  "bg-white border border-[#EAEAEA] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(17,17,17,0.06)] hover:shadow-[0_8px_24px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300";

function formatReviewsCount(count: number) {
  if (count >= 1000) {
    const k = count / 1000;
    const label = Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k`;
    return `(${label})`;
  }
  return `(${count})`;
}

/**
 * Must-Watch movie card — status on poster; rating on title row (right);
 * genre meta, release date, CTA below.
 * Typography densifies inside 5-up AdaptiveCardRow slots.
 */
export function MovieNotifyCard({
  movie,
  dense: denseProp,
}: {
  movie: MustWatchMovieCard;
  /** Force compact type for 5-up grids outside AdaptiveCardRow. */
  dense?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const adaptive = useAdaptiveCard();
  const dense = denseProp ?? (adaptive?.minVisible ?? 0) >= 5;
  const showPoster = Boolean(movie.poster) && !imgFailed;
  const meta = movieDetailMeta(movie);
  // const releaseLabel = formatMovieReleaseLabel(movie.releaseDate);
  const comingSoon = Boolean(movie.comingSoon);
  const promoted = Boolean(movie.promoted);
  const rating = meta.rating;
  const reviewsCount = Math.max(0, Number(movie.reviewsCount) || 0);
  const showRating = rating != null && !comingSoon;
  // const ctaClass =
  //   "shrink-0 inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-[12px] font-semibold tracking-wide text-[#1C1C1C] shadow-sm transition-colors border-[#D4C4A8] group-hover:border-[#B08D57]";

  const metaLine = formatMovieCardMeta(movie.certification, movie.languages);

  return (
    <Link href={movie.href} className={`group block h-full w-full ${cardShell}`}>
      <article className="flex h-full flex-col">
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#F7F7F7]">
          {showPoster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={movie.poster}
              alt=""
              className="h-full w-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.04]"
              loading="lazy"
              draggable={false}
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-300">
              <Clapperboard size={dense ? 28 : 32} strokeWidth={1.4} />
            </div>
          )}

          {/* Status — top left on poster (Coming Soon wins over Promoted); badge UI matches dining */}
          {comingSoon ? (
            <span
              className={`absolute z-[2] pointer-events-none inline-flex max-w-[70%] items-center rounded-full bg-black/70 font-semibold tracking-wide text-white backdrop-blur-[2px] shadow-sm ${
                dense
                  ? "top-2 left-2 px-2 py-0.5 text-[10px]"
                  : "top-3 left-3 px-2.5 py-1 text-[11px]"
              }`}
            >
              Coming Soon
            </span>
          ) : promoted ? (
            <span
              className={`absolute z-[2] pointer-events-none inline-flex max-w-[70%] items-center rounded-full bg-white/80 backdrop-blur-[2px] font-semibold text-slate-900 shadow-sm border border-white/60 ${
                dense
                  ? "top-2 left-2 px-2 py-0.5 text-[10px]"
                  : "top-3 left-3 px-2.5 py-1 text-[11px]"
              }`}
            >
              Promoted
            </span>
          ) : null}

          <MovieWishlistButton
            movieId={String(movie.id)}
            appearance="glass"
            className={
              dense
                ? "absolute top-2 right-2 z-[2] w-8 h-8 rounded-full bg-white/35 backdrop-blur-md border border-white/50 shadow-sm flex items-center justify-center hover:bg-white/50 transition-colors cursor-pointer disabled:opacity-70"
                : undefined
            }
          />
        </div>

        <div
          className={`flex flex-col min-w-0 ${
            dense
              ? "gap-0.5 px-2.5 pt-2 pb-2.5"
              : "gap-0.5 sm:gap-1 px-2.5 sm:px-3.5 pt-2.5 sm:pt-3 pb-3 sm:pb-3.5"
          }`}
        >
          <div className={`flex items-start justify-between min-w-0 ${dense ? "gap-1" : "gap-1.5 sm:gap-2"}`}>
            <h3
              className={`min-w-0 flex-1 font-bold text-[#1C1C1C] break-words leading-snug line-clamp-2 tracking-wide ${
                dense
                  ? "text-[0.8125rem] sm:text-[0.875rem] lg:text-[0.9375rem]"
                  : "text-[0.875rem] sm:text-base md:text-lg"
              }`}
            >
              {movie.title}
            </h3>
            {showRating ? (
              <span
                className={`shrink-0 inline-flex items-center pt-0.5 ${dense ? "gap-0.5" : "gap-1"}`}
                aria-label={`Rated ${rating.toFixed(1)}${reviewsCount > 0 ? ` from ${reviewsCount} reviews` : ""}`}
              >
                <Star
                  size={dense ? 11 : 13}
                  className="fill-[#F5C518] text-[#F5C518]"
                  strokeWidth={0}
                />
                <span
                  className={`font-bold tabular-nums text-[#1C1C1C] leading-none ${
                    dense ? "text-[11px] sm:text-xs" : "text-xs sm:text-sm"
                  }`}
                >
                  {rating.toFixed(1)}
                </span>
                {reviewsCount > 0 ? (
                  <>
                    <span className="hidden sm:inline text-gray-300 leading-none" aria-hidden>
                      |
                    </span>
                    <span
                      className={`hidden sm:inline font-medium tabular-nums text-gray-500 leading-none ${
                        dense ? "text-[11px]" : "text-sm"
                      }`}
                    >
                      {formatReviewsCount(reviewsCount)}
                    </span>
                  </>
                ) : null}
              </span>
            ) : null}
          </div>

          {metaLine ? (
            <p
              className={`min-w-0 tracking-wide text-gray-600 truncate leading-snug ${
                dense ? "text-[11px] sm:text-xs" : "text-xs sm:text-sm"
              }`}
            >
              {metaLine}
            </p>
          ) : null}

          {/* Date + Book Now / View Details — hidden on landing movie cards
          <div className="flex items-center justify-between gap-2 pt-1.5 min-w-0">
            {releaseLabel ? (
              <p
                className="min-w-0 truncate text-sm font-semibold tracking-wide"
                style={{ color: ACCENT }}
              >
                {releaseLabel}
              </p>
            ) : (
              <span />
            )}

            {comingSoon ? (
              <span className={ctaClass}>
                View Details
                <ArrowRight size={13} strokeWidth={2.25} />
              </span>
            ) : (
              <span className={ctaClass}>
                Book Now
                <ArrowRight size={13} strokeWidth={2.25} />
              </span>
            )}
          </div>
          */}
        </div>
      </article>
    </Link>
  );
}
