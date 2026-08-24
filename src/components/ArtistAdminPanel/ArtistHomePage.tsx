"use client";

import { useAppSelector } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import ArtistLandingPage from "@/components/ArtistAdminPanel/ArtistLandingPage";

export default function ArtistHomePage() {
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const isArtist = user?.role === "artist_admin";

  useEffect(() => {
    if (isArtist) router.replace("/artist/profile");
  }, [isArtist, router]);

  if (isArtist) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-medium">
        Loading...
      </div>
    );
  }

  return <ArtistLandingPage />;
}
