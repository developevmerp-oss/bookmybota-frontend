"use client";

import { Suspense } from "react";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import MovieCounterBookingPage from "@/components/MovieAdminPanel/MovieCounterBookingPage";

export default function MovieNewBookingRoutePage() {
  return (
    <Suspense fallback={<AdminListShimmer />}>
      <MovieCounterBookingPage />
    </Suspense>
  );
}
