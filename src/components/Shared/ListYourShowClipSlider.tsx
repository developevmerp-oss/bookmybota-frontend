"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

export type ListYourShowClipSliderSlide = {
  id: string;
  title: string;
  description: string;
  image: string;
  bg?: string;
  knowMoreHref?: string;
};

export type ListYourShowClipSliderProps = {
  slides: ListYourShowClipSliderSlide[];
  registerHref: string;
  primaryCtaLabel: string;
  secondaryLoginLabel?: string;
  loginHref?: string;
  onOpenLogin?: () => void;
  containerClassName?: string;
  /** Auto-advance interval in ms. */
  autoplayMs?: number;
};

const DEFAULT_CONTAINER = "bmb-section-container";

/** Exact hero image clipPath (objectBoundingBox) — provided design path. */
const IMAGE_CLIP_PATH =
  "M 0 0 H 1 V 1 H 0.256 C 0.171 1, 0.138 0.915, 0.118 0.776 L 0 0 Z";

/**
 * List Your Show feature slider — wide active split card (clip-path image) +
 * compact portrait peek cards. Uses existing slide titles, copy, and images.
 */
export default function ListYourShowClipSlider({
  slides,
  registerHref,
  primaryCtaLabel,
  secondaryLoginLabel,
  loginHref,
  onOpenLogin,
  containerClassName = DEFAULT_CONTAINER,
  autoplayMs = 5000,
}: ListYourShowClipSliderProps) {
  const n = slides.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  /** Previous slide index — animation-only, for cinematic crossfade. */
  const [outgoing, setOutgoing] = useState<number | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const activeRef = useRef(0);
  activeRef.current = active;
  const clipId = useId().replace(/:/g, "");
  const imageClipId = `lys-image-clip-${clipId}`;

  const resolvedLoginHref =
    loginHref ?? registerHref.replace(/\/register\/?$/, "/login");

  const goTo = useCallback((next: number | ((i: number) => number)) => {
    const current = activeRef.current;
    const resolved = typeof next === "function" ? next(current) : next;
    if (resolved === current) return;
    setOutgoing(current);
    setAnimKey((k) => k + 1);
    setActive(resolved);
  }, []);

  const goPrev = useCallback(() => {
    if (n <= 1) return;
    goTo((i) => (i - 1 + n) % n);
  }, [n, goTo]);

  const goNext = useCallback(() => {
    if (n <= 1) return;
    goTo((i) => (i + 1) % n);
  }, [n, goTo]);

  useEffect(() => {
    if (n <= 1 || paused) return;
    const id = window.setInterval(() => {
      goTo((i) => (i + 1) % n);
    }, autoplayMs);
    return () => window.clearInterval(id);
  }, [n, paused, autoplayMs, goTo, active]);

  useEffect(() => {
    if (outgoing === null) return;
    const t = window.setTimeout(() => setOutgoing(null), 700);
    return () => window.clearTimeout(t);
  }, [outgoing, animKey]);

  if (n === 0) return null;

  const activeSlide = slides[active];
  const outgoingSlide = outgoing !== null ? slides[outgoing] : null;
  const peekCount = Math.min(2, Math.max(0, n - 1));
  const peekSlides = Array.from({ length: peekCount }, (_, offset) => {
    const idx = (active + offset + 1) % n;
    return { slide: slides[idx], idx };
  });

  return (
    <section
      className="bg-white pt-6 sm:pt-8 pb-4 sm:pb-6 w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`
        /* Jump / bounce — image lands from the right with spring overshoot */
        @keyframes lysJumpIn {
          0% {
            opacity: 0;
            transform: translateX(28%) translateY(-18px) scale(0.88);
          }
          55% {
            opacity: 1;
            transform: translateX(-3%) translateY(6px) scale(1.04);
          }
          75% {
            transform: translateX(1.5%) translateY(-3px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateX(0) translateY(0) scale(1);
          }
        }
        @keyframes lysJumpOut {
          0% {
            opacity: 1;
            transform: translateX(0) translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateX(-22%) translateY(10px) scale(0.9);
          }
        }
        @keyframes lysJumpCopy {
          0% {
            opacity: 0;
            transform: translateY(-22px) scale(0.94);
          }
          60% {
            opacity: 1;
            transform: translateY(5px) scale(1.02);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes lysJumpPeek {
          0% {
            opacity: 0;
            transform: translateX(36px) translateY(-14px) scale(0.86);
          }
          55% {
            opacity: 1;
            transform: translateX(-4px) translateY(5px) scale(1.03);
          }
          100% {
            opacity: 1;
            transform: translateX(0) translateY(0) scale(1);
          }
        }
        .lys-hero-in {
          animation: lysJumpIn 0.7s cubic-bezier(0.34, 1.45, 0.64, 1) both;
        }
        .lys-hero-out {
          animation: lysJumpOut 0.45s cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        .lys-copy > *:nth-child(1) {
          animation: lysJumpCopy 0.55s cubic-bezier(0.34, 1.45, 0.64, 1) 0.04s both;
        }
        .lys-copy > *:nth-child(2) {
          animation: lysJumpCopy 0.55s cubic-bezier(0.34, 1.45, 0.64, 1) 0.1s both;
        }
        .lys-copy > *:nth-child(3) {
          animation: lysJumpCopy 0.55s cubic-bezier(0.34, 1.45, 0.64, 1) 0.16s both;
        }
        .lys-peek {
          animation: lysJumpPeek 0.65s cubic-bezier(0.34, 1.45, 0.64, 1) both;
        }
      `}</style>
      <div className={containerClassName}>
        <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 items-stretch border-0 outline-none shadow-none">
          {/* Active — exact hero clip-path on image + readable cream content */}
          <article className="relative flex-1 min-w-0 overflow-hidden rounded-2xl sm:rounded-[1.25rem] bg-[#FDFAF7] shadow-[0_1px_3px_rgba(0,0,0,0.06)] min-h-[300px] sm:min-h-[340px] md:min-h-[380px]">
            {/* Mobile: stacked image + cream */}
            <div className="sm:hidden flex flex-col">
              <div className="relative h-[180px] overflow-hidden">
                {outgoingSlide ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`m-out-${animKey}`}
                    src={outgoingSlide.image}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover lys-hero-out"
                  />
                ) : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={`m-img-${animKey}`}
                  src={activeSlide.image}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover lys-hero-in"
                />
              </div>
              <div
                key={`m-copy-${animKey}`}
                className="lys-copy flex flex-col justify-center px-5 py-6 bg-[#FDFAF7]"
              >
                <h2 className="text-[1.35rem] font-bold text-[#1A1A1A] leading-tight tracking-tight">
                  {activeSlide.title}
                </h2>
                <p className="mt-3 text-[0.8125rem] text-[#666] leading-relaxed">
                  {activeSlide.description}
                </p>
                <div className="mt-5 flex flex-col gap-2.5">
                  <Link
                    href="#contact"
                    className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-[#111] text-white text-sm font-semibold hover:bg-[#333] transition-colors"
                  >
                    Contact Us
                    <ArrowRight size={15} strokeWidth={2.25} />
                  </Link>
                  {/* Previous CTAs — List your business / Login your business
                  <Link
                    href={registerHref}
                    className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-[#111] text-white text-sm font-semibold hover:bg-[#333] transition-colors"
                  >
                    {primaryCtaLabel}
                    <ArrowRight size={15} strokeWidth={2.25} />
                  </Link>
                  {secondaryLoginLabel ? (
                    onOpenLogin ? (
                      <button
                        type="button"
                        onClick={onOpenLogin}
                        className="inline-flex items-center justify-center h-10 px-5 rounded-lg border border-[#C8C8C8] bg-white text-[#111] text-sm font-semibold hover:bg-[#FAFAFA] transition-colors cursor-pointer"
                      >
                        {secondaryLoginLabel}
                      </button>
                    ) : (
                      <Link
                        href={resolvedLoginHref}
                        className="inline-flex items-center justify-center h-10 px-5 rounded-lg border border-[#C8C8C8] bg-white text-[#111] text-sm font-semibold hover:bg-[#FAFAFA] transition-colors"
                      >
                        {secondaryLoginLabel}
                      </Link>
                    )
                  ) : null}
                  */}
                </div>
              </div>
            </div>

            {/* Desktop: hero-image clip + content panel */}
            <div className="hidden sm:grid absolute inset-0 grid-cols-[minmax(16rem,0.95fr)_1.15fr]">
              <div
                key={`d-copy-${animKey}`}
                className="lys-copy relative z-10 flex flex-col justify-center bg-[#FDFAF7] px-7 py-8 md:px-10 md:py-10"
              >
                <h2 className="text-[1.55rem] md:text-[1.85rem] font-bold text-[#1A1A1A] leading-tight tracking-tight max-w-[22rem]">
                  {activeSlide.title}
                </h2>
                <p className="mt-3.5 text-[0.9rem] text-[#666] leading-relaxed max-w-[22rem]">
                  {activeSlide.description}
                </p>
                <div className="mt-6 flex flex-row flex-wrap items-center gap-3">
                  <Link
                    href="#contact"
                    className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg bg-[#111] text-white text-sm font-semibold hover:bg-[#333] transition-colors"
                  >
                    Contact Us
                    <ArrowRight size={15} strokeWidth={2.25} />
                  </Link>
                  {/* Previous CTAs — List your business / Login your business
                  <Link
                    href={registerHref}
                    className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg bg-[#111] text-white text-sm font-semibold hover:bg-[#333] transition-colors"
                  >
                    {primaryCtaLabel}
                    <ArrowRight size={15} strokeWidth={2.25} />
                  </Link>
                  {secondaryLoginLabel ? (
                    onOpenLogin ? (
                      <button
                        type="button"
                        onClick={onOpenLogin}
                        className="inline-flex items-center justify-center h-11 px-5 rounded-lg border border-[#C8C8C8] bg-white text-[#111] text-sm font-semibold hover:bg-[#FAFAFA] transition-colors cursor-pointer"
                      >
                        {secondaryLoginLabel}
                      </button>
                    ) : (
                      <Link
                        href={resolvedLoginHref}
                        className="inline-flex items-center justify-center h-11 px-5 rounded-lg border border-[#C8C8C8] bg-white text-[#111] text-sm font-semibold hover:bg-[#FAFAFA] transition-colors"
                      >
                        {secondaryLoginLabel}
                      </Link>
                    )
                  ) : null}
                  */}
                </div>
              </div>

              <div className="hero-image relative min-h-full overflow-hidden">
                <svg
                  width={0}
                  height={0}
                  style={{ position: "absolute" }}
                  aria-hidden
                >
                  <defs>
                    <clipPath
                      id={imageClipId}
                      clipPathUnits="objectBoundingBox"
                    >
                      <path d={IMAGE_CLIP_PATH} />
                    </clipPath>
                  </defs>
                </svg>
                {outgoingSlide ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`d-out-${animKey}`}
                    src={outgoingSlide.image}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover will-change-transform lys-hero-out"
                    style={{ clipPath: `url(#${imageClipId})` }}
                  />
                ) : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={`d-img-${animKey}`}
                  src={activeSlide.image}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover will-change-transform lys-hero-in"
                  style={{ clipPath: `url(#${imageClipId})` }}
                />
              </div>
            </div>
          </article>

          {/* Peek cards — next slides as portrait image cards */}
          {peekSlides.map(({ slide, idx }, peekI) => (
            <button
              key={`peek-${slide.id}-${idx}-${animKey}`}
              type="button"
              onClick={() => goTo(idx)}
              aria-label={`Show: ${slide.title}`}
              className="lys-peek group relative hidden lg:flex w-[min(16.5rem,22%)] shrink-0 flex-col overflow-hidden rounded-2xl sm:rounded-[1.25rem] text-left cursor-pointer min-h-[340px] md:min-h-[380px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6900AA]"
              style={{ animationDelay: `${0.08 + peekI * 0.08}s` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.image}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/35 to-black/50"
                aria-hidden
              />
              <div className="relative z-10 flex h-full flex-col p-4 sm:p-5">
                <h3 className="text-[1.05rem] sm:text-[1.15rem] font-bold text-white leading-snug">
                  {slide.title}
                </h3>
                <p className="mt-2 text-[0.75rem] sm:text-[0.8125rem] text-white/85 leading-relaxed line-clamp-3">
                  {slide.description}
                </p>
                <span
                  aria-hidden
                  className="mt-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#111] shadow-sm"
                >
                  <ArrowRight size={16} strokeWidth={2.25} />
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Arrow controls — no divider line above */}
        <div className="mt-4 sm:mt-5 flex items-center gap-2 border-0 outline-none">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous slide"
            disabled={n <= 1}
            className="inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-[#EDEDED] text-[#333] hover:bg-[#E0E0E0] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
          >
            <ChevronLeft size={20} strokeWidth={2.25} />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next slide"
            disabled={n <= 1}
            className="inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-[#EDEDED] text-[#333] hover:bg-[#E0E0E0] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
          >
            <ChevronRight size={20} strokeWidth={2.25} />
          </button>
        </div>
      </div>
    </section>
  );
}
