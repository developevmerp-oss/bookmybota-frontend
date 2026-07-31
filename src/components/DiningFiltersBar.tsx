"use client";

import { SlidersHorizontal, Star, Percent, ArrowUpDown } from "lucide-react";
import type { DiningFilterState, SortOption } from "@/lib/diningFilters";

interface DiningFiltersBarProps {
  cuisines: string[];
  filters: DiningFilterState;
  onChange: (next: DiningFilterState) => void;
  onReset?: () => void;
}

const RATING_OPTIONS = [
  { label: "Any rating", value: 0 },
  { label: "3.5+", value: 3.5 },
  { label: "4.0+", value: 4.0 },
  { label: "4.5+", value: 4.5 },
];

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: "Relevance", value: "relevance" },
  { label: "Rating", value: "rating" },
  { label: "Popular", value: "popular" },
];

export default function DiningFiltersBar({
  cuisines,
  filters,
  onChange,
  onReset,
}: DiningFiltersBarProps) {
  const hasActive =
    !!filters.cuisine || filters.minRating > 0 || filters.offersOnly || filters.sort !== "relevance";

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <SlidersHorizontal size={16} className="text-rose-600" />
          Filters & Sort
        </div>
        {hasActive && onReset && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
            Cuisine
          </label>
          <select
            value={filters.cuisine}
            onChange={(e) => onChange({ ...filters, cuisine: e.target.value })}
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400"
          >
            <option value="">All cuisines</option>
            {cuisines.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
            <Star size={11} /> Rating
          </label>
          <select
            value={filters.minRating}
            onChange={(e) => onChange({ ...filters, minRating: Number(e.target.value) })}
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400"
          >
            {RATING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
            <ArrowUpDown size={11} /> Sort by
          </label>
          <select
            value={filters.sort}
            onChange={(e) => onChange({ ...filters, sort: e.target.value as SortOption })}
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => onChange({ ...filters, offersOnly: !filters.offersOnly })}
            className={`w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-3 py-2.5 rounded-xl border transition-colors cursor-pointer ${
              filters.offersOnly
                ? "bg-blue-600 border-blue-600 text-white"
                : "bg-slate-50 border-slate-200 text-slate-700 hover:border-blue-300"
            }`}
          >
            <Percent size={14} />
            Offers available
          </button>
        </div>
      </div>
    </div>
  );
}
