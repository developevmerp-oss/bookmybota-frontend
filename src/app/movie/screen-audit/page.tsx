"use client";

import { Suspense } from "react";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import MovieScreenAuditPage from "@/components/MovieAdminPanel/MovieScreenAuditPage";

export default function MovieScreenAuditRoutePage() {
  return (
    <Suspense fallback={<AdminListShimmer rows={6} columns={5} />}>
      <MovieScreenAuditPage />
    </Suspense>
  );
}
