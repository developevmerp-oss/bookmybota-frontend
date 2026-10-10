"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export type PartnerSplitHeroProps = {
  containerClassName?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  microcopy?: string;
  /** Optional decorative script overlay on the image. */
  imageScript?: string;
  image: string;
  imageAlt?: string;
  registerHref: string;
  primaryCtaLabel: string;
  secondaryLoginLabel?: string;
  onOpenLogin?: () => void;
  loginHref?: string;
};

const DEFAULT_CONTAINER = "bmb-section-container";

/**
 * Shared split hero used by partner landings (dining, movie, etc.).
 * Pass page-specific copy + image; CTAs keep existing register/login behavior.
 */
export default function PartnerSplitHero({
  containerClassName = DEFAULT_CONTAINER,
  eyebrow,
  title,
  description,
  microcopy,
  imageScript,
  image,
  imageAlt = "",
  registerHref,
  primaryCtaLabel,
  secondaryLoginLabel,
  onOpenLogin,
  loginHref,
}: PartnerSplitHeroProps) {
  const resolvedLoginHref = loginHref ?? registerHref.replace(/\/register\/?$/, "/login");
  const scriptFont = '"Segoe Script", "Brush Script MT", "Apple Chancery", "Bradley Hand", cursive';

  return (
    <section className="bg-white py-8 sm:py-10 md:py-12 lg:py-14">
      <div className={containerClassName}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 xl:gap-12 items-center">
          <div className="order-2 lg:order-1 min-w-0">
            {/* Purple eyebrow line commented out per design
            {eyebrow ? (
              <p className="text-[0.625rem] sm:text-xs font-bold tracking-[0.2em] uppercase text-[#6900AA]">
                {eyebrow}
              </p>
            ) : null}
            */}
            <h1 className="text-[1.75rem] sm:text-[2.15rem] md:text-[2.5rem] lg:text-[2.75rem] font-bold text-[#111] leading-[1.12] tracking-tight whitespace-pre-line">
              {title}
            </h1>
            {description ? (
              <p className="mt-4 sm:mt-5 text-[0.9375rem] sm:text-base text-[#555555] leading-relaxed max-w-[32.5rem]">
                {description}
              </p>
            ) : null}
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
              <Link
                href={registerHref}
                className="inline-flex items-center justify-center gap-2 h-11 sm:h-12 px-6 rounded-lg bg-[#111] text-white text-sm sm:text-[0.9375rem] font-semibold hover:bg-[#333] transition-colors"
              >
                {primaryCtaLabel}
                <ArrowRight size={16} strokeWidth={2.25} />
              </Link>
              {secondaryLoginLabel ? (
                onOpenLogin ? (
                  <button
                    type="button"
                    onClick={onOpenLogin}
                    className="inline-flex items-center justify-center h-11 sm:h-12 px-6 rounded-lg border border-[#D0D0D0] bg-white text-[#111] text-sm sm:text-[0.9375rem] font-semibold hover:bg-[#FAFAFA] transition-colors cursor-pointer"
                  >
                    {secondaryLoginLabel}
                  </button>
                ) : (
                  <Link
                    href={resolvedLoginHref}
                    className="inline-flex items-center justify-center h-11 sm:h-12 px-6 rounded-lg border border-[#D0D0D0] bg-white text-[#111] text-sm sm:text-[0.9375rem] font-semibold hover:bg-[#FAFAFA] transition-colors"
                  >
                    {secondaryLoginLabel}
                  </Link>
                )
              ) : null}
            </div>
            {microcopy ? (
              <p className="mt-5 sm:mt-6 text-[0.8125rem] sm:text-sm text-[#888888]">{microcopy}</p>
            ) : null}
          </div>

          <div className="order-1 lg:order-2 relative w-full min-h-[15rem] sm:min-h-[18.75rem] md:min-h-[22.5rem] lg:min-h-[26.25rem]">
            {imageScript ? (
              <p
                className="absolute top-3 left-3 sm:top-5 sm:left-5 z-10 max-w-[11.25rem] sm:max-w-[15rem] text-[1.1rem] sm:text-[1.35rem] md:text-[1.5rem] font-semibold leading-snug text-[#6900AA] pointer-events-none"
                style={{ fontFamily: scriptFont }}
              >
                {imageScript}
              </p>
            ) : null}
            <div className="relative h-full w-full min-h-[inherit] overflow-hidden rounded-bl-[2.5rem] sm:rounded-bl-[3.5rem] md:rounded-bl-[4.5rem] lg:rounded-bl-[5rem]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={imageAlt}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
