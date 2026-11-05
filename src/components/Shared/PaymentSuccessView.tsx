"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowRight, Compass, ShoppingBag, Sparkles, Wallet, X } from "lucide-react";
import { paymentSuccessCopy, type BookingPaymentModule } from "@/lib/paymentSuccess";
import { lockBodyScroll } from "@/lib/lockBodyScroll";
import ShinyBlackButton from "@/components/Shared/ShinyBlackButton";

type Props = {
  module?: BookingPaymentModule | string | null;
  bookingId?: string | null;
  nextHref: string;
  title?: string;
  subtitle?: ReactNode;
  nextLabel?: string;
  exploreHref?: string;
  exploreLabel?: string;
  /** Extra content under the subtitle (e.g. gift card code). */
  children?: ReactNode;
  /** Override or hide the small footer note. Pass `null` to hide. */
  footerNote?: ReactNode | null;
  /** page = full route. modal = overlay on the review screen. */
  presentation?: "page" | "modal";
  /** Modal only: dismiss without navigating. */
  onClose?: () => void;
  /** Optional explore action (e.g. reset form) instead of router.push. */
  onExplore?: () => void;
};

/**
 * Full-page payment / booking success — Google Pay–style tick, then confirmation CTA.
 * Modal presentation: bottom sheet on mobile (same pattern as dining Filter), centered card on sm+.
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
  children,
  footerNote,
  presentation = "page",
  onClose,
  onExplore,
}: Props) {
  const router = useRouter();
  const copy = paymentSuccessCopy(module);
  const targetExploreHref = exploreHref || copy.exploreHref || "/movies";
  const targetExploreLabel = exploreLabel || copy.exploreLabel || "Explore";
  const playKey = `${module || "booking"}-${bookingId || nextHref}`;
  const [entered, setEntered] = useState(false);
  const [phase, setPhase] = useState<"idle" | "play" | "done">("idle");
  const isModal = presentation === "modal";
  const heading = title || copy.title;
  const isGiftCard = module === "gift_cards";
  const resolvedFooter =
    footerNote === null
      ? null
      : footerNote !== undefined
        ? footerNote
        : isGiftCard
          ? "Keep this code safe — you’ll need it to redeem your gift card."
          : "A confirmation has been prepared for you on the next screen.";

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

  useEffect(() => {
    if (!isModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", onKey);
    const unlock = lockBodyScroll();
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
    };
  }, [isModal, onClose]);

  const shortId =
    bookingId && !isGiftCard
      ? `#${bookingId.replace(/-/g, "").slice(0, 8).toUpperCase()}`
      : null;

  const isPlaying = phase === "play";
  const isDone = phase === "done";
  const showMark = isPlaying || isDone;

  const handleClose = () => {
    onClose?.();
  };

  const animStyles = (
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
  );

  const successMark = (
    <div
      className="relative mb-3 sm:mb-3.5 flex h-[5.75rem] w-[5.75rem] sm:h-[6.25rem] sm:w-[6.25rem] items-center justify-center"
      role="img"
      aria-label={isGiftCard ? "Payment successful" : "Booking successful"}
    >
      {showMark && (
        <>
          <span
            className={`pointer-events-none absolute h-[5.5rem] w-[5.5rem] rounded-full border-2 border-[#34A853]/35 ${
              isPlaying ? "gpay-ripple" : "opacity-0"
            }`}
          />
          <span
            className={`pointer-events-none absolute h-[5.5rem] w-[5.5rem] rounded-full border border-black/10 ${
              isPlaying ? "gpay-ripple-late" : "opacity-0"
            }`}
          />
        </>
      )}

      <div className={`relative z-[1] h-[5.5rem] w-[5.5rem] sm:h-24 sm:w-24 ${isDone ? "gpay-pulse rounded-full" : ""}`}>
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
          className="absolute inset-0 block h-full w-full overflow-visible"
          aria-hidden
        >
          <circle cx="48" cy="48" r="46" stroke="#E8F5E9" strokeWidth="3.5" fill="none" />
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
                isDone ? { strokeDasharray: 289, strokeDashoffset: 0 } : undefined
              }
              transform="rotate(-90 48 48)"
            />
          )}
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
  );

  const successBody = (opts?: { hideTitle?: boolean; compact?: boolean }) => (
    <>
      <p
        className={`inline-flex items-center justify-center gap-1.5 rounded-full bg-[#F4F4F5] px-3 py-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 ${
          opts?.compact ? "mb-3" : "mb-4 sm:mb-5"
        }`}
      >
        <Sparkles size={12} strokeWidth={2.5} className="shrink-0 text-[#6900AA]" />
        <span>{copy.eyebrow}</span>
      </p>

      {successMark}

      {!opts?.hideTitle ? (
        <h1 className="text-[1.5rem] sm:text-[1.75rem] font-bold text-[#111] tracking-tight leading-tight">
          {heading}
        </h1>
      ) : null}

      <p
        className={`${
          opts?.hideTitle ? "mt-0" : "mt-2.5"
        } text-[0.875rem] sm:text-[0.9375rem] text-slate-500 leading-relaxed max-w-[19.5rem] mx-auto`}
      >
        {subtitle || copy.subtitle}
      </p>

      {shortId ? (
        <div
          className={`${
            opts?.compact ? "mt-3" : "mt-4 sm:mt-5"
          } inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Ref
          </span>
          <span className="text-[0.8125rem] font-bold text-slate-800 tabular-nums">
            {shortId}
          </span>
        </div>
      ) : null}

      {children ? (
        <div className={`${opts?.compact ? "mt-3.5" : "mt-4 sm:mt-5"} w-full`}>
          {children}
        </div>
      ) : null}

      <div className={`${opts?.compact ? "mt-5" : "mt-6 sm:mt-7"} w-full space-y-2.5`}>
        <ShinyBlackButton
          type="button"
          onClick={() => router.push(nextHref)}
          className="w-full h-12 rounded-xl bg-[#111111] text-white text-[0.9375rem] font-bold"
        >
          <span className="inline-flex items-center justify-center gap-2">
            {isGiftCard ? <Wallet size={17} strokeWidth={2.25} /> : null}
            {nextLabel || copy.nextLabel}
            {isGiftCard ? null : <ArrowRight size={18} strokeWidth={2.5} />}
          </span>
        </ShinyBlackButton>

        <button
          type="button"
          onClick={() => {
            if (onExplore) {
              onExplore();
              return;
            }
            router.push(targetExploreHref);
          }}
          className={`w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl border bg-white text-[0.875rem] font-semibold transition-all cursor-pointer active:scale-[0.99] ${
            isGiftCard
              ? "border-[#6900AA]/45 text-[#6900AA] hover:bg-[#FAF5FF] hover:border-[#6900AA]"
              : "border-slate-200 text-slate-800 hover:bg-slate-50 hover:border-slate-300"
          }`}
        >
          {isGiftCard ? (
            <ShoppingBag size={16} className="text-[#6900AA]" />
          ) : (
            <Compass size={16} className="text-slate-700" />
          )}
          {targetExploreLabel}
        </button>
      </div>

      {resolvedFooter ? (
        <p
          className={`${
            opts?.compact ? "mt-3" : "mt-4"
          } text-[0.75rem] text-slate-400 leading-snug max-w-[18rem]`}
        >
          {resolvedFooter}
        </p>
      ) : null}
    </>
  );

  if (isModal) {
    const modal = (
      <div
        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-label={heading}
      >
        {animStyles}
        <button
          type="button"
          aria-label="Close"
          className="absolute inset-0 bg-black/45 backdrop-blur-[1px] cursor-pointer"
          onClick={handleClose}
        />
        <div
          className={`relative z-10 w-full sm:w-[min(92vw,26rem)] max-h-[min(92dvh,640px)] bg-white rounded-t-[1.25rem] sm:rounded-2xl shadow-[0_24px_60px_rgba(15,23,42,0.28)] flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)] transition-all duration-500 ease-out ${
            entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative flex items-center justify-center px-12 pt-6 pb-3 sm:pt-7 sm:pb-3.5 border-b border-slate-100 shrink-0 bg-white">
            <h2 className="text-[1.25rem] sm:text-[1.375rem] font-bold text-[#111] text-center truncate max-w-full tracking-tight">
              {heading}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <div
            data-scroll-lock-container
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-3.5 sm:px-6 sm:pt-2.5 sm:pb-4 flex flex-col items-center text-center bg-[#FAFAFA]"
          >
            <div className="w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 sm:px-5 sm:py-4 shadow-sm flex flex-col items-center text-center">
              {successBody({ hideTitle: true, compact: true })}
            </div>
          </div>
        </div>
      </div>
    );

    if (typeof document !== "undefined") {
      return createPortal(modal, document.body);
    }
    return null;
  }

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center px-4 py-10 sm:py-14 relative overflow-hidden bg-[#F5F5F5]">
      {animStyles}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 28%, rgba(0,0,0,0.05), transparent 68%), radial-gradient(ellipse 40% 30% at 80% 90%, rgba(52,168,83,0.08), transparent 55%)",
        }}
      />
      <div
        className={`relative z-[1] w-full max-w-[26rem] transition-all duration-500 ease-out ${
          entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <div className="rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.12)] px-6 py-9 sm:px-8 sm:py-11 flex flex-col items-center text-center">
          {successBody()}
        </div>
      </div>
    </div>
  );
}
