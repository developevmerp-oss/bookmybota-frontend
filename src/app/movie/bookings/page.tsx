"use client";

import { Suspense } from "react";
import MoviePartnerBookingsPage from "@/components/MovieAdminPanel/MoviePartnerBookingsPage";

export default function MovieBookingsRoutePage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-400">Loading bookings…</div>}>
      <MoviePartnerBookingsPage />
    </Suspense>
  );
}
