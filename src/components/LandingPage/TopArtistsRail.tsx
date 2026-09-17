"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Mic2 } from "lucide-react";
import { useGetPublicRegisteredArtistsQuery, type PublicRegisteredPartner } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { useHorizontalScrollEdges } from "@/lib/useHorizontalScrollEdges";
import {
  SHOWCASE_ARTIST_CARDS,
  type ShowcaseArtistCard,
} from "@/data/showcaseArtistCards";
import { RailOverlayNavButton, RailSeeAllLink } from "./RailChrome";
import "./TopArtistsRail.css";

const VISIBLE = 6;

type RailArtistCard = {
  id: string;
  name: string;
  image: string;
  roleLine: string;
  href: string;
};

function mapApiArtist(artist: PublicRegisteredPartner): RailArtistCard {
  const role = artist.type_name || "Artist";
  const place = [artist.city_name, artist.city_state].filter(Boolean).join(", ");
  return {
    id: artist.id,
    name: artist.name,
    image: resolveMediaUrl(artist.cover_image_url),
    roleLine: place ? `${role} · ${place}` : role,
    href: `/artists/${artist.id}`,
  };
}

function mapShowcaseArtist(artist: ShowcaseArtistCard): RailArtistCard {
  return {
    id: artist.id,
    name: artist.name,
    image: artist.image,
    roleLine: `${artist.role} · ${artist.place}`,
    href: artist.href,
  };
}

function ArtistAvatar({ image }: { image: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(image) && !failed;

  if (!showImage) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#F7E9FF] text-[#6900AA]">
        <Mic2 size={32} strokeWidth={1.4} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image}
      alt=""
      className="w-full h-full object-cover"
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

function ArtistCard({ artist }: { artist: RailArtistCard }) {
  return (
    <Link
      href={artist.href}
      className="top-artists-slot top-artists-slot-link"
      title={`View ${artist.name} and send an inquiry`}
    >
      <div className="top-artists-avatar">
        <div className="top-artists-avatar-inner">
          <ArtistAvatar image={artist.image} />
        </div>
      </div>
      <p className="top-artists-name">{artist.name}</p>
      <p className="top-artists-role">{artist.roleLine}</p>
    </Link>
  );
}

export default function TopArtistsRail() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { data: artists = [], isLoading } = useGetPublicRegisteredArtistsQuery();
  const useStatic = !isLoading && artists.length === 0;
  const items = useStatic
    ? SHOWCASE_ARTIST_CARDS.map(mapShowcaseArtist)
    : artists.map(mapApiArtist);
  const scrollEdges = useHorizontalScrollEdges(scrollerRef, [items.length, useStatic, isLoading]);

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
          <RailSeeAllLink href="/artists" />
        </div>

        {isLoading ? (
          <div className="flex gap-4 overflow-hidden py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col items-center w-[6.75rem] sm:w-[7.75rem] shrink-0"
              >
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#F7E9FF] animate-pulse" />
                <div className="mt-3 h-3 w-16 bg-slate-100 rounded animate-pulse" />
                <div className="mt-2 h-2.5 w-12 bg-slate-50 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="relative overflow-visible">
            {scrollEdges.left ? (
              <RailOverlayNavButton
                direction="prev"
                side="left"
                label="Previous artists"
                onClick={() => scrollBy(-1)}
                className="!flex !-left-3 sm:!-left-4 lg:!-left-5 !top-[76px] sm:!top-[86px] md:!top-[94px] lg:!top-[105px]"
              />
            ) : null}

            <div
              ref={scrollerRef}
              className="top-artists-rail"
              style={{ ["--artists-visible" as string]: VISIBLE }}
            >
              {items.map((artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </div>

            {scrollEdges.right ? (
              <RailOverlayNavButton
                direction="next"
                side="right"
                label="Next artists"
                onClick={() => scrollBy(1)}
                className="!flex !-right-3 sm:!-right-4 lg:!-right-5 !top-[76px] sm:!top-[86px] md:!top-[94px] lg:!top-[105px]"
              />
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
