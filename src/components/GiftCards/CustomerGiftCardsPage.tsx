"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { CalendarDays, Gift, Loader2, Send, Ticket, User, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  useClaimGiftCardMutation,
  useGetMyGiftCardsQuery,
  type GiftCardMine,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { formatMoney } from "@/lib/currencyFormat";
import { formatGiftCardExpiryDate } from "@/lib/giftCardValidity";
import {
  getSentGiftClaimState,
  isGiftCardInWallet,
  isGiftCardSentGift,
} from "@/lib/giftCardOwnership";
import {
  customerGiftCardClaimSchema,
  type CustomerGiftCardClaimValues,
} from "@/lib/giftCardFormSchemas";
import CustomerAccountLayout from "@/components/Shared/CustomerAccountLayout";
import GiftCardDesignFace from "@/components/GiftCards/GiftCardDesignFace";
import GiftCardCodeReveal from "@/components/GiftCards/GiftCardCodeReveal";

type TabId = "wallet" | "sent";

function statusStyles(status?: string) {
  const s = (status || "").toUpperCase();
  if (s === "ACTIVE") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "PARTIALLY_USED") return "bg-amber-50 text-amber-800 border-amber-200";
  if (s === "FULLY_USED") return "bg-slate-100 text-slate-600 border-slate-200";
  if (s === "EXPIRED" || s === "BLOCKED") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

function statusLabel(status?: string) {
  return (status || "").toUpperCase().replace(/_/g, " ") || "UNKNOWN";
}

function GiftCardTile({
  card,
  variant,
}: {
  card: GiftCardMine;
  variant: TabId;
}) {
  const balance = Number(card.current_balance) || 0;
  const initial = Number(card.initial_balance) || 0;
  const usedAmount =
    card.used_amount != null
      ? Number(card.used_amount) || 0
      : Math.max(0, initial - balance);
  const usedPct =
    initial > 0 ? Math.min(100, Math.round((usedAmount / initial) * 100)) : 0;
  const remainingPct = Math.max(0, 100 - usedPct);
  const claimState = getSentGiftClaimState(card);
  const isSent = variant === "sent";

  const design = {
    title: (card.design_title || "Gift Card").trim() || "Gift Card",
    image_url: card.design_image_url,
    color_gradient: card.design_color_gradient,
    caption_color: card.design_caption_color || "#FFFFFF",
    text_color: card.design_text_color || "#FFFFFF",
  };

  return (
    <Link
      href={`/customer/gift-cards/${card.id}`}
      className="group flex flex-col rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-[0_2px_8px_rgba(17,17,17,0.05)] hover:shadow-[0_12px_28px_rgba(105,0,170,0.16)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6900AA]/40"
    >
      <GiftCardDesignFace
        design={design}
        className="aspect-[16/10] w-full rounded-none! group-hover:brightness-[1.03] transition-[filter]"
      />

      <div className="p-3.5 sm:p-4 flex flex-col gap-2.5 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF]">
              {isSent ? "Gift value" : "Available balance"}
            </p>
            <p className="text-[1.35rem] font-bold text-[#111827] tracking-tight leading-none mt-1">
              {formatMoney(isSent ? initial : balance, { compact: true })}
            </p>
            {isSent && balance !== initial ? (
              <p className="text-[11px] text-[#6B7280] mt-1">
                Remaining {formatMoney(balance, { compact: true })}
              </p>
            ) : null}
          </div>
          {isSent ? (
            <span
              className={`shrink-0 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${
                claimState === "awaiting_claim"
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-sky-50 text-sky-800 border-sky-200"
              }`}
            >
              {claimState === "awaiting_claim" ? "Awaiting claim" : "Claimed"}
            </span>
          ) : (
            <span
              className={`shrink-0 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${statusStyles(
                card.status
              )}`}
            >
              {statusLabel(card.status)}
            </span>
          )}
        </div>

        {!isSent ? (
          <>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <GiftCardCodeReveal
                code={card.code}
                codeMasked={card.code_masked}
                tone="dark"
                className="min-w-0"
              />
              <p className="text-[11px] text-[#9CA3AF] shrink-0">{remainingPct}% left</p>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#6900AA] transition-[width] duration-300"
                style={{ width: `${remainingPct}%` }}
                aria-hidden
              />
            </div>
          </>
        ) : (
          <GiftCardCodeReveal
            code={card.code}
            codeMasked={card.code_masked}
            tone="dark"
          />
        )}

        <div className="mt-auto pt-1 flex flex-col gap-1.5">
          {card.expires_at ? (
            <p className="inline-flex items-center gap-1.5 text-[11px] text-[#6B7280]">
              <CalendarDays size={12} strokeWidth={2} className="text-[#9CA3AF] shrink-0" />
              Valid until {formatGiftCardExpiryDate(card.expires_at)}
            </p>
          ) : null}
          {isSent && card.recipient_name ? (
            <p className="inline-flex items-center gap-1.5 text-[11px] text-[#6B7280] min-w-0">
              <User size={12} strokeWidth={2} className="text-[#9CA3AF] shrink-0" />
              <span className="truncate">Gift for {card.recipient_name}</span>
            </p>
          ) : null}
          {isSent ? (
            <p className="text-[11px] text-[#9CA3AF] leading-snug">
              {claimState === "awaiting_claim"
                ? "Recipient must claim the code from their email before they can spend this balance."
                : "Recipient has claimed this card. You cannot spend this balance."}
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export default function CustomerGiftCardsPage() {
  const searchParams = useSearchParams();
  const codeFromMail = (
    searchParams.get("code") ||
    searchParams.get("claim") ||
    ""
  )
    .trim()
    .toUpperCase();
  const tabParam = searchParams.get("tab");
  const { data: cards = [], isLoading, isError, refetch } = useGetMyGiftCardsQuery();
  const [claim, { isLoading: claiming }] = useClaimGiftCardMutation();
  const [tab, setTab] = useState<TabId>(tabParam === "sent" ? "sent" : "wallet");

  const walletCards = useMemo(() => cards.filter(isGiftCardInWallet), [cards]);
  const sentCards = useMemo(() => cards.filter(isGiftCardSentGift), [cards]);

  const walletAvailable = useMemo(
    () => walletCards.reduce((sum, c) => sum + (Number(c.current_balance) || 0), 0),
    [walletCards]
  );

  const visibleCards = tab === "wallet" ? walletCards : sentCards;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CustomerGiftCardClaimValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(customerGiftCardClaimSchema) as any,
    defaultValues: { code: codeFromMail },
    mode: "onSubmit",
  });

  useEffect(() => {
    if (codeFromMail) {
      setValue("code", codeFromMail, { shouldValidate: false });
      setTab("wallet");
    }
  }, [codeFromMail, setValue]);

  const onClaim = async (values: CustomerGiftCardClaimValues) => {
    try {
      const res = await claim({ code: values.code.trim().toUpperCase() }).unwrap();
      toast.success(res.message || "Gift card claimed — it’s now in your wallet");
      reset({ code: "" });
      setTab("wallet");
      void refetch();
    } catch (err) {
      toast.error(extractApiError(err, "Could not claim gift card"));
    }
  };

  return (
    <CustomerAccountLayout>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 flex flex-col gap-4 sm:gap-5">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-start justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <h2 className="text-[20px] sm:text-2xl font-bold text-[#1a1040] tracking-tight">
              My Gift Cards
            </h2>
            <p className="text-[13px] sm:text-sm text-[#6B7280]">
              {walletCards.length > 0
                ? `${formatMoney(walletAvailable, { compact: true })} ready to spend · ${walletCards.length} in wallet · ${sentCards.length} sent`
                : sentCards.length > 0
                  ? `${sentCards.length} gift${sentCards.length === 1 ? "" : "s"} sent · Claim a code to add balance to your wallet`
                  : "Claim a code you received, or buy a gift for someone else."}
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

        <form
          onSubmit={handleSubmit(onClaim)}
          noValidate
          className="rounded-2xl border border-[#E8D5FF] bg-[#F9F5FF] p-3.5 sm:p-4 flex flex-col gap-2.5"
        >
          <p className="text-sm font-bold text-[#111827]">Claim a gift card code</p>
          <p className="text-[12px] text-slate-500 -mt-1">
            Enter the code from your gift email to add it to <strong className="font-semibold text-slate-600">My wallet</strong>.
            Spending happens later at event or dining checkout — not here.
          </p>
          <label className="text-sm font-semibold text-[#1F2937]">
            Gift card code <span className="text-rose-500">*</span>
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              placeholder="Enter gift card code (e.g. BOTA-XXXX-XXXX-XXXX)"
              className="flex-1 min-w-0 px-3 sm:px-4 py-2.5 rounded-xl border border-[#E5E7EB] bg-white font-mono text-[13px] sm:text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6900AA]/25 focus:border-[#6900AA]"
              {...register("code", {
                onChange: (e) => {
                  e.target.value = String(e.target.value || "").toUpperCase();
                },
              })}
            />
            <button
              type="submit"
              disabled={claiming}
              className="h-11 px-5 rounded-xl bg-[#6900AA] hover:bg-[#57008E] text-white text-sm font-semibold disabled:opacity-60 cursor-pointer inline-flex items-center justify-center gap-2 shrink-0 w-full sm:w-auto"
            >
              {claiming ? <Loader2 className="animate-spin" size={16} /> : <Ticket size={16} />}
              Claim to wallet
            </button>
          </div>
          {errors.code && (
            <p className="text-[12px] font-semibold text-rose-500">{errors.code.message}</p>
          )}
        </form>

        <div
          className="flex flex-row gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/80"
          role="tablist"
          aria-label="Gift card lists"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "wallet"}
            onClick={() => setTab("wallet")}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              tab === "wallet"
                ? "bg-white text-[#6900AA] shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Wallet size={15} />
            My wallet
            <span className="text-[11px] font-bold text-slate-400">{walletCards.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "sent"}
            onClick={() => setTab("sent")}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              tab === "sent"
                ? "bg-white text-[#6900AA] shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Send size={15} />
            Sent gifts
            <span className="text-[11px] font-bold text-slate-400">{sentCards.length}</span>
          </button>
        </div>

        {tab === "sent" ? (
          <p className="text-[12px] text-slate-500 -mt-2">
            Gifts you bought for someone else. Tracking only — these balances cannot be spent from your account.
          </p>
        ) : (
          <p className="text-[12px] text-slate-500 -mt-2">
            Cards claimed to this account. Use them when paying for Events or Dining.
          </p>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500 py-12 justify-center">
            <Loader2 className="animate-spin" size={18} /> Loading…
          </div>
        ) : isError ? (
          <p className="text-center text-rose-600 py-10">Could not load gift cards.</p>
        ) : visibleCards.length === 0 ? (
          <div className="flex flex-col items-center text-center py-12 text-slate-500">
            {tab === "wallet" ? (
              <>
                <Wallet className="mb-3 text-slate-300" size={40} />
                <p className="font-medium text-slate-700">No cards in your wallet yet</p>
                <p className="text-sm mt-1 max-w-sm">
                  Claim a code from your gift email above, or ask the sender to resend the code.
                </p>
                {sentCards.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setTab("sent")}
                    className="mt-4 text-sm font-semibold text-[#6900AA] hover:underline cursor-pointer"
                  >
                    View {sentCards.length} sent gift{sentCards.length === 1 ? "" : "s"}
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <Send className="mb-3 text-slate-300" size={40} />
                <p className="font-medium text-slate-700">No sent gifts yet</p>
                <p className="text-sm mt-1">Buy a gift card for someone else to track it here.</p>
                <Link
                  href="/gift-cards"
                  className="mt-4 text-sm font-semibold text-[#6900AA] hover:underline"
                >
                  Buy a gift card
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleCards.map((card) => (
              <GiftCardTile key={card.id} card={card} variant={tab} />
            ))}
          </div>
        )}
      </div>
    </CustomerAccountLayout>
  );
}
