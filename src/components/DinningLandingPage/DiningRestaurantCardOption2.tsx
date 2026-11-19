"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  EqualApproximately,
  MapPin,
  Star,
  Utensils,
} from "lucide-react";
import type { Business } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { restaurantHref } from "@/lib/businessPublicPath";
import { formatMoney } from "@/lib/currencyFormat";
import { listingOfferBannerLabel } from "@/lib/diningOffers";
import { localityFromAddress } from "@/components/LandingPage/homeUtils";
import DiningWishlistButton from "@/components/DinningLandingPage/DiningWishlistButton";
import DiningDistanceLabel from "@/components/DinningLandingPage/DiningDistanceLabel";

/**
 * Offer ribbon: flush to left image edge, solid purple → fully transparent on the right
 * (matches dining offer reference). Desktop vertical card only.
 */
const OFFER_RIBBON_BG =
  "linear-gradient(90deg, #8B5CF6 0%, #8B5CF6 38%, rgba(139,92,246,0.55) 68%, rgba(139,92,246,0.18) 86%, rgba(139,92,246,0) 100%)";

const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

function OfferTagIcon({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className="block h-full w-full -rotate-[18deg]"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M21.41 11.58l-9-9A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 .59 1.42l9 9a2 2 0 0 0 2.82 0l7-7a2 2 0 0 0 0-2.84zM5.5 7A1.5 1.5 0 1 1 7 5.5 1.5 1.5 0 0 1 5.5 7z"
        />
      </svg>
    </span>
  );
}

function CoverMedia({
  src,
  alt,
  className = "absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-slate-300">
        <Utensils size={28} strokeWidth={1.5} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

function cuisineTagsList(place: Business | string | undefined): string[] {
  const raw =
    typeof place === "string"
      ? place
      : place?.cuisine || place?.type_name || "";
  if (Array.isArray(raw) && raw.length) {
    const list = raw
      .map(String)
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 3);
    return list.length ? list : ["Dining"];
  }
  const tags = String(raw)
    .split(/[,·•|/]/)
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 3);
  return tags.length ? tags : ["Dining"];
}

function cuisineLabel(place: Business | string | undefined): string {
  return cuisineTagsList(place).join(" • ");
}

function formatReviewCount(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    const label = k >= 10 ? Math.round(k).toString() : k.toFixed(1).replace(/\.0$/, "");
    return `${label}K reviews`;
  }
  return `${n} review${n === 1 ? "" : "s"}`;
}

function formatOpenTimeLabel(raw?: string | null): string | null {
  const t = (raw || "").trim().slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(t)) return null;
  const [hh, mm] = t.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const period = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${String(mm).padStart(2, "0")} ${period}`;
}

function addisWeekdayKey(): (typeof WEEKDAY_KEYS)[number] {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "Africa/Addis_Ababa",
  })
    .format(new Date())
    .toLowerCase();
  if ((WEEKDAY_KEYS as readonly string[]).includes(weekday)) {
    return weekday as (typeof WEEKDAY_KEYS)[number];
  }
  const jsDay = new Date().getDay();
  return WEEKDAY_KEYS[jsDay === 0 ? 6 : jsDay - 1];
}

function addisNowHHMM(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Addis_Ababa",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`;
}

function isWithinOpenWindow(now: string, open: string, close: string): boolean {
  if (close > open) return now >= open && now <= close;
  // Overnight window (e.g. 18:00–02:00)
  return now >= open || now <= close;
}

type ClosedStatus =
  | { type: "closed_today" }
  | { type: "closed_opens"; opensAt: string }
  | { type: "closed" };

type TodayHours = {
  closed: boolean;
  open: string;
  close: string;
};

/**
 * Prefer today's business_operating_dates calendar (what detail/booking use).
 * Fall back to weekly operating_hours JSON when calendar row is missing.
 */
function resolveTodayHours(place: Business): TodayHours | null {
  if (place.today_is_open === false) {
    return { closed: true, open: "", close: "" };
  }

  const calOpen = (place.today_open_time || "").trim().slice(0, 5);
  const calClose = (place.today_close_time || "").trim().slice(0, 5);
  if (
    place.today_is_open === true &&
    /^\d{2}:\d{2}$/.test(calOpen) &&
    /^\d{2}:\d{2}$/.test(calClose)
  ) {
    return { closed: false, open: calOpen, close: calClose };
  }

  const weekly = place.operating_hours?.[addisWeekdayKey()];
  if (!weekly) return null;
  if (weekly.closed) return { closed: true, open: "", close: "" };
  const open = (weekly.open || "").trim().slice(0, 5);
  const close = (weekly.close || "").trim().slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(open) || !/^\d{2}:\d{2}$/.test(close)) return null;
  return { closed: false, open, close };
}

/** District-style closed status from today's calendar / weekly hours. */
function resolveClosedStatus(place: Business): ClosedStatus | null {
  const today = resolveTodayHours(place);
  if (today?.closed) return { type: "closed_today" };

  const open = today?.open || "";
  const close = today?.close || "";
  const hasHours = /^\d{2}:\d{2}$/.test(open) && /^\d{2}:\d{2}$/.test(close);

  if (hasHours) {
    const now = addisNowHHMM();
    if (isWithinOpenWindow(now, open, close)) return null;

    // Before today's open (same-day hours) → show opens-at
    if (close > open && now < open) {
      const opensAt = formatOpenTimeLabel(open);
      return opensAt ? { type: "closed_opens", opensAt } : { type: "closed" };
    }
    // Overnight closed gap, or after closing → still advertise tonight/today's open when useful
    if (close <= open) {
      const opensAt = formatOpenTimeLabel(open);
      return opensAt ? { type: "closed_opens", opensAt } : { type: "closed" };
    }
    return { type: "closed" };
  }

  if (place.is_open === false) return { type: "closed" };
  return null;
}

function hmToMinutes(hm: string): number {
  const [h, m] = hm.slice(0, 5).split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function minutesToHm(total: number): string {
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(
    wrapped % 60
  ).padStart(2, "0")}`;
}

function slotIntervalMinutes(place: Business): number {
  const n = Number(place.slot_interval_minutes);
  return n === 15 || n === 60 ? n : 30;
}

/**
 * Next bookable HH:mm today from calendar/weekly open + slot interval
 * (same grid rules as booking available-slots: future-only, ≥45m before close).
 */
function nextBookableSlotToday(place: Business): string | null {
  const today = resolveTodayHours(place);
  if (!today || today.closed) return null;

  const open = today.open;
  const close = today.close;
  if (!/^\d{2}:\d{2}$/.test(open) || !/^\d{2}:\d{2}$/.test(close)) return null;

  const step = slotIntervalMinutes(place);
  const nowMins = hmToMinutes(addisNowHHMM());
  const openVal = hmToMinutes(open);
  const closeVal = hmToMinutes(close);
  const MIN_DINING_MINUTES = 45;

  const trySlot = (mins: number, mealCloseVal: number) => {
    if (mins + MIN_DINING_MINUTES > mealCloseVal) return null;
    // Strictly after now (matches available-slots for today)
    if (mins <= nowMins) return null;
    return minutesToHm(mins);
  };

  if (closeVal >= openVal) {
    for (let mins = openVal; mins <= closeVal; mins += step) {
      const slot = trySlot(mins, closeVal);
      if (slot) return slot;
    }
    return null;
  }

  // Overnight hours (e.g. 18:00–02:00): afternoon/evening first, then post-midnight
  for (let mins = openVal; mins < 24 * 60; mins += step) {
    if (mins <= nowMins) continue;
    return minutesToHm(mins);
  }
  // Post-midnight portion is "tomorrow" on the calendar — listing footer is "today" only
  return null;
}

/** Footer copy when restaurant is currently open. */
function bookingsAvailableFooterLabel(place: Business): string {
  const next = nextBookableSlotToday(place);
  const label = next ? formatOpenTimeLabel(next) : null;
  return label
    ? `Bookings available from ${label}, today`
    : "Bookings available";
}

/** Renders `2.4 km • ` only when distance resolves (avoids empty bullet). */
function MobileDistancePrefix({
  latitude,
  longitude,
  placeCity,
}: {
  latitude?: number | string | null;
  longitude?: number | string | null;
  placeCity?: string | null;
}) {
  return (
    <DiningDistanceLabel
      latitude={latitude}
      longitude={longitude}
      placeCity={placeCity}
      suffix=" • "
      className="text-[0.75rem] text-slate-500"
    />
  );
}

export type DiningRestaurantCardOption2Props = {
  place: Business;
  className?: string;
  /** Dining listing: show promoted chip. Landing rails: hide. */
  showPromoted?: boolean;
  /** Dining listing: show offer bar. Landing rails: hide. */
  showOffer?: boolean;
  /**
   * Landing rails (1 + 75% peek): slightly tighter type; hide review counts on phone.
   * Also forces desktop/vertical card chrome (no District mobile row).
   */
  railCompact?: boolean;
};

/**
 * Dining restaurant card — listing + landing shared UI.
 * Mobile listing: District-style horizontal row. Desktop / rails: vertical card.
 * Landing passes showPromoted={false} showOffer={false}.
 */
export default function DiningRestaurantCardOption2({
  place,
  className = "",
  showPromoted = true,
  showOffer = true,
  railCompact = false,
}: DiningRestaurantCardOption2Props) {
  const cover = resolveMediaUrl(place.cover_image_url) || "";
  const offerLabel = showOffer ? listingOfferBannerLabel(place.dining_offers) : null;
  const isPromoted = showPromoted && Boolean(place.is_promoted);

  const parsedRating = Number(place.rating);
  const reviewsCount = Number(place.reviews_count) || 0;
  const hasRating =
    reviewsCount > 0 && Number.isFinite(parsedRating) && parsedRating > 0;
  const rating = hasRating ? parsedRating : null;

  const locality = localityFromAddress(place.address) || "";
  const city = place.city_name?.trim() || "";
  const addressLine =
    place.address?.trim() ||
    [locality, city]
      .filter(Boolean)
      .filter((v, i, arr) => arr.findIndex((x) => x?.toLowerCase() === v?.toLowerCase()) === i)
      .join(", ") ||
    "Addis Ababa";
  const placeLine = [locality, city].filter(Boolean).join(", ") || addressLine;

  const idHash =
    typeof place.id === "number"
      ? place.id
      : place.id
        ? String(place.id)
            .split("")
            .reduce((acc, char) => acc + char.charCodeAt(0), 0)
        : 0;
  const costNum = Number(place.average_cost);
  const hasCost = Number.isFinite(costNum) && costNum > 0;
  const priceForTwo = `${
    hasCost
      ? formatMoney(costNum, { compact: true })
      : formatMoney([1200, 1500, 2000, 2400, 1800][idHash % 5], { compact: true })
  } for 2`;
  const cuisines = cuisineTagsList(place);
  const cuisineInline = cuisineLabel(place);
  const closedStatus = resolveClosedStatus(place);
  // District: open cards + "Opens soon" both show bookings footer; closed-today does not
  const bookingsFooter =
    closedStatus == null
      ? bookingsAvailableFooterLabel(place)
      : closedStatus.type === "closed_opens"
        ? `Bookings available from ${closedStatus.opensAt}, today`
        : null;
  const useMobileRow = !railCompact;

  return (
    <Link
      href={restaurantHref(place)}
      className={`group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white shadow-[0_2px_10px_rgba(17,17,17,0.06)] hover:shadow-[0_10px_28px_rgba(17,17,17,0.1)] transition-[box-shadow,transform] duration-300 ${
        useMobileRow ? "md:hover:-translate-y-0.5" : "hover:-translate-y-0.5"
      } ${className}`}
    >
      {/* ── Mobile listing: District horizontal card ── */}
      {useMobileRow ? (
        <div className="md:hidden flex flex-col w-full">
          <div className="flex gap-3 p-3">
            <div className="relative h-[7.25rem] w-[7.25rem] shrink-0 overflow-hidden rounded-xl bg-[#F3F4F6]">
              <CoverMedia
                src={cover}
                alt={place.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
              {hasRating && rating != null ? (
                <span className="absolute top-1.5 left-1.5 z-[1] inline-flex items-center gap-0.5 rounded-md bg-[#1F7A4C] px-1.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
                  {rating.toFixed(1)}
                  <span className="text-[9px] leading-none" aria-hidden>
                    ★
                  </span>
                </span>
              ) : (
                <span className="absolute top-1.5 left-1.5 z-[1] inline-flex items-center rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 shadow-sm">
                  New
                </span>
              )}
              {isPromoted ? (
                <span className="absolute bottom-1.5 right-1.5 z-[1] rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  Ad
                </span>
              ) : null}
            </div>

            <div className="min-w-0 flex-1 flex flex-col gap-1 pt-0.5">
              <div className="flex items-start gap-2">
                <h3
                  className="min-w-0 flex-1 text-[0.9375rem] font-bold text-[#1A1A1A] leading-snug line-clamp-2"
                  title={place.name}
                >
                  {place.name}
                </h3>
                <DiningWishlistButton
                  businessId={String(place.id)}
                  icon="bookmark"
                  tone="neutral"
                  className="relative shrink-0 z-[2] -mr-1 flex h-8 w-8 items-center justify-center rounded-md text-[#292929] hover:bg-[#F3F4F6] transition-colors cursor-pointer disabled:opacity-70"
                />
              </div>

              <p className="truncate text-[0.75rem] text-slate-500 leading-snug">
                <MobileDistancePrefix
                  latitude={place.latitude}
                  longitude={place.longitude}
                  placeCity={city || locality}
                />
                {placeLine}
              </p>

              <p className="truncate text-[0.75rem] text-slate-500 leading-snug">
                {cuisineInline}
                <span className="text-slate-400" aria-hidden>
                  {" "}
                  •{" "}
                </span>
                {priceForTwo}
              </p>

              {closedStatus?.type === "closed_opens" ? (
                <p className="truncate text-[0.75rem] font-medium leading-snug text-[#1F7A4C]">
                  <span className="font-semibold">Opens soon</span>
                  <span className="font-medium text-[#1F7A4C]">{` • Opens at ${closedStatus.opensAt}`}</span>
                </p>
              ) : closedStatus?.type === "closed_today" ? (
                <p className="truncate text-[0.75rem] font-semibold leading-snug text-[#9A3412]">
                  Closed today
                </p>
              ) : closedStatus?.type === "closed" ? (
                <p className="truncate text-[0.75rem] font-semibold leading-snug text-[#9A3412]">
                  Closed
                </p>
              ) : null}

              {offerLabel ? (
                <span className="mt-0.5 inline-flex max-w-full items-center gap-1.5 self-start rounded-full bg-[#F3E8FF] px-2.5 py-[5px] text-[11px] font-semibold text-[#6D28D9]">
                  <OfferTagIcon className="h-3 w-3 text-[#7C3AED]" />
                  <span className="truncate leading-none">{offerLabel}</span>
                </span>
              ) : null}
            </div>
          </div>

          {bookingsFooter ? (
            <div className="flex items-center justify-between gap-2 border-t border-[#F0F0F0] px-3 py-2.5">
              <span className="min-w-0 truncate text-[0.8125rem] font-medium text-slate-600">
                {bookingsFooter}
              </span>
              <ChevronRight size={16} className="shrink-0 text-slate-400" strokeWidth={2.25} />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Desktop / rail: existing vertical card ── */}
      <div
        className={`flex h-full w-full flex-col ${
          useMobileRow ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="relative aspect-[5/4] w-full shrink-0 overflow-hidden bg-[#F3F4F6]">
          <CoverMedia src={cover} alt={place.name} />

          {isPromoted ? (
            <span className="absolute top-3 left-3 z-[1] pointer-events-none inline-flex items-center rounded-full bg-white/80 backdrop-blur-[2px] px-2.5 py-1 text-[11px] font-semibold text-slate-900 shadow-sm border border-white/60">
              Promoted
            </span>
          ) : null}

          <DiningWishlistButton
            businessId={String(place.id)}
            appearance="glass"
            icon="bookmark"
          />

          {offerLabel ? (
            <span
              className="absolute bottom-3.5 left-0 z-[1] pointer-events-none inline-flex max-w-[92%] items-center gap-2 pl-2.5 sm:pl-3 pr-12 sm:pr-14 py-[7px] sm:py-2 text-white text-xs sm:text-[13px] font-bold tracking-wide"
              style={{ background: OFFER_RIBBON_BG }}
            >
              <OfferTagIcon className="h-[17px] w-[17px] sm:h-[18px] sm:w-[18px]" />
              <span className="truncate leading-none">{offerLabel}</span>
            </span>
          ) : null}
        </div>

        <div
          className={`px-3.5 sm:px-4 pt-3 sm:pt-3.5 pb-3.5 sm:pb-4 flex flex-1 flex-col min-w-0 ${
            railCompact ? "gap-1.5 sm:gap-2.5" : "gap-2 sm:gap-2.5"
          }`}
        >
          <div className="flex items-start justify-between gap-2 sm:gap-3 min-w-0">
            <h3
              className={`min-w-0 flex-1 font-semibold text-[#111111] tracking-tight leading-snug ${
                railCompact
                  ? "text-[0.875rem] sm:text-base md:text-lg line-clamp-2"
                  : "text-[0.95rem] sm:text-base md:text-lg"
              }`}
              title={place.name}
            >
              {place.name}
            </h3>

            {hasRating && rating != null ? (
              <div className="shrink-0 flex flex-col items-end justify-center leading-none pt-0.5">
                <span className="inline-flex items-center gap-1">
                  <Star
                    size={14}
                    className="fill-[#F5B301] text-[#F5B301] sm:size-[15px]"
                    strokeWidth={0}
                  />
                  <span className="text-sm sm:text-[0.95rem] font-bold text-[#111111]">
                    {rating.toFixed(1)}
                  </span>
                </span>
                {reviewsCount > 0 ? (
                  <span
                    className={`mt-1 text-[0.65rem] sm:text-[0.7rem] font-medium text-slate-400 ${
                      railCompact ? "hidden sm:inline" : ""
                    }`}
                  >
                    ({formatReviewCount(reviewsCount)})
                  </span>
                ) : null}
              </div>
            ) : (
              <span className="shrink-0 inline-flex items-center bg-slate-100 text-slate-600 text-[0.7rem] sm:text-[0.75rem] font-bold px-2 py-0.5 rounded mt-0.5">
                New
              </span>
            )}
          </div>

          <div
            className={`items-center gap-1.5 min-w-0 text-slate-600 ${
              railCompact ? "hidden sm:flex" : "flex"
            }`}
          >
            <MapPin size={14} strokeWidth={2} className="shrink-0 text-slate-500" />
            <p className="truncate text-xs sm:text-sm leading-snug" title={addressLine}>
              {addressLine}
            </p>
          </div>

          <div className="flex items-center gap-1.5 min-w-0 text-slate-600">
            <EqualApproximately size={14} strokeWidth={2} className="shrink-0 text-slate-500" aria-hidden />
            <p className="truncate text-xs sm:text-sm leading-snug">{priceForTwo}</p>
          </div>

          <div
            className={`flex-wrap items-center gap-1.5 min-w-0 pt-0.5 ${
              railCompact ? "hidden sm:flex" : "flex"
            }`}
          >
            {cuisines.map((tag) => (
              <span
                key={tag}
                className="inline-flex max-w-full items-center truncate rounded-full bg-[#EFF4F2] px-2.5 py-0.5 text-[11px] sm:text-xs font-medium text-[#2E6852] border border-[#CDDBD4]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

/** Showcase card when live dining data is empty (landing rails). */
export function ShowcaseDiningRestaurantCard({
  name,
  image,
  rating,
  locality,
  cuisine,
  href,
  className = "",
  railCompact = false,
}: {
  name: string;
  image: string;
  rating?: number;
  locality?: string;
  cuisine?: string;
  href?: string;
  className?: string;
  railCompact?: boolean;
}) {
  const parsedRating = typeof rating === "number" ? rating : Number(rating);
  const hasRating = Number.isFinite(parsedRating) && parsedRating > 0;
  const idHash = String(name || "")
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const priceForTwo = `${formatMoney([1200, 1500, 2000, 2400, 1800][idHash % 5], {
    compact: true,
  })} for 2`;
  const reviews = [86, 124, 156, 98][idHash % 4];
  const shell = `group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white shadow-[0_2px_10px_rgba(17,17,17,0.06)] hover:shadow-[0_10px_28px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300 ${className}`;

  const body = (
    <>
      <div className="relative aspect-[5/4] w-full shrink-0 overflow-hidden bg-[#F3F4F6]">
        <CoverMedia src={image} alt={name} />
      </div>
      <div
        className={`px-3.5 sm:px-4 pt-3 sm:pt-3.5 pb-3.5 sm:pb-4 flex flex-1 flex-col min-w-0 ${
          railCompact ? "gap-1.5 sm:gap-2.5" : "gap-2 sm:gap-2.5"
        }`}
      >
        <div className="flex items-start justify-between gap-2 sm:gap-3 min-w-0">
          <h3
            className={`min-w-0 flex-1 font-semibold text-[#111111] tracking-tight leading-snug ${
              railCompact
                ? "text-[0.875rem] sm:text-base md:text-lg line-clamp-2"
                : "text-[0.95rem] sm:text-base md:text-lg"
            }`}
            title={name}
          >
            {name}
          </h3>

          {hasRating ? (
            <div className="shrink-0 flex flex-col items-end justify-center leading-none pt-0.5">
              <span className="inline-flex items-center gap-1">
                <Star size={14} className="fill-[#F5B301] text-[#F5B301]" strokeWidth={0} />
                <span className="text-sm sm:text-[0.95rem] font-bold text-[#111111]">
                  {parsedRating.toFixed(1)}
                </span>
              </span>
              <span
                className={`mt-1 text-[0.65rem] sm:text-[0.7rem] font-medium text-slate-400 ${
                  railCompact ? "hidden sm:inline" : ""
                }`}
              >
                ({formatReviewCount(reviews)})
              </span>
            </div>
          ) : (
            <span className="shrink-0 inline-flex items-center bg-slate-100 text-slate-600 text-[0.7rem] font-bold px-2 py-0.5 rounded mt-0.5">
              New
            </span>
          )}
        </div>

        <div
          className={`items-center gap-1.5 min-w-0 text-slate-600 ${
            railCompact ? "hidden sm:flex" : "flex"
          }`}
        >
          <MapPin size={14} strokeWidth={2} className="shrink-0 text-slate-500" />
          <p className="truncate text-xs sm:text-sm leading-snug" title={locality || "Addis Ababa"}>
            {locality || "Addis Ababa"}
          </p>
        </div>

        <div className="flex items-center gap-1.5 min-w-0 text-slate-600">
          <EqualApproximately size={14} strokeWidth={2} className="shrink-0 text-slate-500" aria-hidden />
          <p className="truncate text-xs sm:text-sm leading-snug">{priceForTwo}</p>
        </div>

        <div
          className={`flex-wrap items-center gap-1.5 min-w-0 pt-0.5 ${
            railCompact ? "hidden sm:flex" : "flex"
          }`}
        >
          {cuisineTagsList(cuisine).map((tag) => (
            <span
              key={tag}
              className="inline-flex max-w-full items-center truncate rounded-full bg-[#EFF4F2] px-2.5 py-0.5 text-[11px] sm:text-xs font-medium text-[#2E6852] border border-[#CDDBD4]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </>
  );

  if (!href) {
    return <div className={`${shell} select-none`}>{body}</div>;
  }

  return (
    <Link href={href} className={shell}>
      {body}
    </Link>
  );
}
