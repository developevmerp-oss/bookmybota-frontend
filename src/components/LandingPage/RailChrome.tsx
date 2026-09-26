"use client";

import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

export const RAIL_SEE_ALL_CLASS =
  "inline-flex items-center gap-1.5 h-9 px-3.5 sm:px-4 rounded-full bg-[#F7E9FF] text-[#6900AA] text-sm font-semibold hover:bg-[#EFD7FF] transition-colors shrink-0";

/** Floating rail arrow — white circle outside the card row (margin), soft shadow. */
export const RAIL_OVERLAY_NAV_CLASS =
  "hidden md:flex absolute top-[36%] -translate-y-1/2 z-10 size-9 sm:size-10 rounded-full items-center justify-center cursor-pointer bg-white text-[#9CA3AF] shadow-[0_2px_8px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.06)] hover:text-[#6B7280] hover:shadow-[0_4px_12px_rgba(0,0,0,0.14)] transition-[box-shadow,color] duration-200 border-0 outline-none";

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
