"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, MapPin, Star, Utensils } from "lucide-react";
import type { Business } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { restaurantHref } from "@/lib/businessPublicPath";
import DiningWishlistButton from "@/components/DinningLandingPage/DiningWishlistButton";
import { localityFromAddress } from "./homeUtils";
import { useAdaptiveCard } from "./AdaptiveCardRow";

const CARD_WIDTH = "snap-start shrink-0 w-[260px] sm:w-[280px] lg:w-[300px]";

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

function cuisineLabel(place: Pick<Business, "cuisine" | "type_name">) {
  const raw = place.cuisine || place.type_name || "";
  const tags = raw
    .split(/[,·|/]/)
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 3);
  return tags.length ? tags.join(" • ") : "Dining";
}

function distanceLabel(idHash: number) {
  return `${[0.6, 1.2, 2.4, 3.1, 4.2][idHash % 5]} km`;
}

function stableHash(value: string | number | undefined) {
  if (typeof value === "number") return value;
  return String(value || "")
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
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
      <span className="absolute bottom-3 left-3 z-[2] inline-flex items-center rounded-full bg-black/55 px-2.5 py-1 text-[0.75rem] font-bold tracking-wide text-white backdrop-blur-[2px]">
        New
      </span>
    );
  }
  return (
    <span className="absolute bottom-3 left-3 z-[2] inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-white backdrop-blur-[2px]">
      <Star size={12} className="fill-[#F5C518] text-[#F5C518]" strokeWidth={0} />
      <span className="text-sm font-bold tabular-nums leading-none">{rating.toFixed(1)}</span>
      {reviewsCount > 0 ? (
        <span className="text-sm font-medium text-white/85 leading-none">({reviewsCount})</span>
      ) : null}
    </span>
  );
}

type OverlayBodyProps = {
  name: string;
  locationLine: string;
  distance: string;
  cuisine: string;
};

function OverlayBody({ name, locationLine, distance, cuisine }: OverlayBodyProps) {
  return (
    <div className="flex flex-col gap-1.5 px-3.5 pt-3 pb-3.5 min-w-0 bg-white">
      <h3 className="text-base tracking-wide sm:text-lg font-bold text-[#1C1C1C] leading-snug truncate">
        {name}
      </h3>

      <div className="flex items-center justify-between gap-2 min-w-0 text-sm tracking-wide text-gray-600">
        <p className="inline-flex items-center gap-1.5 min-w-0 truncate leading-snug">
          <MapPin size={14} className="shrink-0 text-gray-500" strokeWidth={2} />
          <span className="truncate">{locationLine || "Addis Ababa"}</span>
        </p>
        <span className="shrink-0 whitespace-nowrap">{distance}</span>
      </div>

      <div className="h-px w-full bg-[#ECEFF3]" aria-hidden />

      <div className="flex items-center justify-between gap-2 min-w-0 text-sm tracking-wide">
        <p className="inline-flex items-center gap-1.5 min-w-0 truncate leading-snug text-gray-600">
          <Utensils size={14} className="shrink-0 text-gray-500" strokeWidth={2} />
          <span className="truncate">{cuisine}</span>
        </p>
        <span className="shrink-0 inline-flex items-center gap-1 font-semibold tracking-wide text-[#1C1C1C] whitespace-nowrap">
          Book a Table
          <ArrowRight size={14} strokeWidth={2.25} />
        </span>
      </div>
    </div>
  );
}

/** Overlay dining card — rating on image, location / cuisine, book CTA. */
export function DiningOverlayCard({
  place,
  className = "",
}: {
  place: Business;
  className?: string;
}) {
  const adaptive = useAdaptiveCard();
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
  const widthClass = adaptive ? "w-full" : CARD_WIDTH;

  return (
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
      <OverlayBody
        name={place.name}
        locationLine={locationLine}
        distance={distanceLabel(idHash)}
        cuisine={cuisineLabel(place)}
      />
    </Link>
  );
}

/** Showcase variant when live dining data is empty. */
export function ShowcaseDiningOverlayCard({
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
  const parsedRating = typeof rating === "number" ? rating : Number(rating);
  const hasRating = Number.isFinite(parsedRating) && parsedRating > 0;
  const idHash = stableHash(name);
  const widthClass = adaptive ? "w-full" : CARD_WIDTH;
  const shell = `${widthClass} group block rounded-[18px] bg-white border border-[#EEF0F3] overflow-hidden shadow-[0_2px_12px_rgba(17,17,17,0.06)] hover:shadow-[0_12px_28px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300 ${className}`;
  const reviewsCount = hasRating ? [126, 98, 214, 86][idHash % 4] : 0;

  const body = (
    <>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F7F7F7]">
        <CoverImage src={image} alt={name} fallback={<Utensils size={28} strokeWidth={1.5} />} />
        <RatingBadge
          rating={hasRating ? parsedRating : null}
          reviewsCount={reviewsCount}
        />
      </div>
      <OverlayBody
        name={name}
        locationLine={locality || "Addis Ababa"}
        distance={distanceLabel(idHash)}
        cuisine={(cuisine || "Dining").replace(/[·|/]/g, "•")}
      />
    </>
  );

  if (!href) {
    return <div className={`${shell} select-none`}>{body}</div>;
  }

  return (
    <Link href={href} className={shell}>
      {body}
    </Link>
  );
}
