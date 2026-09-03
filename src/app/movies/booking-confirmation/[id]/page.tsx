"use client";

import { use } from "react";
import MovieBookingConfirmationPage from "@/components/MovieLandingPage/MovieBookingConfirmationPage";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function MovieBookingConfirmationRoute({ params }: PageProps) {
  const resolvedParams = use(params);
  return <MovieBookingConfirmationPage bookingId={resolvedParams.id} />;
}
