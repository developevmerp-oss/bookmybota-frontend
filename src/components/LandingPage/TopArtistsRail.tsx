"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./TopArtistsRail.css";

export type TopArtist = {
  id: string;
  name: string;
  role: string;
  image: string;
};

/** Static showcase data for the landing Top Artists rail. */
export const TOP_ARTISTS: TopArtist[] = [
  {
    id: "1",
    name: "Tedros Hagos",
    role: "Singer",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&q=80",
  },
  {
    id: "2",
    name: "Selam Tesfaye",
    role: "Singer",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&q=80",
  },
  {
    id: "3",
    name: "Abebe Mulugeta",
    role: "Musician",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&q=80",
  },
  {
    id: "4",
    name: "Eyerus Alebel",
    role: "Singer",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&q=80",
  },
  {
    id: "5",
    name: "Daniel Belay",
    role: "DJ",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&q=80",
  },
  {
    id: "6",
    name: "Kiya Yohannes",
    role: "Comedian",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&q=80",
  },
  {
    id: "7",
    name: "Bethelhem Tilahun",
    role: "Singer",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&q=80",
  },
  {
    id: "8",
    name: "Nahom Records",
    role: "DJ",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&q=80",
  },
];

const VISIBLE = 6;

function ArtistCard({ artist }: { artist: TopArtist }) {
  return (
    <div className="top-artists-slot flex flex-col items-center text-center group">
      <div className="top-artists-avatar rounded-full p-[3px] transition-colors">
        <div className="w-35 h-35 rounded-full overflow-hidden bg-[#F7F7F7] border-2 border-[#6900AA] ring-2 ring-white">
          <img
            src={artist.image}
            alt={artist.name}
            className="w-full h-full object-cover"
            loading="lazy"
            draggable={false}
          />
        </div>
      </div>
      <p className="mt-7 text-sm sm:text-base ml-5 font-semibold text-[#111111] line-clamp-2 leading-snug px-1">
        {artist.name}
      </p>
      <p className="mt-0.5 text-xs sm:text-sm ml-5 text-[#6B6B6B] line-clamp-1">{artist.role}</p>
    </div>
  );
}

export default function TopArtistsRail() {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    // Scroll by roughly one viewport (6 artists) so the remaining 2 come into view
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="bg-white py-6 sm:py-8 lg:py-10">
      <div className="container mx-auto px-4 md:px-5 lg:px-8">
        <div className="flex items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          <h2 className="text-xl sm:text-[22px] md:text-2xl font-semibold tracking-tight text-[#111111]">
            Top Artists
          </h2>
          <Link
            href="/events"
            className="shrink-0 text-xs sm:text-sm font-medium text-[#6900AA] hover:text-[#57008E]"
          >
            See All ›
          </Link>
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label="Previous artists"
            onClick={() => scrollBy(-1)}
            className="hidden md:flex absolute -left-2 lg:-left-3 top-[42%] -translate-y-1/2 z-10 w-9 h-9 rounded-full items-center justify-center cursor-pointer bg-white border border-[#EDEDED] text-[#111111] shadow-sm hover:bg-[#F7E9FF]"
          >
            <ChevronLeft size={18} />
          </button>

          <div
            ref={scrollerRef}
            className="top-artists-rail"
            style={{ ["--artists-visible" as string]: VISIBLE }}
          >
            {TOP_ARTISTS.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>

          <button
            type="button"
            aria-label="Next artists"
            onClick={() => scrollBy(1)}
            className="hidden md:flex absolute -right-2 lg:-right-3 top-[42%] -translate-y-1/2 z-10 w-9 h-9 rounded-full items-center justify-center cursor-pointer bg-white border border-[#EDEDED] text-[#111111] shadow-sm hover:bg-[#F7E9FF]"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
