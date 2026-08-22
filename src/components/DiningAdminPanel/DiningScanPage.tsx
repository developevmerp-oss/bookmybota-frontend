"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, ImageUp, Loader2, QrCode, Tag, Users, Clock, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import {
  useScanDiningBookingQrMutation,
  useCheckoutDiningBookingMutation,
  useValidateMerchantPromoCodeMutation,
  useRedeemWalkInMerchantPromoMutation,
  type Booking,
} from "@/services/api";
import { formatDiningOfferDiscount } from "@/lib/diningOffers";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { formatDate, formatTime12h } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/currencyFormat";
import { extractApiError } from "@/lib/apiErrors";

const SCANNER_REGION_ID = "dining-guest-qr-reader";

export default function DiningScanPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastTokenRef = useRef("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [manualToken, setManualToken] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanned, setScanned] = useState<Booking | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [redemptionNotes, setRedemptionNotes] = useState("");
  const [promoPreview, setPromoPreview] = useState<{
    title?: string;
    discount_label?: string;
    promo_code?: string;
  } | null>(null);
  const [promoValidated, setPromoValidated] = useState(false);

  const [walkInCode, setWalkInCode] = useState("");
  const [walkInBill, setWalkInBill] = useState("");
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInNotes, setWalkInNotes] = useState("");
  const [walkInPreview, setWalkInPreview] = useState<{ title?: string; discount_label?: string; promo_code?: string } | null>(null);

  const [scanQr, { isLoading: isScanning }] = useScanDiningBookingQrMutation();
  const [checkout, { isLoading: isCheckingOut }] = useCheckoutDiningBookingMutation();
  const [validatePromo, { isLoading: validatingPromo }] = useValidateMerchantPromoCodeMutation();
  const [validateWalkIn, { isLoading: validatingWalkIn }] = useValidateMerchantPromoCodeMutation();
  const [redeemWalkIn, { isLoading: redeemingWalkIn }] = useRedeemWalkInMerchantPromoMutation();

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
    [scanQr, stopCamera, applyScannedBooking]
  );

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
    try {
      const result = await validatePromo({ promo_code: code, bill_amount: bill }).unwrap();
      const bookingCode = scanned?.applied_offer?.promo_code?.trim().toUpperCase();
      if (bookingCode && result.promo_code?.toUpperCase() !== bookingCode) {
        setPromoPreview(null);
        setPromoValidated(false);
        toast.error("This code does not match the offer selected at booking.");
        return;
      }
      setPromoPreview(result);
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
    const bill = walkInBill.trim() ? Number(walkInBill) : undefined;
    try {
      const result = await validateWalkIn({
        promo_code: code,
        ...(bill != null && Number.isFinite(bill) ? { bill_amount: bill } : {}),
      }).unwrap();
      setWalkInPreview(result);
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
        guest_phone: walkInPhone.trim() || undefined,
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

  if (!user?.business_id) {
    return <p className="text-zinc-400">Loading restaurant account...</p>;
  }

  const offer = scanned?.applied_offer;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">Scan guest QR</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Scan or enter the guest QR to load their details and booking offer. Enter promo code and bill, validate, then redeem.
        </p>
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 p-5 space-y-4">
        <div className="relative overflow-hidden rounded-xl bg-black min-h-[280px]">
          <div id={SCANNER_REGION_ID} className="w-full overflow-hidden rounded-xl [&>video]:w-full [&>video]:rounded-xl [&>img]:hidden" />
          {!cameraOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 gap-2 pointer-events-none">
              <QrCode size={40} />
              <p className="text-sm">{starting ? "Starting camera..." : "Camera is off"}</p>
            </div>
          )}
        </div>
        {cameraError && <p className="text-xs text-amber-400">{cameraError}</p>}
        <div className="flex flex-wrap gap-2">
          {!cameraOn ? (
            <button
              type="button"
              onClick={() => void startCamera()}
              disabled={starting}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {starting ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              {starting ? "Starting..." : "Start camera"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void stopCamera()}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border border-white/10 text-white hover:bg-white/5"
            >
              Stop camera
            </button>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
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
        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void lookupToken(manualToken);
          }}
        >
          <input
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            placeholder="Or paste / type QR code (DNB-...)"
            className="flex-1 bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500"
          />
          <button
            type="submit"
            disabled={isScanning}
            className="btn-primary rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
          >
            {isScanning ? "Looking up..." : "Lookup"}
          </button>
        </form>
      </div>

      {scanned && (
        <div className="glass-panel rounded-2xl border border-white/5 p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Guest details</p>
              <h3 className="text-xl font-bold text-white mt-0.5">
                {scanned.customer_name || scanned.guest_name || "Guest"}
              </h3>
              <p className="text-sm text-zinc-300 mt-1">
                {scanned.customer_phone || scanned.guest_phone || "No phone on file"}
              </p>
              {scanned.qr_token && (
                <p className="text-[11px] font-mono text-zinc-500 mt-1">{scanned.qr_token}</p>
              )}
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
              scanned.status === "COMPLETED"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : scanned.status === "CANCELLED"
                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                : "bg-amber-500/10 text-amber-300 border-amber-500/20"
            }`}>
              {scanned.status}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/5 border border-white/5 p-3">
              <p className="text-[11px] text-zinc-500 flex items-center gap-1"><Clock size={12} /> Time</p>
              <p className="text-sm font-semibold text-white mt-1">{formatDate(scanned.booking_time)}</p>
              <p className="text-xs text-zinc-400">{formatTime12h(scanned.booking_time)}</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/5 p-3">
              <p className="text-[11px] text-zinc-500 flex items-center gap-1"><Users size={12} /> Guests</p>
              <p className="text-sm font-semibold text-white mt-1">{scanned.guests ?? "—"}</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/5 p-3">
              <p className="text-[11px] text-zinc-500 flex items-center gap-1"><UtensilsCrossed size={12} /> Table</p>
              <p className="text-sm font-semibold text-white mt-1">
                {scanned.table_number ? `Table ${scanned.table_number}` : "Unassigned"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-rose-400/40 bg-rose-500/10 p-4">
            <p className="text-[11px] uppercase tracking-wider text-rose-300 font-bold flex items-center gap-1.5">
              <Tag size={13} /> Offer selected at booking
            </p>
            {offer?.title ? (
              <>
                <p className="text-lg font-extrabold text-white mt-1">{offer.title}</p>
                {offer.promo_code && (
                  <p className="text-sm font-mono text-rose-300 mt-0.5">{offer.promo_code}</p>
                )}
                <p className="text-xs text-zinc-300 mt-0.5">
                  {offer.type || "Offer"}
                </p>
                <p className="text-xs text-emerald-300 mt-1">
                  {formatDiningOfferDiscount(offer as Parameters<typeof formatDiningOfferDiscount>[0])}
                </p>
                <p className="text-xs text-zinc-400 mt-2">
                  Apply this discount on the food bill at your restaurant. BookMyBota does not charge the guest online for dining.
                </p>
              </>
            ) : (
              <p className="text-sm text-zinc-400 mt-1">No merchant offer is attached to this booking.</p>
            )}
          </div>

          {scanned.status !== "CANCELLED" && scanned.status !== "COMPLETED" && (
            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">
                {offer?.title ? "Redeem offer on bill" : "Complete visit"}
              </p>

              {offer?.title ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {offer.promo_code ? (
                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                          Promo code *
                        </label>
                        <input
                          value={promoCode}
                          onChange={(e) => {
                            setPromoCode(e.target.value.toUpperCase());
                            setPromoPreview(null);
                            setPromoValidated(false);
                          }}
                          placeholder={offer.promo_code}
                          className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-rose-500"
                        />
                        <p className="text-[11px] text-zinc-500 mt-1">
                          Pre-filled from the offer chosen at booking.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-white/5 border border-white/5 p-3 sm:col-span-2">
                        <p className="text-xs text-zinc-400">
                          This offer has no promo code — enter the bill amount and redeem directly.
                        </p>
                      </div>
                    )}
                    <div className={offer.promo_code ? "" : "sm:col-span-2"}>
                      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                        Total bill amount (ETB) *
                      </label>
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
                        className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      Notes (optional)
                    </label>
                    <input
                      type="text"
                      value={redemptionNotes}
                      onChange={(e) => setRedemptionNotes(e.target.value)}
                      placeholder="e.g. 20% off applied on main course"
                      className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  {promoPreview && promoValidated && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Promo validated</p>
                      <p className="text-sm font-semibold text-white mt-1">{promoPreview.title}</p>
                      <p className="text-xs text-emerald-300 mt-0.5">{promoPreview.discount_label}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {offer.promo_code && (
                      <button
                        type="button"
                        onClick={() => void handleValidateBookingPromo()}
                        disabled={validatingPromo}
                        className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
                      >
                        {validatingPromo && <Loader2 size={16} className="animate-spin" />}
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
                      className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
                    >
                      {isCheckingOut && <Loader2 size={16} className="animate-spin" />}
                      Redeem offer & complete visit
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      Bill amount (optional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={billAmount}
                      onChange={(e) => setBillAmount(e.target.value)}
                      placeholder="e.g. 1500"
                      className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCompleteVisitOnly()}
                    disabled={isCheckingOut}
                    className="w-full btn-primary rounded-xl py-3 text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2"
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
                <p className="text-xs text-emerald-400">
                  Checked out at {formatDate(scanned.checked_out_at)} {formatTime12h(scanned.checked_out_at)}
                </p>
              )}
              {scanned.offer_redeemed_at ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-left">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Offer redeemed</p>
                  <p className="text-sm text-white mt-1">{offer?.title || "Merchant offer"}</p>
                  <p className="text-xs text-zinc-400 mt-1">
                    {formatDate(scanned.offer_redeemed_at)} {formatTime12h(scanned.offer_redeemed_at)}
                  </p>
                  {scanned.bill_amount != null && Number(scanned.bill_amount) > 0 && (
                    <p className="text-xs text-zinc-300 mt-1">
                      Bill recorded: {formatMoney(scanned.bill_amount, { compact: true })}
                    </p>
                  )}
                  {scanned.offer_redemption_notes && (
                    <p className="text-xs text-zinc-400 mt-1">{scanned.offer_redemption_notes}</p>
                  )}
                </div>
              ) : offer?.title ? (
                <p className="text-xs text-zinc-500">Visit completed — offer was not marked as redeemed.</p>
              ) : null}
            </div>
          )}
        </div>
      )}

      <div className="glass-panel rounded-2xl border border-white/5 p-6 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-white">Walk-in promo redemption</h3>
          <p className="text-sm text-zinc-400 mt-1">
            Guest without a booking? Enter your restaurant promo code and bill amount to record redemption.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">Promo code</label>
            <input
              value={walkInCode}
              onChange={(e) => {
                setWalkInCode(e.target.value.toUpperCase());
                setWalkInPreview(null);
              }}
              placeholder="LUNCH20"
              className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-rose-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">Bill amount (ETB) *</label>
            <input
              type="number"
              min="0"
              value={walkInBill}
              onChange={(e) => setWalkInBill(e.target.value)}
              placeholder="1500"
              className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">Guest name (optional)</label>
            <input
              value={walkInName}
              onChange={(e) => setWalkInName(e.target.value)}
              className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">Guest phone (optional)</label>
            <input
              value={walkInPhone}
              onChange={(e) => setWalkInPhone(e.target.value)}
              className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>

        {walkInPreview && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <p className="text-sm font-semibold text-white">{walkInPreview.title}</p>
            <p className="text-xs text-emerald-300 mt-0.5">{walkInPreview.discount_label}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleValidateWalkIn()}
            disabled={validatingWalkIn}
            className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {validatingWalkIn && <Loader2 size={16} className="animate-spin" />}
            Validate code
          </button>
          <button
            type="button"
            onClick={() => void handleRedeemWalkIn()}
            disabled={redeemingWalkIn}
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {redeemingWalkIn && <Loader2 size={16} className="animate-spin" />}
            Redeem walk-in offer
          </button>
        </div>
      </div>
    </div>
  );
}
