"use client";

import { Suspense } from "react";
import EventsListPage from "@/components/EventLandingPage/EventsListPage";
import { EventListShimmer } from "@/components/Shared/Shimmer";

export default function EventsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white container mx-auto px-4 sm:px-5 md:px-6 lg:px-8 xl:px-10 2xl:px-0 pt-10">
          <EventListShimmer />
        </div>
      }
    >
      <EventsListPage />
    </Suspense>
  );
}
