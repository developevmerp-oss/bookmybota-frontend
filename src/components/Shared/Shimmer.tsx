"use client";

import type { ReactNode } from "react";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { CONFIRMATION_UI_VERSION } from "@/components/Shared/Confirmation/confirmationUiVersion";

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
        <div className="bmb-section-container pt-4 sm:pt-6 lg:pt-7 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-10">
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

/**
 * BMS-style confirmation ticket (ConfirmationPageUI1).
 * `showAside` mirrors rating column for movie/dining.
 */
export function ConfirmationPageUI1Shimmer({
  showAside = false,
}: {
  showAside?: boolean;
}) {
  const ticket = (
    <div className="rounded-2xl border border-[#E8E8E8] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="flex gap-3.5 sm:gap-4 px-4 pt-4 pb-5 sm:px-5 sm:pt-5 sm:pb-6">
        <div className="w-[5rem] sm:w-[5.75rem] shrink-0 aspect-[2/3] overflow-hidden rounded-md">
          <Skeleton className="!block !h-full !w-full !rounded-md" height="100%" />
        </div>
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <Skeleton width="78%" height={22} />
          <Skeleton width="55%" height={12} />
          <Skeleton width="70%" height={12} />
          <Skeleton width="62%" height={12} />
          <Skeleton width={72} height={18} borderRadius={4} className="mt-1" />
        </div>
      </div>
      <div className="px-6 pb-1">
        <Skeleton height={40} borderRadius={999} />
      </div>
      <div className="px-4 sm:px-5 pt-6 pb-2">
        <div className="flex items-start gap-4 sm:gap-5">
          <Skeleton width={128} height={128} borderRadius={4} className="shrink-0 sm:!w-[8rem] sm:!h-[8rem]" />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <Skeleton width="45%" height={12} />
            <Skeleton width="70%" height={22} />
            <Skeleton width="55%" height={14} />
            <Skeleton width="60%" height={14} className="mt-2" />
          </div>
        </div>
        <Skeleton height={32} className="mt-5 !rounded-none" />
        <div className="flex items-center justify-between py-4">
          <Skeleton width="35%" height={16} />
          <Skeleton width="22%" height={16} />
        </div>
      </div>
    </div>
  );

  const aside = (
    <div className="w-full space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <Skeleton width="55%" height={18} />
        <Skeleton width="80%" height={12} />
        <div className="flex gap-1.5 pt-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} circle width={22} height={22} />
          ))}
        </div>
        <Skeleton height={88} borderRadius={12} />
        <Skeleton height={44} borderRadius={12} />
      </div>
      <div className="flex justify-center pt-4">
        <Skeleton width={120} height={48} borderRadius={8} />
      </div>
    </div>
  );

  return (
    <Wrap>
      <div
        className="min-h-screen w-full overflow-x-hidden pb-12"
        style={{ backgroundColor: "#F2F2F2" }}
        aria-busy="true"
        aria-label="Loading confirmation"
      >
        <div className="mx-auto w-full max-w-[72rem] px-4 sm:px-6 lg:px-10 pt-5 sm:pt-8">
          <div className="mb-5 sm:mb-6 flex items-center gap-2.5 sm:gap-3">
            <Skeleton circle width={36} height={36} />
            <Skeleton width="8rem" height={22} />
            <Skeleton circle width={36} height={36} className="ml-auto sm:ml-0" />
          </div>
          <div
            className={
              showAside
                ? "mx-auto flex w-full max-w-[56rem] xl:max-w-[60rem] flex-col items-stretch lg:flex-row lg:items-start lg:justify-center gap-6 sm:gap-8 lg:gap-12 xl:gap-14"
                : "flex justify-center"
            }
          >
            <div
              className={
                showAside
                  ? "min-w-0 w-full lg:w-[28rem] xl:w-[30rem] lg:shrink-0 space-y-3"
                  : "min-w-0 w-full max-w-[28rem] xl:max-w-[30rem] space-y-3"
              }
            >
              <Skeleton height={44} borderRadius={8} />
              {ticket}
            </div>
            {showAside ? (
              <div className="w-full lg:w-[22rem] xl:w-[24rem] lg:shrink-0">{aside}</div>
            ) : null}
          </div>
        </div>
      </div>
    </Wrap>
  );
}

/** Classic confirmation (ConfirmationPageUI2) — check header + ticket card + QR */
export function ConfirmationPageUI2Shimmer() {
  return (
    <Wrap>
      <div
        className="min-h-screen pb-10 sm:pb-12"
        style={{ backgroundColor: "#F5F5F7" }}
        aria-busy="true"
        aria-label="Loading confirmation"
      >
        <div className="mx-auto w-full max-w-[64rem] px-4 md:px-5 lg:px-10 xl:px-12 pt-6 sm:pt-8">
          <div className="mb-5 sm:mb-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 flex items-start gap-3.5 sm:gap-4">
            <Skeleton circle width={48} height={48} className="shrink-0" />
            <div className="flex-1 pt-0.5 space-y-2 min-w-0">
              <Skeleton width="70%" height={26} className="sm:!h-8" />
              <Skeleton width="90%" height={14} />
              <Skeleton width="55%" height={12} />
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col sm:flex-row items-stretch">
              <div className="min-w-0 flex-1 p-4 sm:p-5 flex justify-center sm:justify-start">
                <Skeleton
                  borderRadius={12}
                  className="!w-[9rem] !h-[12.5rem] sm:!max-h-[15rem] sm:!w-[12rem] md:!w-[14rem] md:!h-[17rem]"
                  height="100%"
                />
              </div>
              <div className="w-full sm:w-[min(100%,17rem)] md:w-[18rem] lg:w-[19rem] shrink-0 border-t sm:border-t-0 sm:border-l border-dashed border-slate-300 px-5 py-5 sm:pl-8 flex flex-col items-center gap-3">
                <Skeleton width={168} height={168} borderRadius={8} />
                <Skeleton width="40%" height={16} />
                <Skeleton width="55%" height={14} />
              </div>
            </div>
            <div className="border-t border-dashed border-slate-200 p-5 sm:p-6 space-y-3">
              <Skeleton width={120} height={22} borderRadius={999} />
              <Skeleton width="65%" height={24} />
              <Skeleton width="50%" height={14} />
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} height={52} borderRadius={10} />
                ))}
              </div>
            </div>
            <div className="border-t border-slate-200 p-5 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} height={46} borderRadius={12} />
                ))}
              </div>
            </div>
          </div>
          <Skeleton height={88} borderRadius={16} className="mt-6" />
        </div>
      </div>
    </Wrap>
  );
}

/**
 * Picks UI1 / UI2 confirmation shimmer from CONFIRMATION_UI_VERSION.
 * Pass `showAside` for movie/dining rating column on UI1.
 */
export function BookingConfirmationShimmer({
  showAside = false,
  version,
}: {
  showAside?: boolean;
  /** Override; defaults to CONFIRMATION_UI_VERSION */
  version?: 1 | 2;
}) {
  const v = version ?? CONFIRMATION_UI_VERSION;
  if (v === 2) return <ConfirmationPageUI2Shimmer />;
  return <ConfirmationPageUI1Shimmer showAside={showAside} />;
}

/** @deprecated Prefer BookingConfirmationShimmer / ConfirmationPageUI2Shimmer */
export function EventConfirmationShimmer() {
  return <ConfirmationPageUI2Shimmer />;
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
          <div className="bmb-section-container py-10 xl:py-12">
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
/** Matches DiningRestaurantCardOption2 listing card layout. */
export function DiningHomeRestaurantShimmer({ count = 6 }: { count?: number }) {
  return (
    <Wrap>
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-5 w-full"
        aria-busy="true"
        aria-label="Loading restaurants"
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex w-full flex-col overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white shadow-[0_2px_10px_rgba(17,17,17,0.06)]"
          >
            <div className="relative aspect-[5/4] w-full overflow-hidden bg-[#F3F4F6]">
              <Skeleton className="!absolute !inset-0 !block !h-full !w-full !rounded-none" height="100%" />
            </div>
            <div className="flex flex-col gap-2 px-4 pt-3 pb-3.5 min-w-0">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <Skeleton width="68%" height={20} />
                <Skeleton width={40} height={18} borderRadius={4} />
              </div>
              <div className="flex items-center justify-between gap-2 min-w-0">
                <Skeleton width="58%" height={14} />
                <Skeleton width={48} height={14} />
              </div>
              <div className="flex items-center justify-between gap-2 min-w-0">
                <Skeleton width="42%" height={14} />
                <div className="relative flex h-10 w-[3.25rem] items-center">
                  <Skeleton circle width={36} height={36} className="!absolute left-0" />
                  <Skeleton circle width={36} height={36} className="!absolute left-3.5" />
                </div>
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
      <div className="w-full bg-white pt-2 sm:pt-2.5 lg:pt-3 pb-5 sm:pb-6 lg:pb-7" aria-busy="true" aria-label="Loading promotions">
        <div className="relative flex w-full justify-center h-[250px] sm:h-[300px] md:h-[340px] lg:h-[380px] xl:h-[400px] 2xl:h-[440px]">
          <div className="h-full w-[min(92%,calc(250px*3))] sm:w-[min(90%,calc(300px*3))] md:w-[min(90%,calc(340px*3))] lg:w-[min(90%,calc(380px*3))] xl:w-[min(88%,calc(400px*3))] 2xl:w-[min(86%,calc(440px*3))] overflow-hidden rounded-xl sm:rounded-2xl bg-[#111]">
            <Skeleton className="!block !h-full !w-full !rounded-xl sm:!rounded-2xl" height="100%" />
          </div>
        </div>
      </div>
    </Wrap>
  );
}

/** Restaurant / venue detail page */
/** Matches RestaurantDetailPage layout: gallery mosaic + book sidebar + tabs/content. */
export function RestaurantDetailShimmer() {
  return (
    <Wrap>
      <div className="min-h-screen bg-white text-slate-700" aria-busy="true" aria-label="Loading restaurant">
        {/* Breadcrumb — tablet/desktop */}
        <div className="hidden md:block bg-white pt-4">
          <div className="bmb-section-container flex items-center gap-1.5">
            <Skeleton width={40} height={10} />
            <Skeleton width={8} height={8} />
            <Skeleton width={48} height={10} />
            <Skeleton width={8} height={8} />
            <Skeleton width={140} height={10} />
          </div>
        </div>

        <div className="bmb-section-container max-md:px-0 max-md:pt-0 pt-2 pb-24 md:pb-16">
          {/* Title row — tablet/desktop (matches page h1 + actions + rating) */}
          <div className="hidden md:block bg-white pt-2 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0 flex-1 w-full">
                <Skeleton
                  height={36}
                  borderRadius={8}
                  className="!block !w-[min(100%,22rem)] sm:!h-10 lg:!h-8"
                />
              </div>
              <div className="flex items-center gap-1.5 shrink-0 self-start">
                <Skeleton circle width={36} height={36} />
                <Skeleton circle width={36} height={36} />
                <Skeleton circle width={36} height={36} />
                <div className="flex items-center gap-1.5 pl-2 sm:pl-3">
                  <Skeleton width={18} height={18} borderRadius={4} />
                  <Skeleton width={36} height={18} />
                  <Skeleton width={40} height={14} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid items-start gap-x-5 gap-y-2 sm:gap-x-6 lg:gap-x-7 2xl:gap-x-12 md:grid-cols-[minmax(0,1fr)_280px] lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 order-1">
              {/* Mobile hero */}
              <div className="md:hidden relative w-full h-[62vw] min-h-[280px] max-h-[440px] overflow-hidden bg-[#F3F4F6]">
                <Skeleton className="!absolute !inset-0 !block !h-full !w-full !rounded-none" height="100%" />
              </div>

              {/* Tablet/desktop mosaic gallery */}
              <div className="hidden md:grid grid-cols-4 grid-rows-2 gap-2 h-[260px] md:h-[380px] rounded-2xl overflow-hidden border border-slate-100 bg-[#F3F4F6]">
                <div className="col-span-2 row-span-2 overflow-hidden">
                  <Skeleton className="!block !h-full !w-full !rounded-none" height="100%" />
                </div>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="overflow-hidden">
                    <Skeleton className="!block !h-full !w-full !rounded-none" height="100%" />
                  </div>
                ))}
              </div>

              {/* Mobile title + meta under gallery (matches District-style title block) */}
              <div className="md:hidden mt-4 space-y-3 px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Skeleton
                      height={28}
                      borderRadius={8}
                      className="!block !w-[85%] !max-w-[18rem]"
                    />
                  </div>
                  <Skeleton width={56} height={28} borderRadius={6} className="shrink-0" />
                </div>
                <Skeleton width="70%" height={14} />
                <Skeleton width="40%" height={14} />
                <Skeleton width="55%" height={14} />
                <div className="flex flex-wrap gap-2.5 pt-1">
                  <Skeleton width={110} height={36} borderRadius={999} />
                  <Skeleton width={88} height={36} borderRadius={999} />
                  <Skeleton width={96} height={36} borderRadius={999} />
                </div>
              </div>

              {/* Status bar under gallery — tablet/desktop */}
              <div className="relative mt-3 space-y-2 px-0.5 hidden md:block">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Skeleton width={120} height={14} />
                  <Skeleton width={8} height={12} />
                  <Skeleton width={180} height={14} />
                </div>
              </div>

              {/* Section tabs */}
              <div className="mt-5 flex gap-4 overflow-hidden border-b border-slate-100 pb-3 px-5 md:px-0">
                {[90, 70, 78, 84].map((w, i) => (
                  <Skeleton key={i} width={w} height={18} />
                ))}
              </div>

              {/* Content blocks */}
              <div className="mt-5 space-y-4 px-5 md:px-0">
                <Skeleton width={140} height={22} />
                <Skeleton count={3} />
                <Skeleton height={160} borderRadius={16} />
              </div>
            </div>

            {/* Book a table sidebar */}
            <aside className="hidden md:block order-2 min-w-0">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)] space-y-3">
                <Skeleton width={120} height={22} />
                <Skeleton height={42} borderRadius={12} />
                <Skeleton height={42} borderRadius={12} />
                <Skeleton height={42} borderRadius={12} />
                <Skeleton height={48} borderRadius={12} />
              </div>
            </aside>
          </div>
        </div>

        {/* Mobile sticky book CTA */}
        <div className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-4 py-3">
          <Skeleton height={48} borderRadius={12} />
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
        <div className="bmb-section-container py-6 space-y-5">
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

/** Search / collection restaurant list — matches DiningSearchPage RestaurantCard grid. */
export function DiningSearchShimmer({ count = 6 }: { count?: number }) {
  return (
    <Wrap>
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        aria-busy="true"
        aria-label="Loading restaurants"
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex h-full flex-col bg-[#F5F5F5] rounded-2xl border border-[#E5E5E5] shadow-sm p-3"
          >
            <div className="relative h-52 sm:h-56 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
              <Skeleton
                className="!absolute !inset-0 !block !h-full !w-full !rounded-2xl"
                height="100%"
              />
            </div>
            <div className="flex flex-col flex-1 px-0.5 pt-3.5 pb-1 min-w-0">
              <div className="flex justify-between items-start gap-2 mb-2">
                <Skeleton width="68%" height={22} className="sm:!h-6" />
                <Skeleton width={44} height={22} borderRadius={6} />
              </div>
              <div className="space-y-1.5">
                <Skeleton width="72%" height={14} />
                <div className="flex items-center justify-between gap-2">
                  <Skeleton width="55%" height={14} />
                  <Skeleton width={72} height={14} />
                </div>
                <Skeleton width="48%" height={14} />
              </div>
              <div className="mt-auto pt-7 w-full">
                <Skeleton height={42} borderRadius={12} />
              </div>
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

/** Partner live/past event poster cards — matches PartnerLiveEventsSection grid */
export function PartnerEventsSectionShimmer({ count = 3 }: { count?: number }) {
  return (
    <Wrap>
      <div className="space-y-8 sm:space-y-10" aria-busy="true" aria-label="Loading events">
        <section>
          <Skeleton width="8rem" height={28} className="sm:!h-8 sm:!w-40" />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-5 sm:gap-4 md:grid-cols-3 lg:grid-cols-3 lg:gap-5">
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                className="min-w-0 flex h-full w-full flex-col overflow-hidden rounded-xl border border-[#E5E5E5] bg-white sm:rounded-2xl"
              >
                <div className="aspect-[3/4] w-full overflow-hidden">
                  <Skeleton className="!block !h-full !w-full !rounded-none" height="100%" />
                </div>
                <div className="space-y-2 px-2.5 py-2.5 sm:px-3 sm:py-3">
                  <Skeleton width="55%" height={12} />
                  <Skeleton width="90%" height={16} />
                  <Skeleton width="70%" height={12} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Wrap>
  );
}

/** Public artist detail page — matches PublicArtistProfilePage hero + body */
export function ArtistDetailShimmer() {
  return (
    <Wrap>
      <div className="min-h-screen bg-white" aria-busy="true" aria-label="Loading artist">
        <header className="relative w-full overflow-hidden bg-[#EDE4F7]/40">
          <div className="relative z-10 bmb-section-container py-6 sm:py-8 md:py-10">
            <Skeleton width="6rem" height={16} />
            <div className="mt-5 flex flex-col items-start gap-6 sm:gap-8 md:mt-7 md:flex-row md:items-center md:gap-8 lg:gap-10">
              <div className="h-56 w-56 shrink-0 overflow-hidden rounded-2xl sm:h-64 sm:w-64 md:h-72 md:w-72 lg:h-100 lg:w-100">
                <Skeleton className="!block !h-full !w-full !rounded-2xl" height="100%" />
              </div>
              <div className="min-w-0 flex-1 space-y-3 w-full">
                <Skeleton width="8rem" height={14} />
                <Skeleton width="60%" height={40} className="!max-w-md sm:!h-12" />
                <Skeleton count={3} />
                <Skeleton width="70%" />
                <Skeleton width="8rem" height={44} borderRadius={12} className="mt-2" />
              </div>
            </div>
          </div>
        </header>
        <div className="bg-white bmb-section-container py-8 sm:py-10">
          <div className="flex flex-col items-stretch gap-8 lg:flex-row lg:items-start lg:gap-10">
            <div className="min-w-0 flex-1 space-y-8 sm:space-y-10">
              <PartnerEventsSectionShimmer count={3} />
              <div>
                <Skeleton width="6rem" height={28} className="mb-4" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="aspect-square overflow-hidden rounded-xl">
                      <Skeleton className="!block !h-full !w-full !rounded-xl" height="100%" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <aside className="w-full shrink-0 lg:w-[24.5rem]">
              <div className="rounded-[1.5rem] border border-[#F0EAF7] bg-white p-5 sm:p-6 space-y-4 shadow-[0_10px_30px_rgba(105,0,170,0.07)]">
                <Skeleton width="9rem" height={22} />
                <Skeleton width="90%" height={14} />
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} height={42} borderRadius={12} />
                ))}
                <Skeleton height={48} borderRadius={12} />
              </div>
            </aside>
          </div>
        </div>
      </div>
    </Wrap>
  );
}

/** Public venue detail page — matches PublicVenueProfilePage hero + body */
export function VenueDetailShimmer() {
  return (
    <Wrap>
      <div className="min-h-screen bg-white overflow-x-hidden" aria-busy="true" aria-label="Loading venue">
        <div className="bmb-section-container pt-5 sm:pt-6">
          <Skeleton width="6.5rem" height={16} />
        </div>
        <header className="bmb-section-container pt-4 pb-2 sm:pt-5 sm:pb-3">
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl min-h-[220px] sm:min-h-[280px] md:min-h-[320px] lg:min-h-[360px] bg-slate-200">
            <Skeleton className="!absolute !inset-0 !block !h-full !w-full !rounded-2xl sm:!rounded-3xl" height="100%" />
          </div>
        </header>
        <div className="bg-white bmb-section-container py-6 sm:py-8 md:py-10">
          <div className="flex flex-col items-stretch gap-8 lg:flex-row lg:items-start lg:gap-5">
            <div className="min-w-0 flex-1 space-y-8 sm:space-y-10">
              <div className="space-y-3">
                <Skeleton width="9rem" height={28} />
                <Skeleton count={4} />
                <Skeleton width="75%" />
              </div>
              <PartnerEventsSectionShimmer count={3} />
              <div>
                <Skeleton width="5rem" height={28} className="mb-4" />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="aspect-[4/3] overflow-hidden rounded-xl">
                      <Skeleton className="!block !h-full !w-full !rounded-xl" height="100%" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-full max-w-md sm:max-w-lg space-y-3">
                <Skeleton width="12rem" height={28} />
                <Skeleton width="80%" height={14} />
                <Skeleton height={280} borderRadius={16} />
              </div>
            </div>
            <aside className="w-full shrink-0 max-w-xl lg:max-w-none lg:w-[min(100%,32rem)]">
              <div className="rounded-[1.25rem] sm:rounded-[1.5rem] border border-[#F0EAF7] bg-white p-4 sm:p-5 md:p-6 space-y-4 shadow-[0_10px_30px_rgba(105,0,170,0.07)]">
                <Skeleton width="11rem" height={22} />
                <Skeleton width="90%" height={14} />
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} height={42} borderRadius={12} />
                ))}
                <Skeleton height={48} borderRadius={12} />
              </div>
            </aside>
          </div>
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

/* ─── Customer account (profile sidebar pages) ───────────────────────────── */

/** Left account nav + main content shell — matches CustomerAccountLayout */
export function CustomerAccountShellShimmer({
  children,
}: {
  children?: ReactNode;
}) {
  return (
    <Wrap>
      <div
        className="bg-[#f4f5f7] min-h-[calc(100vh-4rem)] pt-2 pb-4 sm:pt-3 sm:pb-6 lg:pt-4 lg:pb-8"
        aria-busy="true"
        aria-label="Loading account"
      >
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 items-start">
            <aside className="hidden lg:block w-[260px] shrink-0">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2">
                <div className="flex items-center gap-3 px-2 py-3">
                  <Skeleton circle width={48} height={48} />
                  <div className="flex-1 space-y-2 min-w-0">
                    <Skeleton width="70%" height={14} />
                    <Skeleton width="90%" height={10} />
                  </div>
                </div>
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} height={40} borderRadius={12} />
                ))}
                <Skeleton height={40} borderRadius={12} className="mt-2" />
              </div>
            </aside>
            <div className="flex-1 min-w-0 w-full">
              {children ?? <CustomerOrdersListShimmer />}
            </div>
          </div>
        </div>
      </div>
    </Wrap>
  );
}

/** My Orders / Reservations list — matches dashboard booking rows */
export function CustomerOrdersListShimmer({ rows = 4 }: { rows?: number }) {
  return (
    <Wrap>
      <div
        className="bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(15,23,42,0.04)] p-5 sm:p-6 lg:p-8"
        aria-busy="true"
        aria-label="Loading orders"
      >
        <div className="mb-6 space-y-2">
          <Skeleton width="16rem" height={28} className="sm:!h-9" />
          <Skeleton width="70%" height={14} />
        </div>
        <div className="border-b border-slate-200 mb-4 pb-3 flex gap-5 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width={64} height={16} />
          ))}
        </div>
        <div className="flex gap-2 mb-6 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width={88} height={32} borderRadius={999} />
          ))}
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col sm:flex-row sm:items-start gap-4 py-5 first:pt-2"
            >
              <div className="w-full sm:w-[168px] lg:w-[188px] aspect-[16/10] sm:aspect-auto sm:h-[108px] lg:h-[118px] shrink-0 overflow-hidden rounded-xl">
                <Skeleton className="!block !h-full !w-full !rounded-xl" height="100%" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton width={56} height={18} borderRadius={6} />
                <Skeleton width="55%" height={18} />
                <Skeleton width="80%" height={12} />
                <Skeleton width="45%" height={12} />
                <Skeleton width="30%" height={12} />
              </div>
              <div className="shrink-0 flex sm:flex-col items-end gap-3">
                <Skeleton width={88} height={24} borderRadius={999} />
                <Skeleton width={72} height={14} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Wrap>
  );
}

/** My Profile card — matches profile personal-details layout */
export function CustomerProfileShimmer() {
  return (
    <Wrap>
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 lg:p-10"
        aria-busy="true"
        aria-label="Loading profile"
      >
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-200">
          <Skeleton circle width={72} height={72} />
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton width="40%" height={20} />
            <Skeleton width="55%" height={14} />
          </div>
        </div>
        <div className="flex items-center justify-between mb-4">
          <Skeleton width="10rem" height={22} />
          <Skeleton width={64} height={16} />
        </div>
        <div className="space-y-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-2 sm:gap-4">
              <Skeleton width="6rem" height={14} />
              <Skeleton height={40} borderRadius={10} />
            </div>
          ))}
        </div>
      </div>
    </Wrap>
  );
}

/** Simple white account card (change password / help) */
export function CustomerAccountCardShimmer({ lines = 4 }: { lines?: number }) {
  return (
    <Wrap>
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-lg space-y-4"
        aria-busy="true"
        aria-label="Loading"
      >
        <Skeleton width="10rem" height={22} />
        <Skeleton width="80%" height={12} />
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} height={42} borderRadius={10} />
        ))}
        <Skeleton width="8rem" height={44} borderRadius={12} />
      </div>
    </Wrap>
  );
}

/** Dining / generic booking detail page */
export function CustomerBookingDetailShimmer() {
  return (
    <Wrap>
      <div
        className="min-h-screen bg-[#F5F5F7] pt-8 sm:pt-10 pb-12 sm:pb-16"
        aria-busy="true"
        aria-label="Loading booking"
      >
        <div className="bmb-section-container space-y-5 sm:space-y-6">
          <Skeleton width="9rem" height={16} />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2 min-w-0 flex-1">
              <Skeleton width="14rem" height={32} className="sm:!h-9" />
              <Skeleton width="10rem" height={14} />
            </div>
            <Skeleton width={96} height={28} borderRadius={999} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
              <div className="flex gap-4">
                <div className="w-28 h-36 shrink-0 overflow-hidden rounded-xl">
                  <Skeleton className="!block !h-full !w-full !rounded-xl" height="100%" />
                </div>
                <div className="flex-1 space-y-2">
                  <Skeleton width="70%" height={20} />
                  <Skeleton width="90%" height={12} count={3} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} height={64} borderRadius={12} />
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <Skeleton className="!mx-auto" width={160} height={160} borderRadius={12} />
              <Skeleton width="60%" height={14} className="!mx-auto" />
              <Skeleton height={44} borderRadius={12} />
              <Skeleton height={44} borderRadius={12} />
            </div>
          </div>
        </div>
      </div>
    </Wrap>
  );
}

/** My Gift Cards wallet list — `embedded` skips outer chrome when page already has it */
export function CustomerGiftCardsShimmer({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const grid = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-100 p-4 space-y-3"
        >
          <Skeleton height={120} borderRadius={12} />
          <Skeleton width="55%" height={16} />
          <Skeleton width="40%" height={12} />
        </div>
      ))}
    </div>
  );

  if (embedded) {
    return (
      <Wrap>
        <div aria-busy="true" aria-label="Loading gift cards" className="py-2">
          {grid}
        </div>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-5"
        aria-busy="true"
        aria-label="Loading gift cards"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton width="10rem" height={24} />
          <Skeleton width={120} height={36} borderRadius={10} />
        </div>
        <div className="flex gap-2">
          <Skeleton width={88} height={36} borderRadius={999} />
          <Skeleton width={88} height={36} borderRadius={999} />
        </div>
        {grid}
      </div>
    </Wrap>
  );
}

/** Single gift card detail — `embedded` skips outer chrome when page already has it */
export function CustomerGiftCardDetailShimmer({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const body = (
    <>
      {!embedded && <Skeleton width="7rem" height={16} />}
      <Skeleton height={160} borderRadius={16} />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={56} borderRadius={12} />
        ))}
      </div>
      <Skeleton height={48} borderRadius={12} />
    </>
  );

  if (embedded) {
    return (
      <Wrap>
        <div
          className="space-y-4 sm:space-y-5"
          aria-busy="true"
          aria-label="Loading gift card"
        >
          {body}
        </div>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4 sm:space-y-5"
        aria-busy="true"
        aria-label="Loading gift card"
      >
        {body}
      </div>
    </Wrap>
  );
}

/**
 * List Your Show + partner landing pages (business / movie / artist / venue / organizer).
 * Visual shell only — matches BMS partner landing structure.
 */
export function ListYourShowLandingShimmer({
  hideHeader = false,
  variant = "bms",
  hostOnly = false,
}: {
  hideHeader?: boolean;
  /** `split` = dining-style hero; `bms` = feature slider + peek cards */
  variant?: "bms" | "split";
  hostOnly?: boolean;
}) {
  const container = "bmb-section-container";

  return (
    <Wrap>
      <div
        className="min-h-screen bg-white"
        aria-busy="true"
        aria-label="Loading partner page"
      >
        {!hideHeader ? (
          <div className="sticky top-0 z-10 border-b border-[#EBEBEB] bg-white">
            <div className={`${container} flex items-center justify-between h-[72px]`}>
              <Skeleton width={140} height={40} borderRadius={8} />
              <div className="flex items-center gap-3">
                <Skeleton width={110} height={14} />
                <Skeleton width={72} height={36} borderRadius={8} />
              </div>
            </div>
          </div>
        ) : null}

        <div className={container}>
          {variant === "split" ? (
            <div className="py-8 sm:py-10 md:py-12 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-center">
              <div className="space-y-4">
                <Skeleton width="85%" height={40} className="sm:!h-12" />
                <Skeleton width="95%" height={14} count={3} />
                <div className="flex flex-wrap gap-3 pt-2">
                  <Skeleton width={160} height={44} borderRadius={10} />
                  <Skeleton width={160} height={44} borderRadius={10} />
                </div>
                <Skeleton width={180} height={12} />
              </div>
              <Skeleton
                className="!w-full !rounded-bl-[2.5rem] sm:!rounded-bl-[4rem]"
                height={360}
              />
            </div>
          ) : (
            <div className="pt-6 sm:pt-8 pb-4">
              <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
                <Skeleton
                  className="!flex-1 !min-h-[300px] sm:!min-h-[340px] md:!min-h-[380px]"
                  borderRadius={20}
                  height={380}
                />
                <div className="hidden lg:flex gap-3 shrink-0">
                  <Skeleton width={220} height={380} borderRadius={20} />
                  <Skeleton width={220} height={380} borderRadius={20} />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Skeleton circle width={40} height={40} />
                <Skeleton circle width={40} height={40} />
              </div>
            </div>
          )}

          {/* Host / type cards */}
          <div className="py-12 md:py-16 border-t border-[#F0F0F0]">
            <div className="text-center max-w-[820px] mx-auto space-y-3">
              <Skeleton width="55%" height={32} className="!mx-auto sm:!h-9" />
              {!hostOnly ? null : (
                <Skeleton width="80%" height={14} className="!mx-auto" count={2} />
              )}
              {variant === "split" ? (
                <Skeleton width="40%" height={28} className="!mx-auto" />
              ) : (
                <Skeleton width="70%" height={14} className="!mx-auto" count={2} />
              )}
            </div>
            <div className="mt-8 sm:mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {Array.from({ length: hostOnly ? 8 : 4 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-xl border border-[#EDEDED]">
                  <Skeleton className="!block !w-full !rounded-none" height={160} />
                  <div className="px-4 py-4">
                    <Skeleton width="60%" height={18} className="!mx-auto" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Services / features */}
          <div className="py-12 md:py-16 border-t border-[#F0F0F0]">
            <div className="text-center max-w-[820px] mx-auto space-y-3">
              <Skeleton width="50%" height={32} className="!mx-auto" />
              <Skeleton width="75%" height={14} className="!mx-auto" count={2} />
            </div>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-[#EDEDED] bg-white p-6 flex flex-col items-center gap-3"
                >
                  <Skeleton circle width={40} height={40} />
                  <Skeleton width="70%" height={18} />
                  <Skeleton width="90%" height={12} count={2} />
                  <Skeleton circle width={28} height={28} />
                </div>
              ))}
            </div>
            <div className="mt-10 flex justify-center">
              <Skeleton width={180} height={44} borderRadius={10} />
            </div>
          </div>
        </div>
      </div>
    </Wrap>
  );
}

/** Partner panels (dining, cinema, events, venue, artist): sidebar, header, and list. */
export function PartnerPanelShimmer() {
  return (
    <Wrap>
      <div className="min-h-screen bg-slate-50 flex" aria-busy="true" aria-label="Loading panel">
        <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="h-16 border-b border-slate-200 px-4 flex items-center gap-3">
            <Skeleton circle width={36} height={36} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton width="70%" height={14} />
              <Skeleton width="45%" height={10} />
            </div>
          </div>
          <div className="p-3 space-y-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                <Skeleton width={18} height={18} borderRadius={4} />
                <Skeleton width={i % 3 === 0 ? "62%" : "48%"} height={14} />
              </div>
            ))}
          </div>
        </aside>
        <div className="flex-1 min-w-0">
          <header className="h-16 border-b border-slate-200 bg-white px-4 sm:px-8 flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton width={160} height={18} />
              <Skeleton width={240} height={12} className="hidden sm:block" />
            </div>
            <Skeleton circle width={36} height={36} />
          </header>
          <div className="p-3 sm:p-4 md:p-6 lg:p-8">
            <AdminListShimmer rows={6} columns={5} showPagination={false} />
          </div>
        </div>
      </div>
    </Wrap>
  );
}

/** Login, reset password, and other centered auth cards. */
export function AuthFormShimmer() {
  return (
    <Wrap>
      <div
        className="min-h-[calc(100dvh-72px)] flex items-center justify-center bg-slate-50 px-4"
        aria-busy="true"
        aria-label="Loading"
      >
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-4">
          <Skeleton width={48} height={48} borderRadius={12} />
          <Skeleton width="55%" height={28} />
          <Skeleton width="80%" height={14} />
          <Skeleton height={44} borderRadius={10} />
          <Skeleton height={44} borderRadius={10} />
          <Skeleton height={46} borderRadius={10} />
        </div>
      </div>
    </Wrap>
  );
}

/** Partner dashboard: stat cards, then a list. */
export function DashboardShimmer() {
  return (
    <Wrap>
      <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <Skeleton width={36} height={36} borderRadius={10} />
              <Skeleton width="50%" height={12} />
              <Skeleton width="70%" height={26} />
            </div>
          ))}
        </div>
        <AdminListShimmer rows={5} columns={4} showToolbar={false} showPagination={false} />
      </div>
    </Wrap>
  );
}

/** Edit and detail forms: title plus stacked fields. */
export function DetailFormShimmer({ fields = 6 }: { fields?: number }) {
  return (
    <Wrap>
      <div className="w-full space-y-4" aria-busy="true" aria-label="Loading">
        <Skeleton width={220} height={28} />
        <Skeleton width="36%" height={14} />
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          {Array.from({ length: fields }).map((_, i) => (
            <div key={i}>
              <Skeleton width={96} height={12} className="mb-2" />
              <Skeleton height={42} borderRadius={10} />
            </div>
          ))}
          <Skeleton width={148} height={42} borderRadius={10} />
        </div>
      </div>
    </Wrap>
  );
}

/** Cinema / movie showtime rows. */
export function ShowtimeListShimmer({ count = 3 }: { count?: number }) {
  return (
    <Wrap>
      <div className="space-y-4" aria-busy="true" aria-label="Loading showtimes">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[#E8E2F2] bg-white p-4 sm:p-5 flex gap-4">
            <Skeleton width={72} height={108} borderRadius={10} className="shrink-0" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton width="46%" height={20} />
              <Skeleton width="28%" height={12} />
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3].map((slot) => (
                  <Skeleton key={slot} width={76} height={36} borderRadius={8} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Wrap>
  );
}

/** Seat map placeholder matching the booking map frame. */
export function SeatMapShimmer({
  className = "",
  fill = false,
}: {
  className?: string;
  fill?: boolean;
}) {
  return (
    <Wrap>
      <div
        className={`flex ${fill ? "h-full min-h-0" : "h-[550px] min-h-[320px]"} flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-slate-100 px-6 ${className}`}
        aria-busy="true"
        aria-label="Loading seating map"
      >
        <Skeleton width={180} height={10} borderRadius={999} />
        <div className="grid grid-cols-8 sm:grid-cols-12 gap-1.5">
          {Array.from({ length: 48 }).map((_, i) => (
            <Skeleton key={i} width={18} height={18} borderRadius={4} />
          ))}
        </div>
      </div>
    </Wrap>
  );
}
