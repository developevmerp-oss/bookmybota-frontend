"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Clapperboard } from "lucide-react";
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
 * Notify / Coming Soon movie card — status label, tag line, release date, Notify Me CTA.
 */
export function MovieNotifyCard({ movie }: { movie: MustWatchMovieCard }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showPoster = Boolean(movie.poster) && !imgFailed;
  const meta = movieDetailMeta(movie);
  const releaseLabel = formatMovieReleaseLabel(movie.releaseDate);
  const comingSoon = Boolean(movie.comingSoon);
  const statusLabel = comingSoon
    ? "Coming Soon"
    : movie.promoted
      ? "Promoted"
      : "Now Showing";

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

          <MovieWishlistButton
            movieId={String(movie.id)}
            tone="onLight"
            className="absolute top-3 right-3 z-[2] w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-70"
          />
        </div>

        <div className="flex flex-1 flex-col gap-2 px-3.5 pt-3.5 pb-3.5 min-w-0">
          <div className="min-w-0">
            <p
              className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.08em]"
              style={{ color: ACCENT }}
            >
              {statusLabel}
            </p>
            <span
              className="mt-1 block h-px w-8"
              style={{ backgroundColor: ACCENT }}
              aria-hidden
            />
          </div>

          <h3 className="text-base tracking-wide sm:text-lg font-bold text-[#1C1C1C] truncate leading-snug">
            {movie.title}
          </h3>

          {meta.tagLine ? (
            <p className="text-sm tracking-wide text-gray-600 truncate leading-snug">
              {meta.tagLine}
            </p>
          ) : null}

          <div className="mt-auto flex items-center justify-between gap-2 pt-3 min-w-0">
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
              <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-semibold tracking-wide text-[#1C1C1C] shadow-sm group-hover:border-[#D1D5DB]">
                Notify Me
                <ArrowRight size={13} strokeWidth={2.25} />
              </span>
            ) : (
              <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-semibold tracking-wide text-[#C45C26] shadow-sm group-hover:border-[#D1D5DB]">
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
