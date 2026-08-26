"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Gift, Loader2, Ticket } from "lucide-react";
import { toast } from "sonner";
import {
  useClaimGiftCardMutation,
  useGetMyGiftCardsQuery,
  type GiftCardMine,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { formatMoney } from "@/lib/currencyFormat";
import CustomerAccountLayout from "@/components/Shared/CustomerAccountLayout";

const CARD_HEADERS = [
  "bg-gradient-to-br from-[#6900AA] via-[#7C3AED] to-[#9B2DE3]",
  "bg-gradient-to-br from-[#2563EB] via-[#3B82F6] to-[#60A5FA]",
  "bg-gradient-to-br from-[#DB2777] via-[#EC4899] to-[#F472B6]",
  "bg-gradient-to-br from-[#D97706] via-[#F59E0B] to-[#FBBF24]",
  "bg-gradient-to-br from-[#0D9488] via-[#14B8A6] to-[#2DD4BF]",
  "bg-gradient-to-br from-[#EA580C] via-[#F97316] to-[#FB923C]",
  "bg-gradient-to-br from-[#4F46E5] via-[#6366F1] to-[#818CF8]",
  "bg-gradient-to-br from-[#16A34A] via-[#22C55E] to-[#4ADE80]",
];

function statusStyles(status?: string) {
  const s = (status || "").toUpperCase();
  if (s === "ACTIVE") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "PARTIALLY_USED") return "bg-amber-50 text-amber-800 border-amber-200";
  if (s === "FULLY_USED") return "bg-slate-100 text-slate-600 border-slate-200";
  if (s === "EXPIRED" || s === "BLOCKED") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

function GiftCardTile({ card, index }: { card: GiftCardMine; index: number }) {
  const balance = Number(card.current_balance) || 0;
  const initial = Number(card.initial_balance) || 0;
  const usedPct =
    initial > 0 ? Math.min(100, Math.round(((initial - balance) / initial) * 100)) : 0;
  const header = CARD_HEADERS[index % CARD_HEADERS.length];

  return (
    <Link
      href={`/customer/gift-cards/${card.id}`}
      className="group flex flex-col w-full sm:w-[calc((100%-1rem)/2)] md:w-[calc((100%-2rem)/3)] xl:w-[calc((100%-3rem)/4)] rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-[0_2px_8px_rgba(17,17,17,0.05)] hover:shadow-[0_10px_28px_rgba(105,0,170,0.14)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300"
    >
      <div className={`relative ${header} px-4 pt-4 pb-5 text-white`}>
        <Gift
          className="absolute right-3 top-3 opacity-25 group-hover:opacity-40 transition-opacity"
          size={40}
          strokeWidth={1.5}
        />
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">
          Balance
        </p>
        <p className="text-[1.65rem] font-extrabold tracking-tight leading-none mt-1.5">
          {formatMoney(balance, { compact: true })}
        </p>
        <p className="text-[11px] text-white/75 mt-2.5 font-mono tracking-wide">
          {card.code_masked}
        </p>
      </div>

      <div className="p-4 flex flex-col gap-2.5 flex-1">
        <div className="flex flex-row items-start justify-between gap-2">
          <h3 className="font-bold text-[#111827] text-[13px] sm:text-[14px] leading-snug line-clamp-2">
            {card.product_name || "BookMyBota Gift Card"}
          </h3>
          <span
            className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${statusStyles(
              card.status
            )}`}
          >
            {card.status}
          </span>
        </div>

        <p className="text-[13px] font-semibold text-[#1F2937]">
          {formatMoney(balance, { compact: true })}
        </p>

        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] text-[#6B7280]">
            Used {usedPct}% of {formatMoney(initial, { compact: true })}
          </p>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#6900AA]/75"
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </div>

        {card.expires_at ? (
          <p className="mt-auto pt-1 inline-flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
            <CalendarDays size={12} strokeWidth={2} />
            Expires {new Date(card.expires_at).toLocaleDateString()}
          </p>
        ) : card.purchase_for === "SOMEONE_ELSE" && card.recipient_name ? (
          <p className="mt-auto pt-1 text-[11px] text-[#9CA3AF]">
            Gift for {card.recipient_name}
            {!card.is_claimed_by_me ? " · awaiting claim" : ""}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export default function CustomerGiftCardsPage() {
  const { data: cards = [], isLoading, isError, refetch } = useGetMyGiftCardsQuery();
  const [claim, { isLoading: claiming }] = useClaimGiftCardMutation();
  const [code, setCode] = useState("");

  const handleClaim = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      toast.error("Enter a gift card code");
      return;
    }
    try {
      const res = await claim({ code: trimmed }).unwrap();
      toast.success(res.message || "Gift card claimed");
      setCode("");
      void refetch();
    } catch (err) {
      toast.error(extractApiError(err) || "Could not claim gift card");
    }
  };

  return (
    <CustomerAccountLayout>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 flex flex-col gap-4 sm:gap-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-start justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <h2 className="text-[20px] sm:text-2xl font-extrabold text-[#1a1040] tracking-tight">
              My Gift Cards
            </h2>
            <p className="text-[13px] sm:text-sm text-[#6B7280]">
              {cards.length > 0
                ? `${cards.length} card${cards.length === 1 ? "" : "s"} • Tap a card to view details`
                : "Balance-backed BookMyBota cards you bought or claimed."}
            </p>
          </div>
          <Link
            href="/gift-cards"
            className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-[#6900AA] text-white text-sm font-semibold hover:bg-[#57008E] transition-colors shrink-0 w-full sm:w-auto"
          >
            <Gift size={16} />
            Buy a gift card
          </Link>
        </div>

        {/* Claim a code */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-3.5 sm:p-4 flex flex-col gap-2.5">
          <p className="text-sm font-bold text-[#111827]">Claim a code</p>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter gift card code (e.g. BOTA-XXXX-XXXX-XXXX)"
              className="flex-1 min-w-0 px-3 sm:px-4 py-2.5 rounded-xl border border-[#E5E7EB] bg-white font-mono text-[13px] sm:text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6900AA]/25 focus:border-[#6900AA]"
            />
            <button
              type="button"
              disabled={claiming}
              onClick={handleClaim}
              className="h-11 px-5 rounded-xl border border-[#111827] bg-white text-sm font-semibold text-[#111827] hover:bg-slate-50 disabled:opacity-60 cursor-pointer inline-flex items-center justify-center gap-2 shrink-0 w-full sm:w-auto"
            >
              {claiming ? <Loader2 className="animate-spin" size={16} /> : <Ticket size={16} />}
              Claim
            </button>
          </div>
        </div>

        {/* Cards */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500 py-12 justify-center">
            <Loader2 className="animate-spin" size={18} /> Loading…
          </div>
        ) : isError ? (
          <p className="text-center text-rose-600 py-10">Could not load gift cards.</p>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center text-center py-12 text-slate-500">
            <Gift className="mb-3 text-slate-300" size={40} />
            <p className="font-medium text-slate-700">No gift cards yet</p>
            <p className="text-sm mt-1">Buy one or claim a code you received.</p>
          </div>
        ) : (
          <div className="flex flex-wrap justify-start gap-4">
            {cards.map((card, index) => (
              <GiftCardTile key={card.id} card={card} index={index} />
            ))}
          </div>
        )}
      </div>
    </CustomerAccountLayout>
  );
}
