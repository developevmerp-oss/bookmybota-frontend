"use client";

import { Suspense, use } from "react";
import MovieSeatLayoutPage from "@/components/MovieLandingPage/MovieSeatLayoutPage";
import { CustomerFullscreenShimmer } from "@/components/Shared/Shimmer";

interface PageProps {
  params: Promise<{ showtimeId: string }>;
}

function MovieBookFallback() {
  return <CustomerFullscreenShimmer label="Loading booking" />;
}

export default function MovieBookShowtimePage({ params }: PageProps) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<MovieBookFallback />}>
      <MovieSeatLayoutPage showtimeId={resolvedParams.showtimeId} />
    </Suspense>
  );
}
