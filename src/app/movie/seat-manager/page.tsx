"use client";

import { Suspense } from "react";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import MovieSeatManagerPage from "@/components/MovieAdminPanel/MovieSeatManagerPage";

export default function MovieSeatManagerRoutePage() {
  return (
    <Suspense fallback={<AdminListShimmer rows={6} columns={5} />}>
      <MovieSeatManagerPage />
    </Suspense>
  );
}
