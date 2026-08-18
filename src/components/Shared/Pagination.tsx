"use client";

import type { PaginationMeta } from "@/lib/pagination";

export type { PaginationMeta };

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export default function Pagination({ meta, onPageChange, disabled }: PaginationProps) {
  if (!meta || meta.total_pages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-white/5">
      <p className="text-xs text-zinc-500">
        Page {meta.page} of {meta.total_pages} · {meta.total} total
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled || !meta.has_prev}
          onClick={() => onPageChange(meta.page - 1)}
          className="px-3 py-1.5 rounded-lg text-sm text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={disabled || !meta.has_next}
          onClick={() => onPageChange(meta.page + 1)}
          className="px-3 py-1.5 rounded-lg text-sm text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
