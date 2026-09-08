"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Availability module removed — redirect to profile. */
export default function ArtistAvailabilityRoute() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/artist/profile");
  }, [router]);
  return (
    <div className="p-10 text-center text-muted-foreground text-sm">Redirecting…</div>
  );
}
