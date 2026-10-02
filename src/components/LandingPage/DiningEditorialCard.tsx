"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, MapPin, Star, Utensils } from "lucide-react";
import type { Business } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { restaurantHref } from "@/lib/businessPublicPath";
import DiningWishlistButton from "@/components/DinningLandingPage/DiningWishlistButton";
import PartnerMediaLightbox from "@/components/Shared/PartnerMediaLightbox";
import { localityFromAddress } from "./homeUtils";
import { useAdaptiveCard } from "./AdaptiveCardRow";

const CARD_WIDTH = "snap-start shrink-0 w-[280px] sm:w-[300px] lg:w-[320px]";

function CoverImage({
  src,
  alt,
  fallback,
}: {
  src?: string;
  alt: string;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const url = (src || "").trim();
  if (!url || failed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#F3F4F6] text-slate-300">
        {fallback}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.03]"
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

function Thumb({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const url = resolveMediaUrl(src) || "";
  if (!url || failed) {
    return <span className="block h-full w-full bg-[#E5E7EB]" aria-hidden />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className="h-full w-full object-cover"
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

function cuisineTags(place: Pick<Business, "cuisine" | "type_name">) {
  const raw = place.cuisine || place.type_name || "";
  const tags = raw
    .split(/[,·|/]/)
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((t) => t.toUpperCase());
  return tags.length ? tags : ["DINING"];
}

function distanceLabel(idHash: number) {
  return `${[0.4, 0.8, 1.2, 2.1, 3.4][idHash % 5]} km`;
}

function formatReviews(count: number) {
  if (count >= 1000) {
    const k = count / 1000;
    const label = Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k`;
    return `(${label})`;
  }
  return `(${count})`;
}

function stableHash(value: string | number | undefined) {
  if (typeof value === "number") return value;
  return String(value || "")
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function normalizeUrlList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((u) => String(u || "").trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((u) => String(u || "").trim()).filter(Boolean);
      }
    } catch {
      /* ignore */
    }
  }
  return [];
}

/** Unique media URLs for thumbs + lightbox (gallery → menu → cover). */
function collectPlaceImages(place: Business) {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw?: string | null) => {
    const value = (raw || "").trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push(value);
  };
  for (const url of normalizeUrlList(place.gallery_images)) push(url);
  for (const url of normalizeUrlList(place.menu_images)) push(url);
  push(place.cover_image_url);
  return out;
}

/** Prefer two distinct non-cover gallery shots for the facepile; fall back cleanly. */
function previewThumbs(images: string[], cover?: string | null) {
  const coverUrl = (cover || "").trim();
  const others = coverUrl ? images.filter((u) => u !== coverUrl) : images;
  if (others.length >= 2) return others.slice(0, 2);
  if (others.length === 1) {
    if (coverUrl && others[0] !== coverUrl) return [others[0], coverUrl];
    return [others[0]];
  }
  return images.slice(0, 1);
}

function RatingBadge({
  rating,
  reviewsCount,
}: {
  rating: number | null;
  reviewsCount: number;
}) {
  if (rating == null) {
    return (
      <span className="absolute bottom-3 left-3 z-[2] inline-flex items-center rounded-full bg-black/60 px-2.5 py-1 text-[0.75rem] font-bold tracking-wide text-white backdrop-blur-[2px]">
        New
      </span>
    );
  }
  return (
    <span className="absolute bottom-3 left-3 z-[2] inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-white backdrop-blur-[2px]">
      <Star size={12} className="fill-[#F5C518] text-[#F5C518]" strokeWidth={0} />
      <span className="text-sm font-bold tabular-nums leading-none">{rating.toFixed(1)}</span>
      {reviewsCount > 0 ? (
        <>
          <span className="h-3 w-px bg-white/35" aria-hidden />
          <span className="text-sm font-medium text-white/90 leading-none">
            {formatReviews(reviewsCount)}
          </span>
        </>
      ) : null}
    </span>
  );
}

type EditorialBodyProps = {
  name: string;
  locationLine: string;
  distance: string;
  tags: string[];
  thumbs: string[];
  gallery: string[];
  onOpenGallery: (index: number) => void;
};

function EditorialBody({
  name,
  locationLine,
  distance,
  tags,
  thumbs,
  gallery,
  onOpenGallery,
}: EditorialBodyProps) {
  return (
    <div className="flex flex-col gap-2.5 px-3.5 pt-3 pb-3.5 sm:gap-2.5 sm:px-3.5 sm:pt-3.5 sm:pb-3.5 min-w-0 bg-white">
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] sm:text-base lg:text-lg font-bold text-[#1C1C1C] leading-snug tracking-tight truncate">
            {name}
          </h3>
          <p className="mt-1.5 inline-flex items-center gap-1.5 min-w-0 max-w-full text-[12px] sm:text-sm text-gray-600">
            <MapPin size={13} className="shrink-0 text-gray-500" strokeWidth={2} />
            <span className="truncate">
              {locationLine || "Addis Ababa"}
              <span className="hidden sm:inline text-gray-400"> • {distance}</span>
            </span>
          </p>
        </div>

        {thumbs.length > 0 ? (
          <div
            className={`relative shrink-0 hidden sm:block h-11 ${thumbs.length > 1 ? "w-[4.25rem]" : "w-11"}`}
          >
            {thumbs.map((src, idx) => {
              const galleryIndex = Math.max(0, gallery.indexOf(src));
              return (
                <button
                  key={`${src}-${idx}`}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenGallery(galleryIndex >= 0 ? galleryIndex : idx);
                  }}
                  className={`absolute top-0 h-11 w-11 overflow-hidden rounded-full border-2 border-white shadow-sm bg-[#F3F4F6] cursor-pointer hover:ring-2 hover:ring-[#6900AA]/40 transition ${
                    idx === 0 ? "left-0 z-[1]" : "left-6 z-[2]"
                  }`}
                  aria-label={`View photo ${idx + 1}`}
                >
                  <Thumb src={src} alt="" />
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 min-w-0 pt-0.5">
        <p className="min-w-0 truncate text-[11px] sm:text-xs font-semibold tracking-[0.06em] uppercase text-gray-500">
          {tags[0] || "DINING"}
        </p>
        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[#2A2A2A] px-3 py-1.5 text-[11px] sm:text-[12px] font-semibold tracking-wide text-white group-hover:bg-[#1C1C1C] transition-colors">
          Book
          <ArrowRight size={13} strokeWidth={2.25} className="shrink-0" />
        </span>
      </div>
    </div>
  );
}

/** Editorial dining card — hero media, dynamic gallery thumbs, dark book CTA. */
export function DiningEditorialCard({
  place,
  className = "",
}: {
  place: Business;
  className?: string;
}) {
  const adaptive = useAdaptiveCard();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const gallery = useMemo(() => collectPlaceImages(place), [place]);
  const thumbs = useMemo(
    () => previewThumbs(gallery, place.cover_image_url),
    [gallery, place.cover_image_url]
  );

  const image = resolveMediaUrl(place.cover_image_url) || "";
  const reviewsCount = Number(place.reviews_count) || 0;
  const parsedRating = Number(place.rating);
  const rating =
    reviewsCount > 0 && Number.isFinite(parsedRating) && parsedRating > 0
      ? parsedRating
      : null;
  const locality = localityFromAddress(place.address);
  const city = place.city_name?.trim() || "";
  const locationLine = [locality, city].filter(Boolean).join(", ") || locality || city;
  const idHash = stableHash(place.id);
  const tags = cuisineTags(place);
  const widthClass = adaptive ? "w-full" : CARD_WIDTH;

  const openGallery = (index: number) => {
    if (gallery.length === 0) return;
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      <Link
        href={restaurantHref(place)}
        className={`${widthClass} group block rounded-[18px] bg-white border border-[#EEF0F3] overflow-hidden shadow-[0_2px_12px_rgba(17,17,17,0.06)] hover:shadow-[0_12px_28px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300 ${className}`}
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F7F7F7]">
          <CoverImage src={image} alt={place.name} fallback={<Utensils size={28} strokeWidth={1.5} />} />
          <DiningWishlistButton
            businessId={String(place.id)}
            tone="onDark"
            className="absolute top-3 right-3 z-[2] w-9 h-9 rounded-full bg-black/40 backdrop-blur-[2px] flex items-center justify-center hover:bg-black/55 transition-colors cursor-pointer disabled:opacity-70"
          />
          <RatingBadge rating={rating} reviewsCount={reviewsCount} />
        </div>
        <EditorialBody
          name={place.name}
          locationLine={locationLine}
          distance={distanceLabel(idHash)}
          tags={tags}
          thumbs={thumbs}
          gallery={gallery}
          onOpenGallery={openGallery}
        />
      </Link>

      <PartnerMediaLightbox
        open={lightboxOpen}
        items={gallery}
        startIndex={lightboxIndex}
        kind="image"
        label={`${place.name} photos`}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}

/** Showcase variant when live dining data is empty. */
export function ShowcaseDiningEditorialCard({
  name,
  image,
  rating,
  locality,
  cuisine,
  href,
  className = "",
}: {
  name: string;
  image: string;
  rating?: number;
  locality?: string;
  cuisine?: string;
  href?: string;
  className?: string;
}) {
  const adaptive = useAdaptiveCard();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const parsedRating = typeof rating === "number" ? rating : Number(rating);
  const hasRating = Number.isFinite(parsedRating) && parsedRating > 0;
  const idHash = stableHash(name);
  const widthClass = adaptive ? "w-full" : CARD_WIDTH;
  const shell = `${widthClass} group block rounded-[18px] bg-white border border-[#EEF0F3] overflow-hidden shadow-[0_2px_12px_rgba(17,17,17,0.06)] hover:shadow-[0_12px_28px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300 ${className}`;
  const tags = (cuisine || "Dining")
    .split(/[,·|/]/)
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((t) => t.toUpperCase());
  const tagList = tags.length ? tags : ["DINING"];
  const reviewsCount = hasRating ? [1200, 860, 540, 1500][idHash % 4] : 0;
  const gallery = image ? [image] : [];
  const thumbs = gallery.slice(0, 1);

  const openGallery = (index: number) => {
    if (gallery.length === 0) return;
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const body = (
    <>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F7F7F7]">
        <CoverImage src={image} alt={name} fallback={<Utensils size={28} strokeWidth={1.5} />} />
        <RatingBadge
          rating={hasRating ? parsedRating : null}
          reviewsCount={reviewsCount}
        />
      </div>
      <EditorialBody
        name={name}
        locationLine={locality || "Addis Ababa"}
        distance={distanceLabel(idHash)}
        tags={tagList}
        thumbs={thumbs}
        gallery={gallery}
        onOpenGallery={openGallery}
      />
    </>
  );

  return (
    <>
      {!href ? (
        <div className={`${shell} select-none`}>{body}</div>
      ) : (
        <Link href={href} className={shell}>
          {body}
        </Link>
      )}
      <PartnerMediaLightbox
        open={lightboxOpen}
        items={gallery}
        startIndex={lightboxIndex}
        kind="image"
        label={`${name} photos`}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
