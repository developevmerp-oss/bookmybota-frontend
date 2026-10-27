"use client";

import { Suspense } from "react";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import MovieShowtimesPage from "@/components/MovieAdminPanel/MovieShowtimesPage";

export default function MovieShowtimesRoutePage() {
  return (
    <Suspense fallback={<AdminListShimmer rows={6} columns={5} />}>
      <MovieShowtimesPage />
    </Suspense>
  );
}
