"use client";

import { Suspense } from "react";
import CinemaListingPage from "@/components/MovieLandingPage/CinemaListingPage";
import { CinemaListShimmer } from "@/components/Shared/Shimmer";

export default function MoviesCinemasPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f5f5f5] container mx-auto px-4 py-8">
          <CinemaListShimmer count={6} />
        </div>
      }
    >
      <CinemaListingPage />
    </Suspense>
  );
}
