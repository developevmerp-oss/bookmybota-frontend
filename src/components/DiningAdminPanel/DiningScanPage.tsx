"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, ImageUp, Loader2, QrCode, Tag, Users, Clock, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import {
  useScanDiningBookingQrMutation,
  useCheckoutDiningBookingMutation,
  type Booking,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { formatDate, formatTime12h } from "@/lib/dateFormat";
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

  const [scanQr, { isLoading: isScanning }] = useScanDiningBookingQrMutation();
  const [checkout, { isLoading: isCheckingOut }] = useCheckoutDiningBookingMutation();

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
        setScanned(result.data);
        await stopCamera();
        toast.success("Booking found");
      } catch (err) {
        lastTokenRef.current = "";
        toast.error(extractApiError(err, "No booking found for this QR"));
      }
    },
    [scanQr, stopCamera]
  );

  const startCamera = async () => {
    if (starting || cameraOn) return;
    setStarting(true);
    setCameraError("");
    setScanned(null);
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

  const handleCheckout = async () => {
    if (!scanned?.id) return;
    try {
      const result = await checkout(scanned.id).unwrap();
      setScanned(result.data);
      toast.success("Guest checked out. Apply this offer on the food bill.");
    } catch (err) {
      toast.error(extractApiError(err, "Checkout failed"));
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
          Scan the customer booking QR at arrival. You will see their dining offer so you can apply it on the food bill.
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
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border border-white/10 text-white hover:bg-white/5"
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
              <p className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Guest</p>
              <h3 className="text-xl font-bold text-white">{scanned.customer_name || scanned.guest_name || "Guest"}</h3>
              <p className="text-sm text-zinc-400">{scanned.customer_phone || scanned.guest_phone || "—"}</p>
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
              <Tag size={13} /> Discount offer for this guest
            </p>
            {offer?.title ? (
              <>
                <p className="text-lg font-extrabold text-white mt-1">{offer.title}</p>
                <p className="text-xs text-zinc-300 mt-0.5">{offer.type || "Offer"}{offer.validity ? ` · ${offer.validity}` : ""}</p>
                <p className="text-xs text-zinc-400 mt-2">
                  Apply this on the food bill at the restaurant. Online booking total is not discounted.
                </p>
              </>
            ) : (
              <p className="text-sm text-zinc-400 mt-1">No dining offer is attached to this booking.</p>
            )}
          </div>

          {scanned.status !== "CANCELLED" && scanned.status !== "COMPLETED" && (
            <button
              type="button"
              onClick={() => void handleCheckout()}
              disabled={isCheckingOut}
              className="w-full btn-primary rounded-xl py-3 text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {isCheckingOut && <Loader2 size={16} className="animate-spin" />}
              Checkout guest
            </button>
          )}
          {scanned.status === "COMPLETED" && scanned.checked_out_at && (
            <p className="text-xs text-emerald-400 text-center">Checked out at {formatDate(scanned.checked_out_at)} {formatTime12h(scanned.checked_out_at)}</p>
          )}
        </div>
      )}
    </div>
  );
}
