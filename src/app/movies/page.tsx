"use client";

import { Suspense } from "react";
import MovieLandingPage from "@/components/MovieLandingPage/MovieLandingPage";
import { MovieGridShimmer } from "@/components/Shared/Shimmer";

export default function MoviesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white container mx-auto px-4 sm:px-5 md:px-6 lg:px-8 xl:px-10 2xl:px-0 pt-10">
          <MovieGridShimmer />
        </div>
      }
    >
      <MovieLandingPage />
    </Suspense>
  );
}
