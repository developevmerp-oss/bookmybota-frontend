"use client";

import { useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Flame, Loader2, Sparkles, Users } from "lucide-react";
import { useGetActivePlatformOffersQuery, type PlatformOffer } from "@/services/api";
import { formatDate } from "@/lib/dateFormat";
import { formatMoney, formatWholeNumber } from "@/lib/currencyFormat";
import "./SpecialOffersRail.css";

type OfferTheme = "magenta" | "violet" | "ocean" | "sunset" | "emerald";

type DisplayOffer = {
  id: string;
  theme: OfferTheme;
  discountMain: string;
  discountMax: string | null;
  name: string;
  scope: string;
  eligibilityNote: string | null;
  badge: { label: string; tone: "hot" | "new" | "existing" };
  minBooking: string;
  validTill: string;
  code: string;
};

function formatOfferDiscountDisplay(o: PlatformOffer): {
  main: string;
  max: string | null;
} {
  if (o.discount_type === "FLAT") {
    return {
      main: `${formatMoney(o.discount_value, { compact: true })} OFF`,
      max: null,
    };
  }

  const main = `${formatWholeNumber(o.discount_value)}% OFF`;
  const maxAmt = o.max_discount != null ? Number(o.max_discount) : 0;
  const max =
    maxAmt > 0 ? `Max ${formatMoney(maxAmt, { compact: true })}` : null;

  return { main, max };
}

function eligibilityCopy(eligibility?: string): {
  badge: DisplayOffer["badge"];
  note: string | null;
} {
  const e = (eligibility || "ALL").toUpperCase();
  if (e === "NEW") {
    return {
      badge: { label: "NEW USER", tone: "new" },
      note: "First booking only",
    };
  }
  if (e === "EXISTING") {
    return {
      badge: { label: "MEMBERS", tone: "existing" },
      note: "Existing customers only",
    };
  }
  return { badge: { label: "HOT DEAL", tone: "hot" }, note: null };
}

const THEMES: OfferTheme[] = ["magenta", "violet", "ocean", "sunset", "emerald"];

function mapPlatformOffer(o: PlatformOffer, index: number): DisplayOffer {
  const theme = (THEMES.includes(o.display_theme as OfferTheme)
    ? o.display_theme
    : THEMES[index % THEMES.length]) as OfferTheme;

  const { main: discountMain, max: discountMax } = formatOfferDiscountDisplay(o);

  const scope =
    o.scope_label ||
    (o.category === "ALL"
      ? "On Events & Dining"
      : o.category === "EVENTS"
        ? "On Events"
        : "On Dining");

  const minAmt = Number(o.min_order_amount) || 0;
  const minBooking =
    minAmt > 0
      ? `Min. booking: ${formatMoney(minAmt, { compact: true })}`
      : "No minimum booking";

  const validTill = o.end_at
    ? `Valid till ${formatDate(o.end_at)}`
    : "Limited time offer";

  const { badge, note } = eligibilityCopy(o.customer_eligibility);

  return {
    id: o.id,
    theme,
    discountMain,
    discountMax,
    name: o.name || o.code,
    scope,
    eligibilityNote: note,
    badge,
    minBooking,
    validTill,
    code: o.code,
  };
}

function OfferCard({ offer }: { offer: DisplayOffer }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    if (!revealed) {
      setRevealed(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(offer.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard may be blocked
    }
  };

  return (
    <article className={`offers-rail-slot offer-card offer-card--${offer.theme}`}>
      <div className="offer-card__left">
        <p className={`offer-card__badge offer-card__badge--${offer.badge.tone}`}>
          {offer.badge.tone === "new" ? (
            <Sparkles size={14} fill="currentColor" strokeWidth={0} />
          ) : offer.badge.tone === "existing" ? (
            <Users size={14} strokeWidth={2.5} />
          ) : (
            <Flame size={14} fill="currentColor" strokeWidth={0} />
          )}
          {offer.badge.label}
        </p>
        <div>
          <p className="offer-card__discount">{offer.discountMain}</p>
          {offer.discountMax ? (
            <p className="offer-card__discount-max">{offer.discountMax}</p>
          ) : null}
          <p className="offer-card__name">{offer.name}</p>
          <p className="offer-card__scope">
            {offer.scope}
            {offer.eligibilityNote ? (
              <span className="offer-card__eligibility"> · {offer.eligibilityNote}</span>
            ) : null}
          </p>
        </div>
        <p className="offer-card__min">
          <Calendar size={13} strokeWidth={2} />
          {offer.minBooking}
        </p>
      </div>

      <div className="offer-card__right">
        <p className="offer-card__use">Use Code</p>
        <button
          type="button"
          className={`offer-card__code-box ${revealed ? "is-revealed" : ""}`}
          onClick={() => setRevealed(true)}
          aria-label={revealed ? `Promo code ${offer.code}` : "Reveal promo code"}
        >
          {revealed ? offer.code : "••••••••"}
        </button>
        <button type="button" className="offer-card__copy-btn" onClick={copyCode}>
          {copied ? "COPIED!" : revealed ? "COPY CODE" : "REVEAL CODE"}
        </button>
        <p className="offer-card__valid">{offer.validTill}</p>
      </div>
    </article>
  );
}

export default function SpecialOffersRail() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { data: platformOffers = [], isLoading } = useGetActivePlatformOffersQuery();

  const offers = platformOffers
    .filter((o) => o.effective_status === "ACTIVE" || o.effective_status === "SCHEDULED")
    .map(mapPlatformOffer);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  };

  if (!isLoading && offers.length === 0) {
    return null;
  }

  return (
    <section className="bg-white py-6 sm:py-8 lg:py-10">
      <div className="container mx-auto px-4 md:px-5 lg:px-8">
        <div className="flex items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          <h2 className="text-xl sm:text-[22px] md:text-2xl font-semibold tracking-tight text-[#111111]">
            Special Offers
          </h2>
        </div>

        <div className="relative">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-[#666] gap-2">
              <Loader2 className="animate-spin" size={20} />
              Loading offers…
            </div>
          ) : (
            <>
              <button
                type="button"
                aria-label="Previous offers"
                onClick={() => scrollBy(-1)}
                className="hidden md:flex absolute -left-4 md:-left-5 lg:-left-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full items-center justify-center cursor-pointer bg-white border border-[#EDEDED] text-[#111111] shadow-sm hover:bg-[#F7E9FF]"
              >
                <ChevronLeft size={18} />
              </button>

              <div ref={scrollerRef} className="offers-rail">
                {offers.map((offer) => (
                  <OfferCard key={offer.id} offer={offer} />
                ))}
              </div>

              <button
                type="button"
                aria-label="Next offers"
                onClick={() => scrollBy(1)}
                className="hidden md:flex absolute -right-4 md:-right-5 lg:-right-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full items-center justify-center cursor-pointer bg-white border border-[#EDEDED] text-[#111111] shadow-sm hover:bg-[#F7E9FF]"
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
