"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Flame, Sparkles, Users } from "lucide-react";
import { useGetActivePlatformOffersQuery, type PlatformOffer } from "@/services/api";
import { formatDateCustomer } from "@/lib/dateFormat";
import { formatMoney, formatWholeNumber } from "@/lib/currencyFormat";
import { scrollRailBy, useHorizontalScrollEdges } from "@/lib/useHorizontalScrollEdges";
import { readSessionForRole } from "@/lib/authStorage";
import { OffersRailShimmer } from "@/components/Shared/Shimmer";
import { RailPagerNav } from "./RailChrome";
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
      ? "On All Bookings"
      : o.category === "EVENTS"
        ? "On Events"
        : o.category === "DINING"
          ? "On Dining"
          : o.category === "MOVIES"
            ? "On Movies"
            : "On Bookings");

  const minAmt = Number(o.min_order_amount) || 0;
  const minBooking =
    minAmt > 0
      ? `Min. booking: ${formatMoney(minAmt, { compact: true })}`
      : "No minimum booking";

  const validTill = o.end_at
    ? `Valid till ${formatDateCustomer(o.end_at)}`
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

export default function SpecialOffersRail({ city = "" }: { city?: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [customerId, setCustomerId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return readSessionForRole("customer")?.user?.customer_id || null;
  });

  useEffect(() => {
    const syncCustomer = () => {
      const session = readSessionForRole("customer");
      setCustomerId(session?.user?.customer_id || null);
    };
    syncCustomer();
    window.addEventListener("storage", syncCustomer);
    window.addEventListener("auth_changed", syncCustomer);
    return () => {
      window.removeEventListener("storage", syncCustomer);
      window.removeEventListener("auth_changed", syncCustomer);
    };
  }, []);

  const { data: platformOffers = [], isLoading, isFetching } =
    useGetActivePlatformOffersQuery({
      customer_id: customerId,
      ...(city && city !== "All Cities" ? { city } : {}),
    });

  const offers = useMemo(
    () =>
      platformOffers
        .filter((o) => o.effective_status === "ACTIVE" || o.effective_status === "SCHEDULED")
        .map(mapPlatformOffer),
    [platformOffers]
  );

  const scrollEdges = useHorizontalScrollEdges(scrollerRef, [
    offers.length,
    isLoading,
    isFetching,
  ]);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    scrollRailBy(el, dir);
  };

  // Hide the whole Special Offers section when nothing is available for this user
  if (!isLoading && !isFetching && offers.length === 0) {
    return null;
  }

  return (
    <section id="offers" className="bg-white py-6 sm:py-8 lg:pb-5 scroll-mt-28">
      <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0">
        <div className="flex items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
            Special Offers
          </h2>
        </div>

        <div>
          {isLoading || (isFetching && offers.length === 0) ? (
            <OffersRailShimmer count={4} />
          ) : (
            <>
              <div ref={scrollerRef} className="offers-rail">
                {offers.map((offer) => (
                  <OfferCard key={offer.id} offer={offer} />
                ))}
              </div>

              <RailPagerNav
                canPrev={scrollEdges.left}
                canNext={scrollEdges.right}
                pageCount={scrollEdges.pageCount}
                activePage={scrollEdges.activePage}
                onPrev={() => scrollBy(-1)}
                onNext={() => scrollBy(1)}
                label="offers"
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
