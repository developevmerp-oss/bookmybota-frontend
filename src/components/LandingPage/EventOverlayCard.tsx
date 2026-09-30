"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Calendar, Clock, MapPin } from "lucide-react";
import type { PublicEvent } from "@/services/api";
import { useGetPublicEventQuery } from "@/services/api";
import {
  eventDateParts,
  eventLandscape,
  eventPlaceLine,
  eventPortrait,
  venueFromEventDetail,
} from "./homeUtils";
import { useAdaptiveCard } from "./AdaptiveCardRow";
import EventLikeButton from "./EventLikeButton";
import { eventFromPriceLabel } from "./EventTicketDetailCard";

const cardShell =
  "bg-white border border-[#EAEAEA] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(17,17,17,0.06)] hover:shadow-[0_8px_24px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300";

const CARD_WIDTH = "snap-start shrink-0 w-[240px] sm:w-[260px] lg:w-[280px]";
const CTA_PURPLE = "#6900AA";

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
      className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.03]"
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

function overlayCategoryLabel(raw?: string) {
  if (!raw) return "";
  return raw
    .replace(/[·|/]/g, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function eventTimeOnly(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true })
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function showcasePriceFromId(id: string) {
  const hash = id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return [400, 450, 500, 550, 650, 750][hash % 6];
}

function OverlayDateBadge({ iso }: { iso?: string }) {
  const parts = eventDateParts(iso);
  if (!parts) return null;
  return (
    <div className="absolute bottom-3 left-3 z-[2] flex flex-col items-start text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.55)]">
      <span className="text-3xl sm:text-4xl font-bold tabular-nums leading-none tracking-tight">
        {parts.day}
      </span>
      <span className="mt-1 mb-0.5 block h-px w-8 bg-white/90" aria-hidden />
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] leading-none">
        {parts.month}
      </span>
    </div>
  );
}

type ShellProps = {
  href: string;
  image?: string;
  title: string;
  iso?: string;
  category?: string;
  likeId: string;
  placeLine: string;
  timeLine: string;
  priceLabel: string | null;
  className?: string;
};

function OverlayCardShell({
  href,
  image,
  title,
  iso,
  category,
  likeId,
  placeLine,
  timeLine,
  priceLabel,
  className = "",
}: ShellProps) {
  const adaptive = useAdaptiveCard();
  const widthClass = adaptive ? "w-full" : CARD_WIDTH;
  const categoryLabel = overlayCategoryLabel(category);

  return (
    <Link href={href} className={`${widthClass} group block min-w-0 h-full ${cardShell} ${className}`}>
      <article className="flex h-full flex-col">
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#F3F4F6]">
          <CoverImage
            src={image}
            alt={title}
            fallback={<Calendar size={32} strokeWidth={1.4} />}
          />
          {/* Soft bottom gradient so white date stays readable */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent"
            aria-hidden
          />
          {categoryLabel ? (
            <span className="absolute top-3 left-3 z-[2] max-w-[70%] text-[11px] font-semibold uppercase tracking-[0.12em] text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.65)] line-clamp-2">
              {categoryLabel}
            </span>
          ) : null}
          <EventLikeButton eventId={likeId} />
          <OverlayDateBadge iso={iso} />
        </div>

        <div className="flex flex-1 flex-col gap-1.5 px-3.5 pt-3 pb-3.5 min-w-0">
          <h3 className="text-base tracking-wide sm:text-[1.05rem] font-bold text-[#1C1C1C] leading-snug line-clamp-2 min-h-[2.5rem]">
            {title}
          </h3>

          {placeLine ? (
            <p className="inline-flex items-center gap-1.5 min-w-0 text-sm tracking-wide text-gray-600 leading-snug">
              <MapPin size={14} className="shrink-0 text-gray-500" strokeWidth={2} />
              <span className="truncate">{placeLine}</span>
            </p>
          ) : null}

          {timeLine ? (
            <p className="inline-flex items-center gap-1.5 min-w-0 text-sm tracking-wide text-gray-600 leading-snug">
              <Clock size={14} className="shrink-0 text-gray-500" strokeWidth={2} />
              <span className="truncate">{timeLine}</span>
            </p>
          ) : null}

          <div className="mt-auto flex items-center justify-between gap-2 pt-2 min-w-0">
            <span className="text-sm font-bold text-[#1C1C1C] truncate">
              {priceLabel || "Get tickets"}
            </span>
            <span
              className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold tracking-wide whitespace-nowrap"
              style={{ color: CTA_PURPLE }}
            >
              Get Tickets
              <ArrowRight size={14} strokeWidth={2.25} />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

/** Overlay-style event card: category + like on image, large date, clock time, purple CTA. */
export function EventOverlayCard({
  event,
  city,
  className = "",
}: {
  event: PublicEvent;
  city?: string;
  className?: string;
}) {
  const image = eventPortrait(event) || eventLandscape(event);
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
  ).replace(/:\s*/, ", ");

  return (
    <OverlayCardShell
      href={`/events/${event.id}`}
      image={image}
      title={event.name}
      iso={event.next_showtime}
      category={event.category_name}
      likeId={String(event.id)}
      placeLine={placeLine}
      timeLine={eventTimeOnly(event.next_showtime)}
      priceLabel={eventFromPriceLabel(event.min_price)}
      className={className}
    />
  );
}

/** Static showcase variant of the overlay event card. */
export function ShowcaseEventOverlayCard({
  id,
  title,
  image,
  showDate,
  place,
  eventType,
  href,
  minPrice,
  className = "",
}: {
  id: string;
  title: string;
  image: string;
  showDate?: string;
  place?: string;
  eventType?: string;
  href: string;
  minPrice?: number;
  className?: string;
}) {
  const placeLine = (place || "").replace(/:\s*/, ", ");
  const price = minPrice ?? showcasePriceFromId(id);

  return (
    <OverlayCardShell
      href={href}
      image={image}
      title={title}
      iso={showDate}
      category={eventType}
      likeId={id}
      placeLine={placeLine}
      timeLine={eventTimeOnly(showDate)}
      priceLabel={eventFromPriceLabel(price)}
      className={className}
    />
  );
}
