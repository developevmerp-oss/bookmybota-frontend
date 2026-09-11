"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { Html5Qrcode } from "html5-qrcode";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Film,
  ImageUp,
  Loader2,
  MapPin,
  QrCode,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCheckInCinemaMovieBookingMutation,
  useScanCinemaMovieBookingMutation,
  type MovieBookingDetail,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { formatDate, formatTime12h } from "@/lib/dateFormat";
import { extractApiError } from "@/lib/apiErrors";
import {
  organizerScanTokenSchema,
  type OrganizerScanTokenValues,
} from "@/lib/organizerPartnerFormSchemas";

const SCANNER_REGION_ID = "cinema-movie-qr-reader";
const fieldErrorClass = "mt-1.5 text-[11px] font-semibold text-rose-500";
const reqStar = <span className="text-rose-500">*</span>;

type ScannedMovie = MovieBookingDetail & {
  can_check_in?: boolean;
  already_checked_in?: boolean;
  check_in_message?: string;
  just_checked_in?: boolean;
  checked_in_at?: string;
  showtime_starts_at?: string;
  movie_title?: string;
  cinema_name?: string;
  cinema_address?: string;
  screen_name?: string;
};

function isMovieCheckedIn(b: Partial<ScannedMovie>) {
  return (
    String(b.status || "").toUpperCase() === "USED" ||
    Boolean(b.already_checked_in) ||
    Boolean(b.checked_in_at)
  );
}

export default function MovieScanPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastTokenRef = useRef("");
  const lastScanAtRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    getValues,
    setValue,
    reset: resetManualForm,
    formState: { errors: manualErrors },
    setError,
    clearErrors,
  } = useForm<OrganizerScanTokenValues>({
    resolver: yupResolver(organizerScanTokenSchema),
    defaultValues: { manualToken: "" },
    mode: "onSubmit",
  });

  const [cameraOn, setCameraOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanned, setScanned] = useState<ScannedMovie | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [lastDecoded, setLastDecoded] = useState("");

  const [scanQr, { isLoading: isScanning }] = useScanCinemaMovieBookingMutation();
  const [checkIn, { isLoading: isCheckingIn }] = useCheckInCinemaMovieBookingMutation();

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) {
      setCameraOn(false);
      return;
    }
    try {
      if (scanner.isScanning) await scanner.stop();
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

  const applyScanResult = useCallback((booking: ScannedMovie) => {
    setScanned(booking);

    if (booking.just_checked_in) {
      toast.success(booking.check_in_message || "Guest checked in successfully.");
      return;
    }

    if (isMovieCheckedIn(booking)) {
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
        applyScanResult(result.data as ScannedMovie);
        await stopCamera();
      } catch (err) {
        lastTokenRef.current = "";
        toast.error(
          extractApiError(
            err,
            `No booking found for "${token}". Use the cinema account for this ticket.`
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
    resetManualForm({ manualToken: "" });
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

      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      permissionStream.getTracks().forEach((track) => track.stop());

      await stopCamera();
      const scanner = new Html5Qrcode(SCANNER_REGION_ID, { verbose: false });
      scannerRef.current = scanner;

      const cameras = await Html5Qrcode.getCameras();
      if (!cameras.length) {
        throw new Error("No camera was found on this device.");
      }

      const rearCam =
        cameras.find((cam) => /back|rear|environment/i.test(cam.label)) ||
        cameras[cameras.length - 1];

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
      try {
        scanner.clear();
      } catch {
        /* ignore */
      }
      scannerRef.current = null;
      await resolveBooking(String(decoded || "").trim(), true);
    } catch (err) {
      toast.error(extractApiError(err, "Could not read a QR code from that image."));
    } finally {
      setLookingUp(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onManualLookup = async () => {
    clearErrors("manualToken");
    const raw = String(getValues("manualToken") || "").trim();
    if (!raw) {
      setError("manualToken", { type: "required", message: "Booking code is required." });
      return;
    }
    const token = raw.toUpperCase();
    setValue("manualToken", token);
    await resolveBooking(token, true);
  };

  const handleCheckIn = async () => {
    if (!scanned?.id) return;
    if (isMovieCheckedIn(scanned)) {
      toast.warning(
        scanned.check_in_message || "This ticket was already checked in and cannot be used again."
      );
      return;
    }
    try {
      const result = await checkIn(scanned.id).unwrap();
      setScanned(result.data as ScannedMovie);
      if (result.data?.just_checked_in) {
        toast.success(
          result.data.check_in_message || result.message || "Guest checked in successfully."
        );
      } else if (result.data?.already_checked_in) {
        toast.warning(
          result.data.check_in_message || result.message || "This ticket was already checked in."
        );
      } else {
        toast.success(result.message || "Guest checked in successfully.");
      }
    } catch (err) {
      toast.error(extractApiError(err, "Check-in failed."));
    }
  };

  if (!user?.business_id) {
    return <p className="portal-muted">Loading cinema account…</p>;
  }

  const seatsLabel =
    scanned?.seats?.map((s) => s.seat_identifier).filter(Boolean).join(", ") ||
    (scanned?.ticket_qty ? `${scanned.ticket_qty} seat(s)` : "—");
  const isJustCheckedIn = Boolean(scanned?.just_checked_in);
  const isAlreadyUsed = isMovieCheckedIn(scanned || {});
  const isBlocked =
    isAlreadyUsed || scanned?.status === "CANCELLED" || scanned?.status === "REFUNDED";
  const showAt = scanned?.showtime_starts_at;
  const venue = [scanned?.cinema_name, scanned?.screen_name, scanned?.cinema_address]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        {lookingUp && (
          <p className="text-sm text-primary inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Looking up booking…
          </p>
        )}
        {lastDecoded && !lookingUp && !scanned && (
          <p className="text-xs portal-muted break-all">Last read: {lastDecoded}</p>
        )}
      </div>

      <div className="org-card p-5 space-y-4">
        <div className="relative overflow-hidden rounded-xl bg-zinc-950 h-[300px] sm:h-[360px]">
          <div
            id={SCANNER_REGION_ID}
            className="absolute inset-0 w-full h-full overflow-hidden
              [&_video]:absolute [&_video]:inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover
              [&_img]:hidden
              [&_button]:hidden
              [&_input]:hidden
              [&_select]:hidden
              [&_#qr-shaded-region]:pointer-events-none"
          />
          {!cameraOn && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-zinc-400 gap-2 pointer-events-none">
              <QrCode size={40} />
              <p className="text-sm">{starting ? "Starting camera..." : "Camera is off"}</p>
            </div>
          )}
          {cameraOn && (
            <div className="absolute top-3 left-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 border border-emerald-400/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Camera live
            </div>
          )}
        </div>

        {cameraError && <p className="text-xs text-amber-600">{cameraError}</p>}

        <div className="relative z-10 flex flex-wrap items-center gap-2">
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
              className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              Stop camera
            </button>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={starting}
            className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            <ImageUp size={16} /> Upload QR image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => void handleScanFile(e.target.files?.[0])}
          />
        </div>

        <div className="relative z-10 space-y-2 border-t border-slate-200 pt-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Manual booking code {reqStar}
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              placeholder="Paste BMB-… booking code or BMB-MOV-… QR token"
              className="input-field flex-1 rounded-xl px-4 py-3 text-sm focus:outline-none"
              autoComplete="off"
              {...register("manualToken")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void onManualLookup();
                }
              }}
            />
            <button
              type="button"
              onClick={() => void onManualLookup()}
              disabled={isScanning || lookingUp}
              className="btn-primary rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
            >
              {isScanning || lookingUp ? "Looking up..." : "Lookup"}
            </button>
          </div>
          {manualErrors.manualToken && (
            <p className={fieldErrorClass}>{manualErrors.manualToken.message}</p>
          )}
        </div>
      </div>

      {scanned && (
        <div className="org-card p-6 space-y-5">
          {isJustCheckedIn ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex gap-3">
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-700">Checked in successfully</p>
                <p className="text-sm text-emerald-800/90 mt-1 leading-relaxed">
                  {scanned.check_in_message ||
                    "Guest entry is confirmed. This ticket cannot be checked in again."}
                </p>
                {scanned.checked_in_at && (
                  <p className="text-xs text-emerald-700/80 mt-2">
                    Checked in: {formatDate(scanned.checked_in_at)}{" "}
                    {formatTime12h(scanned.checked_in_at)}
                  </p>
                )}
              </div>
            </div>
          ) : isAlreadyUsed ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3">
              <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-700">Already checked in</p>
                <p className="text-sm text-amber-800/90 mt-1 leading-relaxed">
                  {scanned.check_in_message ||
                    "This ticket was already used for entry and cannot be checked in again."}
                </p>
                {scanned.checked_in_at && (
                  <p className="text-xs text-amber-700/80 mt-2">
                    Checked in: {formatDate(scanned.checked_in_at)}{" "}
                    {formatTime12h(scanned.checked_in_at)}
                  </p>
                )}
              </div>
            </div>
          ) : scanned.can_check_in ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex gap-3">
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-700">Ready for entry</p>
                <p className="text-sm text-emerald-800/90 mt-1 leading-relaxed">
                  {scanned.check_in_message ||
                    "Confirm check-in to allow this guest into the cinema."}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 flex gap-3">
              <AlertTriangle size={20} className="text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-rose-700">Check-in not allowed</p>
                <p className="text-sm text-rose-800/90 mt-1 leading-relaxed">
                  {scanned.check_in_message || "This booking cannot be checked in."}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Guest</p>
              <h3 className="text-xl font-bold portal-heading">{scanned.guest_name || "Guest"}</h3>
              <p className="text-sm portal-muted">{scanned.guest_phone || "—"}</p>
              <p className="text-sm text-slate-500 truncate">{scanned.guest_email || "—"}</p>
            </div>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${
                scanned.status === "USED"
                  ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                  : scanned.status === "CANCELLED" || scanned.status === "REFUNDED"
                    ? "bg-rose-500/10 text-rose-700 border-rose-500/20"
                    : "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
              }`}
            >
              {scanned.status === "USED" ? "CHECKED IN" : scanned.status}
            </span>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
              <Film size={12} /> Movie
            </p>
            <p className="text-lg font-bold portal-heading mt-1">{scanned.movie_title || "Movie"}</p>
            {venue ? (
              <p className="text-sm portal-muted mt-1 flex items-start gap-1.5">
                <MapPin size={14} className="mt-0.5 shrink-0" />
                <span>{venue}</span>
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <Clock size={12} /> Showtime
              </p>
              <p className="text-sm font-semibold portal-heading mt-1">
                {showAt ? formatDate(showAt) : "—"}
              </p>
              <p className="text-xs portal-muted">{showAt ? formatTime12h(showAt) : ""}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <Ticket size={12} /> Seats
              </p>
              <p className="text-sm font-semibold portal-heading mt-1">{seatsLabel}</p>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Booking ref:{" "}
            <span className="font-mono text-rose-600">{scanned.booking_code || "—"}</span>
            {scanned.qr_code_token ? (
              <>
                {" "}
                · QR: <span className="font-mono text-slate-500">{scanned.qr_code_token}</span>
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
              className="flex-1 btn-secondary rounded-xl py-3 text-sm font-semibold"
            >
              Scan next ticket
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
