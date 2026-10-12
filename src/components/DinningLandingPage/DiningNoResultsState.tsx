"use client";

type DiningNoResultsStateProps = {
  title?: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
};

/**
 * Dining filter/search empty state — same layout as movie empty state:
 * illustration + title + description + CTA (black button, no purple bg).
 */
export default function DiningNoResultsState({
  title = "No restaurants match these filters",
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: DiningNoResultsStateProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-11 sm:px-8 sm:py-14 text-center">
      <div className="relative mx-auto flex max-w-md flex-col items-center">
        <div className="mb-5 w-[220px] sm:w-[260px] lg:w-[280px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/dining/no-filter-results.png"
            alt="No restaurants found"
            className="mx-auto h-auto w-full object-contain select-none"
            draggable={false}
          />
        </div>

        <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
          {title}
        </h3>
        <p className="mt-1.5 text-sm text-slate-500 leading-relaxed max-w-sm">
          {description}
        </p>

        {(actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction) ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
            {actionLabel && onAction ? (
              <button
                type="button"
                onClick={onAction}
                className="inline-flex cursor-pointer items-center justify-center rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#111111]"
              >
                {actionLabel}
              </button>
            ) : null}
            {secondaryActionLabel && onSecondaryAction ? (
              <button
                type="button"
                onClick={onSecondaryAction}
                className="inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
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
