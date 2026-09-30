"use client";

import { Suspense } from "react";
import MovieLandingPage from "@/components/MovieLandingPage/MovieLandingPage";
import { MovieGridShimmer } from "@/components/Shared/Shimmer";

export default function MoviesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 pt-10">
          <MovieGridShimmer />
        </div>
      }
    >
      <MovieLandingPage />
    </Suspense>
  );
}
