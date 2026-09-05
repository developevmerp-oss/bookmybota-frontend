"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  ArrowLeft,
  Check,
  CircleHelp,
  Copy,
  Loader2,
  Lock,
  ShieldCheck,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetPublicGiftCardDenominationsQuery,
  useGetPublicGiftCardDesignQuery,
  useGetPublicGiftCardSettingsQuery,
  usePurchaseGiftCardMutation,
  type GiftCardPurchaseResult,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { formatMoney } from "@/lib/currencyFormat";
import { GIFT_CARD_DENOMINATIONS, formatGiftCardAmountLabel } from "@/lib/giftCardDenominations";
import {
  DEFAULT_GIFT_CARD_VALIDITY_DAYS,
  formatGiftCardValidityLabel,
} from "@/lib/giftCardValidity";
import {
  customerGiftCardBuySchema,
  GIFT_CARD_MESSAGE_MAX,
  MAX_GIFT_CARD_QTY,
  type CustomerGiftCardBuyValues,
} from "@/lib/giftCardFormSchemas";
import CustomerAuthModal from "@/components/Shared/CustomerAuthModal";
import GiftCardDesignFace from "@/components/GiftCards/GiftCardDesignFace";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";

const fieldErrorClass = "mt-1.5 text-[12px] font-semibold text-rose-500";
const labelClass = "block text-sm font-semibold text-[#1F2937] mb-1.5";

function RequiredMark() {
  return <span className="text-rose-500">*</span>;
}

export default function GiftCardBuyPage() {
  const params = useParams();
  const designId = String(params?.id || "");
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((s) => s.auth.user);
  const isLoggedIn = Boolean(authUser?.role === "customer" || authUser?.customer_id);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const {
    data: design,
    isLoading: designLoading,
    isError: designError,
  } = useGetPublicGiftCardDesignQuery(designId, { skip: !designId });

  const { data: denominationOptions = [] } = useGetPublicGiftCardDenominationsQuery();
  const { data: giftSettings } = useGetPublicGiftCardSettingsQuery();
  const [purchase, { isLoading: purchasing }] = usePurchaseGiftCardMutation();

  const validityDays =
    giftSettings?.validity_days ||
    denominationOptions[0]?.validity_days ||
    DEFAULT_GIFT_CARD_VALIDITY_DAYS;
  const validityLabel = formatGiftCardValidityLabel(validityDays);

  const [loginOpen, setLoginOpen] = useState(false);
  const [issued, setIssued] = useState<GiftCardPurchaseResult | null>(null);

  const amountChips = useMemo(() => {
    if (denominationOptions.length > 0) {
      return denominationOptions.map((d) => ({
        value: Number(d.denomination),
        available: d.available !== false,
      }));
    }
    return GIFT_CARD_DENOMINATIONS.map((value) => ({ value, available: true }));
  }, [denominationOptions]);

  const defaultDenomination = amountChips.find((c) => c.available)?.value ?? 100;

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CustomerGiftCardBuyValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(customerGiftCardBuySchema) as any,
    defaultValues: {
      sender_name: "",
      recipient_name: "",
      recipient_email: "",
      personal_message: "",
      denomination: defaultDenomination,
      quantity: 1,
    },
    mode: "onSubmit",
  });

  const senderName = watch("sender_name");
  const recipientName = watch("recipient_name");
  const personalMessage = watch("personal_message") || "";
  const amount = Number(watch("denomination")) || defaultDenomination;
  const quantity = Number(watch("quantity")) || 1;

  useEffect(() => {
    const first = amountChips.find((c) => c.available);
    if (first && !amountChips.some((c) => c.value === amount && c.available)) {
      setValue("denomination", first.value);
    }
  }, [amountChips, amount, setValue]);

  const inputClass =
    "w-full px-3 sm:px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-[14px] text-[#111111] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6900AA]/25 focus:border-[#6900AA]";

  const totalPayable = amount * Math.max(1, quantity);
  const payLabel = formatMoney(totalPayable, { compact: true });
  const previewTo = recipientName?.trim() || "Recipient Name";
  const previewFrom = senderName?.trim() || "Your Name";
  const previewMsg = personalMessage.trim() || "Your Message";
  const issuedCards =
    issued?.cards && issued.cards.length > 0 ? issued.cards : issued ? [issued] : [];

  const onValid = async (values: CustomerGiftCardBuyValues) => {
    if (!design) return;
    if (!isLoggedIn) {
      setLoginOpen(true);
      toast.message("Please sign in to complete your purchase");
      return;
    }
    const chip = amountChips.find((c) => c.value === values.denomination);
    if (!chip?.available) {
      toast.error("This amount is temporarily unavailable");
      return;
    }

    try {
      const res = await purchase({
        denomination: values.denomination,
        design_id: design.id,
        purchase_for: "SOMEONE_ELSE",
        recipient_name: values.recipient_name.trim(),
        recipient_email: values.recipient_email.trim(),
        sender_name: values.sender_name.trim(),
        personal_message: values.personal_message?.trim() || undefined,
        quantity: values.quantity,
      }).unwrap();
      setIssued(res.data);
      toast.success(res.message || "Gift card purchased");
    } catch (err) {
      toast.error(extractApiError(err, "Purchase failed"));
    }
  };

  const copyCode = async (code?: string) => {
    const value = code || issued?.code;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Code copied");
    } catch {
      toast.message(value);
    }
  };

  if (designLoading) {
    return (
      <div className="bg-[#F4F2F7] min-h-[calc(100vh-4rem)] flex items-center justify-center gap-2 text-slate-500">
        <Loader2 className="animate-spin" size={18} /> Loading design…
      </div>
    );
  }

  if (designError || !design) {
    return (
      <div className="bg-[#F4F2F7] min-h-[calc(100vh-4rem)] py-10 px-4">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <p className="text-slate-600">This gift card design is not available.</p>
          <Link href="/gift-cards" className="text-[#6900AA] font-semibold text-sm mt-3 inline-block">
            Choose a design
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F4F2F7] min-h-[calc(100vh-4rem)] py-3 sm:py-6 md:py-8">
      <div className="max-w-6xl mx-auto px-3 sm:px-5 md:px-6">
        {issued ? (
          <div className="bg-white rounded-2xl sm:rounded-[28px] shadow-[0_10px_40px_rgba(17,17,17,0.07)] w-full max-w-md sm:max-w-lg mx-auto p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col items-center text-center mb-5">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white mb-3">
                <Check size={24} strokeWidth={3} />
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#111111]">Payment Successful!</h1>
              <p className="mt-2 text-sm text-slate-600 max-w-sm">
                Your e-gift{issuedCards.length > 1 ? `s (${issuedCards.length}) were` : " was"}{" "}
                <span className="font-bold text-[#6900AA]">
                  emailed to {issued.recipient_email || issued.recipient_name || "the recipient"}
                </span>
                . Save the code{issuedCards.length > 1 ? "s" : ""} below for your records.
              </p>
            </div>

            <div className="space-y-2.5 mb-5">
              {issuedCards.map((card, idx) => (
                <div
                  key={card.id || card.code}
                  className="rounded-xl bg-[#F5EBFF] border border-[#E8D5FF] px-4 py-3.5 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6900AA]">
                      Gift card code{issuedCards.length > 1 ? ` ${idx + 1}` : ""}
                    </p>
                    <code className="text-sm sm:text-base font-extrabold tracking-wide text-[#6900AA] break-all">
                      {card.code}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyCode(card.code)}
                    className="shrink-0 h-10 w-10 rounded-xl bg-[#6900AA] text-white inline-flex items-center justify-center hover:bg-[#57008E]"
                    aria-label="Copy code"
                  >
                    <Copy size={17} />
                  </button>
                </div>
              ))}
            </div>

            <p className="text-center text-2xl font-extrabold text-[#6900AA] mb-2">
              {formatMoney(
                issued.total_payable ??
                  Number(issued.initial_balance) * (issued.quantity || issuedCards.length || 1),
                { compact: true }
              )}
            </p>
            {issuedCards.length > 1 ? (
              <p className="text-center text-sm text-slate-500 mb-1">
                {issuedCards.length} × {formatMoney(issued.initial_balance, { compact: true })}
              </p>
            ) : null}
            {issued.expires_at ? (
              <p className="text-center text-sm text-slate-500 mb-5">
                Valid until{" "}
                <span className="font-semibold text-slate-700">
                  {new Date(issued.expires_at).toLocaleDateString()}
                </span>
              </p>
            ) : (
              <p className="text-center text-sm text-slate-500 mb-5">Valid for {validityLabel}</p>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/customer/gift-cards/${issued.id}`}
                className="inline-flex flex-1 items-center justify-center gap-2 h-11 rounded-2xl bg-gradient-to-r from-[#6900AA] to-[#9B2DE3] text-white text-sm font-semibold"
              >
                <Wallet size={17} />
                View in My Gift Cards
              </Link>
              <Link
                href="/gift-cards"
                className="inline-flex flex-1 items-center justify-center gap-2 h-11 rounded-2xl border border-[#6900AA] text-[#6900AA] text-sm font-semibold hover:bg-[#F7E9FF]"
              >
                <ShoppingBag size={17} />
                Buy another
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl sm:rounded-[28px] shadow-[0_10px_40px_rgba(17,17,17,0.07)] overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3.5 border-b border-[#EEEAF3]">
              <Link
                href="/gift-cards"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#4B5563] hover:text-[#6900AA]"
              >
                <ArrowLeft size={18} />
                Select a design
              </Link>
              <a
                href="mailto:support@bookmybota.com"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#4B5563] hover:text-[#6900AA]"
              >
                <CircleHelp size={16} />
                <span className="hidden sm:inline">Need help?</span>
              </a>
            </div>

            <form
              onSubmit={handleSubmit(onValid)}
              noValidate
              className="flex flex-col lg:flex-row gap-6 lg:gap-8 px-4 sm:px-6 lg:px-8 py-5 sm:py-7"
            >
              <div className="flex-1 min-w-0 flex flex-col gap-4 sm:gap-5">
                <div>
                  <label className={labelClass}>
                    From <RequiredMark />
                  </label>
                  <input
                    className={inputClass}
                    placeholder="Please Enter Sender's Name"
                    {...register("sender_name")}
                  />
                  {errors.sender_name && (
                    <p className={fieldErrorClass}>{errors.sender_name.message}</p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>
                    To <RequiredMark />
                  </label>
                  <input
                    className={inputClass}
                    placeholder="Please Enter Recipient's Name"
                    {...register("recipient_name")}
                  />
                  {errors.recipient_name && (
                    <p className={fieldErrorClass}>{errors.recipient_name.message}</p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>
                    Email <RequiredMark />
                  </label>
                  <input
                    type="email"
                    className={inputClass}
                    placeholder="Recipient email for gift delivery"
                    {...register("recipient_email")}
                  />
                  {errors.recipient_email && (
                    <p className={fieldErrorClass}>{errors.recipient_email.message}</p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Personal Message</label>
                  <textarea
                    className={`${inputClass} min-h-[88px] resize-y`}
                    placeholder="Write a short note"
                    maxLength={GIFT_CARD_MESSAGE_MAX}
                    {...register("personal_message")}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    {personalMessage.length}/{GIFT_CARD_MESSAGE_MAX} characters
                  </p>
                  {errors.personal_message && (
                    <p className={fieldErrorClass}>{errors.personal_message.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1F2937] mb-2">
                    Amount <RequiredMark />
                  </label>
                  <Controller
                    name="denomination"
                    control={control}
                    render={({ field }) => (
                      <div className="flex flex-wrap gap-2">
                        {amountChips.map((chip) => {
                          const selected = Number(field.value) === chip.value;
                          return (
                            <button
                              key={chip.value}
                              type="button"
                              disabled={!chip.available}
                              onClick={() => field.onChange(chip.value)}
                              className={`min-w-[5.25rem] h-10 px-3 rounded-md text-sm font-bold border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                selected
                                  ? "bg-[#6900AA] border-[#6900AA] text-white"
                                  : "bg-white border-slate-300 text-slate-800 hover:border-[#6900AA]"
                              }`}
                            >
                              {formatGiftCardAmountLabel(chip.value)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  />
                  <p className="mt-2 text-[12px] text-slate-500">
                    Valid for <span className="font-semibold text-slate-700">{validityLabel}</span>{" "}
                    from the purchase date.
                  </p>
                  {errors.denomination && (
                    <p className={fieldErrorClass}>{errors.denomination.message}</p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>
                    Quantity <RequiredMark />
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={MAX_GIFT_CARD_QTY}
                    step={1}
                    inputMode="numeric"
                    className={inputClass}
                    {...register("quantity", { valueAsNumber: true })}
                  />
                  <p className="mt-1.5 text-[12px] text-slate-500">
                    Please enter value less than or equal to {MAX_GIFT_CARD_QTY}
                  </p>
                  {errors.quantity && (
                    <p className={fieldErrorClass}>{errors.quantity.message}</p>
                  )}
                </div>

                <div className="rounded-lg border border-[#E8D48A] bg-[#FFF8DC] px-3 py-2.5 flex gap-2">
                  <ShieldCheck size={16} className="text-[#B45309] shrink-0 mt-0.5" />
                  <p className="text-[12px] text-[#78520F] leading-snug">
                    <strong>Demo payment</strong> – no real charge. The gift code is emailed to the
                    recipient instantly.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1 border-t border-slate-100">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
                      Amount payable
                    </p>
                    <p className="text-xl font-extrabold text-[#111111]">{payLabel}</p>
                  </div>
                  <button
                    type="submit"
                    disabled={purchasing}
                    className="h-12 px-6 rounded-xl bg-[#6900AA] hover:bg-[#5A008F] text-white font-bold disabled:opacity-60 inline-flex items-center justify-center gap-2 shadow-[0_8px_22px_rgba(105,0,170,0.3)]"
                  >
                    {purchasing ? (
                      <>
                        <Loader2 className="animate-spin" size={18} /> Processing…
                      </>
                    ) : (
                      <>
                        <Lock size={16} />
                        Make Payment
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="w-full lg:w-[340px] xl:w-[380px] shrink-0">
                <div className="sticky top-4">
                  <GiftCardDesignFace
                    design={design}
                    size="preview"
                    className="aspect-[16/10] w-full shadow-[0_12px_40px_rgba(17,17,17,0.15)]"
                  />
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 space-y-2.5 shadow-sm">
                    <p className="text-sm text-slate-800">
                      <span className="font-semibold">To</span> {previewTo}
                    </p>
                    <p className="text-sm text-slate-600 italic line-clamp-3">[{previewMsg}]</p>
                    <p className="text-sm text-slate-800">
                      Best Wishes <span className="font-semibold">{previewFrom}</span>
                    </p>
                    <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Gift Card / Voucher Code
                      </p>
                      <p className="text-sm font-mono font-semibold text-slate-400 mt-0.5">
                        Will appear after payment
                      </p>
                    </div>
                    <p className="text-center text-base font-extrabold text-[#6900AA] pt-1">
                      {payLabel}
                    </p>
                    {quantity > 1 ? (
                      <p className="text-center text-[11px] text-slate-500">
                        {quantity} × {formatMoney(amount, { compact: true })}
                      </p>
                    ) : null}
                    <p className="text-center text-[11px] text-slate-500">
                      Expires after {validityLabel}
                    </p>
                  </div>
                  <p className="mt-3 text-[12px] text-slate-500 leading-relaxed text-center lg:text-left">
                    Preview of your gift card. Confirm this is the design you selected before
                    continuing to payment.
                  </p>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>

      <CustomerAuthModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => {
          setLoginOpen(false);
          toast.success("Signed in — tap Make Payment to continue");
        }}
      />
    </div>
  );
}
