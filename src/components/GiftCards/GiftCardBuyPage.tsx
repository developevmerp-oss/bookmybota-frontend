"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
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
  computeGiftCardExpiryDate,
  formatGiftCardExpiryDate,
  formatGiftCardValidityLabel,
} from "@/lib/giftCardValidity";
import {
  customerGiftCardBuySchema,
  GIFT_CARD_MESSAGE_MAX,
  type CustomerGiftCardBuyValues,
} from "@/lib/giftCardFormSchemas";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import CustomerAuthModal from "@/components/Shared/CustomerAuthModal";
import GiftCardDesignFace from "@/components/GiftCards/GiftCardDesignFace";
import GiftCardInfoModals, {
  type GiftCardInfoModalKind,
} from "@/components/GiftCards/GiftCardInfoModals";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";

const fieldErrorClass = "mt-1.5 text-[12px] font-semibold text-rose-500";
const labelClass = "block text-[13px] sm:text-sm font-medium text-[#333333] mb-1.5";
const inputClass =
  "w-full sm:w-[60%] h-11 px-3 rounded border border-[#D0D0D0] bg-white text-[14px] text-[#111111] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#6900AA] focus:ring-1 focus:ring-[#6900AA]/30";
const fieldWrapClass = "w-full sm:w-[60%]";

function RequiredMark() {
  return <span className="text-[#6900AA] mr-0.5">*</span>;
}

function todayIsoDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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
  const [infoModal, setInfoModal] = useState<GiftCardInfoModalKind>(null);
  const [issued, setIssued] = useState<GiftCardPurchaseResult | null>(null);
  /** Keep sticky preview below HomeHeader + SubNav (List Your Show bar). */
  const [stickyOffsetPx, setStickyOffsetPx] = useState(148);

  useEffect(() => {
    const measure = () => {
      const header = document.querySelector("header.sticky") as HTMLElement | null;
      if (!header) return;
      const h = Math.ceil(header.getBoundingClientRect().height);
      // Small gap so the card top is not flush against the purple subnav.
      setStickyOffsetPx(Math.max(120, h + 16));
    };
    measure();
    window.addEventListener("resize", measure);
    const header = document.querySelector("header.sticky");
    const ro = header ? new ResizeObserver(measure) : null;
    if (header && ro) ro.observe(header);
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, []);

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
  const minDeliveryDate = todayIsoDate();

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
      recipient_phone: "",
      personal_message: "",
      delivery_date: minDeliveryDate,
      denomination: defaultDenomination,
    },
    mode: "onSubmit",
  });

  const senderName = watch("sender_name");
  const recipientName = watch("recipient_name");
  const personalMessage = watch("personal_message") || "";
  const deliveryDate = watch("delivery_date") || minDeliveryDate;
  const amount = Number(watch("denomination")) || defaultDenomination;

  const previewExpiryDate = formatGiftCardExpiryDate(
    computeGiftCardExpiryDate(
      new Date(`${deliveryDate}T12:00:00.000Z`),
      validityDays
    )
  );

  useEffect(() => {
    const first = amountChips.find((c) => c.available);
    if (first && !amountChips.some((c) => c.value === amount && c.available)) {
      setValue("denomination", first.value);
    }
  }, [amountChips, amount, setValue]);

  const payLabel = formatMoney(amount, { compact: true });
  const previewTo = recipientName?.trim() || "Recipient Name";
  const previewFrom = senderName?.trim() || "Your Name";
  const previewMsg = personalMessage.trim() || "Your Message";
  const issuedCards =
    issued?.cards && issued.cards.length > 0 ? issued.cards : issued ? [issued] : [];
  const emailSentNow = issued?.email_sent !== false;
  const scheduledLabel = issued?.scheduled_delivery_at
    ? new Date(issued.scheduled_delivery_at).toLocaleDateString()
    : null;
  const heroImg = design ? resolveMediaUrl(design.image_url) : null;

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
        recipient_phone: values.recipient_phone.trim(),
        sender_name: values.sender_name.trim(),
        personal_message: values.personal_message?.trim() || undefined,
        delivery_date: values.delivery_date,
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
      <div className="bg-[#F5F5F5] min-h-[calc(100vh-4rem)] flex items-center justify-center gap-2 text-slate-500">
        <Loader2 className="animate-spin" size={18} /> Loading design…
      </div>
    );
  }

  if (designError || !design) {
    return (
      <div className="bg-[#F5F5F5] min-h-[calc(100vh-4rem)] py-10 px-4">
        <div className="max-w-md mx-auto bg-white rounded-lg border border-slate-200 p-8 text-center">
          <p className="text-slate-600">This gift card design is not available.</p>
          <Link href="/gift-cards" className="text-[#6900AA] font-semibold text-sm mt-3 inline-block">
            Choose a design
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F5F5F5] min-h-[calc(100vh-4rem)] pb-10 sm:pb-14">
      {issued ? (
        <div className="max-w-lg mx-auto px-4 pt-8 sm:pt-12">
          <div className="bg-white rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.08)] p-5 sm:p-8">
            <div className="flex flex-col items-center text-center mb-5">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white mb-3">
                <Check size={24} strokeWidth={3} />
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#111111]">
                Payment Successful!
              </h1>
              <p className="mt-2 text-sm text-slate-600 max-w-sm">
                {emailSentNow ? (
                  <>
                    Your e-gift was{" "}
                    <span className="font-bold text-[#6900AA]">
                      emailed to {issued.recipient_email || issued.recipient_name || "the recipient"}
                    </span>
                    . Save the code below for your records.
                  </>
                ) : (
                  <>
                    Your e-gift is scheduled to be emailed to{" "}
                    <span className="font-bold text-[#6900AA]">
                      {issued.recipient_email || "the recipient"}
                    </span>
                    {scheduledLabel ? (
                      <>
                        {" "}
                        on <span className="font-bold text-[#6900AA]">{scheduledLabel}</span>
                      </>
                    ) : null}
                    . Save the code below for your records.
                  </>
                )}
              </p>
            </div>

            <div className="space-y-2.5 mb-5">
              {issuedCards.map((card) => (
                <div
                  key={card.id || card.code}
                  className="rounded-lg bg-[#F5EBFF] border border-[#E8D5FF] px-4 py-3.5 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6900AA]">
                      Gift card code
                    </p>
                    <code className="text-sm sm:text-base font-extrabold tracking-wide text-[#6900AA] break-all">
                      {card.code}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyCode(card.code)}
                    className="shrink-0 h-10 w-10 rounded-lg bg-[#6900AA] text-white inline-flex items-center justify-center hover:bg-[#57008E]"
                    aria-label="Copy code"
                  >
                    <Copy size={17} />
                  </button>
                </div>
              ))}
            </div>

            <p className="text-center text-2xl font-extrabold text-[#6900AA] mb-2">
              {formatMoney(issued.total_payable ?? issued.initial_balance, { compact: true })}
            </p>
            {issued.expires_at ? (
              <p className="text-center text-sm text-slate-500 mb-5">
                Valid until{" "}
                <span className="font-semibold text-slate-700">
                  {formatGiftCardExpiryDate(issued.expires_at)}
                </span>
              </p>
            ) : (
              <p className="text-center text-sm text-slate-500 mb-5">Valid for {validityLabel}</p>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/customer/gift-cards/${issued.id}`}
                className="inline-flex flex-1 items-center justify-center gap-2 h-11 rounded-lg bg-[#6900AA] text-white text-sm font-semibold hover:bg-[#5A008F]"
              >
                <Wallet size={17} />
                View in My Gift Cards
              </Link>
              <Link
                href="/gift-cards"
                className="inline-flex flex-1 items-center justify-center gap-2 h-11 rounded-lg border border-[#6900AA] text-[#6900AA] text-sm font-semibold hover:bg-[#F7E9FF]"
              >
                <ShoppingBag size={17} />
                Buy another
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* BookMyShow-style gift hero banner */}
          <div className="relative overflow-hidden bg-[#1A0529]">
            {heroImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroImg}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-55"
              />
            ) : null}
            <div
              className="absolute inset-0 bg-gradient-to-r from-[#1A0529] via-[#3B0A5C]/90 to-[#6900AA]/55"
              aria-hidden
            />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_40%,rgba(155,45,227,0.35),transparent_55%)]" aria-hidden />

            <div className="relative z-1 container mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5 pb-10 sm:pb-14 md:pb-16">
              <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
                <Link
                  href="/gift-cards"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-white/90 hover:text-white"
                >
                  <ArrowLeft size={18} />
                  Select a design
                </Link>
                <button
                  type="button"
                  onClick={() => setInfoModal("help")}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-white/90 hover:text-white"
                >
                  <CircleHelp size={16} />
                  <span className="hidden sm:inline">Need help?</span>
                </button>
              </div>

              <div>
                <p className="text-white/80 text-xs sm:text-sm font-semibold tracking-wide">
                  BookMyBota
                </p>
                <h1 className="text-white text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-none mt-1">
                  gift{" "}
                  <span className="font-bold tracking-[0.06em] text-[0.78em] align-middle">
                    CARD
                  </span>
                </h1>
                <p className="mt-2 sm:mt-2.5 text-white/75 text-xs sm:text-sm max-w-xl">
                  {design.title} · Events, Sports, Dining and more
                </p>
              </div>
            </div>
          </div>

          {/* Form + preview — fluid container, clear gap from hero title */}
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 -mt-4 sm:-mt-6 relative z-2 pb-2">
            <form
              onSubmit={handleSubmit(onValid)}
              noValidate
              className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)] gap-5 sm:gap-6 lg:gap-8 items-start"
            >
              {/* Left: purchase form */}
              <div className="bg-white rounded-lg shadow-[0_2px_14px_rgba(0,0,0,0.08)] px-5 sm:px-8 lg:px-10 py-6 sm:py-8 space-y-5 sm:space-y-6">
                <div>
                  <label className={labelClass}>
                    <RequiredMark /> From
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

                <div className="space-y-4 pt-1">
                  <h3 className="text-[15px] sm:text-base font-bold text-[#6900AA]">Recipient</h3>

                  <div>
                    <label className={labelClass}>
                      <RequiredMark /> To
                    </label>
                    <input
                      className={inputClass}
                      placeholder="Please Enter Recipient Name"
                      {...register("recipient_name")}
                    />
                    {errors.recipient_name && (
                      <p className={fieldErrorClass}>{errors.recipient_name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>
                      <RequiredMark /> Email
                    </label>
                    <input
                      type="email"
                      className={inputClass}
                      placeholder="Please Enter Recipient Email Id"
                      {...register("recipient_email")}
                    />
                    <p className="mt-1.5 text-[12px] text-[#6B7280] leading-snug">
                      Your E-Gift card will be mailed to the recipient&apos;s email address provided
                      here.
                    </p>
                    {errors.recipient_email && (
                      <p className={fieldErrorClass}>{errors.recipient_email.message}</p>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>
                      <RequiredMark /> Mobile Number
                    </label>
                    <div className={`${fieldWrapClass} flex gap-2`}>
                      <div
                        className="h-11 px-2.5 sm:px-3 rounded border border-[#D0D0D0] bg-[#FAFAFA] inline-flex items-center gap-1.5 shrink-0 text-[13px] font-semibold text-[#333]"
                        title="Ethiopia"
                      >
                        <span className="text-base leading-none" aria-hidden>
                          🇪🇹
                        </span>
                        <span>+251</span>
                      </div>
                      <input
                        type="tel"
                        inputMode="tel"
                        className="w-full min-w-0 h-11 px-3 rounded border border-[#D0D0D0] bg-white text-[14px] text-[#111111] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#6900AA] focus:ring-1 focus:ring-[#6900AA]/30"
                        placeholder="Please Enter Mobile number"
                        {...register("recipient_phone")}
                      />
                    </div>
                    {errors.recipient_phone && (
                      <p className={fieldErrorClass}>{errors.recipient_phone.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Add your personal message:</label>
                  <textarea
                    className={`${fieldWrapClass} min-h-[100px] px-3 py-2.5 rounded border border-[#D0D0D0] bg-white text-[14px] text-[#111111] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#6900AA] focus:ring-1 focus:ring-[#6900AA]/30 resize-y`}
                    placeholder="Message"
                    maxLength={GIFT_CARD_MESSAGE_MAX}
                    {...register("personal_message")}
                  />
                  <p className="mt-1 text-[12px] text-[#6B7280]">
                    {GIFT_CARD_MESSAGE_MAX} characters allowed ({personalMessage.length}/
                    {GIFT_CARD_MESSAGE_MAX})
                  </p>
                  {errors.personal_message && (
                    <p className={fieldErrorClass}>{errors.personal_message.message}</p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>
                    <RequiredMark /> Delivery date
                  </label>
                  <div className={fieldWrapClass}>
                    <input
                      type="date"
                      min={minDeliveryDate}
                      className="w-full h-11 px-3 rounded border border-[#D0D0D0] bg-white text-[14px] text-[#111111] cursor-pointer focus:outline-none focus:border-[#6900AA] focus:ring-1 focus:ring-[#6900AA]/30 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                      {...register("delivery_date")}
                      onClick={(e) => {
                        const el = e.currentTarget;
                        try {
                          el.showPicker?.();
                        } catch {
                          /* older browsers */
                        }
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-[12px] text-[#6B7280]">
                    Today = email right after payment. Future date = schedule the gift email.
                  </p>
                  {errors.delivery_date && (
                    <p className={fieldErrorClass}>{errors.delivery_date.message}</p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>
                    <RequiredMark /> Amount
                  </label>
                  <Controller
                    name="denomination"
                    control={control}
                    render={({ field }) => (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-2.5">
                        {amountChips.map((chip) => {
                          const selected = Number(field.value) === chip.value;
                          return (
                            <button
                              key={chip.value}
                              type="button"
                              disabled={!chip.available}
                              onClick={() => field.onChange(chip.value)}
                              className={`h-10 sm:h-11 rounded text-[13px] sm:text-sm font-bold border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                selected
                                  ? "bg-[#6900AA] border-[#6900AA] text-white"
                                  : "bg-white border-[#CFCFCF] text-[#333333] hover:border-[#6900AA]"
                              }`}
                            >
                              {formatGiftCardAmountLabel(chip.value)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  />
                  <p className="mt-2 text-[12px] text-[#6B7280]">
                    Valid for {validityLabel} from delivery · through {previewExpiryDate}
                  </p>
                  {errors.denomination && (
                    <p className={fieldErrorClass}>{errors.denomination.message}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-[#6B7280] pt-1">
                  <button
                    type="button"
                    onClick={() => setInfoModal("terms")}
                    className="hover:text-[#6900AA] underline-offset-2 hover:underline"
                  >
                    Terms & Conditions
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfoModal("help")}
                    className="hover:text-[#6900AA] underline-offset-2 hover:underline"
                  >
                    Need Help?
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfoModal("balance")}
                    className="hover:text-[#6900AA] underline-offset-2 hover:underline"
                  >
                    Check Gift Card Balance
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-[#EFEFEF]">
                  <div>
                    <p className="text-[11px] text-[#6B7280] uppercase tracking-wide font-semibold">
                      Amount payable
                    </p>
                    <p className="text-xl font-extrabold text-[#111111]">{payLabel}</p>
                  </div>
                  <button
                    type="submit"
                    disabled={purchasing}
                    className="h-11 px-7 rounded bg-[#6900AA] hover:bg-[#5A008F] text-white font-bold disabled:opacity-60 inline-flex items-center justify-center gap-2"
                  >
                    {purchasing ? (
                      <>
                        <Loader2 className="animate-spin" size={18} /> Processing…
                      </>
                    ) : (
                      <>
                        <Lock size={15} />
                        Make Payment
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right: live gift card preview (page UI — email uses separate BMS template) */}
              <div
                className="bg-white rounded-lg shadow-[0_2px_14px_rgba(0,0,0,0.08)] p-5 sm:p-6 lg:p-7 lg:sticky lg:self-start lg:overflow-y-auto lg:[top:var(--gift-preview-top)] lg:[max-height:var(--gift-preview-max)] [scrollbar-width:thin]"
                style={
                  {
                    ["--gift-preview-top"]: `${stickyOffsetPx}px`,
                    ["--gift-preview-max"]: `calc(100vh - ${stickyOffsetPx + 16}px)`,
                  } as CSSProperties
                }
              >
                <div className="overflow-hidden rounded-md border border-[#E8E8E8]">
                  <GiftCardDesignFace
                    design={design}
                    size="preview"
                    className="aspect-[16/10] w-full rounded-none!"
                  />
                  <div className="px-4 sm:px-5 py-4 sm:py-5 space-y-3">
                    <p className="text-[14px] text-[#333333]">
                      <span className="font-semibold">To</span> {previewTo}
                    </p>
                    <p className="text-[14px] text-[#666666] italic line-clamp-4 min-h-5">
                      {previewMsg}
                    </p>
                    <p className="text-[14px] text-[#333333]">
                      Best Wishes{" "}
                      <span className="font-semibold text-[#6900AA]">{previewFrom}</span>
                    </p>

                    <div className="border-t border-dashed border-[#D4D4D4] pt-3.5 mt-1">
                      <div className="rounded border border-dashed border-[#C8C8C8] bg-[#FAFAFA] px-3 py-3 text-center">
                        <p className="text-[11px] font-semibold text-[#666666]">
                          Gift Card Voucher Code
                        </p>
                        <p className="text-sm font-medium text-[#9CA3AF] mt-1">Voucher Code</p>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-[12px] sm:text-[13px] text-[#6B7280] leading-relaxed">
                  Here is the preview of your gift card. Please confirm that the image above is the
                  gift card you selected, before continuing to the checkout page.
                </p>
              </div>
            </form>
          </div>
        </>
      )}

      <CustomerAuthModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => {
          setLoginOpen(false);
          toast.success("Signed in — tap Make Payment to continue");
        }}
      />

      <GiftCardInfoModals kind={infoModal} onClose={() => setInfoModal(null)} />
    </div>
  );
}
