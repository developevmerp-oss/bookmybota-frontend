"use client";

import { useParams } from "next/navigation";
import PublicArtistProfilePage from "@/components/ArtistAdminPanel/PublicArtistProfilePage";

export default function PublicArtistPage() {
  const params = useParams();
  const id = String(params?.id || "");
  if (!id) {
    return <div className="p-10 text-center text-slate-500">Artist not found.</div>;
  }
  return <PublicArtistProfilePage artistId={id} />;
}
