"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Utensils } from "lucide-react";
import type { Business } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { restaurantHref } from "@/lib/businessPublicPath";
import { formatMoney } from "@/lib/currencyFormat";
import DiningWishlistButton from "@/components/DinningLandingPage/DiningWishlistButton";
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

function cuisineLabel(place: Pick<Business, "cuisine" | "type_name"> | string | undefined) {
  const raw =
    typeof place === "string"
      ? place
      : place?.cuisine || place?.type_name || "";
  const tags = raw
    .split(/[,·|/]/)
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 3);
  return tags.length ? tags.join(", ") : "Dining";
}

function distanceLabel(idHash: number) {
  return `${[0.4, 0.8, 1.2, 2.1, 3.4][idHash % 5]} km`;
}

function priceForTwoLabel(idHash: number, averageCost?: number) {
  if (averageCost) {
    return `${formatMoney(averageCost, { compact: true })} for two`;
  }
  const bases = [1200, 1500, 2000, 2400, 1800];
  return `${formatMoney(bases[idHash % bases.length], { compact: true })} for two`;
}

function stableHash(value: string | number | undefined) {
  if (typeof value === "number") return value;
  return String(value || "")
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

type EditorialBodyProps = {
  name: string;
  rating: number | null;
  cuisine: string;
  priceForTwo: string;
  locationLine: string;
  distance: string;
};

function EditorialBody({
  name,
  rating,
  cuisine,
  priceForTwo,
  locationLine,
  distance,
}: EditorialBodyProps) {
  return (
    <div className="flex flex-col gap-1 px-3.5 pt-3 pb-3.5 min-w-0 bg-white">
      {/* Row 1: Title + rating */}
      <div className="flex items-center justify-between gap-5 sm:gap-6 min-w-0">
        <h3 className="text-base tracking-wide sm:text-lg font-semibold text-[#1C1C1C] truncate min-w-0 flex-1 leading-snug pr-1">
          {name}
        </h3>
        {rating != null ? (
          <div className="shrink-0 inline-flex items-center gap-1 bg-[#24963F] text-white text-[0.9rem] font-bold px-2 py-0.5 rounded ml-1">
            <span>{rating.toFixed(1)}</span>
            <span className="text-[0.9rem] text-white">★</span>
          </div>
        ) : (
          <div className="shrink-0 inline-flex items-center bg-slate-100 text-slate-600 text-[0.75rem] font-bold px-2 py-0.5 rounded ml-1">
            New
          </div>
        )}
      </div>

      {/* Row 2: Cuisine + price */}
      <div className="flex items-center justify-between gap-5 sm:gap-10 min-w-0">
        <p className="min-w-0 flex-1 truncate text-sm tracking-wide text-gray-500 leading-snug">
          {cuisine}
        </p>
        <span className="shrink-0 whitespace-nowrap text-sm tracking-wide text-gray-500 leading-snug">
          {priceForTwo}
        </span>
      </div>

      {/* Row 3: Location + distance */}
      <div className="flex items-center justify-between gap-5 sm:gap-10 min-w-0">
        <p className="min-w-0 flex-1 truncate text-sm tracking-wide text-gray-500 leading-snug">
          {locationLine || "Addis Ababa"}
        </p>
        <span className="shrink-0 whitespace-nowrap text-sm tracking-wide font-semibold text-gray-600 leading-snug">
          {distance}
        </span>
      </div>
    </div>
  );
}

/** Editorial dining card — hero media + title / cuisine·price / location·distance. */
export function DiningEditorialCard({
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
      </div>
      <EditorialBody
        name={place.name}
        rating={rating}
        cuisine={cuisineLabel(place)}
        priceForTwo={priceForTwoLabel(idHash, place.average_cost)}
        locationLine={locationLine}
        distance={distanceLabel(idHash)}
      />
    </Link>
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
  const parsedRating = typeof rating === "number" ? rating : Number(rating);
  const hasRating = Number.isFinite(parsedRating) && parsedRating > 0;
  const idHash = stableHash(name);
  const widthClass = adaptive ? "w-full" : CARD_WIDTH;
  const shell = `${widthClass} group block rounded-[18px] bg-white border border-[#EEF0F3] overflow-hidden shadow-[0_2px_12px_rgba(17,17,17,0.06)] hover:shadow-[0_12px_28px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300 ${className}`;

  const body = (
    <>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F7F7F7]">
        <CoverImage src={image} alt={name} fallback={<Utensils size={28} strokeWidth={1.5} />} />
      </div>
      <EditorialBody
        name={name}
        rating={hasRating ? parsedRating : null}
        cuisine={cuisineLabel(cuisine)}
        priceForTwo={priceForTwoLabel(idHash)}
        locationLine={locality || "Addis Ababa"}
        distance={distanceLabel(idHash)}
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
