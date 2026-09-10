"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

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
  /** Light theme for partner panels; dark for admin. */
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

  if (!open || !mounted) return null;

  const tone: ConfirmVariant = danger ? "danger" : variant ?? "warning";
  const confirmClass =
    tone === "danger"
      ? "bg-[#e11d48] hover:bg-[#be123c]"
      : tone === "success"
        ? "bg-emerald-600 hover:bg-emerald-500"
        : theme === "light"
          ? "bg-primary hover:opacity-90"
          : "bg-amber-600 hover:bg-amber-500";

  const light = theme === "light";

  return createPortal(
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center p-4 ${
        light ? "bg-black/40 backdrop-blur-sm" : "bg-black/80 backdrop-blur-sm"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close dialog"
        disabled={busy}
        onClick={() => !busy && onCancel()}
      />
      <div
        className={`relative z-10 w-full max-w-md rounded-2xl p-5 sm:p-6 shadow-2xl ${
          light
            ? "border border-border bg-card text-foreground"
            : "glass-panel border border-white/10"
        }`}
      >
        <h3
          id="confirm-dialog-title"
          className={`text-lg sm:text-xl font-bold mb-2 ${light ? "text-foreground" : "text-gray-800"}`}
        >
          {title}
        </h3>
        <p className={`text-sm mb-6 leading-relaxed ${light ? "text-muted-foreground" : "text-zinc-600"}`}>
          {body}
        </p>
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => !busy && onCancel()}
            disabled={busy}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 ${
              light
                ? "border border-border bg-background text-foreground hover:bg-muted"
                : "text-zinc-600 hover:text-white hover:bg-white/10"
            }`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors ${confirmClass}`}
          >
            {busy ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
