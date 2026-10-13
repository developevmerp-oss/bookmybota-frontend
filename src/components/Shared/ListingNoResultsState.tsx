"use client";

export type ListingNoResultsKind =
  | "dining"
  | "events"
  | "movies"
  | "artists"
  | "venues";

const PRESETS: Record<
  ListingNoResultsKind,
  { image: string; imageAlt: string; defaultTitle: string }
> = {
  dining: {
    image: "/images/dining/no-filter-results.png",
    imageAlt: "No restaurants found",
    defaultTitle: "No restaurants found",
  },
  events: {
    image: "/images/events/no-filter-results.png",
    imageAlt: "No events found",
    defaultTitle: "No events found",
  },
  movies: {
    image: "/images/movies/no-filter-results.png",
    imageAlt: "No movies found",
    defaultTitle: "No movies found",
  },
  artists: {
    image: "/images/artists/no-filter-results.png",
    imageAlt: "No artists found",
    defaultTitle: "No artists found",
  },
  venues: {
    image: "/images/venues/no-filter-results.png",
    imageAlt: "No venues found",
    defaultTitle: "No venues found",
  },
};

export type ListingNoResultsStateProps = {
  kind: ListingNoResultsKind;
  title?: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  dimmed?: boolean;
  className?: string;
};

/**
 * Shared empty state for listing / filter / search pages.
 * Same responsive UI for dining, events, movies, artists, and venues —
 * only illustration and copy change per `kind`.
 */
export default function ListingNoResultsState({
  kind,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  dimmed = false,
  className = "",
}: ListingNoResultsStateProps) {
  const preset = PRESETS[kind];
  const heading = title ?? preset.defaultTitle;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-10 sm:px-8 sm:py-14 md:py-16 text-center ${
        dimmed ? "opacity-70" : ""
      } ${className}`}
    >
      <div className="relative mx-auto flex w-full max-w-lg flex-col items-center">
        <div className="mb-5 w-[min(100%,240px)] sm:mb-6 sm:w-[280px] md:w-[320px] lg:w-[360px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preset.image}
            alt={preset.imageAlt}
            className="mx-auto h-auto w-full object-contain select-none"
            draggable={false}
          />
        </div>

        <h3 className="text-xl sm:text-2xl md:text-[1.75rem] font-bold text-slate-900 tracking-tight">
          {heading}
        </h3>
        <p className="mt-2 sm:mt-2.5 text-sm sm:text-[0.95rem] text-slate-500 leading-relaxed max-w-md px-1">
          {description}
        </p>

        {(actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction) ? (
          <div className="mt-6 sm:mt-7 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
            {actionLabel && onAction ? (
              <button
                type="button"
                onClick={onAction}
                className="inline-flex cursor-pointer items-center justify-center rounded-full bg-black px-6 sm:px-7 py-2.5 sm:py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#111111]"
              >
                {actionLabel}
              </button>
            ) : null}
            {secondaryActionLabel && onSecondaryAction ? (
              <button
                type="button"
                onClick={onSecondaryAction}
                className="inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white px-6 sm:px-7 py-2.5 sm:py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                {secondaryActionLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
