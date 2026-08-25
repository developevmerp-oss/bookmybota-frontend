"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Copy, Gift, Loader2 } from "lucide-react";
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

type PurchaseFor = "SELF" | "SOMEONE_ELSE";

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
    "w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#6900AA]/25 focus:border-[#6900AA]";

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
    <div className="bg-[#f7f5fa] min-h-[calc(100vh-4rem)]">
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href="/gift-cards"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#6900AA] mb-6"
        >
          <ArrowLeft size={16} />
          All gift cards
        </Link>

        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500 py-16 justify-center">
            <Loader2 className="animate-spin" size={18} /> Loading…
          </div>
        ) : !product ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <p className="text-slate-600">This gift card is not available.</p>
            <Link href="/gift-cards" className="text-[#6900AA] font-semibold text-sm mt-3 inline-block">
              Browse gift cards
            </Link>
          </div>
        ) : issued ? (
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-6 sm:p-8">
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-lg mb-2">
              <CheckCircle2 size={22} />
              Payment successful
            </div>
            <p className="text-sm text-slate-600 mb-5">
              Demo checkout complete. Save your code — it is shown once here and emailed to you
              {issued.purchase_for === "SOMEONE_ELSE" ? " and the recipient" : ""}.
            </p>
            <div className="rounded-xl bg-[#F7E9FF] border border-[#E3BCFF] p-4 mb-4">
              <p className="text-xs font-semibold text-[#6900AA] uppercase tracking-wide mb-1">
                Gift card code
              </p>
              <div className="flex items-center justify-between gap-3">
                <code className="text-lg sm:text-xl font-bold tracking-wider text-[#111111] break-all">
                  {issued.code}
                </code>
                <button
                  type="button"
                  onClick={copyCode}
                  className="shrink-0 p-2 rounded-lg hover:bg-white/80 text-[#6900AA] cursor-pointer"
                  aria-label="Copy code"
                >
                  <Copy size={18} />
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-700 mb-1">
              <span className="font-medium">{issued.product_name}</span>
            </p>
            <p className="text-2xl font-extrabold text-[#6900AA] mb-6">
              {formatMoney(issued.initial_balance, { compact: true })}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/customer/gift-cards/${issued.id}`}
                className="inline-flex flex-1 items-center justify-center h-11 rounded-xl bg-[#6900AA] text-white text-sm font-semibold hover:bg-[#57008E]"
              >
                View in My Gift Cards
              </Link>
              <Link
                href="/gift-cards"
                className="inline-flex flex-1 items-center justify-center h-11 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Buy another
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-br from-[#6900AA] to-[#9B2DE3] px-6 py-7 text-white flex items-start gap-4">
              <Gift size={36} className="opacity-90 shrink-0 mt-0.5" />
              <div>
                <h1 className="text-xl font-extrabold leading-snug">{product.name}</h1>
                <p className="text-3xl font-extrabold mt-2">
                  {formatMoney(Number(product.denomination), { compact: true })}
                </p>
                <p className="text-sm text-white/75 mt-1">
                  Pay {formatMoney(Number(product.selling_price ?? product.denomination), { compact: true })} ·{" "}
                  Valid {product.validity_days || 365} days
                </p>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <p className="text-sm font-semibold text-[#111111] mb-2">Who is this for?</p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["SELF", "For myself"],
                      ["SOMEONE_ELSE", "Someone else"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPurchaseFor(value)}
                      className={`h-11 rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${
                        purchaseFor === value
                          ? "bg-[#F7E9FF] border-[#E3BCFF] text-[#6900AA]"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {purchaseFor === "SOMEONE_ELSE" && (
                <div className="space-y-3 rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">
                      Recipient name *
                    </label>
                    <input
                      className={inputClass}
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="Full name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">
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
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">
                      Your name (optional)
                    </label>
                    <input
                      className={inputClass}
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Shown on the gift email"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">
                      Personal message (optional)
                    </label>
                    <textarea
                      className={`${inputClass} min-h-[88px] resize-y`}
                      value={personalMessage}
                      onChange={(e) => setPersonalMessage(e.target.value.slice(0, 500))}
                      placeholder="Happy birthday!"
                      maxLength={500}
                    />
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <strong>Demo payment.</strong> No real charge — clicking Buy issues an ACTIVE gift
                card immediately.
              </div>

              <button
                type="button"
                disabled={purchasing}
                onClick={handleBuy}
                className="w-full h-12 rounded-xl bg-[#6900AA] text-white font-semibold hover:bg-[#57008E] disabled:opacity-60 inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {purchasing ? (
                  <>
                    <Loader2 className="animate-spin" size={18} /> Processing…
                  </>
                ) : (
                  <>
                    Pay {formatMoney(Number(product.selling_price ?? product.denomination), { compact: true })}
                  </>
                )}
              </button>

              {!isLoggedIn && (
                <p className="text-center text-xs text-slate-500">
                  You will be asked to sign in before payment.
                </p>
              )}
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
