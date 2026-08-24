"use client";

import Link from "next/link";
import { Calendar, Star } from "lucide-react";
import type { Business, PublicEvent } from "@/services/api";
import { normalizePriceRange } from "@/lib/currencyFormat";
import {
  eventPortrait,
  eventLandscape,
  eventPlaceLine,
  formatEventDateLine,
  localityFromAddress,
} from "./homeUtils";
import { useAdaptiveCard } from "./AdaptiveCardRow";

/** 1 card: full-width landscape with capped height. 2 cards: 16/9. 3+: portrait. */
function posterMediaClass(fluid: boolean, horizontal: boolean, columns: number) {
  if (horizontal && columns === 1) {
    return "h-[180px] sm:h-[210px] md:h-[240px] lg:h-[280px] w-full";
  }
  if (horizontal) return "aspect-[16/9] w-full";
  if (fluid) return "aspect-[3/4] w-full max-h-[280px]";
  return "aspect-[3/4] w-full";
}

function diningMediaClass() {
  return "aspect-[4/3] w-full";
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
  const horizontal = Boolean(adaptive?.horizontal);
  const image = horizontal ? eventLandscape(event) : eventPortrait(event);
  const dateLine = formatEventDateLine(event.next_showtime);
  const placeLine = eventPlaceLine(event, city);
  const eventType = event.category_name?.trim();
  const fillSlot = Boolean(adaptive) || fullWidth;
  const fluid = Boolean(adaptive?.fluid);
  const columns = adaptive?.columns ?? 0;
  const widthClass = fillSlot
    ? "w-full"
    : "snap-start shrink-0 w-[180px] sm:w-[200px] md:w-[220px]";

  return (
    <Link
      href={`/events/${event.id}`}
      className={`${widthClass} group block bg-white rounded-2xl overflow-hidden transition-shadow ${className}`}
    >
      <div className="pb-0">
        <div className="rounded-t-[10px] overflow-hidden bg-white">
          <div className={`relative ${posterMediaClass(fluid, horizontal, columns)} overflow-hidden bg-slate-100`}>
            {image ? (
              <img
                src={image}
                alt={event.name}
                className="w-full h-full object-cover group-hover:scale-[1.08] transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <Calendar size={28} strokeWidth={1.5} />
              </div>
            )}
          </div>
        </div>
        {dateLine && (
          <div className="bg-black text-white px-3 py-2.5 type-card-body font-medium rounded-b-[10px]">
            {dateLine}
          </div>
        )}
      </div>

      <div className="px-3 pt-3 pb-4">
        <h3 className="font-bold text-[#1a2744] type-card-title leading-snug line-clamp-2">
          {event.name}
        </h3>
        {placeLine && (
          <p className="mt-2 type-card-body text-[#6b7280] leading-snug line-clamp-2">
            {placeLine}
          </p>
        )}
        {eventType && (
          <p className="mt-1 type-card-caption text-[#9ca3af] line-clamp-1">{eventType}</p>
        )}
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
  const dateLine = formatEventDateLine(showDate);
  const fillSlot = Boolean(adaptive) || fullWidth;
  const fluid = Boolean(adaptive?.fluid);
  const horizontal = Boolean(adaptive?.horizontal);
  const columns = adaptive?.columns ?? 0;
  const widthClass = fillSlot
    ? "w-full"
    : "snap-start shrink-0 w-[180px] sm:w-[200px] md:w-[220px]";

  return (
    <Link
      href={href}
      className={`${widthClass} group block bg-white rounded-xl overflow-hidden hover:shadow-md transition-shadow ${className}`}
    >
      <div className="pb-0">
        <div className="rounded-t-[10px] overflow-hidden bg-white">
          <div className={`relative ${posterMediaClass(fluid, horizontal, columns)} overflow-hidden bg-slate-100`}>
            <img
              src={image}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
              loading="lazy"
              draggable={false}
            />
          </div>
        </div>
        {dateLine && (
          <div className="bg-black text-white px-3 py-2.5 type-card-body font-medium rounded-b-[10px]">
            {dateLine}
          </div>
        )}
      </div>

      <div className="px-3 pt-3 pb-4 bg-white">
        <h3 className="font-bold text-[#1a2744] type-card-title leading-snug line-clamp-2">
          {title}
        </h3>
        {place && (
          <p className="mt-2 type-card-body text-[#6b7280] leading-snug line-clamp-2">
            {place}
          </p>
        )}
        {eventType && (
          <p className="mt-1 type-card-caption text-[#9ca3af] line-clamp-1">{eventType}</p>
        )}
      </div>
    </Link>
  );
}

/** @deprecated Use EventPosterCard — kept for category rails */
export function MusicEventCard({ event, city }: { event: PublicEvent; city?: string }) {
  return <EventPosterCard event={event} city={city} />;
}

export function DiningPosterCard({ place }: { place: Business }) {
  const adaptive = useAdaptiveCard();
  const image = place.cover_image_url || "";
  const rating = Number(place.rating);
  const showRating = Number.isFinite(rating) && rating > 0;
  const locality = localityFromAddress(place.address);
  const tags = [place.cuisine, place.type_name, normalizePriceRange(place.price_range)]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  const fillSlot = Boolean(adaptive);
  const widthClass = fillSlot
    ? "w-full"
    : "snap-start shrink-0 w-[240px] sm:w-[340px] md:w-[355px]";

  return (
    <Link href={`/restaurant/${place.id}`} className={`${widthClass} group block`}>
      <div
        className={`${diningMediaClass()} rounded-xl sm:rounded-2xl overflow-hidden bg-[#F7F7F7] relative`}
      >
        {image ? (
          <img
            src={image}
            alt={place.name}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center type-card-caption text-[#9A9A9A] px-2 text-center">
            {place.name}
          </div>
        )}
        {showRating && (
          <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-0.5 bg-[#267E3E] text-white type-card-caption font-semibold px-2 py-0.5 rounded">
            {rating.toFixed(1)} <Star size={10} fill="currentColor" />
          </span>
        )}
      </div>
      <h3 className="mt-2.5 sm:mt-3 type-card-title font-semibold text-[#111111] line-clamp-1">
        {place.name}
      </h3>
      {locality && <p className="mt-1 type-card-body text-[#6B6B6B] line-clamp-1">{locality}</p>}
      {tags.length > 0 && (
        <p className="mt-0.5 type-card-caption text-[#9A9A9A] line-clamp-1">{tags.join(" · ")}</p>
      )}
    </Link>
  );
}
