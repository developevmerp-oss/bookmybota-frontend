"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  ShoppingBag,
  TrendingUp,
  User,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import { useGetMyGiftCardQuery } from "@/services/api";
import { formatMoney } from "@/lib/currencyFormat";
import { formatGiftCardExpiryDate } from "@/lib/giftCardValidity";
import {
  getSentGiftClaimState,
  isGiftCardInWallet,
  isGiftCardSentGift,
} from "@/lib/giftCardOwnership";
import CustomerAccountLayout from "@/components/Shared/CustomerAccountLayout";
import GiftCardDesignFace from "@/components/GiftCards/GiftCardDesignFace";
import GiftCardCodeReveal from "@/components/GiftCards/GiftCardCodeReveal";
import images from "@/Images";

function imgSrc(img: string | { src: string }) {
  return typeof img === "string" ? img : img.src;
}

function statusBadge(status?: string) {
  const s = (status || "").toUpperCase();
  if (s === "ACTIVE") return "bg-[#14532D] text-[#86EFAC]";
  if (s === "PARTIALLY_USED") return "bg-amber-900/80 text-amber-100";
  if (s === "FULLY_USED") return "bg-slate-700 text-slate-200";
  if (s === "EXPIRED" || s === "BLOCKED") return "bg-rose-900/80 text-rose-100";
  return "bg-white/20 text-white";
}

export default function CustomerGiftCardDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { data: card, isLoading, isError } = useGetMyGiftCardQuery(id, { skip: !id });

  const usedAmount = useMemo(() => {
    if (!card) return 0;
    if (card.used_amount != null) return Number(card.used_amount) || 0;
    return Math.max(0, Number(card.initial_balance) - Number(card.current_balance));
  }, [card]);

  const purchaseLabel =
    card?.purchase_for === "SELF" ? "Purchased for myself (legacy)" : "Gift for someone else";

  const recipientLabel = card?.recipient_name?.trim() || "—";
  const isSent = card ? isGiftCardSentGift(card) : false;
  const isWallet = card ? isGiftCardInWallet(card) : false;
  const claimState = card ? getSentGiftClaimState(card) : "unknown";

  return (
    <CustomerAccountLayout>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 flex flex-col gap-4 sm:gap-5">
        <Link
          href={`/customer/gift-cards${isSent ? "?tab=sent" : ""}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#374151] hover:text-[#6900AA] w-fit"
        >
          <ArrowLeft size={16} />
          {isSent ? "Sent gifts" : "My wallet"}
        </Link>

        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500 py-12 justify-center">
            <Loader2 className="animate-spin" size={18} /> Loading…
          </div>
        ) : isError || !card ? (
          <p className="text-center text-rose-600 py-10">Gift card not found.</p>
        ) : (
          <div className="flex flex-col gap-4 sm:gap-5">
            {isSent ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] text-amber-950 leading-relaxed">
                <p className="font-bold text-amber-900">Sent gift — tracking only</p>
                <p className="mt-1 text-amber-900/85">
                  {claimState === "awaiting_claim"
                    ? `This card was purchased for ${recipientLabel}. They must claim the code from their email before they can spend it. You cannot redeem this balance on your bookings.`
                    : `This card was claimed by the recipient (${recipientLabel}). You can track usage here, but you cannot spend this balance.`}
                </p>
              </div>
            ) : isWallet ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[13px] text-emerald-950 leading-relaxed">
                <p className="font-bold text-emerald-900">In your wallet</p>
                <p className="mt-1 text-emerald-900/85">
                  Use this balance at Events or Dining checkout. Claiming is already done — redeem happens when you pay.
                </p>
              </div>
            ) : null}

            {/* BMS-style design face + balance strip */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_2px_8px_rgba(17,17,17,0.05)]">
              <GiftCardDesignFace
                design={{
                  title: (card.design_title || "Gift Card").trim() || "Gift Card",
                  image_url: card.design_image_url,
                  color_gradient: card.design_color_gradient,
                  caption_color: card.design_caption_color || "#FFFFFF",
                  text_color: card.design_text_color || "#FFFFFF",
                }}
                size="preview"
                className="aspect-[16/9] w-full rounded-none!"
              />
              <div className="relative bg-[#6900AA] text-white px-4 sm:px-6 py-4 sm:py-5">
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-12 opacity-30"
                  aria-hidden
                  style={{
                    backgroundImage:
                      "radial-gradient(ellipse at 20% 100%, rgba(255,255,255,0.35) 0, transparent 55%), radial-gradient(ellipse at 70% 120%, rgba(255,255,255,0.25) 0, transparent 50%)",
                  }}
                />
                <div className="relative z-[1] flex flex-row items-center justify-between gap-3 sm:gap-4">
                  <div className="min-w-0 flex flex-col gap-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-white/75 font-semibold">
                      {isSent ? "Gift value / remaining" : "Available balance"}
                    </p>
                    <p className="text-[1.75rem] sm:text-[2.35rem] font-bold leading-none tracking-tight">
                      {formatMoney(Number(card.current_balance), { compact: true })}
                    </p>
                    {isSent ? (
                      <p className="text-[12px] text-white/75">
                        Initial {formatMoney(Number(card.initial_balance), { compact: true })}
                      </p>
                    ) : null}
                    <div className="flex flex-row items-center gap-2 mt-0.5 sm:mt-1 min-w-0">
                      <GiftCardCodeReveal
                        code={card.code}
                        codeMasked={card.code_masked}
                        tone="light"
                        className="min-w-0"
                      />
                    </div>
                    <div className="flex flex-row flex-wrap items-center gap-2 sm:gap-2.5 mt-1">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${statusBadge(
                          card.status
                        )}`}
                      >
                        {isSent
                          ? claimState === "awaiting_claim"
                            ? "AWAITING CLAIM"
                            : "CLAIMED"
                          : card.status}
                      </span>
                      {card.expires_at ? (
                        <span className="text-[11px] sm:text-[12px] text-white/80 inline-flex items-center gap-1">
                          <CalendarDays size={12} />
                          Valid until {formatGiftCardExpiryDate(card.expires_at)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="relative shrink-0 w-[64px] h-[64px] sm:w-[96px] sm:h-[96px] flex items-center justify-center">
                    <Image
                      src={imgSrc(images.giftbox)}
                      alt=""
                      width={96}
                      height={96}
                      className="relative z-[1] w-[56px] sm:w-[88px] h-auto object-contain drop-shadow-md"
                      style={{ filter: "hue-rotate(-18deg) saturate(1.2) brightness(1.05)" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Stats row — flex */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap rounded-2xl border border-[#EDE8F5] bg-white overflow-hidden shadow-[0_1px_3px_rgba(17,17,17,0.04)]">
              {[
                {
                  Icon: Wallet,
                  label: "Initial balance",
                  value: formatMoney(Number(card.initial_balance), { compact: true }),
                },
                {
                  Icon: TrendingUp,
                  label: "Used",
                  value: formatMoney(usedAmount, { compact: true }),
                },
                {
                  Icon: ShoppingBag,
                  label: "Purchase",
                  value: purchaseLabel,
                },
                {
                  Icon: User,
                  label: "Recipient",
                  value: recipientLabel,
                },
              ].map(({ Icon, label, value }, i) => (
                <div
                  key={label}
                  className={`flex-1 min-w-0 sm:min-w-[45%] lg:min-w-0 flex flex-row items-center gap-3 px-3.5 sm:px-4 py-3.5 sm:py-4 ${
                    i > 0 ? "sm:border-l border-t sm:border-t-0 border-[#EEEAF3]" : ""
                  } ${i === 2 ? "sm:border-t lg:border-t-0" : ""}`}
                >
                  <span className="inline-flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3E8FF] text-[#6900AA]">
                    <Icon size={18} strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex flex-col gap-0.5">
                    <span className="text-[11px] sm:text-[12px] text-[#6B7280]">{label}</span>
                    <span className="text-[13px] sm:text-[14px] font-bold text-[#111827] truncate">{value}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Transactions */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-row items-center justify-between gap-3">
                <h3 className="text-[15px] sm:text-[16px] font-bold text-[#111827]">Transactions</h3>
              </div>

              {!card.transactions?.length ? (
                <p className="text-sm text-slate-500 py-2">No transactions yet.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {card.transactions.map((tx) => (
                    <li
                      key={tx.id}
                      className="flex flex-row items-start sm:items-center gap-2.5 sm:gap-3 rounded-2xl border border-[#EDE8F5] bg-white px-3 sm:px-4 py-3 sm:py-3.5 shadow-[0_1px_2px_rgba(17,17,17,0.03)]"
                    >
                      <span className="inline-flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3E8FF] text-[#6900AA]">
                        <ShoppingBag size={18} strokeWidth={2} />
                      </span>
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-[#6900AA]">
                          {tx.transaction_type}
                        </p>
                        <p className="text-[13px] sm:text-[14px] font-medium text-[#111827] truncate">
                          {tx.notes || "Transaction"}
                        </p>
                        <p className="text-[11px] sm:text-[12px] text-[#9CA3AF]">
                          {new Date(tx.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="shrink-0 flex flex-row items-center gap-2">
                        <div className="text-right flex flex-col gap-0.5">
                          <p className="text-[13px] sm:text-[14px] font-bold text-[#1F2937]">
                            {formatMoney(Number(tx.amount), { compact: true })}
                          </p>
                          <p className="text-[10px] sm:text-[11px] text-[#9CA3AF]">
                            Bal. {formatMoney(Number(tx.balance_after), { compact: true })}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Safe & Secure banner */}
            <div className="flex flex-row items-start sm:items-center gap-3 sm:gap-4 rounded-2xl border border-[#E9D8FF] bg-[#F6EEFF] px-3.5 sm:px-5 py-3.5 sm:py-4">
              <span className="inline-flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#6900AA] shadow-sm">
                <ShieldCheck size={22} strokeWidth={2} />
              </span>
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <p className="text-[14px] sm:text-[15px] font-bold text-[#1F2937]">
                  {isSent ? "Gift delivery tracked" : "Safe & Secure"}
                </p>
                <p className="text-[12px] sm:text-[13px] text-[#6B7280] leading-snug">
                  {isSent
                    ? "Keep the purchase email for your records. Only the recipient can claim and spend this card."
                    : "This card is in your wallet. Apply it during Events or Dining checkout on BookMyBota."}
                </p>
              </div>
              <div className="hidden sm:flex shrink-0 w-16 h-16 items-center justify-center">
                <Image
                  src={imgSrc(images.giftbox)}
                  alt=""
                  width={56}
                  height={56}
                  className="w-14 h-14 object-contain opacity-90"
                  style={{ filter: "hue-rotate(-18deg) saturate(1.15)" }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </CustomerAccountLayout>
  );
}
