"use client";

import { Suspense, use } from "react";
import CinemaDetailPage from "@/components/MovieLandingPage/CinemaDetailPage";
import { CustomerFullscreenShimmer } from "@/components/Shared/Shimmer";

interface PageProps {
  params: Promise<{ id: string }>;
}

function CinemaDetailRouteInner({ params }: PageProps) {
  const { id } = use(params);
  return <CinemaDetailPage cinemaId={id} />;
}

export default function CinemaDetailRoutePage({ params }: PageProps) {
  return (
    <Suspense fallback={<CustomerFullscreenShimmer />}>
      <CinemaDetailRouteInner params={params} />
    </Suspense>
  );
}
