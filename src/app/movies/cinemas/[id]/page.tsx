"use client";

import { use } from "react";
import CinemaDetailPage from "@/components/MovieLandingPage/CinemaDetailPage";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CinemaDetailRoutePage({ params }: PageProps) {
  const { id } = use(params);
  return <CinemaDetailPage cinemaId={id} />;
}
