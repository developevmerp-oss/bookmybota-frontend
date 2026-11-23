"use client";

import { Suspense } from "react";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import MovieShowsSeatsPage from "@/components/MovieAdminPanel/MovieShowsSeatsPage";

export default function MovieShowsSeatsRoutePage() {
  return (
    <Suspense fallback={<AdminListShimmer rows={6} columns={5} />}>
      <MovieShowsSeatsPage />
    </Suspense>
  );
}
