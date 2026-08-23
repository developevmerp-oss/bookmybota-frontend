"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  ImageUp,
  Loader2,
  MapPin,
  QrCode,
  Ticket,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCheckInOrganizerEventBookingMutation,
  useScanOrganizerEventBookingMutation,
  type EventBooking,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { formatDate, formatTime12h } from "@/lib/dateFormat";
import { extractApiError } from "@/lib/apiErrors";
import { ticketModeLabel } from "@/lib/eventTicketMode";
import { expandEventScanTokens, isEventBookingCheckedIn } from "@/lib/eventScanToken";
import { shortBookingCode } from "@/lib/eventTicketPdf";

const SCANNER_REGION_ID = "organizer-event-qr-reader";

export default function OrganizerScanPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastTokenRef = useRef("");
  const lastScanAtRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [manualToken, setManualToken] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanned, setScanned] = useState<EventBooking | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [lastDecoded, setLastDecoded] = useState("");

  const [scanQr, { isLoading: isScanning }] = useScanOrganizerEventBookingMutation();
  const [checkIn, { isLoading: isCheckingIn }] = useCheckInOrganizerEventBookingMutation();

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

  const applyScanResult = useCallback((booking: EventBooking) => {
    setScanned(booking);

    if (booking.just_checked_in) {
      toast.success(booking.check_in_message || "Guest checked in successfully.");
      return;
    }

    if (isEventBookingCheckedIn(booking)) {
      toast.warning(
        booking.check_in_message ||
          "This ticket was already checked in. It cannot be used again for entry."
      );
      return;
    }

    if (booking.can_check_in) {
      toast.success("Booking found — tap Check in guest to allow entry (one time only).");
      return;
    }

    toast.error(booking.check_in_message || "This booking cannot be checked in.");
  }, []);

  const resolveBooking = useCallback(
    async (raw: string, force = false) => {
      const token = raw.trim();
      if (!token) return;

      const now = Date.now();
      if (!force && token === lastTokenRef.current && now - lastScanAtRef.current < 1200) {
        return;
      }
      lastTokenRef.current = token;
      lastScanAtRef.current = now;
      setLastDecoded(token);
      setLookingUp(true);

      try {
        const result = await scanQr({ qr_token: token }).unwrap();
        applyScanResult(result.data);
        await stopCamera();
      } catch (err) {
        lastTokenRef.current = "";
        const tokens = expandEventScanTokens(token);
        toast.error(
          extractApiError(
            err,
            tokens.length
              ? `No booking found for "${tokens[0]}". Use the organizer account for this event.`
              : "No booking found for this code at your events."
          )
        );
      } finally {
        setLookingUp(false);
      }
    },
    [applyScanResult, scanQr, stopCamera]
  );

  const resetForNextScan = () => {
    setScanned(null);
    lastTokenRef.current = "";
    lastScanAtRef.current = 0;
    setLastDecoded("");
    setManualToken("");
  };

  const startCamera = async () => {
    if (starting || cameraOn) return;
    setStarting(true);
    setCameraError("");
    resetForNextScan();

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
        fps: 12,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72);
          return { width: size, height: size };
        },
        disableFlip: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      };

      try {
        await scanner.start(
          rearCam.id,
          config,
          (decoded) => {
            void resolveBooking(decoded);
          },
          () => undefined
        );
      } catch {
        await scanner.start(
          { facingMode: "user" },
          config,
          (decoded) => {
            void resolveBooking(decoded);
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
    setScanned(null);
    lastTokenRef.current = "";
    setLookingUp(true);
    try {
      await stopCamera();
      const scanner = new Html5Qrcode(SCANNER_REGION_ID, { verbose: false });
      scannerRef.current = scanner;
      const decoded = await scanner.scanFile(file, true);
      await resolveBooking(decoded, true);
    } catch (err) {
      const message = extractApiError(err, "Could not read a QR code from that image.");
      toast.error(message);
    } finally {
      setLookingUp(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleManualLookup = () => {
    void resolveBooking(manualToken, true);
  };

  const handleCheckIn = async () => {
    if (!scanned?.id) return;
    if (isEventBookingCheckedIn(scanned)) {
      toast.warning(
        scanned.check_in_message || "This ticket was already checked in and cannot be used again."
      );
      return;
    }
    try {
      const result = await checkIn(scanned.id).unwrap();
      setScanned(result.data);
      if (result.data?.just_checked_in) {
        toast.success(result.data.check_in_message || result.message || "Guest checked in successfully.");
      } else if (result.already_checked_in || result.data?.already_checked_in) {
        toast.warning(result.message || result.data?.check_in_message || "This ticket was already checked in.");
      } else {
        toast.success(result.message || "Guest checked in successfully.");
      }
    } catch (err) {
      toast.error(extractApiError(err, "Check-in failed."));
    }
  };

  if (!user?.business_id) {
    return <p className="text-zinc-400">Loading organizer account...</p>;
  }

  const ticketSummary = scanned?.items?.length
    ? scanned.items.map((i) => `${i.ticket_type || "Ticket"} × ${i.qty}`).join(", ")
    : scanned?.ticket_qty
      ? `${scanned.ticket_qty} ticket(s)`
      : "—";

  const venue = [scanned?.venue_name, scanned?.venue_address].filter(Boolean).join(", ");
  const isJustCheckedIn = Boolean(scanned?.just_checked_in);
  const isAlreadyUsed = isEventBookingCheckedIn(scanned || {});
  const isBlocked =
    isAlreadyUsed || scanned?.status === "CANCELLED" || scanned?.status === "REFUNDED";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">Scan event tickets</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Scan the guest&apos;s QR code at the gate. Each ticket can be checked in only once — scanning
          again will show that entry was already used. Tip: paste your{" "}
          <span className="text-zinc-300">BMB-…</span> booking code or scan the QR.
        </p>
        {lookingUp && (
          <p className="text-sm text-violet-300 mt-2 inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Looking up booking…
          </p>
        )}
        {lastDecoded && !lookingUp && !scanned && (
          <p className="text-xs text-zinc-500 mt-2 break-all">
            Last read: {lastDecoded}
          </p>
        )}
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 p-5 space-y-4">
        <div className="relative overflow-hidden rounded-xl bg-black min-h-[280px]">
          <div
            id={SCANNER_REGION_ID}
            className="w-full overflow-hidden rounded-xl [&>video]:w-full [&>video]:rounded-xl [&>img]:hidden"
          />
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
            handleManualLookup();
          }}
        >
          <input
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            placeholder="Paste BMB-… booking code, EVB-… QR code, or booking ID"
            className="flex-1 bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500"
          />
          <button
            type="submit"
            disabled={isScanning || lookingUp}
            className="btn-primary rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
          >
            {isScanning || lookingUp ? "Looking up..." : "Lookup"}
          </button>
        </form>
      </div>

      {scanned && (
        <div className="glass-panel rounded-2xl border border-white/5 p-6 space-y-5">
          {isJustCheckedIn ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex gap-3">
              <CheckCircle2 size={20} className="text-emerald-300 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-200">Checked in successfully</p>
                <p className="text-sm text-emerald-100/90 mt-1 leading-relaxed">
                  {scanned.check_in_message ||
                    "Guest entry is confirmed. This ticket cannot be checked in again."}
                </p>
                {scanned.checked_in_at && (
                  <p className="text-xs text-emerald-200/80 mt-2">
                    Checked in: {formatDate(scanned.checked_in_at)}{" "}
                    {formatTime12h(scanned.checked_in_at)}
                  </p>
                )}
              </div>
            </div>
          ) : isAlreadyUsed ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3">
              <AlertTriangle size={20} className="text-amber-300 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-200">Already checked in</p>
                <p className="text-sm text-amber-100/90 mt-1 leading-relaxed">
                  {scanned.check_in_message ||
                    "This ticket was already used for entry and cannot be checked in again."}
                </p>
                {scanned.checked_in_at && (
                  <p className="text-xs text-amber-200/80 mt-2">
                    Checked in: {formatDate(scanned.checked_in_at)}{" "}
                    {formatTime12h(scanned.checked_in_at)}
                  </p>
                )}
              </div>
            </div>
          ) : scanned.can_check_in ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex gap-3">
              <CheckCircle2 size={20} className="text-emerald-300 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-200">Ready for entry</p>
                <p className="text-sm text-emerald-100/90 mt-1 leading-relaxed">
                  {scanned.check_in_message || "Confirm check-in to allow this guest into the event."}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 flex gap-3">
              <AlertTriangle size={20} className="text-rose-300 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-rose-200">Check-in not allowed</p>
                <p className="text-sm text-rose-100/90 mt-1 leading-relaxed">
                  {scanned.check_in_message || "This booking cannot be checked in."}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Guest</p>
              <h3 className="text-xl font-bold text-white">{scanned.guest_name || "Guest"}</h3>
              <p className="text-sm text-zinc-400">{scanned.guest_phone ? `+251 ${scanned.guest_phone}` : "—"}</p>
              <p className="text-sm text-zinc-500 truncate">{scanned.guest_email || "—"}</p>
            </div>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${
                scanned.status === "USED"
                  ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                  : scanned.status === "CANCELLED" || scanned.status === "REFUNDED"
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              }`}
            >
              {scanned.status === "USED" ? "CHECKED IN" : scanned.status}
            </span>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Event</p>
            <p className="text-lg font-bold text-white mt-1">{scanned.event_name || "Event"}</p>
            {venue && (
              <p className="text-sm text-zinc-400 mt-1 flex items-start gap-1.5">
                <MapPin size={14} className="mt-0.5 shrink-0" />
                <span>{venue}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/5 border border-white/5 p-3">
              <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                <Clock size={12} /> Showtime
              </p>
              <p className="text-sm font-semibold text-white mt-1">
                {scanned.starts_at ? formatDate(scanned.starts_at) : "—"}
              </p>
              <p className="text-xs text-zinc-400">
                {scanned.starts_at ? formatTime12h(scanned.starts_at) : ""}
              </p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/5 p-3">
              <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                <Ticket size={12} /> Tickets
              </p>
              <p className="text-sm font-semibold text-white mt-1">{ticketSummary}</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/5 p-3">
              <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                <Users size={12} /> Ticket mode
              </p>
              <p className="text-sm font-semibold text-white mt-1">
                {ticketModeLabel(scanned.ticket_mode)}
              </p>
            </div>
          </div>

          <p className="text-xs text-zinc-500">
            Booking ref: <span className="font-mono text-violet-300">{shortBookingCode(scanned.id)}</span>
            {scanned.qr_code ? (
              <>
                {" "}
                · QR: <span className="font-mono text-zinc-400">{scanned.qr_code}</span>
              </>
            ) : null}
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            {scanned.can_check_in && !isBlocked && !isJustCheckedIn && !isAlreadyUsed && (
              <button
                type="button"
                onClick={() => void handleCheckIn()}
                disabled={isCheckingIn}
                className="flex-1 btn-primary rounded-xl py-3 text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {isCheckingIn && <Loader2 size={16} className="animate-spin" />}
                Check in guest
              </button>
            )}
            <button
              type="button"
              onClick={resetForNextScan}
              className="flex-1 rounded-xl py-3 text-sm font-semibold border border-white/10 text-white hover:bg-white/5"
            >
              Scan next ticket
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
