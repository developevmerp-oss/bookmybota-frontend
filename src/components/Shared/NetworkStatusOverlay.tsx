"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { WifiOff } from "lucide-react";

/**
 * Full-app offline shield: blurs the UI and asks the user to check their network.
 * Mount once in the root layout so every panel (admin, organizer, customer, etc.) is covered.
 */
export default function NetworkStatusOverlay() {
  const [offline, setOffline] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const sync = () => {
      setOffline(typeof navigator !== "undefined" ? !navigator.onLine : false);
    };

    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);

    // Catch cases where the connection drops without a reliable event (tab resume, etc.)
    const interval = window.setInterval(sync, 4000);

    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!offline) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [offline]);

  if (!mounted || !offline) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-6"
      role="alertdialog"
      aria-modal="true"
      aria-live="assertive"
      aria-labelledby="network-offline-title"
      aria-describedby="network-offline-desc"
    >
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-md" aria-hidden />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/15 bg-white px-6 py-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <WifiOff size={28} strokeWidth={2} aria-hidden />
        </div>
        <h2 id="network-offline-title" className="text-xl font-extrabold tracking-tight text-slate-900">
          Check your network
        </h2>
        <p id="network-offline-desc" className="mt-2 text-sm leading-relaxed text-slate-600">
          You are offline. Connect to Wi‑Fi or mobile data to keep using Book My Bota.
        </p>
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">
          Waiting for connection…
        </p>
      </div>
    </div>,
    document.body
  );
}
