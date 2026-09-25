"use client";

import type { ReactNode } from "react";
import { LayoutGrid, Maximize2, Minimize2, X } from "lucide-react";

/** Shared full-screen / embedded shell for Layout Studio (custom + stadium). */
export function LayoutStudioShell({
  isFullscreen,
  children,
  className = "",
}: {
  isFullscreen: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col min-h-0 bg-white shadow-sm transition-all ${
        isFullscreen
          ? "fixed inset-0 z-[999] w-screen h-screen rounded-none"
          : "h-full w-full flex-1 border border-slate-200 rounded-2xl overflow-hidden"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** Modal chrome used by Super Admin “Open Layout in Pop-up Studio”. */
export function LayoutStudioModalHost({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-slate-950">
      <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-800 bg-slate-900">
        <div className="min-w-0 flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-400/15 border border-amber-400/30 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-300">
            <Maximize2 size={13} /> Layout Studio
          </span>
          {title ? (
            <p className="text-sm font-semibold text-white truncate">{title}</p>
          ) : null}
          {subtitle ? (
            <p className="text-xs text-slate-400 truncate hidden sm:block">{subtitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
        >
          <X size={14} /> Close Studio
        </button>
      </header>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

export type LayoutStudioFormat = "custom" | "stadium";

export function LayoutFormatSwitcher({
  value,
  onChange,
  confirmBeforeSwitch,
}: {
  value: LayoutStudioFormat;
  onChange: (next: LayoutStudioFormat) => void;
  /** Return false to cancel switch (e.g. user dismissed confirm). */
  confirmBeforeSwitch?: (next: LayoutStudioFormat) => boolean | Promise<boolean>;
}) {
  const select = async (next: LayoutStudioFormat) => {
    if (next === value) return;
    if (confirmBeforeSwitch) {
      const ok = await confirmBeforeSwitch(next);
      if (!ok) return;
    }
    onChange(next);
  };

  return (
    <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-3 sm:px-4 py-2.5 bg-slate-950 border-b border-slate-800 text-white z-40">
      <div className="flex flex-wrap items-center gap-2.5 min-w-0">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
          <LayoutGrid size={12} /> Layout Format
        </span>
        <div
          className="inline-flex rounded-xl bg-slate-900 p-1 border border-slate-800 shadow-inner"
          role="tablist"
          aria-label="Layout format"
        >
          <button
            type="button"
            role="tab"
            aria-selected={value === "custom"}
            onClick={() => void select("custom")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              value === "custom"
                ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            Custom Floor Plan
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={value === "stadium"}
            onClick={() => void select("stadium")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              value === "stadium"
                ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            Sports Stadium
          </button>
        </div>
      </div>

      <div className="text-[11px] sm:text-xs max-w-full">
        {value === "custom" ? (
          <span className="inline-flex flex-wrap items-center gap-1.5 text-slate-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
            <span className="font-semibold text-rose-300">Best for:</span>
            Cinema · Theatre · Club · Conference · Grid seats
          </span>
        ) : (
          <span className="inline-flex flex-wrap items-center gap-1.5 text-amber-200 font-medium bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/25">
            <span className="font-semibold text-amber-300">Best for:</span>
            Multi-stand sports bowls · Tiers · Pitch sections
          </span>
        )}
      </div>
    </div>
  );
}

export function StudioToolButton({
  active,
  onClick,
  title,
  disabled,
  children,
  className = "",
}: {
  active?: boolean;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? "bg-rose-50 text-rose-600 border-rose-200 shadow-sm"
          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function StudioToolbarSection({
  label,
  children,
  className = "",
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0 ${className}`}>
      {label ? (
        <span className="hidden lg:inline text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-0.5 shrink-0">
          {label}
        </span>
      ) : null}
      {children}
    </div>
  );
}

export function StudioDivider() {
  return <div className="hidden sm:block w-px h-7 bg-slate-300 mx-0.5 shrink-0" aria-hidden />;
}

export function StudioZoomControls({
  zoomPercent,
  onZoomOut,
  onZoomIn,
  className = "",
}: {
  zoomPercent: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center gap-0.5 bg-white rounded-lg border border-slate-200 p-0.5 ${className}`}
    >
      <button
        type="button"
        onClick={onZoomOut}
        className="px-2 py-1 hover:bg-slate-100 rounded text-slate-600 font-bold text-sm cursor-pointer"
        aria-label="Zoom out"
      >
        −
      </button>
      <span className="text-xs font-semibold text-slate-600 min-w-[44px] text-center tabular-nums">
        {zoomPercent}%
      </span>
      <button
        type="button"
        onClick={onZoomIn}
        className="px-2 py-1 hover:bg-slate-100 rounded text-slate-600 font-bold text-sm cursor-pointer"
        aria-label="Zoom in"
      >
        +
      </button>
    </div>
  );
}

export function StudioFullscreenToggle({
  isFullscreen,
  onToggle,
}: {
  isFullscreen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer ${
        isFullscreen
          ? "bg-rose-600 text-white border-rose-600 shadow-sm hover:bg-rose-700"
          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
      }`}
      title={isFullscreen ? "Exit Fullscreen (Esc)" : "Full Window"}
    >
      {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      <span className="hidden sm:inline">{isFullscreen ? "Exit" : "Expand"}</span>
    </button>
  );
}
