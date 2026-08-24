"use client";

import type { ReactNode } from "react";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

const theme = {
  baseColor: "#E8E4EE",
  highlightColor: "#F7F3FB",
  borderRadius: 8,
  duration: 1.15,
};

function Wrap({ children }: { children: ReactNode }) {
  return <SkeletonTheme {...theme}>{children}</SkeletonTheme>;
}

export function EventDetailShimmer() {
  return (
    <Wrap>
      <div className="max-w-[80rem] mx-auto px-3 sm:px-6 py-5 sm:py-7">
        <Skeleton width="60%" height={32} className="mb-5" />
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-5 sm:gap-8">
          <div>
            <Skeleton height={280} className="!rounded-[0.75rem] w-full" />
            <div className="mt-4 flex gap-2 items-center">
              <Skeleton width={96} height={32} borderRadius={999} />
              <Skeleton width={140} height={32} borderRadius={999} />
              <div className="ml-auto">
                <Skeleton width={120} height={40} borderRadius={8} />
              </div>
            </div>
            <div className="mt-8 space-y-2">
              <Skeleton width={160} height={24} />
              <Skeleton count={3} />
            </div>
            <div className="mt-8">
              <Skeleton width={100} height={24} className="mb-3" />
              <div className="flex gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} width={88} height={120} borderRadius={12} />
                ))}
              </div>
            </div>
          </div>
          <div className="hidden lg:block">
            <div className="rounded-[0.75rem] border border-slate-100 bg-white p-4">
              <Skeleton count={6} className="mb-2" />
              <Skeleton height={48} className="mt-4" borderRadius={8} />
            </div>
          </div>
        </div>
      </div>
    </Wrap>
  );
}

export function EventBookingShimmer() {
  return (
    <Wrap>
      <div className="min-h-[calc(100vh-4rem)] bg-[#F5F5F5]">
        <div className="bg-white border-b border-slate-200">
          <div className="relative h-14 flex items-center px-4">
            <Skeleton width={100} height={28} className="absolute left-4" />
            <div className="w-full max-w-[36rem] mx-auto flex items-center gap-3 px-12">
              <Skeleton circle width={32} height={32} />
              <Skeleton width="60%" height={18} />
            </div>
          </div>
          <div className="max-w-[40rem] mx-auto px-4 py-3 flex items-center justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton circle width={24} height={24} />
                <Skeleton width={56} height={12} />
                {i < 2 && <Skeleton width={12} height={12} />}
              </div>
            ))}
          </div>
        </div>
        <Skeleton height={40} className="!rounded-none" />
        <div className="max-w-[36rem] mx-auto px-4 py-6 space-y-4">
          <Skeleton width={160} height={28} />
          <Skeleton width={220} height={16} />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={84} borderRadius={12} />
          ))}
        </div>
        <div className="fixed bottom-0 inset-x-0 bg-[#F0F0F0] border-t border-slate-200 p-4">
          <div className="max-w-[36rem] mx-auto">
            <Skeleton height={48} borderRadius={10} />
          </div>
        </div>
      </div>
    </Wrap>
  );
}

export function EventConfirmationShimmer() {
  return (
    <Wrap>
      <div className="min-h-screen bg-[#F5F5F5]">
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-[72rem] mx-auto px-3 sm:px-6 py-6 flex gap-3">
            <Skeleton circle width={44} height={44} />
            <div className="flex-1">
              <Skeleton width={220} height={28} className="mb-2" />
              <Skeleton width="80%" height={16} />
            </div>
          </div>
        </div>
        <div className="max-w-[72rem] mx-auto px-3 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-5">
          <div className="bg-white rounded-[0.75rem] border border-slate-100 p-5 space-y-4">
            <div className="flex gap-4">
              <Skeleton width={88} height={118} borderRadius={8} />
              <div className="flex-1 space-y-2">
                <Skeleton width={64} height={12} />
                <Skeleton width="80%" height={24} />
                <Skeleton width="55%" height={16} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Skeleton height={48} />
              <Skeleton height={48} />
              <Skeleton height={48} />
            </div>
            <Skeleton height={96} />
            <div className="flex gap-4">
              <Skeleton width={88} height={88} borderRadius={6} />
              <div className="flex-1 space-y-2">
                <Skeleton width={80} height={16} />
                <Skeleton count={2} />
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <Skeleton height={140} borderRadius={12} />
            <Skeleton height={120} borderRadius={12} />
            <Skeleton height={48} borderRadius={8} />
            <Skeleton height={48} borderRadius={8} />
          </div>
        </div>
      </div>
    </Wrap>
  );
}

export function EventListShimmer() {
  return (
    <Wrap>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl overflow-hidden border border-slate-100">
            <Skeleton height={260} className="!rounded-none" />
            <div className="p-3 space-y-2">
              <Skeleton width="85%" height={16} />
              <Skeleton width="50%" height={12} />
            </div>
          </div>
        ))}
      </div>
    </Wrap>
  );
}

export function EventGalleryShimmer() {
  return (
    <Wrap>
      <div className="max-w-[48rem] mx-auto px-4 py-10">
        <Skeleton height={320} borderRadius={12} className="w-full" />
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={80} borderRadius={8} />
          ))}
        </div>
      </div>
    </Wrap>
  );
}

export function EventReviewsShimmer() {
  return (
    <Wrap>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-slate-100 bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <Skeleton circle width={32} height={32} />
              <Skeleton width={112} height={16} />
            </div>
            <Skeleton count={2} />
          </div>
        ))}
      </div>
    </Wrap>
  );
}

/** Super Admin list loading state — matches tabs/search bar, cards (<lg), table (lg+), pagination */
export function AdminListShimmer({
  rows = 6,
  columns = 6,
  showTabs = false,
  showToolbar = true,
  showPagination = true,
  tabCount = 2,
}: {
  rows?: number;
  columns?: number;
  showTabs?: boolean;
  showToolbar?: boolean;
  showPagination?: boolean;
  tabCount?: number;
}) {
  const cardCount = Math.min(Math.max(rows, 2), 4);

  return (
    <Wrap>
      <div className="w-full space-y-4">
        {(showToolbar || showTabs) && (
          <div className="mb-1 flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            {showTabs ? (
              <div className="flex shrink-0 items-center gap-1 rounded-xl bg-slate-100/80 p-1">
                {Array.from({ length: tabCount }).map((_, i) => (
                  <Skeleton
                    key={i}
                    width={i === 0 ? 72 : 88}
                    height={36}
                    borderRadius={8}
                    className="!rounded-lg"
                  />
                ))}
              </div>
            ) : (
              <div className="hidden lg:block" />
            )}
            {showToolbar && (
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <Skeleton height={42} borderRadius={12} className="w-full sm:!max-w-xs lg:!max-w-sm" />
                <Skeleton height={42} width={148} borderRadius={12} className="!w-full sm:!w-[9.25rem]" />
              </div>
            )}
          </div>
        )}

        {/* Mobile / tablet cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
          {Array.from({ length: cardCount }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <Skeleton width="55%" height={18} />
                <Skeleton width={76} height={24} borderRadius={999} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2">
                {[0, 1, 2, 3].map((f) => (
                  <div
                    key={f}
                    className={`border-b border-slate-100 px-4 py-3 ${f >= 2 ? "sm:col-span-2" : ""}`}
                  >
                    <Skeleton width={56} height={10} className="mb-2" />
                    <Skeleton width={f >= 2 ? "85%" : "70%"} height={14} />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-1.5 border-t border-slate-100 bg-slate-50/80 px-3 py-2.5">
                <Skeleton width={34} height={34} borderRadius={10} />
                <Skeleton width={34} height={34} borderRadius={10} />
                <Skeleton width={44} height={28} borderRadius={999} />
                <Skeleton width={34} height={34} borderRadius={10} />
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
          <div
            className="grid gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3.5"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} height={12} width={i === columns - 1 ? "40%" : "55%"} />
            ))}
          </div>
          {Array.from({ length: rows }).map((_, r) => (
            <div
              key={r}
              className="grid gap-3 border-b border-slate-100 px-5 py-4 last:border-0"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: columns }).map((_, c) => (
                <Skeleton
                  key={c}
                  height={16}
                  width={c === 0 ? "70%" : c === columns - 1 ? "45%" : "60%"}
                />
              ))}
            </div>
          ))}
        </div>

        {showPagination && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Skeleton width={160} height={16} />
              <Skeleton width={110} height={32} borderRadius={10} />
            </div>
            <div className="inline-flex items-center gap-1 sm:gap-2 ml-auto">
              <Skeleton width={36} height={32} borderRadius={10} />
              <Skeleton width={40} height={16} />
              <Skeleton width={36} height={32} borderRadius={10} />
            </div>
          </div>
        )}
      </div>
    </Wrap>
  );
}
