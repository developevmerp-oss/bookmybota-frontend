"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Building2, Calendar, MapPin, Star, Utensils } from "lucide-react";
import type { Business, PublicEvent, PublicRegisteredPartner } from "@/services/api";
import { useGetPublicEventQuery } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { restaurantHref, venueHref } from "@/lib/businessPublicPath";
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
  "bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden";

const cardShell =
  "bg-white border border-[#EAEAEA] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(17,17,17,0.06)] hover:shadow-[0_8px_24px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300";

/** Same hover as landing movie cards (lift + shadow); size stays put. */
const diningCardShell =
  "rounded-2xl border-0 bg-transparent shadow-none p-2 " +
  "hover:shadow-[0_8px_24px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 " +
  "transition-[box-shadow,transform] duration-300";

/** Title + rating + address only. */
const diningCardBody = "pt-2.5 pb-1 flex flex-col gap-1 min-w-0";
const diningCardWidth =
  "snap-start shrink-0 w-[260px] sm:w-[280px] lg:w-[320px]";

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
        />
        {event.is_promoted ? (
          <span className="absolute top-2 right-2 z-[2] rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#6900AA] shadow-sm">
            Promoted
          </span>
        ) : null}
      </div>
      <div className="space-y-1 px-3.5 py-3 sm:px-4 sm:py-3.5">
        {dateLine ? (
          <p className="text-sm font-semibold text-[#B59B2A]">{dateLine}</p>
        ) : null}
        <h3 className="text-base font-bold leading-snug text-black line-clamp-2 sm:text-lg">
          {event.name}
        </h3>
        {placeLine ? (
          <p className="text-sm font-medium text-[#6B6B6B] line-clamp-1">{placeLine}</p>
        ) : null}
        {eventType ? (
          <p className="text-sm font-medium text-[#6B6B6B] line-clamp-1">{eventType}</p>
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
        />
      </div>
      <div className="space-y-1 px-3.5 py-3 sm:px-4 sm:py-3.5">
        {dateLine ? (
          <p className="text-sm font-semibold text-[#B59B2A]">{dateLine}</p>
        ) : null}
        <h3 className="text-base font-bold leading-snug text-black line-clamp-2 sm:text-lg">
          {title}
        </h3>
        {place ? (
          <p className="text-sm font-medium text-[#6B6B6B] line-clamp-1">{place}</p>
        ) : null}
        {eventType ? (
          <p className="text-sm font-medium text-[#6B6B6B] line-clamp-1">{eventType}</p>
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
        <h3 className="font-bold text-[#111827] type-card-title leading-snug line-clamp-2 group-hover:text-[#6900AA] transition-colors">
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

export function DiningPosterCard({ place }: { place: Business }) {
  const adaptive = useAdaptiveCard();
  const image = resolveMediaUrl(place.cover_image_url) || "";
  const parsedRating = Number(place.rating);
  const rating =
    Number.isFinite(parsedRating) && parsedRating > 0 ? parsedRating : 4.2;
  const locality = localityFromAddress(place.address) || place.city_name?.trim() || "";
  const widthClass = adaptive ? "w-full" : diningCardWidth;

  return (
    <Link href={restaurantHref(place)} className={`${widthClass} group block ${diningCardShell}`}>
      <div className={`relative ${DINING_MEDIA} overflow-hidden bg-[#F7F7F7] rounded-2xl`}>
        <CoverImage
          src={image}
          alt={place.name}
          fallback={<Utensils size={28} strokeWidth={1.5} />}
          hoverScaleClass="group-hover:scale-[1.04]"
        />
      </div>
      <div className={diningCardBody}>
        <div className="flex items-center justify-between gap-4 min-w-0">
          <h3 className="text-base tracking-wide sm:text-lg font-bold text-[#1C1C1C] truncate min-w-0 flex-1 leading-snug  transition-colors">
            {place.name}
          </h3>
          <div className="shrink-0 inline-flex items-center gap-0.5 bg-[#24963F] text-white text-[11px] font-bold px-1.5 py-0.5 rounded">
            <span>{rating.toFixed(1)}</span>
            <span className="text-xs text-yellow-200">★</span>
          </div>
        </div>

        {locality ? (
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
  cuisine: _cuisine,
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
  const displayRating =
    Number.isFinite(parsedRating) && parsedRating > 0 ? parsedRating : 4.2;
  const widthClass = adaptive ? "w-full" : diningCardWidth;

  const body = (
    <>
      <div className={`relative ${DINING_MEDIA} overflow-hidden bg-[#F7F7F7] rounded-2xl`}>
        <CoverImage
          src={image}
          alt={name}
          fallback={<Utensils size={28} strokeWidth={1.5} />}
          hoverScaleClass="group-hover:scale-[1.04]"
        />
      </div>
      <div className={diningCardBody}>
        <div className="flex items-center justify-between gap-3 min-w-0">
          <h3 className="text-[15px] sm:text-base font-bold text-[#1C1C1C] truncate min-w-0 flex-1 leading-snug group-hover:text-[#6900AA] transition-colors">
            {name}
          </h3>
          <div className="shrink-0 inline-flex items-center gap-0.5 bg-[#24963F] text-white text-[11px] font-bold px-1.5 py-0.5 rounded">
            <span>{displayRating.toFixed(1)}</span>
            <span className="text-[9px]">★</span>
          </div>
        </div>

        {locality ? (
          <p className="text-[13px] text-[#696969] truncate leading-snug">{locality}</p>
        ) : null}
      </div>
    </>
  );

  if (!href) {
    return (
      <div className={`${widthClass} group block ${diningCardShell} ${className} select-none`}>
        {body}
      </div>
    );
  }

  return (
    <Link href={href} className={`${widthClass} group block ${diningCardShell} ${className}`}>
      {body}
    </Link>
  );
}
