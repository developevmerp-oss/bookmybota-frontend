"use client";

import { Suspense } from "react";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import MoviePartnerBookingsPage from "@/components/MovieAdminPanel/MoviePartnerBookingsPage";

export default function MovieBookingsRoutePage() {
  return (
    <Suspense fallback={<AdminListShimmer />}>
      <MoviePartnerBookingsPage />
    </Suspense>
  );
}
