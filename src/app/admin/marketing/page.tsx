"use client";

import { Suspense } from "react";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import AdminMarketingPage from "@/components/SuperAdmin/AdminMarketingPage";

export default function MarketingPage() {
  return (
    <Suspense
      fallback={
        <AdminListShimmer showTabs />
      }
    >
      <AdminMarketingPage />
    </Suspense>
  );
}
