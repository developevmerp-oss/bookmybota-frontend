"use client";

import { Suspense } from "react";
import MovieShowtimesPage from "@/components/MovieAdminPanel/MovieShowtimesPage";

export default function MovieShowtimesRoutePage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-400">Loading showtimes…</div>}>
      <MovieShowtimesPage />
    </Suspense>
  );
}
