"use client";

import { useAppSelector } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import ArtistLandingPage from "@/components/ArtistAdminPanel/ArtistLandingPage";
import { ListYourShowLandingShimmer } from "@/components/Shared/Shimmer";

export default function ArtistHomePage() {
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const isArtist = user?.role === "artist_admin";

  useEffect(() => {
    if (isArtist) router.replace("/artist/profile");
  }, [isArtist, router]);

  if (isArtist) {
    return <ListYourShowLandingShimmer variant="split" />;
  }

  return <ArtistLandingPage />;
}
