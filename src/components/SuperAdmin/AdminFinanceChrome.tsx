"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function AdminSegmentedTabs<T extends string>({
  tabs,
  active,
  onChange,
  size = "md",
}: {
  tabs: { key: T; label: string; icon?: LucideIcon; count?: number | string }[];
  active: T;
  onChange: (key: T) => void;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  return (
    <div className="inline-flex flex-wrap gap-1 p-1 rounded-2xl bg-white/[0.03] border border-white/10 w-fit max-w-full">
      {tabs.map((t) => {
        const TabIcon = t.icon;
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`inline-flex items-center gap-1.5 ${pad} rounded-xl font-semibold transition-colors ${
              isActive
                ? "bg-rose-600 text-white shadow-sm shadow-rose-900/30"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {TabIcon ? <TabIcon size={size === "sm" ? 13 : 15} /> : null}
            {t.label}
            {t.count != null && t.count !== "" ? (
              <span
                className={`tabular-nums ${
                  isActive ? "text-rose-100/90" : "text-zinc-500"
                }`}
              >
                ({t.count})
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function AdminStatCard({
  label,
  value,
  hint,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="glass-panel rounded-2xl border border-white/5 p-4 h-full">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold leading-tight">
          {label}
        </p>
        {Icon ? (
          <span className="shrink-0 rounded-lg bg-white/5 p-1.5 text-zinc-400">
            <Icon size={14} />
          </span>
        ) : null}
      </div>
      <p className={`text-xl sm:text-2xl font-bold mt-2 tabular-nums ${accent || "text-white"}`}>
        {value}
      </p>
      {hint ? <p className="text-[11px] text-zinc-500 mt-1.5 leading-snug">{hint}</p> : null}
    </div>
  );
}

export function AdminStatusBadge({ status }: { status?: string }) {
  const s = (status || "DRAFT").toUpperCase();
  const colors: Record<string, string> = {
    DRAFT: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
    APPROVED: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    PAID: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    CANCELLED: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    PENDING: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    CONFIRMED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    USED: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${
        colors[s] || colors.DRAFT
      }`}
    >
      {s}
    </span>
  );
}

export function AdminCallout({
  tone = "neutral",
  children,
  action,
}: {
  tone?: "neutral" | "amber" | "sky" | "rose";
  children: ReactNode;
  action?: ReactNode;
}) {
  // Use portal-banner-* so admin light theme keeps readable contrast (not pale *-100 on white).
  const tones = {
    neutral: "portal-banner-neutral border border-slate-200 bg-slate-50 text-slate-700",
    amber: "portal-banner-warning border text-amber-900",
    sky: "portal-banner-info border text-sky-900",
    rose: "portal-banner-error border text-rose-900",
  };
  return (
    <div
      className={`rounded-2xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between ${tones[tone]}`}
    >
      <div className="text-sm leading-relaxed min-w-0 [&_strong]:font-semibold [&_.font-semibold]:font-semibold">
        {children}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function AdminEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="glass-panel rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
      <Icon className="mx-auto text-zinc-600 mb-3" size={28} />
      <p className="text-zinc-200 font-semibold">{title}</p>
      {description ? (
        <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto leading-relaxed">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function AdminSection({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass-panel rounded-2xl border border-white/5 overflow-hidden ${className}`}>
      <div className="px-4 sm:px-5 py-3.5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          {description ? <p className="text-xs text-zinc-500 mt-0.5">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2 shrink-0">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function AdminFilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="glass-panel rounded-2xl border border-white/5 p-3 sm:p-4">
      <div className="flex flex-col xl:flex-row gap-3 xl:items-end">{children}</div>
    </div>
  );
}

export const adminFinancePageClass = "w-full space-y-6 pb-10";
