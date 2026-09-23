"use client";

import { Suspense } from "react";
import AdminEventsListPage from "@/components/SuperAdmin/AdminEventsListPage";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400 text-sm">Loading events...</div>}>
      <AdminEventsListPage />
    </Suspense>
  );
}
