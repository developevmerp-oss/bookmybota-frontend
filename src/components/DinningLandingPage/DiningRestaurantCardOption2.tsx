"use client";

import { useState } from "react";
import Link from "next/link";
import { Utensils } from "lucide-react";
import type { Business } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { restaurantHref } from "@/lib/businessPublicPath";
import { formatMoney } from "@/lib/currencyFormat";
import { listingOfferBannerLabel } from "@/lib/diningOffers";
import { localityFromAddress } from "@/components/LandingPage/homeUtils";
import DiningWishlistButton from "@/components/DinningLandingPage/DiningWishlistButton";

/** Purple → transparent fishtail ribbon (ref lavender offer gradient). */
const OFFER_RIBBON_BG =
  "linear-gradient(90deg, #7B5DFA 0%, rgba(123,93,250,0.96) 36%, rgba(162,139,250,0.75) 66%, rgba(196,181,253,0.16) 100%)";

/** White price-tag — tip + black hole angled top-right (matches offer icon ref). */
function OfferTagIcon({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className="block h-full w-full"
        focusable="false"
      >
        <g transform="rotate(45 12 12)">
          <path
            fill="#FFFFFF"
            d="M12 2.75 L19.25 10 V21.25 H4.75 V10 Z"
          />
          <circle cx="12" cy="8.85" r="1.7" fill="#111111" />
        </g>
      </svg>
    </span>
  );
}

function cuisineLabel(place: Pick<Business, "cuisine" | "type_name">) {
  const raw = place.cuisine || place.type_name || "";
  const tags = raw
    .split(/[,·|/]/)
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 3);
  return tags.length ? tags.join(", ") : "Dining";
}

function CoverMedia({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const url = (src || "").trim();
  if (!url || failed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#F3F4F6] text-slate-300">
        <Utensils size={28} strokeWidth={1.5} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]"
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

/**
 * Dining homepage restaurant card — UI Option Two.
 */
export default function DiningRestaurantCardOption2({
  place,
  className = "",
}: {
  place: Business;
  className?: string;
}) {
  const cover = resolveMediaUrl(place.cover_image_url) || "";
  const offerLabel = listingOfferBannerLabel(place.dining_offers);
  const isPromoted = Boolean(place.is_promoted);

  const parsedRating = Number(place.rating);
  const reviewsCount = Number(place.reviews_count) || 0;
  const hasRating =
    reviewsCount > 0 && Number.isFinite(parsedRating) && parsedRating > 0;
  const rating = hasRating ? parsedRating : null;

  const locality = localityFromAddress(place.address) || place.city_name?.trim() || "";
  const cityLine = [locality, place.city_name?.trim()]
    .filter(Boolean)
    .filter((v, i, arr) => arr.findIndex((x) => x?.toLowerCase() === v?.toLowerCase()) === i)
    .join(", ");

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
  } for two`;
  const distanceLabel = `${[4.9, 3.5, 5.0, 2.8, 6.2][idHash % 5]} km`;
  const cuisine = cuisineLabel(place);

  return (
    <Link
      href={restaurantHref(place)}
      className={`group block w-full overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white shadow-[0_2px_10px_rgba(17,17,17,0.06)] hover:shadow-[0_10px_28px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300 ${className}`}
    >
      <div className="relative aspect-[5/4] w-full overflow-hidden bg-[#F3F4F6]">
        <CoverMedia src={cover} alt={place.name} />

        {isPromoted ? (
          <span className="absolute top-3 left-3 z-[1] pointer-events-none inline-flex items-center rounded-full bg-white/80 backdrop-blur-[2px] px-2.5 py-1 text-[11px] font-semibold text-slate-900 shadow-sm border border-white/60">
            Promoted
          </span>
        ) : null}

        <DiningWishlistButton businessId={String(place.id)} appearance="glass" />

        {offerLabel ? (
          <span
            className="absolute bottom-3.5 left-0 z-[1] pointer-events-none inline-flex max-w-[90%] items-center gap-2 pl-2.5 pr-5 py-[7px] text-white text-xs sm:text-[13px] font-bold tracking-wide"
            style={{
              background: OFFER_RIBBON_BG,
              clipPath:
                "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)",
              textShadow: "0 1px 2px rgba(15,23,42,0.4)",
            }}
          >
            <OfferTagIcon className="h-[18px] w-[18px]" />
            <span className="truncate leading-none pr-1">{offerLabel}</span>
          </span>
        ) : null}
      </div>

      <div className="px-4 pt-3.5 pb-4 flex flex-col gap-1.5 min-w-0">
        {/* Row 1: title + green rating */}
        <div className="flex items-center justify-between gap-5 sm:gap-6 min-w-0">
          <h3 className="text-base tracking-wide sm:text-lg font-semibold text-gray-800 truncate min-w-0 flex-1 leading-snug pr-1">
            {place.name}
          </h3>
          {hasRating && rating != null ? (
            <div className="shrink-0 inline-flex items-center gap-1 bg-[#24963F] text-white text-[0.85rem] font-bold px-2 py-0.5 rounded ml-1">
              <span>{rating.toFixed(1)}</span>
              <span className="text-[0.85rem] text-white">★</span>
            </div>
          ) : (
            <div className="shrink-0 inline-flex items-center bg-slate-100 text-slate-600 text-[0.75rem] font-bold px-2 py-0.5 rounded ml-1">
              New
            </div>
          )}
        </div>

        {/* Row 2: cuisine + price */}
        <div className="flex items-center justify-between gap-5 sm:gap-6 min-w-0">
          <p className="min-w-0 flex-1 truncate text-sm tracking-wide text-gray-500 font-normal leading-snug">
            {cuisine}
          </p>
          <span className="shrink-0 whitespace-nowrap text-sm tracking-wide text-gray-500 font-normal leading-snug">
            {priceForTwo}
          </span>
        </div>

        {/* Row 3: location + distance */}
        <div className="flex items-center justify-between gap-5 sm:gap-6 min-w-0">
          {cityLine ? (
            <p className="min-w-0 flex-1 truncate text-sm tracking-wide text-gray-500 font-normal leading-snug">
              {cityLine}
            </p>
          ) : (
            <span className="min-w-0 flex-1" />
          )}
          <span className="shrink-0 whitespace-nowrap text-sm tracking-wide font-semibold text-gray-600 leading-snug">
            {distanceLabel}
          </span>
        </div>
      </div>
    </Link>
  );
}
