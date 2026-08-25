"use client";

import { useParams } from "next/navigation";
import PublicVenueProfilePage from "@/components/VenueAdminPanel/PublicVenueProfilePage";

export default function PublicVenuePage() {
  const params = useParams();
  const id = String(params?.id || "");
  if (!id) {
    return <div className="p-10 text-center text-slate-500">Venue not found.</div>;
  }
  return <PublicVenueProfilePage venueId={id} />;
}
