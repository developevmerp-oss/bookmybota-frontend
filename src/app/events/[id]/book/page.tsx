"use client";

import { Suspense } from "react";
import EventBookingPage from "@/components/EventLandingPage/EventBookingPage";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="text-center py-20 text-[1rem] text-slate-500">Loading booking…</div>
      }
    >
      <EventBookingPage params={params} />
    </Suspense>
  );
}
