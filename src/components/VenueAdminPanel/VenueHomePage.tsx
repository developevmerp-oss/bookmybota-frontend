"use client";

import { useAppSelector } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import VenueLandingPage from "@/components/VenueAdminPanel/VenueLandingPage";
import { ListYourShowLandingShimmer } from "@/components/Shared/Shimmer";

export default function VenueHomePage() {
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const isVenue = user?.role === "venue_admin";

  useEffect(() => {
    if (isVenue) router.replace("/venue/profile");
  }, [isVenue, router]);

  if (isVenue) {
    return <ListYourShowLandingShimmer variant="split" />;
  }

  return <VenueLandingPage />;
}
