"use client";

type ConfirmVariant = "danger" | "success" | "warning";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  variant?: ConfirmVariant;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger = false,
  variant,
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  if (!open) return null;

  const tone: ConfirmVariant = danger ? "danger" : variant ?? "warning";
  const confirmClass =
    tone === "danger"
      ? "bg-rose-600 hover:bg-rose-500"
      : tone === "success"
        ? "bg-emerald-600 hover:bg-emerald-500"
        : "bg-amber-600 hover:bg-amber-500";

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-60 flex items-center justify-center p-4">
      <div className="glass-panel max-w-md w-full p-6 rounded-2xl border border-white/10 shadow-2xl">
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-zinc-400 text-sm mb-6">{body}</p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => !busy && onCancel()}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 ${confirmClass}`}
          >
            {busy ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
