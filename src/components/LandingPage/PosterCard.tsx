"use client";

import Link from "next/link";
import { Calendar } from "lucide-react";
import { Star } from "lucide-react";
import type { Business, PublicEvent } from "@/services/api";
import { normalizePriceRange } from "@/lib/currencyFormat";
import {
  eventPortrait,
  eventPlaceLine,
  formatEventDateLine,
  localityFromAddress,
} from "./homeUtils";

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
  const image = eventPortrait(event);
  const dateLine = formatEventDateLine(event.next_showtime);
  const placeLine = eventPlaceLine(event, city);
  const eventType = event.category_name?.trim();
  const widthClass = fullWidth
    ? "w-full"
    : "snap-start shrink-0 w-[180px] sm:w-[200px] md:w-[220px]";

  return (
    <Link
      href={`/events/${event.id}`}
      className={`${widthClass} group block bg-white rounded-2xl overflow-hidden transition-shadow ${className}`}
    >
      <div className="pb-0">
        <div className="rounded-t-[10px] overflow-hidden bg-white">
          <div className="relative aspect-[3/4]  overflow-hidden">
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
          <div className="bg-black text-white px-3 py-2.5 text-[12px] sm:text-[13px] font-medium rounded-b-[10px]">
            {dateLine}
          </div>
        )}
      </div>

      <div className="px-3 pt-3 pb-4">
        <h3 className="font-bold text-[#1a2744] text-[14px] sm:text-[15px] leading-snug line-clamp-2">
          {event.name}
        </h3>
        {placeLine && (
          <p className="mt-2 text-[12px] sm:text-[13px] text-[#6b7280] leading-snug line-clamp-2">{placeLine}</p>
        )}
        {eventType && (
          <p className="mt-1 text-[11px] sm:text-[12px] text-[#9ca3af] line-clamp-1">{eventType}</p>
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
  const dateLine = formatEventDateLine(showDate);
  const widthClass = fullWidth
    ? "w-full"
    : "snap-start shrink-0 w-[180px] sm:w-[200px] md:w-[220px]";

  return (
    <Link
      href={href}
      className={`${widthClass} group block bg-white rounded-xl overflow-hidden hover:shadow-md transition-shadow ${className}`}
    >
      <div className="pb-0">
        <div className="rounded-t-[10px] overflow-hidden bg-white">
          <div className="relative aspect-[3/4] bg-slate-100 overflow-hidden">
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
          <div className="bg-black text-white px-3 py-2.5 text-[12px] sm:text-[13px] font-medium rounded-b-[10px]">
            {dateLine}
          </div>
        )}
      </div>

      <div className="px-3 pt-3 pb-4 bg-white">
        <h3 className="font-bold text-[#1a2744] text-[14px] sm:text-[15px] leading-snug line-clamp-2">
          {title}
        </h3>
        {place && (
          <p className="mt-2 text-[12px] sm:text-[13px] text-[#6b7280] leading-snug line-clamp-2">{place}</p>
        )}
        {eventType && (
          <p className="mt-1 text-[11px] sm:text-[12px] text-[#9ca3af] line-clamp-1">{eventType}</p>
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
  const image = place.cover_image_url || "";
  const rating = Number(place.rating);
  const showRating = Number.isFinite(rating) && rating > 0;
  const locality = localityFromAddress(place.address);
  const tags = [place.cuisine, place.type_name, normalizePriceRange(place.price_range)]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  return (
    <Link
      href={`/restaurant/${place.id}`}
      className="snap-start shrink-0 w-[240px] sm:w-[340px] md:w-[355px] group"
    >
      <div className="aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden bg-[#F7F7F7] relative">
        {image ? (
          <img
            src={image}
            alt={place.name}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-[#9A9A9A] px-2 text-center">
            {place.name}
          </div>
        )}
        {showRating && (
          <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-0.5 bg-[#267E3E] text-white text-xs font-semibold px-2 py-0.5 rounded">
            {rating.toFixed(1)} <Star size={10} fill="currentColor" />
          </span>
        )}
      </div>
      <h3 className="mt-2.5 sm:mt-3 text-sm sm:text-base font-semibold text-[#111111] line-clamp-1">
        {place.name}
      </h3>
      {locality && <p className="mt-1 text-xs sm:text-sm text-[#6B6B6B] line-clamp-1">{locality}</p>}
      {tags.length > 0 && (
        <p className="mt-0.5 text-xs sm:text-sm text-[#9A9A9A] line-clamp-1">{tags.join(" · ")}</p>
      )}
    </Link>
  );
}
