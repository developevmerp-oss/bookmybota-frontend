"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Clapperboard, Crown, Star } from "lucide-react";
import MovieWishlistButton from "@/components/MovieLandingPage/MovieWishlistButton";
import {
  movieDetailMeta,
  type MustWatchMovieCard,
} from "./useMustWatchMoviesCatalog";

const cardShell =
  "bg-white border border-[#EAEAEA] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(17,17,17,0.06)] hover:shadow-[0_8px_24px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300";

/** Detail-style Must-Watch movie card (wishlist, status, rating/format, book CTA). */
export function MovieDetailCard({ movie }: { movie: MustWatchMovieCard }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showPoster = Boolean(movie.poster) && !imgFailed;
  const meta = movieDetailMeta(movie);
  const showRatingBadge = meta.rating != null && !movie.comingSoon;

  return (
    <Link href={movie.href} className={`group block h-full w-full ${cardShell}`}>
      <article className="flex h-full flex-col">
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#F3F4F6]">
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

          {/* Status — top left (Coming Soon wins over Promoted) */}
          {movie.comingSoon ? (
            <span className="absolute top-3 left-3 z-[2] inline-flex max-w-[70%] items-center rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-[2px] shadow-sm">
              Coming Soon
            </span>
          ) : movie.promoted ? (
            <span className="absolute top-3 left-3 z-[2] inline-flex max-w-[70%] items-center gap-1 rounded-full bg-[#6900AA] px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white shadow-sm">
              <Crown size={11} className="shrink-0 text-[#FCD34D]" strokeWidth={2.25} fill="#FCD34D" />
              Promoted
            </span>
          ) : null}

          <MovieWishlistButton
            movieId={String(movie.id)}
            tone="onLight"
            className="absolute top-3 right-3 z-[2] w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-70"
          />

          {/* Rating — bottom left (now showing only) */}
          {showRatingBadge ? (
            <span className="absolute bottom-3 left-3 z-[2] inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-white backdrop-blur-[2px]">
              <Star size={11} className="fill-[#F5C518] text-[#F5C518]" strokeWidth={0} />
              <span className="text-[12px] font-bold tabular-nums leading-none">
                {meta.rating!.toFixed(1)}
              </span>
            </span>
          ) : null}

          {/* Format — bottom right */}
          {meta.format ? (
            <span className="absolute bottom-3 right-3 z-[2] inline-flex items-center rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white backdrop-blur-[2px]">
              {meta.format}
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-1 px-3.5 pt-3 pb-3.5 min-w-0">
          <h3 className="text-base tracking-wide sm:text-lg font-bold text-[#1C1C1C] truncate leading-snug">
            {movie.title}
          </h3>

          {meta.metaLine ? (
            <p className="inline-flex items-center gap-1.5 min-w-0 text-sm tracking-wide text-gray-600 truncate">
              {meta.rating != null && !movie.comingSoon ? (
                <>
                  <Star size={12} className="shrink-0 fill-[#F5C518] text-[#F5C518]" strokeWidth={0} />
                  <span className="font-semibold text-[#1C1C1C] tabular-nums">
                    {meta.rating.toFixed(1)}
                  </span>
                  {(meta.duration || meta.format) ? (
                    <span className="text-gray-400">·</span>
                  ) : null}
                </>
              ) : null}
              <span className="truncate">
                {[meta.duration, meta.format].filter(Boolean).join(" · ")}
              </span>
            </p>
          ) : null}

          {meta.genres ? (
            <p className="text-sm tracking-wide text-gray-600 truncate">{meta.genres}</p>
          ) : null}

          {meta.certification || meta.language ? (
            <p className="text-sm tracking-wide text-gray-600 truncate">
              {[meta.certification, meta.language].filter(Boolean).join(" | ")}
            </p>
          ) : null}

          <div className="mt-auto flex items-center justify-between gap-2 pt-2 min-w-0">
            {movie.comingSoon ? (
              <>
                <p className="min-w-0 truncate text-sm font-semibold tracking-wide text-gray-500">
                  Tickets opening soon
                </p>
                <span className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold tracking-wide text-[#6900AA]">
                  Notify
                  <ArrowRight size={14} strokeWidth={2.25} />
                </span>
              </>
            ) : (
              <>
                {meta.fromPrice != null ? (
                  <p className="min-w-0 truncate text-sm tracking-wide text-[#1C1C1C]">
                    From <span className="font-bold">ETB {meta.fromPrice}</span>
                  </p>
                ) : (
                  <p className="min-w-0 truncate text-sm tracking-wide text-gray-500">
                    {meta.certification || "Now showing"}
                  </p>
                )}
                <span className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold tracking-wide text-[#C45C26]">
                  Book Now
                  <ArrowRight size={14} strokeWidth={2.25} />
                </span>
              </>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
