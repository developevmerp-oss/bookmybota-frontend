"use client";

import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

export const RAIL_SEE_ALL_CLASS =
  "inline-flex items-center gap-1.5 h-9 px-0 text-[#111111] text-sm font-semibold hover:text-black transition-colors shrink-0 bg-transparent";

/** Floating rail arrow — white circle outside the card row (margin), soft shadow. */
export const RAIL_OVERLAY_NAV_CLASS =
  "hidden md:flex absolute top-[36%] -translate-y-1/2 z-10 size-9 sm:size-10 rounded-full items-center justify-center cursor-pointer bg-white text-[#9CA3AF] shadow-[0_2px_8px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.06)] hover:text-[#6B7280] hover:shadow-[0_4px_12px_rgba(0,0,0,0.14)] transition-[box-shadow,color] duration-200 border-0 outline-none";

/** District-style bottom pager arrow — white circle, soft shadow so it’s visible on white. */
export const RAIL_PAGER_BTN_CLASS =
  "inline-flex size-9 items-center justify-center rounded-full border-0 bg-white text-[#4B4B4B] shadow-[0_2px_8px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.06)] cursor-pointer outline-none transition-[box-shadow,color,background-color] duration-200 hover:text-[#111111] hover:shadow-[0_3px_10px_rgba(0,0,0,0.14)] disabled:cursor-default focus-visible:ring-2 focus-visible:ring-[#6900AA] focus-visible:ring-offset-2";

export function RailSeeAllLink({
  href,
  label = "See All",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link href={href} className={RAIL_SEE_ALL_CLASS}>
      {label}
      <ArrowRight size={14} strokeWidth={2.25} />
    </Link>
  );
}

export function RailOverlayNavButton({
  direction,
  label,
  onClick,
  side,
  inset = false,
  className = "",
}: {
  direction: "prev" | "next";
  label: string;
  onClick: () => void;
  side: "left" | "right";
  /** Center on the dining card image edge — half on card, half outside. */
  inset?: boolean;
  className?: string;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  // inset: left-0 / right-0 + dining row pad + card p-2 ≈ half button on the image
  const sideClass = inset
    ? side === "left"
      ? "left-0"
      : "right-0"
    : side === "left"
      ? "-left-3 lg:-left-5"
      : "-right-3 lg:-right-5";
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`${RAIL_OVERLAY_NAV_CLASS} ${sideClass} ${className}`}
    >
      <Icon size={16} strokeWidth={1.75} />
    </button>
  );
}

/**
 * District-style bottom pager: dots + prev/next.
 * - Dot count follows real overflow pages (not a fixed 3).
 * - Start: left hidden; end: right hidden (slots reserved so layout doesn’t jump).
 */
export function RailPagerNav({
  canPrev,
  canNext,
  onPrev,
  onNext,
  pageCount = 0,
  activePage = 0,
  label,
}: {
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** Total swipe pages → number of dots */
  pageCount?: number;
  /** Active swipe page index (0-based) */
  activePage?: number;
  label: string;
}) {
  // Only mount when there is something to scroll
  if (!canPrev && !canNext && pageCount < 2) return null;

  const dots = pageCount >= 2 ? pageCount : canPrev || canNext ? 2 : 0;
  if (dots < 2) return null;

  const active = Math.min(Math.max(0, activePage), dots - 1);
  // Start → no left; end → no right (same for every landing rail using this pager)
  const showPrev = canPrev && active > 0;
  const showNext = canNext && active < dots - 1;

  return (
    <div
      className="mt-4 sm:mt-5 flex items-center justify-center gap-2.5"
      role="group"
      aria-label={`${label} navigation`}
    >
      <button
        type="button"
        aria-label={`Previous ${label}`}
        aria-hidden={!showPrev}
        tabIndex={showPrev ? 0 : -1}
        disabled={!showPrev}
        onClick={onPrev}
        className={`${RAIL_PAGER_BTN_CLASS} ${
          showPrev ? "" : "invisible pointer-events-none"
        }`}
      >
        <ChevronLeft size={16} strokeWidth={2} />
      </button>

      <div className="flex items-center gap-1.5 px-0.5" aria-hidden>
        {Array.from({ length: dots }).map((_, i) => (
          <span
            key={i}
            className={
              i === active
                ? "block size-[7px] rounded-full bg-[#1A1A1A]"
                : "block size-[5px] rounded-full bg-[#C8C8C8]"
            }
          />
        ))}
      </div>

      <button
        type="button"
        aria-label={`Next ${label}`}
        aria-hidden={!showNext}
        tabIndex={showNext ? 0 : -1}
        disabled={!showNext}
        onClick={onNext}
        className={`${RAIL_PAGER_BTN_CLASS} ${
          showNext ? "" : "invisible pointer-events-none"
        }`}
      >
        <ChevronRight size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
