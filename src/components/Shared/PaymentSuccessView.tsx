"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowRight, Compass, Sparkles } from "lucide-react";
import { paymentSuccessCopy, type BookingPaymentModule } from "@/lib/paymentSuccess";

type Props = {
  module?: BookingPaymentModule | string | null;
  bookingId?: string | null;
  nextHref: string;
  title?: string;
  subtitle?: string;
  nextLabel?: string;
  exploreHref?: string;
  exploreLabel?: string;
  /** page = full route. modal = overlay on the review screen. */
  presentation?: "page" | "modal";
};

/**
 * Full-page payment / booking success — Google Pay–style tick, then confirmation CTA.
 */
export default function PaymentSuccessView({
  module,
  bookingId,
  nextHref,
  title,
  subtitle,
  nextLabel,
  exploreHref,
  exploreLabel,
  presentation = "page",
}: Props) {
  const router = useRouter();
  const copy = paymentSuccessCopy(module);
  const targetExploreHref = exploreHref || copy.exploreHref || "/movies";
  const targetExploreLabel = exploreLabel || copy.exploreLabel || "Explore";
  const playKey = `${module || "booking"}-${bookingId || nextHref}`;
  const [entered, setEntered] = useState(false);
  const [phase, setPhase] = useState<"idle" | "play" | "done">("idle");

  useEffect(() => {
    setPhase("idle");
    setEntered(false);
    const enter = window.setTimeout(() => setEntered(true), 40);
    const play = window.setTimeout(() => setPhase("play"), 100);
    const done = window.setTimeout(() => setPhase("done"), 1750);
    return () => {
      window.clearTimeout(enter);
      window.clearTimeout(play);
      window.clearTimeout(done);
    };
  }, [playKey]);

  const shortId = bookingId
    ? `#${bookingId.replace(/-/g, "").slice(0, 8).toUpperCase()}`
    : null;

  const isPlaying = phase === "play";
  const isDone = phase === "done";
  const showMark = isPlaying || isDone;

  const shellClass =
    presentation === "modal"
      ? "fixed inset-0 z-[200] flex items-center justify-center px-4 py-8 bg-black/45"
      : "min-h-[100dvh] w-full flex items-center justify-center px-4 py-10 sm:py-14 relative overflow-hidden bg-[#F7F5FB]";

  const view = (
    <div className={shellClass} role={presentation === "modal" ? "dialog" : undefined} aria-modal={presentation === "modal" ? true : undefined}>
      <style>{`
        @keyframes gpayRingDraw {
          from { stroke-dashoffset: 289; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes gpayFillPop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes gpayCheckDraw {
          from { stroke-dashoffset: 72; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes gpayRipple {
          0% { transform: scale(0.82); opacity: 0.5; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        @keyframes gpayPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(52, 168, 83, 0.32), 0 12px 32px rgba(31, 157, 85, 0.28); }
          50% { box-shadow: 0 0 0 12px rgba(52, 168, 83, 0), 0 14px 36px rgba(31, 157, 85, 0.38); }
        }
        .gpay-ring-draw {
          stroke-dasharray: 289;
          stroke-dashoffset: 289;
          animation: gpayRingDraw 0.55s cubic-bezier(0.65, 0, 0.35, 1) forwards;
        }
        .gpay-fill-pop {
          animation: gpayFillPop 0.48s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both;
        }
        .gpay-check-draw {
          stroke-dasharray: 72;
          stroke-dashoffset: 72;
          animation: gpayCheckDraw 0.42s cubic-bezier(0.65, 0, 0.35, 1) 0.58s forwards;
        }
        .gpay-check-done {
          stroke-dasharray: 72;
          stroke-dashoffset: 0;
        }
        .gpay-ripple {
          animation: gpayRipple 0.9s ease-out 0.52s both;
        }
        .gpay-ripple-late {
          animation: gpayRipple 1s ease-out 0.7s both;
        }
        .gpay-pulse {
          animation: gpayPulse 2s ease-in-out infinite;
        }
      `}</style>

      {presentation === "page" ? (
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 28%, rgba(105,0,170,0.13), transparent 68%), radial-gradient(ellipse 40% 30% at 80% 90%, rgba(52,168,83,0.08), transparent 55%)",
        }}
      />
      ) : null}

      <div
        className={`relative z-[1] w-full max-w-[26rem] transition-all duration-500 ease-out ${
          entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <div className="rounded-[1.75rem] border border-[#EDE4F7] bg-white shadow-[0_22px_55px_rgba(80,40,120,0.14)] px-6 py-10 sm:px-9 sm:py-12 flex flex-col items-center text-center">
          <p className="inline-flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6900AA] mb-8">
            <Sparkles size={12} strokeWidth={2.5} className="shrink-0" />
            <span>{copy.eyebrow}</span>
          </p>

          {/* Google Pay–style success mark */}
          <div
            className="relative mb-8 flex h-[7.5rem] w-[7.5rem] items-center justify-center"
            role="img"
            aria-label="Booking successful"
          >
            {showMark && (
              <>
                <span
                  className={`pointer-events-none absolute h-24 w-24 rounded-full border-2 border-[#34A853]/35 ${
                    isPlaying ? "gpay-ripple" : "opacity-0"
                  }`}
                />
                <span
                  className={`pointer-events-none absolute h-24 w-24 rounded-full border border-[#6900AA]/20 ${
                    isPlaying ? "gpay-ripple-late" : "opacity-0"
                  }`}
                />
              </>
            )}

            <div
              className={`relative z-[1] h-24 w-24 ${isDone ? "gpay-pulse rounded-full" : ""}`}
            >
              {/* Green fill disk */}
              {showMark && (
                <div
                  className={`absolute inset-[6px] rounded-full bg-[#34A853] ${
                    isPlaying ? "gpay-fill-pop" : ""
                  }`}
                  style={
                    isDone
                      ? { transform: "scale(1)", opacity: 1 }
                      : { boxShadow: "0 12px 28px rgba(31, 157, 85, 0.32)" }
                  }
                />
              )}

              <svg
                width="96"
                height="96"
                viewBox="0 0 96 96"
                fill="none"
                className="absolute inset-0 block overflow-visible"
                aria-hidden
              >
                {/* Light track */}
                <circle
                  cx="48"
                  cy="48"
                  r="46"
                  stroke="#E8F5E9"
                  strokeWidth="3.5"
                  fill="none"
                />

                {/* Ring draws clockwise from top */}
                {showMark && (
                  <circle
                    cx="48"
                    cy="48"
                    r="46"
                    stroke="#34A853"
                    strokeWidth="3.5"
                    fill="none"
                    strokeLinecap="round"
                    className={isPlaying ? "gpay-ring-draw" : ""}
                    style={
                      isDone
                        ? { strokeDasharray: 289, strokeDashoffset: 0 }
                        : undefined
                    }
                    transform="rotate(-90 48 48)"
                  />
                )}

                {/* White checkmark */}
                {showMark && (
                  <path
                    d="M28 50 L42 64 L70 34"
                    stroke="#ffffff"
                    strokeWidth="6.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    className={isPlaying ? "gpay-check-draw" : "gpay-check-done"}
                  />
                )}
              </svg>
            </div>
          </div>

          <h1 className="text-2xl sm:text-[1.8rem] font-extrabold text-[#1a1228] tracking-tight leading-tight">
            {title || copy.title}
          </h1>
          <p className="mt-3 text-sm sm:text-[15px] text-[#6B7280] leading-relaxed max-w-[20rem] mx-auto">
            {subtitle || copy.subtitle}
          </p>

          {shortId ? (
            <div className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[#F7E9FF] px-4 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6900AA]/80">
                Ref
              </span>
              <span className="text-sm font-bold text-[#2b1848] tabular-nums">{shortId}</span>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => router.push(nextHref)}
            className="mt-8 w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-gradient-to-r from-[#6900AA] to-[#57008E] text-white text-[15px] font-bold shadow-[0_10px_28px_rgba(105,0,170,0.38)] hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer"
          >
            {nextLabel || copy.nextLabel}
            <ArrowRight size={18} strokeWidth={2.5} />
          </button>

          <button
            type="button"
            onClick={() => router.push(targetExploreHref)}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-400 text-[14px] font-semibold transition-all cursor-pointer shadow-sm active:scale-[0.99]"
          >
            <Compass size={16} className="text-[#6900AA]" />
            {targetExploreLabel}
          </button>

          <p className="mt-4 text-xs text-[#9CA3AF] leading-snug max-w-[18rem]">
            A confirmation has been prepared for you on the next screen.
          </p>
        </div>
      </div>
    </div>
  );

  if (presentation === "modal" && typeof document !== "undefined") {
    return createPortal(view, document.body);
  }
  return view;
}
