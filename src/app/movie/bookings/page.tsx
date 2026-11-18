"use client";

import { Suspense } from "react";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import MovieBookingsHubPage from "@/components/MovieAdminPanel/MovieBookingsHubPage";

export default function MovieBookingsRoutePage() {
  return (
    <Suspense fallback={<AdminListShimmer />}>
      <MovieBookingsHubPage />
    </Suspense>
  );
}
