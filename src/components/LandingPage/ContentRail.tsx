"use client";

import { useRef, Children, type CSSProperties, type ReactNode } from "react";
import "./AdaptiveCardRow.css";
import AdaptiveCardRow from "./AdaptiveCardRow";
import { RailOverlayNavButton, RailSeeAllLink } from "./RailChrome";
import { useHorizontalScrollEdges } from "@/lib/useHorizontalScrollEdges";

type ContentRailProps = {
  title: string;
  subtitle?: string;
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

          {seeAllHref ? <RailSeeAllLink href={seeAllHref} label={seeAllLabel} /> : null}
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
          <div className={`py-2 ${dark ? "text-[#B0B0B0]" : "text-[#6B6B6B]"}`}>
            {typeof empty === "string" ? (
              <p className="type-body py-6">{empty}</p>
            ) : (
              empty
            )}
          </div>
        ) : (
          <div className="relative overflow-visible">
            {showOverlayNav && scrollEdges.left ? (
              <RailOverlayNavButton
                direction="prev"
                side="left"
                label={`Previous ${label}`}
                onClick={() => scrollBy(-1)}
              />
            ) : null}
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
            {showOverlayNav && scrollEdges.right ? (
              <RailOverlayNavButton
                direction="next"
                side="right"
                label={`Next ${label}`}
                onClick={() => scrollBy(1)}
              />
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
