"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { MapPin, Star, Users, Utensils } from "lucide-react";
import type { Business } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { restaurantHref } from "@/lib/businessPublicPath";
import { formatMoney } from "@/lib/currencyFormat";
import { listingOfferBannerLabel } from "@/lib/diningOffers";
import { localityFromAddress } from "@/components/LandingPage/homeUtils";
import DiningWishlistButton from "@/components/DinningLandingPage/DiningWishlistButton";
import {
  coordsForCityName,
  formatDistanceKm,
  haversineKm,
  parseCoords,
} from "@/lib/geoDistance";
import { useSelectedCity } from "@/lib/useSelectedCity";
import { useUserGeo } from "@/lib/useUserGeo";

/**
 * Offer ribbon: flush to left image edge, solid purple → fully transparent on the right
 * (matches dining offer reference).
 */
const OFFER_RIBBON_BG =
  "linear-gradient(90deg, #8B5CF6 0%, #8B5CF6 38%, rgba(139,92,246,0.55) 68%, rgba(139,92,246,0.18) 86%, rgba(139,92,246,0) 100%)";

function OfferTagIcon({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className="block h-full w-full -rotate-[18deg]"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M21.41 11.58l-9-9A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 .59 1.42l9 9a2 2 0 0 0 2.82 0l7-7a2 2 0 0 0 0-2.84zM5.5 7A1.5 1.5 0 1 1 7 5.5 1.5 1.5 0 0 1 5.5 7z"
        />
      </svg>
    </span>
  );
}

function CoverMedia({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-slate-300">
        <Utensils size={28} strokeWidth={1.5} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

function cuisineLabel(place: Business | string | undefined): string {
  const raw =
    typeof place === "string"
      ? place
      : place?.cuisine || place?.type_name || "";
  if (Array.isArray(raw) && raw.length) {
    return raw.filter(Boolean).slice(0, 3).join(" • ");
  }
  const tags = String(raw)
    .split(/[,·|/]/)
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 3);
  return tags.length ? tags.join(" • ") : "Dining";
}

function formatReviewCount(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    const label = k >= 10 ? Math.round(k).toString() : k.toFixed(1).replace(/\.0$/, "");
    return `${label}K reviews`;
  }
  return `${n} review${n === 1 ? "" : "s"}`;
}

function MetaIcon({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
      {children}
    </span>
  );
}

function useCardDistanceLabel(
  latitude?: number | string | null,
  longitude?: number | string | null,
  placeCity?: string | null
): string | null {
  const selectedCity = useSelectedCity().trim();
  const { coords: liveCoords } = useUserGeo({
    selectedCity: selectedCity || null,
    autoDetect: true,
  });

  const userCoords = useMemo(() => {
    if (selectedCity) return coordsForCityName(selectedCity) ?? liveCoords;
    return liveCoords;
  }, [selectedCity, liveCoords]);

  const placeCoords = useMemo(
    () => parseCoords(latitude, longitude) ?? coordsForCityName(placeCity) ?? null,
    [latitude, longitude, placeCity]
  );

  return useMemo(() => {
    if (!userCoords || !placeCoords) return null;
    return formatDistanceKm(haversineKm(userCoords, placeCoords)) || null;
  }, [userCoords, placeCoords]);
}

export type DiningRestaurantCardOption2Props = {
  place: Business;
  className?: string;
  /** Dining listing: show promoted chip. Landing rails: hide. */
  showPromoted?: boolean;
  /** Dining listing: show offer bar. Landing rails: hide. */
  showOffer?: boolean;
};

/**
 * Dining restaurant card — listing + landing shared UI.
 * Landing passes showPromoted={false} showOffer={false}.
 */
export default function DiningRestaurantCardOption2({
  place,
  className = "",
  showPromoted = true,
  showOffer = true,
}: DiningRestaurantCardOption2Props) {
  const cover = resolveMediaUrl(place.cover_image_url) || "";
  const offerLabel = showOffer ? listingOfferBannerLabel(place.dining_offers) : null;
  const isPromoted = showPromoted && Boolean(place.is_promoted);

  const parsedRating = Number(place.rating);
  const reviewsCount = Number(place.reviews_count) || 0;
  const hasRating =
    reviewsCount > 0 && Number.isFinite(parsedRating) && parsedRating > 0;
  const rating = hasRating ? parsedRating : null;

  const locality = localityFromAddress(place.address) || "";
  const city = place.city_name?.trim() || "";
  const addressLine =
    place.address?.trim() ||
    [locality, city]
      .filter(Boolean)
      .filter((v, i, arr) => arr.findIndex((x) => x?.toLowerCase() === v?.toLowerCase()) === i)
      .join(", ") ||
    "Addis Ababa";

  const idHash =
    typeof place.id === "number"
      ? place.id
      : place.id
        ? String(place.id)
            .split("")
            .reduce((acc, char) => acc + char.charCodeAt(0), 0)
        : 0;
  const costNum = Number(place.average_cost);
  const hasCost = Number.isFinite(costNum) && costNum > 0;
  const priceForTwo = `${
    hasCost
      ? formatMoney(costNum, { compact: true })
      : formatMoney([1200, 1500, 2000, 2400, 1800][idHash % 5], { compact: true })
  } for 2`;
  const cuisine = cuisineLabel(place);
  const distanceLabel = useCardDistanceLabel(
    place.latitude,
    place.longitude,
    place.city_name
  );

  return (
    <Link
      href={restaurantHref(place)}
      className={`group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white shadow-[0_2px_10px_rgba(17,17,17,0.06)] hover:shadow-[0_10px_28px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300 ${className}`}
    >
      <div className="relative aspect-[5/4] w-full shrink-0 overflow-hidden bg-[#F3F4F6]">
        <CoverMedia src={cover} alt={place.name} />

        {isPromoted ? (
          <span className="absolute top-3 left-3 z-[1] pointer-events-none inline-flex items-center rounded-full bg-white/80 backdrop-blur-[2px] px-2.5 py-1 text-[11px] font-semibold text-slate-900 shadow-sm border border-white/60">
            Promoted
          </span>
        ) : null}

        <DiningWishlistButton businessId={String(place.id)} appearance="glass" />

        {offerLabel ? (
          <span
            className="absolute bottom-3.5 left-0 z-[1] pointer-events-none inline-flex max-w-[92%] items-center gap-2 pl-2.5 sm:pl-3 pr-12 sm:pr-14 py-[7px] sm:py-2 text-white text-xs sm:text-[13px] font-bold tracking-wide"
            style={{ background: OFFER_RIBBON_BG }}
          >
            <OfferTagIcon className="h-[17px] w-[17px] sm:h-[18px] sm:w-[18px]" />
            <span className="truncate leading-none">{offerLabel}</span>
          </span>
        ) : null}
      </div>

      <div className="px-3.5 sm:px-4 pt-3 sm:pt-3.5 pb-3.5 sm:pb-4 flex flex-1 flex-col gap-2 sm:gap-2.5 min-w-0">
          {/* Title + cuisine — tighter gap only between these two */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center justify-between gap-4 sm:gap-5 min-w-0">
            <h3
              className="min-w-0 flex-1 truncate text-[0.95rem] sm:text-base md:text-lg font-semibold text-[#111111] tracking-tight leading-snug"
              title={place.name}
            >
              {place.name}
            </h3>
            {hasRating && rating != null ? (
              <div className="shrink-0 flex flex-col items-end justify-center leading-none">
                <span className="inline-flex items-center gap-1">
                  <Star
                    size={14}
                    className="fill-[#F5B301] text-[#F5B301] sm:size-[15px]"
                    strokeWidth={0}
                  />
                  <span className="text-sm sm:text-[0.95rem] font-bold text-[#111111]">
                    {rating.toFixed(1)}
                  </span>
                </span>
                {reviewsCount > 0 ? (
                  <span className="mt-1 text-[0.65rem] sm:text-[0.7rem] font-medium text-slate-400">
                    ({formatReviewCount(reviewsCount)})
                  </span>
                ) : null}
              </div>
            ) : (
              <span className="shrink-0 inline-flex items-center bg-slate-100 text-slate-600 text-[0.7rem] sm:text-[0.75rem] font-bold px-2 py-0.5 rounded">
                New
              </span>
            )}
          </div>
          <p className="truncate text-xs sm:text-sm text-slate-600 leading-snug">
            {cuisine}
          </p>
        </div>

        {/* Distance + address — reserved height keeps cards even with/without distance */}
        <div className="flex min-h-[2.75rem] items-start gap-2.5 min-w-0">
          <MetaIcon>
            <MapPin size={14} strokeWidth={2.25} />
          </MetaIcon>
          <div className="min-w-0 flex-1 leading-snug">
            {distanceLabel ? (
              <>
                <p className="text-sm sm:text-sm  text-slate-600">
                  {distanceLabel}
                </p>
                <p className="truncate text-xs sm:text-sm text-slate-600  mt-0.5">
                  {addressLine}
                </p>
              </>
            ) : (
              <p className="truncate text-xs sm:text-sm text-slate-600 pt-1.5">
                {addressLine}
              </p>
            )}
          </div>
        </div>

        {/* Cost for 2 */}
        <div className="flex items-center gap-2.5 min-w-0">
          <MetaIcon>
            <Users size={14} strokeWidth={2.25} />
          </MetaIcon>
          <p className="truncate text-xs sm:text-sm text-slate-600  leading-snug">
            {priceForTwo}
          </p>
        </div>
      </div>
    </Link>
  );
}

/** Showcase card when live dining data is empty (landing rails). */
export function ShowcaseDiningRestaurantCard({
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
  const parsedRating = typeof rating === "number" ? rating : Number(rating);
  const hasRating = Number.isFinite(parsedRating) && parsedRating > 0;
  const idHash = String(name || "")
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const priceForTwo = `${formatMoney([1200, 1500, 2000, 2400, 1800][idHash % 5], {
    compact: true,
  })} for 2`;
  const reviews = [86, 124, 156, 98][idHash % 4];
  const shell = `group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white shadow-[0_2px_10px_rgba(17,17,17,0.06)] hover:shadow-[0_10px_28px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300 ${className}`;

  const body = (
    <>
      <div className="relative aspect-[5/4] w-full shrink-0 overflow-hidden bg-[#F3F4F6]">
        <CoverMedia src={image} alt={name} />
      </div>
      <div className="px-3.5 sm:px-4 pt-3 sm:pt-3.5 pb-3.5 sm:pb-4 flex flex-1 flex-col gap-2 sm:gap-2.5 min-w-0">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center justify-between gap-4 sm:gap-5 min-w-0">
            <h3
              className="min-w-0 flex-1 truncate text-[0.95rem] sm:text-base md:text-lg font-semibold text-[#111111] tracking-tight leading-snug"
              title={name}
            >
              {name}
            </h3>
            {hasRating ? (
              <div className="shrink-0 flex flex-col items-end justify-center leading-none">
                <span className="inline-flex items-center gap-1">
                  <Star size={14} className="fill-[#F5B301] text-[#F5B301]" strokeWidth={0} />
                  <span className="text-sm sm:text-[0.95rem] font-bold text-[#111111]">
                    {parsedRating.toFixed(1)}
                  </span>
                </span>
                <span className="mt-1 text-[0.65rem] sm:text-[0.7rem] font-medium text-slate-400">
                  ({formatReviewCount(reviews)})
                </span>
              </div>
            ) : (
              <span className="shrink-0 inline-flex items-center bg-slate-100 text-slate-600 text-[0.7rem] font-bold px-2 py-0.5 rounded">
                New
              </span>
            )}
          </div>
          <p className="truncate text-xs sm:text-sm text-slate-500 font-medium leading-snug">
            {cuisineLabel(cuisine)}
          </p>
        </div>
        <div className="flex min-h-[2.75rem] items-start gap-2.5 min-w-0">
          <MetaIcon>
            <MapPin size={14} strokeWidth={2.25} />
          </MetaIcon>
          <div className="min-w-0 flex-1 leading-snug">
            <p className="truncate text-xs sm:text-sm text-slate-500 font-medium pt-1.5">
              {locality || "Addis Ababa"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 min-w-0">
          <MetaIcon>
            <Users size={14} strokeWidth={2.25} />
          </MetaIcon>
          <p className="truncate text-xs sm:text-sm text-slate-600 font-medium leading-snug">
            {priceForTwo}
          </p>
        </div>
      </div>
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
