"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Building2, Calendar, Crown, Utensils } from "lucide-react";
import type { Business, PublicEvent, PublicRegisteredPartner } from "@/services/api";
import { useGetPublicEventQuery } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { restaurantHref, venueHref } from "@/lib/businessPublicPath";
import { formatMoney } from "@/lib/currencyFormat";
import { listingOfferBannerLabel } from "@/lib/diningOffers";
import DiningWishlistButton from "@/components/DinningLandingPage/DiningWishlistButton";
import {
  eventPortrait,
  eventPlaceLine,
  localityFromAddress,
  venueFromEventDetail,
} from "./homeUtils";
import { useAdaptiveCard } from "./AdaptiveCardRow";

const POSTER_MEDIA = "aspect-[3/4] w-full";
/** Portrait-leaning cover — matches marketplace dining card proportions */
const DINING_MEDIA = "aspect-[5/4] w-full";

const eventCardShell =
  "bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(17,17,17,0.06)] " +
  "hover:shadow-[0_8px_24px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 " +
  "transition-[box-shadow,transform] duration-300";

const cardShell =
  "bg-white border border-[#EAEAEA] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(17,17,17,0.06)] hover:shadow-[0_8px_24px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300";

/** Hover plate like reference: vertical pad only so card left edge aligns with section title. */
const diningCardShell =
  "rounded-2xl border-0 bg-transparent shadow-none" +
  "hover:bg-white " +
  "hover:shadow-[0_8px_24px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 " +
  "transition-[box-shadow,transform,background-color] duration-300";

/** Title + rating + address only. */
const diningCardBody = "pt-2.5 pb-1 flex flex-col gap-1 min-w-0";
const diningCardWidth =
  "snap-start shrink-0 w-[260px] sm:w-[280px] lg:w-[320px]";

/** White seal with brand-purple % — used on listing offer ribbon. */
function OfferPercentSeal({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-white shadow-sm leading-none ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className="block h-[66%] w-[66%] shrink-0"
        focusable="false"
      >
        <g transform="translate(12 12)">
          <circle cx="-4.35" cy="-4.35" r="2.05" fill="#7B5DFA" />
          <circle cx="4.35" cy="4.35" r="2.05" fill="#7B5DFA" />
          <path
            d="M4.6 -4.6L-4.6 4.6"
            stroke="#7B5DFA"
            strokeWidth="2.35"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </span>
  );
}

/** Purple → transparent fishtail ribbon (ref lavender offer gradient). */
const LISTING_OFFER_RIBBON_BG =
  "linear-gradient(90deg, #7B5DFA 0%, rgba(123,93,250,0.96) 36%, rgba(162,139,250,0.75) 66%, rgba(196,181,253,0.16) 100%)";

function listingDateLine(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const weekday = d.toLocaleString("en-GB", { weekday: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-GB", { month: "short" });
  const time = d.toLocaleString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${weekday}, ${day} ${month}, ${time}`;
}

function MediaFallback({ icon }: { icon: ReactNode }) {
  return (
    <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-[#F3F4F6] text-slate-300">
      {icon}
    </div>
  );
}

/** Cover image that swaps to a placeholder if the URL 404s / is broken. */
function CoverImage({
  src,
  alt,
  fallback,
  objectClass = "object-cover",
  hoverScaleClass = "group-hover:scale-[1.02]",
}: {
  src?: string;
  alt: string;
  fallback: ReactNode;
  objectClass?: string;
  hoverScaleClass?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = (src || "").trim();
  if (!url || failed) return <MediaFallback icon={fallback} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className={`absolute inset-0 h-full w-full ${objectClass} transition-transform duration-500 ease-out ${hoverScaleClass}`}
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

export function EventPosterCard({
  event,
  city,
  className = "",
  fullWidth = false,
}: {
  event: PublicEvent;
  city?: string;
  className?: string;
  fullWidth?: boolean;
}) {
  const adaptive = useAdaptiveCard();
  const image = eventPortrait(event);
  const eventType = event.category_name?.trim();
  const fillSlot = Boolean(adaptive) || fullWidth;
  const widthClass = fillSlot
    ? "w-full"
    : "snap-start shrink-0 w-[180px] sm:w-[200px] md:w-[220px]";

  const needsVenueLookup = !event.venue_name?.trim();
  const { data: detail } = useGetPublicEventQuery(event.id, { skip: !needsVenueLookup });
  const fromDetail = venueFromEventDetail(needsVenueLookup ? detail : null);
  const placeLine = eventPlaceLine(
    {
      ...event,
      venue_name: event.venue_name?.trim() || fromDetail.venue_name || undefined,
      city_name: event.city_name?.trim() || fromDetail.city_name || undefined,
    },
    city
  );

  const dateLine = listingDateLine(event.next_showtime);

  return (
    <Link
      href={`/events/${event.id}`}
      className={`${widthClass} group block min-w-0 h-full ${eventCardShell} ${className}`}
    >
      <div className={`relative ${POSTER_MEDIA} overflow-hidden bg-slate-100`}>
        <CoverImage
          src={image}
          alt={event.name}
          fallback={<Calendar size={28} strokeWidth={1.5} />}
          hoverScaleClass="group-hover:scale-[1.04]"
        />
        {event.is_promoted ? (
          <span className="absolute top-2 right-2 z-[2] rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#6900AA] shadow-sm">
            Promoted
          </span>
        ) : null}
      </div>
      <div className="space-y-1 px-3.5 py-3 sm:px-4 sm:py-3.5">
        {dateLine ? (
          <p className="text-sm tracking-wide  truncate leading-snug font-semibold text-[#B59B2A]">{dateLine}</p>
        ) : null}
        <h3 className="text-base tracking-wide sm:text-lg font-bold  text-[#1C1C1C] truncate min-w-0 flex-1 leading-snug">
          {event.name}
        </h3>
        {placeLine ? (
          <p className="text-sm tracking-wide text-gray-600 truncate leading-snug">{placeLine}</p>
        ) : null}
        {eventType ? (
          <p className="text-sm tracking-wide text-gray-600 truncate leading-snug">{eventType}</p>
        ) : null}
      </div>
    </Link>
  );
}

/** Static showcase card — same layout as EventPosterCard (no price). */
export function ShowcaseEventPosterCard({
  title,
  image,
  showDate,
  place,
  eventType,
  href,
  className = "",
  fullWidth = false,
}: {
  title: string;
  image: string;
  showDate?: string;
  place?: string;
  eventType?: string;
  href: string;
  className?: string;
  fullWidth?: boolean;
}) {
  const adaptive = useAdaptiveCard();
  const fillSlot = Boolean(adaptive) || fullWidth;
  const widthClass = fillSlot
    ? "w-full"
    : "snap-start shrink-0 w-[180px] sm:w-[200px] md:w-[210px]";

  const dateLine = listingDateLine(showDate);

  return (
    <Link
      href={href}
      className={`${widthClass} group block min-w-0 h-full ${eventCardShell} ${className}`}
    >
      <div className={`relative ${POSTER_MEDIA} overflow-hidden bg-slate-100`}>
        <CoverImage
          src={image}
          alt={title}
          fallback={<Calendar size={28} strokeWidth={1.5} />}
          hoverScaleClass="group-hover:scale-[1.04]"
        />
      </div>
      <div className="space-y-1 px-3.5 py-3 sm:px-4 sm:py-3.5">
        {dateLine ? (
          <p className="text-sm tracking-wide  truncate leading-snug font-semibold text-[#B59B2A]">{dateLine}</p>
        ) : null}
        <h3 className="text-base tracking-wide sm:text-lg font-bold  text-[#1C1C1C] truncate min-w-0 flex-1 leading-snug">
          {title}
        </h3>
        {place ? (
          <p className="text-sm tracking-wide text-gray-600 truncate leading-snug">{place}</p>
        ) : null}
        {eventType ? (
          <p className="text-sm tracking-wide text-gray-600 truncate leading-snug">{eventType}</p>
        ) : null}
      </div>
    </Link>
  );
}

function venuePlaceLine(venue: PublicRegisteredPartner) {
  const locality = localityFromAddress(venue.address || undefined);
  const city = venue.city_name?.trim() || "";
  if (locality && city && locality.toLowerCase() !== city.toLowerCase()) {
    return `${locality}: ${city}`;
  }
  if (locality) return locality;
  if (city && venue.city_state?.trim()) return `${city}, ${venue.city_state.trim()}`;
  if (city) return city;
  return venue.city_state?.trim() || "";
}

/** Same poster card layout as events — used on Top Venues rail. */
export function VenuePosterCard({
  venue,
  className = "",
}: {
  venue: PublicRegisteredPartner;
  className?: string;
}) {
  const adaptive = useAdaptiveCard();
  const fillSlot = Boolean(adaptive);
  const widthClass = fillSlot
    ? "w-full"
    : "snap-start shrink-0 w-[180px] sm:w-[200px] md:w-[220px]";
  const image = venue.cover_image_url?.trim()
    ? resolveMediaUrl(venue.cover_image_url.trim())
    : "";
  const placeLine = venuePlaceLine(venue);
  const venueType = venue.type_name?.trim() || "Venue";

  return (
    <Link
      href={venueHref(venue)}
      className={`${widthClass} group block h-full ${cardShell} ${className}`}
      title={`View ${venue.name} availability and send an inquiry`}
    >
      <div className={`relative ${POSTER_MEDIA} overflow-hidden bg-[#F3F4F6]`}>
        <CoverImage
          src={image}
          alt={venue.name}
          fallback={<Building2 size={32} strokeWidth={1.5} />}
        />
      </div>

      <div className="px-3 pt-3 pb-3.5 flex flex-col gap-0.5">
        <h3 className="font-bold text-[#111827] type-card-title leading-snug line-clamp-2">
          {venue.name}
        </h3>
        {placeLine ? (
          <p className="type-card-body text-[#6b7280] leading-snug line-clamp-2">{placeLine}</p>
        ) : null}
        <p className="mt-0.5 type-card-caption text-[#6900AA]/80 font-medium line-clamp-1">
          {venueType}
        </p>
      </div>
    </Link>
  );
}

/** @deprecated Use EventPosterCard — kept for category rails */
export function MusicEventCard({ event, city }: { event: PublicEvent; city?: string }) {
  return <EventPosterCard event={event} city={city} />;
}

export function DiningPosterCard({
  place,
  variant = "rail",
  className = "",
}: {
  place: Business;
  /** `listing` = dining home grid (wishlist / promoted / offer + cost & distance). */
  variant?: "rail" | "listing";
  className?: string;
}) {
  const adaptive = useAdaptiveCard();
  const image = resolveMediaUrl(place.cover_image_url) || "";
  const parsedRating = Number(place.rating);
  const reviewsCount = Number(place.reviews_count) || 0;
  const hasRating =
    reviewsCount > 0 && Number.isFinite(parsedRating) && parsedRating > 0;
  const rating = hasRating ? parsedRating : null;
  const locality = localityFromAddress(place.address) || place.city_name?.trim() || "";
  const isListing = variant === "listing";
  const widthClass = isListing ? "w-full" : adaptive ? "w-full" : diningCardWidth;

  const idHash =
    typeof place.id === "number"
      ? place.id
      : place.id
        ? String(place.id)
            .split("")
            .reduce((acc, char) => acc + char.charCodeAt(0), 0)
        : 0;
  const priceForTwo = place.average_cost
    ? `${formatMoney(place.average_cost, { compact: true })} for two`
    : (() => {
        const bases = [1200, 1500, 2000, 2400, 1800];
        return `${formatMoney(bases[idHash % bases.length], { compact: true })} for two`;
      })();
  const distance = (() => {
    const dists = [4.9, 3.5, 5.0, 2.8, 6.2];
    return `${dists[idHash % dists.length]} km`;
  })();
  const isPromoted = Boolean(place.is_promoted);
  const offerLabel = listingOfferBannerLabel(place.dining_offers);
  /** Shorter than full address — locality / first segment only. */
  const addressLine = locality || place.city_name?.trim() || "";
  const cuisineLine = (() => {
    const raw = place.cuisine || place.type_name || "";
    const tags = raw
      .split(/[,·|/]/)
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 3);
    return tags.length ? tags.join(", ") : "Dining";
  })();

  return (
    <Link
      href={restaurantHref(place)}
      className={`${widthClass} group block ${
        isListing
          ? "overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white shadow-[0_2px_10px_rgba(17,17,17,0.06)] hover:shadow-[0_10px_28px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300"
          : diningCardShell
      } ${className}`}
    >
      <div
        className={`relative ${DINING_MEDIA} overflow-hidden bg-[#F7F7F7] ${
          isListing ? "" : "rounded-2xl"
        }`}
      >
        <CoverImage
          src={image}
          alt={place.name}
          fallback={<Utensils size={28} strokeWidth={1.5} />}
          objectClass="object-cover object-top"
          hoverScaleClass="group-hover:scale-[1.04]"
        />

        {isListing ? (
          <>
            <DiningWishlistButton businessId={String(place.id)} />

            {isPromoted ? (
              <span className="absolute top-3 left-3 z-[1] pointer-events-none inline-flex items-center gap-1 rounded-full bg-[#6900AA] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
                <Crown size={12} className="shrink-0 text-[#FCD34D]" strokeWidth={2.25} fill="#FCD34D" />
                Promoted
              </span>
            ) : null}

            {offerLabel ? (
              <span
                className="absolute bottom-3.5 left-0 z-[1] pointer-events-none inline-flex max-w-[90%] items-center gap-2 pl-2.5 pr-5 py-[7px] text-white text-xs sm:text-[13px] font-bold tracking-wide"
                style={{
                  background: LISTING_OFFER_RIBBON_BG,
                  /* Fishtail / swallowtail ribbon */
                  clipPath:
                    "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)",
                  textShadow: "0 1px 2px rgba(15,23,42,0.4)",
                }}
              >
                <OfferPercentSeal className="h-[18px] w-[18px]" />
                <span className="truncate leading-none pr-1">{offerLabel}</span>
              </span>
            ) : null}
          </>
        ) : null}
      </div>

      <div className={isListing ? "px-4 pt-3.5 pb-4 flex flex-col gap-1.5 min-w-0" : diningCardBody}>
        <div className="flex items-center justify-between gap-5 sm:gap-6 min-w-0">
          <h3 className="text-base tracking-wide sm:text-lg font-bold text-[#1C1C1C] truncate min-w-0 flex-1 leading-snug transition-colors pr-1">
            {place.name}
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

        {isListing ? (
          <>
            <div className="flex items-center justify-between gap-5 sm:gap-6 min-w-0">
              <p className="min-w-0 flex-1 truncate text-sm tracking-wide text-gray-600 font-normal leading-snug">
                {cuisineLine}
              </p>
              <span className="shrink-0 whitespace-nowrap text-sm tracking-wide text-gray-600 font-normal leading-snug">
                {priceForTwo}
              </span>
            </div>
            <div className="flex items-center justify-between gap-5 sm:gap-6 min-w-0">
              {addressLine ? (
                <p className="min-w-0 flex-1 truncate text-sm tracking-wide text-gray-600 font-normal leading-snug">
                  {addressLine}
                </p>
              ) : (
                <span className="min-w-0 flex-1" />
              )}
              <span className="shrink-0 whitespace-nowrap text-sm tracking-wide font-bold text-[#1C1C1C] leading-snug">
                {distance}
              </span>
            </div>
          </>
        ) : locality ? (
          <p className="text-sm tracking-wide text-gray-600 truncate leading-snug">{locality}</p>
        ) : null}
      </div>
    </Link>
  );
}

/** Static showcase card — same layout as DiningPosterCard (no wishlist, no detail page). */
export function ShowcaseDiningPosterCard({
  name,
  image,
  rating,
  locality,
  cuisine,
  href,
  className = "",
  listingMeta = false,
}: {
  name: string;
  image: string;
  rating?: number;
  locality?: string;
  cuisine?: string;
  href?: string;
  className?: string;
  /** Dining-home static cards: cuisine · price · location · distance under the title. */
  listingMeta?: boolean;
}) {
  const adaptive = useAdaptiveCard();
  const parsedRating = typeof rating === "number" ? rating : Number(rating);
  const hasRating = Number.isFinite(parsedRating) && parsedRating > 0;
  const displayRating = hasRating ? parsedRating : null;
  const widthClass = listingMeta || adaptive ? "w-full" : diningCardWidth;
  const idHash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const priceForTwo = `${formatMoney([1200, 1500, 2000, 2400, 1800][idHash % 5], {
    compact: true,
  })} for two`;
  const distance = `${[4.9, 3.5, 5.0, 2.8, 6.2][idHash % 5]} km`;
  const cuisineLine = (() => {
    const tags = (cuisine || "")
      .split(/[,·|/]/)
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 3);
    return tags.length ? tags.join(", ") : "Dining";
  })();

  const body = (
    <>
      <div
        className={`relative ${DINING_MEDIA} overflow-hidden bg-[#F7F7F7] ${
          listingMeta ? "" : "rounded-2xl"
        }`}
      >
        <CoverImage
          src={image}
          alt={name}
          fallback={<Utensils size={28} strokeWidth={1.5} />}
          objectClass="object-cover object-top"
          hoverScaleClass="group-hover:scale-[1.04]"
        />
      </div>
      <div
        className={
          listingMeta
            ? "px-4 pt-3.5 pb-4 flex flex-col gap-1.5 min-w-0"
            : diningCardBody
        }
      >
        <div className="flex items-center justify-between gap-5 sm:gap-6 min-w-0">
          <h3 className="text-base tracking-wide sm:text-lg font-bold text-[#1C1C1C] truncate min-w-0 flex-1 leading-snug pr-1">
            {name}
          </h3>
          {displayRating != null ? (
            <div className="shrink-0 inline-flex items-center gap-1 bg-[#24963F] text-white text-[0.9rem] font-bold px-2 py-0.5 rounded ml-1">
              <span>{displayRating.toFixed(1)}</span>
              <span className="text-[0.9rem] text-white">★</span>
            </div>
          ) : (
            <div className="shrink-0 inline-flex items-center bg-slate-100 text-slate-600 text-[0.75rem] font-bold px-2 py-0.5 rounded ml-1">
              New
            </div>
          )}
        </div>

        {listingMeta ? (
          <>
            <div className="flex items-center justify-between gap-5 sm:gap-6 min-w-0">
              <p className="min-w-0 flex-1 truncate text-sm tracking-wide text-gray-600 font-normal leading-snug">
                {cuisineLine}
              </p>
              <span className="shrink-0 whitespace-nowrap text-sm tracking-wide text-gray-600 font-normal leading-snug">
                {priceForTwo}
              </span>
            </div>
            <div className="flex items-center justify-between gap-5 sm:gap-6 min-w-0">
              {locality ? (
                <p className="min-w-0 flex-1 truncate text-sm tracking-wide text-gray-600 font-normal leading-snug">
                  {locality}
                </p>
              ) : (
                <span className="min-w-0 flex-1" />
              )}
              <span className="shrink-0 whitespace-nowrap text-sm tracking-wide font-bold text-[#1C1C1C] leading-snug">
                {distance}
              </span>
            </div>
          </>
        ) : locality ? (
          <p className="text-[13px] text-[#696969] truncate leading-snug">{locality}</p>
        ) : null}
      </div>
    </>
  );

  const shell = listingMeta
    ? "overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white shadow-[0_2px_10px_rgba(17,17,17,0.06)] hover:shadow-[0_10px_28px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300"
    : diningCardShell;

  if (!href) {
    return (
      <div className={`${widthClass} group block ${shell} ${className} select-none`}>
        {body}
      </div>
    );
  }

  return (
    <Link href={href} className={`${widthClass} group block ${shell} ${className}`}>
      {body}
    </Link>
  );
}
