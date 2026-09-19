"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { PublicEvent } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import SafeCoverImage, {
  EventImageFallback,
} from "@/components/Shared/SafeCoverImage";
import {
  eventPlaceLine,
  eventPortrait,
  formatEventDateLine,
} from "@/components/LandingPage/homeUtils";
import { formatMoney } from "@/lib/currencyFormat";
import {
  splitLiveAndPast,
  type PartnerEventWithMeta,
} from "@/lib/partnerEventHistory";

export type { PartnerEventWithMeta } from "@/lib/partnerEventHistory";
export {
  isPublicEventLive,
  isEventLiveFromDetail,
  splitLiveAndPast,
} from "@/lib/partnerEventHistory";

function priceOnwards(event: PublicEvent) {
  if (event.min_price == null || event.min_price === "") return null;
  const n = Number(event.min_price);
  if (Number.isNaN(n)) return null;
  if (n <= 0) return "Free";
  return `${formatMoney(n, { compact: true })} onwards`;
}

function EventPosterCard({
  event,
  disabled = false,
}: {
  event: PublicEvent;
  disabled?: boolean;
}) {
  const portrait = eventPortrait(event);
  const place = eventPlaceLine(event);
  const dateLine = formatEventDateLine(event.next_showtime);
  const price = priceOnwards(event);

  const body = (
    <>
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-100">
        <SafeCoverImage
          src={portrait}
          alt={event.name}
          className={`absolute inset-0 h-full w-full object-cover ${
            disabled ? "grayscale" : "transition-transform duration-300 group-hover:scale-[1.02]"
          }`}
          fallbackClassName="absolute inset-0 flex h-full w-full items-center justify-center bg-[#F3F4F6] text-slate-300"
          fallback={<EventImageFallback size={32} />}
        />
        {disabled ? (
          <span className="absolute inset-0 bg-white/45" aria-hidden />
        ) : null}
      </div>
      <div className="space-y-1 px-3 py-3 sm:px-3.5 sm:py-3.5">
        {dateLine ? (
          <p
            className={`text-xs font-semibold sm:text-sm ${
              disabled ? "text-[#B59B2A]/50" : "text-[#B59B2A]"
            }`}
          >
            {dateLine}
          </p>
        ) : null}
        <h3
          className={`text-sm font-bold leading-snug line-clamp-2 sm:text-base ${
            disabled ? "text-black/45" : "text-black"
          }`}
        >
          {event.name}
        </h3>
        {place ? (
          <p
            className={`text-xs font-medium line-clamp-1 sm:text-sm ${
              disabled ? "text-[#6B6B6B]/45" : "text-[#6B6B6B]"
            }`}
          >
            {place}
          </p>
        ) : null}
        {price ? (
          <p
            className={`text-xs font-medium sm:text-sm ${
              disabled ? "text-[#6B6B6B]/45" : "text-[#6B6B6B]"
            }`}
          >
            {price}
          </p>
        ) : null}
        {disabled ? (
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">Past event</p>
        ) : null}
      </div>
    </>
  );

  if (disabled) {
    return (
      <div
        className="block min-w-0 w-full overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white opacity-70 pointer-events-none select-none"
        aria-disabled
      >
        {body}
      </div>
    );
  }

  return (
    <Link
      href={`/events/${event.id}`}
      className="group block min-w-0 w-full overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white"
    >
      {body}
    </Link>
  );
}

function SeeMoreCard({
  coverSrc,
  onClick,
}: {
  coverSrc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative block min-w-0 w-full overflow-hidden rounded-2xl border border-[#E5E5E5] bg-[#111111] cursor-pointer text-left"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        {coverSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-55 group-hover:opacity-45 transition-opacity"
            aria-hidden
          />
        ) : (
          <div className="absolute inset-0 bg-[#2a2a2a]" aria-hidden />
        )}
        <span className="absolute inset-0 bg-black/50" />
        <span className="absolute inset-0 flex items-center justify-center px-3 text-center text-white font-bold text-sm sm:text-base leading-snug">
          See more
        </span>
      </div>
    </button>
  );
}

/** Full live + past events list (used when profile body is swapped to All Events). */
export function PartnerAllEventsPanel({
  items,
  onBack,
}: {
  items: PartnerEventWithMeta[];
  onBack?: () => void;
}) {
  const { live, past } = useMemo(() => splitLiveAndPast(items), [items]);

  return (
    <section>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B1B3A]/80 hover:text-[#6900AA] cursor-pointer"
        >
          ← Back
        </button>
      ) : null}

      <h2 className="text-xl font-bold tracking-tight text-[#111111] sm:text-2xl">All Events</h2>

      {live.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-wide text-[#6900AA] mb-3">
            Live events
          </p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {live.map((event) => (
              <EventPosterCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      ) : null}

      {past.length > 0 ? (
        <div className={live.length > 0 ? "mt-8" : "mt-5"}>
          <p className="text-xs font-bold uppercase tracking-wide text-[#9CA3AF] mb-3">
            Past events
          </p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {past.map((event) => (
              <EventPosterCard key={event.id} event={event} disabled />
            ))}
          </div>
        </div>
      ) : null}

      {live.length === 0 && past.length === 0 ? (
        <p className="mt-4 text-sm text-[#6B6B6B]">No events to show.</p>
      ) : null}
    </section>
  );
}

/** Preview: up to 2 live (or past if none live) + See more card. */
export default function PartnerLiveEventsSection({
  items,
  coverSrc,
  onSeeMore,
}: {
  items: PartnerEventWithMeta[];
  coverSrc: string;
  onSeeMore: () => void;
}) {
  const { live, past } = useMemo(() => splitLiveAndPast(items), [items]);

  if (live.length === 0 && past.length === 0) return null;

  const previewLive = live.slice(0, 2);
  const previewPast = live.length === 0 ? past.slice(0, 2) : [];
  const seeMoreCover =
    resolveMediaUrl(
      (live[2] || past[0] || live[0])?.poster_vertical_url ||
        (live[2] || past[0] || live[0])?.poster_horizontal_url ||
        coverSrc
    ) || coverSrc;

  return (
    <section>
      <h2 className="text-xl font-bold tracking-tight text-[#111111] sm:text-2xl">
        Live Events
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        {previewLive.map((event) => (
          <EventPosterCard key={event.id} event={event} />
        ))}
        {previewPast.map((event) => (
          <EventPosterCard key={event.id} event={event} disabled />
        ))}
        <SeeMoreCard coverSrc={seeMoreCover} onClick={onSeeMore} />
      </div>
    </section>
  );
}
