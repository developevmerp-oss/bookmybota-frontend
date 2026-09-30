"use client";

import { Suspense } from "react";
import MovieShowtimesPage from "@/components/MovieLandingPage/MovieShowtimesPage";
import { CustomerFullscreenShimmer } from "@/components/Shared/Shimmer";

export default function ShowtimesRoutePage() {
  return (
    <Suspense fallback={<CustomerFullscreenShimmer />}>
      <MovieShowtimesPage />
    </Suspense>
  );
}
