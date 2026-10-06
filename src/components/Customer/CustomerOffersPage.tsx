"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  Copy,
  Flame,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetActivePlatformOffersQuery,
  type PlatformOffer,
} from "@/services/api";
import { formatDateCustomer } from "@/lib/dateFormat";
import { formatMoney, formatWholeNumber } from "@/lib/currencyFormat";
import { useSelectedCity } from "@/lib/useSelectedCity";
import CustomerAccountLayout from "@/components/Shared/CustomerAccountLayout";
import { OffersRailShimmer } from "@/components/Shared/Shimmer";
import "@/components/LandingPage/SpecialOffersRail.css";

type OfferCategoryTab = "ALL" | "MOVIES" | "DINING" | "EVENTS";

const TABS: Array<{
  key: OfferCategoryTab;
  label: string;
}> = [
  { key: "ALL", label: "All Offers" },
  { key: "MOVIES", label: "Movie" },
  { key: "DINING", label: "Dining" },
  { key: "EVENTS", label: "Events" },
];

type OfferTheme = "magenta" | "violet" | "ocean" | "sunset" | "emerald";
const THEMES: OfferTheme[] = ["magenta", "violet", "ocean", "sunset", "emerald"];

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
  const max = maxAmt > 0 ? `Max ${formatMoney(maxAmt, { compact: true })}` : null;
  return { main, max };
}

function eligibilityMeta(eligibility?: string) {
  const e = (eligibility || "ALL").toUpperCase();
  if (e === "NEW") {
    return { label: "NEW USER", tone: "new" as const, note: "First booking only" };
  }
  if (e === "EXISTING") {
    return { label: "MEMBERS", tone: "existing" as const, note: "Existing customers only" };
  }
  return { label: "HOT DEAL", tone: "hot" as const, note: null as string | null };
}

function OfferCard({ offer, index }: { offer: PlatformOffer; index: number }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const theme = (THEMES.includes(offer.display_theme as OfferTheme)
    ? offer.display_theme
    : THEMES[index % THEMES.length]) as OfferTheme;
  const { main, max } = formatOfferDiscountDisplay(offer);
  const eligibility = eligibilityMeta(offer.customer_eligibility);
  const minAmt = Number(offer.min_order_amount) || 0;
  const minBooking =
    minAmt > 0
      ? `Min. booking: ${formatMoney(minAmt, { compact: true })}`
      : "No minimum booking";
  const validTill = offer.end_at
    ? `Valid till ${formatDateCustomer(offer.end_at)}`
    : "Limited time offer";
  const scope =
    offer.scope_label ||
    (offer.category === "ALL"
      ? "On All Bookings"
      : offer.category === "EVENTS"
        ? "On Events"
        : offer.category === "DINING"
          ? "On Dining"
          : offer.category === "MOVIES"
            ? "On Movies"
            : "On Bookings");

  const copyCode = async () => {
    if (!revealed) {
      setRevealed(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(offer.code);
      setCopied(true);
      toast.success("Promo code copied");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy code");
    }
  };

  return (
    <article className={`offer-card offer-card--${theme} w-full h-full`}>
      <div className="offer-card__left">
        <p className={`offer-card__badge offer-card__badge--${eligibility.tone}`}>
          {eligibility.tone === "new" ? (
            <Sparkles size={14} fill="currentColor" strokeWidth={0} />
          ) : eligibility.tone === "existing" ? (
            <Users size={14} strokeWidth={2.5} />
          ) : (
            <Flame size={14} fill="currentColor" strokeWidth={0} />
          )}
          {eligibility.label}
        </p>
        <div>
          <p className="offer-card__discount">{main}</p>
          {max ? <p className="offer-card__discount-max">{max}</p> : null}
          <p className="offer-card__name">{offer.name || offer.code}</p>
          <p className="offer-card__scope">
            {scope}
            {eligibility.note ? (
              <span className="offer-card__eligibility"> · {eligibility.note}</span>
            ) : null}
          </p>
          {offer.description ? (
            <p className="mt-2 text-xs text-white/80 line-clamp-2">{offer.description}</p>
          ) : null}
        </div>
        <p className="offer-card__min">
          <Calendar size={13} strokeWidth={2} />
          {minBooking}
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
        <button type="button" className="offer-card__copy-btn" onClick={() => void copyCode()}>
          {copied ? (
            "COPIED!"
          ) : revealed ? (
            <>
              <Copy size={12} className="inline mr-1" /> COPY CODE
            </>
          ) : (
            "REVEAL CODE"
          )}
        </button>
        <p className="offer-card__valid">{validTill}</p>
      </div>
    </article>
  );
}

export default function CustomerOffersPage() {
  const [tab, setTab] = useState<OfferCategoryTab>("ALL");
  const selectedCity = useSelectedCity();
  const city =
    selectedCity && selectedCity !== "All Cities" ? selectedCity : undefined;

  const { data: platformOffers = [], isLoading, isFetching } =
    useGetActivePlatformOffersQuery({
      ...(city ? { city } : {}),
    });

  const activeOffers = useMemo(
    () =>
      platformOffers.filter(
        (o) => o.effective_status === "ACTIVE" || o.effective_status === "SCHEDULED"
      ),
    [platformOffers]
  );

  const filtered = useMemo(() => {
    if (tab === "ALL") return activeOffers;
    return activeOffers.filter((o) => {
      const cat = (o.category || "ALL").toUpperCase();
      // Category tabs include platform-wide (ALL) offers too
      return cat === tab || cat === "ALL";
    });
  }, [activeOffers, tab]);

  const offerCount = filtered.length;

  return (
    <CustomerAccountLayout>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 lg:p-8">
        <div className="mb-5">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111111] leading-tight">
            Offers
          </h2>
          <p className="mt-1.5 text-sm sm:text-base text-slate-500">
            Exclusive offers for movies, dining, events and more.
          </p>
        </div>

        <div className="border-b border-slate-200 mb-5">
          <div className="flex items-center gap-5 sm:gap-7 overflow-x-auto scrollbar-hide">
            {TABS.map((item) => {
              const selected = tab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`relative shrink-0 pb-3 text-sm sm:text-[15px] font-medium cursor-pointer transition-colors ${
                    selected
                      ? "text-[#6900AA]"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {item.label}
                  {selected ? (
                    <span className="absolute left-0 right-0 bottom-0 h-[2.5px] rounded-full bg-[#6900AA]" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-base sm:text-lg font-bold text-[#111111]">
              {offerCount} Offer{offerCount === 1 ? "" : "s"}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">
              Save more on your favourite experiences
            </p>
          </div>
          {city ? (
            <p className="text-sm font-medium text-slate-500">
              Showing for <span className="font-bold text-[#6900AA]">{city}</span>
            </p>
          ) : null}
        </div>

        {isLoading || (isFetching && activeOffers.length === 0) ? (
          <OffersRailShimmer count={4} />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
            <Tag className="mx-auto text-slate-300 mb-3" size={28} />
            <p className="font-semibold text-slate-700">No offers in this category</p>
            <p className="mt-1 text-sm text-slate-500">
              Check back soon, or try another category.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 sm:gap-5">
            {filtered.map((offer, index) => (
              <div
                key={offer.id}
                className="w-full max-w-[480px] sm:w-[min(100%,480px)]"
              >
                <OfferCard offer={offer} index={index} />
              </div>
            ))}
          </div>
        )}
      </div>
    </CustomerAccountLayout>
  );
}
