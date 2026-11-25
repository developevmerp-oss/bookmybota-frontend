"use client";

import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";

/**
 * Full-page screen shown when the seats a customer picked were taken by someone else at the same moment
 * (movies, events and sports). It replaces the small popup / toast. Going back (the arrow, the button or the
 * phone's back key) returns to the same seat layout so the customer can choose other seats.
 */
export default function SeatsUnavailablePage({
  title,
  subtitle,
  message,
  onBack,
  buttonLabel = "Choose other seats",
}: {
  /** movie / event name shown in the top bar */
  title?: string;
  /** cinema or venue shown under the name */
  subtitle?: string;
  /** reason from the server; a friendly default is used when empty */
  message?: string;
  /** go back to the seat layout (the page that was open) */
  onBack: () => void;
  buttonLabel?: string;
}) {
  // The phone / browser back key does the same as the back arrow. A history entry is added while this page is open
  // and removed again when it closes, so no extra "back" step is left behind.
  useEffect(() => {
    // (skipped if the marker is already there, e.g. when React runs the effect twice in development)
    if (!window.history.state?.bmbSeatsUnavailable) window.history.pushState({ bmbSeatsUnavailable: true }, "");
    const onPop = () => onBack();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const goBack = () => {
    if (window.history.state?.bmbSeatsUnavailable) window.history.back(); // fires popstate -> onBack
    else onBack();
  };

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-white" role="alert" aria-live="assertive">
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-3 py-3 sm:px-5">
        <button
          type="button"
          onClick={goBack}
          aria-label="Back to the seat layout"
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-800 hover:bg-slate-100"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0">
          {title ? <p className="truncate text-base font-bold leading-tight text-slate-900 sm:text-lg">{title}</p> : null}
          {subtitle ? <p className="truncate text-xs text-slate-500 sm:text-sm">{subtitle}</p> : null}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-5 pb-10 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/seats-unavailable.webp" alt="" className="mb-6 w-full max-w-md select-none object-contain sm:max-w-lg" draggable={false} />
        <h1 className="text-lg font-extrabold text-slate-900 sm:text-xl">Sorry! Request failed</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500 sm:text-base">
          {message || "These seats are no longer available. Please try again with other seats."}
        </p>
        <button
          type="button"
          onClick={goBack}
          className="mt-6 cursor-pointer rounded-xl bg-[#6900AA] px-8 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#55008a] active:scale-95 sm:text-base"
        >
          {buttonLabel}
        </button>
      </main>
    </div>
  );
}
