"use client";

import Link from "next/link";
import { titleLines, type CategoryNavTile } from "./categoryNavTiles";

type CategoryNavTileCardProps = {
  card: CategoryNavTile;
  size?: "nav" | "hero";
  active?: boolean;
};

const sizeClass = {
  nav: "w-[5.75rem] sm:w-[6.75rem] md:w-[7.25rem] lg:flex-1 lg:min-w-0 lg:max-w-[8.5rem] aspect-[3/4] sm:aspect-[5/7] rounded-xl sm:rounded-2xl",
  hero: "w-[calc((100%-0.625rem)/2)] sm:w-[calc((100%-1.5rem)/3)] md:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-5rem)/6)] aspect-[3/4] sm:aspect-[5/7] rounded-xl sm:rounded-2xl",
};

export default function CategoryNavTileCard({
  card,
  size = "nav",
  active = false,
}: CategoryNavTileCardProps) {
  const lines = titleLines(card.title);

  return (
    <Link
      href={card.href}
      aria-current={active ? "page" : undefined}
      className={`${sizeClass[size]} h-auto overflow-hidden relative group shrink-0 block ${
        active ? "ring-2 ring-[#6900AA] ring-offset-2" : ""
      }`}
    >
      <img
        src={card.image}
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
      />
      <div className="absolute inset-0 bg-gradient-to-tr from-black/30 via-black/10 to-transparent" />
      <div className="relative z-10 p-2.5 sm:p-3 lg:p-3.5">
        {lines.map((line) => (
          <p
            key={line}
            className="text-white font-extrabold uppercase type-tile leading-[1.05] tracking-tight"
          >
            {line}
          </p>
        ))}
        <p className="text-white font-semibold type-tile-meta mt-1 sm:mt-1.5">
          {card.count > 0 ? `${card.count}+ Events` : "Events"}
        </p>
      </div>
    </Link>
  );
}
