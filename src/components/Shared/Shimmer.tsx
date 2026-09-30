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
      <div
        className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 md:gap-4 lg:grid-cols-4 lg:gap-5"
        aria-busy="true"
        aria-label="Loading events"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="min-w-0">
            <div className="aspect-[2/3] w-full overflow-hidden rounded-2xl">
              <Skeleton className="!block !h-full !w-full !rounded-2xl" height="100%" />
            </div>
            <div className="mt-2.5 space-y-2">
              <Skeleton width="85%" height={16} />
              <Skeleton width="55%" height={12} />
            </div>
          </div>
        ))}
      </div>
    </Wrap>
  );
}

/** Explore Events pastel category tiles (events home) */
export function EventExploreShimmer({ count = 6 }: { count?: number }) {
  return (
    <Wrap>
      <div
        className="flex gap-4 sm:gap-5 overflow-hidden px-1 pt-5 pb-8"
        aria-busy="true"
        aria-label="Loading categories"
      >
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="h-[188px] w-[148px] sm:h-[180px] sm:w-[140px] shrink-0 overflow-hidden rounded-[22px]">
            <Skeleton className="!block !h-full !w-full !rounded-[22px]" height="100%" />
          </div>
        ))}
      </div>
    </Wrap>
  );
}

/** Featured / promoted events hero on events home */
export function EventHeroShimmer() {
  return (
    <Wrap>
      <div className="w-full bg-white" aria-busy="true" aria-label="Loading featured events">
        <div className="lg:hidden px-5 sm:px-8 pt-3 pb-5">
          <Skeleton width={160} height={22} className="mb-3" />
          <div className="flex justify-center">
            <div className="w-[min(72vw,18.5rem)] aspect-[3/4] overflow-hidden rounded-2xl">
              <Skeleton className="!block !h-full !w-full !rounded-2xl" height="100%" />
            </div>
          </div>
        </div>
        <div className="hidden lg:block">
          <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 py-10 xl:py-12">
            <div className="flex items-center gap-8">
              <div className="min-w-0 flex-1 space-y-3">
                <Skeleton width={88} height={22} borderRadius={6} />
                <Skeleton width="40%" height={16} />
                <Skeleton width="70%" height={36} />
                <Skeleton width="50%" height={18} />
                <Skeleton width={140} height={48} borderRadius={16} />
              </div>
              <div className="shrink-0 h-[280px] sm:h-[340px] md:h-[380px] lg:h-[490px]">
                <div className="aspect-[3/4] h-full overflow-hidden rounded-2xl">
                  <Skeleton className="!block !h-full !w-full !rounded-2xl" height="100%" />
                </div>
              </div>
            </div>
          </div>
        </div>
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

/** Dining home restaurant listing cards — matches DiningPosterCard listing layout */
export function DiningHomeRestaurantShimmer({ count = 6 }: { count?: number }) {
  return (
    <Wrap>
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-5 w-full"
        aria-busy="true"
        aria-label="Loading restaurants"
      >
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex w-full flex-col rounded-2xl p-2">
            <div className="aspect-[5/4] w-full overflow-hidden rounded-2xl">
              <Skeleton className="!block !h-full !w-full !rounded-2xl" height="100%" />
            </div>
            <div className="flex flex-col gap-1 pt-2.5 pb-1 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <Skeleton width="70%" height={18} />
                <Skeleton width={44} height={22} borderRadius={4} />
              </div>
              <Skeleton width="85%" height={14} />
              <div className="flex items-center justify-between gap-3 pt-0.5">
                <Skeleton width="45%" height={14} />
                <Skeleton width={52} height={14} />
              </div>
            </div>
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

/* ─── Customer-facing shimmers ───────────────────────────────────────────── */

/** Horizontal poster / dining card rail used by ContentRail and custom rails */
export function CustomerRailShimmer({
  count = 4,
  variant = "poster",
  className = "",
}: {
  count?: number;
  variant?: "poster" | "dining" | "movie";
  className?: string;
}) {
  const aspect =
    variant === "dining" ? "aspect-[5/4]" : variant === "movie" ? "aspect-[3/4]" : "aspect-[2/3]";
  return (
    <Wrap>
      <div
        className={`flex gap-3 sm:gap-4 overflow-hidden ${className}`}
        aria-busy="true"
        aria-label="Loading"
      >
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="min-w-0 flex-1 basis-0">
            <div className={`${aspect} w-full overflow-hidden rounded-xl`}>
              <Skeleton className="!block !h-full !w-full !rounded-xl" height="100%" />
            </div>
            <div className="mt-2.5 space-y-2">
              <Skeleton width="85%" height={16} />
              <Skeleton width="55%" height={12} />
            </div>
          </div>
        ))}
      </div>
    </Wrap>
  );
}

/** Circular artist avatars rail */
export function ArtistRailShimmer({ count = 6 }: { count?: number }) {
  return (
    <Wrap>
      <div className="flex gap-4 sm:gap-6 overflow-hidden" aria-busy="true" aria-label="Loading artists">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 shrink-0">
            <Skeleton circle width={120} height={120} className="sm:!w-[190px] sm:!h-[190px]" />
            <Skeleton width={72} height={12} />
          </div>
        ))}
      </div>
    </Wrap>
  );
}

/** Live event category tiles */
export function CategoryTilesShimmer({ count = 6 }: { count?: number }) {
  return (
    <Wrap>
      <div
        className="flex flex-wrap gap-2.5 sm:gap-3 md:gap-4 items-start"
        aria-busy="true"
        aria-label="Loading categories"
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="w-[calc((100%-0.625rem)/2)] sm:w-[calc((100%-1.5rem)/3)] md:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-5rem)/6)] aspect-[3/4] sm:aspect-[5/7] overflow-hidden rounded-2xl"
          >
            <Skeleton className="!block !h-full !w-full !rounded-2xl" height="100%" />
          </div>
        ))}
      </div>
    </Wrap>
  );
}

/** Special offers horizontal cards */
export function OffersRailShimmer({ count = 4 }: { count?: number }) {
  return (
    <Wrap>
      <div className="flex gap-3 sm:gap-4 overflow-hidden" aria-busy="true" aria-label="Loading offers">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="w-[min(85vw,20rem)] sm:w-[22rem] shrink-0 rounded-2xl border border-slate-100 bg-white p-4 space-y-3"
          >
            <Skeleton height={120} borderRadius={12} />
            <Skeleton width="70%" height={18} />
            <Skeleton width="90%" height={14} />
            <Skeleton width={100} height={32} borderRadius={999} />
          </div>
        ))}
      </div>
    </Wrap>
  );
}

/** Top promo / listing banner */
export function PromoBannerShimmer() {
  return (
    <Wrap>
      <div className="w-full bg-white pt-3 sm:pt-4 pb-3 sm:pb-4" aria-busy="true" aria-label="Loading promotions">
        <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
          <div className="overflow-hidden rounded-2xl sm:rounded-3xl aspect-[21/9] min-h-[160px] sm:min-h-[220px]">
            <Skeleton className="!block !h-full !w-full !rounded-2xl sm:!rounded-3xl" height="100%" />
          </div>
        </div>
      </div>
    </Wrap>
  );
}

/** Restaurant / venue detail page */
export function RestaurantDetailShimmer() {
  return (
    <Wrap>
      <div className="min-h-screen bg-white" aria-busy="true" aria-label="Loading restaurant">
        <div className="w-full aspect-[21/9] min-h-[200px] sm:min-h-[280px] overflow-hidden">
          <Skeleton className="!block !h-full !w-full !rounded-none" height="100%" />
        </div>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton width="55%" height={32} />
              <Skeleton width="40%" height={16} />
              <Skeleton width="70%" height={14} />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton width={64} height={48} borderRadius={8} />
              <div className="space-y-1">
                <Skeleton width={90} height={12} />
                <Skeleton width={70} height={12} />
              </div>
            </div>
          </div>
          <div className="flex gap-2 overflow-hidden">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} width={88} height={36} borderRadius={999} />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            <div className="space-y-4">
              <Skeleton width={140} height={22} />
              <Skeleton count={4} />
              <Skeleton height={180} borderRadius={16} />
            </div>
            <div className="space-y-3">
              <Skeleton height={200} borderRadius={16} />
              <Skeleton height={48} borderRadius={12} />
            </div>
          </div>
        </div>
      </div>
    </Wrap>
  );
}

/** Movie detail page */
export function MovieDetailShimmer() {
  return (
    <Wrap>
      <div className="min-h-screen bg-white" aria-busy="true" aria-label="Loading movie">
        <div className="w-full aspect-[2.4/1] min-h-[220px] overflow-hidden">
          <Skeleton className="!block !h-full !w-full !rounded-none" height="100%" />
        </div>
        <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 py-6 space-y-5">
          <div className="flex gap-4 sm:gap-6">
            <Skeleton width={140} height={210} borderRadius={12} className="shrink-0 sm:!w-[180px] sm:!h-[270px]" />
            <div className="flex-1 space-y-3 pt-1">
              <Skeleton width="60%" height={28} />
              <Skeleton width="40%" height={16} />
              <Skeleton width="80%" height={14} />
              <div className="flex gap-2 pt-2">
                <Skeleton width={120} height={40} borderRadius={8} />
                <Skeleton width={40} height={40} borderRadius={8} />
              </div>
            </div>
          </div>
          <Skeleton width={160} height={22} />
          <Skeleton count={3} />
          <CustomerRailShimmer count={5} variant="movie" />
        </div>
      </div>
    </Wrap>
  );
}

/** Movies / cinemas listing grids */
export function MovieGridShimmer({ count = 8 }: { count?: number }) {
  return (
    <Wrap>
      <div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4"
        aria-busy="true"
        aria-label="Loading movies"
      >
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="min-w-0">
            <div className="aspect-[2/3] overflow-hidden rounded-xl">
              <Skeleton className="!block !h-full !w-full !rounded-xl" height="100%" />
            </div>
            <Skeleton width="85%" height={14} className="mt-2" />
            <Skeleton width="55%" height={12} className="mt-1" />
          </div>
        ))}
      </div>
    </Wrap>
  );
}

export function CinemaListShimmer({ count = 6 }: { count?: number }) {
  return (
    <Wrap>
      <div className="space-y-3" aria-busy="true" aria-label="Loading cinemas">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex gap-3 sm:gap-4 rounded-2xl border border-slate-100 bg-white p-3 sm:p-4"
          >
            <Skeleton width={88} height={88} borderRadius={12} className="shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              <Skeleton width="55%" height={18} />
              <Skeleton width="80%" height={14} />
              <Skeleton width="35%" height={12} />
            </div>
            <Skeleton circle width={36} height={36} className="shrink-0" />
          </div>
        ))}
      </div>
    </Wrap>
  );
}

/** Collections grid */
export function CollectionsShimmer({ count = 6 }: { count?: number }) {
  return (
    <Wrap>
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
        aria-busy="true"
        aria-label="Loading collections"
      >
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl">
            <div className="aspect-[16/10]">
              <Skeleton className="!block !h-full !w-full !rounded-2xl" height="100%" />
            </div>
          </div>
        ))}
      </div>
    </Wrap>
  );
}

/** Search / filter restaurant list */
export function DiningSearchShimmer({ count = 6 }: { count?: number }) {
  return (
    <Wrap>
      <div className="space-y-4" aria-busy="true" aria-label="Loading restaurants">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex gap-3 rounded-2xl border border-slate-100 bg-white overflow-hidden"
          >
            <Skeleton width={120} height={120} className="!rounded-none shrink-0 sm:!w-[140px] sm:!h-[140px]" />
            <div className="flex-1 py-3 pr-3 space-y-2 min-w-0">
              <div className="flex justify-between gap-2">
                <Skeleton width="60%" height={18} />
                <Skeleton width={40} height={22} borderRadius={6} />
              </div>
              <Skeleton width="75%" height={14} />
              <Skeleton width="45%" height={12} />
            </div>
          </div>
        ))}
      </div>
    </Wrap>
  );
}

/** Generic customer account / wishlist / offers content */
export function CustomerPageShimmer({ rows = 4 }: { rows?: number }) {
  return (
    <Wrap>
      <div className="space-y-4" aria-busy="true" aria-label="Loading">
        <Skeleton width={200} height={28} />
        <Skeleton width={160} height={14} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 pt-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-100 bg-white p-3 space-y-3">
              <Skeleton height={140} borderRadius={12} />
              <Skeleton width="70%" height={16} />
              <Skeleton width="50%" height={12} />
            </div>
          ))}
        </div>
      </div>
    </Wrap>
  );
}

/** Centered page shell for showtimes / seats / booking (structure shimmer) */
export function CustomerFullscreenShimmer({ label = "Loading" }: { label?: string }) {
  return (
    <Wrap>
      <div className="min-h-[60vh] bg-[#F5F5F5]" aria-busy="true" aria-label={label}>
        <div className="bg-white border-b border-slate-200 px-4 py-4">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <Skeleton width={28} height={28} borderRadius={8} />
            <Skeleton width="40%" height={20} />
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
          <div className="flex gap-2 overflow-hidden">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} width={72} height={40} borderRadius={10} />
            ))}
          </div>
          <Skeleton height={280} borderRadius={16} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={64} borderRadius={12} />
            ))}
          </div>
        </div>
      </div>
    </Wrap>
  );
}
