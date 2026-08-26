"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Mic2 } from "lucide-react";
import { useGetPublicRegisteredArtistsQuery, type PublicRegisteredPartner } from "@/services/api";
import "./TopArtistsRail.css";

const VISIBLE = 6;

function ArtistCard({ artist }: { artist: PublicRegisteredPartner }) {
  const role = artist.type_name || "Artist";
  const place = [artist.city_name, artist.city_state].filter(Boolean).join(", ");

  return (
    <Link
      href={`/artists/${artist.id}`}
      className="top-artists-slot top-artists-slot-link"
      title={`View ${artist.name} availability and send an inquiry`}
    >
      <div className="top-artists-avatar">
        <div className="top-artists-avatar-inner">
          {artist.cover_image_url ? (
            <img
              src={artist.cover_image_url}
              alt={artist.name}
              className="w-full h-full object-cover"
              loading="lazy"
              draggable={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#F7E9FF] text-[#6900AA]">
              <Mic2 size={32} strokeWidth={1.4} />
            </div>
          )}
        </div>
      </div>
      <p className="top-artists-name">{artist.name}</p>
      <p className="top-artists-role">{place ? `${role} · ${place}` : role}</p>
    </Link>
  );
}

export default function TopArtistsRail() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { data: artists = [], isLoading } = useGetPublicRegisteredArtistsQuery();

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.7, 280), behavior: "smooth" });
  };

  return (
    <section className="bg-white py-6 sm:py-8 lg:py-10">
      <div className="container mx-auto px-4 md:px-5 lg:px-8">
        <div className="flex items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          <h2 className="type-section font-semibold tracking-tight text-[#111111]">Top Artists</h2>
          <Link
            href="/artists"
            className="shrink-0 type-link font-medium text-[#6900AA] hover:text-[#57008E]"
          >
            See All ›
          </Link>
        </div>

        {isLoading ? (
          <div className="flex gap-4 overflow-hidden py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center w-[6.75rem] sm:w-[7.75rem] shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#F7E9FF] animate-pulse" />
                <div className="mt-3 h-3 w-16 bg-slate-100 rounded animate-pulse" />
                <div className="mt-2 h-2.5 w-12 bg-slate-50 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : artists.length === 0 ? (
          <p className="text-sm text-[#6b6b6b] py-6">
            No registered artists yet. After artists are approved, they will appear here with free
            dates you can inquire about.
          </p>
        ) : (
          <div className="relative">
            {artists.length > 5 ? (
              <button
                type="button"
                aria-label="Previous artists"
                onClick={() => scrollBy(-1)}
                className="flex absolute left-1 sm:-left-2 top-[76px] sm:top-[86px] md:top-[94px] lg:top-[105px] -translate-y-1/2 z-10 w-9 h-9 md:w-10 md:h-10 rounded-full items-center justify-center cursor-pointer bg-white/95 border border-[#EDEDED] text-[#111111] shadow-md hover:bg-[#F7E9FF]"
              >
                <ChevronLeft size={20} />
              </button>
            ) : null}

            <div
              ref={scrollerRef}
              className="top-artists-rail"
              style={{ ["--artists-visible" as string]: VISIBLE }}
            >
              {artists.map((artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </div>

            {artists.length > 5 ? (
              <button
                type="button"
                aria-label="Next artists"
                onClick={() => scrollBy(1)}
                className="flex absolute right-1 sm:-right-2 top-[76px] sm:top-[86px] md:top-[94px] lg:top-[105px] -translate-y-1/2 z-10 w-9 h-9 md:w-10 md:h-10 rounded-full items-center justify-center cursor-pointer bg-white/95 border border-[#EDEDED] text-[#111111] shadow-md hover:bg-[#F7E9FF]"
              >
                <ChevronRight size={20} />
              </button>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
