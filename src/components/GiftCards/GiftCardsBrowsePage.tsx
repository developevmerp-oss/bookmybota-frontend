"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Check,
  Clock,
  Gift,
  Loader2,
  Sparkles,
  Ticket,
  Trophy,
  UtensilsCrossed,
} from "lucide-react";
import { useGetPublicGiftCardProductsQuery } from "@/services/api";
import { formatMoney, formatWholeNumber } from "@/lib/currencyFormat";
import images from "@/Images";

type CardTheme = {
  header: string;
  accent: string;
  accentMuted: string;
  pillBg: string;
  wave: string;
  gift: string;
};

/** Soft pastel themes — one unique color per card (like current multi-color set). */
const CARD_THEMES: CardTheme[] = [
  {
    header: "bg-gradient-to-br from-[#F8EFD9] via-[#F0DFB8] to-[#E2C892]",
    accent: "#8A6A1F",
    accentMuted: "#A8842E",
    pillBg: "bg-[#8A6A1F]/12",
    wave: "#F7F7F8",
    gift: "#C4A35A",
  },
  {
    header: "bg-gradient-to-br from-[#DBEAFE] via-[#BFDBFE] to-[#93C5FD]",
    accent: "#1D4ED8",
    accentMuted: "#2563EB",
    pillBg: "bg-[#1D4ED8]/12",
    wave: "#F7F7F8",
    gift: "#60A5FA",
  },
  {
    header: "bg-gradient-to-br from-[#FCE7F3] via-[#FBCFE8] to-[#F9A8D4]",
    accent: "#BE185D",
    accentMuted: "#DB2777",
    pillBg: "bg-[#BE185D]/12",
    wave: "#F7F7F8",
    gift: "#F472B6",
  },
  {
    header: "bg-gradient-to-br from-[#EDE9FE] via-[#DDD6FE] to-[#C4B5FD]",
    accent: "#5B21B6",
    accentMuted: "#7C3AED",
    pillBg: "bg-[#5B21B6]/12",
    wave: "#F7F7F8",
    gift: "#A78BFA",
  },
  {
    header: "bg-gradient-to-br from-[#CCFBF1] via-[#99F6E4] to-[#5EEAD4]",
    accent: "#0F766E",
    accentMuted: "#0D9488",
    pillBg: "bg-[#0F766E]/12",
    wave: "#F7F7F8",
    gift: "#2DD4BF",
  },
];

function heroSrc(img: string | { src: string }) {
  return typeof img === "string" ? img : img.src;
}

function WaveDivider({ fill }: { fill: string }) {
  return (
    <svg
      className="absolute bottom-0 left-0 w-full h-10 sm:h-11"
      viewBox="0 0 400 48"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M0 28
           C33 12, 67 12, 100 28
           C133 44, 167 44, 200 28
           C233 12, 267 12, 300 28
           C333 44, 367 44, 400 28
           L400 48 L0 48 Z"
        fill={fill}
      />
    </svg>
  );
}

export default function GiftCardsBrowsePage() {
  const { data: products = [], isLoading, isError } = useGetPublicGiftCardProductsQuery();

  return (
    <div className="bg-[#f7f5fa] min-h-[calc(100vh-4rem)]">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[#e8d9ff]" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 28%, rgba(255,255,255,0.85) 0, rgba(255,255,255,0) 42%), radial-gradient(circle at 72% 18%, rgba(255,255,255,0.7) 0, rgba(255,255,255,0) 36%), radial-gradient(circle at 88% 72%, rgba(255,255,255,0.55) 0, rgba(255,255,255,0) 40%), radial-gradient(circle at 40% 80%, rgba(155,45,227,0.12) 0, transparent 28%)",
          }}
        />
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-[#6900AA]/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-[#9B2DE3]/10 blur-3xl"
          aria-hidden
        />

        <div className="relative container mx-auto">
          <div className="flex flex-col lg:flex-row items-stretch">
            <div className="max-w-2xl w-full lg:w-1/2 order-2 lg:order-1 px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-25 flex flex-col justify-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E3BCFF] text-[#6900AA] text-xs font-bold uppercase tracking-wide mb-4 w-fit">
                <Sparkles size={14} />
                BookMyBota Gift Cards
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold text-[#111111] tracking-tight leading-[1.15]">
                Give the gift of experiences
              </h1>
              <p className="mt-3 text-slate-600 text-[15px] sm:text-base leading-relaxed">
                Choose a denomination, buy for yourself or someone else. Redeem on Events at
                checkout, or at restaurants via partner Scan (dining bills are paid at the venue).
              </p>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2.5 text-sm text-slate-700">
                {["Instant digital delivery", "Valid up to 365 days", "Use with promo codes"].map(
                  (item) => (
                    <li key={item} className="inline-flex items-center gap-1.5">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shrink-0">
                        <Check size={12} className="text-[#6900AA]" strokeWidth={2.5} />
                      </span>
                      {item}
                    </li>
                  )
                )}
              </ul>
            </div>

            <div className="relative mt-4 order-1 lg:order-2 w-full lg:w-1/2 min-h-[320px] sm:min-h-[380px] lg:min-h-full self-stretch">
              <Image
                src={heroSrc(images.gifthero)}
                alt="BookMyBota gift cards"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover object-center"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-12 pb-10 sm:pb-14">
        <div className="flex flex-col items-center text-center mb-8 sm:mb-10">
          <h2 className="flex items-center justify-center gap-2.5 text-2xl sm:text-3xl font-extrabold text-[#1a1a2e] tracking-tight">
            <Sparkles size={18} className="text-[#6900AA] shrink-0" fill="currentColor" />
            Choose a gift card
            <Sparkles size={18} className="text-[#6900AA] shrink-0" fill="currentColor" />
          </h2>
          <p className="mt-2 text-slate-500 text-[15px]">
            Select a value and make someone&apos;s day extra special.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20 text-slate-500 gap-2 items-center">
            <Loader2 className="animate-spin" size={20} />
            Loading gift cards…
          </div>
        ) : isError ? (
          <p className="text-center text-rose-600 py-16">Could not load gift cards. Try again later.</p>
        ) : products.length === 0 ? (
          <p className="text-center text-slate-500 py-16">No gift cards are available right now.</p>
        ) : (
          <div className="flex flex-wrap justify-start gap-5">
            {products.map((p, index) => {
              const amount = Number(p.denomination);
              const price = Number(p.selling_price ?? amount);
              const amountNum = formatWholeNumber(amount);
              const amountLabel = formatMoney(amount, { compact: true });
              const theme = CARD_THEMES[index % CARD_THEMES.length];
              const days = p.validity_days || 365;

              return (
                <article
                  key={p.id}
                  className="group flex flex-col w-full max-w-[260px] sm:w-[calc((100%-1.25rem)/2)] md:w-[calc((100%-2.5rem)/3)] lg:w-[calc((100%-3.75rem)/4)] lg:max-w-none rounded-2xl border border-slate-200/70 shadow-[0_6px_20px_rgba(17,17,17,0.07)] overflow-hidden bg-[#F7F7F8] hover:shadow-[0_10px_28px_rgba(17,17,17,0.1)] transition-shadow duration-300"
                >
                  {/* Colored header + wave */}
                  <div className={`relative ${theme.header} px-4 pt-5 sm:pt-6 pb-12 sm:pb-14 min-h-[9.5rem] sm:min-h-[10.5rem]`}>
                    <div className="relative z-[1] flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p
                          className="text-[10px] font-bold uppercase tracking-[0.14em]"
                          style={{ color: theme.accentMuted }}
                        >
                          Gift Card
                        </p>
                        <p className="mt-1.5 flex items-baseline gap-1.5 leading-none">
                          <span
                            className="text-[2rem] font-extrabold tracking-tight"
                            style={{ color: theme.accent }}
                          >
                            {amountNum}
                          </span>
                          <span
                            className="text-base font-bold"
                            style={{ color: theme.accentMuted }}
                          >
                            ETB
                          </span>
                        </p>
                        <span
                          className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${theme.pillBg}`}
                          style={{ color: theme.accent }}
                        >
                          <Clock size={11} strokeWidth={2.25} />
                          Valid up to {days} days
                        </span>
                      </div>

                      <div className="relative shrink-0 w-[5.5rem] h-[5.5rem] sm:w-[6rem] sm:h-[6rem] -mr-1 mt-0">
                        <Image
                          src={heroSrc(images.giftbox)}
                          alt=""
                          width={96}
                          height={96}
                          className="w-full h-full object-contain drop-shadow-sm"
                        />
                      </div>
                    </div>
                    <WaveDivider fill={theme.wave} />
                  </div>

                  {/* Body */}
                  <div className="px-4 pb-4 pt-1 flex flex-col flex-1 items-center text-center -mt-1">
                    <div className="flex w-full justify-around gap-1 mb-3.5">
                      {[
                        { Icon: Ticket, label: "Events" },
                        { Icon: Trophy, label: "Sports" },
                        { Icon: UtensilsCrossed, label: "Dining" },
                      ].map(({ Icon, label }) => (
                        <div key={label} className="flex flex-col items-center pt-5 gap-1 min-w-0">
                          <Icon
                            size={28}
                            strokeWidth={1.6}
                            style={{ color: theme.accentMuted }}
                          />
                          <span className="text-[14px] text-slate-500 font-medium">{label}</span>
                        </div>
                      ))}
                    </div>

                    {/* <h3 className="font-bold text-[#222222] text-[13px] sm:text-[14px] leading-snug">
                      BookMyBota Gift Card {amountLabel}
                    </h3>
                    <p className="mt-1 text-[11px] sm:text-[12px] text-slate-500 leading-relaxed line-clamp-2">
                      {p.description?.trim() || "Give the gift of Events, Sports & Dining"}
                    </p> */}

                    <div className="mt-auto pt-4 w-full">
                      <Link
                        href={`/gift-cards/buy/${p.id}`}
                        className="inline-flex w-full items-center justify-center gap-2 h-10 rounded-full border bg-white text-sm font-semibold will-change-transform hover:scale-[1.06] active:scale-[0.98] transition-[transform,background-color,color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] origin-center"
                        style={{ borderColor: theme.accent, color: theme.accent }}
                      >
                        Buy for {formatMoney(price, { compact: true })}
                        <ArrowRight size={15} strokeWidth={2.25} />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-10 mx-auto max-w-5xl sm:mt-12 rounded-2xl border border-[#E3BCFF] bg-[#e8d9ff] px-5 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#6900AA]">
              <Gift size={30} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="font-bold text-[#6900AA] text-[15px] leading-snug">
                Already have a gift card?
              </p>
              <p className="mt-0.5 text-sm text-slate-500 leading-snug">
                Redeem your gift card and start exploring amazing experiences.
              </p>
            </div>
          </div>
          <Link
            href="/customer/gift-cards"
            className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl border border-[#6900AA] bg-white text-sm font-semibold text-[#6900AA] hover:text-white hover:bg-[#6900aa] transition-colors shrink-0"
          >
            Redeem a gift card
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
