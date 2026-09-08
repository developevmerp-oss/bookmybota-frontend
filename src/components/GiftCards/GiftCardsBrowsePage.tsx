"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Ticket } from "lucide-react";
import {
  useGetPublicGiftCardDesignCategoriesQuery,
  useGetPublicGiftCardDesignsQuery,
  useGetPublicGiftCardSettingsQuery,
} from "@/services/api";
import GiftCardDesignFace from "@/components/GiftCards/GiftCardDesignFace";
import {
  DEFAULT_GIFT_CARD_VALIDITY_DAYS,
  formatGiftCardValidityLabel,
} from "@/lib/giftCardValidity";

export default function GiftCardsBrowsePage() {
  const [category, setCategory] = useState<string>("all");

  const { data: categories = [] } = useGetPublicGiftCardDesignCategoriesQuery();
  const queryArg = useMemo(
    () => (category === "all" ? undefined : { category }),
    [category]
  );
  const { data: designs = [], isLoading, isError } = useGetPublicGiftCardDesignsQuery(queryArg);
  const { data: settings } = useGetPublicGiftCardSettingsQuery();
  const validityLabel = formatGiftCardValidityLabel(
    settings?.validity_days || DEFAULT_GIFT_CARD_VALIDITY_DAYS
  );

  const tabs = useMemo(
    () => [
      { key: "all", label: "All" },
      ...categories.map((c) => ({ key: c.code, label: c.name })),
    ],
    [categories]
  );

  return (
    <div className="bg-white min-h-[calc(100vh-4rem)]">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 pb-12 sm:pb-16">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1a1a1a] tracking-tight">
            BookMyBota Gift Cards
          </h1>
          <p className="mt-2 text-sm sm:text-[15px] text-slate-500 max-w-xl mx-auto">
            Pick a design, choose an amount, and email an e-gift to someone special.
            Cards are valid for {validityLabel} from delivery.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 sm:gap-2.5 mb-7 sm:mb-10">
          {tabs.map((tab) => {
            const active = category === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCategory(tab.key)}
                className={`h-9 sm:h-10 px-4 sm:px-5 rounded-full text-[13px] sm:text-sm font-semibold border transition-colors cursor-pointer ${
                  active
                    ? "bg-[#6900AA] border-[#6900AA] text-white shadow-[0_4px_14px_rgba(105,0,170,0.28)]"
                    : "bg-white border-slate-300 text-slate-700 hover:border-[#6900AA]/50 hover:text-[#6900AA]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20 text-slate-500 gap-2 items-center">
            <Loader2 className="animate-spin" size={20} />
            Loading designs…
          </div>
        ) : isError ? (
          <p className="text-center text-rose-600 py-16">Could not load designs. Try again later.</p>
        ) : designs.length === 0 ? (
          <p className="text-center text-slate-500 py-16">
            No gift card designs are available right now.
          </p>
        ) : (
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {designs.map((design) => (
              <Link
                key={design.id}
                href={`/gift-cards/buy/${design.id}`}
                className="group block rounded-2xl overflow-hidden shadow-[0_4px_16px_rgba(17,17,17,0.08)] hover:shadow-[0_12px_28px_rgba(17,17,17,0.14)] hover:-translate-y-0.5 transition-[transform,shadow] duration-300 ring-1 ring-black/5"
              >
                <GiftCardDesignFace
                  design={design}
                  className="aspect-[16/10] w-full group-hover:brightness-[1.03] transition-[filter]"
                />
              </Link>
            ))}
          </div>
        )}

        {/* Redeem / claim — customer wallet */}
        <div className="mt-10 sm:mt-14 mx-auto max-w-3xl rounded-2xl border border-[#E8D5FF] bg-[#F9F5FF] px-4 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white border border-[#E8D5FF] text-[#6900AA]">
              <Ticket size={22} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="font-bold text-[#1a1a1a]">Already have a gift card?</p>
              <p className="text-sm text-slate-500 mt-0.5">
                Claim it to your BookMyBota wallet and redeem at checkout.
              </p>
            </div>
          </div>
          <Link
            href="/my-gift-cards"
            className="shrink-0 inline-flex items-center justify-center h-10 px-5 rounded-full bg-[#6900AA] text-white text-sm font-semibold hover:bg-[#56008a] transition-colors"
          >
            My Gift Cards
          </Link>
        </div>
      </div>
    </div>
  );
}
