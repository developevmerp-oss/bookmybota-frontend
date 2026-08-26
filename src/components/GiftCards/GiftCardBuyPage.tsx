"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CircleHelp,
  Copy,
  Gift,
  Heart,
  Loader2,
  Lock,
  ShieldCheck,
  ShoppingBag,
  Tag,
  User,
  Wallet,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetPublicGiftCardProductsQuery,
  usePurchaseGiftCardMutation,
  type GiftCardPurchaseResult,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { formatMoney } from "@/lib/currencyFormat";
import CustomerAuthModal from "@/components/Shared/CustomerAuthModal";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import images from "@/Images";

type PurchaseFor = "SELF" | "SOMEONE_ELSE";

function imgSrc(img: string | { src: string }) {
  return typeof img === "string" ? img : img.src;
}

export default function GiftCardBuyPage() {
  const params = useParams();
  const productId = String(params?.id || "");
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((s) => s.auth.user);
  const isLoggedIn = Boolean(authUser?.role === "customer" || authUser?.customer_id);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const { data: products = [], isLoading } = useGetPublicGiftCardProductsQuery();
  const product = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId]
  );

  const [purchase, { isLoading: purchasing }] = usePurchaseGiftCardMutation();
  const [loginOpen, setLoginOpen] = useState(false);
  const [purchaseFor, setPurchaseFor] = useState<PurchaseFor>("SELF");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [issued, setIssued] = useState<GiftCardPurchaseResult | null>(null);

  const inputClass =
    "w-full px-3 sm:px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-[14px] sm:text-[15px] text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#6900AA]/25 focus:border-[#6900AA]";

  const amount = Number(product?.denomination ?? 0);
  const payAmount = Number(product?.selling_price ?? product?.denomination ?? 0);
  const amountLabel = formatMoney(amount, { compact: true });
  const payLabel = formatMoney(payAmount, { compact: true });
  const validityDays = product?.validity_days || 365;

  const handleBuy = async () => {
    if (!product) return;
    if (!isLoggedIn) {
      setLoginOpen(true);
      toast.message("Please sign in to complete your purchase");
      return;
    }
    if (purchaseFor === "SOMEONE_ELSE") {
      if (!recipientName.trim()) {
        toast.error("Recipient name is required");
        return;
      }
      if (!recipientEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) {
        toast.error("Enter a valid recipient email");
        return;
      }
    }

    try {
      const res = await purchase({
        product_id: product.id,
        purchase_for: purchaseFor,
        recipient_name: purchaseFor === "SOMEONE_ELSE" ? recipientName.trim() : undefined,
        recipient_email: purchaseFor === "SOMEONE_ELSE" ? recipientEmail.trim() : undefined,
        sender_name: senderName.trim() || undefined,
        personal_message:
          purchaseFor === "SOMEONE_ELSE" ? personalMessage.trim() || undefined : undefined,
      }).unwrap();
      setIssued(res.data);
      toast.success(res.message || "Gift card purchased");
    } catch (err) {
      toast.error(extractApiError(err) || "Purchase failed");
    }
  };

  const copyCode = async () => {
    if (!issued?.code) return;
    try {
      await navigator.clipboard.writeText(issued.code);
      toast.success("Code copied");
    } catch {
      toast.message(issued.code);
    }
  };

  return (
    <div className="bg-[#F4F2F7] min-h-[calc(100vh-4rem)] py-3 sm:py-6 md:py-8 lg:py-10">
      <div className="max-w-6xl mx-auto px-3 sm:px-5 md:px-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500 py-16 sm:py-20 justify-center bg-white rounded-2xl sm:rounded-[28px] shadow-sm">
            <Loader2 className="animate-spin" size={18} /> Loading…
          </div>
        ) : !product ? (
          <div className="bg-white rounded-2xl sm:rounded-[28px] border border-slate-200 p-6 sm:p-8 text-center shadow-sm">
            <p className="text-slate-600">This gift card is not available.</p>
            <Link href="/gift-cards" className="text-[#6900AA] font-semibold text-sm mt-3 inline-block">
              Browse gift cards
            </Link>
          </div>
        ) : issued ? (
          <div className="bg-white rounded-2xl sm:rounded-[28px] shadow-[0_10px_40px_rgba(17,17,17,0.07)] w-full max-w-md sm:max-w-lg mx-auto p-4 sm:p-5 md:p-6 lg:p-8 flex flex-col items-stretch">
            {/* Success header */}
            <div className="flex flex-col items-center text-center mb-4 sm:mb-5 lg:mb-6">
              <div className="relative mb-3 sm:mb-4">
                <span
                  className="absolute -inset-2.5 sm:-inset-3 rounded-full bg-emerald-400/20 blur-md"
                  aria-hidden
                />
                <span
                  className="absolute -top-1 -right-2 h-2 w-2 rounded-sm bg-[#6900AA] rotate-12"
                  aria-hidden
                />
                <span
                  className="absolute top-0 -left-3 h-1.5 w-1.5 rounded-sm bg-[#EAB308] -rotate-12"
                  aria-hidden
                />
                <span
                  className="absolute -bottom-1 right-0 h-1.5 w-1.5 rounded-sm bg-[#9B2DE3]"
                  aria-hidden
                />
                <span
                  className="absolute bottom-1 -left-2 h-2 w-2 rounded-sm bg-[#F59E0B]/80 rotate-45"
                  aria-hidden
                />
                <span className="relative z-[1] inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_8px_24px_rgba(16,185,129,0.35)]">
                  <Check size={24} className="sm:hidden" strokeWidth={3} />
                  <Check size={28} className="hidden sm:block" strokeWidth={3} />
                </span>
              </div>
              <h1 className="text-[18px] sm:text-[20px] lg:text-2xl font-extrabold text-[#111111] tracking-tight">
                Payment Successful!
              </h1>
              <p className="mt-1.5 sm:mt-2 text-[12px] sm:text-[13px] lg:text-sm text-slate-600 max-w-[20rem] sm:max-w-sm leading-relaxed px-0.5">
                Demo checkout complete. Save your code – it is shown once here and{" "}
                <span className="font-bold text-[#6900AA]">
                  emailed to you
                  {issued.purchase_for === "SOMEONE_ELSE" ? " and the recipient" : ""}.
                </span>
              </p>
            </div>

            {/* Gift card code */}
            <div className="relative rounded-xl sm:rounded-2xl bg-[#F5EBFF] border border-[#E8D5FF] px-3 sm:px-4 py-3 sm:py-3.5 lg:py-4 mb-4 sm:mb-5 overflow-hidden">
              <div
                className="pointer-events-none absolute inset-y-0 right-12 sm:right-16 w-16 sm:w-24 opacity-[0.12] hidden min-[420px]:block"
                aria-hidden
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(135deg, #6900AA 0 2px, transparent 2px 10px)",
                }}
              />
              <div className="relative flex flex-row items-center gap-2 sm:gap-3">
                <div className="flex-1 min-w-0 flex flex-col gap-0.5 sm:gap-1">
                  <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-[#6900AA]">
                    Gift card code
                  </p>
                  <code className="text-[12px] min-[360px]:text-[14px] sm:text-base lg:text-xl font-extrabold tracking-wide sm:tracking-wider text-[#6900AA] break-all leading-snug">
                    {issued.code}
                  </code>
                </div>
                <div className="h-8 sm:h-10 w-px border-l border-dashed border-[#C9A8F0] shrink-0 self-stretch sm:self-auto" />
                <button
                  type="button"
                  onClick={copyCode}
                  className="shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-[#6900AA] text-white inline-flex items-center justify-center hover:bg-[#57008E] transition-colors cursor-pointer shadow-sm"
                  aria-label="Copy code"
                >
                  <Copy size={16} className="sm:hidden" />
                  <Copy size={17} className="hidden sm:block" />
                </button>
              </div>
            </div>

            {/* Product details: left gift + right info */}
            <div className="flex flex-row items-center gap-3 sm:gap-4 mb-5 sm:mb-6">
              <div className="relative shrink-0 w-[60px] h-[60px] sm:w-[72px] sm:h-[72px] lg:w-[88px] lg:h-[88px] flex items-center justify-center">
                <span
                  className="absolute inset-0 rounded-full bg-[#F0E6FF]"
                  aria-hidden
                />
                <Image
                  src={imgSrc(images.giftbox)}
                  alt=""
                  width={72}
                  height={72}
                  className="relative z-[1] w-11 sm:w-14 lg:w-16 h-auto object-contain"
                  style={{ filter: "hue-rotate(-18deg) saturate(1.25) brightness(0.98)" }}
                />
              </div>
              <div className="flex flex-col gap-1 sm:gap-1.5 min-w-0 flex-1">
                <p className="text-[13px] sm:text-[14px] lg:text-[15px] font-medium text-[#4B5563] leading-snug line-clamp-2">
                  {issued.product_name || "BookMyBota Gift Card"}
                </p>
                <p className="text-lg sm:text-xl lg:text-2xl font-extrabold text-[#6900AA] leading-none">
                  {formatMoney(issued.initial_balance, { compact: true })}
                </p>
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#F3E8FF] px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-medium text-[#6900AA]">
                  <CalendarDays size={11} className="sm:hidden shrink-0" strokeWidth={2.25} />
                  <CalendarDays size={12} className="hidden sm:block shrink-0" strokeWidth={2.25} />
                  Valid for {product?.validity_days || 365} days
                </span>
              </div>
            </div>

            {/* Heart divider */}
            <div className="relative flex items-center justify-center mb-5 sm:mb-6">
              <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-[#E5E7EB]" />
              <span className="relative z-[1] inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-white border border-[#EDE4F8] shadow-sm">
                <Heart size={11} className="sm:hidden text-[#6900AA]" fill="currentColor" />
                <Heart size={12} className="hidden sm:block text-[#6900AA]" fill="currentColor" />
              </span>
            </div>

            {/* Actions — full-width stack on mobile + tablet; row on desktop */}
            <div className="flex flex-col lg:flex-row gap-2.5 sm:gap-3">
              <Link
                href={`/customer/gift-cards/${issued.id}`}
                className="inline-flex w-full lg:flex-1 items-center justify-center gap-2 h-11 sm:h-12 rounded-2xl bg-gradient-to-r from-[#6900AA] to-[#9B2DE3] text-white text-[13px] sm:text-sm font-semibold hover:brightness-105 transition-[filter] shadow-[0_8px_20px_rgba(105,0,170,0.28)]"
              >
                <Wallet size={16} className="sm:hidden shrink-0" strokeWidth={2.2} />
                <Wallet size={17} className="hidden sm:block shrink-0" strokeWidth={2.2} />
                View in My Gift Cards
              </Link>
              <Link
                href="/gift-cards"
                className="inline-flex w-full lg:flex-1 items-center justify-center gap-2 h-11 sm:h-12 rounded-2xl border border-[#6900AA] bg-white text-[#6900AA] text-[13px] sm:text-sm font-semibold hover:bg-[#F7E9FF] transition-colors"
              >
                <ShoppingBag size={16} className="sm:hidden shrink-0" strokeWidth={2.2} />
                <ShoppingBag size={17} className="hidden sm:block shrink-0" strokeWidth={2.2} />
                Buy another
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl sm:rounded-[28px] shadow-[0_10px_40px_rgba(17,17,17,0.07)] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 px-3.5 sm:px-6 md:px-7 lg:px-8 py-3 sm:py-3.5 md:py-[18px] border-b border-[#EEEAF3]">
              <Link
                href="/gift-cards"
                className="inline-flex items-center gap-1.5 sm:gap-2 text-[13px] sm:text-[14px] font-medium text-[#4B5563] hover:text-[#6900AA] transition-colors min-w-0"
              >
                <ArrowLeft size={18} strokeWidth={2} className="shrink-0" />
                <span className="truncate">All gift cards</span>
              </Link>
              <a
                href="mailto:support@bookmybota.com"
                className="inline-flex items-center gap-1.5 sm:gap-2 text-[13px] sm:text-[14px] font-medium text-[#4B5563] hover:text-[#6900AA] transition-colors shrink-0"
              >
                <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border border-[#D1D5DB] text-[#6B7280]">
                  <CircleHelp size={13} strokeWidth={2} />
                </span>
                <span className="hidden min-[380px]:inline">Need help?</span>
              </a>
            </div>

            {/* Body: stack on phone + tablet; side-by-side from desktop */}
            <div className="flex flex-col lg:flex-row lg:items-start gap-5 sm:gap-6 lg:gap-8 px-3.5 sm:px-6 lg:px-8 py-5 sm:py-7 lg:py-8">
              {/* LEFT SIDE */}
              <div className="gift-buy-left w-full lg:flex-1 min-w-0 flex flex-col">
                <h1 className="text-[20px] sm:text-[24px] lg:text-[28px] font-bold text-[#1F2937] tracking-tight leading-tight">
                  BookMyBota Gift Card
                </h1>
                <p className="mt-1.5 sm:mt-2.5 lg:mt-3 text-[30px] sm:text-[40px] lg:text-[48px] font-extrabold text-[#6900AA] leading-none tracking-tight">
                  {amountLabel}
                </p>

                <div className="relative flex items-center justify-center my-4 sm:my-6 lg:my-8 min-h-[140px] sm:min-h-[180px] lg:min-h-[220px]">
                  <div
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[140px] h-[140px] sm:w-[220px] sm:h-[180px] lg:w-[280px] lg:h-[220px] rounded-tr-[30%] rounded-bl-[30%] bg-[#f0e3fd]"
                    aria-hidden
                  />
                  <Image
                    src={imgSrc(images.giftbox)}
                    alt="Gift card"
                    width={220}
                    height={220}
                    priority
                    className="relative z-[1] w-[110px] sm:w-[160px] lg:w-[200px] h-auto object-contain drop-shadow-[0_12px_24px_rgba(105,0,170,0.2)]"
                    style={{ filter: "hue-rotate(-18deg) saturate(1.25) brightness(0.98)" }}
                  />
                </div>

                <div className="flex flex-row gap-1.5 sm:gap-2.5 lg:gap-3 mt-auto pt-1 sm:pt-3 lg:pt-4">
                  {[
                    { Icon: CalendarDays, label: `${validityDays} days validity` },
                    { Icon: Tag, label: "Promo codes" },
                    { Icon: Zap, label: "Instant delivery" },
                  ].map(({ Icon, label }) => (
                    <div
                      key={label}
                      className="flex-1 min-w-0 flex flex-col items-center justify-center gap-1 sm:gap-1.5 lg:gap-2 rounded-[10px] sm:rounded-[12px] lg:rounded-[14px] border border-[#E8E8EE] bg-white py-2 sm:py-2.5 lg:py-3 px-0.5 sm:px-1 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
                    >
                      <Icon size={18} className="text-[#6900AA] sm:hidden" strokeWidth={1.75} />
                      <Icon size={22} className="text-[#6900AA] hidden sm:block lg:hidden" strokeWidth={1.75} />
                      <Icon size={27} className="text-[#6900AA] hidden lg:block" strokeWidth={1.75} />
                      <span className="text-[10px] sm:text-[12px] lg:text-[15px] max-w-[4.25rem] sm:max-w-[5rem] lg:max-w-[70px] font-medium text-[#6B7280] text-center leading-snug">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT SIDE */}
              <div className="gift-buy-right w-full lg:w-[360px] xl:w-[420px] 2xl:w-[450px] shrink-0 flex flex-col">
                <div className="rounded-[14px] sm:rounded-[16px] lg:rounded-[20px] bg-white border border-[#F0EEF4] shadow-[0_12px_40px_rgba(17,17,17,0.08)] p-3.5 sm:p-5 lg:p-6 flex flex-col gap-3.5 sm:gap-4 lg:gap-5">
                  <div className="flex flex-col gap-2.5 sm:gap-3">
                    <p className="text-[13px] sm:text-[14px] lg:text-[15px] font-bold text-[#1F2937]">Who is this for?</p>
                    <div className="grid grid-cols-2 gap-2 sm:gap-2.5 lg:gap-3">
                      <button
                        type="button"
                        onClick={() => setPurchaseFor("SELF")}
                        className={`h-[44px] sm:h-[46px] lg:h-[48px] rounded-[12px] text-[12px] sm:text-[13px] font-semibold border inline-flex items-center justify-center gap-1.5 sm:gap-2 transition-colors cursor-pointer px-1 ${
                          purchaseFor === "SELF"
                            ? "bg-[#6900AA] border-[#6900AA] text-white shadow-[0_4px_14px_rgba(105,0,170,0.25)]"
                            : "bg-white border-[#E5E7EB] text-[#374151] hover:bg-slate-50"
                        }`}
                      >
                        <User size={15} strokeWidth={2.2} className="shrink-0" />
                        <span className="truncate">For myself</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPurchaseFor("SOMEONE_ELSE")}
                        className={`h-[44px] sm:h-[46px] lg:h-[48px] rounded-[12px] text-[12px] sm:text-[13px] font-semibold border inline-flex items-center justify-center gap-1.5 sm:gap-2 transition-colors cursor-pointer px-1 ${
                          purchaseFor === "SOMEONE_ELSE"
                            ? "bg-[#6900AA] border-[#6900AA] text-white shadow-[0_4px_14px_rgba(105,0,170,0.25)]"
                            : "bg-white border-[#E5E7EB] text-[#374151] hover:bg-slate-50"
                        }`}
                      >
                        <Gift size={15} strokeWidth={2.2} className="shrink-0" />
                        <span className="truncate">Someone else</span>
                      </button>
                    </div>
                  </div>

                  {purchaseFor === "SOMEONE_ELSE" && (
                    <div className="flex flex-col gap-3 rounded-[14px] bg-[#F9FAFB] border border-[#F3F4F6] p-3 sm:p-3.5 lg:p-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] sm:text-sm font-medium text-slate-700">
                          Recipient name *
                        </label>
                        <input
                          className={inputClass}
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          placeholder="Full name"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] sm:text-sm font-medium text-slate-700">
                          Recipient email *
                        </label>
                        <input
                          type="email"
                          className={inputClass}
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          placeholder="email@example.com"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] sm:text-sm font-medium text-slate-700">
                          Your name (optional)
                        </label>
                        <input
                          className={inputClass}
                          value={senderName}
                          onChange={(e) => setSenderName(e.target.value)}
                          placeholder="Shown on the gift email"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] sm:text-sm font-medium text-slate-700">
                          Personal message (optional)
                        </label>
                        <textarea
                          className={`${inputClass} min-h-[72px] sm:min-h-[80px] resize-y`}
                          value={personalMessage}
                          onChange={(e) => setPersonalMessage(e.target.value.slice(0, 500))}
                          placeholder="Happy birthday!"
                          maxLength={500}
                        />
                      </div>
                    </div>
                  )}

                  <div className="rounded-[12px] border border-[#E8D48A] bg-[#FFF8DC] px-3 sm:px-3.5 py-2.5 sm:py-3 flex flex-row items-start gap-2 sm:gap-2.5">
                    <ShieldCheck size={17} className="text-[#B45309] shrink-0 mt-0.5" strokeWidth={2} />
                    <p className="text-[11px] sm:text-[12px] lg:text-[13px] text-[#78520F] leading-snug">
                      <strong className="font-bold">Demo payment</strong>
                      {" – "}
                      No real charge – clicking Buy issues an ACTIVE gift card immediately.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2.5 sm:gap-3">
                    <p className="text-[13px] sm:text-[14px] lg:text-[15px] font-bold text-[#1F2937]">Order summary</p>
                    <div className="rounded-[12px] border border-[#ECEAF0] bg-[#FAFAFB] px-3 sm:px-3.5 lg:px-4 py-3 sm:py-3.5 flex flex-col gap-2.5 sm:gap-3">
                      <div className="flex flex-row items-center justify-between text-[12px] sm:text-[13px] lg:text-[14px] text-[#6B7280]">
                        <span>Gift card value</span>
                        <span className="font-medium text-[#374151]">{amountLabel}</span>
                      </div>
                      <div className="h-px bg-[#E8E6ED]" />
                      <div className="flex flex-row items-center justify-between gap-2">
                        <span className="text-[12px] sm:text-[13px] lg:text-[14px] font-bold text-[#1F2937]">Total to pay</span>
                        <span className="text-[15px] sm:text-[16px] lg:text-[18px] font-extrabold text-[#6900AA]">{payLabel}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={purchasing}
                    onClick={handleBuy}
                    className="w-full h-[46px] sm:h-[50px] lg:h-[52px] rounded-[14px] bg-[#6900AA] hover:bg-[#5A008F] text-white font-semibold disabled:opacity-60 inline-flex items-center justify-between gap-2 px-3 sm:px-4 lg:px-5 cursor-pointer transition-colors shadow-[0_8px_22px_rgba(105,0,170,0.3)]"
                  >
                    {purchasing ? (
                      <span className="flex-1 inline-flex items-center justify-center gap-2">
                        <Loader2 className="animate-spin" size={18} /> Processing…
                      </span>
                    ) : (
                      <>
                        <Lock size={16} strokeWidth={2.4} className="shrink-0" />
                        <span className="flex-1 text-center text-[12px] min-[380px]:text-[13px] sm:text-[14px] lg:text-[15px] font-semibold truncate px-1">
                          Continue to pay {payLabel}
                        </span>
                        <ArrowRight size={16} strokeWidth={2.4} className="shrink-0" />
                      </>
                    )}
                  </button>

                  <p className="text-center text-[10px] sm:text-[11px] lg:text-[12px] text-[#9CA3AF] inline-flex items-center justify-center gap-1.5 w-full -mt-0.5 sm:-mt-1 px-1">
                    <Lock size={11} className="opacity-80 shrink-0" />
                    You will be asked to sign in before payment.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <CustomerAuthModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => {
          setLoginOpen(false);
          toast.success("Signed in — tap Pay to continue");
        }}
      />
    </div>
  );
}
