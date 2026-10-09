"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export type ListYourShowHostTypeCard = {
  label: string;
  image: string;
  href: string;
};

type ListYourShowHostTypesSectionProps = {
  title: string;
  subtitle: string;
  cards: ListYourShowHostTypeCard[];
  containerClassName?: string;
};

const DEFAULT_CONTAINER = "container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0";

/**
 * List Your Show “What can you host” — dining-types card UI with each category’s hero image.
 */
export default function ListYourShowHostTypesSection({
  title,
  subtitle,
  cards,
  containerClassName = DEFAULT_CONTAINER,
}: ListYourShowHostTypesSectionProps) {
  return (
    <section className="bg-white py-12 md:py-16">
      <div className={containerClassName}>
        <div className="text-center max-w-[820px] mx-auto">
          <h2 className="text-[1.65rem] sm:text-[2rem] md:text-[2.25rem] font-bold tracking-tight text-[#1A2B48] leading-tight">
            {title}
          </h2>
          <p className="mt-4 text-[0.875rem] sm:text-[0.9375rem] text-[#555555] leading-relaxed">
            {subtitle}
          </p>
        </div>

        <div className="mt-8 sm:mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {cards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              aria-label={`${card.label} — continue`}
              className="group flex flex-col overflow-hidden rounded-xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-[#EDEDED] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-shadow duration-300"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-[#EEE]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={card.image}
                  alt={card.label}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5 sm:py-5">
                <h3 className="text-[1.05rem] sm:text-[1.15rem] font-bold text-[#111] leading-snug">
                  {card.label}
                </h3>
                <span
                  aria-hidden
                  className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#222] text-[#222] group-hover:bg-[#111] group-hover:text-white transition-colors"
                >
                  <ArrowRight size={16} strokeWidth={2} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
