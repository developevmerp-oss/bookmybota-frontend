"use client";

import { Suspense } from "react";
import DiningHomePage from "@/components/DinningLandingPage/DiningHomePage";
import { DiningHomeRestaurantShimmer } from "@/components/Shared/Shimmer";

export default function DiningPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 pt-10">
          <DiningHomeRestaurantShimmer />
        </div>
      }
    >
      <DiningHomePage />
    </Suspense>
  );
}
