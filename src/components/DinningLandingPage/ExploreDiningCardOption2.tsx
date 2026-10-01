"use client";

import { useMemo } from "react";
import { motion } from "motion/react";

export type ExploreDiningCardItem = {
  id: string;
  title: string;
  image: string;
  match?: readonly string[] | null;
};

type ExploreDiningCardOption2Props = {
  cards: readonly ExploreDiningCardItem[];
  activeId: string;
  onSelect: (card: ExploreDiningCardItem) => void;
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
 * Explore Dining cards — Option 2
 * Desktop: horizontal white cards (icon + title, no circle bg)
 * Mobile: icon tiles + label (no cream bg behind image)
 * Motion / selected scale match the pastel Explore Dining cards above
 */
export default function ExploreDiningCardOption2({
  cards,
  activeId,
  onSelect,
}: ExploreDiningCardOption2Props) {
  const list = useMemo(() => cards, [cards]);

  return (
    <div className="w-full">
      {/* Mobile — icon + label, no bg behind image */}
      <motion.div
        className="md:hidden grid grid-cols-4 gap-2.5 sm:gap-3 pt-2 pb-2"
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
        {list.map((card) => {
          const isActive = activeId === card.id;
          return (
            <motion.button
              key={`m-${card.id}`}
              type="button"
              aria-label={card.title}
              aria-pressed={isActive}
              onClick={() => onSelect(card)}
              className="flex flex-col items-center gap-1.5 cursor-pointer outline-none"
              variants={{
                hidden: { opacity: 0, y: 20, scale: 0.9 },
                show: {
                  opacity: 1,
                  y: isActive ? -3 : 0,
                  scale: isActive ? 1.06 : 1,
                  transition: cardSpring,
                },
              }}
              animate={{
                y: isActive ? -3 : 0,
                scale: isActive ? 1.06 : 1,
              }}
              whileHover={{
                y: -6,
                scale: isActive ? 1.08 : 1.04,
                transition: hoverSpring,
              }}
              whileTap={{
                scale: 0.96,
                transition: { type: "spring", stiffness: 520, damping: 28 },
              }}
              transition={cardSpring}
            >
              <span className="relative flex h-[72px] w-full max-w-[78px] aspect-square items-center justify-center overflow-visible bg-transparent">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <motion.img
                  src={card.image}
                  alt=""
                  aria-hidden
                  draggable={false}
                  className="h-[95%] w-[95%] object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.14)]"
                  variants={{
                    hidden: { opacity: 0, y: 10, scale: 0.86 },
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
                  }}
                  whileHover={{
                    y: -5,
                    rotate: -2,
                    scale: 1.08,
                    transition: imgSpring,
                  }}
                />
              </span>
              <motion.span
                className="text-center text-[12px] sm:text-[13px] font-semibold leading-tight tracking-tight"
                animate={{ color: isActive ? "#6900AA" : "#1e293b" }}
                transition={{ duration: 0.22 }}
              >
                {card.title}
              </motion.span>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Tablet/Desktop — equal compact width, centered icon+title, clear gap */}
      <motion.div
        className="hidden md:flex md:flex-wrap md:justify-start gap-3 lg:gap-3.5 pt-1 pb-2"
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
        {list.map((card) => {
          const isActive = activeId === card.id;
          return (
            <motion.button
              key={`d-${card.id}`}
              type="button"
              aria-label={card.title}
              aria-pressed={isActive}
              onClick={() => onSelect(card)}
              className="flex w-[12.25rem] lg:w-[13.25rem] items-center justify-start gap-4 lg:gap-5 rounded-xl bg-white px-3 py-2.5 lg:py-3 cursor-pointer border border-slate-200/90 overflow-visible outline-none shadow-[0_6px_18px_rgba(15,23,42,0.06)]"
              variants={{
                hidden: { opacity: 0, y: 24, scale: 0.92 },
                show: {
                  opacity: 1,
                  y: isActive ? -4 : 0,
                  scale: isActive ? 1.04 : 1,
                  transition: cardSpring,
                },
              }}
              animate={{
                y: isActive ? -4 : 0,
                scale: isActive ? 1.04 : 1,
              }}
              whileHover={{
                y: -8,
                scale: isActive ? 1.06 : 1.03,
                boxShadow: "0 10px 24px rgba(15,23,42,0.1)",
                transition: hoverSpring,
              }}
              whileTap={{
                scale: 0.97,
                y: -2,
                transition: { type: "spring", stiffness: 520, damping: 28 },
              }}
              transition={cardSpring}
            >
              <span className="relative shrink-0 flex h-12 w-12 lg:h-14 lg:w-14 items-center justify-center overflow-visible bg-transparent">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <motion.img
                  src={card.image}
                  alt=""
                  aria-hidden
                  draggable={false}
                  className="relative z-[1] h-[118%] w-[118%] max-w-none object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.14)]"
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
                  }}
                  whileHover={{
                    y: -6,
                    rotate: -2,
                    scale: 1.08,
                    transition: imgSpring,
                  }}
                />
              </span>
              <motion.span
                className="shrink-0 whitespace-nowrap text-[15px] lg:text-base font-semibold tracking-tight leading-snug"
                animate={{ color: isActive ? "#6900AA" : "#0f172a" }}
                transition={{ duration: 0.22 }}
              >
                {card.title}
              </motion.span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
