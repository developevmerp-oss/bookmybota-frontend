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
