"use client";

import { Suspense } from "react";
import MovieLandingPage from "@/components/MovieLandingPage/MovieLandingPage";
import { MovieGridShimmer } from "@/components/Shared/Shimmer";

export default function MoviesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white bmb-section-container pt-10">
          <MovieGridShimmer />
        </div>
      }
    >
      <MovieLandingPage />
    </Suspense>
  );
}
