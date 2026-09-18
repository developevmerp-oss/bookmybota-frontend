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
      <div className="min-h-screen bg-white" aria-busy="true" aria-label="Loading event">
        <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 pt-4 sm:pt-6 lg:pt-7 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-10">
          {/* Breadcrumb */}
          <div className="mb-3 sm:mb-4 flex items-center gap-2">
            <Skeleton width={40} height={12} />
            <Skeleton width={8} height={10} />
            <Skeleton width={48} height={12} />
            <Skeleton width={8} height={10} />
            <Skeleton width={64} height={12} />
            <Skeleton width={8} height={10} />
            <Skeleton width={120} height={12} />
          </div>

          {/* Title + share */}
          <div className="flex items-start justify-between gap-3 sm:gap-4 mb-3 sm:mb-4 lg:mb-5">
            <Skeleton width="55%" height={36} className="!max-w-[28rem] sm:!h-10 lg:!h-11" />
            <Skeleton circle width={40} height={40} className="shrink-0" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px] gap-5 sm:gap-6 lg:gap-8 2xl:gap-10">
            <div className="min-w-0">
              {/* Hero media — matches EventMediaSlider aspect ratios */}
              <div className="w-full overflow-hidden rounded-lg sm:rounded-xl aspect-[4/3] sm:aspect-[16/9] lg:aspect-[2/1] 2xl:aspect-[21/9]">
                <Skeleton className="!block !h-full !w-full !rounded-lg sm:!rounded-xl" height="100%" />
              </div>

              {/* Category badges + interested CTA */}
              <div className="mt-3 sm:mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <Skeleton width={88} height={32} borderRadius={999} />
                  <Skeleton width={96} height={32} borderRadius={999} />
                  <Skeleton width={72} height={32} borderRadius={999} />
                </div>
                <div className="sm:ml-auto">
                  <Skeleton width={132} height={40} borderRadius={8} />
                </div>
              </div>

              {/* Mobile booking card */}
              <div className="lg:hidden mt-4 sm:mt-5 rounded-xl border border-[#E8E8E8] bg-white overflow-hidden">
                <div className="px-3.5 sm:px-5 pt-3.5 sm:pt-4 pb-2 space-y-3">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton width={18} height={18} className="mt-0.5 shrink-0" />
                      <Skeleton width={i === 4 ? "75%" : "55%"} height={16} />
                    </div>
                  ))}
                </div>
                <div className="border-t border-[#EEE] px-3.5 sm:px-5 py-3.5 sm:py-4 flex items-center gap-3">
                  <Skeleton width={120} height={22} className="flex-1" />
                  <Skeleton width={110} height={44} borderRadius={8} />
                </div>
              </div>

              {/* About */}
              <div className="mt-6 sm:mt-8 lg:mt-9 space-y-2.5">
                <Skeleton width={160} height={26} />
                <Skeleton count={3} />
                <Skeleton width="70%" />
              </div>

              {/* Artists */}
              <div className="mt-6 sm:mt-8 lg:mt-9">
                <Skeleton width={90} height={26} className="mb-3" />
                <div className="flex gap-3 sm:gap-4 overflow-hidden">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="w-[128px] sm:w-[148px] lg:w-[156px] shrink-0">
                      <div className="h-[160px] sm:h-[188px] lg:h-[196px] rounded-xl overflow-hidden">
                        <Skeleton className="!block !h-full !w-full !rounded-xl" height="100%" />
                      </div>
                      <Skeleton width="80%" height={14} className="mt-2" />
                      <Skeleton width="50%" height={12} className="mt-1" />
                    </div>
                  ))}
                </div>
              </div>

              {/* You May Also Like */}
              <div className="mt-6 sm:mt-8 lg:mt-9">
                <Skeleton width={180} height={26} className="mb-1" />
                <Skeleton width={200} height={14} className="mb-3" />
                <div className="flex gap-3 sm:gap-4 overflow-hidden">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-[148px] sm:w-[176px] lg:w-[196px] shrink-0">
                      <div className="h-[208px] sm:h-[248px] lg:h-[264px] rounded-xl overflow-hidden">
                        <Skeleton className="!block !h-full !w-full !rounded-xl" height="100%" />
                      </div>
                      <Skeleton width="90%" height={16} className="mt-2" />
                      <Skeleton width="55%" height={12} className="mt-1" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Desktop sticky booking card */}
            <aside className="hidden lg:block lg:self-start">
              <div className="rounded-xl border border-[#E8E8E8] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden">
                <div className="px-5 pt-4 pb-2 space-y-3">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-start gap-3 py-1">
                      <Skeleton width={18} height={18} className="mt-0.5 shrink-0" />
                      <Skeleton width={i % 2 === 0 ? "70%" : "55%"} height={18} />
                    </div>
                  ))}
                </div>
                <div className="border-t border-[#EEE] px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <Skeleton width={140} height={22} />
                  </div>
                  <Skeleton width={120} height={48} borderRadius={8} />
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* Mobile sticky book bar */}
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 border-t border-slate-200 px-3 sm:px-4 pt-2.5 sm:pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-3">
          <Skeleton width={120} height={22} className="flex-1" />
          <Skeleton width={120} height={44} borderRadius={8} />
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
