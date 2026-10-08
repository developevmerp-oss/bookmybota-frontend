"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { PublicEvent } from "@/services/api";
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
      <div className="relative aspect-[3/4] w-full shrink-0 overflow-hidden bg-slate-100">
        <SafeCoverImage
          src={portrait}
          alt={event.name}
          className={`absolute inset-0 h-full w-full object-cover ${
            disabled ? "grayscale" : "transition-transform duration-300 group-hover:scale-[1.02]"
          }`}
          fallbackClassName="absolute inset-0 flex h-full w-full items-center justify-center bg-[#F3F4F6] text-slate-300"
          fallback={<EventImageFallback size={28} />}
        />
        {disabled ? (
          <span className="absolute inset-0 bg-white/45" aria-hidden />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col space-y-1 px-2.5 py-2.5 sm:px-3 sm:py-3 lg:min-h-[8.25rem]">
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
          className={`text-sm font-bold leading-snug line-clamp-2 sm:text-base lg:min-h-[3rem] ${
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
            className={`text-xs font-medium line-clamp-1 sm:text-sm ${
              disabled ? "text-[#6B6B6B]/45" : "text-[#6B6B6B]"
            }`}
          >
            {price}
          </p>
        ) : null}
        {disabled ? (
          <p className="text-xs font-bold uppercase tracking-wide text-[#9CA3AF]">Past event</p>
        ) : null}
      </div>
    </>
  );

  const cardClass =
    "flex h-full min-w-0 w-full flex-col overflow-hidden rounded-xl border border-[#E5E5E5] bg-white sm:rounded-2xl";

  if (disabled) {
    return (
      <div
        className={`${cardClass} opacity-70 pointer-events-none select-none`}
        aria-disabled
      >
        {body}
      </div>
    );
  }

  return (
    <Link href={`/events/${event.id}`} className={`group ${cardClass}`}>
      {body}
    </Link>
  );
}

const eventsGridClass =
  "mt-4 grid grid-cols-2 gap-3 sm:mt-5 sm:gap-4 md:grid-cols-3 lg:grid-cols-3 lg:gap-5";

const PREVIEW_COUNT = 3;

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

      <h2 className="text-xl font-bold tracking-tight text-[#111111] sm:text-2xl">See all events</h2>

      {live.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-wide text-[#6900AA] mb-3">
            Live events
          </p>
          <div className={eventsGridClass}>
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
          <div className={eventsGridClass}>
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

/** Preview: 2 cards on mobile, 3 on md+; "See more" when more than visible. */
export default function PartnerLiveEventsSection({
  items,
  coverSrc: _coverSrc,
  onSeeMore,
}: {
  items: PartnerEventWithMeta[];
  /** Kept for callers; overlay See more card removed. */
  coverSrc: string;
  onSeeMore: () => void;
}) {
  const { live, past } = useMemo(() => splitLiveAndPast(items), [items]);

  if (live.length === 0 && past.length === 0) return null;

  const previewLive = live.slice(0, PREVIEW_COUNT);
  const previewPast = past.slice(0, PREVIEW_COUNT);
  /** Mobile: >2; tablet/desktop: >3 */
  const showLiveSeeMore = live.length > 2;
  const showPastSeeMore = past.length > 2;
  const seeMoreOnlyMobile = (count: number) =>
    count > PREVIEW_COUNT ? "" : "md:hidden";

  return (
    <div className="space-y-8 sm:space-y-10">
      {live.length > 0 ? (
        <section>
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-xl font-bold tracking-tight text-[#111111] sm:text-2xl">
              Live Events
            </h2>
            {showLiveSeeMore ? (
              <button
                type="button"
                onClick={onSeeMore}
                className={`shrink-0 text-sm font-bold text-[#6900AA] cursor-pointer hover:underline pb-0.5 ${seeMoreOnlyMobile(live.length)}`}
              >
                See more
              </button>
            ) : null}
          </div>
          <div className={eventsGridClass}>
            {previewLive.map((event, index) => (
              <div
                key={event.id}
                className={`min-w-0 h-full ${index >= 2 ? "hidden md:block" : ""}`}
              >
                <EventPosterCard event={event} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {past.length > 0 ? (
        <section>
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-xl font-bold tracking-tight text-[#111111] sm:text-2xl">
              Past Events
            </h2>
            {showPastSeeMore ? (
              <button
                type="button"
                onClick={onSeeMore}
                className={`shrink-0 text-sm font-bold text-[#6900AA] cursor-pointer hover:underline pb-0.5 ${seeMoreOnlyMobile(past.length)}`}
              >
                See more
              </button>
            ) : null}
          </div>
          <div className={eventsGridClass}>
            {previewPast.map((event, index) => (
              <div
                key={event.id}
                className={`min-w-0 h-full ${index >= 2 ? "hidden md:block" : ""}`}
              >
                <EventPosterCard event={event} disabled />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
