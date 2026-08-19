"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import type { DiningFilterState, SortOption } from "@/lib/diningFilters";
import { extractCuisines } from "@/lib/diningFilters";
import { useGetBusinessesQuery, useGetDiningCuisinesQuery } from "@/services/api";

interface DiningFiltersBarProps {
  cuisines: string[];
  filters: DiningFilterState;
  onChange: (next: DiningFilterState) => void;
  onReset?: () => void;
  categories?: string[];
  category?: string;
  onCategoryChange?: (category: string) => void;
}

const ACCENT = "#6900AA";

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

const RATING_OPTIONS = [
  { label: "Any rating", value: 0 },
  { label: "Rating 3.5+", value: 3.5 },
  { label: "Rating 4+", value: 4 },
  { label: "Rating 4.5+", value: 4.5 },
];

const COST_OPTIONS = [
  { label: "Any cost", value: 0 },
  { label: "Under ₹500", value: 500 },
  { label: "Under ₹1000", value: 1000 },
  { label: "Under ₹2000", value: 2000 },
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
      className="w-full flex items-center justify-between gap-3 py-3 text-left cursor-pointer"
    >
      <span className={`text-sm ${selected ? "font-semibold text-slate-800" : "text-slate-600"}`}>
        {label}
      </span>
      <span
        className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 ${
          selected ? "border-[#6900AA]" : "border-slate-300"
        }`}
      >
        {selected && <span className="w-2 h-2 rounded-full bg-[#6900AA]" />}
      </span>
    </button>
  );
}

export default function DiningFiltersBar({
  cuisines,
  filters,
  onChange,
  onReset,
  categories = [],
  category = "All",
  onCategoryChange,
}: DiningFiltersBarProps) {
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [draft, setDraft] = useState<DiningFilterState>(filters);
  const [draftCategory, setDraftCategory] = useState(category);
  const [tab, setTab] = useState<FilterTab>("sort");
  const [draftSort, setDraftSort] = useState<SortOption>(filters.sort);
  const sortRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const [sortPos, setSortPos] = useState({ top: 0, left: 0 });
  const { data: businesses = [] } = useGetBusinessesQuery({ module: "dining" });
  const { data: cuisineMasters = [] } = useGetDiningCuisinesQuery();
  const cuisineList = useMemo(() => {
    const fromBiz = extractCuisines(businesses);
    const fromMaster = cuisineMasters.map((c) => c.name);
    const seen = new Set<string>();
    const out: string[] = [];
    [...fromMaster, ...fromBiz, ...cuisines].forEach((name) => {
      if (!name) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(name);
    });
    return out;
  }, [businesses, cuisineMasters, cuisines]);

  useEffect(() => {
    if (showFilter) {
      setDraft(filters);
      setDraftCategory(category);
      setTab("sort");
    }
  }, [showFilter, filters, category]);

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
    if (filters.cuisine) n += 1;
    if (filters.minRating > 0) n += 1;
    if (filters.offersOnly) n += 1;
    if (filters.pureVeg) n += 1;
    if (filters.servesAlcohol) n += 1;
    if (filters.maxCost > 0) n += 1;
    if (filters.sort !== "relevance") n += 1;
    if (category && category !== "All") n += 1;
    return n;
  }, [filters, category]);

  const sortLabel =
    SORT_OPTIONS.find((o) => o.value === filters.sort)?.label.split(":")[0] || "Sort By";

  const activeChips: { label: string; onClear: () => void }[] = [];
  if (filters.sort !== "relevance") {
    const lbl = SORT_OPTIONS.find((o) => o.value === filters.sort)?.label || filters.sort;
    activeChips.push({ label: lbl, onClear: () => onChange({ ...filters, sort: "relevance" }) });
  }
  if (category && category !== "All") {
    activeChips.push({
      label: category.toLowerCase() === "all" ? "All Dining" : category,
      onClear: () => onCategoryChange?.("All"),
    });
  }
  if (filters.cuisine) {
    activeChips.push({ label: filters.cuisine, onClear: () => onChange({ ...filters, cuisine: "" }) });
  }
  if (filters.minRating > 0) {
    activeChips.push({ label: `Rating ${filters.minRating}+`, onClear: () => onChange({ ...filters, minRating: 0 }) });
  }
  if (filters.maxCost > 0) {
    const costLabel = COST_OPTIONS.find((o) => o.value === filters.maxCost)?.label || `Under ₹${filters.maxCost}`;
    activeChips.push({ label: costLabel, onClear: () => onChange({ ...filters, maxCost: 0 }) });
  }
  if (filters.pureVeg) {
    activeChips.push({ label: "Pure Veg", onClear: () => onChange({ ...filters, pureVeg: false }) });
  }
  if (filters.servesAlcohol) {
    activeChips.push({ label: "Serves Alcohol", onClear: () => onChange({ ...filters, servesAlcohol: false }) });
  }
  if (filters.offersOnly) {
    activeChips.push({ label: "Offers", onClear: () => onChange({ ...filters, offersOnly: false }) });
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
    onCategoryChange?.(draftCategory);
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
              className="w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
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
                    className="text-sm font-bold"
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
          onClick={() => onChange({ ...filters, offersOnly: !filters.offersOnly })}
          className={chipClass(filters.offersOnly)}
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
                  onCategoryChange?.("All");
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
              <h3 className="text-lg font-bold text-slate-900">Filter</h3>
              <button
                type="button"
                onClick={() => setShowFilter(false)}
                className="p-1 rounded-full hover:bg-slate-100"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row min-h-0 flex-1 overflow-hidden">
              <div className="sm:w-[34%] border-b sm:border-b-0 sm:border-r border-slate-100 overflow-x-auto sm:overflow-y-auto shrink-0 sm:h-full">
                <div className="flex sm:flex-col">
                  {tabs.map((item) => {
                    const active = tab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTab(item.id)}
                        className={`relative shrink-0 text-left px-4 py-3 text-sm whitespace-nowrap ${
                          active ? "font-semibold text-slate-900 bg-slate-50" : "text-slate-600"
                        }`}
                      >
                        {active && (
                          <span
                            className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r hidden sm:block"
                            style={{ backgroundColor: ACCENT }}
                          />
                        )}
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-3 min-h-0 h-full">
                {tab === "sort" && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Sort by
                    </p>
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
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Category
                    </p>
                    {categories.map((c) => {
                      const label = c.toLowerCase() === "all" ? "All Dining" : c;
                      return (
                        <RadioRow
                          key={c}
                          label={label}
                          selected={draftCategory.toLowerCase() === c.toLowerCase()}
                          onSelect={() => setDraftCategory(c)}
                        />
                      );
                    })}
                  </div>
                )}

                {tab === "cuisine" && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Cuisine
                    </p>
                    {cuisineList.map((c) => (
                      <RadioRow
                        key={c}
                        label={c}
                        selected={draft.cuisine.toLowerCase() === c.toLowerCase()}
                        onSelect={() => setDraft({ ...draft, cuisine: c })}
                      />
                    ))}
                  </div>
                )}

                {tab === "ratings" && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Rating
                    </p>
                    {RATING_OPTIONS.filter((opt) => opt.value > 0).map((opt) => (
                      <RadioRow
                        key={opt.value}
                        label={opt.label}
                        selected={draft.minRating === opt.value}
                        onSelect={() => setDraft({ ...draft, minRating: opt.value })}
                      />
                    ))}
                  </div>
                )}

                {tab === "cost" && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Cost for 2
                    </p>
                    {COST_OPTIONS.filter((opt) => opt.value > 0).map((opt) => (
                      <RadioRow
                        key={opt.value}
                        label={opt.label}
                        selected={draft.maxCost === opt.value}
                        onSelect={() => setDraft({ ...draft, maxCost: opt.value })}
                      />
                    ))}
                  </div>
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
                    selected={draft.offersOnly}
                    onSelect={() => setDraft({ ...draft, offersOnly: !draft.offersOnly })}
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-6 px-5 py-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onReset?.();
                  onCategoryChange?.("All");
                  setShowFilter(false);
                }}
                className="text-sm font-bold"
                style={{ color: ACCENT }}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={applyDraft}
                className="text-sm font-bold"
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
