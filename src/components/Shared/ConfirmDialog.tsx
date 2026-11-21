"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

type ConfirmVariant = "danger" | "success" | "warning";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  variant?: ConfirmVariant;
  busy?: boolean;
  /** Light theme for customer / partner panels; dark for admin. */
  theme?: "dark" | "light";
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  danger = false,
  variant,
  busy = false,
  theme = "dark",
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open || !mounted) return null;

  const tone: ConfirmVariant = danger ? "danger" : variant ?? "warning";
  const light = theme === "light";

  const confirmClass = light
    ? tone === "danger"
      ? "bg-[#6900AA] hover:bg-[#550088] focus-visible:ring-[#6900AA]/35"
      : tone === "success"
        ? "bg-emerald-600 hover:bg-emerald-500 focus-visible:ring-emerald-500/30"
        : "bg-[#6900AA] hover:bg-[#550088] focus-visible:ring-[#6900AA]/35"
    : tone === "danger"
      ? "bg-[#e11d48] hover:bg-[#be123c]"
      : tone === "success"
        ? "bg-emerald-600 hover:bg-emerald-500"
        : "bg-amber-600 hover:bg-amber-500";

  return createPortal(
    <div
      className={`fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 ${
        light ? "bg-black/45 backdrop-blur-[2px]" : "bg-black/80 backdrop-blur-sm"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-busy={busy}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close dialog"
        disabled={busy}
        onClick={() => {
          if (!busy) onCancel();
        }}
      />
      <div
        className={`relative z-10 w-full sm:max-w-[400px] rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-[0_16px_48px_rgba(15,23,42,0.18)] ${
          light
            ? "border border-slate-200/90 bg-white text-[#0F172A]"
            : "glass-panel border border-white/10"
        }`}
      >
        <div
          className={`mx-auto mb-4 h-1 w-10 rounded-full sm:hidden ${
            light ? "bg-slate-200" : "bg-white/20"
          }`}
          aria-hidden
        />
        <h3
          id="confirm-dialog-title"
          className={`text-lg sm:text-xl font-bold tracking-tight mb-2 ${
            light ? "text-[#0F172A]" : "text-gray-800"
          }`}
        >
          {title}
        </h3>
        <p
          className={`text-sm sm:text-[15px] mb-6 leading-relaxed ${
            light ? "text-slate-500" : "text-zinc-600"
          }`}
        >
          {body}
        </p>
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (!busy) onConfirm();
            }}
            disabled={busy}
            className={`inline-flex w-full items-center justify-center gap-2 min-h-11 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-55 disabled:cursor-not-allowed disabled:pointer-events-none ${confirmClass}`}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
                <span>Please wait…</span>
              </>
            ) : (
              confirmLabel
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!busy) onCancel();
            }}
            disabled={busy}
            className={`inline-flex w-full items-center justify-center min-h-11 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${
              light
                ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                : "text-zinc-600 hover:text-white hover:bg-white/10"
            }`}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
