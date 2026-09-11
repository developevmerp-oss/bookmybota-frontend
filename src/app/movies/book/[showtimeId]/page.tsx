"use client";

import { Suspense, use } from "react";
import { Loader2 } from "lucide-react";
import MovieSeatLayoutPage from "@/components/MovieLandingPage/MovieSeatLayoutPage";

interface PageProps {
  params: Promise<{ showtimeId: string }>;
}

function MovieBookFallback() {
  return (
    <div className="min-h-screen bg-[#F5F5F7] text-slate-900 flex flex-col items-center justify-center gap-3">
      <Loader2 className="size-10 animate-spin text-[#F84464]" />
      <p className="text-sm font-medium text-slate-500">Loading booking…</p>
    </div>
  );
}

export default function MovieBookShowtimePage({ params }: PageProps) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<MovieBookFallback />}>
      <MovieSeatLayoutPage showtimeId={resolvedParams.showtimeId} />
    </Suspense>
  );
}
