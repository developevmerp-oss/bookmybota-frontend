"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Calendar } from "lucide-react";
import type { PublicEvent } from "@/services/api";
import { useGetPublicEventQuery } from "@/services/api";
import {
  eventLandscape,
  eventPlaceLine,
  eventPortrait,
  venueFromEventDetail,
} from "./homeUtils";
import { useAdaptiveCard } from "./AdaptiveCardRow";
import { formatDateCustomer, formatTime12h } from "@/lib/dateFormat";
import {
  eventCategoryBadge,
  eventFromPriceLabel,
} from "./EventTicketDetailCard";

const cardShell =
  "bg-white border border-[#EAEAEA] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(17,17,17,0.06)] hover:shadow-[0_8px_24px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300";

const CARD_WIDTH = "snap-start shrink-0 w-[240px] sm:w-[260px] lg:w-[280px]";
const DATE_GOLD = "#B59B2A";

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

function showcasePriceFromId(id: string) {
  const hash = id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return [400, 450, 500, 550, 650, 750][hash % 6];
}

/** Split into gold date + black time for editorial meta line. */
export function eventEditorialDateParts(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const weekday = d.toLocaleString("en-GB", { weekday: "short" }).toUpperCase();
  const dateLabel = formatDateCustomer(iso);
  if (!dateLabel || dateLabel === "—") return null;
  const time = formatTime12h(iso).toUpperCase().replace(/\s+/g, " ");
  return {
    dateLabel: `${weekday}, ${dateLabel.toUpperCase()}`,
    timeLabel: time,
  };
}

/** Full category for longer badges like "LIVE PERFORMANCE". */
function editorialCategoryBadge(raw?: string) {
  if (!raw) return "";
  const cleaned = raw
    .replace(/[·|/]/g, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Prefer short single-word when short; keep multi-word when meaningful
  if (cleaned.length <= 18) return cleaned.toUpperCase();
  return eventCategoryBadge(raw);
}

type ShellProps = {
  href: string;
  image?: string;
  title: string;
  iso?: string;
  category?: string;
  venueLine: string;
  cityLine: string;
  priceLabel: string | null;
  className?: string;
};

function EditorialCardShell({
  href,
  image,
  title,
  iso,
  category,
  venueLine,
  cityLine,
  priceLabel,
  className = "",
}: ShellProps) {
  const adaptive = useAdaptiveCard();
  const widthClass = adaptive ? "w-full" : CARD_WIDTH;
  const badge = editorialCategoryBadge(category);
  const dateParts = eventEditorialDateParts(iso);

  return (
    <Link href={href} className={`${widthClass} group block min-w-0 h-full ${cardShell} ${className}`}>
      <article className="flex h-full flex-col">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F3F4F6]">
          <CoverImage
            src={image}
            alt={title}
            fallback={<Calendar size={32} strokeWidth={1.4} />}
          />
          {badge ? (
            <span className="absolute bottom-3 left-3 z-[2] inline-flex max-w-[85%] items-center rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-[2px]">
              {badge}
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col px-3.5 pt-3 pb-3.5 min-w-0">
          <h3 className="text-base tracking-wide sm:text-[1.05rem] font-bold text-[#1C1C1C] leading-snug line-clamp-2">
            {title}
          </h3>

          {dateParts ? (
            <p className="mt-1.5 text-sm tracking-wide leading-snug truncate">
              <span className="font-semibold" style={{ color: DATE_GOLD }}>
                {dateParts.dateLabel}
              </span>
              <span className="text-gray-400 mx-1.5">•</span>
              <span className="font-medium text-[#1C1C1C]">{dateParts.timeLabel}</span>
            </p>
          ) : null}

          {(venueLine || cityLine) && (
            <div className="mt-1.5 text-sm tracking-wide text-gray-500 leading-snug min-w-0">
              {venueLine ? <p className="truncate">{venueLine}</p> : null}
              {cityLine ? <p className="truncate">{cityLine}</p> : null}
            </div>
          )}

          {priceLabel ? (
            <p className="mt-auto pt-4 text-sm font-bold text-[#1C1C1C] truncate">{priceLabel}</p>
          ) : (
            <div className="mt-auto pt-4" />
          )}
        </div>
      </article>
    </Link>
  );
}

/** Clean editorial event card — category pill, gold date, venue/city, From ETB. */
export function EventEditorialCard({
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

  const venue = event.venue_name?.trim() || fromDetail.venue_name || "";
  const cityName =
    event.city_name?.trim() ||
    fromDetail.city_name ||
    (city && city !== "All Cities" && city !== "Ethiopia" ? city.trim() : "");

  let venueLine = venue;
  let cityLine =
    cityName && venue && venue.toLowerCase() !== cityName.toLowerCase() ? cityName : "";
  if (!venueLine && !cityLine) {
    const place = eventPlaceLine(event, city);
    venueLine = place;
  }

  return (
    <EditorialCardShell
      href={`/events/${event.id}`}
      image={image}
      title={event.name}
      iso={event.next_showtime}
      category={event.category_name}
      venueLine={venueLine}
      cityLine={cityLine}
      priceLabel={eventFromPriceLabel(event.min_price)}
      className={className}
    />
  );
}

/** Static showcase variant of the editorial event card. */
export function ShowcaseEventEditorialCard({
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
    <EditorialCardShell
      href={href}
      image={image}
      title={title}
      iso={showDate}
      category={eventType}
      venueLine={venueLine}
      cityLine={cityLine}
      priceLabel={eventFromPriceLabel(price)}
      className={className}
    />
  );
}
