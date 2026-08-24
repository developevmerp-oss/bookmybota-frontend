"use client";

import { useAppSelector } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import VenueLandingPage from "@/components/VenueAdminPanel/VenueLandingPage";

export default function VenueHomePage() {
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const isVenue = user?.role === "venue_admin";

  useEffect(() => {
    if (isVenue) router.replace("/venue/profile");
  }, [isVenue, router]);

  if (isVenue) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-medium">
        Loading...
      </div>
    );
  }

  return <VenueLandingPage />;
}
