"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, ImageUp, Loader2, QrCode, Tag, Users, Clock, UtensilsCrossed, Gift, MessageSquare, Search, Check, Calculator, Link2, CreditCard, User, Phone, ArrowRight, Coins } from "lucide-react";
import { toast } from "sonner";
import {
  useScanDiningBookingQrMutation,
  useCheckoutDiningBookingMutation,
  useValidateMerchantPromoCodeMutation,
  useValidatePlatformPromoCodeMutation,
  useRedeemWalkInMerchantPromoMutation,
  useMerchantVerifyGiftCardMutation,
  useMerchantPreviewGiftCardMutation,
  useMerchantRedeemGiftCardMutation,
  useGetMerchantGiftCardRedemptionsQuery,
  type Booking,
  type MerchantGiftCardVerify,
  type MerchantGiftCardPreview,
} from "@/services/api";
import { formatDiningOfferDiscount, calculateDiningOfferDiscountAmount } from "@/lib/diningOffers";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { formatDate, formatTime12h } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/currencyFormat";
import { extractApiError } from "@/lib/apiErrors";
import {
  diningScanTokenSchema,
  type DiningScanTokenValues,
} from "@/lib/diningPartnerFormSchemas";
import PhoneInput from "@/components/Shared/PhoneInput";
import { sanitizePhoneInput } from "@/lib/validation";

const SCANNER_REGION_ID = "dining-guest-qr-reader";
const fieldErrorClass = "mt-1.5 text-[11px] font-semibold text-rose-500";

function RequiredMark() {
  return <span className="text-rose-500">*</span>;
}

type PromoBillPreview = {
  title?: string;
  discount_label?: string;
  promo_code?: string;
  bill_amount: number;
  discount_amount: number;
  final_amount: number;
};

function buildPromoBillPreview(
  bill: number,
  result: {
    title?: string;
    discount_label?: string;
    promo_code?: string;
    discount_type?: string;
    discount_value?: number;
    max_discount?: number | null;
    discount_amount?: number;
    final_amount?: number;
  }
): PromoBillPreview {
  const discountAmount =
    result.discount_amount != null && Number.isFinite(Number(result.discount_amount))
      ? Number(result.discount_amount)
      : calculateDiningOfferDiscountAmount(bill, result);
  const finalAmount =
    result.final_amount != null && Number.isFinite(Number(result.final_amount))
      ? Number(result.final_amount)
      : Math.max(0, Math.round((bill - discountAmount) * 100) / 100);

  return {
    title: result.title,
    discount_label: result.discount_label,
    promo_code: result.promo_code,
    bill_amount: bill,
    discount_amount: discountAmount,
    final_amount: finalAmount,
  };
}

function OfferBillBreakdown({ preview }: { preview: PromoBillPreview }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 space-y-1">
      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Promo validated</p>
      {preview.title && <p className="text-sm font-semibold text-slate-800">{preview.title}</p>}
      {preview.discount_label && (
        <p className="text-xs text-emerald-700">{preview.discount_label}</p>
      )}
      <div className="flex justify-between text-sm text-slate-600 pt-0.5">
        <span>Total bill</span>
        <span className="font-semibold text-slate-800">
          {formatMoney(preview.bill_amount, { compact: true })}
        </span>
      </div>
      <div className="flex justify-between text-sm text-emerald-700">
        <span>Discount</span>
        <span className="font-semibold">
          −{formatMoney(preview.discount_amount, { compact: true })}
        </span>
      </div>
      <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-emerald-200">
        <span>Guest pays</span>
        <span>{formatMoney(preview.final_amount, { compact: true })}</span>
      </div>
    </div>
  );
}

export default function DiningScanPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastTokenRef = useRef("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanned, setScanned] = useState<Booking | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [redemptionNotes, setRedemptionNotes] = useState("");
  const [promoPreview, setPromoPreview] = useState<PromoBillPreview | null>(null);
  const [promoValidated, setPromoValidated] = useState(false);

  const [walkInCode, setWalkInCode] = useState("");
  const [walkInBill, setWalkInBill] = useState("");
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInNotes, setWalkInNotes] = useState("");
  const [walkInPreview, setWalkInPreview] = useState<PromoBillPreview | null>(null);

  const [gcCode, setGcCode] = useState("");
  const [gcBill, setGcBill] = useState("");
  const [gcGuestName, setGcGuestName] = useState("");
  const [gcGuestPhone, setGcGuestPhone] = useState("");
  const [gcVerified, setGcVerified] = useState<MerchantGiftCardVerify | null>(null);
  const [gcPreview, setGcPreview] = useState<MerchantGiftCardPreview | null>(null);

  const {
    register: registerToken,
    handleSubmit: handleTokenSubmit,
    setValue: setTokenValue,
    formState: { errors: tokenErrors },
  } = useForm<DiningScanTokenValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(diningScanTokenSchema) as any,
    defaultValues: { token: "" },
    mode: "onSubmit",
  });

  const [scanQr, { isLoading: isScanning }] = useScanDiningBookingQrMutation();
  const [checkout, { isLoading: isCheckingOut }] = useCheckoutDiningBookingMutation();
  const [validatePromo, { isLoading: validatingPromo }] = useValidateMerchantPromoCodeMutation();
  const [validatePlatformPromo, { isLoading: validatingPlatformPromo }] =
    useValidatePlatformPromoCodeMutation();
  const [validateWalkIn, { isLoading: validatingWalkIn }] = useValidateMerchantPromoCodeMutation();
  const [redeemWalkIn, { isLoading: redeemingWalkIn }] = useRedeemWalkInMerchantPromoMutation();
  const [verifyGiftCard, { isLoading: verifyingGc }] = useMerchantVerifyGiftCardMutation();
  const [previewGiftCard, { isLoading: previewingGc }] = useMerchantPreviewGiftCardMutation();
  const [redeemGiftCard, { isLoading: redeemingGc }] = useMerchantRedeemGiftCardMutation();
  const { data: gcRedemptionsRes, refetch: refetchGcRedemptions } = useGetMerchantGiftCardRedemptionsQuery({
    page: 1,
    limit: 5,
  });
  const recentGcRedemptions = gcRedemptionsRes?.data || [];

  const resetPromoForm = useCallback(() => {
    setPromoCode("");
    setBillAmount("");
    setRedemptionNotes("");
    setPromoPreview(null);
    setPromoValidated(false);
  }, []);

  const applyScannedBooking = useCallback((booking: Booking) => {
    setScanned(booking);
    const code = booking.applied_offer?.promo_code?.trim().toUpperCase() || "";
    setPromoCode(code);
    setBillAmount("");
    setRedemptionNotes("");
    setPromoPreview(null);
    setPromoValidated(false);
    setGcGuestName(booking.customer_name || booking.guest_name || "");
    setGcGuestPhone(booking.customer_phone || booking.guest_phone || "");
  }, []);

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) {
      setCameraOn(false);
      return;
    }
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      /* already stopped */
    }
    setCameraOn(false);
  }, []);

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  const lookupToken = useCallback(
    async (raw: string) => {
      const token = raw.trim();
      if (!token || token === lastTokenRef.current) return;
      lastTokenRef.current = token;
      setTokenValue("token", token);
      try {
        const result = await scanQr({ qr_token: token }).unwrap();
        applyScannedBooking(result.data);
        await stopCamera();
        toast.success("Guest booking loaded");
      } catch (err) {
        lastTokenRef.current = "";
        toast.error(extractApiError(err, "No booking found for this QR"));
      }
    },
    [scanQr, stopCamera, applyScannedBooking, setTokenValue]
  );

  const onTokenLookup = handleTokenSubmit(async (values) => {
    await lookupToken(values.token);
  });

  const startCamera = async () => {
    if (starting || cameraOn) return;
    setStarting(true);
    setCameraError("");
    setScanned(null);
    resetPromoForm();
    lastTokenRef.current = "";

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera is not available in this browser. Use HTTPS or upload a QR image.");
      }

      const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      permissionStream.getTracks().forEach((track) => track.stop());

      await stopCamera();
      const scanner = new Html5Qrcode(SCANNER_REGION_ID, { verbose: false });
      scannerRef.current = scanner;

      const cameras = await Html5Qrcode.getCameras();
      if (!cameras.length) {
        throw new Error("No camera was found on this device.");
      }

      const rearCam =
        cameras.find((cam) => /back|rear|environment/i.test(cam.label)) || cameras[cameras.length - 1];

      const config = {
        fps: 10,
        qrbox: { width: 240, height: 240 },
        aspectRatio: 1.777,
        disableFlip: false,
      };

      try {
        await scanner.start(
          rearCam.id,
          config,
          (decoded) => {
            void lookupToken(decoded);
          },
          () => undefined
        );
      } catch {
        await scanner.start(
          { facingMode: "user" },
          config,
          (decoded) => {
            void lookupToken(decoded);
          },
          () => undefined
        );
      }

      setCameraOn(true);
    } catch (err) {
      scannerRef.current = null;
      const message =
        err instanceof Error
          ? err.message
          : "Could not start the camera. Allow permission or upload a QR image.";
      setCameraError(message);
      toast.error(message);
    } finally {
      setStarting(false);
    }
  };

  const handleScanFile = async (file: File | undefined) => {
    if (!file) return;
    setCameraError("");
    lastTokenRef.current = "";
    try {
      await stopCamera();
      const scanner = new Html5Qrcode(SCANNER_REGION_ID, { verbose: false });
      scannerRef.current = scanner;
      const decoded = await scanner.scanFile(file, true);
      await lookupToken(decoded);
    } catch (err) {
      toast.error(extractApiError(err, "Could not read a QR code from that image."));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleValidateBookingPromo = async () => {
    const code = promoCode.trim();
    if (!code) {
      toast.error("Enter the promo code from the guest's offer.");
      return;
    }
    const bill = Number(billAmount);
    if (!Number.isFinite(bill) || bill <= 0) {
      toast.error("Enter the total food bill amount.");
      return;
    }
    const isPlatform =
      String(scanned?.applied_offer?.source || "").toLowerCase() === "platform" ||
      String(scanned?.applied_offer?.type || "").toLowerCase().includes("bookmybota");
    try {
      if (isPlatform) {
        const result = await validatePlatformPromo({
          restaurant_id: scanned?.business_id,
          promo_code: code,
          bill_amount: bill,
          booking_id: scanned?.id,
          guest_phone: scanned?.customer_phone || scanned?.guest_phone || undefined,
        }).unwrap();
        const bookingCode = scanned?.applied_offer?.promo_code?.trim().toUpperCase();
        if (bookingCode && result.promo_code?.toUpperCase() !== bookingCode) {
          setPromoPreview(null);
          setPromoValidated(false);
          toast.error("This code does not match the BookMyBota offer selected at booking.");
          return;
        }
        const discountLabel =
          result.discount_type === "FLAT"
            ? `${Math.round(Number(result.discount_value) || 0)} ETB OFF`
            : `${result.discount_value}% OFF`;
        setPromoPreview(
          buildPromoBillPreview(bill, {
            title: result.title,
            promo_code: result.promo_code,
            discount_label: discountLabel,
            discount_amount: Number(result.discount_amount) || 0,
            final_amount: Math.max(0, bill - (Number(result.discount_amount) || 0)),
          })
        );
        setPromoValidated(true);
        toast.success(`Valid BookMyBota offer: ${discountLabel}`);
        return;
      }

      const result = await validatePromo({ promo_code: code, bill_amount: bill }).unwrap();
      const bookingCode = scanned?.applied_offer?.promo_code?.trim().toUpperCase();
      if (bookingCode && result.promo_code?.toUpperCase() !== bookingCode) {
        setPromoPreview(null);
        setPromoValidated(false);
        toast.error("This code does not match the offer selected at booking.");
        return;
      }
      setPromoPreview(buildPromoBillPreview(bill, result));
      setPromoValidated(true);
      toast.success(`Valid: ${result.discount_label || result.title}`);
    } catch (err) {
      setPromoPreview(null);
      setPromoValidated(false);
      toast.error(extractApiError(err, "Invalid promo code."));
    }
  };

  const handleRedeemBooking = async () => {
    if (!scanned?.id) return;
    const hasOffer = Boolean(scanned?.applied_offer?.title);
    const bookingOffer = scanned?.applied_offer;
    const parsedBill = billAmount.trim() ? Number(billAmount) : null;

    if (hasOffer && bookingOffer?.promo_code && !promoValidated) {
      toast.error("Validate the promo code before redeeming.");
      return;
    }
    if (hasOffer && parsedBill != null && (!Number.isFinite(parsedBill) || parsedBill <= 0)) {
      toast.error("Enter the total food bill amount.");
      return;
    }
    if (parsedBill != null && (!Number.isFinite(parsedBill) || parsedBill < 0)) {
      toast.error("Enter a valid bill amount.");
      return;
    }

    try {
      const result = await checkout({
        id: scanned.id,
        offer_redeemed: hasOffer,
        bill_amount: parsedBill,
        ...(hasOffer && promoCode.trim() ? { promo_code: promoCode.trim() } : {}),
        ...(redemptionNotes.trim() ? { offer_redemption_notes: redemptionNotes.trim() } : {}),
      }).unwrap();
      applyScannedBooking(result.data);
      toast.success(result.message || "Offer redeemed and visit completed.");
    } catch (err) {
      toast.error(extractApiError(err, "Redemption failed"));
    }
  };

  const handleCompleteVisitOnly = async () => {
    if (!scanned?.id) return;
    try {
      const result = await checkout({
        id: scanned.id,
        offer_redeemed: false,
        bill_amount: billAmount.trim() ? Number(billAmount) : null,
        ...(redemptionNotes.trim() ? { offer_redemption_notes: redemptionNotes.trim() } : {}),
      }).unwrap();
      applyScannedBooking(result.data);
      toast.success(result.message || "Guest checked out.");
    } catch (err) {
      toast.error(extractApiError(err, "Checkout failed"));
    }
  };

  const handleValidateWalkIn = async () => {
    const code = walkInCode.trim();
    if (!code) {
      toast.error("Enter a promo code.");
      return;
    }
    const bill = Number(walkInBill);
    if (!Number.isFinite(bill) || bill <= 0) {
      toast.error("Enter the food bill amount.");
      return;
    }
    try {
      const result = await validateWalkIn({ promo_code: code, bill_amount: bill }).unwrap();
      setWalkInPreview(buildPromoBillPreview(bill, result));
      toast.success(`Valid: ${result.discount_label || result.title}`);
    } catch (err) {
      setWalkInPreview(null);
      toast.error(extractApiError(err, "Invalid promo code."));
    }
  };

  const handleRedeemWalkIn = async () => {
    const code = walkInCode.trim();
    const bill = Number(walkInBill);
    if (!code) {
      toast.error("Enter a promo code.");
      return;
    }
    if (!Number.isFinite(bill) || bill <= 0) {
      toast.error("Enter the food bill amount.");
      return;
    }
    try {
      await redeemWalkIn({
        promo_code: code,
        bill_amount: bill,
        guest_name: walkInName.trim() || undefined,
        guest_phone: walkInPhone.trim() ? sanitizePhoneInput(walkInPhone) : undefined,
        notes: walkInNotes.trim() || undefined,
      }).unwrap();
      toast.success("Walk-in offer redeemed.");
      setWalkInCode("");
      setWalkInBill("");
      setWalkInName("");
      setWalkInPhone("");
      setWalkInNotes("");
      setWalkInPreview(null);
    } catch (err) {
      toast.error(extractApiError(err, "Redemption failed."));
    }
  };

  const resetGiftCardForm = () => {
    setGcVerified(null);
    setGcPreview(null);
  };

  const handleVerifyGiftCard = async () => {
    const code = gcCode.trim();
    if (!code) {
      toast.error("Enter a gift card code.");
      return;
    }
    try {
      const data = await verifyGiftCard({ code }).unwrap();
      setGcVerified(data);
      setGcPreview(null);
      toast.success("Gift card verified");
    } catch (err) {
      resetGiftCardForm();
      toast.error(extractApiError(err, "Could not verify gift card."));
    }
  };

  const handlePreviewGiftCard = async () => {
    const code = gcCode.trim();
    const bill = Number(gcBill);
    if (!code) {
      toast.error("Enter a gift card code.");
      return;
    }
    if (!Number.isFinite(bill) || bill <= 0) {
      toast.error("Enter the food bill amount.");
      return;
    }
    try {
      const data = await previewGiftCard({ code, bill_amount: bill }).unwrap();
      setGcVerified(data);
      setGcPreview(data);
      toast.success("Split calculated");
    } catch (err) {
      setGcPreview(null);
      toast.error(extractApiError(err, "Could not preview gift card."));
    }
  };

  const handleRedeemGiftCard = async () => {
    const code = gcCode.trim();
    const bill = Number(gcBill);
    if (!code) {
      toast.error("Enter a gift card code.");
      return;
    }
    if (!Number.isFinite(bill) || bill <= 0) {
      toast.error("Enter the food bill amount.");
      return;
    }
    if (!gcVerified) {
      toast.error("Verify the gift card first.");
      return;
    }
    try {
      const res = await redeemGiftCard({
        code,
        bill_amount: bill,
        booking_id: scanned?.id,
        guest_name: gcGuestName.trim() || undefined,
        guest_phone: gcGuestPhone.trim() || undefined,
      }).unwrap();
      toast.success(res.message || "Gift card redeemed.");
      setGcCode("");
      setGcBill("");
      resetGiftCardForm();
      void refetchGcRedemptions();
    } catch (err) {
      toast.error(extractApiError(err, "Gift card redemption failed."));
    }
  };

  if (!user?.business_id) {
    return <p className="text-slate-500">Loading restaurant account...</p>;
  }

  const offer = scanned?.applied_offer;
  const isPlatformOffer =
    String(offer?.source || "").toLowerCase() === "platform" ||
    String(offer?.type || "").toLowerCase().includes("bookmybota");
  const showWalkInPromo =
    !scanned ||
    scanned.status === "COMPLETED" ||
    scanned.status === "CANCELLED" ||
    !offer?.title;

  const fieldWrap =
    "flex h-11 items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-3.5 focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-500/10 transition-shadow";
  const fieldInput =
    "w-full bg-transparent border-0 p-0 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none";
  const primaryBtn =
    "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white bg-[#e11d48] hover:bg-[#be123c] shadow-sm shadow-rose-600/20 disabled:opacity-60 transition-all";
  const secondaryBtn =
    "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 disabled:opacity-60 transition-all";

  return (
    <div className="-m-4 sm:-m-8 min-h-[calc(100vh-5rem)] bg-white p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-5 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-[1.75rem] font-bold text-slate-900 tracking-tight">
            Scan guest QR
          </h2>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Scan guest QR for offers, redeem walk-in promos, or redeem a BookMyBota Gift Card against the food bill.
          </p>
        </div>
        
      </div>

      {/* Top row: Scanner + Manual lookup */}
      <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Scanner */}
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 shadow-lg min-h-[280px] flex flex-col">
          <div className="relative flex-1 min-h-[220px]">
            <div
              id={SCANNER_REGION_ID}
              className="absolute inset-0 w-full h-full overflow-hidden [&>video]:w-full [&>video]:h-full [&>video]:object-cover [&>img]:hidden"
            />
            {!cameraOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-800 to-slate-950">
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <span className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-lg" />
                  <span className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr-lg" />
                  <span className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl-lg" />
                  <span className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br-lg" />
                  <div className="text-center text-white px-2">
                    <QrCode size={36} className="mx-auto mb-2 opacity-90" />
                    <p className="text-sm font-semibold">
                      {starting ? "Starting camera..." : "Scan QR code"}
                    </p>
                    <p className="text-[11px] text-white/70 mt-1">
                      Position the QR code within the frame.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          {cameraError && (
            <p className="px-4 py-1.5 text-xs text-amber-300 bg-black/40">{cameraError}</p>
          )}
          <div className="absolute bottom-4 left-0 right-0 flex flex-wrap justify-center gap-2 px-4">
            {!cameraOn ? (
              <button
                type="button"
                onClick={() => void startCamera()}
                disabled={starting}
                className={primaryBtn}
              >
                {starting ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                {starting ? "Starting..." : "Start camera"}
              </button>
            ) : (
              <button type="button" onClick={() => void stopCamera()} className={secondaryBtn}>
                Stop camera
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white bg-white/15 hover:bg-white/25 backdrop-blur border border-white/20 transition-all"
            >
              <ImageUp size={16} /> Upload QR image
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void handleScanFile(e.target.files?.[0])}
            />
          </div>
        </div>

        {/* Manual lookup */}
        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col">
          <div className="flex items-start gap-3 mb-5">
            <span className="h-11 w-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <Search size={20} />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">Manual Token Lookup</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Paste or type the guest QR token if the camera is unavailable.
              </p>
            </div>
          </div>

          <form className="space-y-4 flex-1 flex flex-col" onSubmit={onTokenLookup} noValidate>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
              <div className="flex-1 w-full min-w-0">
                <label className="sr-only">
                  QR token <RequiredMark />
                </label>
                <div className={fieldWrap}>
                  <Search size={16} className="text-slate-400 shrink-0" />
                  <input
                    placeholder="Or paste / type QR code (DNB-...)"
                    className={fieldInput}
                    {...registerToken("token")}
                  />
                </div>
                {tokenErrors.token && (
                  <p className={fieldErrorClass}>{tokenErrors.token.message}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={isScanning}
                className={`${primaryBtn} shrink-0 w-full sm:w-auto sm:self-start`}
              >
                {isScanning ? "Looking up..." : "Lookup"}
                {!isScanning && <ArrowRight size={16} />}
              </button>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <span className="flex-1 h-px bg-slate-200" />
              OR
              <span className="flex-1 h-px bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-auto w-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-8 text-center transition-colors cursor-pointer"
            >
              <QrCode size={28} className="mx-auto text-rose-500 mb-2" />
              <p className="text-sm font-semibold text-slate-700">
                Drag &amp; drop a QR image here or click to upload
              </p>
            </button>
          </form>
        </div>
      </div>

      {/* Guest details when scanned — keep all existing controls */}
      {scanned && (
        <div className="relative rounded-3xl bg-white border border-slate-100 shadow-lg p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Guest details
              </p>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5 truncate">
                {scanned.customer_name || scanned.guest_name || "Guest"}
              </h3>
              <p className="text-sm text-slate-600 mt-0.5">
                {scanned.customer_phone || scanned.guest_phone || "No phone on file"}
              </p>
              {scanned.qr_token && (
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">{scanned.qr_token}</p>
              )}
            </div>
            <span
              className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                scanned.status === "COMPLETED"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : scanned.status === "CANCELLED"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              {scanned.status}
            </span>
          </div>

          {scanned.special_request?.trim() ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-[11px] uppercase tracking-wider text-amber-700 font-bold flex items-center gap-1.5">
                <MessageSquare size={13} /> Special request
              </p>
              <p className="text-sm text-slate-800 mt-1 leading-relaxed whitespace-pre-wrap">
                {scanned.special_request.trim()}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={13} className="text-slate-400" />
              <span className="font-semibold text-slate-800">{formatDate(scanned.booking_time)}</span>
              <span className="text-slate-500">{formatTime12h(scanned.booking_time)}</span>
            </span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span className="inline-flex items-center gap-1.5">
              <Users size={13} className="text-slate-400" />
              Guests <span className="font-semibold text-slate-800">{scanned.guests ?? "—"}</span>
            </span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span className="inline-flex items-center gap-1.5">
              <UtensilsCrossed size={13} className="text-slate-400" />
              <span className="font-semibold text-slate-800">
                {scanned.table_number ? `Table ${scanned.table_number}` : "Unassigned"}
              </span>
            </span>
          </div>

          <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4 space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-rose-600 font-bold flex items-center gap-1.5">
              <Tag size={13} /> Offer selected at booking
            </p>
            {offer?.title ? (
              <>
                <p className="text-base font-extrabold text-slate-900">{offer.title}</p>
                {offer.promo_code && (
                  <p className="text-sm font-mono text-rose-600">{offer.promo_code}</p>
                )}
                <p className="text-xs text-slate-600">
                  {isPlatformOffer ? "BookMyBota platform offer" : offer.type || "Merchant offer"}
                </p>
                <p className="text-xs text-emerald-700">
                  {formatDiningOfferDiscount(offer as Parameters<typeof formatDiningOfferDiscount>[0])}
                </p>
                {isPlatformOffer && offer.min_bill_amount != null && Number(offer.min_bill_amount) > 0 && (
                  <p className="text-xs text-amber-700">
                    Min bill {formatMoney(Number(offer.min_bill_amount))} to redeem
                  </p>
                )}
                <p className="text-xs text-slate-500 pt-0.5">
                  {isPlatformOffer
                    ? "Apply this BookMyBota discount on the food bill. BookMyBota funds the discount — enter bill amount, validate the code, then redeem."
                    : "Apply this discount on the food bill at your restaurant. BookMyBota does not charge the guest online for dining."}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">No offer is attached to this booking.</p>
            )}
          </div>

          {scanned.status !== "CANCELLED" && scanned.status !== "COMPLETED" && (
            <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                {offer?.title ? "Redeem offer on bill" : "Complete visit"}
              </p>

              {offer?.title ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {offer.promo_code ? (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                          Promo code *
                        </label>
                        <div className={fieldWrap}>
                          <Tag size={15} className="text-slate-400 shrink-0" />
                          <input
                            value={promoCode}
                            onChange={(e) => {
                              setPromoCode(e.target.value.toUpperCase());
                              setPromoPreview(null);
                              setPromoValidated(false);
                            }}
                            placeholder={offer.promo_code}
                            className={`${fieldInput} font-mono`}
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Pre-filled from the offer chosen at booking.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-white border border-slate-200 p-3 sm:col-span-2">
                        <p className="text-xs text-slate-500">
                          This offer has no promo code — enter the bill amount and redeem directly.
                        </p>
                      </div>
                    )}
                    <div className={offer.promo_code ? "" : "sm:col-span-2"}>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                        Total bill amount (ETB) <RequiredMark />
                      </label>
                      <div className={fieldWrap}>
                        <Coins size={15} className="text-slate-400 shrink-0" />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={billAmount}
                          onChange={(e) => {
                            setBillAmount(e.target.value);
                            setPromoPreview(null);
                            setPromoValidated(false);
                          }}
                          placeholder="e.g. 1500"
                          className={fieldInput}
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                        Notes (optional)
                      </label>
                      <div className={fieldWrap}>
                        <MessageSquare size={15} className="text-slate-400 shrink-0" />
                        <input
                          type="text"
                          value={redemptionNotes}
                          onChange={(e) => setRedemptionNotes(e.target.value)}
                          placeholder="e.g. 20% off applied on main course"
                          className={fieldInput}
                        />
                      </div>
                    </div>
                  </div>

                  {promoPreview && promoValidated && <OfferBillBreakdown preview={promoPreview} />}

                  <div className="flex flex-wrap gap-2">
                    {offer.promo_code && (
                      <button
                        type="button"
                        onClick={() => void handleValidateBookingPromo()}
                        disabled={validatingPromo || validatingPlatformPromo}
                        className={secondaryBtn}
                      >
                        {(validatingPromo || validatingPlatformPromo) && (
                          <Loader2 size={16} className="animate-spin" />
                        )}
                        <Check size={16} />
                        Validate code
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleRedeemBooking()}
                      disabled={
                        isCheckingOut ||
                        Boolean(offer.promo_code && !promoValidated) ||
                        !billAmount.trim()
                      }
                      className={primaryBtn}
                    >
                      {isCheckingOut && <Loader2 size={16} className="animate-spin" />}
                      <Gift size={16} />
                      Redeem offer & complete visit
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                      Bill amount (optional)
                    </label>
                    <div className={fieldWrap}>
                      <Coins size={15} className="text-slate-400 shrink-0" />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={billAmount}
                        onChange={(e) => setBillAmount(e.target.value)}
                        placeholder="e.g. 1500"
                        className={fieldInput}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCompleteVisitOnly()}
                    disabled={isCheckingOut}
                    className={`w-full ${primaryBtn}`}
                  >
                    {isCheckingOut && <Loader2 size={16} className="animate-spin" />}
                    Complete visit
                  </button>
                </>
              )}
            </div>
          )}

          {scanned.status === "COMPLETED" && (
            <div className="space-y-2 text-center">
              {scanned.checked_out_at && (
                <p className="text-xs text-emerald-700">
                  Checked out at {formatDate(scanned.checked_out_at)}{" "}
                  {formatTime12h(scanned.checked_out_at)}
                </p>
              )}
              {scanned.offer_redeemed_at ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                    Offer redeemed
                  </p>
                  <p className="text-sm text-slate-800 mt-1">{offer?.title || "Merchant offer"}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatDate(scanned.offer_redeemed_at)} {formatTime12h(scanned.offer_redeemed_at)}
                  </p>
                  {scanned.bill_amount != null && Number(scanned.bill_amount) > 0 && (
                    <p className="text-xs text-slate-600 mt-0.5">
                      Bill recorded: {formatMoney(scanned.bill_amount, { compact: true })}
                    </p>
                  )}
                  {scanned.offer_redemption_notes && (
                    <p className="text-xs text-slate-500 mt-0.5">{scanned.offer_redemption_notes}</p>
                  )}
                </div>
              ) : offer?.title ? (
                <p className="text-xs text-slate-500">
                  Visit completed — offer was not marked as redeemed.
                </p>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Bottom row: Walk-in + Gift card */}
      <div className={`relative grid grid-cols-1 gap-4 ${showWalkInPromo ? "lg:grid-cols-2" : ""}`}>
        {showWalkInPromo && (
          <div className="rounded-3xl border border-orange-100 bg-orange-50/40 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="h-11 w-11 rounded-2xl bg-orange-100 text-orange-500 flex items-center justify-center shrink-0">
                <Tag size={20} />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">Walk-in promo redemption</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Guest without a booking? Enter your restaurant promo code and bill amount to record
                  redemption.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                  Promo Code
                </label>
                <div className={fieldWrap}>
                  <Tag size={15} className="text-orange-400 shrink-0" />
                  <input
                    value={walkInCode}
                    onChange={(e) => {
                      setWalkInCode(e.target.value.toUpperCase());
                      setWalkInPreview(null);
                    }}
                    placeholder="LUNCH20"
                    className={`${fieldInput} font-mono`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                  Bill Amount (ETB) <RequiredMark />
                </label>
                <div className={fieldWrap}>
                  <Coins size={15} className="text-orange-400 shrink-0" />
                  <input
                    type="number"
                    min="0"
                    value={walkInBill}
                    onChange={(e) => {
                      setWalkInBill(e.target.value);
                      setWalkInPreview(null);
                    }}
                    placeholder="1500"
                    className={fieldInput}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                  Guest Name (Optional)
                </label>
                <div className={fieldWrap}>
                  <User size={15} className="text-orange-400 shrink-0" />
                  <input
                    value={walkInName}
                    onChange={(e) => setWalkInName(e.target.value)}
                    className={fieldInput}
                  />
                </div>
              </div>
              <div>
                <PhoneInput
                  label="Guest Phone (Optional)"
                  labelClassName="block text-[11px] font-semibold text-slate-500 mb-1.5"
                  variant="light"
                  value={walkInPhone}
                  onChange={setWalkInPhone}
                  required={false}
                  helperText="9–12 digits if provided"
                  showIcon
                />
              </div>
            </div>

            {walkInPreview && <OfferBillBreakdown preview={walkInPreview} />}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => void handleValidateWalkIn()}
                disabled={validatingWalkIn}
                className={secondaryBtn}
              >
                {validatingWalkIn ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Validate code
              </button>
              <button
                type="button"
                onClick={() => void handleRedeemWalkIn()}
                disabled={redeemingWalkIn || !walkInPreview}
                className={`flex-1 min-w-[180px] ${primaryBtn}`}
              >
                {redeemingWalkIn ? <Loader2 size={16} className="animate-spin" /> : <Gift size={16} />}
                Redeem walk-in offer
              </button>
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-emerald-100 bg-emerald-50/40 shadow-sm p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <span className="h-11 w-11 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <Gift size={20} />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">Gift Card Redemption</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Guest pays with a BookMyBota Gift Card at the restaurant. BookMyBota settles the redeemed
                amount with you later.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                Gift Card Code <RequiredMark />
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className={`flex-1 ${fieldWrap}`}>
                  <CreditCard size={15} className="text-emerald-500 shrink-0" />
                  <input
                    value={gcCode}
                    onChange={(e) => {
                      setGcCode(e.target.value.toUpperCase());
                      resetGiftCardForm();
                    }}
                    placeholder="BOTA-XXXX-XXXX-XXXX"
                    className={`${fieldInput} font-mono`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleVerifyGiftCard()}
                  disabled={verifyingGc}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 border border-emerald-200 disabled:opacity-60 shrink-0"
                >
                  {verifyingGc && <Loader2 size={16} className="animate-spin" />}
                  Verify
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                  Restaurant Bill Amount (ETB) <RequiredMark />
                </label>
                <div className={fieldWrap}>
                  <Coins size={15} className="text-emerald-500 shrink-0" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={gcBill}
                    onChange={(e) => {
                      setGcBill(e.target.value);
                      setGcPreview(null);
                    }}
                    placeholder="1500"
                    className={fieldInput}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                  Link Scanned Booking
                </label>
                <div className={`${fieldWrap} bg-slate-50`}>
                  <Link2 size={15} className="text-emerald-500 shrink-0" />
                  <span className="text-sm text-slate-600 truncate">
                    {scanned?.id
                      ? `${scanned.customer_name || scanned.guest_name || "Guest"} · linked`
                      : "Optional — scan guest QR first"}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                  Guest Name (Optional)
                </label>
                <div className={fieldWrap}>
                  <User size={15} className="text-emerald-500 shrink-0" />
                  <input
                    value={gcGuestName}
                    onChange={(e) => setGcGuestName(e.target.value)}
                    className={fieldInput}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                  Guest Phone (Optional)
                </label>
                <div className={fieldWrap}>
                  <Phone size={15} className="text-emerald-500 shrink-0" />
                  <input
                    value={gcGuestPhone}
                    onChange={(e) => setGcGuestPhone(e.target.value)}
                    className={fieldInput}
                  />
                </div>
              </div>
            </div>
          </div>

          {gcVerified && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Gift card</p>
              <p className="text-sm font-semibold text-slate-800">
                {gcVerified.product_name} · {gcVerified.code_masked}
              </p>
              {gcVerified.customer_name && (
                <p className="text-xs text-slate-600">Customer: {gcVerified.customer_name}</p>
              )}
              <p className="text-sm text-emerald-700">
                Available balance: {formatMoney(gcVerified.current_balance, { compact: true })}
              </p>
              <p className="text-xs text-slate-500">
                Status: {gcVerified.status}
                {gcVerified.expires_at ? ` · Expiry ${formatDate(gcVerified.expires_at)}` : ""}
              </p>
            </div>
          )}

          {gcPreview && (
            <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 space-y-1.5">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Food bill</span>
                <span className="font-semibold text-slate-800">
                  {formatMoney(gcPreview.bill_amount, { compact: true })}
                </span>
              </div>
              <div className="flex justify-between text-sm text-emerald-700">
                <span>Redeem from gift card</span>
                <span className="font-semibold">
                  −{formatMoney(gcPreview.amount_applicable, { compact: true })}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-emerald-100">
                <span>Customer pays restaurant</span>
                <span>{formatMoney(gcPreview.customer_payable, { compact: true })}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Remaining gift card after redeem:{" "}
                {formatMoney(gcPreview.balance_after, { compact: true })} · Settlement to restaurant:{" "}
                {formatMoney(gcPreview.amount_applicable, { compact: true })} (pending)
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => void handlePreviewGiftCard()}
              disabled={previewingGc || !gcVerified}
              className={secondaryBtn}
            >
              {previewingGc ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Calculator size={16} />
              )}
              Calculate split
            </button>
            <button
              type="button"
              onClick={() => void handleRedeemGiftCard()}
              disabled={redeemingGc || !gcVerified || !gcPreview}
              className={`flex-1 min-w-[180px] ${primaryBtn}`}
            >
              {redeemingGc ? <Loader2 size={16} className="animate-spin" /> : <Gift size={16} />}
              Redeem Gift Card
            </button>
          </div>

          {recentGcRedemptions.length > 0 && (
            <div className="pt-2 border-t border-emerald-100">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Recent gift card redemptions
              </p>
              <ul className="space-y-1.5">
                {recentGcRedemptions.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white border border-emerald-100 px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="text-slate-800 font-semibold">
                        ****{row.code_last4} · {formatMoney(row.gift_card_amount, { compact: true })}
                      </p>
                      <p className="text-slate-500">
                        Bill {formatMoney(row.bill_amount, { compact: true })} · Guest pays{" "}
                        {formatMoney(row.customer_payable, { compact: true })}
                        {row.redeemed_at ? ` · ${formatDate(row.redeemed_at)}` : ""}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border border-amber-200 bg-amber-50 text-amber-700">
                      {row.settlement_status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
