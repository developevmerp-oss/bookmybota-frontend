"use client";

import { useRef } from "react";
import Link from "next/link";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { artistHref } from "@/lib/businessPublicPath";
import { useHorizontalScrollEdges } from "@/lib/useHorizontalScrollEdges";
import {
  usePublicArtistsCatalog,
  type DirectoryArtist,
} from "@/lib/usePublicArtistsCatalog";
import SafeCoverImage, {
  ARTIST_IMAGE_FALLBACK_CLASS,
  ArtistImageFallback,
} from "@/components/Shared/SafeCoverImage";
import { RailOverlayNavButton, RailSeeAllLink } from "./RailChrome";
import "./TopArtistsRail.css";

const VISIBLE = 6;

type RailArtistCard = {
  id: string;
  name: string;
  image: string;
  href: string;
};

function mapApiArtist(artist: DirectoryArtist): RailArtistCard {
  return {
    id: artist.id,
    name: artist.name,
    image: resolveMediaUrl(artist.cover_image_url),
    href: artistHref(artist),
  };
}

function ArtistCard({ artist }: { artist: RailArtistCard }) {
  return (
    <Link
      href={artist.href}
      className="top-artists-slot top-artists-slot-link shrink-0 w-[120px] sm:w-[190px] snap-start flex flex-col items-center gap-2.5 text-center"
      title={`View ${artist.name}`}
    >
      {/* Same size as event-listing ArtistChip */}
      <div className="top-artists-avatar relative h-[120px] w-[120px] sm:h-[190px] sm:w-[190px] rounded-full overflow-hidden bg-[#F7E9FF] ring-2 ring-white shadow-sm">
        <SafeCoverImage
          src={artist.image}
          alt=""
          className="top-artists-photo h-full w-full object-cover object-top"
          fallbackClassName={ARTIST_IMAGE_FALLBACK_CLASS}
          fallback={<ArtistImageFallback size={40} />}
        />
      </div>
      <p className="top-artists-name text-base tracking-wide sm:text-lg font-semibold text-slate-800 line-clamp-2 leading-tight px-0.5 w-full">
        {artist.name}
      </p>
    </Link>
  );
}

export default function TopArtistsRail() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { artists, isLoading } = usePublicArtistsCatalog();
  const items = artists.slice(0, 12).map(mapApiArtist);
  const edges = useHorizontalScrollEdges(scrollerRef, [items.length, isLoading]);

  const scrollBy = (dir: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(el.clientWidth * 0.75, 200);
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  if (!isLoading && items.length === 0) return null;

  return (
    <section className="w-full bg-white py-6 sm:py-0">
      <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-wide text-[#111111]">
            Top Artists
          </h2>
          <RailSeeAllLink href="/artists" />
        </div>

        <div className="relative">
          {edges.left ? (
            <RailOverlayNavButton
              direction="prev"
              side="left"
              label="Previous artists"
              onClick={() => scrollBy("left")}
            />
          ) : null}
          {edges.right ? (
            <RailOverlayNavButton
              direction="next"
              side="right"
              label="Next artists"
              onClick={() => scrollBy("right")}
            />
          ) : null}

          <div
            ref={scrollerRef}
            className="top-artists-rail"
            style={{ ["--artists-visible" as string]: VISIBLE }}
          >
            {isLoading
              ? Array.from({ length: VISIBLE }).map((_, i) => (
                  <div
                    key={i}
                    className="top-artists-slot shrink-0 w-[120px] sm:w-[190px] flex flex-col items-center gap-2.5"
                    aria-hidden
                  >
                    <div className="top-artists-avatar h-[120px] w-[120px] sm:h-[190px] sm:w-[190px] rounded-full bg-slate-200 animate-pulse" />
                    <div className="h-3 w-16 rounded bg-slate-200 animate-pulse" />
                  </div>
                ))
              : items.map((artist) => <ArtistCard key={artist.id} artist={artist} />)}
          </div>
        </div>
      </div>
    </section>
  );
}
