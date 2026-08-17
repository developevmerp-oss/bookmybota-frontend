"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import type { Business, PublicEvent } from "@/services/api";
import { formatMoney, normalizePriceRange } from "@/lib/currencyFormat";
import { eventPortrait, formatShowDate, formatShowDateBar, localityFromAddress } from "./homeUtils";

export function EventPosterCard({
  event,
  dark = false,
}: {
  event: PublicEvent;
  dark?: boolean;
}) {
  const image = eventPortrait(event);
  const meta = [event.language, event.category_name].filter(Boolean).join(" · ");
  const date = formatShowDate(event.next_showtime);

  return (
    <Link
      href={`/events/${event.id}`}
      className="snap-start shrink-0 w-[180px] sm:w-[200px] group"
    >
      <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[#F7F7F7] border border-[#EDEDED]">
        {image ? (
          <img
            src={image}
            alt={event.name}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-[#9A9A9A]">
            No poster
          </div>
        )}
      </div>
      <h3
        className={`mt-2.5 text-sm font-semibold line-clamp-2 leading-snug ${
          dark ? "text-white" : "text-[#111111]"
        }`}
      >
        {event.name}
      </h3>
      {meta && <p className="mt-1 text-xs text-[#6B6B6B] line-clamp-1">{meta}</p>}
      {date && <p className="mt-0.5 text-xs text-[#6B6B6B]">{date}</p>}
      {event.min_price != null && event.min_price !== "" && (
        <p className={`mt-1 text-xs font-medium ${dark ? "text-[#E0D7FF]" : "text-[#111111]"}`}>
          From {formatMoney(event.min_price, { compact: true })}
        </p>
      )}
    </Link>
  );
}

export function MusicEventCard({ event, city }: { event: PublicEvent; city?: string }) {
  const image = eventPortrait(event);
  const date = formatShowDateBar(event.next_showtime);
  const venue = [event.organizer_name, city && city !== "All Cities" ? city : ""]
    .filter(Boolean)
    .join(": ");

  return (
    <Link href={`/events/${event.id}`} className="snap-start shrink-0 w-[200px] sm:w-[220px] group">
      <div className="rounded-t-xl overflow-hidden bg-[#F7F7F7] relative aspect-[3/4]">
        {image ? (
          <img
            src={image}
            alt={event.name}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-[#9A9A9A]">
            No poster
          </div>
        )}
        {date && (
          <div className="absolute bottom-0 left-0 right-0 bg-black text-white text-[11px] font-medium px-2 py-1">
            {date}
          </div>
        )}
      </div>
      <div className="bg-[#F7F7F7] rounded-b-xl px-2.5 py-2.5 min-h-[88px]">
        <h3 className="text-sm font-bold text-[#111111] line-clamp-2 leading-snug">{event.name}</h3>
        {venue && <p className="mt-1 text-xs text-[#6B6B6B] line-clamp-1">{venue}</p>}
        <p className="mt-0.5 text-xs text-[#6B6B6B]">{event.category_name || "Concerts"}</p>
      </div>
    </Link>
  );
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
    <Link href={`/restaurant/${place.id}`} className="snap-start shrink-0 w-[260px] sm:w-[280px] md:w-[300px] group">
      <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-[#F7F7F7] relative">
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
      <h3 className="mt-3 text-base font-semibold text-[#111111] line-clamp-1">{place.name}</h3>
      {locality && <p className="mt-1 text-sm text-[#6B6B6B] line-clamp-1">{locality}</p>}
      {tags.length > 0 && (
        <p className="mt-0.5 text-sm text-[#9A9A9A] line-clamp-1">{tags.join(" · ")}</p>
      )}
    </Link>
  );
}
