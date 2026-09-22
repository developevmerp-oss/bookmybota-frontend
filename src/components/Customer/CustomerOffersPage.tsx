"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  Clapperboard,
  Copy,
  Flame,
  Loader2,
  Sparkles,
  Tag,
  UtensilsCrossed,
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
import "@/components/LandingPage/SpecialOffersRail.css";

type OfferCategoryTab = "ALL" | "MOVIES" | "DINING" | "EVENTS";

const TABS: Array<{
  key: OfferCategoryTab;
  label: string;
  hint: string;
  icon: typeof Tag;
}> = [
  {
    key: "ALL",
    label: "Book My Bota Offers",
    hint: "Platform-wide promos",
    icon: Tag,
  },
  {
    key: "MOVIES",
    label: "Movie Offers",
    hint: "Cinema & showtimes",
    icon: Clapperboard,
  },
  {
    key: "DINING",
    label: "Dining Offers",
    hint: "Restaurants & cafes",
    icon: UtensilsCrossed,
  },
  {
    key: "EVENTS",
    label: "Event Offers",
    hint: "Concerts & shows",
    icon: Calendar,
  },
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
    <article className={`offer-card offer-card--${theme} w-full max-w-none`}>
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

  const counts = useMemo(() => {
    const map: Record<OfferCategoryTab, number> = {
      ALL: 0,
      MOVIES: 0,
      DINING: 0,
      EVENTS: 0,
    };
    for (const o of activeOffers) {
      const cat = (o.category || "ALL").toUpperCase() as OfferCategoryTab;
      if (cat in map) map[cat] += 1;
      else map.ALL += 1;
    }
    return map;
  }, [activeOffers]);

  const filtered = useMemo(
    () => activeOffers.filter((o) => (o.category || "ALL").toUpperCase() === tab),
    [activeOffers, tab]
  );

  const activeTab = TABS.find((t) => t.key === tab) || TABS[0];

  return (
    <CustomerAccountLayout>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-5 border-b border-slate-100">
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#111111]">Offers</h2>
          <p className="mt-1 text-sm text-slate-500">
            Browse Book My Bota platform offers by category. Reveal a code and use it at checkout.
          </p>
        </div>

        <div className="flex flex-col md:flex-row min-h-[420px]">
          <aside className="md:w-[240px] shrink-0 border-b md:border-b-0 md:border-r border-slate-100 bg-[#fafafa] p-3">
            <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
              {TABS.map((item) => {
                const Icon = item.icon;
                const selected = tab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTab(item.key)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors whitespace-nowrap md:whitespace-normal cursor-pointer ${
                      selected
                        ? "bg-[#F7E9FF] text-[#6900AA]"
                        : "text-slate-700 hover:bg-white"
                    }`}
                  >
                    <Icon
                      size={18}
                      className={selected ? "text-[#6900AA] shrink-0" : "text-slate-500 shrink-0"}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold leading-tight">{item.label}</span>
                      <span className="hidden md:block text-[11px] font-normal text-slate-500 mt-0.5">
                        {item.hint}
                      </span>
                    </span>
                    <span
                      className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                        selected
                          ? "bg-white text-[#6900AA]"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {counts[item.key]}
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="flex-1 min-w-0 p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-[#111111]">{activeTab.label}</h3>
                <p className="text-sm text-slate-500">{activeTab.hint}</p>
              </div>
              {city ? (
                <p className="text-xs font-semibold text-slate-500">
                  Showing for <span className="text-[#6900AA]">{city}</span>
                </p>
              ) : null}
            </div>

            {isLoading || (isFetching && activeOffers.length === 0) ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                <Loader2 size={18} className="animate-spin" />
                Loading offers…
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
                <Tag className="mx-auto text-slate-300 mb-3" size={28} />
                <p className="font-semibold text-slate-700">No offers in this category</p>
                <p className="mt-1 text-sm text-slate-500">
                  Check back soon, or try another category on the left.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filtered.map((offer, index) => (
                  <OfferCard key={offer.id} offer={offer} index={index} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </CustomerAccountLayout>
  );
}
