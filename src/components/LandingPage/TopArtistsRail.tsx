"use client";

import { useRef } from "react";
import Link from "next/link";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { artistHref } from "@/lib/businessPublicPath";
import { scrollRailBy, useHorizontalScrollEdges } from "@/lib/useHorizontalScrollEdges";
import {
  usePublicArtistsCatalog,
  type DirectoryArtist,
} from "@/lib/usePublicArtistsCatalog";
import SafeCoverImage, {
  ARTIST_IMAGE_FALLBACK_CLASS,
  ArtistImageFallback,
} from "@/components/Shared/SafeCoverImage";
import { RailPagerNav, RailSeeAllLink } from "./RailChrome";
import { ArtistRailShimmer } from "@/components/Shared/Shimmer";
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
      className="top-artists-slot top-artists-slot-link snap-start flex flex-col items-center gap-2.5 text-center"
      title={`View ${artist.name}`}
    >
      <div className="top-artists-avatar relative rounded-full overflow-hidden bg-[#F7E9FF] ring-2 ring-white shadow-sm">
        <SafeCoverImage
          src={artist.image}
          alt=""
          className="top-artists-photo h-full w-full object-cover object-top"
          fallbackClassName={ARTIST_IMAGE_FALLBACK_CLASS}
          fallback={<ArtistImageFallback size={40} />}
        />
      </div>
      <p className="top-artists-name text-sm sm:text-base lg:text-lg font-bold text-[#1C1C1C] truncate min-w-0 leading-snug transition-colors">
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
    scrollRailBy(el, dir === "left" ? -1 : 1);
  };

  if (!isLoading && items.length === 0) return null;

  return (
    <section className="w-full bg-white py-6 sm:py-0">
      <div className="container mx-auto px-4 sm:px-5 md:px-6 lg:px-8 xl:px-10 2xl:px-0">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
            Top Artists
          </h2>
          <RailSeeAllLink href="/artists" />
        </div>

        <div>
          {isLoading ? (
            <ArtistRailShimmer count={VISIBLE} />
          ) : (
            <>
              <div
                ref={scrollerRef}
                className="top-artists-rail"
              >
                {items.map((artist) => (
                  <ArtistCard key={artist.id} artist={artist} />
                ))}
              </div>

              <div className="hidden lg:block">
                <RailPagerNav
                  canPrev={edges.left}
                  canNext={edges.right}
                  pageCount={edges.pageCount}
                  activePage={edges.activePage}
                  onPrev={() => scrollBy("left")}
                  onNext={() => scrollBy("right")}
                  label="artists"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
