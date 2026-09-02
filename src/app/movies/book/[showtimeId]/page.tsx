"use client";

import { use } from "react";
import MovieSeatLayoutPage from "@/components/MovieLandingPage/MovieSeatLayoutPage";

interface PageProps {
  params: Promise<{ showtimeId: string }>;
}

export default function MovieBookShowtimePage({ params }: PageProps) {
  const resolvedParams = use(params);
  return <MovieSeatLayoutPage showtimeId={resolvedParams.showtimeId} />;
}
