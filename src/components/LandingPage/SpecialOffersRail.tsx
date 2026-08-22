"use client";

import { useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import "./SpecialOffersRail.css";

type OfferTheme = "magenta" | "violet" | "ocean" | "sunset" | "emerald";

type SpecialOffer = {
  id: string;
  theme: OfferTheme;
  discount: string;
  scope: string;
  minBooking: string;
  validTill: string;
  code: string;
};

/** Static showcase offers for the landing page. */
export const SPECIAL_OFFERS: SpecialOffer[] = [
  {
    id: "1",
    theme: "magenta",
    discount: "25% OFF",
    scope: "On Venues",
    minBooking: "Min. booking: $100 ETB",
    validTill: "Valid till 31 Aug, 2026",
    code: "VENUE25",
  },
  {
    id: "2",
    theme: "violet",
    discount: "20% OFF",
    scope: "On All Events",
    minBooking: "Min. booking: $150 ETB",
    validTill: "Valid till 15 Sep, 2026",
    code: "EVENT20",
  },
  {
    id: "3",
    theme: "sunset",
    discount: "15% OFF",
    scope: "On Dining",
    minBooking: "Min. booking: $100 ETB",
    validTill: "Valid till 30 Sep, 2026",
    code: "DINING15",
  },
  {
    id: "4",
    theme: "ocean",
    discount: "30% OFF",
    scope: "On Sports",
    minBooking: "Min. booking: $100 ETB",
    validTill: "Valid till 20 Oct, 2026",
    code: "SPORT30",
  },
  {
    id: "5",
    theme: "emerald",
    discount: "10% OFF",
    scope: "On Concerts",
    minBooking: "Min. booking: $200 ETB",
    validTill: "Valid till 31 Dec, 2026",
    code: "MUSIC10",
  },
];

function OfferCard({ offer }: { offer: SpecialOffer }) {
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
        <p className="offer-card__badge">
          <Flame size={14} fill="currentColor" strokeWidth={0} />
          HOT DEAL
        </p>
        <div>
          <p className="offer-card__discount">{offer.discount}</p>
          <p className="offer-card__scope">{offer.scope}</p>
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

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  };

  return (
    <section className="bg-white py-6 sm:py-8 lg:py-10">
      <div className="container mx-auto px-4 md:px-5 lg:px-8">
        <div className="flex items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          <h2 className="text-xl sm:text-[22px] md:text-2xl font-semibold tracking-tight text-[#111111]">
            Special Offers
          </h2>
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label="Previous offers"
            onClick={() => scrollBy(-1)}
            className="hidden md:flex absolute -left-4 md:-left-5 lg:-left-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full items-center justify-center cursor-pointer bg-white border border-[#EDEDED] text-[#111111] shadow-sm hover:bg-[#F7E9FF]"
          >
            <ChevronLeft size={18} />
          </button>

          <div ref={scrollerRef} className="offers-rail">
            {SPECIAL_OFFERS.map((offer) => (
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
        </div>
      </div>
    </section>
  );
}
