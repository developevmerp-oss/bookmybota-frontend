"use client";

import { useRef, Children, type CSSProperties, type ReactNode } from "react";
import "./AdaptiveCardRow.css";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AdaptiveCardRow from "./AdaptiveCardRow";

type ContentRailProps = {
  title: string;
  subtitle?: string;
  seeAllHref?: string;
  seeAllLabel?: string;
  dark?: boolean;
  alt?: boolean;
  isLoading?: boolean;
  empty?: string;
  children: ReactNode;
  label: string;
  cardStyle?: "poster" | "dining";
  /** Cards visible in the row before scroll. Default 5. */
  minVisible?: number;
  /** Use AdaptiveCardRow width-fill logic. Default true. */
  adaptive?: boolean;
};

export default function ContentRail({
  title,
  subtitle,
  seeAllHref,
  seeAllLabel = "See All",
  dark = false,
  alt = false,
  isLoading,
  empty,
  children,
  label,
  cardStyle = "poster",
  minVisible = 5,
  adaptive = true,
}: ContentRailProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const childCount = Children.toArray(children).filter(Boolean).length;
  const showArrows = !adaptive || childCount > minVisible;

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 640), behavior: "smooth" });
  };

  return (
    <section
      className={
        dark
          ? "bg-[#111111] py-6 sm:py-8 lg:py-10"
          : alt
            ? "bg-[#F7F7F7] py-6 sm:py-8 lg:py-10"
            : "bg-white py-6 sm:py-8 lg:py-10"
      }
    >
      <div className="container mx-auto px-4 md:px-5 lg:px-8">
        <div className="flex items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          <div className="min-w-0">
            <h2
              className={`type-section font-semibold tracking-tight ${
                dark ? "text-white" : "text-[#111111]"
              }`}
            >
              {title}
            </h2>
            {subtitle && (
              <p className={`type-body mt-1 ${dark ? "text-[#B0B0B0]" : "text-[#6B6B6B]"}`}>
                {subtitle}
              </p>
            )}
          </div>
          {seeAllHref && (
            <Link
              href={seeAllHref}
              className="shrink-0 type-link font-medium text-[#6900AA] hover:text-[#57008E]"
            >
              {seeAllLabel} ›
            </Link>
          )}
        </div>

        {isLoading ? (
          <div
            className="adaptive-card-row overflow-hidden"
            style={{ ["--adaptive-count" as string]: minVisible } as CSSProperties}
          >
            {Array.from({ length: minVisible }).map((_, i) => (
              <div key={i} className="adaptive-card-slot">
                <div
                  className={`rounded-xl ${
                    cardStyle === "dining" ? "aspect-[4/3]" : "aspect-[2/3]"
                  } ${dark ? "bg-white/10" : alt ? "bg-white" : "bg-[#F7F7F7]"}`}
                />
                <div
                  className={`mt-3 h-4 w-4/5 rounded ${
                    dark ? "bg-white/10" : alt ? "bg-white" : "bg-[#F7F7F7]"
                  }`}
                />
                <div
                  className={`mt-2 h-3 w-3/5 rounded ${
                    dark ? "bg-white/10" : alt ? "bg-white" : "bg-[#F7F7F7]"
                  }`}
                />
              </div>
            ))}
          </div>
        ) : empty ? (
          <p className={`type-body py-8 ${dark ? "text-[#B0B0B0]" : "text-[#6B6B6B]"}`}>{empty}</p>
        ) : (
          <div className="relative">
            {showArrows && (
              <button
                type="button"
                aria-label={`Previous ${label}`}
                onClick={() => scrollBy(-1)}
                className={`hidden md:flex absolute -left-2 lg:-left-3 top-[38%] -translate-y-1/2 z-10 w-9 h-9 rounded-full items-center justify-center cursor-pointer ${
                  dark
                    ? "bg-white/10 text-white hover:bg-white/20"
                    : "bg-white border border-[#EDEDED] text-[#111111] shadow-sm hover:bg-[#F7E9FF]"
                }`}
              >
                <ChevronLeft size={18} />
              </button>
            )}
            {adaptive ? (
              <AdaptiveCardRow minVisible={minVisible} scrollerRef={scrollerRef}>
                {children}
              </AdaptiveCardRow>
            ) : (
              <div
                ref={scrollerRef}
                className="flex gap-3 sm:gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {children}
              </div>
            )}
            {showArrows && (
              <button
                type="button"
                aria-label={`Next ${label}`}
                onClick={() => scrollBy(1)}
                className={`hidden md:flex absolute -right-2 lg:-right-3 top-[38%] -translate-y-1/2 z-10 w-9 h-9 rounded-full items-center justify-center cursor-pointer ${
                  dark
                    ? "bg-white/10 text-white hover:bg-white/20"
                    : "bg-white border border-[#EDEDED] text-[#111111] shadow-sm hover:bg-[#F7E9FF]"
                }`}
              >
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
