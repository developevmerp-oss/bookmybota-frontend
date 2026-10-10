"use client";

import { Suspense } from "react";
import DiningHomePage from "@/components/DinningLandingPage/DiningHomePage";
import { DiningHomeRestaurantShimmer } from "@/components/Shared/Shimmer";

export default function DiningPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white bmb-section-container pt-10">
          <DiningHomeRestaurantShimmer />
        </div>
      }
    >
      <DiningHomePage />
    </Suspense>
  );
}
