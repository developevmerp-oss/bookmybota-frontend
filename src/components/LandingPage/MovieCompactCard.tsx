"use client";

import { useState } from "react";
import Link from "next/link";
import { Clapperboard, Crown } from "lucide-react";
import MovieWishlistButton from "@/components/MovieLandingPage/MovieWishlistButton";
import {
  movieDetailMeta,
  type MustWatchMovieCard,
} from "./useMustWatchMoviesCatalog";

const cardShell =
  "bg-white border border-[#EAEAEA] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(17,17,17,0.06)] hover:shadow-[0_8px_24px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300";

/**
 * Compact Must-Watch movie card — status + format on poster,
 * title, duration, genres, language (same fields for every movie).
 */
export function MovieCompactCard({ movie }: { movie: MustWatchMovieCard }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showPoster = Boolean(movie.poster) && !imgFailed;
  const meta = movieDetailMeta(movie);

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

          {movie.comingSoon ? (
            <span className="absolute top-3 left-3 z-[2] inline-flex max-w-[65%] items-center rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-[2px] shadow-sm">
              Coming Soon
            </span>
          ) : movie.promoted ? (
            <span className="absolute top-3 left-3 z-[2] inline-flex max-w-[65%] items-center gap-1 rounded-full bg-[#6900AA] px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white shadow-sm">
              <Crown size={11} className="shrink-0 text-[#FCD34D]" strokeWidth={2.25} fill="#FCD34D" />
              Promoted
            </span>
          ) : null}

          <MovieWishlistButton
            movieId={String(movie.id)}
            tone="onLight"
            className="absolute top-3 right-3 z-[2] w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-70"
          />

          {meta.format ? (
            <span className="absolute bottom-3 left-3 z-[2] inline-flex items-center rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white backdrop-blur-[2px]">
              {meta.format}
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-1 px-3.5 pt-3 pb-3.5 min-w-0">
          <h3 className="text-base tracking-wide sm:text-lg font-bold text-[#1C1C1C] truncate leading-snug">
            {movie.title}
          </h3>

          {/* Always reserve the same rows so Promoted / Coming Soon cards align */}
          <p className="text-sm tracking-wide text-gray-600 truncate min-h-[1.25rem]">
            {meta.duration || "—"}
          </p>
          <p className="text-sm tracking-wide text-gray-600 truncate min-h-[1.25rem]">
            {meta.genres || "—"}
          </p>
          <p className="text-sm tracking-wide text-gray-600 truncate min-h-[1.25rem]">
            {meta.language || "—"}
          </p>
        </div>
      </article>
    </Link>
  );
}
