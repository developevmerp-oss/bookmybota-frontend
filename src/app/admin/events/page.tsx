"use client";

import { Suspense } from "react";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import AdminEventsListPage from "@/components/SuperAdmin/AdminEventsListPage";

export default function Page() {
  return (
    <Suspense fallback={<AdminListShimmer />}>
      <AdminEventsListPage />
    </Suspense>
  );
}
