"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Clapperboard, Crown, Star } from "lucide-react";
import MovieWishlistButton from "@/components/MovieLandingPage/MovieWishlistButton";
import {
  formatMovieReleaseLabel,
  movieDetailMeta,
  type MustWatchMovieCard,
} from "./useMustWatchMoviesCatalog";

const ACCENT = "#B08D57";

const cardShell =
  "bg-white border border-[#EAEAEA] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(17,17,17,0.06)] hover:shadow-[0_8px_24px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300";

/**
 * Must-Watch movie card — status + rating on poster, genre meta, release date, CTA.
 */
export function MovieNotifyCard({ movie }: { movie: MustWatchMovieCard }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showPoster = Boolean(movie.poster) && !imgFailed;
  const meta = movieDetailMeta(movie);
  const releaseLabel = formatMovieReleaseLabel(movie.releaseDate);
  const comingSoon = Boolean(movie.comingSoon);
  const promoted = Boolean(movie.promoted);
  const rating = meta.rating;
  const showRating = rating != null;
  const ctaClass =
    "shrink-0 inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-[12px] font-semibold tracking-wide text-[#1C1C1C] shadow-sm transition-colors border-[#D4C4A8] group-hover:border-[#B08D57]";

  // Genre · Language · Format
  const detailParts = [meta.genres, meta.language, meta.format].filter(Boolean);

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

          {/* Rating — bottom right on poster */}
          {showRating ? (
            <span className="absolute bottom-3 right-3 z-[2] inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-white backdrop-blur-[2px]">
              <Star
                size={11}
                className="fill-[#F5C518] text-[#F5C518]"
                strokeWidth={0}
              />
              <span className="text-[12px] font-bold tabular-nums leading-none">
                {rating.toFixed(1)}
              </span>
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1 px-3.5 pt-3 pb-3.5 min-w-0">
          <h3 className="text-base tracking-wide sm:text-lg font-bold text-[#1C1C1C] truncate leading-snug">
            {movie.title}
          </h3>

          {showRating || detailParts.length > 0 ? (
            <p className="inline-flex items-center gap-1.5 min-w-0 text-sm tracking-wide text-gray-600 truncate leading-snug">
              {showRating ? (
                <>
                  <Star
                    size={12}
                    className="shrink-0 fill-[#F5C518] text-[#F5C518]"
                    strokeWidth={0}
                  />
                  <span className="font-semibold text-[#1C1C1C] tabular-nums">
                    {rating.toFixed(1)}
                  </span>
                  {detailParts.length > 0 ? (
                    <span className="text-gray-400">·</span>
                  ) : null}
                </>
              ) : null}
              {detailParts.length > 0 ? (
                <span className="truncate">{detailParts.join(" · ")}</span>
              ) : null}
            </p>
          ) : null}

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
        </div>
      </article>
    </Link>
  );
}
