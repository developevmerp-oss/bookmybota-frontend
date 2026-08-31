"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PaginationMeta } from "@/lib/pagination";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";

export type { PaginationMeta };

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  pageSizeOptions?: readonly number[];
  disabled?: boolean;
  className?: string;
}

export default function Pagination({
  meta,
  onPageChange,
  onLimitChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  disabled,
  className = "",
}: PaginationProps) {
  if (!meta) return null;

  const total = meta.total ?? 0;
  const limit = meta.limit || pageSizeOptions[0] || 10;
  const page = meta.page || 1;
  const totalPages = Math.max(meta.total_pages || 0, total > 0 ? 1 : 0);
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  if (total === 0 && !onLimitChange) return null;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm ${className}`.trim()}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0">
        <p className="m-0 text-[0.8125rem] sm:text-sm text-slate-500 whitespace-nowrap">
          {total === 0 ? (
            "No records"
          ) : (
            <>
              Showing <span className="font-semibold text-slate-800">{from}</span>
              {"\u2013"}
              <span className="font-semibold text-slate-800">{to}</span>
              {" of "}
              <span className="font-semibold text-slate-800">{total}</span>
            </>
          )}
        </p>

        {onLimitChange && (
          <label className="inline-flex items-center gap-1.5 text-[0.8125rem] sm:text-sm text-slate-500">
            <span className="whitespace-nowrap">Per page</span>
            <select
              value={limit}
              disabled={disabled}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isFinite(next) || next <= 0) return;
                onLimitChange(next);
              }}
              className="h-8 cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-[0.8125rem] sm:text-sm font-medium text-slate-700 outline-none focus:border-rose-400"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="inline-flex items-center gap-1 sm:gap-2 ml-auto">
        <button
          type="button"
          disabled={disabled || !meta.has_prev || page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex h-8 sm:h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 sm:px-3 text-[0.8125rem] sm:text-sm font-semibold text-slate-700 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-700"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} className="shrink-0" />
          <span className="hidden sm:inline">Previous</span>
        </button>
        <span className="min-w-[2.75rem] sm:min-w-[3.5rem] text-center text-[0.8125rem] sm:text-sm font-semibold tabular-nums text-slate-600">
          {totalPages > 0 ? `${page} / ${totalPages}` : "0 / 0"}
        </span>
        <button
          type="button"
          disabled={disabled || !meta.has_next || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex h-8 sm:h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 sm:px-3 text-[0.8125rem] sm:text-sm font-semibold text-slate-700 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-700"
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight size={16} className="shrink-0" />
        </button>
      </div>
    </div>
  );
}
