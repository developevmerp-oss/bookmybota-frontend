"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  ShoppingBag,
  TrendingUp,
  User,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import { useGetMyGiftCardQuery } from "@/services/api";
import { formatMoney } from "@/lib/currencyFormat";
import CustomerAccountLayout from "@/components/Shared/CustomerAccountLayout";
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
  const [showCode, setShowCode] = useState(false);

  const usedAmount = useMemo(() => {
    if (!card) return 0;
    if (card.used_amount != null) return Number(card.used_amount) || 0;
    return Math.max(0, Number(card.initial_balance) - Number(card.current_balance));
  }, [card]);

  const purchaseLabel =
    card?.purchase_for === "SOMEONE_ELSE" ? "Gift for someone else" : "For myself";

  const recipientLabel =
    card?.recipient_name?.trim() ||
    (card?.purchase_for === "SELF" ? "—" : "—");

  return (
    <CustomerAccountLayout>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 flex flex-col gap-4 sm:gap-5">
        <Link
          href="/customer/gift-cards"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#374151] hover:text-[#6900AA] w-fit"
        >
          <ArrowLeft size={16} />
          My Gift Cards
        </Link>

        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500 py-12 justify-center">
            <Loader2 className="animate-spin" size={18} /> Loading…
          </div>
        ) : isError || !card ? (
          <p className="text-center text-rose-600 py-10">Gift card not found.</p>
        ) : (
          <div className="flex flex-col gap-4 sm:gap-5">
            {/* Featured purple card */}
            <div className="relative overflow-hidden rounded-2xl bg-[#8200e3] text-white px-4 sm:px-6 py-4 sm:py-6">
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-16 opacity-30"
                aria-hidden
                style={{
                  backgroundImage:
                    "radial-gradient(ellipse at 20% 100%, rgba(255,255,255,0.35) 0, transparent 55%), radial-gradient(ellipse at 70% 120%, rgba(255,255,255,0.25) 0, transparent 50%)",
                }}
              />
              <div className="relative z-[1] flex flex-row items-center justify-between gap-3 sm:gap-4">
                <div className="min-w-0 flex flex-col gap-2">
                  <p className="text-[12px] sm:text-[13px] text-white/85 truncate">
                    {card.product_name || "BookMyBota Gift Card"}
                  </p>
                  <p className="text-[1.75rem] sm:text-[2.35rem] font-extrabold leading-none tracking-tight">
                    {formatMoney(Number(card.current_balance), { compact: true })}
                  </p>
                  <div className="flex flex-row items-center gap-2 mt-0.5 sm:mt-1">
                    <p className="text-[12px] sm:text-sm text-white/80 font-mono tracking-wide break-all">
                      {showCode ? card.code_masked : card.code_masked}
                    </p>
                  </div>
                  <div className="flex flex-row flex-wrap items-center gap-2 sm:gap-2.5 mt-1">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${statusBadge(
                        card.status
                      )}`}
                    >
                      {card.status}
                    </span>
                    {card.expires_at ? (
                      <span className="text-[11px] sm:text-[12px] text-white/80">
                        Expires {new Date(card.expires_at).toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="relative shrink-0 w-[72px] h-[72px] sm:w-[120px] sm:h-[120px] flex items-center justify-center">
                  <Image
                    src={imgSrc(images.giftbox)}
                    alt=""
                    width={110}
                    height={110}
                    className="relative z-[1] w-[64px] sm:w-[110px] h-auto object-contain drop-shadow-md"
                    style={{ filter: "hue-rotate(-18deg) saturate(1.2) brightness(1.05)" }}
                  />
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
                <p className="text-[14px] sm:text-[15px] font-bold text-[#1F2937]">Safe & Secure</p>
                <p className="text-[12px] sm:text-[13px] text-[#6B7280] leading-snug">
                  Your gift card is active and ready to use. Use it during checkout on BookMyBota.
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
