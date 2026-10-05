"use client";

import { useState } from "react";
import Link from "next/link";
import { Clapperboard, Crown, Star } from "lucide-react";
// import { ArrowRight } from "lucide-react"; // used by commented Book Now / View Details CTA
import MovieWishlistButton from "@/components/MovieLandingPage/MovieWishlistButton";
import { formatMovieCardMeta } from "@/lib/movieDisplay";
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
 */
export function MovieNotifyCard({ movie }: { movie: MustWatchMovieCard }) {
  const [imgFailed, setImgFailed] = useState(false);
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
              <Clapperboard size={32} strokeWidth={1.4} />
            </div>
          )}

          {/* Status — top left on poster (Coming Soon wins over Promoted) */}
          {comingSoon ? (
            <span className="absolute top-3 left-3 z-[2] inline-flex max-w-[65%] items-center rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-[2px] shadow-sm">
              Coming Soon
            </span>
          ) : promoted ? (
            <span className="absolute top-3 left-3 z-[2] inline-flex max-w-[65%] items-center gap-1 rounded-full bg-[#6900AA] px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white shadow-sm">
              <Crown
                size={11}
                className="shrink-0 text-[#FCD34D]"
                strokeWidth={2.25}
                fill="#FCD34D"
              />
              Promoted
            </span>
          ) : null}

          <MovieWishlistButton
            movieId={String(movie.id)}
            tone="onLight"
            className="absolute top-3 right-3 z-[2] w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-70"
          />
        </div>

        <div className="flex flex-col gap-1 px-3.5 pt-3 pb-3.5 min-w-0">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <h3 className="min-w-0 flex-1 text-base tracking-wide sm:text-lg font-bold text-[#1C1C1C] truncate leading-snug">
              {movie.title}
            </h3>
            {showRating ? (
              <span
                className="shrink-0 inline-flex items-center gap-1 pt-0.5"
                aria-label={`Rated ${rating.toFixed(1)}${reviewsCount > 0 ? ` from ${reviewsCount} reviews` : ""}`}
              >
                <Star
                  size={13}
                  className="fill-[#F5C518] text-[#F5C518]"
                  strokeWidth={0}
                />
                <span className="text-sm font-bold tabular-nums text-[#1C1C1C] leading-none">
                  {rating.toFixed(1)}
                </span>
                {reviewsCount > 0 ? (
                  <>
                    <span className="text-gray-300 leading-none" aria-hidden>
                      |
                    </span>
                    <span className="text-sm font-medium tabular-nums text-gray-500 leading-none">
                      {formatReviewsCount(reviewsCount)}
                    </span>
                  </>
                ) : null}
              </span>
            ) : null}
          </div>

          {metaLine ? (
            <p className="min-w-0 text-sm tracking-wide text-gray-600 truncate leading-snug">
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
