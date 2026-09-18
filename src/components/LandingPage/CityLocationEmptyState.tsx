"use client";

import {
  Calendar,
  Clapperboard,
  Mic2,
  Trophy,
  Utensils,
  type LucideIcon,
} from "lucide-react";

type CityLocationEmptyStateProps = {
  /** Kept for call-site compatibility; drives the title icon. */
  categoryLabel?: string;
  city?: string;
  className?: string;
};

export function openCitySelect() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("open_city_select"));
}

export function clearSelectedCity() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("selected_city");
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("city")) {
      url.searchParams.delete("city");
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, "", next);
    }
  } catch {
    // ignore URL parse errors
  }
  window.dispatchEvent(new Event("selected_city_changed"));
}

function iconForCategory(categoryLabel?: string): LucideIcon {
  const key = (categoryLabel || "").toLowerCase().trim();
  if (key.includes("movie")) return Clapperboard;
  if (key.includes("sport")) return Trophy;
  if (key.includes("artist")) return Mic2;
  if (key.includes("restaurant") || key.includes("dining") || key.includes("bar")) {
    return Utensils;
  }
  return Calendar;
}

/** Empty state when a city is selected but there is no live catalog data. */
export default function CityLocationEmptyState({
  categoryLabel,
  className = "",
}: CityLocationEmptyStateProps) {
  const Icon = iconForCategory(categoryLabel);

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50 px-4 py-10 text-center ${className}`}
    >
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F7E9FF] text-[#6900AA]">
        <Icon size={28} strokeWidth={1.5} aria-hidden />
      </div>
      <p className="text-sm font-semibold text-slate-800 sm:text-base">
        No events, movie, restaurant, sports available in your area right now.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={openCitySelect}
          className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-[#6900AA] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#57008E]"
        >
          Choose another city
        </button>
        <button
          type="button"
          onClick={clearSelectedCity}
          className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Clear city
        </button>
      </div>
    </div>
  );
}
