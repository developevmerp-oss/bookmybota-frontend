"use client";

import { useState } from "react";
import Link from "next/link";
import { Gift, Loader2, Ticket } from "lucide-react";
import { toast } from "sonner";
import {
  useClaimGiftCardMutation,
  useGetMyGiftCardsQuery,
  type GiftCardMine,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { formatMoney } from "@/lib/currencyFormat";
import CustomerAccountLayout from "@/components/Shared/CustomerAccountLayout";

function statusStyles(status?: string) {
  const s = (status || "").toUpperCase();
  if (s === "ACTIVE") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "PARTIALLY_USED") return "bg-amber-50 text-amber-800 border-amber-200";
  if (s === "FULLY_USED") return "bg-slate-100 text-slate-600 border-slate-200";
  if (s === "EXPIRED" || s === "BLOCKED") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

function GiftCardTile({ card }: { card: GiftCardMine }) {
  const balance = Number(card.current_balance) || 0;
  const initial = Number(card.initial_balance) || 0;
  const usedPct =
    initial > 0 ? Math.min(100, Math.round(((initial - balance) / initial) * 100)) : 0;

  return (
    <Link
      href={`/customer/gift-cards/${card.id}`}
      className="group block rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-[#E3BCFF] hover:shadow-[0_8px_24px_rgba(105,0,170,0.1)] transition-all"
    >
      <div className="relative bg-gradient-to-br from-[#6900AA] via-[#7A00C6] to-[#9B2DE3] px-4 pt-4 pb-5 text-white">
        <Gift
          className="absolute right-3 top-3 opacity-20 group-hover:opacity-30 transition-opacity"
          size={36}
        />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/75">
          Balance
        </p>
        <p className="text-2xl font-extrabold tracking-tight leading-none mt-1">
          {formatMoney(balance, { compact: true })}
        </p>
        <p className="text-[11px] text-white/70 mt-2 font-mono">{card.code_masked}</p>
      </div>

      <div className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-[#111111] text-[14px] leading-snug line-clamp-2">
            {card.product_name || "Gift Card"}
          </h3>
          <span
            className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${statusStyles(
              card.status
            )}`}
          >
            {card.status}
          </span>
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-slate-500 mb-1">
            <span>Used {usedPct}%</span>
            <span>of {formatMoney(initial, { compact: true })}</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#6900AA]/80"
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </div>

        {card.purchase_for === "SOMEONE_ELSE" && card.recipient_name ? (
          <p className="text-xs text-slate-500">
            Gift for {card.recipient_name}
            {!card.is_claimed_by_me ? " · awaiting claim" : ""}
          </p>
        ) : card.expires_at ? (
          <p className="text-xs text-slate-500">
            Expires {new Date(card.expires_at).toLocaleDateString()}
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl font-extrabold text-[#111111]">My Gift Cards</h2>
            <p className="text-sm text-slate-500 mt-1">
              {cards.length > 0
                ? `${cards.length} card${cards.length === 1 ? "" : "s"} · tap one for details`
                : "Balance-backed BookMyBota cards you bought or claimed."}
            </p>
          </div>
          <Link
            href="/gift-cards"
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[#6900AA] text-white text-sm font-semibold hover:bg-[#57008E]"
          >
            <Gift size={16} />
            Buy a gift card
          </Link>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-6">
          <p className="text-sm font-semibold text-[#111111] mb-2">Claim a code</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="BOTA-XXXX-XXXX-XXXX"
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#6900AA]/25 focus:border-[#6900AA]"
            />
            <button
              type="button"
              disabled={claiming}
              onClick={handleClaim}
              className="h-11 px-5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 cursor-pointer inline-flex items-center justify-center gap-2"
            >
              {claiming ? <Loader2 className="animate-spin" size={16} /> : <Ticket size={16} />}
              Claim
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500 py-12 justify-center">
            <Loader2 className="animate-spin" size={18} /> Loading…
          </div>
        ) : isError ? (
          <p className="text-center text-rose-600 py-10">Could not load gift cards.</p>
        ) : cards.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Gift className="mx-auto mb-3 text-slate-300" size={40} />
            <p className="font-medium text-slate-700">No gift cards yet</p>
            <p className="text-sm mt-1">Buy one or claim a code you received.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cards.map((card) => (
              <GiftCardTile key={card.id} card={card} />
            ))}
          </div>
        )}
      </div>
    </CustomerAccountLayout>
  );
}
