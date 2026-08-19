"use client";

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
}: ContentRailProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 640), behavior: "smooth" });
  };

  return (
    <section
      className={
        dark ? "bg-[#111111] py-8 sm:py-10" : alt ? "bg-[#F7F7F7] py-8 sm:py-10" : "bg-white py-8 sm:py-10"
      }
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <h2
              className={`text-[22px] sm:text-2xl font-semibold tracking-tight ${
                dark ? "text-white" : "text-[#111111]"
              }`}
            >
              {title}
            </h2>
            {subtitle && (
              <p className={`text-sm mt-1 ${dark ? "text-[#B0B0B0]" : "text-[#6B6B6B]"}`}>
                {subtitle}
              </p>
            )}
          </div>
          {seeAllHref && (
            <Link
              href={seeAllHref}
              className="shrink-0 text-sm font-medium text-[#6900AA] hover:text-[#57008E]"
            >
              {seeAllLabel} ›
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={cardStyle === "dining" ? "w-[260px] sm:w-[280px] md:w-[300px] shrink-0" : "w-[180px] sm:w-[200px] shrink-0"}>
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
          <p className={`text-sm py-8 ${dark ? "text-[#B0B0B0]" : "text-[#6B6B6B]"}`}>{empty}</p>
        ) : (
          <div className="relative">
            <button
              type="button"
              aria-label={`Previous ${label}`}
              onClick={() => scrollBy(-1)}
              className={`hidden md:flex absolute -left-3 top-[38%] -translate-y-1/2 z-10 w-9 h-9 rounded-full items-center justify-center cursor-pointer ${
                dark
                  ? "bg-white/10 text-white hover:bg-white/20"
                  : "bg-white border border-[#EDEDED] text-[#111111] shadow-sm hover:bg-[#F7E9FF]"
              }`}
            >
              <ChevronLeft size={18} />
            </button>
            <div
              ref={scrollerRef}
              className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {children}
            </div>
            <button
              type="button"
              aria-label={`Next ${label}`}
              onClick={() => scrollBy(1)}
              className={`hidden md:flex absolute -right-3 top-[38%] -translate-y-1/2 z-10 w-9 h-9 rounded-full items-center justify-center cursor-pointer ${
                dark
                  ? "bg-white/10 text-white hover:bg-white/20"
                  : "bg-white border border-[#EDEDED] text-[#111111] shadow-sm hover:bg-[#F7E9FF]"
              }`}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
