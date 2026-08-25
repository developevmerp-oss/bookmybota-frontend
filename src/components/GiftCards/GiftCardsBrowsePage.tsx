"use client";

import Link from "next/link";
import { Check, Gift, Loader2, Sparkles } from "lucide-react";
import { useGetPublicGiftCardProductsQuery } from "@/services/api";
import { formatMoney } from "@/lib/currencyFormat";

function categoryLabel(cat?: string) {
  switch ((cat || "ALL").toUpperCase()) {
    case "EVENTS":
      return "Events";
    case "SPORTS":
      return "Sports";
    case "DINING":
      return "Dining";
    default:
      return "All experiences";
  }
}

export default function GiftCardsBrowsePage() {
  const { data: products = [], isLoading, isError } = useGetPublicGiftCardProductsQuery();

  return (
    <div className="bg-[#f7f5fa] min-h-[calc(100vh-4rem)]">
      <section className="relative overflow-hidden border-b border-[#EAD9F8] bg-gradient-to-br from-[#F7E9FF] via-white to-[#F3EEFF]">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#6900AA]/10 blur-2xl" />
        <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-[#9B2DE3]/10 blur-2xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 border border-[#E3BCFF] text-[#6900AA] text-xs font-bold uppercase tracking-wide mb-4">
              <Sparkles size={14} />
              BookMyBota Gift Cards
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#111111] tracking-tight">
              Give the gift of experiences
            </h1>
            <p className="mt-3 text-slate-600 text-[15px] leading-relaxed">
              Choose a denomination, buy for yourself or someone else. Redeem on Events at
              checkout, or at restaurants via partner Scan (dining bills are paid at the venue).
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-700">
              {["Instant digital delivery", "Valid up to 365 days", "Use with promo codes"].map(
                (item) => (
                  <li key={item} className="inline-flex items-center gap-1.5">
                    <Check size={14} className="text-[#6900AA] shrink-0" />
                    {item}
                  </li>
                )
              )}
            </ul>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {products.map((p) => {
              const amount = Number(p.denomination);
              const price = Number(p.selling_price ?? amount);
              return (
                <article
                  key={p.id}
                  className="group bg-white rounded-2xl border border-slate-200/90 shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden flex flex-col hover:border-[#E3BCFF] hover:shadow-[0_8px_24px_rgba(105,0,170,0.12)] transition-all duration-200"
                >
                  <div className="relative bg-gradient-to-br from-[#6900AA] via-[#7A00C6] to-[#9B2DE3] px-4 pt-5 pb-6 text-white">
                    <Gift
                      className="absolute right-3 top-3 opacity-20 group-hover:opacity-30 transition-opacity"
                      size={40}
                    />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-white/75">
                      Gift Card
                    </p>
                    <p className="text-2xl sm:text-[1.65rem] font-extrabold mt-1 tracking-tight leading-none">
                      {formatMoney(amount, { compact: true })}
                    </p>
                    <p className="text-[11px] mt-2.5 text-white/70">
                      Valid {p.validity_days || 365} days · {categoryLabel(p.applicable_category)}
                    </p>
                  </div>

                  <div className="p-4 flex flex-col flex-1 gap-2.5">
                    <h2 className="font-bold text-[#111111] text-[15px] leading-snug line-clamp-2 min-h-[2.5rem]">
                      {p.name}
                    </h2>
                    {p.description ? (
                      <p className="text-[13px] text-slate-500 line-clamp-2 leading-relaxed">
                        {p.description}
                      </p>
                    ) : (
                      <p className="text-[13px] text-slate-400">Digital gift card balance</p>
                    )}

                    <div className="mt-auto pt-3">
                      <Link
                        href={`/gift-cards/buy/${p.id}`}
                        className="inline-flex w-full items-center justify-center h-10 rounded-xl bg-[#6900AA] text-white text-sm font-semibold hover:bg-[#57008E] transition-colors"
                      >
                        Buy · {formatMoney(price, { compact: true })}
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-10 rounded-2xl border border-[#E3BCFF] bg-[#FDF8FF] px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-slate-700">
            Already have a gift card code? Claim it under{" "}
            <span className="font-semibold text-[#6900AA]">My Gift Cards</span>.
          </p>
          <Link
            href="/customer/gift-cards"
            className="inline-flex items-center justify-center h-10 px-4 rounded-xl border border-[#E3BCFF] bg-white text-sm font-semibold text-[#6900AA] hover:bg-[#F7E9FF] transition-colors shrink-0"
          >
            Claim a code
          </Link>
        </div>
      </div>
    </div>
  );
}
