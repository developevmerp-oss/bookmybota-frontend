"use client";

import { useRef, Children, type ReactNode } from "react";
import "./AdaptiveCardRow.css";
import AdaptiveCardRow from "./AdaptiveCardRow";
import CitySectionEmptyNotice from "./CitySectionEmptyNotice";
import { RailPagerNav, RailSeeAllLink } from "./RailChrome";
import { scrollRailBy, useHorizontalScrollEdges } from "@/lib/useHorizontalScrollEdges";
import { CustomerRailShimmer } from "@/components/Shared/Shimmer";

type ContentRailProps = {
  title: string;
  subtitle?: string;
  /** Shown under the title when the selected city has no data for this rail. */
  cityNotice?: string;
  eyebrow?: string;
  seeAllHref?: string;
  seeAllLabel?: string;
  dark?: boolean;
  alt?: boolean;
  isLoading?: boolean;
  empty?: ReactNode;
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
  cityNotice,
  eyebrow,
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
  const scrollEdges = useHorizontalScrollEdges(scrollerRef, [childCount, isLoading, empty]);
  const showOverlayNav = !isLoading && !empty && childCount > 0;

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    scrollRailBy(el, dir);
  };

  return (
    <section
      className={
        dark
          ? "bg-[#111111] py-6 sm:py-8 lg:pt-0"
          : alt
            ? "bg-[#F7F7F7] py-6 sm:py-8 lg:pt-0"
            : "bg-white py-6 sm:py-8 lg:py-5"
      }
    >
      <div className="container mx-auto px-4 sm:px-5 md:px-6 lg:px-8 xl:px-10 2xl:px-0">
        <div className="flex items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          <div className="min-w-0">
            {eyebrow ? (
              <p
                className={`type-card-caption font-semibold uppercase tracking-[0.14em] mb-1.5 flex items-center gap-2 ${
                  dark ? "text-white/55" : "text-slate-400"
                }`}
              >
                {eyebrow}
                <span
                  className="inline-block h-px w-6 sm:w-8"
                  style={{ backgroundColor: "#6900AA" }}
                  aria-hidden
                />
              </p>
            ) : null}
            <h2
              className={`text-xl sm:text-2xl font-bold ${
                dark ? "text-white" : "text-slate-800"
              }`}
            >
              {title}
            </h2>
            {cityNotice ? <CitySectionEmptyNotice message={cityNotice} /> : null}
            {!cityNotice && subtitle ? (
              <p className={`type-body mt-1 ${dark ? "text-[#B0B0B0]" : "text-[#6B6B6B]"}`}>
                {subtitle}
              </p>
            ) : null}
          </div>

          {seeAllHref ? <RailSeeAllLink href={seeAllHref} label={seeAllLabel} /> : null}
        </div>

        {isLoading ? (
          <CustomerRailShimmer
            count={minVisible}
            variant={cardStyle === "dining" ? "dining" : "poster"}
          />
        ) : empty ? (
          <div className={`py-2 ${dark ? "text-[#B0B0B0]" : "text-[#6B6B6B]"}`}>
            {typeof empty === "string" ? (
              <p className="type-body py-6">{empty}</p>
            ) : (
              empty
            )}
          </div>
        ) : (
          <div>
            {adaptive ? (
              <AdaptiveCardRow
                minVisible={minVisible}
                scrollerRef={scrollerRef}
                className={
                  cardStyle === "dining"
                    ? "adaptive-card-row--dining"
                    : minVisible === 4
                      ? "adaptive-card-row--four"
                      : undefined
                }
              >
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
            {showOverlayNav ? (
              <div className="hidden lg:block">
                <RailPagerNav
                  canPrev={scrollEdges.left}
                  canNext={scrollEdges.right}
                  pageCount={scrollEdges.pageCount}
                  activePage={scrollEdges.activePage}
                  onPrev={() => scrollBy(-1)}
                  onNext={() => scrollBy(1)}
                  label={label}
                />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
