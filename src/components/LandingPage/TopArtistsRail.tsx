"use client";

import { useRef } from "react";
import Link from "next/link";
import { resolveMediaUrl } from "@/lib/mediaUrl";
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
  roleLine: string;
  href: string;
};

function mapApiArtist(artist: DirectoryArtist): RailArtistCard {
  const role = artist.type_name || artist.role_title || "Artist";
  const place = [artist.city_name, artist.city_state].filter(Boolean).join(", ");
  return {
    id: artist.id,
    name: artist.name,
    image: resolveMediaUrl(artist.cover_image_url),
    roleLine: place ? `${role} · ${place}` : role,
    href: `/artists/${artist.id}`,
  };
}

function ArtistCard({ artist }: { artist: RailArtistCard }) {
  return (
    <Link
      href={artist.href}
      className="top-artists-slot top-artists-slot-link"
      title={`View ${artist.name}`}
    >
      <div className="top-artists-avatar">
        <div className="top-artists-avatar-inner">
          <SafeCoverImage
            src={artist.image}
            alt=""
            className="w-full h-full object-cover"
            fallbackClassName={ARTIST_IMAGE_FALLBACK_CLASS}
            fallback={<ArtistImageFallback size={32} />}
          />
        </div>
      </div>
      <p className="top-artists-name">{artist.name}</p>
      <p className="top-artists-role">{artist.roleLine}</p>
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
    <section className="w-full bg-white py-6 sm:py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 2xl:px-0">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#111111]">
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
                  <div key={i} className="top-artists-slot" aria-hidden>
                    <div className="top-artists-avatar">
                      <div className="top-artists-avatar-inner bg-slate-200 animate-pulse" />
                    </div>
                    <div className="h-3 w-16 mx-auto mt-2 rounded bg-slate-200 animate-pulse" />
                    <div className="h-2.5 w-12 mx-auto mt-1.5 rounded bg-slate-100 animate-pulse" />
                  </div>
                ))
              : items.map((artist) => <ArtistCard key={artist.id} artist={artist} />)}
          </div>
        </div>
      </div>
    </section>
  );
}
