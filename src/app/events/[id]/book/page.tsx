"use client";

import { Suspense } from "react";
import EventBookingPage from "@/components/EventLandingPage/EventBookingPage";
import { EventBookingShimmer } from "@/components/Shared/Shimmer";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<EventBookingShimmer />}>
      <EventBookingPage params={params} />
    </Suspense>
  );
}
