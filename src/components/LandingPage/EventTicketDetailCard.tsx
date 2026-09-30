"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Calendar, MapPin } from "lucide-react";
import type { PublicEvent } from "@/services/api";
import { useGetPublicEventQuery } from "@/services/api";
import { formatMoney } from "@/lib/currencyFormat";
import {
  eventDateParts,
  eventLandscape,
  eventPlaceLine,
  eventPortrait,
  venueFromEventDetail,
} from "./homeUtils";
import { useAdaptiveCard } from "./AdaptiveCardRow";
import EventLikeButton from "./EventLikeButton";

const cardShell =
  "bg-white border border-[#EAEAEA] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(17,17,17,0.06)] hover:shadow-[0_8px_24px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300";

const CARD_WIDTH = "snap-start shrink-0 w-[240px] sm:w-[260px] lg:w-[280px]";

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

/** "SAT, 18 OCT · 8:00 PM" */
export function eventTicketDateTimeLine(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const weekday = d.toLocaleString("en-GB", { weekday: "short" }).toUpperCase();
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-GB", { month: "short" }).toUpperCase();
  const time = d
    .toLocaleString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true })
    .toUpperCase()
    .replace(/\s+/g, " ");
  return `${weekday}, ${day} ${month} · ${time}`;
}

export function eventCategoryBadge(raw?: string) {
  if (!raw) return "";
  const first = raw.split(/[·|,/]/)[0]?.trim() || raw.trim();
  return first.toUpperCase();
}

export function eventFromPriceLabel(minPrice?: number | string | null) {
  if (minPrice == null || minPrice === "") return null;
  const n = Number(minPrice);
  if (Number.isNaN(n)) return null;
  if (n <= 0) return "Free";
  const amount = formatMoney(n, { compact: true }).replace(/\s*ETB\s*/i, "").trim();
  return `From ETB ${amount}`;
}

function showcasePriceFromId(id: string) {
  const hash = id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return [400, 450, 500, 550, 650, 750][hash % 6];
}

function DateBadge({ iso }: { iso?: string }) {
  const parts = eventDateParts(iso);
  if (!parts) return null;
  return (
    <div className="absolute top-3 left-3 z-[2] flex flex-col items-center rounded-xl bg-black/70 px-2.5 py-1.5 text-white backdrop-blur-[2px] shadow-sm min-w-[2.75rem]">
      <span className="text-[10px] font-semibold uppercase tracking-wider leading-none opacity-90">
        {parts.weekday.toUpperCase()}
      </span>
      <span className="text-lg font-bold tabular-nums leading-tight my-0.5">{parts.day}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider leading-none opacity-90">
        {parts.month}
      </span>
    </div>
  );
}

function TicketBody({
  title,
  dateTimeLine,
  venueLine,
  cityLine,
  priceLabel,
}: {
  title: string;
  dateTimeLine: string;
  venueLine: string;
  cityLine: string;
  priceLabel: string | null;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1.5 px-3.5 pt-3 pb-3.5 min-w-0">
      <h3 className="text-base tracking-wide sm:text-[1.05rem] font-bold text-[#1C1C1C] leading-snug line-clamp-2 min-h-[2.5rem]">
        {title}
      </h3>

      {dateTimeLine ? (
        <p className="inline-flex items-center gap-1.5 min-w-0 text-sm tracking-wide text-gray-600 leading-snug">
          <Calendar size={14} className="shrink-0 text-gray-500" strokeWidth={2} />
          <span className="truncate">{dateTimeLine}</span>
        </p>
      ) : null}

      {venueLine || cityLine ? (
        <p className="inline-flex items-start gap-1.5 min-w-0 text-sm tracking-wide text-gray-600 leading-snug">
          <MapPin size={14} className="shrink-0 text-gray-500 mt-0.5" strokeWidth={2} />
          <span className="min-w-0 line-clamp-2">
            {venueLine}
            {venueLine && cityLine ? (
              <>
                <br />
                {cityLine}
              </>
            ) : (
              cityLine
            )}
          </span>
        </p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 pt-2 min-w-0">
        <span className="text-sm font-bold text-[#1C1C1C] truncate">
          {priceLabel || "Get tickets"}
        </span>
        <span className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold tracking-wide text-[#1C1C1C] whitespace-nowrap">
          Get Tickets
          <ArrowRight size={14} strokeWidth={2.25} />
        </span>
      </div>
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
  dateTimeLine: string;
  venueLine: string;
  cityLine: string;
  priceLabel: string | null;
  className?: string;
};

function TicketCardShell({
  href,
  image,
  title,
  iso,
  category,
  likeId,
  dateTimeLine,
  venueLine,
  cityLine,
  priceLabel,
  className = "",
}: ShellProps) {
  const adaptive = useAdaptiveCard();
  const widthClass = adaptive ? "w-full" : CARD_WIDTH;
  const badge = eventCategoryBadge(category);

  return (
    <Link href={href} className={`${widthClass} group block min-w-0 h-full ${cardShell} ${className}`}>
      <article className="flex h-full flex-col">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F3F4F6]">
          <CoverImage
            src={image}
            alt={title}
            fallback={<Calendar size={32} strokeWidth={1.4} />}
          />
          <DateBadge iso={iso} />
          <EventLikeButton eventId={likeId} />
          {badge ? (
            <span className="absolute bottom-3 left-3 z-[2] inline-flex max-w-[75%] items-center rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-[2px]">
              {badge}
            </span>
          ) : null}
        </div>
        <TicketBody
          title={title}
          dateTimeLine={dateTimeLine}
          venueLine={venueLine}
          cityLine={cityLine}
          priceLabel={priceLabel}
        />
      </article>
    </Link>
  );
}

/** Ticket-style event card: date badge, like, category, meta, From ETB + Get Tickets. */
export function EventTicketDetailCard({
  event,
  city,
  className = "",
}: {
  event: PublicEvent;
  city?: string;
  className?: string;
}) {
  const image = eventLandscape(event) || eventPortrait(event);
  const needsVenueLookup = !event.venue_name?.trim();
  const { data: detail } = useGetPublicEventQuery(event.id, { skip: !needsVenueLookup });
  const fromDetail = venueFromEventDetail(needsVenueLookup ? detail : null);

  const venue =
    event.venue_name?.trim() || fromDetail.venue_name || "";
  const cityName =
    event.city_name?.trim() ||
    fromDetail.city_name ||
    (city && city !== "All Cities" && city !== "Ethiopia" ? city.trim() : "");

  // Prefer split venue / city; fall back to combined place line when only one exists
  let venueLine = venue;
  let cityLine = cityName && venue && venue.toLowerCase() !== cityName.toLowerCase() ? cityName : "";
  if (!venueLine && !cityLine) {
    const place = eventPlaceLine(event, city);
    venueLine = place;
  }

  return (
    <TicketCardShell
      href={`/events/${event.id}`}
      image={image}
      title={event.name}
      iso={event.next_showtime}
      category={event.category_name}
      likeId={String(event.id)}
      dateTimeLine={eventTicketDateTimeLine(event.next_showtime)}
      venueLine={venueLine}
      cityLine={cityLine}
      priceLabel={eventFromPriceLabel(event.min_price)}
      className={className}
    />
  );
}

/** Static showcase variant of the ticket-style event card. */
export function ShowcaseEventTicketDetailCard({
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
  const placeParts = (place || "").split(":").map((p) => p.trim()).filter(Boolean);
  const venueLine = placeParts[0] || place || "";
  const cityLine = placeParts.length > 1 ? placeParts.slice(1).join(": ") : "";
  const price = minPrice ?? showcasePriceFromId(id);

  return (
    <TicketCardShell
      href={href}
      image={image}
      title={title}
      iso={showDate}
      category={eventType}
      likeId={id}
      dateTimeLine={eventTicketDateTimeLine(showDate)}
      venueLine={venueLine}
      cityLine={cityLine}
      priceLabel={eventFromPriceLabel(price)}
      className={className}
    />
  );
}
