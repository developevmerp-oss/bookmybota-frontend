"use client";

import { Suspense } from "react";
import AdminMarketingPage from "@/components/SuperAdmin/AdminMarketingPage";

export default function MarketingPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full py-16 text-center text-sm text-zinc-500">Loading marketing…</div>
      }
    >
      <AdminMarketingPage />
    </Suspense>
  );
}
