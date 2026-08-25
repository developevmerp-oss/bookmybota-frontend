"use client";

import Link from "next/link";
import { Calendar, Star } from "lucide-react";
import type { Business, PublicEvent } from "@/services/api";
import { useGetPublicEventQuery } from "@/services/api";
import { normalizePriceRange } from "@/lib/currencyFormat";
import {
  eventPortrait,
  eventLandscape,
  eventPlaceLine,
  eventDateParts,
  localityFromAddress,
  venueFromEventDetail,
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

const cardShell =
  "bg-white border border-[#EAEAEA] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(17,17,17,0.06)] hover:shadow-[0_8px_24px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300";

function DateBadge({ iso }: { iso?: string }) {
  const parts = eventDateParts(iso);
  if (!parts) return null;
  return (
    <div className="absolute top-2.5 left-2.5 z-10 min-w-[3.15rem] rounded-xl bg-white shadow-[0_4px_14px_rgba(17,17,17,0.18)] overflow-hidden text-center leading-none">
      <div className="bg-[#6900AA] px-2 py-1 text-[0.625rem] font-bold tracking-wider text-white">
        {parts.month}
      </div>
      <div className="px-2 pt-1.5 pb-1.5">
        <div className="text-[1.125rem] font-extrabold text-[#111827]">{parts.day}</div>
        <div className="mt-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-[#6b7280]">
          {parts.weekday}
        </div>
      </div>
    </div>
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
  const horizontal = Boolean(adaptive?.horizontal);
  const image = horizontal ? eventLandscape(event) : eventPortrait(event);
  const eventType = event.category_name?.trim();
  const fillSlot = Boolean(adaptive) || fullWidth;
  const fluid = Boolean(adaptive?.fluid);
  const columns = adaptive?.columns ?? 0;
  const widthClass = fillSlot
    ? "w-full"
    : "snap-start shrink-0 w-[180px] sm:w-[200px] md:w-[220px]";

  // List API may omit venue — resolve from next showtime on public detail.
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

  return (
    <Link
      href={`/events/${event.id}`}
      className={`${widthClass} group block h-full ${cardShell} ${className}`}
    >
      <div className={`relative ${posterMediaClass(fluid, horizontal, columns)} overflow-hidden bg-[#F3F4F6]`}>
        {image ? (
          <img
            src={image}
            alt={event.name}
            className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Calendar size={28} strokeWidth={1.5} />
          </div>
        )}
        <DateBadge iso={event.next_showtime} />
      </div>

      <div className="px-3.5 pt-3.5 pb-4 flex flex-col gap-1">
        <h3 className="font-bold text-[#111827] type-card-title leading-snug line-clamp-2 group-hover:text-[#6900AA] transition-colors">
          {event.name}
        </h3>
        {placeLine ? (
          <p className="type-card-body text-[#6b7280] leading-snug line-clamp-2">
            {placeLine}
          </p>
        ) : null}
        {eventType ? (
          <p className="mt-0.5 type-card-caption text-[#6900AA]/80 font-medium line-clamp-1">
            {eventType}
          </p>
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
  const fluid = Boolean(adaptive?.fluid);
  const horizontal = Boolean(adaptive?.horizontal);
  const columns = adaptive?.columns ?? 0;
  const widthClass = fillSlot
    ? "w-full"
    : "snap-start shrink-0 w-[180px] sm:w-[200px] md:w-[220px]";

  return (
    <Link
      href={href}
      className={`${widthClass} group block h-full ${cardShell} ${className}`}
    >
      <div className={`relative ${posterMediaClass(fluid, horizontal, columns)} overflow-hidden bg-[#F3F4F6]`}>
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500 ease-out"
          loading="lazy"
          draggable={false}
        />
        <DateBadge iso={showDate} />
      </div>

      <div className="px-3.5 pt-3.5 pb-4 flex flex-col gap-1">
        <h3 className="font-bold text-[#111827] type-card-title leading-snug line-clamp-2 group-hover:text-[#6900AA] transition-colors">
          {title}
        </h3>
        {place && (
          <p className="type-card-body text-[#6b7280] leading-snug line-clamp-2">
            {place}
          </p>
        )}
        {eventType && (
          <p className="mt-0.5 type-card-caption text-[#6900AA]/80 font-medium line-clamp-1">
            {eventType}
          </p>
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
    <Link href={`/restaurant/${place.id}`} className={`${widthClass} group block h-full ${cardShell}`}>
      <div className={`${diningMediaClass()} overflow-hidden bg-[#F7F7F7] relative`}>
        {image ? (
          <img
            src={image}
            alt={place.name}
            className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center type-card-caption text-[#9A9A9A] px-2 text-center">
            {place.name}
          </div>
        )}
        {showRating && (
          <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 bg-[#267E3E] text-white type-card-caption font-semibold px-2 py-1 rounded-md shadow-sm">
            {rating.toFixed(1)} <Star size={11} fill="currentColor" />
          </span>
        )}
      </div>
      <div className="px-3.5 pt-3.5 pb-4 flex flex-col gap-1">
        <h3 className="type-card-title font-bold text-[#111827] line-clamp-1 group-hover:text-[#6900AA] transition-colors">
          {place.name}
        </h3>
        {locality && (
          <p className="type-card-body text-[#6B6B6B] line-clamp-1">{locality}</p>
        )}
        {tags.length > 0 && (
          <p className="type-card-caption text-[#9A9A9A] line-clamp-1">{tags.join(" · ")}</p>
        )}
      </div>
    </Link>
  );
}
