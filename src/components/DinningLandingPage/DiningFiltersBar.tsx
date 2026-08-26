"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import type { DiningFilterState, SortOption } from "@/lib/diningFilters";
import { useGetDiningCuisinesQuery } from "@/services/api";

interface DiningFiltersBarProps {
  cuisines: string[];
  filters: DiningFilterState;
  onChange: (next: DiningFilterState) => void;
  onReset?: () => void;
  categories?: string[];
  categoriesSelected?: string[];
  onCategoriesChange?: (categories: string[]) => void;
  category?: string;
  onCategoryChange?: (category: string) => void;
}

const ACCENT = "#6900AA";
const EMPTY_CATEGORIES: string[] = [];
const PANEL_TITLE = "text-sm font-medium text-slate-400 mb-1";
const PANEL_VALUE = "text-xl font-bold text-slate-900 mb-6";

type FilterTab =
  | "sort"
  | "category"
  | "cuisine"
  | "ratings"
  | "cost"
  | "veg"
  | "alcohol"
  | "offers";

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: "Relevance", value: "relevance" },
  { label: "Popularity: High to Low", value: "popular" },
  { label: "Rating", value: "rating" },
  { label: "Cost for two: Low to High", value: "costAsc" },
  { label: "Cost for two: High to Low", value: "costDesc" },
];

/** Same rating range as before — UI only changes. */
const RATING_STOPS = [
  { value: 0, label: "Any", display: "Any" },
  { value: 3.5, label: "3.5", display: "3.5+" },
  { value: 4, label: "4.0", display: "4.0+" },
  { value: 4.5, label: "4.5", display: "4.5+" },
] as const;

/** Same cost caps as before — UI only changes. */
const COST_STOPS = [
  { value: 0, label: "0" },
  { value: 500, label: "500" },
  { value: 1000, label: "1000" },
  { value: 2000, label: "2000" },
  { value: -1, label: "Any" },
] as const;

const COST_OPTIONS = [
  { label: "Any cost", value: 0 },
  { label: "Under 500 ETB", value: 500 },
  { label: "Under 1000 ETB", value: 1000 },
  { label: "Under 2000 ETB", value: 2000 },
];

function chipClass(active: boolean) {
  return `shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] sm:text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
    active
      ? "bg-slate-100 border-slate-400 text-slate-800"
      : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
  }`;
}

function RadioRow({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-center justify-between gap-3 py-3.5 text-left cursor-pointer"
    >
      <span className={`text-base ${selected ? "font-semibold text-slate-800" : "text-slate-600"}`}>
        {label}
      </span>
      <span
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
          selected ? "border-[#6900AA]" : "border-slate-300"
        }`}
      >
        {selected && <span className="w-2.5 h-2.5 rounded-full bg-[#6900AA]" />}
      </span>
    </button>
  );
}

function CheckboxRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full min-w-0 flex items-center justify-between gap-2 py-3 text-left cursor-pointer"
    >
      <span className={`text-base truncate ${checked ? "font-semibold text-slate-800" : "text-slate-600"}`}>
        {label}
      </span>
      <span
        className={`w-5 h-5 rounded-[4px] border flex items-center justify-center shrink-0 ${
          checked ? "border-[#6900AA] bg-[#6900AA]" : "border-slate-300 bg-white"
        }`}
      >
        {checked && <Check size={13} strokeWidth={3} className="text-white" />}
      </span>
    </button>
  );
}

function SliderTooltip({
  label,
  pct,
  edge,
}: {
  label: string;
  pct: number;
  edge?: "start" | "end" | "center";
}) {
  const side = edge ?? (pct <= 2 ? "start" : pct >= 98 ? "end" : "center");
  const style: CSSProperties =
    side === "start"
      ? { left: 0, transform: "none" }
      : side === "end"
        ? { left: "100%", transform: "translateX(-100%)" }
        : { left: `${pct}%`, transform: "translateX(-50%)" };
  const arrowClass =
    side === "start"
      ? "left-3"
      : side === "end"
        ? "right-3 left-auto"
        : "left-1/2 -translate-x-1/2";

  return (
    <div className="absolute z-20 top-0 pointer-events-none" style={style}>
      <div className="bg-slate-800 text-white text-sm font-semibold px-2.5 py-1 rounded-md relative whitespace-nowrap">
        {label}
        <span
          className={`absolute top-full w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-slate-800 ${arrowClass}`}
        />
      </div>
    </div>
  );
}

/** Zomato-style discrete rating slider — same stops; UI matches Cost for 2. */
function RatingSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const idx = Math.max(
    0,
    RATING_STOPS.findIndex((s) => s.value === value)
  );
  const selected = RATING_STOPS[idx] ?? RATING_STOPS[0];
  const pct = RATING_STOPS.length <= 1 ? 0 : (idx / (RATING_STOPS.length - 1)) * 100;

  return (
    <div className="overflow-visible">
      <p className={PANEL_TITLE}>Rating</p>
      <p className={PANEL_VALUE}>{selected.display}</p>
      <div className="relative pt-11 pb-10 px-6 sm:px-8 overflow-visible">
        <SliderTooltip label={selected.display} pct={pct} />

        <div className="relative h-1.5 rounded-full bg-slate-200">
          <div
            className="absolute top-0 bottom-0 left-0 rounded-full"
            style={{ width: `${pct}%`, backgroundColor: ACCENT }}
          />
          {RATING_STOPS.map((stop, i) => {
            const left = (i / (RATING_STOPS.length - 1)) * 100;
            const isActive = i === idx;
            return (
              <button
                key={stop.value}
                type="button"
                aria-label={`Rating ${stop.display}`}
                onClick={() => onChange(stop.value)}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer p-2"
                style={{ left: `${left}%` }}
              >
                <span
                  className={`block rounded-full border-[3px] border-white shadow-md transition-transform ${
                    isActive ? "w-5 h-5" : "w-3.5 h-3.5 opacity-70"
                  }`}
                  style={{ backgroundColor: ACCENT }}
                />
              </button>
            );
          })}
        </div>
        {RATING_STOPS.map((stop, i) => {
          const left = (i / (RATING_STOPS.length - 1)) * 100;
          return (
            <span
              key={`label-${stop.value}`}
              className="absolute top-[52px] text-sm text-slate-500 font-medium -translate-x-1/2"
              style={{ left: `${left}%` }}
            >
              {stop.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Zomato-style cost range UI — still maps to the same maxCost values. */
function CostRangeSlider({
  maxCost,
  onChange,
}: {
  maxCost: number;
  onChange: (next: number) => void;
}) {
  const rightIdx =
    maxCost <= 0
      ? COST_STOPS.length - 1
      : Math.max(
          1,
          COST_STOPS.findIndex((s) => s.value === maxCost)
        );
  const leftPct = 0;
  const rightPct = (rightIdx / (COST_STOPS.length - 1)) * 100;
  const rightStop = COST_STOPS[rightIdx] ?? COST_STOPS[COST_STOPS.length - 1];
  const rightTooltip =
    rightStop.value === -1 ? "Any" : `${rightStop.label} ETB`;
  const rangeLabel =
    rightStop.value === -1 ? "0 ETB - Any" : `0 ETB - ${rightStop.label} ETB`;

  return (
    <div className="overflow-visible">
      <p className={PANEL_TITLE}>Cost for two</p>
      <p className={PANEL_VALUE}>{rangeLabel}</p>
      <div className="relative pt-11 pb-4 px-6 sm:px-8 overflow-visible">
        <SliderTooltip label="0 ETB" pct={leftPct} edge="start" />
        <SliderTooltip label={rightTooltip} pct={rightPct} edge={rightPct >= 98 ? "end" : "center"} />

        <div className="relative h-1.5 rounded-full bg-slate-200">
          <div
            className="absolute top-0 bottom-0 rounded-full"
            style={{
              left: `${leftPct}%`,
              width: `${Math.max(0, rightPct - leftPct)}%`,
              backgroundColor: ACCENT,
            }}
          />
          <span
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-[3px] border-white shadow-md z-[5]"
            style={{ left: `${leftPct}%`, backgroundColor: ACCENT }}
            aria-hidden
          />
          {COST_STOPS.map((stop, i) => {
            const left = (i / (COST_STOPS.length - 1)) * 100;
            const isRight = i === rightIdx;
            return (
              <button
                key={`${stop.value}-${stop.label}`}
                type="button"
                aria-label={
                  stop.value === -1
                    ? "Any cost"
                    : stop.value === 0
                      ? "Cost from 0 ETB"
                      : `Cost up to ${stop.label} ETB`
                }
                onClick={() => {
                  if (i === 0) {
                    onChange(0);
                    return;
                  }
                  onChange(stop.value === -1 ? 0 : stop.value);
                }}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer p-2"
                style={{ left: `${left}%` }}
              >
                <span
                  className={`block rounded-full border-[3px] border-white shadow-md transition-transform ${
                    i === 0 || isRight ? "w-5 h-5" : "w-3.5 h-3.5 opacity-70"
                  }`}
                  style={{ backgroundColor: ACCENT }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function DiningFiltersBar({
  cuisines,
  filters,
  onChange,
  onReset,
  categories = [],
  categoriesSelected = [],
  onCategoriesChange,
  category = "All",
  onCategoryChange,
}: DiningFiltersBarProps) {
  const effectiveCategoriesSelected = useMemo(() => {
    if (categoriesSelected.length > 0) return categoriesSelected;
    if (category && category !== "All") return [category];
    return EMPTY_CATEGORIES;
  }, [categoriesSelected, category]);

  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [draft, setDraft] = useState<DiningFilterState>(filters);
  const [draftCategories, setDraftCategories] = useState<string[]>(effectiveCategoriesSelected);
  const [tab, setTab] = useState<FilterTab>("sort");
  const [draftSort, setDraftSort] = useState<SortOption>(filters.sort);
  const sortRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const wasFilterOpenRef = useRef(false);
  const [sortPos, setSortPos] = useState({ top: 0, left: 0 });
  const { data: cuisineMasters = [] } = useGetDiningCuisinesQuery();
  const normalizedCategories = useMemo(
    () => categories.filter((c) => c.toLowerCase() !== "all"),
    [categories]
  );
  const cuisineList = useMemo(() => {
    const fromMaster = cuisineMasters.map((c) => c.name);
    const seen = new Set<string>();
    const out: string[] = [];
    [...fromMaster, ...cuisines].forEach((name) => {
      if (!name) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(name);
    });
    return out;
  }, [cuisineMasters, cuisines]);

  // Sync draft only when the popup opens — not on every parent re-render while open.
  useEffect(() => {
    if (showFilter && !wasFilterOpenRef.current) {
      setDraft(filters);
      setDraftCategories(effectiveCategoriesSelected);
      setTab("sort");
    }
    wasFilterOpenRef.current = showFilter;
  }, [showFilter, filters, effectiveCategoriesSelected]);

  useEffect(() => {
    if (showSort) setDraftSort(filters.sort);
  }, [showSort, filters.sort]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowFilter(false);
        setShowSort(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (sortRef.current?.contains(target) || sortMenuRef.current?.contains(target)) return;
      setShowSort(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!showSort || !sortRef.current) return;
    const update = () => {
      const rect = sortRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(window.innerWidth * 0.92, 320);
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      setSortPos({ top: rect.bottom + 8, left: Math.max(8, left) });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [showSort]);

  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.cuisines.length > 0) n += 1;
    if (filters.minRating > 0) n += 1;
    if (filters.offersOnly || filters.offerBucket) n += 1;
    if (filters.pureVeg) n += 1;
    if (filters.servesAlcohol) n += 1;
    if (filters.maxCost > 0) n += 1;
    if (filters.sort !== "relevance") n += 1;
    if (effectiveCategoriesSelected.length > 0) n += 1;
    return n;
  }, [filters, effectiveCategoriesSelected]);

  const sortLabel =
    SORT_OPTIONS.find((o) => o.value === filters.sort)?.label.split(":")[0] || "Sort By";

  const activeChips: { label: string; onClear: () => void }[] = [];
  if (filters.sort !== "relevance") {
    const lbl = SORT_OPTIONS.find((o) => o.value === filters.sort)?.label || filters.sort;
    activeChips.push({ label: lbl, onClear: () => onChange({ ...filters, sort: "relevance" }) });
  }
  for (const selectedCategory of effectiveCategoriesSelected) {
    activeChips.push({
      label: selectedCategory.toLowerCase() === "all" ? "All Dining" : selectedCategory,
      onClear: () =>
        onCategoriesChange?.(
          effectiveCategoriesSelected.filter((c) => c.toLowerCase() !== selectedCategory.toLowerCase())
        ),
    });
  }
  for (const selectedCuisine of filters.cuisines) {
    activeChips.push({
      label: selectedCuisine,
      onClear: () =>
        onChange({
          ...filters,
          cuisines: filters.cuisines.filter((c) => c.toLowerCase() !== selectedCuisine.toLowerCase()),
        }),
    });
  }
  if (filters.minRating > 0) {
    activeChips.push({ label: `Rating ${filters.minRating}+`, onClear: () => onChange({ ...filters, minRating: 0 }) });
  }
  if (filters.maxCost > 0) {
    const costLabel = COST_OPTIONS.find((o) => o.value === filters.maxCost)?.label || `Under ${filters.maxCost} ETB`;
    activeChips.push({ label: costLabel, onClear: () => onChange({ ...filters, maxCost: 0 }) });
  }
  if (filters.pureVeg) {
    activeChips.push({ label: "Pure Veg", onClear: () => onChange({ ...filters, pureVeg: false }) });
  }
  if (filters.servesAlcohol) {
    activeChips.push({ label: "Serves Alcohol", onClear: () => onChange({ ...filters, servesAlcohol: false }) });
  }
  if (filters.offersOnly || filters.offerBucket) {
    const offerLabel =
      filters.offerBucket === "percent_upto_20"
        ? "Up to 20% Off"
        : filters.offerBucket === "percent_upto_50"
          ? "Up to 50% Off"
          : filters.offerBucket === "percent_high"
            ? "Over 50% Off"
            : filters.offerBucket === "flat"
              ? "Flat ETB Offers"
              : "Offers";
    activeChips.push({
      label: offerLabel,
      onClear: () => onChange({ ...filters, offersOnly: false, offerBucket: null }),
    });
  }

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "sort", label: "Sort" },
    ...(categories.length > 0 ? [{ id: "category" as const, label: "Category" }] : []),
    { id: "cuisine", label: "Cuisine" },
    { id: "ratings", label: "Ratings" },
    { id: "cost", label: "Cost for 2" },
    { id: "veg", label: "Pure Veg" },
    { id: "alcohol", label: "Serves Alcohol" },
    { id: "offers", label: "Offers" },
  ];

  const applyDraft = () => {
    onChange(draft);
    onCategoriesChange?.(draftCategories);
    if (!onCategoriesChange) {
      onCategoryChange?.(draftCategories[0] ?? "All");
    }
    setShowFilter(false);
  };

  const applySort = () => {
    onChange({ ...filters, sort: draftSort });
    setShowSort(false);
  };

  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
        <button
          type="button"
          onClick={() => {
            setShowSort(false);
            setShowFilter(true);
          }}
          className={chipClass(activeCount > 0)}
        >
          {activeCount > 0 && (
            <span
              className="w-4 h-4 rounded-full text-[0.7rem] font-bold text-white flex items-center justify-center"
              style={{ backgroundColor: ACCENT }}
            >
              {activeCount}
            </span>
          )}
          Filter
          <SlidersHorizontal size={14} className="text-slate-500" />
        </button>

        <div className="relative shrink-0" ref={sortRef}>
          <button
            type="button"
            onClick={() => {
              setShowFilter(false);
              setShowSort((v) => !v);
            }}
            className={chipClass(filters.sort !== "relevance")}
          >
            {filters.sort === "relevance" ? "Sort By" : sortLabel}
            <ChevronDown size={14} className="text-slate-500" />
          </button>

          {showSort &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                ref={sortMenuRef}
                className="w-[min(92vw,320px)] max-h-[min(70vh,380px)] bg-white rounded-2xl border border-slate-200 shadow-xl p-4 flex flex-col"
                style={{ position: "fixed", top: sortPos.top, left: sortPos.left, zIndex: 80 }}
              >
                <div className="divide-y divide-slate-100 overflow-y-auto min-h-0 flex-1 pr-1">
                  {SORT_OPTIONS.map((opt) => (
                    <RadioRow
                      key={opt.value}
                      label={opt.label}
                      selected={draftSort === opt.value}
                      onSelect={() => setDraftSort(opt.value)}
                    />
                  ))}
                </div>
                <div className="border-t border-slate-100 pt-3 mt-1 flex items-center justify-center shrink-0">
                  <button
                    type="button"
                    onClick={applySort}
                    className="text-sm sm:text-base lg:text-smfont-bold"
                    style={{ color: ACCENT }}
                  >
                    Apply
                  </button>
                </div>
              </div>,
              document.body
            )}
        </div>

        <button
          type="button"
          onClick={() =>
            onChange({ ...filters, minRating: filters.minRating === 4 ? 0 : 4 })
          }
          className={chipClass(filters.minRating === 4)}
        >
          Rating 4+
        </button>

        <button
          type="button"
          onClick={() => onChange({ ...filters, pureVeg: !filters.pureVeg })}
          className={chipClass(filters.pureVeg)}
        >
          Pure Veg
        </button>

        <button
          type="button"
          onClick={() => onChange({ ...filters, servesAlcohol: !filters.servesAlcohol })}
          className={chipClass(filters.servesAlcohol)}
        >
          Serves Alcohol
        </button>

        <button
          type="button"
          onClick={() =>
            onChange({
              ...filters,
              offersOnly: !filters.offersOnly && !filters.offerBucket,
              offerBucket: null,
            })
          }
          className={chipClass(filters.offersOnly || Boolean(filters.offerBucket))}
        >
          Offers
        </button>
      </div>

      <div
        className={`grid transition-[grid-template-rows,margin] duration-300 ease-out ${
          activeChips.length > 0 ? "grid-rows-[1fr] mt-3" : "grid-rows-[0fr] mt-0"
        }`}
      >
        <div className="overflow-hidden min-h-0">
          <div className="flex items-center gap-2 flex-wrap">
            {activeChips.map((chip) => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-1.5 bg-[#f7e9ff] border border-[#e3bcff] text-[#6900AA] rounded-full px-3 py-1.5 text-xs font-semibold"
              >
                {chip.label}
                <button
                  type="button"
                  onClick={chip.onClear}
                  className="hover:bg-[#efd7ff] rounded-full p-0.5 transition-colors"
                  aria-label={`Remove ${chip.label}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            {activeChips.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onReset?.();
                  onCategoriesChange?.([]);
                  if (!onCategoriesChange) onCategoryChange?.("All");
                }}
                className="text-xs font-bold px-2 py-1.5 transition-colors cursor-pointer hover:underline"
                style={{ color: ACCENT }}
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      </div>

      {showFilter && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowFilter(false)}
          />
          <div className="relative w-full sm:w-[min(92vw,720px)] h-[min(88vh,540px)] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">Filter</h3>
              <button
                type="button"
                onClick={() => setShowFilter(false)}
                className="p-1 rounded-full hover:bg-slate-100"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row min-h-0 flex-1 overflow-hidden">
              <div className="sm:w-[34%] bg-slate-100 border-b sm:border-b-0 sm:border-r border-slate-200 overflow-x-auto sm:overflow-y-auto shrink-0 sm:h-full">
                <div className="flex sm:flex-col">
                  {tabs.map((item) => {
                    const active = tab === item.id;
                    const sortHint =
                      item.id === "sort" && draft.sort !== "relevance"
                        ? SORT_OPTIONS.find((o) => o.value === draft.sort)?.label.split(":")[0]
                        : null;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTab(item.id)}
                        className={`relative shrink-0 text-left px-4 py-3.5 text-base whitespace-nowrap transition-colors ${
                          active
                            ? "font-semibold text-slate-900 bg-white"
                            : "font-medium text-slate-600 bg-transparent hover:bg-slate-50/80"
                        }`}
                      >
                        {active && (
                          <span
                            className="absolute left-0 top-0 bottom-0 w-[3px] hidden sm:block"
                            style={{ backgroundColor: ACCENT }}
                          />
                        )}
                        <span className="block">{item.label}</span>
                        {sortHint && (
                          <span className="block text-sm font-medium mt-0.5" style={{ color: ACCENT }}>
                            {sortHint}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4 min-h-0 h-full bg-white">
                {tab === "sort" && (
                  <div>
                    <p className="text-lg font-bold text-slate-900 mb-2">Sort by</p>
                    {SORT_OPTIONS.map((opt) => (
                      <RadioRow
                        key={opt.value}
                        label={opt.label}
                        selected={draft.sort === opt.value}
                        onSelect={() => setDraft({ ...draft, sort: opt.value })}
                      />
                    ))}
                  </div>
                )}

                {tab === "category" && (
                  <div>
                    <p className="text-lg font-bold text-slate-900 mb-2">Category</p>
                    <div className="grid grid-cols-2 gap-x-4">
                      {normalizedCategories.map((c) => {
                        const label = c.toLowerCase() === "all" ? "All Dining" : c;
                        const checked = draftCategories.some(
                          (selected) => selected.toLowerCase() === c.toLowerCase()
                        );
                        return (
                          <CheckboxRow
                            key={c}
                            label={label}
                            checked={checked}
                            onToggle={() =>
                              setDraftCategories((prev) =>
                                checked
                                  ? prev.filter((selected) => selected.toLowerCase() !== c.toLowerCase())
                                  : [...prev, c]
                              )
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {tab === "cuisine" && (
                  <div>
                    <p className="text-lg font-bold text-slate-900 mb-2">Cuisine</p>
                    <div className="grid grid-cols-2 gap-x-4">
                      {cuisineList.map((c) => (
                        <CheckboxRow
                          key={c}
                          label={c}
                          checked={draft.cuisines.some((selected) => selected.toLowerCase() === c.toLowerCase())}
                          onToggle={() =>
                            setDraft((prev) => {
                              const exists = prev.cuisines.some((selected) => selected.toLowerCase() === c.toLowerCase());
                              return {
                                ...prev,
                                cuisines: exists
                                  ? prev.cuisines.filter((selected) => selected.toLowerCase() !== c.toLowerCase())
                                  : [...prev.cuisines, c],
                              };
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}

                {tab === "ratings" && (
                  <RatingSlider
                    value={draft.minRating}
                    onChange={(minRating) => setDraft({ ...draft, minRating })}
                  />
                )}

                {tab === "cost" && (
                  <CostRangeSlider
                    maxCost={draft.maxCost}
                    onChange={(next) => setDraft({ ...draft, maxCost: next })}
                  />
                )}

                {tab === "veg" && (
                  <RadioRow
                    label="Pure Veg"
                    selected={draft.pureVeg}
                    onSelect={() => setDraft({ ...draft, pureVeg: !draft.pureVeg })}
                  />
                )}

                {tab === "alcohol" && (
                  <RadioRow
                    label="Serves Alcohol"
                    selected={draft.servesAlcohol}
                    onSelect={() => setDraft({ ...draft, servesAlcohol: !draft.servesAlcohol })}
                  />
                )}

                {tab === "offers" && (
                  <RadioRow
                    label="Offers available"
                    selected={draft.offersOnly || Boolean(draft.offerBucket)}
                    onSelect={() =>
                      setDraft({
                        ...draft,
                        offersOnly: !draft.offersOnly && !draft.offerBucket,
                        offerBucket: null,
                      })
                    }
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-6 px-5 py-3.5 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onReset?.();
                  onCategoriesChange?.([]);
                  if (!onCategoriesChange) onCategoryChange?.("All");
                  setShowFilter(false);
                }}
                className="text-base font-bold cursor-pointer"
                style={{ color: ACCENT }}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={applyDraft}
                className="text-base font-bold cursor-pointer"
                style={{ color: ACCENT }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
