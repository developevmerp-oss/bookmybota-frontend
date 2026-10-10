"use client";

import { Suspense } from "react";
import EventsListPage from "@/components/EventLandingPage/EventsListPage";
import { EventListShimmer } from "@/components/Shared/Shimmer";

export default function EventsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white bmb-section-container pt-10">
          <EventListShimmer />
        </div>
      }
    >
      <EventsListPage />
    </Suspense>
  );
}
