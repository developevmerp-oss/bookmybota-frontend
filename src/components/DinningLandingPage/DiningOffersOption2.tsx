"use client";

import { useRef } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { DiningHomeOfferCard, DiningOfferBucket } from "@/lib/diningFilters";
import { useHorizontalScrollEdges } from "@/lib/useHorizontalScrollEdges";

const COPPER = "#A87C51";
const BG = "#F9F6F1";
const SERIF = 'Georgia, "Times New Roman", Times, serif';

/** Same card width as Offer Option One */
const CARD_WIDTH =
  "shrink-0 snap-start w-[min(86vw,340px)] xl:w-[calc((100%-40px)/3)]";

function offerCardDiscountDisplay(card: DiningHomeOfferCard): {
  kind: "flat" | "percent";
  value: number;
} {
  if (card.bucket === "flat") {
    const match = card.title.match(/(\d+(?:\.\d+)?)/);
    return { kind: "flat", value: match ? Number(match[1]) : 0 };
  }
  if (card.bucket === "percent_upto_20") return { kind: "percent", value: 20 };
  if (card.bucket === "percent_upto_50") return { kind: "percent", value: 50 };
  const match = card.title.match(/(\d+)\s*%/i);
  return { kind: "percent", value: match ? Number(match[1]) : 0 };
}

function OfferPromoCardOption2({
  card,
  locationCity,
  className = "",
  onSelect,
}: {
  card: DiningHomeOfferCard;
  locationCity: string;
  className?: string;
  onSelect: (bucket: DiningOfferBucket) => void;
}) {
  const { kind, value } = offerCardDiscountDisplay(card);
  const isFlat = kind === "flat";
  const count = card.restaurantCount;
  const citySuffix =
    locationCity && locationCity !== "All Cities" ? ` in ${locationCity}` : "";
  const displayValue =
    Number.isFinite(value) && value > 0 ? String(Math.round(value)) : "0";
  const watermark = isFlat ? displayValue : "%";
  const watermarkSize = isFlat
    ? displayValue.length >= 3
      ? "4.25rem"
      : "5.25rem"
    : "5.75rem";

  return (
    <button
      type="button"
      onClick={() => onSelect(card.bucket)}
      className={`relative overflow-hidden rounded-[20px] border border-[#E8E2DA] text-left min-h-[220px] sm:min-h-[236px] px-5 py-5 sm:px-6 sm:py-6 cursor-pointer transition-shadow hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] ${className}`}
      style={{ backgroundColor: BG }}
    >
      {/* Watermark kept fully inside the card — not clipped */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 select-none leading-none font-bold"
        style={{
          fontFamily: SERIF,
          color: COPPER,
          opacity: 0.14,
          fontSize: watermarkSize,
        }}
      >
        {watermark}
      </span>

      <div className="relative z-10 flex flex-col h-full min-h-[180px] sm:min-h-[196px]">
        {/* Top label + copper rule */}
        {/* <div className="flex items-center gap-2.5">
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.16em] text-slate-900">
            {isFlat ? "GET" : "DINING OFFERS"}
          </span>
          <span className="block h-px w-9 sm:w-11 shrink-0" style={{ backgroundColor: COPPER }} />
        </div> */}

        {/* Main headline — open sizing, not cramped */}
        <div className="mt-3 sm:mt-3.5 pr-10">
          {isFlat ? (
            <div className="flex items-start gap-2 sm:gap-2.5">
              <span
                className="text-[3.25rem] sm:text-[4.25rem] leading-none font-bold "
                style={{ fontFamily: SERIF, color: COPPER }}
              >
                {displayValue}
              </span>
              <div className="pt-1.5 leading-none">
                <div
                  className="text-[1.65rem] sm:text-[1.85rem] font-bold text-slate-900 leading-none"
                  style={{ fontFamily: SERIF }}
                >
                  ETB
                </div>
                <div
                  className="text-[1.35rem] sm:text-[1.5rem] font-bold tracking-wide mt-1 leading-none"
                  style={{ fontFamily: SERIF, color: COPPER }}
                >
                  OFF
                </div>
              </div>
            </div>
          ) : (
            <>
              <p
                className="text-[1.35rem] sm:text-[1.5rem] font-bold text-slate-900 leading-snug"
                style={{ fontFamily: SERIF }}
              >
                Save up to
              </p>
              <p
                className="text-[2.6rem] sm:text-[3rem] font-bold leading-none tracking-tight mt-1"
                style={{ fontFamily: SERIF }}
              >
                <span style={{ color: COPPER }}>{displayValue}%</span>
                <span className="text-slate-900"> OFF</span>
              </p>
            </>
          )}
        </div>

        {/* Bottom row: subtitle left, CTA right */}
        <div className="mt-auto pt-4 flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p
              className="text-[13px] sm:text-sm text-slate-500 truncate leading-snug"
              style={{ fontFamily: SERIF }}
            >
              Available at{" "}
              <span className="font-bold text-slate-900">{count}</span> restaurant
              {count === 1 ? "" : "s"}
              {citySuffix}
            </p>
            {isFlat && (
              <p className="mt-1 text-[11px] sm:text-xs text-slate-400 truncate">
                Selected dining offers
              </p>
            )}
          </div>

          <span className="shrink-0 inline-flex flex-col items-start pb-0.5">
            <span className="inline-flex items-center gap-1.5 text-[13px] sm:text-sm font-semibold text-slate-900 whitespace-nowrap">
              Explore offers <ArrowRight size={14} strokeWidth={2} />
            </span>
            <span
              className="mt-1.5 block h-px w-[5.25rem]"
              style={{ backgroundColor: COPPER }}
            />
          </span>
        </div>
      </div>
    </button>
  );
}


/**
 * Dining homepage Offers — UI Option Two (wide flat % / flat ETB cream banners).
 * Comment out the usage in DiningHomePage to hide this row.
 */
export default function DiningOffersOption2({
  cards,
  locationCity,
  onSelect,
}: {
  cards: DiningHomeOfferCard[];
  locationCity: string;
  onSelect: (bucket: DiningOfferBucket) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollEdges = useHorizontalScrollEdges(scrollerRef, [cards.length]);

  if (cards.length === 0) return null;

  const scrollBy = (direction: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(el.clientWidth * 0.85, 320);
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  const useSlider = cards.length > 3;

  return (
    <div className="mt-4 sm:mt-5">
      {useSlider ? (
        <div className="relative">
          {scrollEdges.left && (
            <button
              type="button"
              aria-label="Previous offers option two"
              onClick={() => scrollBy("left")}
              className="absolute left-0 sm:-left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow-md hidden md:flex items-center justify-center text-slate-700"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <div
            ref={scrollerRef}
            className="flex gap-4 sm:gap-5 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pb-1"
          >
            {cards.map((card) => (
              <OfferPromoCardOption2
                key={`opt2-${card.id}`}
                card={card}
                locationCity={locationCity}
                onSelect={onSelect}
                className={CARD_WIDTH}
              />
            ))}
          </div>
          {scrollEdges.right && (
            <button
              type="button"
              aria-label="Next offers option two"
              onClick={() => scrollBy("right")}
              className="absolute right-0 sm:-right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow-md hidden md:flex items-center justify-center text-slate-700"
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {cards.map((card) => (
            <OfferPromoCardOption2
              key={`opt2-${card.id}`}
              card={card}
              locationCity={locationCity}
              onSelect={onSelect}
              className="w-full"
            />
          ))}
        </div>
      )}
    </div>
  );
}
