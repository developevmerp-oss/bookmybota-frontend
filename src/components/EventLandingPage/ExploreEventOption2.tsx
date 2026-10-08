"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export type ExploreEventOption2Category = {
  key: string;
  label: string;
  image: string;
  /** Soft pastel card fill */
  background: string;
};

type ExploreEventOption2Props = {
  title?: string;
  categories: ExploreEventOption2Category[];
  onCategoryClick: (key: string) => void;
  emptyNotice?: React.ReactNode;
  className?: string;
};

const cardSpring = {
  type: "spring" as const,
  stiffness: 320,
  damping: 22,
  mass: 0.8,
};

const hoverSpring = {
  type: "spring" as const,
  stiffness: 420,
  damping: 16,
};

const imgSpring = {
  type: "spring" as const,
  stiffness: 340,
  damping: 14,
};

/**
 * Explore Events — horizontal pastel cards (icon left, title + CTA right).
 * Object motion + scroll layout aligned with dining explore cards.
 */
export default function ExploreEventOption2({
  title = "Explore Events",
  categories,
  onCategoryClick,
  emptyNotice,
  className = "",
}: ExploreEventOption2Props) {
  if (!categories.length) return null;

  return (
    <section className={`pt-8 sm:pt-10 pb-3 bg-white ${className}`}>
      <div className="container mx-auto px-4 sm:px-5 md:px-6 lg:px-8 xl:px-10 2xl:px-0">
        <div className="min-w-0 pb-4">
          <motion.h2
            className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-800"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {title}
          </motion.h2>
          {emptyNotice}
        </div>

        <motion.div
          className="flex gap-3 sm:gap-4 md:gap-5 overflow-x-auto px-0.5 pt-2 pb-6 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.35 }}
          variants={{
            hidden: {},
            show: {
              transition: { staggerChildren: 0.09, delayChildren: 0.05 },
            },
          }}
        >
          {categories.map((cat) => (
            <motion.button
              key={cat.key}
              type="button"
              aria-label={`${cat.label} — Explore events`}
              onClick={() => onCategoryClick(cat.key)}
              className="group flex shrink-0 snap-start items-center gap-3 sm:gap-3.5 rounded-[1.25rem] sm:rounded-[1.5rem] px-3.5 py-3 sm:px-4 sm:py-3.5 text-left cursor-pointer border border-black/[0.04] shadow-[0_4px_16px_rgba(15,23,42,0.06)] w-[min(78vw,15.5rem)] sm:w-[15.5rem] md:w-[16.25rem] lg:w-[17rem]"
              style={{ background: cat.background }}
              variants={{
                hidden: { opacity: 0, y: 24, scale: 0.92 },
                show: {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: cardSpring,
                },
                hover: {
                  y: -8,
                  scale: 1.03,
                  boxShadow: "0 10px 24px rgba(15,23,42,0.1)",
                  transition: hoverSpring,
                },
              }}
              whileHover="hover"
              whileTap={{
                scale: 0.97,
                y: -2,
                transition: { type: "spring", stiffness: 520, damping: 28 },
              }}
            >
              <span className="relative flex h-[3.75rem] w-[3.75rem] sm:h-[4.25rem] sm:w-[4.25rem] md:h-[4.5rem] md:w-[4.5rem] shrink-0 items-center justify-center overflow-visible">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <motion.img
                  src={cat.image}
                  alt=""
                  aria-hidden
                  draggable={false}
                  className="h-full w-full object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.12)]"
                  variants={{
                    hidden: { opacity: 0, y: 12, scale: 0.86 },
                    show: {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: {
                        type: "spring",
                        stiffness: 280,
                        damping: 18,
                        delay: 0.05,
                      },
                    },
                    hover: {
                      y: -6,
                      rotate: -2,
                      scale: 1.08,
                      transition: imgSpring,
                    },
                  }}
                />
              </span>

              <span className="min-w-0 flex-1 flex flex-col justify-center gap-0.5 sm:gap-1">
                <span className="text-[1rem] sm:text-[1.0625rem] font-bold text-slate-900 leading-tight truncate">
                  {cat.label}
                </span>
                <span className="inline-flex items-center gap-1 text-[0.8125rem] sm:text-[0.875rem] font-medium text-slate-500 group-hover:text-[#6900AA] transition-colors">
                  Explore events
                  <ArrowRight
                    className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
                    strokeWidth={2.25}
                  />
                </span>
              </span>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
