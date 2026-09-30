"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Tag, Utensils, X } from "lucide-react";
import type { Business } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { restaurantHref } from "@/lib/businessPublicPath";
import { formatMoney } from "@/lib/currencyFormat";
import { listingOfferBannerLabel } from "@/lib/diningOffers";
import { localityFromAddress } from "@/components/LandingPage/homeUtils";
import DiningWishlistButton from "@/components/DinningLandingPage/DiningWishlistButton";

const OFFER_BANNER_GRADIENT =
  "linear-gradient(90deg, #6A5AD2 0%, #7B68DE 45%, #9B87EC 100%)";

function CoverMedia({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const url = (src || "").trim();
  if (!url || failed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#F3F4F6] text-slate-300">
        <Utensils size={28} strokeWidth={1.5} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]"
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

function normalizeGalleryList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((s) => s.trim()).filter(Boolean);
      }
    } catch {
      /* ignore */
    }
  }
  return [];
}

function resolveList(urls: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of urls) {
    const resolved = resolveMediaUrl(u)?.trim();
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    out.push(resolved);
  }
  return out;
}

/** Full gallery for lightbox: cover + unique gallery uploads (detail-page style). */
function allGalleryUrls(place: Business): string[] {
  const raw: string[] = [];
  if (place.cover_image_url?.trim()) raw.push(place.cover_image_url.trim());
  for (const img of normalizeGalleryList(place.gallery_images)) {
    if (img !== place.cover_image_url?.trim()) raw.push(img);
  }
  return resolveList(raw);
}

/**
 * Overlapping circle previews like the Lume reference.
 * Prefer uploaded gallery shots; if only one gallery image, pair with cover when different.
 * Hide entirely when there is nothing to preview beyond the main cover alone.
 */
function galleryPreviewUrls(place: Business): string[] {
  const cover = place.cover_image_url?.trim() || "";
  const gallery = normalizeGalleryList(place.gallery_images);
  const galleryOnly = gallery.filter((img) => img !== cover);
  const pool = galleryOnly.length > 0 ? galleryOnly : gallery;

  if (pool.length === 0) return [];

  const resolvedPool = resolveList(pool);
  if (resolvedPool.length >= 2) return resolvedPool.slice(0, 2);

  if (resolvedPool.length === 1) {
    const coverResolved = cover ? resolveMediaUrl(cover)?.trim() : "";
    if (coverResolved && coverResolved !== resolvedPool[0]) {
      return [resolvedPool[0], coverResolved];
    }
    return resolvedPool;
  }

  return [];
}

function GalleryLightbox({
  items,
  startIndex,
  onClose,
}: {
  items: string[];
  startIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);

  useEffect(() => {
    setIdx(startIndex);
  }, [startIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((p) => (p + 1) % items.length);
      if (e.key === "ArrowLeft") setIdx((p) => (p - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [items.length, onClose]);

  if (typeof document === "undefined" || items.length === 0) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col justify-between py-6 px-4 select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Restaurant gallery"
      onClick={onClose}
    >
      <div
        className="flex justify-between items-center max-w-7xl mx-auto w-full text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-semibold tracking-wider text-slate-300 font-mono">
          {idx + 1} of {items.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-full transition-colors text-white cursor-pointer"
          aria-label="Close gallery"
        >
          <X size={24} />
        </button>
      </div>

      <div
        className="flex-1 flex items-center container mx-auto px-5 sm:px-10 justify-between w-full gap-2 sm:gap-4 my-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {items.length > 1 ? (
          <button
            type="button"
            onClick={() => setIdx((p) => (p - 1 + items.length) % items.length)}
            className="p-2 sm:p-3 bg-white/5 hover:bg-white/15 active:scale-95 text-white rounded-full transition-all cursor-pointer backdrop-blur-sm shadow-lg border border-white/10 shrink-0"
            aria-label="Previous image"
          >
            <ChevronLeft size={24} />
          </button>
        ) : (
          <div className="w-10 sm:w-12 shrink-0" />
        )}

        <div className="flex-1 h-full flex items-center justify-center overflow-auto px-1 sm:px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={items[idx]}
            alt={`Gallery image ${idx + 1}`}
            className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-2xl bg-white"
          />
        </div>

        {items.length > 1 ? (
          <button
            type="button"
            onClick={() => setIdx((p) => (p + 1) % items.length)}
            className="p-2 sm:p-3 bg-white/5 hover:bg-white/15 active:scale-95 text-white rounded-full transition-all cursor-pointer backdrop-blur-sm shadow-lg border border-white/10 shrink-0"
            aria-label="Next image"
          >
            <ChevronRight size={24} />
          </button>
        ) : (
          <div className="w-10 sm:w-12 shrink-0" />
        )}
      </div>

      {items.length > 1 ? (
        <div
          className="max-w-4xl mx-auto w-full overflow-x-auto py-2 flex justify-center gap-2.5 px-4 scrollbar-hide"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => setIdx(i)}
              className={`w-16 h-12 rounded-lg overflow-hidden shrink-0 transition-all border-2 cursor-pointer ${
                idx === i
                  ? "border-rose-500 scale-105 opacity-100 shadow-md"
                  : "border-transparent opacity-50 hover:opacity-80"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>,
    document.body
  );
}

/**
 * Dining homepage restaurant card — UI Option Two.
 */
export default function DiningRestaurantCardOption2({
  place,
  className = "",
}: {
  place: Business;
  className?: string;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxStart, setLightboxStart] = useState(0);

  const cover =
    resolveMediaUrl(place.cover_image_url) ||
    resolveList(normalizeGalleryList(place.gallery_images))[0] ||
    "";
  const previews = galleryPreviewUrls(place);
  const lightboxItems = allGalleryUrls(place);
  const offerLabel = listingOfferBannerLabel(place.dining_offers);
  const isPromoted = Boolean(place.is_promoted);

  const parsedRating = Number(place.rating);
  const reviewsCount = Number(place.reviews_count) || 0;
  const hasRating =
    reviewsCount > 0 && Number.isFinite(parsedRating) && parsedRating > 0;
  const rating = hasRating ? parsedRating : null;

  const locality = localityFromAddress(place.address) || place.city_name?.trim() || "";
  const cityLine = [locality, place.city_name?.trim()]
    .filter(Boolean)
    .filter((v, i, arr) => arr.findIndex((x) => x?.toLowerCase() === v?.toLowerCase()) === i)
    .join(", ");

  // Same price display logic as Option 1 (DiningPosterCard listing)
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
  const priceLabel = hasCost
    ? formatMoney(costNum, { compact: true })
    : formatMoney([1200, 1500, 2000, 2400, 1800][idHash % 5], { compact: true });
  const distanceLabel = `${[4.9, 3.5, 5.0, 2.8, 6.2][idHash % 5]} km`;

  const openGallery = (e: MouseEvent, previewIndex = 0) => {
    e.preventDefault();
    e.stopPropagation();
    if (lightboxItems.length === 0) return;
    const previewUrl = previews[previewIndex];
    const start =
      previewUrl != null
        ? Math.max(0, lightboxItems.findIndex((u) => u === previewUrl))
        : 0;
    setLightboxStart(start >= 0 ? start : 0);
    setLightboxOpen(true);
  };

  return (
    <>
      <Link
        href={restaurantHref(place)}
        className={`group block w-full overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white shadow-[0_2px_10px_rgba(17,17,17,0.06)] hover:shadow-[0_10px_28px_rgba(17,17,17,0.1)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300 ${className}`}
      >
        <div className="relative aspect-[5/4] w-full overflow-hidden bg-[#F3F4F6]">
          <CoverMedia src={cover} alt={place.name} />

          {isPromoted ? (
            <span className="absolute top-3 left-3 z-[1] pointer-events-none inline-flex items-center rounded-full bg-white/80 backdrop-blur-[2px] px-2.5 py-1 text-[11px] font-semibold text-slate-900 shadow-sm border border-white/60">
              Promoted
            </span>
          ) : null}

          <DiningWishlistButton businessId={String(place.id)} appearance="glass" />
        </div>

        {/* Offer strip — full-width banner under image (reference gradient) */}
        {offerLabel ? (
          <div
            className="flex items-center gap-2 px-3 py-2 min-w-0"
            style={{ background: OFFER_BANNER_GRADIENT }}
          >
            <Tag size={14} className="shrink-0 text-white -rotate-45" strokeWidth={2.25} aria-hidden />
            <span className="text-white text-xs sm:text-[13px] font-semibold truncate leading-none">
              {offerLabel}
            </span>
          </div>
        ) : null}

        <div className="px-4 pt-3.5 pb-4 flex flex-col gap-1.5 min-w-0">
          {/* Title row: name + gallery circles */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <h3 className="text-base sm:text-xl font-bold text-[#1C1C1C] truncate leading-snug min-w-0 flex-1 tracking-wide pr-1">
              {place.name}
            </h3>

            {previews.length > 0 ? (
              <button
                type="button"
                onClick={(e) => openGallery(e, 0)}
                className="shrink-0 flex items-center cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6900AA] focus-visible:ring-offset-2"
                aria-label={`Open gallery for ${place.name}`}
              >
                <span
                  className="relative flex items-center h-11 sm:h-12"
                  style={{ width: previews.length > 1 ? "3.5rem" : "2.5rem" }}
                >
                  {previews.map((url, i) => (
                    <span
                      key={`${place.id}-g-${i}`}
                      className="absolute top-0 size-10 sm:size-11 rounded-full overflow-hidden border-[2.5px] border-white bg-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
                      style={{
                        left: i * 16,
                        zIndex: previews.length - i,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget.parentElement as HTMLElement).style.visibility =
                            "hidden";
                        }}
                      />
                    </span>
                  ))}
                </span>
              </button>
            ) : null}
          </div>

          {/* Rating / New — below title */}
          {hasRating && rating != null ? (
            <div className="inline-flex w-fit items-center gap-1 bg-[#24963F] text-white text-[0.9rem] font-bold px-2 py-0.5 rounded">
              <span>{rating.toFixed(1)}</span>
              <span className="text-[0.9rem] text-white">★</span>
            </div>
          ) : (
            <div className="inline-flex w-fit items-center bg-slate-100 text-slate-600 text-[0.75rem] font-bold px-2 py-0.5 rounded">
              New
            </div>
          )}

          {cityLine ? (
            <p className="text-sm text-gray-600 truncate leading-snug tracking-wide">{cityLine}</p>
          ) : null}

          {/* Price + distance */}
          <div className="flex items-center justify-between gap-3 min-w-0 pt-0.5 text-sm tracking-wide text-gray-600">
            <p className="min-w-0 truncate">
              <span className="font-bold text-[#1C1C1C]">{priceLabel}</span>
              <span> for two</span>
            </p>
            <span className="shrink-0 whitespace-nowrap">{distanceLabel}</span>
          </div>
        </div>
      </Link>

      {lightboxOpen && lightboxItems.length > 0 ? (
        <GalleryLightbox
          items={lightboxItems}
          startIndex={lightboxStart}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </>
  );
}
